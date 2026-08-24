import { actorDisplayName, actorSpeaker } from "./document-names.js";
import { applyDeath, defeatedStatusId } from "./death.js";
import { applyTimedCondition } from "./timed-condition-runtime.js";
import { TIMED_CONDITION_FLAG, TIMED_CONDITION_SCOPE,
  timedConditionSource } from "./timed-conditions.js";

export const DYING_STATUS_ID = "dying";
export const DYING_DURATION_MODES = Object.freeze(["custom", "healingRate2", "healingRate60"]);
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

export function dyingRounds({ mode = "custom", customRounds = 1, healingRate = 1 } = {}) {
  const rate = Math.max(1, Math.floor(Number(healingRate) || 1));
  if (mode === "healingRate2") return rate * 2;
  if (mode === "healingRate60") return rate * 60;
  return Math.max(1, Math.floor(Number(customRounds) || 1));
}

export function shouldReplaceDying(currentRemaining, newRemaining) {
  return Math.max(1, Number(newRemaining) || 1) < Math.max(1,
    Number(currentRemaining) || 1);
}

export function criticalWoundOutcome({ extremity = false, enduranceSucceeded = false,
  healingRate = 1 } = {}) {
  if (extremity) return Object.freeze({ outcome: "dying", mode: "healingRate60",
    rounds: dyingRounds({ mode: "healingRate60", healingRate }) });
  if (enduranceSucceeded) return Object.freeze({ outcome: "dying", mode: "healingRate2",
    rounds: dyingRounds({ mode: "healingRate2", healingRate }) });
  return Object.freeze({ outcome: "dead", mode: null, rounds: 0 });
}

export function dyingConditionSource(rounds, { combat = null, mode = "custom",
  locationId = "", sourceName = "" } = {}) {
  const remaining = Math.max(1, Math.floor(Number(rounds) || 1));
  return timedConditionSource({ key: DYING_STATUS_ID, statusId: DYING_STATUS_ID,
    source: { name: sourceName }, combat, locationId,
    duration: { unit: "dyingRounds", phase: "startRound", value: remaining },
    metadata: { original: remaining, remaining, durationMode: mode,
      lastCountedCombatUuid: "", lastCountedRound: null } });
}

export function dyingEffect(actor) {
  return Array.from(actor?.effects ?? []).find((effect) => effect.statuses?.has?.(DYING_STATUS_ID))
    ?? null;
}

export function dyingCondition(effect) {
  return effect?.getFlag?.(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG)
    ?? effect?.flags?.[TIMED_CONDITION_SCOPE]?.[TIMED_CONDITION_FLAG] ?? null;
}

function activeCombatFor(actor) {
  return game.combats?.find?.((combat) => combat.started
    && combat.combatants.some((entry) => entry.actor?.uuid === actor.uuid)) ?? null;
}

export async function initializeDyingEffect(effect) {
  if (!effect?.statuses?.has?.(DYING_STATUS_ID)) return null;
  if (dyingCondition(effect)?.key === DYING_STATUS_ID) return effect;
  const actor = effect.parent;
  const rounds = dyingRounds({ mode: "healingRate2",
    healingRate: actor?.system?.attributes?.healingRate });
  const combat = activeCombatFor(actor);
  await effect.update({ [`flags.${TIMED_CONDITION_SCOPE}.${TIMED_CONDITION_FLAG}`]:
    dyingConditionSource(rounds, { mode: "healingRate2", combat: combat ? {
      uuid: combat.uuid, round: combat.round, cycle: combat.mythrasTurnEconomy?.cycle,
      turn: combat.turn } : null }) });
  return effect;
}

export async function applyDying(actor, { rounds, mode = "custom", locationId = "",
  sourceName = "" } = {}) {
  if (!actor || !["character", "npc"].includes(actor.type)) return null;
  if (actor.statuses?.has?.(defeatedStatusId())) return null;
  const next = Math.max(1, Math.floor(Number(rounds) || 1));
  const existing = dyingEffect(actor);
  if (existing) {
    await initializeDyingEffect(existing);
    const current = dyingCondition(existing);
    if (!shouldReplaceDying(current.remaining, next)) {
      return { effect: existing, created: false, replaced: false,
        remaining: Number(current.remaining) };
    }
    await existing.update({ [`flags.${TIMED_CONDITION_SCOPE}.${TIMED_CONDITION_FLAG}`]: {
      ...current, original: next, remaining: next, durationMode: mode, locationId,
      sourceName, appliedAt: Date.now() } });
    return { effect: existing, created: false, replaced: true, remaining: next };
  }
  const combat = activeCombatFor(actor);
  const condition = dyingConditionSource(next, { mode, locationId, sourceName,
    combat: combat ? { uuid: combat.uuid, round: combat.round,
      cycle: combat.mythrasTurnEconomy?.cycle, turn: combat.turn } : null });
  const [effect] = await applyTimedCondition(actor, { key: DYING_STATUS_ID,
    statusId: DYING_STATUS_ID, name: game.i18n.localize("MYTHRASF.Status.Dying"),
    img: "icons/svg/skull.svg", locationId, duration: { unit: "dyingRounds",
      phase: "startRound" }, metadata: condition });
  return effect ? { effect, created: true, replaced: false, remaining: next } : null;
}

