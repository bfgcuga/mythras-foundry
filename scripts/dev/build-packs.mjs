import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { compilePack } from "@foundryvtt/foundryvtt-cli";
import {
  CULTURE_SOURCES,
  PROFESSION_SOURCES
} from "../data/backgrounds.js";
import { ALL_SKILL_SOURCES } from "../data/skills.js";

const projectRoot = resolve(import.meta.dirname, "../..");

async function buildPack(name, sources, idNamespace) {
  const sourceDirectory = resolve(projectRoot, `.build/packs-src/${name}`);
  const outputDirectory = resolve(projectRoot, `packs/${name}`);
  await rm(sourceDirectory, { recursive: true, force: true });
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(sourceDirectory, { recursive: true });

  for (const [index, source] of sources.entries()) {
    const key = source.system.slug ?? source.system.key;
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

await buildPack("skills", ALL_SKILL_SOURCES, "skill");
await buildPack("cultures", CULTURE_SOURCES, "culture");
await buildPack("professions", PROFESSION_SOURCES, "profession");
