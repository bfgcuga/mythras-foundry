import test from "node:test";
import assert from "node:assert/strict";
import { coverFor, deactivatePassiveBlock, removeCoverCorrection, removeRelation,
  reactivatePassiveBlock, setCoverCorrection } from "../scripts/rules/engagement-runtime.js";

test("eliminar una relación la suprime durante el encuentro para que no se recree", async () => {
  globalThis.foundry = { utils: { deepClone: structuredClone } };
  globalThis.game = { user: { id: "gm" } };
  let stored = { schemaVersion: 1, revision: 4, relations: {
    "left::right": {}, "left::third": { id: "left::third" }
  }, passiveBlocks: {}, covers: {} };
  const combat = { getFlag: () => stored, setFlag: async (scope, flag, value) => { stored = value; } };

  assert.equal(await removeRelation(combat, "left::right"), true);
  assert.equal(stored.relations["left::right"].status, "removed");
  assert.equal(stored.relations["left::right"].reason, "gmRemoval");
  assert.equal(stored.revision, 5);
  assert.equal(await removeRelation(combat, "left::right"), false);
  assert.equal(await removeRelation(combat, "missing"), false);
});

test("la corrección del DJ crea, modifica, desactiva y elimina coberturas", async () => {
  globalThis.foundry = { utils: { deepClone: structuredClone } };
  globalThis.game = { user: { id: "gm" } };
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
  await setCoverCorrection(combat, "fighter", { source: "Escudo", protection: 4,
    status: "active", complete: true, locationIds: ["chest"] }, "gm");
  assert.equal(await removeCoverCorrection(combat, "fighter"), true);
  assert.equal(stored.covers.fighter.status, "cancelled");
  assert.equal(stored.covers.fighter.source, "");
  assert.equal(stored.covers.fighter.protection, 0);
  assert.equal(stored.covers.fighter.complete, false);
  assert.deepEqual(stored.covers.fighter.locationIds, []);
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

test("la corrección del DJ reactiva un bloqueo válido en el asalto actual", async () => {
  globalThis.foundry = { utils: { deepClone: structuredClone } };
  globalThis.game = { i18n: { localize: (key) => key } };
  let stored = { schemaVersion: 1, revision: 2, relations: {}, covers: {},
    passiveBlocks: { fighter: { combatantId: "fighter", status: "cancelled", revision: 1,
      weaponId: "shield", locationIds: ["head"], crouched: false } } };
  const items = new Map([["shield", { id: "shield", type: "weapon", system: { equipped: true } }],
    ["head", { id: "head", type: "hitLocation" }]]);
  const actor = { items }; const combat = { round: 4, uuid: "Combat.test",
    combatants: new Map([["fighter", { actor }]]), getFlag: () => stored,
    setFlag: async (scope, flag, value) => { stored = value; } };

  assert.equal(await reactivatePassiveBlock(combat, "fighter", "gm"), true);
  assert.equal(stored.passiveBlocks.fighter.status, "active");
  assert.equal(stored.passiveBlocks.fighter.round, 4);
  assert.equal(stored.passiveBlocks.fighter.revision, 2);
  assert.equal(await reactivatePassiveBlock(combat, "fighter", "gm"), false);
});
