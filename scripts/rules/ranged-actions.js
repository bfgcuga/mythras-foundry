import { modeAmmunition, ammunitionChoices, ammunitionView } from "./ammunition.js";
import { requestAmmunitionOperation } from "./ammunition-runtime.js";
import { canStartProactiveAction, finishInterruptionAction } from "./combat-interruption.js";
import { spendActorActionPoint } from "./combat-resource-runtime.js";
import { effectiveActionPointMaximum } from "./action-points.js";
import { getActionPointRules } from "../settings.js";
import { weaponModes } from "./weapon-modes.js";
import { weaponCanEquip } from "./weapon-durability.js";
import { weaponIsPinned } from "./weapon-pinning.js";

const SCOPE = "mythras-foundry";
const AIM = "rangedAim";
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

function activeEntry(actor) {
  const combat = game.combat ?? game.combats?.active;
  if (!combat?.started) return null;
  const entry = combat.combatants.find((candidate) => candidate.actor?.uuid === actor.uuid
    || candidate.token?.actor?.uuid === actor.uuid);
  return entry && canStartProactiveAction(combat, entry) ? { combat, entry } : null;
}

async function spend(actor) {
  if (!activeEntry(actor)) return false;
  if (effectiveActionPointMaximum(actor, getActionPointRules()) < 1) return false;
  return spendActorActionPoint(actor, { actionKind: "immediate" });
}

function rangedChoices(actor) {
  return actor.items.filter((item) => item.type === "weapon" && item.system.equipped
    && weaponCanEquip(item) && !weaponIsPinned(item, actor))
    .flatMap((weapon) => weaponModes(weapon).filter((mode) => mode.key === weapon.system.activeModeKey
      && ["ranged", "siege"].includes(mode.weaponType)).map((mode) => ({ weapon, mode })));
}

