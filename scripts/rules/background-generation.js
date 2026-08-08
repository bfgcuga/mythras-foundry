import { getSocialClass } from "../data/social-classes.js";

export const BACKGROUND_BUDGETS = Object.freeze({
  culture: 100,
  profession: 100,
  free: 150
});

export const DEFAULT_CULTURE_ALLOCATION_LIMITS = Object.freeze({
  minimum: 5,
  maximum: 15
});

export const AGE_CATEGORIES = Object.freeze([
  Object.freeze({ key: "young", ageFormula: "1d6+10", freePoints: 100,
    maximum: 10, backgroundEvents: 0, aging: false }),
  Object.freeze({ key: "adult", ageFormula: "2d6+15", freePoints: 150,
    maximum: 15, backgroundEvents: 1, aging: false }),
  Object.freeze({ key: "mature", ageFormula: "3d6+25", freePoints: 200,
    maximum: 20, backgroundEvents: 2, aging: false }),
  Object.freeze({ key: "older", ageFormula: "4d6+40", freePoints: 250,
    maximum: 25, backgroundEvents: 3, aging: true }),
  Object.freeze({ key: "elderly", ageFormula: "5d6+60", freePoints: 300,
    maximum: 30, backgroundEvents: 4, aging: true })
]);

export function getAgeCategory(key) {
  return AGE_CATEGORIES.find((entry) => entry.key === key);
}

const SPECIALIZED_SKILLS = new Set([
  "arte", "artesania", "cultura", "curacion", "ensenar", "idioma",
  "leer-escribir", "musica", "saber", "supervivencia"
]);

export function createBackgroundDraft() {
  return {
    stage: "culture",
    cultureKey: "",
    professionKey: "",
    socialClassKey: "",
    socialClassRoll: 0,
    startingMoneyDice: 0,
    startingMoney: 0,
    ageCategory: "",
    age: 0,
    cultureChoices: {},
    professionChoices: {},
    cultureProfessionals: [],
    professionProfessionals: [],
    specializations: {},
    styles: {},
    extraStyles: { culture: [], profession: [] },
    freeProfessional: {
      type: "skill", slug: "", specialization: "", name: "", weapons: "", traits: ""
    },
    allocations: { culture: {}, profession: {}, free: {} }
  };
}

export function parseBackgroundDraft(value) {
  if (!value) return createBackgroundDraft();
  try {
    return mergeDraft(JSON.parse(value));
  } catch {
    return createBackgroundDraft();
  }
}

export function serializeBackgroundDraft(draft) {
  return JSON.stringify(mergeDraft(draft));
}

export function mergeDraft(draft = {}) {
  const initial = createBackgroundDraft();
  return {
    ...initial,
    ...draft,
    cultureChoices: { ...initial.cultureChoices, ...draft.cultureChoices },
    professionChoices: { ...initial.professionChoices, ...draft.professionChoices },
    specializations: { ...initial.specializations, ...draft.specializations },
    styles: { ...initial.styles, ...draft.styles },
    extraStyles: {
      culture: [...(draft.extraStyles?.culture ?? [])],
      profession: [...(draft.extraStyles?.profession ?? [])]
    },
    freeProfessional: { ...initial.freeProfessional, ...draft.freeProfessional },
    allocations: {
      culture: { ...initial.allocations.culture, ...draft.allocations?.culture },
      profession: { ...initial.allocations.profession, ...draft.allocations?.profession },
      free: { ...initial.allocations.free, ...draft.allocations?.free }
    }
  };
}

