import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { requestFreeCombatAction, heldDroppableWeapons } from "../scripts/rules/free-combat-actions.js";

function fixture(t) {
  const dom = new JSDOM(); t.after(() => dom.window.close());
  const messages = []; const dialogs = []; const warnings = [];
  const actor = { id: "a", name: "Hodei", isOwner: true, system: {}, effects: [], statuses: new Set(), items: [] };
  const responses = { note: "Hola <b>amigos</b>", weapon: "sword", confirmed: true };
  const globals = {
    ChatMessage: { getSpeaker: () => ({}), create: async data => { messages.push(data); } },
    game: { combats: [], user: { isGM: false }, settings: { get: () => false },
      i18n: { localize: key => key, format: key => key } },
    ui: { notifications: { warn: text => warnings.push(text) } },
    foundry: { utils: { escapeHTML: value => { const p = dom.window.document.createElement("p"); p.textContent = value; return p.innerHTML; } },
      applications: { api: { DialogV2: {
        prompt: async options => { dialogs.push(options); return responses.note; },
        wait: async options => { dialogs.push(options); return responses.weapon; },
        confirm: async options => { dialogs.push(options); return responses.confirmed; }
      } } } }
  };
  for (const [key, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
  }
  return { actor, responses, messages, dialogs, warnings };
}

test('speech and gestures publish escaped descriptions without spending PA or advancing turns', async t => {
  const { actor, messages, responses } = fixture(t);
  actor.system.actionPoints = { value: 0 };
  for (const key of ["speak", "gesture"]) await requestFreeCombatAction(actor, key);
  assert.equal(messages.length, 2);
  assert.match(messages[0].content, /Hola &lt;b&gt;amigos&lt;\/b&gt;/);
  assert.equal(actor.system.actionPoints.value, 0);
  responses.note = "  "; await requestFreeCombatAction(actor, "speak");
  responses.note = null; await requestFreeCombatAction(actor, "gesture");
  assert.equal(messages.length, 2);
  actor.isOwner = false; responses.note = "No";
  await requestFreeCombatAction(actor, "speak"); assert.equal(messages.length, 2);
});

test('dropping selects only held manufactured weapons and preserves the item', async t => {
  const { actor, messages, responses } = fixture(t);
  const sword = { id: "sword", name: "Espada", type: "weapon", system: { equipped: true, handsRequired: 1 },
    async update(data) { this.system.equipped = data["system.equipped"]; } };
  const claw = { id: "claw", type: "weapon", system: { equipped: true, handsRequired: 0 } };
  actor.items.push(sword, claw);
  assert.deepEqual(heldDroppableWeapons(actor), [sword]);
  responses.weapon = null; await requestFreeCombatAction(actor, "dropWeapon");
  assert.equal(sword.system.equipped, true); assert.equal(messages.length, 0);
  actor.uuid = "Actor.a";
  let tactical = { revision: 0, passiveBlocks: { fighter: { status: "active", weaponId: "sword" } } };
  const combatants = [{ id: "fighter", actor }]; combatants.get = id => combatants.find(entry => entry.id === id);
  game.combats.push({ combatants, getFlag: () => tactical, setFlag: async (scope, key, state) => { tactical = state; } });
  foundry.utils.deepClone = value => structuredClone(value);
  responses.weapon = "sword"; await requestFreeCombatAction(actor, "dropWeapon");
  assert.equal(tactical.passiveBlocks.fighter.status, "consumed");
  assert.equal(sword.system.equipped, false); assert.equal(actor.items.includes(sword), true);
  assert.equal(claw.system.equipped, true); assert.equal(messages.length, 1);
  await requestFreeCombatAction(actor, "dropWeapon"); assert.equal(messages.length, 1);
});

test('assessing always warns and allows Perception after confirmation even when engaged', async t => {
  const { actor, responses, dialogs } = fixture(t);
  const rolls = [];
  actor.items.push({ type: "skill", system: { slug: "percepcion" }, rollSkill: async options => rolls.push(options) });
  actor.system.actionPoints = { value: 0 };
  responses.confirmed = false; await requestFreeCombatAction(actor, "assessSituation");
  assert.equal(rolls.length, 0);
  responses.confirmed = true; await requestFreeCombatAction(actor, "assessSituation", { manual: true });
  assert.equal(rolls.length, 1); assert.equal(rolls[0].manual, true);
  assert.equal(rolls[0].difficulty, "standard");
  assert.match(dialogs[0].content, /AssessWarning/);
  assert.equal(actor.system.actionPoints.value, 0);
});
