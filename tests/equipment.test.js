import test from "node:test";
import assert from "node:assert/strict";

import { assessWeaponEquip, equippedHandsUsed, inferWeaponHands } from "../scripts/rules/equipment.js";

const weapon = (id, handsRequired, equipped = false) => ({ id, system: { handsRequired, equipped } });

test("infiere armas desarmadas, de una mano y de dos manos", () => {
  assert.equal(inferWeaponHands({ profileKey: "desarmado", grip: "" }), 0);
  assert.equal(inferWeaponHands({ grip: "1 mano" }), 1);
  assert.equal(inferWeaponHands({ grip: "2 manos" }), 2);
});

test("dos armas de una mano o arma y escudo ocupan las dos manos", () => {
  assert.equal(equippedHandsUsed([weapon("sword", 1, true), weapon("shield", 1, true)]), 2);
});

test("un arma a dos manos exige que ambas estén libres", () => {
  const sword = weapon("sword", 1, true);
  const greatsword = weapon("greatsword", 2);
  assert.equal(assessWeaponEquip(greatsword, [sword, greatsword]).allowed, false);
  assert.equal(assessWeaponEquip(greatsword, [greatsword]).allowed, true);
});

test("no se puede equipar una tercera arma de una mano", () => {
  const weapons = [weapon("a", 1, true), weapon("b", 1, true), weapon("c", 1)];
  assert.equal(assessWeaponEquip(weapons[2], weapons).allowed, false);
});
