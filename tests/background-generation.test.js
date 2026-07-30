import assert from "node:assert/strict";
import test from "node:test";

import { CULTURES, PROFESSIONS } from "../scripts/data/backgrounds.js";
import { ALL_SKILL_SOURCES } from "../scripts/data/skills.js";
import {
  allocationRemaining,
  createBackgroundDraft,
  getAllAcquiredAbilities,
  setAllocation,
  skillAbilityKey,
  validateBackgroundSelection,
  validateFreePhase
} from "../scripts/rules/background-generation.js";

test("el catálogo contiene las cuatro culturas y las treinta profesiones", () => {
  assert.equal(CULTURES.length, 4);
  assert.equal(PROFESSIONS.length, 30);
  assert.deepEqual(
    CULTURES.map((entry) => entry.name),
    ["Bárbara", "Civilizada", "Nómada", "Primitiva"]
  );
  assert.equal(new Set(PROFESSIONS.map((entry) => entry.key)).size, 30);
});

test("todas las referencias de culturas y profesiones existen en el compendio", () => {
  const slugs = new Set(ALL_SKILL_SOURCES.map((source) => source.system.slug));
  for (const entry of [...CULTURES, ...PROFESSIONS]) {
    assert.ok(entry.professional.length >= 3, entry.name);
    for (const slug of entry.basic) assert.ok(slugs.has(slug), `${entry.name}: ${slug}`);
    for (const choice of entry.choices) {
      assert.ok(choice.count > 0 && choice.count <= choice.options.length, entry.name);
      for (const option of choice.options) assert.ok(slugs.has(option.slug), option.label);
    }
    for (const option of entry.professional) {
      assert.ok(slugs.has(option.slug), `${entry.name}: ${option.label}`);
    }
  }
});

test("las elecciones culturales exigen tres profesionales, estilo y 100 puntos", () => {
  const culture = CULTURES.find((entry) => entry.key === "civilizada");
  const draft = createBackgroundDraft();
  draft.cultureKey = culture.key;
  draft.cultureProfessionals = culture.professional
    .filter((entry) => !entry.specializationRequired)
    .slice(0, 3)
    .map((entry) => entry.id);
  draft.styles["culture:0"] = { name: "Legión urbana" };
  const [ability] = getAllAcquiredAbilities(culture, null, draft, { includeFree: false });
  draft.allocations.culture[ability.key] = 100;

  assert.deepEqual(
    validateBackgroundSelection(culture, draft, "culture"),
    { valid: true }
  );
});

test("las especializaciones distintas crean habilidades independientes", () => {
  const draft = createBackgroundDraft();
  draft.freeProfessional = { slug: "saber", specialization: "Historia" };
  const culture = {
    basic: [],
    choices: [],
    professionalChoiceCount: 3,
    professional: [
      { id: "s1", slug: "saber", specializationRequired: true },
      { id: "s2", slug: "saber", specializationRequired: true },
      { id: "a", slug: "actuar", specializationRequired: false }
    ],
    styles: []
  };
  draft.cultureProfessionals = ["s1", "s2", "a"];
  draft.specializations["culture:s1"] = "Historia";
  draft.specializations["culture:s2"] = "Religión";

  const keys = getAllAcquiredAbilities(culture, null, draft).map((entry) => entry.key);
  assert.ok(keys.includes(skillAbilityKey("saber", "Historia")));
  assert.ok(keys.includes(skillAbilityKey("saber", "Religión")));
  assert.equal(keys.filter((key) => key.startsWith("skill:saber:")).length, 2);
});

test("la asignación nunca sobrepasa el presupuesto de la fase", () => {
  let allocation = setAllocation({}, "skill:atletismo:", 80, 100);
  allocation = setAllocation(allocation, "skill:aguante:", 50, 100);
  assert.equal(allocation["skill:aguante:"], 20);
  assert.equal(allocationRemaining("culture", allocation), 0);
});

test("la fase libre exige habilidad adicional, especialización y 150 puntos", () => {
  const draft = createBackgroundDraft();
  draft.freeProfessional = { slug: "saber", specialization: "Historia" };
  draft.allocations.free[skillAbilityKey("saber", "Historia")] = 150;
  assert.deepEqual(
    validateFreePhase(null, null, draft, []),
    { valid: true }
  );
});

test("la habilidad libre no puede repetir una profesional ya adquirida", () => {
  const draft = createBackgroundDraft();
  const culture = {
    basic: [],
    choices: [],
    professionalChoiceCount: 3,
    professional: [
      { id: "a", slug: "actuar", specializationRequired: false },
      { id: "b", slug: "callejeo", specializationRequired: false },
      { id: "c", slug: "comerciar", specializationRequired: false }
    ],
    styles: []
  };
  draft.cultureProfessionals = ["a", "b", "c"];
  draft.freeProfessional = { slug: "actuar", specialization: "" };
  draft.allocations.free[skillAbilityKey("actuar")] = 150;
  assert.deepEqual(
    validateFreePhase(culture, null, draft, []),
    { valid: false, reason: "freeSkillDuplicate" }
  );
});
