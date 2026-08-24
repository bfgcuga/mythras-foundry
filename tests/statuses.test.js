import test from "node:test";
import assert from "node:assert/strict";
import { activeSkillStatusPenalties, applyStatusAttributes, BLINDED_STATUS_ID,
  ACID_IMMERSION_STATUS_ID, ACID_SPLASH_STATUS_ID, BLEEDING_STATUS_ID,
  BURNING_STATUS_ID, canActorAttack, DROWNING_STATUS_ID, MYTHRAS_STATUS_EFFECTS,
  PRONE_STATUS_ID, statusSkillDifficulty, STUNNED_STATUS_ID,
  SURPRISED_STATUS_ID, UNCONSCIOUS_STATUS_ID } from "../scripts/rules/statuses.js";

test("cegado establece dificultad herculea", () => {
  assert.equal(statusSkillDifficulty(new Set([BLINDED_STATUS_ID])), "herculean");
});

test("inconsciente pone habilidades y atributos derivados a cero", () => {
  const statuses = new Set([UNCONSCIOUS_STATUS_ID]);
  assert.equal(statusSkillDifficulty(statuses), "impossible");
  assert.deepEqual(applyStatusAttributes({ initiative: 12, movementRate: 6,
    actionPointsMax: 3, damageModifier: { sign: 1, terms: ["1d2"], label: "+1d2" } }, statuses),
  { initiative: 0, movementRate: 0, actionPointsMax: 0,
    damageModifier: { sign: 0, terms: [], label: "0" } });
});

test("aturdido e inconsciente impiden atacar, pero los demás estados no", () => {
  assert.equal(canActorAttack(new Set([STUNNED_STATUS_ID])), false);
  assert.equal(canActorAttack(new Set([UNCONSCIOUS_STATUS_ID])), false);
  assert.equal(canActorAttack(new Set([BLEEDING_STATUS_ID])), true);
});

test("sangrando y ahogándose exigen resistencia por asalto", () => {
  const periodic = MYTHRAS_STATUS_EFFECTS.filter((status) => status.roundAutomation === "resistance")
    .map((status) => status.id);
  assert.deepEqual(periodic, [BLEEDING_STATUS_ID, DROWNING_STATUS_ID]);
});

test("ácido se registra como estado sin imponer una penalización adicional", () => {
  assert.ok(MYTHRAS_STATUS_EFFECTS.some((status) => status.id === ACID_SPLASH_STATUS_ID));
  assert.ok(MYTHRAS_STATUS_EFFECTS.some((status) => status.id === ACID_IMMERSION_STATUS_ID));
  assert.equal(statusSkillDifficulty(new Set([ACID_SPLASH_STATUS_ID])), "standard");
  assert.equal(canActorAttack(new Set([ACID_IMMERSION_STATUS_ID])), true);
});

test("ardiendo se registra como estado neutral resuelto por la cola del DJ", () => {
  assert.ok(MYTHRAS_STATUS_EFFECTS.some((status) => status.id === BURNING_STATUS_ID));
  assert.equal(statusSkillDifficulty(new Set([BURNING_STATUS_ID])), "standard");
  assert.equal(canActorAttack(new Set([BURNING_STATUS_ID])), true);
});

test("sorprendido penaliza iniciativa y bloquea ataque y defensa", () => {
  const surprised = MYTHRAS_STATUS_EFFECTS.find((status) => status.id === SURPRISED_STATUS_ID);
  assert.equal(surprised.initiativePenalty, 10);
  assert.equal(statusSkillDifficulty(new Set([SURPRISED_STATUS_ID])), "standard");
  assert.equal(canActorAttack(new Set([SURPRISED_STATUS_ID])), false);
});

test("derribado establece dificultad formidable", () => {
  assert.equal(statusSkillDifficulty(new Set([PRONE_STATUS_ID])), "formidable");
});

test("varios estados conservan la peor dificultad y sus fuentes", () => {
  const statuses = new Set([BLINDED_STATUS_ID, PRONE_STATUS_ID]);
  assert.equal(statusSkillDifficulty(statuses), "herculean");
  assert.deepEqual(activeSkillStatusPenalties(statuses).map(({ id }) => id),
    [BLINDED_STATUS_ID, PRONE_STATUS_ID]);
});
