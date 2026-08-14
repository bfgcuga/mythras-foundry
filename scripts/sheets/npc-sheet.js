import { CHARACTERISTIC_KEYS } from "../rules/derived-attributes.js";
import { combineDifficulties, fatigueLevel, worsenDifficulty } from "../rules/fatigue.js";
import { difficultyTarget, resolveWeaponStyle } from "../rules/combat.js";
import { createAttackMessage } from "../rules/combat-chat.js";
import { assessWeaponEquip } from "../rules/equipment.js";
import { findWeaponMode, weaponModeDisplayName, weaponModes, weaponModeView } from "../rules/weapon-modes.js";
import { calculateResourceValue } from "../rules/resources.js";
import { nextNumberedItemName } from "../rules/item-names.js";
import { armorFitsWearer, totalArmorPoints, wornArmorPoints } from "../rules/armor.js";
import { npcWeaponDurability, NPC_OVERRIDE_KEYS } from "../rules/npc.js";
import { regenerateNpcActor } from "../rules/npc-token.js";
import { hasSeriousWound, worstWoundLevel, woundPenaltyKey } from "../rules/hit-locations.js";
import { penalizedResource, penalizedValue } from "../rules/penalties.js";

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
      submitOnChange: false
    }
  };

  static PARTS = {
    main: {
      template: "systems/mythras-foundry/templates/actor/npc-sheet.hbs",
      scrollable: [".sheet-body"]
    }
  };

  static async _onSubmitForm(event, form, formData) {
    await this.actor.update(formData.object);
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
    const intelligenceKind = this.actor.system.intelligenceKind === "instinct"
      ? "instinct" : "intelligence";
    const currentFatigue = fatigueLevel(this.actor.system.fatigueLevel);
    const currentWound = worstWoundLevel(hitLocations);
    const baseAttributes = this.actor.system.baseAttributes ?? this.actor.system.attributes;
    const effectiveAttributes = this.actor.system.attributes;
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
    const combatWeapons = weapons.flatMap((weapon) => weaponModes(weapon)
      .map((mode) => this.#prepareCombatWeapon(weapon, mode, combatStyles, hitLocations)));

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
        magicPoints: `${this.actor.system.resources.magicPoints.value}/${effectiveAttributes.magicPointsMax}`,
        luckPoints: `${this.actor.system.resources.luckPoints.value}/${effectiveAttributes.luckPointsMax}`,
        fatigue: game.i18n.localize(`MYTHRASF.Fatigue.Level.${currentFatigue.key}`),
        fatigueKey: currentFatigue.key,
        wound: game.i18n.localize(`MYTHRASF.Wound.${currentWound}`),
        woundKey: currentWound,
        woundPenalty: game.i18n.localize(
          `MYTHRASF.Header.WoundPenalty.${woundPenaltyKey(currentWound)}`),
        fatiguePenalty: currentFatigue.skillDifficulty === "standard"
          ? game.i18n.localize("MYTHRASF.Fatigue.NoPenalty")
          : game.i18n.localize(`MYTHRASF.Difficulty.${currentFatigue.skillDifficulty}`)
      },
      skills: skills.map((item) => {
        const total = Number(item.system.total ?? 0);
        return { item, total, display: penalizedValue(total,
          difficultyTarget(total, this.actor.system.conditionLevel?.skillDifficulty ?? "standard")) };
      }),
      combatStyles: combatStyles.map((item) => {
        const total = Number(item.system.total ?? 0);
        return { item, total, display: penalizedValue(total,
          difficultyTarget(total, this.actor.system.conditionLevel?.skillDifficulty ?? "standard")) };
      }),
      passions: items.filter((item) => item.type === "passion"),
      traits: items.filter((item) => item.type === "trait"),
      equipment: items.filter((item) => item.type === "equipment"),
      armor,
      weapons,
      combatWeapons,
      hitLocations: hitLocations.map((item) => ({
        item,
        woundKey: item.system.woundLevel,
        woundLabel: game.i18n.localize(`MYTHRASF.Wound.${item.system.woundLevel}`),
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
      fatigueChoices: ["fresh", "winded", "tired", "wearied", "exhausted", "debilitated",
        "incapacitated", "semiConscious", "comatose", "dead"].map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.Fatigue.Level.${value}`)
      }))
    }, { inplace: false });
  }

  #prepareCombatWeapon(weapon, mode, combatStyles, hitLocations) {
    const modeWeapon = weaponModeView(weapon, mode);
    const resolution = resolveWeaponStyle({
      weapon: modeWeapon,
      styles: combatStyles,
      selectedStyleId: mode.preferredCombatStyleId,
      familiarity: mode.familiarity
    });
    resolution.difficulty = combineDifficulties(
      resolution.difficulty, this.actor.system.conditionLevel?.skillDifficulty ?? "standard");
    const candidates = resolution.matching.length ? resolution.matching : combatStyles;
    const effectiveTarget = difficultyTarget(resolution.target, resolution.difficulty);
    const durability = npcWeaponDurability(weapon, hitLocations);
    return {
      item: weapon,
      mode,
      displayName: weaponModeDisplayName(weapon, mode),
      prepared: Boolean(weapon.system.equipped && weapon.system.activeModeKey === mode.key),
      styleOptions: candidates.map((style) => ({
        id: style.id, name: style.name, selected: style.id === resolution.style?.id
      })),
      familiarityOptions: ["similar", "broadlySimilar", "reasonablyDifferent", "substantiallyDifferent"]
        .map((value) => ({ value, selected: value === resolution.familiarity,
          label: game.i18n.localize(`MYTHRASF.Familiarity.${value}`) })),
      difficultyLabel: game.i18n.localize(`MYTHRASF.Difficulty.${resolution.difficulty}`),
      baseTarget: resolution.target,
      effectiveTarget,
      hasTargetPenalty: effectiveTarget !== resolution.target,
      canAttack: resolution.difficulty !== "impossible" && weapon.system.equipped
        && weapon.system.activeModeKey === mode.key
        && (Boolean(resolution.style) || resolution.usesBase || candidates.length > 0),
      durability: `${durability.armorPoints}/${durability.currentHitPoints}`
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll("[data-tab]").forEach((button) =>
      button.addEventListener("click", (event) => this.#activateTab(event)));
    this.#showTab(this._activeTab ?? "general");
    this.element.querySelector("[data-action='choose-portrait']")
      ?.addEventListener("click", () => this.#choosePortrait());
    this.element.querySelector("[data-action='view-portrait']")
      ?.addEventListener("click", () => this.#viewPortrait());
    this.element.querySelector("[data-action='regenerate-npc']")
      ?.addEventListener("click", () => this.#regenerate());
    this.element.querySelectorAll("[data-action='create-item']").forEach((button) =>
      button.addEventListener("click", (event) => this.#createItem(event)));
    this.element.querySelectorAll("[data-action='edit-item']").forEach((button) =>
      button.addEventListener("click", (event) => this.#editItem(event)));
    this.element.querySelectorAll("[data-action='delete-item']").forEach((button) =>
      button.addEventListener("click", (event) => this.#deleteItem(event)));
    this.element.querySelectorAll("[data-action='roll-skill']").forEach((button) =>
      button.addEventListener("click", (event) => this.#rollSkill(event)));
    this.element.querySelectorAll("[data-action='roll-passion']").forEach((button) =>
      button.addEventListener("click", (event) => this.#rollPassion(event)));
    this.element.querySelectorAll("[data-action='roll-attack']").forEach((button) =>
      button.addEventListener("click", (event) => this.#rollWeaponAttack(event)));
    this.element.querySelectorAll("[data-action='toggle-equipped']").forEach((button) =>
      button.addEventListener("click", (event) => this.#toggleEquipped(event)));
    this.element.querySelectorAll("[data-resource-action]").forEach((button) =>
      button.addEventListener("click", (event) => this.#adjustResource(event)));
    this.element.querySelectorAll("input[name], textarea[name], select[name]").forEach((field) =>
      field.addEventListener("change", (event) => this.#updateActorField(event)));
    this.element.querySelectorAll("[data-manual-value]").forEach((field) =>
      field.addEventListener("change", (event) => this.#updateManualValue(event)));
    this.element.querySelectorAll("[data-item-field]").forEach((field) =>
      field.addEventListener("change", (event) => this.#updateItemField(event)));
    this.element.querySelectorAll("[data-combat-style]").forEach((field) =>
      field.addEventListener("change", (event) => this.#updateWeaponCombatChoice(event)));
    this.element.querySelectorAll("[data-location-disabled]").forEach((field) =>
      field.addEventListener("change", (event) => this.#updateLocationDisabled(event)));
    this.element.querySelectorAll("[data-location-armor]").forEach((field) =>
      field.addEventListener("change", (event) => this.#updateLocationArmor(event)));

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

  async #regenerate() {
    if (!game.user.isGM || !this.actor.isToken || this.actor.token?.isLinked) return;
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("MYTHRASF.Npc.Regenerate") },
      content: `<p>${game.i18n.localize("MYTHRASF.Npc.RegenerateWarning")}</p>`
    });
    if (!confirmed) return;
    await regenerateNpcActor(this.actor);
  }

  async #createItem(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const type = event.currentTarget.dataset.type;
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
    const system = ["skill", "combatStyle"].includes(type)
      ? { valueMode: "manual", group: type === "combatStyle" ? "combat" : "professional",
        category: type === "combatStyle" ? "professional" : "professional" }
      : {};
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{ name, type, system }]);
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
    if (itemId) await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }

  async #rollSkill(event) {
    event.preventDefault();
    const row = event.currentTarget.closest("[data-item-id]");
    const item = this.actor.items.get(row?.dataset.itemId);
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
      const woundDifficulty = fatigueLevel("incapacitated").skillDifficulty;
      difficulty = combineDifficulties(difficulty, woundDifficulty);
      modifiers.push({
        source: game.i18n.localize("MYTHRASF.Wound.major"),
        effect: game.i18n.localize(`MYTHRASF.Difficulty.${woundDifficulty}`),
        type: "penalty"
      });
    }
    const beforeStatusPenalty = difficulty;
    difficulty = combineDifficulties(
      difficulty, this.actor.system.conditionLevel?.skillDifficulty ?? "standard"
    );
    if (difficulty !== beforeStatusPenalty) {
      modifiers.push({
        source: game.i18n.localize("MYTHRASF.Status.IncapacitatedManual"),
        effect: game.i18n.localize(`MYTHRASF.Difficulty.${difficulty}`),
        type: "penalty"
      });
    }
    const beforeWoundPenalty = difficulty;
    difficulty = await this.#applySeriousWoundPenalty(difficulty);
    if (difficulty !== beforeWoundPenalty) {
      modifiers.push({
        source: game.i18n.localize("MYTHRASF.Wound.serious"),
        effect: game.i18n.localize("MYTHRASF.SkillRoll.OneDifficultyStep"),
        type: "penalty"
      });
    }
    await item?.rollSkill({ difficulty, modifiers });
  }

  async #rollPassion(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    await this.actor.items.get(itemId)?.rollPassion();
  }

  async #rollWeaponAttack(event) {
    event.preventDefault();
    const row = event.currentTarget.closest("[data-item-id]");
    const weapon = this.actor.items.get(row?.dataset.itemId);
    const mode = weapon ? findWeaponMode(weapon, row.dataset.modeKey) : null;
    if (!weapon || !mode || !weapon.system.equipped || weapon.system.activeModeKey !== mode.key) {
      return ui.notifications.warn(game.i18n.localize("MYTHRASF.Weapon.ModeNotPrepared"));
    }
    const resolution = resolveWeaponStyle({
      weapon: weaponModeView(weapon, mode),
      styles: this.actor.items.filter((item) => item.type === "combatStyle"),
      selectedStyleId: row.querySelector("[data-combat-style]")?.value,
      familiarity: row.querySelector("[data-combat-familiarity]")?.value ?? mode.familiarity
    });
    resolution.difficulty = combineDifficulties(
      resolution.difficulty, this.actor.system.conditionLevel?.skillDifficulty ?? "standard");
    resolution.difficulty = await this.#applySeriousWoundPenalty(resolution.difficulty);
    if (resolution.difficulty === "impossible" || (!resolution.style && !resolution.usesBase)) {
      return ui.notifications.warn(game.i18n.localize("MYTHRASF.Combat.SelectStyle"));
    }
    const targets = Array.from(game.user.targets ?? []);
    if (targets.length > 1) return ui.notifications.warn(game.i18n.localize("MYTHRASF.Combat.OneTarget"));
    await createAttackMessage({ actor: this.actor, weapon, mode, resolution, target: targets[0] });
  }

  async #applySeriousWoundPenalty(difficulty) {
    const locations = this.actor.items.filter((item) => item.type === "hitLocation");
    if (!hasSeriousWound(locations)) return difficulty;
    const applyPenalty = await DialogV2.confirm({
      window: { title: game.i18n.localize("MYTHRASF.Wound.ApplyPenaltyTitle") },
      content: `<div class="mythras-foundry mythras-dialog"><p>${game.i18n.localize("MYTHRASF.Wound.ApplyPenaltyPrompt")}</p></div>`,
      yes: { label: game.i18n.localize("MYTHRASF.Wound.ApplyPenalty") },
      no: { label: game.i18n.localize("MYTHRASF.Wound.IgnorePenalty") }
    });
    return applyPenalty ? worsenDifficulty(difficulty) : difficulty;
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

  async #updateWeaponCombatChoice(event) {
    if (!this.isEditable) return;
    const row = event.currentTarget.closest("[data-item-id]");
    const weapon = this.actor.items.get(row?.dataset.itemId);
    if (!weapon || weapon.type !== "weapon") return;
    const modes = weaponModes(weapon).map((mode) => ({ ...mode }));
    const mode = modes.find((entry) => entry.key === row.dataset.modeKey);
    if (!mode) return;
    mode.preferredCombatStyleId = event.currentTarget.value;
    await weapon.update({ "system.modes": modes });
  }

  async #updateLocationDisabled(event) {
    if (!this.isEditable) return;
    const location = this.actor.items.get(
      event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    if (location?.type !== "hitLocation") return;
    await location.update({ "system.disabled": event.currentTarget.checked });
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
