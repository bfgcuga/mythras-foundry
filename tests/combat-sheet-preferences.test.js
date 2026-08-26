import test from "node:test";
import assert from "node:assert/strict";

import { preferAttackChoices } from "../scripts/ui/combat-sheet.js";

test("el ataque propone primero el arma y conserva el escudo como alternativa", () => {
  const choices = preferAttackChoices([
    { id: "shield", weaponType: "shield" },
    { id: "sword", weaponType: "melee" },
    { id: "bow", weaponType: "ranged" }
  ]);
  assert.deepEqual(choices.map((choice) => choice.id), ["sword", "bow", "shield"]);
});
