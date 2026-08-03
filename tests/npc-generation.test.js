import test from "node:test";
import assert from "node:assert/strict";

import { materializeNpc, NpcGenerationError, shouldGenerateNpcToken } from "../scripts/rules/npc-generation.js";

function source() {
  return {
    name: "Prueba", type: "npc", system: {
      strength: 10, constitution: 10, size: 10, dexterity: 10, intelligence: 10,
      power: 10, charisma: 10,
      characteristicFormulas: { strength: "2d6+9", constitution: "", size: "",
        dexterity: "", intelligence: "", power: "", charisma: "" },
      attributeOverrides: {
        actionPoints: { mode: "manual", value: 2, formula: "1d2+1" },
        initiative: { mode: "auto", value: 0, formula: "" },
        movementRate: { mode: "manual", value: 6, formula: "1d3+7" },
        magicPoints: { mode: "auto", value: 0, formula: "" },
        luckPoints: { mode: "manual", value: 0, formula: "" },
        damageModifier: { mode: "auto", formula: "" }
      },
      resources: { actionPoints: { value: 0 }, magicPoints: { value: 0 }, luckPoints: { value: 0 } }
    },
    items: [
      { _id: "skill", name: "Sigilo", type: "skill", system: {
        valueMode: "manual", manualValue: 50, generationFormula: "1d10+50" } },
      { _id: "tail", name: "Cola", type: "hitLocation", system: {
        maxHitPoints: 5, maxHitPointsFormula: "1d3+4", currentHitPoints: -2,
        armorPoints: 3, armorPointsFormula: "1d2+2" } },
      { _id: "claw", name: "Garra", type: "weapon", system: {
        quantity: 1, quantityFormula: "", maxHitPoints: 2, maxHitPointsFormula: "1d2+2",
        currentHitPoints: 0, armorPoints: 1, armorPointsFormula: "1d2" } }
    ]
  };
}

test("materializa en orden, recalcula recursos y restaura PG actuales", async () => {
  const calls = [];
  const values = new Map([["2d6+9", 16], ["1d2+1", 3], ["1d3+7", 8],
    ["1d10+50", 57], ["1d3+4", 6], ["1d2+2", 4], ["1d2", 2]]);
  const generated = await materializeNpc(source(), async (formula) => {
    calls.push(formula);
    return values.get(formula);
  });
  assert.deepEqual(calls, ["2d6+9", "1d2+1", "1d3+7", "1d10+50", "1d3+4", "1d2+2", "1d2+2", "1d2"]);
  assert.equal(generated.system.strength, 16);
  assert.equal(generated.system.resources.actionPoints.value, 3);
  assert.equal(generated.system.resources.magicPoints.value, 10);
  assert.equal(generated.items[0].system.manualValue, 57);
  assert.equal(generated.items[1].system.currentHitPoints, 6);
  assert.equal(generated.items[2].system.currentHitPoints, 4);
});

test("un fallo no modifica la fuente ni devuelve un resultado parcial", async () => {
  const original = source();
  const snapshot = structuredClone(original);
  await assert.rejects(() => materializeNpc(original, async (formula) => {
    if (formula === "1d10+50") throw new Error("fórmula rota");
    return 5;
  }), (error) => error instanceof NpcGenerationError
    && error.failures.some((failure) => failure.label === "Sigilo.manualValue"));
  assert.deepEqual(original, snapshot);
});

test("rechaza referencias de datos y resultados fuera de rango", async () => {
  const data = source();
  data.system.characteristicFormulas.strength = "@power+1";
  data.system.attributeOverrides.actionPoints.formula = "1d2-5";
  await assert.rejects(() => materializeNpc(data, async () => -3),
    (error) => error.failures.length >= 2);
});

test("solo se generan tokens NPC no enlazados", () => {
  assert.equal(shouldGenerateNpcToken({ actorType: "npc", actorLink: false }), true);
  assert.equal(shouldGenerateNpcToken({ actorType: "npc", actorLink: true }), false);
  assert.equal(shouldGenerateNpcToken({ actorType: "character", actorLink: false }), false);
});

