import test from "node:test";
import assert from "node:assert/strict";
import { availableCombatActions, braceSize, chargeEligibility, chargeModifiers,
  contestWinner, interruptPriority, isEngaged, movementDeclaration,
  normalizeCombatActionState } from "../scripts/rules/combat-actions.js";

test("las acciones proactivas solo aparecen en el turno propio con PA", () => {
  const available = availableCombatActions({ inCombat: true, isActive: true, actionPoints: 1,
    hasPreparedWeapon: true, hasRangedWeapon: true, canAttack: true });
  assert.equal(available.brace, true); assert.equal(available.aim, true);
  assert.equal(available.move, true); assert.equal(available.stand, false);
  assert.equal(availableCombatActions({ inCombat: true, isActive: false, actionPoints: 3 }).move, false);
});

test("traba, postura y fuentes restringen únicamente sus acciones", () => {
  const relations = { one: { status: "engaged", sides: { a: {}, b: {} } } };
  assert.equal(isEngaged(relations, "a"), true);
  const available = availableCombatActions({ inCombat: true, isActive: true, actionPoints: 2,
    engaged: true, prone: true, hasRestraint: true });
  assert.equal(available.move, false); assert.equal(available.stand, true);
  assert.equal(available.struggle, true);
});

test("el movimiento conserva continuidad entre asaltos completos", () => {
  const first = movementDeclaration({ mode: "run", round: 2, cycle: 1 });
  const second = movementDeclaration({ mode: "sprint", round: 3, cycle: 1, previous: first });
  assert.equal(second.continuousFromPreviousRound, true);
  assert.equal(chargeEligibility(first, 3).eligible, true);
  assert.equal(chargeEligibility(second, 3).eligible, false);
});

test("carga y afianzamiento redondean siempre hacia arriba", () => {
  assert.deepEqual(chargeModifiers({ locomotion: "biped" }), {
    difficultySteps: 1, damageModifierSteps: 1, weaponSizeSteps: 1 });
  assert.equal(chargeModifiers({ locomotion: "quadruped" }).damageModifierSteps, 2);
  assert.equal(chargeModifiers({ locomotion: "quadruped", mountedLancer: true }).difficultySteps, 0);
  assert.equal(braceSize(5, "push"), 8); assert.equal(braceSize(5, "bash"), 10);
});

test("las oposiciones desempatan por dado alto y la interrupción por iniciativa", () => {
  assert.equal(contestWinner({ level: 2, roll: 31 }, { level: 2, roll: 72 }), "right");
  assert.equal(interruptPriority([{ combatantId: "a", initiative: 12 },
    { combatantId: "b", initiative: 15 }]).combatantId, "b");
});

test("el esquema táctico normaliza colecciones antiguas", () => {
  const state = normalizeCombatActionState({ revision: 4, delays: { a: { status: "reserved" } } });
  assert.equal(state.revision, 4); assert.equal(state.delays.a.status, "reserved");
  assert.deepEqual(state.movements, {}); assert.deepEqual(state.actions, {});
});
