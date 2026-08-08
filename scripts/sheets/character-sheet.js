import { CHARACTERISTIC_KEYS, calculateDerivedAttributes } from "../rules/derived-attributes.js";
import {
  CULTURES,
  getCulture,
  getProfession,
  professionAvailableToCulture,
  professionsForCulture
} from "../data/backgrounds.js";
import { BASIC_SKILL_SOURCES } from "../data/basic-skills.js";
import { PROFESSIONAL_SKILL_SOURCES } from "../data/professional-skills.js";
import { ALL_SKILL_SOURCES } from "../data/skills.js";
import { calculateStartingMoney, getSocialClass, resolveSocialClass,
  socialClassesForCulture, STARTING_MONEY_BY_CULTURE } from "../data/social-classes.js";
import { defaultItemIcon } from "../data/item-icons.js";
import {
  BACKGROUND_BUDGETS,
  AGE_CATEGORIES,
  allocationRemaining as backgroundAllocationRemaining,
  createBackgroundDraft,
  freeSkillNeedsSpecialization,
  getAllAcquiredAbilities,
  getAgeCategory,
  getFreeAbilities,
  getPhaseAbilities,
  parseBackgroundDraft,
  serializeBackgroundDraft,
  setAllocation,
  skillAbilityKey,
  styleAbilityKey,
  validateAgeSelection,
  validateBackgroundSelection,
  validateFreePhase,
  validateSocialClassSelection
} from "../rules/background-generation.js";
import {
  CHARACTERISTIC_MINIMUMS,
  adjustPointAllocation,
  calculateAllocationRemaining,
  canSwapCharacteristics,
  createMinimumAllocation
} from "../rules/character-generation.js";
import { calculateResourceValue } from "../rules/resources.js";
import { PASSION_OBJECT_TYPES, PASSION_VERBS } from "../rules/passions.js";
import { difficultyTarget, resolveWeaponStyle } from "../rules/combat.js";
import { createAttackMessage } from "../rules/combat-chat.js";
import { assessWeaponEquip, weaponHandsRequired } from "../rules/equipment.js";
import { findWeaponMode, weaponModeDisplayName, weaponModes, weaponModeView } from "../rules/weapon-modes.js";
import { armorCoverageLocations, armorEquipConflicts, armorPhysicalTotals,
  totalArmorPoints, wornArmorPoints } from "../rules/armor.js";
import { applyFatigue, combinedConditionLevel, combineDifficulties, fatigueLevel,
  FATIGUE_LEVELS, worsenDifficulty } from "../rules/fatigue.js";
import { hasSeriousWound, worstWoundLevel,
  woundPenaltyKey } from "../rules/hit-locations.js";
import { penalizedResource, penalizedValue } from "../rules/penalties.js";
import { nextNumberedItemName } from "../rules/item-names.js";
import {
  NEW_SKILL_EXPERIENCE_COST,
  resolveExperienceImprovement,
  skillAcquisition
} from "../rules/skills.js";
import { getActionPointRules, getCultureAllocationRules,
  getProfessionAllocationRules, getSocialClassMethod,
  SOCIAL_CLASS_METHODS } from "../settings.js";

