import test from "node:test";
import assert from "node:assert/strict";
import { coverFor, deactivatePassiveBlock, removeCoverCorrection, removeRelation,
  setCoverCorrection } from "../scripts/rules/engagement-runtime.js";

test("eliminar una relación la retira del estado táctico persistido", async () => {
  globalThis.foundry = { utils: { deepClone: structuredClone } };
  let stored = { schemaVersion: 1, revision: 4, relations: {
    "left::right": {}, "left::third": { id: "left::third" }
  }, passiveBlocks: {}, covers: {} };
  const combat = { getFlag: () => stored, setFlag: async (scope, flag, value) => { stored = value; } };

  assert.equal(await removeRelation(combat, "left::right"), true);
  assert.deepEqual(Object.keys(stored.relations), ["left::third"]);
  assert.equal(stored.revision, 5);
  assert.equal(await removeRelation(combat, "missing"), false);
});

test("la corrección del DJ crea, modifica, desactiva y elimina coberturas", async () => {
  globalThis.foundry = { utils: { deepClone: structuredClone } };
  let stored = { schemaVersion: 1, revision: 1, relations: {}, passiveBlocks: {}, covers: {} };
  const locations = [{ id: "head", type: "hitLocation" }, { id: "chest", type: "hitLocation" },
    { id: "sword", type: "weapon" }];
  const actor = { uuid: "Actor.fighter", items: locations };
  const combat = { combatants: new Map([["fighter", { id: "fighter", actor }]]),
    getFlag: () => stored, setFlag: async (scope, flag, value) => { stored = value; } };

  const created = await setCoverCorrection(combat, "fighter", { source: " Muro ", protection: 6,
    complete: true, status: "active", locationIds: ["head", "invalid", "head"] }, "gm");
  assert.equal(created.source, "Muro"); assert.equal(created.protection, 6);
  assert.deepEqual(created.locationIds, ["head"]); assert.equal(created.actorUuid, "Actor.fighter");
  assert.equal(coverFor(combat, "fighter", "head")?.complete, true);

  await setCoverCorrection(combat, "fighter", { source: "Escudo", protection: -2,
    status: "cancelled", locationIds: ["chest"] }, "gm");
  assert.equal(stored.covers.fighter.protection, 0); assert.equal(stored.covers.fighter.revision, 2);
  assert.equal(coverFor(combat, "fighter", "chest"), null);
  assert.equal(await removeCoverCorrection(combat, "fighter"), true);
  assert.equal(stored.covers.fighter, undefined);
  assert.equal(await removeCoverCorrection(combat, "fighter"), false);
});

test("la corrección del DJ desactiva el bloqueo y retira el efecto de agacharse", async () => {
  globalThis.foundry = { utils: { deepClone: structuredClone } };
  let deleted = []; let stored = { schemaVersion: 1, revision: 2, relations: {}, covers: {},
    passiveBlocks: { fighter: { combatantId: "fighter", status: "active", revision: 3,
      crouchEffectId: "crouched" } } };
  const actor = { effects: new Map([["crouched", {}]]),
    deleteEmbeddedDocuments: async (type, ids) => { deleted = ids; } };
  const combat = { combatants: new Map([["fighter", { actor }]]), getFlag: () => stored,
    setFlag: async (scope, flag, value) => { stored = value; } };

  assert.equal(await deactivatePassiveBlock(combat, "fighter", "gm"), true);
  assert.equal(stored.passiveBlocks.fighter.status, "cancelled");
  assert.equal(stored.passiveBlocks.fighter.reason, "gmCorrection");
  assert.equal(stored.passiveBlocks.fighter.userId, "gm");
  assert.equal(stored.passiveBlocks.fighter.revision, 4);
  assert.equal(stored.revision, 3);
  assert.deepEqual(deleted, ["crouched"]);
  assert.equal(await deactivatePassiveBlock(combat, "fighter", "gm"), false);
});
