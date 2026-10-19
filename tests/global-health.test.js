import test from "node:test";
import assert from "node:assert/strict";
import { installHost, collection, documentDouble, setPath, render, dom } from "./helpers/ui.js";
import { GLOBAL_CREATURE_SOURCES, ELEMENTAL_ROWS, SWARM_ROWS } from "../scripts/data/global-creatures.js";
import { globalHealthConfigurationValid, globalHealthState, healthWoundLevel,
  normalizeAbsentCharacteristics } from "../scripts/rules/health.js";
import { calculateNpcAttributes } from "../scripts/rules/npc.js";
import { materializeNpc } from "../scripts/rules/npc-generation.js";
import { actorConditionState, actorLoadState } from "../scripts/rules/actor-conditions.js";
import { calculateSkillValues, skillRequiresManualValue } from "../scripts/rules/skills.js";
import { prepareGlobalHealthItemUpdate, announceGlobalHealthExhausted,
  registerNpcHealthHooks } from "../scripts/rules/npc-health-runtime.js";
import { applyDirectDamage } from "../scripts/rules/direct-damage.js";
import { applyAcidDamage } from "../scripts/rules/acid.js";
import { applyFireDamage } from "../scripts/rules/fire.js";
import { applyFallDamage } from "../scripts/rules/fall.js";
import { applyCombatDamageDocument } from "../scripts/rules/combat-damage-runtime.js";
import { applyCombatWoundConsequences } from "../scripts/rules/combat-wound-runtime.js";
import { applyHazardWoundConsequences } from "../scripts/rules/wound-consequences.js";

function fixture(t) {
  const { foundry } = installHost(t);
  foundry.utils.setProperty = setPath;
  foundry.utils.expandObject = (object) => {
    const result = {};
    for (const [key, value] of Object.entries(object)) setPath(result, key, value);
    return result;
  };
  const chats = [];
  const previousChat = globalThis.ChatMessage;
  const previousRoll = globalThis.Roll;
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async (data) => { chats.push(data); return data; } };
  globalThis.Roll = class {
    static validate() { return true; }
    constructor(formula) { this.formula = formula; this.total = formula === "1d20" ? 1 : 20; }
    async evaluate() { return this; }
    toJSON() { return { formula: this.formula, total: this.total }; }
  };
  t.after(() => { globalThis.ChatMessage = previousChat; globalThis.Roll = previousRoll; });
  const source = structuredClone(GLOBAL_CREATURE_SOURCES[1]);
  const actor = documentDouble({ ...source, system: source.system,
    items: collection(), statuses: new Set(), effects: [] });
  Object.defineProperty(actor.system, "toObject", { value: () => structuredClone(source.system), enumerable: false });
  const body = { id: "body", type: "hitLocation", name: "Cuerpo", actor,
    system: { ...source.items[0].system, currentHitPoints: 5 },
    async update(changed) {
      const options = {};
      if (prepareGlobalHealthItemUpdate(this, changed, options) === false) throw new Error("invalid-body");
      Object.assign(this.system, foundry.utils.expandObject(changed).system);
      await announceGlobalHealthExhausted(this, options, "gm");
      return this;
    } };
  actor.items.push(body);
  actor.system.baseAttributes = actor.system.attributes = calculateNpcAttributes(actor.system);
  return { actor, body, chats, foundry };
}

