import { interruptionBlocksAction } from "./combat-interruption.js";
import { createContestMessage } from "./contest-chat.js";
import { tokenDisplayName } from "./document-names.js";
import { resolveActorConditions } from "./actor-conditions.js";
import { tacticalState } from "./engagement-runtime.js";
import { isEngaged } from "./combat-actions.js";
import { resolveConfiguredContest } from "./contest-rolls.js";
import { resolveSkillRollTargets } from "./skill-roll.js";

const SCOPE = "mythras-foundry";
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const localize = (key) => game.i18n.localize(key);
export const STAND_SKILLS = ["musculo", "atletismo"];
const standSkill = (actor) => actor?.items?.filter((item) => item.type === "skill" && STAND_SKILLS.includes(item.system.slug))
  .sort((a, b) => Number(b.system.total) - Number(a.system.total))[0];

async function resolveStandRivals(actor, tokenUuid, parameters) {
  const uuids = parameters?.rivalTokenUuids;
  if (!standSkill(actor) || !tokenUuid || !Array.isArray(uuids) || !uuids.length
    || new Set(uuids).size !== uuids.length || uuids.includes(tokenUuid)) return null;
  const [own, ...rivals] = await Promise.all([tokenUuid, ...uuids].map((uuid) => typeof uuid === "string" ? fromUuid(uuid) : null));
  if (!own?.parent?.id || own.actor?.uuid !== actor.uuid || rivals.some((token) => !token?.actor
    || token.parent?.id !== own.parent.id || !standSkill(token.actor))) return null;
  return rivals;
}

export async function validateStandSelection(combat, actor, tokenUuid, parameters, user) {
  const rivals = await resolveStandRivals(actor, tokenUuid, parameters);
  return Boolean(combat?.started && rivals && rivals.every((token) => user.isGM || !token.hidden));
}

export async function chooseStandParameters(actor, ownTokenUuid, combat) {
  const own = combat.combatants.find((entry) => entry.token?.uuid === ownTokenUuid);
  const relations = tacticalState(combat).relations;
  const detected = isEngaged(relations, own?.id);
  const engagedIds = new Set(Object.values(relations).filter((relation) => relation.status === "engaged"
    && Object.hasOwn(relation.sides ?? {}, own?.id)).flatMap((relation) => Object.keys(relation.sides)));
  const targets = new Set(Array.from(game.user.targets ?? []).map((token) => token.document?.uuid ?? token.uuid));
  const candidates = combat.combatants.filter((entry) => entry.token?.uuid && entry.token.uuid !== ownTokenUuid
    && (game.user.isGM || (canvas.tokens?.placeables ?? []).some((token) => token.document?.uuid === entry.token.uuid && token.isVisible)))
    .map((entry) => ({ uuid: entry.token.uuid, name: tokenDisplayName(entry.token), eligible: Boolean(standSkill(entry.actor)),
      selected: engagedIds.has(entry.id) || targets.has(entry.token.uuid) }));
  return foundry.applications.api.DialogV2.wait({ window: { title: localize("MYTHRASF.Action.stand") },
    content: `<div class="mythras-foundry mythras-dialog"><label><input type="checkbox" class="sheet-state-box" name="engaged" ${detected ? "checked" : ""}>${escape(localize("MYTHRASF.Stand.Engaged"))}</label><p>${escape(localize("MYTHRASF.Stand.Hint"))}</p><fieldset data-stand-rivals><legend>${escape(localize("MYTHRASF.Stand.Rivals"))}</legend>${candidates.map((entry) => `<label><input type="checkbox" class="sheet-state-box" name="rival" value="${escape(entry.uuid)}" ${entry.selected && entry.eligible ? "checked" : ""} ${entry.eligible ? "" : "disabled"}>${escape(entry.name)}${entry.eligible ? "" : ` — ${escape(localize("MYTHRASF.Stand.InvalidParticipants"))}`}</label>`).join("")}</fieldset></div>`,
    render: (event, dialog) => {
      const root = dialog.element;
      const refresh = () => {
        const engaged = root.querySelector('[name="engaged"]').checked;
        root.querySelector('[data-stand-rivals]').hidden = !engaged;
        root.querySelector('button[data-action="confirm"]').disabled = engaged
          && (!standSkill(actor) || !root.querySelector('[name="rival"]:checked'));
      };
      root.addEventListener("change", refresh); refresh();
    },
    buttons: [{ action: "confirm", label: localize("MYTHRASF.Confirm"), default: true,
      callback: (event, button) => {
        const engaged = button.form.elements.engaged.checked;
        const rivalTokenUuids = Array.from(button.form.querySelectorAll('[name="rival"]:checked')).map((input) => input.value);
        return engaged && (!standSkill(actor) || !rivalTokenUuids.length) ? null : { engaged, rivalTokenUuids: engaged ? rivalTokenUuids : [] };
      } }, { action: "cancel", label: localize("MYTHRASF.Cancel"), callback: () => null }], rejectClose: false });
}

