import { CHARACTERISTIC_KEYS } from "../rules/derived-attributes.js";
import { fatigueLevel, FATIGUE_LEVELS } from "../rules/fatigue.js";
import { difficultyTarget } from "../rules/combat.js";
import { assessWeaponEquip } from "../rules/equipment.js";
import { weaponCanEquip } from "../rules/weapon-durability.js";
import { weaponIsPinned } from "../rules/weapon-pinning.js";
import { findWeaponMode, weaponModes } from "../rules/weapon-modes.js";
import { calculateResourceValue } from "../rules/resources.js";
import { nextNumberedItemName } from "../rules/item-names.js";
import { armorFitsWearer, armorInitiativePenalty } from "../rules/armor.js";
import { NPC_OVERRIDE_KEYS } from "../rules/npc.js";
import { regenerateNpcActor } from "../rules/npc-token.js";
import { hitLocationDisplayName, isLocationCrippled, worstWoundLevel,
  woundPenaltyKey } from "../rules/hit-locations.js";
import { activeSkillStatusPenalties, activeStatusRules,
  UNCONSCIOUS_STATUS_ID } from "../rules/statuses.js";
import { penalizedResource, penalizedValue } from "../rules/penalties.js";
import { INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG } from "../rules/incapacitated.js";
import { encumbranceState, skillUsesStrengthOrDexterity, totalCarriedEncumbrance
} from "../rules/encumbrance.js";
import { penaltySummary } from "../rules/penalty-summary.js";
import { prepareActiveStatusControls, preparePenaltySummary } from "../ui/penalties.js";
import { askWoundRollImpact } from "../ui/wound-roll-dialog.js";
import { actorLoadState, resolveActorConditions } from "../rules/actor-conditions.js";
import { resolveSkillRollConditions } from "../rules/skill-roll-resolution.js";
import { decorateCombatActionButtons } from "../rules/combat-action-runtime.js";
import { prepareHitLocationTable } from "../ui/hit-location-table.js";
import { InventorySheetController, prepareInventoryView } from "../ui/inventory-sheet.js";
import { CombatSheetController, prepareCombatStyleViews, prepareCombatWeaponView,
  splitCombatWeapons } from "../ui/combat-sheet.js";
import { rollSpecial } from "../rules/special-roll.js";
import { updateActorFromSheet } from "../rules/document-names.js";
import { MORPHOLOGIES, MORPHOLOGY_KEYS } from "../rules/morphologies.js";
import { replaceActorMorphology } from "../rules/morphology-replacement.js";

