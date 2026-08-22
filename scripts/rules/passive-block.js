export const PASSIVE_BLOCK_SCHEMA_VERSION = 1;

export function passiveBlockCapacity(mode) {
  const trait = Array.from(mode?.traitRefs ?? []).find((entry) => entry.key === "bloqueo-pasivo");
  return Math.max(0, Number(trait?.parameters?.find((entry) => entry.key === "locations")?.value ?? 0));
}
export function contiguousLocationIds(locations, selectedIds) {
  const ordered = Array.from(locations ?? []).sort((a, b) => Number(a.rangeStart) - Number(b.rangeStart));
  const selected = ordered.filter((entry) => selectedIds.includes(entry.id));
  if (!selected.length || selected.length !== new Set(selectedIds).size) return false;
  const category = (entry) => entry.category ?? entry.system?.category ?? "";
  const humanCategories = new Set(["head", "chest", "abdomen", "arm", "leg"]);
  if (!selected.every((entry) => humanCategories.has(category(entry)))) {
    const indexes = selected.map((entry) => ordered.indexOf(entry)).sort((a, b) => a - b);
    return indexes.every((value, index) => index === 0 || value === indexes[index - 1] + 1);
  }
  const adjacent = (left, right) => {
    const pair = new Set([category(left), category(right)]);
    return pair.size === 1 || (pair.has("chest") && ["head", "abdomen", "arm"]
      .some((value) => pair.has(value))) || (pair.has("abdomen") && pair.has("leg"));
  };
  const reached = new Set([selected[0].id]);
  for (let changed = true; changed;) {
    changed = false;
    for (const candidate of selected) {
      if (!reached.has(candidate.id) && selected.some((entry) =>
        reached.has(entry.id) && adjacent(entry, candidate))) {
        reached.add(candidate.id); changed = true;
      }
    }
  }
  return reached.size === selected.length;
}
export function validatePassiveBlock({ mode, locations, selectedIds, crouched = false }) {
  const base = passiveBlockCapacity(mode);
  const capacity = base * (crouched && mode?.weaponType === "shield" ? 2 : 1);
  return { valid: base > 0 && selectedIds.length === capacity
    && new Set(selectedIds).size === selectedIds.length
    && contiguousLocationIds(locations, selectedIds), base, capacity };
}
export function activePassiveBlock(block, { round, weaponExists = true, locationsExist = true } = {}) {
  return Boolean(block && block.status === "active" && Number(block.round) === Number(round)
    && weaponExists && locationsExist);
}
