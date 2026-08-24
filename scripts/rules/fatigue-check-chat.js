import { difficultyTarget } from "./combat.js";
import { classifyContestRoll } from "./contest-rolls.js";
import { appendSerializedRolls, evaluateAnimatedRoll } from "./dice-animation.js";
import { recordAbilityFumble } from "./skills.js";
import { worsenFatigueLevel } from "./timed-conditions.js";
import { actorDisplayName } from "./document-names.js";

const SCOPE = "mythras-foundry";
const SOCKET = "system.mythras-foundry";
const SKILLS = Object.freeze(["atletismo", "musculo", "aguante"]);
const DIFFICULTIES = Object.freeze(["veryEasy", "easy", "standard", "hard",
  "formidable", "herculean"]);
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

export function fatigueCheckTarget(base, difficulty = "standard") {
  return difficultyTarget(base, DIFFICULTIES.includes(difficulty) ? difficulty : "standard");
}

export function validateFatigueCheckResponse(state, request, { actor, user } = {}) {
  if (!state || Number(request?.revision) !== Number(state.revision)) return "revision";
  const participant = state.participants?.find((entry) => entry.actorUuid === request.actorUuid);
  if (!participant || participant.status !== "pending") return "participant";
  if (!user || user.id !== request.userId
    || (!user.isGM && !actor?.testUserPermission?.(user, "OWNER"))) return "ownership";
  return null;
}

export function renderFatigueCheckCard(state) {
  const rows = state.participants.map((participant) => {
    const result = participant.status === "resolved"
      ? `<strong><span class="mythras-chat-roll-value">${participant.rawRoll}</span> ${escape(game.i18n.localize(`MYTHRASF.RollResult.${participant.result}`))}</strong><span>${escape(game.i18n.format("MYTHRASF.FatigueCheck.FatigueLost", { count: participant.fatigueLoss }))}</span>`
      : `<button type="button" data-fatigue-check-roll data-actor-uuid="${escape(participant.actorUuid)}" title="${escape(game.i18n.localize("MYTHRASF.FatigueCheck.Roll"))}">${escape(game.i18n.localize("MYTHRASF.FatigueCheck.Roll"))}</button>`;
    return `<div class="mythras-chat-row" data-fatigue-participant="${escape(participant.actorUuid)}"><span>${escape(participant.name)} — ${participant.target}%</span>${result}</div>`;
  }).join("");
  return `<section class="mythras-fatigue-check-card mythras-chat-card"><div class="mythras-chat-title">${escape(game.i18n.localize("MYTHRASF.FatigueCheck.ChatTitle"))}</div>
    <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.FatigueCheck.SkillLabel"))}</span><strong>${escape(game.i18n.localize(`MYTHRASF.FatigueCheck.Skill.${state.skillSlug}`))}</strong></div>
    <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.FatigueCheck.Difficulty"))}</span><strong>${escape(game.i18n.localize(`MYTHRASF.Difficulty.${state.difficulty}`))}</strong></div>
    <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.FatigueCheck.Participants"))}</legend>${rows}</fieldset></section>`;
}

async function applyFatigueCheckResponse(message, request) {
  const state = foundry.utils.deepClone(message.getFlag(SCOPE, "fatigueCheck"));
  const actor = await fromUuid(request.actorUuid).catch(() => null);
  const user = game.users.get(request.userId);
  if (validateFatigueCheckResponse(state, request, { actor, user })) return;
  const participant = state.participants.find((entry) => entry.actorUuid === request.actorUuid);
  const skill = actor.items.find((item) => item.type === "skill" && item.system.slug === state.skillSlug);
  if (!skill) return;
  const result = classifyContestRoll(request.rawRoll, participant.target);
  await recordAbilityFumble(skill, result);
  const fatigueLoss = ["failure", "fumble"].includes(result) ? 1 : 0;
  const fatigueBefore = actor.system.fatigueLevel ?? "fresh";
  const fatigueAfter = worsenFatigueLevel(fatigueBefore, fatigueLoss);
  if (fatigueAfter !== fatigueBefore) await actor.update({ "system.fatigueLevel": fatigueAfter });
  Object.assign(participant, { status: "resolved", rawRoll: Number(request.rawRoll), result,
    fatigueLoss, fatigueBefore, fatigueAfter, userId: user.id, resolvedAt: Date.now() });
  state.revision += 1;
  await message.update({ content: renderFatigueCheckCard(state),
    rolls: appendSerializedRolls(message, request.serializedRoll),
    [`flags.${SCOPE}.fatigueCheck`]: state });
}

async function requestFatigueCheckRoll(message, actorUuid) {
  const state = message.getFlag(SCOPE, "fatigueCheck");
  const actor = await fromUuid(actorUuid).catch(() => null);
  if (!state || !actor || (!game.user.isGM && !actor.testUserPermission(game.user, "OWNER"))) return;
  const participant = state.participants.find((entry) => entry.actorUuid === actorUuid);
  if (!participant || participant.status !== "pending") return;
  const roll = await evaluateAnimatedRoll("1d100");
  const request = { action: "fatigueCheckRoll", messageId: message.id,
    revision: state.revision, actorUuid, userId: game.user.id, rawRoll: Number(roll.total),
    serializedRoll: roll.toJSON() };
  if (game.mythrasFoundry?.combat?.isCoordinator?.()) await applyFatigueCheckResponse(message, request);
  else game.socket.emit(SOCKET, request);
}

