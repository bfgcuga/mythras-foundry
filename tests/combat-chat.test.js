import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { preferredCombatCoordinator, validateCombatResponse,
  preferredParryChoice, selectedParryChoice,
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
  const responseRuntime = fs.readFileSync(new URL("../scripts/rules/combat-response-runtime.js",
    import.meta.url), "utf8");
  const damageRuntime = fs.readFileSync(new URL("../scripts/rules/combat-damage-runtime.js",
    import.meta.url), "utf8");
  const checkRuntime = fs.readFileSync(new URL("../scripts/rules/combat-check-runtime.js",
    import.meta.url), "utf8");
  assert.match(responseRuntime, /appendRolls\(message, request\.defense\.serializedRoll\)/);
  assert.match(damageRuntime, /request\.alternateRoll\?\.serializedRoll, request\.serializedLocationRoll/);
  assert.match(damageRuntime, /rolls: appendRolls\(message, request\.serializedRoll\)/);
  assert.match(checkRuntime, /appendRolls\(message, request\.resolution\?\.serializedRoll\)/);
});

test("la parada prefiere el arma que no mantiene el bloqueo pasivo", () => {
  const choices = [{ value: "shield", weaponId: "shield" },
    { value: "sword", weaponId: "sword" }];
  assert.equal(preferredParryChoice(choices, { status: "active", weaponId: "shield" }).value,
    "sword");
  assert.equal(preferredParryChoice(choices, { status: "consumed", weaponId: "shield" }).value,
    "shield");
  assert.equal(preferredParryChoice([choices[0]],
    { status: "active", weaponId: "shield" }).value, "shield");
});

test("cancelar el selector de parada no produce una defensa parcial", () => {
  const choices = [{ value: "sword", weaponId: "sword" }];
  assert.equal(selectedParryChoice(choices, "sword"), choices[0]);
  assert.equal(selectedParryChoice(choices, "cancel"), null);
  assert.equal(selectedParryChoice(choices, null), null);
});

