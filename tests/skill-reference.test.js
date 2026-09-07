import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { ALL_SKILL_SOURCES } from "../scripts/data/skills.js";
import { fullSkillSources } from "../scripts/data/skill-reference.js";
import { referenceJournalSources } from "../scripts/data/reference-journals.js";

const document = JSON.parse(readFileSync(
  new URL("../data/mythras_habilidades.json", import.meta.url), "utf8"
));

test("el catálogo completo sustituye las 58 descripciones sin alterar los slugs", () => {
  const skills = fullSkillSources(ALL_SKILL_SOURCES, document);
  assert.equal(skills.length, 58);
  assert.deepEqual(skills.map((skill) => skill.system.slug),
    ALL_SKILL_SOURCES.map((skill) => skill.system.slug));
  assert.equal(skills.find((skill) => skill.system.slug === "juegos-de-manos").name,
    "Juego de Manos");
  assert.ok(skills.every((skill, index) =>
    skill.system.description.length > ALL_SKILL_SOURCES[index].system.description.length));
});

test("solo las tablas específicas se incorporan a sus habilidades", () => {
  const skills = fullSkillSources(ALL_SKILL_SOURCES, document);
  const firstAid = skills.find((skill) => skill.system.slug === "primeros-auxilios");
  const language = skills.find((skill) => skill.system.slug === "idioma");
  assert.equal(firstAid.system.referenceTables[0].name, "Acciones de Primeros Auxilios");
  assert.equal(language.system.referenceTables[0].name, "Fluidez lingüística");
  assert.equal(skills.reduce((total, skill) => total + skill.system.referenceTables.length, 0), 2);
});

test("compendio y Journal reciben exactamente la misma descripción completa", () => {
  const skills = fullSkillSources(ALL_SKILL_SOURCES, document);
  const [journal] = referenceJournalSources([], skills);
  const context = { pageUuid: (key) => `UUID.${key}` };
  for (const skill of skills) {
    const page = journal.pages.find((candidate) =>
      candidate.buildKey === `skill-${skill.system.slug}`);
    const escapedDescription = skill.system.description
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#39;").replaceAll(" • ", "<br>• ");
    assert.ok(page.content(context).includes(escapedDescription), skill.name);
  }
});

test("el saneado retira únicamente defectos de extracción conocidos", () => {
  const skills = fullSkillSources(ALL_SKILL_SOURCES, document);
  const text = skills.map((skill) => skill.system.description).join("\n");
  assert.doesNotMatch(text, /refugio;el|másavanzados|ocuando lascondiciones/);
  assert.doesNotMatch(skills.find((skill) => skill.system.slug === "voluntad").system.description,
    /Las Habilidades Profesionales varían/);
});

test("la hoja de habilidad representa las tablas con encabezados semánticos", () => {
  const template = readFileSync(new URL("../templates/item/item-sheet.hbs", import.meta.url), "utf8");
  const model = readFileSync(new URL("../scripts/data/item-data.js", import.meta.url), "utf8");
  assert.match(template, /skill-reference-table-panel/);
  assert.match(template, /<th scope="col">/);
  assert.match(template, /<th scope="row">/);
  assert.match(model, /referenceTables: new ArrayField/);
});