const { ActorSheetV2 } = foundry.applications.sheets;
const { DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { FilePicker, ImagePopout } = foundry.applications.apps;

export class NpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["mythras-foundry", "mythras-paper-sheet", "actor-sheet", "npc-sheet"],
    tag: "form",
    window: { resizable: true },
    position: { width: 960, height: 760 },
    form: {
      handler: NpcSheet._onSubmitForm,
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/mythras-foundry/templates/actor/npc-sheet.hbs",
      scrollable: [".sheet-body"]
    }
  };

  static async _onSubmitForm(event, form, formData) {
    await updateActorFromSheet(this.actor, formData.object);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const items = [...this.actor.items];
    const skills = items.filter((item) => item.type === "skill");
    const combatStyles = items.filter((item) => item.type === "combatStyle");
    const hitLocations = items.filter((item) => item.type === "hitLocation")
      .sort((left, right) => left.system.rangeStart - right.system.rangeStart);
    const weapons = items.filter((item) => item.type === "weapon");
    const armor = items.filter((item) => item.type === "armor");
    const equippedArmor = armor.filter((item) => item.system.equipped);
    const hitLocationTable = prepareHitLocationTable({ actor: this.actor, armor,
      combat: game.combat ?? game.combats?.active,
      armorPointLabel: game.i18n.localize("MYTHRASF.HitLocation.Armor") });
    const inventory = items.filter((item) => ["equipment", "weapon", "armor"].includes(item.type));
    const carriedEncumbrance = totalCarriedEncumbrance(inventory);
    const loadState = encumbranceState(carriedEncumbrance, this.actor.system.strength);
    const intelligenceKind = this.actor.system.intelligenceKind === "instinct"
      ? "instinct" : "intelligence";
    const currentFatigue = fatigueLevel(this.actor.system.fatigueLevel);
    const currentWound = worstWoundLevel(hitLocations);
    const baseAttributes = this.actor.system.baseAttributes ?? this.actor.system.attributes;
    const activeStatuses = activeStatusRules(this.actor.statuses);
    const manuallyIncapacitated = Boolean(this.actor.getFlag(
      INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG));
    const conditionResolution = resolveActorConditions(this.actor, {
      baseAttributes, fatigueKey: currentFatigue.key, loadState
    });
    const effectiveAttributes = conditionResolution.attributes;
    const activeStatusControls = prepareActiveStatusControls(this.actor, {
      fatigueKey: currentFatigue.key, woundLevel: currentWound
    });
    const penalties = preparePenaltySummary(penaltySummary({ baseAttributes,
      fatigueKey: currentFatigue.key, woundLevel: currentWound, manuallyIncapacitated,
      skillStatuses: activeSkillStatusPenalties(this.actor.statuses), activeStatuses,
      loadState, armorPenalty: armorInitiativePenalty(equippedArmor),
      unconscious: this.actor.statuses.has(UNCONSCIOUS_STATUS_ID) }));
    const actionPointsDisplay = penalizedResource(
      this.actor.system.resources.actionPoints.value,
      baseAttributes.actionPointsMax,
      effectiveAttributes.actionPointsMax
    );

    const characteristicRows = CHARACTERISTIC_KEYS.map((key) => ({
      key,
      label: game.i18n.localize(key === "intelligence"
        ? `MYTHRASF.Npc.${intelligenceKind === "instinct" ? "Instinct" : "Intelligence"}`
        : `MYTHRASF.Characteristic.${key}`),
      value: this.actor.system[key],
      formula: this.actor.system.characteristicFormulas?.[key] ?? ""
    }));
    const attributeRows = NPC_OVERRIDE_KEYS.map((key) => {
      const override = this.actor.system.attributeOverrides[key];
      const attributeKey = {
        actionPoints: "actionPointsMax", initiative: "initiative",
        movementRate: "movementRate", magicPoints: "magicPointsMax",
        luckPoints: "luckPointsMax"
      }[key];
      return {
        key,
        label: game.i18n.localize(`MYTHRASF.Npc.Attribute.${key}`),
        mode: override.mode,
        manual: override.mode === "manual",
        value: override.value,
        formula: override.formula,
        resolved: baseAttributes?.[attributeKey],
        display: penalizedValue(baseAttributes?.[attributeKey], effectiveAttributes?.[attributeKey])
      };
    });
    const combatWeapons = weapons.flatMap((weapon) => weaponModes(weapon).map((mode) =>
      prepareCombatWeaponView({ actor: this.actor, weapon, mode, styles: combatStyles,
        hitLocations, resolveDifficulty: (difficulty) => this.#conditionResolution({
          baseDifficulty: difficulty, physical: true }).difficulty })));
    const combatWeaponGroups = splitCombatWeapons(combatWeapons);
    const inventoryView = prepareInventoryView(items);

    return foundry.utils.mergeObject(context, {
      actor: this.actor,
      editable: this.isEditable,
      isTemplate: !this.actor.isToken,
      canRegenerate: Boolean(this.actor.isToken && !this.actor.token?.isLinked && game.user.isGM),
      isInstinct: intelligenceKind === "instinct",
      characteristicRows,
      attributeRows,
      damageModifierManual: this.actor.system.attributeOverrides.damageModifier.mode === "manual",
      damageModifierLabel: typeof this.actor.system.attributes.damageModifier === "string"
        ? this.actor.system.attributes.damageModifier
        : this.actor.system.attributes.damageModifier.label,
      headerStatus: {
        actionPoints: actionPointsDisplay,
        magicPoints: this.actor.statuses.has(UNCONSCIOUS_STATUS_ID) ? "0/0"
          : `${this.actor.system.resources.magicPoints.value}/${effectiveAttributes.magicPointsMax}`,
        luckPoints: this.actor.statuses.has(UNCONSCIOUS_STATUS_ID) ? "0/0"
          : `${this.actor.system.resources.luckPoints.value}/${effectiveAttributes.luckPointsMax}`,
        fatigue: game.i18n.localize(`MYTHRASF.Fatigue.Level.${currentFatigue.key}`),
        fatigueKey: currentFatigue.key,
        wound: game.i18n.localize(`MYTHRASF.Wound.${currentWound}`),
        woundKey: currentWound,
        encumbrance: `${carriedEncumbrance}/${this.actor.system.strength}`,
        encumbranceTitle: game.i18n.localize(`MYTHRASF.Encumbrance.Detail.${loadState.key}`),
        woundPenalty: game.i18n.localize(
          `MYTHRASF.Header.WoundPenalty.${woundPenaltyKey(currentWound)}`),
        fatiguePenalty: currentFatigue.skillDifficulty === "standard"
          ? game.i18n.localize("MYTHRASF.Fatigue.NoPenalty")
          : game.i18n.localize(`MYTHRASF.Difficulty.${currentFatigue.skillDifficulty}`),
        encumbrancePenalty: game.i18n.localize(`MYTHRASF.Encumbrance.Penalty.${loadState.key}`),
        encumbrancePenaltyTitle: game.i18n.localize(
          `MYTHRASF.Encumbrance.Detail.${loadState.key}`)
      },
      skills: skills.map((item) => {
        const total = Number(item.system.total ?? 0);
        return { item, total, display: penalizedValue(total,
          difficultyTarget(total, this.#conditionResolution({
            physical: skillUsesStrengthOrDexterity(item)
          }).difficulty)) };
      }),
      combatStyles: prepareCombatStyleViews(combatStyles,
        this.#conditionResolution({ physical: true }).difficulty),
      passions: items.filter((item) => item.type === "passion"),
      traits: items.filter((item) => item.type === "trait"),
      equipment: items.filter((item) => item.type === "equipment"),
      armor,
      weapons,
      combatWeapons,
      ...combatWeaponGroups,
      inventorySections: inventoryView.sections,
      editMode: Boolean(this._editMode),
      canToggleEditMode: !this.actor.isToken && this.isEditable,
      canDeleteHitLocations: !this.actor.isToken && this.isEditable && Boolean(this._editMode),
      canManageMorphology: !this.actor.isToken && this.isEditable && Boolean(this._editMode),
      canApplyMorphology: Boolean(MORPHOLOGIES[this.actor.system.morphologyKey]),
      morphologyChoices: MORPHOLOGY_KEYS.map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Morphology.${value}`) })),
      hitLocationTemplateMode: !this.actor.isToken && Boolean(this._editMode),
      npcLayout: true,
      combatStyleTemplateMode: !this.actor.isToken,
      penalties,
      activeStatusControls,
      hasActiveStatusControls: activeStatusControls.length > 0,
      hitLocationTable,
      permanentWounds: hitLocations.filter(isLocationCrippled).map((item) => ({
        item, displayName: hitLocationDisplayName(item), ...item.system.permanentWound
      })),
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
    }, { inplace: false });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    decorateCombatActionButtons(this.actor, this.element);
    this.element.querySelectorAll("[data-tab]").forEach((button) =>
      button.addEventListener("click", (event) => this.#activateTab(event)));
    this.#showTab(this._activeTab ?? "general");
    this.element.querySelector("[data-action='choose-portrait']")
      ?.addEventListener("click", () => this.#choosePortrait());
    this.element.querySelector("[data-action='view-portrait']")
      ?.addEventListener("click", () => this.#viewPortrait());
    this.element.querySelector("[data-action='regenerate-npc']")
      ?.addEventListener("click", (event) => this.#regenerate(event));
    this.element.querySelector("[data-action='toggle-edit-mode']")
      ?.addEventListener("click", () => this.#toggleEditMode());
    this.element.querySelectorAll("[data-action='create-item']").forEach((button) =>
      button.addEventListener("click", (event) => this.#createItem(event)));
    this.element.querySelectorAll("[data-action='edit-item']").forEach((button) =>
      button.addEventListener("click", (event) => this.#editItem(event)));
    this.element.querySelectorAll("[data-action='delete-item']").forEach((button) =>
      button.addEventListener("click", (event) => this.#deleteItem(event)));
    this.element.querySelector("[data-action='apply-morphology']")
      ?.addEventListener("click", () => this.#applyMorphology());
    this.element.querySelectorAll("[data-action='roll-skill']").forEach((button) =>
      button.addEventListener("click", (event) => this.#rollSkill(event)));
    this.element.querySelector("[data-action='roll-special']")
      ?.addEventListener("click", (event) => rollSpecial(this.actor,
        { manual: event.shiftKey }));
    this.element.querySelectorAll("[data-action='roll-passion']").forEach((button) =>
      button.addEventListener("click", (event) => this.#rollPassion(event)));
    const changeReach = this.element.querySelector("[data-action='change-reach']");
    if (changeReach) changeReach.disabled = !game.combat?.started
      || game.combat.combatant?.actor?.uuid !== this.actor.uuid;
    this.element.querySelectorAll("[data-action='toggle-equipped']").forEach((button) =>
      button.addEventListener("click", (event) => this.#toggleEquipped(event)));
    this.element.querySelectorAll("[data-resource-action]").forEach((button) =>
      button.addEventListener("click", (event) => this.#adjustResource(event)));
    this.element.querySelectorAll("input[name]:not([data-fatigue-level]), textarea[name], select[name]").forEach((field) =>
      field.addEventListener("change", (event) => this.#updateActorField(event)));
    this.element.querySelectorAll("[data-manual-value]").forEach((field) =>
      field.addEventListener("change", (event) => this.#updateManualValue(event)));
    this.element.querySelectorAll("[data-item-field]").forEach((field) =>
      field.addEventListener("change", (event) => this.#updateItemField(event)));
    this.element.querySelectorAll("[data-action='create-combat-style']").forEach((button) =>
      button.addEventListener("click", (event) => this.#createItem(event, "combatStyle")));
    this.element.querySelectorAll("[data-location-disabled]").forEach((field) =>
      field.addEventListener("change", (event) => this.#updateLocationDisabled(event)));
    this.element.querySelectorAll("[data-location-hp-delta]").forEach((button) =>
      button.addEventListener("click", (event) => this.#adjustLocationHitPoints(event)));
    this.element.querySelectorAll("[data-fatigue-level]").forEach((field) =>
      field.addEventListener("change", (event) => this.actor.update({
        "system.fatigueLevel": event.currentTarget.value })));
    this.element.querySelectorAll("[data-location-armor]").forEach((field) =>
      field.addEventListener("change", (event) => this.#updateLocationArmor(event)));
    this.element.querySelectorAll("[data-status-toggle]").forEach((field) =>
      field.addEventListener("change", (event) => this.#toggleStatus(event)));
    new InventorySheetController(this).bind();
    new CombatSheetController(this, { resolveSituationalDifficulty: (difficulty, physical) =>
      this.#resolveSituationalDifficulty(difficulty, physical) }).bind();

    if (!this.isEditable) {
      this.element.querySelectorAll("input[name], textarea[name], select[name]")
        .forEach((field) => { field.disabled = true; });
    }
  }

  #activateTab(event) {
    event.preventDefault();
    this._activeTab = event.currentTarget.dataset.tab;
    this.#showTab(this._activeTab);
  }

  #showTab(tab) {
    this.element.querySelectorAll("[data-tab]").forEach((button) =>
      button.classList.toggle("active", button.dataset.tab === tab));
    this.element.querySelectorAll("[data-tab-content]").forEach((panel) =>
      panel.classList.toggle("active", panel.dataset.tabContent === tab));
  }

  async #toggleEditMode() {
    if (!this.isEditable || this.actor.isToken) return;
    this._editMode = !this._editMode;
    await this.render({ force: true });
  }

  async #choosePortrait() {
    if (!this.isEditable) return;
    const directory = `worlds/${game.world.id}`;
    const picker = new FilePicker({ type: "image", current: directory,
      callback: async (path) => { if (path) await this.actor.update({ img: path }); } });
    await picker.browse(directory);
  }

  #viewPortrait() {
    new ImagePopout({ src: this.actor.img, uuid: this.actor.uuid,
      window: { title: this.actor.name } }).render(true);
  }

  async #regenerate(event) {
    if (!game.user.isGM || !this.actor.isToken || this.actor.token?.isLinked) return;
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("MYTHRASF.Npc.Regenerate") },
      content: `<p>${game.i18n.localize("MYTHRASF.Npc.RegenerateWarning")}</p>`
    });
    if (!confirmed) return;
    await regenerateNpcActor(this.actor, { manual: event.shiftKey });
  }

  async #applyMorphology() {
    if (!this.isEditable || this.actor.isToken || !this._editMode) return;
    const morphologyKey = this.element.querySelector("select[name='system.morphologyKey']")?.value
      ?? this.actor.system.morphologyKey;
    if (!MORPHOLOGIES[morphologyKey]) return;
    if (morphologyKey !== this.actor.system.morphologyKey) {
      await this.actor.update({ "system.morphologyKey": morphologyKey });
    }
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("MYTHRASF.Morphology.Apply") },
      content: `<p>${game.i18n.localize("MYTHRASF.Morphology.ApplyConfirm")}</p>`,
      yes: { label: game.i18n.localize("MYTHRASF.Morphology.Apply") },
      no: { label: game.i18n.localize("MYTHRASF.Cancel") }
    });
    if (!confirmed) return;
    const result = await replaceActorMorphology(this.actor, morphologyKey);
    if (!result.valid) return ui.notifications.error(game.i18n.format(
      "MYTHRASF.Morphology.IncompatibleWounds", {
        locations: result.incompatibleWounds.map((location) => location.name).join(", ")
      }));
    ui.notifications.info(game.i18n.localize("MYTHRASF.Morphology.Applied"));
  }

  async #createItem(event, forcedType = "") {
    event.preventDefault();
    if (!this.isEditable) return;
    const type = forcedType || event.currentTarget.dataset.type;
    if (type === "passion") {
      const result = await DialogV2.input({
        window: { title: game.i18n.localize("MYTHRASF.Passion.Create") },
        content: `<div class="passion-create-dialog">
          <label><span>${game.i18n.localize("MYTHRASF.Skill.Name")}</span>
            <input type="text" name="name" required autofocus></label>
          <label><span>${game.i18n.localize("MYTHRASF.Passion.Value")}</span>
            <input type="number" min="0" name="value" value="50"></label></div>`,
        ok: { label: game.i18n.localize("MYTHRASF.Add"), icon: "fas fa-plus",
          callback: (dialogEvent, button) => ({
            name: button.form.elements.name.value.trim(),
            value: Math.max(0, Number(button.form.elements.value.value) || 0)
          }) }
      });
      if (result?.name) await this.actor.createEmbeddedDocuments("Item", [{
        name: result.name, type: "passion", system: { structured: false, value: result.value }
      }]);
      return;
    }
    const name = nextNumberedItemName(type, this.actor.items,
      (key) => game.i18n.localize(key));
    const parentContainerId = event.currentTarget.dataset.parentId ?? "";
    const category = event.currentTarget.dataset.category;
    const system = ["skill", "combatStyle"].includes(type)
      ? { valueMode: "manual", group: type === "combatStyle" ? "combat" : "professional",
        category: type === "combatStyle" ? "professional" : "professional" }
      : { parentContainerId, ...(category ? { category,
        isContainer: category === "property" } : {}) };
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{
      name: category === "property" ? game.i18n.localize("MYTHRASF.Inventory.NewProperty") : name,
      type, system }]);
    item?.sheet.render(true);
  }

  #editItem(event) {
    event.preventDefault();
    this.actor.items.get(event.currentTarget.closest("[data-item-id]")?.dataset.itemId)
      ?.sheet.render(true);
  }

  async #deleteItem(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const itemId = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    if (itemId) {
      const item = this.actor.items.get(itemId);
      if (item) await new InventorySheetController(this).reparentChildren(item);
      await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
    }
  }

  async #rollSkill(event) {
    event.preventDefault();
    const row = event.currentTarget.closest("[data-item-id]");
    const item = this.actor.items.get(row?.dataset.itemId);
    if (!item) return;
    const woundImpact = await askWoundRollImpact(this.actor);
    const { difficulty, modifiers } = resolveSkillRollConditions(this.actor, item,
      { woundImpact, loadState: this.#loadState() });
    await item.rollSkill({ difficulty, modifiers, manual: event.shiftKey });
  }

  async #rollPassion(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    await this.actor.items.get(itemId)?.rollPassion({ manual: event.shiftKey });
  }

  #conditionResolution({ baseDifficulty = "standard", physical = false,
    situational = false } = {}) {
    return resolveActorConditions(this.actor, {
      baseAttributes: this.actor.system.baseAttributes ?? {}, baseDifficulty, physical,
      situational, loadState: this.#loadState()
    });
  }

  #loadState() {
    return actorLoadState(this.actor);
  }

  async #resolveSituationalDifficulty(baseDifficulty, physical = false) {
    const impact = await askWoundRollImpact(this.actor);
    if (impact.unusableMember || impact.entangledMember) return "impossible";
    return this.#conditionResolution({ baseDifficulty, physical,
      situational: impact.seriousPenalty }).difficulty;
  }

  async #toggleStatus(event) {
    if (!this.isEditable) return;
    await this.actor.toggleStatusEffect(event.currentTarget.dataset.statusToggle, {
      active: event.currentTarget.checked
    });
  }

  async #toggleEquipped(event) {
    if (!this.isEditable) return;
    const item = this.actor.items.get(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    if (!item || !["weapon", "armor"].includes(item.type)) return;
    if (item.type === "weapon" && weaponIsPinned(item, this.actor)) return ui.notifications.warn(
      game.i18n.localize("MYTHRASF.Pin.Blocked"));
    if (item.type === "armor") {
      if (!item.system.equipped && !this.#canEquipArmor(item)) return;
      await item.update({ "system.equipped": !Boolean(item.system.equipped) });
      return;
    }
    if (!item.system.equipped && !weaponCanEquip(item)) return ui.notifications.warn(
      game.i18n.localize("MYTHRASF.Weapon.BrokenCannotEquip"));
    const modeKey = event.currentTarget.closest("[data-mode-key]")?.dataset.modeKey
      || item.system.activeModeKey || findWeaponMode(item)?.key;
    const samePrepared = item.system.equipped && item.system.activeModeKey === modeKey;
    if (!samePrepared) {
      const assessment = assessWeaponEquip(item,
        this.actor.items.filter((candidate) => candidate.type === "weapon"), modeKey);
      if (!assessment.allowed) return ui.notifications.warn(
        game.i18n.format("MYTHRASF.Weapon.HandsUnavailable", assessment));
    }
    await item.update({ "system.equipped": !samePrepared, "system.activeModeKey": modeKey });
  }

  #canEquipArmor(item) {
    if (!armorFitsWearer(item, this.actor)) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Armor.SizeMismatch"));
      return false;
    }
    if (!(item.system.coveredLocationIds ?? []).length) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Armor.CoverageRequired"));
      return false;
    }
    return true;
  }

  async #adjustResource(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const key = event.currentTarget.dataset.resource;
    const resource = this.actor.system.resources[key];
    const maximum = this.actor.system.attributes[`${key}Max`];
    if (!resource || maximum === undefined) return;
    const value = calculateResourceValue(resource.value, maximum,
      event.currentTarget.dataset.resourceAction);
    await this.actor.update({ [`system.resources.${key}.value`]: value });
  }

  async #updateActorField(event) {
    if (!this.isEditable) return;
    const field = event.currentTarget;
    if (!field.name) return;
    let value = field.type === "checkbox" ? field.checked : field.value;
    if (field.type === "number") value = Number(value);
    await this.actor.update({ [field.name]: value });
  }

  async #updateManualValue(event) {
    if (!this.isEditable) return;
    const item = this.actor.items.get(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    await item.update({ "system.manualValue": Math.max(0,
      Number.parseInt(event.currentTarget.value, 10) || 0), "system.valueMode": "manual" });
  }

  async #updateItemField(event) {
    if (!this.isEditable) return;
    const field = event.currentTarget;
    const item = this.actor.items.get(field.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    let value = field.type === "checkbox" ? field.checked : field.value;
    if (field.type === "number") value = Number(value);
    await item.update({ [`system.${field.dataset.itemField}`]: value });
  }

  async #updateLocationDisabled(event) {
    if (!this.isEditable) return;
    const location = this.actor.items.get(
      event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    if (location?.type !== "hitLocation") return;
    await location.update({ "system.disabled": event.currentTarget.checked });
  }

  async #adjustLocationHitPoints(event) {
    if (!this.isEditable) return;
    const location = this.actor.items.get(
      event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    if (location?.type !== "hitLocation") return;
    const value = Number(location.system.currentHitPoints ?? 0)
      + Number(event.currentTarget.dataset.locationHpDelta ?? 0);
    await location.update({ "system.currentHitPoints": value });
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
}
