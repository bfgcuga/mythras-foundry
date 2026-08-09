import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessCatalogPurchase, catalogCategory, catalogPriceSortValue, filterCatalogEntries,
  mergeCatalogEntries, normalizeCatalogConfig, normalizeCatalogText,
  prepareCatalogEntry } from "../scripts/rules/catalog.js";

const entry = (name, type, system, uuid = `Item.${name}`) => ({
  _id: name, uuid, name, img: "icons/svg/item-bag.svg", type, system
});

test("clasifica todos los tipos comerciales actuales", () => {
  assert.equal(catalogCategory(entry("Daga", "weapon", { weaponType: "melee" })), "weapon");
  assert.equal(catalogCategory(entry("Rodela", "weapon", { weaponType: "shield" })), "shield");
  assert.equal(catalogCategory(entry("Peto", "armor", {})), "armor");
  for (const category of ["item", "container", "clothing", "food", "ammunition",
    "property", "livestock", "vehicle", "service"]) {
    assert.equal(catalogCategory(entry(category, "equipment", { category })), category);
  }
  assert.equal(catalogCategory(entry("Acrobacias", "skill", {})), null);
});

test("busca por fragmentos sin distinguir acentos ni mayúsculas", () => {
  assert.equal(normalizeCatalogText("  HOPLÓN "), "hoplon");
  const rows = [prepareCatalogEntry(entry("Escudo hoplón", "weapon",
    { weaponType: "shield", value: 10, currency: "silver" }))];
  assert.equal(filterCatalogEntries(rows, { search: "HOPLO" }).length, 1);
});

test("combina filtros de categoría mediante unión", () => {
  const rows = [
    prepareCatalogEntry(entry("Daga", "weapon", { weaponType: "melee" })),
    prepareCatalogEntry(entry("Peto", "armor", {})),
    prepareCatalogEntry(entry("Casa", "equipment", { category: "property" }))
  ];
  assert.deepEqual(filterCatalogEntries(rows, { categories: ["weapon", "armor"] })
    .map((row) => row.name), ["Daga", "Peto"]);
  assert.equal(filterCatalogEntries(rows, { categories: [] }).length, 0);
});

test("ordena monedas por equivalencia sin cambiar el precio original", () => {
  const rows = [
    prepareCatalogEntry(entry("Oro", "equipment", { value: 1, currency: "gold" })),
    prepareCatalogEntry(entry("Cobre", "equipment", { value: 50, currency: "copper" })),
    prepareCatalogEntry(entry("Plata", "equipment", { value: 6, currency: "silver" }))
  ];
  assert.deepEqual(filterCatalogEntries(rows).map((row) => row.name),
    ["Cobre", "Plata", "Oro"]);
  assert.equal(catalogPriceSortValue(entry("Plata", "equipment",
    { value: 6, currency: "silver" })), 60);
  assert.deepEqual(rows.map(({ value, currency }) => [value, currency]),
    [[1, "gold"], [50, "copper"], [6, "silver"]]);
});

test("elimina duplicados por UUID y normaliza fuentes configuradas", () => {
  const repeated = prepareCatalogEntry(entry("Daga", "weapon", {}, "Compendium.test.daga"));
  assert.equal(mergeCatalogEntries([repeated, { ...repeated, name: "Otra" }]).length, 1);
  assert.deepEqual(normalizeCatalogConfig({ packIds: ["world.shop", "world.shop", 3] }),
    { version: 1, packIds: ["world.shop"] });
});

test("la compra exige fondos en la misma moneda y calcula el saldo restante", () => {
  const product = { value: 12, currency: "silver" };
  assert.deepEqual(assessCatalogPurchase({ copper: 500, silver: 15, gold: 2 }, product), {
    allowed: true, currency: "silver", price: 12, available: 15, remaining: 3
  });
  assert.equal(assessCatalogPurchase({ copper: 500, silver: 10, gold: 2 }, product).allowed,
    false);
});

test("la interfaz emite arrastre Item estándar y reserva la gestión homebrew al DJ", () => {
  const catalog = readFileSync(new URL("../scripts/apps/item-catalog.js", import.meta.url), "utf8");
  const manager = readFileSync(
    new URL("../scripts/apps/catalog-source-manager.js", import.meta.url), "utf8");
  assert.match(catalog, /JSON\.stringify\(\{ type: "Item", uuid:/);
  assert.match(catalog, /createEmbeddedDocuments\("Item"/);
  assert.match(catalog, /system\.currency/);
  assert.match(catalog, /system\.funds/);
  assert.match(catalog, /OFFICIAL_CATALOG_PACKS/);
  assert.match(manager, /if \(!game\.user\.isGM\) return;/);
  assert.match(manager, /createCompendium/);
  assert.match(manager, /\{ pack: pack\.collection \}/);
});
