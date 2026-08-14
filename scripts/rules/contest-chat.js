import { openContestResponseDialog } from "../apps/skill-roll-dialog.js";
import { invertD100, resolveSkillRollTargets } from "./skill-roll.js";
import { resolveContest } from "./contest-rolls.js";

const FLAG_SCOPE = "mythras-foundry";
const SOCKET = "system.mythras-foundry";

function escape(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function localize(key) {
  return game.i18n.localize(key);
}

function participantId(actorId) {
  return foundry.utils.randomID(12) + actorId.slice(0, 4);
}

export async function createContestMessage(item, configured, initiatorRoll = null) {
  const setup = configured.contest;
  const initiator = {
    id: participantId(item.actor.id), actorId: item.actor.id, actorName: item.actor.name,
    abilityId: item.id, abilityName: item.name, target: configured.targets.target,
    rawRoll: initiatorRoll?.total ?? null, pending: !initiatorRoll,
    serializedRoll: initiatorRoll?.toJSON?.() ?? null,
    config: { difficulty: configured.difficulty,
      limitedAbility: configured.limitedSkill ? `${configured.limitedSkill.actor.id}:${configured.limitedSkill.id}` : null,
      reinforcedAbility: configured.reinforcedSkill ? `${configured.reinforcedSkill.actor.id}:${configured.reinforcedSkill.id}` : null }
  };
  const participants = [initiator, ...setup.participants.filter((entry) => entry.actorId !== item.actor.id).map((entry) => ({
    id: participantId(entry.actorId), ...entry,
    rawRoll: null, pending: true, config: { difficulty: entry.difficulty }
  }))];
  const designated = participants.find((entry) => entry.actorId === setup.designatedActorId) ?? initiator;
  if (["team", "inverseTeam", "elimination"].includes(setup.type)) {
    const representative = setup.type === "elimination" ? designated : participants.reduce((chosen, entry) => {
      if (!chosen) return entry;
      return setup.type === "inverseTeam"
        ? (entry.target < chosen.target ? entry : chosen)
        : (entry.target > chosen.target ? entry : chosen);
    }, null);
    participants.forEach((entry) => { entry.pending = entry.id === representative.id; });
  }
  const contest = {
    schemaVersion: 1, type: setup.type, status: "pending", revision: 0,
    authorUserId: game.user.id, initiatorId: initiator.id,
    designatedId: designated.id, participants, rounds: [], resolution: null
  };
  const messageData = {
    speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    content: renderContestCard(contest),
    flags: { [FLAG_SCOPE]: { contest } },
    rolls: initiatorRoll ? [initiatorRoll] : []
  };
  ChatMessage.applyRollMode?.(messageData, game.settings.get("core", "rollMode"));
  return ChatMessage.create(messageData);
}

export function renderContestCard(contest) {
  const resolved = contest.status === "resolved" ? contest.resolution : null;
  const resolvedById = new Map((resolved?.participants ?? []).map((entry) => [entry.id, entry]));
  const rows = contest.participants.map((participant) => {
    const final = resolvedById.get(participant.id) ?? participant;
    const roll = participant.rawRoll == null ? localize("MYTHRASF.Contest.Pending") : participant.rawRoll;
    const ability = participant.abilityName ?? localize("MYTHRASF.Contest.ChosenOnResponse");
    const target = final.target == null ? "—" : `${final.target}%`;
    const result = resolved && final.result ? `<span class="contest-participant-result mythras-chat-result--${final.result}">${escape(localize(`MYTHRASF.RollResult.${final.result}`))}</span>` : "";
    const button = participant.pending && contest.status === "pending"
      ? `<button type="button" class="sheet-icon-button contest-response-button" data-contest-action="respond" data-participant-id="${escape(participant.id)}" aria-label="${escape(localize("MYTHRASF.Contest.Respond"))}" title="${escape(localize("MYTHRASF.Contest.Respond"))}"><i class="fas fa-dice-d20" aria-hidden="true"></i></button>` : "";
    const luck = participant.rawRoll != null ? `<button type="button" class="sheet-icon-button contest-luck-button" data-contest-action="luck" data-participant-id="${escape(participant.id)}" aria-label="${escape(localize("MYTHRASF.Luck.Use"))}" title="${escape(localize("MYTHRASF.Luck.Use"))}"><i class="fas fa-clover" aria-hidden="true"></i></button>` : "";
    const history = (participant.luckHistory ?? []).map((entry) => {
      const value = typeof entry === "object" ? entry.value : entry;
      const spender = typeof entry === "object" ? entry.spenderName : null;
      const text = spender ? game.i18n.format("MYTHRASF.Luck.SpentBy", { actor: spender }) : localize("MYTHRASF.Luck.Spent");
      return `<strong class="mythras-chat-roll-value">${escape(value)}</strong><span class="mythras-chat-luck-spent">${escape(text)}</span>`;
    }).join("");
    return `<div class="contest-participant mythras-chat-row" data-actor-id="${escape(participant.actorId)}">
      <span><strong>${escape(participant.actorName)}</strong><small>${escape(ability)}</small></span>
      <span class="contest-participant-values"><span>${escape(target)}</span>${history}<strong class="mythras-chat-roll-value">${escape(roll)}</strong>${result}${button}${luck}</span>
    </div>`;
  }).join("");
  const comparisons = resolved ? renderResolution(contest, resolved) : "";
  const penalty = resolved?.penalty > 0 ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.Over100Penalty"))}</span><strong class="skill-roll-modifier-effect--penalty">−${resolved.penalty}</strong></div>` : "";
  const gm = `<div class="contest-gm-actions" data-contest-gm-actions>
    ${contest.status === "pending" ? `<button type="button" data-contest-action="cancel" title="${escape(localize("MYTHRASF.Contest.Cancel"))}">${escape(localize("MYTHRASF.Contest.Cancel"))}</button>` : ""}
    ${contest.status !== "pending" ? `<button type="button" data-contest-action="reopen" title="${escape(localize("MYTHRASF.Contest.Reopen"))}">${escape(localize("MYTHRASF.Contest.Reopen"))}</button>` : ""}
    ${resolved?.comparisons?.some((entry) => entry.repeatable) ? `<button type="button" data-contest-action="repeat" title="${escape(localize("MYTHRASF.Contest.Repeat"))}">${escape(localize("MYTHRASF.Contest.Repeat"))}</button><button type="button" data-contest-action="close" title="${escape(localize("MYTHRASF.Contest.CloseWithoutWinner"))}">${escape(localize("MYTHRASF.Contest.CloseWithoutWinner"))}</button>` : ""}
  </div>`;
  return `<section class="mythras-chat-card mythras-contest-card" data-contest-revision="${contest.revision}">
    <div class="mythras-chat-title">${escape(localize(`MYTHRASF.Contest.Type.${contest.type}`))}</div>
    <div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.StatusLabel"))}</span><strong>${escape(localize(`MYTHRASF.Contest.Status.${contest.status}`))}</strong></div>
    <div class="contest-participants">${rows}</div>${penalty}${comparisons}${gm}</section>`;
}

function renderResolution(contest, resolved) {
  if (contest.type === "opposed") return resolved.comparisons.map((entry) => {
    const opponent = contest.participants.find((participant) => participant.id === entry.antagonistId);
    const winner = contest.participants.find((participant) => participant.id === entry.winnerId);
    const text = winner
      ? game.i18n.format("MYTHRASF.Contest.WinnerValue", { actor: winner.actorName })
      : localize(`MYTHRASF.Contest.Resolution.${entry.reason}`);
    return `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.Against"))}</span><strong>${escape(opponent?.actorName)}</strong></div><div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Contest.Outcome"))}</span><strong>${escape(text)}</strong></div>`;
  }).join("");
  if (contest.type === "differential") return resolved.comparisons.map((entry) => {
    const opponent = contest.participants.find((participant) => participant.id === entry.antagonistId);
    return `<div class="mythras-chat-total"><span>${escape(opponent?.actorName)}</span><strong>${entry.advantage > 0 ? "+" : ""}${entry.advantage}</strong></div>`;
  }).join("");
  if (contest.type === "elimination") return `<div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Contest.Continue"))}</span><strong>${escape(namesFor(contest, resolved.continuingIds))}</strong></div><div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Contest.Eliminated"))}</span><strong>${escape(namesFor(contest, resolved.eliminatedIds))}</strong></div>`;
  return `<div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Chat.Result"))}</span><strong>${escape(localize(`MYTHRASF.RollResult.${resolved.result}`))}</strong></div>`;
}

function namesFor(contest, ids) {
  return ids.map((id) => contest.participants.find((entry) => entry.id === id)?.actorName).filter(Boolean).join(", ") || "—";
}

export function preferredContestCoordinator(users, authorUserId) {
  const activeGm = Array.from(users ?? []).filter((user) => user.active && user.isGM).sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  if (activeGm) return activeGm.id;
  return Array.from(users ?? []).find((user) => user.id === authorUserId && user.active)?.id ?? null;
}

export function validateContestResponse(contest, { revision, participantId, userId }, { actor, user }) {
  if (contest.status !== "pending") return "state";
  if (Number(revision) !== Number(contest.revision)) return "revision";
  const participant = contest.participants.find((entry) => entry.id === participantId);
  if (!participant || !participant.pending) return "duplicate";
  if (!user || user.id !== userId || (!user.isGM && !actor?.testUserPermission(user, "OWNER"))) return "ownership";
  return null;
}

export function registerContestSocket() {
  game.socket.on(SOCKET, async (request) => {
    if (!["contestResponse", "contestLuck"].includes(request?.action)) return;
    const message = game.messages.get(request.messageId);
    const contest = message?.getFlag(FLAG_SCOPE, "contest");
    if (!contest || preferredContestCoordinator(game.users, contest.authorUserId) !== game.user.id) return;
    if (request.action === "contestLuck") await applyContestLuck(message, request);
    else await applyContestResponse(message, request);
  });
}

async function applyContestResponse(message, request) {
  const contest = foundry.utils.deepClone(message.getFlag(FLAG_SCOPE, "contest"));
  const participant = contest.participants.find((entry) => entry.id === request.participantId);
  const actor = game.actors.get(participant?.actorId);
  const user = game.users.get(request.userId);
  const invalid = validateContestResponse(contest, request, { actor, user });
  if (invalid) return ui.notifications.warn(game.i18n.localize(`MYTHRASF.Contest.Rejected.${invalid}`));
  const ability = actor.items.get(request.config.abilityId);
  if (!ability || !["skill", "combatStyle", "passion"].includes(ability.type)) return;
  const affecting = (reference) => {
    const [actorId, itemId] = String(reference ?? "").split(":");
    const item = game.actors.get(actorId)?.items.get(itemId);
    return item && ["skill", "combatStyle", "passion"].includes(item.type) ? item : null;
  };
  const limited = affecting(request.config.limitedAbility);
  const reinforced = affecting(request.config.reinforcedAbility);
  const targets = resolveSkillRollTargets({ baseTarget: ability.system.total, difficulty: request.config.difficulty,
    limited: Boolean(limited), limitedTarget: limited?.system.total,
    reinforced: Boolean(reinforced), reinforcedTarget: reinforced?.system.total });
  Object.assign(participant, { abilityId: ability.id, abilityName: ability.name, target: targets.target,
    rawRoll: Number(request.rawRoll), serializedRoll: request.serializedRoll, pending: false, config: request.config });
  contest.revision += 1;
  if (contest.participants.every((entry) => !entry.pending)) {
    contest.resolution = resolveContest(contest);
    contest.status = "resolved";
  }
  await message.update({ content: renderContestCard(contest), [`flags.${FLAG_SCOPE}.contest`]: contest });
}

export function activateContestCard(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.matches?.(".mythras-contest-card") ? root : root?.querySelector?.(".mythras-contest-card");
  const contest = message.getFlag?.(FLAG_SCOPE, "contest");
  if (!card || !contest || card.dataset.contestActive) return;
  card.dataset.contestActive = "true";
  card.querySelectorAll(".contest-response-button").forEach((button) => {
    const participant = contest.participants.find((entry) => entry.id === button.dataset.participantId);
    const actor = game.actors.get(participant?.actorId);
    button.hidden = !game.user.isGM && !actor?.isOwner;
  });
  card.querySelectorAll(".contest-luck-button").forEach((button) => {
    button.hidden = !eligibleLuckSpenders(game.user).length;
  });
  const gmActions = card.querySelector("[data-contest-gm-actions]");
  if (gmActions) gmActions.hidden = !game.user.isGM;
  card.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-contest-action]");
    if (!button) return;
    if (button.dataset.contestAction === "respond") return respond(message, contest, button.dataset.participantId);
    if (button.dataset.contestAction === "luck") return spendContestLuck(message, contest, button.dataset.participantId);
    if (!game.user.isGM) return;
    await gmAction(message, contest, button.dataset.contestAction, button.dataset.participantId);
  });
}

