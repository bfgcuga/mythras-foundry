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
export const CATALOG_SORTS = Object.freeze([
  "name-asc", "name-desc", "category-asc", "category-desc", "price-asc", "price-desc"
]);

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
  if (entry.type === "weapon") return (entry.system?.modes?.some((mode) => mode.weaponType === "shield")
    || entry.system?.weaponType === "shield")
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

export function filterCatalogEntries(entries, {
  search = "", categories = null, packIds = null, sort = "price-asc"
} = {}) {
  const query = normalizeCatalogText(search);
  const selected = new Set(categories ?? []);
  const selectedPacks = new Set(packIds ?? []);
  const sorting = CATALOG_SORTS.includes(sort) ? sort : "price-asc";
  const [field, direction] = sorting.split("-");
  const sign = direction === "desc" ? -1 : 1;
  const text = (left, right) => String(left).localeCompare(String(right), "es", {
    sensitivity: "base"
  });
  return entries.filter((entry) => (!query || normalizeCatalogText(entry.name).includes(query))
    && (categories === null || selected.has(entry.category))
    && (packIds === null || selectedPacks.has(entry.packId)))
    .sort((left, right) => sign * (field === "price"
      ? left.priceSortValue - right.priceSortValue
      : text(field === "category" ? left.categoryLabel ?? left.category : left.name,
        field === "category" ? right.categoryLabel ?? right.category : right.name))
      || text(left.name, right.name));
}

export function mergeCatalogEntries(entries) {
  return [...new Map(entries.filter(Boolean).map((entry) => [entry.uuid, entry])).values()];
}

export function assessCatalogPurchase(funds, entry) {
  const currency = entry.system?.currency ?? entry.currency ?? "silver";
  const price = Math.max(0, Number(entry.system?.value ?? entry.value ?? 0));
  const denominations = ["copper", "silver", "gold"];
  const targetIndex = Math.max(0, denominations.indexOf(currency));
  const targetValue = CURRENCY_SORT_VALUE[currency] ?? CURRENCY_SORT_VALUE.silver;
  const round = (value) => Math.round((Number(value) + Number.EPSILON) * 1e8) / 1e8;
  const balances = Object.fromEntries(denominations.map((key) => [
    key, Math.max(0, Number(funds?.[key] ?? 0))
  ]));
  const originalBalances = { ...balances };
  const available = round(denominations.slice(targetIndex).reduce((total, key) => (
    total + balances[key] * CURRENCY_SORT_VALUE[key] / targetValue
  ), 0));
  let remainingPrice = price;
  const sameCurrency = Math.min(balances[currency], remainingPrice);
  balances[currency] = round(balances[currency] - sameCurrency);
  remainingPrice = round(remainingPrice - sameCurrency);
  let highestUsed = targetIndex;
  for (let index = targetIndex + 1; index < denominations.length && remainingPrice > 0;
    index += 1) {
    const key = denominations[index];
    const ratio = CURRENCY_SORT_VALUE[key] / targetValue;
    const required = Math.ceil(remainingPrice / ratio - 1e-8);
    const used = Math.min(balances[key], required);
    balances[key] = round(balances[key] - used);
    remainingPrice = round(remainingPrice - used * ratio);
    if (used > 0) highestUsed = index;
  }
  if (remainingPrice > 0) return { allowed: false, currency, price, available,
    remaining: originalBalances[currency], balances: originalBalances };
  let change = round(-remainingPrice * targetValue);
  for (let index = highestUsed - 1; index >= 0 && change > 0; index -= 1) {
    const key = denominations[index];
    const unit = CURRENCY_SORT_VALUE[key];
    const returned = index === 0 ? round(change / unit) : Math.floor(change / unit + 1e-8);
    balances[key] = round(balances[key] + returned);
    change = round(change - returned * unit);
  }
  return { allowed: true, currency, price, available,
    remaining: balances[currency], balances };
}
