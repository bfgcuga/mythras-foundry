import test from "node:test";
import assert from "node:assert/strict";

import { BASIC_SKILL_SOURCES } from "../scripts/data/basic-skills.js";
import { ALL_SKILL_SOURCES } from "../scripts/data/skills.js";
import { MAGIC_SKILL_SOURCES } from "../scripts/data/magic-skills.js";
import { MYTHRAS_REVISED_SOURCE } from "../scripts/data/sources.js";

test("el catálogo contiene todas las habilidades básicas de Imperativo", () => {
  assert.equal(BASIC_SKILL_SOURCES.length, 23);
  assert.equal(
    new Set(BASIC_SKILL_SOURCES.map((skill) => skill.system.slug)).size,
    BASIC_SKILL_SOURCES.length
  );
  assert.ok(BASIC_SKILL_SOURCES.every((skill) => skill.system.category === "basic"));
  assert.ok(BASIC_SKILL_SOURCES.every((skill) => skill.system.description.length > 0));
});

test("el catálogo incluye las nueve habilidades mágicas del documento de referencia", () => {
  assert.equal(MAGIC_SKILL_SOURCES.length, 9);
  assert.ok(MAGIC_SKILL_SOURCES.every((skill) => skill.system.group === "magic"));
  assert.equal(
    new Set(MAGIC_SKILL_SOURCES.map((skill) => skill.system.slug)).size,
    MAGIC_SKILL_SOURCES.length
  );
});

test("el catálogo completo contiene básicas y profesionales sin duplicados", () => {
  assert.equal(ALL_SKILL_SOURCES.length, 58);
  assert.ok(!ALL_SKILL_SOURCES.some((skill) => (
    skill.system.slug === "estilo-de-combate"
  )));
  assert.equal(
    new Set(ALL_SKILL_SOURCES.map((skill) => skill.system.slug)).size,
    ALL_SKILL_SOURCES.length
  );
  assert.equal(
    ALL_SKILL_SOURCES.filter((skill) => skill.system.category === "professional").length,
    36
  );
});

test("el catálogo profesional coincide exactamente con el documento de referencia", () => {
  const expected = [
    "acrobacias", "actuar", "arte", "artesania", "atadura", "burocracia",
    "callejeo", "comerciar", "cortesia", "cultura", "curacion", "devocion",
    "disfraz", "ensenar", "exhortacion", "forzar-cerraduras", "idioma",
    "ingenieria", "invocacion", "juego",
    "juegos-de-manos", "leer-escribir", "magia-comun", "manipulacion",
    "mecanismos", "meditacion", "misticismo", "musica", "navegacion",
    "oratoria", "orientacion", "rastrear", "saber", "seduccion", "supervivencia",
    "trance"
  ];
  const actual = ALL_SKILL_SOURCES
    .filter((skill) => skill.system.category === "professional")
    .map((skill) => skill.system.slug)
    .sort();

  assert.deepEqual(actual, expected.sort());
});

test("todas las habilidades del compendio indican su fuente", () => {
  assert.ok(ALL_SKILL_SOURCES.every(
    (skill) => skill.system.source === MYTHRAS_REVISED_SOURCE
  ));
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
