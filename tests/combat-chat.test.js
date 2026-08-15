import test from "node:test";
import assert from "node:assert/strict";
import { preferredCombatCoordinator, validateCombatResponse } from "../scripts/rules/combat-chat.js";

test("el primer DJ activo coordina y el autor es el respaldo", () => {
  const users = [{ id: "z", active: true, isGM: true }, { id: "a", active: true, isGM: true },
    { id: "author", active: true, isGM: false }];
  assert.equal(preferredCombatCoordinator(users, "author"), "a");
  assert.equal(preferredCombatCoordinator(users.filter((user) => !user.isGM), "author"), "author");
});

test("la respuesta de combate rechaza estado, revision, propiedad y tipo invalidos", () => {
  const combat = { status: "awaitingDefense", revision: 2 };
  const actor = { testUserPermission: () => true };
  const user = { id: "u", isGM: false };
  const valid = { revision: 2, userId: "u", defense: { type: "parry" } };
  assert.equal(validateCombatResponse(combat, valid, { actor, user }), null);
  assert.equal(validateCombatResponse({ ...combat, status: "resolved" }, valid, { actor, user }), "state");
  assert.equal(validateCombatResponse(combat, { ...valid, revision: 1 }, { actor, user }), "revision");
  assert.equal(validateCombatResponse(combat, valid,
    { actor: { testUserPermission: () => false }, user }), "ownership");
  assert.equal(validateCombatResponse(combat, { ...valid, defense: { type: "block" } },
    { actor, user }), "invalid");
});
