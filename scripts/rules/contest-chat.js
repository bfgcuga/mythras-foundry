import { openContestResponseDialog } from "../apps/skill-roll-dialog.js";
import { invertD100, resolveSkillRollTargets } from "./skill-roll.js";
import { resolveConfiguredContest, resolveContest } from "./contest-rolls.js";

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
  const buildSide = (name) => {
    const source = setup.sides[name];
    const members = participants.filter((entry) => entry.id === initiator.id
      ? name === "initiator" : entry.side === name);
    const designated = members.find((entry) => entry.actorId === source.designatedActorId) ?? members[0] ?? null;
    const representative = source.mode === "individual" ? null : source.mode === "elimination" || source.representativeRule === "designated"
      ? designated : members.reduce((chosen, entry) => !chosen ? entry
        : source.representativeRule === "lowest" ? (entry.target < chosen.target ? entry : chosen)
          : (entry.target > chosen.target ? entry : chosen), null);
    return { mode: source.mode, representativeRule: source.representativeRule,
      participantIds: members.map((entry) => entry.id), designatedId: designated?.id ?? null,
      representativeId: representative?.id ?? null };
  };
  const sides = { initiator: buildSide("initiator"), opponent: buildSide("opponent") };
  participants.forEach((entry) => { entry.pending = false; });
  for (const [name, side] of Object.entries(sides)) {
    if (name === "opponent" && setup.resolutionMode === "difficulty") continue;
    if (side.mode === "individual") {
      side.participantIds.forEach((id) => {
        const entry = participants.find((candidate) => candidate.id === id);
        if (entry?.rawRoll == null) entry.pending = true;
      });
    } else {
      const entry = participants.find((candidate) => candidate.id === side.representativeId);
      if (entry) entry.pending = entry.rawRoll == null;
    }
  }
  const contest = {
    schemaVersion: 2, resolutionMode: setup.resolutionMode, sides,
    status: "pending", revision: 0,
    authorUserId: game.user.id, initiatorId: initiator.id,
    participants, rounds: [], resolution: null
  };
  if (participants.every((entry) => !entry.pending)) {
    contest.resolution = resolveConfiguredContest(contest); contest.status = "resolved";
  }
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
  const configuredResults = contest.schemaVersion >= 2 && resolved
    ? [resolved.sides.initiator, resolved.sides.opponent].filter(Boolean).flatMap((side) => side.memberResults ?? []) : [];
  const resolvedById = new Map((configuredResults.length ? configuredResults : resolved?.participants ?? []).map((entry) => [entry.id, entry]));
  const rowEntries = contest.participants.map((participant) => {
    const final = resolvedById.get(participant.id) ?? participant;
    const shownRoll = final.rawRoll ?? participant.rawRoll;
    const roll = shownRoll == null ? localize("MYTHRASF.Contest.Pending") : shownRoll;
    const ability = participant.abilityName ?? localize("MYTHRASF.Contest.ChosenOnResponse");
    const target = final.target == null ? "—" : `${final.target}%`;
    const result = resolved && final.result ? `<span class="contest-participant-result mythras-chat-result--${final.result}">${escape(localize(`MYTHRASF.RollResult.${final.result}`))}</span>` : "";
    const button = participant.pending && contest.status === "pending"
      ? `<button type="button" class="sheet-icon-button contest-response-button" data-contest-action="respond" data-participant-id="${escape(participant.id)}" aria-label="${escape(localize("MYTHRASF.Contest.Respond"))}" title="${escape(localize("MYTHRASF.Contest.Respond"))}"><i class="fas fa-dice-d20" aria-hidden="true"></i></button>` : "";
    const luck = shownRoll != null ? `<button type="button" class="sheet-icon-button mythras-chat-luck-button contest-luck-button" data-contest-action="luck" data-participant-id="${escape(participant.id)}" aria-label="${escape(localize("MYTHRASF.Luck.Use"))}" title="${escape(localize("MYTHRASF.Luck.Use"))}"><i class="fas fa-clover" aria-hidden="true"></i></button>` : "";
    const history = participant.luckHistory ?? [];
    const oldAttempts = history.map((entry, index) => {
      const value = typeof entry === "object" ? entry.value : entry;
      if (index === 0) return `<div class="contest-roll-attempt"><strong class="mythras-chat-roll-value">${escape(value)}</strong></div>`;
      return `<div class="contest-roll-attempt"><strong class="mythras-chat-roll-value">${escape(value)}</strong></div>`;
    }).join("");
    const luckNotes = history.map((entry) => {
      const spender = typeof entry === "object" ? entry.spenderName : null;
      return `<small class="mythras-chat-luck-spent">${escape(spender ? game.i18n.format("MYTHRASF.Luck.SpentBy", { actor: spender }) : localize("MYTHRASF.Luck.Spent"))}</small>`;
    }).join("");
    const attempts = `${oldAttempts}<div class="contest-roll-attempt contest-roll-attempt--current"><strong class="mythras-chat-roll-value">${escape(roll)}</strong>${result}</div>`;
    const html = `<div class="contest-participant mythras-chat-row" data-actor-id="${escape(participant.actorId)}">
      <span class="contest-participant-identity"><strong>${escape(participant.actorName)}</strong><small>${escape(ability)}</small>${luckNotes}</span>
      <span class="contest-participant-values"><span class="contest-participant-target">${escape(target)}</span><span class="contest-roll-attempts">${attempts}</span></span>
      <span class="contest-participant-actions">${button}${luck}</span>
    </div>`;
    return [participant.id, html];
  });
  const rowById = new Map(rowEntries);
  const sideRows = (name) => {
    const side = contest.sides?.[name];
    if (!side || (name === "opponent" && contest.resolutionMode === "difficulty")) return "";
    const label = localize(`MYTHRASF.Contest.Side.${name}`);
    return `<section class="contest-side contest-side--${name}"><div class="contest-side-title">${escape(label)}</div>${side.participantIds.map((id) => rowById.get(id) ?? "").join("")}</section>`;
  };
  const rows = contest.schemaVersion >= 2 ? sideRows("initiator") + sideRows("opponent") : rowEntries.map((entry) => entry[1]).join("");
  const comparisons = resolved ? renderResolution(contest, resolved) : "";
  const penalty = resolved?.penalty > 0 ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.Over100Penalty"))}</span><strong class="skill-roll-modifier-effect--penalty">−${resolved.penalty}</strong></div>` : "";
  const gm = `<div class="contest-gm-actions" data-contest-gm-actions>
    ${contest.status === "pending" ? `<button type="button" data-contest-action="cancel" title="${escape(localize("MYTHRASF.Contest.Cancel"))}">${escape(localize("MYTHRASF.Contest.Cancel"))}</button>` : ""}
    ${contest.status !== "pending" ? `<button type="button" data-contest-action="reopen" title="${escape(localize("MYTHRASF.Contest.Reopen"))}">${escape(localize("MYTHRASF.Contest.Reopen"))}</button>` : ""}
    ${resolved?.comparisons?.some((entry) => entry.repeatable) ? `<button type="button" data-contest-action="repeat" title="${escape(localize("MYTHRASF.Contest.Repeat"))}">${escape(localize("MYTHRASF.Contest.Repeat"))}</button><button type="button" data-contest-action="close" title="${escape(localize("MYTHRASF.Contest.CloseWithoutWinner"))}">${escape(localize("MYTHRASF.Contest.CloseWithoutWinner"))}</button>` : ""}
  </div>`;
  const title = contest.schemaVersion >= 2
    ? game.i18n.format("MYTHRASF.Contest.ConfiguredTitle", {
      resolution: localize(`MYTHRASF.Contest.ResolutionMode.${contest.resolutionMode}`),
      initiator: localize(`MYTHRASF.Contest.SideMode.${contest.sides.initiator.mode}`),
      opponent: contest.resolutionMode === "difficulty" ? "" : ` / ${localize(`MYTHRASF.Contest.SideMode.${contest.sides.opponent.mode}`)}`
    }) : localize(`MYTHRASF.Contest.Type.${contest.type}`);
  return `<section class="mythras-chat-card mythras-contest-card" data-contest-revision="${contest.revision}">
    <div class="mythras-chat-title">${escape(title)}</div>
    <div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.StatusLabel"))}</span><strong>${escape(localize(`MYTHRASF.Contest.Status.${contest.status}`))}</strong></div>
    <div class="contest-participants">${rows}</div>${penalty}${comparisons}${gm}</section>`;
}

