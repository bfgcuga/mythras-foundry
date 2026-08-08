import { MYTHRAS_REVISED_SOURCE } from "./sources.js";

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
  ["adiestrador", "Adiestrador",
    ["aguante", "conocimiento-local", "conducir", "montar", "primeros-auxilios", "influencia", "voluntad"],
    ["artesania|Artesanía (cría de animales)", "comerciar|Comercio", "curacion|Curación (especie concreta)", "ensenar|Enseñar (especie concreta)", "saber|Saber (especies concretas)", "rastrear|Rastrear", "supervivencia|Supervivencia"]],
  ["agente", "Agente",
    ["enganar", "evadir", "ocultar", "percepcion", "perspicacia", "sigilo"],
    ["callejeo|Callejeo", "cultura|Cultura (cualquiera)", "disfraz|Disfraz", "idioma|Idioma (cualquiera)", "juegos-de-manos|Juego de Manos", "rastrear|Rastrear", "supervivencia|Supervivencia"],
    [], ["Estilo de Combate (Armas Ocultas)"]],
  ["alquimista", "Alquimista",
    ["aguante", "conocimiento-local", "costumbres", "percepcion", "perspicacia", "primeros-auxilios", "voluntad"],
    ["artesania|Artesanía (alquimia)", "callejeo|Callejeo", "comerciar|Comercio", "cultura|Cultura (cualquiera)", "curacion|Curación", "idioma|Idioma (cualquiera)", "leer-escribir|Leer/Escribir", "saber|Saber (especialidad alquímica concreta)"]],
  ["artesano", "Artesano",
    ["conducir", "conocimiento-local", "influencia", "musculo", "percepcion", "perspicacia", "voluntad"],
    ["arte|Arte (cualquiera)", "artesania|Artesanía (principal)", "artesania|Artesanía (secundaria)", "callejeo|Callejeo", "comerciar|Comercio", "ingenieria|Ingeniería", "mecanismos|Mecanismos"]],
  ["artista", "Artista",
    ["atletismo", "bailar", "cantar", "enganar", "influencia", "musculo", "perspicacia"],
    ["acrobacias|Acrobacias", "actuar|Actuar", "callejeo|Callejeo", "juegos-de-manos|Juego de Manos", "musica|Música", "oratoria|Oratoria", "seduccion|Seducción"]],
  ["cazador", "Cazador",
    ["aguante", "atletismo", "conocimiento-local", "montar", "percepcion", "sigilo"],
    ["artesania|Artesanía (relacionada con la caza)", "comerciar|Comercio", "mecanismos|Mecanismos", "orientacion|Orientación", "rastrear|Rastrear", "saber|Saber (especie concreta o regional)", "supervivencia|Supervivencia"],
    [], ["Estilo de Combate (estilo de caza concreto o cultural)"]],
  ["chaman", "Chamán",
    ["bailar", "conocimiento-local", "costumbres", "enganar", "influencia", "perspicacia", "voluntad"],
    ["atadura|Atadura (culto, tótem o tradición)", "curacion|Curación", "juegos-de-manos|Juego de Manos", "magia-comun|Magia Común", "oratoria|Oratoria", "saber|Saber (cualquiera)", "trance|Trance"]],
  ["cortesano", "Cortesano",
    ["bailar", "conocimiento-local", "costumbres", "enganar", "influencia", "percepcion", "perspicacia"],
    ["arte|Arte (cualquiera)", "burocracia|Burocracia", "cortesia|Cortesía", "cultura|Cultura (cualquiera)", "idioma|Idioma (cualquiera)", "oratoria|Oratoria", "saber|Saber (cualquiera)"]],
  ["erudito", "Erudito",
    ["conocimiento-local", "costumbres", "influencia", "lengua-materna", "percepcion", "perspicacia", "voluntad"],
    ["cultura|Cultura (cualquiera)", "ensenar|Enseñar", "idioma|Idioma (cualquiera)", "leer-escribir|Leer/Escribir", "oratoria|Oratoria", "saber|Saber (principal)", "saber|Saber (secundario)"]],
  ["explorador", "Explorador",
    ["aguante", "atletismo", "nadar", "percepcion", "primeros-auxilios", "sigilo"],
    ["cultura|Cultura (cualquiera)", "curacion|Curación", "idioma|Idioma (cualquiera)", "orientacion|Orientación", "rastrear|Rastrear", "saber|Saber (cualquiera)", "supervivencia|Supervivencia"],
    [], ["Estilo de Combate (estilo de caza concreto o cultural)"]],
  ["funcionario", "Funcionario",
    ["conocimiento-local", "costumbres", "enganar", "influencia", "percepcion", "perspicacia", "voluntad"],
    ["burocracia|Burocracia", "comerciar|Comercio", "cortesia|Cortesía", "idioma|Idioma (cualquiera)", "leer-escribir|Leer/Escribir", "oratoria|Oratoria", "saber|Saber (cualquiera)"]],
  ["granjero", "Granjero",
    ["aguante", "atletismo", "conducir", "conocimiento-local", "montar", "musculo", "percepcion"],
    ["artesania|Artesanía (cualquiera)", "comerciar|Comercio", "orientacion|Orientación", "rastrear|Rastrear", "saber|Saber (agricultura)", "saber|Saber (cría de animales)", "supervivencia|Supervivencia"]],
  ["guerrero", "Guerrero",
    ["aguante", "atletismo", "evadir", "musculo", "pelea"],
    ["artesania|Artesanía (cualquiera)", "ingenieria|Ingeniería", "juego|Juego", "oratoria|Oratoria", "saber|Saber (estrategia y tácticas)", "saber|Saber (historia militar)", "supervivencia|Supervivencia"],
    [], ["Estilo de Combate (estilo cultural)", "Estilo de Combate (estilo especializado)"]],
  ["hechicero", "Hechicero",
    ["conocimiento-local", "costumbres", "enganar", "influencia", "percepcion", "perspicacia", "voluntad"],
    ["idioma|Idioma (cualquiera)", "invocacion|Invocación (culto, escuela o grimorio)", "juegos-de-manos|Juego de Manos", "leer-escribir|Leer/Escribir", "magia-comun|Magia Común", "manipulacion|Manipulación", "saber|Saber (cualquiera)"]],
  ["ladron", "Ladrón",
    ["atletismo", "enganar", "evadir", "percepcion", "perspicacia", "sigilo"],
    ["actuar|Actuar", "callejeo|Callejeo", "comerciar|Comercio", "disfraz|Disfraz", "forzar-cerraduras|Forzar Cerraduras", "juegos-de-manos|Juego de Manos", "mecanismos|Mecanismos"],
    [], ["Estilo de Combate (Armas Ocultas)"]],
  ["marinero", "Marinero",
    ["aguante", "atletismo", "conocimiento-local", "manejo-de-botes", "musculo", "nadar"],
    ["artesania|Artesanía (especialidad concreta de a bordo)", "cultura|Cultura (cualquiera)", "idioma|Idioma (cualquiera)", "navegacion|Navegación", "orientacion|Orientación", "saber|Saber (cualquiera)", "supervivencia|Supervivencia"],
    [], ["Estilo de Combate (estilo concreto cultural o de a bordo)"]],
  ["medico", "Médico",
    ["bailar", "cantar", "conocimiento-local", "influencia", "perspicacia", "primeros-auxilios", "voluntad"],
    ["artesania|Artesanía (especialidad fisiológica concreta)", "callejeo|Callejeo", "comerciar|Comercio", "curacion|Curación", "idioma|Idioma (cualquiera)", "leer-escribir|Leer/Escribir", "saber|Saber (especialidad alquímica concreta)"]],
  ["mercader", "Mercader",
    ["conducir", "conocimiento-local", "enganar", "influencia", "manejo-de-botes", "montar", "perspicacia"],
    ["callejeo|Callejeo", "comerciar|Comercio", "cortesia|Cortesía", "cultura|Cultura (cualquiera)", "idioma|Idioma (cualquiera)", "navegacion|Navegación", "orientacion|Orientación"]],
  ["minero", "Minero",
    ["aguante", "atletismo", "cantar", "conocimiento-local", "musculo", "percepcion", "voluntad"],
    ["artesania|Artesanía (minería)", "comerciar|Comercio", "ingenieria|Ingeniería", "mecanismos|Mecanismos", "orientacion|Orientación (bajo tierra)", "saber|Saber (minerales)", "supervivencia|Supervivencia"]],
  ["mistico", "Místico",
    ["aguante", "atletismo", "evadir", "percepcion", "perspicacia", "voluntad"],
    ["arte|Arte (cualquiera)", "leer-escribir|Leer/Escribir", "magia-comun|Magia Común", "meditacion|Meditación", "misticismo|Misticismo", "musica|Música", "saber|Saber (cualquiera)"],
    [], ["Estilo de Combate (estilo cultural)"]],
  ["pastor", "Pastor",
    ["aguante", "conocimiento-local", "montar", "percepcion", "perspicacia", "primeros-auxilios"],
    ["artesania|Artesanía (crianza de animales)", "comerciar|Comercio", "curacion|Curación (especie concreta)", "musica|Música", "orientacion|Orientación", "rastrear|Rastrear", "supervivencia|Supervivencia"],
    [], ["Estilo de Combate (estilo de armas cultural o de pastoreo concreto)"]],
  ["pescador", "Pescador",
    ["aguante", "atletismo", "conocimiento-local", "manejo-de-botes", "nadar", "percepcion", "sigilo"],
    ["artesania|Artesanía (cualquiera)", "comerciar|Comercio", "navegacion|Navegación", "orientacion|Orientación", "saber|Saber (capturas principales)", "saber|Saber (capturas secundarias)", "supervivencia|Supervivencia"]],
  ["sacerdote", "Sacerdote",
    ["bailar", "conocimiento-local", "costumbres", "enganar", "influencia", "perspicacia", "voluntad"],
    ["burocracia|Burocracia", "devocion|Devoción (panteón, culto o deidad)", "exhortacion|Exhortación", "leer-escribir|Leer/Escribir", "magia-comun|Magia Común", "oratoria|Oratoria", "saber|Saber (cualquiera)"]]
];

