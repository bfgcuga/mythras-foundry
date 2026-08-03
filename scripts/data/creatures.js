import { getTraitSource } from "./traits.js";

const sourceFlags = { "mythras-foundry": { source: "mythras-imperative-srd" } };

const characteristicKeys = ["strength", "constitution", "size", "dexterity",
  "intelligence", "power", "charisma"];

function npcSystem({ values, formulas, species, instinct = false, actionPoints = 2,
  movement = 6, magicPoints = null, damageModifier = "", description = "",
  magicNotes = "Ninguna", armorNotes = "" }) {
  const system = Object.fromEntries(characteristicKeys.map((key) => [key, values[key] ?? 1]));
  system.characteristicFormulas = Object.fromEntries(
    characteristicKeys.map((key) => [key, formulas[key] ?? ""]));
  system.identity = { species };
  system.intelligenceKind = instinct ? "instinct" : "intelligence";
  system.description = description;
  system.magicNotes = magicNotes;
  system.armorNotes = armorNotes;
  system.fatigueLevel = "fresh";
  system.attributeOverrides = {
    actionPoints: { mode: "manual", value: actionPoints, formula: "" },
    initiative: { mode: "auto", value: 0, formula: "" },
    movementRate: { mode: "manual", value: movement, formula: "" },
    magicPoints: magicPoints === null
      ? { mode: "auto", value: 0, formula: "" }
      : { mode: "manual", value: magicPoints, formula: "" },
    luckPoints: { mode: "manual", value: 0, formula: "" },
    damageModifier: damageModifier
      ? { mode: "manual", formula: damageModifier }
      : { mode: "auto", formula: "" }
  };
  system.resources = {
    actionPoints: { value: actionPoints },
    luckPoints: { value: 0 },
    magicPoints: { value: magicPoints ?? values.power ?? 0 }
  };
  system.generatedInstance = false;
  return system;
}

function location(buildKey, name, rangeStart, rangeEnd, armorPoints, maxHitPoints,
  category = "other", hpClass = "standard") {
  return { buildKey, name, type: "hitLocation", img: "icons/svg/blood.svg", system: {
    rangeStart, rangeEnd, category, hpClass, autoCalculate: false,
    maxHitPoints, maxHitPointsFormula: "", currentHitPoints: maxHitPoints,
    armorPoints, armorPointsFormula: "", armorEncumbranceMultiplier: 1,
    armorCostPercentage: 10, armorFactorsVersion: 2, disabled: false, description: ""
  }, flags: sourceFlags };
}

function skill(buildKey, name, value, group = "professional") {
  return { buildKey, name, type: "skill", img: "icons/svg/book.svg", system: {
    slug: buildKey, category: group === "basic" ? "basic" : "professional", group,
    characteristic1: "strength", characteristic2: "dexterity", baseBonus: 0,
    culturePoints: 0, professionPoints: 0, freePoints: 0, experiencePoints: 0,
    trained: true, fumbled: false, valueMode: "manual", manualValue: value,
    generationFormula: "", description: ""
  }, flags: sourceFlags };
}

function style(buildKey, name, value, weaponKeys, traits = "") {
  return { buildKey, name, type: "combatStyle", img: "systems/mythras-foundry/assets/icons/combat-style.svg",
    system: { slug: buildKey, category: "professional", group: "combat",
      characteristic1: "strength", characteristic2: "dexterity", baseBonus: 0,
      culturePoints: 0, professionPoints: 0, freePoints: 0, experiencePoints: 0,
      trained: true, fumbled: false, valueMode: "manual", manualValue: value,
      generationFormula: "", weapons: weaponKeys.join(", "),
      weaponProfiles: weaponKeys.map((key) => ({ key, name: key })), traits,
      sourceType: "creature", description: "" }, flags: sourceFlags };
}

function weapon(buildKey, name, { damage, size = "M", reach = "M", linkedLocationKey = "",
  ap = 0, hp = 0, effects = "", weaponType = "melee", damageModifierMode = "full",
  handsRequired = 0, range = "" }) {
  const modeKey = weaponType === "ranged" ? "ranged" : "melee";
  return { buildKey, linkedLocationKey, name, type: "weapon", img: "icons/svg/sword.svg", system: {
    quantity: 1, quantityFormula: "", weight: 0, value: 0, location: "", equipped: true,
    profileKey: buildKey, activeModeKey: modeKey, weaponType, damage, damageModifierMode,
    size, reach, maxHitPoints: hp, maxHitPointsFormula: "", currentHitPoints: hp,
    armorPoints: ap, armorPointsFormula: "", durabilitySource: linkedLocationKey
      ? "hitLocation" : "independent", linkedLocationId: "", encumbrance: 0, effects,
    grip: handsRequired === 2 ? "2 manos" : handsRequired === 1 ? "1 mano" : "Natural",
    handsRequired, range, reload: "", preferredCombatStyleId: "", familiarity: "similar",
    description: "", modes: [{ key: modeKey, name: "", profileKey: buildKey, weaponType,
      damage, damageModifierMode, size, reach, effects, grip: handsRequired ? `${handsRequired} mano${handsRequired > 1 ? "s" : ""}` : "Natural",
      handsRequired, range, reload: "", preferredCombatStyleId: "", familiarity: "similar" }]
  }, flags: sourceFlags };
}

