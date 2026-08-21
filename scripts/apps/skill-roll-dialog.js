import { resolveSkillRollTargets } from "../rules/skill-roll.js";
import { combineDifficulties } from "../rules/fatigue.js";
import { actorDisplayName, tokenDisplayName } from "../rules/document-names.js";

const DIFFICULTIES = ["automatic", "veryEasy", "easy", "standard", "hard",
  "formidable", "herculean", "impossible"];
const ABILITY_TYPES = ["skill", "combatStyle", "passion"];
const RESOLUTION_MODES = ["difficulty", "opposed", "differential"];
const SIDE_MODES = ["individual", "team", "elimination"];
const TEAM_RULES = ["highest", "lowest", "designated", "individual"];
export const SPECIAL_ABILITY_ID = "__special__";

function escape(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

export function sceneRollParticipants(tokens = canvas?.tokens?.placeables ?? []) {
  return Array.from(tokens).filter((token) => token.actor).map((token) => ({
    token,
    actor: token.actor,
    reference: token.document?.uuid ?? token.uuid ?? token.document?.id ?? token.id ?? ""
  }));
}

function actorReference(actor) {
  return actor?.uuid ?? actor?.id ?? "";
}

function actorIdentity(actor) {
  return actor?.parent?.actorId ?? actor?.token?.actorId ?? actor?.id ?? null;
}

function actorLabel(actor, token = null) {
  if (actor?.type !== "character" && token) return tokenDisplayName(token);
  return actorDisplayName(actor);
}

function actorByReference(participants, reference) {
  const participant = participants.find((entry) => entry.reference === reference);
  if (participant) return participant.actor;
  const document = globalThis.fromUuidSync?.(reference);
  return document?.actor ?? document ?? game.actors.get(reference) ?? null;
}

export async function openSkillRollDialog(item, { imposedDifficulty = "standard",
  defaultDifficulty = "standard", modifiers = [] } = {}) {
  const { DialogV2 } = foundry.applications.api;
  const sceneParticipants = sceneRollParticipants();
  const initiatorParticipant = sceneParticipants.find((entry) => entry.actor === item.actor)
    ?? sceneParticipants.find((entry) => entry.actor?.uuid === item.actor?.uuid);
  const initiatorReference = initiatorParticipant?.reference ?? actorReference(item.actor);
  const actorOptions = sceneParticipants.map(({ actor, token, reference }) =>
    `<option value="${escape(reference)}" ${reference === initiatorReference ? "selected" : ""}>${escape(actorLabel(actor, token))}</option>`).join("");
  const skillOptions = sceneParticipants.flatMap(({ actor, token, reference }) => actor.items
    .filter((candidate) => ABILITY_TYPES.includes(candidate.type))
    .map((skill) => `<option value="${escape(reference)}|${escape(skill.id)}" data-actor-id="${escape(reference)}" data-target="${Number(skill.system.total ?? 0)}" ${reference === initiatorReference && skill.id === item.id ? "selected" : ""}>${escape(actorLabel(actor, token))} — ${escape(skill.name)} (${Number(skill.system.total ?? 0)}%)</option>`))
    .join("");
  const targetedActorIds = new Set(Array.from(game.user?.targets ?? [])
    .map((token) => token.document?.uuid ?? token.uuid ?? token.document?.id ?? token.id).filter(Boolean));
  const participantDifficultyOptions = DIFFICULTIES.map((key) => `<option value="${key}" ${key === defaultDifficulty ? "selected" : ""}>${escape(game.i18n.localize(`MYTHRASF.Difficulty.${key}`))}</option>`).join("");
  const initiatorRow = `<div class="skill-roll-participant skill-roll-participant--initiator" data-actor-id="${escape(initiatorReference)}">
    <span class="skill-roll-participant-name">${escape(actorLabel(item.actor, initiatorParticipant?.token))}</span>
    <span class="skill-roll-participant-fixed">${escape(game.i18n.localize("MYTHRASF.Contest.InitiatorIncluded"))}</span>
    <span></span><output class="sheet-field-readonly">${escape(item.name)} (${Number(item.system.total ?? 0)}%)</output><span></span>
  </div>`;
  const participantRows = sceneParticipants.filter((entry) => entry.reference !== initiatorReference).map(({ actor, token, reference }) => {
    const abilities = actor.items.filter((candidate) => ABILITY_TYPES.includes(candidate.type));
    const options = [...abilities.map((ability) => `<option value="${escape(ability.id)}" data-target="${Number(ability.system.total ?? 0)}" ${ability.type === item.type && ability.name === item.name ? "selected" : ""}>${escape(ability.name)} (${Number(ability.system.total ?? 0)}%)</option>`),
      `<option value="${SPECIAL_ABILITY_ID}">${escape(game.i18n.localize("MYTHRASF.SpecialRoll.Title"))}</option>`].join("");
    const checked = targetedActorIds.has(reference) ? "checked" : "";
    return `<div class="skill-roll-participant" data-actor-id="${escape(reference)}">
      <span class="skill-roll-participant-name">${escape(actorLabel(actor, token))}</span>
      <label><input type="checkbox" class="sheet-state-box" name="initiatorParticipant" value="${escape(reference)}" data-actor-identity="${escape(actorIdentity(actor))}"><span>${escape(game.i18n.localize("MYTHRASF.Contest.Side.initiator"))}</span></label>
      <label><input type="checkbox" class="sheet-state-box" name="opponentParticipant" value="${escape(reference)}" data-actor-identity="${escape(actorIdentity(actor))}" ${checked}><span>${escape(game.i18n.localize("MYTHRASF.Contest.Side.opponent"))}</span></label>
      <select class="skill-roll-participant-configuration" name="participantAbility-${escape(reference)}" aria-label="${escape(game.i18n.localize("MYTHRASF.Contest.Ability"))}">${options}</select>
      <input class="skill-roll-participant-configuration" name="participantSpecialName-${escape(reference)}" value="${escape(game.i18n.localize("MYTHRASF.SpecialRoll.DefaultName"))}" aria-label="${escape(game.i18n.localize("MYTHRASF.SpecialRoll.Name"))}" hidden>
      <input type="number" min="0" class="skill-roll-participant-configuration" name="participantSpecialTarget-${escape(reference)}" value="50" aria-label="${escape(game.i18n.localize("MYTHRASF.SpecialRoll.Target"))}" hidden>
      <select class="skill-roll-participant-configuration" name="participantDifficulty-${escape(reference)}" aria-label="${escape(game.i18n.localize("MYTHRASF.SkillRoll.ChosenDifficulty"))}">${participantDifficultyOptions}</select>
    </div>`;
  }).join("");
  const resolutionOptions = RESOLUTION_MODES.map((mode) => `<option value="${mode}">${escape(game.i18n.localize(`MYTHRASF.Contest.ResolutionMode.${mode}`))}</option>`).join("");
  const sideModeOptions = SIDE_MODES.map((mode) => `<option value="${mode}">${escape(game.i18n.localize(`MYTHRASF.Contest.SideMode.${mode}`))}</option>`).join("");
  const teamRuleOptions = TEAM_RULES.map((rule) => `<option value="${rule}">${escape(game.i18n.localize(`MYTHRASF.Contest.TeamRule.${rule}`))}</option>`).join("");
  const partyOptions = [`<option value="">${escape(game.i18n.localize("MYTHRASF.Contest.NoGroup"))}</option>`,
    ...(game.mythrasFoundry?.party?.parties ?? []).map((party) => `<option value="${escape(party.id)}" data-members="${escape((party.memberIds ?? []).join(","))}">${escape(party.name)}</option>`)].join("");
  const difficultyOptions = DIFFICULTIES.map((key) =>
    `<option value="${key}" ${key === defaultDifficulty ? "selected" : ""}>${escape(game.i18n.localize(`MYTHRASF.Difficulty.${key}`))}</option>`).join("");
  const modifierRows = modifiers.length
    ? modifiers.map(({ source, effect, type = "penalty" }) => `<div class="skill-roll-modifier"><span>${escape(source)}</span><strong class="skill-roll-modifier-effect skill-roll-modifier-effect--${type}">${escape(effect)}</strong></div>`).join("")
    : `<p class="skill-roll-empty">${escape(game.i18n.localize("MYTHRASF.SkillRoll.NoModifiers"))}</p>`;
  const adjustmentPanel = (type) => `<fieldset class="skill-roll-adjustment" data-adjustment="${type}">
    <legend>${escape(game.i18n.localize(`MYTHRASF.SkillRoll.${type === "limited" ? "Limited" : "Reinforced"}`))}</legend>
    <label class="skill-roll-adjustment-toggle"><input type="checkbox" class="sheet-state-box" name="${type}Enabled">
      <span>${escape(game.i18n.localize("MYTHRASF.SkillRoll.ApplyAdjustment"))}</span></label>
    <div class="skill-roll-adjustment-fields">
      <label><span>${escape(game.i18n.localize("MYTHRASF.SkillRoll.AffectedBy"))}</span><select name="${type}ActorId">${actorOptions}</select></label>
      <label><span>${escape(game.i18n.localize("MYTHRASF.SkillRoll.AffectingSkill"))}</span><select name="${type}Skill">${skillOptions}</select></label>
    </div>
  </fieldset>`;
  const initialTargets = resolveSkillRollTargets({
    baseTarget: item.system.total, difficulty: defaultDifficulty, imposedDifficulty
  });
  const result = await DialogV2.wait({
    window: { title: game.i18n.format("MYTHRASF.SkillRoll.Title", { skill: item.name }) },
    content: `<div class="mythras-foundry mythras-dialog skill-roll-dialog" data-imposed-difficulty="${imposedDifficulty}" data-base-target="${Number(item.system.total ?? 0)}">
      <fieldset class="skill-roll-contest"><legend>${escape(game.i18n.localize("MYTHRASF.Contest.Title"))}</legend>
        <label><span>${escape(game.i18n.localize("MYTHRASF.Contest.ResolutionLabel"))}</span><select name="resolutionMode">${resolutionOptions}</select></label>
        <div data-contest-settings>
          <fieldset class="skill-roll-side" data-contest-side="initiator"><legend>${escape(game.i18n.localize("MYTHRASF.Contest.Side.initiator"))}</legend>
            <label><span>${escape(game.i18n.localize("MYTHRASF.Contest.Participation"))}</span><select name="initiatorMode">${sideModeOptions}</select></label>
            <label data-team-rule hidden><span>${escape(game.i18n.localize("MYTHRASF.Contest.TeamRule.Label"))}</span><select name="initiatorTeamRule">${teamRuleOptions}</select></label>
            <label data-designated hidden><span>${escape(game.i18n.localize("MYTHRASF.Contest.Representative"))}</span><select name="initiatorDesignatedActorId">${actorOptions}</select></label>
            <label data-party-loader hidden><span>${escape(game.i18n.localize("MYTHRASF.Contest.LoadGroup"))}</span><select name="initiatorPartyId">${partyOptions}</select></label>
          </fieldset>
          <fieldset class="skill-roll-side" data-contest-side="opponent" hidden><legend>${escape(game.i18n.localize("MYTHRASF.Contest.Side.opponent"))}</legend>
            <label><span>${escape(game.i18n.localize("MYTHRASF.Contest.Participation"))}</span><select name="opponentMode">${sideModeOptions}</select></label>
            <label data-team-rule hidden><span>${escape(game.i18n.localize("MYTHRASF.Contest.TeamRule.Label"))}</span><select name="opponentTeamRule">${teamRuleOptions}</select></label>
            <label data-designated hidden><span>${escape(game.i18n.localize("MYTHRASF.Contest.Representative"))}</span><select name="opponentDesignatedActorId">${actorOptions}</select></label>
            <label data-party-loader hidden><span>${escape(game.i18n.localize("MYTHRASF.Contest.LoadGroup"))}</span><select name="opponentPartyId">${partyOptions}</select></label>
          </fieldset>
          <div class="skill-roll-participants" hidden>${initiatorRow}${participantRows}</div>
        </div>
      </fieldset>
      ${adjustmentPanel("limited")}
      ${adjustmentPanel("reinforced")}
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.SkillRoll.Modifiers"))}</legend>${modifierRows}</fieldset>
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.SkillRoll.ChosenDifficulty"))}</legend><select name="difficulty">${difficultyOptions}</select></fieldset>
      <fieldset class="skill-roll-effective-difficulty"><legend>${escape(game.i18n.localize("MYTHRASF.SkillRoll.FinalDifficulty"))}</legend>
        <output class="sheet-field-readonly" data-effective-difficulty>${escape(game.i18n.localize(`MYTHRASF.Difficulty.${combineDifficulties(defaultDifficulty, imposedDifficulty)}`))}</output>
      </fieldset>
      <fieldset class="skill-roll-final-target"><legend>${escape(game.i18n.localize("MYTHRASF.SkillRoll.FinalSkillValue"))}</legend>
        <div><span>${escape(item.name)}</span><output class="sheet-field-readonly penalized-value"><span data-base-target-value>${initialTargets.baseTarget}%</span><span class="skill-roll-target skill-roll-target--${targetComparison(initialTargets.target, initialTargets.baseTarget)}" data-final-target-value ${initialTargets.target === initialTargets.baseTarget ? "hidden" : ""}>(${initialTargets.target}%)</span></output></div>
      </fieldset>
    </div>`,
    buttons: [{ action: "roll", label: game.i18n.localize("MYTHRASF.Roll"), icon: "fas fa-dice-d20", default: true,
      callback: (event, button) => {
        const form = button.form.elements;
        const adjustment = (type) => {
          if (!form[`${type}Enabled`].checked) return null;
          const [actorId, skillId] = String(form[`${type}Skill`].value).split("|");
          if (actorId !== form[`${type}ActorId`].value || !skillId) return false;
          return actorByReference(sceneParticipants, actorId)?.items.get(skillId) ?? false;
        };
        const limitedSkill = adjustment("limited");
        const reinforcedSkill = adjustment("reinforced");
        if (limitedSkill === false || reinforcedSkill === false) {
          ui.notifications.warn(game.i18n.localize("MYTHRASF.SkillRoll.SupportMismatch"));
          return null;
        }
        const resolutionMode = form.resolutionMode.value;
        const sideConfig = (side) => {
          const mode = form[`${side}Mode`].value;
          const controls = Array.from(button.form.querySelectorAll(`input[name='${side}Participant']:checked`));
          const selectedParticipants = controls.map((control) => {
            const actor = actorByReference(sceneParticipants, control.value);
            if (!actor) return null;
            const token = sceneParticipants.find((entry) => entry.reference === control.value)?.token ?? null;
            if (mode === "individual") return { actorId: actorIdentity(actor), actorUuid: actorReference(actor), tokenUuid: control.value,
              actorName: actorLabel(actor, token),
              abilityId: null, abilityName: null, difficulty: null, target: null, side };
            const abilityId = form[`participantAbility-${control.value}`]?.value;
            const ability = abilityId === SPECIAL_ABILITY_ID ? { id: SPECIAL_ABILITY_ID, type: "special",
              name: form[`participantSpecialName-${control.value}`]?.value.trim()
                || game.i18n.localize("MYTHRASF.SpecialRoll.DefaultName"),
              system: { total: Math.max(0, Number(form[`participantSpecialTarget-${control.value}`]?.value) || 0) } }
              : actor.items.get(abilityId);
            const participantDifficulty = form[`participantDifficulty-${control.value}`]?.value ?? "standard";
            return ability ? { actorId: actorIdentity(actor), actorUuid: actorReference(actor), tokenUuid: control.value,
              actorName: actorLabel(actor, token), abilityId: ability.id,
              abilityName: side === "opponent" ? null : ability.name, difficulty: participantDifficulty, side,
              target: resolveSkillRollTargets({ baseTarget: ability.system.total, difficulty: participantDifficulty }).target } : null;
          }).filter(Boolean);
          return { mode, representativeRule: form[`${side}TeamRule`].value,
            designatedActorId: form[`${side}DesignatedActorId`].value || selectedParticipants[0]?.tokenUuid || selectedParticipants[0]?.actorUuid || null,
            participants: selectedParticipants, valid: selectedParticipants.length === controls.length };
        };
        const initiatorSide = sideConfig("initiator");
        const opponentSide = resolutionMode === "difficulty"
          ? { mode: form.opponentMode.value, representativeRule: form.opponentTeamRule.value,
            designatedActorId: null, participants: [], valid: true }
          : sideConfig("opponent");
        if (resolutionMode !== "difficulty" && !opponentSide.participants.length) {
          ui.notifications.warn(game.i18n.localize("MYTHRASF.Contest.ParticipantsRequired")); return null;
        }
        if (!initiatorSide.valid || !opponentSide.valid) {
          ui.notifications.warn(game.i18n.localize("MYTHRASF.Contest.ParticipantsRequired")); return null;
        }
        return { difficulty: form.difficulty.value, limitedSkill, reinforcedSkill,
          contest: { resolutionMode, sides: { initiator: initiatorSide, opponent: opponentSide },
            participants: [...initiatorSide.participants, ...opponentSide.participants] } };
      }
    }, { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), icon: "fas fa-times" }],
    rejectClose: false
  });
  if (!result) return null;
  return { ...result, targets: resolveSkillRollTargets({
    baseTarget: item.system.total, difficulty: result.difficulty, imposedDifficulty,
    limited: Boolean(result.limitedSkill), limitedTarget: result.limitedSkill?.system.total,
    reinforced: Boolean(result.reinforcedSkill),
    reinforcedTarget: result.reinforcedSkill?.system.total
  }) };
}

