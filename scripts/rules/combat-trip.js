import { difficultyTarget } from "./combat.js";

const DIFFICULTIES = ["automatic", "veryEasy", "easy", "standard", "hard",
  "formidable", "herculean", "impossible"];

export function tripResistanceChoices(actor, biped = true, baseDifficulty = "standard") {
  const slugs = ["musculo", "evadir", "acrobacias", ...(biped ? [] : ["atletismo"])];
  const index = Math.max(0, DIFFICULTIES.indexOf(baseDifficulty));
  const difficulty = DIFFICULTIES[Math.max(0, index - (biped ? 0 : 1))];
  return (actor.items ?? []).filter((item) => item.type === "skill" && slugs.includes(item.system.slug))
    .map((ability) => ({ ability, name: ability.name, baseTarget: Number(ability.system.total ?? 0),
      target: difficultyTarget(ability.system.total, difficulty), difficulty,
      steps: biped ? 0 : -1, biped }));
}

export async function chooseTripResistance(actor, baseDifficulty, { Dialog, localize, escape }) {
  const options = (biped) => tripResistanceChoices(actor, biped, baseDifficulty);
  const optionHtml = (choices) => choices.map((choice) =>
    `<option value="${escape(choice.ability.id)}">${escape(choice.name)} (${choice.target}%)</option>`).join("");
  return Dialog.wait({
    window: { title: localize("MYTHRASF.Combat.CheckChooseAbility") },
    content: `<div class="mythras-foundry mythras-dialog"><fieldset><legend>${escape(localize(
      "MYTHRASF.Combat.CheckTest"))}</legend><label><span>${escape(localize(
      "MYTHRASF.Combat.Trip.Biped"))}</span><select name="biped"><option value="yes" selected>${escape(
      localize("MYTHRASF.Yes"))}</option><option value="no">${escape(localize("MYTHRASF.No"))}</option></select></label>
      <label><span>${escape(localize("MYTHRASF.Combat.CheckAbility"))}</span><select name="ability">${optionHtml(options(true))}</select></label>
      <p>${escape(localize("MYTHRASF.Combat.Trip.Help"))}</p>
      <div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Difficulty"))}</span><output name="difficulty"></output></div>
      <div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.CheckAbility"))}</span><output name="target" class="penalized-value"></output></div>
      </fieldset></div>`,
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form");
      const refreshTarget = () => {
        const choice = options(form.elements.biped.value !== "no").find((entry) =>
          entry.ability.id === form.elements.ability.value);
        form.elements.target.innerHTML = choice ? `${choice.baseTarget}%${choice.target !== choice.baseTarget
          ? ` <span class="skill-roll-modifier-effect--${choice.target > choice.baseTarget ? "bonus" : "penalty"}">(${choice.target}%)</span>` : ""}` : "—";
      };
      const refresh = () => {
        const choices = options(form.elements.biped.value !== "no");
        const previous = form.elements.ability.value;
        form.elements.ability.innerHTML = optionHtml(choices);
        if (choices.some((choice) => choice.ability.id === previous)) form.elements.ability.value = previous;
        form.elements.difficulty.textContent = choices.length
          ? localize(`MYTHRASF.Difficulty.${choices[0].difficulty}`) : "—";
        form.querySelector('[data-action="roll"]').disabled = !choices.length;
        refreshTarget();
      };
      form.elements.ability.addEventListener("change", refreshTarget);
      form.elements.biped.addEventListener("change", refresh);
      refresh();
    },
    buttons: [{ action: "roll", icon: "fas fa-dice-d20", label: localize("MYTHRASF.Roll"),
      default: true, callback: (event, button) => options(button.form.elements.biped.value !== "no")
        .find((choice) => choice.ability.id === button.form.elements.ability.value) ?? null },
    { action: "cancel", icon: "fas fa-times", label: localize("MYTHRASF.Cancel"), callback: () => null }],
    rejectClose: false
  });
}
