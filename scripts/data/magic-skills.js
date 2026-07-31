const MAGIC_SKILLS = [
  ["atadura", "Atadura", "charisma", "power", "Controlar y vincular espíritus dentro de una tradición animista."],
  ["devocion", "Devoción", "charisma", "power", "Representar la fuerza de la devoción a un dios o culto."],
  ["exhortacion", "Exhortación", "intelligence", "charisma", "Solicitar milagros mediante la magia teísta."],
  ["magia-comun", "Magia Común", "charisma", "power", "Lanzar los conjuros sencillos de la magia común."],
  ["invocacion", "Invocación", "intelligence", "intelligence", "Invocar conjuros de una escuela o grimorio de hechicería."],
  ["meditacion", "Meditación", "intelligence", "constitution", "Alcanzar la concentración necesaria para las disciplinas místicas."],
  ["misticismo", "Misticismo", "power", "constitution", "Activar talentos y capacidades místicas."],
  ["moldeado", "Moldeado", "intelligence", "power", "Modificar los parámetros de un conjuro de hechicería."],
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
