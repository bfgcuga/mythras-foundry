import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { WEAPON_SOURCES } from "../scripts/data/weapons.js";
import { weaponReferenceGroups, weaponReferenceHtml } from "../scripts/rules/weapon-reference.js";

test("la referencia separa armas en las cinco tablas solicitadas", () => {
  const groups = weaponReferenceGroups(WEAPON_SOURCES);
  assert.deepEqual(groups.map((group) => group.key),
    ["oneHanded", "twoHanded", "shields", "ranged", "siege"]);
  assert.ok(groups.every((group) => group.rows.length > 0));
  assert.ok(groups.flatMap((group) => group.rows).every((row) => row.name !== "Puño/Patada"));
});

test("las tablas conservan datos operativos, enlaces y procedencia", () => {
  const weapon = structuredClone(WEAPON_SOURCES.find((entry) => entry.buildKey === "daga"));
  weapon.uuid = "Compendium.world.armas.Item.daga";
  weapon.packLabel = "Armas personales";
  const html = weaponReferenceHtml([weapon], { dynamic: true, includeSource: true });
  assert.match(html, /data-uuid="Compendium\.world\.armas\.Item\.daga"/);
  assert.match(html, /Desangrar, Empalar/);
  assert.match(html, /Armas personales/);
  assert.match(html, /<th scope="col">Procedencia<\/th>/);
});

test("la aplicación dinámica consulta las fuentes personales configuradas", () => {
  const app = readFileSync(new URL("../scripts/apps/weapon-reference.js", import.meta.url), "utf8");
  const registration = readFileSync(
    new URL("../scripts/system/registration.js", import.meta.url), "utf8");
  const hooks = readFileSync(new URL("../scripts/system/ui-hooks.js", import.meta.url), "utf8");
  assert.match(app, /SETTING_KEYS\.catalogSources/);
  assert.match(app, /pack\.getDocuments\(\)/);
  assert.match(registration, /weaponReference: createWeaponReferenceApi\(\)/);
  assert.match(hooks, /mythras-reference-open-weapons/);
});
