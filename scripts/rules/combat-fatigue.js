export const COMBAT_FATIGUE_FLAG = "combatFatigue";
export const COMBAT_FATIGUE_SCOPE = "mythras-foundry";

export function combatFatigueInterval(constitution) {
  return Math.max(1, Math.ceil(Math.max(0, Number(constitution) || 0) / 5));
}

export function combatFatigueLoss(result) {
  return ["failure", "fumble"].includes(result) ? 1 : 0;
}

export function advanceCombatFatigue(state, { combatId, round, interval }) {
  const currentRound = Math.max(0, Number(round) || 0);
  const currentInterval = Math.max(1, Number(interval) || 1);
  const previous = state?.combatId === combatId ? state : {};
  if (Number(previous.lastCountedRound) === currentRound) {
    return { due: Number(previous.dueRound) === currentRound, state: previous };
  }
  if (currentRound === 0) return { due: false, state: {
    schemaVersion: 1, combatId, lastCountedRound: 0,
    roundsElapsed: 0, dueRound: null
  } };
  const elapsed = Math.max(0, Number(previous.roundsElapsed) || 0) + 1;
  const due = elapsed >= currentInterval;
  return { due, state: {
    schemaVersion: 1,
    combatId,
    lastCountedRound: currentRound,
    roundsElapsed: due ? 0 : elapsed,
    dueRound: due ? currentRound : null
  } };
}
