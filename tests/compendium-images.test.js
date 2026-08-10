import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ARMOR_SOURCES } from "../scripts/data/armor.js";
import { EQUIPMENT_SOURCES } from "../scripts/data/equipment.js";
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

test("todas las armas reciben una imagen existente", () => {
  const illustrated = WEAPON_SOURCES;
  assert.equal(illustrated.length, 63);
  for (const source of illustrated) assert.equal(existsSync(localPath(source.img)), true,
    `${source.name}: ${source.img}`);
});

test("las nuevas imagenes de equipo se asignan a entradas existentes", () => {
  const illustrated = EQUIPMENT_SOURCES.filter((source) => (
    source.img.includes("/imagenes_256x256/")
  ));
  assert.equal(illustrated.length, 117);
  for (const source of illustrated) assert.equal(existsSync(localPath(source.img)), true,
    `${source.name}: ${source.img}`);
});

test("ningun objeto del compendio conserva un icono generico", () => {
  const generic = EQUIPMENT_SOURCES.filter((source) => (
    !source.img.includes("/imagenes_256x256/")
  ));
  assert.equal(generic.length, 0);
});