export function activateSkillRollDialog(element) {
  const dialog = element.querySelector?.(".skill-roll-dialog");
  const select = dialog?.querySelector("select[name='difficulty']");
  const output = dialog?.querySelector("[data-effective-difficulty]");
  const finalTarget = dialog?.querySelector("[data-final-target-value]");
  if (!select || !output || !finalTarget || dialog.dataset.rollPreviewListener) return;
  const update = () => {
    const selectedTarget = (type) => {
      const enabled = dialog.querySelector(`input[name='${type}Enabled']`)?.checked;
      const option = dialog.querySelector(`select[name='${type}Skill']`)?.selectedOptions?.[0];
      return enabled ? Number(option?.dataset.target ?? 0) : 0;
    };
    const limited = dialog.querySelector("input[name='limitedEnabled']")?.checked;
    const reinforced = dialog.querySelector("input[name='reinforcedEnabled']")?.checked;
    const targets = resolveSkillRollTargets({
      baseTarget: Number(dialog.dataset.baseTarget), difficulty: select.value,
      imposedDifficulty: dialog.dataset.imposedDifficulty,
      limited, limitedTarget: selectedTarget("limited"),
      reinforced, reinforcedTarget: selectedTarget("reinforced")
    });
    output.textContent = game.i18n.localize(`MYTHRASF.Difficulty.${targets.difficulty}`);
    finalTarget.textContent = `(${targets.target}%)`;
    finalTarget.hidden = targets.target === targets.baseTarget;
    finalTarget.className = `skill-roll-target skill-roll-target--${targetComparison(targets.target, targets.baseTarget)}`;
  };
  dialog.dataset.rollPreviewListener = "true";
  dialog.addEventListener("change", (event) => {
    if (["resolutionMode", "initiatorMode", "opponentMode", "initiatorTeamRule", "opponentTeamRule"].includes(event.target.name)) refreshContestFields(dialog);
    if (/^(limited|reinforced)ActorId$/.test(event.target.name)) syncAdjustmentSkill(dialog, event.target.name.replace("ActorId", ""));
    if (/^(initiator|opponent)PartyId$/.test(event.target.name)) {
      const side = event.target.name.startsWith("initiator") ? "initiator" : "opponent";
      const members = new Set(String(event.target.selectedOptions[0]?.dataset.members ?? "").split(",").filter(Boolean));
      if (members.size) dialog.querySelectorAll(`input[name='${side}Participant']`).forEach((control) => {
        control.checked = members.has(control.dataset.actorIdentity);
      });
      refreshContestFields(dialog);
    }
    if (["initiatorParticipant", "opponentParticipant"].includes(event.target.name) && event.target.checked) {
      const other = event.target.name === "initiatorParticipant" ? "opponentParticipant" : "initiatorParticipant";
      const opposite = event.target.closest(".skill-roll-participant")?.querySelector(`input[name='${other}']`);
      if (opposite) opposite.checked = false;
      refreshContestFields(dialog);
    }
    if (event.target.name?.startsWith("participantAbility-")) refreshContestFields(dialog);
    update();
  });
  refreshContestFields(dialog);
  syncAdjustmentSkill(dialog, "limited");
  syncAdjustmentSkill(dialog, "reinforced");
  update();
}

