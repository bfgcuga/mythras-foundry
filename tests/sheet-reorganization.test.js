import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { woundRollRisks } from "../scripts/ui/wound-roll-dialog.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("las acciones tácticas permanecen reunidas y visibles en ambas hojas", async () => {
  const [characterCombat, npc] = await Promise.all([
    read("templates/actor/parts/combat-tab.hbs"), read("templates/actor/npc-sheet.hbs")]);
  for (const source of [characterCombat, npc]) {
    for (const action of ["attack", "changeReach", "aim", "reload", "seekCover"]) {
      assert.match(source, new RegExp(`data-combat-action-key=["']${action}["']`));
    }
    assert.match(source, /data-action="declare-passive-block"/);
  }
  assert.doesNotMatch(characterCombat, /combat-paper-ranged-weapons[\s\S]*?<div class="combat-tactical-actions">/);
});

test("Estado contiene Fatiga y Combate ya no la duplica", async () => {
  const [penalties, combat, character, npc] = await Promise.all([
    read("templates/actor/parts/penalties-tab.hbs"),
    read("templates/actor/parts/combat-tab.hbs"),
    read("templates/actor/character-sheet.hbs"), read("templates/actor/npc-sheet.hbs")]);
  assert.match(penalties, /fatigue-table\.hbs/);
  assert.doesNotMatch(combat, /data-fatigue-level/);
  assert.match(character, /MYTHRASF\.Tab\.Status/);
  assert.match(npc, /MYTHRASF\.Tab\.Status/);
});

test("Trasfondo, amputación y silueta canónica quedan modelados", async () => {
  const [model, itemModel, sheet, silhouette] = await Promise.all([
    read("scripts/data/character-data.js"), read("scripts/data/item-data.js"),
    read("templates/actor/character-sheet.hbs"), read("scripts/ui/body-silhouette.js")]);
  for (const field of ["history", "description", "personality", "motivation", "goals",
    "beliefs", "siblings", "parents", "partner", "children", "extendedFamily", "allies",
    "contacts", "rivals", "enemies", "secrets", "notes"]) assert.match(model, new RegExp(`"${field}"`));
  assert.match(itemModel, /amputated: new BooleanField/);
  const itemSheet = await read("templates/item/item-sheet.hbs");
  assert.match(itemSheet, /name="system\.amputated"/);
  assert.doesNotMatch(sheet, /data-location-amputated/);
  assert.match(sheet, /data-body-silhouette/);
  assert.match(silhouette, /assets\/Silueta\/Silueta\.svg/);
  assert.match(silhouette, /humanArmorFactors/);
});

test("las consecuencias narrativas distinguen herida grave y miembro inutilizable", () => {
  const locations = [{ id: "arm", type: "hitLocation", name: "Brazo",
    system: { currentHitPoints: 0, maxHitPoints: 5, disabled: false, amputated: false } },
  { id: "leg", type: "hitLocation", name: "Pierna",
    system: { currentHitPoints: 5, maxHitPoints: 5, disabled: false, amputated: true } }];
  const risks = woundRollRisks({ items: locations, effects: [] });
  assert.deepEqual(risks.serious.map((item) => item.id), ["arm"]);
  assert.deepEqual(risks.unusable.map((item) => item.id), ["leg"]);
});
