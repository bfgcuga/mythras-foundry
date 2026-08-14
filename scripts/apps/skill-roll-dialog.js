import { resolveSkillRollTargets } from "../rules/skill-roll.js";
import { combineDifficulties } from "../rules/fatigue.js";

const DIFFICULTIES = ["automatic", "veryEasy", "easy", "standard", "hard",
  "formidable", "herculean", "impossible"];
const ABILITY_TYPES = ["skill", "combatStyle", "passion"];
const CONTEST_TYPES = ["simple", "opposed", "differential", "team", "inverseTeam", "elimination"];

function escape(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function sceneActors() {
  const seen = new Set();
  return Array.from(canvas?.tokens?.placeables ?? []).map((token) => token.actor)
    .filter((actor) => actor && !seen.has(actor.id) && seen.add(actor.id));
}

export async function openSkillRollDialog(item, { imposedDifficulty = "standard",
  defaultDifficulty = "standard", modifiers = [] } = {}) {
  const { DialogV2 } = foundry.applications.api;
  const actors = sceneActors();
  const actorOptions = actors.map((actor) =>
    `<option value="${escape(actor.id)}">${escape(actor.name)}</option>`).join("");
  const skillOptions = actors.flatMap((actor) => actor.items
    .filter((candidate) => ABILITY_TYPES.includes(candidate.type))
    .map((skill) => `<option value="${escape(actor.id)}:${escape(skill.id)}" data-target="${Number(skill.system.total ?? 0)}">${escape(actor.name)} — ${escape(skill.name)} (${Number(skill.system.total ?? 0)}%)</option>`))
    .join("");
  const targetedActorIds = new Set(Array.from(game.user?.targets ?? []).map((token) => token.actor?.id).filter(Boolean));
  const participantDifficultyOptions = DIFFICULTIES.map((key) => `<option value="${key}" ${key === "standard" ? "selected" : ""}>${escape(game.i18n.localize(`MYTHRASF.Difficulty.${key}`))}</option>`).join("");
  const participantRows = actors.map((actor) => {
    const abilities = actor.items.filter((candidate) => ABILITY_TYPES.includes(candidate.type));
    const options = abilities.map((ability) => `<option value="${escape(ability.id)}" data-target="${Number(ability.system.total ?? 0)}">${escape(ability.name)} (${Number(ability.system.total ?? 0)}%)</option>`).join("");
    const checked = targetedActorIds.has(actor.id) ? "checked" : "";
    return `<div class="skill-roll-participant" data-actor-id="${escape(actor.id)}">
      <label><input type="checkbox" class="sheet-state-box" name="participantActor" value="${escape(actor.id)}" ${checked}><span>${escape(actor.name)}</span></label>
      <select class="skill-roll-participant-configuration" name="participantAbility-${escape(actor.id)}" aria-label="${escape(game.i18n.localize("MYTHRASF.Contest.Ability"))}">${options}</select>
      <select class="skill-roll-participant-configuration" name="participantDifficulty-${escape(actor.id)}" aria-label="${escape(game.i18n.localize("MYTHRASF.SkillRoll.ChosenDifficulty"))}">${participantDifficultyOptions}</select>
      <label class="skill-roll-representative"><input type="radio" class="sheet-state-box" name="designatedActor" value="${escape(actor.id)}"><span>${escape(game.i18n.localize("MYTHRASF.Contest.Representative"))}</span></label>
    </div>`;
  }).join("");
  const contestOptions = CONTEST_TYPES.map((type) => `<option value="${type}">${escape(game.i18n.localize(`MYTHRASF.Contest.Type.${type}`))}</option>`).join("");
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
        <label><span>${escape(game.i18n.localize("MYTHRASF.Contest.RollType"))}</span><select name="contestType">${contestOptions}</select></label>
        <div data-contest-settings hidden>
          <label><span>${escape(game.i18n.localize("MYTHRASF.Contest.LoadGroup"))}</span><select name="partyId">${partyOptions}</select></label>
          <div class="skill-roll-participants">${participantRows}</div>
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
          const [actorId, skillId] = String(form[`${type}Skill`].value).split(":");
          if (actorId !== form[`${type}ActorId`].value || !skillId) return false;
          return game.actors.get(actorId)?.items.get(skillId) ?? false;
        };
        const limitedSkill = adjustment("limited");
        const reinforcedSkill = adjustment("reinforced");
        if (limitedSkill === false || reinforcedSkill === false) {
          ui.notifications.warn(game.i18n.localize("MYTHRASF.SkillRoll.SupportMismatch"));
          return null;
        }
        const type = form.contestType.value;
        const selectedParticipants = type === "simple" ? [] : Array.from(button.form.querySelectorAll("input[name='participantActor']:checked"));
        const groupType = ["team", "inverseTeam", "elimination"].includes(type);
        const participants = selectedParticipants.map((control) => {
          const actor = game.actors.get(control.value);
          if (!groupType) return actor ? { actorId: actor.id, actorName: actor.name,
            abilityId: null, abilityName: null, difficulty: null, target: null } : null;
          const abilityId = form[`participantAbility-${control.value}`]?.value;
          const ability = actor?.items.get(abilityId);
          const participantDifficulty = form[`participantDifficulty-${control.value}`]?.value ?? "standard";
          return actor && ability ? { actorId: actor.id, actorName: actor.name, abilityId: ability.id,
            abilityName: ability.name, difficulty: participantDifficulty,
            target: resolveSkillRollTargets({ baseTarget: ability.system.total, difficulty: participantDifficulty }).target } : null;
        }).filter(Boolean);
        if (type !== "simple" && !participants.length) {
          ui.notifications.warn(game.i18n.localize("MYTHRASF.Contest.ParticipantsRequired"));
          return null;
        }
        if (groupType && participants.length !== selectedParticipants.length) {
          ui.notifications.warn(game.i18n.localize("MYTHRASF.Contest.ParticipantsRequired"));
          return null;
        }
        const designatedActorId = form.designatedActor?.value || (type === "elimination" ? participants[0]?.actorId : null);
        return { difficulty: form.difficulty.value, limitedSkill, reinforcedSkill,
          contest: { type, participants, designatedActorId } };
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
    if (event.target.name === "contestType") {
      const simple = event.target.value === "simple";
      const group = ["team", "inverseTeam", "elimination"].includes(event.target.value);
      dialog.querySelector("[data-contest-settings]").hidden = simple;
      dialog.querySelectorAll(".skill-roll-participant-configuration").forEach((node) => { node.hidden = !group; });
      dialog.querySelectorAll(".skill-roll-representative").forEach((node) => {
        node.hidden = event.target.value !== "elimination";
      });
    }
    if (/^(limited|reinforced)ActorId$/.test(event.target.name)) syncAdjustmentSkill(dialog, event.target.name.replace("ActorId", ""));
    if (event.target.name === "partyId") {
      const members = new Set(String(event.target.selectedOptions[0]?.dataset.members ?? "").split(",").filter(Boolean));
      if (members.size) dialog.querySelectorAll("input[name='participantActor']").forEach((control) => { control.checked = members.has(control.value); });
    }
    update();
  });
  dialog.querySelectorAll(".skill-roll-participant-configuration, .skill-roll-representative").forEach((node) => { node.hidden = true; });
  syncAdjustmentSkill(dialog, "limited");
  syncAdjustmentSkill(dialog, "reinforced");
  update();
}

