import { combatantForActor, consumePassiveBlock } from "./engagement-runtime.js";
import { actorDisplayName, actorSpeaker } from "./document-names.js";
import { findWeaponMode } from "./weapon-modes.js";
import { isNaturalWeaponMode } from "./passive-block.js";
import { actorLoadState } from "./actor-conditions.js";
import { resolveSkillRollConditions } from "./skill-roll-resolution.js";
import { askWoundRollImpact } from "../ui/wound-roll-dialog.js";

const localize = (key) => game.i18n.localize(key);
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
export const FREE_COMBAT_ACTIONS = ["speak", "gesture", "dropWeapon", "assessSituation"];

export function heldDroppableWeapons(actor) {
  return actor.items.filter((item) => item.type === "weapon" && item.system.equipped
    && !isNaturalWeaponMode(findWeaponMode(item)));
}

async function announce(actor, key, description) {
  return ChatMessage.create({ speaker: actorSpeaker(actor),
    content: `<section class="mythras-chat-card"><h3 class="mythras-chat-title">${escape(localize(`MYTHRASF.Action.${key}`))}</h3><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Action.Actor"))}</span><span>${escape(actorDisplayName(actor))}</span></div><p>${escape(description)}</p></section>` });
}

export async function requestFreeCombatAction(actor, key, { manual = false } = {}) {
  if (!FREE_COMBAT_ACTIONS.includes(key) || (!game.user.isGM && !actor?.isOwner)) return;
  const Dialog = foundry.applications.api.DialogV2;
  if (["speak", "gesture"].includes(key)) {
    const note = await Dialog.prompt({ window: { title: localize(`MYTHRASF.Action.${key}`) },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.Action.Note"))}</span><textarea name="note" required></textarea></label></div>`,
      ok: { callback: (event, button) => button.form.elements.note.value.trim() }, rejectClose: false });
    if (!note || !note.trim() || (!game.user.isGM && !actor.isOwner)) return;
    return announce(actor, key, note.trim());
  }
  if (key === "dropWeapon") {
    const weapons = heldDroppableWeapons(actor);
    if (!weapons.length) return ui.notifications.warn(localize("MYTHRASF.FreeAction.NoHeldWeapon"));
    const selected = await Dialog.wait({ window: { title: localize("MYTHRASF.Action.dropWeapon") },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.Weapon.Name"))}</span><select name="weapon">${weapons.map((weapon) => `<option value="${escape(weapon.id)}">${escape(weapon.name)}</option>`).join("")}</select></label></div>`,
      buttons: [{ action: "confirm", label: localize("MYTHRASF.Action.dropWeapon"),
        callback: (event, button) => button.form.elements.weapon.value },
      { action: "cancel", label: localize("MYTHRASF.Cancel") }], rejectClose: false });
    const weapon = heldDroppableWeapons(actor).find((item) => item.id === selected);
    if (!weapon || (!game.user.isGM && !actor.isOwner)) return;
    await weapon.update({ "system.equipped": false });
    for (const combat of game.combats ?? []) {
      const combatant = combatantForActor(combat, actor, actor.token?.uuid);
      if (combatant) await consumePassiveBlock(combat, combatant.id, weapon.id, "dropWeapon");
    }
    return announce(actor, key, localize("MYTHRASF.FreeAction.DroppedWeapon").replace("{weapon}", weapon.name));
  }
  const confirmed = await Dialog.confirm({ window: { title: localize("MYTHRASF.Action.assessSituation") },
    content: `<div class="mythras-foundry mythras-dialog"><p>${escape(localize("MYTHRASF.FreeAction.AssessWarning"))}</p></div>`, rejectClose: false });
  if (!confirmed || (!game.user.isGM && !actor.isOwner)) return;
  const skill = actor.items.find((item) => item.type === "skill" && item.system.slug === "percepcion");
  if (!skill) return ui.notifications.warn(localize("MYTHRASF.FreeAction.NoPerception"));
  const woundImpact = await askWoundRollImpact(actor);
  const { difficulty, modifiers } = resolveSkillRollConditions(actor, skill,
    { woundImpact, loadState: actorLoadState(actor) });
  return skill.rollSkill({ difficulty, modifiers, manual });
}
