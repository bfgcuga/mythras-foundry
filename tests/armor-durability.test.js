import test from "node:test";
import assert from "node:assert/strict";
import { armorCanEquip, armorDurabilityState, armorMaximumPoints, armorSunderLayer,
  armorSunderResult } from "../scripts/rules/armor-durability.js";

const armor = (id, points, options = {}) => ({ id, name: id, type: "armor", system: {
  armorPoints: points, maxArmorPoints: options.maximum ?? 0, equipped: options.equipped ?? true,
  coveredLocationIds: options.locations ?? ["chest"] } });

test("la durabilidad de armadura conserva el máximo original y bloquea solo la destruida", () => {
  assert.equal(armorMaximumPoints(armor("old", 5)), 5);
  assert.equal(armorDurabilityState(armor("intact", 5, { maximum: 5 })), "intact");
  assert.equal(armorDurabilityState(armor("damaged", 2, { maximum: 5 })), "damaged");
  assert.equal(armorDurabilityState(armor("broken", 0, { maximum: 5 })), "broken");
  assert.equal(armorCanEquip(armor("broken", 0, { maximum: 5 })), false);
  assert.equal(armorCanEquip(armor("clothes", 0)), true);
});

test("Hender absorbe primero la protección, después reduce sus PA y finalmente traspasa PG", () => {
  assert.deepEqual(armorSunderResult({ damage: 4, protectionPoints: 5, armorPoints: 5 }), {
    damage: 4, protectionPoints: 5, excess: 0, armorBefore: 5, armorDamage: 0,
    armorAfter: 5, penetratingDamage: 0 });
  assert.deepEqual(armorSunderResult({ damage: 8, protectionPoints: 5, armorPoints: 5 }), {
    damage: 8, protectionPoints: 5, excess: 3, armorBefore: 5, armorDamage: 3,
    armorAfter: 2, penetratingDamage: 0 });
  assert.deepEqual(armorSunderResult({ damage: 13, protectionPoints: 5, armorPoints: 5 }), {
    damage: 13, protectionPoints: 5, excess: 8, armorBefore: 5, armorDamage: 5,
    armorAfter: 0, penetratingDamage: 3 });
});

test("Hender elige la capa equipada más fuerte y usa protección natural si no existe", () => {
  const location = { id: "chest", system: { armorPoints: 2 } };
  assert.equal(armorSunderLayer(location, [armor("padding", 2), armor("plate", 5)]).item.id,
    "plate");
  assert.equal(armorSunderLayer(location, [armor("plate", 5, { equipped: false })]).kind,
    "natural");
});
