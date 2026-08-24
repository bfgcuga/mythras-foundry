import test from "node:test";
import assert from "node:assert/strict";
import { renderInitiativeChat } from "../scripts/rules/initiative-chat.js";

const localize = (key) => key;
const format = (key, data) => `${key}:${data.count}`;

test("la tarjeta individual muestra dado, bonificador y total sin desempate", () => {
  const html = renderInitiativeChat([{ name: "Aitor", roll: 7, bonus: 11, total: 18,
    tieBreak: null }], { localize, format });
  assert.match(html, /Aitor/);
  assert.match(html, /\(1d10\).*7/);
  assert.match(html, /\+11/);
  assert.match(html, />18</);
  assert.doesNotMatch(html, /1d100/);
});

test("la tarjeta grupal reúne participantes y muestra desempate solo donde existe", () => {
  const html = renderInitiativeChat([
    { name: "Uno", roll: 6, bonus: 10, total: 16, tieBreak: 42 },
    { name: "Dos", roll: 8, bonus: 8, total: 16, tieBreak: 73 }
  ], { localize, format });
  assert.match(html, /InitiativeGroupTitle:2/);
  assert.equal((html.match(/1d100/g) ?? []).length, 2);
});
