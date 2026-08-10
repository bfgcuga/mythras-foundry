import test from "node:test";
import assert from "node:assert/strict";

import { COMBAT_STYLE_TRAIT_SOURCES, CREATURE_TRAIT_SOURCES, TRAIT_SOURCES,
  WEAPON_TRAIT_SOURCES } from "../scripts/data/traits.js";
import { WEAPON_SOURCES } from "../scripts/data/weapons.js";
import { hasTrait, mergeTraitReferences, parseLegacyTraitText, registerTraitRule,
  resolveTraitRules, traitReference, traitReferences,
  unregisterTraitRule } from "../scripts/rules/traits.js";

test("el compendio comparte un unico tipo de Item para los 83 rasgos", () => {
  assert.equal(TRAIT_SOURCES.length, 83);
  assert.equal(COMBAT_STYLE_TRAIT_SOURCES.length, 26);
  assert.equal(WEAPON_TRAIT_SOURCES.length, 12);
  assert.equal(CREATURE_TRAIT_SOURCES.length, 45);
  assert.equal(new Set(TRAIT_SOURCES.map((trait) => trait.system.key)).size, 83);
  assert.ok(TRAIT_SOURCES.every((trait) => trait.type === "trait"
    && trait.system.description && trait.system.source));
});

test("los requisitos grupales son datos estructurados y no forman parte del nombre", () => {
  const grouped = COMBAT_STYLE_TRAIT_SOURCES.filter((trait) => (
    trait.system.requiresAllGroupMembers
  ));
  assert.deepEqual(grouped.map((trait) => trait.name), ["Combate en Formación", "Muro de Escudos"]);
  assert.ok(grouped.every((trait) => !trait.name.includes("*")));
});

test("el texto antiguo se convierte en referencias y conserva lo desconocido", () => {
  const parsed = parseLegacyTraitText(
    "Parar Proyectiles, Bloqueo Pasivo 4 Localizaciones, Rasgo casero",
    WEAPON_TRAIT_SOURCES
  );
  assert.deepEqual(parsed.references.map((reference) => reference.key),
    ["parar-proyectiles", "bloqueo-pasivo"]);
  assert.deepEqual(parsed.references[1].parameters, [{ key: "locations", value: "4" }]);
  assert.equal(parsed.legacyText, "Rasgo casero");
});

test("las armas oficiales usan referencias estructuradas incluso por modo", () => {
  const references = WEAPON_SOURCES.flatMap((weapon) => [
    ...(weapon.system.traitRefs ?? []),
    ...weapon.system.modes.flatMap((mode) => mode.traitRefs ?? [])
  ]);
  assert.ok(references.length > 0);
  assert.ok(references.every((reference) => WEAPON_TRAIT_SOURCES.some((trait) => (
    trait.system.key === reference.key
  ))));
});

test("la consulta y el registro de reglas dependen de claves estables", () => {
  const reference = traitReference(COMBAT_STYLE_TRAIT_SOURCES[0]);
  const style = { type: "combatStyle", system: { traitRefs: [reference] } };
  assert.equal(hasTrait(style, "Aporrear"), true);
  registerTraitRule("aporrear", ({ reference: assigned }) => ({ key: assigned.key, amount: 1 }));
  assert.deepEqual(resolveTraitRules(style), [{ key: "aporrear", amount: 1 }]);
  unregisterTraitRule("aporrear");
  assert.deepEqual(resolveTraitRules(style), []);
});

test("las referencias duplicadas no se incorporan dos veces", () => {
  const reference = traitReference(COMBAT_STYLE_TRAIT_SOURCES[0]);
  const merged = mergeTraitReferences([reference], [{ ...reference,
    uuid: "Compendium.mythras-foundry.traits.Item.example" }]);
  assert.equal(merged.added, 0);
  assert.equal(merged.duplicates, 1);
  assert.equal(merged.references.length, 1);
});

test("las criaturas consultan sus rasgos embebidos con la API compartida", () => {
  const actor = {
    type: "creature",
    items: [
      { type: "trait", name: "Regeneración", system: { key: "regeneracion" } },
      { type: "skill", name: "Percepción", system: {} }
    ]
  };
  assert.equal(hasTrait(actor, "Regeneración"), true);
  assert.deepEqual(traitReferences(actor).map((trait) => trait.key), ["regeneracion"]);
});
