import { MythrasItemSheet } from "./item-sheet.js";
import { rollHazardCheck, rollHazardDamage } from "../rules/hazard-item-runtime.js";
import { TRAP_DAMAGE_TABLE } from "../rules/hazard-items.js";
import { runSystemRollAction } from "../rules/system-roll.js";

const localize = (key) => game.i18n.localize(`MYTHRASF.Hazard.${key}`);
const profileKeys = ["name", "application", "purpose", "trigger", "resistance",
  "resistanceSkill", "resistanceDifficulty", "onset", "duration", "conditions",
  "cure", "damage", "size", "armorIgnored", "effect", "rearm", "notes"];
const stageKeys = ["name", "variant", "onset", "interval", "conditions", "effect"];
const conditionKeys = ["agony", "exhaustion", "hallucinations", "asphyxiation", "blindness",
  "confusion", "contagion", "bleeding", "draining", "fever", "unconsciousness", "mania",
  "muteness", "death", "mutilation", "nausea", "paralysis", "deafness"];

export function hazardFields(profile, prefix, { trap = false, stage = false, variant = false } = {}) {
  const keys = stage ? stageKeys : profileKeys.filter((key) => key !== "name" || variant);
  return keys.filter((key) => stage || variant || (trap
    ? !["application", "onset", "duration", "cure"].includes(key)
    : !["purpose", "trigger", "damage", "size", "armorIgnored", "rearm"].includes(key)))
    .map((key) => ({ key, path: `${prefix}.${key}`, label: localize(key),
      value: profile[key] ?? "", checkbox: key === "armorIgnored",
      choices: key === "resistanceDifficulty" ? ["veryEasy", "easy", "standard", "hard", "formidable", "herculean"]
        .map((value) => ({ value, label: game.i18n.localize(`MYTHRASF.Difficulty.${value}`) }))
        : key === "resistanceSkill" ? ["aguante", "voluntad", "evadir", "musculo", "atletismo", "percepcion", "mecanismos", "ingenieria"]
          .map((value) => ({ value, label: localize(`Skill.${value}`) })) : null,
      multiline: ["resistance", "conditions", "cure", "effect", "notes"].includes(key) }));
}

export class HazardItemSheet extends MythrasItemSheet {
  static DEFAULT_OPTIONS = {
    position: { width: 760, height: 760 },
    classes: ["mythras-foundry", "mythras-paper-sheet", "item-sheet", "hazard-item-sheet"],
    form: { handler: HazardItemSheet._onSubmitForm, closeOnSubmit: false, submitOnChange: true }
  };

  static PARTS = { main: {
    template: "systems/mythras-foundry/templates/item/hazard-item-sheet.hbs",
    scrollable: [".item-sheet-content"]
  } };

  static async _onSubmitForm(event, form, formData) {
    if (!this.item.isOwner) return;
    const update = foundry.utils.expandObject(formData.object);
    for (const key of ["variants", "stages"]) {
      if (update.system?.[key]) update.system[key] = Object.values(update.system[key]);
    }
    await this.item.update(update);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const trap = this.item.type === "trap";
    return { ...context, isTrap: trap,
      hazardFields: hazardFields(this.item.system, "system", { trap }),
      hazardVariants: this.item.system.variants.map((profile, index) => ({ index,
        fields: hazardFields(profile, `system.variants.${index}`, { trap, variant: true }) })),
      hazardStages: this.item.system.stages.map((stage, index) => ({ index,
        fields: hazardFields(stage, `system.stages.${index}`, { stage: true }) })),
      canRollDamage: [this.item.system, ...this.item.system.variants].some((profile) => profile.damage),
      trapDamageRows: TRAP_DAMAGE_TABLE.map(([minimum, maximum, damage, size]) => ({
        range: `${minimum}-${maximum}%`, damage,
        size: game.i18n.localize(`MYTHRASF.Hazard.Size.${size}`) })),
      conditionRules: conditionKeys.map((key) => ({ name: localize(`Condition.${key}`),
        effect: localize(`ConditionRule.${key}`) }))
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll("[data-hazard-action]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        const action = button.dataset.hazardAction;
        if (button.disabled) return;
        button.disabled = true;
        try {
          const manual = game.mythrasFoundry?.dice?.isManualGesture?.(event) ?? false;
          if (action === "damage") await runSystemRollAction(() => rollHazardDamage(this.item, { manual }));
          else if (["detect", "disarm", "resist"].includes(action)) await runSystemRollAction(() => rollHazardCheck(this.item, action, { manual }));
          else if (this.item.isOwner) {
            const key = button.dataset.collection;
            if (!["variants", "stages"].includes(key)) return;
            const entries = this.item.system[key].map((entry) => foundry.utils.deepClone(entry));
            if (action === "add") {
              entries.push(key === "variants" ? Object.fromEntries(profileKeys.map((field) =>
                [field, field === "name" ? localize("Variant") : this.item.system[field]]))
                : Object.fromEntries(stageKeys.map((field) => [field, field === "name" ? localize("Stage") : ""])));
            } else if (action === "delete") entries.splice(Number(button.dataset.index), 1);
            await this.item.update({ [`system.${key}`]: entries });
          }
        } finally { button.disabled = false; }
      });
    });
  }
}
