import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { compilePack } from "@foundryvtt/foundryvtt-cli/index.mjs";
import {
  CULTURE_SOURCES,
  PROFESSION_SOURCES
} from "../data/backgrounds.js";
import { ALL_SKILL_SOURCES } from "../data/skills.js";
import { WEAPON_SOURCES } from "../data/weapons.js";
import { ARMOR_SOURCES } from "../data/armor.js";
import { MACRO_SOURCES } from "../data/macros.js";
import { TRAIT_SOURCES } from "../data/traits.js";
import { CREATURE_SOURCES } from "../data/creatures.js";
import { SOCIAL_CLASS_TABLE_SOURCES } from "../data/social-classes.js";
import { deterministicPackId } from "./pack-ids.mjs";

const projectRoot = resolve(import.meta.dirname, "../..");

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
        text: `<strong>${result.name}</strong> (×${result.moneyModifier})<br>${result.resources}`,
        img: "icons/svg/d20-grey.svg",
        documentCollection: "",
        documentId: null,
        weight: result.range[1] - result.range[0] + 1,
        range: result.range,
        drawn: false,
        flags: { "mythras-foundry": {
          socialClassKey: result.key,
          moneyModifier: result.moneyModifier,
          titles: result.titles,
          resources: result.resources
        }}
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
      flags: { "mythras-foundry": { cultureKey: source.cultureKey } }
    };
    await writeFile(resolve(sourceDirectory, `${source.buildKey}_${tableId}.json`),
      `${JSON.stringify(document, null, 2)}\n`, "utf8");
  }

  await compilePack(sourceDirectory, outputDirectory, { log: true });
  console.log(`Compendio ${name} generado con ${sources.length} tablas.`);
}

await buildPack("skills", ALL_SKILL_SOURCES, "skill");
await buildPack("cultures", CULTURE_SOURCES, "culture");
await buildPack("professions", PROFESSION_SOURCES, "profession");
await buildPack("weapons", WEAPON_SOURCES, "weapon");
await buildPack("armor-pieces", ARMOR_SOURCES, "armor-piece");
await buildPack("traits", TRAIT_SOURCES, "trait");
await buildActorPack("creatures", CREATURE_SOURCES, "creature");
await buildMacroPack("macros", MACRO_SOURCES, "macro");
await buildRollTablePack("social-class-tables", SOCIAL_CLASS_TABLE_SOURCES, "table");
