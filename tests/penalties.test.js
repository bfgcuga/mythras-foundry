import test from "node:test";
import assert from "node:assert/strict";

import { penalizedResource, penalizedValue } from "../scripts/rules/penalties.js";

test("un valor solo se marca cuando el efectivo cambia", () => {
  assert.deepEqual(penalizedValue(50, 50), { base: 50, effective: 50, penalized: false });
  assert.deepEqual(penalizedValue(50, 34), { base: 50, effective: 34, penalized: true });
});

test("un recurso temporal nunca supera el maximo penalizado", () => {
  assert.deepEqual(penalizedResource(2, 2, 1), {
    base: "2/2",
    effective: "1/1",
    effectiveCurrent: 1,
    penalized: true
  });
});
