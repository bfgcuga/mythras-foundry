const option = (value) => {
  const [slug, label = slug] = value.split("|");
  return {
    id: `${slug}:${label}`,
    slug,
    label,
    specializationRequired: label.includes("(")
  };
};

const background = ({
  key,
  name,
  basic = [],
  choices = [],
  professional = [],
  styles = [],
  description = ""
}) => ({
  key,
  name,
  basic,
  choices: choices.map((choice, index) => ({
    id: `${key}-choice-${index}`,
    label: choice.label,
    count: choice.count ?? 1,
    options: choice.options.map(option)
  })),
  professional: professional.map(option),
  professionalChoiceCount: 3,
  styles,
  description
});

export const CULTURES = [
  background({
    key: "barbara",
    name: "Bárbara",
    basic: ["aguante", "atletismo", "conocimiento-local", "musculo", "percepcion", "primeros-auxilios"],
    choices: [{ label: "Medio de transporte", options: ["manejo-de-botes|Manejo de Botes", "montar|Montar"] }],
    professional: [
      "artesania|Artesanía (cualquiera)", "curacion|Curación", "musica|Música",
      "navegacion|Navegación", "orientacion|Orientación", "rastrear|Rastrear",
      "saber|Saber (cualquiera)", "supervivencia|Supervivencia"
    ],
    styles: ["Estilo de combate cultural"]
  }),
  background({
    key: "civilizada",
    name: "Civilizada",
    basic: ["conducir", "conocimiento-local", "enganar", "influencia", "ocultar", "perspicacia", "voluntad"],
    professional: [
      "arte|Arte (cualquiera)", "artesania|Artesanía (cualquiera)", "callejeo|Callejeo",
      "comerciar|Comerciar", "cortesia|Cortesía", "idioma|Idioma (cualquiera)",
      "musica|Música", "saber|Saber (cualquiera)"
    ],
    styles: ["Estilo de combate cultural"]
  }),
  background({
    key: "nomada",
    name: "Nómada",
    basic: ["aguante", "conocimiento-local", "percepcion", "primeros-auxilios", "sigilo"],
    choices: [{
      label: "Dos habilidades de transporte",
      count: 2,
      options: [
        "atletismo|Atletismo", "conducir|Conducir", "manejo-de-botes|Manejo de Botes",
        "montar|Montar", "nadar|Nadar"
      ]
    }],
    professional: [
      "artesania|Artesanía (cualquiera)", "cultura|Cultura (cualquiera)",
      "idioma|Idioma (cualquiera)", "musica|Música", "orientacion|Orientación",
      "rastrear|Rastrear", "saber|Saber (cualquiera)", "supervivencia|Supervivencia"
    ],
    styles: ["Estilo de combate cultural"]
  }),
  background({
    key: "primitiva",
    name: "Primitiva",
    basic: ["aguante", "conocimiento-local", "evadir", "musculo", "percepcion", "sigilo"],
    choices: [{
      label: "Habilidad de desplazamiento",
      options: ["atletismo|Atletismo", "manejo-de-botes|Manejo de Botes", "nadar|Nadar"]
    }],
    professional: [
      "artesania|Artesanía (cualquiera)", "curacion|Curación", "musica|Música",
      "orientacion|Orientación", "rastrear|Rastrear", "saber|Saber (cualquiera)",
      "supervivencia|Supervivencia"
    ],
    styles: ["Estilo de combate cultural"]
  })
];

