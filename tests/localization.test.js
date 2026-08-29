import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const es = JSON.parse(readFileSync(new URL("../lang/es.json", import.meta.url), "utf8"));
const en = JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));

function sourceFiles(relativeDirectory) {
  const directory = fileURLToPath(new URL(`../${relativeDirectory}/`, import.meta.url));
  const visit = (path) => readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? visit(child) : [child];
  });
  return visit(directory).filter((path) => [".hbs", ".js", ".mjs"].includes(extname(path)));
}

for (const [language, dictionary] of Object.entries({ en, es })) {
  test(`el diccionario ${language} no contiene claves que colisionen al expandirse`, () => {
    const keys = new Set(Object.keys(dictionary));
    const collisions = [];
    for (const key of keys) {
      const parts = key.split(".");
      for (let index = 1; index < parts.length; index += 1) {
        const parent = parts.slice(0, index).join(".");
        if (keys.has(parent)) collisions.push(`${parent} / ${key}`);
      }
    }
    assert.deepEqual(collisions, []);
  });
}

test("los catálogos español e inglés contienen las mismas claves", () => {
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
});

test("todas las claves de localización literales usadas por la interfaz existen", () => {
  const missing = new Map();
  for (const path of [...sourceFiles("scripts"), ...sourceFiles("templates")]) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/(["'])(MYTHRASF\.[A-Za-z0-9_.-]+|TYPES\.[A-Za-z0-9_.-]+)\1/g)) {
      const key = match[2];
      if (Object.hasOwn(es, key) && Object.hasOwn(en, key)) continue;
      const paths = missing.get(key) ?? [];
      paths.push(relative(root, path));
      missing.set(key, paths);
    }
  }
  assert.deepEqual([...missing.entries()], []);
});

test("el catálogo español no contiene texto con codificación dañada", () => {
  const broken = Object.entries(es).filter(([, value]) =>
    typeof value === "string" && /(?:Ã|Â|â€|�)/.test(value));
  assert.deepEqual(broken, []);
});

test("las etiquetas principales de la hoja están traducidas al castellano", () => {
  const expected = {
    "MYTHRASF.Characteristics": "Características",
    "MYTHRASF.Attributes": "Atributos",
    "MYTHRASF.Resources": "Recursos actuales",
    "MYTHRASF.Tab.Character": "Personaje",
    "MYTHRASF.Tab.Skills": "Habilidades",
    "MYTHRASF.Attribute.ActionPoints": "Puntos de acción",
    "MYTHRASF.Skill.GroupBasic": "Habilidades básicas",
    "MYTHRASF.Skill.GroupProfessional": "Habilidades profesionales",
    "MYTHRASF.Skill.GroupMagic": "Habilidades mágicas",
    "MYTHRASF.Skill.GroupLanguage": "Idiomas"
  };
  for (const [key, value] of Object.entries(expected)) assert.equal(es[key], value, key);
});
