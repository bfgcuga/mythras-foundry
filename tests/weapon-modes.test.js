import test from "node:test";
import assert from "node:assert/strict";
import { effectiveModeProfileKey, findWeaponMode, legacyWeaponMode, modeKeysAreUnique, weaponModeDisplayName, weaponModeView } from "../scripts/rules/weapon-modes.js";
import { mergedWeaponModes, weaponMergeCandidates } from "../scripts/rules/weapon-mode-merge.js";

test("un arma antigua produce un modo equivalente sin perder su estilo", () => {
  const mode = legacyWeaponMode({ name: "Daga", system: { weaponType: "ranged", damage: "1d4", grip: "1 mano", handsRequired: 1, preferredCombatStyleId: "style", familiarity: "broadlySimilar" } });
  assert.equal(mode.damage, "1d4"); assert.equal(mode.preferredCombatStyleId, "style"); assert.equal(mode.familiarity, "broadlySimilar");
});

test("un modo hereda el perfil físico o puede sobrescribirlo", () => {
  const weapon = { id: "w", name: "Lanza", system: { profileKey: "lanza", activeModeKey: "one", modes: [{ key: "one", name: "1M", profileKey: "" }, { key: "two", name: "2M", profileKey: "pica" }] } };
  assert.equal(effectiveModeProfileKey(weapon, findWeaponMode(weapon, "one")), "lanza");
  assert.equal(weaponModeView(weapon, "two").system.profileKey, "pica");
});

test("las claves duplicadas se detectan", () => assert.equal(modeKeysAreUnique([{ key: "melee" }, { key: "Mêlée" }]), false));

test("el nombre físico solo añade un sufijo cuando el modo lo necesita", () => {
  const weapon = { name: "Daga" };
  assert.equal(weaponModeDisplayName(weapon, { name: "" }), "Daga");
  assert.equal(weaponModeDisplayName(weapon, { name: "Arrojar" }), "Daga - Arrojar");
  assert.equal(weaponModeDisplayName({ name: "Lanza" }, { name: "2M" }), "Lanza - 2M");
});

test("el asistente conserva datos físicos y solo combina modos", () => {
  const keeper = { id: "a", type: "weapon", system: { profileKey: "daga", weight: 1, modes: [{ key: "melee" }] } };
  const donor = { id: "b", type: "weapon", system: { profileKey: "daga", weight: 9, modes: [{ key: "thrown" }] } };
  const actor = { items: [keeper, donor] };
  assert.equal(weaponMergeCandidates([actor])[0].conflicts.includes("weight"), true);
  assert.deepEqual(mergedWeaponModes(keeper, [donor]).map((mode) => mode.key), ["melee", "thrown"]);
  assert.equal(keeper.system.weight, 1);
});
