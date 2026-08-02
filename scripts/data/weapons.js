const baseSystem = Object.freeze({
  quantity: 1,
  weight: 0,
  value: 0,
  location: "",
  equipped: false,
  damageModifierMode: "full",
  reach: "",
  hitPoints: 0,
  encumbrance: 0,
  effects: "",
  grip: "",
  range: "",
  reload: "",
  preferredCombatStyleId: "",
  familiarity: "similar",
  description: ""
});

const weapon = ({
  key,
  profileKey = key,
  name,
  weaponType = "melee",
  damage,
  size = "",
  ap = 0,
  hp = 0,
  damageModifierMode = "full",
  range = "",
  reload = "",
  grip = "",
  handsRequired = profileKey === "desarmado" ? 0 : (grip === "2 manos" ? 2 : 1),
  effects = "",
  description = "",
  img = "icons/svg/sword.svg",
  modes = null
}) => {
  const defaultMode = { key: weaponType === "ranged" ? "ranged" : weaponType === "shield" ? "shield" : "melee",
    name: "",
    profileKey: "", weaponType, damage, damageModifierMode, size, reach: "", effects, grip,
    handsRequired, range, reload, preferredCombatStyleId: "", familiarity: "similar" };
  const resolvedModes = modes ?? [defaultMode];
  return ({
  buildKey: key,
  name,
  type: "weapon",
  img,
  system: {
    ...baseSystem,
    profileKey,
    activeModeKey: resolvedModes[0].key,
    modes: resolvedModes,
    weaponType,
    damage,
    damageModifierMode,
    size,
    maxHitPoints: hp,
    currentHitPoints: hp,
    armorPoints: ap,
    range,
    reload,
    grip,
    handsRequired,
    effects,
    description
  },
  flags: { "mythras-foundry": { source: "mythras-imperative-srd" } }
  });
};

const shield = (data) => weapon({
  ...data,
  weaponType: "shield",
  grip: "1 mano",
  img: "icons/svg/shield.svg"
});

const ranged = (data) => weapon({
  ...data,
  weaponType: "ranged",
  img: "icons/svg/target.svg"
});

export const SHIELD_SOURCES = Object.freeze([
  shield({ key: "rodela", name: "Rodela", damage: "1d3", size: "M", ap: 6, hp: 9,
    effects: "Bloqueo pasivo: 2 localizaciones" }),
  shield({ key: "escudo-termico", name: "Escudo Térmico", damage: "1d4", size: "G", ap: 6, hp: 12,
    effects: "Bloqueo pasivo: 3 localizaciones" }),
  shield({ key: "escudo-cometa", name: "Escudo de Cometa", damage: "1d4", size: "E", ap: 4, hp: 15,
    effects: "Bloqueo pasivo: 4 localizaciones" }),
  shield({ key: "scutum", name: "Scutum", damage: "1d4", size: "E", ap: 4, hp: 18,
    effects: "Bloqueo pasivo: 5 localizaciones" }),
  shield({ key: "escudo-vikingo-antidisturbios", name: "Escudo Vikingo/Antidisturbios",
    damage: "1d4", size: "G", ap: 4, hp: 12, effects: "Bloqueo pasivo: 4 localizaciones" })
]);

