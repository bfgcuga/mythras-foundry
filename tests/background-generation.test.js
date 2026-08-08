import assert from "node:assert/strict";
import test from "node:test";

import { CULTURES, CULTURE_PROFESSION_KEYS, CULTURE_SOURCES, PROFESSIONS,
  PROFESSION_SOURCES, professionAvailableToCulture,
  professionsForCulture } from "../scripts/data/backgrounds.js";
import { ALL_SKILL_SOURCES } from "../scripts/data/skills.js";
import { MYTHRAS_REVISED_SOURCE } from "../scripts/data/sources.js";
import {
  allocationRemaining,
  AGE_CATEGORIES,
  createBackgroundDraft,
  getAllAcquiredAbilities,
  getAgeCategory,
  getPhaseAbilities,
  setAllocation,
  skillAbilityKey,
  validateAgeSelection,
  validateBackgroundSelection,
  validateFreePhase
} from "../scripts/rules/background-generation.js";

test("el catálogo coincide con las veinticuatro profesiones del documento", () => {
  assert.equal(CULTURES.length, 4);
  assert.equal(PROFESSIONS.length, 24);
  assert.deepEqual(
    CULTURES.map((entry) => entry.name),
    ["Bárbara", "Civilizada", "Nómada", "Primitiva"]
  );
  assert.deepEqual(PROFESSIONS.map((entry) => entry.name), [
    "Acompañante", "Adiestrador", "Agente", "Alquimista", "Artesano", "Artista",
    "Cazador", "Chamán", "Cortesano", "Erudito", "Explorador", "Funcionario",
    "Granjero", "Guerrero", "Hechicero", "Ladrón", "Marinero", "Médico",
    "Mercader", "Minero", "Místico", "Pastor", "Pescador", "Sacerdote"
  ]);
  assert.equal(new Set(PROFESSIONS.map((entry) => entry.key)).size, 24);
});

test("las cuatro culturas indican la fuente Mythras básico revisado", () => {
  assert.ok(CULTURE_SOURCES.every(
    (culture) => culture.system.source === MYTHRAS_REVISED_SOURCE
  ));
});

test("las veinticuatro profesiones indican la fuente Mythras básico revisado", () => {
  assert.ok(PROFESSION_SOURCES.every(
    (profession) => profession.system.source === MYTHRAS_REVISED_SOURCE
  ));
});

test("cada cultura solo accede a las profesiones indicadas", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(CULTURE_PROFESSION_KEYS)
    .map(([key, values]) => [key, values.length])), {
    civilizada: 24, barbara: 19, nomada: 15, primitiva: 11
  });
  assert.equal(professionAvailableToCulture("hechicero", "civilizada"), true);
  assert.equal(professionAvailableToCulture("hechicero", "barbara"), false);
  assert.equal(professionAvailableToCulture("sacerdote", "nomada"), true);
  assert.equal(professionAvailableToCulture("sacerdote", "primitiva"), false);
  assert.deepEqual(professionsForCulture("primitiva").map((entry) => entry.key),
    CULTURE_PROFESSION_KEYS.primitiva);
});

test("las profesiones nuevas conservan sus habilidades y magia de referencia", () => {
  const byKey = Object.fromEntries(PROFESSIONS.map((entry) => [entry.key, entry]));
  assert.deepEqual(byKey.alquimista.professional.map((entry) => entry.slug),
    ["artesania", "callejeo", "comerciar", "cultura", "curacion", "idioma", "leer-escribir", "saber"]);
  assert.deepEqual(byKey.chaman.professional.map((entry) => entry.slug),
    ["atadura", "curacion", "juegos-de-manos", "magia-comun", "oratoria", "saber", "trance"]);
  assert.deepEqual(byKey.hechicero.professional.map((entry) => entry.slug),
    ["idioma", "invocacion", "juegos-de-manos", "leer-escribir", "magia-comun", "manipulacion", "saber"]);
  assert.deepEqual(byKey.mistico.professional.map((entry) => entry.slug),
    ["arte", "leer-escribir", "magia-comun", "meditacion", "misticismo", "musica", "saber"]);
  assert.deepEqual(byKey.sacerdote.professional.map((entry) => entry.slug),
    ["burocracia", "devocion", "exhortacion", "leer-escribir", "magia-comun", "oratoria", "saber"]);
});

