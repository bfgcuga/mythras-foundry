const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
import {
  PASSION_OBJECT_TYPES,
  PASSION_VERBS,
  calculatePassionBase
} from "../rules/passions.js";
import { normalizeWeaponProfile, parseWeaponProfileReferences } from "../rules/combat.js";
import { modeKeysAreUnique, nextModeKey, normalizeModeKey, weaponModes } from "../rules/weapon-modes.js";

export class MythrasItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["mythras-foundry", "item-sheet"],
    tag: "form",
    window: {
      resizable: true
    },
    position: {
      width: 520,
      height: 560
    },
    form: {
      handler: MythrasItemSheet._onSubmitForm,
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/mythras-foundry/templates/item/item-sheet.hbs",
      scrollable: [".item-sheet-content"]
    }
  };

  static async _onSubmitForm(event, form, formData) {
    const update = foundry.utils.expandObject(formData.object);
    if (this.item.type === "combatStyle" && update.system?.weapons !== undefined) {
      update.system.weaponProfiles = parseWeaponProfileReferences(update.system.weapons);
    }
    if (this.item.type === "weapon") {
      update.system.profileKey = normalizeWeaponProfile(
        update.system?.profileKey || update.name || this.item.name
      );
      if (update.system?.modes) {
        update.system.modes = Object.values(update.system.modes).map((mode) => ({ ...mode,
          key: normalizeModeKey(mode.key), profileKey: mode.profileKey
            ? normalizeWeaponProfile(mode.profileKey) : "" }));
        if (!modeKeysAreUnique(update.system.modes)) {
          return ui.notifications.error(game.i18n.localize("MYTHRASF.Weapon.DuplicateModeKey"));
        }
        if (!update.system.modes.some((mode) => mode.key === update.system.activeModeKey)) {
          update.system.activeModeKey = update.system.modes[0].key;
        }
      }
    }
    if (this.item.type === "passion" && update.system?.structured) {
      if (!this.item.system.structured) {
        const base = calculatePassionBase(
          update.system.objectType,
          this.item.actor?.system
        );
        update.system.manualAdjustment = Number(this.item.system.value ?? 0)
          - base
          - Number(update.system.creationBonus ?? 0)
          - Number(update.system.experiencePoints ?? 0);
      }
      const verb = update.system.verb === "other"
        ? update.system.customVerb.trim()
        : game.i18n.localize(`MYTHRASF.Passion.Verb.${update.system.verb}`);
      const object = update.system.objectDescription.trim();
      if (verb && object) update.name = `${verb} (${object})`;
    }
    await this.item.update(update);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return foundry.utils.mergeObject(context, {
      item: this.item,
      editable: this.isEditable,
      isSkill: this.item.type === "skill",
      isSkillLike: ["skill", "combatStyle"].includes(this.item.type),
      isCombatStyle: this.item.type === "combatStyle",
      isBackground: ["culture", "profession"].includes(this.item.type),
      isPassion: this.item.type === "passion",
      isCustomPassionVerb: this.item.type === "passion" && this.item.system.verb === "other",
      isEquipment: ["equipment", "weapon", "armor"].includes(this.item.type),
      isWeapon: this.item.type === "weapon",
      weaponModes: this.item.type === "weapon" ? weaponModes(this.item) : [],
      isArmor: this.item.type === "armor",
      isHitLocation: this.item.type === "hitLocation",
      combatStyleWeaponNames: this.item.type === "combatStyle"
        ? (this.item.system.weaponProfiles ?? []).map((profile) => profile.name).join(", ")
          || this.item.system.weapons
        : "",
      groupChoices: [
        ["", "MYTHRASF.Skill.GroupAutomatic"],
        ["basic", "MYTHRASF.Skill.GroupBasic"],
        ["professional", "MYTHRASF.Skill.GroupProfessional"],
        ["resistance", "MYTHRASF.Skill.GroupResistance"],
        ["magic", "MYTHRASF.Skill.GroupMagic"],
        ["language", "MYTHRASF.Skill.GroupLanguage"],
        ["combat", "MYTHRASF.Skill.GroupCombat"]
      ].map(([value, key]) => ({
        value,
        label: game.i18n.localize(key)
      })),
      characteristicChoices: [
        "strength",
        "constitution",
        "size",
        "dexterity",
        "intelligence",
        "power",
        "charisma"
      ].map((value) => ({
        value,
        label: game.i18n.localize(`MYTHRASF.Characteristic.${value}`)
      })),
      passionVerbChoices: PASSION_VERBS.map((value) => ({
        value,
        label: game.i18n.localize(`MYTHRASF.Passion.Verb.${value}`)
      })),
      passionObjectChoices: PASSION_OBJECT_TYPES.map((value) => ({
        value,
        label: game.i18n.localize(`MYTHRASF.Passion.Object.${value}`)
      })),
      weaponTypeChoices: ["melee", "ranged", "shield"].map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.Weapon.Type.${value}`)
      })),
      damageModifierChoices: ["full", "half", "none"].map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.Weapon.DamageModifier.${value}`)
      })),
      armorEraChoices: ["ancient", "modern", "futuristic"].map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.Armor.Era.${value}`)
      })),
      locationCategoryChoices: ["limb", "head", "chest", "abdomen", "other"].map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.HitLocation.Category.${value}`)
      })),
      locationHpClassChoices: ["arm", "standard", "abdomen", "chest"].map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.HitLocation.HpClass.${value}`)
      }))
    }, { inplace: false });
  }

  _onRender(context, options) {
    super._onRender(context, options);

    if (!this.isEditable) {
      this.element.querySelectorAll("input[name], textarea[name], select[name]")
        .forEach((field) => { field.disabled = true; });
    }
    this.element.querySelector("[data-action='add-weapon-mode']")
      ?.addEventListener("click", () => this.#addWeaponMode());
    this.element.querySelectorAll("[data-action='delete-weapon-mode']").forEach((button) =>
      button.addEventListener("click", (event) => this.#deleteWeaponMode(event)));
    this.element.querySelectorAll("[data-action='move-weapon-mode']").forEach((button) =>
      button.addEventListener("click", (event) => this.#moveWeaponMode(event)));
  }

  async #addWeaponMode() {
    if (!this.isEditable) return;
    const modes = weaponModes(this.item).map((mode) => ({ ...mode }));
    const key = nextModeKey(modes);
    modes.push({ key, name: "", profileKey: "",
      weaponType: "melee", damage: "", damageModifierMode: "full", size: "", reach: "",
      effects: "", grip: "1 mano", handsRequired: 1, range: "", reload: "",
      preferredCombatStyleId: "", familiarity: "similar" });
    await this.item.update({ "system.modes": modes });
  }

  async #deleteWeaponMode(event) {
    const modes = weaponModes(this.item).map((mode) => ({ ...mode }));
    if (modes.length <= 1) return ui.notifications.warn(
      game.i18n.localize("MYTHRASF.Weapon.KeepOneMode"));
    const index = Number(event.currentTarget.dataset.modeIndex);
    modes.splice(index, 1);
    const active = modes.some((mode) => mode.key === this.item.system.activeModeKey)
      ? this.item.system.activeModeKey : modes[0].key;
    await this.item.update({ "system.modes": modes, "system.activeModeKey": active });
  }

  async #moveWeaponMode(event) {
    const modes = weaponModes(this.item).map((mode) => ({ ...mode }));
    const index = Number(event.currentTarget.dataset.modeIndex);
    const target = index + Number(event.currentTarget.dataset.direction);
    if (target < 0 || target >= modes.length) return;
    [modes[index], modes[target]] = [modes[target], modes[index]];
    await this.item.update({ "system.modes": modes });
  }
}
