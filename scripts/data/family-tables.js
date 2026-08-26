import { AGE_CATEGORIES } from "../rules/background-generation.js";
import { MYTHRAS_REVISED_SOURCE } from "./sources.js";

const localized = (es, en) => Object.freeze({ es, en });
const result = (key, range, text, rules = {}) => Object.freeze({
  key, range: Object.freeze(range), text: localized(text[0], text[1]), ...rules
});

export const FAMILY_TABLES = Object.freeze([
  Object.freeze({
    key: "parents", name: localized("Padres", "Parents"), formula: "1d100",
    results: Object.freeze([
      result("both-alive", [1, 20], ["Ambos padres vivos", "Both parents alive"]),
      result("father-alive", [21, 40], ["Solo vive el padre", "Only the father is alive"]),
      result("parent-and-stepparent", [41, 60],
        ["Uno de los padres biológicos más un padrastro o madrastra",
          "One biological parent and one stepparent"]),
      result("mother-alive", [61, 80], ["Solo vive la madre", "Only the mother is alive"]),
      result("both-dead", [81, 100], ["Ambos padres muertos", "Both parents deceased"])
    ])
  }),
  Object.freeze({
    key: "siblings", name: localized("Hermanos", "Siblings"), formula: "1d100",
    results: Object.freeze([
      result("none", [1, 10], ["Ninguno", "None"], { count: 0 }),
      result("d4", [11, 30], ["1d4 hermanos", "1d4 siblings"], { count: "1d4" }),
      result("d6", [31, 70], ["1d6 hermanos", "1d6 siblings"], { count: "1d6" }),
      result("d8", [71, 90], ["1d8 hermanos", "1d8 siblings"], { count: "1d8" }),
      result("d10", [91, 100], ["1d10 hermanos", "1d10 siblings"], { count: "1d10" })
    ])
  }),
  Object.freeze({
    key: "extendedFamily", name: localized("Familia extendida", "Extended family"),
    formula: "1d100", results: Object.freeze([
      result("none", [1, 10], ["Sin familia extendida", "No extended family"],
        { relatives: { grandparents: 0, auntsUncles: 0, cousins: 0 } }),
      result("small", [11, 30], ["Familia extendida pequeña", "Small extended family"],
        { relatives: { grandparents: "1d2+1", auntsUncles: "1d2", cousins: "1d3" } }),
      result("average", [31, 70], ["Familia extendida media", "Average extended family"],
        { relatives: { grandparents: "1d3+1", auntsUncles: "1d3", cousins: "1d4" } }),
      result("large", [71, 90], ["Familia extendida grande", "Large extended family"],
        { relatives: { grandparents: "1d3", auntsUncles: "1d4", cousins: "1d6" } }),
      result("very-large", [91, 100], ["Familia extendida muy grande", "Very large extended family"],
        { relatives: { grandparents: "1d3+1", auntsUncles: "1d6", cousins: "1d8" } })
    ])
  }),
  Object.freeze({
    key: "familyReputation", name: localized("Reputación familiar", "Family reputation"),
    formula: "1d100", results: Object.freeze([
      result("terrible", [1, 15],
        ["La familia tiene mala reputación", "The family has a bad reputation"],
        { relationship: { formula: "1d3", group: "enemyOrRival" } }),
      result("questioned", [16, 35],
        ["La reputación de la familia es sólida, pero puede haber algún secreto o esqueleto en el armario que es mejor que no se sepa",
          "The family has a solid reputation, but may have a secret or skeleton in the closet best left unknown"],
        { relationship: { formula: 1, group: "enemyOrRival" } }),
      result("solid", [36, 65],
        ["Una sólida reputación familiar", "A solid family reputation"]),
      result("good", [66, 85],
        ["La familia disfruta de una buena reputación, aunque puede haber quien quiera mancillarla desde dentro o desde fuera",
          "The family enjoys a good reputation, though someone may wish to tarnish it from within or without"],
        { relationship: { formula: 1, group: "allyOrContact" } }),
      result("excellent", [86, 100],
        ["La reputación familiar está inmaculada y goza de una excelente posición",
          "The family reputation is immaculate and enjoys excellent standing"],
        { relationship: { formula: "1d3", group: "allyOrContact" } })
    ])
  }),
  Object.freeze({
    key: "familyConnections", name: localized("Conexiones", "Connections"),
    formula: "1d100", results: Object.freeze([
      result("none", [1, 20], ["Sin conexiones destacadas", "No notable connections"],
        { connectionRolls: 0 }),
      result("community", [21, 80],
        ["La familia disfruta de conexiones razonables dentro de su comunidad",
          "The family enjoys reasonable connections within its community"],
        { connectionRolls: 1 }),
      result("local", [81, 90],
        ["La familia está bien conectada dentro de la comunidad y es conocida por quienes ostentan el poder a nivel local",
          "The family is well connected in the community and known by those holding power locally"],
        { connectionRolls: 2 }),
      result("regional", [91, 95],
        ["Como en el caso anterior, pero la familia también goza de buena posición respecto a quienes ostentan el poder a nivel regional",
          "As above, but the family also has good standing with those holding power regionally"],
        { connectionRolls: 3 }),
      result("national", [96, 100],
        ["Como en el caso anterior, pero la familia también goza de buena posición respecto a quienes ostentan el poder a nivel nacional",
          "As above, but the family also has good standing with those holding power nationally"],
        { connectionRolls: 4 })
    ])
  })
]);

