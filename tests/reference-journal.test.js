import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { referenceJournalSources } from "../scripts/data/reference-journals.js";

const combatEffects = JSON.parse(readFileSync(
  new URL("../data/mythras_efectos_combate.json", import.meta.url), "utf8"
)).efectos_combate.map((effect, index) => ({
  buildKey: `effect-${index}`,
  name: effect.nombre,
  system: {
    offensive: effect.ofensivo,
    defensive: effect.defensivo,
    weaponRestriction: effect.tipo_arma_especifica ?? "",
    rollRestriction: effect.tirada_especifica ?? "",
    stackable: effect.apilable,
    description: effect.descripcion,
    tableColumns: [],
    tableRows: [],
    tableNote: ""
  }
}));

test("el diario de referencia enlaza el índice, la tabla y todas las descripciones", () => {
  const [journal] = referenceJournalSources(combatEffects);
  const uuids = new Map(journal.pages.map((page) => [page.buildKey, `UUID.${page.buildKey}`]));
  const context = { pageUuid: (key) => uuids.get(key) };
  const index = journal.pages.find((page) => page.buildKey === "index").content(context);
  const summary = journal.pages.find((page) => page.buildKey === "combat-effects").content(context);

  assert.equal(journal.pages.length, combatEffects.length + 2);
  assert.match(index, /data-uuid="UUID\.combat-effects"/);
  assert.match(summary, /<table class="mythras-reference-table">/);
  assert.match(summary, /<th scope="col">Efecto de combate<\/th>/);
  for (const effect of combatEffects) {
    assert.match(summary, new RegExp(`data-uuid="UUID\\.combat-effect-${effect.buildKey}"`));
    const detail = journal.pages.find(
      (page) => page.buildKey === `combat-effect-${effect.buildKey}`
    ).content(context);
    assert.match(detail, /data-uuid="UUID\.combat-effects"/);
    assert.ok(detail.includes(effect.system.description.replaceAll("&", "&amp;")));
  }
});

test("el diario traduce restricciones y escapa el contenido variable", () => {
  const [journal] = referenceJournalSources([{
    buildKey: "unsafe",
    name: "A&B <prueba>",
    system: {
      offensive: true,
      defensive: false,
      weaponRestriction: "unarmed",
      rollRestriction: "attackerCritical",
      stackable: false,
      description: '<script>alert("x")</script>',
      tableColumns: [], tableRows: [], tableNote: ""
    }
  }]);
  const context = { pageUuid: (key) => `UUID.${key}` };
  const summary = journal.pages[1].content(context);
  const detail = journal.pages[2].content(context);

  assert.match(summary, /A&amp;B &lt;prueba&gt;/);
  assert.match(summary, /Pelea/);
  assert.match(detail, /Crítico del atacante/);
  assert.doesNotMatch(detail, /<script>/);
  assert.match(detail, /&lt;script&gt;/);
});
