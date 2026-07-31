import test from "node:test";
import assert from "node:assert/strict";

import { BASIC_SKILL_SOURCES } from "../scripts/data/basic-skills.js";
import { ALL_SKILL_SOURCES } from "../scripts/data/skills.js";

test("el catálogo contiene todas las habilidades básicas de Imperativo", () => {
  assert.equal(BASIC_SKILL_SOURCES.length, 23);
  assert.equal(
    new Set(BASIC_SKILL_SOURCES.map((skill) => skill.system.slug)).size,
    BASIC_SKILL_SOURCES.length
  );
  assert.ok(BASIC_SKILL_SOURCES.every((skill) => skill.system.category === "basic"));
  assert.ok(BASIC_SKILL_SOURCES.every((skill) => skill.system.description.length > 0));
});

test("el catálogo completo contiene básicas y profesionales sin duplicados", () => {
  assert.equal(ALL_SKILL_SOURCES.length, 60);
  assert.ok(!ALL_SKILL_SOURCES.some((skill) => (
    skill.system.slug === "estilo-de-combate"
  )));
  assert.equal(
    new Set(ALL_SKILL_SOURCES.map((skill) => skill.system.slug)).size,
    ALL_SKILL_SOURCES.length
  );
  assert.equal(
    ALL_SKILL_SOURCES.filter((skill) => skill.system.category === "professional").length,
    38
  );
});

test("Costumbres y Lengua Materna conservan su +40 inicial", () => {
  const bySlug = Object.fromEntries(
    BASIC_SKILL_SOURCES.map((skill) => [skill.system.slug, skill])
  );

  assert.equal(bySlug["costumbres"].system.baseBonus, 40);
  assert.equal(bySlug["lengua-materna"].system.baseBonus, 40);
  assert.equal(bySlug["lengua-materna"].system.group, "language");
  assert.equal(bySlug.aguante.system.group, "resistance");
  assert.equal(bySlug.evadir.system.group, "resistance");
  assert.equal(bySlug.musculo.system.group, "resistance");
  assert.equal(bySlug.voluntad.system.group, "resistance");
});
