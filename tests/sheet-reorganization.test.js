import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { woundRollRisks } from "../scripts/ui/wound-roll-dialog.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("las acciones tácticas permanecen reunidas y visibles en ambas hojas", async () => {
  const [characterCombat, npc] = await Promise.all([
    read("templates/actor/parts/combat-tab.hbs"), read("templates/actor/npc-sheet.hbs")]);
  for (const action of ["attack", "changeReach", "aim", "reload", "seekCover"]) {
    assert.match(characterCombat, new RegExp(`data-combat-action-key=["']${action}["']`));
  }
  assert.match(characterCombat, /data-action="declare-passive-block"/);
  assert.match(npc, /parts\/combat-tab\.hbs/);
  assert.doesNotMatch(characterCombat, /combat-paper-ranged-weapons[\s\S]*?<div class="combat-tactical-actions">/);
});

test("personaje y PNJ comparten Combate e Inventario", async () => {
  const [character, npc, inventory, characterSheet, npcSheet, npcData] = await Promise.all([
    read("templates/actor/character-sheet.hbs"), read("templates/actor/npc-sheet.hbs"),
    read("templates/actor/parts/inventory-tab.hbs"), read("scripts/sheets/character-sheet.js"),
    read("scripts/sheets/npc-sheet.js"), read("scripts/data/npc-data.js")]);
  for (const source of [character, npc]) {
    assert.match(source, /parts\/combat-tab\.hbs/);
    assert.match(source, /parts\/inventory-tab\.hbs/);
  }
  assert.match(npc, /data-tab="inventory"/);
  assert.match(inventory, /data-action="buy-item"/);
  assert.match(inventory, /data-action="transfer-money"/);
  for (const source of [characterSheet, npcSheet]) {
    assert.match(source, /prepareCombatWeaponView/);
    assert.match(source, /new CombatSheetController/);
    assert.match(source, /prepareInventoryView/);
    assert.match(source, /new InventorySheetController/);
  }
  assert.match(npcData, /currency: new SchemaField/);
});

test("Combate de personaje conserva el orden operativo de sus paneles", async () => {
  const combat = await read("templates/actor/parts/combat-tab.hbs");
  const css = await read("styles/mythras-foundry.css");
  const expectedOrder = [
    "combat-action-panel",
    "hit-location-table.hbs",
    "combat-paper-melee-weapons",
    "combat-paper-ranged-weapons",
    "combat-paper-styles"
  ];
  const positions = expectedOrder.map((marker) => combat.indexOf(marker));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
  assert.match(css, /grid-template-areas:\s*"actions actions"\s*"locations locations"\s*"meleeWeapons meleeWeapons"\s*"rangedWeapons rangedWeapons"\s*"styles styles"/);
  assert.match(css, /grid-template-areas:\s*"actions"\s*"locations"\s*"meleeWeapons"\s*"rangedWeapons"\s*"styles"/);
});

test("todas las navegaciones usan pestañas elevadas con superficie activa", async () => {
  const css = await read("styles/mythras-foundry.css");
  for (const selector of ["data-tab", "data-weapon-tab", "data-combat-style-tab", "data-armor-tab"]) {
    assert.match(css, new RegExp(selector));
  }
  assert.match(css, /border-radius: 0\.45rem 0\.45rem 0 0/);
  assert.match(css, /background: var\(--mythras-tab-inactive\)/);
  assert.match(css, /background: var\(--mythras-paper\)/);
});

test("los encabezados oscuros conservan contraste propio en campos, líneas y botones", async () => {
  const css = await read("styles/mythras-foundry.css");
  assert.match(css, /--mythras-header-line:/);
  assert.match(css, /--mythras-header-control:/);
  assert.match(css, /> \.sheet-header :is\(label, span, output, input, select, i\)[\s\S]*?color: var\(--mythras-header-ink\) !important/);
  assert.match(css, /> \.sheet-header \.body-silhouette[\s\S]*?border-left: 1px solid var\(--mythras-header-line\)/);
  assert.match(css, /\.npc-header-resource-control button[\s\S]*?background: var\(--mythras-header-control\)/);
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

test("Trasfondo, lesión permanente y silueta canónica quedan modelados", async () => {
  const [model, itemModel, sheet, silhouette] = await Promise.all([
    read("scripts/data/character-data.js"), read("scripts/data/item-data.js"),
    read("templates/actor/character-sheet.hbs"), read("scripts/ui/body-silhouette.js")]);
  for (const field of ["history", "description", "personality", "motivation", "goals",
    "beliefs", "siblings", "parents", "partner", "children", "extendedFamily", "allies",
    "contacts", "rivals", "enemies", "secrets", "notes"]) assert.match(model, new RegExp(`"${field}"`));
  assert.match(itemModel, /permanentWound: new SchemaField/);
  const itemSheet = await read("templates/item/item-sheet.hbs");
  assert.match(itemSheet, /item\.system\.permanentWound\.severity/);
  assert.doesNotMatch(sheet, /data-location-amputated/);
  assert.match(sheet, /data-body-silhouette/);
  assert.match(silhouette, /assets\/Silueta\/Silueta\.svg/);
  assert.match(silhouette, /humanArmorFactors/);
});

test("las consecuencias narrativas distinguen herida grave y miembro inutilizable", () => {
  const locations = [{ id: "arm", type: "hitLocation", name: "Brazo",
    system: { currentHitPoints: 0, maxHitPoints: 5, disabled: false,
      permanentWound: { severity: 0 } } },
  { id: "leg", type: "hitLocation", name: "Pierna",
    system: { currentHitPoints: 5, maxHitPoints: 5, disabled: false,
      permanentWound: { severity: 3 } } }];
  const risks = woundRollRisks({ items: locations, effects: [] });
  assert.deepEqual(risks.serious.map((item) => item.id), ["arm"]);
  assert.deepEqual(risks.unusable.map((item) => item.id), ["leg"]);
});
