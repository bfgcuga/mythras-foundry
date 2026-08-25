import test from "node:test";
import assert from "node:assert/strict";

import {
  applyArmor,
  combatAttackHits,
  difficultyTarget,
  evasionWinner,
  normalizeWeaponProfile,
  parseWeaponProfileReferences,
  parryReduction,
  resolveDamage,
  resolveCombatExchange,
  resolveWeaponStyle,
  UNTRAINED_COMBAT_STYLE_ID
} from "../scripts/rules/combat.js";
import {
  calculateLocationHitPoints,
  findHitLocation,
  humanHitLocationData,
  hasSeriousWound,
  permanentWoundLostHitResults,
  permanentWoundMaximum,
  permanentWoundSeverity,
  permanentWoundState,
  woundLevel,
  woundLocationKind,
  woundPenaltyKey,
  worstWoundLevel
} from "../scripts/rules/hit-locations.js";

test("las consecuencias de heridas reconocen brazos y piernas por anatomía canónica", () => {
  const locations = humanHitLocationData({ constitution: 10, size: 10 });
  const rightLeg = locations.find((location) => location.system.rangeStart === 1);
  const rightArm = locations.find((location) => location.system.rangeStart === 13);
  const chest = locations.find((location) => location.system.rangeStart === 10);
  assert.deepEqual(woundLocationKind(rightLeg), {
    extremity: true, arm: false, leg: true, vital: false });
  assert.deepEqual(woundLocationKind(rightArm), {
    extremity: true, arm: true, leg: false, vital: false });
  assert.deepEqual(woundLocationKind(chest), {
    extremity: false, arm: false, leg: false, vital: true });
});

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

test("un arma sin estilo puede usarse sin entrenamiento con FUE + DES", () => {
  const result = resolveWeaponStyle({
    weapon: weapon("garrote"),
    styles: [style("a", 75, ["lanza"])],
    selectedStyleId: UNTRAINED_COMBAT_STYLE_ID,
    familiarity: "similar"
  });
  assert.equal(result.style, null);
  assert.equal(result.target, 26);
  assert.equal(result.difficulty, "standard");
  assert.equal(result.usesBase, true);
  assert.equal(result.untrained, true);
});

