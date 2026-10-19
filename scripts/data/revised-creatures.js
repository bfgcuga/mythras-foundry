import { REVISED_CREATURE_PROFILES } from "./revised-creature-profiles.js";
import { creature, npcSystem, location, skill, style, weapon, passion } from "./creature-helpers.js";
import { CREATURE_TRAIT_SOURCES } from "./traits.js";
import { ALL_SKILL_SOURCES } from "./skills.js";
import { MYTHRAS_REVISED_SOURCE } from "./sources.js";
import { identifyMorphology, MORPHOLOGIES } from "../rules/morphologies.js";
import { calculateDerivedAttributes } from "../rules/derived-attributes.js";
import { calculateLocationHitPoints } from "../rules/hit-locations.js";
import { REVISED_CREATURE_NOTES } from "./revised-creature-notes.js";

const normalize = (text) => String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().trim();
const slug = (text) => normalize(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const html = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const paragraph = (text) => `<p>${html(text)}</p>`;
const characteristicKeys = { FUE: "strength", CON: "constitution", TAM: "size", DES: "dexterity",
  INT: "intelligence", INS: "intelligence", POD: "power", CAR: "charisma" };
const legacyLocationKeys = {
  "lizard-man": ["tail", "right-leg", "left-leg", "abdomen", "chest", "right-arm", "left-arm", "head"],
  "giant-ant": ["rear-right", "rear-left", "middle-right", "middle-left", "abdomen", "thorax", "front-right", "front-left", "head"],
  manticore: ["tail", "rear-right", "rear-left", "hindquarters", "forequarters", "front-right", "front-left", "head"],
  bear: ["rear-right", "rear-left", "hindquarters", "forequarters", "front-right", "front-left", "head"]
};
const legacyWeaponKeys = {
  "lizard-man": { Mordisco: "bite", Garras: "claw", Coletazo: "tail", "Lanza corta": "short-spear",
    "Hacha de piedra": "stone-axe", "Escudo tarja": "buckler" },
  "giant-ant": { Mandíbulas: "bite", Aguijón: "sting" },
  manticore: { Mordisco: "jaws", Garras: "claws", Aguijón: "sting", "Púas arrojadizas": "spikes" },
  bear: { Mordisco: "bite", Garra: "claw" }
};
const legacyStyleKeys = { "lizard-man": "lizard-warrior", "giant-ant": "formicid-attack",
  manticore: "man-hunter", bear: "ursine-fury" };

// These aliases describe the same anatomical zone; they do not change hit ranges.
const anatomicalName = (name) => normalize(name).replace("pata central", "pata media")
  .replace("pata frontal", "pata delantera")
  .replace(/^pata derecha$/, "pierna derecha").replace(/^pata izquierda$/, "pierna izquierda");

function profileLocations(profile) {
  const locations = profile.locations.map(([start, end, name, ap, hp], index) => {
    const category = /cabeza/i.test(name) ? "head" : /pecho|tórax|cuartos delanteros/i.test(name)
      ? "chest" : /abdomen|cuartos traseros/i.test(name) ? "abdomen"
        : /pata|pierna|brazo|ala|pinza|tentáculo|trompa/i.test(name) ? "limb" : "other";
    const hpClass = category === "chest" || category === "abdomen" ? category
      : /brazo|ala|pinza|tentáculo|trompa/i.test(name) ? "arm" : "standard";
    const item = location(legacyLocationKeys[profile.key]?.[index] ?? slug(name), name, start, end, ap, hp, category, hpClass);
    // Semantic keys are assigned only when the table, range and zone all agree.
    const matches = Object.values(MORPHOLOGIES).flat().filter((zone) =>
      anatomicalName(zone.name) === anatomicalName(name)
      && zone.rangeStart === start && zone.rangeEnd === end);
    const keys = [...new Set(matches.map((zone) => zone.locationKey))];
    if (keys.length === 1) item.system.locationKey = keys[0];
    return item;
  });
  return { locations, morphologyKey: identifyMorphology(locations) };
}

const traitAliases = {
  apresar: "apresar", aterrador: "aterrador", intimidar: "intimidate",
  "aliento de llamas": "aliento-de-llamas", "armas naturales formidables": "formidable-natural-weapons",
  "inmunidad a las enfermedades": "inmunidad-a-las-enfermedades",
  "inmunidad al veneno": "inmunidad-al-veneno", voladora: "volador"
};

function creatureTraits(profile) {
  // Split outside parentheses so parameters, alternatives and conditions survive.
  const names = profile.traits.match(/(?:[^,(]|\([^)]*\))+/g) ?? [];
  return names.filter((name) => normalize(name) !== "ninguno").flatMap((name) => {
    const alternatives = name.trim().replace(/\.$/, "").split(/\s+o\s+(?=Camuflaje)/);
    return alternatives.map((alternative) => {
      const base = normalize(alternative.replace(/\(.*\)/g, "").trim());
      const key = traitAliases[base];
      const source = CREATURE_TRAIT_SOURCES.find((trait) => trait.buildKey === key
        || normalize(trait.name) === base
        || (base === "inmunidad" && /venenos/i.test(alternative)
          && trait.buildKey === "inmunidad-al-veneno"));
      if (!source) throw new Error(`${profile.name}: rasgo desconocido ${alternative}`);
      const detail = alternatives.length > 1 ? `Alternativa del perfil: ${name.trim()}.` : alternative.trim();
      return { ...source, system: { ...source.system,
        source: `${MYTHRAS_REVISED_SOURCE}, pág. ${profile.page}`,
        description: paragraph(detail) + paragraph(source.system.description) } };
    });
  });
}

function creatureSkill(name, value) {
  const base = ALL_SKILL_SOURCES.find((source) => normalize(source.name) === normalize(name))
    ?? ALL_SKILL_SOURCES.find((source) => normalize(source.name).split(" (")[0] === normalize(name).split(" (")[0]);
  const result = skill(slug(name), name, value, base?.system.group ?? "professional");
  if (base) result.system = { ...base.system, ...result.system,
    characteristic1: base.system.characteristic1, characteristic2: base.system.characteristic2,
    category: base.system.category, group: base.system.group };
  if (name === "Volar") Object.assign(result.system, { characteristic1: "dexterity", characteristic2: "strength" });
  if (name === "Chillido Paralizante") Object.assign(result.system,
    { characteristic1: "intelligence", characteristic2: "charisma" });
  return result;
}

function linkedLocation(reference, locations) {
  if (!/^Como /i.test(reference)) return "";
  const name = normalize(reference.replace(/^Como /i, ""));
  const exact = locations.find((item) => normalize(item.name) === name);
  if (exact) return exact.buildKey;
  const aliases = { cabeza: /cabeza|cefalotórax/i, pata: /pata delantera derecha|pierna derecha|pata derecha/i,
    patas: /pata delantera derecha|pierna derecha|pata derecha/i, brazo: /brazo derecho/i,
    pierna: /pierna derecha/i, ala: /ala derecha/i, pinza: /pinza derecha/i,
    antebrazo: /antebrazo derecho/i, tentaculo: /tentáculo 1/i,
    seccion: /sección media central/i, cola: /cola/i };
  const match = aliases[name];
  const result = match && locations.find((item) => match.test(item.name));
  if (!result) throw new Error(`Localización de arma sin resolver: ${reference}`);
  return result.buildKey;
}

function creatureWeapon(row, profile, locations) {
  const [name, size, reach, printedDamage, durability] = row;
  const key = legacyWeaponKeys[profile.key]?.[name] ?? slug(name);
  const effects = [printedDamage.match(/Veneno|Enfermedad|Presa|Fuego|Especial.*$/i)?.[0],
    durability.match(/\(([^)]+)\)/)?.[1]].filter(Boolean).join(", ");
  let damage = printedDamage.replace(/\s/g, "").replace(/\+?(Veneno|Enfermedad).*$/i, "");
  if (!/^[\ddD+\-*/()]+$/.test(damage)) damage = "0";
  // The printed damage already includes MD. Strip it only when explicitly present.
  const modifier = profile.damageModifier.replace(/^\+/, "");
  const suffix = profile.damageModifier.startsWith("-") ? profile.damageModifier : `+${modifier}`;
  const includesModifier = modifier !== "0" && damage.endsWith(suffix);
  if (includesModifier) damage = damage.slice(0, -suffix.length) || "0";
  const ranged = /\d+\/\d+\/\d+/.test(reach) || /arroj|honda|aliento|mirada/i.test(name);
  const shield = /^Escudo /i.test(name);
  const linkedLocationKey = linkedLocation(durability, locations);
  const [ap, hp] = /^\d+\/(\d+|-)/.test(durability) ? durability.split("/").map(Number) : [0, 0];
  const handsRequired = linkedLocationKey || /aliento|mirada|arrollar/i.test(name) ? 0
    : /arco|ballesta|gran |larga|mazo troll|rama|ciclópea|forja/i.test(name) ? 2 : 1;
  const result = weapon(key, name, { damage, size, reach: ranged ? "" : reach,
    damageModifierMode: includesModifier ? "full" : "none", linkedLocationKey,
    ap: ap || 0, hp: hp || 0, effects, weaponType: shield ? "shield" : ranged ? "ranged" : "melee",
    handsRequired, range: ranged ? reach : "" });
  const range = reach.match(/^(\d+)\/(\d+)\/(\d+)$/);
  if (range) Object.assign(result.system.modes[0], { rangeShort: Number(range[1]),
    rangeEffective: Number(range[2]), rangeLong: Number(range[3]) });
  result.system.description = paragraph(`Perfil del bestiario: daño ${printedDamage}; PA/PG ${durability || "no indicados"}.`);
  return result;
}

