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
  const locationIds = Array.from(armor.system.coveredLocationIds ?? []);
  if (armor.system.coverageMigrated || locationIds.length) {
    return locationIds.includes(location?.id ?? location?._id);
  }
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

export function armorCoverageLocations(armor, locations) {
  const ids = new Set(Array.from(armor?.system?.coveredLocationIds ?? []));
  return (locations ?? []).filter((location) => ids.has(location.id ?? location._id));
}

export function armorCoverageFactor(armor, locations) {
  return armorCoverageLocations(armor, locations).reduce((total, location) =>
    total + Math.max(0, Number(location.system?.armorMultiplier ?? 0)), 0);
}

export function armorPhysicalTotals(armor, locations) {
  const factor = armorCoverageFactor(armor, locations);
  return {
    factor,
    encumbrance: factor * Math.max(0, Number(armor?.system?.baseEncumbrance ?? 0)),
    value: factor * Math.max(0, Number(armor?.system?.baseValue ?? 0))
  };
}

export function armorEquipConflicts(armor, armors) {
  const selected = new Set(Array.from(armor?.system?.coveredLocationIds ?? []));
  if (!selected.size) return [];
  const conflicts = new Set();
  for (const candidate of armors ?? []) {
    if (candidate.id === armor.id || !candidate.system?.equipped) continue;
    for (const id of candidate.system?.coveredLocationIds ?? []) {
      if (selected.has(id)) conflicts.add(id);
    }
  }
  return [...conflicts];
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
