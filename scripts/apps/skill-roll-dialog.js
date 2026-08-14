import { resolveSkillRollTargets } from "../rules/skill-roll.js";
import { combineDifficulties } from "../rules/fatigue.js";

const DIFFICULTIES = ["automatic", "veryEasy", "easy", "standard", "hard",
  "formidable", "herculean", "impossible"];

function escape(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

export async function openSkillRollDialog(item, { imposedDifficulty = "standard",
  defaultDifficulty = "standard", modifiers = [] } = {}) {
  const { DialogV2 } = foundry.applications.api;
  const actors = game.actors.filter((actor) => actor.testUserPermission(game.user, "OBSERVER"));
  const actorOptions = actors.map((actor) =>
    `<option value="${escape(actor.id)}">${escape(actor.name)}</option>`).join("");
  const skillOptions = actors.flatMap((actor) => actor.items
    .filter((candidate) => ["skill", "combatStyle"].includes(candidate.type))
    .map((skill) => `<option value="${escape(actor.id)}:${escape(skill.id)}" data-target="${Number(skill.system.total ?? 0)}">${escape(actor.name)} — ${escape(skill.name)} (${Number(skill.system.total ?? 0)}%)</option>`))
    .join("");
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
        return { difficulty: form.difficulty.value, limitedSkill, reinforcedSkill };
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
  dialog.addEventListener("change", update);
  update();
}

function targetComparison(target, baseTarget) {
  if (target < baseTarget) return "penalty";
  if (target > baseTarget) return "bonus";
  return "neutral";
}
