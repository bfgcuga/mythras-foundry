import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { compilePack } from "@foundryvtt/foundryvtt-cli/index.mjs";
import {
  CULTURE_SOURCES,
  PROFESSION_SOURCES
} from "../data/backgrounds.js";
import { ALL_SKILL_SOURCES } from "../data/skills.js";
import { WEAPON_SOURCES } from "../data/weapons.js";
import { EQUIPMENT_SOURCES } from "../data/equipment.js";
import { ARMOR_SOURCES } from "../data/armor.js";
import { MACRO_SOURCES } from "../data/macros.js";
import { TRAIT_SOURCES } from "../data/traits.js";
import { CREATURE_SOURCES } from "../data/creatures.js";
import { SOCIAL_CLASS_TABLE_SOURCES } from "../data/social-classes.js";
import { FAMILY_TABLE_SOURCES } from "../data/family-tables.js";
import { BACKGROUND_EVENT_TABLE_SOURCES } from "../data/background-events.js";
import { COMBAT_STYLE_SOURCES } from "../data/combat-styles.js";
import { combatEffectRule, combatEffectSlug } from "../rules/combat-effects.js";
import { deterministicPackId } from "./pack-ids.mjs";

const projectRoot = resolve(import.meta.dirname, "../..");

const combatEffectsDocument = JSON.parse(await readFile(
  resolve(projectRoot, "data/mythras_efectos_combate.json"), "utf8"
));
const COMBAT_EFFECT_SOURCES = combatEffectsDocument.efectos_combate.map((entry) => {
  const buildKey = combatEffectSlug(entry.nombre);
  const rule = combatEffectRule({ key: buildKey });
  const table = entry.nombre === "Empalar" ? combatEffectsDocument.tabla_empalamiento : null;
  return {
    buildKey,
    name: entry.nombre,
    type: "combatEffect",
    img: "icons/svg/combat.svg",
    system: {
      key: buildKey,
      source: combatEffectsDocument.fuente,
      offensive: Boolean(entry.ofensivo),
      defensive: Boolean(entry.defensivo),
      weaponRestriction: entry.tipo_arma_especifica ?? "",
      rollRestriction: entry.tirada_especifica ?? "",
      stackable: Boolean(entry.apilable),
      ruleKey: rule.ruleKey,
      stage: rule.stage,
      requiresWound: Boolean(rule.requiresWound),
      endurance: Boolean(rule.endurance),
      tableColumns: table?.columnas ?? [],
      tableRows: table?.filas ?? [],
      tableNote: table?.regla_adicional ?? "",
      description: entry.descripcion
    },
    flags: { "mythras-foundry": { source: "mythras-basic-revised" } }
  };
});

async function buildPack(name, sources, idNamespace) {
  const sourceDirectory = resolve(projectRoot, `.build/packs-src/${name}`);
  const outputDirectory = resolve(projectRoot, `packs/${name}`);
  await rm(sourceDirectory, { recursive: true, force: true });
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(sourceDirectory, { recursive: true });

  for (const [index, source] of sources.entries()) {
    const key = source.buildKey ?? source.system.slug ?? source.system.key ?? source.system.profileKey;
    const id = createHash("sha256")
      .update(`mythras-foundry.${idNamespace}.${key}`)
      .digest("hex")
      .slice(0, 16);
    const document = {
      _key: `!items!${id}`,
      _id: id,
      name: source.name,
      type: source.type,
      img: source.img ?? "icons/svg/book.svg",
      system: source.system,
      effects: [],
      folder: null,
      sort: index * 1000,
      ownership: { default: 0 },
      flags: source.flags
    };
    await writeFile(
      resolve(sourceDirectory, `${key}_${id}.json`),
      `${JSON.stringify(document, null, 2)}\n`,
      "utf8"
    );
  }

  await compilePack(sourceDirectory, outputDirectory, { log: true });
  console.log(`Compendio ${name} generado con ${sources.length} elementos.`);
}

async function buildMacroPack(name, sources, idNamespace) {
  const sourceDirectory = resolve(projectRoot, `.build/packs-src/${name}`);
  const outputDirectory = resolve(projectRoot, `packs/${name}`);
  await rm(sourceDirectory, { recursive: true, force: true });
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(sourceDirectory, { recursive: true });

  for (const [index, source] of sources.entries()) {
    const id = createHash("sha256")
      .update(`mythras-foundry.${idNamespace}.${source.buildKey}`)
      .digest("hex")
      .slice(0, 16);
    const document = {
      _key: `!macros!${id}`,
      _id: id,
      name: source.name,
      type: source.type,
      img: source.img,
      scope: "global",
      command: source.command,
      folder: null,
      sort: index * 1000,
      ownership: { default: 0 },
      flags: source.flags
    };
    await writeFile(resolve(sourceDirectory, `${source.buildKey}_${id}.json`),
      `${JSON.stringify(document, null, 2)}\n`, "utf8");
  }

  await compilePack(sourceDirectory, outputDirectory, { log: true });
  console.log(`Compendio ${name} generado con ${sources.length} macros.`);
}

