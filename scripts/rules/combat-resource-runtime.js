import { currentActionPoints } from "./action-points.js";
import { consumeAmmunition } from "./ranged-combat.js";
import { weaponModes } from "./weapon-modes.js";

export async function spendActorActionPoint(actor) {
  const points = currentActionPoints(actor);
  if (points < 1) return false;
  await actor.update({ "system.resources.actionPoints.value": points - 1 });
  return true;
}

export async function spendActorLuckPoint(actor) {
  const points = Number(actor?.system.resources?.luckPoints?.value ?? 0);
  if (points < 1) return false;
  await actor.update({ "system.resources.luckPoints.value": points - 1 });
  return true;
}

export async function consumeWeaponModeAmmunition(weapon, mode) {
  const ammunition = consumeAmmunition(mode);
  const modes = weaponModes(weapon).map((entry) => entry.key === mode.key ? { ...entry,
    ammoLoaded: ammunition.loaded, ammoReserve: ammunition.reserve,
    reloadProgress: ammunition.reloadProgress } : { ...entry });
  await weapon.update({ "system.modes": modes });
  return ammunition;
}

export async function consumeSurpriseEffectBonus(defender, combat, { scope, flag } = {}) {
  if (!combat.surprise?.eligible || combat.surprise.consumed) return 0;
  const effect = defender.effects.get(combat.surprise.effectId);
  const condition = effect?.getFlag(scope, flag);
  if (!effect || condition?.bonusConsumed) return 0;
  await effect.update({ [`flags.${scope}.${flag}`]: { ...condition, bonusConsumed: true } });
  combat.surprise.consumed = true;
  return 1;
}
