import { applyTimedCondition } from "./timed-condition-runtime.js";
import { TIMED_CONDITION_FLAG, TIMED_CONDITION_SCOPE } from "./timed-conditions.js";
import { actorDisplayName, actorSpeaker } from "./document-names.js";

export const SUFFOCATING_STATUS_ID = "suffocating";
export const SUFFOCATION_ROUND_SECONDS = 5;
export const BREATH_CIRCUMSTANCES = Object.freeze({
  prepared: 1, passive: 0.5, strenuous: 0.2
});

const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

export function breathHoldingSeconds(endurance, circumstance = "prepared") {
  const multiplier = BREATH_CIRCUMSTANCES[circumstance] ?? 1;
  return Math.max(0, Number(endurance) || 0) * multiplier;
}

export function suffocationTiming({ endurance, circumstance = "prepared",
  elapsedRounds = 0 } = {}) {
  const thresholdSeconds = breathHoldingSeconds(endurance, circumstance);
  const rounds = Math.max(0, Math.floor(Number(elapsedRounds) || 0));
  return Object.freeze({ endurance: Math.max(0, Number(endurance) || 0), circumstance,
    thresholdSeconds, elapsedRounds: rounds, elapsedSeconds: rounds * SUFFOCATION_ROUND_SECONDS,
  checksRequired: rounds * SUFFOCATION_ROUND_SECONDS >= thresholdSeconds });
}

function enduranceValue(actor) {
  const skill = actor?.items?.find?.((item) => item.type === "skill"
    && item.system.slug === "aguante");
  return Math.max(0, Number(skill?.system?.total) || 0);
}

export function suffocationEffect(actor) {
  return Array.from(actor?.effects ?? []).find((effect) => effect.statuses?.has?.(SUFFOCATING_STATUS_ID)
    || Array.from(effect.statuses ?? []).includes(SUFFOCATING_STATUS_ID)) ?? null;
}

export function suffocationCondition(effect) {
  return effect?.getFlag?.(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG)
    ?? effect?.flags?.[TIMED_CONDITION_SCOPE]?.[TIMED_CONDITION_FLAG];
}

async function activeCombatForActor(actor) {
  return game.combats?.find((combat) => combat.started
    && combat.combatants.some((entry) => entry.actor?.uuid === actor.uuid)) ?? null;
}

async function createSuffocationChat(actor, token, condition) {
  return ChatMessage.create({ speaker: actorSpeaker(actor, token),
    content: `<section class="mythras-chat-card"><div class="mythras-chat-title">${escape(game.i18n.localize("MYTHRASF.Suffocation.ChatTitle"))}</div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Suffocation.Target"))}</span><strong>${escape(actorDisplayName(actor))}</strong></div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Suffocation.Endurance"))}</span><strong>${condition.endurance}</strong></div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Suffocation.CircumstanceLabel"))}</span><strong>${escape(game.i18n.localize(`MYTHRASF.Suffocation.Circumstance.${condition.circumstance}`))}</strong></div>
      <div class="mythras-chat-total"><span>${escape(game.i18n.localize("MYTHRASF.Suffocation.HoldTime"))}</span><strong>${condition.thresholdSeconds} s</strong></div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Suffocation.CheckStarts"))}</span><strong>${Math.ceil(condition.thresholdSeconds / SUFFOCATION_ROUND_SECONDS)} ${escape(game.i18n.localize("MYTHRASF.Suffocation.Rounds"))}</strong></div></section>` });
}

export async function applySuffocation(actor, configuration = {}, { token = null } = {}) {
  if (!actor || !["character", "npc"].includes(actor.type)) return null;
  const existing = suffocationEffect(actor);
  if (existing) await actor.deleteEmbeddedDocuments("ActiveEffect", [existing.id]);
  const combat = await activeCombatForActor(actor);
  const circumstance = BREATH_CIRCUMSTANCES[configuration.circumstance]
    ? configuration.circumstance : "prepared";
  const timing = suffocationTiming({ endurance: enduranceValue(actor), circumstance });
  const metadata = { ...timing, lastCountedRound: combat?.round ?? null };
  const [effect] = await applyTimedCondition(actor, {
    name: game.i18n.localize("MYTHRASF.Status.Suffocating"),
    img: "systems/mythras-foundry/assets/icons/suffocation.svg",
    key: SUFFOCATING_STATUS_ID, statusId: SUFFOCATING_STATUS_ID,
    combat: combat ? { uuid: combat.uuid, round: combat.round,
      cycle: combat.mythrasTurnEconomy?.cycle, turn: combat.turn } : null,
    duration: { unit: "suffocation", phase: "startRound" }, metadata
  });
  await createSuffocationChat(actor, token, metadata);
  return effect;
}

