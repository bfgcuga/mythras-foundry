import test from "node:test";
import assert from "node:assert/strict";

import {
  assessWeaponEquip,
  equippedHandsUsed,
  inferWeaponHands,
  weaponHandsRequired
} from "../scripts/rules/equipment.js";

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

test("una empuñadura a dos manos corrige el valor antiguo de una mano", () => {
  const shield = weapon("shield", 1, true);
  const legacyGreatsword = { id: "greatsword", system: {
    handsRequired: 1,
    grip: "2 manos",
    equipped: false
  } };
  assert.equal(weaponHandsRequired(legacyGreatsword), 2);
  assert.equal(assessWeaponEquip(legacyGreatsword, [shield, legacyGreatsword]).allowed, false);
});

test("no se puede equipar una tercera arma de una mano", () => {
  const weapons = [weapon("a", 1, true), weapon("b", 1, true), weapon("c", 1)];
  assert.equal(assessWeaponEquip(weapons[2], weapons).allowed, false);
});

test("el modo preparado determina las manos ocupadas", () => {
  const versatile = { id: "spear", system: { equipped: true, activeModeKey: "two",
    modes: [{ key: "one", grip: "1 mano", handsRequired: 1 },
      { key: "two", grip: "2 manos", handsRequired: 2 }] } };
  assert.equal(weaponHandsRequired(versatile), 2);
  assert.equal(weaponHandsRequired(versatile, "one"), 1);
});

test("cambiar a modo de dos manos se rechaza junto a un escudo", () => {
  const shield = weapon("shield", 1, true);
  const versatile = { id: "spear", system: { equipped: false, activeModeKey: "one",
    modes: [{ key: "one", handsRequired: 1 }, { key: "two", grip: "2 manos", handsRequired: 2 }] } };
  assert.equal(assessWeaponEquip(versatile, [shield, versatile], "two").allowed, false);
});
