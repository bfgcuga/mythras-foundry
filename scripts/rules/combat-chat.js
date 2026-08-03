import {
  classifyRoll,
  renderRollResult,
  rollThresholdRanges
} from "../documents/mythras-item.js";
import { applyArmor, damageModifierFormula, difficultyTarget } from "./combat.js";
import { findHitLocation, woundLevel } from "./hit-locations.js";
import { totalArmorPoints } from "./armor.js";
import { findWeaponMode } from "./weapon-modes.js";
import { activateDelayedTooltips } from "../ui/tooltips.js";

export async function createAttackMessage({ actor, weapon, mode, resolution, target }) {
  const targetValue = difficultyTarget(resolution.target, resolution.difficulty);
  const roll = await new Roll("1d100").evaluate();
  const criticalTarget = Math.max(1, Math.ceil(targetValue / 10));
  const result = classifyRoll(roll.total, targetValue, criticalTarget);
  const data = {
    actorUuid: actor.uuid,
    weaponId: weapon.id,
    modeKey: mode.key,
    modeName: mode.name,
    targetActorUuid: target?.actor?.uuid ?? "",
    targetName: target?.name ?? "",
    styleName: resolution.usesBase
      ? game.i18n.localize("MYTHRASF.Combat.BaseStyle")
      : resolution.style?.name ?? "",
    familiarity: resolution.familiarity,
    difficulty: resolution.difficulty,
    baseTargetValue: resolution.target,
    targetValue,
    criticalTarget,
    attackRoll: roll.total,
    result,
    damageRolled: false,
    applied: false
  };
  const messageData = {
    speaker: ChatMessage.getSpeaker({ actor }),
    content: renderAttackCard(data, actor, weapon, target?.actor ?? null),
    rolls: [roll],
    flags: { "mythras-foundry": { combat: data } }
  };
  ChatMessage.applyRollMode?.(messageData, game.settings.get("core", "rollMode"));
  return ChatMessage.create(messageData);
}

export function activateCombatCard(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  activateDelayedTooltips(root);
  if (!root || root.dataset.mythrasCombatActivated) return;
  root.dataset.mythrasCombatActivated = "true";
  root?.querySelector("[data-combat-action='roll-damage']")
    ?.addEventListener("click", (event) => rollDamage(message, event.currentTarget));
  root?.querySelector("[data-combat-action='apply-damage']")
    ?.addEventListener("click", (event) => {
      event.currentTarget.disabled = true;
      applyDamage(message).catch((error) => {
        event.currentTarget.disabled = false;
        console.error("Mythras Foundry | Error applying combat damage", error);
      });
    });
}

async function rollDamage(message, button) {
  const data = foundry.utils.deepClone(message.getFlag("mythras-foundry", "combat"));
  if (!data || data.damageRolled) return;
  const actor = await fromUuid(data.actorUuid);
  const weapon = actor?.items.get(data.weaponId);
  const mode = weapon ? findWeaponMode(weapon, data.modeKey) : null;
  if (!actor || !weapon || !mode) return ui.notifications.error(
    game.i18n.localize("MYTHRASF.Combat.SourceMissing")
  );
  const modifier = damageModifierFormula(
    actor.system.attributes?.damageModifier,
    mode.damageModifierMode
  );
  const formula = modifier
    ? `max(0, (${mode.damage || "0"}) + (${modifier}))`
    : `max(0, ${mode.damage || "0"})`;
  const damageRoll = await new Roll(formula).evaluate();
  data.damageRolled = true;
  data.damage = damageRoll.total;
  data.damageFormula = formula;

  const target = data.targetActorUuid ? await fromUuid(data.targetActorUuid) : null;
  const locationId = button.closest(".mythras-combat-card")
    ?.querySelector("[data-hit-location]")?.value;
  if (target) {
    const locations = target.items.filter((item) => item.type === "hitLocation");
    let location = locationId ? target.items.get(locationId) : null;
    if (!location) {
      const locationRoll = await new Roll("1d20").evaluate();
      data.locationRoll = locationRoll.total;
      location = findHitLocation(locations, locationRoll.total);
    }
    if (location) {
      data.locationId = location.id;
      data.locationName = location.name;
      const wornArmor = target.items.filter((item) => item.type === "armor");
      data.armorPoints = totalArmorPoints(location, wornArmor);
      data.penetratingDamage = applyArmor(data.damage, data.armorPoints);
    }
  }
  await message.update({
    content: renderAttackCard(data, actor, weapon, target),
    "flags.mythras-foundry.combat": data
  });
}

