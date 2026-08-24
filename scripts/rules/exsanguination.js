import { actorDisplayName, actorSpeaker } from "./document-names.js";
import { applyTimedCondition } from "./timed-condition-runtime.js";
import { timedConditionSource, TIMED_CONDITION_FLAG,
  TIMED_CONDITION_SCOPE } from "./timed-conditions.js";

export const EXSANGUINATING_STATUS_ID = "exsanguinating";
const ICON = "icons/svg/blood.svg";
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

export function exsanguinationConditionSource() {
  return timedConditionSource({ key: EXSANGUINATING_STATUS_ID,
    statusId: EXSANGUINATING_STATUS_ID,
    duration: { unit: "manual", phase: "startRound" } });
}

export async function initializeExsanguinatingEffect(effect) {
  if (!effect?.statuses?.has?.(EXSANGUINATING_STATUS_ID)) return null;
  const existing = effect.getFlag?.(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG)
    ?? effect.flags?.[TIMED_CONDITION_SCOPE]?.[TIMED_CONDITION_FLAG];
  if (existing?.key === EXSANGUINATING_STATUS_ID) return effect;
  await effect.update({ [`flags.${TIMED_CONDITION_SCOPE}.${TIMED_CONDITION_FLAG}`]:
    exsanguinationConditionSource() });
  return effect;
}

export async function applyExsanguination(actor) {
  if (!actor || !["character", "npc"].includes(actor.type)) return null;
  const existing = Array.from(actor.effects ?? []).find((effect) =>
    effect.statuses?.has?.(EXSANGUINATING_STATUS_ID));
  if (existing) {
    await initializeExsanguinatingEffect(existing);
    return { effect: existing, created: false };
  }
  const [effect] = await applyTimedCondition(actor, {
    key: EXSANGUINATING_STATUS_ID, statusId: EXSANGUINATING_STATUS_ID,
    name: game.i18n.localize("MYTHRASF.Status.Exsanguinating"), img: ICON,
    duration: { unit: "manual", phase: "startRound" }
  });
  return effect ? { effect, created: true } : null;
}

export async function openExsanguinationMacro() {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Exsanguination.GMOnly")); return null;
  }
  const controlled = canvas.tokens?.controlled ?? [];
  if (controlled.length !== 1 || !["character", "npc"].includes(controlled[0]?.actor?.type)) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Exsanguination.SelectOneToken"));
    return null;
  }
  const token = controlled[0]; const actor = token.actor;
  const result = await applyExsanguination(actor);
  if (!result) return null;
  await ChatMessage.create({ speaker: actorSpeaker(actor, token),
    content: `<section class="mythras-chat-card"><div class="mythras-chat-title">${escape(game.i18n.localize("MYTHRASF.Exsanguination.ChatTitle"))}</div><div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Exsanguination.Target"))}</span><strong>${escape(actorDisplayName(actor))}</strong></div><div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Exsanguination.Effect"))}</span><strong>${escape(game.i18n.localize("MYTHRASF.Exsanguination.Automation"))}</strong></div></section>` });
  return result;
}

export function createExsanguinationApi() {
  return Object.freeze({ open: openExsanguinationMacro, apply: applyExsanguination });
}
