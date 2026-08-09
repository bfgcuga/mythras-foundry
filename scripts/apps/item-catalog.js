import { CATALOG_CATEGORIES, OFFICIAL_CATALOG_PACKS, filterCatalogEntries,
  assessCatalogPurchase, mergeCatalogEntries, normalizeCatalogConfig,
  prepareCatalogEntry } from "../rules/catalog.js";
import { getSystemSetting, SETTING_KEYS } from "../settings.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const INDEX_FIELDS = ["name", "img", "type", "system.category", "system.weaponType",
  "system.value", "system.currency"];

export class ItemCatalog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "mythras-item-catalog",
    classes: ["mythras-foundry", "mythras-paper-sheet", "item-catalog"],
    window: { title: "MYTHRASF.Catalog.Title", resizable: true },
    position: { width: 920, height: 720 },
    actions: { openItem: ItemCatalog.#openItem, purchase: ItemCatalog.#purchase }
  };

  static PARTS = {
    main: { template: "systems/mythras-foundry/templates/apps/item-catalog.hbs",
      scrollable: [".catalog-results"] }
  };

  constructor(options = {}) {
    super(options);
    this.catalogContext = options.catalogContext ?? {};
    this.search = "";
    this.categories = new Set(CATALOG_CATEGORIES);
  }

  async #entries() {
    const configured = normalizeCatalogConfig(getSystemSetting(SETTING_KEYS.catalogSources));
    const packIds = [...new Set([...OFFICIAL_CATALOG_PACKS, ...configured.packIds])];
    const entries = [];
    for (const packId of packIds) {
      const pack = game.packs.get(packId);
      if (!pack || (pack.documentName ?? pack.metadata?.type) !== "Item") continue;
      try {
        const index = await pack.getIndex({ fields: INDEX_FIELDS });
        for (const entry of index) entries.push(prepareCatalogEntry(entry, {
          packId: pack.collection ?? packId, packLabel: pack.metadata?.label ?? pack.title ?? packId
        }));
      } catch (error) {
        console.warn(`Mythras Foundry | Catalog could not index ${packId}`, error);
      }
    }
    return mergeCatalogEntries(entries);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const buyer = this.catalogContext.actorUuid
      ? await fromUuid(this.catalogContext.actorUuid) : null;
    const entries = filterCatalogEntries(await this.#entries(), {
      search: this.search, categories: [...this.categories]
    }).map((entry) => ({ ...entry,
      categoryLabel: game.i18n.localize(`MYTHRASF.Catalog.Category.${entry.category}`) }));
    return { ...context, search: this.search, count: entries.length, entries,
      canPurchase: Boolean(buyer?.isOwner),
      categories: CATALOG_CATEGORIES.map((key) => ({ key,
        label: game.i18n.localize(`MYTHRASF.Catalog.Category.${key}`),
        selected: this.categories.has(key) })),
      currencyLabels: Object.fromEntries(["copper", "silver", "gold"].map((key) => [
        key, game.i18n.localize(`MYTHRASF.Currency.${key}`)
      ])) };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const search = this.element.querySelector("[data-catalog-search]");
    search?.addEventListener("input", (event) => {
      this.search = event.currentTarget.value;
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this.render({ force: true }), 150);
    });
    this.element.querySelectorAll("[data-catalog-category]").forEach((field) => {
      field.addEventListener("change", (event) => {
        if (event.currentTarget.checked) this.categories.add(event.currentTarget.value);
        else this.categories.delete(event.currentTarget.value);
        this.render({ force: true });
      });
    });
    this.element.querySelectorAll("[data-catalog-uuid][draggable='true']").forEach((row) => {
      row.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain",
        JSON.stringify({ type: "Item", uuid: row.dataset.catalogUuid })));
    });
  }

  static async #openItem(event, target) {
    const document = await fromUuid(target.closest("[data-catalog-uuid]")?.dataset.catalogUuid);
    document?.sheet?.render(true);
  }

  static async #purchase(event, target) {
    if (this._purchasePending) return;
    this._purchasePending = true;
    target.disabled = true;
    try {
      const actor = this.catalogContext.actorUuid
        ? await fromUuid(this.catalogContext.actorUuid) : null;
      if (!actor?.isOwner) {
        ui.notifications.warn(game.i18n.localize("MYTHRASF.Catalog.Purchase.NoPermission"));
        return;
      }
      const source = await fromUuid(target.closest("[data-catalog-uuid]")?.dataset.catalogUuid);
      if (!source || source.documentName !== "Item") return;
      const destinationId = this.catalogContext.destinationId === "person"
        ? "" : this.catalogContext.destinationId ?? "";
      const property = destinationId ? actor.items.get(destinationId) : null;
      if (destinationId && (!property || property.system?.category !== "property")) {
        ui.notifications.warn(game.i18n.localize("MYTHRASF.Catalog.Purchase.InvalidDestination"));
        return;
      }
      const funds = property ? property.system.funds : actor.system.currency;
      const assessment = assessCatalogPurchase(funds, source);
      if (!assessment.allowed) {
        ui.notifications.warn(game.i18n.format("MYTHRASF.Catalog.Purchase.Insufficient", {
          price: assessment.price,
          currency: game.i18n.localize(`MYTHRASF.Currency.${assessment.currency}`)
        }));
        return;
      }
      const itemData = source.toObject();
      delete itemData._id;
      delete itemData.folder;
      itemData.system.parentContainerId = destinationId;
      const [created] = await actor.createEmbeddedDocuments("Item", [itemData]);
      try {
        if (property) await property.update({
          [`system.funds.${assessment.currency}`]: assessment.remaining
        });
        else await actor.update({
          [`system.currency.${assessment.currency}`]: assessment.remaining
        });
      } catch (error) {
        if (created) await actor.deleteEmbeddedDocuments("Item", [created.id]);
        throw error;
      }
      ui.notifications.info(game.i18n.format("MYTHRASF.Catalog.Purchase.Success", {
        item: source.name, price: assessment.price,
        currency: game.i18n.localize(`MYTHRASF.Currency.${assessment.currency}`)
      }));
      this.render({ force: true });
    } finally {
      this._purchasePending = false;
      if (target.isConnected) target.disabled = false;
    }
  }
}

export function createCatalogApi() {
  return {
    open: (catalogContext = {}) => {
      const catalog = new ItemCatalog({ catalogContext });
      catalog.render({ force: true });
      return catalog;
    }
  };
}
