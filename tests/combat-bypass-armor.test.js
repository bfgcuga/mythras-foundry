import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { bypassArmorProtection, chooseBypassArmor } from "../scripts/rules/combat-bypass-armor.js";
import { refreshCombatDamageProposal } from "../scripts/rules/combat-damage-runtime.js";
import { applyCombatEffectsTransition } from "../scripts/rules/combat-response-runtime.js";

const location = { id: "chest", type: "hitLocation", name: "Chest",
  system: { armorPoints: 3, currentHitPoints: 12, maxHitPoints: 12, category: "chest" } };
const armors = [5, 2].map((armorPoints, i) => ({ id: "armor"+i, type: "armor",
  system: { equipped: true, armorPoints, coveredLocationIds: ["chest"] } }));
const effect = (armorType) => ({ key: "superar-armadura", ruleKey: "bypassArmor",
  parameters: { armorType } });
function actor() {
  const items = structuredClone([location, ...armors]);
  items.get = (id) => items.find((item) => item.id === id);
  return { items, system: { size: 12 } };
}

test("Superar Armadura ignora un tipo por uso y dos usos ignoran ambos sin sumar prendas", () => {
  for (const [selections, expected] of [[[], 8], [[effect("natural")], 5],
    [[effect("worn")], 3], [[effect("natural"), effect("natural")], 0],
    [[{ ...effect("natural"), waived: true }], 8]]) {
    assert.equal(bypassArmorProtection(location, armors, selections).effective, expected);
  }
  assert.equal(bypassArmorProtection(location, [], [effect("worn")]).effective, 0);
  assert.equal(bypassArmorProtection({ ...location, system: { armorPoints: 0 } },
    armors, [effect("natural")]).effective, 0);
  assert.equal(bypassArmorProtection(location, armors.map((armor) => ({
    ...armor, system: { ...armor.system, equipped: false }
  })), [effect("natural")]).effective, 0);
});

test("el selector permite elegir el tipo, cancelar y omite preguntas con dos usos o un solo tipo", async () => {
  const selected = [effect("")];
  const deps = { localize: (s) => s, escape: (s) => s, Dialog: { wait: async (spec) => {
    const dom = new JSDOM(`<form>${spec.content}</form>`);
    const form = dom.window.document.querySelector("form");
    form.elements.armorType.value = "natural";
    assert.equal(spec.buttons[1].callback(), null);
    return spec.buttons[0].callback(null, { form });
  } } };
  assert.equal(await chooseBypassArmor(actor(), selected, deps), true);
  assert.equal(selected[0].parameters.armorType, "natural");
  assert.equal(await chooseBypassArmor(actor(), [effect("")],
    { ...deps, Dialog: { wait: async () => null } }), false);
  const noDialog = { ...deps, Dialog: { wait: assert.fail } };
  assert.equal(await chooseBypassArmor(actor(), [effect(""), effect("")], noDialog), true);
  assert.equal(await chooseBypassArmor({ items: [location] }, [effect("")], noDialog), true);
});

test("la propuesta aplica el tipo elegido y el apilamiento sin modificar la armadura", async () => {
  for (const [selections, expectedArmor] of [[[effect("natural")], 5],
    [[effect("worn")], 3], [[effect("natural"), effect("worn")], 0]]) {
    const target = actor();
    const before = JSON.stringify(target.items);
    const state = { attacker: { weaponSize: "P" }, defender: {},
      resolution: { defense: { result: "failure" } },
      effects: { selections, checks: [] }, damage: { rawRoll: 10, locationId: "chest" } };
    await refreshCombatDamageProposal(state, null, { resolveActor: async () => target });
    assert.equal(state.damage.armorPoints, expectedArmor);
    assert.equal(state.damage.penetratingDamage, 10 - expectedArmor);
    assert.equal(state.damage.armorSnapshot, 8);
    assert.equal(JSON.stringify(target.items), before);
  }
});

test("el coordinador conserva el tipo elegido y admite dos selecciones apiladas", async () => {
  const catalog = { ...effect(""), name: "Superar Armadura", offensive: true,
    stackable: true, stage: "beforeArmor", rollRestriction: "attackerCritical" };
  for (const count of [1, 2]) {
    const state = { revision: 1, status: "awaitingEffects", attacker: {}, defender: {},
      resolution: { attack: { result: "critical" }, defense: { result: "failure" } },
      effects: { winner: "attacker", slots: count, selections: [], checks: [] } };
    const message = { getFlag: () => state, update: async (change) => { message.change = change; } };
    const result = await applyCombatEffectsTransition(message, { revision: 1, side: "attacker",
      userId: "gm", selections: Array.from({ length: count }, () => effect("natural")) }, {
      clone: structuredClone, flagScope: "scope", resolveActor: async () => ({}),
      userById: () => ({ isGM: true }), catalogDocuments: async () => [catalog],
      effectView: (s) => s, effectContext: () => ({ winner: "attacker", attackResult: "critical" }),
      warn: assert.fail, localize: (s) => s, applyImmediateEffects: async () => {},
      immediateDependencies: () => ({}), render: () => "", advance: async () => {}
    });
    assert.equal(result, true);
    assert.ok(message.change["flags.scope.combat"].effects.selections.every((s) =>
      s.parameters.armorType === "natural"));
  }
});
