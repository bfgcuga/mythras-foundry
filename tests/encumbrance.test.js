import test from "node:test";
import assert from "node:assert/strict";
import { applyEncumbrance, encumbranceState, itemEncumbrance,
  skillUsesStrengthOrDexterity, totalCarriedEncumbrance } from "../scripts/rules/encumbrance.js";

let nextId = 0;
const item = (type, system) => ({ id: `item-${nextId += 1}`, type, system });

test("los umbrales de carga usan FUE x2, x3 y x4", () => {
  assert.equal(encumbranceState(20, 10).key, "unencumbered");
  assert.equal(encumbranceState(21, 10).key, "loaded");
  assert.equal(encumbranceState(31, 10).key, "overloaded");
  assert.equal(encumbranceState(41, 10).key, "excess");
});

test("la carga reduce movimiento según el estado", () => {
  assert.equal(applyEncumbrance({ movementRate: 6 }, encumbranceState(21, 10)).movementRate, 4);
  assert.equal(applyEncumbrance({ movementRate: 7 }, encumbranceState(31, 10)).movementRate, 3);
});

test("la armadura equipada cuenta a la mitad y la transportada completa", () => {
  const worn = item("armor", { quantity: 1, baseEncumbrance: 4, material: "bronze", equipped: true });
  const carried = item("armor", { quantity: 1, baseEncumbrance: 4, material: "bronze", equipped: false });
  assert.equal(itemEncumbrance(worn), 2);
  assert.equal(itemEncumbrance(carried), 4);
});

test("las armas usan su CRG y cada veinte objetos de CRG cero suman uno", () => {
  const weapon = item("weapon", { quantity: 2, encumbrance: 3 });
  const arrows = item("equipment", { quantity: 20, weight: 0 });
  assert.equal(totalCarriedEncumbrance([weapon, arrows]), 7);
});

test("solo FUE, DES y estilos de combate reciben la dificultad por carga", () => {
  assert.equal(skillUsesStrengthOrDexterity(item("skill", { characteristic1: "intelligence", characteristic2: "dexterity" })), true);
  assert.equal(skillUsesStrengthOrDexterity(item("skill", { characteristic1: "power", characteristic2: "charisma" })), false);
  assert.equal(skillUsesStrengthOrDexterity(item("combatStyle", {})), true);
});