function weaponKeysForStyle(profile, index, weapons) {
  if (profile.key === "acefalo") return weapons.filter((item) => index === 0
    ? /arco|boleadoras|honda/.test(item.buildKey) : /escudo|lanza/.test(item.buildKey)).map((item) => item.buildKey);
  if (profile.key === "dragon") return weapons.filter((item) => index === 0
    ? !/aliento/.test(item.buildKey) : /aliento/.test(item.buildKey)).map((item) => item.buildKey);
  if (profile.key === "gigante") return weapons.filter((item) => index === 0
    ? item.buildKey === "rama-de-arbol" : item.buildKey !== "rama-de-arbol").map((item) => item.buildKey);
  return weapons.map((item) => item.buildKey);
}

function revisedCreature(profile) {
  const { locations, morphologyKey } = profileLocations(profile);
  const values = Object.fromEntries(Object.entries(profile.characteristics).map(([key, entry]) =>
    [characteristicKeys[key], entry.value]));
  const formulas = Object.fromEntries(Object.entries(profile.characteristics).map(([key, entry]) =>
    [characteristicKeys[key], entry.formula]));
  const source = `${MYTHRAS_REVISED_SOURCE}, pág. ${profile.page}`;
  const system = npcSystem({ species: profile.name, values, formulas, morphologyKey,
    instinct: Boolean(profile.characteristics.INS), actionPoints: profile.actionPoints,
    magicPoints: profile.magicPoints, movement: Number.parseInt(profile.movement, 10),
    damageModifier: profile.damageModifier, armorNotes: profile.armor,
    magicNotes: paragraph(profile.magic), description: paragraph(`Fuente: ${source}.`)
      + paragraph(`Movimiento: ${profile.movement}. Rasgos: ${profile.traits}.`)
      + (REVISED_CREATURE_NOTES[profile.key] ?? []).map(paragraph).join("")
      + (profile.stylesText && !profile.styles.length ? paragraph(profile.stylesText) : "") });
  system.attributeOverrides.initiative = { mode: "manual", value: profile.initiative, formula: "" };
  const weapons = profile.weapons.map((row) => creatureWeapon(row, profile, locations));
  const styles = profile.styles.map(([text, value], index) => style(legacyStyleKeys[profile.key] ?? `style-${index + 1}`,
    text.replace(/\s*\(.*\)/, ""), value, weaponKeysForStyle(profile, index, weapons)));
  // These two stat blocks explicitly use Brawl for their natural weapons.
  if (["vampiro", "zombi"].includes(profile.key)) styles.push(style("unarmed", "Combate desarmado",
    profile.skills.find(([name]) => name === "Pelea")[1], weapons.map((item) => item.buildKey)));
  const result = creature(profile.key, profile.name, system, [
    ...creatureTraits(profile), ...profile.skills.map(([name, value]) => creatureSkill(name, value)),
    ...styles, ...weapons, ...locations,
    ...profile.passions.map(([name, value]) => passion(slug(name), name, value))
  ], "icons/svg/mystery-man.svg", { "mythras-foundry": {
    source: "mythras-basic-revised", sourcePage: profile.page } });
  return result;
}