test("el bestiario global cubre los 50 elementales y los cinco rangos de enjambre", () => {
  assert.equal(GLOBAL_CREATURE_SOURCES.length, 55);
  assert.equal(new Set(GLOBAL_CREATURE_SOURCES.map((source) => source.buildKey)).size, 55);
  for (const source of GLOBAL_CREATURE_SOURCES) {
    assert.equal(source.flags["mythras-foundry"].source, "mythras-basic-revised");
    assert.equal(globalHealthConfigurationValid(source.system, source.items), true, source.name);
    assert.equal(source.items.filter((item) => item.type === "hitLocation").length, 1);
    assert.match(source.system.description, /Mythras básico revisado/);
    assert.ok(source.items.every((item) => item.flags["mythras-foundry"].source === "mythras-basic-revised"));
  }
  for (const row of ELEMENTAL_ROWS) {
    const [volume, size, damage, ap, initiative, protection, hp, combat, evade, brawn, perception, will] = row;
    const sources = GLOBAL_CREATURE_SOURCES.filter((source) => source.name.endsWith(`(${volume} m³)`));
    assert.equal(sources.length, 5);
    for (const source of sources) {
      const attributes = calculateNpcAttributes(source.system);
      assert.deepEqual([attributes.actionPointsMax, attributes.initiative], [ap, initiative]);
      assert.equal(attributes.healingRate, 0);
      assert.equal(source.items[0].system.maxHitPoints, hp);
      assert.equal(source.items[0].system.maxHitPointsFormula, `1d6+${6 * volume}`);
      assert.equal(source.items[0].system.armorPoints, protection);
      assert.deepEqual(source.items.filter((item) => item.type === "skill").map((item) => item.system.manualValue),
        [evade, brawn, perception, will]);
      assert.equal(source.items.find((item) => item.type === "combatStyle").system.manualValue, combat);
      const attack = source.items.find((item) => item.type === "weapon");
      if (volume === 1) assert.equal(attack, undefined);
      else assert.deepEqual([attack.system.modes[0].size, attack.system.modes[0].damage,
        attack.system.modes[0].damageModifierMode], [size, damage, "none"]);
    }
  }
  for (const [size, , damage, ap] of SWARM_ROWS) {
    const source = GLOBAL_CREATURE_SOURCES.find((entry) => entry.buildKey === `swarm-${size}`);
    assert.equal(source.system.size, size);
    assert.equal(source.items[0].system.maxHitPoints, size);
    assert.equal(calculateNpcAttributes(source.system).actionPointsMax, ap);
    assert.equal(calculateNpcAttributes(source.system).initiative, 0);
    assert.equal(source.items.find((item) => item.type === "weapon").system.modes[0].damage, damage);
    assert.equal(source.system.absentCharacteristics.length, 6);
  }
});

test("daño parcial, agotamiento, daño repetido y recuperación mantienen resolución manual", async (t) => {
  const { actor, body, chats } = fixture(t);
  await applyDirectDamage(actor, { amount: 2, locationIds: ["body"] });
  assert.equal(body.system.currentHitPoints, 3);
  assert.equal(chats.filter((chat) => chat.content.includes("PG agotados")).length, 0);
  const result = await applyDirectDamage(actor, { amount: 20, locationIds: ["body"] });
  assert.equal(result.results[0].hitPointsAfter, 0);
  assert.equal(body.system.currentHitPoints, 0);
  assert.equal(result.results[0].woundConsequence, null);
  assert.equal(actorConditionState(actor).woundLevel, "healthy");
  const { actorIncapacitatedState } = await import("../scripts/documents/mythras-actor.js");
  assert.equal(actorIncapacitatedState(actor).active, false);
  assert.equal(globalHealthState(actor).exhausted, true);
  await applyDirectDamage(actor, { amount: 20, locationIds: ["body"] });
  assert.equal(chats.filter((chat) => chat.content.includes("PG agotados")).length, 1);
  await body.update({ "system.currentHitPoints": 4 });
  assert.equal(globalHealthState(actor).exhausted, false);
  await body.update({ "system.currentHitPoints": -99 });
  assert.equal(body.system.currentHitPoints, 0);
  assert.equal(chats.filter((chat) => chat.content.includes("PG agotados")).length, 2);
});

test("fuego, ácido y caídas limitan PG sin generar consecuencias anatómicas", async (t) => {
  const { actor, body } = fixture(t);
  const operations = [
    () => applyFireDamage(actor, { formula: "20", locationIds: ["body"], keepBurning: false }),
    () => applyAcidDamage(actor, { damageFormula: "20", locationIds: ["body"] }),
    () => applyFallDamage(actor, { distance: 10, formula: "20", locationCount: 1 })
  ];
  for (const operation of operations) {
    body.system.currentHitPoints = 5;
    const result = await operation();
    assert.ok(result);
    assert.equal(body.system.currentHitPoints, 0);
    assert.ok(result.results.every((entry) => entry.woundConsequence === null));
  }
  assert.equal(await applyHazardWoundConsequences(actor, body, "healthy", "major"), null);
});

