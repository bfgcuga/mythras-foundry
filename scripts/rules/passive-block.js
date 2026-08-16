export const PASSIVE_BLOCK_SCHEMA_VERSION = 1;

export function passiveBlockCapacity(mode) {
  const trait = Array.from(mode?.traitRefs ?? []).find((entry) => entry.key === "bloqueo-pasivo");
  return Math.max(0, Number(trait?.parameters?.find((entry) => entry.key === "locations")?.value ?? 0));
}
export function contiguousLocationIds(locations, selectedIds) {
  const ordered = Array.from(locations ?? []).sort((a, b) => Number(a.rangeStart) - Number(b.rangeStart));
  const indexes = selectedIds.map((id) => ordered.findIndex((entry) => entry.id === id)).sort((a, b) => a - b);
  return indexes.length > 0 && !indexes.includes(-1)
    && indexes.every((value, index) => index === 0 || value === indexes[index - 1] + 1);
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
