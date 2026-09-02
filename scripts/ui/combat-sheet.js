import { difficultyTarget, resolveWeaponStyle,
  UNTRAINED_COMBAT_STYLE_ID } from "../rules/combat.js";
import { weaponHandsRequired } from "../rules/equipment.js";
import { npcWeaponDurability } from "../rules/npc.js";
import { penalizedValue } from "../rules/penalties.js";
import { canActorAttack } from "../rules/statuses.js";
import { findWeaponMode, weaponModeDisplayName, weaponModes,
  weaponModeView } from "../rules/weapon-modes.js";
import { createAttackMessage } from "../rules/combat-chat.js";
import { weaponCanEquip, weaponDurabilityState } from "../rules/weapon-durability.js";

export function prepareCombatStyleViews(styles, difficulty = "standard") {
  return styles.map((item) => {
    const total = Number(item.system.total ?? 0);
    const totalDisplay = penalizedValue(total, difficultyTarget(total, difficulty));
    return {
      item, total, display: totalDisplay, totalDisplay,
      weapons: (item.system.weaponProfiles ?? []).map((profile) => profile.name)
        .filter(Boolean).join(", "),
      traits: (item.system.traitRefs ?? []).map((reference) =>
        reference.name || reference.key).join(", ")
    };
  });
}

export function prepareCombatWeaponView({ actor, weapon, mode, styles,
  resolveDifficulty = (difficulty) => difficulty, hitLocations = [] }) {
  const resolution = resolveWeaponStyle({
    weapon: weaponModeView(weapon, mode), styles,
    selectedStyleId: mode.preferredCombatStyleId, familiarity: mode.familiarity
  });
  resolution.difficulty = resolveDifficulty(resolution.difficulty);
  const candidates = resolution.matching.length ? resolution.matching : styles;
  const effectiveTarget = difficultyTarget(resolution.target, resolution.difficulty);
  const durability = npcWeaponDurability(weapon, hitLocations);
  const durabilityState = weaponDurabilityState(durability);
  return {
    item: weapon, mode, displayName: weaponModeDisplayName(weapon, mode),
    handsRequired: weaponHandsRequired(weapon, mode),
    prepared: Boolean(weaponCanEquip(durability) && weapon.system.equipped
      && weapon.system.activeModeKey === mode.key),
    durabilityState, broken: durabilityState === "broken", damaged: durabilityState === "damaged",
    styleOptions: [
      ...candidates.map((style) => ({ id: style.id, name: style.name,
        selected: style.id === resolution.style?.id })),
      ...(resolution.matching.length === 0 ? [{ id: UNTRAINED_COMBAT_STYLE_ID,
        name: game.i18n.localize("MYTHRASF.Combat.Untrained"),
        selected: resolution.untrained }] : [])
    ],
    hasDirectStyle: resolution.matching.length > 0,
    usesUntrained: resolution.untrained,
    needsStyleChoice: !resolution.style && !resolution.untrained,
    familiarity: resolution.familiarity,
    familiarityOptions: ["similar", "broadlySimilar", "reasonablyDifferent", "substantiallyDifferent"]
      .map((value) => ({ value, selected: value === resolution.familiarity,
        label: game.i18n.localize(`MYTHRASF.Familiarity.${value}`) })),
    difficulty: resolution.difficulty,
    difficultyLabel: game.i18n.localize(`MYTHRASF.Difficulty.${resolution.difficulty}`),
    baseTarget: resolution.target, effectiveTarget,
    hasTargetPenalty: effectiveTarget !== resolution.target,
    canAttack: canActorAttack(actor.statuses) && resolution.difficulty !== "impossible"
      && weaponCanEquip(durability) && weapon.system.equipped
      && weapon.system.activeModeKey === mode.key
      && (Boolean(resolution.style) || resolution.usesBase),
    durabilityDisplay: `${durability.armorPoints} / ${durability.currentHitPoints}–${durability.maxHitPoints}`
  };
}

export function splitCombatWeapons(rows) {
  return {
    meleeCombatWeapons: rows.filter((row) =>
      !["ranged", "siege"].includes(row.mode.weaponType)),
    rangedCombatWeapons: rows.filter((row) =>
      ["ranged", "siege"].includes(row.mode.weaponType)).map((row) => ({ ...row,
        damageModifierLabel: game.i18n.localize(
          `MYTHRASF.Weapon.DamageModifier.${row.mode.damageModifierMode ?? "full"}`)
      }))
  };
}

export function preferAttackChoices(rows = []) {
  return rows.map((row, index) => ({ ...row, preferenceIndex: index }))
    .sort((left, right) => Number(left.weaponType === "shield")
      - Number(right.weaponType === "shield") || left.preferenceIndex - right.preferenceIndex)
    .map(({ preferenceIndex, ...row }) => row);
}

export class CombatSheetController {
  constructor(sheet, { resolveSituationalDifficulty }) {
    this.sheet = sheet;
    this.resolveSituationalDifficulty = resolveSituationalDifficulty;
  }

