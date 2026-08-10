import { MYTHRAS_REVISED_SOURCE } from "./sources.js";
import { WEAPON_TRAIT_SOURCES } from "./traits.js";
import { parseLegacyTraitText } from "../rules/traits.js";

const WEAPON_IMAGE_NAMES = Object.freeze({
  "bola-cadena": "bola_y_cadena",
  "hacha-batalla": "hacha_de_batalla",
  "lanza-caballeria": "lanza_de_caballeria",
  "alabarda-hacha-armas": "alabarda_hacha_de_armas",
  "cuerda-estrangular": "cuerda_de_estrangular",
  "honda-fuste": "honda_de_fuste"
});

export function weaponImage(category, key, fallback) {
  const filename = WEAPON_IMAGE_NAMES[key] ?? key.replaceAll("-", "_");
  return category
    ? `systems/mythras-foundry/assets/imagenes_256x256/${category}/${filename}.webp`
    : fallback;
}

const baseSystem = Object.freeze({
  quantity: 1, value: 0, equipped: false,
  source: MYTHRAS_REVISED_SOURCE, era: "", profileKey: "", activeModeKey: "",
  modes: [], maxHitPoints: 0, maxHitPointsFormula: "", currentHitPoints: 0,
  armorPoints: 0, armorPointsFormula: "", durabilitySource: "independent",
  linkedLocationId: "", encumbrance: 0,
  description: ""
});

const mode = ({ key, name = "", type = "melee", damage = "", damageModifier = "full",
  size = "", reach = "", effects = "", traits = "", hands = 1, range = "", reload = "",
  impalingSize = "", powerModifier = 0, crew = [0, 0] }) => ({
  key, name, profileKey: "", weaponType: type, damage, damageModifierMode: damageModifier,
  size, impalingSize, powerModifier, reach, effects, traits, traitRefs: [],
  grip: hands === 2 ? "2 manos" : hands === 1 ? "1 mano" : "",
  handsRequired: hands, range, reload, crewMinimum: crew[0], crewMaximum: crew[1],
  preferredCombatStyleId: "", familiarity: "similar"
});

const source = ({ key, name, ap, hp, enc = 0, cost = 0, era = "", traits = "",
  modes, img = "icons/svg/sword.svg", description = "",
  sourceName = MYTHRAS_REVISED_SOURCE, sourceFlag = "mythras-basic-revised" }) => {
  const active = modes[0];
  return {
    buildKey: key, name, type: "weapon", img,
    system: {
      ...baseSystem, profileKey: key, activeModeKey: active.key, modes,
      maxHitPoints: hp, currentHitPoints: hp, armorPoints: ap, encumbrance: enc,
      value: cost, era, source: sourceName, description
    },
    flags: { "mythras-foundry": { source: sourceFlag } }
  };
};

const melee = (key, name, damage, size, reach, effects, enc, ap, hp, era, cost,
  traits = "", hands = 1) => source({ key, name, ap, hp, enc, cost, era, traits,
  img: weaponImage(`armas/${hands === 2 ? "grandes" : "comunes"}`, key),
  modes: [mode({ key: hands === 2 ? "two-handed" : "melee", damage, size, reach,
    effects, traits, hands })] });

const shield = (key, name, damage, size, enc, ap, hp, era, cost, locations,
  effects = "Aturdir Localización, Golpetazo") => source({
  key, name, ap, hp, enc, cost, era, img: weaponImage("escudos", key),
  traits: `Parar Proyectiles, Bloqueo Pasivo ${locations} Localizaciones`,
  modes: [mode({ key: "shield", type: "shield", damage, size, reach: "C", effects,
    traits: `Parar Proyectiles, Bloqueo Pasivo ${locations} Localizaciones` })]
});

const ranged = (key, name, damage, damageModifier, power, range, reload, effects,
  impalingSize, enc, ap, hp, era, cost, traits = "") => source({
  key, name, ap, hp, enc, cost, era, traits, img: weaponImage("armas/proyectil", key),
  modes: [mode({ key: "ranged", type: "ranged", damage, damageModifier, size: power,
    range, reload, effects, impalingSize, traits,
    hands: new Set(["boleadoras", "dardo", "disco", "jabalina", "piedra-roca"]).has(key) ? 1 : 2 })]
});

