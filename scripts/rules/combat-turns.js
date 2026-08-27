export const TURN_ECONOMY_SCHEMA_VERSION = 1;

export function composedInitiative(primary, tieBreak = 0, collision = 0) {
  return Number(primary) + Math.max(0, Math.min(100, Number(tieBreak) || 0)) / 1000
    + Math.max(0, Number(collision) || 0) / 1000000;
}

export function splitComposedInitiative(value) {
  const primary = Math.trunc(Number(value) || 0);
  return { primary, tieBreak: Math.round(((Number(value) || 0) - primary) * 1000) };
}

export function dynamicInitiativePrimary(rollTotal, effectiveInitiative) {
  const roll = Number(rollTotal);
  const bonus = Number(effectiveInitiative);
  if (!Number.isFinite(roll) || !Number.isFinite(bonus)) return null;
  return roll + bonus;
}

export function nextCombatPosition({ turns, currentIndex = -1, round = 0, cycle = 1 }) {
  const entries = Array.from(turns ?? []);
  if (!entries.length) return { transition: "empty", round, cycle, turn: null, skipped: [] };
  const skipped = [];
  for (let offset = 1; offset <= entries.length; offset += 1) {
    const index = (Math.max(-1, currentIndex) + offset) % entries.length;
    if (entries[index].eligible && Number(entries[index].current) > 0
      && entries[index].canTakeProactiveTurn !== false) {
      const wrapped = currentIndex >= 0 && index <= currentIndex;
      return { transition: wrapped ? "cycle" : "turn", round,
        cycle: wrapped ? cycle + 1 : cycle, turn: index, skipped };
    }
    if (entries[index].eligible && Number(entries[index].current) > 0
      && entries[index].canTakeProactiveTurn === false) skipped.push(index);
  }
  return { transition: "round", round: Math.max(0, round) + 1, cycle: 1, turn: null, skipped };
}

export function uniqueActorEntries(combatants) {
  const seen = new Set();
  return Array.from(combatants ?? []).filter((combatant) => {
    const actor = combatant.actor;
    const identity = actor?.isToken ? actor.uuid : actor?.id;
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
