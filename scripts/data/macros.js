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

const rows = awards.map(({ actor, modifier, award }) => \`
  <div class="mythras-chat-member">
    <strong>\${foundry.utils.escapeHTML(actor.name)}</strong>
    <div class="mythras-chat-row"><span>\${game.i18n.localize("MYTHRASF.Chat.Awarded")}</span><span>+\${result.amount}</span></div>
    <div class="mythras-chat-row"><span>\${game.i18n.localize("MYTHRASF.Chat.ExperienceModifier")}</span><span>\${modifier >= 0 ? "+" : "−"}\${Math.abs(modifier)}</span></div>
    <div class="mythras-chat-total"><span>\${game.i18n.localize("MYTHRASF.Chat.Total")}</span><strong>+\${award}</strong></div>
  </div>\`).join("");
await ChatMessage.create({
  content: \`<section class="mythras-chat-card">
    <div class="mythras-chat-title">\${game.i18n.format("MYTHRASF.Macro.Experience.ChatTitle", {
      party: foundry.utils.escapeHTML(activeParty.name)
    })}</div>\${rows}</section>\`,
  speaker: ChatMessage.getSpeaker()
});
`;

export const MACRO_SOURCES = [{
  buildKey: "award-party-experience-rolls",
  name: "Asignar tiradas de experiencia al grupo",
  type: "script",
  img: "icons/svg/upgrade.svg",
  command: AWARD_PARTY_EXPERIENCE_COMMAND,
  flags: { "mythras-foundry": {
    macroKey: "award-party-experience-rolls", macroVersion: 2
  } }
}, {
  buildKey: "open-item-catalog",
  name: "Abrir catálogo de objetos",
  type: "script",
  img: "icons/svg/coins.svg",
  command: `
const catalog = game.mythrasFoundry?.shop?.open?.();
if (!catalog) ui.notifications.error(game.i18n.localize("MYTHRASF.Catalog.Unavailable"));
`,
  flags: { "mythras-foundry": { macroKey: "open-item-catalog", macroVersion: 1 } }
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
  flags: { "mythras-foundry": { macroKey: "manage-parties", macroVersion: 2 } }
}];

export function managedMacroUpdate(macro) {
  const flags = macro.flags?.["mythras-foundry"] ?? {};
  const key = macro.getFlag?.("mythras-foundry", "macroKey") ?? flags.macroKey;
  const version = Number(
    macro.getFlag?.("mythras-foundry", "macroVersion") ?? flags.macroVersion ?? 0
  );
  const source = MACRO_SOURCES.find((candidate) => candidate.buildKey === key);
  const sourceVersion = Number(source?.flags?.["mythras-foundry"]?.macroVersion ?? 0);
  if (!source || version >= sourceVersion) return null;
  return {
    _id: macro.id,
    name: source.name,
    type: source.type,
    img: source.img,
    scope: "global",
    command: source.command,
    flags: source.flags
  };
}