export function activateFatigueCheckCard(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.matches?.(".mythras-fatigue-check-card") ? root
    : root?.querySelector?.(".mythras-fatigue-check-card");
  const state = message.getFlag?.(SCOPE, "fatigueCheck");
  if (!card || !state || card.dataset.active) return;
  card.dataset.active = "true";
  for (const button of card.querySelectorAll("[data-fatigue-check-roll]")) {
    const actorUuid = button.dataset.actorUuid;
    button.hidden = !game.user.isGM;
    fromUuid(actorUuid).then((actor) => {
      button.hidden = !game.user.isGM && !actor?.testUserPermission?.(game.user, "OWNER");
    });
    button.addEventListener("click", () => {
      button.disabled = true; requestFatigueCheckRoll(message, actorUuid);
    });
  }
}

export function registerFatigueCheckSocket() {
  game.socket.on(SOCKET, async (request) => {
    if (request?.action !== "fatigueCheckRoll"
      || !game.mythrasFoundry?.combat?.isCoordinator?.()) return;
    const message = game.messages.get(request.messageId);
    if (message) await applyFatigueCheckResponse(message, request);
  });
}

export async function openFatigueCheckDialog() {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.FatigueCheck.GMOnly")); return null;
  }
  const parties = game.mythrasFoundry?.party?.parties ?? [];
  if (!parties.length) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.FatigueCheck.NoParties")); return null;
  }
  const activeId = game.mythrasFoundry.party.getActiveParty?.()?.id ?? parties[0].id;
  const partyOptions = parties.map((party) => `<option value="${escape(party.id)}" ${party.id === activeId ? "selected" : ""}>${escape(party.name)}</option>`).join("");
  const skillOptions = SKILLS.map((slug) => `<option value="${slug}">${escape(game.i18n.localize(`MYTHRASF.FatigueCheck.Skill.${slug}`))}</option>`).join("");
  const difficultyOptions = DIFFICULTIES.map((difficulty) => `<option value="${difficulty}" ${difficulty === "standard" ? "selected" : ""}>${escape(game.i18n.localize(`MYTHRASF.Difficulty.${difficulty}`))}</option>`).join("");
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.FatigueCheck.Title") },
    content: `<div class="mythras-foundry mythras-dialog"><fieldset><legend>${escape(game.i18n.localize("MYTHRASF.FatigueCheck.Group"))}</legend><select name="party" class="sheet-field-editable">${partyOptions}</select></fieldset><fieldset><legend>${escape(game.i18n.localize("MYTHRASF.FatigueCheck.Participants"))}</legend><div class="sheet-state-list" data-fatigue-members></div></fieldset><fieldset><legend>${escape(game.i18n.localize("MYTHRASF.FatigueCheck.RollConfiguration"))}</legend><label><span>${escape(game.i18n.localize("MYTHRASF.FatigueCheck.SkillLabel"))}</span><select name="skill" class="sheet-field-editable">${skillOptions}</select></label><label><span>${escape(game.i18n.localize("MYTHRASF.FatigueCheck.Difficulty"))}</span><select name="difficulty" class="sheet-field-editable">${difficultyOptions}</select></label></fieldset></div>`,
    buttons: [{ action: "create", label: game.i18n.localize("MYTHRASF.FatigueCheck.Create"),
      icon: "fas fa-person-running", default: true, callback: (event, button) => ({
        partyId: button.form.elements.party.value, skillSlug: button.form.elements.skill.value,
        difficulty: button.form.elements.difficulty.value,
        actorIds: Array.from(button.form.querySelectorAll("input[name='member']:checked"),
          (control) => control.value) }) },
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), icon: "fas fa-times",
      callback: () => null }],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form"); const container = form.querySelector("[data-fatigue-members]");
      const refresh = () => {
        const members = game.mythrasFoundry.party.getMembers(form.elements.party.value);
        container.innerHTML = members.map((actor) => `<label><input type="checkbox" class="sheet-state-box" name="member" value="${escape(actor.id)}" checked><span>${escape(actorDisplayName(actor))}</span></label>`).join("") || `<p>${escape(game.i18n.localize("MYTHRASF.FatigueCheck.NoMembers"))}</p>`;
      };
      form.elements.party.addEventListener("change", refresh); refresh();
    }, rejectClose: false
  });
  if (!result || typeof result !== "object") return null;
  if (!result.actorIds.length) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.FatigueCheck.SelectParticipants")); return null;
  }
  const partyMembers = game.mythrasFoundry.party.getMembers(result.partyId);
  const selected = partyMembers.filter((actor) => result.actorIds.includes(actor.id));
  if (!selected.length || !SKILLS.includes(result.skillSlug)
    || !DIFFICULTIES.includes(result.difficulty)) return null;
  const participants = selected.flatMap((actor) => {
    const skill = actor.items.find((item) => item.type === "skill"
      && item.system.slug === result.skillSlug);
    if (!skill) return [];
    const baseTarget = Number(skill.system.total) || 0;
    return [{ actorUuid: actor.uuid, actorId: actor.id, name: actorDisplayName(actor),
      baseTarget, target: fatigueCheckTarget(baseTarget, result.difficulty), status: "pending" }];
  });
  if (!participants.length) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.FatigueCheck.NoSkills")); return null;
  }
  const state = { schemaVersion: 1, revision: 0, partyId: result.partyId,
    skillSlug: result.skillSlug, difficulty: result.difficulty, participants };
  return ChatMessage.create({ content: renderFatigueCheckCard(state),
    flags: { [SCOPE]: { fatigueCheck: state } } });
}

export function createFatigueCheckApi() {
  return Object.freeze({ open: openFatigueCheckDialog });
}
