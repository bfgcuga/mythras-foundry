import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { ALL_SKILL_SOURCES } from "../data/skills.js";

const projectRoot = resolve(import.meta.dirname, "../..");
const sourceDirectory = resolve(projectRoot, ".build/packs-src/skills");
const outputDirectory = resolve(projectRoot, "packs/skills");

await rm(sourceDirectory, { recursive: true, force: true });
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(sourceDirectory, { recursive: true });

for (const [index, source] of ALL_SKILL_SOURCES.entries()) {
  const id = createHash("sha256")
    .update(`mythras-foundry.skill.${source.system.slug}`)
    .digest("hex")
    .slice(0, 16);
  const document = {
    _key: `!items!${id}`,
    _id: id,
    name: source.name,
    type: source.type,
    img: "icons/svg/book.svg",
    system: source.system,
    effects: [],
    folder: null,
    sort: index * 1000,
    ownership: {
      default: 0
    },
    flags: source.flags
  };
  const filename = `${source.system.slug}_${id}.json`;
  await writeFile(
    resolve(sourceDirectory, filename),
    `${JSON.stringify(document, null, 2)}\n`,
    "utf8"
  );
}

await compilePack(sourceDirectory, outputDirectory, { log: true });
console.log(`Compendio generado con ${ALL_SKILL_SOURCES.length} habilidades.`);