export async function openContestResponseDialog(actor, defaultAbilityId) {
  const { DialogV2 } = foundry.applications.api;
  const abilities = actor.items.filter((item) => ABILITY_TYPES.includes(item.type));
  const options = abilities.map((item) => `<option value="${escape(item.id)}" ${item.id === defaultAbilityId ? "selected" : ""}>${escape(item.name)} (${Number(item.system.total ?? 0)}%)</option>`).join("");
  const actors = sceneActors();
  const actorOptions = actors.map((candidate) => `<option value="${escape(candidate.id)}">${escape(candidate.name)}</option>`).join("");
  const affectingOptions = actors.flatMap((candidate) => candidate.items.filter((item) => ABILITY_TYPES.includes(item.type))
    .map((item) => `<option value="${escape(candidate.id)}:${escape(item.id)}" data-actor-id="${escape(candidate.id)}">${escape(item.name)} (${Number(item.system.total ?? 0)}%)</option>`)).join("");
  const adjustment = (name, key) => `<fieldset class="skill-roll-adjustment" data-adjustment="${name}"><legend>${escape(game.i18n.localize(`MYTHRASF.SkillRoll.${key}`))}</legend><label><span>${escape(game.i18n.localize("MYTHRASF.SkillRoll.ApplyAdjustment"))}</span><input type="checkbox" class="sheet-state-box" name="${name}Enabled"></label><div class="skill-roll-adjustment-fields"><label><span>${escape(game.i18n.localize("MYTHRASF.SkillRoll.AffectedBy"))}</span><select name="${name}ActorId">${actorOptions}</select></label><label><span>${escape(game.i18n.localize("MYTHRASF.SkillRoll.AffectingSkill"))}</span><select name="${name}Ability">${affectingOptions}</select></label></div></fieldset>`;
  return DialogV2.wait({
    window: { title: game.i18n.format("MYTHRASF.Contest.ResponseTitle", { actor: actor.name }) },
    content: `<div class="mythras-foundry mythras-dialog contest-response-dialog"><fieldset><legend>${escape(actor.name)}</legend>
      <label><span>${escape(game.i18n.localize("MYTHRASF.Contest.Ability"))}</span><select name="abilityId">${options}</select></label>
      <label><span>${escape(game.i18n.localize("MYTHRASF.SkillRoll.ChosenDifficulty"))}</span><select name="difficulty">${DIFFICULTIES.map((key) => `<option value="${key}" ${key === "standard" ? "selected" : ""}>${escape(game.i18n.localize(`MYTHRASF.Difficulty.${key}`))}</option>`).join("")}</select></label>
    </fieldset>${adjustment("limited", "Limited")}${adjustment("reinforced", "Reinforced")}</div>`,
    buttons: [{ action: "roll", label: game.i18n.localize("MYTHRASF.Roll"), icon: "fas fa-dice-d20", default: true,
      callback: (event, button) => ({ abilityId: button.form.elements.abilityId.value,
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
  dialog.dataset.adjustmentListener = "true";
  dialog.addEventListener("change", (event) => {
    for (const type of ["limited", "reinforced"]) {
      if (event.target.name === `${type}Enabled` || event.target.name === `${type}ActorId`) update(type);
    }
  });
  update("limited"); update("reinforced");
}

function responseAdjustment(form, type) {
  if (!form[`${type}Enabled`].checked) return null;
  const value = form[`${type}Ability`].value;
  return value.startsWith(`${form[`${type}ActorId`].value}:`) ? value : null;
}

function syncAdjustmentSkill(dialog, type, suffix = "Skill") {
  const actorId = dialog.querySelector(`select[name='${type}ActorId']`)?.value;
  const select = dialog.querySelector(`select[name='${type}${suffix}']`);
  if (!select) return;
  Array.from(select.options).forEach((option) => {
    const optionActorId = option.dataset.actorId ?? String(option.value).split(":")[0];
    option.hidden = option.disabled = optionActorId !== actorId;
  });
  if (select.selectedOptions[0]?.disabled) select.value = Array.from(select.options).find((option) => !option.disabled)?.value ?? "";
}

function targetComparison(target, baseTarget) {
  if (target < baseTarget) return "penalty";
  if (target > baseTarget) return "bonus";
  return "neutral";
}