async function respond(message, contest, id) {
  const participant = contest.participants.find((entry) => entry.id === id);
  const actor = game.actors.get(participant?.actorId);
  if (!actor || (!game.user.isGM && !actor.isOwner)) return;
  const config = await openContestResponseDialog(actor, participant.abilityId);
  if (!config) return;
  const roll = await new Roll("1d100").evaluate();
  const request = { action: "contestResponse", messageId: message.id, revision: contest.revision,
    participantId: id, userId: game.user.id, config, rawRoll: roll.total, serializedRoll: roll.toJSON() };
  if (preferredContestCoordinator(game.users, contest.authorUserId) === game.user.id) await applyContestResponse(message, request);
  else game.socket.emit(SOCKET, request);
}

async function spendContestLuck(message, contest, id) {
  const participant = contest.participants.find((entry) => entry.id === id);
  const rolledActor = game.actors.get(participant?.actorId);
  if (!rolledActor || participant.rawRoll == null) return;
  const spenders = eligibleLuckSpenders(game.user);
  if (!spenders.length) return ui.notifications.warn(localize("MYTHRASF.Luck.None"));
  const ownRoll = !game.user.isGM && rolledActor.testUserPermission(game.user, "OWNER")
    && spenders.some((actor) => actor.id === rolledActor.id);
  const { DialogV2 } = foundry.applications.api;
  const spenderOptions = spenders.map((actor) => `<option value="${escape(actor.id)}">${escape(actor.name)} (${Number(actor.system.resources?.luckPoints?.value ?? 0)})</option>`).join("");
  const choice = await DialogV2.wait({ window: { title: localize("MYTHRASF.Luck.Title") },
    content: `<div class="mythras-foundry mythras-dialog luck-spend-dialog"><p>${escape(localize(ownRoll ? "MYTHRASF.Luck.Confirm" : "MYTHRASF.Luck.ForceRerollConfirm"))}</p><label><span>${escape(localize("MYTHRASF.Luck.Spender"))}</span><select name="luckActorId">${spenderOptions}</select></label></div>`,
    buttons: [{ action: "reroll", label: localize(ownRoll ? "MYTHRASF.Luck.Reroll" : "MYTHRASF.Luck.ForceReroll"), icon: "fas fa-dice-d20", callback: (event, button) => ({ mode: "reroll", luckActorId: button.form.elements.luckActorId.value }) },
      ...(ownRoll ? [{ action: "invert", label: localize("MYTHRASF.Luck.Invert"), icon: "fas fa-arrow-right-arrow-left", callback: (event, button) => ({ mode: "invert", luckActorId: button.form.elements.luckActorId.value }) }] : []),
      { action: "cancel", label: localize("MYTHRASF.Cancel"), icon: "fas fa-times" }], rejectClose: false });
  if (!choice) return;
  const luckActor = game.actors.get(choice.luckActorId);
  const points = Number(luckActor?.system.resources?.luckPoints?.value ?? 0);
  if (!luckActor || !spenders.some((actor) => actor.id === luckActor.id) || points < 1) return ui.notifications.warn(localize("MYTHRASF.Luck.None"));
  const roll = choice.mode === "reroll" ? await new Roll("1d100").evaluate() : null;
  const request = { action: "contestLuck", messageId: message.id, revision: contest.revision,
    participantId: id, userId: game.user.id, luckActorId: luckActor.id,
    rawRoll: roll?.total ?? invertD100(participant.rawRoll),
    serializedRoll: roll?.toJSON?.() ?? null };
  await luckActor.update({ "system.resources.luckPoints.value": points - 1 });
  if (preferredContestCoordinator(game.users, contest.authorUserId) === game.user.id) await applyContestLuck(message, request);
  else game.socket.emit(SOCKET, request);
}

