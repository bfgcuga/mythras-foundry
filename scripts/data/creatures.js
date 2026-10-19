import { creature, npcSystem, traitItem, style, weapon, location, skill } from "./creature-helpers.js";
import { REVISED_CREATURE_SOURCES } from "./revised-creatures.js";

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
  ...REVISED_CREATURE_SOURCES,
  creature("xenomorph", "Xenomorfo", npcSystem({
    species: "Xenomorfo", morphologyKey: "tailedBiped", instinct: true, values: { strength: 22, constitution: 13,
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
