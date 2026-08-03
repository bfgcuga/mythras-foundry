import test from "node:test";
import assert from "node:assert/strict";

import { calculateNpcAttributes, npcIntelligenceKey, npcWeaponDurability } from "../scripts/rules/npc.js";
import { calculateSkillValues } from "../scripts/rules/skills.js";
import { damageModifierFormula } from "../scripts/rules/combat.js";

const characteristics = {
  strength: 22, constitution: 13, size: 16, dexterity: 25,
  intelligence: 11, power: 11, charisma: 1
};

test("las habilidades conservan el cálculo derivado de los personajes", () => {
  const values = calculateSkillValues({ characteristic1: "strength", characteristic2: "dexterity",
    baseBonus: 3, culturePoints: 2, professionPoints: 0, freePoints: 1,
    experiencePoints: 0, valueMode: "derived" }, characteristics);
  assert.deepEqual(values, { base: 50, bonus: 3, total: 53, experienceImprovementBonus: 0 });
});

test("una habilidad manual usa directamente su porcentaje", () => {
  const values = calculateSkillValues({ valueMode: "manual", manualValue: 77, fumbled: true }, characteristics);
  assert.deepEqual(values, { base: 77, bonus: 0, total: 77, experienceImprovementBonus: 1 });
});

test("los atributos NPC admiten overrides sin cambiar las características planas", () => {
  const attributes = calculateNpcAttributes({ ...characteristics, attributeOverrides: {
    actionPoints: { mode: "manual", value: 3 }, initiative: { mode: "auto", value: 0 },
    movementRate: { mode: "manual", value: 8 }, magicPoints: { mode: "manual", value: 0 },
    luckPoints: { mode: "manual", value: 0 }, damageModifier: { mode: "manual", formula: "+1d6" }
  } });
  assert.equal(attributes.actionPointsMax, 3);
  assert.equal(attributes.initiative, 18);
  assert.equal(attributes.movementRate, 8);
  assert.equal(attributes.magicPointsMax, 0);
  assert.equal(attributes.damageModifier, "+1d6");
});

test("INT e INS comparten el mismo dato interno", () => {
  assert.equal(npcIntelligenceKey("intelligence"), "intelligence");
  assert.equal(npcIntelligenceKey("instinct"), "instinct");
  assert.equal(npcIntelligenceKey("otro"), "intelligence");
});

test("un arma natural toma PA y PG de su localización", () => {
  const location = { id: "tail", system: { armorPoints: 6, currentHitPoints: 4, maxHitPoints: 5 } };
  const linked = npcWeaponDurability({ system: { durabilitySource: "hitLocation",
    linkedLocationId: "tail", armorPoints: 1, currentHitPoints: 2, maxHitPoints: 3 } }, [location]);
  assert.deepEqual({ source: linked.source, armorPoints: linked.armorPoints,
    currentHitPoints: linked.currentHitPoints, maxHitPoints: linked.maxHitPoints },
  { source: "hitLocation", armorPoints: 6, currentHitPoints: 4, maxHitPoints: 5 });
});

test("el modificador de daño manual conserva la fórmula para cada ataque", () => {
  assert.equal(damageModifierFormula("+1d6", "full"), "1d6");
  assert.equal(damageModifierFormula("+1d6", "half"), "floor((1d6) / 2)");
  assert.equal(damageModifierFormula("+1d6", "none"), "0");
});
