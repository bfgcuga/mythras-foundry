import { normalizeCatalogConfig } from "../rules/catalog.js";
import { weaponReferenceHtml } from "../rules/weapon-reference.js";
import { getSystemSetting, SETTING_KEYS } from "../settings.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class WeaponReference extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "mythras-weapon-reference",
    classes: ["mythras-foundry", "mythras-paper-sheet", "weapon-reference"],
    window: { title: "MYTHRASF.WeaponReference.Title", resizable: true },
    position: { width: 1100, height: 780 }
  };

  static PARTS = { main: { template: "systems/mythras-foundry/templates/apps/weapon-reference.hbs",
    scrollable: [".weapon-reference-content"] } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const configured = normalizeCatalogConfig(getSystemSetting(SETTING_KEYS.catalogSources));
    const packIds = ["mythras-foundry.weapons", ...configured.packIds];
    const weapons = [];
    for (const packId of [...new Set(packIds)]) {
      const pack = game.packs.get(packId);
      if (!pack || (pack.documentName ?? pack.metadata?.type) !== "Item") continue;
      try {
        for (const document of await pack.getDocuments()) {
          if (document.type === "weapon") weapons.push({ ...document.toObject(), uuid: document.uuid,
            packLabel: pack.metadata?.label ?? pack.title ?? packId });
        }
      } catch (error) {
        console.warn(`Mythras Foundry | Weapon reference could not read ${packId}`, error);
      }
    }
    const localize = (key) => game.i18n.localize(`MYTHRASF.WeaponReference.${key}`);
    return { ...context, content: weaponReferenceHtml(weapons, {
      dynamic: true,
      includeSource: true,
      labels: Object.fromEntries(["open", "openHint", "weapon", "shield", "damage",
        "damageModifier", "power", "size", "reach", "reload", "effects", "impalingSize",
        "encumbrance", "durability", "crew", "traits", "era", "cost", "source", "yes",
        "half", "no"].map((key) => [key, localize(key)])),
      groupTitles: Object.fromEntries(["oneHanded", "twoHanded", "shields", "ranged", "siege"]
        .map((key) => [key, localize(`Group.${key}`)]))
    }) };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll("[data-uuid]").forEach((link) => {
      link.removeAttribute("data-link");
      link.addEventListener("click", async (event) => {
        event.preventDefault();
        (await fromUuid(event.currentTarget.dataset.uuid))?.sheet?.render(true);
      });
    });
  }
}

export function createWeaponReferenceApi() {
  return { open: () => {
    const reference = new WeaponReference();
    reference.render({ force: true });
    return reference;
  } };
}
