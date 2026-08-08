import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createBackgroundDraft, validateSocialClassSelection }
  from "../scripts/rules/background-generation.js";
import { calculateStartingMoney, resolveSocialClass, SOCIAL_CLASSES_BY_CULTURE,
  SOCIAL_CLASS_TABLE_SOURCES, STARTING_MONEY_BY_CULTURE }
  from "../scripts/data/social-classes.js";

test("las cuatro tablas sociales cubren todo el intervalo de 1d100", () => {
  for (const [culture, entries] of Object.entries(SOCIAL_CLASSES_BY_CULTURE)) {
    const results = Array.from({ length: 100 }, (_, index) => (
      resolveSocialClass(culture, index + 1)?.key
    ));
    assert.equal(results.filter(Boolean).length, 100, culture);
    assert.equal(entries[0].range[0], 1, culture);
    assert.equal(entries.at(-1).range[1], 100, culture);
  }
});

test("los umbrales sociales extremos coinciden con las tablas", () => {
  assert.equal(resolveSocialClass("barbara", 5).key, "outcast");
  assert.equal(resolveSocialClass("barbara", 6).key, "slave");
  assert.equal(resolveSocialClass("civilizada", 99).key, "aristocrat");
  assert.equal(resolveSocialClass("civilizada", 100).key, "ruler");
  assert.equal(resolveSocialClass("nomada", 90).key, "freeman");
  assert.equal(resolveSocialClass("nomada", 91).key, "ruler");
  assert.equal(resolveSocialClass("primitiva", 80).key, "freeman");
  assert.equal(resolveSocialClass("primitiva", 81).key, "ruler");
});

test("el dinero inicial combina cultura, 4d6 y clase social", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(STARTING_MONEY_BY_CULTURE)
    .map(([key, value]) => [key, value.silverPerPoint])), {
    barbara: 50, civilizada: 75, nomada: 25, primitiva: 10
  });
  assert.equal(calculateStartingMoney("barbara", "freeman", 14), 700);
  assert.equal(calculateStartingMoney("civilizada", "ruler", 14), 10500);
  assert.equal(calculateStartingMoney("nomada", "outcast", 14), 87.5);
  assert.equal(calculateStartingMoney("primitiva", "ruler", 14), 280);
});

test("la selección social exige clase y tirada de dinero", () => {
  const draft = createBackgroundDraft();
  draft.cultureKey = "civilizada";
  assert.deepEqual(validateSocialClassSelection(draft), {
    valid: false, reason: "socialClass"
  });
  Object.assign(draft, {
    socialClassKey: "freeman", startingMoneyDice: 14, startingMoney: 1050
  });
  assert.deepEqual(validateSocialClassSelection(draft), { valid: true });
});

test("el compendio ofrece una tabla rollable por cultura", () => {
  assert.equal(SOCIAL_CLASS_TABLE_SOURCES.length, 4);
  assert.ok(SOCIAL_CLASS_TABLE_SOURCES.every((table) => (
    table.formula === "1d100" && table.results.length > 0
  )));
  const manifest = JSON.parse(readFileSync(new URL("../system.json", import.meta.url), "utf8"));
  assert.equal(manifest.packs.find(
    (pack) => pack.name === "social-class-tables")?.type, "RollTable");
});
