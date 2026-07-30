export class MythrasItem extends Item {
  prepareDerivedData() {
    super.prepareDerivedData();

    if (this.type !== "skill") return;

    this.system.isStandard = this.system.category === "standard";
    this.system.isProfessional = this.system.category === "professional";

    const actor = this.actor;
    if (!actor) {
      this.system.total = this.system.bonus;
      return;
    }

    const first = Number(actor.system[this.system.characteristic1] ?? 0);
    const second = Number(actor.system[this.system.characteristic2] ?? 0);
    this.system.total = first + second + Number(this.system.bonus ?? 0);
  }

  async rollSkill({ difficulty = "standard" } = {}) {
    if (this.type !== "skill") return;

    const multipliers = {
      veryEasy: 2,
      easy: 1.5,
      standard: 1,
      hard: 2 / 3,
      formidable: 0.5,
      herculean: 0.1,
      hopeless: 0
    };
    const multiplier = multipliers[difficulty] ?? 1;
    const target = Math.max(0, Math.floor(this.system.total * multiplier));
    const roll = await new Roll("1d100").evaluate();
    const result = classifyRoll(roll.total, target);

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `
        <strong>${foundry.utils.escapeHTML(this.name)}</strong>
        — ${game.i18n.localize(`MYTHRASF.Difficulty.${difficulty}`)}
        (${target}%): ${game.i18n.localize(`MYTHRASF.RollResult.${result}`)}
      `
    });
  }
}

function classifyRoll(value, target) {
  if (value === 1 || (value <= target && value <= Math.ceil(target / 10))) {
    return "critical";
  }
  if (value <= target) return "success";
  if (value === 100 || (value > target && value >= 96)) return "fumble";
  return "failure";
}
