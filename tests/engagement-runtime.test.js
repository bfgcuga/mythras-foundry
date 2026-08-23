import test from "node:test";
import assert from "node:assert/strict";
import { deactivatePassiveBlock, removeRelation } from "../scripts/rules/engagement-runtime.js";

test("eliminar una relación la retira del estado táctico persistido", async () => {
  globalThis.foundry = { utils: { deepClone: structuredClone } };
  let stored = { schemaVersion: 1, revision: 4, relations: {
    "left::right": { id: "left::right" }, "left::third": { id: "left::third" }
  }, passiveBlocks: {}, covers: {} };
  const combat = { getFlag: () => stored, setFlag: async (scope, flag, value) => { stored = value; } };

  assert.equal(await removeRelation(combat, "left::right"), true);
  assert.deepEqual(Object.keys(stored.relations), ["left::third"]);
  assert.equal(stored.revision, 5);
  assert.equal(await removeRelation(combat, "missing"), false);
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
