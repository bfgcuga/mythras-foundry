import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_HOME_DATA, EQUIPMENT_SOURCES } from "../scripts/data/equipment.js";
import { MYTHRAS_REVISED_SOURCE } from "../scripts/data/sources.js";
import { carriedInventoryEncumbrance, inventoryCarried, inventoryRows }
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