async function buildActorPack(name, sources, idNamespace) {
  const sourceDirectory = resolve(projectRoot, `.build/packs-src/${name}`);
  const outputDirectory = resolve(projectRoot, `packs/${name}`);
  await rm(sourceDirectory, { recursive: true, force: true });
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(sourceDirectory, { recursive: true });

  for (const [index, source] of sources.entries()) {
    const actorId = deterministicPackId(`${idNamespace}.${source.buildKey}`);
    const itemIds = new Map((source.items ?? []).map((item) => [
      `${item.type}:${item.buildKey}`,
      deterministicPackId(`${idNamespace}.${source.buildKey}.item.${item.type}.${item.buildKey}`)
    ]));
    const items = (source.items ?? []).map((item, itemIndex) => {
      const linkedLocationId = item.linkedLocationKey
        ? itemIds.get(`hitLocation:${item.linkedLocationKey}`) ?? "" : item.system.linkedLocationId;
      const itemId = itemIds.get(`${item.type}:${item.buildKey}`);
      return {
        _key: `!actors.items!${actorId}.${itemId}`,
        _id: itemId,
        name: item.name,
        type: item.type,
        img: item.img ?? "icons/svg/item-bag.svg",
        system: { ...item.system, ...(item.type === "weapon" ? { linkedLocationId } : {}) },
        effects: [],
        folder: null,
        sort: itemIndex * 1000,
        ownership: { default: 0 },
        flags: item.flags
      };
    });
    const document = {
      _key: `!actors!${actorId}`,
      _id: actorId,
      name: source.name,
      type: source.type,
      img: source.img,
      system: source.system,
      prototypeToken: source.prototypeToken,
      items,
      effects: [],
      folder: null,
      sort: index * 1000,
      ownership: { default: 0 },
      flags: source.flags
    };
    await writeFile(resolve(sourceDirectory, `${source.buildKey}_${actorId}.json`),
      `${JSON.stringify(document, null, 2)}\n`, "utf8");
  }

  await compilePack(sourceDirectory, outputDirectory, { log: true });
  console.log(`Compendio ${name} generado con ${sources.length} actores.`);
}

async function buildRollTablePack(name, sources, idNamespace) {
  const sourceDirectory = resolve(projectRoot, `.build/packs-src/${name}`);
  const outputDirectory = resolve(projectRoot, `packs/${name}`);
  await rm(sourceDirectory, { recursive: true, force: true });
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(sourceDirectory, { recursive: true });

  for (const [index, source] of sources.entries()) {
    const tableId = deterministicPackId(`${idNamespace}.${source.buildKey}`);
    const results = source.results.map((result, resultIndex) => {
      const resultId = deterministicPackId(
        `${idNamespace}.${source.buildKey}.result.${result.key}`
      );
      return {
        _key: `!tables.results!${tableId}.${resultId}`,
        _id: resultId,
        type: 0,
        text: result.text ?? `<strong>${result.name}</strong> (×${result.moneyModifier})<br>${result.resources}`,
        img: "icons/svg/d20-grey.svg",
        documentCollection: "",
        documentId: null,
        weight: result.range[1] - result.range[0] + 1,
        range: result.range,
        drawn: false,
        flags: { "mythras-foundry": result.text
          ? { resultKey: result.key }
          : {
            socialClassKey: result.key,
            moneyModifier: result.moneyModifier,
            titles: result.titles,
            resources: result.resources
          } }
      };
    });
    const document = {
      _key: `!tables!${tableId}`,
      _id: tableId,
      name: source.name,
      img: "icons/svg/d20-black.svg",
      description: `<p>Fuente: ${source.source}</p>`,
      results,
      formula: source.formula,
      replacement: true,
      displayRoll: true,
      folder: null,
      sort: index * 1000,
      ownership: { default: 0 },
      flags: { "mythras-foundry": source.cultureKey
        ? { cultureKey: source.cultureKey }
        : { tableKey: source.key } }
    };
    await writeFile(resolve(sourceDirectory, `${source.buildKey}_${tableId}.json`),
      `${JSON.stringify(document, null, 2)}\n`, "utf8");
  }

  await compilePack(sourceDirectory, outputDirectory, { log: true });
  console.log(`Compendio ${name} generado con ${sources.length} tablas.`);
}

const packBuilders = new Map([
  ["skills", () => buildPack("skills", ALL_SKILL_SOURCES, "skill")],
  ["cultures", () => buildPack("cultures", CULTURE_SOURCES, "culture")],
  ["professions", () => buildPack("professions", PROFESSION_SOURCES, "profession")],
  ["weapons", () => buildPack("weapons", WEAPON_SOURCES, "weapon")],
  ["equipment", () => buildPack("equipment", EQUIPMENT_SOURCES, "equipment")],
  ["armor-pieces", () => buildPack("armor-pieces", ARMOR_SOURCES, "armor-piece")],
  ["traits", () => buildPack("traits", TRAIT_SOURCES, "trait")],
  ["combat-effects", () => buildPack("combat-effects", COMBAT_EFFECT_SOURCES, "combat-effect")],
  ["combat-styles", () => buildPack("combat-styles", COMBAT_STYLE_SOURCES, "combat-style")],
  ["creatures", () => buildActorPack("creatures", CREATURE_SOURCES, "creature")],
  ["macros", () => buildMacroPack("macros", MACRO_SOURCES, "macro")],
  ["social-class-tables", () => buildRollTablePack("social-class-tables",
    SOCIAL_CLASS_TABLE_SOURCES, "table")],
  ["family-tables", () => buildRollTablePack("family-tables",
    FAMILY_TABLE_SOURCES, "family-table")],
  ["background-event-tables", () => buildRollTablePack("background-event-tables",
    BACKGROUND_EVENT_TABLE_SOURCES, "background-event-table")]
]);

const requestedPacks = process.argv.slice(2);
const selectedPacks = requestedPacks.length ? requestedPacks : Array.from(packBuilders.keys());
for (const name of selectedPacks) {
  const build = packBuilders.get(name);
  if (!build) throw new Error(`Compendio desconocido: ${name}`);
  await build();
}
