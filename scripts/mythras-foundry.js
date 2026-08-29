import { defaultItemIcon } from "./data/item-icons.js";
import { actorIncapacitatedState, syncIncapacitatedStatus
} from "./documents/mythras-actor.js";
import { calculateLocationHitPoints, permanentWoundState,
  recoversDisabledLocation, worstWoundLevel } from "./rules/hit-locations.js";
import { normalizeWeaponProfile, parseWeaponProfileReferences } from "./rules/combat.js";
import { calculateDerivedAttributes } from "./rules/derived-attributes.js";
import { parseBackgroundDraft, serializeBackgroundDraft,
  styleAbilityKey } from "./rules/background-generation.js";
import { legacyWeaponMode } from "./rules/weapon-modes.js";
import { conditionDescriptors, resolveConditions } from "./rules/condition-resolver.js";
import { configureNewArmorPiece } from "./apps/armor-piece-configurator.js";
import { ARMOR_MATERIAL_MODIFIERS, armorLocationForReference,
  armorPieceTypeForLocation } from "./rules/armor.js";
import { isGenericItemName, nextNumberedItemName } from "./rules/item-names.js";
import { fumbledSkillUpdatesAtZero } from "./rules/skills.js";
import { traitSlug } from "./rules/traits.js";
import { calculateNpcAttributes } from "./rules/npc.js";
import { regenerateNpcActor } from "./rules/npc-token.js";
import { getActionPointRules } from "./settings.js";
import { INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG,
  INCAPACITATED_STATUS_ID } from "./rules/incapacitated.js";
import { registerSystemInitialization } from "./system/registration.js";
import { registerUiHooks } from "./system/ui-hooks.js";
import { clearAim } from "./rules/ranged-actions.js";
import { resolveActorConditions } from "./rules/actor-conditions.js";
import { synchronizeFatigueDeath } from "./rules/death.js";
import { initializeCreatedActor, isPrimaryActiveGM,
  runWorldMigrations } from "./migrations/index.js";

registerSystemInitialization();
registerUiHooks();

Hooks.on("updateToken", (token, changed, options, userId) => {
  if (userId === game.user.id && (Object.hasOwn(changed, "x") || Object.hasOwn(changed, "y") || Object.hasOwn(changed, "elevation"))
    && token.actor) clearAim(token.actor);
});

Hooks.on("createActiveEffect", (effect, options, userId) => {
  const actor = effect.parent;
  if (userId === game.user.id && isCombatActor(actor) && !resolveActorConditions(actor, {
    baseAttributes: actor.system.baseAttributes ?? actor.system.attributes ?? {}
  }).capabilities.canAttack) clearAim(actor);
});

Hooks.on("preUpdateItem", (item, changed) => {
  if (item.type !== "hitLocation"
    || !foundry.utils.hasProperty(changed, "system.currentHitPoints")) return;
  const nextHitPoints = foundry.utils.getProperty(changed, "system.currentHitPoints");
  if (recoversDisabledLocation(item, nextHitPoints)) {
    foundry.utils.setProperty(changed, "system.disabled", false);
  }
});

Hooks.once("setup", () => {
  // Character documents were first prepared before world settings became
  // readable. Re-run their derived data now so configured rules take effect.
  game.actors?.forEach((actor) => {
    if (actor.type === "character") actor.prepareData();
  });
});

