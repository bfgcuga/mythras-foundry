export const FAMILIARITY_LEVELS = Object.freeze([
  "included",
  "similar",
  "broadlySimilar",
  "reasonablyDifferent",
  "substantiallyDifferent"
]);

export const UNTRAINED_COMBAT_STYLE_ID = "__untrained__";

export function normalizeWeaponProfile(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseWeaponProfileReferences(value) {
  return String(value ?? "")
    .split(/[,;\n]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ key: normalizeWeaponProfile(name), name }));
}

export function styleIncludesWeapon(style, weapon) {
  const key = weapon?.system?.profileKey || normalizeWeaponProfile(weapon?.name);
  return (style?.system?.weaponProfiles ?? []).some((profile) => profile.key === key);
}

export function resolveWeaponStyle({ weapon, styles, selectedStyleId, familiarity }) {
  const matching = styles.filter((style) => styleIncludesWeapon(style, weapon));
  const base = Number(weapon?.actor?.system?.strength ?? 0)
    + Number(weapon?.actor?.system?.dexterity ?? 0);
  if (matching.length === 0 && selectedStyleId === UNTRAINED_COMBAT_STYLE_ID) {
    return {
      style: null,
      matching,
      familiarity: "untrained",
      difficulty: "standard",
      target: base,
      usesBase: true,
      untrained: true
    };
  }
  const selected = styles.find((style) => style.id === selectedStyleId);
  const directStyle = matching.find((style) => style.id === selectedStyleId)
    ?? (matching.length === 1 ? matching[0] : null);
  if (directStyle) {
    return { style: directStyle, matching, familiarity: "included", difficulty: "standard",
      target: Number(directStyle.system.total ?? 0), usesBase: false, untrained: false };
  }

  const fallback = selected && !matching.includes(selected) ? selected : null;
  const level = FAMILIARITY_LEVELS.includes(familiarity) && familiarity !== "included"
    ? familiarity
    : "similar";
  const difficulties = {
    similar: "standard",
    broadlySimilar: "hard",
    reasonablyDifferent: "formidable",
    substantiallyDifferent: "standard"
  };
  const usesBase = level === "substantiallyDifferent";
  return {
    style: fallback,
    matching,
    familiarity: level,
    difficulty: difficulties[level],
    target: usesBase ? base : Number(fallback?.system?.total ?? base),
    usesBase,
    untrained: false
  };
}

export function difficultyTarget(value, difficulty = "standard") {
  const multipliers = { veryEasy: 2, easy: 1.5, standard: 1, hard: 2 / 3,
    formidable: 0.5, herculean: 0.2, impossible: 0 };
  return Math.max(0, Math.ceil(Number(value ?? 0) * (multipliers[difficulty] ?? 1)));
}

export function applyArmor(damage, armorPoints) {
  return Math.max(0, Number(damage ?? 0) - Math.max(0, Number(armorPoints ?? 0)));
}

export function damageModifierFormula(modifier, mode = "full") {
  if (typeof modifier === "string") {
    const formula = modifier.trim().replace(/^\+/, "");
    if (!formula || formula === "0" || mode === "none") return "0";
    if (mode === "half") return `floor((${formula}) / 2)`;
    return formula;
  }
  const formula = String(modifier?.label ?? modifier ?? "").trim().replace(/^\+/, "");
  if (!formula || formula === "0" || formula === "None" || mode === "none") return "";
  if (mode === "half") return `floor((${formula}) / 2)`;
  return formula;
}
