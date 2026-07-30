import test from "node:test";
import assert from "node:assert/strict";

globalThis.Item = class {};

const { classifyRoll } = await import("../scripts/documents/mythras-item.js");

test("01-05 siempre tiene éxito y el umbral crítico prevalece", () => {
  assert.equal(classifyRoll(4, 3, 1), "success");
  assert.equal(classifyRoll(1, 3, 1), "critical");
});

test("96-00 siempre falla", () => {
  assert.equal(classifyRoll(96, 150, 15), "failure");
  assert.equal(classifyRoll(100, 150, 15), "fumble");
});

test("99 y 00 son pifia hasta 100%; por encima solo 00", () => {
  assert.equal(classifyRoll(99, 65, 7), "fumble");
  assert.equal(classifyRoll(99, 110, 11), "failure");
  assert.equal(classifyRoll(100, 110, 11), "fumble");
});
