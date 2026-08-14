import test from "node:test";
import assert from "node:assert/strict";
import { ENCUMBRANCE_STATES } from "../scripts/rules/encumbrance.js";
import { penaltySummary } from "../scripts/rules/penalty-summary.js";

const baseAttributes = { movementRate: 6, initiative: 12, actionPointsMax: 3 };

test("resume por separado las fuentes y los totales contextuales", () => {
  const summary = penaltySummary({
    baseAttributes,
    fatigueKey: "tired",
    woundLevel: "serious",
    loadState: ENCUMBRANCE_STATES.loaded,
    armorPenalty: 2
  });
  assert.equal(summary.rows.fatigue.difficulty, "hard");
  assert.equal(summary.rows.wounds.situationalSteps, 1);
  assert.equal(summary.rows.encumbrance.difficultySteps, 1);
  assert.deepEqual(summary.totals.difficulties, {
    general: "hard", physical: "formidable", situational: "formidable",
    combined: "herculean", hasPhysicalVariant: true, hasSituationalVariant: true
  });
  assert.deepEqual(summary.totals.movement, { base: 6, effective: 3 });
  assert.deepEqual(summary.totals.initiative, { base: 12, effective: 10 });
  assert.deepEqual(summary.totals.actionPoints, { base: 3, effective: 3 });
});

test("una herida critica establece incapacitado como suelo", () => {
  const summary = penaltySummary({ baseAttributes, fatigueKey: "tired",
    woundLevel: "major", loadState: ENCUMBRANCE_STATES.unencumbered });
  assert.equal(summary.rows.wounds.incapacitated, true);
  assert.equal(summary.totals.difficulties.general, "herculean");
  assert.equal(summary.totals.movement.effective, 0);
  assert.equal(summary.totals.initiative.effective, 4);
  assert.equal(summary.totals.actionPoints.effective, 0);
});

test("una fatiga peor que incapacitado prevalece sobre la herida critica", () => {
  const summary = penaltySummary({ baseAttributes, fatigueKey: "comatose",
    woundLevel: "major", loadState: ENCUMBRANCE_STATES.unencumbered });
  assert.equal(summary.totals.difficulties.general, "impossible");
  assert.equal(summary.totals.initiative.effective, 0);
});

test("la causa manual de incapacitado aplica las mismas consecuencias", () => {
  const summary = penaltySummary({ baseAttributes, manuallyIncapacitated: true,
    loadState: ENCUMBRANCE_STATES.unencumbered });
  assert.equal(summary.rows.status.manuallyIncapacitated, true);
  assert.equal(summary.totals.difficulties.general, "herculean");
  assert.equal(summary.totals.movement.effective, 0);
  assert.equal(summary.totals.initiative.effective, 4);
  assert.equal(summary.totals.actionPoints.effective, 0);
});

test("los estados de habilidad se combinan antes de los incrementos por grados", () => {
  const summary = penaltySummary({ baseAttributes,
    skillStatuses: [{ id: "prone", name: "Prone", skillDifficulty: "formidable" }],
    loadState: ENCUMBRANCE_STATES.loaded });
  assert.equal(summary.totals.difficulties.general, "formidable");
  assert.equal(summary.totals.difficulties.physical, "herculean");
  assert.equal(summary.rows.status.skillStatuses[0].id, "prone");
});

test("inconsciente reduce a cero los atributos totales", () => {
  const summary = penaltySummary({ baseAttributes, unconscious: true,
    skillStatuses: [{ id: "unconscious", name: "Unconscious",
      skillDifficulty: "impossible" }], loadState: ENCUMBRANCE_STATES.unencumbered });
  assert.equal(summary.totals.difficulties.general, "impossible");
  assert.equal(summary.totals.movement.effective, 0);
  assert.equal(summary.totals.initiative.effective, 0);
  assert.equal(summary.totals.actionPoints.effective, 0);
});