test("combate global conserva protección y no tira lesiones aunque reciba gravedad antigua", async (t) => {
  const { actor, body } = fixture(t);
  const result = await applyCombatDamageDocument({ location: body,
    damage: { afterHitPoints: -20, resultingWound: "major" },
    evaluateRoll: () => assert.fail("no debe tirar lesión"), format: () => "" });
  assert.equal(result.damage.afterHitPoints, 0);
  assert.equal(result.serializedPermanentWoundRoll, null);
  assert.equal(await applyCombatWoundConsequences({ damage: { resultingWound: "major" } }, actor, body), false);
  assert.equal(healthWoundLevel(actor, body, 0), "minor");
});

test("el modo global rechaza segunda localización, rangos parciales, PG automáticos y lesiones", async (t) => {
  const { actor, body } = fixture(t);
  assert.equal(globalHealthConfigurationValid(actor.system, []), false);
  assert.equal(globalHealthConfigurationValid(actor.system, [body, body]), false);
  assert.equal(prepareGlobalHealthItemUpdate(body, { "system.rangeEnd": 19 }), false);
  assert.equal(prepareGlobalHealthItemUpdate(body, { "system.autoCalculate": true }), false);
  assert.equal(prepareGlobalHealthItemUpdate(body, { "system.permanentWound.severity": 1 }), false);
  const handlers = new Map();
  Hooks.on = (name, handler) => handlers.set(name, handler);
  registerNpcHealthHooks();
  assert.equal(handlers.get("preCreateItem")({ actor, type: "hitLocation" }, { type: "hitLocation", system: body.system }), false);
  assert.equal(handlers.get("preCreateItem")(body, { type: "hitLocation", system: body.system }), undefined);
  assert.equal(handlers.get("preDeleteItem")(body), false);
  const { MythrasActor } = await import("../scripts/documents/mythras-actor.js");
  await assert.rejects(MythrasActor.prototype.createEmbeddedDocuments.call(actor, "Item",
    [{ type: "hitLocation", system: { ...body.system } }]), /localización/);
  const changed = { "system.hitPointMode": "global" };
  actor.items.push({ type: "hitLocation", system: { ...body.system } });
  assert.equal(handlers.get("preUpdateActor")(actor, changed), false);
});

test("características ausentes no aportan valores, dados, carga ni curación ficticios", async (t) => {
  const { actor } = fixture(t);
  actor.system.absentCharacteristics.push("strength");
  actor.system.characteristicFormulas.constitution = "999d6";
  actor.system.attributeOverrides.damageModifier = { mode: "auto", formula: "" };
  normalizeAbsentCharacteristics(actor.system);
  assert.equal(actor.system.characteristicFormulas.constitution, "");
  assert.equal(calculateNpcAttributes(actor.system).damageModifier, "0");
  assert.equal(actorLoadState(actor).notApplicable, true);
  const ability = { characteristic1: "constitution", characteristic2: "strength", valueMode: "derived" };
  assert.equal(skillRequiresManualValue(ability, actor.system), true);
  assert.equal(calculateSkillValues(ability, actor.system).total, 0);
  assert.equal(calculateSkillValues({ ...ability, valueMode: "manual", manualValue: 65 }, actor.system).total, 65);
  const source = structuredClone(GLOBAL_CREATURE_SOURCES[1]);
  source.system.characteristicFormulas.constitution = "999d6";
  const formulas = [];
  const generated = await materializeNpc(source, async (formula) => { formulas.push(formula); return 12; });
  assert.ok(!formulas.includes("999d6"));
  assert.equal(generated.items[0].system.currentHitPoints, 12);
  assert.equal(source.items[0].system.currentHitPoints, 16);
});

test("la hoja muestra PG globales y No aplica sin controles ni leyenda anatómicos", (t) => {
  const page = dom(render("templates/actor/npc-sheet.hbs", { actor: { system: { hitPointMode: "global" } },
    isTemplate: true, globalHitPoints: true, globalHealth: { current: 0, maximum: 16, exhausted: true },
    characteristicRows: [{ key: "constitution", label: "CON", absent: true }],
    hitLocationTable: { globalHitPoints: true, rows: [] } }));
  t.after(() => page.window.close());
  const document = page.window.document;
  assert.match(document.querySelector("#npc-characteristic-constitution").textContent, /No aplica/);
  assert.equal(document.querySelector("input[name='system.constitution']"), null);
  assert.equal(document.querySelector(".combat-wound-legend"), null);
  assert.match(document.querySelector("[role='status']").textContent, /PG agotados/);
});
