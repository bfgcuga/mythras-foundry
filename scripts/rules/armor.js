function normalizeCoverage(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function armorCoversLocation(armor, location) {
  if (!armor?.system?.equipped) return false;
  const coverage = String(armor.system.coverage ?? "").trim();
  if (!coverage) return true;
  const entries = coverage.split(/[,;\n]/).map(normalizeCoverage).filter(Boolean);
  if (entries.some((entry) => ["all", "all-locations", "full-body", "todas", "todas-las-localizaciones", "todo-el-cuerpo"].includes(entry))) {
    return true;
  }
  const locationName = normalizeCoverage(location?.name);
  const category = normalizeCoverage(location?.system?.category);
  return entries.includes(locationName) || entries.includes(category);
}

export function wornArmorPoints(location, armors) {
  return armors.reduce((total, armor) => (
    armorCoversLocation(armor, location)
      ? total + Math.max(0, Number(armor.system.armorPoints ?? 0))
      : total
  ), 0);
}

export function totalArmorPoints(location, armors) {
  const natural = Math.max(0, Number(location?.system?.armorPoints ?? 0));
  return natural + wornArmorPoints(location, armors);
}
