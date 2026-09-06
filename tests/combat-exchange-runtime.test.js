import test from "node:test";
import assert from "node:assert/strict";
import { advanceCombatExchange,
  closeTerminalCombatExchange } from "../scripts/rules/combat-exchange-runtime.js";

test("Ráfaga cierra el intercambio sin avanzar el tracker", async () => {
  const combat = { status: "resolved", revision: 2, consequencesApplied: true,
    effects: { selections: [] }, damage: { status: "unavailable" },
    turnEconomy: { combatId: "tracker", combatantId: "attacker", round: 1,
      turnAdvanced: false, retainTurn: true, retainTurnReason: "rafaga" } };
  const message = { async update(change) { this.change = change; } };
  let turns = 0;
  const result = await advanceCombatExchange(message, combat, {
    combatById: () => ({ started: true, combatant: { id: "attacker" }, round: 1,
      async nextTurn() { turns += 1; } }), render: () => "closed", flagScope: "scope"
  });
  assert.equal(result, true);
  assert.equal(turns, 0);
  assert.equal(combat.turnEconomy.turnAdvanced, true);
});

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
