import { aimEligibility, aimState, clearAim } from "./aim.js";
import { requestAim } from "./aim-runtime.js";
export { clearAim } from "./aim.js";
import { modeAmmunition, ammunitionChoices, ammunitionView } from "./ammunition.js";
import { requestAmmunitionOperation } from "./ammunition-runtime.js";
import { canStartProactiveAction } from "./combat-interruption.js";
import { weaponModes } from "./weapon-modes.js";
import { weaponCanEquip } from "./weapon-durability.js";
import { weaponIsPinned } from "./weapon-pinning.js";

const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

function activeEntry(actor) {
  const combat = game.combat ?? game.combats?.active;
  if (!combat?.started) return null;
  const entry = combat.combatants.find((candidate) => candidate.actor?.uuid === actor.uuid
    || candidate.token?.actor?.uuid === actor.uuid);
  return entry && canStartProactiveAction(combat, entry) ? { combat, entry } : null;
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
  if (!active || active.combat.combatant?.id !== active.entry.id || (!game.user.isGM && !actor.isOwner)) return ui.notifications.warn(
    game.i18n.localize("MYTHRASF.Tracker.Rejected.turn"));
  const reason = aimEligibility(actor, active.combat);
  if (reason) return ui.notifications.warn(game.i18n.localize(`MYTHRASF.Action.Unavailable.${reason}`));
  const preparing = aimState(actor, active.combat);
  if (preparing?.phase === "preparing") {
    try {
      await requestAim(active.combat, active.entry, preparing);
      ui.notifications.info(game.i18n.localize("MYTHRASF.Ranged.AimDeclared"));
    } catch (failure) { ui.notifications.warn(failure.message); }
    return;
  }
  const choice = await chooseWeapon(actor, game.i18n.localize("MYTHRASF.Ranged.Aim"));
  if (!choice) return;
  const targets = Array.from(game.user.targets ?? []);
  if (targets.length !== 1) return ui.notifications.warn(game.i18n.localize("MYTHRASF.Ranged.AimOneTarget"));
  try {
    const state = await requestAim(active.combat, active.entry, { weaponId: choice.weapon.id,
      modeKey: choice.mode.key, targetTokenUuid: targets[0].document?.uuid ?? targets[0].uuid });
    if (state) ui.notifications.info(game.i18n.localize("MYTHRASF.Ranged.AimDeclared"));
  } catch (failure) { ui.notifications.warn(failure.message); }
}

export function readyAim(actor, { weaponId, modeKey, targetTokenUuid, combat } = {}) {
  const aim = aimState(actor, combat);
  return aim?.phase === "ready" && aim.weaponId === weaponId && aim.modeKey === modeKey
    && aim.targetTokenUuid === targetTokenUuid ? aim : null;
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
    } catch (failure) { ui.notifications.warn(failure.message); }
    return;
  }
  return ui.notifications.warn(game.i18n.localize("MYTHRASF.Ranged.Inventory.SelectAmmunition"));
}
