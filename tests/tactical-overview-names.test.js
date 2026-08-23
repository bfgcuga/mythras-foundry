import test from "node:test";
import assert from "node:assert/strict";
import { renderTacticalOverview } from "../scripts/rules/reach-chat.js";

test("el menú táctico resuelve personajes y PNJ con los nombres compartidos", () => {
  globalThis.foundry = { utils: { escapeHTML: (value) => String(value) } };
  globalThis.game = { actors: new Map([["character-source", { name: "Hodei" }]]),
    i18n: { localize: (key) => key } };
  const character = { id: "character", type: "character", name: "Prueba final", isToken: true,
    token: { actorId: "character-source" }, items: new Map() };
  const npc = { id: "npc", type: "npc", name: "Hombre lagarto", isToken: true,
    token: { name: "Hombre lagarto" }, items: new Map() };
  const entries = new Map([
    ["left", { id: "left", name: "Prueba final", actor: character,
      token: { actor: character, _source: { name: "Prueba final" } } }],
    ["right", { id: "right", name: "Hombre lagarto", actor: npc,
      token: { actor: npc, _source: { name: "Guardián del puente" } } }]
  ]);
  const combat = { combatants: entries, getFlag: () => ({ relations: { relation: {
    status: "engaged", position: "neutral", sides: {
      left: { combatantId: "left", actorName: "Prueba final", weaponId: "", weaponName: "Espada", reach: "M" },
      right: { combatantId: "right", actorName: "Hombre lagarto", weaponId: "", weaponName: "Lanza", reach: "L" }
    } } }, passiveBlocks: {}, covers: {} }) };

  const html = renderTacticalOverview(combat);
  assert.match(html, /Hodei/);
  assert.match(html, /Guardián del puente/);
  assert.doesNotMatch(html, /Prueba final|>Hombre lagarto</);
  assert.match(html, /<details class="tactical-reach-reference" open>/);
  for (const reach of ["T", "C", "M", "L", "ML"]) {
    assert.match(html, new RegExp(`MYTHRASF\\.Reach\\.Category${reach}`));
  }
  assert.match(html, /MYTHRASF\.Reach\.ReferenceLongerHint/);
  assert.match(html, /MYTHRASF\.Reach\.ReferenceShorterHint/);
});
