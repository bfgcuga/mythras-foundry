const AWARD_PARTY_EXPERIENCE_COMMAND = `
if (!game.user.isGM) {
  ui.notifications.warn(game.i18n.localize("MYTHRASF.Macro.Experience.GMOnly"));
  return;
}

const { DialogV2 } = foundry.applications.api;
const result = await DialogV2.wait({
  window: { title: game.i18n.localize("MYTHRASF.Macro.Experience.Title") },
  content: \`<div class="mythras-foundry party-experience-dialog">
    <label><span>\${game.i18n.localize("MYTHRASF.Macro.Experience.Amount")}</span>
      <input type="number" name="amount" class="sheet-field-editable" min="0" step="1" value="1" autofocus></label>
    <label><input type="checkbox" class="sheet-state-box" name="applyModifier">
      <span>\${game.i18n.localize("MYTHRASF.Macro.Experience.ApplyModifier")}</span></label>
  </div>\`,
  buttons: [{
    action: "award",
    label: game.i18n.localize("MYTHRASF.Macro.Experience.Award"),
    icon: "fas fa-award",
    default: true,
    callback: (event, button) => ({
      amount: Number(button.form.elements.amount.value),
      applyModifier: button.form.elements.applyModifier.checked
    })
  }, {
    action: "cancel",
    label: game.i18n.localize("MYTHRASF.Cancel"),
    icon: "fas fa-times"
  }],
  rejectClose: false
});
if (!result) return;
if (!Number.isInteger(result.amount) || result.amount < 0) {
  ui.notifications.warn(game.i18n.localize("MYTHRASF.Macro.Experience.InvalidAmount"));
  return;
}

const members = game.mythrasFoundry?.party?.getActiveMembers?.() ?? [];
const activeParty = game.mythrasFoundry?.party?.getActiveParty?.();
if (!activeParty || members.length === 0) {
  ui.notifications.warn(game.i18n.localize("MYTHRASF.Macro.Experience.EmptyParty"));
  return;
}

const awards = members.map((actor) => {
  const modifier = result.applyModifier
    ? Number(actor.system.attributes?.experienceModifier ?? 0)
    : 0;
  return { actor, modifier, award: Math.max(0, result.amount + modifier) };
});
await Promise.all(awards.map(({ actor, award }) => actor.update({
  "system.experienceRolls": Number(actor.system.experienceRolls ?? 0) + award
})));

const rows = awards.map(({ actor, modifier, award }) =>
  \`<li><strong>\${foundry.utils.escapeHTML(actor.name)}</strong>: +\${award}\${
    result.applyModifier ? \` (\${result.amount} \${modifier >= 0 ? "+" : "−"} \${Math.abs(modifier)})\` : ""
  }</li>\`).join("");
await ChatMessage.create({
  content: \`<strong>\${game.i18n.format("MYTHRASF.Macro.Experience.ChatTitle", {
    party: foundry.utils.escapeHTML(activeParty.name)
  })}</strong><br><br><ul>\${rows}</ul>\`,
  speaker: ChatMessage.getSpeaker()
});
`;

export const MACRO_SOURCES = [{
  buildKey: "award-party-experience-rolls",
  name: "Asignar tiradas de experiencia al grupo",
  type: "script",
  img: "icons/svg/upgrade.svg",
  command: AWARD_PARTY_EXPERIENCE_COMMAND,
  flags: { "mythras-foundry": { macroKey: "award-party-experience-rolls" } }
}, {
  buildKey: "manage-parties",
  name: "Gestionar grupos de personajes",
  type: "script",
  img: "icons/svg/mystery-man.svg",
  command: `
if (!game.user.isGM) {
  ui.notifications.warn(game.i18n.localize("MYTHRASF.Macro.PartyManager.GMOnly"));
  return;
}
const manager = game.mythrasFoundry?.party?.openManager?.();
if (!manager) {
  ui.notifications.error(game.i18n.localize("MYTHRASF.Macro.PartyManager.Unavailable"));
}
`,
  flags: { "mythras-foundry": { macroKey: "manage-parties" } }
}];