export async function removeSuffocation(actor) {
  const effect = suffocationEffect(actor);
  if (!effect) return false;
  await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id]); return true;
}

export async function prepareSuffocationEntry(combat, combatant) {
  const actor = combatant?.actor; const effect = suffocationEffect(actor);
  if (!actor || !effect) return null;
  const stored = suffocationCondition(effect) ?? {};
  const circumstance = BREATH_CIRCUMSTANCES[stored.circumstance]
    ? stored.circumstance : "prepared";
  const endurance = Number.isFinite(Number(stored.endurance))
    ? Number(stored.endurance) : enduranceValue(actor);
  const alreadyCounted = Number(stored.lastCountedRound) === Number(combat.round)
    && stored.combatUuid === combat.uuid;
  const elapsedRounds = Math.max(0, Number(stored.elapsedRounds) || 0)
    + (alreadyCounted ? 0 : 1);
  const timing = suffocationTiming({ endurance, circumstance, elapsedRounds });
  const condition = { ...stored, schemaVersion: 1, key: SUFFOCATING_STATUS_ID,
    statusId: SUFFOCATING_STATUS_ID, unit: "suffocation", phase: "startRound",
    combatUuid: combat.uuid, lastCountedRound: combat.round, ...timing };
  if (!alreadyCounted || !suffocationCondition(effect)) {
    await effect.update({ [`flags.${TIMED_CONDITION_SCOPE}.${TIMED_CONDITION_FLAG}`]: condition });
  }
  if (!timing.checksRequired) return null;
  return { id: `${combatant.id}:${effect.id}:suffocating`, combatantId: combatant.id,
    actorUuid: actor.uuid, effectId: effect.id, actorName: actorDisplayName(actor),
    key: SUFFOCATING_STATUS_ID, automatic: false, status: "pending",
    elapsedRounds: timing.elapsedRounds, elapsedSeconds: timing.elapsedSeconds,
    thresholdSeconds: timing.thresholdSeconds };
}

export async function openSuffocationDialog({ actor = null, token = null } = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Suffocation.GMOnly")); return null;
  }
  if (!actor) {
    const controlled = canvas.tokens?.controlled ?? [];
    if (controlled.length !== 1 || !["character", "npc"].includes(controlled[0]?.actor?.type)) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Suffocation.SelectOneToken")); return null;
    }
    token = controlled[0]; actor = token.actor;
  }
  const endurance = enduranceValue(actor);
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Suffocation.Title") },
    content: `<div class="mythras-foundry mythras-dialog"><fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Suffocation.Target"))}</legend><div class="sheet-field-readonly">${escape(actorDisplayName(actor))} — ${escape(game.i18n.localize("MYTHRASF.Suffocation.Endurance"))} ${endurance}</div></fieldset><fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Suffocation.CircumstanceLabel"))}</legend>${Object.keys(BREATH_CIRCUMSTANCES).map((circumstance) => `<label><input type="radio" class="sheet-state-box" name="circumstance" value="${circumstance}" ${circumstance === "prepared" ? "checked" : ""}><span>${escape(game.i18n.localize(`MYTHRASF.Suffocation.Circumstance.${circumstance}`))} — ${breathHoldingSeconds(endurance, circumstance)} s</span></label>`).join("")}</fieldset></div>`,
    buttons: [{ action: "apply", label: game.i18n.localize("MYTHRASF.Suffocation.Apply"),
      icon: "fas fa-lungs", default: true, callback: (event, button) => ({
        circumstance: button.form.elements.circumstance.value }) },
    ...(suffocationEffect(actor) ? [{ action: "remove",
      label: game.i18n.localize("MYTHRASF.Suffocation.Remove"), icon: "fas fa-lungs-virus",
      callback: () => ({ remove: true }) }] : []),
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"),
      icon: "fas fa-times", callback: () => null }], rejectClose: false
  });
  if (!result || typeof result !== "object") return null;
  if (result.remove) return removeSuffocation(actor);
  return applySuffocation(actor, result, { token });
}

export function createSuffocationApi() {
  return Object.freeze({ open: openSuffocationDialog, apply: applySuffocation,
    remove: removeSuffocation, timing: suffocationTiming });
}