function ophidian(lizard) {
  const result = structuredClone(lizard);
  result.buildKey = "ofidio";
  result.name = result.system.identity.species = result.prototypeToken.name = "Ofidio";
  result.flags = { "mythras-foundry": { source: "mythras-basic-revised", sourcePage: 262 } };
  const system = result.system;
  for (const [left, right] of [["strength", "power"], ["size", "intelligence"]]) {
    [system[left], system[right]] = [system[right], system[left]];
    [system.characteristicFormulas[left], system.characteristicFormulas[right]] =
      [system.characteristicFormulas[right], system.characteristicFormulas[left]];
  }
  const attributes = calculateDerivedAttributes(system);
  system.attributeOverrides.initiative.value = attributes.initiative;
  system.attributeOverrides.magicPoints.value = attributes.magicPointsMax;
  system.attributeOverrides.damageModifier.formula = "0";
  system.resources.magicPoints.value = attributes.magicPointsMax;
  system.resources.actionPoints.value = system.attributeOverrides.actionPoints.value;
  system.magicNotes = paragraph("Casi todos conocen Magia Común; sus especialistas estudian Hechicería o Misticismo.");
  system.description = paragraph(`${MYTHRAS_REVISED_SOURCE}, págs. 262-263. Variante ofidia: intercambia FUE/POD y TAM/INT del hombre lagarto y tiene dos PA naturales menos.`)
    + (REVISED_CREATURE_NOTES.ofidio ?? []).map(paragraph).join("");
  for (const item of result.items) {
    item.flags = result.flags;
    if (item.type === "trait") item.system.source = `${MYTHRAS_REVISED_SOURCE}, pág. 262`;
    if (item.type === "combatStyle") item.name = "Guerrero ofidio";
    if (item.type === "weapon") item.system.description = paragraph(
      "Perfil adaptado del hombre lagarto; el modificador de daño se ajusta a las características del ofidio.");
    if (item.type === "hitLocation") {
      item.system.armorPoints = item.system.maxArmorPoints = Math.max(0, item.system.armorPoints - 2);
      item.system.maxHitPoints = item.system.currentHitPoints = calculateLocationHitPoints(
        system.constitution, system.size, item.system.hpClass);
    }
    if (item.type === "skill" && item.name.startsWith("Artesanía")) {
      item.buildKey = item.system.slug = "saber-ofidio";
      item.name = "Saber (Cualquiera apropiado)";
      item.system.characteristic1 = item.system.characteristic2 = "intelligence";
    }
    if (item.type === "weapon" && item.name === "Mordisco") item.system.modes[0].effects = "Veneno";
  }
  const venom = creatureTraits({ traits: "Venenoso", page: 262, name: "Ofidio" })[0];
  venom.flags = result.flags;
  venom.system.description += (REVISED_CREATURE_NOTES.ofidio ?? []).map(paragraph).join("");
  result.items.push(venom);
  return result;
}

const sources = REVISED_CREATURE_PROFILES.map(revisedCreature);
export const REVISED_CREATURE_SOURCES = Object.freeze([
  ...sources, ophidian(sources.find((source) => source.buildKey === "lizard-man"))
]);
