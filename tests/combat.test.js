import test from "node:test";
import assert from "node:assert/strict";

import {
  applyArmor,
  difficultyTarget,
  normalizeWeaponProfile,
  parseWeaponProfileReferences,
  resolveWeaponStyle
} from "../scripts/rules/combat.js";
import {
  calculateLocationHitPoints,
  findHitLocation,
  humanHitLocationData,
  hasSeriousWound,
  woundLevel,
  woundPenaltyKey,
  worstWoundLevel
} from "../scripts/rules/hit-locations.js";

function style(id, total, keys) {
  return { id, system: { total, weaponProfiles: keys.map((key) => ({ key, name: key })) } };
}

function weapon(profileKey = "espada-ancha") {
  return { name: "Espada ancha", actor: { system: { strength: 12, dexterity: 14 } },
    system: { profileKey } };
}

test("normaliza y migra referencias textuales de armas", () => {
  assert.equal(normalizeWeaponProfile(" Espada Áncha "), "espada-ancha");
  assert.deepEqual(parseWeaponProfileReferences("Espada ancha, Escudo; Lanza"), [
    { key: "espada-ancha", name: "Espada ancha" },
    { key: "escudo", name: "Escudo" },
    { key: "lanza", name: "Lanza" }
  ]);
});

test("un estilo compatible aplica su porcentaje completo", () => {
  const compatible = style("a", 72, ["espada-ancha"]);
  const result = resolveWeaponStyle({ weapon: weapon(), styles: [compatible], familiarity: "similar" });
  assert.equal(result.style, compatible);
  assert.equal(result.familiarity, "included");
  assert.equal(result.target, 72);
  assert.equal(result.difficulty, "standard");
});

test("varios estilos compatibles conservan la elección explícita", () => {
  const styles = [style("a", 72, ["espada-ancha"]), style("b", 54, ["espada-ancha"])];
  const result = resolveWeaponStyle({ weapon: weapon(), styles, selectedStyleId: "b" });
  assert.equal(result.style.id, "b");
  assert.equal(result.matching.length, 2);
});

test("la familiaridad reduce el estilo por grados oficiales", () => {
  const selected = style("a", 75, ["lanza"]);
  const broad = resolveWeaponStyle({ weapon: weapon(), styles: [selected],
    selectedStyleId: "a", familiarity: "broadlySimilar" });
  const reasonable = resolveWeaponStyle({ weapon: weapon(), styles: [selected],
    selectedStyleId: "a", familiarity: "reasonablyDifferent" });
  assert.equal(difficultyTarget(broad.target, broad.difficulty), 50);
  assert.equal(difficultyTarget(reasonable.target, reasonable.difficulty), 38);
});

test("un arma sustancialmente diferente usa FUE + DES", () => {
  const selected = style("a", 75, ["lanza"]);
  const result = resolveWeaponStyle({ weapon: weapon(), styles: [selected],
    selectedStyleId: "a", familiarity: "substantiallyDifferent" });
  assert.equal(result.target, 26);
  assert.equal(result.usesBase, true);
});

test("la armadura nunca produce daño negativo", () => {
  assert.equal(applyArmor(8, 3), 5);
  assert.equal(applyArmor(2, 4), 0);
});

test("la tabla humana calcula los siete valores para CON 10 y TAM 10", () => {
  const locations = humanHitLocationData({ constitution: 10, size: 10 });
  assert.equal(locations.length, 7);
  assert.deepEqual(locations.map((entry) => entry.system.maxHitPoints), [4, 4, 5, 6, 3, 3, 4]);
  assert.equal(calculateLocationHitPoints(10, 10, "chest"), 6);
});

test("las localizaciones humanas separan carga y porcentaje de precio de armadura", () => {
  const locations = humanHitLocationData({ constitution: 10, size: 10 });
  assert.deepEqual(locations.map(({ system }) => system.armorEncumbranceMultiplier),
    [1.5, 1.5, 2, 3, 1, 1, 1.5]);
  assert.deepEqual(locations.map(({ system }) => system.armorCostPercentage),
    [15, 15, 20, 25, 7.5, 7.5, 10]);
  assert.ok(locations.every(({ system }) => system.armorFactorsVersion === 2));
});

test("los umbrales de herida usan los PV máximos", () => {
  assert.equal(woundLevel(4, 4), "healthy");
  assert.equal(woundLevel(1, 4), "minor");
  assert.equal(woundLevel(0, 4), "serious");
  assert.equal(woundLevel(-3, 4), "serious");
  assert.equal(woundLevel(-4, 4), "major");
});

test("el estado general usa la herida más grave de todas las localizaciones", () => {
  const locations = [{ system: { currentHitPoints: 3, maxHitPoints: 3 } },
    { system: { currentHitPoints: 1, maxHitPoints: 4 } },
    { system: { currentHitPoints: -4, maxHitPoints: 4 } }];
  assert.equal(worstWoundLevel(locations), "major");
  assert.equal(worstWoundLevel([]), "healthy");
});

test("la penalizacion del encabezado deriva del nivel de herida", () => {
  assert.equal(woundPenaltyKey("healthy"), "none");
  assert.equal(woundPenaltyKey("minor"), "none");
  assert.equal(woundPenaltyKey("serious"), "situationalDifficulty");
  assert.equal(woundPenaltyKey("major"), "incapacitated");
});

test("cualquier herida grave activa la consulta situacional", () => {
  assert.equal(hasSeriousWound([
    { system: { currentHitPoints: 0, maxHitPoints: 4, disabled: false } }
  ]), true);
  assert.equal(hasSeriousWound([
    { system: { currentHitPoints: 1, maxHitPoints: 4, disabled: true } },
    { system: { currentHitPoints: -4, maxHitPoints: 4, disabled: true } }
  ]), false);
});

test("una tirada localiza el rango correspondiente o devuelve null", () => {
  const locations = [
    { system: { rangeStart: 1, rangeEnd: 10 } },
    { system: { rangeStart: 11, rangeEnd: 20 } }
  ];
  assert.equal(findHitLocation(locations, 17), locations[1]);
  assert.equal(findHitLocation(locations, 21), null);
});