Hooks.on("preUpdateActor", (actor, changed) => {
  if (!isCombatActor(actor)) return;

  const expanded = foundry.utils.expandObject(changed);
  const candidate = foundry.utils.mergeObject(
    foundry.utils.deepClone(actor.system.toObject()),
    expanded.system ?? {},
    { inplace: false }
  );
  const baseAttributes = actor.type === "npc"
    ? calculateNpcAttributes(candidate)
    : calculateDerivedAttributes(candidate, getActionPointRules());
  const changedManualCause = foundry.utils.getProperty(
    changed, `flags.${INCAPACITATED_FLAG_SCOPE}.${INCAPACITATED_MANUAL_FLAG}`
  );
  const manuallyIncapacitated = changedManualCause ?? actor.getFlag(
    INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG
  );
  const attributes = resolveConditions({ baseAttributes, descriptors: conditionDescriptors({
    fatigueKey: candidate.fatigueLevel,
    woundLevel: worstWoundLevel(actor.items.filter((item) => item.type === "hitLocation")),
    manuallyIncapacitated: Boolean(manuallyIncapacitated
      || actor.statuses?.has(INCAPACITATED_STATUS_ID))
  }) }).attributes;

  clampResource(changed, candidate, "actionPoints", attributes.actionPointsMax);
  clampResource(changed, candidate, "luckPoints", attributes.luckPointsMax);
  clampResource(changed, candidate, "magicPoints", attributes.magicPointsMax);
});

Hooks.on("updateItem", async (item, changed, options, userId) => {
  const actor = item.parent;
  const draftKey = item.getFlag("mythras-foundry", "backgroundDraftAbility");
  if (userId === game.user.id && item.type === "combatStyle" && actor?.type === "character"
    && draftKey && (Object.hasOwn(changed, "name")
      || foundry.utils.hasProperty(changed, "system.traitRefs"))) {
    const draft = parseBackgroundDraft(actor.system.backgroundDraft);
    const styleEntries = Object.entries(draft.styles)
      .filter(([, style]) => styleAbilityKey(style.name) === draftKey);
    if (styleEntries.length) {
      const name = String(changed.name ?? item.name).trim();
      const nextKey = styleAbilityKey(name);
      for (const [styleId, style] of styleEntries) {
        const phase = styleId.split(":")[0];
        const oldKey = styleAbilityKey(style.name);
        draft.styles[styleId] = {
          ...style,
          name,
          traitKeys: (item.system.traitRefs ?? []).map((trait) => trait.key).filter(Boolean)
        };
        if (oldKey !== nextKey) {
          const points = Number(draft.allocations[phase]?.[oldKey] ?? 0);
          if (points > 0) draft.allocations[phase][nextKey] = points;
          delete draft.allocations[phase][oldKey];
        }
      }
      if (draftKey !== nextKey) {
        await item.update({
          "flags.mythras-foundry.backgroundDraftAbility": nextKey
        });
      }
      await actor.update({
        "system.backgroundDraft": serializeBackgroundDraft(draft)
      });
    }
  }
  if (userId === game.user.id && item.type === "weapon" && isCombatActor(actor)
    && (foundry.utils.hasProperty(changed, "system.equipped")
      || foundry.utils.hasProperty(changed, "system.activeModeKey"))) await clearAim(actor);
  if (userId !== game.user.id || item.type !== "hitLocation" || !isCombatActor(actor)) return;
  const baseAttributes = actor.type === "npc"
    ? calculateNpcAttributes(actor.system)
    : calculateDerivedAttributes(actor.system, getActionPointRules());
  const maximum = resolveConditions({ baseAttributes, descriptors: conditionDescriptors({
    fatigueKey: actor.system.fatigueLevel,
    woundLevel: worstWoundLevel(actor.items.filter((candidate) => candidate.type === "hitLocation")),
    manuallyIncapacitated: Boolean(actor.getFlag(
      INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG)
      || actor.statuses?.has(INCAPACITATED_STATUS_ID))
  }) }).attributes.actionPointsMax;
  const current = Number(actor.system.resources.actionPoints.value ?? 0);
  if (current > maximum) {
    await actor.update({ "system.resources.actionPoints.value": maximum });
  }
  await syncIncapacitatedStatus(actor);
});

