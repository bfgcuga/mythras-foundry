import { MYTHRAS_REVISED_SOURCE } from "./sources.js";

const sourceFlags = { "mythras-foundry": { source: "mythras-basic-revised" } };

const profile = (key, name) => ({ key, name });
const trait = (key, name) => ({ uuid: "", key, name, parameters: [] });

const bowsAndCrossbows = [
  profile("arco-corto", "Arco corto"),
  profile("arco-largo", "Arco largo"),
  profile("arco-recurvado", "Arco recurvado"),
  profile("ballesta-ligera", "Ballesta ligera"),
  profile("ballesta-pesada", "Ballesta pesada")
];

const shields = [
  profile("cometa", "Escudo cometa"),
  profile("heraldo", "Escudo heraldo"),
  profile("hoplon", "Escudo hoplón"),
  profile("pelta", "Escudo pelta"),
  profile("rodela", "Escudo rodela"),
  profile("scutum-paves", "Escudo scutum/pavés"),
  profile("tarja", "Escudo tarja"),
  profile("vikingo", "Escudo vikingo")
];

const swords = [
  profile("espada-ancha", "Espada ancha"),
  profile("espada-corta", "Espada corta"),
  profile("espada-larga", "Espada larga")
];

const style = (buildKey, name, weaponProfiles, traitRefs) => ({
  buildKey,
  name,
  type: "combatStyle",
  img: "systems/mythras-foundry/assets/icons/combat-style.svg",
  system: {
    slug: buildKey,
    category: "professional",
    group: "combat",
    characteristic1: "strength",
    characteristic2: "dexterity",
    baseBonus: 0,
    culturePoints: 0,
    professionPoints: 0,
    freePoints: 0,
    experiencePoints: 0,
    trained: false,
    fumbled: false,
    valueMode: "formula",
    manualValue: 0,
    generationFormula: "",
    weaponProfiles,
    traitRefs,
    sourceType: "official",
    source: MYTHRAS_REVISED_SOURCE,
    description: ""
  },
  flags: sourceFlags
});

export const COMBAT_STYLE_SOURCES = Object.freeze([
  style("asesino", "Asesino", [
    ...bowsAndCrossbows,
    profile("daga", "Daga"),
    profile("espada-corta", "Espada corta")
  ], [trait("asesinato", "Asesinato"), trait("punteria-de-tirador", "Puntería de Tirador")]),
  style("caballeria-caballero-montado", "Caballería o Caballero montado", [
    ...shields,
    ...swords,
    profile("lanza-larga", "Lanza larga"),
    profile("lanza-caballeria", "Lanza de caballería")
  ], [trait("combate-montado", "Combate Montado"), trait("lancero-montado", "Lancero Montado")]),
  style("gladiador", "Gladiador", [
    profile("espada-corta", "Espada corta"),
    profile("red", "Red"),
    profile("rodela", "Escudo rodela"),
    profile("tridente", "Tridente")
  ], [trait("apresador", "Apresador"), trait("temerario", "Temerario")]),
  style("guardia-ciudad-hoplita", "Guardia de la ciudad u Hoplita", [
    ...shields,
    profile("espada-corta", "Espada corta"),
    profile("lanza-larga", "Lanza larga")
  ], [trait("combate-en-formacion", "Combate en Formación"), trait("luchador-precavido", "Luchador Precavido")]),
  style("guerrero-barbaro", "Guerrero bárbaro", [
    ...shields,
    profile("espada-ancha", "Espada ancha"),
    profile("espadon", "Espadón"),
    profile("hacha-batalla", "Hacha de batalla")
  ], [trait("grito-intimidante", "Grito Intimidante"), trait("matar-o-morir", "Matar o Morir")]),
  style("guerrero-noble", "Guerrero noble", [
    profile("arco-corto", "Arco corto"),
    ...shields,
    profile("espada-larga", "Espada larga"),
    profile("main-gauche", "Main gauche")
  ], [trait("mentalidad-defensiva", "Mentalidad Defensiva")]),
  style("hondero-micenico", "Hondero micénico", [
    ...shields,
    profile("espada-corta", "Espada corta"),
    profile("honda", "Honda")
  ], [trait("muro-de-escudos", "Muro de Escudos"), trait("noquear", "Noquear")]),
  style("luchador-callejero", "Luchador callejero", [
    profile("clava", "Clava"),
    profile("cuchillo", "Cuchillo"),
    profile("puno-patada", "Puño/Patada")
  ], [trait("aporrear", "Aporrear"), trait("maestria-sin-armas", "Maestría sin Armas")]),
  style("maestro-arquero", "Maestro arquero", [
    profile("arco-largo", "Arco largo"),
    profile("daga", "Daga"),
    profile("espada-corta", "Espada corta")
  ], [trait("hostigador", "Hostigador"), trait("punteria-de-tirador", "Puntería de Tirador")]),
  style("marinero-pirata", "Marinero o Pirata", [
    profile("alfanje", "Alfanje"),
    profile("estoque", "Estoque"),
    profile("clava", "Clava"),
    profile("main-gauche", "Main gauche")
  ], [trait("espadachin", "Espadachín"), trait("juego-de-pies-excelente", "Juego de Pies Excelente")])
]);
