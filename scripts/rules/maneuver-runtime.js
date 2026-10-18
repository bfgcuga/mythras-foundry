import { interruptionBlocksAction } from "./combat-interruption.js";
import { createContestMessage } from "./contest-chat.js";
import { tokenDisplayName } from "./document-names.js";
import { resolveActorConditions } from "./actor-conditions.js";
import { applyManeuverProtection } from "./maneuver-protection.js";
import { relationFor, setRelationPosition } from "./engagement-runtime.js";
import { resolveConfiguredContest } from "./contest-rolls.js";
import { resolveSkillRollTargets } from "./skill-roll.js";

const SCOPE = "mythras-foundry";
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const localize = (key) => game.i18n.localize(key);
export const evadeSkill = (actor) => actor?.items?.find((item) => item.type === "skill" && item.system.slug === "evadir");

async function resolveManeuverRivals(actor, tokenUuid, parameters) {
  const uuids = parameters?.rivalTokenUuids;
  if (!evadeSkill(actor) || !tokenUuid || !Array.isArray(uuids) || !uuids.length
    || new Set(uuids).size !== uuids.length || uuids.includes(tokenUuid)) return null;
  const [initiator, ...rivals] = await Promise.all([tokenUuid, ...uuids]
    .map((uuid) => typeof uuid === "string" ? fromUuid(uuid) : null));
  // Encounters may be scene-independent. The initiating TokenDocument defines
  // the scene for this action, including when the coordinator views another one.
  const sceneId = initiator?.parent?.id;
  if (!sceneId || initiator.actor?.uuid !== actor.uuid || rivals.some((token) => !token?.actor
    || token.parent?.id !== sceneId || !evadeSkill(token.actor))) return null;
  return rivals;
}

export function maneuverCandidates(tokens, ownUuid, user, targets = []) {
  const selected = new Set(Array.from(targets).map((token) => token.document?.uuid ?? token.uuid));
  return Array.from(tokens).filter((token) => token.actor && (token.document?.uuid ?? token.uuid) !== ownUuid
    && (user.isGM || token.isVisible === true)).map((token) => ({
    uuid: token.document?.uuid ?? token.uuid, name: tokenDisplayName(token),
    img: token.document?.texture?.src ?? token.actor.img ?? "", hasEvade: Boolean(evadeSkill(token.actor)),
    selected: selected.has(token.document?.uuid ?? token.uuid)
  }));
}

export async function chooseManeuverRivals(actor, ownTokenUuid) {
  if (!evadeSkill(actor)) { ui.notifications.warn(localize("MYTHRASF.Maneuver.MissingEvade")); return null; }
  const candidates = maneuverCandidates(canvas.tokens?.placeables ?? [], ownTokenUuid, game.user, game.user.targets);
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: localize("MYTHRASF.Maneuver.SelectRivals") }, position: { width: 480 },
    content: `<div class="mythras-foundry mythras-dialog maneuver-selector"><p>${escape(localize("MYTHRASF.Maneuver.SelectHint"))}</p><div class="maneuver-selection-actions"><button type="button" data-maneuver-select="all">${escape(localize("MYTHRASF.Maneuver.SelectAll"))}</button><button type="button" data-maneuver-select="none">${escape(localize("MYTHRASF.Maneuver.SelectNone"))}</button></div>${candidates.map((entry) => `<label class="maneuver-candidate"><input type="checkbox" class="sheet-state-box" name="rival" value="${escape(entry.uuid)}" ${entry.selected && entry.hasEvade ? "checked" : ""} ${entry.hasEvade ? "" : "disabled"}><img src="${escape(entry.img)}" alt=""><span>${escape(entry.name)}${entry.hasEvade ? "" : ` — ${escape(localize("MYTHRASF.Maneuver.MissingEvade"))}`}</span></label>`).join("")}</div>`,
    render: (event, dialog) => {
      const root = dialog.element;
      root.querySelectorAll("[data-maneuver-select]").forEach((button) => button.addEventListener("click", () => {
        root.querySelectorAll('input[name="rival"]:not(:disabled)').forEach((input) => { input.checked = button.dataset.maneuverSelect === "all"; });
        refresh();
      }));
      const refresh = () => {
        const submit = root.querySelector('button[data-action="confirm"]');
        if (submit) submit.disabled = !root.querySelector('input[name="rival"]:checked');
      };
      root.addEventListener("change", refresh); refresh();
    },
    buttons: [{ action: "confirm", label: localize("MYTHRASF.Confirm"), default: true,
      callback: (event, button) => Array.from(button.form.querySelectorAll('input[name="rival"]:checked')).map((input) => input.value) },
    { action: "cancel", label: localize("MYTHRASF.Cancel"), callback: () => null }], rejectClose: false
  });
  return chosen?.length ? { rivalTokenUuids: chosen } : null;
}

