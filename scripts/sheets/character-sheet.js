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
import { ARMOR_SOURCES } from "../data/armor.js";
import { WEAPON_SOURCES } from "../data/weapons.js";
import { equipmentIcon } from "../data/equipment.js";
import { MYTHRAS_REVISED_SOURCE } from "../data/sources.js";
import { COMBAT_STYLE_TRAIT_SOURCES } from "../data/traits.js";
import { traitReference } from "../rules/traits.js";
import {
  BACKGROUND_BUDGETS,
  AGE_CATEGORIES,
  allocationRemaining as backgroundAllocationRemaining,
  createBackgroundDraft,
  culturePassionDrafts,
  finalizeBackgroundCreation,
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
  validatePassionSelection,
  validateSocialClassSelection
} from "../rules/background-generation.js";
import {
  CHARACTER_GENERATION_METHODS,
  CHARACTERISTIC_MINIMUMS,
  adjustPointAllocation,
  calculateAllocationRemaining,
  canSwapCharacteristics,
  initialAllocationForGenerationMethod
} from "../rules/character-generation.js";
import { calculateResourceValue } from "../rules/resources.js";
import { calculatePassionBase, PASSION_OBJECT_TYPES, PASSION_VERBS } from "../rules/passions.js";
import { difficultyTarget, resolveWeaponStyle,
  UNTRAINED_COMBAT_STYLE_ID } from "../rules/combat.js";
import { createAttackMessage } from "../rules/combat-chat.js";
import { assessWeaponEquip, weaponHandsRequired } from "../rules/equipment.js";
import { inventoryCarried, inventoryLocation, inventoryRows,
  inventorySections } from "../rules/inventory.js";
import { encumbranceState, itemEncumbrance,
  skillUsesStrengthOrDexterity, totalCarriedEncumbrance } from "../rules/encumbrance.js";
import { findWeaponMode, weaponModeDisplayName, weaponModes, weaponModeView } from "../rules/weapon-modes.js";
import { armorCoverageLocations, armorFitsWearer, armorPhysicalTotals,
  armorInitiativePenalty, totalArmorPoints,
  wornArmorPoints } from "../rules/armor.js";
import { applyFatigue, combinedConditionLevel, combineDifficulties, fatigueLevel,
  FATIGUE_LEVELS, worsenDifficulty } from "../rules/fatigue.js";
import { hasSeriousWound, worstWoundLevel,
  woundPenaltyKey } from "../rules/hit-locations.js";
import { penalizedResource, penalizedValue } from "../rules/penalties.js";
import { penaltySummary } from "../rules/penalty-summary.js";
import { actorLoadState, resolveActorConditions } from "../rules/actor-conditions.js";
import { INCAPACITATED_FLAG_SCOPE,
  INCAPACITATED_MANUAL_FLAG } from "../rules/incapacitated.js";
import { activeSkillStatusPenalties, activeStatusRules, canActorAttack,
  UNCONSCIOUS_STATUS_ID } from "../rules/statuses.js";
