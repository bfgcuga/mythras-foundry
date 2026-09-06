import test from "node:test";
import assert from "node:assert/strict";
import { activeEntanglements, actorHasVitalEntanglement, actorIsRooted,
  entanglementKind, weaponIsEntangled } from "../scripts/rules/entanglement.js";
import { resolveActorConditions } from "../scripts/rules/actor-conditions.js";

const effect = (data) => ({ id: data.locationId, disabled: false,
  flags: { "mythras-foundry": { timedCondition: { key: "entangled", ...data } } } });
const location = (id, category, hpClass = "standard") => ({ id, name: id, type: "hitLocation",
  system: { category, hpClass, currentHitPoints: 5, maxHitPoints: 5 } });

test("Enredar distingue brazo, pierna y zona vital", () => {
  assert.equal(entanglementKind(location("arm", "limb", "arm")), "arm");
  assert.equal(entanglementKind(location("leg", "limb")), "leg");
  assert.equal(entanglementKind(location("chest", "chest", "chest")), "vital");
});

test("la condición identifica armas bloqueadas y movimiento inmovilizado", () => {
  const weapon = { id: "netted-sword", type: "weapon" };
  const items = new Map([[weapon.id, weapon], ["leg", location("leg", "limb")]]);
  items.filter = (fn) => [...items.values()].filter(fn);
  const actor = { items, effects: [effect({ locationId: "leg", kind: "leg" }),
    effect({ locationId: "arm", kind: "arm", weaponId: weapon.id })], statuses: new Set() };
  assert.equal(activeEntanglements(actor).length, 2);
  assert.equal(actorIsRooted(actor), true);
  assert.equal(weaponIsEntangled(weapon, actor), true);
  assert.equal(resolveActorConditions(actor, { baseAttributes: { movementRate: 6 } })
    .attributes.movementRate, 0);
});

test("un enredo vital aumenta un grado cualquier dificultad", () => {
  const actor = { items: [], effects: [effect({ locationId: "head", kind: "vital" })],
    statuses: new Set(), system: { strength: 10 } };
  actor.items.filter = Array.prototype.filter.bind(actor.items);
  assert.equal(actorHasVitalEntanglement(actor), true);
  assert.equal(resolveActorConditions(actor, { baseDifficulty: "hard" }).difficulty,
    "formidable");
});
