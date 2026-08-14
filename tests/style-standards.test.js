import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../styles/mythras-foundry.css", import.meta.url), "utf8");
const chatScript = readFileSync(
  new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8"
);
const standards = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
const characterTemplate = readFileSync(
  new URL("../templates/actor/character-sheet.hbs", import.meta.url), "utf8"
);
const characteristicsTemplate = readFileSync(
  new URL("../templates/actor/parts/characteristics.hbs", import.meta.url), "utf8"
);
const combatTemplate = readFileSync(
  new URL("../templates/actor/parts/combat-tab.hbs", import.meta.url), "utf8"
);
const itemTemplate = readFileSync(
  new URL("../templates/item/item-sheet.hbs", import.meta.url), "utf8"
);
const tooltipScript = readFileSync(new URL("../scripts/ui/tooltips.js", import.meta.url), "utf8");
const itemData = readFileSync(new URL("../scripts/data/item-data.js", import.meta.url), "utf8");
const sheetSources = ["character-sheet.js", "npc-sheet.js", "item-sheet.js"]
  .map((name) => readFileSync(new URL(`../scripts/sheets/${name}`, import.meta.url), "utf8"));
const systemScript = readFileSync(new URL("../scripts/mythras-foundry.js", import.meta.url), "utf8");
const rollDialog = readFileSync(new URL("../scripts/apps/skill-roll-dialog.js", import.meta.url), "utf8");
const rollChat = readFileSync(new URL("../scripts/rules/skill-roll-chat.js", import.meta.url), "utf8");

test("hojas y mensajes Mythras comparten la superficie de papel", () => {
  assert.match(css, /--mythras-paper-texture:/);
  assert.match(css, /\.mythras-foundry \.window-content/);
  assert.match(css, /\.mythras-paper-sheet \.window-content/);
  assert.match(css, /\.chat-message\.mythras-chat-message/);
  assert.match(chatScript, /classList\.add\("mythras-chat-message"\)/);
  assert.ok(sheetSources.every((source) => source.includes('"mythras-paper-sheet"')));
});

test("los diálogos Mythras aplican la superficie de papel a la ventana completa", () => {
  assert.match(rollDialog, /mythras-dialog skill-roll-dialog/);
  assert.match(rollChat, /mythras-dialog luck-spend-dialog/);
  assert.match(systemScript, /querySelector\?\.\("\.mythras-dialog"\)/);
  assert.match(systemScript, /classList\.add\("mythras-foundry", "mythras-paper-sheet"\)/);
});