test("la tarjeta descarta parar y evadir antes del diálogo si no quedan PA", () => {
  const source = fs.readFileSync(new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8");
  const damageRuntime = fs.readFileSync(new URL("../scripts/rules/combat-damage-runtime.js",
    import.meta.url), "utf8");
  assert.match(source, /\["parry", "evade"\]\.includes\(type\)[\s\S]*currentActionPoints\(actor\) < 1/);
  assert.match(source, /lacksActionPoints[\s\S]*\["parry", "evade"\]\.includes\(button\.dataset\.combatAction\)/);
  assert.match(source, /MYTHRASF\.Combat\.NoActionPoints/);
});

test("las pruebas de heridas distinguen oposición y consecuencia anatómica", () => {
  const resolution = { winner: "right" };
  assert.equal(woundCheckOutcomeKey({ source: "wound", woundSeverity: "serious",
    locationKind: { extremity: true, leg: true }, resolution }), "seriousFailedLeg");
  assert.equal(woundCheckOutcomeKey({ source: "wound", woundSeverity: "major",
    locationKind: { extremity: false }, resolution: { winner: "left" } }),
  "majorResistedBody");
  assert.equal(woundCheckOutcomeKey({ source: "effect", resolution }), null);
  const renderer = fs.readFileSync(new URL("../scripts/rules/combat-chat-renderer.js",
    import.meta.url), "utf8");
  assert.match(renderer, /combat-check-detail combat-check-consequence/);
  assert.doesNotMatch(renderer, /mythras-chat-row combat-check-consequence/);
  assert.match(renderer, /resolution\.rawRoll[\s\S]*resolution\.result/);
  assert.match(renderer, /opposed\.rawRoll[\s\S]*opposed\.result/);
  assert.match(renderer, /mythras-chat-total mythras-chat-result--\$\{resisted/);
});

test("una tirada sin localización cierra el daño sin reasignarlo", () => {
  const source = fs.readFileSync(new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8");
  const renderer = fs.readFileSync(new URL("../scripts/rules/combat-chat-renderer.js",
    import.meta.url), "utf8");
  const state = fs.readFileSync(new URL("../scripts/rules/combat-exchange-state.js",
    import.meta.url), "utf8");
  const damageRuntime = fs.readFileSync(new URL("../scripts/rules/combat-damage-runtime.js",
    import.meta.url), "utf8");
  assert.match(damageRuntime, /combat\.damage\.status = "missedLocation"/);
  assert.match(renderer, /MYTHRASF\.Combat\.NoHitLocation/);
  assert.match(state, /"unavailable", "applied", "missedLocation"/);
  assert.match(source, /permanentWound: entry\.permanentWound/);
  assert.match(source, /evaluateSystemRoll\("1d3"/);
  assert.match(source, /SETTING_KEYS\.permanentWoundHitLocationRule/);
  assert.match(renderer, /MYTHRASF\.Combat\.PermanentWoundHitFailed/);
  assert.match(damageRuntime, /permanentWoundHitCheck/);
  assert.match(damageRuntime, /serializedPermanentWoundHitRoll/);
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
  const damageRuntime = fs.readFileSync(new URL("../scripts/rules/combat-damage-runtime.js",
    import.meta.url), "utf8");
  assert.match(renderer, /data-combat-action="wound-luck"/);
  assert.match(source, /action: "combatWoundLuck"/);
  assert.match(damageRuntime, /"system\.resources\.luckPoints\.value": points - 1/);
  assert.match(renderer, /combat-wound-luck-button/);
  assert.doesNotMatch(renderer, /resolve-check-manual/);
});

test("el daño precede a la prueba de Aguante de la herida", () => {
  const source = fs.readFileSync(new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8");
  const damageRuntime = fs.readFileSync(new URL("../scripts/rules/combat-damage-runtime.js",
    import.meta.url), "utf8");
  const renderer = fs.readFileSync(new URL("../scripts/rules/combat-chat-renderer.js",
    import.meta.url), "utf8");
  assert.match(source, /\["applied", "unavailable", "missedLocation"\]\.includes\(combat\.damage\?\.status\)/);
  assert.doesNotMatch(damageRuntime, /check\.status === "pending" && check\.source !== "wound"/);
  assert.match(renderer, /MYTHRASF\.Combat\.WoundCheck\.ApplyDamageFirst/);
  assert.match(renderer, /combat\.damage\?\.status === "applied"/);
});

test("las resistencias automatizadas no ocultan ni bloquean el daño", () => {
  const source = fs.readFileSync(new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8");
  const renderer = fs.readFileSync(new URL("../scripts/rules/combat-chat-renderer.js",
    import.meta.url), "utf8");
  assert.match(source, /combatEffectCheckPhase\(check, combat\.effects\?\.selections/);
  assert.match(source, /combat\.damage\?\.status === "ready"/);
  assert.match(renderer, /combat\.damage\?\.status === "ready"\) damageHtml/);
  assert.doesNotMatch(renderer, /resolve-effect/);
});

test("las heridas graves y críticas permiten Suerte antes de aplicar consecuencias", () => {
  const checkRuntime = fs.readFileSync(new URL("../scripts/rules/combat-check-runtime.js",
    import.meta.url), "utf8");
  const renderer = fs.readFileSync(new URL("../scripts/rules/combat-chat-renderer.js",
    import.meta.url), "utf8");
  assert.match(checkRuntime, /check\.status = "rolled"/);
  assert.match(checkRuntime, /request\.finalize && check\.source === "wound"/);
  assert.match(checkRuntime, /"system\.resources\.luckPoints\.value": points - 1/);
  assert.match(renderer, /data-combat-action="check-luck"/);
  assert.match(renderer, /data-combat-action="confirm-check"/);
});

test("las pruebas de efectos admiten habilidad elegida, Suerte y consecuencia automatizada", () => {
  const source = fs.readFileSync(new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8");
  const runtime = fs.readFileSync(new URL("../scripts/rules/combat-check-runtime.js",
    import.meta.url), "utf8");
  const renderer = fs.readFileSync(new URL("../scripts/rules/combat-chat-renderer.js",
    import.meta.url), "utf8");
  assert.match(source, /shieldResistanceChoices[\s\S]*mode\.weaponType === "shield"/);
  assert.match(source, /MYTHRASF\.Combat\.CheckChooseAbility/);
  assert.match(runtime, /if \(request\.reroll\) \{\s+if \(check\.resolution\?\.automaticFailure\)/);
  assert.match(runtime, /request\.finalize && check\.source !== "wound"/);
  assert.match(renderer, /MYTHRASF\.Combat\.EffectConsequence\.blinded/);
  assert.match(renderer, /MYTHRASF\.Combat\.EffectResolution/);
});

test("la suerte de combate permite elegir pagador y limita la tirada ajena a repetir", () => {
  const source = fs.readFileSync(new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8");
  const responseRuntime = fs.readFileSync(new URL("../scripts/rules/combat-response-runtime.js",
    import.meta.url), "utf8");
  const resourceRuntime = fs.readFileSync(new URL("../scripts/rules/combat-resource-runtime.js",
    import.meta.url), "utf8");
  assert.match(source, /spenders\.length > 1[\s\S]*name="luckSide"/);
  assert.match(source, /const ownRoll = spender\.side === side/);
  assert.match(source, /ownRoll \? \[\{ action: "invert"/);
  assert.match(responseRuntime, /\(!ownRoll && request\.mode !== "reroll"\)/);
  assert.match(resourceRuntime, /"system\.resources\.luckPoints\.value": points - 1/);
});

test("el fallo de Aguante en un brazo resuelve en la tarjeta qué objeto se suelta", () => {
  const source = fs.readFileSync(new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8");
  const woundRuntime = fs.readFileSync(new URL("../scripts/rules/combat-wound-runtime.js",
    import.meta.url), "utf8");
  const runtime = fs.readFileSync(new URL("../scripts/rules/combat-exchange-runtime.js",
    import.meta.url), "utf8");
  const renderer = fs.readFileSync(new URL("../scripts/rules/combat-chat-renderer.js",
    import.meta.url), "utf8");
  assert.match(woundRuntime, /heldCombatItemChoices[\s\S]*item\.system\.equipped/);
  assert.match(woundRuntime, /afterEndurance[\s\S]*baselineTypes/);
  assert.match(runtime, /applyDroppedCombatItem[\s\S]*"system\.equipped": false/);
  assert.match(renderer, /data-combat-action="drop-held-item"/);
  assert.match(renderer, /data-drop-held-item/);
  assert.match(renderer, /MYTHRASF\.Combat\.Consequence\.droppedItem/);
});
