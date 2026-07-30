import { readFile, readdir } from "node:fs/promises";
import { extname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("system.json", root), "utf8"));
const expectedDownload =
  `https://github.com/bfgcuga/mythras-foundry/releases/download/v${manifest.version}/mythras-foundry.zip`;

if (manifest.download !== expectedDownload) {
  throw new Error(`La URL download no corresponde a la versión ${manifest.version}.`);
}

for (const path of [...manifest.esmodules, ...manifest.styles]) {
  await readFile(new URL(path, root));
}

for (const language of manifest.languages ?? []) {
  JSON.parse(await readFile(new URL(language.path, root), "utf8"));
}

for (const pack of manifest.packs ?? []) {
  const entries = await readdir(new URL(`${pack.path}/`, root));
  if (entries.length === 0) {
    throw new Error(`El compendio ${pack.name} está vacío.`);
  }
}

const javascriptFiles = await collectJavaScriptFiles(new URL("scripts/", root));
for (const file of javascriptFiles) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Error de sintaxis en ${file}`);
  }
}

const releaseTag = process.argv[2];
if (releaseTag && releaseTag !== `v${manifest.version}`) {
  throw new Error(
    `La etiqueta ${releaseTag} no corresponde a system.json (${manifest.version}).`
  );
}

console.log(`Proyecto válido para Mythras Foundry ${manifest.version}.`);

async function collectJavaScriptFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directoryUrl);
    if (entry.isDirectory()) {
      files.push(...await collectJavaScriptFiles(child));
    } else if (extname(entry.name) === ".js" || extname(entry.name) === ".mjs") {
      files.push(fileURLToPath(child));
    }
  }

  return files;
}