Hooks.on("preCreateItem", (item, data) => {
  const current = String(data.img ?? item.img ?? "");
  if (!current || ["icons/svg/item-bag.svg", "icons/svg/mystery-man.svg"].includes(current)) {
    item.updateSource({ img: defaultItemIcon(data.type ?? item.type) });
  }
  const type = data.type ?? item.type;
  const system = data.system ?? item.system ?? {};
  if (isGenericItemName(data.name ?? item.name, type, (key) => game.i18n.localize(key))) {
    const documents = item.parent?.items ?? game.items ?? [];
    item.updateSource({ name: nextNumberedItemName(
      type, documents, (key) => game.i18n.localize(key)
    ) });
  }
  if (type === "combatStyle" && !(system.weaponProfiles?.length) && system.weapons) {
    item.updateSource({ "system.weaponProfiles": parseWeaponProfileReferences(system.weapons) });
  }
  if (type === "trait" && !system.key) {
    item.updateSource({ "system.key": traitSlug(data.name ?? item.name) });
  }
  if (type === "weapon" && !system.profileKey) {
    item.updateSource({ "system.profileKey": normalizeWeaponProfile(data.name ?? item.name) });
  }
  if (type === "weapon" && Number(system.hitPoints ?? 0) > 0
    && !Number(system.maxHitPoints ?? 0)) {
    item.updateSource({
      "system.maxHitPoints": Number(system.hitPoints),
      "system.currentHitPoints": Number(system.hitPoints)
    });
  }
  if (type === "weapon" && !(system.modes?.length)) {
    const mode = legacyWeaponMode({ name: data.name ?? item.name, system });
    item.updateSource({ "system.modes": [mode], "system.activeModeKey": mode.key });
  }
  if (type === "armor") {
    const referenceLocation = system.referenceLocation || "special";
    const material = system.material || "leather";
    item.updateSource({
      "system.profileKey": system.profileKey || normalizeWeaponProfile(data.name ?? item.name),
      "system.profileName": system.profileName || data.name || item.name,
      "system.pieceType": armorPieceTypeForLocation(referenceLocation),
      "system.referenceLocation": referenceLocation,
      "system.material": material,
      "system.materialModifier": ARMOR_MATERIAL_MODIFIERS[material] ?? 1,
      "system.coveredLocationIds": Array.from(system.coveredLocationIds ?? []).slice(0, 1),
      "system.coverageMigrated": true,
      "system.armorRulesVersion": 4
    });
  }
});

Hooks.on("createItem", async (item, options, userId) => {
  if (userId !== game.user.id || item.type !== "armor" || !isCombatActor(item.parent)) return;
  if ((item.system.coveredLocationIds?.length ?? 0) > 0) return;
  if (item.system.referenceLocation === "special") {
    configureNewArmorPiece(item).catch((error) => {
      console.error("Mythras Foundry | Error configuring armor piece", error);
      ui.notifications.error(game.i18n.localize("MYTHRASF.Armor.Piece.ConfigureError"));
    });
    return;
  }
  const locations = item.parent.items.filter((candidate) => candidate.type === "hitLocation");
  const location = armorLocationForReference(item.system.referenceLocation, locations);
  if (location) {
    await item.update({ "system.coveredLocationIds": [location.id], "system.equipped": false });
  } else {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Armor.ReferenceLocationMissing"));
  }
});

Hooks.on("preCreateActor", (actor, data) => {
  if ((data.type ?? actor.type) !== "npc") return;
  actor.updateSource({ "prototypeToken.actorLink": false });
});

Hooks.on("createToken", async (token, options, userId) => {
  if (userId !== game.user.id || token.actorLink || token.isLinked) return;
  const actor = token.actor;
  if (actor?.type !== "npc" || actor.system.generatedInstance) return;
  await regenerateNpcActor(actor, { notify: false });
});

Hooks.on("createActor", async (actor, options, userId) => {
  if (userId !== game.user.id) return;
  await initializeCreatedActor(actor);
});

Hooks.once("ready", async () => {
  if (!isPrimaryActiveGM()) return;
  await runWorldMigrations();
});



