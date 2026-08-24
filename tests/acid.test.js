import test from "node:test";
import assert from "node:assert/strict";
import { ACID_CONCENTRATIONS, acidArmorLayer, acidDamageResult,
  acidExposureDuration, acidReviewConfiguration } from "../scripts/rules/acid.js";

function armor(id, points, { equipped = true, locationId = "torso" } = {}) {
  return { id, type: "armor", system: { armorPoints: points, equipped,
    coveredLocationIds: [locationId] } };
}

test("las concentraciones de ácido conservan las fórmulas de Mythras", () => {
  assert.deepEqual(ACID_CONCENTRATIONS.weak,
    { damageFormula: "1d2", durationFormula: "1" });
  assert.deepEqual(ACID_CONCENTRATIONS.strong,
    { damageFormula: "1d4", durationFormula: "1d2" });
  assert.deepEqual(ACID_CONCENTRATIONS.concentrated,
    { damageFormula: "1d6", durationFormula: "1d3" });
});

test("el daño corroe una sola capa y solo el exceso alcanza la localización", () => {
  assert.deepEqual(acidDamageResult({ damage: 5, armorPoints: 3, hitPoints: 6 }), {
    damage: 5, armorBefore: 3, armorAfter: 0, absorbed: 3,
    penetrating: 2, hitPointsBefore: 6, hitPointsAfter: 4
  });
  assert.equal(acidDamageResult({ damage: 2, armorPoints: 5, hitPoints: 6 }).penetrating, 0);
});

test("la capa equipada más fuerte gana con desempate estable", () => {
  const location = { id: "torso", system: { armorPoints: 2 } };
  assert.equal(acidArmorLayer(location, [armor("b", 4), armor("a", 4)]).item.id, "a");
  assert.equal(acidArmorLayer(location, [armor("a", 8, { equipped: false })]).kind, "natural");
  assert.equal(acidArmorLayer({ id: "torso", system: { armorPoints: 0 } }, []), null);
});

test("la tirada inicial forma parte de la duración y la inmersión no vence", () => {
  assert.deepEqual(acidExposureDuration({ exposure: "splash", rolledDuration: 1 }), {
    totalApplications: 1, applicationsRemaining: 0, indefinite: false
  });
  assert.deepEqual(acidExposureDuration({ exposure: "splash", rolledDuration: 3 }), {
    totalApplications: 3, applicationsRemaining: 2, indefinite: false
  });
  assert.deepEqual(acidExposureDuration({ exposure: "immersion" }), {
    applicationsRemaining: null, indefinite: true
  });
});

test("los estados de salpicadura e inmersión preparan revisiones distintas", () => {
  const splash = { statuses: new Set(["acidSplash"]), flags: {} };
  const immersion = { statuses: new Set(["acidImmersion"]), flags: {} };
  assert.equal(acidReviewConfiguration(splash).applicationsRemaining, 1);
  assert.equal(acidReviewConfiguration(splash).exposure, "splash");
  assert.equal(acidReviewConfiguration(immersion).applicationsRemaining, null);
  assert.equal(acidReviewConfiguration(immersion).exposure, "immersion");
});