function refreshContestFields(dialog) {
  const resolution = dialog.querySelector("select[name='resolutionMode']")?.value ?? "difficulty";
  const opponentPanel = dialog.querySelector("[data-contest-side='opponent']");
  if (opponentPanel) opponentPanel.hidden = resolution === "difficulty";
  const initiatorMode = dialog.querySelector("select[name='initiatorMode']")?.value ?? "individual";
  const participantList = dialog.querySelector(".skill-roll-participants");
  if (participantList) participantList.hidden = resolution === "difficulty" && initiatorMode === "individual";
  for (const side of ["initiator", "opponent"]) {
    const mode = dialog.querySelector(`select[name='${side}Mode']`)?.value ?? "individual";
    const group = mode !== "individual";
    const panel = dialog.querySelector(`[data-contest-side='${side}']`);
    panel?.querySelectorAll("[data-party-loader]").forEach((node) => { node.hidden = !group; });
    panel?.querySelectorAll("[data-team-rule]").forEach((node) => { node.hidden = mode !== "team"; });
    const rule = dialog.querySelector(`select[name='${side}TeamRule']`)?.value;
    const designated = panel?.querySelector("[data-designated]");
    if (designated) designated.hidden = mode !== "team" || rule !== "designated";
    dialog.querySelectorAll(`input[name='${side}Participant']`).forEach((control) => {
      control.closest("label").hidden = (side === "initiator" && !group) || (side === "opponent" && resolution === "difficulty");
    });
  }
  dialog.querySelectorAll(".skill-roll-participant").forEach((row) => {
    const initiatorGroup = dialog.querySelector("select[name='initiatorMode']")?.value !== "individual"
      && row.querySelector("input[name='initiatorParticipant']")?.checked;
    row.querySelectorAll(".skill-roll-participant-configuration").forEach((node) => {
      const specialField = node.name?.includes("Special");
      const specialSelected = row.querySelector("select[name^='participantAbility-']")?.value === SPECIAL_ABILITY_ID;
      node.hidden = !initiatorGroup || (specialField && !specialSelected);
    });
  });
}

