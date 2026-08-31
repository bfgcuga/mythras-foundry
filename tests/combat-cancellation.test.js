import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { combatCanBeCancelled } from "../scripts/rules/combat-cancellation.js";
import { exchangeTerminal, resolvePendingExchangeSteps
} from "../scripts/rules/combat-exchange-state.js";

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
  const runtime = fs.readFileSync(new URL("../scripts/rules/combat-exchange-runtime.js",
    import.meta.url), "utf8");
  assert.match(runtime, /\["attackSpent", "attackRefunded", combat\.attacker\]/);
  assert.match(runtime, /\["defenseSpent", "defenseRefunded", combat\.defender\]/);
  assert.match(runtime, /currentActionPoints\(actor\) \+ 1/);
  const cancelBody = source.slice(source.indexOf("async function cancelCombat"),
    source.indexOf("async function closeCombatExchange"));
  assert.doesNotMatch(cancelBody, /advanceCombatTurnForExchange/);
});

test("cerrar un intercambio terminal avanza aunque todavía pueda cancelarse", () => {
  const runtime = fs.readFileSync(new URL("../scripts/rules/combat-exchange-runtime.js",
    import.meta.url), "utf8");
  assert.match(runtime, /advance\(message, combat, \{ force: true \}\)/);
  assert.match(runtime, /\(!force && combatCanBeCancelled\(combat\)\)/);
});

test("el cierre forzado resuelve los pasos pendientes sin cancelar daño aplicado", () => {
  const combat = { status: "resolved", damage: { status: "applied" },
    effects: { checks: [{ status: "pending" }], selections: [{ status: "resolved" }] },
    consequences: [{ key: "manualStep", status: "pending" }] };

  resolvePendingExchangeSteps(combat, { note: "Decisión del DJ", userId: "gm", resolvedAt: 10 });

  assert.equal(combat.effects.checks[0].status, "resolved");
  assert.equal(combat.effects.checks[0].resolution.manual, true);
  assert.equal(combat.consequences[0].status, "resolved");
  assert.equal(combat.consequences[0].note, "Decisión del DJ");
  assert.equal(exchangeTerminal(combat), true);
});

test("una herida crítica de extremidad terminada no necesita consecuencia narrativa", () => {
  const combat = { status: "resolved", damage: { status: "applied" },
    effects: { checks: [{ status: "resolved" }], selections: [{ status: "resolved" }] },
    consequences: [] };
  assert.equal(exchangeTerminal(combat), true);
});

test("una tirada de herida provisional impide cerrar hasta aceptar su resultado", () => {
  const combat = { status: "resolved", damage: { status: "applied" },
    effects: { checks: [{ status: "rolled", resolution: { rawRoll: 42 } }], selections: [] },
    consequences: [] };
  assert.equal(exchangeTerminal(combat), false);
  resolvePendingExchangeSteps(combat, { userId: "gm", resolvedAt: 10 });
  assert.equal(combat.effects.checks[0].status, "resolved");
  assert.equal(combat.effects.checks[0].resolution.rawRoll, 42);
  assert.equal(combat.effects.checks[0].resolution.manual, undefined);
});
