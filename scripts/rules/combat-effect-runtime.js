import { engagementId } from "./engagements.js";
import { setRelationPosition } from "./engagement-runtime.js";
import { applyTimedCondition, timedEffects } from "./timed-condition-runtime.js";
import { TIMED_CONDITION_FLAG, TIMED_CONDITION_SCOPE } from "./timed-conditions.js";
import { damageModifierFormula } from "./combat.js";
import { disarmHasFreeHand, disarmStrengthAllowed, disarmWeaponChoices
} from "./combat-disarm.js";
import { findWeaponMode } from "./weapon-modes.js";
import { pinnableWeapons, clearWeaponPinsBetween } from "./weapon-pinning.js";

export function combatSideEntry(combat, side) {
  return side === "attacker" ? combat.attacker : combat.defender;
}

export function combatEffectAffectedSide(effect) {
  if (effect.target === "self") return effect.side;
  return effect.side === "attacker" ? "defender" : "attacker";
}

export async function addManagedCombatStatus(combat, effect, { key, statusId, turns = null,
  unit = "actorTurn", phase = "endActorTurn", locationId = "", capabilities = {},
  metadata = {} } = {}, { resolveActor, combatById, localize,
  applyCondition = applyTimedCondition } = {}) {
  const affectedEntry = combatSideEntry(combat, combatEffectAffectedSide(effect));
  const sourceEntry = combatSideEntry(combat, effect.side);
  const actor = await resolveActor?.(affectedEntry.tokenUuid, affectedEntry.actorUuid);
  const tracker = combat.turnEconomy ? combatById?.(combat.turnEconomy.combatId) : null;
  if (!actor) return false;
  await applyCondition(actor, { key, statusId, name: localize(`MYTHRASF.Status.${
    statusId[0].toUpperCase()}${statusId.slice(1)}`), img: "icons/svg/daze.svg",
  source: { messageUuid: combat.messageUuid ?? "", name: sourceEntry.actorName,
    actorUuid: sourceEntry.actorUuid, tokenUuid: sourceEntry.tokenUuid },
  combat: tracker ? { uuid: tracker.uuid, round: tracker.round,
    cycle: tracker.mythrasTurnEconomy?.cycle, turn: tracker.turn } : null,
  duration: { unit, phase, value: turns,
    skipCurrentTurn: unit === "actorTurn" && tracker?.combatant?.actor?.uuid === actor.uuid },
  locationId, capabilities, metadata });
  combat.consequencesApplied = true;
  return true;
}