export async function openContestResponseDialog(actor, defaultAbilityId, defaultDifficulty = "standard",
  { specialName = "", specialTarget = 50 } = {}) {
  const { DialogV2 } = foundry.applications.api;
  const abilities = actor.items.filter((item) => ABILITY_TYPES.includes(item.type));
  const options = [...abilities.map((item) => `<option value="${escape(item.id)}" ${item.id === defaultAbilityId ? "selected" : ""}>${escape(item.name)} (${Number(item.system.total ?? 0)}%)</option>`),
    `<option value="${SPECIAL_ABILITY_ID}" ${defaultAbilityId === SPECIAL_ABILITY_ID ? "selected" : ""}>${escape(game.i18n.localize("MYTHRASF.SpecialRoll.Title"))}</option>`].join("");
  const sceneParticipants = sceneRollParticipants();
  const respondingParticipant = sceneParticipants.find((entry) => entry.actor === actor)
    ?? sceneParticipants.find((entry) => entry.actor?.uuid === actor?.uuid);
  const respondingReference = respondingParticipant?.reference ?? actorReference(actor);
  const responseActorName = actorLabel(actor, respondingParticipant?.token);
  const actorOptions = sceneParticipants.map(({ actor: candidate, token, reference }) => `<option value="${escape(reference)}" ${reference === respondingReference ? "selected" : ""}>${escape(actorLabel(candidate, token))}</option>`).join("");
  const affectingOptions = sceneParticipants.flatMap(({ actor: candidate, reference }) => candidate.items.filter((item) => ABILITY_TYPES.includes(item.type))
    .map((item) => `<option value="${escape(reference)}|${escape(item.id)}" data-actor-id="${escape(reference)}" ${reference === respondingReference && item.id === defaultAbilityId ? "selected" : ""}>${escape(item.name)} (${Number(item.system.total ?? 0)}%)</option>`)).join("");
  const adjustment = (name, key) => `<fieldset class="skill-roll-adjustment" data-adjustment="${name}"><legend>${escape(game.i18n.localize(`MYTHRASF.SkillRoll.${key}`))}</legend><label><span>${escape(game.i18n.localize("MYTHRASF.SkillRoll.ApplyAdjustment"))}</span><input type="checkbox" class="sheet-state-box" name="${name}Enabled"></label><div class="skill-roll-adjustment-fields"><label><span>${escape(game.i18n.localize("MYTHRASF.SkillRoll.AffectedBy"))}</span><select name="${name}ActorId">${actorOptions}</select></label><label><span>${escape(game.i18n.localize("MYTHRASF.SkillRoll.AffectingSkill"))}</span><select name="${name}Ability">${affectingOptions}</select></label></div></fieldset>`;
  return DialogV2.wait({
    window: { title: game.i18n.format("MYTHRASF.Contest.ResponseTitle", { actor: responseActorName }) },
    content: `<div class="mythras-foundry mythras-dialog contest-response-dialog"><fieldset><legend>${escape(responseActorName)}</legend>
      <label><span>${escape(game.i18n.localize("MYTHRASF.Contest.Ability"))}</span><select name="abilityId">${options}</select></label>
      <div class="special-roll-fields" data-special-roll-fields hidden>
        <label><span>${escape(game.i18n.localize("MYTHRASF.SpecialRoll.Name"))}</span><input type="text" name="specialName" value="${escape(specialName || game.i18n.localize("MYTHRASF.SpecialRoll.DefaultName"))}"></label>
        <label><span>${escape(game.i18n.localize("MYTHRASF.SpecialRoll.Target"))}</span><input type="number" name="specialTarget" min="0" value="${Math.max(0, Number(specialTarget) || 0)}" required></label>
      </div>
      <label><span>${escape(game.i18n.localize("MYTHRASF.SkillRoll.ChosenDifficulty"))}</span><select name="difficulty">${DIFFICULTIES.map((key) => `<option value="${key}" ${key === (defaultDifficulty ?? "standard") ? "selected" : ""}>${escape(game.i18n.localize(`MYTHRASF.Difficulty.${key}`))}</option>`).join("")}</select></label>
    </fieldset>${adjustment("limited", "Limited")}${adjustment("reinforced", "Reinforced")}</div>`,
    buttons: [{ action: "roll", label: game.i18n.localize("MYTHRASF.Roll"), icon: "fas fa-dice-d20", default: true,
      callback: (event, button) => ({ abilityId: button.form.elements.abilityId.value,
        specialName: button.form.elements.specialName.value.trim(),
        specialTarget: Math.max(0, Number(button.form.elements.specialTarget.value) || 0),
        difficulty: button.form.elements.difficulty.value,
        limitedAbility: responseAdjustment(button.form.elements, "limited"),
        reinforcedAbility: responseAdjustment(button.form.elements, "reinforced") }) },
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), icon: "fas fa-times" }], rejectClose: false
  });
}