const professions = [
  ["acompanante", "Acompañante",
    ["bailar", "cantar", "costumbres", "enganar", "influencia", "percepcion", "perspicacia"],
    ["arte|Arte (cualquiera)", "cortesia|Cortesía", "cultura|Cultura (cualquiera)", "idioma|Idioma (cualquiera)", "juego|Juego", "musica|Música", "seduccion|Seducción"]],
  ["adiestrador-animales", "Adiestrador de animales",
    ["aguante", "conocimiento-local", "conducir", "montar", "primeros-auxilios", "influencia", "voluntad"],
    ["artesania|Artesanía (cría de animales)", "comerciar|Comerciar", "curacion|Curación (especie concreta)", "ensenar|Enseñar (especie concreta)", "saber|Saber (especies concretas)", "rastrear|Rastrear", "supervivencia|Supervivencia"]],
  ["agente", "Agente",
    ["enganar", "evadir", "ocultar", "percepcion", "perspicacia", "sigilo"],
    ["callejeo|Callejeo", "cultura|Cultura (cualquiera)", "disfraz|Disfraz", "idioma|Idioma (cualquiera)", "juegos-de-manos|Juegos de Manos", "rastrear|Rastrear", "supervivencia|Supervivencia"],
    [], ["Estilo específico de agente o cultural"]],
  ["apostador", "Apostador",
    ["aguante", "atletismo", "conocimiento-local", "musculo", "percepcion", "voluntad"],
    ["actuar|Actuar", "burocracia|Burocracia", "callejeo|Callejeo", "comerciar|Comerciar", "cortesia|Cortesía", "juego|Juego", "investigacion|Investigación", "juegos-de-manos|Juegos de Manos"],
    [{ label: "Transporte", options: ["conducir|Conducir", "montar|Montar"] }]],
  ["artesano", "Artesano",
    ["conducir", "conocimiento-local", "influencia", "musculo", "percepcion", "perspicacia", "voluntad"],
    ["arte|Arte (cualquiera)", "artesania|Artesanía (principal)", "artesania|Artesanía (secundaria)", "callejeo|Callejeo", "comerciar|Comerciar", "ingenieria|Ingeniería", "mecanismos|Mecanismos"]],
  ["artista", "Artista",
    ["atletismo", "bailar", "cantar", "enganar", "influencia", "musculo", "perspicacia"],
    ["acrobacias|Acrobacias", "actuar|Actuar", "callejeo|Callejeo", "juegos-de-manos|Juegos de Manos", "musica|Música", "oratoria|Oratoria", "seduccion|Seducción"]],
  ["cazador", "Cazador",
    ["aguante", "atletismo", "conducir", "conocimiento-local", "montar", "percepcion", "sigilo"],
    ["artesania|Artesanía (relacionada con la caza)", "comerciar|Comerciar", "mecanismos|Mecanismos", "orientacion|Orientación", "rastrear|Rastrear", "saber|Saber (especie o región)", "supervivencia|Supervivencia"],
    [], ["Estilo de caza concreto o cultural"]],
  ["cazador-recompensas", "Cazador de recompensas",
    ["aguante", "atletismo", "evadir", "percepcion", "perspicacia", "sigilo"],
    ["burocracia|Burocracia", "callejeo|Callejeo", "comerciar|Comerciar", "cultura|Cultura (cualquiera)", "idioma|Idioma (cualquiera)", "rastrear|Rastrear", "supervivencia|Supervivencia (cualquiera)"],
    [], ["Estilo de combate (cualquiera)"]],
  ["cientifico", "Científico",
    ["conocimiento-local", "costumbres", "influencia", "lengua-materna", "percepcion", "perspicacia", "voluntad"],
    ["ciencia|Ciencia (cualquiera)", "cultura|Cultura (cualquiera)", "ensenar|Enseñar", "ingenieria|Ingeniería", "idioma|Idioma (cualquiera)", "investigacion|Investigación", "oratoria|Oratoria"]],
  ["contrabandista", "Contrabandista",
    ["conducir", "conocimiento-local", "costumbres", "enganar", "influencia", "ocultar", "perspicacia"],
    ["burocracia|Burocracia", "callejeo|Callejeo", "comerciar|Comerciar", "cultura|Cultura (cualquiera)", "idioma|Idioma (cualquiera)", "orientacion|Orientación", "astrogacion|Astrogación", "navegacion|Navegación"]],
  ["detective", "Detective",
    ["costumbres", "evadir", "influencia", "percepcion", "perspicacia", "sigilo"],
    ["burocracia|Burocracia", "callejeo|Callejeo", "cultura|Cultura (cualquiera)", "disfraz|Disfraz", "investigacion|Investigación", "idioma|Idioma (cualquiera)", "juegos-de-manos|Juegos de Manos", "saber|Saber (cualquiera)"],
    [], ["Estilo de arma corta o sin armas"]],
  ["erudito", "Erudito",
    ["conocimiento-local", "costumbres", "influencia", "lengua-materna", "percepcion", "perspicacia", "voluntad"],
    ["cultura|Cultura (cualquiera)", "ensenar|Enseñar", "idioma|Idioma (cualquiera)", "leer-escribir|Leer/Escribir", "oratoria|Oratoria", "saber|Saber (principal)", "saber|Saber (secundario)"]],
  ["explorador", "Explorador",
    ["aguante", "atletismo", "nadar", "percepcion", "primeros-auxilios", "sigilo"],
    ["cultura|Cultura (cualquiera)", "curacion|Curación", "idioma|Idioma (cualquiera)", "orientacion|Orientación", "rastrear|Rastrear", "saber|Saber (cualquiera)", "supervivencia|Supervivencia"],
    [], ["Estilo de caza concreto o cultural"]],
  ["funcionario", "Funcionario",
    ["conocimiento-local", "costumbres", "enganar", "influencia", "percepcion", "perspicacia", "voluntad"],
    ["burocracia|Burocracia", "comerciar|Comerciar", "cortesia|Cortesía", "idioma|Idioma (cualquiera)", "leer-escribir|Leer/Escribir", "oratoria|Oratoria", "saber|Saber (cualquiera)"]],
  ["granjero", "Granjero",
    ["aguante", "atletismo", "conducir", "conocimiento-local", "montar", "musculo", "percepcion"],
    ["artesania|Artesanía (cualquiera)", "comerciar|Comerciar", "orientacion|Orientación", "rastrear|Rastrear", "saber|Saber (agricultura)", "saber|Saber (cría de animales)", "supervivencia|Supervivencia"]],
  ["guerrero", "Guerrero",
    ["aguante", "atletismo", "evadir", "musculo", "pelea"],
    ["artesania|Artesanía (cualquiera)", "ingenieria|Ingeniería", "juego|Juego", "oratoria|Oratoria", "saber|Saber (estrategia y tácticas)", "saber|Saber (historia militar)", "supervivencia|Supervivencia"],
    [], ["Estilo cultural", "Estilo militar"]],
  ["ladron", "Ladrón",
    ["atletismo", "enganar", "evadir", "percepcion", "perspicacia", "sigilo"],
    ["actuar|Actuar", "callejeo|Callejeo", "comerciar|Comerciar", "disfraz|Disfraz", "forzar-cerraduras|Forzar Cerraduras", "juegos-de-manos|Juegos de Manos", "mecanismos|Mecanismos"],
    [], ["Estilo específico de ladrón o cultural"]],
  ["marinero", "Marinero",
    ["aguante", "atletismo", "conocimiento-local", "manejo-de-botes", "musculo", "nadar"],
    ["artesania|Artesanía (especialidad marinera)", "cultura|Cultura (cualquiera)", "idioma|Idioma (cualquiera)", "navegacion|Navegación", "orientacion|Orientación", "saber|Saber (cualquiera)", "supervivencia|Supervivencia"],
    [], ["Estilo específico de marinero o cultural"]],
  ["mecanico", "Mecánico",
    ["aguante", "conducir", "conocimiento-local", "costumbres", "influencia", "musculo", "voluntad"],
    ["artesania|Artesanía (principal)", "artesania|Artesanía (secundaria)", "callejeo|Callejeo", "comerciar|Comerciar", "electronica|Electrónica", "juego|Juego", "mecanismos|Mecanismos"]],
  ["medico", "Médico",
    ["bailar", "cantar", "conocimiento-local", "influencia", "perspicacia", "primeros-auxilios", "voluntad"],
    ["artesania|Artesanía (especialidad fisiológica)", "callejeo|Callejeo", "comerciar|Comerciar", "curacion|Curación", "idioma|Idioma (cualquiera)", "leer-escribir|Leer/Escribir (cualquiera)", "saber|Saber (cualquiera)"]],
  ["mercader", "Mercader",
    ["conducir", "conocimiento-local", "enganar", "influencia", "manejo-de-botes", "montar", "perspicacia"],
    ["callejeo|Callejeo", "comerciar|Comerciar", "cortesia|Cortesía", "cultura|Cultura (cualquiera)", "idioma|Idioma (cualquiera)", "navegacion|Navegación", "orientacion|Orientación"]],
  ["minero", "Minero",
    ["aguante", "atletismo", "cantar", "conocimiento-local", "musculo", "percepcion", "voluntad"],
    ["artesania|Artesanía (minería)", "comerciar|Comerciar", "ingenieria|Ingeniería", "mecanismos|Mecanismos", "orientacion|Orientación (bajo tierra)", "saber|Saber (minerales)", "supervivencia|Supervivencia"]],
  ["pastor", "Pastor",
    ["aguante", "conocimiento-local", "montar", "percepcion", "perspicacia", "primeros-auxilios"],
    ["artesania|Artesanía (crianza de animales)", "comerciar|Comerciar", "curacion|Curación (especie concreta)", "musica|Música", "orientacion|Orientación", "rastrear|Rastrear", "supervivencia|Supervivencia"],
    [], ["Estilo cultural o de pastoreo"]],
  ["periodista", "Periodista",
    ["conocimiento-local", "costumbres", "enganar", "influencia", "lengua-materna", "percepcion", "perspicacia"],
    ["burocracia|Burocracia", "callejeo|Callejeo", "cultura|Cultura (cualquiera)", "idioma|Idioma (cualquiera)", "oratoria|Oratoria", "politica|Política", "saber|Saber (cualquiera)"]],
  ["pescador", "Pescador",
    ["aguante", "atletismo", "conocimiento-local", "manejo-de-botes", "nadar", "percepcion", "sigilo"],
    ["artesania|Artesanía (cualquiera)", "comerciar|Comerciar", "navegacion|Navegación", "orientacion|Orientación", "saber|Saber (capturas principales)", "saber|Saber (capturas secundarias)", "supervivencia|Supervivencia"]],
  ["piloto", "Piloto",
    ["aguante", "conducir", "conocimiento-local", "evadir", "musculo", "percepcion", "voluntad"],
    ["callejeo|Callejeo", "cultura|Cultura (cualquiera)", "electronica|Electrónica", "mecanismos|Mecanismos", "orientacion|Orientación", "pilotaje|Pilotaje", "sensores|Sensores"]],
  ["politico", "Político",
    ["conocimiento-local", "costumbres", "enganar", "influencia", "lengua-materna", "percepcion", "perspicacia"],
    ["burocracia|Burocracia", "cortesia|Cortesía", "cultura|Cultura (cualquiera)", "idioma|Idioma (cualquiera)", "oratoria|Oratoria", "politica|Política", "saber|Saber (cualquiera)"]],
  ["sacerdote", "Sacerdote",
    ["bailar", "conocimiento-local", "costumbres", "enganar", "influencia", "perspicacia", "voluntad"],
    ["burocracia|Burocracia", "cortesia|Cortesía", "costumbres|Costumbres", "leer-escribir|Leer/Escribir (cualquiera)", "oratoria|Oratoria", "politica|Política", "saber|Saber (cualquiera)"]],
  ["sirviente", "Sirviente",
    ["conducir", "conocimiento-local", "costumbres", "enganar", "influencia", "percepcion", "perspicacia"],
    ["artesania|Artesanía (servicio)", "burocracia|Burocracia", "callejeo|Callejeo", "cortesia|Cortesía", "cultura|Cultura (cualquiera)", "idioma|Idioma (cualquiera)", "politica|Política"]],
  ["tecnico", "Técnico",
    ["aguante", "conducir", "conocimiento-local", "influencia", "musculo", "percepcion", "voluntad"],
    ["artesania|Artesanía (cualquiera)", "ciencia|Ciencia (cualquiera)", "comunicaciones|Comunicaciones", "electronica|Electrónica", "juego|Juego", "mecanismos|Mecanismos", "sensores|Sensores"]]
];

export const PROFESSIONS = professions.map(([
  key, name, basic, professional, choices = [], styles = []
]) => background({ key, name, basic, professional, choices, styles }));

export const CULTURE_SOURCES = CULTURES.map((entry) => ({
  name: entry.name,
  type: "culture",
  img: "icons/svg/village.svg",
  system: {
    key: entry.key,
    rules: JSON.stringify(entry),
    description: entry.description
  },
  flags: { "mythras-foundry": { backgroundKey: entry.key } }
}));

export const PROFESSION_SOURCES = PROFESSIONS.map((entry) => ({
  name: entry.name,
  type: "profession",
  img: "icons/svg/book.svg",
  system: {
    key: entry.key,
    rules: JSON.stringify(entry),
    description: entry.description
  },
  flags: { "mythras-foundry": { backgroundKey: entry.key } }
}));

export function getCulture(key) {
  return CULTURES.find((entry) => entry.key === key);
}

export function getProfession(key) {
  return PROFESSIONS.find((entry) => entry.key === key);
}
