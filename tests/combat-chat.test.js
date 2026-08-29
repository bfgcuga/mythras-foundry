import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { preferredCombatCoordinator, validateCombatResponse,
  woundCheckOutcomeKey } from "../scripts/rules/combat-chat.js";
import { difficultyTone, targetTone } from "../scripts/rules/combat-chat-renderer.js";

test("el primer DJ activo coordina y el autor es el respaldo", () => {
  const users = [{ id: "z", active: true, isGM: true }, { id: "a", active: true, isGM: true },
    { id: "author", active: true, isGM: false }];
  assert.equal(preferredCombatCoordinator(users, "author"), "a");
  assert.equal(preferredCombatCoordinator(users.filter((user) => !user.isGM), "author"), "author");
});

test("paradas y daño se incorporan como Roll al mensaje interactivo", () => {
  const source = fs.readFileSync(new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8");
  assert.match(source, /appendSerializedRolls\(message, request\.defense\.serializedRoll\)/);
  assert.match(source, /request\.alternateRoll\?\.serializedRoll, request\.serializedLocationRoll/);
  assert.match(source, /rolls: appendSerializedRolls\(message, request\.serializedRoll\)/);
  assert.match(source, /appendSerializedRolls\(message, request\.resolution\?\.serializedRoll\)/);
});

test("las pruebas de heridas distinguen oposición y consecuencia anatómica", () => {
  const resolution = { winner: "right" };
  assert.equal(woundCheckOutcomeKey({ source: "wound", woundSeverity: "serious",
    locationKind: { extremity: true, leg: true }, resolution }), "seriousFailedLeg");
  assert.equal(woundCheckOutcomeKey({ source: "wound", woundSeverity: "major",
    locationKind: { extremity: false }, resolution: { winner: "left" } }),
  "majorResistedBody");
  assert.equal(woundCheckOutcomeKey({ source: "effect", resolution }), null);
});

test("una tirada sin localización cierra el daño sin reasignarlo", () => {
  const source = fs.readFileSync(new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8");
  const renderer = fs.readFileSync(new URL("../scripts/rules/combat-chat-renderer.js",
    import.meta.url), "utf8");
  const state = fs.readFileSync(new URL("../scripts/rules/combat-exchange-state.js",
    import.meta.url), "utf8");
  assert.match(source, /combat\.damage\.status = "missedLocation"/);
  assert.match(renderer, /MYTHRASF\.Combat\.NoHitLocation/);
  assert.match(state, /"unavailable", "applied", "missedLocation"/);
  assert.match(source, /permanentWound: entry\.permanentWound/);
});

test("la respuesta de combate rechaza estado, revision, propiedad y tipo invalidos", () => {
  const combat = { status: "awaitingDefense", revision: 2 };
  const actor = { testUserPermission: () => true };
  const user = { id: "u", isGM: false };
  const valid = { revision: 2, userId: "u", defense: { type: "parry" } };
  assert.equal(validateCombatResponse(combat, valid, { actor, user }), null);
  assert.equal(validateCombatResponse({ ...combat, status: "resolved" }, valid, { actor, user }), "state");
  assert.equal(validateCombatResponse(combat, { ...valid, revision: 1 }, { actor, user }), "revision");
  assert.equal(validateCombatResponse(combat, valid,
    { actor: { testUserPermission: () => false }, user }), "ownership");
  assert.equal(validateCombatResponse(combat, { ...valid, defense: { type: "block" } },
    { actor, user }), "invalid");
});

test("la tarjeta clasifica dificultad y objetivo con los colores compartidos", () => {
  assert.equal(difficultyTone("easy"), "bonus");
  assert.equal(difficultyTone("standard"), "neutral");
  assert.equal(difficultyTone("hard"), "penalty");
  assert.equal(targetTone(75, 60), "bonus");
  assert.equal(targetTone(45, 60), "penalty");
  assert.equal(targetTone(60, 60), "neutral");
  const renderer = fs.readFileSync(new URL("../scripts/rules/combat-chat-renderer.js",
    import.meta.url), "utf8");
  assert.match(renderer, /mythras-chat-result--[\s\S]*combat-roll-outcome/);
  assert.match(renderer, /combat-wound-outcome wound-/);
  assert.match(renderer, /skill-roll-target--\$\{targetTone/);
});

test("la prueba de herida crítica ofrece reducirla mediante Suerte", () => {
  const renderer = fs.readFileSync(new URL("../scripts/rules/combat-chat-renderer.js",
    import.meta.url), "utf8");
  const source = fs.readFileSync(new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8");
  assert.match(renderer, /data-combat-action="wound-luck"/);
  assert.match(source, /action: "combatWoundLuck"/);
  assert.match(source, /"system\.resources\.luckPoints\.value": points - 1/);
});

test("la suerte de combate permite elegir pagador y limita la tirada ajena a repetir", () => {
  const source = fs.readFileSync(new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8");
  assert.match(source, /spenders\.length > 1[\s\S]*name="luckSide"/);
  assert.match(source, /const ownRoll = spender\.side === side/);
  assert.match(source, /ownRoll \? \[\{ action: "invert"/);
  assert.match(source, /\(!ownRoll && request\.mode !== "reroll"\)/);
  assert.match(source, /spender\.actor\.update\(\{ "system\.resources\.luckPoints\.value": points - 1 \}\)/);
});

test("el fallo de Aguante en un brazo resuelve en la tarjeta qué objeto se suelta", () => {
  const source = fs.readFileSync(new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8");
  const renderer = fs.readFileSync(new URL("../scripts/rules/combat-chat-renderer.js",
    import.meta.url), "utf8");
  assert.match(source, /function heldItemChoices[\s\S]*item\.system\.equipped/);
  assert.match(source, /applyWoundConsequences\(combat, defender, location,[\s\S]*afterEndurance: true/);
  assert.match(source, /applyDropHeldItem[\s\S]*"system\.equipped": false/);
  assert.match(renderer, /data-combat-action="drop-held-item"/);
  assert.match(renderer, /data-drop-held-item/);
});
