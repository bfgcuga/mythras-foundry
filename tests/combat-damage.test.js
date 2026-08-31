import test from "node:test";
import assert from "node:assert/strict";
import { damageLocationChoices, majorWoundLuckAdjustment, prepareDamageChecks
} from "../scripts/rules/combat-damage.js";

test("la fase de daño conserva resoluciones previas y ordena efectos antes que heridas", () => {
  const location = { id: "leg", name: "Pierna",
    system: { category: "limb", hpClass: "leg" } };
  const previous = { winner: "left" };
  const combat = { defender: { locations: [location] }, damage: { locationId: "leg" },
    effects: { winner: "attacker", selections: [{ key: "test", side: "attacker", slot: 0,
      name: "Efecto", ruleKey: "guided", endurance: true, requiresWound: true,
      status: "conditional" }],
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

test("Empalar queda resuelto al penetrar y no bloquea la prueba de la herida", () => {
  const location = { id: "arm", name: "Brazo",
    system: { category: "arm", hpClass: "arm" } };
  const combat = { defender: { locations: [location] }, damage: { locationId: "arm" },
    effects: { winner: "attacker", selections: [{ key: "empalar", side: "attacker", slot: 0,
      name: "Empalar", ruleKey: "impale", stage: "damageRoll", requiresWound: true,
      status: "conditional" }], checks: [] } };

  const checks = prepareDamageChecks(combat, { location, resultingWound: "major",
    penetratingDamage: 8 });

  assert.equal(combat.effects.selections[0].status, "resolved");
  assert.deepEqual(checks.map((entry) => entry.source), ["wound"]);
});

test("una resistencia no condicionada al daño se conserva al recalcular la propuesta", () => {
  const location = { id: "arm", name: "Brazo", system: { category: "arm", hpClass: "arm" } };
  const previous = { id: "effect-defender-0", source: "effect", effectKey: "cegar-oponente",
    effectSide: "defender", effectSlot: 0, status: "pending" };
  const combat = { effects: { winner: "defender", selections: [{ key: "cegar-oponente",
    side: "defender", slot: 0, name: "Cegar oponente" }], checks: [previous] } };
  const checks = prepareDamageChecks(combat, { location, resultingWound: "healthy",
    penetratingDamage: 0, weaponTarget: true });
  assert.equal(checks.length, 1);
  assert.equal(checks[0].id, previous.id);
  assert.equal(checks[0].allowsShieldStyle, true);
});

test("la suerte reduce una herida crítica al mínimo exacto de herida grave", () => {
  assert.deepEqual(majorWoundLuckAdjustment({ beforeHitPoints: 5, maxHitPoints: 5,
    penetratingDamage: 11 }), { afterHitPoints: -4, penetratingDamage: 9,
    resultingWound: "serious" });
  assert.equal(majorWoundLuckAdjustment({ beforeHitPoints: 5, maxHitPoints: 5,
    penetratingDamage: 9 }), null);
});
