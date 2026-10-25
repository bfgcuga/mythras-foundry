import { aimEligibility, expireCombatAims, actionPointSpendingChange, AIM_SCOPE, AIM_FLAG } from "./aim.js";
import { currentActionPoints } from "./action-points.js";
import { withActionPointLock } from "./combat-waiting.js";
import { combatInterruption } from "./combat-interruption.js";
import { resolveActorConditions } from "./actor-conditions.js";
import { weaponModes } from "./weapon-modes.js";
import { weaponCanEquip } from "./weapon-durability.js";
import { weaponIsPinned } from "./weapon-pinning.js";

const CHANNEL = "system.mythras-foundry";
const pending = new Map();
const coordinator = () => game.users.filter(user => user.active && user.isGM).sort((a,b) => a.id.localeCompare(b.id))[0]?.id ?? game.user.id;
const fail = reason => { throw new Error(game.i18n.localize(`MYTHRASF.Action.Unavailable.${reason}`)); };
export async function applyAimRequest(request) {
  if (!request?.id || typeof request.id !== "string") return false;
  const combat = game.combats.get(request.combatId);
  const user = game.users.get(request.userId);
  const entry = combat?.combatants.get(request.combatantId);
  const actor = entry?.actor;
  if (!actor || !user || (!user.isGM && !actor.testUserPermission(user, "OWNER"))) return false;
  let advanced = false;
  const result = await withActionPointLock(actor, async () => {
    const history = actor.getFlag(AIM_SCOPE, "aimOperations") ?? [];
    const previous = history.find(operation => operation.id === request.id);
    if (previous) return previous.result;
    if (!combat.started || combat.combatant?.id !== entry.id || combatInterruption(combat)
      || combat.round !== request.round) fail("activeTurnRequired");
    const conditions = resolveActorConditions(actor, { baseAttributes: actor.system.baseAttributes ?? actor.system.attributes ?? {} });
    if (!conditions.capabilities.canAttack || !conditions.capabilities.canTakeProactiveTurn) fail("attackBlocked");
    const reason = aimEligibility(actor, combat);
    if (reason) fail(reason);
    const weapon = actor.items.get(request.weaponId);
    const mode = weapon && weaponModes(weapon).find(mode => mode.key === request.modeKey);
    if (!weapon?.system.equipped || weapon.system.activeModeKey !== mode?.key || !weaponCanEquip(weapon)
      || weaponIsPinned(weapon, actor) || !["ranged", "siege"].includes(mode?.weaponType)) fail("rangedWeapon");
    const target = await fromUuid(request.targetTokenUuid);
    if (!target?.actor || target.actor.uuid === actor.uuid) fail("aimTarget");
    const points = currentActionPoints(actor);
    const state = { schemaVersion: 2, combatId: combat.id, combatantId: entry.id,
      weaponId: weapon.id, modeKey: mode.key, targetTokenUuid: request.targetTokenUuid,
      declaredRound: combat.round, readyRound: combat.round + 1, phase: "preparing", spent: points };
    await actor.update({ "system.resources.actionPoints.value": 0,
      [`flags.${AIM_SCOPE}.${AIM_FLAG}`]: state,
      [`flags.${AIM_SCOPE}.actionPointSpending`]: { combatId: combat.id, round: combat.round, spent: points },
      [`flags.${AIM_SCOPE}.aimOperations`]: [...history.slice(-19), { id: request.id, result: state }]
    }, { mythrasAimDeclaration: { combatId: combat.id } });
    advanced = true;
    return state;
  });
  if (advanced && combat.combatant?.id === entry.id) await combat.nextTurn();
  return result;
}
export async function requestAim(combat, entry, selection) {
  const request = { ...selection, id: foundry.utils.randomID(), combatId: combat.id,
    combatantId: entry.id, round: combat.round, userId: game.user.id };
  if (coordinator() === game.user.id) return applyAimRequest(request);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(request.id); reject(new Error(game.i18n.localize("MYTHRASF.Ranged.Inventory.Timeout"))); }, 30000);
    pending.set(request.id, { resolve, reject, timer });
    game.socket.emit(CHANNEL, { action: "wholeRoundAim", request });
  });
}
export function registerAimRuntime() {
  Hooks.on("deleteCombat", combat => { if (coordinator() === game.user.id) return expireCombatAims(combat); });
  game.socket.on(CHANNEL, async message => {
    if (message.action === "wholeRoundAimResult" && message.userId === game.user.id) {
      const call = pending.get(message.id); if (!call) return;
      clearTimeout(call.timer); pending.delete(message.id);
      if (message.error) call.reject(new Error(message.error)); else call.resolve(message.result);
    }
    if (message.action !== "wholeRoundAim" || coordinator() !== game.user.id) return;
    const request = message.request;
    try {
      const result = await applyAimRequest(request);
      game.socket.emit(CHANNEL, { action: "wholeRoundAimResult", id: request.id, userId: request.userId, result });
    } catch (error) { game.socket.emit(CHANNEL, { action: "wholeRoundAimResult", id: request.id, userId: request.userId, error: error.message }); }
  });
  Hooks.on("preUpdateActor", (actor, changed, options) => {
    const next = foundry.utils.getProperty(changed, "system.resources.actionPoints.value");
    if (next == null) return;
    const combatId = options.mythrasAimDeclaration?.combatId || options.mythrasRoundRestore?.combatId;
    const combat = combatId ? game.combats.get(combatId) : [game.combat, ...Array.from(game.combats ?? [])]
      .find(candidate => candidate?.started && candidate.combatants?.some(entry => entry.actor?.uuid === actor.uuid));
    const before = currentActionPoints(actor);
    const spending = actionPointSpendingChange(actor, combat, before, Number(next), options);
    if (spending) foundry.utils.setProperty(changed, `flags.${AIM_SCOPE}.actionPointSpending`, spending);
    if (Number(next) < before && !options.mythrasAimDeclaration && options.mythrasCombatAction !== "attack" && actor.getFlag?.(AIM_SCOPE, AIM_FLAG)) {
      foundry.utils.setProperty(changed, `flags.${AIM_SCOPE}.-=${AIM_FLAG}`, null);
    }
  });
}
