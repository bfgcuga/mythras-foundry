import test from "node:test";
import assert from "node:assert/strict";
import { engagementId, engagementRestriction, initialReachPosition, reachDifference,
  relationSituationReach, shiftedWeaponSize } from "../scripts/rules/engagements.js";
import { contiguousLocationIds, isNaturalWeaponMode, passiveBlockCapacity,
  validatePassiveBlock } from "../scripts/rules/passive-block.js";
import { passiveBlockEntries } from "../scripts/rules/round-consequences.js";

test("las relaciones usan una identidad estable y el alcance largo con dos grados", () => {
  assert.equal(engagementId("b", "a"), "a::b");
  assert.equal(reachDifference("C", "L"), 2);
  assert.equal(initialReachPosition("C", "L"), "longer");
  assert.equal(initialReachPosition("M", "L"), "neutral");
});

test("la situación muestra el alcance favorecido de las armas relacionadas", () => {
  const relation = { position: "longer", sides: { a: { reach: "C" }, b: { reach: "L" } } };
  assert.equal(relationSituationReach(relation), "L");
  relation.position = "shorter";
  assert.equal(relationSituationReach(relation), "C");
  relation.position = "neutral";
  assert.equal(relationSituationReach(relation), "—");
});

test("el alcance impide al arma corta y convierte el arma larga en pomo", () => {
  const relation = { status: "engaged", position: "longer", sides: {
    short: { reach: "C" }, long: { reach: "L" } } };
  assert.equal(engagementRestriction(relation, "short", "C").reason, "tooShort");
  relation.position = "shorter";
  const long = engagementRestriction(relation, "long", "L");
  assert.equal(long.pommel, true);
  assert.equal(shiftedWeaponSize("E", long.effectiveSizeSteps), "M");
});

test("el bloqueo pasivo exige capacidad exacta y localizaciones contiguas", () => {
  const mode = { weaponType: "shield", traitRefs: [{ key: "bloqueo-pasivo",
    parameters: [{ key: "locations", value: "2" }] }] };
  const locations = [1, 2, 3, 4].map((rangeStart) => ({ id: String(rangeStart), rangeStart }));
  assert.equal(passiveBlockCapacity(mode), 2);
  assert.equal(contiguousLocationIds(locations, ["2", "3"]), true);
  assert.equal(validatePassiveBlock({ mode, locations, selectedIds: ["1", "2"] }).valid, true);
  assert.equal(validatePassiveBlock({ mode, locations, selectedIds: ["1", "3"] }).valid, false);
  assert.equal(validatePassiveBlock({ mode, locations, selectedIds: ["1", "2", "3", "4"],
    crouched: true }).valid, true);
});

test("la comprobación de contigüidad puede desactivarse", () => {
  const mode = { weaponType: "shield", traitRefs: [{ key: "bloqueo-pasivo",
    parameters: [{ key: "locations", value: "2" }] }] };
  const locations = [1, 2, 3].map((rangeStart) => ({ id: String(rangeStart), rangeStart }));
  assert.equal(validatePassiveBlock({ mode, locations, selectedIds: ["1", "3"] }).valid, false);
  assert.equal(validatePassiveBlock({ mode, locations, selectedIds: ["1", "3"],
    checkContiguity: false }).valid, true);
});

test("un arma manufacturada puede bloquear una localización al luchar con dos armas", () => {
  const sword = { weaponType: "melee", handsRequired: 1, grip: "1 mano", traitRefs: [] };
  const claw = { weaponType: "melee", handsRequired: 0, grip: "Natural", traitRefs: [] };
  assert.equal(passiveBlockCapacity(sword), 0);
  assert.equal(passiveBlockCapacity(sword, { dualWield: true }), 1);
  assert.equal(isNaturalWeaponMode(claw), true);
  assert.equal(passiveBlockCapacity(claw, { dualWield: true }), 0);
});

test("las armas naturales no cuentan para habilitar el bloqueo pasivo con dos armas", () => {
  const weapon = (id, name, mode) => ({ id, name, type: "weapon",
    system: { equipped: true, modes: [{ key: id, name, size: "M", traitRefs: [], ...mode }] } });
  const sword = weapon("sword", "Espada", { weaponType: "melee", handsRequired: 1,
    grip: "1 mano" });
  const claw = weapon("claw", "Garra", { weaponType: "melee", handsRequired: 0,
    grip: "Natural" });
  const actor = { uuid: "Actor.fighter", name: "Combatiente", items: [sword, claw] };
  const combat = { combatants: [{ id: "fighter", actor, isDefeated: false }] };

  assert.deepEqual(passiveBlockEntries(combat), []);

  actor.items.push(weapon("dagger", "Daga", { weaponType: "melee", handsRequired: 1,
    grip: "1 mano" }));
  const [entry] = passiveBlockEntries(combat);
  assert.deepEqual(entry.choices.map((choice) => choice.weaponId).sort(), ["dagger", "sword"]);
  assert.equal(entry.choices.some((choice) => choice.weaponId === "claw"), false);
});

test("las localizaciones humanas forman una red anatómica y no el orden del d20", () => {
  const locations = [
    { id: "leg", rangeStart: 1, category: "leg" },
    { id: "abdomen", rangeStart: 7, category: "abdomen" },
    { id: "chest", rangeStart: 10, category: "chest" },
    { id: "arm", rangeStart: 13, category: "arm" },
    { id: "head", rangeStart: 20, category: "head" }
  ];
  assert.equal(contiguousLocationIds(locations, ["chest", "abdomen", "arm", "head"]), true);
  assert.equal(contiguousLocationIds(locations, ["leg", "head"]), false);
});
