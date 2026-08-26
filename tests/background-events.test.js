import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BACKGROUND_EVENT_TABLE,
  BACKGROUND_EVENT_TABLE_SOURCES,
  backgroundEventResult,
  composeBackgroundEventHistory
} from "../scripts/data/background-events.js";
import { createBackgroundDraft, parseBackgroundDraft,
  serializeBackgroundDraft } from "../scripts/rules/background-generation.js";

test("la tabla de acontecimientos cubre sin huecos todos los resultados de 1d100", () => {
  assert.equal(BACKGROUND_EVENT_TABLE.formula, "1d100");
  assert.equal(BACKGROUND_EVENT_TABLE.results.length, 55);
  assert.equal(BACKGROUND_EVENT_TABLE_SOURCES.length, 1);
  for (let roll = 1; roll <= 100; roll += 1) assert.ok(backgroundEventResult(roll), String(roll));
  assert.equal(backgroundEventResult(1).key, "confused-identities");
  assert.equal(backgroundEventResult(100).key, "supernatural-epiphany");
});

test("los acontecimientos preceden las notas previas del jugador", () => {
  const entries = [{ text: "Primer acontecimiento." }, { text: "Segundo acontecimiento." }];
  assert.equal(composeBackgroundEventHistory(entries, "Historia anterior",
    "Posible trasfondo", "Notas del jugador"),
  "Posible trasfondo: Primer acontecimiento.\nPosible trasfondo: Segundo acontecimiento.\nNotas del jugador: Historia anterior");
  assert.equal(composeBackgroundEventHistory(entries.slice(0, 1), "",
    "Posible trasfondo", "Notas del jugador"),
  "Posible trasfondo: Primer acontecimiento.");
});

test("el borrador conserva las tiradas para no repetirlas al volver a la edad", () => {
  const draft = createBackgroundDraft();
  draft.backgroundEventRolls = {
    ageCategory: "adult",
    entries: [{ percentile: 33, resultKey: "beloved-pet", text: "Mascota" }],
    originalHistory: "Notas"
  };
  const parsed = parseBackgroundDraft(serializeBackgroundDraft(draft));
  assert.deepEqual(parsed.backgroundEventRolls, draft.backgroundEventRolls);
  assert.deepEqual(parseBackgroundDraft("{}").backgroundEventRolls,
    { ageCategory: "", entries: [], originalHistory: "" });
});

test("el manifiesto y el asistente registran los acontecimientos de trasfondo", () => {
  const manifest = JSON.parse(readFileSync(new URL("../system.json", import.meta.url), "utf8"));
  assert.equal(manifest.packs.find(({ name }) => name === "background-event-tables")?.type,
    "RollTable");
  const sheet = readFileSync(new URL("../scripts/sheets/character-sheet.js", import.meta.url),
    "utf8");
  assert.match(sheet, /previousStage === "age"/);
  assert.match(sheet, /composeBackgroundEventHistory/);
});
