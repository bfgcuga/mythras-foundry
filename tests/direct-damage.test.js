import test from "node:test";
import assert from "node:assert/strict";

import { directDamageResult,
  normalizeDirectDamageConfiguration } from "../scripts/rules/direct-damage.js";

test("el daño directo admite una cantidad específica", () => {
  const configuration = normalizeDirectDamageConfiguration({ mode: "fixed", amount: 7,
    locationIds: ["arm", "arm", "chest"] });
  assert.equal(configuration.mode, "fixed");
  assert.equal(configuration.amount, 7);
  assert.deepEqual(configuration.locationIds, ["arm", "chest"]);
  assert.equal(configuration.randomLocation, false);
});

test("el daño directo conserva fórmulas y la selección aleatoria", () => {
  const configuration = normalizeDirectDamageConfiguration({ mode: "formula",
    formula: "2d6+1", randomLocation: true });
  assert.equal(configuration.mode, "formula");
  assert.equal(configuration.formula, "2d6+1");
  assert.equal(configuration.randomLocation, true);
});

test("el daño directo resta PG sin absorción de armadura", () => {
  assert.deepEqual(directDamageResult(6, 4), {
    damage: 6, hitPointsBefore: 4, hitPointsAfter: -2 });
});