export function slugifySpecialization(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function skillAbilityKey(slug, specialization = "") {
  return `skill:${slug}:${slugifySpecialization(specialization)}`;
}

export function styleAbilityKey(name) {
  return `style:${slugifySpecialization(name)}`;
}

export function optionNeedsSpecialization(option) {
  return Boolean(option?.specializationRequired);
}

export function freeSkillNeedsSpecialization(slug) {
  return SPECIALIZED_SKILLS.has(slug);
}

function choiceSlugs(background, selections) {
  return (background?.choices ?? []).flatMap((choice) => {
    const values = selections?.[choice.id] ?? [];
    return Array.isArray(values) ? values : [values].filter(Boolean);
  });
}

function selectedProfessionalOptions(background, selectedIds) {
  const selected = new Set(selectedIds ?? []);
  return (background?.professional ?? []).filter((entry) => selected.has(entry.id));
}

export function getPhaseAbilities(background, draft, phase) {
  if (!background) return [];
  const selections = phase === "culture"
    ? draft.cultureChoices
    : draft.professionChoices;
  const selectedIds = phase === "culture"
    ? draft.cultureProfessionals
    : draft.professionProfessionals;
  const basicSlugs = [...new Set([
    ...background.basic,
    ...choiceSlugs(background, selections)
  ])];
  const basics = basicSlugs.map((slug) => ({
    key: skillAbilityKey(slug),
    type: "skill",
    slug,
    specialization: ""
  }));
  const professionals = selectedProfessionalOptions(background, selectedIds).map((entry) => {
    const specialization = draft.specializations[`${phase}:${entry.id}`] ?? "";
    return {
      key: skillAbilityKey(entry.slug, specialization),
      type: "skill",
      slug: entry.slug,
      specialization,
      option: entry
    };
  });
  const offeredStyles = (background.styles ?? []).map((prompt, index) => ({
    id: `${phase}:${index}`,
    prompt,
    required: false
  }));
  const extraStyles = (phase === "culture" ? [] : draft.extraStyles?.[phase] ?? []).map((id) => ({
    id,
    prompt: "Estilo de combate adicional",
    required: false
  }));
  const styles = [...offeredStyles, ...extraStyles].map((definition) => {
    const style = draft.styles[definition.id] ?? {};
    return {
      key: styleAbilityKey(style.name),
      type: "combatStyle",
      id: definition.id,
      name: style.name ?? "",
      weapons: style.weapons ?? "",
      traits: style.traits ?? "",
      prompt: definition.prompt,
      required: definition.required
    };
  });
  return [...basics, ...professionals, ...styles];
}

export function getAllAcquiredAbilities(culture, profession, draft, {
  includeFree = true
} = {}) {
  const abilities = [
    ...getPhaseAbilities(culture, draft, "culture"),
    ...getPhaseAbilities(profession, draft, "profession")
  ];
  if (includeFree && draft.freeProfessional.slug) {
    const free = draft.freeProfessional;
    if (free.type === "combatStyle") {
      abilities.push({
        key: styleAbilityKey(free.name),
        type: "combatStyle",
        name: free.name,
        weapons: free.weapons,
        traits: free.traits,
        specialization: free.name,
        freeChoice: true
      });
    } else {
      abilities.push({
        key: skillAbilityKey(free.slug, free.specialization),
        type: "skill",
        slug: free.slug,
        specialization: free.specialization,
        freeChoice: true
      });
    }
  }
  const unique = new Map();
  for (const ability of abilities) {
    if (!ability.key.endsWith(":")) unique.set(ability.key, ability);
    else if (ability.type === "skill") unique.set(ability.key, ability);
  }
  return [...unique.values()];
}

export function getFreeAbilities(culture, profession, draft, basicSlugs = []) {
  const abilities = [
    ...basicSlugs.map((slug) => ({
      key: skillAbilityKey(slug),
      type: "skill",
      slug,
      specialization: ""
    })),
    ...getAllAcquiredAbilities(culture, profession, draft)
  ];
  return [...new Map(abilities.map((ability) => [ability.key, ability])).values()];
}

export function allocationSpent(allocation = {}) {
  return Object.values(allocation)
    .reduce((total, value) => total + Math.max(0, Number(value) || 0), 0);
}

export function allocationRemaining(phase, allocation = {}, budget = BACKGROUND_BUDGETS[phase]) {
  return budget - allocationSpent(allocation);
}

export function setAllocation(allocation, key, value, budget, limits = {}) {
  const next = { ...allocation };
  const previous = Math.max(0, Number(next[key]) || 0);
  const requested = Math.max(0, Number.parseInt(value, 10) || 0);
  const minimum = Math.max(0, Number(limits.minimum) || 0);
  const maximum = Math.max(minimum, Number(limits.maximum) || budget);
  const limited = requested === 0
    ? 0
    : requested < minimum
      ? (previous >= minimum ? 0 : minimum)
      : Math.min(requested, maximum);
  const spentWithoutCurrent = allocationSpent(next) - previous;
  next[key] = Math.min(limited, Math.max(0, budget - spentWithoutCurrent));
  return next;
}

export function validateBackgroundSelection(background, draft, phase,
  allocationLimits = phase === "culture" ? DEFAULT_CULTURE_ALLOCATION_LIMITS : null) {
  if (!background) return { valid: false, reason: "background" };
  const choices = phase === "culture" ? draft.cultureChoices : draft.professionChoices;
  for (const choice of background.choices ?? []) {
    const selected = new Set(choices[choice.id] ?? []);
    if (selected.size !== choice.count) return { valid: false, reason: "basicChoices" };
  }
  const selectedIds = phase === "culture"
    ? draft.cultureProfessionals
    : draft.professionProfessionals;
  if (new Set(selectedIds).size !== background.professionalChoiceCount) {
    return { valid: false, reason: "professionalChoices" };
  }
  for (const entry of selectedProfessionalOptions(background, selectedIds)) {
    if (
      optionNeedsSpecialization(entry)
      && !String(draft.specializations[`${phase}:${entry.id}`] ?? "").trim()
    ) {
      return { valid: false, reason: "specialization" };
    }
  }
  for (const id of phase === "culture" ? [] : draft.extraStyles?.[phase] ?? []) {
    if (!String(draft.styles[id]?.name ?? "").trim()) {
      return { valid: false, reason: "style" };
    }
  }
  const abilities = getPhaseAbilities(background, draft, phase);
  if (abilities.some((ability) => (
    !ability.key
    || (ability.type === "combatStyle" && ability.required && ability.key === "style:")
  ))) {
    return { valid: false, reason: "style" };
  }
  if (allocationRemaining(phase, draft.allocations[phase]) !== 0) {
    return { valid: false, reason: "points" };
  }
  const allowed = new Set(abilities.map((ability) => ability.key));
  if (Object.keys(draft.allocations[phase]).some((key) => !allowed.has(key))) {
    return { valid: false, reason: "points" };
  }
  if (allocationLimits) {
    const minimum = Math.max(0, Number(allocationLimits.minimum) || 0);
    const maximum = Math.max(minimum, Number(allocationLimits.maximum) || 0);
    if (abilities.some((ability) => {
      if (!ability.key || ability.key === "style:") return false;
      const points = Math.max(0, Number(draft.allocations[phase][ability.key]) || 0);
      return points > maximum
        || (points > 0 && points < minimum)
        || (phase === "culture" && points < minimum);
    })) {
      return { valid: false, reason: "pointLimits" };
    }
  }
  return { valid: true };
}

export function validateAgeSelection(draft) {
  if (!getAgeCategory(draft.ageCategory) || Number(draft.age) < 1) {
    return { valid: false, reason: "age" };
  }
  return { valid: true };
}

export function validateSocialClassSelection(draft) {
  if (!getSocialClass(draft.cultureKey, draft.socialClassKey)
    || Number(draft.startingMoneyDice) < 4
    || Number(draft.startingMoney) < 0) {
    return { valid: false, reason: "socialClass" };
  }
  return { valid: true };
}

export function validateFreePhase(culture, profession, draft, basicSlugs = [], rules = {}) {
  const { type, slug, specialization, name } = draft.freeProfessional;
  if (!slug) return { valid: false, reason: "freeSkill" };
  if (type === "combatStyle" && !String(name).trim()) {
    return { valid: false, reason: "style" };
  }
  if (type !== "combatStyle" && freeSkillNeedsSpecialization(slug)
    && !String(specialization).trim()) {
    return { valid: false, reason: "specialization" };
  }
  const budget = Number(rules.budget) || BACKGROUND_BUDGETS.free;
  if (allocationRemaining("free", draft.allocations.free, budget) !== 0) {
    return { valid: false, reason: "points" };
  }
  const allowed = new Set(
    getFreeAbilities(culture, profession, draft, basicSlugs).map((ability) => ability.key)
  );
  if (Object.keys(draft.allocations.free).some((key) => !allowed.has(key))) {
    return { valid: false, reason: "points" };
  }
  const minimum = Math.max(0, Number(rules.minimum) || 0);
  const maximum = Math.max(minimum, Number(rules.maximum) || budget);
  if (Object.values(draft.allocations.free).some((value) => {
    const points = Math.max(0, Number(value) || 0);
    return points > maximum || (points > 0 && points < minimum);
  })) return { valid: false, reason: "pointLimits" };
  return { valid: true };
}