function renderResolution(contest, resolved) {
  if (contest.schemaVersion >= 2) return renderConfiguredResolution(contest, resolved);
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

function renderConfiguredResolution(contest, resolved) {
  const sideSummary = (sideName) => {
    const side = resolved.sides[sideName];
    if (!side) return "";
    if (side.mode === "elimination") return `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.Continue"))}</span><strong>${escape(namesFor(contest, side.continuingIds))}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.Eliminated"))}</span><strong>${escape(namesFor(contest, side.eliminatedIds))}</strong></div>`;
    if (contest.resolutionMode === "difficulty" && side.result) return `<div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Chat.Result"))}</span><strong>${escape(localize(`MYTHRASF.RollResult.${side.result}`))}</strong></div>`;
    return "";
  };
  const summaries = sideSummary("initiator") + sideSummary("opponent");
  if (contest.resolutionMode === "difficulty") return summaries;
  const comparisons = resolved.comparisons.map((entry) => {
    const protagonist = contest.participants.find((participant) => participant.id === entry.protagonistId);
    const antagonist = contest.participants.find((participant) => participant.id === entry.antagonistId);
    if (contest.resolutionMode === "differential") return `<div class="mythras-chat-total"><span>${escape(`${protagonist?.actorName} / ${antagonist?.actorName}`)}</span><strong>${entry.advantage > 0 ? "+" : ""}${entry.advantage}</strong></div>`;
    const winner = contest.participants.find((participant) => participant.id === entry.winnerId);
    const outcome = winner ? game.i18n.format("MYTHRASF.Contest.WinnerValue", { actor: configuredWinnerName(contest, winner) })
      : localize(`MYTHRASF.Contest.Resolution.${entry.reason}`);
    return `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.Against"))}</span><strong>${escape(`${protagonist?.actorName} / ${antagonist?.actorName}`)}</strong></div><div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Contest.Outcome"))}</span><strong>${escape(outcome)}</strong></div>`;
  }).join("");
  return summaries + comparisons;
}

function configuredWinnerName(contest, winner) {
  const sideEntry = Object.entries(contest.sides ?? {}).find(([, side]) => side.participantIds.includes(winner.id));
  if (!sideEntry) return winner.actorName;
  const [sideName, side] = sideEntry;
  return side.mode === "team" && side.participantIds.length > 1
    ? localize(`MYTHRASF.Contest.Team.${sideName}`) : winner.actorName;
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
    contest.resolution = contest.schemaVersion >= 2 ? resolveConfiguredContest(contest) : resolveContest(contest);
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
    button.hidden = !contestLuckContext(game.user, contest, button.dataset.participantId).spenders.length;
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
  const configuredSide = contest.schemaVersion >= 2
    ? Object.values(contest.sides).find((side) => side.participantIds.includes(id)) : null;
  const config = configuredSide && configuredSide.mode !== "individual"
    ? { ...participant.config, abilityId: participant.abilityId }
    : await openContestResponseDialog(actor, participant.abilityId);
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
  const currentRoll = contestRollForParticipant(contest, id);
  if (!rolledActor || currentRoll == null) return;
  const context = contestLuckContext(game.user, contest, id);
  const spenders = context.spenders;
  if (!spenders.length) return ui.notifications.warn(localize("MYTHRASF.Luck.None"));
  const ownRoll = context.ownRoll;
  const { DialogV2 } = foundry.applications.api;
  const spenderControl = spenders.length === 1
    ? `<div class="luck-spender-fixed"><span>${escape(localize("MYTHRASF.Luck.Spender"))}</span><strong>${escape(spenders[0].name)} (${Number(spenders[0].system.resources?.luckPoints?.value ?? 0)})</strong><input type="hidden" name="luckActorId" value="${escape(spenders[0].id)}"></div>`
    : `<label><span>${escape(localize("MYTHRASF.Luck.Spender"))}</span><select name="luckActorId">${spenders.map((actor) => `<option value="${escape(actor.id)}">${escape(actor.name)} (${Number(actor.system.resources?.luckPoints?.value ?? 0)})</option>`).join("")}</select></label>`;
  const choice = await DialogV2.wait({ window: { title: localize("MYTHRASF.Luck.Title") },
    content: `<div class="mythras-foundry mythras-dialog luck-spend-dialog"><p>${escape(localize(ownRoll ? "MYTHRASF.Luck.Confirm" : "MYTHRASF.Luck.ForceRerollConfirm"))}</p>${spenderControl}</div>`,
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
    rawRoll: roll?.total ?? invertD100(currentRoll),
    serializedRoll: roll?.toJSON?.() ?? null };
  if (game.user.isGM || luckActor.isOwner) {
    await luckActor.update({ "system.resources.luckPoints.value": points - 1 });
    request.luckAlreadySpent = true;
  }
  if (preferredContestCoordinator(game.users, contest.authorUserId) === game.user.id) await applyContestLuck(message, request);
  else game.socket.emit(SOCKET, request);
}

async function applyContestLuck(message, request) {
  const contest = foundry.utils.deepClone(message.getFlag(FLAG_SCOPE, "contest"));
  if (Number(request.revision) !== Number(contest.revision)) return;
  const participant = contest.participants.find((entry) => entry.id === request.participantId);
  const rollHolder = contestRollHolder(contest, request.participantId);
  const luckActor = game.actors.get(request.luckActorId);
  const user = game.users.get(request.userId);
  const eligible = contestLuckContext(user, contest, request.participantId, { requirePoints: false }).spenders;
  if (!participant || !rollHolder || contestRollForParticipant(contest, request.participantId) == null || !user || !luckActor
    || !eligible.some((actor) => actor.id === luckActor.id)) return;
  if (!request.luckAlreadySpent) {
    const points = Number(luckActor.system.resources?.luckPoints?.value ?? 0);
    if (points < 1) return ui.notifications.warn(localize("MYTHRASF.Luck.None"));
    await luckActor.update({ "system.resources.luckPoints.value": points - 1 });
  }
  participant.luckHistory = [...(participant.luckHistory ?? []), {
    value: contestRollForParticipant(contest, request.participantId), spenderId: luckActor.id, spenderName: luckActor.name
  }];
  rollHolder.rawRoll = Number(request.rawRoll); rollHolder.serializedRoll = request.serializedRoll;
  contest.revision += 1;
  if (contest.participants.every((entry) => !entry.pending)) {
    contest.resolution = contest.schemaVersion >= 2 ? resolveConfiguredContest(contest) : resolveContest(contest);
    contest.status = "resolved";
  }
  await message.update({ content: renderContestCard(contest), [`flags.${FLAG_SCOPE}.contest`]: contest });
}

function eligibleLuckSpenders(user, contest, { requirePoints = true } = {}) {
  const activeParty = game.mythrasFoundry?.party?.getActiveParty?.();
  const partyIds = new Set(activeParty?.memberIds ?? []);
  const participantIds = new Set((contest?.participants ?? []).map((participant) => participant.actorId));
  return game.actors.filter((actor) => {
    if (requirePoints && Number(actor.system.resources?.luckPoints?.value ?? 0) < 1) return false;
    return partyIds.has(actor.id) && participantIds.has(actor.id);
  });
}

function contestLuckContext(user, contest, participantId, { requirePoints = true } = {}) {
  const participant = contest.participants.find((entry) => entry.id === participantId);
  const actor = game.actors.get(participant?.actorId);
  const eligible = eligibleLuckSpenders(user, contest, { requirePoints });
  const ownRoll = Boolean(actor && eligible.some((candidate) => candidate.id === actor.id)
    && (user.isGM || actor.isOwner));
  if (ownRoll) return { ownRoll: true, spenders: [actor] };
  if (contest.resolutionMode === "difficulty") return { ownRoll: false, spenders: [] };
  const clickedSide = contestSideForParticipant(contest, participantId);
  const spenders = eligible.filter((candidate) => {
    if (!user.isGM && !candidate.isOwner) return false;
    const candidateParticipant = contest.participants.find((entry) => entry.actorId === candidate.id);
    return contestSideForParticipant(contest, candidateParticipant?.id) !== clickedSide;
  });
  return { ownRoll: false, spenders };
}

function contestSideForParticipant(contest, participantId) {
  if (contest.schemaVersion < 2) return participantId === contest.initiatorId ? "initiator" : "opponent";
  return Object.entries(contest.sides).find(([, side]) => side.participantIds.includes(participantId))?.[0] ?? null;
}

function contestRollHolder(contest, participantId) {
  const sideName = contestSideForParticipant(contest, participantId);
  const side = contest.sides?.[sideName];
  const holderId = side && side.mode !== "individual" ? side.representativeId : participantId;
  return contest.participants.find((entry) => entry.id === holderId) ?? null;
}

function contestRollForParticipant(contest, participantId) {
  return contestRollHolder(contest, participantId)?.rawRoll ?? null;
}

async function gmAction(message, current, action, participantId = null) {
  const contest = foundry.utils.deepClone(current);
  if (action === "cancel" || action === "close") contest.status = action === "cancel" ? "cancelled" : "closed";
  if (action === "reopen") {
    contest.status = "pending"; contest.resolution = null;
    if (contest.schemaVersion >= 2) {
      resetConfiguredRollers(contest, { keepInitiatorIndividual: true });
    } else if (["team", "inverseTeam", "elimination"].includes(contest.type)) {
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
    if (contest.schemaVersion >= 2) resetConfiguredRollers(contest, { keepInitiatorIndividual: false });
    else contest.participants.forEach((entry) => { entry.pending = true; entry.rawRoll = null; });
  }
  contest.revision += 1;
  await message.update({ content: renderContestCard(contest), [`flags.${FLAG_SCOPE}.contest`]: contest });
}

function resetConfiguredRollers(contest, { keepInitiatorIndividual }) {
  contest.participants.forEach((entry) => { entry.pending = false; });
  for (const [name, side] of Object.entries(contest.sides)) {
    if (name === "opponent" && contest.resolutionMode === "difficulty") continue;
    const rollerIds = side.mode === "individual" ? side.participantIds : [side.representativeId];
    for (const id of rollerIds.filter(Boolean)) {
      const entry = contest.participants.find((candidate) => candidate.id === id);
      if (!entry || (keepInitiatorIndividual && name === "initiator" && side.mode === "individual")) continue;
      entry.pending = true; entry.rawRoll = null; entry.serializedRoll = null;
    }
  }
}