export const ONE_HANDED_WEAPON_SOURCES = [
  melee("alfanje", "Alfanje", "1d6+2", "M", "M", "Desangrar", 1, 6, 10, "A-M", 200),
  melee("bola-cadena", "Bola y cadena", "1d6+1", "M", "M", "Aturdir Localización, Enredar, Golpetazo", 2, 6, 8, "M", 250, "Flexible"),
  melee("cadena", "Cadena", "1d4", "M", "M", "Enredar", 1, 8, 6, "A-E", 10, "Flexible"),
  melee("cimitarra", "Cimitarra", "1d8", "M", "M", "Desangrar", 2, 6, 10, "M-I", 200),
  melee("clava", "Clava", "1d6", "M", "C", "Aturdir Localización, Golpetazo", 1, 4, 4, "Todas", 5),
  melee("cuchillo", "Cuchillo", "1d3", "P", "C", "Desangrar, Empalar", 0, 5, 4, "Todas", 10),
  melee("daga", "Daga", "1d4+1", "P", "C", "Desangrar, Empalar", 0, 6, 8, "Todas", 30, "Arrojadiza"),
  melee("espada-ancha", "Espada ancha", "1d8", "M", "M", "Desangrar, Empalar", 2, 6, 10, "A-I", 175),
  melee("espada-corta", "Espada corta", "1d6", "M", "C", "Desangrar, Empalar", 1, 6, 8, "Todas", 100),
  melee("espada-larga", "Espada larga", "1d8", "M", "L", "Desangrar, Empalar", 2, 6, 12, "M-R", 250),
  melee("estoque", "Estoque", "1d8", "M", "L", "Empalar", 1, 5, 8, "I", 100),
  melee("hacha-batalla", "Hacha de batalla", "1d6+1", "M", "M", "Desangrar, Hender Armadura", 1, 4, 8, "A-R", 100),
  melee("hachuela", "Hachuela", "1d6", "P", "C", "Desangrar", 1, 4, 6, "Todas", 25, "Arrojadiza"),
  melee("lanza-corta", "Lanza corta", "1d8+1", "M", "L", "Empalar", 2, 4, 5, "Todas", 20, "Recibir Carga, Arrojadiza"),
  melee("lanza-caballeria", "Lanza de caballería", "1d10+2", "E", "ML", "Empalar, Hender Armadura", 3, 4, 10, "A-M", 150, "Montada"),
  melee("latigo", "Látigo", "1d3", "M", "ML", "Aturdir Localización, Enredar", 1, 2, 8, "A-M", 100, "Atrapadora, Flexible, Ofensiva"),
  melee("main-gauche", "Main gauche", "1d4", "P", "C", "Desangrar", 0, 6, 10, "M-I", 180, "Atrapadora"),
  melee("mayal", "Mayal", "1d6", "M", "M", "Golpetazo", 1, 3, 6, "A-M", 25, "Flexible"),
  melee("maza", "Maza", "1d8", "M", "C", "Aturdir Localización, Golpetazo", 1, 6, 6, "A-R", 100),
  melee("pico-militar", "Pico militar", "1d6+1", "M", "M", "Aturdir Localización, Hender Armadura", 3, 6, 10, "M-I", 180),
  melee("red", "Red", "1d4", "P", "L", "Enredar", 3, 2, 20, "Todas", 20, "Atrapadora, Arrojadiza"),
  melee("sable", "Sable", "1d6+1", "M", "M", "Desangrar, Empalar", 1, 6, 8, "I-E", 225),
  melee("tridente", "Tridente", "1d8", "M", "L", "Empalar", 2, 4, 10, "A-M", 155, "Arrojadiza, Barbada")
];

export const SHIELD_SOURCES = [
  shield("cometa", "Escudo cometa", "1d4", "E", 3, 4, 15, "M", 300, 4),
  shield("heraldo", "Escudo heraldo", "1d4", "G", 2, 6, 12, "M", 150, 3),
  shield("hoplon", "Escudo hoplón", "1d4", "E", 3, 6, 15, "A-M", 300, 4),
  shield("pelta", "Escudo pelta", "1d4", "G", 2, 4, 12, "A-M", 150, 3),
  shield("rodela", "Escudo rodela", "1d3", "M", 1, 6, 9, "M-I", 50, 2),
  shield("scutum-paves", "Escudo scutum/pavés", "1d4", "E", 4, 4, 18, "A-M", 450, 5),
  shield("tarja", "Escudo tarja", "1d3+1", "G", 2, 4, 9, "A-E", 150, 3, "Empalar, Golpetazo"),
  shield("vikingo", "Escudo vikingo", "1d4", "G", 3, 4, 12, "M", 300, 4)
];

