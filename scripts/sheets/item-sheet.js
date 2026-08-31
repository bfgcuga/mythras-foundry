const { ItemSheetV2 } = foundry.applications.sheets;
const { DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { ImagePopout } = foundry.applications.apps;
import {
  PASSION_OBJECT_TYPES,
  PASSION_VERBS,
  calculatePassionBase
} from "../rules/passions.js";
import { normalizeWeaponProfile, parseWeaponProfileReferences } from "../rules/combat.js";
import { modeKeysAreUnique, nextModeKey, normalizeModeKey, weaponModes } from "../rules/weapon-modes.js";
import { manualWeaponProfiles, mergeWeaponProfiles, removeWeaponProfile, weaponProfileOptions } from "../rules/combat-style-weapons.js";
import { armorDefaultName } from "../data/armor.js";
import { ARMOR_MATERIAL_MODIFIERS, ARMOR_REFERENCE_LOCATIONS, armorPieceTypeForLocation,
  armorLocationForReference, armorPhysicalTotals } from "../rules/armor.js";
import { inventoryCarried } from "../rules/inventory.js";
import { TRAIT_TYPES, mergeTraitReferences, removeTraitReference, traitReference,
  traitSlug } from "../rules/traits.js";
import { canonicalCombatEffectStage, COMBAT_EFFECT_ROLL_RESTRICTIONS,
  COMBAT_EFFECT_RULE_KEYS, COMBAT_EFFECT_STAGES,
  COMBAT_EFFECT_WEAPON_RESTRICTIONS } from "../rules/combat-effects.js";

async function prepareTraitReferences(references = []) {
  return Promise.all(references.map(async (reference, referenceIndex) => {
    let document = null;
    try { document = reference.uuid ? await fromUuid(reference.uuid) : null; } catch { /* broken UUID */ }
    if (!document && reference.key) {
      document = game.items.find((item) => item.type === "trait"
        && traitSlug(item.system.key || item.name) === traitSlug(reference.key)) ?? null;
    }
    if (!document && reference.key) {
      for (const pack of game.packs.filter((candidate) => candidate.documentName === "Item")) {
        if (!pack.visible) continue;
        const index = await pack.getIndex({ fields: ["type", "system.key"] });
        const entry = index.find((candidate) => candidate.type === "trait"
          && traitSlug(candidate.system?.key || candidate.name) === traitSlug(reference.key));
        if (entry) {
          document = await pack.getDocument(entry._id);
          break;
        }
      }
    }
    return {
      ...reference,
      referenceIndex,
      parameters: (reference.parameters ?? []).map((parameter, parameterIndex) => ({
        ...parameter,
        parameterIndex,
        hideLabel: parameter.key === "locations",
        label: parameter.key === "locations"
          ? game.i18n.localize("MYTHRASF.Trait.Parameter.Locations") : parameter.key
      })),
      uuid: document?.uuid || reference.uuid,
      name: document?.name || reference.name || reference.key,
      img: document?.img || "icons/svg/aura.svg",
      description: document?.system?.description || "",
      source: document?.system?.source || "",
      traitType: document?.system?.traitType || "",
      requiresAllGroupMembers: Boolean(document?.system?.requiresAllGroupMembers),
      broken: !document
    };
  }));
}

export class MythrasItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["mythras-foundry", "mythras-paper-sheet", "item-sheet"],
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
    if (["equipment", "weapon", "armor"].includes(this.item.type)
      && update.system?.parentContainerId !== undefined && this.item.actor) {
      const preview = { id: this.item.id, type: this.item.type,
        system: { ...this.item.system, ...update.system } };
      const inventory = this.item.actor.items.filter((candidate) =>
        ["equipment", "weapon", "armor"].includes(candidate.type))
        .map((candidate) => candidate.id === this.item.id ? preview : candidate);
      if (!inventoryCarried(preview, inventory)) update.system.equipped = false;
    }
    if (this.item.type === "trait") {
      update.system.key = traitSlug(update.system?.key || update.name || this.item.name);
    }
    if (this.item.type === "weapon") {
      update.system.profileKey = normalizeWeaponProfile(
        update.system?.profileKey || update.name || this.item.name
      );
      if (update.system?.modes) {
        const currentModes = weaponModes(this.item);
        update.system.modes = Object.values(update.system.modes).map((submitted, index) => {
          const mode = foundry.utils.mergeObject(
            foundry.utils.deepClone(currentModes[index] ?? {}), submitted, { inplace: false }
          );
          const hands = Math.max(0, Math.min(2, Number(mode.handsRequired ?? 1)));
          return { ...mode,
            key: normalizeModeKey(mode.key || mode.weaponType),
            profileKey: mode.profileKey ? normalizeWeaponProfile(mode.profileKey) : "",
            grip: hands === 2 ? "2 manos" : hands === 1 ? "1 mano" : "" };
        });
        if (!modeKeysAreUnique(update.system.modes)) {
          return ui.notifications.error(game.i18n.localize("MYTHRASF.Weapon.DuplicateModeKey"));
        }
        if (!update.system.modes.some((mode) => mode.key === update.system.activeModeKey)) {
          update.system.activeModeKey = update.system.modes[0].key;
        }
      }
    }
    if (this.item.type === "armor") {
      const referenceLocation = update.system?.referenceLocation
        || this.item.system.referenceLocation || "special";
      const profileName = update.system?.profileName || this.item.system.profileName
        || update.name || this.item.name;
      const oldDefaultName = armorDefaultName(
        this.item.system.referenceLocation || "special",
        this.item.system.profileName || this.item.name);
      if (!String(update.name ?? "").trim() || update.name === oldDefaultName) {
        update.name = armorDefaultName(referenceLocation, profileName);
      }
      update.system.profileKey = normalizeWeaponProfile(
        update.system?.profileKey || this.item.system.profileKey || update.name || this.item.name
      );
      update.system.profileName = profileName;
      update.system.pieceType = armorPieceTypeForLocation(referenceLocation);
      if (this.item.actor) {
        const locations = this.item.actor.items.filter((candidate) => candidate.type === "hitLocation");
        if (referenceLocation === "special") {
          if (this.item.system.referenceLocation !== "special") update.system.coveredLocationIds = [];
        } else {
          const location = armorLocationForReference(referenceLocation, locations);
          update.system.coveredLocationIds = location ? [location.id] : [];
        }
        update.system.equipped = false;
      }
      const material = update.system?.material || this.item.system.material || "leather";
      update.system.materialModifier = ARMOR_MATERIAL_MODIFIERS[material] ?? 1;
      update.system.coverageMigrated = true;
    }
    if (this.item.type === "passion" && update.system?.structured) {
      if (!this.item.system.structured) {
        const base = calculatePassionBase(
          update.system.objectType,
          this.item.actor?.system,
          update.system.targetCharisma
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
    const armorLocations = this.item.type === "armor" && this.item.actor
      ? this.item.actor.items.filter((candidate) => candidate.type === "hitLocation") : [];
    const selectedArmorLocations = new Set(this.item.system.coveredLocationIds ?? []);
    const armorTotals = this.item.type === "armor"
      ? armorPhysicalTotals(this.item, armorLocations) : null;
    const combatStyleTraitReferences = this.item.type === "combatStyle"
      ? await prepareTraitReferences(this.item.system.traitRefs ?? []) : [];
    const weaponTraitReferences = this.item.type === "weapon"
      ? await prepareTraitReferences(this.item.system.traitRefs ?? []) : [];
    const weaponStyles = this.item.type === "weapon" && this.item.actor
      ? this.item.actor.items.filter((candidate) => candidate.type === "combatStyle") : [];
    const preparedWeaponModes = this.item.type === "weapon"
      ? await Promise.all(weaponModes(this.item).map(async (weaponMode, modeIndex) => ({
        ...weaponMode, modeIndex,
        displayName: game.i18n.localize(`MYTHRASF.Weapon.Type.${weaponMode.weaponType}`),
        isRanged: weaponMode.weaponType === "ranged",
        isSiege: weaponMode.weaponType === "siege",
        isMelee: weaponMode.weaponType === "melee",
        isShield: weaponMode.weaponType === "shield",
        usesRange: ["ranged", "siege"].includes(weaponMode.weaponType),
        combatStyleChoices: weaponStyles.map((style) => ({ id: style.id, name: style.name })),
        traitReferences: await prepareTraitReferences(weaponMode.traitRefs ?? []) }))) : [];
    return foundry.utils.mergeObject(context, {
      item: this.item,
      editable: this.isEditable,
      creationMode: Boolean(this.creationMode),
      isSkill: this.item.type === "skill",
      isSkillLike: ["skill", "combatStyle"].includes(this.item.type),
      isCombatStyle: this.item.type === "combatStyle",
      isBackground: ["culture", "profession"].includes(this.item.type),
      isCulture: this.item.type === "culture",
      isPassion: this.item.type === "passion",
      isCustomPassionVerb: this.item.type === "passion" && this.item.system.verb === "other",
      isPersonPassion: this.item.type === "passion" && this.item.system.objectType === "person",
      isEquipment: ["equipment", "weapon", "armor"].includes(this.item.type),
      currencyChoices: ["copper", "silver", "gold"].map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Currency.${value}`) })),
      equipmentCategoryChoices: ["item", "service", "vehicle", "livestock", "container",
        "property", "clothing", "food", "ammunition"].map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.ItemClass.${value}`) })),
      equipmentContainerChoices: ["equipment", "weapon", "armor"].includes(this.item.type)
        && this.item.actor
        ? this.item.actor.items.filter((candidate) => candidate.type === "equipment"
          && candidate.id !== this.item.id && candidate.system.isContainer)
          .map((candidate) => ({ value: candidate.id, label: candidate.name })) : [],
      isWeapon: this.item.type === "weapon",
      weaponModes: preparedWeaponModes,
      weaponTraitReferences,
      isArmor: this.item.type === "armor",
      armorLocations: armorLocations.map((location) => ({
        id: location.id,
        name: location.name,
        encumbranceMultiplier: location.system.armorEncumbranceMultiplier,
        costPercentage: location.system.armorCostPercentage,
        selected: selectedArmorLocations.has(location.id)
      })),
      armorSelectedLocationId: Array.from(selectedArmorLocations)[0] ?? "",
      isSpecialArmor: this.item.type === "armor"
        && this.item.system.referenceLocation === "special",
      armorAssignedLocationName: armorLocations.find((location) =>
        selectedArmorLocations.has(location.id))?.name ?? "",
      armorPieceTypeLabel: this.item.type === "armor"
        ? game.i18n.localize(`MYTHRASF.Armor.Piece.Type.${this.item.system.pieceType}`) : "",
      armorTotals,
      isHitLocation: this.item.type === "hitLocation",
      isTrait: this.item.type === "trait",
      isCombatEffect: this.item.type === "combatEffect",
      combatEffectWeaponRestriction: this.item.system.weaponRestriction,
      combatEffectRollRestriction: this.item.system.rollRestriction,
      combatEffectStage: canonicalCombatEffectStage(this.item.system.stage),
      combatEffectWeaponRestrictionChoices: COMBAT_EFFECT_WEAPON_RESTRICTIONS.map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.CombatEffect.WeaponRestrictionChoice.${value || "none"}`)
      })),
      combatEffectRollRestrictionChoices: COMBAT_EFFECT_ROLL_RESTRICTIONS.map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.CombatEffect.RollRestrictionChoice.${value || "none"}`)
      })),
      combatEffectRuleChoices: COMBAT_EFFECT_RULE_KEYS.map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.CombatEffect.Rule.${value}`) })),
      combatEffectStageChoices: COMBAT_EFFECT_STAGES.map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.CombatEffect.Stage.${value}`) })),
      traitTypeChoices: TRAIT_TYPES.map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Trait.Type.${value}`) })),
      weaponLocationChoices: this.item.type === "weapon" && this.item.actor
        ? this.item.actor.items.filter((candidate) => candidate.type === "hitLocation")
          .map((location) => ({ value: location.id, label: location.name })) : [],
      weaponDurabilityHelp: this.item.type === "weapon"
        ? game.i18n.format(this.item.actor
          ? "MYTHRASF.Weapon.Durability.NaturalHelpActor"
          : "MYTHRASF.Weapon.Durability.NaturalHelpTemplate", {
          actor: this.item.actor?.name ?? ""
        }) : "",
      skillValueModeChoices: ["derived", "manual"].map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.Skill.ValueMode.${value}`)
      })),
      weaponDurabilityChoices: ["independent", "hitLocation"].map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.Weapon.Durability.${value}`)
      })),
      combatStyleWeaponProfiles: this.item.type === "combatStyle"
        ? (this.item.system.weaponProfiles ?? []) : [],
      combatStyleTraitReferences,
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
      weaponTypeChoices: ["melee", "ranged", "shield", "siege"].map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.Weapon.Type.${value}`)
      })),
      damageModifierChoices: ["full", "half", "none"].map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.Weapon.DamageModifier.${value}`)
      })),
      familiarityChoices: ["similar", "broadlySimilar", "reasonablyDifferent",
        "substantiallyDifferent"].map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Familiarity.${value}`) })),
      armorEraChoices: ["all", "ancient-medieval", "ancient-renaissance",
        "medieval-industrial", "ancient", "modern", "futuristic"].map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.Armor.Era.${value}`)
      })),
      armorPieceTypeChoices: ["helmet", "cuirass", "skirt", "greaves", "bracers", "other"].map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.Armor.Piece.Type.${value}`)
      })),
      armorReferenceLocationChoices: ARMOR_REFERENCE_LOCATIONS.map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.Armor.ReferenceLocation.${value}`)
      })),
      armorMaterialChoices: Object.keys(ARMOR_MATERIAL_MODIFIERS).map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.Armor.Material.${value}`)
      })),
      armorConstructionChoices: ["flexible", "rigid"].map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.Armor.Construction.${value}`)
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

    if (this.item.type === "weapon" && !this._weaponDefaultSizeApplied) {
      this._weaponDefaultSizeApplied = true;
      this.setPosition({ width: 960, height: 560 });
    }

    if (this.item.type === "combatEffect" && !this._combatEffectDefaultSizeApplied) {
      this._combatEffectDefaultSizeApplied = true;
      this.setPosition({ width: 740, height: 640 });
    }

    this.element.querySelector("[data-action='view-item-image']")
      ?.addEventListener("click", () => this.#viewItemImage());

    this._activeWeaponTab ??= "characteristics";
    this.element.classList.toggle("item-creation-mode", Boolean(this.creationMode));
    this.element.querySelectorAll("[data-weapon-tab]").forEach((button) =>
      button.addEventListener("click", (event) => this.#activateWeaponTab(event)));
    this.#showWeaponTab(this._activeWeaponTab);
    this._activeCombatStyleTab ??= "description";
    this.element.querySelectorAll("[data-combat-style-tab]").forEach((button) =>
      button.addEventListener("click", (event) => this.#activateCombatStyleTab(event)));
    this.#showCombatStyleTab(this._activeCombatStyleTab);
    this._activeArmorTab ??= "characteristics";
    this.element.querySelectorAll("[data-armor-tab]").forEach((button) =>
      button.addEventListener("click", (event) => this.#activateArmorTab(event)));
    this.#showArmorTab(this._activeArmorTab);

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
    this.element.querySelectorAll("[data-action='select-weapon-trait']").forEach((button) =>
      button.addEventListener("click", (event) => this.#selectWeaponTrait(event)));
    this.element.querySelectorAll("[data-action='delete-weapon-trait']").forEach((button) =>
      button.addEventListener("click", (event) => this.#deleteWeaponTrait(event)));
    this.element.querySelectorAll("[data-action='open-weapon-trait']").forEach((button) =>
      button.addEventListener("click", (event) => this.#openWeaponTrait(event)));
    this.element.querySelectorAll("[data-weapon-mode-type]").forEach((field) =>
      field.addEventListener("change", () => field.closest("form")?.requestSubmit()));
    this.element.querySelector("[data-action='add-combat-style-profile']")
      ?.addEventListener("click", (event) => {
        event.preventDefault();
        this.#addManualCombatStyleProfiles().catch((error) => this.#notifyProfileError(error));
      });
    this.element.querySelector("[data-combat-style-profile-input]")
      ?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          this.#addManualCombatStyleProfiles().catch((error) => this.#notifyProfileError(error));
        }
      });
    this.element.querySelectorAll("[data-action='delete-combat-style-profile']").forEach((button) =>
      button.addEventListener("click", (event) => this.#deleteCombatStyleProfile(event)));
    this.element.querySelector("[data-action='select-combat-style-weapon']")
      ?.addEventListener("click", () => this.#selectCombatStyleWeapon());
    this.element.querySelector("[data-action='select-combat-style-trait']")
      ?.addEventListener("click", () => this.#selectCombatStyleTrait());
    this.element.querySelector("[data-action='create-combat-style-trait']")
      ?.addEventListener("click", () => this.#createCombatStyleTrait());
    this.element.querySelectorAll("[data-action='delete-combat-style-trait']").forEach((button) =>
      button.addEventListener("click", (event) => this.#deleteCombatStyleTrait(event)));
    this.element.querySelectorAll("[data-action='open-combat-style-trait']").forEach((button) =>
      button.addEventListener("click", (event) => this.#openCombatStyleTrait(event)));
    this.element.querySelectorAll("[data-armor-location-id]").forEach((field) =>
      field.addEventListener("change", (event) => this.#updateArmorCoverage(event)));
    const dropZone = this.element.querySelector("[data-combat-style-weapon-drop]");
    dropZone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      dropZone.classList.add("drag-over");
    });
    dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone?.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.remove("drag-over");
      this.#handleCombatStyleWeaponDrop(event).catch((error) => this.#notifyProfileError(error));
    });
    const traitDropZone = this.element.querySelector("[data-combat-style-trait-drop]");
    traitDropZone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      traitDropZone.classList.add("drag-over");
    });
    traitDropZone?.addEventListener("dragleave", () => traitDropZone.classList.remove("drag-over"));
    traitDropZone?.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      traitDropZone.classList.remove("drag-over");
      this.#handleCombatStyleTraitDrop(event);
    });
  }

  #activateWeaponTab(event) {
    event.preventDefault();
    this._activeWeaponTab = event.currentTarget.dataset.weaponTab;
    this.#showWeaponTab(this._activeWeaponTab);
  }

  #showWeaponTab(tab) {
    this.element.querySelectorAll("[data-weapon-tab]").forEach((button) =>
      button.classList.toggle("active", button.dataset.weaponTab === tab));
    this.element.querySelectorAll("[data-weapon-tab-content]").forEach((panel) =>
      panel.classList.toggle("active", panel.dataset.weaponTabContent === tab));
  }

  #activateCombatStyleTab(event) {
    event.preventDefault();
    this._activeCombatStyleTab = event.currentTarget.dataset.combatStyleTab;
    this.#showCombatStyleTab(this._activeCombatStyleTab);
  }

  #showCombatStyleTab(tab) {
    this.element.querySelectorAll("[data-combat-style-tab]").forEach((button) =>
      button.classList.toggle("active", button.dataset.combatStyleTab === tab));
    this.element.querySelectorAll("[data-combat-style-tab-content]").forEach((panel) =>
      panel.classList.toggle("active", panel.dataset.combatStyleTabContent === tab));
  }

  #activateArmorTab(event) {
    event.preventDefault();
    this._activeArmorTab = event.currentTarget.dataset.armorTab;
    this.#showArmorTab(this._activeArmorTab);
  }

  #showArmorTab(tab) {
    this.element.querySelectorAll("[data-armor-tab]").forEach((button) =>
      button.classList.toggle("active", button.dataset.armorTab === tab));
    this.element.querySelectorAll("[data-armor-tab-content]").forEach((panel) =>
      panel.classList.toggle("active", panel.dataset.armorTabContent === tab));
  }

  async #updateArmorCoverage(event) {
    if (!this.isEditable || this.item.type !== "armor") return;
    const id = event.currentTarget.value;
    await this.item.update({
      "system.coveredLocationIds": id ? [id] : [],
      "system.coverageMigrated": true,
      "system.equipped": false
    });
  }

  async _onDropDocument(event, document) {
    if (this.item.type !== "combatStyle") return super._onDropDocument(event, document);
    if (!this.isEditable) return null;
    if (event.target?.closest?.(".combat-style-traits-editor")) return this.#addDroppedTrait(document);
    if (!event.target?.closest?.(".combat-style-weapons-editor")) return null;
    if (document?.documentName !== "Item" || document.type !== "weapon") {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.CombatStyle.DropWeaponOnly"));
      return null;
    }
    return this.#addDroppedWeapon(document);
  }

  async #handleCombatStyleWeaponDrop(event) {
    if (!this.isEditable || this.item.type !== "combatStyle") return null;
    const data = foundry.applications.ux.TextEditor.getDragEventData(event);
    if (!data?.type) return null;
    const document = await Item.implementation.fromDropData(data);
    return this.#addDroppedWeapon(document);
  }

  async #handleCombatStyleTraitDrop(event) {
    if (!this.isEditable || this.item.type !== "combatStyle") return null;
    const data = foundry.applications.ux.TextEditor.getDragEventData(event);
    if (!data?.type) return null;
    const document = await Item.implementation.fromDropData(data);
    return this.#addDroppedTrait(document);
  }

  async #addDroppedTrait(document) {
    if (document?.documentName !== "Item" || document.type !== "trait"
      || document.system.traitType !== "combatStyle") {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.CombatStyle.DropTraitOnly"));
      return null;
    }
    const result = mergeTraitReferences(this.item.system.traitRefs,
      [traitReference(document)]);
    if (!result.added) {
      ui.notifications.info(game.i18n.localize("MYTHRASF.CombatStyle.TraitAlreadyIncluded"));
      return null;
    }
    await this.item.update({ "system.traitRefs": result.references });
    return document;
  }

  async #catalogItemOptions(type, traitType = "") {
    const options = game.items.filter((item) => item.type === type
      && (!traitType || item.system.traitType === traitType))
      .map((item) => ({ uuid: item.uuid, name: item.name }));
    for (const pack of game.packs.filter((candidate) => candidate.documentName === "Item")) {
      if (!pack.visible) continue;
      const index = await pack.getIndex({ fields: ["type", "system.traitType"] });
      for (const entry of index) {
        if (entry.type !== type || (traitType && entry.system?.traitType !== traitType)) continue;
        options.push({ uuid: entry.uuid || `Compendium.${pack.collection}.${entry._id}`,
          name: entry.name });
      }
    }
    return [...new Map(options.map((option) => [option.uuid, option])).values()]
      .sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang));
  }

  async #chooseCatalogItem(type, traitType, titleKey) {
    const options = await this.#catalogItemOptions(type, traitType);
    if (!options.length) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.CombatStyle.NoSelectableItems"));
      return null;
    }
    const escape = foundry.utils.escapeHTML;
    const labels = new Map(options.map((option) => [`${option.name} — ${option.uuid}`, option.uuid]));
    const result = await DialogV2.input({
      window: { title: game.i18n.localize(titleKey) },
      content: `<div class="mythras-foundry combat-style-catalog-dialog"><label>${game.i18n.localize("MYTHRASF.Catalog.Search")}
        <input class="sheet-field-editable" name="catalogItem" list="combat-style-catalog-items" autocomplete="off"></label>
        <datalist id="combat-style-catalog-items">${[...labels.keys()].map((label) =>
          `<option value="${escape(label)}"></option>`).join("")}</datalist></div>`,
      ok: { label: game.i18n.localize("MYTHRASF.Add"), icon: "fas fa-plus",
        callback: (event, button) => labels.get(button.form.elements.catalogItem.value) ?? null }
    });
    return result ? fromUuid(result) : null;
  }

  async #selectCombatStyleWeapon() {
    const document = await this.#chooseCatalogItem("weapon", "",
      "MYTHRASF.CombatStyle.SelectWeapon");
    if (document) await this.#addDroppedWeapon(document);
  }

  async #selectCombatStyleTrait() {
    const document = await this.#chooseCatalogItem("trait", "combatStyle",
      "MYTHRASF.CombatStyle.SelectTrait");
    if (document) await this.#addDroppedTrait(document);
  }

  async #createCombatStyleTrait() {
    if (!game.user.can("ITEM_CREATE")) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.CombatStyle.CannotCreateTrait"));
      return;
    }
    const name = await DialogV2.input({
      window: { title: game.i18n.localize("MYTHRASF.CombatStyle.CreateTrait") },
      content: `<div class="mythras-foundry"><label>${game.i18n.localize("MYTHRASF.Item.Name")}<input class="sheet-field-editable" name="name" required></label></div>`,
      ok: { label: game.i18n.localize("MYTHRASF.Add"), icon: "fas fa-plus",
        callback: (event, button) => button.form.elements.name.value.trim() }
    });
    if (!name) return;
    const document = await Item.create({ name, type: "trait", img: "icons/svg/aura.svg",
      system: { key: traitSlug(name), source: "", traitType: "combatStyle",
        requiresAllGroupMembers: false, ruleKey: "", ruleParameters: [], description: "" } });
    if (!document) return;
    await this.#addDroppedTrait(document);
    document.sheet?.render(true);
  }

  async #deleteCombatStyleTrait(event) {
    const identity = event.currentTarget.dataset.traitKey || event.currentTarget.dataset.traitUuid;
    await this.item.update({ "system.traitRefs": removeTraitReference(
      this.item.system.traitRefs, identity) });
  }

  async #openCombatStyleTrait(event) {
    const uuid = event.currentTarget.dataset.traitUuid;
    const document = uuid ? await fromUuid(uuid) : null;
    if (!document) return ui.notifications.warn(
      game.i18n.localize("MYTHRASF.CombatStyle.BrokenTraitReference"));
    document.sheet?.render(true);
  }

  async #selectWeaponTrait(event) {
    const document = await this.#chooseCatalogItem("trait", "weapon",
      "MYTHRASF.Weapon.SelectTrait");
    if (!document) return;
    const reference = traitReference(document,
      traitSlug(document.system.key || document.name) === "bloqueo-pasivo"
        ? [{ key: "locations", value: "1" }] : []);
    const index = event.currentTarget.dataset.modeIndex;
    if (index === undefined) {
      const result = mergeTraitReferences(this.item.system.traitRefs, [reference]);
      if (result.added) await this.item.update({ "system.traitRefs": result.references });
      return;
    }
    const modes = weaponModes(this.item).map((mode) => ({ ...mode }));
    const result = mergeTraitReferences(modes[Number(index)].traitRefs, [reference]);
    if (!result.added) return;
    modes[Number(index)].traitRefs = result.references;
    await this.item.update({ "system.modes": modes });
  }

  async #deleteWeaponTrait(event) {
    const identity = event.currentTarget.dataset.traitKey || event.currentTarget.dataset.traitUuid;
    const index = event.currentTarget.dataset.modeIndex;
    if (index === undefined) {
      await this.item.update({ "system.traitRefs": removeTraitReference(
        this.item.system.traitRefs, identity) });
      return;
    }
    const modes = weaponModes(this.item).map((mode) => ({ ...mode }));
    modes[Number(index)].traitRefs = removeTraitReference(modes[Number(index)].traitRefs, identity);
    await this.item.update({ "system.modes": modes });
  }

  async #openWeaponTrait(event) {
    return this.#openCombatStyleTrait(event);
  }

  #viewItemImage() {
    new ImagePopout({
      src: this.item.img,
      uuid: this.item.uuid,
      window: { title: this.item.name }
    }).render(true);
  }

  async #addDroppedWeapon(document) {
    if (document?.documentName !== "Item" || document.type !== "weapon") {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.CombatStyle.DropWeaponOnly"));
      return null;
    }
    const options = weaponProfileOptions(document);
    if (!options.length) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.CombatStyle.WeaponWithoutProfile"));
      return null;
    }
    const selected = options.length === 1 ? options : await this.#selectWeaponProfiles(options);
    if (!selected?.length) return null;
    await this.#addCombatStyleProfiles(selected);
    return document;
  }

  #notifyProfileError(error) {
    console.error("Mythras Foundry | Error updating combat style weapon profiles", error);
    ui.notifications.error(game.i18n.localize("MYTHRASF.CombatStyle.ProfileUpdateFailed"));
  }

  async #selectWeaponProfiles(options) {
    const escape = foundry.utils.escapeHTML;
    return DialogV2.input({
      window: { title: game.i18n.localize("MYTHRASF.CombatStyle.SelectWeaponProfiles") },
      content: `<fieldset class="mythras-foundry"><legend>${game.i18n.localize("MYTHRASF.CombatStyle.Weapons")}</legend>
        <div class="combat-style-profile-dialog">${options.map((profile) => `<label>
          <input type="checkbox" class="sheet-state-box" name="profiles" value="${escape(profile.key)}" checked>
          <span>${escape(profile.name)}</span></label>`).join("")}</div></fieldset>`,
      ok: { label: game.i18n.localize("MYTHRASF.Add"), icon: "fas fa-plus",
        callback: (dialogEvent, button) => {
          const keys = new Set(new FormData(button.form).getAll("profiles"));
          return options.filter((profile) => keys.has(profile.key));
        } }
    });
  }

  async #addCombatStyleProfiles(incoming) {
    const result = mergeWeaponProfiles(this.item.system.weaponProfiles, incoming);
    if (!result.added) {
      ui.notifications.info(game.i18n.localize("MYTHRASF.CombatStyle.ProfilesAlreadyIncluded"));
      return;
    }
    await this.item.update({ "system.weaponProfiles": result.profiles });
    if (result.duplicates) ui.notifications.info(
      game.i18n.localize("MYTHRASF.CombatStyle.SomeProfilesAlreadyIncluded"));
  }

  async #addManualCombatStyleProfiles() {
    if (!this.isEditable || this.item.type !== "combatStyle") return;
    const input = this.element.querySelector("[data-combat-style-profile-input]");
    const profiles = manualWeaponProfiles(input?.value);
    if (!profiles.length) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.CombatStyle.EnterWeaponProfile"));
      return;
    }
    await this.#addCombatStyleProfiles(profiles);
    input.value = "";
  }

  async #deleteCombatStyleProfile(event) {
    if (!this.isEditable || this.item.type !== "combatStyle") return;
    const key = event.currentTarget.dataset.profileKey;
    const profiles = removeWeaponProfile(this.item.system.weaponProfiles, key);
    await this.item.update({ "system.weaponProfiles": profiles });
  }

  async #addWeaponMode() {
    if (!this.isEditable) return;
    const modes = weaponModes(this.item).map((mode) => ({ ...mode }));
    const key = nextModeKey(modes);
    modes.push({ key, name: "", profileKey: "",
      weaponType: "melee", damage: "", damageModifierMode: "full", size: "", reach: "",
      effects: "", traits: "", traitRefs: [], grip: "1 mano", handsRequired: 1, range: "", reload: "",
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
