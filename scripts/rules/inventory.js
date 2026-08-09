export const NON_CARRIED_CATEGORIES = Object.freeze([
  "service", "vehicle", "livestock", "property"
]);

export function inventoryCarried(item, items = []) {
  const byId = new Map(items.map((entry) => [entry.id, entry]));
  const visited = new Set();
  let current = item;
  while (current) {
    if (NON_CARRIED_CATEGORIES.includes(current.system?.category)) return false;
    const parentId = current.system?.parentContainerId;
    if (!parentId) return true;
    if (visited.has(parentId)) return false;
    visited.add(parentId);
    current = byId.get(parentId);
  }
  return true;
}

export function inventoryRows(items = []) {
  const byParent = new Map();
  const ids = new Set(items.map((item) => item.id));
  for (const item of items) {
    const requested = item.system?.parentContainerId;
    const parent = requested && ids.has(requested) ? requested : "";
    byParent.set(parent, [...(byParent.get(parent) ?? []), item]);
  }
  const rows = [];
  const rendered = new Set();
  const visit = (item, depth, hidden, ancestors) => {
    if (ancestors.has(item.id) || rendered.has(item.id)) return;
    rendered.add(item.id);
    const children = byParent.get(item.id) ?? [];
    rows.push({ item, id: item.id, name: item.name, system: item.system, depth,
      indent: depth * 18, hidden, hasChildren: children.length > 0,
      isContainer: Boolean(item.system?.isContainer),
      isWeapon: item.type === "weapon", isArmor: item.type === "armor",
      isEquipment: item.type === "equipment",
      carried: inventoryCarried(item, items) });
    const nextAncestors = new Set(ancestors).add(item.id);
    for (const child of children) {
      visit(child, depth + 1, hidden || Boolean(item.system?.collapsed), nextAncestors);
    }
  };
  for (const root of byParent.get("") ?? []) visit(root, 0, false, new Set());
  for (const item of items) if (!rendered.has(item.id)) visit(item, 0, false, new Set());
  return rows;
}

export function carriedInventoryEncumbrance(items = []) {
  return items.filter((item) => inventoryCarried(item, items)).reduce((total, item) => (
    total + Number(item.system?.weight ?? 0) * Number(item.system?.quantity ?? 1)
  ), 0);
}