export async function prepareDyingEntry(combat, combatant) {
  const actor = combatant?.actor; const effect = dyingEffect(actor);
  if (!actor || !effect || combatant.isDefeated) return null;
  const condition = dyingCondition(effect);
  if (!condition) return null;
  const sameRound = condition.lastCountedCombatUuid === combat.uuid
    && Number(condition.lastCountedRound) === Number(combat.round);
  const appliedThisRound = condition.combatUuid === combat.uuid
    && Number(condition.appliedRound) === Number(combat.round);
  if (sameRound || appliedThisRound) return null;
  const remaining = Math.max(0, Number(condition.remaining ?? 1) - 1);
  const next = { ...condition, remaining, lastCountedCombatUuid: combat.uuid,
    lastCountedRound: combat.round };
  let dead = false;
  if (remaining <= 0) {
    dead = await applyDeath(actor);
    await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id]);
  } else await effect.update({ [`flags.${TIMED_CONDITION_SCOPE}.${TIMED_CONDITION_FLAG}`]: next });
  return { id: `${combatant.id}:${effect.id}:dying`, combatantId: combatant.id,
    actorUuid: actor.uuid, actorName: actorDisplayName(actor), key: "dying",
    automatic: false, status: "resolved", round: combat.round,
    resolution: { remaining, dead } };
}

export async function openDyingDialog({ actor = null, token = null } = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Dying.GMOnly")); return null;
  }
  if (!actor) {
    const controlled = canvas.tokens?.controlled ?? [];
    if (controlled.length !== 1 || !["character", "npc"].includes(controlled[0]?.actor?.type)) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Dying.SelectOneToken")); return null;
    }
    token = controlled[0]; actor = token.actor;
  }
  const healingRate = Math.max(1, Number(actor.system.attributes?.healingRate) || 1);
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Dying.Title") },
    content: `<div class="mythras-foundry mythras-dialog"><fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Dying.Target"))}</legend><div class="sheet-field-readonly">${escape(actorDisplayName(actor))}</div></fieldset><fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Dying.Duration"))}</legend><div class="sheet-state-list">${DYING_DURATION_MODES.map((mode) => `<label><input type="radio" class="sheet-state-box" name="mode" value="${mode}" ${mode === "custom" ? "checked" : ""}><span>${escape(game.i18n.format(`MYTHRASF.Dying.Mode.${mode}`, { healingRate, rounds: dyingRounds({ mode, healingRate }) }))}</span></label>`).join("")}</div><label data-dying-custom><span>${escape(game.i18n.localize("MYTHRASF.Dying.CustomRounds"))}</span><input type="number" class="sheet-field-editable" name="customRounds" min="1" step="1" value="1"></label></fieldset></div>`,
    buttons: [{ action: "apply", label: game.i18n.localize("MYTHRASF.Dying.Apply"),
      icon: "fas fa-skull", default: true, callback: (event, button) => ({
        mode: button.form.elements.mode.value,
        customRounds: Number(button.form.elements.customRounds.value) }) },
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), icon: "fas fa-times",
      callback: () => null }],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form");
      const refresh = () => { form.querySelector("[data-dying-custom]").hidden
        = form.elements.mode.value !== "custom"; };
      form.addEventListener("change", refresh); refresh();
    }, rejectClose: false
  });
  if (!result) return null;
  const rounds = dyingRounds({ ...result, healingRate });
  const applied = await applyDying(actor, { rounds, mode: result.mode,
    sourceName: game.i18n.localize("MYTHRASF.Status.Dying") });
  if (!applied) return null;
  await ChatMessage.create({ speaker: actorSpeaker(actor, token),
    content: `<section class="mythras-chat-card"><div class="mythras-chat-title">${escape(game.i18n.localize("MYTHRASF.Dying.ChatTitle"))}</div><div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Dying.Target"))}</span><strong>${escape(actorDisplayName(actor))}</strong></div><div class="mythras-chat-total"><span>${escape(game.i18n.localize("MYTHRASF.Dying.RoundsRemaining"))}</span><strong>${applied.remaining}</strong></div>${!applied.created && !applied.replaced ? `<p>${escape(game.i18n.localize("MYTHRASF.Dying.NotExtended"))}</p>` : ""}</section>` });
  return applied;
}

export function createDyingApi() {
  return Object.freeze({ open: openDyingDialog, apply: applyDying,
    calculateRounds: dyingRounds });
}
