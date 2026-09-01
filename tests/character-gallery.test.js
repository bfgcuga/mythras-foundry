import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("la galería de personaje usa datos estructurados y un parcial reutilizable", async () => {
  const [schema, sheet, partial] = await Promise.all([
    readFile(new URL("scripts/data/character-data.js", root), "utf8"),
    readFile(new URL("templates/actor/character-sheet.hbs", root), "utf8"),
    readFile(new URL("templates/actor/parts/gallery-tab.hbs", root), "utf8")
  ]);
  assert.match(schema, /gallery:\s*new ArrayField\(galleryImageField\(\)/);
  assert.match(sheet, /parts\/gallery-tab\.hbs/);
  assert.match(partial, /data-action="view-gallery-image"/);
  assert.match(partial, /data-action="add-gallery-image"/);
  assert.match(partial, /data-action="remove-gallery-image"/);
});
