const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

export function ruleHelpButton(attributes = "", label = game.i18n.localize("MYTHRASF.Combat.CheckHelp")) {
  return `<button type="button" class="sheet-icon-button mythras-help-button" ${attributes} title="${escape(label)}" aria-label="${escape(label)}"><i class="fas fa-circle-question" aria-hidden="true"></i></button>`;
}

export function openRuleHelp(title, description) {
  return foundry.applications.api.DialogV2.wait({
    window: { title }, position: { width: 480 },
    content: `<div class="mythras-foundry mythras-dialog"><p>${escape(description)}</p></div>`,
    buttons: [{ action: "close", label: game.i18n.localize("MYTHRASF.Close") }], rejectClose: false
  });
}
