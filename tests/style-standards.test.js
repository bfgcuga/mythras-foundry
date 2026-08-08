import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../styles/mythras-foundry.css", import.meta.url), "utf8");
const chatScript = readFileSync(
  new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8"
);
const standards = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");

test("hojas y mensajes Mythras comparten la superficie de papel", () => {
  assert.match(css, /--mythras-paper-texture:/);
  assert.match(css, /\.mythras-foundry \.window-content/);
  assert.match(css, /\.chat-message\.mythras-chat-message/);
  assert.match(chatScript, /classList\.add\("mythras-chat-message"\)/);
});

test("la superficie compartida queda registrada como estándar visual", () => {
  assert.match(standards, /Superficie estándar de papel/);
  assert.match(standards, /no sustituye la superficie de papel/);
});
