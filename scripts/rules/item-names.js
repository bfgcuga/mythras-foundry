function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function nextNumberedItemName(type, documents, localize = (key) => key) {
  const base = localize(`TYPES.Item.${type}`);
  const pattern = new RegExp(`^${escapeRegExp(base)}(?: (\\d+))?$`, "i");
  const used = new Set((documents ?? []).filter((document) => document.type === type)
    .map((document) => String(document.name ?? "").match(pattern))
    .filter(Boolean)
    .map((match) => Number(match[1] ?? 1)));
  let number = 1;
  while (used.has(number)) number += 1;
  return `${base} ${number}`;
}

export function isGenericItemName(name, type, localize = (key) => key) {
  const normalized = String(name ?? "").trim().toLocaleLowerCase();
  const generic = [
    "", "item", "new item",
    localize("DOCUMENT.Item"),
    localize(`MYTHRASF.Item.New.${type}`)
  ].map((value) => String(value ?? "").trim().toLocaleLowerCase());
  return generic.includes(normalized);
}
