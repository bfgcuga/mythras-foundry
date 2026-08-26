import test from "node:test";
import assert from "node:assert/strict";

globalThis.Item = class {};

const { classifyRoll, renderRollLine, rollThresholdRanges } = await import("../scripts/documents/mythras-item.js");
const { combineRollDifficulties, invertD100, resolveSkillRollTargets,
  supportingSkillAdjustment } = await import("../scripts/rules/skill-roll.js");

test("01-05 siempre tiene éxito y el umbral crítico prevalece", () => {
  assert.equal(classifyRoll(4, 3, 1), "success");
  assert.equal(classifyRoll(1, 3, 1), "critical");
});

test("una habilidad limitada queda topada y una reforzada suma el 20% hacia arriba", () => {
  assert.equal(supportingSkillAdjustment(70, 45, "limited"), 45);
  assert.equal(supportingSkillAdjustment(70, 46, "reinforced"), 80);
});

test("la dificultad se aplica después del ajuste y el crítico usa el objetivo efectivo", () => {
  assert.deepEqual(resolveSkillRollTargets({ baseTarget: 70,
    reinforced: true, reinforcedTarget: 46, difficulty: "hard" }), {
    baseTarget: 70, adjustedTarget: 80, difficulty: "hard", target: 54, criticalTarget: 6
  });
});

test("los grados favorables y adversos se combinan alrededor de estándar", () => {
  assert.equal(combineRollDifficulties("easy", "standard"), "easy");
  assert.equal(combineRollDifficulties("veryEasy", "standard"), "veryEasy");
  assert.equal(combineRollDifficulties("easy", "hard"), "standard");
  assert.equal(resolveSkillRollTargets({ baseTarget: 60, difficulty: "easy" }).target, 90);
  assert.equal(resolveSkillRollTargets({ baseTarget: 60, difficulty: "veryEasy" }).target, 120);
});

test("limitada y reforzada pueden aplicarse juntas de forma independiente", () => {
  assert.equal(resolveSkillRollTargets({ baseTarget: 70, limited: true, limitedTarget: 45,
    reinforced: true, reinforcedTarget: 46 }).adjustedTarget, 55);
});

test("invertir conserva los dos dígitos y trata 00 como 100", () => {
  assert.equal(invertD100(59), 95);
  assert.equal(invertD100(93), 39);
  assert.equal(invertD100(50), 5);
  assert.equal(invertD100(100), 100);
});

test("96-00 siempre falla", () => {
  assert.equal(classifyRoll(96, 150, 15), "failure");
  assert.equal(classifyRoll(99, 1000, 100), "failure");
  assert.equal(classifyRoll(100, 150, 15), "fumble");
});

test("99 y 00 son pifia hasta 100%; por encima solo 00", () => {
  assert.equal(classifyRoll(99, 65, 7), "fumble");
  assert.equal(classifyRoll(99, 110, 11), "failure");
  assert.equal(classifyRoll(100, 110, 11), "fumble");
});

test("la leyenda muestra los rangos de crítico y pifia aplicados", () => {
  assert.deepEqual(rollThresholdRanges(65, 7), {
    critical: "01–07",
    fumble: "99–00"
  });
  assert.deepEqual(rollThresholdRanges(110, 11), {
    critical: "01–11",
    fumble: "00"
  });
});

test("la línea de tirada conserva la suerte para usos repetidos", () => {
  globalThis.game = { i18n: { localize: (key) => key } };
  const html = renderRollLine(39, { previous: [93, 59] });
  assert.equal((html.match(/mythras-chat-simple-roll-attempt/g) ?? []).length, 2);
  assert.match(html, /data-action="spend-luck"/);
  assert.match(html, /93/);
  assert.match(html, /59/);
  assert.match(html, /39/);
});
