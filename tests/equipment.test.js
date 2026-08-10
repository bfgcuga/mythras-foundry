import test from "node:test";
import assert from "node:assert/strict";

import { ACCOMMODATION_SOURCES, DEFAULT_HOME_DATA, EQUIPMENT_SOURCES,
  LIVESTOCK_SOURCES } from "../scripts/data/equipment.js";
import { MYTHRAS_REVISED_SOURCE } from "../scripts/data/sources.js";
import { carriedInventoryEncumbrance, inventoryCarried, inventoryRows, inventorySections,
  sortInventoryItems }
  from "../scripts/rules/inventory.js";

test("el compendio clasifica todos los objetos y conserva su fuente", () => {
  assert.equal(EQUIPMENT_SOURCES.length, 117);
  assert.equal(new Set(EQUIPMENT_SOURCES.map((entry) => entry.buildKey)).size, 117);
  assert.ok(EQUIPMENT_SOURCES.every((entry) => entry.system.source === MYTHRAS_REVISED_SOURCE));
  assert.ok(EQUIPMENT_SOURCES.some((entry) => entry.system.category === "service"));
  assert.ok(EQUIPMENT_SOURCES.some((entry) => entry.system.category === "vehicle"));
  assert.ok(EQUIPMENT_SOURCES.some((entry) => entry.system.category === "livestock"));
  assert.ok(EQUIPMENT_SOURCES.some((entry) => entry.system.isContainer));
});

test("la casa predeterminada es una propiedad contenedora", () => {
  assert.equal(DEFAULT_HOME_DATA.system.category, "property");
  assert.equal(DEFAULT_HOME_DATA.system.isContainer, true);
});

test("viviendas alquiladas y en propiedad se comportan como propiedades", () => {
  const dwellings = ACCOMMODATION_SOURCES.filter((entry) => (
    /choza|cabaña|casa|villa/i.test(entry.name)
  ));
  assert.equal(dwellings.length, 8);
  assert.ok(dwellings.every((entry) => entry.system.category === "property"
    && entry.system.isContainer && (entry.img === "icons/svg/chest.svg"
      || entry.img.startsWith("systems/mythras-foundry/assets/"))));
});

test("el ganado usa una imagen local estable", () => {
  assert.ok(LIVESTOCK_SOURCES.every((entry) => (
    entry.img.startsWith("systems/mythras-foundry/assets/")
  )));
});

test("los vehículos usan una imagen local estable", () => {
  assert.ok(EQUIPMENT_SOURCES.filter((entry) => entry.system.category === "vehicle")
    .every((entry) => entry.img.startsWith("systems/mythras-foundry/assets/")));
});

test("los objetos dentro de propiedades o vehículos no cuentan como transportados", () => {
  const house = { id: "home", name: "Casa", system: { category: "property", isContainer: true } };
  const backpack = { id: "bag", name: "Mochila", system: { category: "container",
    isContainer: true, parentContainerId: "home", weight: 1, quantity: 1 } };
  const rope = { id: "rope", name: "Cuerda", system: { category: "item",
    parentContainerId: "bag", weight: 2, quantity: 2 } };
  assert.equal(inventoryCarried(rope, [house, backpack, rope]), false);
  backpack.system.parentContainerId = "";
  assert.equal(inventoryCarried(rope, [house, backpack, rope]), true);
  assert.equal(carriedInventoryEncumbrance([house, backpack, rope]), 5);
});

test("el inventario genera filas jerárquicas y respeta contenedores plegados", () => {
  const bag = { id: "bag", name: "Mochila", system: { category: "container",
    isContainer: true, collapsed: true } };
  const rope = { id: "rope", name: "Cuerda", system: { category: "item",
    parentContainerId: "bag" } };
  const rows = inventoryRows([bag, rope]);
  assert.equal(rows[0].depth, 0);
  assert.equal(rows[1].depth, 1);
  assert.equal(rows[1].hidden, true);
});

test("el inventario separa la persona de cada propiedad", () => {
  const home = { id: "home", name: "Casa", type: "equipment",
    system: { category: "property", isContainer: true } };
  const chest = { id: "chest", name: "Cofre", type: "equipment",
    system: { category: "container", isContainer: true, parentContainerId: "home" } };
  const stored = { id: "stored", name: "Manta", type: "equipment",
    system: { category: "item", parentContainerId: "chest" } };
  const carried = { id: "carried", name: "Daga", type: "weapon", system: {} };
  const sections = inventorySections([home, chest, stored, carried]);
  assert.deepEqual(sections.map((section) => section.id), ["person", "home"]);
  assert.deepEqual(sections[0].items.map((item) => item.id), ["carried"]);
  assert.deepEqual(sections[1].items.map((item) => item.id), ["chest", "stored"]);
});

test("las categorías se ordenan según la presentación del inventario", () => {
  const entries = [
    { name: "Carro", type: "equipment", system: { category: "vehicle" } },
    { name: "Mochila", type: "equipment", system: { category: "container" } },
    { name: "Peto", type: "armor", system: {} },
    { name: "Daga", type: "weapon", system: {} }
  ];
  assert.deepEqual(sortInventoryItems(entries).map((item) => item.name),
    ["Daga", "Peto", "Mochila", "Carro"]);
});

test("cada categoría del inventario comienza con una separación visual", () => {
  const entries = [
    { id: "weapon", name: "Daga", type: "weapon", system: {} },
    { id: "armor", name: "Peto", type: "armor", system: {} },
    { id: "item", name: "Manta", type: "equipment", system: { category: "item" } },
    { id: "bag", name: "Mochila", type: "equipment",
      system: { category: "container", isContainer: true } },
    { id: "horse", name: "Caballo", type: "equipment", system: { category: "livestock" } },
    { id: "cart", name: "Carro", type: "equipment", system: { category: "vehicle" } }
  ];
  const rows = inventoryRows(entries);
  assert.deepEqual(rows.map((row) => row.groupKey),
    ["weapons", "armor", "miscellaneous", "containers", "livestock", "vehicles"]);
  assert.ok(rows.every((row) => row.groupStart));
});
