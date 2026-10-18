import { MYTHRAS_REVISED_SOURCE } from "./sources.js";
import { HAZARD_DESCRIPTIONS } from "./hazard-descriptions.js";

const baseProfile = {
  name: "", application: "", purpose: "", trigger: "", resistance: "Aguante",
  resistanceSkill: "aguante", resistanceDifficulty: "standard", onset: "", duration: "",
  conditions: "", cure: "", damage: "", size: "", armorIgnored: false,
  effect: "", rearm: "", notes: ""
};
function source(type, key, name, page, profile, variants = [], stages = []) {
  const system = { ...baseProfile, ...profile };
  return { buildKey: key, name, type,
    img: `icons/svg/${type === "trap" ? "trap" : type === "poison" ? "poison" : "biohazard"}.svg`,
    system: { ...system, key, source: `${MYTHRAS_REVISED_SOURCE}, pág. ${page}`,
      description: HAZARD_DESCRIPTIONS[key],
      variants: variants.map((variant) => ({ ...baseProfile, ...Object.fromEntries(
        Object.entries(system).filter(([field]) => field in baseProfile)), ...variant })),
      stages: stages.map((stage) => ({ name: "", variant: "", onset: "", interval: "",
        conditions: "", effect: "", ...stage })) },
    flags: { "mythras-foundry": { source: "mythras-basic-revised" } } };
}

export const DISEASE_SOURCES = [
  source("disease", "pirohoxia", "Pirohoxia", "76", {
    application: "Inyectada (mordisco)", potency: 80, onset: "1d6+6 días", duration: "1 semana + 1d3 días",
    conditions: "Alucinaciones, Manía (Fuego), Muerte",
    effect: "Comienza con alucinaciones; una semana después aparece la manía. Al concluir sobreviene la muerte incluso si se impide la inmolación.",
    cure: "Curación hasta que aparece la Manía; después solo medios mágicos."
  }, [], [
    { name: "Alucinaciones", onset: "Al manifestarse (1d6+6 días)", conditions: "Alucinaciones" },
    { name: "Manía (Fuego)", onset: "Una semana después de la aparición", conditions: "Manía (Fuego)" },
    { name: "Final", onset: "Al concluir la duración", conditions: "Muerte" }
  ]),
  source("disease", "succion-del-alma", "Succión del alma", "76", {
    application: "Inhalada", potency: 65, onset: "1d6 días", duration: "1d3+3 semanas", conditions: "Drenaje",
    effect: "Cada semana reduce el Atributo de Puntos de Magia en 1d6. No se recuperan hasta que termina la enfermedad; entonces se recupera 1 punto por día.",
    cure: "No se indica una cura específica; se aplican las reglas generales de curación mágica de aflicciones."
  }, [], [{ name: "Drenaje", onset: "Tras la aparición", interval: "Cada semana", conditions: "Drenaje",
    effect: "Reduce el Atributo de Puntos de Magia en 1d6; recuperación de 1 punto/día al terminar." }]),
  source("disease", "viruela-roja", "Viruela roja", "76-77", {
    application: "Contacto", potency: 50, onset: "1d6+6 horas", duration: "1d6+3 días",
    conditions: "Contagio, Fiebre, Desangramiento",
    effect: "Contagiosa desde la aparición. Un día después comienza la fiebre y el desangramiento. Cada día de sangrado acumula un Nivel de Fatiga que no se recupera hasta terminar la enfermedad.",
    cure: "Se puede curar con Curación.", notes: "Los objetos tocados permanecen infecciosos durante 1d3 días."
  }, [], [
    { name: "Contagio", onset: "Al manifestarse", conditions: "Contagio" },
    { name: "Fiebre y desangramiento", onset: "Un día después de la aparición", interval: "Cada día con sangrado",
      conditions: "Fiebre, Desangramiento", effect: "+1 Nivel de Fatiga diario, no recuperable hasta finalizar la duración." }
  ])
];