async function chooseWeapon(actor, title) {
  const choices = rangedChoices(actor); if (!choices.length) return null;
  const selected = await foundry.applications.api.DialogV2.wait({ window: { title },
    content: `<div class="mythras-foundry mythras-dialog"><label><span>${game.i18n.localize("MYTHRASF.Weapon.Name")}</span><select name="weapon">${choices.map(({ weapon, mode }) => `<option value="${weapon.id}:${escape(mode.key)}">${escape(weapon.name)}${mode.name ? ` — ${escape(mode.name)}` : ""}</option>`).join("")}</select></label></div>`,
    buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.CombatEffect.Confirm"),
      callback: (_event, button) => button.form.elements.weapon.value },
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel") }], rejectClose: false });
  if (!selected) return null;
  const [weaponId, modeKey] = selected.split(":");
  return choices.find(({ weapon, mode }) => weapon.id === weaponId && mode.key === modeKey) ?? null;
}

export async function declareAim(actor) {
  const active = activeEntry(actor);
  if (!active || (!game.user.isGM && !actor.isOwner)) return ui.notifications.warn(
    game.i18n.localize("MYTHRASF.Tracker.Rejected.turn"));
  const choice = await chooseWeapon(actor, game.i18n.localize("MYTHRASF.Ranged.Aim"));
  const targets = Array.from(game.user.targets ?? []);
  if (!choice || targets.length !== 1) return ui.notifications.warn(
    game.i18n.localize("MYTHRASF.Ranged.AimOneTarget"));
  if (!await spend(actor)) return ui.notifications.warn(
    game.i18n.localize("MYTHRASF.Tracker.Rejected.actionPoints"));
  const economy = active.combat.mythrasTurnEconomy;
  await actor.setFlag(SCOPE, AIM, { schemaVersion: 1, combatId: active.combat.id,
    combatantId: active.entry.id, weaponId: choice.weapon.id, modeKey: choice.mode.key,
    targetTokenUuid: targets[0].document?.uuid ?? targets[0].uuid, declaredRound: active.combat.round,
    declaredCycle: economy.cycle ?? 1, userId: game.user.id, declaredAt: Date.now() });
  ui.notifications.info(game.i18n.localize("MYTHRASF.Ranged.AimDeclared"));
  await finishInterruptionAction(active.combat, active.entry.id);
}

export function readyAim(actor, { weaponId, modeKey, targetTokenUuid, combat } = {}) {
  const aim = actor?.getFlag?.(SCOPE, AIM); if (!aim || aim.combatId !== combat?.id
    || aim.weaponId !== weaponId || aim.modeKey !== modeKey || aim.targetTokenUuid !== targetTokenUuid) return null;
  const cycle = combat.mythrasTurnEconomy?.cycle ?? 1;
  return Number(combat.round) > Number(aim.declaredRound)
    || (Number(combat.round) === Number(aim.declaredRound) && Number(cycle) > Number(aim.declaredCycle))
    ? aim : null;
}

export async function clearAim(actor) {
  if (actor?.getFlag?.(SCOPE, AIM)) await actor.unsetFlag(SCOPE, AIM);
}

export async function reloadRangedWeapon(actor) {
  const active = activeEntry(actor);
  if (!active || (!game.user.isGM && !actor.isOwner)) return ui.notifications.warn(
    game.i18n.localize("MYTHRASF.Tracker.Rejected.turn"));
  const choice = await chooseWeapon(actor, game.i18n.localize("MYTHRASF.Ranged.Reload"));
  if (!choice) return;
  const use = modeAmmunition(choice.weapon, choice.mode).use;
  if (use === "thrown") return ui.notifications.warn(game.i18n.localize("MYTHRASF.Ranged.Inventory.NoReloadThrown"));
  if (use === "projectile") {
    const stocks = ammunitionChoices(actor, choice.weapon, choice.mode);
    const selected = choice.mode.ammoItemId;
    const current = ammunitionView(actor, choice.weapon, choice.mode);
    const availableSelection = stocks.some(stock => stock.item.id === selected && stock.total > 0);
    const content = `<div class="mythras-foundry mythras-dialog"><p>${escape(game.i18n.localize("MYTHRASF.Ranged.Inventory.ReloadHint"))}</p><p>${escape(game.i18n.format("MYTHRASF.Ranged.Inventory.LoadState", current))}</p><label><span>${escape(game.i18n.localize("MYTHRASF.Ranged.Inventory.Ammunition"))}</span><select name="ammunition">${!availableSelection ? `<option value="" selected>${escape(game.i18n.localize("MYTHRASF.Ranged.Inventory.SelectAmmunition"))}</option>` : ""}${stocks.map(stock => `<option value="${stock.item.id}" ${stock.item.id === selected && availableSelection ? "selected" : ""} ${stock.available < 1 && stock.item.id !== selected ? "disabled" : ""}>${escape(stock.item.name)} — ${escape(game.i18n.format("MYTHRASF.Ranged.Inventory.StockState", stock))}</option>`).join("")}</select></label></div>`;
    const itemId = await foundry.applications.api.DialogV2.wait({ window: { title: game.i18n.localize("MYTHRASF.Ranged.Reload") }, content,
      buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.CombatEffect.Confirm"),
        callback: (_event, button) => button.form.elements.ammunition.value },
      { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel") }], rejectClose: false });
    if (itemId == null) return;
    if (!itemId) return ui.notifications.warn(game.i18n.localize("MYTHRASF.Ranged.Inventory.SelectAmmunition"));
    try {
      const next = await requestAmmunitionOperation(actor, { kind: "reload", weaponId: choice.weapon.id,
        modeKey: choice.mode.key, itemId });
      ui.notifications.info(game.i18n.localize(next.completed ? "MYTHRASF.Ranged.ReloadComplete" : "MYTHRASF.Ranged.ReloadProgress"));
      await finishInterruptionAction(active.combat, active.entry.id);
    } catch (failure) { ui.notifications.warn(failure.message); }
    return;
  }
  return ui.notifications.warn(game.i18n.localize("MYTHRASF.Ranged.Inventory.SelectAmmunition"));
}
