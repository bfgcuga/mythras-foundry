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
const itemTemplate = readFileSync(
  new URL("../templates/item/item-sheet.hbs", import.meta.url), "utf8"
);
const tooltipScript = readFileSync(new URL("../scripts/ui/tooltips.js", import.meta.url), "utf8");
const sheetSources = ["character-sheet.js", "npc-sheet.js", "item-sheet.js"]
  .map((name) => readFileSync(new URL(`../scripts/sheets/${name}`, import.meta.url), "utf8"));

test("hojas y mensajes Mythras comparten la superficie de papel", () => {
  assert.match(css, /--mythras-paper-texture:/);
  assert.match(css, /\.mythras-foundry \.window-content/);
  assert.match(css, /\.mythras-paper-sheet \.window-content/);
  assert.match(css, /\.chat-message\.mythras-chat-message/);
  assert.match(chatScript, /classList\.add\("mythras-chat-message"\)/);
  assert.ok(sheetSources.every((source) => source.includes('"mythras-paper-sheet"')));
});

test("la superficie compartida queda registrada como estándar visual", () => {
  assert.match(standards, /Superficie estándar de papel/);
  assert.match(standards, /Toda hoja de documento/);
  assert.match(standards, /no sustituye la superficie de papel/);
});

test("todos los atributos derivados ofrecen el tooltip retrasado compartido", () => {
  const attributeTooltips = characterTemplate.match(/data-mythras-tooltip="{{attributeTooltips\./g) ?? [];
  assert.equal(attributeTooltips.length, 8);
  assert.match(tooltipScript, /button, \[data-mythras-tooltip\]/);
  assert.match(tooltipScript, /TOOLTIP_DELAY_MS = 1100/);
});

test("catálogo e inventario alinean cabeceras y filas con la misma cuadrícula", () => {
  assert.match(css, /\.catalog-header,\s*\n\.mythras-foundry \.catalog-results li[^}]*grid-template-columns:/);
  assert.match(css, /\.inventory-tree-head,\s*\n\.mythras-foundry \.inventory-tree \.item-list li[^}]*grid-template-columns:/);
  assert.match(css, /\.inventory-tree-head \{[^}]*text-align: left/);
});

test("la ficha de arma usa tabla compacta y expone parámetros de rasgo", () => {
  assert.match(css, /\.weapon-mode-table-head,\s*\n\.mythras-foundry \.weapon-mode-table-row/);
  assert.match(itemTemplate, /data-action="view-item-image"/);
  assert.match(itemTemplate, /traitRefs\.\{\{\.\.\/referenceIndex\}\}\.parameters/);
  assert.match(itemTemplate, /weapon-advanced-fields/);
});