const TABLES_BY_KEY = new Map(FAMILY_TABLES.map((table) => [table.key, table]));
const languageKey = (language) => String(language).toLowerCase().startsWith("en") ? "en" : "es";
const text = (value, language) => value[languageKey(language)];

function rollTableResultText(tableKey, entry) {
  if (tableKey === "extendedFamily") {
    const { grandparents, auntsUncles, cousins } = entry.relatives;
    return `Abuelos: ${grandparents}; tíos y tías: ${auntsUncles}; primos: ${cousins}`;
  }
  if (tableKey === "familyReputation" && entry.relationship) {
    const group = entry.relationship.group === "allyOrContact"
      ? "contactos o aliados"
      : "enemigos o rivales";
    return `${text(entry.text, "es")} — ${entry.relationship.formula} ${group}`;
  }
  if (tableKey === "familyConnections" && entry.connectionRolls > 0) {
    const times = entry.connectionRolls === 1 ? "una vez" : `${entry.connectionRolls} veces`;
    return `${text(entry.text, "es")} — Tira 1d4 ${times}: 1 aliado, 2 contacto, 3 enemigo, 4 rival`;
  }
  return text(entry.text, "es");
}

export const FAMILY_TABLE_SOURCES = Object.freeze(FAMILY_TABLES.map((table) => ({
  buildKey: `family-${table.key}`,
  key: table.key,
  name: text(table.name, "es"),
  formula: table.formula,
  source: MYTHRAS_REVISED_SOURCE,
  results: table.results.map((entry) => ({
    key: entry.key,
    range: entry.range,
    text: rollTableResultText(table.key, entry)
  }))
})));

export function familyTableResult(tableKey, percentile) {
  const table = TABLES_BY_KEY.get(tableKey);
  const roll = Math.max(1, Math.min(100, Number(percentile) || 1));
  return table?.results.find((entry) => roll >= entry.range[0] && roll <= entry.range[1]);
}

async function resolveRelationship(group, count, roll, relationships) {
  for (let index = 0; index < count; index += 1) {
    const choice = Number(await roll("1d2"));
    const field = group === "allyOrContact"
      ? (choice === 1 ? "allies" : "contacts")
      : (choice === 1 ? "enemies" : "rivals");
    relationships[field] += 1;
  }
}

const relationshipText = (field, count, language) => {
  const labels = {
    es: { allies: ["aliado", "aliados"], contacts: ["contacto", "contactos"],
      enemies: ["enemigo", "enemigos"], rivals: ["rival", "rivales"] },
    en: { allies: ["ally", "allies"], contacts: ["contact", "contacts"],
      enemies: ["enemy", "enemies"], rivals: ["rival", "rivals"] }
  }[languageKey(language)];
  return `${count} ${labels[field][count === 1 ? 0 : 1]}`;
};

