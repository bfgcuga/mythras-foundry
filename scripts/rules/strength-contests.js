import { calculateDamageModifier } from "./derived-attributes.js";
import { increaseConditionDifficulty } from "./condition-resolver.js";
import { difficultyTarget } from "./combat.js";

const signature = (modifier) => `${Number(modifier?.sign ?? 0)}:${(modifier?.terms ?? [])
  .map(({ dice, faces }) => `${dice}d${faces}`).sort().join("+")}`;

export function damageModifierGrade(modifier) {
  if (!modifier || !Array.isArray(modifier.terms)) return null;
  const wanted = signature(modifier);
  const maximum = modifier.terms.reduce((total, term) => total + term.dice * term.faces, 0);
  if (!Number.isFinite(maximum) || maximum < 0 || maximum > 10000) return null;
  let previous = ""; let grade = -1;
  for (let total = 1; total <= Math.max(110, maximum * 10 + 110); total += 1) {
    const current = signature(calculateDamageModifier(total, 0));
    if (current !== previous) { grade += 1; previous = current; }
    if (current === wanted) return grade;
  }
  return null;
}

export function strengthContestAdjustment(participant, opponents = []) {
  const own = damageModifierGrade(participant.damageModifier);
  const other = opponents.map((entry) => damageModifierGrade(entry.damageModifier))
    .filter((grade) => grade != null);
  const steps = participant.abilitySlug === "musculo" && own != null && other.length
    ? Math.max(0, Math.max(...other) - own) : 0;
  const difficulty = increaseConditionDifficulty(participant.difficulty ?? "standard", steps);
  return { steps, difficulty, target: steps
    ? difficultyTarget(participant.baseTarget ?? participant.target, difficulty) : participant.target };
}

export function applyStrengthContestPenalties(participants = [], opponentIds = null) {
  return participants.map((entry) => {
    if (!entry.abilitySlug) return entry;
    const rivals = participants.filter((rival) => rival.id !== entry.id
      && (!opponentIds || opponentIds(entry.id).includes(rival.id)));
    const adjustment = strengthContestAdjustment(entry, rivals);
    return { ...entry, target: adjustment.target, strengthSteps: adjustment.steps,
      strengthDifficulty: adjustment.difficulty };
  });
}
