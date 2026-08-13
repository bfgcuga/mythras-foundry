import { defaultItemIcon } from "../data/item-icons.js";
import { CHARACTERISTIC_KEYS } from "../rules/derived-attributes.js";
import { PASSION_OBJECT_TYPES, PASSION_VERBS } from "../rules/passions.js";
import { TRAIT_TYPES } from "../rules/traits.js";
import { HOMEBREW_ITEM_TYPES, buildHomebrewItem, homebrewPackName }
  from "../rules/homebrew-items.js";
import { getSystemSetting, setSystemSetting, SETTING_KEYS } from "../settings.js";
import { normalizeCatalogConfig } from "../rules/catalog.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

function worldItemPacks() {
  return game.packs.filter((pack) => (
    (pack.documentName ?? pack.metadata?.type) === "Item"
    && (pack.metadata?.packageType === "world" || String(pack.collection).startsWith("world."))
  )).sort((left, right) => String(left.metadata?.label ?? left.title)
    .localeCompare(String(right.metadata?.label ?? right.title), game.i18n.lang));
}

async function addCatalogSource(packId) {
  const config = normalizeCatalogConfig(getSystemSetting(SETTING_KEYS.catalogSources));
  await setSystemSetting(SETTING_KEYS.catalogSources,
    { version: 1, packIds: [...new Set([...config.packIds, packId])] });
}

