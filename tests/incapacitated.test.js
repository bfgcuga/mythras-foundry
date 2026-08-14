import test from "node:test";
import assert from "node:assert/strict";
import { automaticIncapacitatedCauses, hasActiveIncapacitatedEffect, incapacitatedCauses } from
  "../scripts/rules/incapacitated.js";

test("fatiga incapacitado o peor produce la causa automática", () => {
  assert.deepEqual(automaticIncapacitatedCauses({ fatigueKey: "debilitated" }), []);
  assert.deepEqual(automaticIncapacitatedCauses({ fatigueKey: "incapacitated" }), ["fatigue"]);
  assert.deepEqual(automaticIncapacitatedCauses({ fatigueKey: "dead" }), ["fatigue"]);
});

test("la herida critica y la fatiga conservan causas independientes", () => {
  assert.deepEqual(automaticIncapacitatedCauses({
    fatigueKey: "incapacitated", woundLevel: "major"
  }), ["fatigue", "majorWound"]);
});

test("la causa manual coexiste con las causas automáticas", () => {
  assert.deepEqual(incapacitatedCauses({
    fatigueKey: "fresh", woundLevel: "major", manual: true
  }), ["majorWound", "manual"]);
});

test("la presencia del estado consulta efectos reales y no estados derivados obsoletos", () => {
  const incapacitated = { disabled: false, statuses: new Set(["incapacitated"]) };
  assert.equal(hasActiveIncapacitatedEffect([incapacitated]), true);
  assert.equal(hasActiveIncapacitatedEffect([]), false);
  assert.equal(hasActiveIncapacitatedEffect([{ ...incapacitated, disabled: true }]), false);
});