export const MELEE_WEAPON_SOURCES = Object.freeze([
  weapon({ key: "hacha", name: "Hacha", damage: "1d6+1", size: "M", ap: 4, hp: 8,
    effects: "Despedazar armadura", grip: "1 mano" }),
  weapon({ key: "espada-ancha", name: "Espada Ancha", damage: "1d8", size: "M", ap: 6, hp: 10,
    grip: "1 mano" }),
  weapon({ key: "cadena", name: "Cadena", damage: "1d4", size: "M", ap: 8, hp: 6,
    effects: "Enredar", grip: "1 mano" }),
  weapon({ key: "garrote", name: "Garrote", damage: "1d6", size: "M", ap: 4, hp: 4,
    grip: "1 mano" }),
  weapon({ key: "daga", name: "Daga", damage: "1d4+1", size: "P", ap: 6, hp: 8,
    effects: "Arrojadiza", grip: "1 mano", range: "5/10/20", modes: [
      { key: "melee", name: "", profileKey: "", weaponType: "melee", damage: "1d4+1",
        damageModifierMode: "full", size: "P", reach: "", effects: "Arrojadiza", grip: "1 mano",
        handsRequired: 1, range: "", reload: "", preferredCombatStyleId: "", familiarity: "similar" },
      { key: "thrown", name: "Arrojar", profileKey: "", weaponType: "ranged", damage: "1d4",
        damageModifierMode: "full", size: "P", reach: "", effects: "Empalamiento P, arrojadiza", grip: "1 mano",
        handsRequired: 1, range: "5/10/20", reload: "", preferredCombatStyleId: "", familiarity: "similar" }
    ] }),
  weapon({ key: "punyo-patada", profileKey: "desarmado", name: "Puño/Patada", damage: "1d3",
    size: "P", damageModifierMode: "full", description: "Daño de combate desarmado humano." }),
  weapon({ key: "espada-larga", name: "Espada Larga", damage: "1d8", size: "M", ap: 6, hp: 12,
    grip: "2 manos" }),
  weapon({ key: "maza", name: "Maza", damage: "1d8", size: "M", ap: 6, hp: 6, grip: "1 mano" }),
  weapon({ key: "red", name: "Red", damage: "1d4", size: "P", ap: 2, hp: 20,
    effects: "Enredar, arrojadiza", range: "Según la situación" }),
  weapon({ key: "espada-corta", name: "Espada Corta", damage: "1d6", size: "M", ap: 6, hp: 8,
    grip: "1 mano" }),
  weapon({ key: "lanza-1m", name: "Lanza 1M", damage: "1d8+1", size: "M", ap: 4, hp: 5,
    grip: "1 mano" }),
  weapon({ key: "lanza-2m", name: "Lanza 2M", damage: "1d10+1", size: "G", ap: 4, hp: 10,
    grip: "2 manos", effects: "Puede prepararse para recibir una carga" }),
  weapon({ key: "martillo-guerra", name: "Martillo de Guerra", damage: "1d8+1", size: "M", ap: 3,
    hp: 8, grip: "2 manos" }),
  weapon({ key: "latigo", name: "Látigo", damage: "1d3", size: "M", ap: 2, hp: 8,
    grip: "1 mano", effects: "Enredar" })
]);

export const RANGED_WEAPON_SOURCES = Object.freeze([
  ranged({ key: "bolas", name: "Bolas", damage: "1d4", ap: 2, hp: 2,
    damageModifierMode: "none", range: "10/25/50", effects: "Arrojadiza" }),
  ranged({ key: "arco", name: "Arco", damage: "1d8", size: "G", ap: 4, hp: 4,
    range: "15/100/200", reload: "1", grip: "2 manos", effects: "Empalamiento P" }),
  ranged({ key: "jabalina", name: "Jabalina", damage: "1d8+1", size: "E", ap: 3, hp: 8,
    range: "10/20/50", effects: "Empalamiento M, arrojadiza" }),
  ranged({ key: "honda", name: "Honda", damage: "1d8", size: "G", ap: 1, hp: 2,
    damageModifierMode: "none", range: "10/150/300", reload: "2", grip: "2 manos" }),
  ranged({ key: "piedra-roca", name: "Piedra/Roca", damage: "1d3", size: "P",
    range: "5/10/20", effects: "Arrojadiza" }),
  ranged({ key: "pistola", name: "Pistola", damage: "1d6", size: "G", damageModifierMode: "none",
    range: "50/100/200", reload: "2", grip: "1 mano" }),
  ranged({ key: "rifle", name: "Rifle", damage: "2d6", size: "E", damageModifierMode: "none",
    range: "100/300/2000", reload: "2", grip: "2 manos" }),
  ranged({ key: "escopeta", name: "Escopeta", damage: "3d6", size: "M", damageModifierMode: "none",
    range: "20/50/200", reload: "3", grip: "2 manos" }),
  ranged({ key: "rifle-laser", name: "Rifle Láser", damage: "1d10+2", damageModifierMode: "none",
    range: "40/120/480", reload: "3", grip: "2 manos" }),
  ranged({ key: "rifle-plasma", name: "Rifle de Plasma", damage: "2d6+4", size: "I",
    damageModifierMode: "none", range: "30/100/300", reload: "3", grip: "2 manos" }),
  ranged({ key: "rifle-gauss", name: "Rifle Gauss", damage: "2d8+2", size: "I",
    damageModifierMode: "none", range: "150/500/5000", reload: "3", grip: "2 manos" })
]);

export const WEAPON_SOURCES = Object.freeze([
  ...SHIELD_SOURCES,
  ...MELEE_WEAPON_SOURCES,
  ...RANGED_WEAPON_SOURCES
]);
