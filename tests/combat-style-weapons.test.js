import test from "node:test";
import assert from "node:assert/strict";
import { manualWeaponProfiles, mergeWeaponProfiles, removeWeaponProfile, weaponProfileOptions } from "../scripts/rules/combat-style-weapons.js";

test("un arma de varios modos heredados aporta un único perfil", () => {
  const weapon = { name: "Daga", system: { profileKey: "daga", modes: [
    { key: "melee", name: "" }, { key: "thrown", name: "Arrojar" }
  ] } };
  assert.deepEqual(weaponProfileOptions(weapon), [{ key: "daga", name: "Daga" }]);
});

test("varios modos con el mismo perfil usan el nombre físico", () => {
  const weapon = { name: "Lanza", system: { profileKey: "lanza", modes: [
    { key: "one", name: "1M" }, { key: "two", name: "2M" }
  ] } };
  assert.deepEqual(weaponProfileOptions(weapon), [{ key: "lanza", name: "Lanza" }]);
});

test("los perfiles propios de los modos se ofrecen por separado", () => {
  const weapon = { name: "Lanza", system: { profileKey: "lanza", modes: [
    { key: "one", name: "1M", profileKey: "lanza-1m" },
    { key: "two", name: "2M", profileKey: "lanza-2m" }
  ] } };
  assert.deepEqual(weaponProfileOptions(weapon), [
    { key: "lanza-1m", name: "Lanza - 1M" }, { key: "lanza-2m", name: "Lanza - 2M" }
  ]);
});

test("la incorporación conserva el orden y evita duplicados", () => {
  const result = mergeWeaponProfiles([{ key: "daga", name: "Daga" }], [
    { key: "Dága", name: "Daga repetida" }, { key: "arco", name: "Arco" }
  ]);
  assert.deepEqual(result.profiles, [{ key: "daga", name: "Daga" }, { key: "arco", name: "Arco" }]);
  assert.equal(result.added, 1); assert.equal(result.duplicates, 1);
});

test("la entrada manual admite comas, punto y coma y líneas", () => {
  assert.deepEqual(manualWeaponProfiles("Espada; Arco\nLanza"), [
    { key: "espada", name: "Espada" }, { key: "arco", name: "Arco" },
    { key: "lanza", name: "Lanza" }
  ]);
});

test("la lista no impone un límite artificial", () => {
  const incoming = Array.from({ length: 100 }, (_, index) => ({ key: `arma-${index}`, name: `Arma ${index}` }));
  assert.equal(mergeWeaponProfiles([], incoming).profiles.length, 100);
});

test("eliminar un perfil conserva los demás y cambia la compatibilidad disponible", () => {
  assert.deepEqual(removeWeaponProfile([
    { key: "daga", name: "Daga" }, { key: "arco", name: "Arco" }
  ], "Dága"), [{ key: "arco", name: "Arco" }]);
});