function traitItem(key, description = "") {
  const source = getTraitSource(key);
  return { ...source, system: { ...source.system,
    ...(description ? { description } : {}) }, flags: sourceFlags };
}

function passion(buildKey, name, value) {
  return { buildKey, name, type: "passion", img: "systems/mythras-foundry/assets/icons/passion.svg",
    system: { structured: false, value, generationFormula: "", verb: "other", customVerb: "",
      objectType: "other", objectDescription: "", creationBonus: 0, experiencePoints: 0,
      manualAdjustment: 0, description: "" }, flags: sourceFlags };
}

function creature(buildKey, name, system, items, img = "icons/svg/mystery-man.svg") {
  return { buildKey, name, type: "npc", img, system, items, prototypeToken: {
    actorLink: false, name, texture: { src: img }, disposition: -1,
    displayName: 20, displayBars: 20, bar1: { attribute: "resources.actionPoints" },
    bar2: { attribute: "resources.magicPoints" }
  }, flags: sourceFlags };
}

const skillNames = Object.freeze({
  aguante: "Aguante", artesania: "Artesanía", atletismo: "Atletismo",
  conocimiento_local: "Conocimiento Local", costumbres: "Costumbres", evadir: "Evadir",
  musculo: "Músculo", nadar: "Nadar", pelea: "Pelea", percepcion: "Percepción",
  perspicacia: "Perspicacia", voluntad: "Voluntad", rastrear: "Rastrear",
  sigilo: "Sigilo", supervivencia: "Supervivencia"
});

const commonAnimalSkills = (values) => Object.entries(values)
  .map(([key, value]) => skill(key, skillNames[key] ?? key, value));

