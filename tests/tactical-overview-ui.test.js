import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../scripts/rules/reach-chat.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles/mythras-foundry.css", import.meta.url), "utf8");

test("el menú táctico filtra armas y mantiene sus acciones dentro de la ventana", () => {
  assert.match(source, /function weaponOptions\(combat, combatantId/);
  assert.match(source, /combat\.combatants\.get\(combatantId\)/);
  assert.match(source, /Object\.entries\(tacticalState\(combat\)\.relations/);
  assert.match(source, /<option value="\$\{escape\(relationId\)\}"/);
  assert.doesNotMatch(source, /<optgroup label=/);
  for (const action of ["correct", "remove", "create", "deactivate-block", "apply-cover", "remove-cover"]) {
    assert.match(source, new RegExp(`<button[^>]*type="button"[^>]*data-tactical-action="${action}"`));
  }
  assert.match(source, /dialog\.element\.getBoundingClientRect\(\)/);
  assert.match(source, /dialog\.setPosition\(\{ width: Math\.ceil\(bounds\.width\), height: Math\.ceil\(bounds\.height\) \}\)/);
  assert.match(source, /reference\.open = referenceOpen/);
  assert.match(source, /buttons: \[\{ action: "close"/);
  assert.match(source, /event\.preventDefault\(\); event\.stopPropagation\(\)/);
  assert.match(source, /button\.addEventListener\("click", handleAction\)/);
});

test("las tablas tácticas fuerzan una superficie totalmente transparente", () => {
  assert.match(css, /\.tactical-overview-menu table,[\s\S]*?background: none !important;/);
  assert.match(css, /background-color: transparent !important;/);
  assert.match(css, /background-image: none !important;/);
  assert.match(css, /\.tactical-reach-rules \{[\s\S]*?grid-template-columns: 1fr;/);
});
