import test from "node:test";
import assert from "node:assert/strict";

import { MACRO_SOURCES, managedMacroUpdate } from "../scripts/data/macros.js";

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

test("el compendio incluye una macro GM para aplicar ácido mediante la API pública", () => {
  const macro = MACRO_SOURCES.find((source) => source.buildKey === "apply-acid-damage");
  assert.ok(macro);
  assert.match(macro.command, /game\.user\.isGM/);
  assert.match(macro.command, /hazards\?\.acid\?\.open/);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(macro.command));
});

test("el compendio incluye un lanzador común de peligros y fatiga", () => {
  const macro = MACRO_SOURCES.find((source) => source.buildKey === "open-hazard-launcher");
  assert.ok(macro);
  assert.match(macro.command, /DialogV2\.wait/);
  assert.match(macro.command, /hazards\?\.acid\?\.open/);
  assert.match(macro.command, /hazards\?\.fire\?\.open/);
  assert.match(macro.command, /hazards\?\.fall\?\.open/);
  assert.match(macro.command, /fatigueChecks\?\.open/);
  assert.match(macro.command, /hazards\?\.suffocation\?\.open/);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(macro.command));
});

test("el compendio incluye una macro GM para aplicar fuego mediante la API pública", () => {
  const macro = MACRO_SOURCES.find((source) => source.buildKey === "apply-fire-damage");
  assert.ok(macro);
  assert.match(macro.command, /game\.user\.isGM/);
  assert.match(macro.command, /hazards\?\.fire\?\.open/);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(macro.command));
});

test("el compendio incluye una macro GM para aplicar caídas mediante la API pública", () => {
  const macro = MACRO_SOURCES.find((source) => source.buildKey === "apply-fall-damage");
  assert.ok(macro);
  assert.match(macro.command, /game\.user\.isGM/);
  assert.match(macro.command, /hazards\?\.fall\?\.open/);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(macro.command));
});

test("el compendio incluye una macro GM para aplicar asfixia mediante la API pública", () => {
  const macro = MACRO_SOURCES.find((source) => source.buildKey === "apply-suffocation");
  assert.ok(macro);
  assert.match(macro.command, /game\.user\.isGM/);
  assert.match(macro.command, /hazards\?\.suffocation\?\.open/);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(macro.command));
});

test("el compendio incluye una macro GM para solicitar tiradas de fatiga", () => {
  const macro = MACRO_SOURCES.find((source) => source.buildKey === "request-fatigue-checks");
  assert.ok(macro);
  assert.match(macro.command, /game\.user\.isGM/);
  assert.match(macro.command, /fatigueChecks\?\.open/);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(macro.command));
});

test("el compendio incluye un lanzador ligero para el catálogo", () => {
  const macro = MACRO_SOURCES.find((source) => source.buildKey === "open-item-catalog");
  assert.ok(macro);
  assert.match(macro.command, /mythrasFoundry\?\.shop\?\.open/);
  assert.doesNotMatch(macro.command, /game\.packs/);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(macro.command));
});

test("el compendio incluye una macro GM para abrir el creador homebrew", () => {
  const macro = MACRO_SOURCES.find((source) => (
    source.buildKey === "open-homebrew-item-creator"
  ));
  assert.ok(macro);
  assert.match(macro.command, /game\.user\.isGM/);
  assert.match(macro.command, /homebrew\?\.open/);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(macro.command));
});

test("las copias antiguas de macros oficiales reciben el formato actualizado", () => {
  const update = managedMacroUpdate({
    id: "world-macro",
    flags: { "mythras-foundry": {
      macroKey: "award-party-experience-rolls", macroVersion: 1
    } }
  });
  assert.equal(update._id, "world-macro");
  assert.equal(update.flags["mythras-foundry"].macroVersion, 2);
  assert.match(update.command, /mythras-chat-card/);
  assert.equal(managedMacroUpdate({
    id: "current",
    flags: { "mythras-foundry": {
      macroKey: "award-party-experience-rolls", macroVersion: 2
    } }
  }), null);
});