export async function applyImmediateCombatEffects(combat, message, dependencies = {}) {
  combat.messageUuid = message.uuid;
  const selections = combat.effects.selections.filter((effect) => !effect.waived);
  for (const effect of selections) {
    if (effect.key === "inmovilizar-arma") {
      const target = combatSideEntry(combat, combatEffectAffectedSide(effect));
      const actor = await dependencies.resolveActor?.(target.tokenUuid, target.actorUuid);
      const weapons = pinnableWeapons(actor).map((weapon) => ({ id: weapon.id, name: weapon.name }));
      (combat.consequences ??= []).push({ key: "pinWeapon", actorSide: effect.side,
        victimSide: combatEffectAffectedSide(effect), weapons,
        status: weapons.length ? "pending" : "resolved" });
      effect.status = "resolved";
    }
    if (effect.key === "retirada") {
      const left = await dependencies.resolveActor?.(combat.attacker.tokenUuid, combat.attacker.actorUuid);
      const right = await dependencies.resolveActor?.(combat.defender.tokenUuid, combat.defender.actorUuid);
      await clearWeaponPinsBetween(left, right);
    }
    if (effect.key === "ardid" && combat.turnEconomy) {
      const tracker = dependencies.combatById?.(combat.turnEconomy.combatId);
      const ruse = await dependencies.registerRuse?.(tracker, {
        ownerCombatantId: combat.turnEconomy.defenderCombatantId,
        rivalCombatantId: combat.turnEconomy.combatantId,
        effectKey: effect.parameters?.effectKey,
        sourceMessageUuid: message.uuid,
        sourceSlot: effect.slot
      });
      effect.status = ruse ? "resolved" : "notActivated";
      if (ruse) effect.resolution = { ruseId: ruse.id, preparedAt: ruse.createdAt };
    }
    if (effect.key === "aprovechar-la-ventaja") {
      await addManagedCombatStatus(combat, effect,
        { key: "pressed", statusId: "pressed", turns: 1 }, dependencies);
      effect.status = "resolved";
    }
    if (effect.key === "muerte-silenciosa") {
      await addManagedCombatStatus(combat, effect, { key: "silenced", statusId: "silenced",
        unit: "round", phase: "endRound" }, dependencies);
      effect.status = "resolved";
    }
    if (["abrir-distancia", "cerrar-distancia", "retirada"].includes(effect.key)
      && combat.turnEconomy) {
      const tracker = dependencies.combatById?.(combat.turnEconomy.combatId);
      const relationId = (dependencies.engagementKey ?? engagementId)(
        combat.turnEconomy.combatantId, combat.turnEconomy.defenderCombatantId);
      await (dependencies.setPosition ?? setRelationPosition)(tracker, relationId,
        effect.key === "cerrar-distancia" ? "shorter" : effect.key === "abrir-distancia"
          ? "longer" : "neutral", { reason: `effect:${effect.key}`,
          status: effect.key === "retirada" ? "disengaged" : "engaged" });
      combat.consequencesApplied = true;
      effect.status = "resolved";
    }
  }
  const offBalance = selections.filter((effect) => effect.key === "desequilibrar-oponente");
  if (offBalance.length) {
    await addManagedCombatStatus(combat, offBalance[0], { key: "offBalance",
      statusId: "offBalance", turns: offBalance.length }, dependencies);
    offBalance.forEach((effect) => { effect.status = "resolved"; });
  }
  for (const effect of selections.filter((entry) => ["cegar-oponente",
    "disparo-de-supresion", "desarmar-oponente"].includes(entry.key))) {
    const sourceEntry = combatSideEntry(combat, effect.side);
    const targetEntry = combatSideEntry(combat, combatEffectAffectedSide(effect));
    const sourceActor = effect.key === "desarmar-oponente"
      ? await dependencies.resolveActor?.(sourceEntry.tokenUuid, sourceEntry.actorUuid) : null;
    const targetActor = effect.key === "desarmar-oponente"
      ? await dependencies.resolveActor?.(targetEntry.tokenUuid, targetEntry.actorUuid) : null;
    const preferredWeaponId = effect.side === "attacker"
      ? combat.defender.defense?.weaponId : combat.attacker.weaponId;
    const weaponChoices = effect.key === "desarmar-oponente"
      ? disarmWeaponChoices(targetActor, preferredWeaponId) : [];
    const tooStrong = effect.key === "desarmar-oponente"
      && !disarmStrengthAllowed(sourceActor, targetActor);
    combat.effects.checks.push({ id: `effect-${effect.side}-${effect.slot}`,
      source: "effect", order: combat.effects.checks.length, effectKey: effect.key,
      effectSide: effect.side, effectSlot: effect.slot,
      actorSide: combatEffectAffectedSide(effect),
      abilitySlugs: effect.key === "cegar-oponente" ? ["evadir"] : ["voluntad"],
      combatStyle: effect.key === "desarmar-oponente", weaponChoices,
      sourceWeaponSize: sourceEntry.weaponSize ?? sourceEntry.defense?.weaponSize ?? "",
      allowsShieldStyle: effect.key === "cegar-oponente",
      opposedSide: effect.side, label: effect.name, status: "pending",
      automaticFailure: Boolean(effect.automaticSuccess), automaticResistance: tooStrong,
      unavailable: effect.key === "desarmar-oponente" && !weaponChoices.length });
    effect.status = "pending";
  }
  await applyAutomaticCombatEffectChecks(combat, dependencies);
}

export async function applyAutomaticCombatEffectChecks(combat, dependencies = {}) {
  for (const check of combat.effects?.checks ?? []) {
    if (check.status === "pending" && (check.automaticResistance || check.unavailable)) {
      check.resolution = { manual: false, automaticResistance: true, result: "success",
        winner: "left", resolvedAt: Date.now() };
      check.status = "resolved";
      const entry = combatSideEntry(combat, check.actorSide ?? "defender");
      const actor = await dependencies.resolveActor?.(entry.tokenUuid, entry.actorUuid);
      await applyCombatEffectCheckConsequence(combat, check, actor, dependencies);
      continue;
    }
    if (check.status !== "pending" || !check.automaticFailure) continue;
    const entry = combatSideEntry(combat, check.actorSide ?? "defender");
    const actor = await dependencies.resolveActor?.(entry.tokenUuid, entry.actorUuid);
    check.resolution = { manual: false, automaticFailure: true, result: "failure",
      winner: "right", resolvedAt: Date.now() };
    check.status = "resolved";
    await applyCombatEffectCheckConsequence(combat, check, actor, dependencies);
  }
}