export const POISON_SOURCES = [
  source("poison", "pocima-somnifera", "Pócima somnífera", "77", {
    application: "Ingerida", potency: 60, resistance: "Voluntad", resistanceSkill: "voluntad",
    onset: "1d6+4 minutos", duration: "1d6+3 horas", conditions: "Inconsciencia",
    effect: "Sueño profundo del que no se puede despertar hasta que termina la duración. Al recuperar la consciencia se sufre un Nivel de Fatiga.",
    cure: "Curación y un estimulante fuerte."
  }),
  source("poison", "polvo-de-loto", "Polvo de loto", "77-78", {
    application: "Inhalado", potency: 90, resistance: "Voluntad", resistanceSkill: "voluntad",
    onset: "1d3 Asaltos", duration: "Instantáneo (natural); 2d6 horas (quemado)",
    conditions: "Muerte (natural); Parálisis y Alucinaciones (quemado)",
    effect: "El polen natural provoca Muerte. Quemado provoca Parálisis y Alucinaciones; al terminar exige otra resistencia o un coma interminable.",
    cure: "Infusión de Loto dorado para recuperación completa; de lo contrario, magia."
  }, [
    { name: "Polen natural", application: "Inhalado (también letal ingerido)", duration: "Instantáneo", conditions: "Muerte", effect: "El corazón de la víctima revienta." },
    { name: "Quemado", duration: "2d6 horas", conditions: "Parálisis, Alucinaciones",
      effect: "Al final del sueño narcótico debe superar otra resistencia o entrar en un coma interminable." }
  ], [{ name: "Resistencia al despertar", variant: "Quemado", onset: "Al concluir las 2d6 horas",
    effect: "Otra tirada de resistencia; si falla, coma interminable." }]),
  source("poison", "veneno-de-cobra", "Veneno de cobra", "78", {
    application: "Contacto (ojos) o Inyectado", potency: 75,
    onset: "Instantáneo (ojos); 1d6+4 minutos (mordedura)", duration: "1d3+3 días",
    conditions: "Agonía, Ceguera (ojos); Agonía, Asfixia, Muerte, Necrosis (mordedura)",
    effect: "Los efectos dependen de la vía de aplicación; consultar variantes y etapas.",
    cure: "Curación. La ceguera se vuelve permanente si no se trata antes del fin de la duración. Cada día de necrosis antes del tratamiento causa daño permanente."
  }, [
    { name: "Contacto ocular", application: "Contacto (ojos)", onset: "Instantáneo", conditions: "Agonía, Ceguera",
      effect: "Agonía y Ceguera durante toda la duración; la Ceguera es permanente si no se trata a tiempo." },
    { name: "Mordedura", application: "Inyectado", onset: "1d6+4 minutos", conditions: "Agonía, Asfixia, Muerte, Necrosis",
      effect: "Agonía; Asfixia a las 1d6+6 horas del mordisco. Primeros Auxilios puede mantener la respiración. Los supervivientes pierden permanentemente 1 PG al día en la Localización mordida hasta purgarse el veneno o acabar su duración." }
  ], [
    { name: "Agonía y Ceguera", variant: "Contacto ocular", onset: "Instantáneo", conditions: "Agonía, Ceguera" },
    { name: "Agonía", variant: "Mordedura", onset: "1d6+4 minutos", conditions: "Agonía" },
    { name: "Fallo respiratorio", variant: "Mordedura", onset: "1d6+6 horas desde el mordisco", conditions: "Asfixia, Muerte",
      effect: "Primeros Auxilios enfrentado a la Potencia puede mantener a la víctima respirando." },
    { name: "Necrosis", variant: "Mordedura", onset: "Si sobrevive a la asfixia", interval: "Cada día",
      conditions: "Mutilación (Necrosis)", effect: "Pierde permanentemente 1 PG/día en la Localización mordida hasta tratamiento o fin del veneno." }
  ])
];

export const TRAP_SOURCES = [
  source("trap", "techo-aplastante", "Techo aplastante", "86", {
    purpose: "Muerte", trigger: "Mover el objeto-cebo", difficulty: 80,
    resistance: "Evadir para salir antes de cerrarse la entrada. Músculo en grupo para sostener el techo mientras otro abre la puerta o lo calza.",
    resistanceSkill: "evadir", damage: "2d8", armorIgnored: true,
    effect: "Al bajar lo suficiente inmoviliza contra el suelo y causa 2d8 puntos de daño por Asalto a una Localización aleatoria; la armadura no protege.",
    rearm: "Manual, salvo diseño o encantamiento que indique lo contrario.",
    notes: "Para sostenerlo se suman FUE y TAM de los resistentes y se calcula un Modificador de Daño combinado; se usa con la mayor Habilidad de Músculo del grupo contra el Modificador de Daño 2d8 de la trampa. Resolver esta alternativa con las reglas de fuerza; la enfrentada individual no la sustituye."
  }),
  source("trap", "foso", "Foso", "86-87", {
    purpose: "Captura o Muerte", trigger: "Caminar sobre la falsa superficie que cubre el foso", difficulty: 60,
    resistance: "Evadir para saltar a tiempo o Atletismo Difícil para agarrarse al borde al caer.",
    resistanceSkill: "evadir", damage: "2d6", armorIgnored: true,
    effect: "2d6 puntos de daño por caída a una Localización aleatoria; la armadura no protege. Los efectos secundarios quedan a criterio del DJ.",
    rearm: "Manual, salvo mecanismo de cierre por bisagras y contrapesos u otro diseño específico."
  }, [
    { name: "Captura", purpose: "Captura", notes: "Forma de ánfora, paredes pulidas o material suelto pueden impedir escapar escalando." },
    { name: "Muerte", purpose: "Muerte", notes: "Puede incorporar estacas, ácido débil, agua para ahogar o ratas famélicas. El DJ resuelve estos efectos adicionales." }
  ]),
  source("trap", "trampa-de-venablo", "Trampa de venablo", "87", {
    purpose: "Mutilación", trigger: "Pisar una placa de presión o mover un objeto", difficulty: 75,
    resistance: "Evadir para apartarse o parada Difícil con un Estilo de Combate y un escudo equipado.",
    resistanceSkill: "evadir", damage: "2d8", size: "E", armorIgnored: false,
    effect: "2d8 puntos de daño a una Localización. Puede pararse parcialmente con escudo según su tamaño frente al tamaño Enorme del venablo. Con uno o más niveles de éxito sobre la víctima puede aplicar Efectos de Combate como Empalar.",
    rearm: "Manual.", notes: "Resolver la absorción del escudo y los Efectos de Combate antes de confirmar el daño final."
  })
];
