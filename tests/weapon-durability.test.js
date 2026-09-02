import test from "node:test";
import assert from "node:assert/strict";
import { weaponCanEquip, weaponDamageResult, weaponDurabilityState,
  weaponHasDurability } from "../scripts/rules/weapon-durability.js";

test("la durabilidad deriva estados sin persistirlos", () => {
  assert.equal(weaponDurabilityState({ currentHitPoints: 8, maxHitPoints: 8 }), "intact");
  assert.equal(weaponDurabilityState({ currentHitPoints: 3, maxHitPoints: 8 }), "damaged");
  assert.equal(weaponDurabilityState({ currentHitPoints: 0, maxHitPoints: 8 }), "broken");
  assert.equal(weaponDurabilityState({ currentHitPoints: 0, maxHitPoints: 0 }), "indestructible");
  assert.equal(weaponCanEquip({ currentHitPoints: 3, maxHitPoints: 8 }), true);
  assert.equal(weaponCanEquip({ currentHitPoints: 0, maxHitPoints: 8 }), false);
  assert.equal(weaponCanEquip(null), false);
  assert.equal(weaponHasDurability({ maxHitPoints: 0 }), false);
});

test("el daño de arma usa PA, limita PG a cero y clasifica el resultado", () => {
  assert.deepEqual(weaponDamageResult({ currentHitPoints: 8, armorPoints: 4, damage: 3 }),
    { armorPoints: 4, penetratingDamage: 0, beforeHitPoints: 8,
      afterHitPoints: 8, result: "unharmed" });
  assert.equal(weaponDamageResult({ currentHitPoints: 8, armorPoints: 4, damage: 7 }).result,
    "damaged");
  assert.deepEqual(weaponDamageResult({ currentHitPoints: 2, armorPoints: 1, damage: 9 }),
    { armorPoints: 1, penetratingDamage: 8, beforeHitPoints: 2,
      afterHitPoints: 0, result: "broken" });
});
