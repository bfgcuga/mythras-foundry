import test from "node:test";
import assert from "node:assert/strict";

import { calculateResourceValue } from "../scripts/rules/resources.js";

test("los controles de recursos respetan cero y el máximo", () => {
  assert.equal(calculateResourceValue(1, 3, "decrease"), 0);
  assert.equal(calculateResourceValue(0, 3, "decrease"), 0);
  assert.equal(calculateResourceValue(2, 3, "increase"), 3);
  assert.equal(calculateResourceValue(3, 3, "increase"), 3);
});

test("restaurar rellena el recurso hasta su máximo", () => {
  assert.equal(calculateResourceValue(0, 7, "restore"), 7);
  assert.equal(calculateResourceValue(4, 7, "restore"), 7);
});
