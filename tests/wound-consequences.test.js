import test from "node:test";
import assert from "node:assert/strict";
import { executeWoundConsequencePlan, rollSimpleWoundEndurance, woundConsequencePlan
} from "../scripts/rules/wound-consequences.js";

const actionTypes = (plan) => plan.actions.map((action) => action.type);

test("una herida grave siempre aturde y el fallo decide la consecuencia anatómica", () => {
  assert.deepEqual(actionTypes(woundConsequencePlan({ wound: "serious",
    locationKind: { extremity: true, leg: true }, enduranceSucceeded: false })),
  ["stunned", "disableLocation", "prone"]);
  assert.deepEqual(actionTypes(woundConsequencePlan({ wound: "serious",
    locationKind: { extremity: false }, enduranceSucceeded: false, penetratingDamage: 4 })),
  ["stunned", "unconscious"]);
  assert.deepEqual(actionTypes(woundConsequencePlan({ wound: "serious",
    locationKind: { extremity: true }, enduranceSucceeded: true })), ["stunned"]);
});

test("una herida crítica comparte las consecuencias de extremidad y zona vital", () => {
  const extremity = woundConsequencePlan({ wound: "major",
    locationKind: { extremity: true }, enduranceSucceeded: false, healingRate: 2 });
  assert.deepEqual(actionTypes(extremity),
    ["prone", "dying", "unconscious"]);
  assert.equal(extremity.actions.find((action) => action.type === "dying").rounds, 120);

  const resistedBody = woundConsequencePlan({ wound: "major",
    locationKind: { extremity: false }, enduranceSucceeded: true, healingRate: 2 });
  assert.deepEqual(actionTypes(resistedBody), ["unconscious", "dying"]);
  assert.equal(resistedBody.actions[1].rounds, 4);
  assert.deepEqual(actionTypes(woundConsequencePlan({ wound: "major",
    locationKind: { extremity: false }, enduranceSucceeded: false })),
  ["unconscious", "death"]);
});

test("la resolución manual conserva solo las consecuencias independientes de Aguante", () => {
  assert.deepEqual(actionTypes(woundConsequencePlan({ wound: "serious",
    locationKind: { extremity: true }, enduranceSucceeded: null })), ["stunned"]);
  assert.deepEqual(actionTypes(woundConsequencePlan({ wound: "major",
    locationKind: { extremity: false }, enduranceSucceeded: null })), ["unconscious"]);
});

test("el ejecutor común aplica las acciones en orden", async () => {
  const applied = [];
  const plan = woundConsequencePlan({ wound: "serious",
    locationKind: { extremity: true, leg: true }, enduranceSucceeded: false });
  await executeWoundConsequencePlan(plan, Object.fromEntries(
    plan.actions.map(({ type }) => [type, () => applied.push(type)])));
  assert.deepEqual(applied, ["stunned", "disableLocation", "prone"]);
});

test("los peligros resuelven Aguante como tirada simple sin oponente", async () => {
  const previousRoll = globalThis.Roll;
  const previousGame = globalThis.game;
  const previousChatMessage = globalThis.ChatMessage;
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; this.total = 42; }
    async evaluate() { return this; }
  };
  globalThis.game = { dice3d: null };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  try {
    const actor = { items: [{ id: "endurance", type: "skill",
      system: { slug: "aguante", total: 55 } }] };
    const resolution = await rollSimpleWoundEndurance(actor);
    assert.equal(resolution.roll.formula, "1d100");
    assert.equal(resolution.target, 55);
    assert.equal(resolution.result, "success");
    assert.equal(resolution.succeeded, true);
    assert.equal(Object.hasOwn(resolution, "opposed"), false);
  } finally {
    globalThis.Roll = previousRoll;
    globalThis.game = previousGame;
    globalThis.ChatMessage = previousChatMessage;
  }
});
