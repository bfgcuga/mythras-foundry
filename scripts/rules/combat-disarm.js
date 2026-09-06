import { difficultyTarget, normalizeWeaponSize, WEAPON_SIZE_ORDER } from "./combat.js";
import { equippedHandsUsed, HAND_CAPACITY, weaponHandsRequired } from "./equipment.js";

const DIFFICULTIES = Object.freeze(["automatic", "veryEasy", "easy", "standard", "hard",
  "formidable", "herculean", "impossible"]);

export function disarmDifficulty(attackerSize, targetSize) {
  const attacker = WEAPON_SIZE_ORDER.indexOf(normalizeWeaponSize(attackerSize));
  const target = WEAPON_SIZE_ORDER.indexOf(normalizeWeaponSize(targetSize));
  const steps = attacker < 0 || target < 0 ? 0 : attacker - target;
  const standard = DIFFICULTIES.indexOf("standard");
  return { steps, difficulty: DIFFICULTIES[Math.max(0,
    Math.min(DIFFICULTIES.length - 1, standard + steps))] };
}

export function disarmResistanceTarget(baseTarget, attackerSize, targetSize) {
  const adjustment = disarmDifficulty(attackerSize, targetSize);
  return { ...adjustment, baseTarget: Number(baseTarget ?? 0),
    target: difficultyTarget(baseTarget, adjustment.difficulty) };
}

export function disarmStrengthAllowed(attacker, victim) {
  return Number(victim?.system?.strength ?? 0) <= Number(attacker?.system?.strength ?? 0) * 2;
}

export function disarmHasFreeHand(actor) {
  const weapons = actor?.items?.filter?.((item) => item.type === "weapon") ?? [];
  return equippedHandsUsed(weapons) < HAND_CAPACITY;
}

export function disarmWeaponChoices(actor, preferredId = "") {
  const choices = (actor?.items?.filter?.((item) => item.type === "weapon"
    && item.system?.equipped && weaponHandsRequired(item) > 0) ?? [])
    .map((item) => ({ id: item.id, name: item.name }));
  return choices.sort((left, right) => left.id === preferredId ? -1
    : right.id === preferredId ? 1 : left.name.localeCompare(right.name));
}

export function takeWeaponStrengthAllowed(attacker, victim) {
  return Number(victim?.system?.strength ?? 0) < Number(attacker?.system?.strength ?? 0) * 2;
}