test("el diálogo de tirada separa origen, efecto y dificultad final", () => {
  assert.match(css, /skill-roll-modifier > span \{ color: var\(--mythras-ink\) !important/);
  assert.match(css, /skill-roll-modifier-effect--penalty \{ color: #a1241b !important/);
  assert.match(css, /skill-roll-modifier-effect--bonus \{ color: #3f7138 !important/);
  assert.match(rollDialog, /data-effective-difficulty/);
  assert.match(rollDialog, /data-base-target-value/);
  assert.match(rollDialog, /data-final-target-value/);
  assert.match(rollDialog, /penalized-value/);
  assert.match(rollDialog, /targets\.target === targets\.baseTarget/);
  assert.match(css, /skill-roll-target--penalty \{ color: #a1241b !important/);
  assert.match(css, /skill-roll-target--bonus \{ color: #3f7138 !important/);
  assert.match(standards, /penalizaciones se muestran en rojo y los bonificadores en verde/);
});

test("la superficie compartida queda registrada como estándar visual", () => {
  assert.match(standards, /Superficie estándar de papel/);
  assert.match(standards, /Toda hoja de documento/);
  assert.match(standards, /no sustituye la superficie de papel/);
});

test("todos los campos editables son transparentes y el estándar prohíbe fondos coloreados", () => {
  assert.match(css, /input:not\(\[type="checkbox"\]\),[^}]*textarea[^}]*background: transparent !important/s);
  assert.match(css, /\.sheet-field-editable \{[^}]*background: transparent !important/s);
  assert.doesNotMatch(css, /mythras-field-editable/);
  assert.match(standards, /input`, `select` y `textarea` son transparentes/);
  assert.match(standards, /nunca introduce una superficie coloreada/);
});

test("todos los atributos derivados ofrecen el tooltip retrasado compartido", () => {
  const attributeTooltips = characterTemplate.match(/data-mythras-tooltip="{{attributeTooltips\./g) ?? [];
  assert.equal(attributeTooltips.length, 8);
  assert.match(tooltipScript, /button, \[data-mythras-tooltip\]/);
  assert.match(tooltipScript, /TOOLTIP_DELAY_MS = 1100/);
});

test("los cuatro métodos de características comparten fila y libre usa campos editables", () => {
  assert.match(css, /\.generation-methods \{[^}]*repeat\(4, minmax\(0, 1fr\)\)/s);
  assert.match(characteristicsTemplate, /isFreeAllocation/);
  assert.match(characteristicsTemplate, /class="sheet-field-editable characteristic-free-input"/);
  assert.match(characteristicsTemplate, /min="\{\{characteristic\.minimum\}\}"/);
});

test("catálogo e inventario alinean cabeceras y filas con la misma cuadrícula", () => {
  assert.match(css, /\.catalog-header,\s*\n\.mythras-foundry \.catalog-results li[^}]*grid-template-columns:/);
  assert.match(css, /\.inventory-tree-head,\s*\n\.mythras-foundry \.inventory-tree \.item-list li[^}]*grid-template-columns:/);
  assert.match(css, /\.inventory-tree-head \{[^}]*text-align: left/);
});

test("la ficha de arma separa modos por tipo y expone parámetros de rasgo", () => {
  assert.match(css, /\.weapon-mode-fields-melee/);
  assert.match(css, /\.weapon-mode-fields-ranged/);
  assert.match(css, /\.weapon-mode-fields-siege/);
  assert.match(css, /\.weapon-item-sheet textarea \{[^}]*background: transparent !important/s);
  assert.match(itemTemplate, /data-action="view-item-image"/);
  assert.match(itemTemplate, /traitRefs\.\{\{\.\.\/referenceIndex\}\}\.parameters/);
  assert.match(itemTemplate, /weapon-advanced-fields/);
});

test("la ficha de arma envía una sola moneda y combate muestra los PG actuales", () => {
  const armorStart = itemTemplate.indexOf("{{#if isArmor}}");
  const weaponSection = itemTemplate.slice(itemTemplate.lastIndexOf("{{#if isWeapon}}", armorStart),
    armorStart);
  assert.equal((weaponSection.match(/name="system\.currency"/g) ?? []).length, 1);
  assert.doesNotMatch(weaponSection, /name="system\.(parentContainerId|location|quantityFormula)"/);
  assert.match(combatTemplate, /row\.item\.system\.currentHitPoints/);
});

test("las acciones de modo y rasgo son distintas y la durabilidad natural se explica", () => {
  assert.match(itemTemplate, /weapon-modes-toolbar[^]*sheet-add-button/);
  assert.match(itemTemplate, /class="weapon-trait-add"[^]*fa-tag/);
  assert.doesNotMatch(itemTemplate, /class="sheet-add-button weapon-trait-add"/);
  assert.match(itemTemplate, /MYTHRASF\.Weapon\.NaturalWeaponDurability/);
  assert.match(itemTemplate, /weaponDurabilityHelp/);
});

test("la configuración de arma separa ejemplar y situación del personaje", () => {
  assert.match(itemTemplate, /weapon-copy-editor[^]*system\.quantity[^]*system\.currentHitPoints/);
  assert.match(itemTemplate, /weapon-situation-editor[^]*system\.activeModeKey[^]*system\.equipped/);
  assert.ok(itemTemplate.indexOf("weapon-copy-editor")
    < itemTemplate.indexOf("weapon-situation-editor"));
});

test("la ficha de estilo resume asociaciones y separa el cálculo no editable", () => {
  assert.match(itemTemplate, /combat-style-name-summary[^]*combatStyleWeaponProfiles/);
  assert.match(itemTemplate, /combat-style-name-summary[^]*combatStyleTraitReferences/);
  assert.match(itemTemplate, /data-combat-style-tab-content="calculation"[^]*<output class="sheet-field-readonly">/);
  assert.match(itemTemplate, /combat-style-advanced-state/);
  assert.match(itemTemplate, /combat-style-experience-variables[^]*system\.trained[^]*system\.fumbled/);
  assert.doesNotMatch(itemTemplate, /name="system\.(weapons|traits|bonus)"/);
  assert.match(css, /\.combat-style-item-sheet input,[^}]*background: transparent/s);

  const styleSchema = itemData.slice(itemData.indexOf("export class CombatStyleData"),
    itemData.indexOf("export class BackgroundData"));
  assert.doesNotMatch(styleSchema, /\b(weapons|traits): textField/);
  assert.match(styleSchema, /\.\.\.super\.defineSchema\(\)/);
});

test("las hojas de Item y el creador usan recuadros discretos sin superficie propia", () => {
  assert.match(css, /\.item-sheet-content fieldset,[^}]*\.homebrew-creator-content fieldset[^}]*background: transparent/s);
  assert.match(css, /\.item-sheet-content input,[^}]*\.homebrew-creator-content textarea[^}]*background: transparent !important/s);
});
