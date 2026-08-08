import { MYTHRAS_REVISED_SOURCE } from "./sources.js";

const PROFESSIONAL_SKILLS = [
  ["acrobacias", "Acrobacias", "strength", "dexterity", "Equilibrio, gimnasia, malabarismo, piruetas y control de caídas."],
  ["actuar", "Actuar", "charisma", "charisma", "Interpretar un papel y hacerse pasar por otra persona."],
  ["arte", "Arte", "power", "charisma", "Crear obras dentro de una disciplina artística concreta y usarlas para impresionar, emocionar o convencer a través de su calidad."],
  ["artesania", "Artesanía", "dexterity", "intelligence", "Fabricar objetos mediante una especialidad artesanal concreta."],
  ["burocracia", "Burocracia", "intelligence", "intelligence", "Comprender procedimientos, registros y organizaciones administrativas."],
  ["callejeo", "Callejeo", "power", "charisma", "Localizar contactos, servicios y zonas relevantes de un asentamiento."],
  ["comerciar", "Comerciar", "intelligence", "charisma", "Tasar bienes, negociar precios y entender transacciones mercantiles."],
  ["cortesia", "Cortesía", "intelligence", "charisma", "Actuar correctamente según protocolos y códigos sociales formales."],
  ["cultura", "Cultura", "intelligence", "intelligence", "Conocer las costumbres de una sociedad diferente de la propia."],
  ["curacion", "Curación", "intelligence", "power", "Diagnosticar y tratar lesiones mediante los conocimientos médicos, remedios, instrumentos y prácticas disponibles en la cultura del personaje."],
  ["disfraz", "Disfraz", "intelligence", "charisma", "Diseñar una apariencia falsa convincente con materiales adecuados."],
  ["ensenar", "Enseñar", "intelligence", "charisma", "Transmitir conocimientos y técnicas de forma comprensible."],
  ["forzar-cerraduras", "Forzar Cerraduras", "dexterity", "dexterity", "Abrir cierres mecánicos sin su llave correspondiente."],
  ["idioma", "Idioma", "intelligence", "charisma", "Comprender y hablar un idioma distinto de la lengua materna."],
  ["ingenieria", "Ingeniería", "intelligence", "intelligence", "Diseñar, construir y evaluar estructuras o máquinas de gran escala."],
  ["juego", "Juego", "intelligence", "power", "Analizar probabilidades y detectar trampas en juegos de azar."],
  ["juegos-de-manos", "Juegos de Manos", "dexterity", "charisma", "Ocultar o manipular objetos pequeños mediante destreza y distracción."],
  ["leer-escribir", "Leer/Escribir", "intelligence", "intelligence", "Leer y redactar correctamente en un idioma concreto."],
  ["mecanismos", "Mecanismos", "dexterity", "intelligence", "Montar, desmontar y reparar dispositivos mecánicos delicados."],
  ["musica", "Música", "dexterity", "charisma", "Interpretar un grupo concreto de instrumentos musicales."],
  ["navegacion", "Navegación", "intelligence", "constitution", "Pilotar y mantener embarcaciones grandes en travesías acuáticas."],
  ["oratoria", "Oratoria", "power", "charisma", "Persuadir o inspirar a un público numeroso mediante discursos."],
  ["orientacion", "Orientación", "intelligence", "power", "Trazar y mantener un rumbo en una región o entorno concreto."],
  ["rastrear", "Rastrear", "intelligence", "constitution", "Seguir el rastro de una presa mediante indicios de su paso."],
  ["saber", "Saber", "intelligence", "intelligence", "Recordar y aplicar un campo de conocimiento especializado."],
  ["seduccion", "Seducción", "intelligence", "charisma", "Provocar interés romántico o sexual mediante persuasión deliberada."],
  ["supervivencia", "Supervivencia", "constitution", "power", "Subsistir en entornos salvajes sin apoyo de la civilización."]
];

export const PROFESSIONAL_SKILL_SOURCES = PROFESSIONAL_SKILLS.map(([
  slug,
  name,
  characteristic1,
  characteristic2,
  description
]) => ({
  name,
  type: "skill",
  flags: {
    "mythras-foundry": {
      compendiumSkill: slug
    }
  },
  system: {
    slug,
    templateSlug: slug,
    source: MYTHRAS_REVISED_SOURCE,
    specialization: "",
    category: "professional",
    group: slug === "idioma" ? "language" : "professional",
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
