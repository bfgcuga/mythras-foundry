import { modeAmmunition } from "./ammunition.js";
import { interruptionActionPayment, combatInterruption, submitInterruption } from "./combat-interruption.js";
import { withActionPointLock, consumeActorWaiting } from "./combat-waiting.js";
import { currentActionPoints } from "./action-points.js";
import { consumeAmmunition } from "./ranged-combat.js";
import { weaponModes } from "./weapon-modes.js";

export async function spendActorActionPoint(actor, { reactive = false, actionKind = "general" } = {}) {
  if (!reactive && combatInterruption(globalThis.game?.combat ?? globalThis.game?.combats?.active)) {
    const payment = await interruptionActionPayment(actor, { reactive, actionKind });
    if (payment !== null) return payment;
  }
  const result = await withActionPointLock(actor, async () => {
    const points = currentActionPoints(actor);
    if (points < 1) return false;
    await actor.update({ "system.resources.actionPoints.value": points - 1 }, { mythrasCombatAction: actionKind });
    if (reactive) await consumeActorWaiting(actor);
    return true;
  });
  const combat = globalThis.game?.combat ?? globalThis.game?.combats?.active;
  const session = combatInterruption(combat);
  if (result && reactive && session?.phase === "choosing"
    && combat.combatants.get(session.combatantId)?.actor?.uuid === actor.uuid) {
    await submitInterruption(combat, "cancel");
  }
  return result;
}

export async function spendActorLuckPoint(actor) {
  const points = Number(actor?.system.resources?.luckPoints?.value ?? 0);
  if (points < 1) return false;
  await actor.update({ "system.resources.luckPoints.value": points - 1 });
  return true;
}

export async function consumeWeaponModeAmmunition(weapon, mode, options = {}) {
  if (modeAmmunition(weapon, mode).use !== "none") {
    const { requestAmmunitionOperation } = await import("./ammunition-runtime.js");
    return requestAmmunitionOperation(weapon.actor ?? weapon.parent, {
      kind: "shoot", weaponId: weapon.id, modeKey: mode.key, ...options
    });
  }
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