test("sin entrenamiento no sustituye un estilo que incluye el arma", () => {
  const compatible = style("a", 72, ["espada-ancha"]);
  const result = resolveWeaponStyle({
    weapon: weapon(), styles: [compatible], selectedStyleId: UNTRAINED_COMBAT_STYLE_ID
  });
  assert.equal(result.style, compatible);
  assert.equal(result.target, 72);
  assert.notEqual(result.untrained, true);
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

test("la lesión permanente progresa, redondea y conserva el máximo original", () => {
  assert.deepEqual([1, 2, 3].map((grade) => permanentWoundMaximum(5, grade)), [4, 2, 1]);
  assert.equal(permanentWoundSeverity(1, 1), 2);
  assert.equal(permanentWoundSeverity(2, 1), 3);
  assert.equal(permanentWoundSeverity(3, 1), 3);
  const arm = { system: { rangeStart: 13, rangeEnd: 15, category: "limb",
    hpClass: "arm", maxHitPoints: 5, permanentWound: { severity: 1,
      originalMaxHitPoints: 5, description: "Anterior" } } };
  const wound = permanentWoundState(arm, { severity: 2, roll: 1, description: "Nueva" });
  assert.deepEqual({ severity: wound.severity, original: wound.originalMaxHitPoints,
    effective: wound.effectiveMaxHitPoints, lost: wound.lostHitResults },
  { severity: 2, original: 5, effective: 2, lost: 2 });
  assert.equal(permanentWoundLostHitResults(arm, 3), 3);
});

test("los resultados anulados desde el inicio no impactan ninguna localización", () => {
  const arm = { system: { rangeStart: 13, rangeEnd: 15,
    permanentWound: { lostHitResults: 2 } } };
  assert.equal(findHitLocation([arm], 13), null);
  assert.equal(findHitLocation([arm], 14), null);
  assert.equal(findHitLocation([arm], 15), arm);
});

test("una defensa predeclarada comparte la mayor reduccion por encima de 100", () => {
  const result = resolveCombatExchange({ predeclared: true,
    attack: { target: 130, rawRoll: 90 },
    defense: { type: "parry", target: 85, rawRoll: 60 } });
  assert.equal(result.sharedPenalty, 30);
  assert.equal(result.attack.target, 100);
  assert.equal(result.defense.target, 55);
  assert.equal(result.advantage, 1);
  assert.equal(result.winner, "attacker");
  assert.equal(result.effects, 1);
});

test("una defensa tardia no reclasifica ni reduce el ataque", () => {
  const result = resolveCombatExchange({ predeclared: false,
    attack: { target: 130, rawRoll: 90 },
    defense: { type: "evade", target: 85, rawRoll: 60 } });
  assert.equal(result.sharedPenalty, 0);
  assert.equal(result.attack.target, 130);
  assert.equal(result.attack.result, "success");
  assert.equal(result.defense.target, 85);
  assert.equal(result.defense.result, "success");
  assert.equal(result.effects, 0);
});

test("no defenderse es un fallo automatico sin dado ni reduccion compartida", () => {
  const result = resolveCombatExchange({ predeclared: true,
    attack: { target: 130, rawRoll: 60 }, defense: { type: "none" } });
  assert.equal(result.sharedPenalty, 0);
  assert.equal(result.attack.target, 130);
  assert.equal(result.defense.result, "failure");
  assert.equal(result.defense.rawRoll, null);
  assert.equal(result.defense.automaticFailure, true);
  assert.equal(result.effects, 1);
});

test("la cobertura es una defensa pasiva y se aplica antes de la armadura", () => {
  const exchange = resolveCombatExchange({ predeclared: true,
    attack: { target: 130, rawRoll: 50 }, defense: { type: "cover" } });
  assert.equal(exchange.sharedPenalty, 0);
  assert.equal(exchange.defense.type, "cover");
  assert.equal(exchange.defense.automaticFailure, true);
  const damage = resolveDamage({ rolledDamage: 11, parry: { type: "half" },
    coverPoints: 2, armorPoints: 1 });
  assert.equal(damage.afterParry, 6);
  assert.equal(damage.afterCover, 4);
  assert.equal(damage.penetratingDamage, 3);
});

test("una defensa puede obtener efectos contra un ataque fallido", () => {
  const result = resolveCombatExchange({ attack: { target: 55, rawRoll: 80 },
    defense: { type: "parry", target: 70, rawRoll: 40 } });
  assert.equal(result.attack.result, "failure");
  assert.equal(result.defense.result, "success");
  assert.equal(result.advantage, -1);
  assert.equal(result.winner, "defender");
});

test("Evadir desempata grados iguales con el dado mas alto", () => {
  const attackWins = { attack: { result: "success", rawRoll: 65 },
    defense: { type: "evade", result: "success", rawRoll: 40 } };
  const defenseWins = { attack: { result: "critical", rawRoll: 4 },
    defense: { type: "evade", result: "critical", rawRoll: 7 } };
  assert.equal(evasionWinner(attackWins), "attacker");
  assert.equal(combatAttackHits(attackWins), true);
  assert.equal(evasionWinner(defenseWins), "defender");
  assert.equal(combatAttackHits(defenseWins), false);
  assert.equal(combatAttackHits({ attack: { result: "success", rawRoll: 50 },
    defense: { type: "evade", result: "success", rawRoll: 50 } }), false);
});

test("la parada compara las cinco categorias de tamaño", () => {
  assert.equal(parryReduction("M", "G").type, "full");
  assert.equal(parryReduction("G", "M").type, "half");
  assert.equal(parryReduction("E", "P").type, "none");
  assert.equal(parryReduction("?", "M").type, "unknown");
});

test("golpe contenido y parada parcial dividen redondeando hacia arriba", () => {
  const result = resolveDamage({ rolledDamage: 11, containedBlow: true,
    parry: { type: "half" }, armorPoints: 2, targetSize: 4 });
  assert.equal(result.afterContainedBlow, 6);
  assert.equal(result.afterParry, 3);
  assert.equal(result.penetratingDamage, 1);
  assert.deepEqual(result.push, { triggered: true, excess: 2, distance: 1 });
});

test("una parada completa y la armadura nunca producen daño negativo", () => {
  assert.equal(resolveDamage({ rolledDamage: 9, parry: { type: "full" },
    armorPoints: 4 }).penetratingDamage, 0);
  assert.equal(resolveDamage({ rolledDamage: 3, parry: { type: "none" },
    armorPoints: 8 }).penetratingDamage, 0);
});