export const CREATURE_SOURCES = Object.freeze([
  creature("lizard-man", "Hombre lagarto", npcSystem({
    species: "Hombre lagarto", values: { strength: 16, constitution: 13, size: 16,
      dexterity: 13, intelligence: 13, power: 11, charisma: 7 },
    formulas: { strength: "2d6+9", constitution: "2d6+6", size: "2d6+9",
      dexterity: "2d6+6", intelligence: "2d6+6", power: "3d6", charisma: "2d6" },
    actionPoints: 3, movement: 6, armorNotes: "Escamas duras.",
    magicNotes: "Algunos especialistas pueden practicar Animismo o Teísmo." }), [
    traitItem("cold-blooded"), traitItem("night-vision"),
    ...commonAnimalSkills({ aguante: 66, artesania: 56, atletismo: 59, conocimiento_local: 66,
      costumbres: 56, evadir: 56, musculo: 62, nadar: 69, pelea: 59, percepcion: 54,
      perspicacia: 44, voluntad: 52 }),
    style("lizard-warrior", "Guerrero Hombre Lagarto", 69,
      ["stone-axe", "short-spear", "buckler", "bite", "claw", "tail"]),
    weapon("bite", "Mordisco", { damage: "1d6", linkedLocationKey: "head" }),
    weapon("claw", "Garra", { damage: "1d4", reach: "T", linkedLocationKey: "right-arm" }),
    weapon("tail", "Cola", { damage: "1d4", reach: "L", linkedLocationKey: "tail" }),
    weapon("short-spear", "Lanza corta", { damage: "1d8+1", reach: "L", ap: 4, hp: 5, handsRequired: 1 }),
    weapon("stone-axe", "Hacha de piedra", { damage: "1d6+1", ap: 4, hp: 8, handsRequired: 1 }),
    weapon("buckler", "Rodela", { damage: "1d3+1", size: "G", reach: "C", ap: 4, hp: 9, handsRequired: 1 }),
    location("tail", "Cola", 1, 3, 3, 6), location("right-leg", "Pierna derecha", 4, 5, 3, 6, "limb"),
    location("left-leg", "Pierna izquierda", 6, 7, 3, 6, "limb"), location("abdomen", "Abdomen", 8, 10, 3, 7, "abdomen", "abdomen"),
    location("chest", "Pecho", 11, 14, 3, 8, "chest", "chest"), location("right-arm", "Brazo derecho", 15, 16, 3, 5, "limb", "arm"),
    location("left-arm", "Brazo izquierdo", 17, 18, 3, 5, "limb", "arm"), location("head", "Cabeza", 19, 20, 3, 6, "head"),
    passion("tribal-loyalty", "Lealtad a la tribu", 90), passion("enemy-hatred", "Odio a enemigos", 80)
  ]),
  creature("giant-ant", "Hormiga gigante", npcSystem({
    species: "Hormiga gigante", instinct: true, values: { strength: 14, constitution: 17,
      size: 14, dexterity: 13, intelligence: 9, power: 4, charisma: 1 },
    formulas: { strength: "4d6", constitution: "3d6+6", size: "4d6", dexterity: "2d6+6",
      intelligence: "2d6+2", power: "1d6" }, actionPoints: 2, movement: 12,
    armorNotes: "Quitina." }), [
    traitItem("formidable-natural-weapons"), traitItem("venomous",
      "El aguijón enfrenta el Aguante de la víctima al Aguante de la hormiga. Si falla, la localización queda inutilizable por dolor durante 30-CON minutos."),
    ...commonAnimalSkills({ aguante: 74, atletismo: 67, evadir: 56, musculo: 68,
      percepcion: 53, rastrear: 66, voluntad: 48 }),
    style("formicid-attack", "Ataque Formícido", 67, ["bite", "sting"]),
    weapon("bite", "Mordisco", { damage: "1d6", reach: "T", ap: 1, hp: 2 }),
    weapon("sting", "Aguijón", { damage: "1d4", linkedLocationKey: "head", effects: "Veneno" }),
    location("rear-right", "Pata trasera derecha", 1, 1, 4, 6, "limb"), location("rear-left", "Pata trasera izquierda", 2, 2, 4, 6, "limb"),
    location("middle-right", "Pata central derecha", 3, 3, 4, 6, "limb"), location("middle-left", "Pata central izquierda", 4, 4, 4, 6, "limb"),
    location("abdomen", "Abdomen", 5, 9, 4, 8, "abdomen", "abdomen"), location("thorax", "Tórax", 10, 13, 4, 9, "chest", "chest"),
    location("front-right", "Pata delantera derecha", 14, 14, 4, 6, "limb"), location("front-left", "Pata delantera izquierda", 15, 15, 4, 6, "limb"),
    location("head", "Cabeza", 16, 20, 4, 7, "head")
  ]),
  creature("manticore", "Mantícora", npcSystem({
    species: "Mantícora", instinct: true, values: { strength: 22, constitution: 16,
      size: 25, dexterity: 17, intelligence: 14, power: 11, charisma: 1 },
    formulas: { strength: "2d6+15", constitution: "2d6+9", size: "2d6+18",
      dexterity: "3d6+6", intelligence: "2d6+7", power: "3d6" },
    actionPoints: 3, movement: 10, armorNotes: "Piel, melena y quitina." }), [
    traitItem("frenzy"), traitItem("leaper"), traitItem("venomous",
      "Potencia igual al Aguante de la mantícora. Actúa un asalto después, paraliza 1d3 localizaciones contiguas y provoca asfixia si alcanza el pecho."),
    ...commonAnimalSkills({ aguante: 72, atletismo: 69, evadir: 74, musculo: 61,
      percepcion: 65, rastrear: 60, sigilo: 71, voluntad: 62 }),
    style("man-hunter", "Cazador de Hombres", 79, ["jaws", "claws", "sting", "spikes"]),
    weapon("jaws", "Fauces", { damage: "1d4", reach: "T", linkedLocationKey: "head" }),
    weapon("claws", "Garras", { damage: "1d6", size: "G", linkedLocationKey: "front-right" }),
    weapon("sting", "Aguijón", { damage: "1d8", size: "E", reach: "L", linkedLocationKey: "tail", effects: "Veneno" }),
    weapon("spikes", "Lanzar púas", { damage: "1d6", size: "G", weaponType: "ranged", range: "Larga", effects: "Veneno" }),
    location("tail", "Cola", 1, 3, 6, 9), location("rear-right", "Pata trasera derecha", 4, 5, 3, 9, "limb"),
    location("rear-left", "Pata trasera izquierda", 6, 7, 3, 9, "limb"), location("hindquarters", "Cuartos traseros", 8, 10, 3, 10, "abdomen", "abdomen"),
    location("forequarters", "Cuartos delanteros", 11, 14, 3, 11, "chest", "chest"), location("front-right", "Pata delantera derecha", 15, 16, 3, 9, "limb"),
    location("front-left", "Pata delantera izquierda", 17, 18, 3, 9, "limb"), location("head", "Cabeza", 19, 20, 5, 9, "head")
  ]),
  creature("bear", "Oso", npcSystem({
    species: "Oso", instinct: true, values: { strength: 25, constitution: 13,
      size: 34, dexterity: 13, intelligence: 13, power: 7, charisma: 1 },
    formulas: { strength: "2d6+18", constitution: "2d6+6", size: "4d6+20",
      dexterity: "2d6+6", intelligence: "2d6+6", power: "2d6" },
    actionPoints: 3, movement: 8, armorNotes: "Piel gruesa." }), [
    traitItem("intimidate",
      "Tirada enfrentada de Voluntad: un fallo obliga a alejarse el próximo asalto; una pifia fuerza a huir al movimiento máximo; un crítico concede inmunidad durante el encuentro."), traitItem("night-vision"),
    ...commonAnimalSkills({ aguante: 66, atletismo: 68, evadir: 46, musculo: 79,
      nadar: 68, percepcion: 60, rastrear: 66, sigilo: 66, supervivencia: 60, voluntad: 44 }),
    style("ursine-fury", "Furia Úrsida", 78, ["bite", "claw"]),
    weapon("bite", "Mordisco", { damage: "1d8", size: "G", reach: "C", linkedLocationKey: "head" }),
    weapon("claw", "Garra", { damage: "1d8", size: "E", reach: "L", linkedLocationKey: "front-right" }),
    location("rear-right", "Pata trasera derecha", 1, 3, 3, 10, "limb"), location("rear-left", "Pata trasera izquierda", 4, 6, 3, 10, "limb"),
    location("hindquarters", "Cuartos traseros", 7, 9, 3, 11, "abdomen", "abdomen"), location("forequarters", "Cuartos delanteros", 10, 12, 3, 12, "chest", "chest"),
    location("front-right", "Pata delantera derecha", 13, 15, 3, 10, "limb"), location("front-left", "Pata delantera izquierda", 16, 18, 3, 10, "limb"),
    location("head", "Cabeza", 19, 20, 3, 10, "head")
  ]),
  creature("xenomorph", "Xenomorfo", npcSystem({
    species: "Xenomorfo", instinct: true, values: { strength: 22, constitution: 13,
      size: 16, dexterity: 25, intelligence: 11, power: 11, charisma: 1 },
    formulas: { strength: "2d6+15", constitution: "2d6+6", size: "2d6+9",
      dexterity: "2d6+18", intelligence: "2d6+4", power: "3d6" },
    actionPoints: 2, movement: 8, magicPoints: 0, armorNotes: "Exoesqueleto.",
    description: "Al ser herido puede entrar en frenesí. Su sangre ácida puede dañar a un atacante próximo." }), [
    traitItem("frenzy",
      "Al ser herido tira Voluntad. Si falla, durante CON asaltos solo puede atacar o acercarse al combate, no puede parar ni evadir e ignora los efectos de heridas graves."),
    traitItem("acid-blood",
      "Cuando es herido, salpica a un atacante en alcance cuerpo a cuerpo: 1d3 de daño durante 1d3 asaltos a una localización aleatoria, corroyendo primero la armadura."),
    ...commonAnimalSkills({ aguante: 56, atletismo: 77, evadir: 80, musculo: 68,
      percepcion: 62, rastrear: 64, sigilo: 76, voluntad: 52 }),
    style("parasite-hunter", "Cazador Parásito", 77, ["claw", "tail-whip"]),
    weapon("claw", "Garra", { damage: "1d4", linkedLocationKey: "right-arm" }),
    weapon("tail-whip", "Latigazo de cola", { damage: "1d6", size: "G", linkedLocationKey: "tail" }),
    location("tail", "Cola", 1, 3, 6, 5), location("right-leg", "Pierna derecha", 4, 5, 6, 6, "limb"),
    location("left-leg", "Pierna izquierda", 6, 7, 6, 6, "limb"), location("abdomen", "Abdomen", 8, 10, 6, 7, "abdomen", "abdomen"),
    location("chest", "Pecho", 11, 14, 6, 8, "chest", "chest"), location("right-arm", "Brazo derecho", 15, 16, 6, 5, "limb", "arm"),
    location("left-arm", "Brazo izquierdo", 17, 18, 6, 5, "limb", "arm"), location("head", "Cabeza", 19, 20, 6, 7, "head")
  ])
]);
