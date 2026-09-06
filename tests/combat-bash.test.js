import test from "node:test";
import assert from "node:assert/strict";
import { bashKnockback } from "../scripts/rules/combat-bash.js";

test("Golpetazo empuja con el daño bruto según escudo o arma contundente", () => {
  assert.deepEqual(bashKnockback({ damage: 11, weaponType: "shield",
    attackerSize: 12, targetSize: 24 }), { allowed: true, divisor: 2, distance: 5 });
  assert.deepEqual(bashKnockback({ damage: 11, weaponType: "melee",
    attackerSize: 12, targetSize: 8 }), { allowed: true, divisor: 3, distance: 3 });
});

test("Golpetazo no afecta a blancos que superan el doble de TAM", () => {
  assert.deepEqual(bashKnockback({ damage: 30, weaponType: "shield",
    attackerSize: 10, targetSize: 21 }), { allowed: false, divisor: 2, distance: 0 });
});
