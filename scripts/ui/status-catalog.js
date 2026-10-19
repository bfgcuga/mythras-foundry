import { STATUS_ALIASES } from "../data/status-aliases.js";
import { statusIcon } from "../data/status-icons.js";
// Presentation only: preserve status identifiers and all mechanical metadata.
export const CORE_STATUS_IDS = Object.freeze([
  "dead", "asleep", "stun", "restrain", "paralysis", "fly", "blind", "deaf",
  "silence", "fear", "cold", "shock", "corrode", "disease", "poison", "curse",
  "regen", "degen", "hover", "burrow", "empower", "weaken", "invisible",
  "target", "mark", "bless", "fireShield", "coldShield", "magicShield", "holyShield",
  "shieldFire", "shieldIce", "shieldMagic", "shieldFaith", "shieldHoly"
]);

// Some Foundry releases use different IDs from their visible status labels.
const CORE_STATUS_NAMES = Object.freeze({
  death: "dead", asleep: "asleep", sleep: "asleep", stunned: "stun", restrained: "restrain",
  paralyzed: "paralysis", flying: "fly", blinded: "blind", silenced: "silence",
  frightened: "fear", frozen: "cold", shocked: "shock", corroding: "corrode",
  diseased: "disease", poisoned: "poison", cursed: "curse", regenerating: "regen",
  degenerating: "degen", hovering: "hover", burrowing: "burrow", empowered: "empower",
  upgrade: "empower", weakened: "weaken", downgrade: "weaken", invisibility: "invisible",
  targeted: "target", marked: "mark", blessed: "bless", iceshield: "coldShield"
});

function coreStatusId(id, name) {
  const normalize = (value) => String(value).replace(/^EFFECT\.Status/i, "").replace(/[^a-z]/gi, "").toLowerCase();
  for (const value of [id, name]) {
    const normalized = normalize(value);
    const known = CORE_STATUS_IDS.find((entry) => entry.toLowerCase() === normalized);
    if (known) return known;
    if (CORE_STATUS_NAMES[normalized]) return CORE_STATUS_NAMES[normalized];
  }
  return null;
}

export function prepareStatusCatalog(statuses, i18n) {
  const array = Array.isArray(statuses);
  const entries = array ? statuses.map((status) => [status.id, status])
    : Object.entries(statuses ?? {});
  const collator = new Intl.Collator(i18n.lang || "en", { sensitivity: "base", numeric: true });
  const prepared = entries.filter(([id]) => !Object.hasOwn(STATUS_ALIASES, id)).map(([id, status]) => {
    const coreId = coreStatusId(id, status.name ?? status.label);
    const key = `MYTHRASF.CoreStatus.${coreId}`;
    const name = status.name ?? status.label ?? id;
    const translated = coreId && !name.startsWith("MYTHRASF.")
      ? { ...status, name: key, ...(Object.hasOwn(status, "label") ? { label: key } : {}) }
      : status;
    return [id, { ...translated, img: statusIcon(id, statusIcon(coreId, translated.img)),
      ...(Object.hasOwn(translated, "icon") ? { icon: statusIcon(id, statusIcon(coreId, translated.icon)) } : {}) }];
  });
  prepared.sort(([idA, a], [idB, b]) =>
    collator.compare(i18n.localize(a.name ?? a.label ?? idA),
      i18n.localize(b.name ?? b.label ?? idB)) || collator.compare(idA, idB));
  return array ? prepared.map(([, status]) => status) : Object.fromEntries(prepared);
}
