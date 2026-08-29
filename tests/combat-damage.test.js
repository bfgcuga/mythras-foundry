import test from "node:test";
import assert from "node:assert/strict";
import { damageLocationChoices, prepareDamageChecks
} from "../scripts/rules/combat-damage.js";

test("la fase de daño conserva resoluciones previas y ordena efectos antes que heridas", () => {
  const location = { id: "leg", name: "Pierna",
    system: { category: "limb", hpClass: "leg" } };
  const previous = { winner: "left" };
  const combat = { defender: { locations: [location] }, damage: { locationId: "leg" },
    effects: { winner: "attacker", selections: [{ key: "test", side: "attacker", slot: 0,
      name: "Efecto", endurance: true, requiresWound: true, status: "conditional" }],
    checks: [{ id: "wound-leg", resolution: previous, status: "resolved" }] } };
  const checks = prepareDamageChecks(combat, { location, resultingWound: "serious",
    penetratingDamage: 2 });
  assert.deepEqual(checks.map((entry) => entry.source), ["effect", "wound"]);
  assert.equal(checks[1].resolution, previous);
  assert.equal(combat.effects.selections[0].status, "pending");
});

test("Elegir Localización limita las opciones de la propuesta de daño", () => {
  const combat = { defender: { locations: [{ id: "head" }, { id: "arm" }] },
    damage: { locationId: "arm" }, effects: { selections: [{ key: "elegir-localizacion",
      ruleKey: "chooseLocation", stackable: false }] } };
  assert.deepEqual(damageLocationChoices(combat).map((entry) => entry.id), ["arm"]);
});
