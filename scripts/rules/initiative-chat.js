function escape(value) {
  const text = String(value ?? "");
  return globalThis.foundry?.utils?.escapeHTML?.(text)
    ?? text.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function signed(value) {
  const number = Number(value) || 0;
  return number >= 0 ? `+${number}` : String(number);
}

export function renderInitiativeChat(entries, { localize, format } = {}) {
  const translate = localize ?? ((key) => key);
  const interpolate = format ?? ((key, data) => `${key} ${JSON.stringify(data)}`);
  const rows = Array.from(entries ?? []).map((entry) => {
    const tie = entry.tieBreak == null ? "" : `<div class="mythras-chat-row"><span>${escape(translate("MYTHRASF.Tracker.InitiativeTieBreak"))} (1d100)</span><strong class="mythras-chat-roll-value">${escape(entry.tieBreak)}</strong></div>`;
    return `<fieldset class="mythras-initiative-entry"><legend>${escape(entry.name)}</legend><div class="mythras-chat-row"><span>${escape(translate("MYTHRASF.Tracker.InitiativeRoll"))} (1d10)</span><strong class="mythras-chat-roll-value">${escape(entry.roll)}</strong></div><div class="mythras-chat-row"><span>${escape(translate("MYTHRASF.Tracker.InitiativeBonus"))}</span><strong>${escape(signed(entry.bonus))}</strong></div>${tie}<div class="mythras-chat-total"><span>${escape(translate("MYTHRASF.Chat.Result"))}</span><strong>${escape(entry.total)}</strong></div></fieldset>`;
  }).join("");
  const title = entries.length > 1
    ? interpolate("MYTHRASF.Tracker.InitiativeGroupTitle", { count: entries.length })
    : translate("MYTHRASF.Tracker.InitiativeTitle");
  return `<section class="mythras-chat-card mythras-initiative-card"><div class="mythras-chat-title">${escape(title)}</div>${rows}</section>`;
}
