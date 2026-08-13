import { OFFICIAL_CATALOG_PACKS, normalizeCatalogConfig } from "../rules/catalog.js";
import { getSystemSetting, setSystemSetting, SETTING_KEYS } from "../settings.js";
import { HomebrewItemCreator } from "./homebrew-item-creator.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CatalogSourceManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "mythras-catalog-source-manager",
    classes: ["mythras-foundry", "mythras-paper-sheet", "catalog-source-manager"],
    window: { title: "MYTHRASF.Catalog.Sources.Title", resizable: true },
    position: { width: 720, height: 680 },
    actions: {
      save: CatalogSourceManager.#save,
      createPack: CatalogSourceManager.#createPack,
      openPack: CatalogSourceManager.#openPack,
      createItem: CatalogSourceManager.#createItem
    }
  };

  static PARTS = {
    main: { template: "systems/mythras-foundry/templates/apps/catalog-source-manager.hbs",
      scrollable: [".catalog-source-list"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const selected = new Set(normalizeCatalogConfig(
      getSystemSetting(SETTING_KEYS.catalogSources)).packIds);
    const packs = game.packs.filter((pack) => (
      (pack.documentName ?? pack.metadata?.type) === "Item"
      && !OFFICIAL_CATALOG_PACKS.includes(pack.collection)
    )).sort((left, right) => String(left.metadata?.label ?? left.title)
      .localeCompare(String(right.metadata?.label ?? right.title), game.i18n.lang));
    return { ...context, packs: packs.map((pack) => ({
      id: pack.collection, label: pack.metadata?.label ?? pack.title ?? pack.collection,
      packageName: pack.metadata?.packageName ?? pack.metadata?.package ?? "world",
      selected: selected.has(pack.collection), world: pack.metadata?.packageType === "world"
        || String(pack.collection).startsWith("world.")
    })) };
  }

  static #readSelected() {
    return [...this.element.querySelectorAll("[data-catalog-source]:checked")]
      .map((field) => field.value);
  }

  static async #save() {
    if (!game.user.isGM) return;
    await setSystemSetting(SETTING_KEYS.catalogSources,
      { version: 1, packIds: CatalogSourceManager.#readSelected.call(this) });
    ui.notifications.info(game.i18n.localize("MYTHRASF.Catalog.Sources.Saved"));
    this.render({ force: true });
  }

  static async #createPack() {
    if (!game.user.isGM) return;
    const label = await DialogV2.input({
      window: { title: game.i18n.localize("MYTHRASF.Catalog.Sources.Create") },
      content: `<div class="mythras-foundry"><label><span>${game.i18n.localize(
        "MYTHRASF.Catalog.Sources.Name")}</span><input type="text" name="label" class="sheet-field-editable" required autofocus></label></div>`,
      ok: { label: game.i18n.localize("MYTHRASF.Add"), icon: "fas fa-plus",
        callback: (event, button) => button.form.elements.label.value.trim() }
    });
    if (!label) return;
    const name = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      || `catalog-${foundry.utils.randomID(6).toLowerCase()}`;
    const pack = await CompendiumCollection.createCompendium({
      type: "Item", label, name, package: "world"
    });
    const config = normalizeCatalogConfig(getSystemSetting(SETTING_KEYS.catalogSources));
    await setSystemSetting(SETTING_KEYS.catalogSources,
      { version: 1, packIds: [...new Set([...config.packIds, pack.collection])] });
    this.render({ force: true });
  }

  static async #openPack(event, target) {
    if (!game.user.isGM) return;
    game.packs.get(target.closest("[data-pack-id]")?.dataset.packId)?.render(true);
  }

  static async #createItem(event, target) {
    if (!game.user.isGM) return;
    const pack = game.packs.get(target.closest("[data-pack-id]")?.dataset.packId);
    if (!pack) return;
    new HomebrewItemCreator({ selectedPackId: pack.collection }).render({ force: true });
  }
}
