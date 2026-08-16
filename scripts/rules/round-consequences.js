import { classifyContestRoll } from "./contest-rolls.js";
import { fatigueLossForResult, worsenFatigueLevel, TIMED_CONDITION_FLAG,
  TIMED_CONDITION_SCOPE } from "./timed-conditions.js";
import { timedEffects } from "./timed-condition-runtime.js";

const SCOPE = "mythras-foundry";
const SOCKET = "system.mythras-foundry";
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

export function periodicConditionEntries(combat) {
  const entries = [];
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor; if (!actor) continue;
    for (const effect of timedEffects(actor)) {
      const condition = effect.getFlag(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG);
      if (condition.key === "exsanguinating") entries.push({ id: `${combatant.id}:${effect.id}`,
        combatantId: combatant.id, actorUuid: actor.uuid, effectId: effect.id,
        key: condition.key, automatic: true, status: "pending" });
    }
    for (const key of ["bleeding", "drowning"]) {
      if (actor.statuses?.has(key)) entries.push({ id: `${combatant.id}:${key}`,
        combatantId: combatant.id, actorUuid: actor.uuid, key, automatic: false,
        status: "pending" });
    }
  }
  return entries;
}

export async function applyFatigueLoss(actor, loss) {
  const before = actor.system.fatigueLevel ?? "fresh";
  const after = worsenFatigueLevel(before, loss);
  if (after !== before) await actor.update({ "system.fatigueLevel": after });
  return { before, after, loss };
}

export async function prepareRoundConsequences(combat) {
  const economy = combat.mythrasTurnEconomy;
  const queue = periodicConditionEntries(combat).map((entry) => ({ ...entry,
    round: combat.round }));
  for (const entry of queue.filter((candidate) => candidate.automatic)) {
    const actor = await fromUuid(entry.actorUuid);
    entry.resolution = actor ? await applyFatigueLoss(actor, 1) : { missing: true };
    entry.status = actor ? "resolved" : "pending";
  }
  await combat.setFlag(SCOPE, "turnEconomy", { ...economy,
    roundQueue: queue, roundPreparing: queue.some((entry) => entry.status === "pending") });
  if (queue.length) await createRoundMessage(combat, queue);
  return queue;
}

async function createRoundMessage(combat, queue) {
  const state = { schemaVersion: 1, combatId: combat.id, combatUuid: combat.uuid,
    round: combat.round, revision: 0, queue };
  return ChatMessage.create({ content: renderRoundConsequences(state),
    flags: { [SCOPE]: { roundConsequences: state } } });
}

export function renderRoundConsequences(state) {
  const rows = state.queue.map((entry) => `<div class="mythras-chat-row"><span>${escape(
    game.i18n.localize(`MYTHRASF.Status.${entry.key === "exsanguinating" ? "Exsanguinating"
      : entry.key === "bleeding" ? "Bleeding" : "Drowning"}`))}</span><strong>${escape(
    game.i18n.localize(`MYTHRASF.RoundConsequence.${entry.status}`))}</strong>${entry.status === "pending"
      ? `<button type="button" data-round-action="roll" data-entry-id="${escape(entry.id)}">${escape(game.i18n.localize("MYTHRASF.Roll"))}</button><button type="button" data-round-action="manual" data-entry-id="${escape(entry.id)}" data-gm-only>${escape(game.i18n.localize("MYTHRASF.CombatEffect.ResolveManual"))}</button>` : entry.resolution ? `<span>${escape(game.i18n.format("MYTHRASF.RoundConsequence.Fatigue", { loss: entry.resolution.loss ?? 0 }))}</span>` : ""}</div>`).join("");
  return `<section class="mythras-round-card mythras-chat-card"><div class="mythras-chat-title">${escape(game.i18n.format("MYTHRASF.RoundConsequence.Title", { round: state.round }))}</div>${rows}</section>`;
}

