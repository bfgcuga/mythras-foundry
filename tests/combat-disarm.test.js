import test from "node:test";
import assert from "node:assert/strict";
import { disarmDifficulty, disarmHasFreeHand, disarmResistanceTarget,
  disarmStrengthAllowed, disarmWeaponChoices } from "../scripts/rules/combat-disarm.js";

const weapon = (id, name, size = "M", hands = 1, equipped = true) => ({ id, name,
  type: "weapon", system: { equipped, activeModeKey: "main",
    modes: [{ key: "main", size, handsRequired: hands }] } });
const actor = (strength, weapons = []) => ({ system: { strength },
  items: { filter: (predicate) => weapons.filter(predicate) } });

test("el tamaño del arma atacante desplaza la dificultad del desarme", () => {
  assert.deepEqual(disarmDifficulty("G", "M"), { steps: 1, difficulty: "hard" });
  assert.deepEqual(disarmDifficulty("P", "G"), { steps: -2, difficulty: "veryEasy" });
  assert.deepEqual(disarmResistanceTarget(60, "G", "M"), {
    steps: 1, difficulty: "hard", baseTarget: 60, target: 40 });
});

test("el desarme limita la FUE de la víctima al doble de la atacante", () => {
  assert.equal(disarmStrengthAllowed(actor(12), actor(24)), true);
  assert.equal(disarmStrengthAllowed(actor(12), actor(25)), false);
});

test("la mano libre y las armas arrebatables proceden del equipo activo", () => {
  const sword = weapon("sword", "Espada");
  const shield = weapon("shield", "Escudo");
  assert.equal(disarmHasFreeHand(actor(10, [sword])), true);
  assert.equal(disarmHasFreeHand(actor(10, [sword, shield])), false);
  assert.deepEqual(disarmWeaponChoices(actor(10, [sword, shield]), "shield")
    .map((entry) => entry.id), ["shield", "sword"]);
});