const { ActorSheetV2 } = foundry.applications.sheets;
const { DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { FilePicker, ImagePopout } = foundry.applications.apps;

const SKILL_GROUP_LABELS = {
  basic: "MYTHRASF.Skill.GroupBasic",
  professional: "MYTHRASF.Skill.GroupProfessional",
  resistance: "MYTHRASF.Skill.GroupResistance",
  magic: "MYTHRASF.Skill.GroupMagic",
  language: "MYTHRASF.Skill.GroupLanguage",
  combat: "MYTHRASF.Skill.GroupCombat"
};

const BASIC_SKILLS_BY_SLUG = new Map(
  BASIC_SKILL_SOURCES.map((source) => [source.system.slug, source])
);
const PROFESSIONAL_SKILLS_BY_SLUG = new Map(
  PROFESSIONAL_SKILL_SOURCES.map((source) => [source.system.slug, source])
);
const SKILLS_BY_SLUG = new Map(
  ALL_SKILL_SOURCES.map((source) => [source.system.slug, source])
);
const SKILL_NAMES = new Map([
  ...ALL_SKILL_SOURCES
].map((source) => [source.system.slug, source.name]));
const CORE_BASIC_SLUGS = BASIC_SKILL_SOURCES
  .map((source) => source.system.slug)
  .filter((slug) => slug !== "estilo-de-combate");

export class CharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["mythras-foundry", "actor-sheet", "character-sheet"],
    tag: "form",
    window: {
      resizable: true
    },
    position: {
      width: 960,
      height: 760
    },
    form: {
      handler: CharacterSheet._onSubmitForm,
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/mythras-foundry/templates/actor/character-sheet.hbs",
      scrollable: [".sheet-body"]
    }
  };

  static async _onSubmitForm(event, form, formData) {
    await this.actor.update(formData.object);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const items = [...this.actor.items];
    const skills = items.filter((item) => ["skill", "combatStyle"].includes(item.type));
    const canImproveSkills = this.isEditable
      && Number(this.actor.system.experienceRolls ?? 0) > 0;
    const combatStyles = items.filter((item) => item.type === "combatStyle");
    const hitLocations = items.filter((item) => item.type === "hitLocation")
      .sort((left, right) => left.system.rangeStart - right.system.rangeStart);
    const equipment = items.filter((item) => item.type === "equipment");
    const weapons = items.filter((item) => item.type === "weapon");
    const armor = items.filter((item) => item.type === "armor");
    const equippedArmor = armor.filter((item) => item.system.equipped);
    const currentFatigue = fatigueLevel(this.actor.system.fatigueLevel);
    const currentWound = worstWoundLevel(hitLocations);
    const currentCondition = combinedConditionLevel(currentFatigue.key, currentWound);
    const baseAttributes = this.actor.system.baseAttributes
      ?? calculateDerivedAttributes(this.actor.system, getActionPointRules());
    const effectiveAttributes = applyFatigue(baseAttributes, currentCondition.key);
    const actionPointsDisplay = penalizedResource(
      this.actor.system.resources.actionPoints.value,
      baseAttributes.actionPointsMax,
      effectiveAttributes.actionPointsMax
    );
    const combatWeapons = weapons.flatMap((weapon) => weaponModes(weapon)
      .map((mode) => this.#prepareCombatWeapon(weapon, mode, combatStyles)));
    const characteristicRows = CHARACTERISTIC_KEYS.map((key) => ({
      key,
      label: game.i18n.localize(`MYTHRASF.Characteristic.${key}`),
      value: this.actor.system[key],
      swapChoices: CHARACTERISTIC_KEYS
        .filter((candidate) => canSwapCharacteristics(key, candidate))
        .map((candidate) => ({
          key: candidate,
          label: game.i18n.localize(`MYTHRASF.Characteristic.${candidate}`)
        }))
    }));
    const characteristicsGenerated = this.actor.system.characteristicsGenerated;
    const generationMethod = this.actor.system.generationMethod;
    const generationMethods = ["random", "randomSwap", "points"].map((key) => ({
      key,
      label: game.i18n.localize(`MYTHRASF.Character.Method.${key}`),
      active: generationMethod === key
    }));
    const backgroundWizard = this.actor.system.characteristicsGenerated
      && this.actor.system.backgroundCreationEnabled
      && !this.actor.system.backgroundComplete
      ? this.#prepareBackgroundWizard()
      : null;
    const backgroundDraft = backgroundWizard
      ? parseBackgroundDraft(this.actor.system.backgroundDraft)
      : null;
    const skillGroups = Object.entries(SKILL_GROUP_LABELS).map(([key, label]) => ({
      key,
      label,
      isCombat: key === "combat",
      creationMode: Boolean(backgroundWizard),
      creationPhaseLabel: backgroundDraft
        ? game.i18n.localize(`MYTHRASF.Background.PhasePoints.${
          backgroundDraft.stage === "review" ? "free" : backgroundDraft.stage
        }`)
        : "",
      skills: skills
        .filter((item) => (item.system.group || item.system.category) === key)
        .map((item) => this.#prepareSkillRow(item, backgroundDraft))
    }));
    const basicSkillGroup = skillGroups.find((group) => group.key === "basic");
    const combatSkillGroup = skillGroups.find((group) => group.key === "combat");
    const secondarySkillGroups = skillGroups.filter((group) => (
      !["basic", "combat"].includes(group.key)
    ));
    return foundry.utils.mergeObject(context, {
      actor: this.actor,
      editable: this.isEditable,
      characteristicRows,
      editMode: Boolean(this._editMode),
      headerStatus: {
        actionPoints: actionPointsDisplay,
        magicPoints: `${this.actor.system.resources.magicPoints.value}/${this.actor.system.attributes.magicPointsMax}`,
        luckPoints: `${this.actor.system.resources.luckPoints.value}/${this.actor.system.attributes.luckPointsMax}`,
        fatigue: game.i18n.localize(`MYTHRASF.Fatigue.Level.${currentFatigue.key}`),
        fatigueKey: currentFatigue.key,
        wound: game.i18n.localize(`MYTHRASF.Wound.${currentWound}`),
        woundKey: currentWound,
        woundPenalty: game.i18n.localize(
          `MYTHRASF.Header.WoundPenalty.${woundPenaltyKey(currentWound)}`),
        fatiguePenalty: currentFatigue.skillDifficulty === "standard"
          ? game.i18n.localize("MYTHRASF.Fatigue.NoPenalty")
          : game.i18n.localize(`MYTHRASF.Difficulty.${currentFatigue.skillDifficulty}`),
        encumbrance: "",
        encumbrancePenalty: ""
      },
      attributePenalties: {
        actionPoints: actionPointsDisplay,
        initiative: penalizedValue(baseAttributes.initiative, effectiveAttributes.initiative),
        movement: penalizedValue(baseAttributes.movementRate, effectiveAttributes.movementRate)
      },
      generationMethod,
      generationMethods,
      isPointAllocation: !characteristicsGenerated && generationMethod === "points",
      allocationRemaining: calculateAllocationRemaining(this.actor.system),
      showCharacteristicAdjustments: this.isEditable && (
        (!characteristicsGenerated && generationMethod === "points")
        || (characteristicsGenerated && this._editMode)
      ),
      showCharacteristicSwaps: this.isEditable
        && !characteristicsGenerated
        && generationMethod === "randomSwap",
      backgroundWizard,
      skillGroups,
      canImproveSkills,
      basicSkillGroup,
      combatSkillGroup,
      secondarySkillGroups,
      passions: items.filter((item) => item.type === "passion"),
      equipment,
      weapons: weapons.map((item) => ({ item,
        hasMultipleModes: weaponModes(item).length > 1,
        modeOptions: weaponModes(item).map((mode) => ({ ...mode,
          displayName: weaponModeDisplayName(item, mode) })),
        activeModeKey: findWeaponMode(item)?.key ?? "",
        handsRequired: weaponHandsRequired(item) })),
      armor,
      hitLocations,
      combatHitLocations: hitLocations.map((item) => ({
        item,
        naturalArmor: Number(item.system.armorPoints ?? 0),
        wornArmor: wornArmorPoints(item, equippedArmor),
        totalArmor: totalArmorPoints(item, equippedArmor),
        armorOptions: armor.filter((piece) =>
          (piece.system.coveredLocationIds ?? []).includes(item.id))
          .map((piece) => ({ value: piece.id, label: piece.name })),
        equippedArmorId: equippedArmor.find((piece) =>
          (piece.system.coveredLocationIds ?? []).includes(item.id))?.id ?? "",
        showDisabledControl: item.system.woundLevel === "serious",
        disabled: item.system.woundLevel === "major" || Boolean(item.system.disabled)
      })),
      combatStyles: combatStyles.map((style) => ({
        item: style,
        weapons: (style.system.weaponProfiles ?? [])
          .map((profile) => profile.name)
          .filter(Boolean)
          .join(", ") || style.system.weapons,
        traits: style.system.traits,
        total: Number(style.system.total ?? 0),
        totalDisplay: penalizedValue(
          Number(style.system.total ?? 0),
          difficultyTarget(Number(style.system.total ?? 0), currentCondition.skillDifficulty)
        )
      })),
      inventoryArmor: armor.map((item) => this.#prepareArmor(item, hitLocations)),
      fatigueRows: FATIGUE_LEVELS.map((level) => ({ ...level,
        selected: level.key === this.actor.system.fatigueLevel,
        levelLabel: game.i18n.localize(`MYTHRASF.Fatigue.Level.${level.key}`),
        skillLabel: level.key === "fresh" ? game.i18n.localize("MYTHRASF.Fatigue.NoPenalty")
          : game.i18n.localize(`MYTHRASF.Difficulty.${level.skillDifficulty}`),
        movementLabel: game.i18n.localize(`MYTHRASF.Fatigue.MovementValue.${level.movement}`),
        initiativeLabel: level.skillDifficulty === "impossible" ? game.i18n.localize("MYTHRASF.Fatigue.NoActivity") : level.initiativePenalty ? `-${level.initiativePenalty}` : "—",
        actionPointLabel: level.skillDifficulty === "impossible" ? game.i18n.localize("MYTHRASF.Fatigue.NoActivity") : level.actionPointPenalty ? `-${level.actionPointPenalty}` : "—",
        recoveryLabel: game.i18n.localize(`MYTHRASF.Fatigue.RecoveryValue.${level.recovery}`)
      })),
      combatWeapons,
      meleeCombatWeapons: combatWeapons.filter((row) => row.mode.weaponType !== "ranged"),
      rangedCombatWeapons: combatWeapons.filter((row) => row.mode.weaponType === "ranged")
        .map((row) => ({ ...row,
          damageModifierLabel: game.i18n.localize(
            `MYTHRASF.Weapon.DamageModifier.${row.mode.damageModifierMode ?? "full"}`) })),
      familiarityChoices: ["similar", "broadlySimilar", "reasonablyDifferent", "substantiallyDifferent"]
        .map((value) => ({ value, label: game.i18n.localize(`MYTHRASF.Familiarity.${value}`) }))
    }, { inplace: false });
  }

  #prepareCombatWeapon(weapon, mode, combatStyles) {
    const modeWeapon = weaponModeView(weapon, mode);
    const resolution = resolveWeaponStyle({
      weapon: modeWeapon,
      styles: combatStyles,
      selectedStyleId: mode.preferredCombatStyleId,
      familiarity: mode.familiarity
    });
    resolution.difficulty = combineDifficulties(resolution.difficulty,
      this.#conditionLevel().skillDifficulty);
    const candidates = resolution.matching.length ? resolution.matching : combatStyles;
    const effectiveTarget = difficultyTarget(resolution.target, resolution.difficulty);
    return {
      item: weapon,
      mode,
      displayName: weaponModeDisplayName(weapon, mode),
      handsRequired: weaponHandsRequired(weapon, mode),
      prepared: Boolean(weapon.system.equipped && weapon.system.activeModeKey === mode.key),
      styleOptions: candidates.map((style) => ({
        id: style.id,
        name: style.name,
        selected: style.id === resolution.style?.id
      })),
      hasDirectStyle: resolution.matching.length > 0,
      needsStyleChoice: !resolution.style,
      familiarity: resolution.familiarity,
      familiarityOptions: ["similar", "broadlySimilar", "reasonablyDifferent", "substantiallyDifferent"]
        .map((value) => ({ value, selected: value === resolution.familiarity,
          label: game.i18n.localize(`MYTHRASF.Familiarity.${value}`) })),
      difficulty: resolution.difficulty,
      difficultyLabel: game.i18n.localize(`MYTHRASF.Difficulty.${resolution.difficulty}`),
      baseTarget: resolution.target,
      effectiveTarget,
      hasTargetPenalty: effectiveTarget !== resolution.target,
      canAttack: resolution.difficulty !== "impossible" && weapon.system.equipped && weapon.system.activeModeKey === mode.key
        && (Boolean(resolution.style) || resolution.usesBase)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    if (!this.isEditable) {
      this.element.querySelectorAll(
        "input[name], textarea[name], select[name], [data-skill-field], "
        + "[data-passion-field], [data-resource-action], [data-combat-style], "
        + "[data-combat-familiarity]"
      )
        .forEach((field) => { field.disabled = true; });
    }

    this.element.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", (event) => this.#activateTab(event));
    });
    this.#showTab(this._activeTab ?? "character");
    this.element.querySelector("[data-action='confirm-characteristics']")
      ?.addEventListener("click", () => this.#confirmCharacteristics());
    this.element.querySelectorAll("[data-generation-method]").forEach((button) => {
      button.addEventListener("click", (event) => this.#selectGenerationMethod(event));
    });
    this.element.querySelector("[data-action='toggle-edit-mode']")
      ?.addEventListener("click", () => this.#toggleEditMode());
    this.element.querySelector("[data-action='train-skill']")
      ?.addEventListener("click", () => this.#showTrainingPlaceholder());
    this.element.querySelector("[data-action='choose-portrait']")
      ?.addEventListener("click", () => this.#choosePortrait());
    this.element.querySelector("[data-action='view-portrait']")
      ?.addEventListener("click", () => this.#viewPortrait());
    this.element.querySelectorAll("[data-action='adjust-characteristic']").forEach((button) => {
      button.addEventListener("click", (event) => this.#adjustCharacteristic(event));
    });
    this.element.querySelectorAll("[data-swap-characteristic]").forEach((select) => {
      select.addEventListener("change", (event) => this.#swapCharacteristic(event));
    });
    this.element.querySelectorAll("[data-background-select]").forEach((select) => {
      select.addEventListener("change", (event) => this.#selectBackground(event));
    });
    this.element.querySelectorAll("[data-background-choice]").forEach((field) => {
      field.addEventListener("change", (event) => this.#toggleBackgroundChoice(event));
    });
    this.element.querySelectorAll("[data-background-professional]").forEach((field) => {
      field.addEventListener("change", (event) => this.#toggleBackgroundProfessional(event));
    });
    this.element.querySelectorAll("[data-background-specialization]").forEach((field) => {
      field.addEventListener("change", (event) => this.#updateBackgroundSpecialization(event));
    });
    this.element.querySelectorAll("[data-background-style-field]").forEach((field) => {
      field.addEventListener("change", (event) => this.#updateBackgroundStyle(event));
    });
    this.element.querySelectorAll("[data-background-style-action]").forEach((button) => {
      button.addEventListener("click", (event) => this.#changeBackgroundStyles(event));
    });
    this.element.querySelectorAll("[data-background-free-field]").forEach((field) => {
      field.addEventListener("change", (event) => this.#updateFreeSkill(event));
    });
    this.element.querySelectorAll("[data-background-age-field]").forEach((field) => {
      field.addEventListener("change", (event) => this.#updateBackgroundAge(event));
    });
    this.element.querySelector("[data-background-social-class]")
      ?.addEventListener("change", (event) => this.#selectSocialClass(event));
    this.element.querySelector("[data-action='roll-social-class']")
      ?.addEventListener("click", (event) => this.#rollSocialClass(event));
    this.element.querySelectorAll("[data-background-points]").forEach((field) => {
      field.addEventListener("change", (event) => this.#updateBackgroundPoints(event));
    });
    this.element.querySelectorAll("[data-background-points-action]").forEach((button) => {
      button.addEventListener("click", (event) => this.#adjustBackgroundPoints(event));
    });
    this.element.querySelectorAll("[data-background-navigation]").forEach((button) => {
      button.addEventListener("click", (event) => this.#navigateBackground(event));
    });
    this.element.querySelector("[data-action='confirm-background']")
      ?.addEventListener("click", () => this.#confirmBackground());
    this.element.querySelectorAll("[data-action='create-item']").forEach((button) => {
      button.addEventListener("click", (event) => this.#createItem(event));
    });
    this.element.querySelectorAll("[data-action='edit-item']").forEach((button) => {
      button.addEventListener("click", (event) => this.#editItem(event));
    });
    this.element.querySelectorAll("[data-action='delete-item']").forEach((button) => {
      button.addEventListener("click", (event) => this.#deleteItem(event));
    });
    this.element.querySelectorAll("[data-action='toggle-equipped']").forEach((button) => {
      button.addEventListener("click", (event) => this.#toggleEquipped(event));
    });
    this.element.querySelectorAll("[data-active-weapon-mode]").forEach((select) => {
      select.addEventListener("change", (event) => this.#prepareWeaponMode(event));
    });
    this.element.querySelectorAll("[data-fatigue-level]").forEach((field) => {
      field.addEventListener("change", (event) => this.#updateFatigue(event));
    });
    this.element.querySelectorAll("[data-location-disabled]").forEach((field) => {
      field.addEventListener("change", (event) => this.#updateLocationDisabled(event));
    });
    this.element.querySelectorAll("[data-location-armor]").forEach((field) => {
      field.addEventListener("change", (event) => this.#updateLocationArmor(event));
    });
    this.element.querySelectorAll("[data-action='roll-skill']").forEach((button) => {
      button.addEventListener("click", (event) => this.#rollSkill(event));
    });
    this.element.querySelectorAll("[data-action='improve-skill']").forEach((button) => {
      button.addEventListener("click", (event) => this.#improveSkill(event));
    });
    this.element.querySelectorAll("[data-action='roll-passion']").forEach((button) => {
      button.addEventListener("click", (event) => this.#rollPassion(event));
    });
    this.element.querySelectorAll("[data-passion-adjust]").forEach((button) => {
      button.addEventListener("click", (event) => this.#adjustPassion(event));
    });
    this.element.querySelectorAll("[data-action='add-skill-from-pack']").forEach((button) => {
      button.addEventListener("click", (event) => this.#addSkillFromPack(event));
    });
    this.element.querySelectorAll("[data-action='create-combat-style']").forEach((button) => {
      button.addEventListener("click", () => this.#createCombatStyle());
    });
    this.element.querySelectorAll("[data-resource-action]").forEach((button) => {
      button.addEventListener("click", (event) => this.#adjustResource(event));
    });
    this.element.querySelectorAll("[data-skill-field]").forEach((field) => {
      field.addEventListener("change", (event) => this.#updateSkillField(event));
    });
    this.element.querySelectorAll("[data-passion-field]").forEach((field) => {
      field.addEventListener("change", (event) => this.#updatePassionField(event));
    });
    this.element.querySelectorAll("[data-combat-style]").forEach((field) => {
      field.addEventListener("change", (event) => this.#updateWeaponCombatChoice(event));
    });
    this.element.querySelectorAll("[data-combat-familiarity]").forEach((field) => {
      field.addEventListener("change", (event) => this.#updateWeaponCombatChoice(event));
    });
    this.element.querySelectorAll("[data-action='roll-weapon-attack']").forEach((button) => {
      button.addEventListener("click", (event) => this.#rollWeaponAttack(event));
    });
    this.#fitCombatEffects();

    if (context.backgroundWizard && !this._backgroundSyncing) {
      const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
      if (this.#backgroundItemsNeedSync(draft)) {
        this._backgroundSyncing = true;
        this.#syncBackgroundItems(draft)
          .catch((error) => console.error(
            "Mythras Foundry | Error synchronizing background draft",
            error
          ))
          .finally(() => { this._backgroundSyncing = false; });
      }
    }
  }

  #activateTab(event) {
    event.preventDefault();
    const tab = event.currentTarget.dataset.tab;
    this._activeTab = tab;
    this.#showTab(tab);
    if (tab === "combat") this.#fitCombatEffects();
  }

  #showTab(tab) {
    this.element.querySelectorAll("[data-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tab);
    });
    this.element.querySelectorAll("[data-tab-content]").forEach((section) => {
      section.classList.toggle("active", section.dataset.tabContent === tab);
    });
    const trainSkill = this.element.querySelector("[data-action='train-skill']");
    if (trainSkill) trainSkill.hidden = tab !== "character";
  }

  async #showTrainingPlaceholder() {
    await DialogV2.confirm({
      window: { title: game.i18n.localize("MYTHRASF.Skill.Train") },
      content: `<p>${game.i18n.localize("MYTHRASF.Skill.TrainingPlaceholder")}</p>`,
      yes: { label: game.i18n.localize("MYTHRASF.Confirm") },
      no: { label: game.i18n.localize("MYTHRASF.Cancel") }
    });
  }

  #fitCombatEffects() {
    for (const element of this.element.querySelectorAll(".combat-effects")) {
      element.style.fontSize = "";
      if (element.clientWidth === 0 || element.clientHeight === 0) continue;
      let size = Number.parseFloat(getComputedStyle(element).fontSize);
      const minimum = 9;
      while ((element.scrollHeight > element.clientHeight + 1
        || element.scrollWidth > element.clientWidth + 1) && size > minimum) {
        size -= 0.5;
        element.style.fontSize = `${size}px`;
      }
    }
  }

  async #toggleEquipped(event) {
    if (!this.isEditable) return;
    const item = this.actor.items.get(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    if (!item || !["weapon", "armor"].includes(item.type)) return;
    if (item.type === "armor") {
      if (!item.system.equipped && !this.#canEquipArmor(item)) return;
      await item.update({ "system.equipped": !Boolean(item.system.equipped) });
      return;
    }
    const modeKey = event.currentTarget.closest("[data-mode-key]")?.dataset.modeKey
      || item.system.activeModeKey || findWeaponMode(item)?.key;
    if (!item.system.equipped || modeKey !== item.system.activeModeKey) {
      const assessment = assessWeaponEquip(
        item,
        this.actor.items.filter((candidate) => candidate.type === "weapon"), modeKey
      );
      if (!assessment.allowed) {
        ui.notifications.warn(game.i18n.format("MYTHRASF.Weapon.HandsUnavailable", {
          required: assessment.required,
          available: assessment.available
        }));
        return;
      }
    }
    const samePrepared = item.system.equipped && modeKey === item.system.activeModeKey;
    await item.update({ "system.equipped": !samePrepared, "system.activeModeKey": modeKey });
  }

  #canEquipArmor(item) {
    const locationIds = new Set(this.actor.items
      .filter((candidate) => candidate.type === "hitLocation").map((location) => location.id));
    const selectedIds = Array.from(item.system.coveredLocationIds ?? [])
      .filter((id) => locationIds.has(id));
    if (!selectedIds.length) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Armor.CoverageRequired"));
      return false;
    }
    const conflicts = armorEquipConflicts(item,
      this.actor.items.filter((candidate) => candidate.type === "armor"));
    if (conflicts.length) {
      const names = conflicts.map((id) => this.actor.items.get(id)?.name ?? id).join(", ");
      ui.notifications.warn(game.i18n.format("MYTHRASF.Armor.CoverageConflict", { locations: names }));
      return false;
    }
    return true;
  }

  async #updateLocationArmor(event) {
    if (!this.isEditable) return;
    const locationId = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    const armors = this.actor.items.filter((item) => item.type === "armor");
    const current = armors.find((item) => item.system.equipped
      && (item.system.coveredLocationIds ?? []).includes(locationId));
    const selected = armors.find((item) => item.id === event.currentTarget.value);
    if (!selected) {
      if (current) await current.update({ "system.equipped": false });
      return;
    }
    if (selected.id === current?.id || selected.system.equipped) return;
    if (!this.#canEquipArmor(selected)) {
      event.currentTarget.value = current?.id ?? "";
      return;
    }
    await selected.update({ "system.equipped": true });
  }

  #prepareArmor(item, hitLocations) {
    const locations = armorCoverageLocations(item, hitLocations);
    const totals = armorPhysicalTotals(item, hitLocations);
    return {
      item,
      coverageLabel: locations.map((location) => location.name).join(", ")
        || game.i18n.localize("MYTHRASF.Armor.Unassigned"),
      profileLabel: item.system.profileName || item.name,
      showProfile: Boolean(item.system.profileName && item.system.profileName !== item.name),
      ...totals
    };
  }

  async #prepareWeaponMode(event) {
    if (!this.isEditable) return;
    const weapon = this.actor.items.get(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    if (!weapon) return;
    const modeKey = event.currentTarget.value;
    if (weapon.system.equipped) {
      const assessment = assessWeaponEquip(weapon,
        this.actor.items.filter((item) => item.type === "weapon"), modeKey);
      if (!assessment.allowed) {
        event.currentTarget.value = weapon.system.activeModeKey;
        return ui.notifications.warn(game.i18n.format("MYTHRASF.Weapon.HandsUnavailable", assessment));
      }
    }
    await weapon.update({ "system.activeModeKey": modeKey });
  }

  async #updateFatigue(event) {
    if (!this.isEditable || !event.currentTarget.checked) return;
    const levelKey = event.currentTarget.value;
    const baseAttributes = calculateDerivedAttributes(this.actor.system, getActionPointRules());
    const effectiveAttributes = applyFatigue(baseAttributes,
      this.#conditionLevel(levelKey).key);
    const currentActionPoints = Number(this.actor.system.resources.actionPoints.value ?? 0);
    await this.actor.update({
      "system.fatigueLevel": levelKey,
      "system.resources.actionPoints.value": Math.min(
        currentActionPoints, effectiveAttributes.actionPointsMax)
    });
  }

  async #updateLocationDisabled(event) {
    if (!this.isEditable) return;
    const location = this.actor.items.get(
      event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    if (location?.type !== "hitLocation") return;
    await location.update({ "system.disabled": event.currentTarget.checked });
  }

  #conditionLevel(fatigueKey = this.actor.system.fatigueLevel) {
    const locations = this.actor.items.filter((item) => item.type === "hitLocation");
    return combinedConditionLevel(fatigueKey, worstWoundLevel(locations));
  }

  async #applySeriousWoundPenalty(difficulty) {
    const locations = this.actor.items.filter((item) => item.type === "hitLocation");
    if (!hasSeriousWound(locations)) return difficulty;
    const applyPenalty = await DialogV2.confirm({
      window: { title: game.i18n.localize("MYTHRASF.Wound.ApplyPenaltyTitle") },
      content: `<p>${game.i18n.localize("MYTHRASF.Wound.ApplyPenaltyPrompt")}</p>`,
      yes: { label: game.i18n.localize("MYTHRASF.Wound.ApplyPenalty") },
      no: { label: game.i18n.localize("MYTHRASF.Wound.IgnorePenalty") }
    });
    return applyPenalty ? worsenDifficulty(difficulty) : difficulty;
  }

  async #updateWeaponCombatChoice(event) {
    if (!this.isEditable) return;
    const row = event.currentTarget.closest("[data-item-id]");
    const weapon = this.actor.items.get(row?.dataset.itemId);
    if (!weapon || weapon.type !== "weapon") return;
    const modes = weaponModes(weapon).map((mode) => ({ ...mode }));
    const mode = modes.find((entry) => entry.key === row.dataset.modeKey);
    if (!mode) return;
    if (event.currentTarget.matches("[data-combat-style]")) {
      mode.preferredCombatStyleId = event.currentTarget.value;
    } else {
      mode.familiarity = event.currentTarget.value;
    }
    await weapon.update({ "system.modes": modes });
  }

  async #rollWeaponAttack(event) {
    event.preventDefault();
    const row = event.currentTarget.closest("[data-item-id]");
    const weapon = this.actor.items.get(row?.dataset.itemId);
    if (!weapon) return;
    const mode = findWeaponMode(weapon, row.dataset.modeKey);
    if (!weapon.system.equipped || weapon.system.activeModeKey !== mode?.key) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Weapon.ModeNotPrepared"));
      return;
    }
    const modeWeapon = weaponModeView(weapon, mode);
    const styles = this.actor.items.filter((item) => item.type === "combatStyle");
    const resolution = resolveWeaponStyle({
      weapon: modeWeapon,
      styles,
      selectedStyleId: row.querySelector("[data-combat-style]")?.value,
      familiarity: row.querySelector("[data-combat-familiarity]")?.value
        ?? mode.familiarity
    });
    resolution.difficulty = combineDifficulties(resolution.difficulty,
      this.#conditionLevel().skillDifficulty);
    resolution.difficulty = await this.#applySeriousWoundPenalty(resolution.difficulty);
    if (resolution.difficulty === "impossible") {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Fatigue.NoActivity"));
      return;
    }
    if (!resolution.style && !resolution.usesBase) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Combat.SelectStyle"));
      return;
    }
    const targets = Array.from(game.user.targets ?? []);
    if (targets.length > 1) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Combat.OneTarget"));
      return;
    }
    await createAttackMessage({ actor: this.actor, weapon, mode, resolution, target: targets[0] });
  }

  async #choosePortrait() {
    if (!this.isEditable) return;
    const worldDirectory = `worlds/${game.world.id}`;
    const picker = new FilePicker({
      type: "image",
      current: worldDirectory,
      callback: async (path) => {
        if (path) await this.actor.update({ img: path });
      }
    });
    await picker.browse(worldDirectory);
  }

  #viewPortrait() {
    new ImagePopout({
      src: this.actor.img,
      uuid: this.actor.uuid,
      window: { title: this.actor.name }
    }).render(true);
  }

  async #confirmCharacteristics() {
    if (!this.isEditable) return;
    const method = this.actor.system.generationMethod;
    if (!method) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Character.ChooseMethod"));
      return;
    }
    if (
      method === "points"
      && calculateAllocationRemaining(this.actor.system) !== 0
    ) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Character.SpendAllPoints"));
      return;
    }

    const { attributes } = this.actor.system;
    this._editMode = false;
    await this.actor.update({
      "system.characteristicsGenerated": true,
      "system.resources.actionPoints.value": attributes.actionPointsMax,
      "system.resources.luckPoints.value": attributes.luckPointsMax,
      "system.resources.magicPoints.value": attributes.magicPointsMax
    });
  }

  async #selectGenerationMethod(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const method = event.currentTarget.dataset.generationMethod;
    if (method === "points") {
      const allocation = createMinimumAllocation();
      const update = { "system.generationMethod": method };
      for (const [key, value] of Object.entries(allocation)) {
        update[`system.${key}`] = value;
      }
      await this.actor.update(update);
      return;
    }

    const formulas = {
      strength: "3d6",
      constitution: "3d6",
      size: "2d6 + 6",
      dexterity: "3d6",
      intelligence: "2d6 + 6",
      power: "3d6",
      charisma: "3d6"
    };
    const update = { "system.generationMethod": method };

    for (const [key, formula] of Object.entries(formulas)) {
      const roll = await new Roll(formula).evaluate();
      update[`system.${key}`] = roll.total;
    }

    await this.actor.update(update);
  }

  async #toggleEditMode() {
    if (!this.isEditable) return;
    this._editMode = !this._editMode;
    await this.render({ force: true });
  }

  async #adjustCharacteristic(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const key = event.currentTarget.dataset.characteristic;
    const delta = Number(event.currentTarget.dataset.delta);
    const generated = this.actor.system.characteristicsGenerated;
    let value = Number(this.actor.system[key]);

    if (!generated && this.actor.system.generationMethod === "points") {
      value = adjustPointAllocation(this.actor.system, key, delta);
    } else if (generated && this._editMode) {
      value = Math.max(CHARACTERISTIC_MINIMUMS[key], value + delta);
    } else {
      return;
    }

    await this.actor.update({ [`system.${key}`]: value });
  }

  async #swapCharacteristic(event) {
    if (!this.isEditable || this.actor.system.characteristicsGenerated) return;

    const first = event.currentTarget.dataset.swapCharacteristic;
    const second = event.currentTarget.value;
    if (!canSwapCharacteristics(first, second)) return;

    await this.actor.update({
      [`system.${first}`]: this.actor.system[second],
      [`system.${second}`]: this.actor.system[first]
    });
  }

  #prepareBackgroundWizard() {
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const culture = getCulture(draft.cultureKey);
    const profession = getProfession(draft.professionKey);
    const stage = draft.stage;
    const socialClass = getSocialClass(draft.cultureKey, draft.socialClassKey);
    const socialClassMethod = getSocialClassMethod();
    const phase = ["culture", "profession"].includes(stage) ? stage : null;
    const selectedBackground = phase
      ? (phase === "culture" ? culture : profession)
      : null;
    const selectedProfessionals = new Set(
      phase === "culture"
        ? draft.cultureProfessionals
        : draft.professionProfessionals
    );
    const selectedChoices = phase === "culture"
      ? draft.cultureChoices
      : draft.professionChoices;
    const phaseAbilities = phase
      ? getPhaseAbilities(selectedBackground, draft, phase)
      : [];
    const freeAbilities = getFreeAbilities(
      culture,
      profession,
      draft,
      CORE_BASIC_SLUGS
    );
    const allocationPhase = phase ?? (stage === "free" ? "free" : null);
    const allocationRules = allocationPhase
      ? this.#backgroundAllocationRules(draft, allocationPhase)
      : { budget: 0, limits: null };
    const allocationAbilities = allocationPhase === "free" ? freeAbilities : phaseAbilities;
    const allocation = allocationPhase ? draft.allocations[allocationPhase] : {};
    const allocationRows = allocationAbilities
      .filter((ability) => ability.key && ability.key !== "style:")
      .map((ability) => ({
        ...ability,
        phase: allocationPhase,
        label: this.#abilityLabel(ability),
        base: this.#abilityBase(ability),
        previousPoints: this.#previousBackgroundPoints(draft, allocationPhase, ability.key),
        points: Number(allocation[ability.key] ?? 0),
        total: this.#abilityBase(ability)
          + this.#previousBackgroundPoints(draft, allocationPhase, ability.key)
          + Number(allocation[ability.key] ?? 0)
      }))
      .sort((left, right) => left.label.localeCompare(right.label, game.i18n.lang));
    const reviewAbilities = freeAbilities.map((ability) => {
      const culturePoints = Number(draft.allocations.culture[ability.key] ?? 0);
      const professionPoints = Number(draft.allocations.profession[ability.key] ?? 0);
      const freePoints = Number(draft.allocations.free[ability.key] ?? 0);
      return {
        ...ability,
        label: this.#abilityLabel(ability),
        culturePoints,
        professionPoints,
        freePoints,
        totalPoints: culturePoints + professionPoints + freePoints
      };
    }).sort((left, right) => left.label.localeCompare(right.label, game.i18n.lang));

    return {
      stage,
      isCulture: stage === "culture",
      isSocialClass: stage === "socialClass",
      isProfession: stage === "profession",
      isAge: stage === "age",
      isFree: stage === "free",
      isReview: stage === "review",
      cultureName: culture?.name ?? "",
      professionName: profession?.name ?? "",
      socialClassName: socialClass?.name ?? "",
      socialClassRandom: socialClassMethod === SOCIAL_CLASS_METHODS.random,
      socialClasses: socialClassesForCulture(draft.cultureKey).map((entry) => ({
        ...entry,
        selected: entry.key === draft.socialClassKey
      })),
      selectedSocialClass: socialClass,
      socialClassRoll: Number(draft.socialClassRoll) || "",
      startingMoney: Number(draft.startingMoney) || 0,
      startingMoneyFormula: STARTING_MONEY_BY_CULTURE[draft.cultureKey]?.formula ?? "",
      age: Number(draft.age) || "",
      ageCategoryName: draft.ageCategory
        ? game.i18n.localize(`MYTHRASF.Age.Category.${draft.ageCategory}`)
        : "",
      ageCategories: AGE_CATEGORIES.map((entry) => ({
        ...entry,
        selected: entry.key === draft.ageCategory,
        name: game.i18n.localize(`MYTHRASF.Age.Category.${entry.key}`)
      })),
      selectedAgeCategory: getAgeCategory(draft.ageCategory),
      cultures: CULTURES.map((entry) => ({
        key: entry.key,
        name: entry.name,
        selected: entry.key === draft.cultureKey
      })),
      professions: professionsForCulture(draft.cultureKey).map((entry) => ({
        key: entry.key,
        name: entry.name,
        selected: entry.key === draft.professionKey
      })),
      selected: selectedBackground
        ? {
          ...selectedBackground,
          choices: selectedBackground.choices.map((choice) => ({
            ...choice,
            options: choice.options.map((entry) => ({
              ...entry,
              phase,
              groupId: choice.id,
              checked: (selectedChoices[choice.id] ?? []).includes(entry.slug)
            }))
          })),
          professional: selectedBackground.professional.map((entry, index) => ({
            ...entry,
            phase,
            checked: selectedProfessionals.has(entry.id),
            specialization: draft.specializations[`${phase}:${entry.id}`] ?? "",
            specializationListId: `specializations-${phase}-${entry.slug}-${index}`,
            existingSpecializations: this.#existingSpecializations(entry.slug, phase)
          })),
          styles: phaseAbilities
            .filter((ability) => ability.type === "combatStyle")
            .map((ability) => ({
              ...ability,
              phase,
              existingStyleNames: this.#existingCombatStyleNames(),
              canRemove: !ability.required
            }))
        }
        : null,
      selectedProfessionalCount: selectedProfessionals.size,
      freeProfessionalOptions: ALL_SKILL_SOURCES.map((source) => ({
        slug: source.system.slug,
        name: source.name,
        group: source.system.group,
        selected: draft.freeProfessional.type !== "combatStyle"
          && source.system.slug === draft.freeProfessional.slug
      })),
      freeCombatStyleSelected: draft.freeProfessional.type === "combatStyle",
      freeExistingCombatStyles: this.#existingCombatStyleNames(),
      freeProfessional: draft.freeProfessional,
      freeSpecializationListId: `specializations-free-${
        draft.freeProfessional.slug || "skill"
      }`,
      freeExistingSpecializations: this.#existingSpecializations(
        draft.freeProfessional.slug,
        "free"
      ),
      freeSpecializationRequired: freeSkillNeedsSpecialization(
        draft.freeProfessional.slug
      ) && draft.freeProfessional.type !== "combatStyle",
      allocationPhase,
      allocationRows,
      allocationRemaining: allocationPhase
        ? backgroundAllocationRemaining(allocationPhase, allocation, allocationRules.budget)
        : 0,
      allocationBudget: allocationRules.budget,
      allocationLimits: allocationRules.limits,
      reviewAbilities
    };
  }

  #prepareSkillRow(item, draft) {
    const total = Number(item.system.total ?? 0);
    const row = {
      id: item.id,
      name: item.name,
      type: item.type,
      system: item.system,
      totalDisplay: penalizedValue(total, difficultyTarget(
      total, this.#conditionLevel().skillDifficulty))
    };
    if (!draft) return row;

    const culture = getCulture(draft.cultureKey);
    const profession = getProfession(draft.professionKey);
    const phase = draft.stage === "review"
      ? "free"
      : ["culture", "profession", "free"].includes(draft.stage)
        ? draft.stage
        : null;
    if (!phase) return row;
    const key = item.getFlag("mythras-foundry", "backgroundDraftAbility")
      ?? item.getFlag("mythras-foundry", "backgroundAbility")
      ?? (item.type === "combatStyle"
        ? styleAbilityKey(item.name)
        : skillAbilityKey(
          item.system.templateSlug || item.system.slug,
          item.system.specialization
        ));
    const allowedAbilities = phase === "free"
      ? getFreeAbilities(culture, profession, draft, CORE_BASIC_SLUGS)
      : getPhaseAbilities(phase === "culture" ? culture : profession, draft, phase);
    const allowed = new Set(allowedAbilities.map((ability) => ability.key));
    const currentPoints = Number(draft.allocations[phase]?.[key] ?? 0);
    const previousPoints = this.#previousBackgroundPoints(draft, phase, key);
    return {
      ...row,
      creation: {
        key,
        phase,
        modifiable: draft.stage !== "review" && allowed.has(key),
        base: Number(item.system.base ?? this.#abilityBase(
          allowedAbilities.find((ability) => ability.key === key) ?? {}
        )),
        previousPoints,
        currentPoints,
        total: Number(item.system.base ?? 0) + previousPoints + currentPoints
      }
    };
  }

  #abilityLabel(ability) {
    if (ability.type === "combatStyle") return ability.name || ability.prompt;
    const name = SKILL_NAMES.get(ability.slug) ?? ability.slug;
    return ability.specialization ? `${name} (${ability.specialization})` : name;
  }

  #existingSpecializations(slug, phase) {
    if (!slug) return [];
    return [...new Set(this.actor.items
      .filter((item) => (
        item.type === "skill"
        && (item.system.templateSlug || item.system.slug) === slug
        && String(item.system.specialization ?? "").trim()
      ))
      .map((item) => item.system.specialization.trim()))]
      .sort((left, right) => left.localeCompare(right, game.i18n.lang));
  }

  #existingCombatStyleNames() {
    return [...new Set(this.actor.items
      .filter((item) => item.type === "combatStyle" && item.name.trim())
      .map((item) => item.name.trim()))]
      .sort((left, right) => left.localeCompare(right, game.i18n.lang));
  }

  #abilityBase(ability) {
    if (ability.type === "combatStyle") {
      return Number(this.actor.system.strength) + Number(this.actor.system.dexterity);
    }
    const source = SKILLS_BY_SLUG.get(ability.slug);
    if (!source) return 0;
    return Number(this.actor.system[source.system.characteristic1] ?? 0)
      + Number(this.actor.system[source.system.characteristic2] ?? 0)
      + Number(source.system.baseBonus ?? 0);
  }

  #previousBackgroundPoints(draft, phase, key) {
    if (phase === "profession") {
      return Number(draft.allocations.culture[key] ?? 0);
    }
    if (phase === "free") {
      return Number(draft.allocations.culture[key] ?? 0)
        + Number(draft.allocations.profession[key] ?? 0);
    }
    return 0;
  }

  #backgroundAllocationRules(draft, phase) {
    if (phase === "culture") {
      return { budget: BACKGROUND_BUDGETS.culture, limits: getCultureAllocationRules() };
    }
    if (phase === "profession") {
      return { budget: BACKGROUND_BUDGETS.profession, limits: getProfessionAllocationRules() };
    }
    const age = getAgeCategory(draft.ageCategory);
    return {
      budget: age?.freePoints ?? BACKGROUND_BUDGETS.free,
      limits: { minimum: 0, maximum: age?.maximum ?? BACKGROUND_BUDGETS.free }
    };
  }

  async #saveBackgroundDraft(draft) {
    this._backgroundSyncing = true;
    try {
      await this.actor.update({
        "system.backgroundDraft": serializeBackgroundDraft(draft)
      });
      await this.#syncBackgroundItems(draft);
    } finally {
      this._backgroundSyncing = false;
    }
  }

  async #syncBackgroundItems(draft) {
    const culture = getCulture(draft.cultureKey);
    const profession = getProfession(draft.professionKey);
    const acquired = getAllAcquiredAbilities(culture, profession, draft);
    const desired = new Map(acquired.map((ability) => [ability.key, ability]));
    const draftItems = this.actor.items.filter((item) => (
      item.getFlag("mythras-foundry", "backgroundDraftAbility")
    ));
    const draftByKey = new Map();
    const duplicates = [];
    for (const item of draftItems) {
      const key = item.getFlag("mythras-foundry", "backgroundDraftAbility");
      if (draftByKey.has(key)) duplicates.push(item.id);
      else draftByKey.set(key, item);
    }
    const combatByKey = new Map();
    for (const item of this.actor.items.filter((candidate) => candidate.type === "combatStyle")) {
      const key = styleAbilityKey(item.name);
      const current = combatByKey.get(key);
      if (!current) {
        combatByKey.set(key, item);
        continue;
      }
      // Prefer an established item over a transient copy made by the wizard.
      if (
        current.getFlag("mythras-foundry", "backgroundDraftAbility")
        && !item.getFlag("mythras-foundry", "backgroundDraftAbility")
      ) {
        duplicates.push(current.id);
        combatByKey.set(key, item);
      } else {
        duplicates.push(item.id);
      }
    }
    const deletions = [...duplicates, ...draftItems
      .filter((item) => !desired.has(
        item.getFlag("mythras-foundry", "backgroundDraftAbility")
      ))
      .map((item) => item.id)]
      .filter((id, index, values) => values.indexOf(id) === index);
    if (deletions.length > 0) {
      await this.actor.deleteEmbeddedDocuments("Item", deletions);
    }

    const updates = [];
    const creations = [];
    for (const source of BASIC_SKILL_SOURCES) {
      if (source.system.slug === "estilo-de-combate") continue;
      const item = this.actor.items.find((candidate) => (
        candidate.type === "skill" && candidate.system.slug === source.system.slug
      ));
      if (!item) continue;
      const key = skillAbilityKey(source.system.slug);
      updates.push({
        _id: item.id,
        "system.culturePoints": Number(draft.allocations.culture[key] ?? 0),
        "system.professionPoints": Number(draft.allocations.profession[key] ?? 0),
        "system.freePoints": Number(draft.allocations.free[key] ?? 0)
      });
    }

    for (const ability of acquired) {
      if (
        ability.type === "skill"
        && BASIC_SKILLS_BY_SLUG.has(ability.slug)
        && !ability.specialization
      ) continue;
      const points = {
        culturePoints: Number(draft.allocations.culture[ability.key] ?? 0),
        professionPoints: Number(draft.allocations.profession[ability.key] ?? 0),
        freePoints: Number(draft.allocations.free[ability.key] ?? 0)
      };
      const existing = ability.type === "combatStyle"
        ? combatByKey.get(styleAbilityKey(ability.name))
        : draftByKey.get(ability.key);
      if (existing && !deletions.includes(existing.id)) {
        updates.push({
          _id: existing.id,
          "system.culturePoints": points.culturePoints,
          "system.professionPoints": points.professionPoints,
          "system.freePoints": points.freePoints,
          ...(ability.type === "combatStyle" && ability.weapons
            ? { "system.weapons": ability.weapons }
            : {}),
          ...(ability.type === "combatStyle" && ability.traits
            ? { "system.traits": ability.traits }
            : {})
        });
      } else {
        creations.push(this.#createBackgroundAbilityData(ability, points, true));
      }
    }
    if (updates.length > 0) {
      await this.actor.updateEmbeddedDocuments("Item", updates);
    }
    if (creations.length > 0) {
      await this.actor.createEmbeddedDocuments("Item", creations);
    }
  }

  #backgroundItemsNeedSync(draft) {
    const culture = getCulture(draft.cultureKey);
    const profession = getProfession(draft.professionKey);
    const desired = getAllAcquiredAbilities(culture, profession, draft)
      .filter((ability) => !(
        ability.type === "skill"
        && BASIC_SKILLS_BY_SLUG.has(ability.slug)
        && !ability.specialization
      ));
    const currentKeys = new Set(this.actor.items
      .map((item) => item.getFlag("mythras-foundry", "backgroundDraftAbility"))
      .filter(Boolean));
    for (const item of this.actor.items.filter((candidate) => candidate.type === "combatStyle")) {
      const key = styleAbilityKey(item.name);
      if (desired.some((ability) => ability.key === key)) currentKeys.add(key);
    }
    if (
      desired.length !== currentKeys.size
      || desired.some((ability) => !currentKeys.has(ability.key))
    ) return true;
    return BASIC_SKILL_SOURCES.some((source) => {
      if (source.system.slug === "estilo-de-combate") return false;
      const item = this.actor.items.find((candidate) => (
        candidate.type === "skill" && candidate.system.slug === source.system.slug
      ));
      const key = skillAbilityKey(source.system.slug);
      return item && (
        Number(item.system.culturePoints) !== Number(draft.allocations.culture[key] ?? 0)
        || Number(item.system.professionPoints) !== Number(
          draft.allocations.profession[key] ?? 0
        )
        || Number(item.system.freePoints) !== Number(draft.allocations.free[key] ?? 0)
      );
    });
  }

  #createBackgroundAbilityData(ability, points, draft = false) {
    const flag = draft ? "backgroundDraftAbility" : "backgroundAbility";
    if (ability.type === "combatStyle") {
      return {
        name: ability.name,
        type: "combatStyle",
        img: defaultItemIcon("combatStyle"),
        system: {
          slug: ability.key.slice(6),
          templateSlug: "estilo-de-combate",
          specialization: ability.name,
          category: "professional",
          group: "combat",
          characteristic1: "strength",
          characteristic2: "dexterity",
          baseBonus: 0,
          bonus: 0,
          ...points,
          experiencePoints: 0,
          trained: false,
          fumbled: false,
          weapons: ability.weapons,
          traits: ability.traits,
          sourceType: "background",
          description: ability.prompt
        },
        flags: { "mythras-foundry": { [flag]: ability.key } }
      };
    }
    const source = SKILLS_BY_SLUG.get(ability.slug);
    if (!source) return null;
    const data = foundry.utils.deepClone(source);
    data.name = ability.specialization
      ? `${source.name} (${ability.specialization})`
      : source.name;
    data.system.slug = ability.specialization
      ? `${ability.slug}-${ability.key.split(":").at(-1)}`
      : ability.slug;
    data.system.templateSlug = ability.slug;
    data.system.specialization = ability.specialization;
    Object.assign(data.system, points);
    data.flags = {
      ...(data.flags ?? {}),
      "mythras-foundry": {
        ...(data.flags?.["mythras-foundry"] ?? {}),
        [flag]: ability.key
      }
    };
    return data;
  }

  async #selectBackground(event) {
    if (!this.isEditable) return;
    const type = event.currentTarget.dataset.backgroundSelect;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    if (type === "culture") {
      Object.assign(draft, createBackgroundDraft(), {
        cultureKey: event.currentTarget.value
      });
    } else {
      draft.professionKey = event.currentTarget.value;
      draft.professionChoices = {};
      draft.professionProfessionals = [];
      draft.allocations.profession = {};
      draft.allocations.free = {};
      draft.freeProfessional = createBackgroundDraft().freeProfessional;
      for (const key of Object.keys(draft.specializations)) {
        if (key.startsWith("profession:")) delete draft.specializations[key];
      }
      for (const key of Object.keys(draft.styles)) {
        if (key.startsWith("profession:")) delete draft.styles[key];
      }
    }
    await this.#saveBackgroundDraft(draft);
  }

  async #toggleBackgroundChoice(event) {
    if (!this.isEditable) return;
    const { phase, group, slug } = event.currentTarget.dataset;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const background = phase === "culture"
      ? getCulture(draft.cultureKey)
      : getProfession(draft.professionKey);
    const rule = background?.choices.find((choice) => choice.id === group);
    if (!rule) return;
    const target = phase === "culture" ? draft.cultureChoices : draft.professionChoices;
    const selected = new Set(target[group] ?? []);
    if (event.currentTarget.checked) {
      if (selected.size >= rule.count) {
        ui.notifications.warn(game.i18n.format("MYTHRASF.Background.ChoiceLimit", {
          count: rule.count
        }));
        await this.render({ force: true });
        return;
      }
      selected.add(slug);
    } else {
      selected.delete(slug);
    }
    target[group] = [...selected];
    this.#pruneBackgroundAllocation(draft, phase);
    await this.#saveBackgroundDraft(draft);
  }

  async #toggleBackgroundProfessional(event) {
    if (!this.isEditable) return;
    const { phase, option } = event.currentTarget.dataset;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const target = phase === "culture"
      ? draft.cultureProfessionals
      : draft.professionProfessionals;
    const selected = new Set(target);
    if (event.currentTarget.checked) {
      if (selected.size >= 3) {
        ui.notifications.warn(game.i18n.localize("MYTHRASF.Background.ThreeSkills"));
        await this.render({ force: true });
        return;
      }
      selected.add(option);
    } else {
      selected.delete(option);
    }
    if (phase === "culture") draft.cultureProfessionals = [...selected];
    else draft.professionProfessionals = [...selected];
    this.#pruneBackgroundAllocation(draft, phase);
    await this.#saveBackgroundDraft(draft);
  }

  async #updateBackgroundSpecialization(event) {
    const { phase, option } = event.currentTarget.dataset;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const background = phase === "culture"
      ? getCulture(draft.cultureKey)
      : getProfession(draft.professionKey);
    const selectedOption = background?.professional.find((entry) => entry.id === option);
    const previous = draft.specializations[`${phase}:${option}`] ?? "";
    const previousKey = selectedOption
      ? skillAbilityKey(selectedOption.slug, previous)
      : "";
    draft.specializations[`${phase}:${option}`] = event.currentTarget.value.trim();
    const nextKey = selectedOption
      ? skillAbilityKey(selectedOption.slug, draft.specializations[`${phase}:${option}`])
      : "";
    this.#transferBackgroundPoints(draft.allocations[phase], previousKey, nextKey);
    this.#pruneBackgroundAllocation(draft, phase);
    await this.#saveBackgroundDraft(draft);
  }

  async #updateBackgroundStyle(event) {
    const { style, backgroundStyleField: field } = event.currentTarget.dataset;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const previousKey = styleAbilityKey(draft.styles[style]?.name ?? "");
    draft.styles[style] = {
      ...(draft.styles[style] ?? {}),
      [field]: event.currentTarget.value.trim()
    };
    if (field === "name") {
      const phase = style.split(":")[0];
      const nextKey = styleAbilityKey(draft.styles[style].name ?? "");
      this.#transferBackgroundPoints(draft.allocations[phase], previousKey, nextKey);
      this.#pruneBackgroundAllocation(draft, phase);
    }
    await this.#saveBackgroundDraft(draft);
  }

  async #changeBackgroundStyles(event) {
    event.preventDefault();
    const { phase, backgroundStyleAction: action, style } = event.currentTarget.dataset;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    if (action === "add") {
      if (phase === "culture") return;
      const id = `${phase}:extra-${Date.now().toString(36)}`;
      draft.extraStyles[phase].push(id);
      draft.styles[id] = { name: "", weapons: "", traits: "" };
    } else if (action === "remove" && style) {
      const oldName = draft.styles[style]?.name ?? "";
      const oldKey = styleAbilityKey(oldName);
      draft.extraStyles[phase] = draft.extraStyles[phase].filter((id) => id !== style);
      delete draft.styles[style];
      delete draft.allocations[phase][oldKey];
      this.#pruneBackgroundAllocation(draft, phase);
    }
    await this.#saveBackgroundDraft(draft);
  }

  async #rollStartingMoney(draft) {
    const roll = await new Roll("4d6").evaluate();
    draft.startingMoneyDice = Number(roll.total);
    draft.startingMoney = calculateStartingMoney(
      draft.cultureKey, draft.socialClassKey, draft.startingMoneyDice
    );
  }

  async #assignRandomSocialClass(draft) {
    const roll = await new Roll("1d100").evaluate();
    const socialClass = resolveSocialClass(draft.cultureKey, roll.total);
    draft.socialClassRoll = Number(roll.total);
    draft.socialClassKey = socialClass?.key ?? "";
    if (socialClass) await this.#rollStartingMoney(draft);
  }

  async #selectSocialClass(event) {
    if (!this.isEditable) return;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    draft.socialClassKey = event.currentTarget.value;
    draft.socialClassRoll = 0;
    draft.startingMoneyDice = 0;
    draft.startingMoney = 0;
    if (draft.socialClassKey) await this.#rollStartingMoney(draft);
    await this.#saveBackgroundDraft(draft);
  }

  async #rollSocialClass(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    if (getSocialClassMethod() === SOCIAL_CLASS_METHODS.random) {
      await this.#assignRandomSocialClass(draft);
    } else if (draft.socialClassKey) {
      await this.#rollStartingMoney(draft);
    }
    await this.#saveBackgroundDraft(draft);
  }

  async #updateBackgroundAge(event) {
    if (!this.isEditable) return;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const field = event.currentTarget.dataset.backgroundAgeField;
    if (field === "category") {
      draft.ageCategory = event.currentTarget.value;
      draft.allocations.free = {};
    } else if (field === "age") {
      draft.age = Math.max(0, Number.parseInt(event.currentTarget.value, 10) || 0);
    }
    await this.#saveBackgroundDraft(draft);
  }

  async #updateFreeSkill(event) {
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const field = event.currentTarget.dataset.backgroundFreeField;
    const previousKey = draft.freeProfessional.type === "combatStyle"
      ? styleAbilityKey(draft.freeProfessional.name)
      : skillAbilityKey(
        draft.freeProfessional.slug,
        draft.freeProfessional.specialization
      );
    const value = event.currentTarget.value.trim();
    if (field === "slug") {
      if (value === "__combat-style__") {
        Object.assign(draft.freeProfessional, {
          type: "combatStyle", slug: value, specialization: ""
        });
      } else {
        Object.assign(draft.freeProfessional, {
          type: "skill", slug: value, name: "", weapons: "", traits: ""
        });
      }
    } else {
      draft.freeProfessional[field] = value;
    }
    const nextKey = draft.freeProfessional.type === "combatStyle"
      ? styleAbilityKey(draft.freeProfessional.name)
      : skillAbilityKey(
        draft.freeProfessional.slug,
        draft.freeProfessional.specialization
      );
    this.#transferBackgroundPoints(draft.allocations.free, previousKey, nextKey);
    this.#pruneBackgroundAllocation(draft, "free");
    await this.#saveBackgroundDraft(draft);
  }

  #transferBackgroundPoints(allocation, previousKey, nextKey) {
    if (!previousKey || !nextKey || previousKey === nextKey) return;
    const points = Number(allocation[previousKey] ?? 0);
    if (points > 0) allocation[nextKey] = Number(allocation[nextKey] ?? 0) + points;
    delete allocation[previousKey];
  }

  #pruneBackgroundAllocation(draft, phase) {
    const culture = getCulture(draft.cultureKey);
    const profession = getProfession(draft.professionKey);
    const abilities = phase === "free"
      ? getFreeAbilities(culture, profession, draft, CORE_BASIC_SLUGS)
      : getPhaseAbilities(phase === "culture" ? culture : profession, draft, phase);
    const allowed = new Set(abilities.map((ability) => ability.key));
    draft.allocations[phase] = Object.fromEntries(
      Object.entries(draft.allocations[phase])
        .filter(([key]) => allowed.has(key))
    );
  }

  async #updateBackgroundPoints(event) {
    const { phase, ability } = event.currentTarget.dataset;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const rules = this.#backgroundAllocationRules(draft, phase);
    draft.allocations[phase] = setAllocation(
      draft.allocations[phase],
      ability,
      event.currentTarget.value,
      rules.budget,
      rules.limits
    );
    await this.#saveBackgroundDraft(draft);
  }

  async #adjustBackgroundPoints(event) {
    event.preventDefault();
    const { phase, ability, delta } = event.currentTarget.dataset;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const current = Number(draft.allocations[phase][ability] ?? 0);
    const rules = this.#backgroundAllocationRules(draft, phase);
    draft.allocations[phase] = setAllocation(
      draft.allocations[phase],
      ability,
      current + Number(delta),
      rules.budget,
      rules.limits
    );
    await this.#saveBackgroundDraft(draft);
  }

  async #navigateBackground(event) {
    event.preventDefault();
    const direction = event.currentTarget.dataset.backgroundNavigation;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    if (direction === "back") {
      draft.stage = {
        socialClass: "culture",
        profession: "socialClass",
        age: "profession",
        free: "age",
        review: "free"
      }[draft.stage] ?? "culture";
      await this.#saveBackgroundDraft(draft);
      return;
    }
    const culture = getCulture(draft.cultureKey);
    const profession = getProfession(draft.professionKey);
    const cultureAllocationRules = getCultureAllocationRules();
    const professionAllocationRules = getProfessionAllocationRules();
    const freeAllocationRules = this.#backgroundAllocationRules(draft, "free");
    const validation = draft.stage === "culture"
      ? validateBackgroundSelection(culture, draft, "culture", cultureAllocationRules)
      : draft.stage === "socialClass"
        ? validateSocialClassSelection(draft)
        : draft.stage === "profession"
        ? (!professionAvailableToCulture(draft.professionKey, draft.cultureKey)
          ? { valid: false, reason: "professionCulture" }
          : validateBackgroundSelection(
            profession, draft, "profession", professionAllocationRules))
        : draft.stage === "age"
          ? validateAgeSelection(draft)
          : validateFreePhase(culture, profession, draft, CORE_BASIC_SLUGS, {
            budget: freeAllocationRules.budget,
            ...freeAllocationRules.limits
          });
    if (!validation.valid) {
      ui.notifications.warn(game.i18n.localize(
        `MYTHRASF.Background.Validation.${validation.reason}`
      ));
      return;
    }
    const previousStage = draft.stage;
    draft.stage = {
      culture: "socialClass", socialClass: "profession", profession: "age",
      age: "free", free: "review"
    }[draft.stage];
    if (previousStage === "culture"
      && getSocialClassMethod() === SOCIAL_CLASS_METHODS.random
      && !draft.socialClassKey) {
      await this.#assignRandomSocialClass(draft);
    }
    await this.#saveBackgroundDraft(draft);
  }

  async #confirmBackground() {
    if (!this.isEditable) return;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const culture = getCulture(draft.cultureKey);
    const profession = getProfession(draft.professionKey);
    const cultureAllocationRules = getCultureAllocationRules();
    const professionAllocationRules = getProfessionAllocationRules();
    const freeAllocationRules = this.#backgroundAllocationRules(draft, "free");
    if (
      !validateBackgroundSelection(culture, draft, "culture", cultureAllocationRules).valid
      || !validateSocialClassSelection(draft).valid
      || !professionAvailableToCulture(draft.professionKey, draft.cultureKey)
      || !validateBackgroundSelection(
        profession, draft, "profession", professionAllocationRules).valid
      || !validateAgeSelection(draft).valid
      || !validateFreePhase(culture, profession, draft, CORE_BASIC_SLUGS, {
        budget: freeAllocationRules.budget,
        ...freeAllocationRules.limits
      }).valid
    ) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Background.Validation.incomplete"));
      return;
    }

    await this.#syncBackgroundItems(draft);
    const finalizedItems = this.actor.items
      .filter((item) => item.getFlag("mythras-foundry", "backgroundDraftAbility"))
      .map((item) => ({
        _id: item.id,
        "flags.mythras-foundry.backgroundAbility": item.getFlag(
          "mythras-foundry",
          "backgroundDraftAbility"
        ),
        "flags.mythras-foundry.-=backgroundDraftAbility": null
      }));
    if (finalizedItems.length > 0) {
      await this.actor.updateEmbeddedDocuments("Item", finalizedItems);
    }
    const [cultureDocument, professionDocument] = await Promise.all([
      this.#getBackgroundDocument("cultures", culture.key),
      this.#getBackgroundDocument("professions", profession.key)
    ]);
    const socialClass = getSocialClass(draft.cultureKey, draft.socialClassKey);
    await this.actor.update({
      "system.identity.culture.name": culture.name,
      "system.identity.culture.sourceUuid": cultureDocument?.uuid ?? "",
      "system.identity.profession.name": profession.name,
      "system.identity.profession.sourceUuid": professionDocument?.uuid ?? "",
      "system.identity.socialClass.key": socialClass.key,
      "system.identity.socialClass.name": socialClass.name,
      "system.identity.socialClass.titles": socialClass.titles,
      "system.identity.socialClass.resources": socialClass.resources,
      "system.identity.socialClass.moneyModifier": socialClass.moneyModifier,
      "system.identity.age": Number(draft.age),
      "system.identity.ageCategory": draft.ageCategory,
      "system.currency.silver": Number(draft.startingMoney),
      "system.currency.startingSilver": Number(draft.startingMoney),
      "system.backgroundComplete": true,
      "system.backgroundCreationEnabled": false,
      "system.backgroundDraft": ""
    });
    ui.notifications.info(game.i18n.localize("MYTHRASF.Background.Completed"));
  }

  async #getBackgroundDocument(packName, key) {
    const pack = game.packs.get(`mythras-foundry.${packName}`);
    if (!pack) return null;
    const documents = await pack.getDocuments();
    return documents.find((item) => item.system.key === key) ?? null;
  }

  async #createItem(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const type = event.currentTarget.dataset.type;
    if (type === "passion") {
      await this.#createPassion();
      return;
    }
    const name = nextNumberedItemName(type, this.actor.items,
      (key) => game.i18n.localize(key));
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{ name, type }]);
    item?.sheet.render(true);
  }

  async #createPassion() {
    const verbOptions = PASSION_VERBS.map((verb) => (
      `<option value="${verb}">${game.i18n.localize(`MYTHRASF.Passion.Verb.${verb}`)}</option>`
    )).join("");
    const objectOptions = PASSION_OBJECT_TYPES.map((type) => (
      `<option value="${type}">${game.i18n.localize(`MYTHRASF.Passion.Object.${type}`)}</option>`
    )).join("");
    const result = await DialogV2.input({
      window: { title: game.i18n.localize("MYTHRASF.Passion.Create") },
      content: `<div class="passion-create-dialog">
        <label><span>${game.i18n.localize("MYTHRASF.Passion.VerbLabel")}</span>
          <select name="verb">${verbOptions}</select></label>
        <label><span>${game.i18n.localize("MYTHRASF.Passion.CustomVerb")}</span>
          <input type="text" name="customVerb"></label>
        <label><span>${game.i18n.localize("MYTHRASF.Passion.ObjectType")}</span>
          <select name="objectType">${objectOptions}</select></label>
        <label><span>${game.i18n.localize("MYTHRASF.Passion.ObjectDescription")}</span>
          <input type="text" name="objectDescription" required></label>
        <label><span>${game.i18n.localize("MYTHRASF.Passion.CreationBonus")}</span>
          <input type="number" name="creationBonus" value="0"></label>
      </div>`,
      ok: {
        label: game.i18n.localize("MYTHRASF.Add"),
        icon: "fas fa-plus",
        callback: (dialogEvent, button) => {
          const elements = button.form.elements;
          return {
            verb: elements.verb.value,
            customVerb: elements.customVerb.value.trim(),
            objectType: elements.objectType.value,
            objectDescription: elements.objectDescription.value.trim(),
            creationBonus: Number.parseInt(elements.creationBonus.value, 10) || 0
          };
        }
      }
    });
    if (!result?.objectDescription) return;
    const verb = result.verb === "other"
      ? result.customVerb
      : game.i18n.localize(`MYTHRASF.Passion.Verb.${result.verb}`);
    if (!verb) return;
    await this.actor.createEmbeddedDocuments("Item", [{
      name: `${verb} (${result.objectDescription})`,
      type: "passion",
      system: { ...result, structured: true }
    }]);
  }

  #editItem(event) {
    event.preventDefault();
    const item = this.actor.items.get(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    item?.sheet.render(true);
  }

  async #deleteItem(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const itemId = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    if (itemId) await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }

  async #rollSkill(event) {
    event.preventDefault();
    const row = event.currentTarget.closest("[data-item-id]");
    const item = this.actor.items.get(row?.dataset.itemId);
    let difficulty = combineDifficulties(
      row?.querySelector("[data-difficulty]")?.value ?? "standard",
      this.#conditionLevel().skillDifficulty);
    difficulty = await this.#applySeriousWoundPenalty(difficulty);
    await item?.rollSkill({ difficulty });
  }

  async #improveSkill(event) {
    event.preventDefault();
    if (!this.isEditable || this._experienceImprovementPending) return;

    const button = event.currentTarget;
    const itemId = button.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    let experienceRolls = Number(this.actor.system.experienceRolls ?? 0);
    if (!item || !["skill", "combatStyle"].includes(item.type) || experienceRolls < 1) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Skill.NoExperienceRolls"));
      this.render();
      return;
    }

    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("MYTHRASF.Skill.ImproveConfirmTitle") },
      content: `<p>${game.i18n.format("MYTHRASF.Skill.ImproveConfirm", {
        skill: foundry.utils.escapeHTML(item.name)
      })}</p>`
    });
    if (!confirmed) return;
    experienceRolls = Number(this.actor.system.experienceRolls ?? 0);
    if (experienceRolls < 1) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Skill.NoExperienceRolls"));
      this.render();
      return;
    }

    button.disabled = true;
    this._experienceImprovementPending = true;
    try {
      const checkRoll = await new Roll("1d100").evaluate();
      const checkTotal = Number(checkRoll.total);
      const intelligence = Number(this.actor.system.intelligence ?? 0);
      const skillTotal = Number(item.system.total ?? 0);
      const checkSucceeded = checkTotal + intelligence >= skillTotal;
      const improvementRoll = checkSucceeded ? await new Roll("1d4").evaluate() : null;
      const result = resolveExperienceImprovement({
        skillTotal,
        intelligence,
        checkRoll: checkTotal,
        improvementRoll: improvementRoll?.total,
        fumbled: item.system.fumbled
      });

      await item.update({
        "system.experiencePoints": Number(item.system.experiencePoints ?? 0) + result.increase,
        "system.trained": false,
        "system.fumbled": false
      });
      await this.actor.update({ "system.experienceRolls": experienceRolls - 1 });

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        rolls: [checkRoll, ...(improvementRoll ? [improvementRoll] : [])],
        content: game.i18n.format("MYTHRASF.Skill.ImprovementResult", {
          skill: foundry.utils.escapeHTML(item.name),
          roll: checkTotal,
          intelligence,
          modified: result.modifiedRoll,
          target: skillTotal,
          outcome: game.i18n.localize(`MYTHRASF.Skill.Improvement${
            result.succeeded ? "Success" : "Failure"
          }`),
          improvementRollLine: result.succeeded
            ? game.i18n.format("MYTHRASF.Skill.ImprovementRollLine", {
              roll: Number(improvementRoll.total)
            })
            : "",
          baseIncreaseLine: game.i18n.format(
            result.succeeded
              ? "MYTHRASF.Skill.ImprovementFixedBonus"
              : "MYTHRASF.Skill.ImprovementFailureBonus",
            { bonus: 1 }
          ),
          fumbleLine: result.fumbleBonus
            ? game.i18n.format("MYTHRASF.Skill.ImprovementFumbleBonus", {
              bonus: result.fumbleBonus
            })
            : "",
          increase: result.increase
        })
      });
    } finally {
      this._experienceImprovementPending = false;
      button.disabled = false;
    }
  }

  async #rollPassion(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    await this.actor.items.get(itemId)?.rollPassion();
  }

  async #adjustPassion(event) {
    event.preventDefault();
    if (!this.isEditable || !this._editMode) return;
    const itemId = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item || item.type !== "passion") return;
    const delta = Number(event.currentTarget.dataset.passionAdjust) || 0;
    if (item.system.structured) {
      await item.update({
        "system.experiencePoints": Number(item.system.experiencePoints ?? 0) + delta
      });
    } else {
      await item.update({ "system.value": Math.max(0, Number(item.system.value ?? 0) + delta) });
    }
  }

  async #addSkillFromPack(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const group = event.currentTarget.dataset.skillGroup;

    const ignoresExperienceCost = Boolean(this._editMode);
    const acquisition = skillAcquisition({
      experienceRolls: this.actor.system.experienceRolls,
      editMode: ignoresExperienceCost
    });
    if (!acquisition.allowed) {
      ui.notifications.warn(game.i18n.format("MYTHRASF.Skill.AddExperienceUnavailable", {
        cost: acquisition.cost,
        available: acquisition.available
      }));
      return;
    }
    if (!ignoresExperienceCost) {
      const proceed = await DialogV2.confirm({
        window: { title: game.i18n.localize("MYTHRASF.Skill.AddExperienceTitle") },
        content: `<p>${game.i18n.format("MYTHRASF.Skill.AddExperienceConfirm", {
          cost: acquisition.cost
        })}</p>`
      });
      if (!proceed) return;
    }

    const pack = game.packs.get("mythras-foundry.skills");
    if (!pack) {
      ui.notifications.error(game.i18n.localize("MYTHRASF.Skill.PackMissing"));
      return;
    }

    const existingSlugs = new Set(
      this.actor.items
        .filter((item) => item.type === "skill")
        .map((item) => item.system.slug)
        .filter(Boolean)
    );
    const documents = await pack.getDocuments({ type: "skill" });
    const available = documents
      .filter((item) => (item.system.group || item.system.category) === group)
      .filter((item) => (
        item.system.category === "professional"
        || !existingSlugs.has(item.system.slug)
      ))
      .sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang));

    if (available.length === 0) {
      ui.notifications.info(game.i18n.localize("MYTHRASF.Skill.NoneAvailable"));
      return;
    }

    const options = available.map((item) => (
      `<option value="${item.id}">${foundry.utils.escapeHTML(item.name)}</option>`
    )).join("");
    const skillId = await DialogV2.input({
      window: {
        title: game.i18n.format("MYTHRASF.Skill.AddDialogTitle", {
          group: game.i18n.localize(SKILL_GROUP_LABELS[group])
        })
      },
      content: `
        <label class="skill-pack-picker">
          <span>${game.i18n.localize("MYTHRASF.Skill.ChooseFromPack")}</span>
          <select name="skillId" autofocus>${options}</select>
        </label>
      `,
      ok: {
        label: game.i18n.localize("MYTHRASF.Add"),
        icon: "fas fa-plus",
        callback: (event, button) => button.form.elements.skillId.value
      }
    });
    if (!skillId) return;

    const source = available.find((item) => item.id === skillId);
    if (!source) return;

    try {
      const sourceData = source.toObject();
      delete sourceData._id;
      delete sourceData._key;
      delete sourceData.folder;
      if (freeSkillNeedsSpecialization(source.system.templateSlug || source.system.slug)) {
        const specialization = await DialogV2.input({
          window: { title: game.i18n.localize("MYTHRASF.Background.Specialization") },
          content: `
            <label class="skill-pack-picker">
              <span>${game.i18n.localize("MYTHRASF.Background.Specialization")}</span>
              <input type="text" name="specialization" autofocus required>
            </label>
          `,
          ok: {
            label: game.i18n.localize("MYTHRASF.Add"),
            callback: (dialogEvent, button) => (
              button.form.elements.specialization.value.trim()
            )
          }
        });
        if (!specialization) return;
        sourceData.name = `${source.name} (${specialization})`;
        sourceData.system.templateSlug = source.system.slug;
        sourceData.system.specialization = specialization;
        sourceData.system.slug = `${source.system.slug}-${
          skillAbilityKey(source.system.slug, specialization).split(":").at(-1)
        }`;
      }
      if (!ignoresExperienceCost) {
        const currentExperience = Number(this.actor.system.experienceRolls ?? 0);
        if (currentExperience < NEW_SKILL_EXPERIENCE_COST) {
          ui.notifications.warn(game.i18n.format("MYTHRASF.Skill.AddExperienceUnavailable", {
            cost: NEW_SKILL_EXPERIENCE_COST,
            available: currentExperience
          }));
          return;
        }
      }
      await this.actor.createEmbeddedDocuments("Item", [sourceData]);
      if (!ignoresExperienceCost) {
        const remainingExperience = Number(this.actor.system.experienceRolls ?? 0)
          - NEW_SKILL_EXPERIENCE_COST;
        await this.actor.update({
          "system.experienceRolls": remainingExperience
        });
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: game.i18n.format("MYTHRASF.Skill.AcquisitionChatMessage", {
            skill: foundry.utils.escapeHTML(sourceData.name),
            cost: NEW_SKILL_EXPERIENCE_COST,
            remaining: remainingExperience
          })
        });
      }
      await this.render({ force: true });
      ui.notifications.info(game.i18n.format("MYTHRASF.Skill.Added", {
        name: source.name
      }));
    } catch (error) {
      console.error("Mythras Foundry | Error adding skill from compendium", error);
      ui.notifications.error(game.i18n.localize("MYTHRASF.Skill.AddFailed"));
    }
  }

  async #createCombatStyle() {
    if (!this.isEditable) return;
    const ignoresExperienceCost = Boolean(this._editMode);
    const acquisition = skillAcquisition({
      experienceRolls: this.actor.system.experienceRolls,
      editMode: ignoresExperienceCost
    });
    if (!acquisition.allowed) {
      ui.notifications.warn(game.i18n.format("MYTHRASF.Skill.AddExperienceUnavailable", {
        cost: acquisition.cost,
        available: acquisition.available
      }));
      return;
    }
    if (!ignoresExperienceCost) {
      const proceed = await DialogV2.confirm({
        window: { title: game.i18n.localize("MYTHRASF.Skill.AddExperienceTitle") },
        content: `<p>${game.i18n.format("MYTHRASF.Skill.AddExperienceConfirm", {
          cost: acquisition.cost
        })}</p>`
      });
      if (!proceed) return;
    }
    const result = await DialogV2.input({
      window: { title: game.i18n.localize("MYTHRASF.CombatStyle.Create") },
      content: `
        <div class="combat-style-dialog">
          <label><span>${game.i18n.localize("MYTHRASF.Background.StyleName")}</span>
            <input type="text" name="name" autofocus required></label>
          <label><span>${game.i18n.localize("MYTHRASF.CombatStyle.Weapons")}</span>
            <input type="text" name="weapons"></label>
          <label><span>${game.i18n.localize("MYTHRASF.CombatStyle.Traits")}</span>
            <input type="text" name="traits"></label>
        </div>
      `,
      ok: {
        label: game.i18n.localize("MYTHRASF.Add"),
        icon: "fas fa-plus",
        callback: (dialogEvent, button) => ({
          name: button.form.elements.name.value.trim(),
          weapons: button.form.elements.weapons.value.trim(),
          traits: button.form.elements.traits.value.trim()
        })
      }
    });
    if (!result?.name) return;
    if (!ignoresExperienceCost) {
      const currentExperience = Number(this.actor.system.experienceRolls ?? 0);
      if (currentExperience < NEW_SKILL_EXPERIENCE_COST) {
        ui.notifications.warn(game.i18n.format("MYTHRASF.Skill.AddExperienceUnavailable", {
          cost: NEW_SKILL_EXPERIENCE_COST,
          available: currentExperience
        }));
        return;
      }
    }
    const key = styleAbilityKey(result.name);
    const data = this.#createBackgroundAbilityData({
      key,
      type: "combatStyle",
      name: result.name,
      weapons: result.weapons,
      traits: result.traits,
      prompt: ""
    }, { culturePoints: 0, professionPoints: 0, freePoints: 0 });
    await this.actor.createEmbeddedDocuments("Item", [data]);
    if (!ignoresExperienceCost) {
      const remainingExperience = Number(this.actor.system.experienceRolls ?? 0)
        - NEW_SKILL_EXPERIENCE_COST;
      await this.actor.update({ "system.experienceRolls": remainingExperience });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: game.i18n.format("MYTHRASF.Skill.AcquisitionChatMessage", {
          skill: foundry.utils.escapeHTML(result.name),
          cost: NEW_SKILL_EXPERIENCE_COST,
          remaining: remainingExperience
        })
      });
    }
    await this.render({ force: true });
  }

  async #adjustResource(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const button = event.currentTarget;
    const key = button.dataset.resource;
    const action = button.dataset.resourceAction;
    const resource = this.actor.system.resources[key];
    const maximum = this.actor.system.attributes[`${key}Max`];
    if (!resource || maximum === undefined) return;

    const value = calculateResourceValue(resource.value, maximum, action);
    await this.actor.update({ [`system.resources.${key}.value`]: value });
  }

  async #updateSkillField(event) {
    if (!this.isEditable) return;

    const field = event.currentTarget;
    const itemId = field.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    const value = field.type === "checkbox"
      ? field.checked
      : Math.max(0, Number.parseInt(field.value, 10) || 0);
    await item.update({ [`system.${field.dataset.skillField}`]: value });
  }

  async #updatePassionField(event) {
    if (!this.isEditable) return;

    const field = event.currentTarget;
    const itemId = field.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item || item.type !== "passion") return;

    const value = Math.max(0, Number.parseInt(field.value, 10) || 0);
    await item.update({ [`system.${field.dataset.passionField}`]: value });
  }
}