export const TWO_HANDED_WEAPON_SOURCES = [
  melee("alabarda-hacha-armas", "Alabarda/Hacha de armas", "1d8+2", "G", "ML", "Empalar, Enredar, Hender Armadura", 4, 4, 10, "A-I", 200, "Recibir Carga", 2),
  melee("baston", "Bastón", "1d8", "M", "L", "Aturdir Localización", 2, 4, 8, "Todas", 20, "Defensiva", 2),
  melee("cuerda-estrangular", "Cuerda de estrangular", "1d2", "P", "T", "", 0, 1, 2, "A-E", 15, "Sigilo", 2),
  melee("espadon", "Espadón", "2d8", "E", "L", "Desangrar, Empalar, Hender Armadura", 4, 6, 12, "M-I", 300, "", 2),
  melee("gran-clava", "Gran clava", "2d6", "E", "L", "Aturdir Localización, Golpetazo", 3, 4, 10, "Todas", 50, "", 2),
  melee("gran-hacha", "Gran hacha", "2d6+2", "E", "L", "Desangrar, Hender Armadura", 2, 4, 10, "A-M", 125, "", 2),
  melee("gran-martillo", "Gran martillo", "1d10+3", "E", "L", "Aturdir Localización, Golpetazo, Hender Armadura", 3, 4, 10, "M-I", 250, "", 2),
  melee("guja-ronfea", "Guja/Ronfea", "1d10+2", "G", "L", "Desangrar, Hender Armadura", 2, 4, 10, "A-M", 250, "", 2),
  melee("lanza-larga", "Lanza larga", "1d10+1", "G", "ML", "Empalar", 2, 4, 10, "Todas", 30, "Recibir Carga", 2),
  melee("mayal-militar", "Mayal militar", "1d10", "G", "L", "Aturdir Localización, Golpetazo", 3, 4, 10, "A-M", 250, "Flexible", 2),
  melee("pica-sarisa", "Pica/Sarisa", "1d10+2", "G", "ML", "Empalar", 4, 4, 12, "A-M", 90, "Recibir Carga", 2),
  melee("xyston", "Xyston", "1d10", "G", "ML", "Empalar", 3, 4, 10, "A", 100, "Doble, Recibir Carga", 2)
];

export const SIEGE_WEAPON_SOURCES = [
  ["balista", "Balista", "4d6", "200/400", "5", [2, 4], "Empalar, Hender Armadura", 4, 25, "A-M", 1000],
  ["escorpion", "Escorpión", "3d6", "150/300", "4", [1, 1], "Empalar, Hender Armadura", 4, 15, "A-M", 750],
  ["fundibulo", "Fundíbulo", "7d6", "350/700", "8", [3, 6], "Aturdir Localización, Golpetazo", 4, 100, "M", 3000],
  ["mangonel", "Mangonel", "5d6", "250/500", "6", [2, 4], "Aturdir Localización, Golpetazo", 4, 50, "M", 1250],
  ["onagro", "Onagro", "6d6", "300/600", "7", [3, 6], "Aturdir Localización, Golpetazo", 4, 75, "A-M", 1500],
  ["trabuquete", "Trabuquete", "8d6", "400/800", "9", [4, 8], "Aturdir Localización, Golpetazo", 4, 150, "M", 5000]
].map(([key, name, damage, range, reload, crew, effects, ap, hp, era, cost]) => source({
  key, name, ap, hp, cost, era, img: weaponImage("armas_de_asedio", key),
  modes: [mode({ key: "siege", type: "siege", damage, damageModifier: "none",
    size: "MD", range, reload, crew, effects, hands: 0 })]
}));

export const RANGED_WEAPON_SOURCES = [
  ranged("arco-corto", "Arco corto", "1d6", "full", "G", "15/100/200", "2", "Empalar", "P", 1, 4, 4, "P-M", 75),
  ranged("arco-largo", "Arco largo", "1d8", "full", "E", "15/125/250", "2", "Empalar", "P", 1, 4, 7, "M", 200),
  ranged("arco-recurvado", "Arco recurvado", "1d8", "full", "E", "15/125/250", "2", "Empalar", "P", 1, 4, 8, "A-M", 225),
  source({ key: "atlatl", name: "Atlatl", ap: 1, hp: 4, enc: 1, cost: 10, era: "P", img: weaponImage("armas/proyectil", "atlatl"),
    modes: [mode({ key: "ranged", type: "ranged", powerModifier: 1, range: "+0/+25/+75", reload: "1" })] }),
  ranged("ballesta-ligera", "Ballesta ligera", "1d8", "none", "G", "20/100/200", "3", "Empalar", "P", 1, 4, 5, "M-I", 150),
  ranged("ballesta-pesada", "Ballesta pesada", "1d10", "none", "E", "20/150/300", "4", "Empalar, Hender Armadura", "P", 2, 4, 8, "M-I", 350),
  ranged("boleadoras", "Boleadoras", "1d4", "none", "", "10/25/30", "", "Enredar", "", 0, 2, 2, "P-A", 10),
  ranged("cerbatana", "Cerbatana", "", "none", "", "10/20/30", "2", "", "", 0, 1, 4, "P", 30),
  ranged("dardo", "Dardo", "1d4", "full", "P", "5/10/20", "", "Empalar", "P", 0, 2, 1, "P-A", 10),
  ranged("disco", "Disco", "1d4+1", "full", "G", "5/20/40", "", "Aturdir Localización", "", 0, 2, 3, "A", 30),
  ranged("honda", "Honda", "1d8", "none", "G", "10/150/300", "3", "Aturdir Localización", "", 0, 1, 2, "P-M", 5),
  ranged("honda-fuste", "Honda de fuste", "2d6", "none", "D", "5/25/50", "4", "Aturdir Localización", "", 2, 3, 6, "A-M", 20),
  ranged("jabalina", "Jabalina", "1d8+1", "full", "E", "10/20/50", "", "Empalar, Inmovilizar Arma (Escudo)", "M", 1, 3, 8, "A-M", 20),
  ranged("piedra-roca", "Piedra/Roca", "1d3", "full", "P", "5/10/20", "", "Aturdir Localización", "", 0, 0, 0, "Todas", 0)
];