async function applyContestLuck(message, request) {
  const contest = foundry.utils.deepClone(message.getFlag(FLAG_SCOPE, "contest"));
  if (Number(request.revision) !== Number(contest.revision)) return;
  const participant = contest.participants.find((entry) => entry.id === request.participantId);
  const luckActor = game.actors.get(request.luckActorId);
  const user = game.users.get(request.userId);
  if (!participant || participant.rawRoll == null || !user || !luckActor
    || (!user.isGM && !luckActor.testUserPermission(user, "OWNER"))) return;
  participant.luckHistory = [...(participant.luckHistory ?? []), {
    value: participant.rawRoll, spenderId: luckActor.id, spenderName: luckActor.name
  }];
  participant.rawRoll = Number(request.rawRoll); participant.serializedRoll = request.serializedRoll;
  contest.revision += 1;
  if (contest.participants.every((entry) => !entry.pending)) {
    contest.resolution = resolveContest(contest); contest.status = "resolved";
  }
  await message.update({ content: renderContestCard(contest), [`flags.${FLAG_SCOPE}.contest`]: contest });
}

function eligibleLuckSpenders(user) {
  const partyIds = new Set((game.mythrasFoundry?.party?.parties ?? []).flatMap((party) => party.memberIds ?? []));
  const players = Array.from(game.users ?? []).filter((candidate) => !candidate.isGM);
  return game.actors.filter((actor) => {
    if (actor.type !== "character" || Number(actor.system.resources?.luckPoints?.value ?? 0) < 1) return false;
    const playerOwned = players.some((player) => actor.testUserPermission(player, "OWNER"));
    if (!playerOwned && !partyIds.has(actor.id)) return false;
    return user.isGM || actor.testUserPermission(user, "OWNER");
  });
}

async function gmAction(message, current, action, participantId = null) {
  const contest = foundry.utils.deepClone(current);
  if (action === "cancel" || action === "close") contest.status = action === "cancel" ? "cancelled" : "closed";
  if (action === "reopen") {
    contest.status = "pending"; contest.resolution = null;
    if (["team", "inverseTeam", "elimination"].includes(contest.type)) {
      const representativeId = current.resolution?.representativeId ?? contest.designatedId;
      contest.participants.forEach((entry) => {
        entry.pending = entry.id === representativeId;
        if (entry.pending) { entry.rawRoll = null; entry.serializedRoll = null; }
      });
    } else {
      contest.participants.forEach((entry) => { if (entry.id !== contest.initiatorId) { entry.pending = true; entry.rawRoll = null; entry.serializedRoll = null; } });
    }
  }
  if (action === "repeat") {
    contest.rounds.push({ participants: foundry.utils.deepClone(contest.participants), resolution: contest.resolution });
    contest.status = "pending"; contest.resolution = null;
    contest.participants.forEach((entry) => { entry.pending = true; entry.rawRoll = null; });
  }
  contest.revision += 1;
  await message.update({ content: renderContestCard(contest), [`flags.${FLAG_SCOPE}.contest`]: contest });
}
