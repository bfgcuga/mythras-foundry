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
  const result = await DialogV2.wait({
    window: { title: game.i18n.format("MYTHRASF.SkillRoll.Title", { skill: item.name }) },
    content: `<div class="mythras-foundry skill-roll-dialog">
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.SkillRoll.Adjustment"))}</legend>
        <label><span>${escape(game.i18n.localize("MYTHRASF.SkillRoll.Type"))}</span><select name="adjustmentMode">
          <option value="none">${escape(game.i18n.localize("MYTHRASF.SkillRoll.None"))}</option>
          <option value="limited">${escape(game.i18n.localize("MYTHRASF.SkillRoll.Limited"))}</option>
          <option value="reinforced">${escape(game.i18n.localize("MYTHRASF.SkillRoll.Reinforced"))}</option>
        </select></label>
        <label class="skill-roll-support-field"><span>${escape(game.i18n.localize("MYTHRASF.SkillRoll.Who"))}</span><select name="supportActorId">${actorOptions}</select></label>
        <label class="skill-roll-support-field"><span>${escape(game.i18n.localize("MYTHRASF.SkillRoll.SupportingSkill"))}</span><select name="supportSkill">${skillOptions}</select></label>
      </fieldset>
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Skill.Difficulty"))}</legend><select name="difficulty">${difficultyOptions}</select></fieldset>
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.SkillRoll.Modifiers"))}</legend>${modifierRows}</fieldset>
    </div>`,
    buttons: [{ action: "roll", label: game.i18n.localize("MYTHRASF.Roll"), icon: "fas fa-dice-d20", default: true,
      callback: (event, button) => {
        const form = button.form.elements;
        const mode = form.adjustmentMode.value;
        const [actorId, skillId] = String(form.supportSkill.value).split(":");
        if (mode !== "none" && (actorId !== form.supportActorId.value || !skillId)) {
          ui.notifications.warn(game.i18n.localize("MYTHRASF.SkillRoll.SupportMismatch"));
          return null;
        }
        const support = mode === "none" ? null : game.actors.get(actorId)?.items.get(skillId);
        return { mode, difficulty: form.difficulty.value, support };
      }
    }, { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), icon: "fas fa-times" }],
    rejectClose: false
  });
  if (!result) return null;
  return { ...result, targets: resolveSkillRollTargets({
    baseTarget: item.system.total, difficulty: result.difficulty, imposedDifficulty,
    adjustmentMode: result.mode, supportingTarget: result.support?.system.total
  }) };
}
