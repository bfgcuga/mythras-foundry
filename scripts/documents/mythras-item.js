import { calculateSkillValues } from "../rules/skills.js";
import { calculatePassionValues } from "../rules/passions.js";
import { woundLevel } from "../rules/hit-locations.js";

export class MythrasItem extends Item {
  prepareDerivedData() {
    super.prepareDerivedData();

    if (this.type === "passion") {
      const values = calculatePassionValues(this.system, this.actor?.system);
      this.system.base = values.base;
      this.system.allocatedBonus = values.bonus;
      this.system.total = values.total;
      this.system.isLegacy = values.legacy;
      return;
    }

    if (this.type === "hitLocation") {
      this.system.woundLevel = woundLevel(
        this.system.currentHitPoints,
        this.system.maxHitPoints
      );
      return;
    }

    if (!["skill", "combatStyle"].includes(this.type)) return;

    this.system.isBasic = ["basic", "standard"].includes(this.system.category);
    this.system.isProfessional = this.system.category === "professional";

    const values = calculateSkillValues(this.system, this.actor?.system);
    this.system.base = values.base;
    this.system.allocatedBonus = values.bonus;
    this.system.total = values.total;
    this.system.experienceImprovementBonus = values.experienceImprovementBonus;
  }

  async rollSkill({ difficulty = "standard" } = {}) {
    if (!["skill", "combatStyle"].includes(this.type)) return;

    const multipliers = {
      automatic: null,
      veryEasy: 2,
      easy: 1.5,
      standard: 1,
      hard: 2 / 3,
      formidable: 0.5,
      herculean: 0.2,
      impossible: null
    };
    if (difficulty === "automatic") {
      ui.notifications.info(game.i18n.localize("MYTHRASF.RollResult.automatic"));
      return;
    }
    if (difficulty === "impossible") {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.RollResult.impossible"));
      return;
    }

    const multiplier = multipliers[difficulty] ?? 1;
    const baseTarget = Number(this.system.total);
    const target = Math.max(0, Math.ceil(baseTarget * multiplier));
    const criticalTarget = Math.max(
      1,
      Math.floor(Math.ceil(baseTarget / 10) * multiplier)
    );
    const roll = await new Roll("1d100").evaluate();
    const result = classifyRoll(roll.total, target, criticalTarget);

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `
        <strong>${foundry.utils.escapeHTML(this.name)}</strong>
        — ${game.i18n.localize(`MYTHRASF.Difficulty.${difficulty}`)}
        <span class="penalized-value">${baseTarget}%${target !== baseTarget
          ? ` <span class="penalized-value-modifier">(${target}%)</span>` : ""}</span>:
        ${game.i18n.localize(`MYTHRASF.RollResult.${result}`)}
      `
    });

    if (result === "fumble" && !this.system.fumbled) {
      await this.update({ "system.fumbled": true });
    }
  }

  async rollPassion() {
    if (this.type !== "passion") return;
    const target = Math.max(0, Number(this.system.total ?? 0));
    const criticalTarget = Math.max(1, Math.ceil(target / 10));
    const roll = await new Roll("1d100").evaluate();
    const result = classifyRoll(roll.total, target, criticalTarget);
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<strong>${foundry.utils.escapeHTML(this.name)}</strong> (${target}%): ${
        game.i18n.localize(`MYTHRASF.RollResult.${result}`)
      }`
    });
  }
}

export function classifyRoll(value, target, criticalTarget) {
  if (value <= criticalTarget) return "critical";
  if (value <= 5 || (value <= target && value <= 95)) return "success";
  if (value === 100 || (target <= 100 && value === 99)) return "fumble";
  return "failure";
}
