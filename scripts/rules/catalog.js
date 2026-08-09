export const OFFICIAL_CATALOG_PACKS = Object.freeze([
  "mythras-foundry.weapons",
  "mythras-foundry.armor-pieces",
  "mythras-foundry.equipment"
]);

export const CATALOG_CATEGORIES = Object.freeze([
  "weapon", "shield", "armor", "item", "container", "clothing", "food",
  "ammunition", "property", "livestock", "vehicle", "service"
]);

export const CURRENCY_SORT_VALUE = Object.freeze({ copper: 1, silver: 10, gold: 100 });

export function normalizeCatalogConfig(value) {
  const packIds = Array.isArray(value?.packIds) ? value.packIds : [];
  return { version: 1, packIds: [...new Set(packIds.filter((id) => typeof id === "string"))] };
}

export function normalizeCatalogText(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase().trim();
}

export function catalogCategory(entry) {
  if (entry.type === "armor") return "armor";
  if (entry.type === "weapon") return entry.system?.weaponType === "shield"
    ? "shield" : "weapon";
  if (entry.type !== "equipment") return null;
  const category = entry.system?.category ?? "item";
  return CATALOG_CATEGORIES.includes(category) ? category : "item";
}

export function catalogPriceSortValue(entry) {
  return Math.max(0, Number(entry.system?.value ?? 0))
    * (CURRENCY_SORT_VALUE[entry.system?.currency] ?? CURRENCY_SORT_VALUE.silver);
}

export function prepareCatalogEntry(entry, { packId = "", packLabel = "" } = {}) {
  const category = catalogCategory(entry);
  if (!category) return null;
  const id = entry._id ?? entry.id;
  const uuid = entry.uuid ?? (packId && id ? `Compendium.${packId}.${id}` : "");
  return {
    id, uuid, name: entry.name, img: entry.img, type: entry.type, category,
    value: Math.max(0, Number(entry.system?.value ?? 0)),
    currency: entry.system?.currency ?? "silver",
    priceSortValue: catalogPriceSortValue(entry), packId, packLabel
  };
}

export function filterCatalogEntries(entries, { search = "", categories = null } = {}) {
  const query = normalizeCatalogText(search);
  const selected = new Set(categories ?? []);
  return entries.filter((entry) => (!query || normalizeCatalogText(entry.name).includes(query))
    && (categories === null || selected.has(entry.category)))
    .sort((left, right) => left.priceSortValue - right.priceSortValue
      || String(left.name).localeCompare(String(right.name), "es", { sensitivity: "base" }));
}

export function mergeCatalogEntries(entries) {
  return [...new Map(entries.filter(Boolean).map((entry) => [entry.uuid, entry])).values()];
}

export function assessCatalogPurchase(funds, entry) {
  const currency = entry.system?.currency ?? entry.currency ?? "silver";
  const price = Math.max(0, Number(entry.system?.value ?? entry.value ?? 0));
  const available = Math.max(0, Number(funds?.[currency] ?? 0));
  return { allowed: available >= price, currency, price, available,
    remaining: Math.max(0, available - price) };
}