export async function resolveFamilyTable(tableKey, percentile, roll, language = "es") {
  const entry = familyTableResult(tableKey, percentile);
  if (!entry) throw new Error(`Unknown family table: ${tableKey}`);
  const secondaryRolls = [];
  const rollFormula = async (formula) => {
    if (typeof formula === "number") return formula;
    const total = Number(await roll(formula));
    secondaryRolls.push({ formula, total });
    return total;
  };
  const fields = {};
  const relationships = { allies: 0, contacts: 0, enemies: 0, rivals: 0 };
  if (tableKey === "parents") fields.parents = text(entry.text, language);
  if (tableKey === "siblings") {
    const count = await rollFormula(entry.count);
    fields.siblings = languageKey(language) === "es"
      ? `${count} ${count === 1 ? "hermano" : "hermanos"}`
      : `${count} ${count === 1 ? "sibling" : "siblings"}`;
  }
  if (tableKey === "extendedFamily") {
    const relatives = {};
    for (const [key, formula] of Object.entries(entry.relatives)) {
      relatives[key] = await rollFormula(formula);
    }
    fields.extendedFamily = languageKey(language) === "es"
      ? `Abuelos: ${relatives.grandparents}; tíos y tías: ${relatives.auntsUncles}; primos: ${relatives.cousins}`
      : `Grandparents: ${relatives.grandparents}; aunts and uncles: ${relatives.auntsUncles}; cousins: ${relatives.cousins}`;
  }
  if (tableKey === "familyReputation") {
    fields.familyReputation = text(entry.text, language);
    if (entry.relationship) {
      const count = await rollFormula(entry.relationship.formula);
      await resolveRelationship(entry.relationship.group, count, rollFormula, relationships);
    }
  }
  if (tableKey === "familyConnections") {
    fields.familyConnections = text(entry.text, language);
    const connectionFields = ["allies", "contacts", "enemies", "rivals"];
    for (let index = 0; index < entry.connectionRolls; index += 1) {
      const connectionRoll = await rollFormula("1d4");
      relationships[connectionFields[Math.max(1, Math.min(4, connectionRoll)) - 1]] += 1;
    }
  }
  for (const [field, count] of Object.entries(relationships)) {
    if (count > 0) fields[field] = relationshipText(field, count, language);
  }
  return { key: tableKey, resultKey: entry.key, percentile: Number(percentile),
    result: text(entry.text, language), secondaryRolls, fields };
}

export function resolveMarriage({ percentile, influence, childCount = 0, childAges = [] },
  language = "es") {
  const threshold = Math.ceil(Math.max(0, Number(influence)) / 10);
  const roll = Number(percentile);
  const status = roll <= threshold ? "married" : roll <= influence ? "betrothed" : "single";
  const labels = languageKey(language) === "es"
    ? { married: "Casado/a", betrothed: "Prometido/a", single: "Sin compromiso",
      noChildren: "Sin hijos", children: "hijos", ages: "edades" }
    : { married: "Married", betrothed: "Betrothed", single: "Unattached",
      noChildren: "No children", children: "children", ages: "ages" };
  const fields = { partner: labels[status] };
  if (status === "married") {
    fields.children = childCount === 0
      ? labels.noChildren
      : `${childCount} ${labels.children}; ${labels.ages}: ${childAges.join(", ")}`;
  }
  return { key: "marriage", resultKey: status, percentile: roll, influence: Number(influence),
    result: labels[status], secondaryRolls: [], fields };
}

export function childAgeFormula(ageCategory) {
  const index = AGE_CATEGORIES.findIndex(({ key }) => key === ageCategory);
  if (index < 2) return "1d4";
  return AGE_CATEGORIES[index - 1].ageFormula;
}

export function composeGeneratedNarrative(generated, original, notesLabel) {
  const generatedText = generated.filter(Boolean).join("\n");
  const originalText = String(original ?? "").trim();
  if (!originalText) return generatedText;
  return `${generatedText}\n${notesLabel}: ${originalText}`;
}
