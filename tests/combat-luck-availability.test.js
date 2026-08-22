import test from "node:test";
import assert from "node:assert/strict";
import { combatRollLuckAllowed } from "../scripts/rules/combat-luck-availability.js";

test("permite Suerte tras ataque y parada cuando no hay efectos que elegir", () => {
  assert.equal(combatRollLuckAllowed({ status: "resolved",
    effects: { confirmed: true, selections: [] }, damage: { status: "ready" } }), true);
});

test("permite Suerte mientras los efectos aún no se han elegido", () => {
  assert.equal(combatRollLuckAllowed({ status: "awaitingEffects",
    effects: { confirmed: false, selections: [] }, damage: { status: "blocked" } }), true);
});

test("bloquea Suerte después de elegir efectos o tirar el daño", () => {
  assert.equal(combatRollLuckAllowed({ status: "resolved",
    effects: { selections: [{ key: "chooseLocation" }] }, damage: { status: "ready" } }), false);
  assert.equal(combatRollLuckAllowed({ status: "resolved",
    effects: { selections: [] }, damage: { status: "rolled" } }), false);
});
