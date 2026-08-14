import test from "node:test";
import assert from "node:assert/strict";
import { automaticIncapacitatedCauses, incapacitatedCauses } from
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