export const CULTURE_PROFESSION_KEYS = Object.freeze({
  civilizada: Object.freeze(professions.map(([key]) => key)),
  barbara: Object.freeze([
    "adiestrador", "artesano", "artista", "cazador", "chaman", "erudito",
    "explorador", "funcionario", "granjero", "guerrero", "ladron", "marinero",
    "medico", "mercader", "minero", "mistico", "pastor", "pescador", "sacerdote"
  ]),
  nomada: Object.freeze([
    "adiestrador", "artesano", "cazador", "chaman", "erudito", "explorador",
    "funcionario", "guerrero", "ladron", "marinero", "medico", "mercader",
    "pastor", "pescador", "sacerdote"
  ]),
  primitiva: Object.freeze([
    "adiestrador", "artesano", "cazador", "chaman", "erudito", "explorador",
    "guerrero", "ladron", "marinero", "medico", "pescador"
  ])
});

export const PROFESSIONS = professions.map(([
  key, name, basic, professional, choices = [], styles = []
]) => background({ key, name, basic, professional, choices, styles }));

export const CULTURE_SOURCES = CULTURES.map((entry) => ({
  name: entry.name,
  type: "culture",
  img: "icons/svg/village.svg",
  system: {
    key: entry.key,
    source: MYTHRAS_REVISED_SOURCE,
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
    source: MYTHRAS_REVISED_SOURCE,
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

export function professionsForCulture(cultureKey) {
  const allowed = new Set(CULTURE_PROFESSION_KEYS[cultureKey] ?? []);
  return PROFESSIONS.filter((entry) => allowed.has(entry.key));
}

export function professionAvailableToCulture(professionKey, cultureKey) {
  return (CULTURE_PROFESSION_KEYS[cultureKey] ?? []).includes(professionKey);
}
