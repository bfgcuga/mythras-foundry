import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ARMOR_SOURCES } from "../scripts/data/armor.js";
import { WEAPON_SOURCES } from "../scripts/data/weapons.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const localPath = (img) => resolve(root, img.replace("systems/mythras-foundry/", ""));

test("todas las imágenes asignadas a armaduras existen", () => {
  const illustrated = ARMOR_SOURCES.filter((source) => (
    source.system.referenceLocation !== "special"
  ));
  assert.equal(illustrated.length, 56);
  for (const source of illustrated) assert.equal(existsSync(localPath(source.img)), true,
    `${source.name}: ${source.img}`);
});

test("todas las armas no de asedio reciben una imagen existente", () => {
  const illustrated = WEAPON_SOURCES.filter((source) => source.system.modes[0]?.key !== "siege");
  assert.equal(illustrated.length, 57);
  for (const source of illustrated) assert.equal(existsSync(localPath(source.img)), true,
    `${source.name}: ${source.img}`);
});
