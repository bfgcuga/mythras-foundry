const BASIC_SKILLS = [
  ["aguante", "Aguante", "constitution", "constitution", 0,
    "Resistir dolor, fatiga, enfermedades, venenos y esfuerzo físico."],
  ["atletismo", "Atletismo", "strength", "dexterity", 0,
    "Correr, saltar, escalar, lanzar y realizar otras actividades atléticas."],
  ["bailar", "Bailar", "dexterity", "charisma", 0,
    "Moverse con ritmo y precisión en bailes, actuaciones y rituales."],
  ["cantar", "Cantar", "power", "charisma", 0,
    "Interpretar melodías, desde cantos sencillos hasta piezas complejas."],
  ["conducir", "Conducir", "dexterity", "power", 0,
    "Controlar vehículos terrestres en maniobras o condiciones difíciles."],
  ["conocimiento-local", "Conocimiento Local", "intelligence", "intelligence", 0,
    "Conocer la geografía, clima, flora, fauna y comunidad de la región propia."],
  ["costumbres", "Costumbres", "intelligence", "intelligence", 40,
    "Comprender los códigos sociales, rituales, tabúes y prácticas de la cultura propia."],
  ["enganar", "Engañar", "intelligence", "charisma", 0,
    "Mentir, ocultar la verdad, confundir o plantear un engaño convincente."],
  ["evadir", "Evadir", "dexterity", "dexterity", 0,
    "Apartarse de peligros percibidos, proyectiles, trampas y amenazas físicas."],
  ["influencia", "Influencia", "charisma", "charisma", 0,
    "Convencer a otras personas para que actúen de la manera deseada."],
  ["lengua-materna", "Lengua Materna", "intelligence", "charisma", 40,
    "Hablar el idioma nativo con vocabulario, claridad y elocuencia."],
  ["manejo-de-botes", "Manejo de Botes", "strength", "constitution", 0,
    "Pilotar pequeñas embarcaciones en ríos, lagos y aguas costeras."],
  ["montar", "Montar", "dexterity", "power", 0,
    "Controlar y permanecer sobre una criatura entrenada como montura."],
  ["musculo", "Músculo", "strength", "size", 0,
    "Aplicar fuerza con técnica para levantar pesos, romper objetos o forcejear."],
  ["nadar", "Nadar", "strength", "constitution", 0,
    "Mantenerse a flote y desplazarse de forma controlada en el agua."],
  ["ocultar", "Ocultar", "dexterity", "power", 0,
    "Esconder objetos grandes evitando que sean descubiertos."],
  ["pelea", "Pelea", "strength", "dexterity", 0,
    "Atacar y defenderse sin armas mediante golpes, bloqueos y presas."],
  ["percepcion", "Percepción", "intelligence", "power", 0,
    "Observar el entorno y detectar de forma consciente detalles o amenazas."],
  ["perspicacia", "Perspicacia", "intelligence", "power", 0,
    "Interpretar conducta, lenguaje corporal, intenciones y posibles mentiras."],
  ["primeros-auxilios", "Primeros Auxilios", "intelligence", "dexterity", 0,
    "Tratar heridas menores y estabilizar lesiones graves inmediatamente."],
  ["sigilo", "Sigilo", "dexterity", "intelligence", 0,
    "Ocultarse y moverse procurando no ser visto ni oído."],
  ["voluntad", "Voluntad", "power", "power", 0,
    "Mantener la concentración y resistir presión, miedo o conmoción mental."],
  ["estilo-de-combate", "Estilo de Combate", "strength", "dexterity", 0,
    "Usar de forma coordinada las armas y técnicas de una tradición de combate."]
];

export const BASIC_SKILL_SOURCES = BASIC_SKILLS.map(([
  slug,
  name,
  characteristic1,
  characteristic2,
  baseBonus,
  description
]) => ({
  name,
  type: "skill",
  flags: {
    "mythras-foundry": {
      coreSkill: slug
    }
  },
  system: {
    slug,
    category: "basic",
    characteristic1,
    characteristic2,
    baseBonus,
    culturePoints: 0,
    professionPoints: 0,
    freePoints: 0,
    experiencePoints: 0,
    trained: false,
    used: false,
    description
  }
}));

export async function ensureBasicSkills(actor) {
  if (actor.type !== "character") return [];

  const existing = new Set(
    actor.items
      .filter((item) => item.type === "skill")
      .map((item) => item.getFlag("mythras-foundry", "coreSkill") ?? item.system.slug)
      .filter(Boolean)
  );
  const missing = BASIC_SKILL_SOURCES
    .filter((source) => !existing.has(source.system.slug))
    .map((source) => foundry.utils.deepClone(source));

  if (missing.length === 0) return [];
  return actor.createEmbeddedDocuments("Item", missing);
}
