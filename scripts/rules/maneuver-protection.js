import { applyTimedCondition } from "./timed-condition-runtime.js";
import { tokenDisplayName } from "./document-names.js";

const SCOPE = "mythras-foundry";
export const MANEUVER_STATUS = "maneuverProtected";
export const maneuverCondition = (effect) => effect.getFlag?.(SCOPE, "timedCondition")
  ?? effect.flags?.[SCOPE]?.timedCondition;

export function maneuverTokenUuid(combat, actor) {
  if (!actor) return "";
  return actor?.token?.uuid
    ?? (combat?.combatant && combat.combatant.actor?.uuid === actor.uuid ? combat.combatant.token?.uuid : null)
    ?? combat?.combatants?.find?.((entry) => entry.actor?.uuid === actor?.uuid)?.token?.uuid ?? "";
}

export function actorManeuverRestriction(combat, attacker, defender, defenderTokenUuid = "") {
  return maneuverAttackRestriction(combat, maneuverTokenUuid(combat, attacker), {
    actor: defender, uuid: defenderTokenUuid || maneuverTokenUuid(combat, defender)
  });
}

export async function removeManeuverProtection(actor, tokenUuid = actor?.token?.uuid ?? "") {
  const effects = maneuverEffects(actor, tokenUuid);
  if (effects.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effects.map((effect) => effect.id));
}

export async function clearCombatManeuvers(combat) {
  const actors = new Set(Array.from(combat.combatants ?? []).map((entry) => entry.actor).filter(Boolean));
  for (const actor of actors) {
    const effects = maneuverEffects(actor).filter((effect) => maneuverCondition(effect).combatUuid === combat.uuid);
    if (effects.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effects.map((effect) => effect.id));
  }
}

export function maneuverEffects(actor, tokenUuid = "") {
  return Array.from(actor?.effects ?? []).filter((effect) => !effect.disabled
    && maneuverCondition(effect)?.key === MANEUVER_STATUS
    && (!tokenUuid || maneuverCondition(effect).protectedTokenUuid === tokenUuid));
}

export function maneuverAttackRestriction(combat, attackerTokenUuid, defender) {
  if (!combat?.started || !attackerTokenUuid || !defender?.uuid) return null;
  return maneuverEffects(defender.actor, defender.uuid).find((effect) => {
    const condition = maneuverCondition(effect);
    return condition.combatUuid === combat.uuid && Number(condition.appliedRound) === Number(combat.round)
      && condition.restrictedTokenUuids?.includes(attackerTokenUuid);
  }) ?? null;
}

export async function applyManeuverProtection(actor, tokenUuid, rivals, combat, actionId) {
  const existing = maneuverEffects(actor, tokenUuid).find((effect) => {
    const condition = maneuverCondition(effect);
    return condition.combatUuid === combat.uuid && Number(condition.appliedRound) === Number(combat.round);
  });
  if (!rivals.length) return existing ?? null;
  const old = existing ? maneuverCondition(existing) : {};
  const restrictedTokenUuids = [...new Set([...(old.restrictedTokenUuids ?? []), ...rivals.map((token) => token.uuid)])];
  const metadata = { protectedTokenUuid: tokenUuid, restrictedTokenUuids,
    rivalNames: { ...old.rivalNames, ...Object.fromEntries(rivals.map((token) => [token.uuid, tokenDisplayName(token)])) },
    actionIds: [...new Set([...(old.actionIds ?? []), actionId])] };
  if (existing) {
    await existing.update({ [`flags.${SCOPE}.timedCondition`]: { ...old, ...metadata } });
    return existing;
  }
  const [effect] = await applyTimedCondition(actor, { key: MANEUVER_STATUS, statusId: MANEUVER_STATUS,
    name: game.i18n.localize("MYTHRASF.Status.ManeuverProtected"), img: "icons/svg/shield.svg",
    combat: { uuid: combat.uuid, round: combat.round, turn: combat.turn },
    duration: { unit: "round", phase: "endRound", remaining: 1 }, metadata });
  return effect;
}

// Called only once the attack has passed validation and been accepted.
export async function releaseManeuverRival(combat, attacker, defenderTokenUuid, attackerTokenUuid = attacker?.token?.uuid) {
  if (!combat?.started || !attackerTokenUuid) return;
  for (const effect of maneuverEffects(attacker, attackerTokenUuid)) {
    const condition = maneuverCondition(effect);
    if (condition.combatUuid !== combat.uuid || Number(condition.appliedRound) !== Number(combat.round)
      || !condition.restrictedTokenUuids?.includes(defenderTokenUuid)) continue;
    const remaining = condition.restrictedTokenUuids.filter((uuid) => uuid !== defenderTokenUuid);
    if (!remaining.length) await attacker.deleteEmbeddedDocuments("ActiveEffect", [effect.id]);
    else await effect.update({ [`flags.${SCOPE}.timedCondition.restrictedTokenUuids`]: remaining });
  }
}
