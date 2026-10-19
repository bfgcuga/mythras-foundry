import { creature, npcSystem, location, skill, style, weapon, traitItem } from "./creature-helpers.js";
import { MYTHRAS_REVISED_SOURCE } from "./sources.js";

// Mythras básico revisado, págs. 249–251. Values are the printed examples,
// not re-derived from the rounded averages of their characteristic dice.
export const ELEMENTAL_ROWS = Object.freeze([
  // m³, size, total natural damage, AP, initiative, protection, HP, combat, evade, brawn, perception, will
  [1, "", "0", 2, 7, 1, 10, 57, 52, 42, 45, 64],
  [2, "M", "1d2", 2, 9, 1, 16, 63, 56, 50, 49, 70],
  [3, "G", "1d6", 2, 10, 2, 22, 69, 60, 58, 53, 76],
  [4, "G", "1d10", 2, 12, 2, 28, 75, 64, 66, 57, 82],
  [5, "E", "1d12", 3, 13, 3, 34, 81, 68, 74, 61, 88],
  [6, "E", "2d6", 3, 15, 3, 40, 87, 72, 82, 65, 94],
  [7, "D", "2d6", 3, 16, 4, 46, 93, 76, 90, 69, 100],
  [8, "C", "1d8+1d6", 3, 18, 4, 52, 99, 80, 98, 73, 106],
  [9, "C", "2d8", 4, 19, 5, 58, 105, 84, 106, 77, 112],
  [10, "C", "1d10+1d8", 4, 21, 5, 64, 111, 88, 114, 81, 118]
]);
const types = [
  ["gnomo", "Gnomo", "tierra", 6, "Manipula tierra y roca: crea túneles, pozos y desprendimientos. Ataca golpeando, lanzando rocas o triturando al envolver."],
  ["ondina", "Ondina", "agua", 8, "Manipula corrientes, remolinos, mareas y oleaje. Ataca con olas, chorros a presión o aplastando a la víctima al envolverla."],
  ["salamandra", "Salamandra", "fuego", 8, "Manipula llamas, luz y calor. Ataca con látigos ígneos, chorros de fuego o inmolando a la víctima al envolverla."],
  ["silfo", "Silfo", "aire", 10, "Manipula vientos y suspende objetos en el aire. Ataca con objetos, empujones o desgarrando a la víctima con un ciclón al envolverla."],
  ["sombra", "Sombra", "oscuridad", 10, "Concentra oscuridad y crea zonas de absoluta negrura. Ataca robando calor con su toque o congelando a la víctima al envolverla."]
];
const engulfRules = "Engullir: una tirada de ataque que solo se puede esquivar. Inflige el daño elemental en todas las localizaciones de la víctima al acertar y al comienzo de cada asalto mientras siga envuelta. La armadura protege contra golpes, pero no contra Engullir. Escapar exige Evadir, Músculo o Acrobacias enfrentado al Músculo del elemental. Aplicación manual.";
const paragraph = (text) => `<p>${text}</p>`;
const provenance = (page) => ({ "mythras-foundry": { source: "mythras-basic-revised", sourcePage: page } });
const allCharacteristics = ["strength", "constitution", "size", "dexterity", "intelligence", "power", "charisma"];

function globalBody(hp, protection = 0, formula = "") {
  const body = location("body", "Cuerpo", 1, 20, protection, hp);
  body.system.maxHitPointsFormula = formula;
  return body;
}

