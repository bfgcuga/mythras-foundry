import test from "node:test";
import assert from "node:assert/strict";

import { MACRO_SOURCES } from "../scripts/data/macros.js";

test("el compendio incluye la macro de experiencia del grupo", () => {
  const macro = MACRO_SOURCES.find((source) => (
    source.buildKey === "award-party-experience-rolls"
  ));
  assert.ok(macro);
  assert.equal(macro.type, "script");
  assert.match(macro.command, /game\.user\.isGM/);
  assert.match(macro.command, /getActiveMembers/);
  assert.match(macro.command, /experienceModifier/);
  assert.match(macro.command, /system\.experienceRolls/);
  assert.match(macro.command, /MYTHRASF\.Chat\.Awarded/);
  assert.match(macro.command, /MYTHRASF\.Chat\.ExperienceModifier/);
  assert.match(macro.command, /mythras-chat-total/);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(macro.command));
});

test("el compendio incluye una macro GM para abrir el gestor de grupos", () => {
  const macro = MACRO_SOURCES.find((source) => source.buildKey === "manage-parties");
  assert.ok(macro);
  assert.match(macro.command, /game\.user\.isGM/);
  assert.match(macro.command, /party\?\.openManager/);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(macro.command));
});
