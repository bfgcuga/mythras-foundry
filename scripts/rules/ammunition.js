import { inventoryCarried } from "./inventory.js";
import { weaponModes } from "./weapon-modes.js";

export const AMMUNITION_TYPES = Object.freeze(["arrow", "bolt", "sling", "blowgun", "dart", "siege"]);
export const AMMUNITION_PACKS = Object.freeze({
  "flechas-fajo-de-doce": { ammoType: "arrow", packageSize: 12, unitName: "Flechas" },
  "virotes-fajo-de-doce": { ammoType: "bolt", packageSize: 12, unitName: "Virotes" },
  "balas-de-plomo-para-honda-bolsa-de-veinte": { ammoType: "sling", packageSize: 20, unitName: "Balas de plomo para honda" },
  "dardos-de-cerbatana-media-docena": { ammoType: "blowgun", packageSize: 6, unitName: "Dardos de cerbatana" },
  "dardos-arrojadizos-fajo-de-doce": { ammoType: "dart", packageSize: 12, unitName: "Dardo", thrownProfile: "dardo" }
});
export const PROJECTILE_PROFILES = Object.freeze({
  "arco-corto": "arrow", "arco-largo": "arrow", "arco-recurvado": "arrow",
  "arco-compuesto": "arrow", "arco-largo-compuesto": "arrow",
  "ballesta-ligera": "bolt", "ballesta-pesada": "bolt",
  atlatl: "atlatl-dart", cerbatana: "blowgun", honda: "sling", "honda-fuste": "sling",
  balista: "siege", escorpion: "siege", fundibulo: "siege", mangonel: "siege", onagro: "siege", trabuquete: "siege"
});
export const THROWN_PROFILES = Object.freeze(["boleadoras", "dardo", "disco", "jabalina", "piedra-roca", "daga", "hachuela", "lanza-corta", "red", "tridente"]);
export const count = value => Math.max(0, Math.trunc(Number(value) || 0));
export function modeAmmunition(weapon, mode) {
  const key = mode.profileKey || weapon?.system?.profileKey || "";
  const use = mode.ammoUse || (THROWN_PROFILES.includes(key) && mode.weaponType === "ranged" ? "thrown"
    : ["ranged", "siege"].includes(mode.weaponType) && PROJECTILE_PROFILES[key] ? "projectile" : "none");
  return { use, type: mode.ammoType || PROJECTILE_PROFILES[key] || "" };
}
export function ammunitionStock(actor, itemId) {
  const item = actor?.items?.get?.(itemId) ?? Array.from(actor?.items ?? []).find(item => item.id === itemId);
  const items = Array.from(actor?.items ?? []);
  const total = count(item?.system?.quantity);
  const allocations = items.filter(item => item.type === "weapon").flatMap(weapon => weaponModes(weapon)
    .filter(mode => mode.ammoItemId === itemId && count(mode.ammoLoaded) > 0)
    .map(mode => ({ weaponId: weapon.id, modeKey: mode.key, loaded: count(mode.ammoLoaded) })));
  const loaded = allocations.reduce((sum, entry) => sum + entry.loaded, 0);
  return { item, total, loaded, available: Math.max(0, total - loaded), allocations,
    carried: Boolean(item && inventoryCarried(item, items)) };
}
export function ammunitionChoices(actor, weapon, mode) {
  const { type } = modeAmmunition(weapon, mode);
  if (!type) return [];
  return Array.from(actor?.items ?? []).filter(item => item.type === "equipment"
    && item.system.category === "ammunition" && item.system.ammoType === type)
    .map(item => ammunitionStock(actor, item.id)).filter(stock => stock.carried);
}
export function ammunitionProblem(actor, weapon, mode, { firing = true } = {}) {
  const { use, type } = modeAmmunition(weapon, mode);
  if (weapon?.system?.thrown) return "Thrown";
  if (use !== "projectile") return null;
  const stock = ammunitionStock(actor, mode.ammoItemId);
  if (!type || !stock.item || stock.item.type !== "equipment" || stock.item.system.category !== "ammunition"
    || stock.item.system.ammoType !== type || !stock.carried
    || !inventoryCarried(weapon, Array.from(actor?.items ?? []))) return "SelectAmmunition";
  if (stock.loaded > stock.total || count(mode.ammoLoaded) > Math.max(1, count(mode.ammoCapacity))) return "InvalidLoad";
  if (firing && !count(mode.ammoLoaded)) return "NotLoaded";
  if (firing && stock.total < 1) return "NoReserve";
  return null;
}
export function ammunitionView(actor, weapon, mode) {
  const { use } = modeAmmunition(weapon, mode);
  if (use !== "projectile") return { use, tracking: false };
  const stock = ammunitionStock(actor, mode.ammoItemId);
  return { use, tracking: true, itemId: mode.ammoItemId, name: stock.item?.name ?? "",
    total: stock.total, loaded: count(mode.ammoLoaded), allocated: stock.loaded, available: stock.available,
    capacity: Math.max(1, count(mode.ammoCapacity)), progress: count(mode.reloadProgress),
    actions: Math.max(1, count(mode.reloadActions)),
    completedActions: count(mode.reloadProgress) || (count(mode.ammoLoaded) > 0 ? Math.max(1, count(mode.reloadActions)) : 0),
    problem: ammunitionProblem(actor, weapon, mode) };
}