test("las categorías de edad determinan puntos gratuitos y aumento máximo", () => {
  assert.deepEqual(AGE_CATEGORIES.map(({ key, freePoints, maximum, backgroundEvents }) => (
    [key, freePoints, maximum, backgroundEvents]
  )), [
    ["young", 100, 10, 0], ["adult", 150, 15, 1], ["mature", 200, 20, 2],
    ["older", 250, 25, 3], ["elderly", 300, 30, 4]
  ]);
  assert.equal(getAgeCategory("mature").ageFormula, "3d6+25");
  const draft = createBackgroundDraft();
  assert.deepEqual(validateAgeSelection(draft), { valid: false, reason: "age" });
  Object.assign(draft, { ageCategory: "adult", age: 21 });
  assert.deepEqual(validateAgeSelection(draft), { valid: true });
});

test("las habilidades culturales coinciden con las listas del documento", () => {
  const byKey = Object.fromEntries(CULTURES.map((culture) => [culture.key, culture]));
  assert.deepEqual(byKey.barbara.basic,
    ["aguante", "atletismo", "conocimiento-local", "musculo", "percepcion", "primeros-auxilios"]);
  assert.deepEqual(byKey.civilizada.basic,
    ["conducir", "conocimiento-local", "enganar", "influencia", "ocultar", "perspicacia", "voluntad"]);
  assert.deepEqual(byKey.nomada.basic,
    ["aguante", "conocimiento-local", "percepcion", "primeros-auxilios", "sigilo"]);
  assert.deepEqual(byKey.primitiva.basic,
    ["aguante", "conocimiento-local", "evadir", "musculo", "percepcion", "sigilo"]);
  assert.deepEqual(byKey.barbara.professional.map((entry) => entry.slug),
    ["artesania", "curacion", "musica", "navegacion", "orientacion", "rastrear", "saber", "supervivencia"]);
  assert.deepEqual(byKey.civilizada.professional.map((entry) => entry.slug),
    ["arte", "artesania", "callejeo", "comerciar", "cortesia", "idioma", "musica", "saber"]);
  assert.deepEqual(byKey.nomada.professional.map((entry) => entry.slug),
    ["artesania", "cultura", "idioma", "musica", "orientacion", "rastrear", "saber", "supervivencia"]);
  assert.deepEqual(byKey.primitiva.professional.map((entry) => entry.slug),
    ["artesania", "curacion", "musica", "orientacion", "rastrear", "saber", "supervivencia"]);
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

test("la cultura exige tres profesionales, permite omitir el estilo y reparte 100 puntos", () => {
  const culture = CULTURES.find((entry) => entry.key === "civilizada");
  const draft = createBackgroundDraft();
  draft.cultureKey = culture.key;
  draft.cultureProfessionals = culture.professional
    .filter((entry) => !entry.specializationRequired)
    .slice(0, 3)
    .map((entry) => entry.id);
  const abilities = getPhaseAbilities(culture, draft, "culture")
    .filter((ability) => ability.key && ability.key !== "style:");
  for (const ability of abilities) draft.allocations.culture[ability.key] = 10;

  assert.deepEqual(
    validateBackgroundSelection(culture, draft, "culture"),
    { valid: true }
  );
});

test("la asignación cultural aplica los límites 5-15 de la página 13", () => {
  const culture = CULTURES.find((entry) => entry.key === "civilizada");
  const draft = createBackgroundDraft();
  draft.cultureKey = culture.key;
  draft.cultureProfessionals = culture.professional
    .filter((entry) => !entry.specializationRequired)
    .slice(0, 3)
    .map((entry) => entry.id);
  const abilities = getPhaseAbilities(culture, draft, "culture")
    .filter((ability) => ability.key && ability.key !== "style:");
  for (const ability of abilities) draft.allocations.culture[ability.key] = 10;

  draft.allocations.culture[abilities[0].key] = 4;
  draft.allocations.culture[abilities[1].key] = 16;
  assert.deepEqual(validateBackgroundSelection(culture, draft, "culture"), {
    valid: false,
    reason: "pointLimits"
  });

  assert.deepEqual(validateBackgroundSelection(
    culture, draft, "culture", { minimum: 0, maximum: 100 }
  ), { valid: true });
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

test("la misma especialización de cultura y profesión se fusiona", () => {
  const draft = createBackgroundDraft();
  const culture = {
    basic: [],
    choices: [],
    professionalChoiceCount: 3,
    professional: [{ id: "c", slug: "artesania", specializationRequired: true }],
    styles: []
  };
  const profession = {
    basic: [],
    choices: [],
    professionalChoiceCount: 3,
    professional: [{ id: "p", slug: "artesania", specializationRequired: true }],
    styles: []
  };
  draft.cultureProfessionals = ["c"];
  draft.professionProfessionals = ["p"];
  draft.specializations["culture:c"] = "Carpintería";
  draft.specializations["profession:p"] = "Carpintería";
  const matches = getAllAcquiredAbilities(culture, profession, draft, {
    includeFree: false
  }).filter((ability) => ability.key === skillAbilityKey("artesania", "Carpintería"));
  assert.equal(matches.length, 1);
});

test("la asignación nunca sobrepasa el presupuesto de la fase", () => {
  let allocation = setAllocation({}, "skill:atletismo:", 80, 100);
  allocation = setAllocation(allocation, "skill:aguante:", 50, 100);
  assert.equal(allocation["skill:aguante:"], 20);
  assert.equal(allocationRemaining("culture", allocation), 0);
});

test("la edición de puntos culturales salta al mínimo y respeta el máximo", () => {
  const limits = { minimum: 5, maximum: 15 };
  let allocation = setAllocation({}, "skill:atletismo:", 1, 100, limits);
  assert.equal(allocation["skill:atletismo:"], 5);
  allocation = setAllocation(allocation, "skill:atletismo:", 99, 100, limits);
  assert.equal(allocation["skill:atletismo:"], 15);
  allocation = setAllocation(allocation, "skill:atletismo:", 4, 100, limits);
  assert.equal(allocation["skill:atletismo:"], 0);
});

test("la profesión aplica los límites configurados sin obligar a mejorar todo", () => {
  const profession = PROFESSIONS.find((entry) => entry.key === "funcionario");
  const draft = createBackgroundDraft();
  draft.professionProfessionals = profession.professional.slice(0, 3).map((entry) => entry.id);
  const abilities = getPhaseAbilities(profession, draft, "profession")
    .filter((ability) => ability.key && ability.key !== "style:");
  for (const ability of abilities) draft.allocations.profession[ability.key] = 10;
  assert.deepEqual(validateBackgroundSelection(
    profession, draft, "profession", { minimum: 0, maximum: 15 }
  ), { valid: true });
  draft.allocations.profession[abilities[0].key] = 16;
  draft.allocations.profession[abilities[1].key] = 4;
  assert.deepEqual(validateBackgroundSelection(
    profession, draft, "profession", { minimum: 5, maximum: 15 }
  ), { valid: false, reason: "pointLimits" });
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

test("la edad limita el aumento individual de los puntos gratuitos", () => {
  const draft = createBackgroundDraft();
  draft.freeProfessional = { slug: "saber", specialization: "Historia" };
  draft.allocations.free[skillAbilityKey("saber", "Historia")] = 150;
  assert.deepEqual(validateFreePhase(null, null, draft, [], {
    budget: 150, minimum: 0, maximum: 15
  }), { valid: false, reason: "pointLimits" });
});

test("la habilidad libre puede mejorar una habilidad ya adquirida", () => {
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
    { valid: true }
  );
});

test("la habilidad libre puede ser un estilo de combate", () => {
  const draft = createBackgroundDraft();
  draft.freeProfessional = {
    type: "combatStyle",
    slug: "__combat-style__",
    specialization: "",
    name: "Lanza y escudo",
    weapons: "Lanza, escudo",
    traits: "Formación cerrada"
  };
  draft.allocations.free["style:lanza-y-escudo"] = 150;
  assert.deepEqual(validateFreePhase(null, null, draft, []), { valid: true });
  const [style] = getAllAcquiredAbilities(null, null, draft);
  assert.equal(style.type, "combatStyle");
  assert.equal(style.name, "Lanza y escudo");
});

test("la profesión admite estilos de combate adicionales independientes", () => {
  const draft = createBackgroundDraft();
  const profession = {
    basic: [],
    choices: [],
    professionalChoiceCount: 3,
    professional: [],
    styles: ["Estilo profesional"]
  };
  draft.styles["profession:0"] = { name: "Espada y escudo" };
  draft.extraStyles.profession.push("profession:extra-1");
  draft.styles["profession:extra-1"] = { name: "Arco tribal" };
  const styles = getAllAcquiredAbilities(null, profession, draft, {
    includeFree: false
  }).filter((ability) => ability.type === "combatStyle");
  assert.deepEqual(styles.map((style) => style.name), ["Espada y escudo", "Arco tribal"]);
});

test("un estilo ofrecido por la profesión puede dejarse vacío", () => {
  const draft = createBackgroundDraft();
  const profession = {
    basic: [],
    choices: [],
    professionalChoiceCount: 3,
    professional: [
      { id: "a", slug: "actuar", specializationRequired: false },
      { id: "b", slug: "callejeo", specializationRequired: false },
      { id: "c", slug: "comerciar", specializationRequired: false }
    ],
    styles: ["Estilo cultural o militar"]
  };
  draft.professionProfessionals = ["a", "b", "c"];
  draft.allocations.profession[skillAbilityKey("actuar")] = 100;
  assert.deepEqual(
    validateBackgroundSelection(profession, draft, "profession"),
    { valid: true }
  );
});
