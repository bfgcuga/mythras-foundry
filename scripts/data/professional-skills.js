const PROFESSIONAL_SKILLS = [
  ["acrobacias", "Acrobacias", "strength", "dexterity", "Equilibrio, gimnasia, malabarismo, piruetas y control de caídas."],
  ["actuar", "Actuar", "charisma", "charisma", "Interpretar un papel y hacerse pasar por otra persona."],
  ["arte", "Arte", "power", "charisma", "Crear o interpretar una disciplina artística concreta."],
  ["artesania", "Artesanía", "dexterity", "intelligence", "Fabricar objetos mediante una especialidad artesanal concreta."],
  ["astrogacion", "Astrogación", "intelligence", "intelligence", "Trazar rumbos seguros entre cuerpos y sistemas estelares."],
  ["burocracia", "Burocracia", "intelligence", "intelligence", "Comprender procedimientos, registros y organizaciones administrativas."],
  ["callejeo", "Callejeo", "power", "charisma", "Localizar contactos, servicios y zonas relevantes de un asentamiento."],
  ["ciencia", "Ciencia", "intelligence", "intelligence", "Aplicar una disciplina científica concreta."],
  ["comerciar", "Comerciar", "intelligence", "charisma", "Tasar bienes, negociar precios y entender transacciones mercantiles."],
  ["comunicaciones", "Comunicaciones", "intelligence", "intelligence", "Operar, detectar, ocultar o interferir sistemas de comunicaciones."],
  ["cortesia", "Cortesía", "intelligence", "charisma", "Actuar correctamente según protocolos y códigos sociales formales."],
  ["cultura", "Cultura", "intelligence", "intelligence", "Conocer las costumbres de una sociedad diferente de la propia."],
  ["curacion", "Curación", "intelligence", "power", "Diagnosticar y tratar lesiones mediante la medicina disponible."],
  ["demoliciones", "Demoliciones", "intelligence", "power", "Preparar y manejar materiales explosivos de forma controlada."],
  ["disfraz", "Disfraz", "intelligence", "charisma", "Diseñar una apariencia falsa convincente con materiales adecuados."],
  ["electronica", "Electrónica", "dexterity", "intelligence", "Reparar, modificar o puentear dispositivos y circuitos electrónicos."],
  ["ensenar", "Enseñar", "intelligence", "charisma", "Transmitir conocimientos y técnicas de forma comprensible."],
  ["falsificacion", "Falsificación", "dexterity", "intelligence", "Crear o alterar documentos para que parezcan auténticos."],
  ["forzar-cerraduras", "Forzar Cerraduras", "dexterity", "dexterity", "Abrir cierres mecánicos sin su llave correspondiente."],
  ["idioma", "Idioma", "intelligence", "charisma", "Comprender y hablar un idioma distinto de la lengua materna."],
  ["informatica", "Informática", "intelligence", "intelligence", "Programar, investigar y resolver problemas mediante sistemas informáticos."],
  ["ingenieria", "Ingeniería", "intelligence", "intelligence", "Diseñar, construir y evaluar estructuras o máquinas de gran escala."],
  ["investigacion", "Investigación", "intelligence", "power", "Encontrar información utilizando archivos, bibliotecas o redes."],
  ["juego", "Juego", "intelligence", "power", "Analizar probabilidades y detectar trampas en juegos de azar."],
  ["juegos-de-manos", "Juegos de Manos", "dexterity", "charisma", "Ocultar o manipular objetos pequeños mediante destreza y distracción."],
  ["leer-escribir", "Leer/Escribir", "intelligence", "intelligence", "Leer y redactar correctamente en un idioma concreto."],
  ["mecanismos", "Mecanismos", "dexterity", "intelligence", "Montar, desmontar y reparar dispositivos mecánicos delicados."],
  ["musica", "Música", "dexterity", "charisma", "Interpretar un grupo concreto de instrumentos musicales."],
  ["navegacion", "Navegación", "intelligence", "constitution", "Pilotar y mantener embarcaciones grandes en travesías acuáticas."],
  ["oratoria", "Oratoria", "power", "charisma", "Persuadir o inspirar a un público numeroso mediante discursos."],
  ["orientacion", "Orientación", "intelligence", "power", "Trazar y mantener un rumbo en una región o entorno concreto."],
  ["pilotaje", "Pilotaje", "dexterity", "intelligence", "Controlar una clase concreta de vehículo volador."],
  ["politica", "Política", "intelligence", "charisma", "Comprender y manejar estructuras de poder e influencia institucional."],
  ["rastrear", "Rastrear", "intelligence", "constitution", "Seguir el rastro de una presa mediante indicios de su paso."],
  ["saber", "Saber", "intelligence", "intelligence", "Recordar y aplicar un campo de conocimiento especializado."],
  ["seduccion", "Seducción", "intelligence", "charisma", "Provocar interés romántico o sexual mediante persuasión deliberada."],
  ["sensores", "Sensores", "intelligence", "power", "Operar y analizar información obtenida mediante sistemas sensores."],
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
