import { timedEffects } from "./timed-condition-runtime.js";

const SIZE_INDEX = Object.freeze({ P: 0, M: 1, G: 2, E: 3, D: 4 });

export function impalementPenalty(targetSize, weaponSize) {
  const creatureBand = Math.max(0, Math.floor((Math.max(1, Number(targetSize) || 1) - 1) / 10));
  const difference = (SIZE_INDEX[weaponSize] ?? -Infinity) - creatureBand;
  if (difference <= -2) return { key: "none", difficultySteps: 0, incapacitated: false };
  if (difference === -1) return { key: "hard", difficultySteps: 1, incapacitated: false };
  if (difference === 0) return { key: "formidable", difficultySteps: 2, incapacitated: false };
  if (difference === 1) return { key: "herculean", difficultySteps: 3, incapacitated: false };
  return { key: "incapacitated", difficultySteps: 0, incapacitated: true };
}

export function impalementData(effect) {
  const data = effect?.getFlag?.("mythras-foundry", "timedCondition")
    ?? effect?.flags?.["mythras-foundry"]?.timedCondition;
  return data?.key === "impaled" ? data : null;
}

export function activeImpalements(actor) {
  return timedEffects(actor).map((effect) => ({ effect, data: impalementData(effect) }))
    .filter((entry) => entry.data);
}

export function impalementConditionDescriptors(actor) {
  const entries = activeImpalements(actor);
  if (!entries.length) return [];
  const worst = entries.reduce((left, right) => {
    const leftRank = left.data.incapacitated ? 4 : Number(left.data.difficultySteps ?? 0);
    const rightRank = right.data.incapacitated ? 4 : Number(right.data.difficultySteps ?? 0);
    return rightRank > leftRank ? right : left;
  });
  if (worst.data.incapacitated) return [
    { id: "impaled:condition", source: "status", sourceKey: "impaled",
      name: "MYTHRASF.Status.Impaled", scope: "condition", operation: "floor",
      value: "incapacitated", contexts: [] },
    { id: "impaled:actions", source: "status", sourceKey: "impaled",
      name: "MYTHRASF.Status.Impaled", scope: "attribute", target: "actionPointsMax",
      operation: "zero", value: true, contexts: [] },
    { id: "impaled:attack", source: "status", sourceKey: "impaled",
      name: "MYTHRASF.Status.Impaled", scope: "capability", target: "canAttack",
      operation: "block", value: true, contexts: [] }
  ];
  return Number(worst.data.difficultySteps ?? 0) > 0 ? [{ id: "impaled:difficulty",
    source: "status", sourceKey: "impaled", name: "MYTHRASF.Status.Impaled",
    scope: "difficulty", operation: "increase", value: Number(worst.data.difficultySteps),
    contexts: [] }] : [];
}

export function impalementsReachableBy(combat, actor) {
  const own = combat?.combatants?.find((entry) => entry.actor?.uuid === actor?.uuid);
  if (!own) return [];
  const relations = combat?.getFlag?.("mythras-foundry", "tacticalState")?.relations ?? {};
  const rivals = Object.values(relations).filter((relation) => relation.status === "engaged"
    && Object.hasOwn(relation.sides ?? {}, own.id)).flatMap((relation) =>
    Object.keys(relation.sides ?? {}).filter((id) => id !== own.id));
  return [...new Set(rivals)].flatMap((id) => {
    const victim = combat.combatants.get?.(id) ?? combat.combatants.find?.((entry) => entry.id === id);
    return activeImpalements(victim?.actor).map((entry) => ({ ...entry,
      victim: victim.actor, victimCombatantId: id, victimName: victim.name }));
  });
}

export function extractionDamage(rolledDamage, barbed = false) {
  const rolled = Math.max(0, Number(rolledDamage) || 0);
  return barbed ? rolled : Math.ceil(rolled / 2);
}
