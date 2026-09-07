import test from "node:test";
import assert from "node:assert/strict";

import { CULTURE_SOURCES, PROFESSION_SOURCES } from "../scripts/data/backgrounds.js";
import { COMBAT_STYLE_SOURCES } from "../scripts/data/combat-styles.js";
import { EQUIPMENT_SOURCES } from "../scripts/data/equipment.js";
import { referenceJournalSources } from "../scripts/data/reference-journals.js";

const context = { pageUuid: (key) => `UUID.${key}` };

test("culturas y profesiones tienen índices y páginas con sus reglas", () => {
  const [journal] = referenceJournalSources([], [], [], [], CULTURE_SOURCES,
    PROFESSION_SOURCES);
  for (const [indexKey, prefix, sources] of [["cultures", "culture", CULTURE_SOURCES],
    ["professions", "profession", PROFESSION_SOURCES]]) {
    const index = journal.pages.find((page) => page.buildKey === indexKey).content(context);
    assert.match(index, /UUID\.index/);
    for (const source of sources) {
      assert.match(index, new RegExp(`UUID\\.${prefix}-${source.system.key}`));
      const detail = journal.pages.find(
        (page) => page.buildKey === `${prefix}-${source.system.key}`).content(context);
      assert.match(detail, /Habilidades básicas/);
      assert.match(detail, new RegExp(`UUID\\.${indexKey}`));
    }
  }
});

test("los objetos generales se muestran por categorías y abren el catálogo dinámico", () => {
  const [journal] = referenceJournalSources([], [], [], [], [], [], EQUIPMENT_SOURCES);
  const index = journal.pages.find((page) => page.buildKey === "equipment").content(context);
  assert.match(index, /mythras-reference-open-catalog/);
  assert.match(index, /Servicios y alojamiento/);
  assert.match(index, /Equipo general/);
  assert.match(index, /UUID\.equipment-botas/);
  const detail = journal.pages.find((page) => page.buildKey === "equipment-botas").content(context);
  assert.match(detail, /Coste/);
  assert.match(detail, /UUID\.equipment/);
});

test("los estilos de combate enlazan armas y rasgos desde su índice", () => {
  const [journal] = referenceJournalSources([], [], [], [], [], [], [], COMBAT_STYLE_SOURCES);
  const index = journal.pages.find((page) => page.buildKey === "combat-styles").content(context);
  assert.match(index, /UUID\.combat-style-asesino/);
  assert.match(index, /UUID\.index/);
  const detail = journal.pages.find(
    (page) => page.buildKey === "combat-style-asesino").content(context);
  assert.match(detail, /Arco corto/);
  assert.match(detail, /Asesinato/);
  assert.match(detail, /UUID\.combat-styles/);
});

test("el hook abre el catálogo completo desde el Journal", async () => {
  const text = await (await import("node:fs/promises")).readFile(
    new URL("../scripts/system/ui-hooks.js", import.meta.url), "utf8");
  assert.match(text, /mythras-reference-open-catalog/);
  assert.match(text, /mythrasFoundry\?\.shop\?\.open/);
});
