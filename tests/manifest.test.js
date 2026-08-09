import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../system.json", import.meta.url), "utf8"));

const EXPECTED_PACKS = Object.freeze({
  skills: { label: "Habilidades", path: "packs/skills", type: "Item" },
  cultures: { label: "Culturas", path: "packs/cultures", type: "Item" },
  professions: { label: "Profesiones", path: "packs/professions", type: "Item" },
  weapons: { label: "Armas", path: "packs/weapons", type: "Item" },
  "armor-pieces": { label: "Piezas de armadura", path: "packs/armor-pieces", type: "Item" },
  macros: { label: "Macros", path: "packs/macros", type: "Macro" },
  traits: { label: "Rasgos", path: "packs/traits", type: "Item" },
  creatures: { label: "Criaturas", path: "packs/creatures", type: "Actor" },
  "social-class-tables": {
    label: "Tablas de clase social",
    path: "packs/social-class-tables",
    type: "RollTable"
  }
});

test("los compendios muestran únicamente el nombre de su contenido", () => {
  assert.deepEqual(
    Object.fromEntries(manifest.packs.map(({ name, label, path, type }) => [
      name, { label, path, type }
    ])),
    EXPECTED_PACKS
  );
});

test("las referencias internas conservan identificadores de compendio válidos", () => {
  const registered = new Set(manifest.packs.map((pack) => pack.name));
  for (const referenced of ["skills", "cultures", "professions"]) {
    assert.ok(registered.has(referenced), referenced);
  }
  assert.equal(new Set(manifest.packs.map((pack) => pack.path)).size, manifest.packs.length);
});