  get actor() { return this.sheet.actor; }
  get element() { return this.sheet.element; }
  get editable() { return this.sheet.isEditable; }

  bind() {
    this.element.querySelectorAll("[data-combat-style], [data-combat-familiarity]").forEach((field) =>
      field.addEventListener("change", (event) => this.updateWeaponChoice(event)));
    this.element.querySelectorAll("[data-action='roll-weapon-attack']").forEach((button) =>
      button.addEventListener("click", (event) => this.rollWeaponAttack(event)));
    this.element.querySelector("[data-action='choose-weapon-attack']")
      ?.addEventListener("click", (event) => this.chooseWeaponAttack(event));
    const tacticalActions = {
      "change-reach": "changeReach", "declare-passive-block": "declarePassiveBlock",
      "declare-cover": "declareCover", "aim-ranged": "aim", "reload-ranged": "reload"
    };
    for (const [action, method] of Object.entries(tacticalActions)) {
      this.element.querySelector(`[data-action='${action}']`)?.addEventListener("click", (event) =>
        game.mythrasFoundry?.combat?.[method]?.(this.actor, { manual: event.shiftKey }));
    }
    this.element.querySelector("[data-action='tactical-overview']")?.addEventListener("click", () =>
      game.mythrasFoundry?.combat?.openTacticalOverview?.());
  }

  async updateWeaponChoice(event) {
    if (!this.editable) return;
    const row = event.currentTarget.closest("[data-item-id]");
    const weapon = this.actor.items.get(row?.dataset.itemId);
    if (weapon?.type !== "weapon") return;
    const modes = weaponModes(weapon).map((mode) => ({ ...mode }));
    const mode = modes.find((entry) => entry.key === row.dataset.modeKey);
    if (!mode) return;
    if (event.currentTarget.matches("[data-combat-style]")) {
      mode.preferredCombatStyleId = event.currentTarget.value;
    } else mode.familiarity = event.currentTarget.value;
    await weapon.update({ "system.modes": modes });
  }

  async chooseWeaponAttack(event) {
    const manual = Boolean(event?.shiftKey);
    const rows = preferAttackChoices(Array.from(this.element
      .querySelectorAll("[data-action='roll-weapon-attack']"))
      .filter((button) => !button.disabled).map((button, index) => {
        const row = button.closest("[data-item-id]");
        const weapon = this.actor.items.get(row?.dataset.itemId);
        const mode = weapon ? findWeaponMode(weapon, row.dataset.modeKey) : null;
        return { button, index, weaponType: mode?.weaponType,
          label: row?.querySelector("[data-action='edit-item']")?.textContent?.trim() };
      }));
    if (!rows.length) return ui.notifications.warn(
      game.i18n.localize("MYTHRASF.Action.Unavailable.preparedWeapon"));
    const selected = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("MYTHRASF.Combat.Attack") },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${game.i18n.localize("MYTHRASF.Weapon.Name")}</span><select name="attack">${rows.map((row) => `<option value="${row.index}">${foundry.utils.escapeHTML(row.label ?? "")}</option>`).join("")}</select></label></div>`,
      buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.Combat.Attack"),
        callback: (event, button) => Number(button.form.elements.attack.value) },
      { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel") }], rejectClose: false
    });
    rows.find((row) => row.index === selected)?.button.dispatchEvent(new MouseEvent("click", {
      bubbles: true, shiftKey: manual
    }));
  }

  async rollWeaponAttack(event) {
    event.preventDefault();
    const manual = Boolean(event.shiftKey);
    if (!canActorAttack(this.actor.statuses)) return ui.notifications.warn(
      game.i18n.localize("MYTHRASF.Status.CannotAttack"));
    const row = event.currentTarget.closest("[data-item-id]");
    const weapon = this.actor.items.get(row?.dataset.itemId);
    const mode = weapon ? findWeaponMode(weapon, row.dataset.modeKey) : null;
    if (!weapon || !mode || !weaponCanEquip(weapon) || !weapon.system.equipped
      || weapon.system.activeModeKey !== mode.key) {
      return ui.notifications.warn(game.i18n.localize("MYTHRASF.Weapon.ModeNotPrepared"));
    }
    const resolution = resolveWeaponStyle({
      weapon: weaponModeView(weapon, mode),
      styles: this.actor.items.filter((item) => item.type === "combatStyle"),
      selectedStyleId: row.querySelector("[data-combat-style]")?.value,
      familiarity: row.querySelector("[data-combat-familiarity]")?.value ?? mode.familiarity
    });
    resolution.difficulty = await this.resolveSituationalDifficulty(resolution.difficulty, true);
    if (resolution.difficulty === "impossible") return ui.notifications.warn(
      game.i18n.localize("MYTHRASF.Fatigue.NoActivity"));
    if (!resolution.style && !resolution.usesBase) return ui.notifications.warn(
      game.i18n.localize("MYTHRASF.Combat.SelectStyle"));
    const targets = Array.from(game.user.targets ?? []);
    await createAttackMessage({ actor: this.actor, weapon, mode, resolution,
      target: targets.length === 1 ? targets[0] : null, manual });
  }
}
