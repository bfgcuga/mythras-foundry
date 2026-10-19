// Shared by the token catalog, assignment tools and ActiveEffect creation.
const STATUS_ICON_FILES = Object.freeze({
  "braced": "braced",
  "fear": "fear",
  "crouchedBehindShield": "crouchedBehindShield",
  "stunned": "stunned",
  "grabbed": "grabbed",
  "bless": "bless",
  "dying": "dying",
  "blind": "blind",
  "drowning": "drowning",
  "cold": "cold",
  "burning": "burning",
  "corrode": "corrode",
  "weaponPinned": "weaponPinned",
  "weaken": "weaken",
  "suffocating": "suffocating",
  "degen": "degen",
  "asleep": "asleep",
  "blinded": "blinded",
  "shock": "shock",
  "prone": "prone",
  "disease": "disease",
  "exsanguinating": "exsanguinating",
  "poison": "poison",
  "offBalance": "offBalance",
  "shieldFire": "shieldFire",
  "impaled": "impaled",
  "shieldIce": "shieldIce",
  "entangled": "entangled",
  "shieldMagic": "shieldMagic",
  "waiting": "waiting",
  "shieldHoly": "shieldHoly",
  "incapacitated": "incapacitated",
  "burrow": "burrow",
  "unconscious": "unconscious",
  "invisible": "invisible",
  "acidImmersion": "acidImmersion",
  "hover": "hover",
  "stunnedLocation": "stunnedLocation",
  "curse": "curse",
  "pressed": "pressed",
  "mark": "mark",
  "maneuverProtected": "maneuverProtected",
  "dead": "dead",
  "acidSplash": "acidSplash",
  "paralysis": "paralysis",
  "bleeding": "bleeding",
  "empower": "empower",
  "regen": "regen",
  "restrain": "restrain",
  "surprised": "surprised",
  "surprisedOffensive": "surprisedOffensive",
  "target": "target",
  "suppressed": "suppressed",
  "silenced": "silenced",
  "stunnedTorso": "stunnedTorso",
  "deaf": "deaf",
  "fly": "fly",
  "stun": "stunned",
  "silence": "silenced",
  "fireShield": "shieldFire",
  "coldShield": "shieldIce",
  "magicShield": "shieldMagic",
  "holyShield": "shieldHoly",
  "shieldFaith": "shieldHoly"
});

export function statusIcon(statusId, fallback = null) {
  const id = String(statusId ?? "").toLowerCase();
  const key = Object.keys(STATUS_ICON_FILES).find((entry) => entry.toLowerCase() === id);
  return key ? `systems/mythras-foundry/assets/icons/statuses/${STATUS_ICON_FILES[key]}.png` : fallback;
}

export function effectStatusIcon(effect) {
  for (const id of effect.statuses ?? []) {
    const img = statusIcon(id);
    if (img) return img;
  }
  return null;
}

export function statusIconUpdates(effects = []) {
  return Array.from(effects).flatMap((effect) => {
    const img = effectStatusIcon(effect);
    const legacy = !effect.img || effect.img.startsWith("icons/svg/")
      || effect.img === "systems/mythras-foundry/assets/icons/suffocation.svg";
    return img && legacy && effect.img !== img ? [{ _id: effect.id, img }] : [];
  });
}