Hooks.on("updateActor", async (actor, changed, options, userId) => {
  if (userId !== game.user.id || !isCombatActor(actor)) return;
  if (actor.type === "character" && foundry.utils.hasProperty(changed, "system.experienceRolls")
    && Number(actor.system.experienceRolls ?? 0) === 0) {
    const fumbleUpdates = fumbledSkillUpdatesAtZero(actor.system.experienceRolls, actor.items);
    if (fumbleUpdates.length) await actor.updateEmbeddedDocuments("Item", fumbleUpdates);
  }
  await syncIncapacitatedStatus(actor);
  if (foundry.utils.hasProperty(changed, "system.fatigueLevel")) {
    await synchronizeFatigueDeath(actor);
  }
  if (!foundry.utils.hasProperty(changed, "system.constitution")
    && !foundry.utils.hasProperty(changed, "system.size")) return;
  const updates = actor.items.filter((item) => item.type === "hitLocation"
    && item.system.autoCalculate).map((item) => {
      const maximum = calculateLocationHitPoints(
        actor.system.constitution, actor.system.size, item.system.hpClass
      );
      const previousMaximum = Number(item.system.maxHitPoints ?? maximum);
      const current = Number(item.system.currentHitPoints ?? previousMaximum);
      const severity = Number(item.system.permanentWound?.severity ?? 0);
      const wound = severity ? permanentWoundState({ ...item, system: { ...item.system,
        maxHitPoints: maximum, permanentWound: { ...item.system.permanentWound,
          originalMaxHitPoints: maximum } } }, { severity,
        roll: item.system.permanentWound.roll,
        description: item.system.permanentWound.description }) : null;
      const effectiveMaximum = wound?.effectiveMaxHitPoints ?? maximum;
      return {
        _id: item.id,
        "system.maxHitPoints": effectiveMaximum,
        "system.currentHitPoints": current === previousMaximum ? effectiveMaximum
          : Math.min(current, effectiveMaximum),
        ...(wound ? { "system.permanentWound": wound } : {})
      };
    });
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
});

Hooks.on("createItem", async (item, options, userId) => {
  if (userId !== game.user.id || item.type !== "hitLocation" || !isCombatActor(item.parent)) return;
  await syncIncapacitatedStatus(item.parent);
});

Hooks.on("deleteItem", async (item, options, userId) => {
  if (userId !== game.user.id || item.type !== "hitLocation" || !isCombatActor(item.parent)) return;
  await syncIncapacitatedStatus(item.parent);
});

function incapacitatedEffectActor(effect) {
  const actor = effect.parent;
  return actor?.documentName === "Actor"
    && effect.statuses?.has(INCAPACITATED_STATUS_ID) ? actor : null;
}

function protectedIncapacitatedEffect(effect) {
  const actor = incapacitatedEffectActor(effect);
  return Boolean(actor && actorIncapacitatedState(actor).automatic.length);
}

Hooks.on("preDeleteActiveEffect", (effect, options, userId) => {
  if (!protectedIncapacitatedEffect(effect)) return true;
  if (userId === game.user.id) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Status.IncapacitatedManaged"));
  }
  return false;
});

Hooks.on("preUpdateActiveEffect", (effect, changed, options, userId) => {
  if (changed.disabled !== true || !protectedIncapacitatedEffect(effect)) return true;
  if (userId === game.user.id) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Status.IncapacitatedManaged"));
  }
  return false;
});

async function clearDeletedManualIncapacitated(effect, userId) {
  const actor = incapacitatedEffectActor(effect);
  if (userId !== game.user.id || !actor
    || !actor.getFlag(INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG)) return;
  await actor.unsetFlag(INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG);
}

Hooks.on("deleteActiveEffect", clearDeletedManualIncapacitated);
Hooks.on("updateActiveEffect", async (effect, changed, options, userId) => {
  if (changed.disabled === true) await clearDeletedManualIncapacitated(effect, userId);
});



function clampResource(changed, candidate, key, maximum) {
  const current = Number(candidate.resources?.[key]?.value ?? 0);
  if (current <= maximum) return;
  foundry.utils.setProperty(changed, `system.resources.${key}.value`, maximum);
}

function isCombatActor(actor) {
  return Boolean(actor && ["character", "npc"].includes(actor.type));
}
