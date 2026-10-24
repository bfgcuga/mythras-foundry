import { ammunitionStock, ammunitionChoices, ammunitionProblem, ammunitionView, modeAmmunition, count } from "./ammunition.js";
import { weaponModes } from "./weapon-modes.js";
import { spendActorActionPoint } from "./combat-resource-runtime.js";
import { weaponCanEquip } from "./weapon-durability.js";
import { weaponIsPinned } from "./weapon-pinning.js";
import { canStartProactiveAction, finishInterruptionAction } from "./combat-interruption.js";

const locks = new Map();
const pending = new Map();
const SCOPE = "mythras-foundry";
const CHANNEL = "system.mythras-foundry";
const primary = () => game.users?.filter(user => user.active && user.isGM).sort((a, b) => a.id.localeCompare(b.id))[0];
export async function withAmmunitionLock(actor, callback) {
  const key = actor.uuid || actor.id;
  const previous = locks.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(callback); locks.set(key, next);
  try { return await next; } finally { if (locks.get(key) === next) locks.delete(key); }
}
function error(reason) { throw new Error(game.i18n.localize(`MYTHRASF.Ranged.Inventory.${reason}`)); }
async function writeItems(actor, updates) {
  return actor.updateEmbeddedDocuments("Item", updates, { mythrasAmmo: true });
}
export async function reconcileAmmunition(actor, { warn = true } = {}) {
  const updates = [];
  for (const weapon of actor.items.filter(item => item.type === "weapon")) {
    let changed = false;
    const modes = weaponModes(weapon).map(mode => {
      if (modeAmmunition(weapon, mode).use !== "projectile" || !count(mode.ammoLoaded)) return { ...mode };
      const issue = ammunitionProblem(actor, weapon, mode);
      if (issue && issue !== "Thrown") { changed = true; return { ...mode, ammoLoaded: 0, reloadProgress: 0 }; }
      return { ...mode };
    });
    if (changed) updates.push({ _id: weapon.id, "system.modes": modes });
  }
  if (updates.length) {
    await writeItems(actor, updates);
    if (warn) ui.notifications.warn(game.i18n.localize("MYTHRASF.Ranged.Inventory.InvalidLoad"));
  }
  return updates.length;
}
async function applyOperation(actor, request) {
  return withAmmunitionLock(actor, async () => {
    const weapon = actor.items.get(request.weaponId);
    if (!weapon || weapon.type !== "weapon") error("MissingWeapon");
    const history = weapon.getFlag?.(SCOPE, "ammunitionOperations") ?? [];
    const previous = history.find(entry => entry.id === request.id);
    if (previous) return previous.result;
    if (request.kind === "recover") {
      if (!weapon.system.thrown) return null;
      if (weapon.system.lodged) error("Lodged");
      await weapon.update({ "system.thrown": false, "system.equipped": false }, { mythrasAmmo: true });
      return { recovered: true };
    }
    await reconcileAmmunition(actor);
    const mode = weaponModes(weapon).find(mode => mode.key === request.modeKey);
    if (!mode || !weapon.system.equipped || weapon.system.activeModeKey !== mode.key || !weaponCanEquip(weapon) || weaponIsPinned(weapon, actor)) error("MissingWeapon");
    const combat = game.combat ?? game.combats?.active;
    const entry = combat?.combatants?.find(entry => entry.actor?.uuid === actor.uuid);
    if (request.kind === "reload" || request.spendAction) {
      if (!combat?.started || !entry || !canStartProactiveAction(combat, entry)) error("WrongTurn");
    }
    const use = modeAmmunition(weapon, mode).use;
    let result, updatedMode = { ...mode }, stock;
    if (request.kind === "reload") {
      if (use !== "projectile") error("SelectAmmunition");
      stock = ammunitionStock(actor, request.itemId);
      if (!ammunitionChoices(actor, weapon, mode).some(candidate => candidate.item.id === request.itemId)) error("SelectAmmunition");
      const same = request.itemId === mode.ammoItemId;
      const loaded = same ? count(mode.ammoLoaded) : 0;
      const capacity = Math.max(1, count(mode.ammoCapacity));
      if (loaded >= capacity) error("AlreadyLoaded");
      if (stock.available < 1) error("NoReserve");
      const progress = (same ? count(mode.reloadProgress) : 0) + 1;
      const completed = progress >= Math.max(1, count(mode.reloadActions));
      updatedMode = { ...mode, ammoItemId: request.itemId, ammoLoaded: completed
        ? loaded + Math.min(capacity - loaded, stock.available) : loaded,
        reloadProgress: completed ? 0 : progress };
      result = { completed };
    } else {
      const issue = ammunitionProblem(actor, weapon, mode);
      if (issue) error(issue);
      if (use === "projectile") {
        stock = ammunitionStock(actor, mode.ammoItemId);
        updatedMode.ammoLoaded = count(mode.ammoLoaded) - 1;
        updatedMode.reloadProgress = 0;
        result = { ...ammunitionView(actor, weapon, updatedMode), name: stock.item.name,
          total: stock.total - 1, allocated: stock.loaded - 1, available: stock.available, consumed: 1 };
      } else if (use === "thrown") result = { thrown: true, name: weapon.name, consumed: 1 };
      else error("SelectAmmunition");
    }
    if ((request.kind === "reload" || request.spendAction)
      && !await spendActorActionPoint(actor, { actionKind: request.kind === "reload" ? "immediate" : "attack" })) error("NoActionPoints");
    const operations = [...history.slice(-39), { id: request.id, result }];
    const update = { _id: weapon.id, "system.modes": weaponModes(weapon).map(entry => entry.key === mode.key ? updatedMode : { ...entry }),
      [`flags.${SCOPE}.ammunitionOperations`]: operations };
    if (use === "thrown") Object.assign(update, { "system.thrown": true, "system.equipped": false });
    const updates = [update];
    if (request.kind === "shoot" && stock) updates.push({ _id: stock.item.id, "system.quantity": stock.total - 1 });
    try { await writeItems(actor, updates); }
    catch (failure) {
      // Embedded updates are one server request. Refund only the AP payment on a failed write.
      if (request.kind === "reload" || request.spendAction) await actor.update({
        "system.resources.actionPoints.value": count(actor.system.resources.actionPoints.value) + 1
      });
      throw failure;
    }
    if (request.kind === "reload"
      && !await finishInterruptionAction(combat, entry.id)
      && combat.combatant?.id === entry.id) await combat.nextTurn();
    return result;
  });
}
export async function requestAmmunitionOperation(actor, request) {
  const message = { ...request, id: request.id || foundry.utils.randomID(), actorUuid: actor.uuid, userId: game.user.id };
  if (!game.user.isGM && !actor.isOwner) error("NoPermission");
  const coordinator = primary();
  if (!coordinator || coordinator.id === game.user.id || !game.socket?.emit) return applyOperation(actor, message);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(message.id); reject(new Error(game.i18n.localize("MYTHRASF.Ranged.Inventory.Timeout"))); }, 30000);
    pending.set(message.id, { resolve, reject, timer });
    game.socket.emit(CHANNEL, { action: "inventoryAmmunition", request: message });
  });
}
export function registerAmmunitionRuntime() {
  game.socket.on(CHANNEL, async message => {
    if (message.action === "inventoryAmmunitionResult" && message.userId === game.user.id) {
      const waiting = pending.get(message.id); if (!waiting) return;
      clearTimeout(waiting.timer); pending.delete(message.id);
      if (message.error) waiting.reject(new Error(message.error)); else waiting.resolve(message.result);
    }
    if (message.action !== "inventoryAmmunition" || primary()?.id !== game.user.id) return;
    const request = message.request;
    const user = game.users.get(request?.userId);
    const actor = request?.actorUuid ? await fromUuid(request.actorUuid) : null;
    if (!user?.active || !actor || (!user.isGM && !actor.testUserPermission(user, "OWNER"))
      || !["shoot", "reload", "recover"].includes(request.kind)) return;
    try {
      const result = await applyOperation(actor, request);
      game.socket.emit(CHANNEL, { action: "inventoryAmmunitionResult", id: request.id, userId: user.id, result });
    } catch (failure) { game.socket.emit(CHANNEL, { action: "inventoryAmmunitionResult", id: request.id, userId: user.id, error: failure.message }); }
  });
  Hooks.on("deleteActiveEffect", async effect => {
    const data = effect.getFlag?.(SCOPE, "timedCondition");
    if (primary()?.id !== game.user.id || !data?.retainedWeapon || !data.ownerActorUuid) return;
    const owner = await fromUuid(data.ownerActorUuid);
    const weapon = owner?.items?.get(data.weaponId);
    if (weapon?.system?.lodged) await weapon.update({ "system.lodged": false }, { mythrasAmmo: true });
  });
  for (const event of ["updateItem", "deleteItem"]) Hooks.on(event, (item, changed, options, userId) => {
    const metadata = event === "deleteItem" ? changed : options;
    const actor = item.actor ?? item.parent;
    if (metadata?.mythrasAmmo || !actor?.items || primary()?.id !== game.user.id) return;
    return withAmmunitionLock(actor, async () => {
      if (item.type === "weapon") {
        const { migrateActorAmmunition } = await import("../migrations/ammunition-migrations.js");
        await migrateActorAmmunition(actor);
      }
      await reconcileAmmunition(actor);
    });
  });
}