export async function startManeuverContest(combat, action, actor) {
  if (!combat.started || Number(action.round) !== Number(combat.round)) {
    throw new Error(localize("MYTHRASF.Maneuver.Expired"));
  }
  const skill = evadeSkill(actor);
  const rivals = await resolveManeuverRivals(actor, action.tokenUuid, action.parameters);
  if (!rivals) throw new Error(localize("MYTHRASF.Maneuver.InvalidParticipants"));
  const difficulty = (subject) => resolveActorConditions(subject, { physical: true }).difficulty;
  const configured = { difficulty: difficulty(actor), targets: resolveSkillRollTargets({
    baseTarget: skill.system.total, difficulty: difficulty(actor) }), contest: {
    resolutionMode: "opposed", participants: rivals.map((token) => {
      const ability = evadeSkill(token.actor);
      return { actorId: token.actor.id, actorUuid: token.actor.uuid, tokenUuid: token.uuid,
        actorName: tokenDisplayName(token), side: "opponent", abilityId: ability.id, abilityName: ability.name,
        baseTarget: ability.system.total, target: resolveSkillRollTargets({ baseTarget: ability.system.total,
          difficulty: difficulty(token.actor) }).target, difficulty: difficulty(token.actor) };
    }), sides: { initiator: { mode: "individual" }, opponent: { mode: "team", representativeRule: "individual" } }
  } };
  const message = await fromUuid(action.messageUuid);
  return createContestMessage(skill, configured, null, { message, initiatorTokenUuid: action.tokenUuid,
    requiredAbilitySlug: "evadir", actionContext: { key: "maneuver", combatId: combat.id,
      combatUuid: combat.uuid, round: combat.round, actionId: action.id, combatantId: action.combatantId,
      protectedTokenUuid: action.tokenUuid } });
}

export async function validateManeuverSelection(combat, actor, tokenUuid, parameters, user) {
  if (!combat?.started) return false;
  const tokens = await resolveManeuverRivals(actor, tokenUuid, parameters);
  return Boolean(tokens && tokens.every((token) => user.isGM || !token.hidden));
}

export function maneuverContestIsCurrent(contest) {
  const context = contest?.actionContext;
  if (context?.key !== "maneuver") return true;
  const combat = game.combats.get(context.combatId);
  const action = combat?.getFlag(SCOPE, "combatActions")?.actions?.[context.actionId];
  return Boolean(combat?.started && combat.uuid === context.combatUuid && Number(combat.round) === Number(context.round)
    && !interruptionBlocksAction(combat, context.actionId) && action?.status === "awaitingContest" && !context.confirmedAt);
}

export async function confirmManeuverContest(message, request) {
  const contest = foundry.utils.deepClone(message.getFlag(SCOPE, "contest"));
  const context = contest?.actionContext; const user = game.users.get(request.userId);
  const combat = game.combats.get(context?.combatId);
  const combatant = combat?.combatants.get(context?.combatantId);
  if (!context || context.key !== "maneuver" || !user || (!user.isGM && !combatant?.actor?.testUserPermission(user, "OWNER"))
    || !maneuverContestIsCurrent(contest) || contest.status !== "resolved"
    || Number(contest.revision) !== Number(request.revision) || contest.participants.some((entry) => entry.pending)) return false;
  const resolution = resolveConfiguredContest(contest);
  const winners = new Set(resolution.comparisons.filter((entry) => entry.winnerId === contest.initiatorId).map((entry) => entry.antagonistId));
  const rivals = (await Promise.all(contest.participants.filter((entry) => winners.has(entry.id))
    .map((entry) => fromUuid(entry.tokenUuid)))).filter((token) => token?.actor);
  await applyManeuverProtection(combatant.actor, context.protectedTokenUuid, rivals, combat, context.actionId);
  for (const rival of rivals) {
    const other = combat.combatants.find((entry) => entry.token?.uuid === rival.uuid);
    const relation = other ? relationFor(combat, combatant.id, other.id) : null;
    if (relation?.status === "engaged") await setRelationPosition(combat, relation.id, relation.position,
      { status: "disengaged", reason: "maneuver", userId: request.userId });
  }
  contest.resolution = resolution;
  context.confirmedAt = Date.now(); context.restrictedTokenUuids = rivals.map((token) => token.uuid);
  contest.revision += 1;
  const { renderContestCard } = await import("./contest-chat.js");
  await message.update({ content: renderContestCard(contest), [`flags.${SCOPE}.contest`]: contest });
  const { finishCombatActionContest } = await import("./combat-action-runtime.js");
  await finishCombatActionContest(combat, context.actionId);
  return true;
}
