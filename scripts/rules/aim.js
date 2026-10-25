import { currentActionPoints, effectiveActionPointMaximum } from "./action-points.js";
import { getActionPointRules } from "../settings.js";

export const AIM_SCOPE = "mythras-foundry";
export const AIM_FLAG = "rangedAim";
export function aimState(actor, combat) {
  const aim = actor?.getFlag?.(AIM_SCOPE, AIM_FLAG);
  if (aim?.schemaVersion !== 2 || aim.combatId !== combat?.id || Number(combat.round) > aim.readyRound) return null;
  return { ...aim, phase: Number(combat.round) === aim.readyRound ? "ready" : "preparing" };
}
export function aimEligibility(actor, combat, maximum = effectiveActionPointMaximum(actor, getActionPointRules())) {
  const state = aimState(actor, combat);
  const history = actor?.getFlag?.(AIM_SCOPE, "actionPointSpending");
  if (state) return "aimAlreadyDeclared";
  if (maximum < 1 || currentActionPoints(actor) !== maximum || (history?.combatId === combat?.id
    && history.round === combat?.round && history.spent > 0)) return "aimWholeRound";
  return "";
}
export function actionPointSpendingChange(actor, combat, before, after, options = {}) {
  const restore = options.mythrasRoundRestore;
  if (restore) return { combatId: restore.combatId, round: restore.round, spent: 0 };
  if (!combat?.started || options.mythrasActionPointAdjustment) return null;
  const old = actor.getFlag?.(AIM_SCOPE, "actionPointSpending");
  const spent = old?.combatId === combat.id && old.round === combat.round ? Number(old.spent) || 0 : 0;
  const delta = before - after;
  return { combatId: combat.id, round: combat.round,
    spent: Math.max(0, spent + (delta > 0 || options.mythrasActionPointRefund ? delta : 0)) };
}
export async function clearAim(actor, { consumed = false } = {}) {
  const aim = actor?.getFlag?.(AIM_SCOPE, AIM_FLAG);
  if (!aim) return;
  await actor.unsetFlag(AIM_SCOPE, AIM_FLAG);
  if (aim.schemaVersion === 2) globalThis.ui?.notifications?.info?.(game.i18n.format(
    consumed ? "MYTHRASF.Ranged.AimConsumed" : "MYTHRASF.Ranged.AimCancelled", { actor: actor.name }));
}
export async function expireAimAtTurnEnd(combat) {
  const actor = combat.combatant?.actor;
  const state = aimState(actor, combat);
  if (actor && (!state || state.phase === "ready")) await clearAim(actor);
}
export async function expireCombatAims(combat, nextRound = Infinity) {
  for (const entry of combat.combatants ?? []) {
    const aim = entry.actor?.getFlag?.(AIM_SCOPE, AIM_FLAG);
    if (aim && aim.combatId === combat.id) {
      if (aim.schemaVersion !== 2 || aim.readyRound < nextRound) await clearAim(entry.actor);
      else if (aim.readyRound === nextRound && aim.phase !== "ready") {
        await entry.actor.setFlag(AIM_SCOPE, AIM_FLAG, { ...aim, phase: "ready" });
        globalThis.ui?.notifications?.info?.(game.i18n.format("MYTHRASF.Ranged.AimReady", { actor: entry.actor.name }));
      }
    }
  }
}
