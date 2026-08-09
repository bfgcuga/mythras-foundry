export const NON_CARRIED_CATEGORIES = Object.freeze([
  "service", "vehicle", "livestock", "property"
]);

export const INVENTORY_CATEGORY_ORDER = Object.freeze({
  weapon: 1, armor: 2, item: 3, clothing: 3, food: 3, ammunition: 3,
  service: 3, container: 4, livestock: 5, vehicle: 6, property: 7
});

export function inventoryCategory(item) {
  return item.type === "weapon" ? "weapon"
    : item.type === "armor" ? "armor" : (item.system?.category ?? "item");
}

export function inventoryGroup(item) {
  const category = inventoryCategory(item);
  if (category === "weapon") return "weapons";
  if (category === "armor") return "armor";
  if (category === "container") return "containers";
  if (category === "livestock") return "livestock";
  if (category === "vehicle") return "vehicles";
  return "miscellaneous";
}

export function sortInventoryItems(items = []) {
  return [...items].sort((left, right) => {
    const order = (INVENTORY_CATEGORY_ORDER[inventoryCategory(left)] ?? 3)
      - (INVENTORY_CATEGORY_ORDER[inventoryCategory(right)] ?? 3);
    return order || String(left.name ?? "").localeCompare(String(right.name ?? ""), "es");
  });
}

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
  for (const item of sortInventoryItems(items)) {
    const requested = item.system?.parentContainerId;
    const parent = requested && ids.has(requested) ? requested : "";
    byParent.set(parent, [...(byParent.get(parent) ?? []), item]);
  }
  const rows = [];
  const rendered = new Set();
  const visit = (item, depth, hidden, ancestors, groupStart = false) => {
    if (ancestors.has(item.id) || rendered.has(item.id)) return;
    rendered.add(item.id);
    const children = byParent.get(item.id) ?? [];
    rows.push({ item, id: item.id, name: item.name, system: item.system, depth,
      indent: depth * 18, hidden, hasChildren: children.length > 0,
      groupKey: inventoryGroup(item), groupStart,
      isContainer: Boolean(item.system?.isContainer),
      isWeapon: item.type === "weapon", isArmor: item.type === "armor",
      isEquipment: item.type === "equipment",
      carried: inventoryCarried(item, items) });
    const nextAncestors = new Set(ancestors).add(item.id);
    let previousGroup = null;
    for (const child of children) {
      const group = inventoryGroup(child);
      visit(child, depth + 1, hidden || Boolean(item.system?.collapsed), nextAncestors,
        group !== previousGroup);
      previousGroup = group;
    }
  };
  let previousRootGroup = null;
  for (const root of byParent.get("") ?? []) {
    const group = inventoryGroup(root);
    visit(root, 0, false, new Set(), group !== previousRootGroup);
    previousRootGroup = group;
  }
  for (const item of items) if (!rendered.has(item.id)) visit(item, 0, false, new Set(), true);
  return rows;
}

export function inventoryLocation(item, items = []) {
  if (!item.system?.parentContainerId) return "person";
  return items.find((entry) => entry.id === item.system.parentContainerId)?.name ?? "person";
}

export function inventorySections(items = []) {
  const properties = sortInventoryItems(items.filter((item) => (
    item.type === "equipment" && item.system?.category === "property"
  )));
  const propertyIds = new Set(properties.map((item) => item.id));
  const descendants = (rootId) => {
    const selected = [];
    const pending = [rootId];
    const visited = new Set();
    while (pending.length) {
      const parentId = pending.shift();
      if (visited.has(parentId)) continue;
      visited.add(parentId);
      for (const item of items) if (item.system?.parentContainerId === parentId) {
        selected.push(item);
        pending.push(item.id);
      }
    }
    return selected;
  };
  const assigned = new Set(properties.flatMap((property) => descendants(property.id))
    .map((item) => item.id));
  return [{ id: "person", property: null, items: items.filter((item) => (
    !propertyIds.has(item.id) && !assigned.has(item.id)
  )) }, ...properties.map((property) => ({ id: property.id, property,
    items: descendants(property.id) }))];
}

export function carriedInventoryEncumbrance(items = []) {
  return items.filter((item) => inventoryCarried(item, items)).reduce((total, item) => (
    total + Number(item.system?.weight ?? 0) * Number(item.system?.quantity ?? 1)
  ), 0);
}
