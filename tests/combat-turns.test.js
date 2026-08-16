import test from "node:test";
import assert from "node:assert/strict";
import { composedInitiative, nextCombatPosition, splitComposedInitiative,
  uniqueActorEntries } from "../scripts/rules/combat-turns.js";

test("la iniciativa compuesta conserva el orden principal y el desempate", () => {
  assert.equal(composedInitiative(17, 83), 17.083);
  assert.deepEqual(splitComposedInitiative(17.083), { primary: 17, tieBreak: 83 });
  assert.ok(composedInitiative(17, 100) < composedInitiative(18, 1));
});

test("avanza dentro del ciclo y omite participantes sin acciones", () => {
  const result = nextCombatPosition({ turns: [
    { eligible: true, current: 1 }, { eligible: true, current: 0 },
    { eligible: true, current: 2 }
  ], currentIndex: 0, round: 2, cycle: 1 });
  assert.deepEqual(result, { transition: "turn", round: 2, cycle: 1, turn: 2 });
});

test("un recorrido completo crea otro ciclo si quedan acciones", () => {
  const result = nextCombatPosition({ turns: [
    { eligible: true, current: 1 }, { eligible: false, current: 3 }
  ], currentIndex: 1, round: 3, cycle: 2 });
  assert.deepEqual(result, { transition: "cycle", round: 3, cycle: 3, turn: 0 });
});

test("sin acciones pendientes solicita un asalto nuevo", () => {
  const result = nextCombatPosition({ turns: [
    { eligible: true, current: 0 }, { eligible: false, current: 2 }
  ], currentIndex: 0, round: 4, cycle: 3 });
  assert.deepEqual(result, { transition: "round", round: 5, cycle: 1, turn: null });
});

test("deduplica actores enlazados y conserva actores sintéticos", () => {
  const linked = { id: "a", uuid: "Actor.a", isToken: false };
  const synthetic1 = { id: "a", uuid: "Scene.s.Token.1.Actor.a", isToken: true };
  const synthetic2 = { id: "a", uuid: "Scene.s.Token.2.Actor.a", isToken: true };
  const result = uniqueActorEntries([
    { actor: linked }, { actor: linked }, { actor: synthetic1 }, { actor: synthetic2 }
  ]);
  assert.equal(result.length, 3);
});