export function activateContestResponseDialog(element) {
  const dialog = element.querySelector?.(".contest-response-dialog");
  if (!dialog || dialog.dataset.adjustmentListener) return;
  const update = (type) => {
    const fields = dialog.querySelector(`[data-adjustment='${type}'] .skill-roll-adjustment-fields`);
    if (fields) fields.hidden = !dialog.querySelector(`input[name='${type}Enabled']`)?.checked;
    syncAdjustmentSkill(dialog, type, "Ability");
  };
  const updateSpecial = () => {
    const special = dialog.querySelector("select[name='abilityId']")?.value === SPECIAL_ABILITY_ID;
    const fields = dialog.querySelector("[data-special-roll-fields]");
    if (fields) fields.hidden = !special;
  };
  dialog.dataset.adjustmentListener = "true";
  dialog.addEventListener("change", (event) => {
    for (const type of ["limited", "reinforced"]) {
      if (event.target.name === `${type}Enabled` || event.target.name === `${type}ActorId`) update(type);
    }
    if (event.target.name === "abilityId") updateSpecial();
  });
  update("limited"); update("reinforced"); updateSpecial();
}

export async function openSpecialRollSetup(actor) {
  return foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.SpecialRoll.Title") },
    content: `<div class="mythras-foundry mythras-dialog special-roll-dialog">
      <label><span>${escape(game.i18n.localize("MYTHRASF.SpecialRoll.Name"))}</span><input type="text" name="name" value="${escape(game.i18n.localize("MYTHRASF.SpecialRoll.DefaultName"))}" autofocus></label>
      <label><span>${escape(game.i18n.localize("MYTHRASF.SpecialRoll.Target"))}</span><input type="number" name="target" min="0" value="50" required></label>
    </div>`,
    buttons: [{ action: "continue", label: game.i18n.localize("MYTHRASF.SpecialRoll.Continue"), default: true,
      callback: (event, button) => ({ actor, name: button.form.elements.name.value.trim()
        || game.i18n.localize("MYTHRASF.SpecialRoll.DefaultName"),
      target: Math.max(0, Number(button.form.elements.target.value) || 0) }) },
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel") }], rejectClose: false
  });
}

function responseAdjustment(form, type) {
  if (!form[`${type}Enabled`].checked) return null;
  const value = form[`${type}Ability`].value;
  return value.startsWith(`${form[`${type}ActorId`].value}|`) ? value : null;
}

function syncAdjustmentSkill(dialog, type, suffix = "Skill") {
  const actorId = dialog.querySelector(`select[name='${type}ActorId']`)?.value;
  const select = dialog.querySelector(`select[name='${type}${suffix}']`);
  if (!select) return;
  Array.from(select.options).forEach((option) => {
    const optionActorId = option.dataset.actorId ?? String(option.value).split("|")[0];
    option.hidden = option.disabled = optionActorId !== actorId;
  });
  if (select.selectedOptions[0]?.disabled) select.value = Array.from(select.options).find((option) => !option.disabled)?.value ?? "";
}

function targetComparison(target, baseTarget) {
  if (target < baseTarget) return "penalty";
  if (target > baseTarget) return "bonus";
  return "neutral";
}
