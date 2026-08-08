import { MYTHRAS_REVISED_SOURCE } from "./sources.js";

const MAGIC_SKILLS = [
  ["atadura", "Atadura", "power", "charisma", "Dominar, vincular y controlar espíritus dentro de una tradición animista concreta."],
  ["devocion", "Devoción", "power", "charisma", "Medir la relación con un dios o culto concreto y recurrir a ella para solicitar milagros."],
  ["exhortacion", "Exhortación", "intelligence", "charisma", "Invocar y encauzar el poder de los dioses mediante el conocimiento de los mitos, rituales, plegarias y prácticas de un culto teísta concreto."],
  ["magia-comun", "Magia Común", "power", "charisma", "Usar bendiciones, talismanes, trucos y otros conjuros sencillos de magia común."],
  ["invocacion", "Invocación", "intelligence", "intelligence", "Lanzar conjuros aprendidos de un grimorio, escuela o mentor de hechicería concreto."],
  ["meditacion", "Meditación", "intelligence", "constitution", "Ignorar distracciones y alcanzar una concentración profunda; también permite descansar y recuperarse en condiciones normalmente inadecuadas."],
  ["misticismo", "Misticismo", "power", "constitution", "Canalizar los recursos interiores para activar talentos místicos y realizar actos sobrehumanos."],
  ["manipulacion", "Manipulación", "intelligence", "power", "Moldear un conjuro de hechicería ya invocado para alterar su alcance, duración, objetivos u otros parámetros."],
  ["trance", "Trance", "power", "constitution", "Percibir y viajar por el mundo espiritual."]
];

export const MAGIC_SKILL_SOURCES = MAGIC_SKILLS.map(([
  slug, name, characteristic1, characteristic2, description
]) => ({
  name,
  type: "skill",
  flags: { "mythras-foundry": { compendiumSkill: slug } },
  system: {
    slug,
    templateSlug: slug,
    source: MYTHRAS_REVISED_SOURCE,
    specialization: "",
    category: "professional",
    group: "magic",
    characteristic1,
    characteristic2,
    baseBonus: 0,
    culturePoints: 0,
    professionPoints: 0,
    freePoints: 0,
    experiencePoints: 0,
    trained: false,
    fumbled: false,
    description
  }
}));