import { prepareActiveStatusControls, preparePenaltySummary } from "../ui/penalties.js";
import { bindSheetEvents } from "../ui/sheet-events.js";
import { nextNumberedItemName } from "../rules/item-names.js";
import { replaceFormula, SIMPLE_WEAPON_KEYS, startingEquipmentRule,
  validateStartingEquipment } from "../rules/starting-equipment.js";
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
    classes: ["mythras-foundry", "mythras-paper-sheet", "actor-sheet", "character-sheet"],
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
    const allInventoryItems = [...equipment, ...weapons, ...armor];
    const prepareInventoryRows = (sectionItems) => inventoryRows(sectionItems).map((row) => ({ ...row,
      handsRequired: row.isWeapon ? weaponHandsRequired(row.item) : 0,
      encumbrance: itemEncumbrance(row.item),
      priceLabel: `${Number(row.system.value ?? 0)} ${game.i18n.localize(
        `MYTHRASF.Currency.${row.system.currency ?? "silver"}`)}`,
      locationLabel: inventoryLocation(row.item, allInventoryItems) === "person"
        ? game.i18n.localize("MYTHRASF.Item.Carried")
        : inventoryLocation(row.item, allInventoryItems),
      groupLabel: game.i18n.localize(`MYTHRASF.Inventory.Category.${row.groupKey}`),
      categoryLabel: row.isWeapon ? game.i18n.localize("TYPES.Item.weapon")
        : row.isArmor ? game.i18n.localize("TYPES.Item.armor")
          : game.i18n.localize(`MYTHRASF.ItemClass.${row.system.category}`) }));
    const equipmentRows = prepareInventoryRows(allInventoryItems);
    const preparedInventorySections = inventorySections(allInventoryItems).map((section) => ({
      ...section,
      label: section.property?.name ?? game.i18n.localize("MYTHRASF.Inventory.OnPerson"),
      rows: prepareInventoryRows(section.items)
    }));
    const equippedArmor = armor.filter((item) => item.system.equipped);
    const carriedEncumbrance = totalCarriedEncumbrance(allInventoryItems);
    const loadState = encumbranceState(carriedEncumbrance, this.actor.system.strength);
    const currentFatigue = fatigueLevel(this.actor.system.fatigueLevel);
    const currentWound = worstWoundLevel(hitLocations);
    const manuallyIncapacitated = Boolean(
      this.actor.getFlag(INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG)
    );
    const currentCondition = combinedConditionLevel(
      currentFatigue.key, currentWound, manuallyIncapacitated
    );
    const activeSkillStatuses = activeSkillStatusPenalties(this.actor.statuses);
    const activeStatuses = activeStatusRules(this.actor.statuses);
    const activeStatusControls = prepareActiveStatusControls(this.actor, {
      fatigueKey: currentFatigue.key, woundLevel: currentWound
    });
    const actionPointRules = getActionPointRules();
    const baseAttributes = this.actor.system.baseAttributes
      ?? calculateDerivedAttributes(this.actor.system, actionPointRules);
    const conditionResolution = resolveActorConditions(this.actor, {
      baseAttributes, fatigueKey: currentFatigue.key, loadState
    });
    const fatiguedAttributes = applyFatigue(baseAttributes, currentCondition.key);
    const effectiveAttributes = conditionResolution.attributes;
    const attributeTooltips = this.#attributeTooltips({
      actionPointRules, baseAttributes, effectiveAttributes, fatiguedAttributes,
      currentFatigue, currentCondition, equippedArmor, loadState
    });
    const penalties = preparePenaltySummary(penaltySummary({
      baseAttributes,
      fatigueKey: currentFatigue.key,
      woundLevel: currentWound,
      manuallyIncapacitated,
      skillStatuses: activeSkillStatuses,
      activeStatuses,
      loadState,
      armorPenalty: armorInitiativePenalty(equippedArmor),
      unconscious: this.actor.statuses.has(UNCONSCIOUS_STATUS_ID)
    }));
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
      minimum: CHARACTERISTIC_MINIMUMS[key],
      swapChoices: CHARACTERISTIC_KEYS
        .filter((candidate) => canSwapCharacteristics(key, candidate))
        .map((candidate) => ({
          key: candidate,
          label: game.i18n.localize(`MYTHRASF.Characteristic.${candidate}`)
        }))
    }));
    const characteristicsGenerated = this.actor.system.characteristicsGenerated;
    const generationMethod = this.actor.system.generationMethod;
    const generationMethods = CHARACTER_GENERATION_METHODS.map((key) => ({
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
        magicPoints: this.actor.statuses.has(UNCONSCIOUS_STATUS_ID) ? "0/0"
          : `${this.actor.system.resources.magicPoints.value}/${this.actor.system.attributes.magicPointsMax}`,
        luckPoints: this.actor.statuses.has(UNCONSCIOUS_STATUS_ID) ? "0/0"
          : `${this.actor.system.resources.luckPoints.value}/${this.actor.system.attributes.luckPointsMax}`,
        fatigue: game.i18n.localize(`MYTHRASF.Fatigue.Level.${currentFatigue.key}`),
        fatigueKey: currentFatigue.key,
        wound: game.i18n.localize(`MYTHRASF.Wound.${currentWound}`),
        woundKey: currentWound,
        woundPenalty: game.i18n.localize(
          `MYTHRASF.Header.WoundPenalty.${woundPenaltyKey(currentWound)}`),
        fatiguePenalty: currentFatigue.skillDifficulty === "standard"
          ? game.i18n.localize("MYTHRASF.Fatigue.NoPenalty")
          : game.i18n.localize(`MYTHRASF.Difficulty.${currentFatigue.skillDifficulty}`),
        encumbrance: `${carriedEncumbrance}/${loadState.easyLimit}`,
        encumbranceTitle: game.i18n.format("MYTHRASF.Encumbrance.Summary", {
          total: carriedEncumbrance, easy: loadState.easyLimit,
          overloaded: loadState.overloadedLimit, maximum: loadState.maximum
        }),
        encumbrancePenalty: game.i18n.localize(
          `MYTHRASF.Encumbrance.Penalty.${loadState.key}`),
        encumbrancePenaltyTitle: game.i18n.localize(
          `MYTHRASF.Encumbrance.Detail.${loadState.key}`)
      },
      attributePenalties: {
        actionPoints: actionPointsDisplay,
        initiative: { ...penalizedValue(baseAttributes.initiative, effectiveAttributes.initiative),
          title: this.#initiativePenaltyTitle(currentCondition, equippedArmor,
            currentCondition.key !== currentFatigue.key) },
        movement: penalizedValue(baseAttributes.movementRate, effectiveAttributes.movementRate)
      },
      attributeTooltips,
      penalties,
      activeStatusControls,
      hasActiveStatusControls: activeStatusControls.length > 0,
      generationMethod,
      generationMethods,
      isPointAllocation: !characteristicsGenerated && generationMethod === "points",
      isFreeAllocation: !characteristicsGenerated && generationMethod === "free",
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
      equipment: equipmentRows,
      inventorySections: preparedInventorySections,
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
          .join(", "),
        traits: (style.system.traitRefs ?? [])
          .map((reference) => reference.name || reference.key).join(", "),
        total: Number(style.system.total ?? 0),
        totalDisplay: penalizedValue(
          Number(style.system.total ?? 0),
          difficultyTarget(Number(style.system.total ?? 0),
            conditionResolution.difficulties.physical)
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
      meleeCombatWeapons: combatWeapons.filter((row) => !["ranged", "siege"].includes(row.mode.weaponType)),
      rangedCombatWeapons: combatWeapons.filter((row) => ["ranged", "siege"].includes(row.mode.weaponType))
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
    resolution.difficulty = this.#conditionResolution({ baseDifficulty: resolution.difficulty,
      physical: true }).difficulty;
    const candidates = resolution.matching.length ? resolution.matching : combatStyles;
    const effectiveTarget = difficultyTarget(resolution.target, resolution.difficulty);
    return {
      item: weapon,
      mode,
      displayName: weaponModeDisplayName(weapon, mode),
      handsRequired: weaponHandsRequired(weapon, mode),
      prepared: Boolean(weapon.system.equipped && weapon.system.activeModeKey === mode.key),
      styleOptions: [
        ...candidates.map((style) => ({
          id: style.id,
          name: style.name,
          selected: style.id === resolution.style?.id
        })),
        ...(resolution.matching.length === 0 ? [{
          id: UNTRAINED_COMBAT_STYLE_ID,
          name: game.i18n.localize("MYTHRASF.Combat.Untrained"),
          selected: resolution.untrained
        }] : [])
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
      baseTarget: resolution.target,
      effectiveTarget,
      hasTargetPenalty: effectiveTarget !== resolution.target,
      canAttack: canActorAttack(this.actor.statuses)
        && resolution.difficulty !== "impossible" && weapon.system.equipped && weapon.system.activeModeKey === mode.key
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

    bindSheetEvents(this.element, [
      ["[data-tab]", "click", (event) => this.#activateTab(event)],
      ["[data-action='confirm-characteristics']", "click", () => this.#confirmCharacteristics()],
      ["[data-generation-method]", "click", (event) => this.#selectGenerationMethod(event)],
      ["[data-action='toggle-edit-mode']", "click", () => this.#toggleEditMode()],
      ["[data-action='train-skill']", "click", () => this.#showTrainingPlaceholder()],
      ["[data-action='choose-portrait']", "click", () => this.#choosePortrait()],
      ["[data-action='view-portrait']", "click", () => this.#viewPortrait()],
      ["[data-action='adjust-characteristic']", "click", (event) => this.#adjustCharacteristic(event)],
      ["[data-swap-characteristic]", "change", (event) => this.#swapCharacteristic(event)],
      ["[data-background-select]", "change", (event) => this.#selectBackground(event)],
      ["[data-background-choice]", "change", (event) => this.#toggleBackgroundChoice(event)],
      ["[data-background-passion-field]", "change", (event) => this.#updateBackgroundPassion(event)],
      ["[data-background-professional]", "change", (event) => this.#toggleBackgroundProfessional(event)],
      ["[data-background-specialization]", "change", (event) => this.#updateBackgroundSpecialization(event)],
      ["[data-background-style-field]", "change", (event) => this.#updateBackgroundStyle(event)],
      ["[data-background-style-trait]", "change", (event) => this.#toggleBackgroundStyleTrait(event)],
      ["[data-background-style-action]", "click", (event) => this.#changeBackgroundStyles(event)],
      ["[data-background-free-field]", "change", (event) => this.#updateFreeSkill(event)],
      ["[data-background-age-field]", "change", (event) => this.#updateBackgroundAge(event)],
      ["[data-action='roll-background-age']", "click", (event) => this.#rollBackgroundAge(event)],
      ["[data-background-social-class]", "change", (event) => this.#selectSocialClass(event)],
      ["[data-action='roll-social-class']", "click", (event) => this.#rollSocialClass(event)],
      ["[data-background-points]", "change", (event) => this.#updateBackgroundPoints(event)],
      ["[data-background-points-action]", "click", (event) => this.#adjustBackgroundPoints(event)],
      ["[data-background-navigation]", "click", (event) => this.#navigateBackground(event)],
      ["[data-action='confirm-background']", "click", () => this.#confirmBackground()],
      ["[data-action='create-item']", "click", (event) => this.#createItem(event)],
      ["[data-action='edit-item']", "click", (event) => this.#editItem(event)],
      ["[data-action='delete-item']", "click", (event) => this.#deleteItem(event)],
      ["[data-action='toggle-equipped']", "click", (event) => this.#toggleEquipped(event)],
      ["[data-action='toggle-container']", "click", (event) => this.#toggleContainer(event)],
      ["[data-action='sell-item']", "click", (event) => this.#sellItem(event)],
      ["[data-property-funds]", "change", (event) => this.#updatePropertyFunds(event)],
      ["[data-action='buy-item']", "click", (event) => game.mythrasFoundry?.shop?.open?.({
        actorUuid: this.actor.uuid,
        destinationId: event.currentTarget.dataset.walletId ?? "person"
      })],
      ["[data-action='transfer-money']", "click", (event) => this.#transferMoney(event)],
      ["[data-active-weapon-mode]", "change", (event) => this.#prepareWeaponMode(event)],
      ["[data-fatigue-level]", "change", (event) => this.#updateFatigue(event)],
      ["[data-incapacitated-manual]", "change", (event) => this.#toggleManualIncapacitated(event)],
      ["[data-status-toggle]", "change", (event) => this.#toggleStatus(event)],
      ["[data-location-disabled]", "change", (event) => this.#updateLocationDisabled(event)],
      ["[data-location-armor]", "change", (event) => this.#updateLocationArmor(event)],
      ["[data-action='roll-skill']", "click", (event) => this.#rollSkill(event)],
      ["[data-action='improve-skill']", "click", (event) => this.#improveSkill(event)],
      ["[data-action='roll-passion']", "click", (event) => this.#rollPassion(event)],
      ["[data-passion-adjust]", "click", (event) => this.#adjustPassion(event)],
      ["[data-action='add-skill-from-pack']", "click", (event) => this.#addSkillFromPack(event)],
      ["[data-action='create-combat-style']", "click", () => this.#createCombatStyle()],
      ["[data-resource-action]", "click", (event) => this.#adjustResource(event)],
      ["[data-skill-field]", "change", (event) => this.#updateSkillField(event)],
      ["[data-passion-field]", "change", (event) => this.#updatePassionField(event)],
      ["[data-combat-style]", "change", (event) => this.#updateWeaponCombatChoice(event)],
      ["[data-combat-familiarity]", "change", (event) => this.#updateWeaponCombatChoice(event)],
      ["[data-action='roll-weapon-attack']", "click", (event) => this.#rollWeaponAttack(event)]
    ]);
    this.#showTab(this._activeTab ?? "character");
    this.#activateInventoryDragAndDrop();
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
    if (!item.system.equipped && !inventoryCarried(item, this.actor.items.filter((candidate) =>
      ["equipment", "weapon", "armor"].includes(candidate.type)))) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Item.StoredCannotEquip"));
      return;
    }
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
    if (!armorFitsWearer(item, this.actor)) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Armor.SizeMismatch"));
      return false;
    }
    const locationIds = new Set(this.actor.items
      .filter((candidate) => candidate.type === "hitLocation").map((location) => location.id));
    const selectedIds = Array.from(item.system.coveredLocationIds ?? [])
      .filter((id) => locationIds.has(id));
    if (!selectedIds.length) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Armor.CoverageRequired"));
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
      initiativePenalty: totals.encumbrance > 0 ? Math.ceil(totals.encumbrance / 5) : 0,
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
    return this.#conditionResolution({ fatigueKey }).condition;
  }

  #skillDifficulty() {
    return this.#conditionResolution().difficulties.general;
  }

  #conditionResolution({ baseDifficulty = "standard", physical = false,
    situational = false, fatigueKey = this.actor.system.fatigueLevel } = {}) {
    const baseAttributes = this.actor.system.baseAttributes
      ?? calculateDerivedAttributes(this.actor.system, getActionPointRules());
    return resolveActorConditions(this.actor, { baseAttributes, baseDifficulty, physical,
      situational, fatigueKey, loadState: this.#loadState() });
  }

  async #toggleManualIncapacitated(event) {
    if (!this.isEditable) return;
    await this.actor.update({
      [`flags.${INCAPACITATED_FLAG_SCOPE}.${INCAPACITATED_MANUAL_FLAG}`]: event.currentTarget.checked
    });
  }

  async #toggleStatus(event) {
    if (!this.isEditable) return;
    await this.actor.toggleStatusEffect(event.currentTarget.dataset.statusToggle, {
      active: event.currentTarget.checked
    });
  }

  #loadState() {
    return actorLoadState(this.actor);
  }

  #initiativePenaltyTitle(condition, equippedArmor, causedByWound = false) {
    const armorPenalty = armorInitiativePenalty(equippedArmor);
    const parts = [];
    if (condition.initiativePenalty) parts.push(game.i18n.format(
      causedByWound ? "MYTHRASF.InitiativePenalty.Wound"
        : "MYTHRASF.InitiativePenalty.Fatigue", { penalty: condition.initiativePenalty }));
    if (armorPenalty) parts.push(game.i18n.format(
      "MYTHRASF.InitiativePenalty.Armor", { penalty: armorPenalty }));
    return parts.length ? parts.join("\n")
      : game.i18n.localize("MYTHRASF.InitiativePenalty.None");
  }

  #attributeTooltips({ actionPointRules, baseAttributes, effectiveAttributes,
    fatiguedAttributes, currentFatigue, currentCondition, equippedArmor, loadState }) {
    const system = this.actor.system;
    const join = (...parts) => parts.filter(Boolean).join(" ");
    const actionPoints = actionPointRules.method === "calculated"
      ? game.i18n.format("MYTHRASF.AttributeTooltip.ActionPointsCalculated", {
        intelligence: system.intelligence, dexterity: system.dexterity,
        total: Number(system.intelligence) + Number(system.dexterity),
        result: baseAttributes.actionPointsMax
      })
      : game.i18n.format("MYTHRASF.AttributeTooltip.ActionPointsFixed", {
        result: baseAttributes.actionPointsMax
      });
    const causedByWound = currentCondition.key !== currentFatigue.key;
    const actionPointPenalty = currentCondition.actionPointPenalty
      ? game.i18n.format(causedByWound
        ? "MYTHRASF.AttributeTooltip.WoundPenalty"
        : "MYTHRASF.AttributeTooltip.FatiguePenalty", {
        penalty: currentCondition.actionPointPenalty,
        effective: effectiveAttributes.actionPointsMax
      }) : game.i18n.localize("MYTHRASF.AttributeTooltip.NoModifiers");
    const movementFatigue = fatiguedAttributes.movementRate !== baseAttributes.movementRate
      ? game.i18n.format(causedByWound
        ? "MYTHRASF.AttributeTooltip.MovementWound"
        : "MYTHRASF.AttributeTooltip.MovementFatigue", {
        effective: fatiguedAttributes.movementRate
      }) : "";
    const movementLoad = effectiveAttributes.movementRate !== fatiguedAttributes.movementRate
      ? game.i18n.format("MYTHRASF.AttributeTooltip.MovementLoad", {
        state: game.i18n.localize(`MYTHRASF.Encumbrance.Penalty.${loadState.key}`),
        effective: effectiveAttributes.movementRate
      }) : "";
    return {
      actionPoints: join(actionPoints, actionPointPenalty),
      damageModifier: game.i18n.format("MYTHRASF.AttributeTooltip.DamageModifier", {
        strength: system.strength, size: system.size,
        total: Number(system.strength) + Number(system.size),
        result: baseAttributes.damageModifier.label
      }),
      experienceModifier: game.i18n.format("MYTHRASF.AttributeTooltip.ExperienceModifier", {
        charisma: system.charisma, result: baseAttributes.experienceModifier
      }),
      healingRate: game.i18n.format("MYTHRASF.AttributeTooltip.HealingRate", {
        constitution: system.constitution, result: baseAttributes.healingRate
      }),
      initiative: join(game.i18n.format("MYTHRASF.AttributeTooltip.Initiative", {
        dexterity: system.dexterity, intelligence: system.intelligence,
        result: baseAttributes.initiative
      }), this.#initiativePenaltyTitle(currentCondition, equippedArmor, causedByWound)),
      luckPoints: game.i18n.format("MYTHRASF.AttributeTooltip.LuckPoints", {
        power: system.power, result: baseAttributes.luckPointsMax
      }),
      magicPoints: game.i18n.format("MYTHRASF.AttributeTooltip.MagicPoints", {
        power: system.power, result: baseAttributes.magicPointsMax
      }),
      movement: join(game.i18n.format("MYTHRASF.AttributeTooltip.Movement", {
        result: baseAttributes.movementRate
      }), movementFatigue, movementLoad,
      !movementFatigue && !movementLoad
        ? game.i18n.localize("MYTHRASF.AttributeTooltip.NoModifiers") : "")
    };
  }

  async #applySeriousWoundPenalty(difficulty) {
    return this.#resolveSituationalDifficulty(difficulty);
  }

  async #resolveSituationalDifficulty(baseDifficulty, physical = false) {
    const locations = this.actor.items.filter((item) => item.type === "hitLocation");
    let situational = false;
    if (hasSeriousWound(locations)) {
      situational = await DialogV2.confirm({
        window: { title: game.i18n.localize("MYTHRASF.Wound.ApplyPenaltyTitle") },
        content: `<div class="mythras-foundry mythras-dialog"><p>${game.i18n.localize("MYTHRASF.Wound.ApplyPenaltyPrompt")}</p></div>`,
        yes: { label: game.i18n.localize("MYTHRASF.Wound.ApplyPenalty") },
        no: { label: game.i18n.localize("MYTHRASF.Wound.IgnorePenalty") }
      });
    }
    return this.#conditionResolution({ baseDifficulty, physical, situational }).difficulty;
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
    if (!canActorAttack(this.actor.statuses)) {
      return ui.notifications.warn(game.i18n.localize("MYTHRASF.Status.CannotAttack"));
    }
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
    resolution.difficulty = await this.#resolveSituationalDifficulty(
      resolution.difficulty, true);
    if (resolution.difficulty === "impossible") {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Fatigue.NoActivity"));
      return;
    }
    if (!resolution.style && !resolution.usesBase) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Combat.SelectStyle"));
      return;
    }
    const targets = Array.from(game.user.targets ?? []);
    await createAttackMessage({ actor: this.actor, weapon, mode, resolution,
      target: targets.length === 1 ? targets[0] : null });
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
    const allocation = initialAllocationForGenerationMethod(
      method, this.actor.system.generationMethod
    );
    if (["points", "free"].includes(method)) {
      const update = { "system.generationMethod": method };
      if (allocation) {
        for (const [key, value] of Object.entries(allocation)) {
          update[`system.${key}`] = value;
        }
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
      isPassions: stage === "passions",
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
      passionRows: draft.passions.map((passion, index) => ({
        ...passion,
        index,
        number: index + 1,
        isPerson: passion.objectType === "person",
        isCustomVerb: passion.verb === "other",
        total: calculatePassionBase(
          passion.objectType, this.actor.system, passion.targetCharisma
        ) + Number(passion.creationBonus ?? 0),
        verbChoices: PASSION_VERBS.map((value) => ({
          value,
          label: game.i18n.localize(`MYTHRASF.Passion.Verb.${value}`),
          selected: value === passion.verb
        })),
        objectChoices: PASSION_OBJECT_TYPES.map((value) => ({
          value,
          label: game.i18n.localize(`MYTHRASF.Passion.Object.${value}`),
          selected: value === passion.objectType
        }))
      })),
      showPassionSummary: !["culture", "passions"].includes(stage)
        && draft.passions.length > 0,
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
              traitOptions: COMBAT_STYLE_TRAIT_SOURCES.map((trait) => ({
                key: trait.buildKey, name: trait.name,
                checked: (ability.traitKeys ?? []).includes(trait.buildKey)
              })),
              canRemove: !ability.required
            }))
        }
        : null,
      selectedProfessionalCount: selectedProfessionals.size,
      freeProfessionalOptions: ALL_SKILL_SOURCES.filter((source) => (
        source.system.category === "professional"
      )).map((source) => ({
        slug: source.system.slug,
        name: source.name,
        group: source.system.group,
        selected: draft.freeProfessional.type !== "combatStyle"
          && source.system.slug === draft.freeProfessional.slug
      })),
      freeCombatStyleSelected: draft.freeProfessional.type === "combatStyle",
      freeExistingCombatStyles: this.#existingCombatStyleNames(),
      freeProfessional: draft.freeProfessional,
      freeCombatStyleTraitOptions: COMBAT_STYLE_TRAIT_SOURCES.map((trait) => ({
        key: trait.buildKey, name: trait.name,
        checked: (draft.freeProfessional.traitKeys ?? []).includes(trait.buildKey)
      })),
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
    const difficulty = this.#conditionResolution({
      physical: skillUsesStrengthOrDexterity(item)
    }).difficulty;
    const row = {
      id: item.id,
      name: item.name,
      type: item.type,
      system: item.system,
      totalDisplay: penalizedValue(total, difficultyTarget(total, difficulty))
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
          ...(ability.type === "combatStyle"
            ? { "system.traitRefs": this.#backgroundTraitReferences(ability.traitKeys) }
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
    for (const ability of desired.filter((candidate) => candidate.type === "combatStyle")) {
      const item = this.actor.items.find((candidate) => (
        candidate.type === "combatStyle"
        && styleAbilityKey(candidate.name) === ability.key
      ));
      if (!item) return true;
      const desiredTraitKeys = new Set(ability.traitKeys ?? []);
      const currentTraitKeys = new Set((item.system.traitRefs ?? []).map((trait) => trait.key));
      if (
        desiredTraitKeys.size !== currentTraitKeys.size
        || [...desiredTraitKeys].some((key) => !currentTraitKeys.has(key))
      ) return true;
    }
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
          ...points,
          experiencePoints: 0,
          trained: false,
          fumbled: false,
          weaponProfiles: parseWeaponProfileReferences(ability.weapons),
          traitRefs: this.#backgroundTraitReferences(ability.traitKeys),
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

  #backgroundTraitReferences(keys = []) {
    const selected = new Set(keys ?? []);
    return COMBAT_STYLE_TRAIT_SOURCES.filter((trait) => selected.has(trait.buildKey))
      .map((trait) => traitReference(trait));
  }

  async #selectBackground(event) {
    if (!this.isEditable) return;
    const type = event.currentTarget.dataset.backgroundSelect;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    if (type === "culture") {
      Object.assign(draft, createBackgroundDraft(), {
        cultureKey: event.currentTarget.value,
        passions: culturePassionDrafts(getCulture(event.currentTarget.value))
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

  async #updateBackgroundPassion(event) {
    if (!this.isEditable) return;
    const { index, backgroundPassionField: field } = event.currentTarget.dataset;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const passion = draft.passions[Number(index)];
    if (!passion) return;
    passion[field] = ["targetCharisma", "creationBonus"].includes(field)
      ? Number.parseInt(event.currentTarget.value, 10) || 0
      : event.currentTarget.value.trim();
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

  async #toggleBackgroundStyleTrait(event) {
    const { style, traitKey, free } = event.currentTarget.dataset;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const target = free === "true" ? draft.freeProfessional : draft.styles[style];
    if (!target) return;
    const selected = new Set(target.traitKeys ?? []);
    if (event.currentTarget.checked) selected.add(traitKey);
    else selected.delete(traitKey);
    target.traitKeys = [...selected];
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
      draft.styles[id] = { name: "", weapons: "", traits: "", traitKeys: [] };
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

  async #rollBackgroundAge(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const category = getAgeCategory(draft.ageCategory);
    if (!category) return;
    const roll = await new Roll(category.ageFormula).evaluate();
    draft.age = Number(roll.total);
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
          type: "skill", slug: value, name: "", weapons: "", traits: "", traitKeys: []
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
        passions: "culture",
        socialClass: "passions",
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
      : draft.stage === "passions"
        ? validatePassionSelection(draft)
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
      culture: "passions", passions: "socialClass", socialClass: "profession", profession: "age",
      age: "free", free: "review"
    }[draft.stage];
    if (previousStage === "passions"
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
      || !validatePassionSelection(draft).valid
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

    const startingEquipment = await this.#chooseStartingEquipment(draft);
    if (!startingEquipment) return;

    const [cultureDocument, professionDocument] = await Promise.all([
      this.#getBackgroundDocument("cultures", culture.key),
      this.#getBackgroundDocument("professions", profession.key)
    ]);
    const socialClass = getSocialClass(draft.cultureKey, draft.socialClassKey);
    this._backgroundSyncing = true;
    try {
      await finalizeBackgroundCreation({
        sync: () => this.#syncBackgroundItems(draft),
        complete: () => this.actor.update({
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
        }),
        finalizeItems: async () => {
          const updates = this.actor.items
            .filter((item) => item.getFlag(
              "mythras-foundry", "backgroundDraftAbility"
            ))
            .map((item) => ({
              _id: item.id,
              "flags.mythras-foundry.backgroundAbility": item.getFlag(
                "mythras-foundry", "backgroundDraftAbility"
              ),
              "flags.mythras-foundry.-=backgroundDraftAbility": null
            }));
          if (updates.length > 0) {
            await this.actor.updateEmbeddedDocuments("Item", updates);
          }
          const existing = new Set(this.actor.items
            .filter((item) => item.type === "passion")
            .map((item) => item.getFlag("mythras-foundry", "culturalPassion"))
            .filter(Boolean));
          const passionItems = draft.passions.flatMap((passion, index) => {
            const flag = `${culture.key}:${index}`;
            if (existing.has(flag)) return [];
            const verb = passion.verb === "other"
              ? passion.customVerb
              : game.i18n.localize(`MYTHRASF.Passion.Verb.${passion.verb}`);
            return [{
              name: `${verb} (${passion.objectDescription})`,
              type: "passion",
              img: defaultItemIcon("passion"),
              system: {
                structured: true,
                ...passion,
                experiencePoints: 0,
                manualAdjustment: 0,
                value: 0,
                description: ""
              },
              flags: { "mythras-foundry": { culturalPassion: flag } }
            }];
          });
          if (passionItems.length > 0) {
            await this.actor.createEmbeddedDocuments("Item", passionItems);
          }
          const equipmentItems = this.#startingEquipmentItems(startingEquipment);
          const alreadyGranted = this.actor.items.some((item) => item.getFlag(
            "mythras-foundry", "startingEquipment"));
          if (!alreadyGranted && equipmentItems.length > 0) {
            await this.actor.createEmbeddedDocuments("Item", equipmentItems);
          }
        }
      });
    } finally {
      this._backgroundSyncing = false;
    }
    ui.notifications.info(game.i18n.localize("MYTHRASF.Background.Completed"));
  }

  async #rollStartingValue(formula) {
    if (!formula || formula === "0") return 0;
    if (/^\d+$/.test(formula)) return Number(formula);
    return Number((await new Roll(formula).evaluate()).total ?? 0);
  }

  async #chooseStartingEquipment(draft) {
    const rule = startingEquipmentRule(draft.socialClassKey);
    let rolls = draft.startingEquipment?.rolls;
    if (!rolls) {
      const [clothingCount, weaponCount, armorPoints, rolledLocations] = await Promise.all([
        this.#rollStartingValue(rule.clothingFormula ?? "0"),
        this.#rollStartingValue(rule.weaponFormula),
        this.#rollStartingValue(rule.armorFormula),
        this.#rollStartingValue(rule.armorLocationsFormula)
      ]);
      rolls = {
        clothingCount, weaponCount: Math.max(0, weaponCount),
        armorPoints: Math.max(0, armorPoints),
        armorLocations: armorPoints > 0 ? Math.max(0, rolledLocations) : 0,
        transportRequired: rule.transport.length > 0
      };
      draft.startingEquipment = { rolls };
      await this.#saveBackgroundDraft(draft);
    }
    const weapons = WEAPON_SOURCES.filter((source) => (
      Number(source.system.crewMinimum ?? 0) === 0
      && (rule.weaponTier !== "simple" || SIMPLE_WEAPON_KEYS.has(source.buildKey))
    )).sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang));
    const armor = ARMOR_SOURCES.filter((source) => (
      source.system.armorPoints === rolls.armorPoints
      && source.system.referenceLocation !== "special"
    ));
    const optionList = (entries) => entries.map((entry) => (
      `<option value="${entry.buildKey}">${foundry.utils.escapeHTML(entry.name)}</option>`
    )).join("");
    const weaponFields = Array.from({ length: rolls.weaponCount }, (_, index) => (
      `<label><span>${game.i18n.format("MYTHRASF.StartingEquipment.WeaponNumber", { number: index + 1 })}</span><select name="weapon-${index}"><option value=""></option>${optionList(weapons)}</select></label>`
    )).join("");
    const armorFields = Array.from({ length: rolls.armorLocations }, (_, index) => (
      `<label><span>${game.i18n.format("MYTHRASF.StartingEquipment.ArmorNumber", { number: index + 1 })}</span><select name="armor-${index}"><option value=""></option>${optionList(armor)}</select></label>`
    )).join("");
    const transportOptions = rule.transport.map((name) => (
      `<option value="${foundry.utils.escapeHTML(name)}">${foundry.utils.escapeHTML(name)}</option>`
    )).join("");
    const clothing = replaceFormula(rule.clothing, rule.clothingFormula, rolls.clothingCount);
    const result = await DialogV2.input({
      window: { title: game.i18n.localize("MYTHRASF.StartingEquipment.Title") },
      content: `<div class="starting-equipment-dialog">
        <fieldset><legend>${game.i18n.localize("MYTHRASF.StartingEquipment.Clothing")}</legend><p>${foundry.utils.escapeHTML(clothing)}</p></fieldset>
        <fieldset><legend>${game.i18n.format("MYTHRASF.StartingEquipment.Weapons", { count: rolls.weaponCount })}</legend>${weaponFields || `<p>${game.i18n.localize("MYTHRASF.StartingEquipment.None")}</p>`}</fieldset>
        <fieldset class="starting-equipment-armor"><legend>${game.i18n.format("MYTHRASF.StartingEquipment.Armor", { points: rolls.armorPoints, count: rolls.armorLocations })}</legend>${armorFields || `<p>${game.i18n.localize("MYTHRASF.StartingEquipment.None")}</p>`}</fieldset>
        ${rolls.transportRequired ? `<fieldset><legend>${game.i18n.localize("MYTHRASF.StartingEquipment.Transport")}</legend><select name="transport"><option value=""></option>${transportOptions}</select></fieldset>` : ""}
      </div>`,
      ok: { label: game.i18n.localize("MYTHRASF.Background.Confirm"), icon: "fas fa-check",
        callback: (dialogEvent, button) => ({
          clothing,
          weapons: Array.from({ length: rolls.weaponCount }, (_, index) =>
            button.form.elements[`weapon-${index}`].value),
          armor: Array.from({ length: rolls.armorLocations }, (_, index) =>
            button.form.elements[`armor-${index}`].value),
          transport: rolls.transportRequired ? button.form.elements.transport.value : ""
        }) }
    });
    if (!result) return null;
    if (!validateStartingEquipment(result, rolls)) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.StartingEquipment.Incomplete"));
      return null;
    }
    return { rule, rolls, ...result };
  }

  #startingEquipmentItems(selection) {
    const cloneSource = (source) => {
      const data = foundry.utils.deepClone(source);
      delete data.buildKey;
      data.flags = foundry.utils.mergeObject(data.flags ?? {}, {
        "mythras-foundry": { startingEquipment: true }
      });
      return data;
    };
    const items = [{
      name: game.i18n.localize("MYTHRASF.StartingEquipment.Clothing"),
      type: "equipment", img: defaultItemIcon("equipment"),
      system: { source: MYTHRAS_REVISED_SOURCE, category: "clothing", quantity: 1,
        description: `<p>${selection.clothing}</p>` },
      flags: { "mythras-foundry": { startingEquipment: true } }
    }];
    items.push(...selection.weapons.map((key) => cloneSource(
      WEAPON_SOURCES.find((source) => source.buildKey === key))));
    items.push(...selection.armor.map((key) => cloneSource(
      ARMOR_SOURCES.find((source) => source.buildKey === key))));
    if (selection.transport && selection.transport !== "Su propia espalda") {
      const normalized = selection.transport.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const livestock = /bestia|animal|montura/.test(normalized);
      const service = /porteador|esclavo/.test(normalized);
      const category = livestock ? "livestock" : service ? "service" : "vehicle";
      items.push({ name: selection.transport, type: "equipment",
        img: equipmentIcon(category), system: { source: MYTHRAS_REVISED_SOURCE,
          category, quantity: 1, isContainer: ["livestock", "vehicle"].includes(category),
          description: `<p>${game.i18n.localize("MYTHRASF.StartingEquipment.TransportDescription")}</p>` },
        flags: { "mythras-foundry": { startingEquipment: true } } });
    }
    return items.filter(Boolean);
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
    const parentContainerId = event.currentTarget.dataset.parentId ?? "";
    const category = event.currentTarget.dataset.category;
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{ name, type,
      ...(category === "property" ? { name: game.i18n.localize("MYTHRASF.Inventory.NewProperty") } : {}),
      system: { parentContainerId, ...(category ? { category,
        isContainer: category === "property" } : {}) } }]);
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
        <label><span>${game.i18n.localize("MYTHRASF.Passion.TargetCharisma")}</span>
          <input type="number" min="1" name="targetCharisma" value="11"></label>
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
            targetCharisma: Number.parseInt(elements.targetCharisma.value, 10) || 11,
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

  async #toggleContainer(event) {
    event.preventDefault();
    const item = this.actor.items.get(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    if (item?.type !== "equipment" || !item.system.isContainer) return;
    await item.update({ "system.collapsed": !item.system.collapsed });
  }

  async #updatePropertyFunds(event) {
    if (!this.isEditable) return;
    const property = this.actor.items.get(event.currentTarget
      .closest("[data-inventory-destination]")?.dataset.inventoryDestination);
    if (property?.system.category !== "property") return;
    const denomination = event.currentTarget.dataset.propertyFunds;
    await property.update({ [`system.funds.${denomination}`]: Math.max(0,
      Number(event.currentTarget.value ?? 0)) });
  }

  async #transferMoney(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const sourceId = event.currentTarget.dataset.walletId;
    const wallets = [{ id: "person", name: game.i18n.localize("MYTHRASF.Inventory.OnPerson") },
      ...this.actor.items.filter((item) => item.type === "equipment"
        && item.system.category === "property").map((item) => ({ id: item.id, name: item.name }))];
    const destinations = wallets.filter((wallet) => wallet.id !== sourceId);
    if (!destinations.length) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Inventory.TransferNoDestination"));
      return;
    }
    const options = destinations.map((wallet) => `<option value="${wallet.id}">${
      foundry.utils.escapeHTML(wallet.name)}</option>`).join("");
    const result = await DialogV2.input({
      window: { title: game.i18n.localize("MYTHRASF.Inventory.Transfer") },
      content: `<div class="inventory-transfer-dialog">
        <label><span>${game.i18n.localize("MYTHRASF.Inventory.TransferDestination")}</span><select name="destination">${options}</select></label>
        <fieldset class="inventory-transfer-amounts"><legend>${game.i18n.localize("MYTHRASF.Inventory.TransferAmount")}</legend>
          <label><span>PC</span><input type="number" min="0" step="0.01" name="copper" value="0"></label>
          <label><span>PP</span><input type="number" min="0" step="0.01" name="silver" value="0"></label>
          <label><span>PO</span><input type="number" min="0" step="0.01" name="gold" value="0"></label>
        </fieldset>
      </div>`,
      ok: { label: game.i18n.localize("MYTHRASF.Inventory.Transfer"),
        icon: "fas fa-right-left", callback: (dialogEvent, button) => ({
          destinationId: button.form.elements.destination.value,
          amounts: Object.fromEntries(["copper", "silver", "gold"].map((denomination) => (
            [denomination, Math.max(0, Number(button.form.elements[denomination].value) || 0)]
          )))
        }) }
    });
    if (!result) return;
    const transfers = Object.entries(result.amounts).filter(([, amount]) => amount > 0);
    if (!transfers.length) return;
    const walletDocument = (id) => id === "person" ? this.actor : this.actor.items.get(id);
    const walletPath = (id, denomination) => id === "person"
      ? `system.currency.${denomination}` : `system.funds.${denomination}`;
    const source = walletDocument(sourceId);
    const destination = walletDocument(result.destinationId);
    if (!source || !destination) return;
    for (const [denomination, amount] of transfers) {
      const available = Number(foundry.utils.getProperty(
        source, walletPath(sourceId, denomination)) ?? 0);
      if (amount > available) {
        ui.notifications.warn(game.i18n.format("MYTHRASF.Inventory.TransferInsufficient", {
          currency: game.i18n.localize(`MYTHRASF.Currency.${denomination}`)
        }));
        return;
      }
    }
    const sourceUpdate = {};
    const destinationUpdate = {};
    for (const [denomination, amount] of transfers) {
      const sourcePath = walletPath(sourceId, denomination);
      const destinationPath = walletPath(result.destinationId, denomination);
      sourceUpdate[sourcePath] = Number(foundry.utils.getProperty(source, sourcePath) ?? 0) - amount;
      destinationUpdate[destinationPath] = Number(
        foundry.utils.getProperty(destination, destinationPath) ?? 0) + amount;
    }
    await source.update(sourceUpdate);
    await destination.update(destinationUpdate);
  }

  #propertyContaining(item) {
    const byId = new Map(this.actor.items.map((entry) => [entry.id, entry]));
    const visited = new Set();
    let current = item;
    while (current?.system?.parentContainerId) {
      if (visited.has(current.system.parentContainerId)) return null;
      visited.add(current.system.parentContainerId);
      current = byId.get(current.system.parentContainerId);
      if (current?.system?.category === "property") return current;
    }
    return null;
  }

  async #sellItem(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const item = this.actor.items.get(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    const value = Math.max(0, Number(item.system.value ?? 0))
      * Math.max(1, Number(item.system.quantity ?? 1));
    const denomination = item.system.currency ?? "silver";
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("MYTHRASF.Item.Sell") },
      content: `<p>${game.i18n.format("MYTHRASF.Item.SellConfirm", {
        item: foundry.utils.escapeHTML(item.name), value,
        currency: game.i18n.localize(`MYTHRASF.Currency.${denomination}`)
      })}</p>`
    });
    if (!confirmed) return;
    const property = this.#propertyContaining(item);
    if (property) await property.update({ [`system.funds.${denomination}`]:
      Number(property.system.funds?.[denomination] ?? 0) + value });
    else await this.actor.update({ [`system.currency.${denomination}`]:
      Number(this.actor.system.currency?.[denomination] ?? 0) + value });
    const childUpdates = this.actor.items.filter((candidate) => (
      candidate.system?.parentContainerId === item.id
    )).map((candidate) => ({ _id: candidate.id,
      "system.parentContainerId": item.system.parentContainerId ?? "" }));
    if (childUpdates.length) await this.actor.updateEmbeddedDocuments("Item", childUpdates);
    await this.actor.deleteEmbeddedDocuments("Item", [item.id]);
  }

  #activateInventoryDragAndDrop() {
    const inventory = this.element.querySelector("[data-tab-content='inventory']");
    if (!inventory || !this.isEditable) return;
    inventory.querySelectorAll("[data-item-id][draggable='true']").forEach((row) => {
      row.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain",
        JSON.stringify({ type: "Item", uuid: this.actor.items.get(row.dataset.itemId)?.uuid,
          mythrasInventoryItemId: row.dataset.itemId })));
    });
    inventory.querySelectorAll("[data-inventory-destination]").forEach((target) => {
      target.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        target.classList.add("inventory-drop-target");
      });
      target.addEventListener("dragleave", () => target.classList.remove("inventory-drop-target"));
      target.addEventListener("drop", (event) => this.#dropInventoryItem(event, target));
    });
  }

  async #dropInventoryItem(event, target) {
    event.preventDefault();
    event.stopPropagation();
    target.classList.remove("inventory-drop-target");
    let data;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
    if (data.type !== "Item") return;
    const destinationId = target.dataset.inventoryDestination === "person"
      ? "" : target.dataset.inventoryDestination;
    const destination = destinationId ? this.actor.items.get(destinationId) : null;
    if (destinationId && (!destination || !destination.system.isContainer)) return;
    const embedded = data.mythrasInventoryItemId
      ? this.actor.items.get(data.mythrasInventoryItemId) : null;
    if (embedded) {
      if (embedded.id === destinationId || embedded.system.category === "property") return;
      let ancestor = destination;
      while (ancestor) {
        if (ancestor.id === embedded.id) return;
        ancestor = this.actor.items.get(ancestor.system.parentContainerId);
      }
      await embedded.update({ "system.parentContainerId": destinationId });
      return;
    }
    const source = data.uuid ? await fromUuid(data.uuid) : null;
    if (!source || source.documentName !== "Item") return;
    const itemData = source.toObject();
    delete itemData._id;
    itemData.system.parentContainerId = destinationId;
    await this.actor.createEmbeddedDocuments("Item", [itemData]);
  }

  async #deleteItem(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const itemId = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    if (itemId) {
      const item = this.actor.items.get(itemId);
      const childUpdates = this.actor.items.filter((candidate) => (
        candidate.system?.parentContainerId === itemId
      )).map((candidate) => ({ _id: candidate.id,
        "system.parentContainerId": item?.system?.parentContainerId ?? "" }));
      if (childUpdates.length) await this.actor.updateEmbeddedDocuments("Item", childUpdates);
      await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
    }
  }

  async #rollSkill(event) {
    event.preventDefault();
    const row = event.currentTarget.closest("[data-item-id]");
    const item = this.actor.items.get(row?.dataset.itemId);
    const defaultDifficulty = row?.querySelector("[data-difficulty]")?.value ?? "standard";
    const locations = this.actor.items.filter((candidate) => candidate.type === "hitLocation");
    const currentFatigue = fatigueLevel(this.actor.system.fatigueLevel);
    const currentWound = worstWoundLevel(locations);
    const modifiers = [];
    let difficulty = "standard";
    if (currentFatigue.skillDifficulty !== "standard") {
      difficulty = combineDifficulties(difficulty, currentFatigue.skillDifficulty);
      modifiers.push({
        source: game.i18n.format("MYTHRASF.SkillRoll.FatigueSource", {
          level: game.i18n.localize(`MYTHRASF.Fatigue.Level.${currentFatigue.key}`)
        }),
        effect: game.i18n.localize(`MYTHRASF.Difficulty.${currentFatigue.skillDifficulty}`),
        type: "penalty"
      });
    }
    if (currentWound === "major") {
      const woundDifficulty = combinedConditionLevel("fresh", "major").skillDifficulty;
      difficulty = combineDifficulties(difficulty, woundDifficulty);
      modifiers.push({
        source: game.i18n.localize("MYTHRASF.Wound.major"),
        effect: game.i18n.localize(`MYTHRASF.Difficulty.${woundDifficulty}`),
        type: "penalty"
      });
    }
    const beforeStatusPenalty = difficulty;
    difficulty = combineDifficulties(difficulty, this.#conditionLevel().skillDifficulty);
    if (difficulty !== beforeStatusPenalty) {
      modifiers.push({
        source: game.i18n.localize("MYTHRASF.Status.IncapacitatedManual"),
        effect: game.i18n.localize(`MYTHRASF.Difficulty.${difficulty}`),
        type: "penalty"
      });
    }
    for (const status of activeSkillStatusPenalties(this.actor.statuses)) {
      difficulty = combineDifficulties(difficulty, status.skillDifficulty);
      modifiers.push({
        source: game.i18n.localize(status.name),
        effect: game.i18n.localize(`MYTHRASF.Difficulty.${status.skillDifficulty}`),
        type: "penalty"
      });
    }
    if (skillUsesStrengthOrDexterity(item)) {
      const load = this.#loadState();
      if (load.difficultySteps > 0) {
        difficulty = worsenDifficulty(difficulty, load.difficultySteps);
        modifiers.push({
          source: game.i18n.localize("MYTHRASF.SkillRoll.EncumbranceSource"),
          effect: game.i18n.localize(`MYTHRASF.Encumbrance.Penalty.${load.key}`),
          type: "penalty"
        });
      }
    }
    difficulty = this.#conditionResolution({
      physical: skillUsesStrengthOrDexterity(item)
    }).difficulty;
    const beforeWoundPenalty = difficulty;
    difficulty = await this.#applySeriousWoundPenalty(difficulty);
    if (difficulty !== beforeWoundPenalty) {
      modifiers.push({
        source: game.i18n.localize("MYTHRASF.Wound.serious"),
        effect: game.i18n.localize("MYTHRASF.SkillRoll.OneDifficultyStep"),
        type: "penalty"
      });
    }
    await item?.rollSkill({ difficulty, defaultDifficulty, modifiers });
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
        </div>
      `,
      ok: {
        label: game.i18n.localize("MYTHRASF.Add"),
        icon: "fas fa-plus",
        callback: (dialogEvent, button) => ({
          name: button.form.elements.name.value.trim()
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
      weapons: "",
      traits: "",
      traitKeys: [],
      prompt: ""
    }, { culturePoints: 0, professionPoints: 0, freePoints: 0 });
    const [createdStyle] = await this.actor.createEmbeddedDocuments("Item", [data]);
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
    createdStyle?.sheet?.render(true);
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
