import { resolveSkillRollTargets } from "../rules/skill-roll.js";

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
    .map((skill) => `<option value="${escape(actor.id)}:${escape(skill.id)}">${escape(actor.name)} — ${escape(skill.name)} (${Number(skill.system.total ?? 0)}%)</option>`))
    .join("");
  const difficultyOptions = DIFFICULTIES.map((key) =>
    `<option value="${key}" ${key === defaultDifficulty ? "selected" : ""}>${escape(game.i18n.localize(`MYTHRASF.Difficulty.${key}`))}</option>`).join("");
  const modifierRows = modifiers.length
    ? modifiers.map(({ source, effect }) => `<div class="skill-roll-modifier"><span>${escape(source)}</span><strong>${escape(effect)}</strong></div>`).join("")
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
  const result = await DialogV2.wait({
    window: { title: game.i18n.format("MYTHRASF.SkillRoll.Title", { skill: item.name }) },
    content: `<div class="mythras-foundry mythras-dialog skill-roll-dialog">
      ${adjustmentPanel("limited")}
      ${adjustmentPanel("reinforced")}
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Skill.Difficulty"))}</legend><select name="difficulty">${difficultyOptions}</select></fieldset>
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.SkillRoll.Modifiers"))}</legend>${modifierRows}</fieldset>
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