export async function applyCombatEffectCheckConsequence(combat, check, actor,
  { manual = false, ...dependencies } = {}) {
  if (check.resolution?.manual || !actor) return;
  const resisted = check.resolution?.winner === "left";
  const effect = (combat.effects?.selections ?? []).find((entry) =>
    entry.key === check.effectKey && Number(entry.slot) === Number(check.effectSlot ?? entry.slot)
    && (!check.effectSide || entry.side === check.effectSide));
  if (!effect) return;
  effect.resolution = { checkId: check.id, resisted, resolvedAt: Date.now() };
  effect.status = "resolved";
  if (resisted) {
    check.consequence = { key: effect.key === "desarmar-oponente"
      ? check.resolution?.automaticResistance ? "disarmTooStrong" : "disarmResisted"
      : "resisted" };
    effect.resolution.consequence = check.consequence;
    return;
  }
  if (effect.key === "cegar-oponente") {
    const duration = await dependencies.evaluateRoll("1d3", { manual });
    await addManagedCombatStatus(combat, effect, { key: "blinded", statusId: "blinded",
      turns: duration.total }, dependencies);
    check.consequence = { key: "blinded", turns: duration.total };
    effect.resolution.consequence = check.consequence;
  }
  if (effect.key === "disparo-de-supresion") {
    const sourceActorUuid = combatSideEntry(combat, effect.side).actorUuid;
    const existing = (dependencies.activeEffects ?? timedEffects)(actor).find((candidate) => {
      const condition = candidate.getFlag(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG);
      return condition?.key === "suppressed" && condition.sourceActorUuid === sourceActorUuid;
    });
    if (existing) {
      const condition = existing.getFlag(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG);
      await existing.update({ [`flags.${TIMED_CONDITION_SCOPE}.${TIMED_CONDITION_FLAG}`]: {
        ...condition, original: Number(condition.original ?? 1) + 1,
        remaining: Number(condition.remaining ?? 1) + 1 } });
    } else await addManagedCombatStatus(combat, effect, { key: "suppressed",
      statusId: "suppressed", turns: 1 }, dependencies);
    check.consequence = { key: "suppressed", turns: 1 };
    effect.resolution.consequence = check.consequence;
  }
  if (effect.key === "desarmar-oponente") {
    const sourceEntry = combatSideEntry(combat, effect.side);
    const sourceActor = await dependencies.resolveActor?.(sourceEntry.tokenUuid,
      sourceEntry.actorUuid);
    const formula = damageModifierFormula(sourceActor?.system?.attributes?.damageModifier) || "0";
    const distanceRoll = formula === "0" ? { total: 0 } : await dependencies.evaluateRoll(formula,
      { manual });
    const weapon = actor.items.get(check.resolution?.weaponId ?? check.weaponChoices?.[0]?.id);
    if (weapon?.system?.equipped) await weapon.update({ "system.equipped": false });
    const canTake = Boolean(weapon && disarmHasFreeHand(sourceActor));
    check.consequence = { key: canTake ? "disarmChoice" : "disarmThrown",
      status: canTake ? "pending" : "resolved", actorSide: effect.side,
      victimSide: combatEffectAffectedSide(effect), weaponId: weapon?.id ?? "",
      weaponName: weapon?.name ?? "", distance: Math.max(0, Number(distanceRoll.total ?? 0)), formula };
    effect.resolution.consequence = check.consequence;
    if (canTake) (combat.consequences ??= []).push(check.consequence);
  }
  if (effect.key === "desangrar") await addManagedCombatStatus(combat, effect,
    { key: "exsanguinating", statusId: "exsanguinating", unit: "manual" }, dependencies);
  if (effect.key === "tumbar-oponente") await addManagedCombatStatus(combat, effect,
    { key: "incapacitated", statusId: "incapacitated", unit: "manual" }, dependencies);
  if (effect.key === "aturdir-localizacion") {
    const location = actor.items.get(combat.damage.locationId);
    const turns = Math.max(1, Number(combat.damage.penetratingDamage ?? 1));
    const category = location?.system.category ?? location?.system.hpClass;
    const statusId = category === "head" ? "unconscious"
      : ["chest", "abdomen", "torso"].includes(category) ? "stunnedTorso" : "stunnedLocation";
    await addManagedCombatStatus(combat, effect, { key: statusId, statusId, turns,
      locationId: location?.id ?? "" }, dependencies);
  }
}
