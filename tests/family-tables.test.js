import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FAMILY_TABLES,
  FAMILY_TABLE_SOURCES,
  childAgeFormula,
  composeGeneratedNarrative,
  familyTableResult,
  resolveFamilyTable,
  resolveMarriage
} from "../scripts/data/family-tables.js";
import { createBackgroundDraft, parseBackgroundDraft,
  serializeBackgroundDraft } from "../scripts/rules/background-generation.js";

const queuedRoll = (...totals) => async () => totals.shift();

test("las cinco tablas cubren sin huecos todos los resultados de 1d100", () => {
  assert.equal(FAMILY_TABLES.length, 5);
  assert.equal(FAMILY_TABLE_SOURCES.length, 5);
  assert.match(FAMILY_TABLE_SOURCES.find(({ key }) => key === "extendedFamily")
    .results[1].text, /Abuelos: 1d2\+1/);
  assert.match(FAMILY_TABLE_SOURCES.find(({ key }) => key === "familyConnections")
    .results[4].text, /1d4 4 veces/);
  for (const table of FAMILY_TABLES) {
    for (let roll = 1; roll <= 100; roll += 1) {
      assert.ok(familyTableResult(table.key, roll), `${table.key}: ${roll}`);
    }
    assert.equal(familyTableResult(table.key, 100).range[1], 100);
  }
});

test("hermanos y familia extendida resuelven sus fórmulas secundarias", async () => {
  const siblings = await resolveFamilyTable("siblings", 71, queuedRoll(3));
  assert.equal(siblings.fields.siblings, "3 hermanos");
  assert.deepEqual(siblings.secondaryRolls, [{ formula: "1d8", total: 3 }]);
  const extended = await resolveFamilyTable("extendedFamily", 91, queuedRoll(4, 5, 7));
  assert.equal(extended.fields.extendedFamily,
    "Abuelos: 4; tíos y tías: 5; primos: 7");
});

test("reputación distribuye aleatoriamente cada relación compuesta", async () => {
  const reputation = await resolveFamilyTable("familyReputation", 1,
    queuedRoll(3, 1, 2, 1));
  assert.equal(reputation.fields.enemies, "2 enemigos");
  assert.equal(reputation.fields.rivals, "1 rival");
});

test("conexiones realiza de una a cuatro tiradas y reparte sus tipos", async () => {
  const connections = await resolveFamilyTable("familyConnections", 100,
    queuedRoll(1, 2, 3, 4));
  assert.equal(connections.fields.allies, "1 aliado");
  assert.equal(connections.fields.contacts, "1 contacto");
  assert.equal(connections.fields.enemies, "1 enemigo");
  assert.equal(connections.fields.rivals, "1 rival");
});

test("matrimonio respeta el diez por ciento y el valor de Influencia", () => {
  assert.equal(resolveMarriage({ percentile: 6, influence: 55 }).resultKey, "married");
  assert.equal(resolveMarriage({ percentile: 7, influence: 55 }).resultKey, "betrothed");
  assert.equal(resolveMarriage({ percentile: 56, influence: 55 }).resultKey, "single");
  const married = resolveMarriage({ percentile: 1, influence: 55,
    childCount: 2, childAges: [3, 4] });
  assert.equal(married.fields.children, "2 hijos; edades: 3, 4");
  assert.equal(childAgeFormula("adult"), "1d4");
  assert.equal(childAgeFormula("mature"), "2d6+15");
});

test("el texto generado preserva las notas previas una sola vez", () => {
  assert.equal(composeGeneratedNarrative(["1 aliado", "2 aliados"], "Viejo amigo",
    "Notas del jugador"), "1 aliado\n2 aliados\nNotas del jugador: Viejo amigo");
});

test("los borradores antiguos reciben almacenamiento de tiradas compatible", () => {
  const parsed = parseBackgroundDraft('{"stage":"free"}');
  assert.deepEqual(parsed.familyRolls, { entries: {}, originals: {} });
  const draft = createBackgroundDraft();
  draft.familyRolls.entries.parents = { fields: { parents: "Ambos padres vivos" } };
  assert.equal(parseBackgroundDraft(serializeBackgroundDraft(draft))
    .familyRolls.entries.parents.fields.parents, "Ambos padres vivos");
});

test("manifiesto, plantilla y asistente registran la nueva fase", () => {
  const manifest = JSON.parse(readFileSync(new URL("../system.json", import.meta.url), "utf8"));
  assert.equal(manifest.packs.find(({ name }) => name === "family-tables")?.type, "RollTable");
  const template = readFileSync(new URL(
    "../templates/actor/parts/background-wizard.hbs", import.meta.url), "utf8");
  const sheet = readFileSync(new URL("../scripts/sheets/character-sheet.js", import.meta.url), "utf8");
  assert.match(template, /data-background-family-roll/);
  assert.match(template, /aria-label=/);
  assert.match(sheet, /free: "family", family: "review"/);
});
