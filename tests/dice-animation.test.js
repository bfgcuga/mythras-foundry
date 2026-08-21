import test from "node:test";
import assert from "node:assert/strict";

import { appendSerializedRolls, evaluateAnimatedRoll } from "../scripts/rules/dice-animation.js";

test("evaluateAnimatedRoll evaluates a Foundry Roll without requiring Dice So Nice", async () => {
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; }
    async evaluate() { this.total = 7; return this; }
  };
  globalThis.game = { dice3d: null, settings: { get: () => "publicroll" }, user: { id: "user" } };
  globalThis.ChatMessage = { applyRollMode: () => {}, getSpeaker: () => ({ alias: "User" }) };

  const roll = await evaluateAnimatedRoll("1d10");
  assert.equal(roll.formula, "1d10");
  assert.equal(roll.total, 7);
});

test("evaluateAnimatedRoll broadcasts Dice So Nice with the active roll visibility", async () => {
  const calls = [];
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; }
    async evaluate() { return this; }
  };
  globalThis.game = {
    dice3d: { showForRoll: async (...args) => calls.push(args) },
    settings: { get: () => "gmroll" },
    user: { id: "user" }
  };
  globalThis.ChatMessage = {
    applyRollMode: (data) => { data.whisper = ["gm"]; data.blind = false; },
    getSpeaker: () => ({ alias: "Default" })
  };
  const roll = await evaluateAnimatedRoll("1d100");

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [roll, game.user, true, ["gm"], false]);
});

test("interactive card updates append real Foundry rolls", () => {
  globalThis.Roll = { fromData: (data) => ({ ...data, restored: true }) };
  const existing = { total: 12 };
  assert.deepEqual(appendSerializedRolls({ rolls: [existing] }, { total: 34 }),
    [existing, { total: 34, restored: true }]);
});