const modeFor = (entry, overrides) => mode({
  key: "ranged", type: "ranged", hands: 1, ...overrides
});

const addMode = (sources, key, rangedMode) => {
  const entry = sources.find((candidate) => candidate.buildKey === key);
  entry.system.modes.push(rangedMode);
};

addMode(ONE_HANDED_WEAPON_SOURCES, "daga", modeFor(null, { damage: "1d4", size: "P", range: "5/10/20", effects: "Empalar", impalingSize: "P" }));
addMode(ONE_HANDED_WEAPON_SOURCES, "hachuela", modeFor(null, { damage: "1d6", size: "P", range: "10/20/30", effects: "Desangrar" }));
addMode(ONE_HANDED_WEAPON_SOURCES, "lanza-corta", modeFor(null, { damage: "1d8", size: "G", range: "10/15/30", effects: "Empalar", impalingSize: "M" }));
addMode(ONE_HANDED_WEAPON_SOURCES, "red", modeFor(null, { damage: "", damageModifier: "none", range: "3/5/10", effects: "Enredar" }));
addMode(ONE_HANDED_WEAPON_SOURCES, "tridente", modeFor(null, { damage: "1d8", size: "G", range: "10/15/30", effects: "Empalar", traits: "Barbada", impalingSize: "M" }));

const addTwoHandedMode = (key, damage, size, reach, effects, era) => {
  const entry = ONE_HANDED_WEAPON_SOURCES.find((candidate) => candidate.buildKey === key);
  entry.system.modes.push(mode({ key: "two-handed", name: "Dos manos", damage, size, reach,
    effects, hands: 2 }));
  if (era) entry.system.era = era;
};
addTwoHandedMode("espada-larga", "1d10", "G", "L", "Desangrar, Empalar, Hender Armadura", "M-I");
addTwoHandedMode("hacha-batalla", "1d8+1", "G", "M", "Desangrar, Hender Armadura", "A-M");

export const UNARMED_WEAPON_SOURCE = source({
  key: "puno-patada", name: "Puño/Patada", ap: 0, hp: 0, era: "Todas",
  description: "Daño de Pelea para humanos", sourceName: "Mythras Imperativo SRD",
  sourceFlag: "mythras-imperative-srd", img: "icons/svg/fist.svg",
  modes: [mode({ key: "unarmed", type: "melee", damage: "1d3", size: "P",
    reach: "T", hands: 0 })]
});

export const MELEE_WEAPON_SOURCES = Object.freeze([
  ...ONE_HANDED_WEAPON_SOURCES,
  ...TWO_HANDED_WEAPON_SOURCES,
  UNARMED_WEAPON_SOURCE
]);

function convertWeaponTraits(entry) {
  entry.system.modes = entry.system.modes.map((weaponMode) => {
    const converted = parseLegacyTraitText(weaponMode.traits, WEAPON_TRAIT_SOURCES);
    const { traits: _legacyTraits, ...structuredMode } = weaponMode;
    return { ...structuredMode, traitRefs: converted.references };
  });
  return entry;
}

export const WEAPON_SOURCES = Object.freeze([
  ...SHIELD_SOURCES,
  ...MELEE_WEAPON_SOURCES,
  ...SIEGE_WEAPON_SOURCES,
  ...RANGED_WEAPON_SOURCES
].map(convertWeaponTraits));
