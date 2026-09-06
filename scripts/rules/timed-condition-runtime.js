import { advanceActorTurnDuration, advanceRoundDuration, expiresAtRoundEnd, timedConditionSource,
  TIMED_CONDITION_FLAG, TIMED_CONDITION_SCOPE } from "./timed-conditions.js";
import { composedInitiative, splitComposedInitiative } from "./combat-turns.js";

const flag = (effect) => effect.getFlag?.(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG)
  ?? effect.flags?.[TIMED_CONDITION_SCOPE]?.[TIMED_CONDITION_FLAG];

export function timedEffects(actor) {
  return Array.from(actor?.effects ?? []).filter((effect) => flag(effect));
}

export async function applyTimedCondition(actor, { name, img, statusId, ...configuration }) {
  if (!actor) return null;
  const condition = timedConditionSource({ statusId, ...configuration });
  return actor.createEmbeddedDocuments("ActiveEffect", [{ name, img, statuses: [statusId],
    flags: { [TIMED_CONDITION_SCOPE]: { [TIMED_CONDITION_FLAG]: condition } } }]);
}

export async function advanceActorTurnConditions(actor, history = [], options = {}) {
  const updates = []; const deletes = [];
  for (const effect of timedEffects(actor)) {
    const result = advanceActorTurnDuration(flag(effect), options);
    if (result.action === "update") updates.push({ _id: effect.id,
      [`flags.${TIMED_CONDITION_SCOPE}.${TIMED_CONDITION_FLAG}`]: result.condition });
    if (result.action === "expire") {
      deletes.push(effect.id); history.push({ effectId: effect.id, key: result.condition.key,
        expiredAt: Date.now(), phase: "endActorTurn" });
    }
  }
  if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates);
  if (deletes.length) await actor.deleteEmbeddedDocuments("ActiveEffect", deletes);
  return history;
}

export async function expireRoundConditions(combat, history = []) {
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor; if (!actor) continue;
    const effects = timedEffects(actor).filter((effect) => expiresAtRoundEnd(flag(effect), combat.uuid));
    if (!effects.length) continue;
    const deletes = [];
    for (const effect of effects) {
      const condition = flag(effect);
      const result = advanceRoundDuration(condition, combat.uuid);
      if (result.action === "update") {
        await effect.update({ [`flags.${TIMED_CONDITION_SCOPE}.${TIMED_CONDITION_FLAG}`]:
          result.condition });
        continue;
      }
      history.push({ effectId: effect.id, key: condition.key,
        expiredAt: Date.now(), phase: "endRound" });
      if (condition.key === "surprised" && condition.initiativeAdjusted) {
        const entry = combat.combatants.get(condition.combatantId);
        if (entry?.initiative != null) {
          const stored = entry.getFlag(TIMED_CONDITION_SCOPE, "initiative")
            ?? splitComposedInitiative(entry.initiative);
          const primary = Number(stored.primary) + 10;
          await entry.update({ initiative: composedInitiative(primary, stored.tieBreak,
            stored.collision), [`flags.${TIMED_CONDITION_SCOPE}.initiative.primary`]: primary,
          [`flags.${TIMED_CONDITION_SCOPE}.initiative.surprisePenaltyApplied`]: false },
          { mythrasTieBreak: true });
        }
      }
      deletes.push(effect.id);
    }
    if (deletes.length) await actor.deleteEmbeddedDocuments("ActiveEffect", deletes);
  }
  return history;
}

export async function initializeSurpriseEffect(effect, preferredCombat = null) {
  const existing = flag(effect);
  if (!effect?.statuses?.has?.("surprised") || (existing && existing.unit !== "manual")) return;
  const actor = effect.parent;
  const combat = preferredCombat ?? game.combats?.find((entry) => entry.started
    && entry.combatants.some((candidate) => candidate.actor?.uuid === actor?.uuid));
  const combatant = combat?.combatants.find((entry) => entry.actor?.uuid === actor?.uuid);
  let initiativeAdjusted = false;
  if (combatant?.initiative != null) {
    const stored = combatant.getFlag(TIMED_CONDITION_SCOPE, "initiative")
      ?? splitComposedInitiative(combatant.initiative);
    if (!stored.surprisePenaltyApplied) {
      const primary = Number(stored.primary) - 10;
      await combatant.update({ initiative: composedInitiative(primary, stored.tieBreak,
        stored.collision), [`flags.${TIMED_CONDITION_SCOPE}.initiative.primary`]: primary,
      [`flags.${TIMED_CONDITION_SCOPE}.initiative.surprisePenaltyApplied`]: true },
      { mythrasTieBreak: true });
      initiativeAdjusted = true;
    } else initiativeAdjusted = true;
  }
  const condition = timedConditionSource({ key: "surprised", statusId: "surprised",
    combat: combat ? { uuid: combat.uuid, round: combat.round,
      cycle: combat.mythrasTurnEconomy?.cycle, turn: combat.turn } : null,
    duration: combat ? { unit: "round", phase: "endRound" } : { unit: "manual" },
    metadata: { combatantId: combatant?.id ?? "", initiativeAdjusted,
      bonusConsumed: false, defenseReleased: false } });
  await effect.update({ [`flags.${TIMED_CONDITION_SCOPE}.${TIMED_CONDITION_FLAG}`]: condition });
}

export async function bindSurpriseEffects(combat) {
  for (const combatant of combat?.combatants ?? []) {
    for (const effect of combatant.actor?.effects ?? []) {
      if (effect.statuses?.has?.("surprised")) await initializeSurpriseEffect(effect, combat);
    }
  }
}

export async function revealSurprisedTurn(actor) {
  const updates = timedEffects(actor).flatMap((effect) => {
    const condition = flag(effect);
    if (condition.key !== "surprised" || condition.defenseReleased) return [];
    return [{ _id: effect.id, statuses: ["surprisedOffensive"],
      [`flags.${TIMED_CONDITION_SCOPE}.${TIMED_CONDITION_FLAG}`]: {
        ...condition, defenseReleased: true } }];
  });
  if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates);
}

export function timedAttackRestriction(actor, { weaponType } = {}) {
  for (const effect of timedEffects(actor)) {
    const condition = flag(effect);
    if (condition.key === "suppressed" && ["ranged", "siege"].includes(weaponType)) {
      return "suppressed";
    }
  }
  return null;
}
