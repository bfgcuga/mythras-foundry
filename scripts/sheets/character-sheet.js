import { CHARACTERISTIC_KEYS } from "../rules/derived-attributes.js";
import {
  CULTURES,
  PROFESSIONS,
  getCulture,
  getProfession
} from "../data/backgrounds.js";
import { BASIC_SKILL_SOURCES } from "../data/basic-skills.js";
import { PROFESSIONAL_SKILL_SOURCES } from "../data/professional-skills.js";
import {
  BACKGROUND_BUDGETS,
  allocationRemaining as backgroundAllocationRemaining,
  createBackgroundDraft,
  freeSkillNeedsSpecialization,
  getAllAcquiredAbilities,
  getFreeAbilities,
  getPhaseAbilities,
  parseBackgroundDraft,
  serializeBackgroundDraft,
  setAllocation,
  skillAbilityKey,
  styleAbilityKey,
  validateBackgroundSelection,
  validateFreePhase
} from "../rules/background-generation.js";
import {
  CHARACTERISTIC_MINIMUMS,
  adjustPointAllocation,
  calculateAllocationRemaining,
  canSwapCharacteristics,
  createMinimumAllocation
} from "../rules/character-generation.js";
import { calculateResourceValue } from "../rules/resources.js";

const { ActorSheetV2 } = foundry.applications.sheets;
const { DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

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
const SKILL_NAMES = new Map([
  ...BASIC_SKILL_SOURCES,
  ...PROFESSIONAL_SKILL_SOURCES
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
      basicSkillGroup,
      combatSkillGroup,
      secondarySkillGroups,
      passions: items.filter((item) => item.type === "passion"),
      equipment: items.filter((item) => item.type === "equipment"),
      weapons: items.filter((item) => item.type === "weapon")
    }, { inplace: false });
  }

  _onRender(context, options) {
    super._onRender(context, options);

    if (!this.isEditable) {
      this.element.querySelectorAll(
        "input[name], textarea[name], select[name], [data-skill-field], "
        + "[data-passion-field], [data-resource-action]"
      )
        .forEach((field) => { field.disabled = true; });
    }

    this.element.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", (event) => this.#activateTab(event));
    });
    this.element.querySelector("[data-action='confirm-characteristics']")
      ?.addEventListener("click", () => this.#confirmCharacteristics());
    this.element.querySelectorAll("[data-generation-method]").forEach((button) => {
      button.addEventListener("click", (event) => this.#selectGenerationMethod(event));
    });
    this.element.querySelector("[data-action='toggle-edit-mode']")
      ?.addEventListener("click", () => this.#toggleEditMode());
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
    this.element.querySelectorAll("[data-action='roll-skill']").forEach((button) => {
      button.addEventListener("click", (event) => this.#rollSkill(event));
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
    this.element.querySelectorAll("[data-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tab);
    });
    this.element.querySelectorAll("[data-tab-content]").forEach((section) => {
      section.classList.toggle("active", section.dataset.tabContent === tab);
    });
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
    const acquiredBeforeFree = new Set(
      getAllAcquiredAbilities(culture, profession, draft, { includeFree: false })
        .map((ability) => ability.key)
    );
    const allocationPhase = phase ?? (stage === "free" ? "free" : null);
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
      isProfession: stage === "profession",
      isFree: stage === "free",
      isReview: stage === "review",
      cultureName: culture?.name ?? "",
      professionName: profession?.name ?? "",
      cultures: CULTURES.map((entry) => ({
        key: entry.key,
        name: entry.name,
        selected: entry.key === draft.cultureKey
      })),
      professions: PROFESSIONS.map((entry) => ({
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
      freeProfessionalOptions: PROFESSIONAL_SKILL_SOURCES.map((source) => ({
        slug: source.system.slug,
        name: source.name,
        selected: source.system.slug === draft.freeProfessional.slug,
        available: freeSkillNeedsSpecialization(source.system.slug)
          || !acquiredBeforeFree.has(skillAbilityKey(source.system.slug))
      })).filter((entry) => entry.available || entry.selected),
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
      ),
      allocationPhase,
      allocationRows,
      allocationRemaining: allocationPhase
        ? backgroundAllocationRemaining(allocationPhase, allocation)
        : 0,
      allocationBudget: allocationPhase ? BACKGROUND_BUDGETS[allocationPhase] : 0,
      reviewAbilities
    };
  }

  #prepareSkillRow(item, draft) {
    const row = {
      id: item.id,
      name: item.name,
      type: item.type,
      system: item.system
    };
    if (!draft) return row;

    const culture = getCulture(draft.cultureKey);
    const profession = getProfession(draft.professionKey);
    const phase = draft.stage === "review" ? "free" : draft.stage;
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
    const source = BASIC_SKILLS_BY_SLUG.get(ability.slug)
      ?? PROFESSIONAL_SKILLS_BY_SLUG.get(ability.slug);
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
        img: "icons/svg/sword.svg",
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
    const source = PROFESSIONAL_SKILLS_BY_SLUG.get(ability.slug);
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
      draft.freeProfessional = { slug: "", specialization: "" };
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

  async #updateFreeSkill(event) {
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const field = event.currentTarget.dataset.backgroundFreeField;
    const previousKey = skillAbilityKey(
      draft.freeProfessional.slug,
      draft.freeProfessional.specialization
    );
    draft.freeProfessional[field] = event.currentTarget.value.trim();
    const nextKey = skillAbilityKey(
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
    draft.allocations[phase] = setAllocation(
      draft.allocations[phase],
      ability,
      event.currentTarget.value,
      BACKGROUND_BUDGETS[phase]
    );
    await this.#saveBackgroundDraft(draft);
  }

  async #adjustBackgroundPoints(event) {
    event.preventDefault();
    const { phase, ability, delta } = event.currentTarget.dataset;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const current = Number(draft.allocations[phase][ability] ?? 0);
    draft.allocations[phase] = setAllocation(
      draft.allocations[phase],
      ability,
      current + Number(delta),
      BACKGROUND_BUDGETS[phase]
    );
    await this.#saveBackgroundDraft(draft);
  }

  async #navigateBackground(event) {
    event.preventDefault();
    const direction = event.currentTarget.dataset.backgroundNavigation;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    if (direction === "back") {
      draft.stage = {
        profession: "culture",
        free: "profession",
        review: "free"
      }[draft.stage] ?? "culture";
      await this.#saveBackgroundDraft(draft);
      return;
    }
    const culture = getCulture(draft.cultureKey);
    const profession = getProfession(draft.professionKey);
    const validation = draft.stage === "culture"
      ? validateBackgroundSelection(culture, draft, "culture")
      : draft.stage === "profession"
        ? validateBackgroundSelection(profession, draft, "profession")
        : validateFreePhase(culture, profession, draft, CORE_BASIC_SLUGS);
    if (!validation.valid) {
      ui.notifications.warn(game.i18n.localize(
        `MYTHRASF.Background.Validation.${validation.reason}`
      ));
      return;
    }
    draft.stage = { culture: "profession", profession: "free", free: "review" }[draft.stage];
    await this.#saveBackgroundDraft(draft);
  }

  async #confirmBackground() {
    if (!this.isEditable) return;
    const draft = parseBackgroundDraft(this.actor.system.backgroundDraft);
    const culture = getCulture(draft.cultureKey);
    const profession = getProfession(draft.professionKey);
    if (
      !validateBackgroundSelection(culture, draft, "culture").valid
      || !validateBackgroundSelection(profession, draft, "profession").valid
      || !validateFreePhase(culture, profession, draft, CORE_BASIC_SLUGS).valid
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
    await this.actor.update({
      "system.identity.culture.name": culture.name,
      "system.identity.culture.sourceUuid": cultureDocument?.uuid ?? "",
      "system.identity.profession.name": profession.name,
      "system.identity.profession.sourceUuid": professionDocument?.uuid ?? "",
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
    const name = game.i18n.localize(`MYTHRASF.Item.New.${type}`);
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{ name, type }]);
    item?.sheet.render(true);
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
    const difficulty = row?.querySelector("[data-difficulty]")?.value ?? "standard";
    await item?.rollSkill({ difficulty });
  }

  async #addSkillFromPack(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const group = event.currentTarget.dataset.skillGroup;
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
      await this.actor.createEmbeddedDocuments("Item", [sourceData]);
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
