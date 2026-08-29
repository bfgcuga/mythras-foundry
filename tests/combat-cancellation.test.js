import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { combatCanBeCancelled } from "../scripts/rules/combat-cancellation.js";

test("el ataque puede cancelarse hasta aplicar una consecuencia", () => {
  for (const status of ["awaitingDefense", "awaitingEffects", "resolved"]) {
    assert.equal(combatCanBeCancelled({ status, damage: { status: "unavailable" } }), true);
  }
  assert.equal(combatCanBeCancelled({ status: "resolved", damage: { status: "proposed" } }), true);
  assert.equal(combatCanBeCancelled({ status: "resolved", damage: { status: "applying" } }), false);
  assert.equal(combatCanBeCancelled({ status: "resolved", damage: { status: "applied" } }), false);
  assert.equal(combatCanBeCancelled({ status: "resolved", consequencesApplied: true,
    damage: { status: "ready" } }), false);
  assert.equal(combatCanBeCancelled({ status: "cancelled", damage: { status: "unavailable" } }), false);
});

test("cancelar restituye ambos PA y no solicita avanzar el tracker", () => {
  const source = fs.readFileSync(new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8");
  assert.match(source, /economy\?\.attackSpent[\s\S]*currentActionPoints\(attacker\) \+ 1/);
  assert.match(source, /economy\?\.defenseSpent[\s\S]*currentActionPoints\(defender\) \+ 1/);
  const cancelBody = source.slice(source.indexOf("async function cancelCombat"),
    source.indexOf("async function closeCombatExchange"));
  assert.doesNotMatch(cancelBody, /advanceCombatTurnForExchange/);
  assert.match(source, /await cancelCombat\(message, current, reason\)/);
});
