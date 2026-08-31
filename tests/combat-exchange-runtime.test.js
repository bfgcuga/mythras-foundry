import test from "node:test";
import assert from "node:assert/strict";
import { closeTerminalCombatExchange } from "../scripts/rules/combat-exchange-runtime.js";

test("cerrar un intercambio terminal obsoleto lo sella sin mover otro turno", async () => {
  const current = { status: "cancelled", revision: 4,
    turnEconomy: { combatId: "tracker", combatantId: "old", round: 1,
      turnAdvanced: false } };
  const message = { async update(change) { this.change = change; } };
  let advanced = false;
  const result = await closeTerminalCombatExchange(message, current, {
    clone: structuredClone, combatById: () => ({ started: true,
      combatant: { id: "other" }, round: 1 }), render: () => "closed",
    advance: async () => { advanced = true; }, flagScope: "scope" });
  assert.equal(result, true);
  assert.equal(advanced, false);
  assert.equal(message.change["flags.scope.combat"].turnEconomy.turnAdvanced, true);
  assert.equal(current.turnEconomy.turnAdvanced, false);
});
