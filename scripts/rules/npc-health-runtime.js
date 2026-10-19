import { globalHealthConfigurationValid, healthHitPoints, normalizeAbsentCharacteristics,
  usesGlobalHitPoints } from "./health.js";
import { actorSpeaker, actorDisplayName } from "./document-names.js";

const invalid = () => {
  ui.notifications.warn(game.i18n.localize("MYTHRASF.Health.InvalidBody"));
  return false;
};

export function prepareGlobalHealthItemUpdate(item, changed, options = {}) {
  if (item.type !== "hitLocation" || !usesGlobalHitPoints(item)) return;
  const expanded = foundry.utils.expandObject(changed);
  const system = foundry.utils.mergeObject(item.system.toObject?.() ?? { ...item.system },
    expanded.system ?? {}, { inplace: false });
  if (!globalHealthConfigurationValid(item.actor?.system ?? item.parent.system,
    [{ type: "hitLocation", system }]) || system.disabled
    || Number(system.permanentWound?.severity ?? 0) > 0) return invalid();
  if (expanded.system?.currentHitPoints !== undefined) {
    const next = healthHitPoints(item, expanded.system.currentHitPoints);
    foundry.utils.setProperty(changed, "system.currentHitPoints", next);
    if (Number(item.system.currentHitPoints) > 0 && next === 0) {
      options.mythrasGlobalHealthExhausted ??= {};
      options.mythrasGlobalHealthExhausted[item.id] = true;
    }
  }
}

export async function announceGlobalHealthExhausted(item, options, userId) {
  if (userId !== game.user.id || !options?.mythrasGlobalHealthExhausted?.[item.id]
    || !usesGlobalHitPoints(item)) return;
  const actor = item.actor ?? item.parent;
  const escape = (text) => foundry.utils.escapeHTML(String(text));
  await ChatMessage.create({ speaker: actorSpeaker(actor),
    content: `<section class="mythras-chat-card"><div class="mythras-chat-title">${escape(actorDisplayName(actor))}</div><div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Health.Exhausted"))}</span></div></section>` });
}

export function registerNpcHealthHooks() {
  Hooks.on("preCreateActor", (actor, data) => {
    if ((data.type ?? actor.type) !== "npc") return;
    const system = normalizeAbsentCharacteristics(foundry.utils.deepClone(data.system ?? actor.system.toObject()));
    if (!globalHealthConfigurationValid(system, data.items ?? actor.items)) return invalid();
    actor.updateSource({ system });
  });
  Hooks.on("preUpdateActor", (actor, changed) => {
    if (actor.type !== "npc") return;
    const expanded = foundry.utils.expandObject(changed);
    const candidate = foundry.utils.mergeObject(actor.system.toObject(), expanded.system ?? {}, { inplace: false });
    if (!globalHealthConfigurationValid(candidate, expanded.items ?? actor.items)) return invalid();
    normalizeAbsentCharacteristics(candidate);
    if (candidate.absentCharacteristics?.length) {
      foundry.utils.setProperty(changed, "system.characteristicFormulas", candidate.characteristicFormulas);
      foundry.utils.setProperty(changed, "system.attributeOverrides", candidate.attributeOverrides);
    }
  });
  Hooks.on("preCreateItem", (item, data) => {
    const actor = item.actor ?? item.parent;
    if (!usesGlobalHitPoints(actor) || (data.type ?? item.type) !== "hitLocation") return;
    // During Actor creation the initial embedded Item may already be present
    // in the in-memory collection. Count it once, rather than rejecting imports.
    const existing = Array.from(actor.items).filter((entry) => entry.id !== item.id);
    if (!globalHealthConfigurationValid(actor.system, [...existing,
      { type: data.type ?? item.type, system: data.system ?? item.system }])) return invalid();
  });
  Hooks.on("preDeleteItem", (item) => {
    if (item.type === "hitLocation" && usesGlobalHitPoints(item)) return invalid();
  });
  Hooks.on("preUpdateItem", prepareGlobalHealthItemUpdate);
  Hooks.on("updateItem", (item, changed, options, userId) => announceGlobalHealthExhausted(item, options, userId));
}
