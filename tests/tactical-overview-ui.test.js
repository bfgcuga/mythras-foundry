import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../scripts/rules/reach-chat.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles/mythras-foundry.css", import.meta.url), "utf8");

test("el menú táctico filtra armas y mantiene sus acciones dentro de la ventana", () => {
  assert.match(source, /function weaponOptions\(combat, combatantId/);
  assert.match(source, /combat\.combatants\.get\(combatantId\)/);
  assert.match(source, /const longest = longestPreparedWeapon\(combatant\?\.actor\)/);
  assert.match(source, /selected \|\| \(longest \?/);
  assert.match(source, /Object\.entries\(state\.relations/);
  assert.match(source, /relation\.status !== "removed"/);
  assert.doesNotMatch(source, /<optgroup label=/);
  for (const action of ["save-relation-row", "remove-relation", "deactivate-block",
    "reactivate-block", "modify-block", "save-cover-row", "edit-cover-locations",
    "remove-cover-row"]) {
    assert.match(source, new RegExp(`<button[^>]*type="button"[^>]*data-tactical-action="${action}"`));
  }
  assert.match(source, /data-tactical-action="explain-complete-cover"/);
  assert.match(source, /<span>CCP<\/span>/);
  assert.match(source, /tactical-cover-location-cell/);
  assert.match(source, /tactical-relation-position/);
  assert.match(source, /storedCover\?\.status === "active" \? storedCover : null/);
  assert.match(source, /game\.user\?\.isGM \|\| combatant\.actor\?\.isOwner/);
  assert.match(source, /submitCoverDeclaration\(combat, combatantId/);
  assert.match(source, /submitCoverDeclaration\(combat, button\.dataset\.combatantId, "remove"\)/);
  assert.match(source, /addButton\("add-relation"/);
  assert.match(source, /addButton\("add-cover"/);
  assert.match(source, /action === "add-relation"/);
  assert.match(source, /action === "add-cover"/);
  assert.doesNotMatch(source, /data-tactical-action="remove"/);
  assert.match(source, /name="coverLocation"/);
  assert.doesNotMatch(source, /tactical-correction/);
  assert.doesNotMatch(source, /tactical-cover-correction/);
  assert.match(source, /\[name='coverLocation'\]:checked/);
  assert.match(source, /MYTHRASF\.Reach\.RelationsTable/);
  assert.match(source, /MYTHRASF\.PassiveBlock\.Table/);
  assert.match(source, /MYTHRASF\.Ranged\.CoversTable/);
  assert.match(source, /function tacticalMenuContent\(combat\) \{ return renderTacticalOverview\(combat\); \}/);
  assert.match(source, /window: \{[\s\S]*?resizable: true \},[\s\S]*?position: \{ width: 480 \}/);
  assert.doesNotMatch(source, /dialog\.element\.getBoundingClientRect\(\)/);
  assert.doesNotMatch(source, /dialog\.setPosition\(/);
  assert.match(source, /reference\.open = referenceOpen/);
  assert.match(source, /buttons: \[\{ action: "close"/);
  assert.match(source, /event\.preventDefault\(\); event\.stopPropagation\(\)/);
  assert.match(source, /button\.addEventListener\("click", handleAction\)/);
});

test("las tablas tácticas conservan el contenido transparente y destacan sus cabeceras", () => {
  assert.match(css, /\.tactical-overview-menu table,[\s\S]*?background: none !important;/);
  assert.match(css, /background-color: transparent !important;/);
  assert.match(css, /background-image: none !important;/);
  assert.match(css, /\.tactical-overview-menu thead th \{[\s\S]*?var\(--mythras-header-accent\)/);
  assert.match(css, /\.tactical-reach-rules \{[\s\S]*?grid-template-columns: 1fr;/);
  assert.match(css, /table:first-of-type th:nth-child\(1\),[\s\S]*?th:nth-child\(2\) \{ width: 18%; \}/);
  assert.match(css, /table:first-of-type th:nth-child\(4\) \{ width: 24%; \}/);
});
