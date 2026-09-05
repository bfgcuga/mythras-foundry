import test from "node:test";
import assert from "node:assert/strict";
import { prepareHitLocationTable } from "../scripts/ui/hit-location-table.js";
import { hasBrokenHitLocationReference, restoredHumanHitLocationData }
  from "../scripts/rules/hit-locations.js";

test("restaurar anatomía humana conserva la herida permanente reconocible", () => {
  const existing = [{ id: "old-head", name: "Cabeza", type: "hitLocation", system: {
    nameKey: "head", rangeStart: 19, rangeEnd: 20, maxHitPoints: 2,
    currentHitPoints: -1, disabled: true, permanentWound: {
      severity: 2, roll: 2, originalMaxHitPoints: 6, effectiveMaxHitPoints: 2,
      lostHitResults: 0, description: "Cicatriz"
    }
  } }];
  const restored = restoredHumanHitLocationData({ constitution: 12, size: 13 }, existing);
  const head = restored.find((location) => location.system.nameKey === "head");
  assert.equal(head.system.permanentWound.severity, 2);
  assert.equal(head.system.permanentWound.description, "Cicatriz");
  assert.equal(head.system.maxHitPoints, 2);
  assert.equal(head.system.currentHitPoints, -1);
  assert.equal(head.system.disabled, true);
});

test("detecta armaduras y armas que apuntan a IDs de localización borrados", () => {
  const locations = [{ id: "head", type: "hitLocation", system: {} }];
  const helmet = { type: "armor", system: { coveredLocationIds: ["deleted"] } };
  const sword = { type: "weapon", system: { durabilitySource: "independent",
    linkedLocationId: "deleted" } };
  const horn = { type: "weapon", system: { durabilitySource: "hitLocation",
    linkedLocationId: "deleted" } };
  assert.equal(hasBrokenHitLocationReference(helmet, locations), true);
  assert.equal(hasBrokenHitLocationReference(sword, locations), false);
  assert.equal(hasBrokenHitLocationReference(horn, locations), true);
  helmet.system.coveredLocationIds = ["head"];
  assert.equal(hasBrokenHitLocationReference(helmet, locations), false);
});

test("el preparador común resuelve estados, armadura y bloqueo pasivo", () => {
  const location = { id: "chest", type: "hitLocation", name: "Pecho", system: {
    rangeStart: 10, rangeEnd: 12, armorPoints: 1, woundLevel: "major",
    currentHitPoints: 2, maxHitPoints: 1, disabled: false,
    permanentWound: { severity: 3, originalMaxHitPoints: 6,
      effectiveMaxHitPoints: 1, lostHitResults: 0 } } };
  const armor = { id: "mail", type: "armor", name: "Cota", system: {
    equipped: true, armorPoints: 4, coveredLocationIds: ["chest"] } };
  const actor = { uuid: "Actor.hodei", token: { uuid: "Scene.s.Token.hodei" },
    items: [location, armor] };
  const combatant = { id: "combatant", actor, token: actor.token };
  const combat = { round: 2, combatants: [combatant], getFlag: () => ({ passiveBlocks: {
    combatant: { status: "active", round: 2, locationIds: ["chest"] }
  } }) };
  const table = prepareHitLocationTable({ actor, armor: [armor], combat, armorPointLabel: "PA" });
  assert.equal(table.hasNaturalArmor, true);
  assert.deepEqual({ disabled: table.rows[0].disabled, crippled: table.rows[0].crippled,
    passiveBlocked: table.rows[0].passiveBlocked, totalArmor: table.rows[0].totalArmor },
  { disabled: false, crippled: true, passiveBlocked: true, totalArmor: 5 });
  assert.equal(table.rows[0].overMaximum, true);
  assert.equal(table.rows[0].armorOptions[0].label, "Cota (4 PA)");
});

test("el preparador presenta el nombre localizado de la localización", () => {
  globalThis.game = { i18n: { localize: (key) => key.endsWith(".chest") ? "Chest" : key } };
  const location = { id: "chest", type: "hitLocation", name: "Pecho", system: {
    nameKey: "chest", rangeStart: 10, rangeEnd: 12, armorPoints: 0,
    currentHitPoints: 6, maxHitPoints: 6, disabled: false,
    permanentWound: { severity: 0, originalMaxHitPoints: 0 } } };
  const table = prepareHitLocationTable({ actor: { items: [location] } });
  assert.equal(table.rows[0].displayName, "Chest");
  assert.equal(location.name, "Pecho");
});