function elemental(type, row) {
  const [key, name, element, movement, powers] = type;
  const [volume, size, damage, ap, initiative, protection, hp, combat, evade, brawn, perception, will] = row;
  const system = npcSystem({ species: `${name} (${volume} m³)`, instinct: true,
    values: { strength: 7 + 4 * volume, dexterity: 4 + 2 * volume,
      intelligence: 7 + volume, power: 4 + 3 * volume },
    formulas: { strength: `2d6+${4 * volume}`, dexterity: `1d6+${2 * volume}`,
      intelligence: `2d6+${volume}`, power: `1d6+${3 * volume}` },
    actionPoints: ap, movement, magicPoints: 4 + 3 * volume,
    damageModifier: damage === "0" ? "0" : `+${damage}`,
    armorNotes: "Protección contra daño mágico. Inmunidades y elemento opuesto se aplican manualmente.",
    description: paragraph(`Fuente: ${MYTHRAS_REVISED_SOURCE}, págs. 249–251. Volumen: ${volume} m³. Elemento: ${element}.`)
      + paragraph(powers)
      + paragraph("Solo el daño mágico de otro elemento puede herirlo. Las armas mundanas y la magia de su propio elemento no le causan daño. De un arma mejorada mágicamente solo se aplica el daño mágico, sin el modificador de daño del portador. La protección impresa reduce el daño mágico; el elemento opuesto, elegido para la campaña, causa doble daño. Estas condiciones se resuelven manualmente antes de aplicar el daño.")
      + paragraph(engulfRules)
      + paragraph("A 0 PG se disipa y regresa al lugar de invocación; no muere. No sufre heridas graves ni críticas. El director resuelve la disipación tras el aviso de PG agotados.")
      + (volume === 1 ? paragraph("Este volumen carece de armas naturales y de daño físico según la tabla.") : "") });
  Object.assign(system, { hitPointMode: "global", absentCharacteristics: ["constitution", "size", "charisma"] });
  system.attributeOverrides.initiative = { mode: "manual", value: initiative, formula: "" };
  const attack = volume > 1 ? [weapon("elemental-strike", "Golpe elemental", { damage, size,
    reach: "Especial", damageModifierMode: "none", linkedLocationKey: "body" })] : [];
  const traits = [traitItem("engullir", engulfRules),
    traitItem("inmunidad", `Inmune a armas mundanas y a la magia de su propio elemento (${element}). Aplicación manual.`),
    traitItem("vulnerabilidad", "El elemento opuesto de la campaña le causa doble daño mágico. Aplicación manual.")]
    .map((item) => ({ ...item, system: { ...item.system, source: `${MYTHRAS_REVISED_SOURCE}, págs. 249–251` } }));
  return creature(`elemental-${key}-${volume}`, system.identity.species, system, [
    globalBody(hp, protection, `1d6+${6 * volume}`), ...traits,
    skill("evadir", "Evadir", evade), skill("musculo", "Músculo", brawn),
    skill("percepcion", "Percepción", perception), skill("voluntad", "Voluntad", will),
    style("elemental-combat", "Combate elemental", combat, attack.map((item) => item.buildKey)), ...attack
  ], "icons/svg/mystery-man.svg", provenance(249));
}

export const SWARM_ROWS = Object.freeze([
  // Representative TAM, original range, total damage, AP.
  [3, "1–5", "1", 1], [9, "6–11", "1d2", 2], [15, "12–18", "1d3", 3],
  [22, "19–25", "1d4", 4], [30, "26–33", "1d6", 5]
]);

function swarm([size, range, damage, ap]) {
  const name = `Enjambre (TAM ${size})`;
  const system = npcSystem({ species: name, values: { size }, formulas: {}, actionPoints: ap,
    movement: 4, magicPoints: 0, damageModifier: "0", armorNotes: "Sin armadura natural.",
    description: paragraph(`Fuente: ${MYTHRAS_REVISED_SOURCE}, págs. 254–255. Ejemplo del intervalo de TAM ${range}; PG iguales a TAM.`)
      + paragraph("Solo los ataques de área que cubran al menos el 75 % del enjambre pueden dañarlo. El director comprueba esta condición antes de aplicar el daño. A 0 PG resuelve manualmente su destrucción o dispersión.")
      + paragraph("Su ataque 60 % inflige el daño indicado simultáneamente a cada localización cubierta. La armadura protege, pero cada ataque exitoso reduce en 1 su protección contra este enjambre al colarse los insectos bajo ella. La ropa normal no protege salvo que sea especialmente gruesa. El seguimiento de zonas, protección y víctimas es manual.")
      + paragraph("No genera efectos de combate ni usa sus PA para parar o evadir salvo frente a ataques de área. Tras 1d3 asaltos puede tirar Voluntad para dejar de atacar. La toxicidad de una variedad venenosa acumula el daño sufrido por la víctima; cada nuevo ataque exige Aguante frente a la toxicidad acumulada. Aplicación manual.")
      + paragraph("La fuente no proporciona iniciativa: se deja en 0 como valor operativo editable por el director. Carece de características distintas de TAM; PM, Suerte y modificador de daño son 0.") });
  Object.assign(system, { hitPointMode: "global", absentCharacteristics: allCharacteristics.filter((key) => key !== "size") });
  system.attributeOverrides.initiative = { mode: "manual", value: 0, formula: "" };
  return creature(`swarm-${size}`, name, system, [globalBody(size),
    skill("atletismo", "Atletismo", 60), skill("volar", "Volar", 60), skill("voluntad", "Voluntad", 30),
    style("swarm-attack", "Ataque de enjambre", 60, ["swarm-bites"]),
    weapon("swarm-bites", "Aguijones o mordiscos", { damage, size: "Especial", reach: "Especial",
      damageModifierMode: "none", linkedLocationKey: "body" })
  ], "icons/svg/mystery-man.svg", provenance(254));
}

export const GLOBAL_CREATURE_SOURCES = Object.freeze([
  ...types.flatMap((type) => ELEMENTAL_ROWS.map((row) => elemental(type, row))),
  ...SWARM_ROWS.map(swarm)
]);
