import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const language of ["en", "es"]) {
  test(`el diccionario ${language} no contiene claves que colisionen al expandirse`, () => {
    const dictionary = JSON.parse(readFileSync(
      new URL(`../lang/${language}.json`, import.meta.url),
      "utf8"
    ));
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