export async function startStandContest(combat, action, actor) {
  if (!combat.started || Number(action.round) !== Number(combat.round)) {
    throw new Error(localize("MYTHRASF.Maneuver.Expired"));
  }
  const skill = standSkill(actor);
  const rivals = await resolveStandRivals(actor, action.tokenUuid, action.parameters);
  if (!rivals) throw new Error(localize("MYTHRASF.Stand.InvalidParticipants"));
  const difficulty = (subject) => resolveActorConditions(subject, { physical: true }).difficulty;
  const configured = { difficulty: difficulty(actor), targets: resolveSkillRollTargets({
    baseTarget: skill.system.total, difficulty: difficulty(actor) }), contest: {
    resolutionMode: "opposed", participants: rivals.map((token) => {
      const ability = standSkill(token.actor);
      return { actorId: token.actor.id, actorUuid: token.actor.uuid, tokenUuid: token.uuid,
        actorName: tokenDisplayName(token), side: "opponent", abilityId: ability.id, abilityName: ability.name,
        baseTarget: ability.system.total, target: resolveSkillRollTargets({ baseTarget: ability.system.total,
          difficulty: difficulty(token.actor) }).target, difficulty: difficulty(token.actor) };
    }), sides: { initiator: { mode: "individual" }, opponent: { mode: "team", representativeRule: "individual" } }
  } };
  const message = await fromUuid(action.messageUuid);
  return createContestMessage(skill, configured, null, { message, initiatorTokenUuid: action.tokenUuid,
    requiredAbilitySlug: STAND_SKILLS, actionContext: { key: "stand", combatId: combat.id,
      combatUuid: combat.uuid, round: combat.round, actionId: action.id, combatantId: action.combatantId,
      protectedTokenUuid: action.tokenUuid } });
}

export function standContestIsCurrent(contest) {
  const context = contest?.actionContext;
  const combat = game.combats.get(context?.combatId);
  const action = combat?.getFlag(SCOPE, "combatActions")?.actions?.[context?.actionId];
  return Boolean(context?.key === "stand" && combat?.started && combat.uuid === context.combatUuid
    && Number(combat.round) === Number(context.round) && !interruptionBlocksAction(combat, context.actionId)
    && action?.key === "stand" && action.status === "awaitingContest" && !context.confirmedAt);
}

export async function confirmStandContest(message, request) {
  const contest = foundry.utils.deepClone(message.getFlag(SCOPE, "contest"));
  const context = contest?.actionContext; const user = game.users.get(request.userId);
  const combat = game.combats.get(context?.combatId);
  const actor = combat?.combatants.get(context?.combatantId)?.actor;
  if (!user || (!user.isGM && !actor?.testUserPermission(user, "OWNER")) || !standContestIsCurrent(contest)
    || contest.status !== "resolved" || Number(contest.revision) !== Number(request.revision)
    || contest.participants.some((entry) => entry.pending)) return false;
  const resolution = resolveConfiguredContest(contest);
  const success = resolution.comparisons.length > 0 && resolution.comparisons.every((entry) => entry.winnerId === contest.initiatorId);
  if (success) {
    const prone = actor.effects.filter((effect) => effect.statuses?.has?.("prone"));
    if (prone.length) await actor.deleteEmbeddedDocuments("ActiveEffect", prone.map((effect) => effect.id));
  }
  contest.resolution = resolution; context.confirmedAt = Date.now(); context.stoodUp = success; contest.revision += 1;
  const { renderContestCard } = await import("./contest-chat.js");
  await message.update({ content: renderContestCard(contest), [`flags.${SCOPE}.contest`]: contest });
  const { finishCombatActionContest } = await import("./combat-action-runtime.js");
  await finishCombatActionContest(combat, context.actionId);
  return true;
}