async function applyDamage(message) {
  const data = foundry.utils.deepClone(message.getFlag("mythras-foundry", "combat"));
  if (!data || !data.damageRolled || data.applied) return;
  const target = data.targetActorUuid ? await fromUuid(data.targetActorUuid) : null;
  const location = target?.items.get(data.locationId);
  if (!target || !location) return ui.notifications.warn(
    game.i18n.localize("MYTHRASF.Combat.TargetMissing")
  );
  if (!target.isOwner) return ui.notifications.error(
    game.i18n.localize("MYTHRASF.Combat.NoPermission")
  );
  // Claim the card before mutating the target so repeated clicks cannot apply twice.
  data.applied = true;
  const before = Number(location.system.currentHitPoints ?? 0);
  const after = before - Number(data.penetratingDamage ?? 0);
  data.beforeHitPoints = before;
  data.afterHitPoints = after;
  data.woundLevel = woundLevel(after, location.system.maxHitPoints);
  await message.update({ "flags.mythras-foundry.combat": data });
  try {
    await location.update({ "system.currentHitPoints": after });
  } catch (error) {
    data.applied = false;
    await message.update({ "flags.mythras-foundry.combat": data });
    throw error;
  }
  const actor = await fromUuid(data.actorUuid);
  const weapon = actor?.items.get(data.weaponId);
  await message.update({
    content: renderAttackCard(data, actor, weapon, target),
    "flags.mythras-foundry.combat": data
  });
}

function renderAttackCard(data, actor, weapon, target = null) {
  const escape = foundry.utils.escapeHTML;
  const successful = ["critical", "success"].includes(data.result);
  const ranges = rollThresholdRanges(
    data.targetValue,
    data.criticalTarget ?? Math.max(1, Math.ceil(data.targetValue / 10))
  );
  const resolvedTarget = target ?? (data.targetName ? { name: data.targetName } : null);
  const targetLocations = target?.items?.filter((item) => item.type === "hitLocation") ?? [];
  const options = targetLocations.map((location) => (
    `<option value="${location.id}" ${location.id === data.locationId ? "selected" : ""}>${escape(location.name)}</option>`
  )).join("");
  const damageSection = data.damageRolled ? `
    <div class="combat-card-damage">
      <div class="mythras-chat-details">
        <div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.Damage")}</span><strong class="mythras-chat-roll-value">${data.damage}</strong></div>
        <div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.Armor")}</span><strong>${data.armorPoints ?? "—"}</strong></div>
        <div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.HitLocation")}</span><strong>${escape(data.locationName || game.i18n.localize("MYTHRASF.Combat.NoLocation"))}</strong></div>
      </div>
      <div class="mythras-chat-total"><span>${game.i18n.localize("MYTHRASF.Chat.PenetratingDamage")}</span><strong>${data.penetratingDamage ?? "—"}</strong></div>
      ${data.applied ? `<div class="mythras-chat-details combat-card-applied">
        <div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.HitPointsBefore")}</span><strong>${data.beforeHitPoints}</strong></div>
        <div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.HitPointsAfter")}</span><strong>${data.afterHitPoints}</strong></div>
        <div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.Wound")}</span><strong>${game.i18n.localize(`MYTHRASF.Wound.${data.woundLevel}`)}</strong></div>
      </div>${["serious", "major"].includes(data.woundLevel) ? `<p class="combat-card-warning">${game.i18n.localize(`MYTHRASF.Combat.WoundWarning.${data.woundLevel}`)}</p>` : ""}`
      : data.locationId ? `<button type="button" data-combat-action="apply-damage">${game.i18n.localize("MYTHRASF.Combat.ApplyDamage")}</button>`
      : `<p>${game.i18n.localize("MYTHRASF.Combat.TargetMissing")}</p>`}
    </div>` : successful ? `
    ${resolvedTarget && options ? `<label>${game.i18n.localize("MYTHRASF.Combat.HitLocation")}
      <select data-hit-location><option value="">${game.i18n.localize("MYTHRASF.Combat.RollLocation")}</option>${options}</select>
    </label>` : ""}
    <button type="button" data-combat-action="roll-damage">${game.i18n.localize("MYTHRASF.Combat.RollDamage")}</button>` : "";
  return `<section class="mythras-combat-card mythras-chat-card">
    <div class="mythras-chat-title">${game.i18n.format("MYTHRASF.Combat.AttackWith", {
      weapon: escape(weapon?.name ?? "")
    })}${data.modeName ? ` (${escape(data.modeName)})` : ""}</div>
    <div class="mythras-chat-details">
      <div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.Style")}</span><strong>${escape(data.styleName)}</strong></div>
      <div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.Difficulty")}</span><strong>${game.i18n.localize(`MYTHRASF.Difficulty.${data.difficulty}`)}</strong></div>
      <div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.BaseTarget")}</span><strong>${data.baseTargetValue ?? data.targetValue}%</strong></div>
      ${data.baseTargetValue !== undefined && data.baseTargetValue !== data.targetValue ? `<div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.EffectiveTarget")}</span><strong class="penalized-value-modifier">${data.targetValue}%</strong></div>` : ""}
      ${resolvedTarget ? `<div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Combat.Target")}</span><strong>${escape(resolvedTarget.name)}</strong></div>` : ""}
      <div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.AttackRoll")} (1d100)</span><strong class="mythras-chat-roll-value">${data.attackRoll}</strong></div>
    </div>
    ${renderRollResult(data.result, ranges)}
    ${damageSection}
  </section>`;
}
