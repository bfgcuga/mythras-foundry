import test from "node:test";
import assert from "node:assert/strict";
import { calculateFall, COMBAT_ROUND_SECONDS, fallDistanceProfile,
  fallLargeSizeBonus, fallSizeDistanceReduction } from "../scripts/rules/fall.js";

test("la tabla de caída determina dados y localizaciones", () => {
  assert.deepEqual(fallDistanceProfile(1), { dice: 0, locations: 0 });
  assert.deepEqual(fallDistanceProfile(5), { dice: 1, locations: 1 });
  assert.deepEqual(fallDistanceProfile(10), { dice: 2, locations: 2 });
  assert.deepEqual(fallDistanceProfile(15), { dice: 3, locations: 3 });
  assert.deepEqual(fallDistanceProfile(20), { dice: 4, locations: 4 });
  assert.deepEqual(fallDistanceProfile(21), { dice: 5, locations: 5 });
});

test("TAM pequeño reduce distancia y TAM grande aumenta el daño", () => {
  assert.deepEqual([1, 2, 4, 6, 8, 10].map(fallSizeDistanceReduction), [10, 8, 5, 3, 1, 0]);
  assert.equal(fallLargeSizeBonus(20), 0);
  assert.equal(fallLargeSizeBonus(21), 1);
  assert.equal(fallLargeSizeBonus(35), 2);
  assert.equal(calculateFall({ distance: 1, actorSize: 35 }).formula, "0");
  assert.equal(calculateFall({ distance: 2, actorSize: 35 }).formula, "3d6");
});

test("Acrobacias y superficie blanda reducen la distancia antes de consultar la tabla", () => {
  const fall = calculateFall({ distance: 12, actorSize: 10,
    acrobaticsSuccess: true, softSurface: true });
  assert.equal(fall.referenceDistance, 6);
  assert.equal(fall.effectiveDistance, 4);
  assert.equal(fall.formula, "1d6");
  assert.equal(fall.locations, 1);
});

test("el vehículo convierte velocidad por asalto y reproduce el ejemplo de 20 metros", () => {
  const fall = calculateFall({ kind: "vehicle", distance: 0,
    speedPerRound: 20, actorSize: 10 });
  assert.equal(COMBAT_ROUND_SECONDS, 5);
  assert.equal(fall.speedPerSecond, 4);
  assert.equal(fall.effectiveDistance, 10);
  assert.equal(fall.formula, "2d6");
  assert.equal(fall.locations, 2);
});

test("un objeto suma dados por TAM al daño de la distancia y afecta una zona", () => {
  const fall = calculateFall({ kind: "object", distance: 10, objectSize: 12 });
  assert.equal(fall.formula, "4d6");
  assert.equal(fall.locations, 1);
});