async function requestResolution(message, state, entryId, manual) {
  const entry = state.queue.find((candidate) => candidate.id === entryId);
  const actor = entry ? await fromUuid(entry.actorUuid).catch(() => null) : null;
  if (!entry || (!actor && !manual) || (!game.user.isGM && !actor?.isOwner)) return;
  let resolution;
  if (manual) {
    if (!game.user.isGM) return;
    resolution = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("MYTHRASF.CombatEffect.ResolveManual") },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(game.i18n.localize("MYTHRASF.RoundConsequence.Loss"))}</span><input type="number" name="loss" min="0" value="0"></label><textarea name="note" required></textarea></div>`,
      buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.CombatEffect.ResolveManual"),
        callback: (event, button) => ({ manual: true,
          loss: Math.max(0, Number(button.form.elements.loss.value) || 0),
          note: button.form.elements.note.value.trim() }) }], rejectClose: false });
  } else {
    const skill = actor.items.find((item) => item.type === "skill" && item.system.slug === "aguante");
    if (!skill) return ui.notifications.warn(game.i18n.localize("MYTHRASF.Combat.SourceMissing"));
    const roll = await new Roll("1d100").evaluate();
    const result = classifyContestRoll(roll.total, Number(skill.system.total ?? 0));
    const lossRoll = result === "failure" ? await new Roll("1d2").evaluate()
      : result === "fumble" ? await new Roll("1d3").evaluate() : null;
    resolution = { manual: false, target: Number(skill.system.total ?? 0), rawRoll: roll.total,
      serializedRoll: roll.toJSON(), result,
      loss: fatigueLossForResult(result, lossRoll?.total ?? 1),
      lossRoll: lossRoll?.toJSON?.() ?? null };
  }
  if (!resolution) return;
  const request = { action: "roundConsequence", messageId: message.id,
    revision: state.revision, entryId, userId: game.user.id, resolution };
  if (game.mythrasFoundry?.combat?.isCoordinator?.()) await applyResolution(message, request);
  else game.socket.emit(SOCKET, request);
}

async function applyResolution(message, request) {
  const state = foundry.utils.deepClone(message.getFlag(SCOPE, "roundConsequences"));
  const entry = state?.queue.find((candidate) => candidate.id === request.entryId);
  if (!state || !entry || entry.status !== "pending" || state.revision !== request.revision) return;
  const actor = await fromUuid(entry.actorUuid).catch(() => null);
  const user = game.users.get(request.userId);
  if (!user || (!actor && !request.resolution.manual)
    || (actor && !user.isGM && !actor.testUserPermission(user, "OWNER"))) return;
  const fatigue = actor ? await applyFatigueLoss(actor, request.resolution.loss)
    : { before: null, after: null, loss: request.resolution.loss, missing: true };
  entry.status = "resolved"; entry.resolution = { ...request.resolution, ...fatigue,
    userId: user.id, resolvedAt: Date.now() }; state.revision += 1;
  await message.update({ content: renderRoundConsequences(state),
    [`flags.${SCOPE}.roundConsequences`]: state });
  const combat = game.combats.get(state.combatId);
  if (combat && state.queue.every((candidate) => candidate.status === "resolved")) {
    await combat.completeRoundPreparation(state.queue);
  }
}

export function activateRoundConsequenceCard(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.matches?.(".mythras-round-card") ? root : root?.querySelector?.(".mythras-round-card");
  const state = message.getFlag?.(SCOPE, "roundConsequences");
  if (!card || !state || card.dataset.active) return;
  card.dataset.active = "true";
  card.querySelectorAll("[data-gm-only]").forEach((button) => { button.hidden = !game.user.isGM; });
  for (const button of card.querySelectorAll("[data-round-action='roll']")) {
    const entry = state.queue.find((candidate) => candidate.id === button.dataset.entryId);
    if (!entry) continue;
    fromUuid(entry.actorUuid).then((actor) => { button.hidden = !game.user.isGM && !actor?.isOwner; });
  }
  card.addEventListener("click", (event) => {
    const button = event.target.closest("[data-round-action]"); if (!button) return;
    requestResolution(message, state, button.dataset.entryId, button.dataset.roundAction === "manual");
  });
}

export function registerRoundConsequenceSocket() {
  game.socket.on(SOCKET, async (request) => {
    if (request?.action !== "roundConsequence" || !game.mythrasFoundry?.combat?.isCoordinator?.()) return;
    const message = game.messages.get(request.messageId); if (message) await applyResolution(message, request);
  });
}
