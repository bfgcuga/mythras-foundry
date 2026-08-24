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

const HAZARD_LAUNCHER_COMMAND = `
if (!game.user.isGM) {
  ui.notifications.warn(game.i18n.localize("MYTHRASF.HazardLauncher.GMOnly"));
  return;
}

const choices = ["acid", "fire", "fall", "fatigue", "drowning"];
const options = choices.map((choice, index) => \`<label>
  <input type="radio" class="sheet-state-box" name="hazard" value="\${choice}"\${index === 0 ? " checked" : ""}>
  <span>\${game.i18n.localize(\`MYTHRASF.HazardLauncher.Option.\${choice}\`)}</span>
</label>\`).join("");
const result = await foundry.applications.api.DialogV2.wait({
  window: { title: game.i18n.localize("MYTHRASF.HazardLauncher.Title") },
  content: \`<div class="mythras-foundry mythras-dialog">
    <fieldset><legend>\${game.i18n.localize("MYTHRASF.HazardLauncher.Select")}</legend>
      <div class="sheet-state-list">\${options}</div>
    </fieldset>
  </div>\`,
  buttons: [{
    action: "open",
    label: game.i18n.localize("MYTHRASF.HazardLauncher.Open"),
    icon: "fas fa-arrow-right",
    default: true,
    callback: (event, button) => button.form.elements.hazard.value
  }, {
    action: "cancel",
    label: game.i18n.localize("MYTHRASF.Cancel"),
    icon: "fas fa-times"
  }],
  rejectClose: false
});
if (!result) return;

const launchers = {
  acid: game.mythrasFoundry?.hazards?.acid?.open,
  fire: game.mythrasFoundry?.hazards?.fire?.open,
  fall: game.mythrasFoundry?.hazards?.fall?.open,
  fatigue: game.mythrasFoundry?.fatigueChecks?.open,
  drowning: game.mythrasFoundry?.hazards?.suffocation?.open
};
const open = launchers[result];
if (!open) ui.notifications.error(game.i18n.localize("MYTHRASF.HazardLauncher.Unavailable"));
else await open();
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
  buildKey: "open-hazard-launcher",
  name: "Aplicar peligros y fatiga",
  type: "script",
  img: "icons/svg/hazard.svg",
  command: HAZARD_LAUNCHER_COMMAND,
  flags: { "mythras-foundry": { macroKey: "open-hazard-launcher", macroVersion: 1 } }
}, {
  buildKey: "apply-acid-damage",
  name: "Aplicar daño por ácido",
  type: "script",
  img: "icons/svg/acid.svg",
  command: `
if (!game.user.isGM) {
  ui.notifications.warn(game.i18n.localize("MYTHRASF.Acid.GMOnly"));
  return;
}
const open = game.mythrasFoundry?.hazards?.acid?.open;
if (!open) ui.notifications.error(game.i18n.localize("MYTHRASF.Acid.Unavailable"));
else await open();
`,
  flags: { "mythras-foundry": { macroKey: "apply-acid-damage", macroVersion: 1 } }
}, {
  buildKey: "apply-fire-damage",
  name: "Aplicar daño por fuego",
  type: "script",
  img: "icons/svg/fire.svg",
  command: `
if (!game.user.isGM) {
  ui.notifications.warn(game.i18n.localize("MYTHRASF.Fire.GMOnly"));
  return;
}
const open = game.mythrasFoundry?.hazards?.fire?.open;
if (!open) ui.notifications.error(game.i18n.localize("MYTHRASF.Fire.Unavailable"));
else await open();
`,
  flags: { "mythras-foundry": { macroKey: "apply-fire-damage", macroVersion: 1 } }
}, {
  buildKey: "apply-fall-damage",
  name: "Aplicar daño por caída",
  type: "script",
  img: "icons/svg/falling.svg",
  command: `
if (!game.user.isGM) {
  ui.notifications.warn(game.i18n.localize("MYTHRASF.Fall.GMOnly"));
  return;
}
const open = game.mythrasFoundry?.hazards?.fall?.open;
if (!open) ui.notifications.error(game.i18n.localize("MYTHRASF.Fall.Unavailable"));
else await open();
`,
  flags: { "mythras-foundry": { macroKey: "apply-fall-damage", macroVersion: 1 } }
}, {
  buildKey: "apply-suffocation",
  name: "Aplicar asfixia",
  type: "script",
  img: "icons/svg/drowning.svg",
  command: `
if (!game.user.isGM) {
  ui.notifications.warn(game.i18n.localize("MYTHRASF.Suffocation.GMOnly"));
  return;
}
const open = game.mythrasFoundry?.hazards?.suffocation?.open;
if (!open) ui.notifications.error(game.i18n.localize("MYTHRASF.Suffocation.Unavailable"));
else await open();
`,
  flags: { "mythras-foundry": { macroKey: "apply-suffocation", macroVersion: 1 } }
}, {
  buildKey: "request-fatigue-checks",
  name: "Solicitar tiradas de fatiga",
  type: "script",
  img: "icons/svg/downgrade.svg",
  command: `
if (!game.user.isGM) {
  ui.notifications.warn(game.i18n.localize("MYTHRASF.FatigueCheck.GMOnly"));
  return;
}
const open = game.mythrasFoundry?.fatigueChecks?.open;
if (!open) ui.notifications.error(game.i18n.localize("MYTHRASF.FatigueCheck.Unavailable"));
else await open();
`,
  flags: { "mythras-foundry": { macroKey: "request-fatigue-checks", macroVersion: 1 } }
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
  buildKey: "open-homebrew-item-creator",
  name: "Crear contenido homebrew",
  type: "script",
  img: "icons/svg/item-bag.svg",
  command: `
if (!game.user.isGM) {
  ui.notifications.warn(game.i18n.localize("MYTHRASF.Homebrew.GMOnly"));
  return;
}
const creator = game.mythrasFoundry?.homebrew?.open?.();
if (!creator) ui.notifications.error(game.i18n.localize("MYTHRASF.Homebrew.Unavailable"));
`,
  flags: { "mythras-foundry": {
    macroKey: "open-homebrew-item-creator", macroVersion: 1
  } }
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
