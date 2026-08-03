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
    const ranges = rollThresholdRanges(target, criticalTarget);

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      rolls: [roll],
      content: `
        <section class="mythras-chat-card">
          <div class="mythras-chat-title">${foundry.utils.escapeHTML(this.name)}</div>
          <div class="mythras-chat-details">
            <div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.Difficulty")}</span><strong>${game.i18n.localize(`MYTHRASF.Difficulty.${difficulty}`)}</strong></div>
            <div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.BaseTarget")}</span><strong>${baseTarget}%</strong></div>
            ${target !== baseTarget ? `<div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.EffectiveTarget")}</span><strong class="penalized-value-modifier">${target}%</strong></div>` : ""}
            <div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.SkillRoll")} (1d100)</span><strong class="mythras-chat-roll-value">${roll.total}</strong></div>
          </div>
          ${renderRollResult(result, ranges)}
        </section>
      `
    };
    ChatMessage.applyRollMode?.(messageData, game.settings.get("core", "rollMode"));
    await ChatMessage.create(messageData);

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
    const ranges = rollThresholdRanges(target, criticalTarget);
    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      rolls: [roll],
      content: `<section class="mythras-chat-card">
        <div class="mythras-chat-title">${foundry.utils.escapeHTML(this.name)}</div>
        <div class="mythras-chat-details">
          <div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.Target")}</span><strong>${target}%</strong></div>
          <div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.PassionRoll")} (1d100)</span><strong class="mythras-chat-roll-value">${roll.total}</strong></div>
        </div>
        ${renderRollResult(result, ranges)}
      </section>`
    };
    ChatMessage.applyRollMode?.(messageData, game.settings.get("core", "rollMode"));
    await ChatMessage.create(messageData);
  }
}

export function classifyRoll(value, target, criticalTarget) {
  if (value <= criticalTarget) return "critical";
  if (value <= 5 || (value <= target && value <= 95)) return "success";
  if (value === 100 || (target <= 100 && value === 99)) return "fumble";
  return "failure";
}

export function rollThresholdRanges(target, criticalTarget) {
  const criticalMaximum = Math.max(1, Math.min(100, Number(criticalTarget) || 1));
  return {
    critical: `01–${formatD100(criticalMaximum)}`,
    fumble: Number(target) <= 100 ? "99–00" : "00"
  };
}

export function renderRollResult(result, ranges) {
  return `<div class="mythras-chat-result-block">
    <div class="mythras-chat-total mythras-chat-result mythras-chat-result--${result}">
      <span>${game.i18n.localize("MYTHRASF.Chat.Result")}</span>
      <strong>${game.i18n.localize(`MYTHRASF.RollResult.${result}`)}</strong>
    </div>
    <div class="mythras-chat-roll-legend">
      <span>${game.i18n.localize("MYTHRASF.Chat.CriticalRange")}: <strong>${ranges.critical}</strong></span>
      <span>${game.i18n.localize("MYTHRASF.Chat.FumbleRange")}: <strong>${ranges.fumble}</strong></span>
    </div>
  </div>`;
}

function formatD100(value) {
  return value >= 100 ? "00" : String(Math.trunc(value)).padStart(2, "0");
}
