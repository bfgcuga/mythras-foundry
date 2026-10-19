import { statusIcon } from "../data/status-icons.js";
// Presentation only: preserve status identifiers and all mechanical metadata.
export const CORE_STATUS_IDS = Object.freeze([
  "dead", "asleep", "stun", "restrain", "paralysis", "fly", "blind", "deaf",
  "silence", "fear", "cold", "shock", "corrode", "disease", "poison", "curse",
  "regen", "degen", "hover", "burrow", "empower", "weaken", "invisible",
  "target", "mark", "bless", "fireShield", "coldShield", "magicShield", "holyShield",
  "shieldFire", "shieldIce", "shieldMagic", "shieldFaith", "shieldHoly"
]);

export function prepareStatusCatalog(statuses, i18n) {
  const array = Array.isArray(statuses);
  const entries = array ? statuses.map((status) => [status.id, status])
    : Object.entries(statuses ?? {});
  const collator = new Intl.Collator(i18n.lang || "en", { sensitivity: "base", numeric: true });
  const prepared = entries.map(([id, status]) => {
    const coreId = CORE_STATUS_IDS.find((entry) => entry.toLowerCase() === id.toLowerCase());
    const key = `MYTHRASF.CoreStatus.${coreId}`;
    const name = status.name ?? status.label ?? id;
    const translated = coreId && !name.startsWith("MYTHRASF.")
      ? { ...status, name: key, ...(Object.hasOwn(status, "label") ? { label: key } : {}) }
      : status;
    return [id, { ...translated, img: statusIcon(id, translated.img),
      ...(Object.hasOwn(translated, "icon") ? { icon: statusIcon(id, translated.icon) } : {}) }];
  });
  prepared.sort(([idA, a], [idB, b]) =>
    collator.compare(i18n.localize(a.name ?? a.label ?? idA),
      i18n.localize(b.name ?? b.label ?? idB)) || collator.compare(idA, idB));
  return array ? prepared.map(([, status]) => status) : Object.fromEntries(prepared);
}
