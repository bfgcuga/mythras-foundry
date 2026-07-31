export const BACKGROUND_BUDGETS = Object.freeze({
  culture: 100,
  profession: 100,
  free: 150
});

const SPECIALIZED_SKILLS = new Set([
  "arte", "artesania", "ciencia", "cultura", "curacion", "ensenar",
  "idioma", "leer-escribir", "musica", "pilotaje", "saber", "supervivencia"
]);

export function createBackgroundDraft() {
  return {
    stage: "culture",
    cultureKey: "",
    professionKey: "",
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
  const requiredStyles = (background.styles ?? []).map((prompt, index) => ({
    id: `${phase}:${index}`,
    prompt,
    required: phase === "culture"
  }));
  const extraStyles = (draft.extraStyles?.[phase] ?? []).map((id) => ({
    id,
    prompt: "Estilo de combate adicional",
    required: false
  }));
  const styles = [...requiredStyles, ...extraStyles].map((definition) => {
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

export function allocationRemaining(phase, allocation = {}) {
  return BACKGROUND_BUDGETS[phase] - allocationSpent(allocation);
}

export function setAllocation(allocation, key, value, budget) {
  const next = { ...allocation };
  const previous = Math.max(0, Number(next[key]) || 0);
  const requested = Math.max(0, Number.parseInt(value, 10) || 0);
  const spentWithoutCurrent = allocationSpent(next) - previous;
  next[key] = Math.min(requested, Math.max(0, budget - spentWithoutCurrent));
  return next;
}

export function validateBackgroundSelection(background, draft, phase) {
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
  for (let index = 0; index < (background.styles ?? []).length; index += 1) {
    if (
      phase === "culture"
      && !String(draft.styles[`${phase}:${index}`]?.name ?? "").trim()
    ) {
      return { valid: false, reason: "style" };
    }
  }
  for (const id of draft.extraStyles?.[phase] ?? []) {
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
  return { valid: true };
}

export function validateFreePhase(culture, profession, draft, basicSlugs = []) {
  const { type, slug, specialization, name } = draft.freeProfessional;
  if (!slug) return { valid: false, reason: "freeSkill" };
  if (type === "combatStyle" && !String(name).trim()) {
    return { valid: false, reason: "style" };
  }
  if (type !== "combatStyle" && freeSkillNeedsSpecialization(slug)
    && !String(specialization).trim()) {
    return { valid: false, reason: "specialization" };
  }
  if (allocationRemaining("free", draft.allocations.free) !== 0) {
    return { valid: false, reason: "points" };
  }
  const allowed = new Set(
    getFreeAbilities(culture, profession, draft, basicSlugs).map((ability) => ability.key)
  );
  if (Object.keys(draft.allocations.free).some((key) => !allowed.has(key))) {
    return { valid: false, reason: "points" };
  }
  return { valid: true };
}
