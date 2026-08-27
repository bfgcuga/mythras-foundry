import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { normalizeStatusDuration,
  statusAssignmentCatalog } from "../scripts/rules/status-assignment.js";
import { MYTHRAS_STATUS_EFFECTS } from "../scripts/rules/statuses.js";

test("el gestor incluye Incapacitado y todo el catálogo canónico de estados", () => {
  const catalog = statusAssignmentCatalog();
  assert.equal(catalog[0].id, "incapacitated");
  assert.deepEqual(catalog.slice(1).map(({ id }) => id),
    MYTHRAS_STATUS_EFFECTS.map(({ id }) => id));
});

test("normaliza duraciones manuales, por turnos propios y por asaltos", () => {
  assert.deepEqual(normalizeStatusDuration({ unit: "manual", value: 8 }),
    { unit: "manual", value: null, phase: "manual" });
  assert.deepEqual(normalizeStatusDuration({ unit: "actorTurn", value: 2.4 }),
    { unit: "actorTurn", value: 2, phase: "endActorTurn" });
  assert.deepEqual(normalizeStatusDuration({ unit: "round", value: 0 }),
    { unit: "round", value: 1, phase: "endRound" });
});

test("cada estado asignable dispone de explicación en ambos idiomas", () => {
  for (const language of ["es", "en"]) {
    const translations = JSON.parse(readFileSync(new URL(`../lang/${language}.json`,
      import.meta.url), "utf8"));
    for (const status of statusAssignmentCatalog()) {
      assert.equal(typeof translations[status.description], "string",
        `${language}: ${status.description}`);
      assert.ok(translations[status.description].length > 0);
    }
  }
});