export class HomebrewItemCreator extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "mythras-homebrew-item-creator",
    classes: ["mythras-foundry", "mythras-paper-sheet", "homebrew-item-creator"],
    window: { title: "MYTHRASF.Homebrew.Title", resizable: true },
    position: { width: 760, height: 720 },
    actions: {
      selectType: HomebrewItemCreator.#selectType,
      back: HomebrewItemCreator.#back,
      createPack: HomebrewItemCreator.#createPack,
      createItem: HomebrewItemCreator.#createItem
    }
  };

  static PARTS = {
    main: { template: "systems/mythras-foundry/templates/apps/homebrew-item-creator.hbs",
      scrollable: [".homebrew-creator-content"] }
  };

  constructor(options = {}) {
    super(options);
    this.selectedType = options.selectedType ?? "";
    this.selectedPackId = options.selectedPackId ?? "";
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const packs = worldItemPacks();
    if (!packs.some((pack) => pack.collection === this.selectedPackId)) {
      this.selectedPackId = packs[0]?.collection ?? "";
    }
    const selectedType = this.selectedType;
    return { ...context,
      selectedType,
      selectedTypeLabel: selectedType ? game.i18n.localize(`TYPES.Item.${selectedType}`) : "",
      hasSelectedType: HOMEBREW_ITEM_TYPES.includes(selectedType),
      packs: packs.map((pack) => ({ value: pack.collection,
        label: pack.metadata?.label ?? pack.title ?? pack.collection })),
      selectedPackId: this.selectedPackId,
      types: HOMEBREW_ITEM_TYPES.map((type) => ({ type,
        label: game.i18n.localize(`TYPES.Item.${type}`), icon: defaultItemIcon(type) })),
      isSkill: selectedType === "skill",
      isCombatStyle: selectedType === "combatStyle",
      isBackground: ["culture", "profession"].includes(selectedType),
      isPassion: selectedType === "passion",
      isEquipment: selectedType === "equipment",
      isWeapon: selectedType === "weapon",
      isArmor: selectedType === "armor",
      isHitLocation: selectedType === "hitLocation",
      isTrait: selectedType === "trait",
      characteristics: CHARACTERISTIC_KEYS.map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Characteristic.${value}`) })),
      skillCategories: ["basic", "professional"].map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Skill.${value === "basic" ? "Basic" : "Professional"}`) })),
      skillGroups: ["basic", "professional", "resistance", "magic", "language"].map((value) => ({
        value, label: game.i18n.localize(`MYTHRASF.Skill.Group${value[0].toUpperCase()}${value.slice(1)}`) })),
      equipmentCategories: ["item", "service", "vehicle", "livestock", "container",
        "property", "clothing", "food", "ammunition"].map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.ItemClass.${value}`) })),
      currencies: ["copper", "silver", "gold"].map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Currency.${value}`) })),
      weaponTypes: ["melee", "ranged", "shield", "siege"].map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Weapon.Type.${value}`) })),
      damageModifierModes: ["full", "half", "none"].map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Weapon.DamageModifier.${value}`) })),
      traitTypes: TRAIT_TYPES.map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Trait.Type.${value}`) })),
      passionVerbs: PASSION_VERBS.map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Passion.Verb.${value}`) })),
      passionObjects: PASSION_OBJECT_TYPES.map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Passion.Object.${value}`) })),
      armorLocations: ["rightLeg", "leftLeg", "abdomen", "chest", "rightArm", "leftArm",
        "head", "special"].map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Armor.ReferenceLocation.${value}`) })),
      armorConstructions: ["flexible", "rigid"].map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Armor.Construction.${value}`) })),
      armorMaterials: ["steel", "bronze", "shell", "leather", "iron", "bone", "linen",
        "ivory", "stone", "chitin", "silk"].map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Armor.Material.${value}`) })),
      armorEras: ["all", "ancient-medieval", "ancient-renaissance", "medieval-industrial",
        "ancient", "modern", "futuristic"].map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.Armor.Era.${value}`) })),
      locationCategories: ["limb", "head", "chest", "abdomen", "other"].map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.HitLocation.Category.${value}`) })),
      hpClasses: ["arm", "standard", "abdomen", "chest"].map((value) => ({ value,
        label: game.i18n.localize(`MYTHRASF.HitLocation.HpClass.${value}`) }))
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector("[data-homebrew-pack]")?.addEventListener("change", (event) => {
      this.selectedPackId = event.currentTarget.value;
    });
  }

  static #selectType(event, target) {
    if (!game.user.isGM) return;
    this.selectedPackId = this.element.querySelector("[data-homebrew-pack]")?.value ?? "";
    this.selectedType = target.dataset.itemType;
    this.render({ force: true });
  }

  static #back() {
    this.selectedType = "";
    this.render({ force: true });
  }

  static async #createPack() {
    if (!game.user.isGM) return;
    const label = await DialogV2.input({
      window: { title: game.i18n.localize("MYTHRASF.Homebrew.CreatePack") },
      content: `<div class="mythras-foundry"><label><span>${game.i18n.localize(
        "MYTHRASF.Homebrew.PackName")}</span><input class="sheet-field-editable" name="label" required autofocus></label></div>`,
      ok: { label: game.i18n.localize("MYTHRASF.Add"), icon: "fas fa-plus",
        callback: (event, button) => button.form.elements.label.value.trim() }
    });
    if (!label) return;
    const base = homebrewPackName(label);
    let name = base;
    let suffix = 2;
    while (game.packs.has(`world.${name}`)) name = `${base}-${suffix++}`;
    const pack = await CompendiumCollection.createCompendium({
      type: "Item", label, name, package: "world"
    });
    await addCatalogSource(pack.collection);
    this.selectedPackId = pack.collection;
    this.render({ force: true });
  }

  static async #createItem() {
    if (!game.user.isGM) return;
    const form = this.element.querySelector("[data-homebrew-form]");
    const packId = this.element.querySelector("[data-homebrew-pack]")?.value
      || this.selectedPackId;
    const pack = game.packs.get(packId);
    if (!form || !pack) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Homebrew.SelectPack"));
      return;
    }
    if (!form.reportValidity()) return;
    const fields = Object.fromEntries(new FormData(form).entries());
    let data;
    try {
      data = buildHomebrewItem(this.selectedType, fields);
    } catch (error) {
      const key = error.message === "invalid-rules" || error instanceof SyntaxError
        ? "InvalidRules" : "InvalidData";
      ui.notifications.error(game.i18n.localize(`MYTHRASF.Homebrew.${key}`));
      return;
    }
    if (pack.locked && pack.configure) await pack.configure({ locked: false });
    const document = await Item.create(data, { pack: pack.collection });
    if (!document) return;
    await addCatalogSource(pack.collection);
    ui.notifications.info(game.i18n.format("MYTHRASF.Homebrew.Created", { name: document.name }));
    document.sheet?.render(true);
    this.selectedType = "";
    this.render({ force: true });
  }
}

export function createHomebrewApi() {
  return Object.freeze({
    open: () => {
      if (!game.user.isGM) return null;
      const creator = new HomebrewItemCreator();
      creator.render({ force: true });
      return creator;
    }
  });
}
