import test from "node:test";
import assert from "node:assert/strict";
import { fatigueCheckTarget, validateFatigueCheckResponse }
  from "../scripts/rules/fatigue-check-chat.js";

function state() {
  return { revision: 2, participants: [{ actorUuid: "Actor.hero", status: "pending" }] };
}

test("la dificultad transforma el objetivo y estándar lo conserva", () => {
  assert.equal(fatigueCheckTarget(60, "standard"), 60);
  assert.equal(fatigueCheckTarget(60, "easy"), 90);
  assert.equal(fatigueCheckTarget(60, "hard"), 40);
  assert.equal(fatigueCheckTarget(60, "formidable"), 30);
});

test("la respuesta exige revisión vigente, participante pendiente y propiedad", () => {
  const user = { id: "user", isGM: false };
  const actor = { testUserPermission: () => true };
  const request = { revision: 2, actorUuid: "Actor.hero", userId: "user" };
  assert.equal(validateFatigueCheckResponse(state(), request, { actor, user }), null);
  assert.equal(validateFatigueCheckResponse(state(), { ...request, revision: 1 },
    { actor, user }), "revision");
  assert.equal(validateFatigueCheckResponse(state(), { ...request, actorUuid: "Actor.other" },
    { actor, user }), "participant");
  assert.equal(validateFatigueCheckResponse(state(), request,
    { actor: { testUserPermission: () => false }, user }), "ownership");
});
