import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { actionCard, activateCombatActionCard, executeAction } from "../scripts/rules/combat-action-runtime.js";
import { COMBAT_ACTIONS } from "../scripts/rules/combat-actions.js";

function fixture(t) {
  const dom = new JSDOM('<main></main>');
  t.after(() => dom.window.close());
  const actor = { id: 'a', uuid: 'Actor.a', type: 'character', name: 'Hodei',
    statuses: new Set(), effects: [],
    async createEmbeddedDocuments(type, entries) {
      for (const entry of entries) {
        this.effects.push({ ...entry, id: 'braced-effect', statuses: new Set(entry.statuses) });
        entry.statuses.forEach(id => this.statuses.add(id));
      }
    },
    async deleteEmbeddedDocuments(type, ids) {
      this.effects = this.effects.filter(effect => !ids.includes(effect.id));
      this.statuses = new Set(this.effects.flatMap(effect => [...effect.statuses]));
    }
  };
  const action = { id: 'action', key: 'brace', actorName: 'prueba final',
    combatId: 'combat', combatantId: 'c', parameters: {}, status: 'resolving', revision: 0 };
  let state = { actions: { action }, braces: {}, movements: {} };
  const combat = { round: 1, combatants: new Map([['c', { actor }]]),
    getFlag: () => state, async setFlag(scope, key, value) { state = value; } };
  const globals = { HTMLElement: dom.window.HTMLElement,
    game: { actors: new Map([['a', actor]]), combats: new Map([['combat', combat]]),
      i18n: { localize: key => key } },
    foundry: { utils: { escapeHTML: value => value }, applications: { api: { DialogV2: {
      wait: async options => { globals.dialog = options; }
    } } } }, Hooks: { callAll() {} } };
  for (const [key, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
    t.after(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
  }
  return { actor, action, combat, root: dom.window.document.querySelector('main'), globals };
}

test('action cards use the current character name and open brace help on click', async t => {
  const { action, root, globals } = fixture(t);
  root.innerHTML = actionCard(action);
  assert.match(root.textContent, /Hodei/);
  assert.doesNotMatch(root.textContent, /prueba final/);
  activateCombatActionCard({ getFlag: () => ({ combatId: 'combat', actionId: 'action' }) }, root);
  root.querySelector('[data-action-help]').click();
  assert.match(globals.dialog.content, /Status.Description.braced/);
});

test('all registered action cards offer the shared help button', t => {
  const { action, root } = fixture(t);
  for (const key of Object.keys(COMBAT_ACTIONS)) {
    root.innerHTML = actionCard({ ...action, key, status: 'resolved' });
    const help = root.querySelector(`[data-action-help="${key}"]`);
    assert.ok(help, key);
    assert.ok(help.classList.contains('mythras-help-button'));
    assert.ok(help.getAttribute('aria-label'));
  }
});

test('every registered action displays its effect directly in the card in every phase', t => {
  const { action, root } = fixture(t);
  for (const key of Object.keys(COMBAT_ACTIONS)) {
    for (const status of ['awaitingConfirmation', 'resolving', 'resolved', 'cancelled']) {
      root.innerHTML = actionCard({ ...action, key, status });
      const description = root.querySelector('.combat-action-description');
      const expected = key === 'brace' ? 'MYTHRASF.Status.Description.braced'
        : key === 'maneuver' ? 'MYTHRASF.Status.Description.maneuverProtected'
          : `MYTHRASF.Action.Description.${key}`;
      assert.equal(description?.textContent, expected, `${key}: ${status}`);
      assert.equal(description.hidden, false);
      assert.equal(description.previousElementSibling.className, 'mythras-chat-title');
    }
  }
});

test('resolved action help includes its description, recorded cost and execution note', t => {
  const { action, root, globals } = fixture(t);
  Object.assign(action, { key: 'delay', status: 'resolved', cost: 0, note: 'Espera hasta el siguiente turno' });
  root.innerHTML = actionCard(action);
  activateCombatActionCard({ getFlag: () => ({ combatId: 'combat', actionId: action.id }) }, root);
  root.querySelector('[data-action-help]').click();
  assert.match(globals.dialog.content, /Action.Description.delay/);
  assert.match(globals.dialog.content, /Action.Status.resolved/);
  assert.match(globals.dialog.content, /Espera hasta el siguiente turno/);
});

test('brace creates one visible status and Move removes it', async t => {
  const { actor, action, combat } = fixture(t);
  await executeAction(combat, action);
  assert.equal(actor.statuses.has('braced'), true);
  action.status = 'resolving';
  await executeAction(combat, action);
  assert.equal(actor.effects.length, 1);
  action.status = 'resolving'; action.key = 'move'; action.parameters = { mode: 'walk' };
  await executeAction(combat, action);
  assert.equal(actor.statuses.has('braced'), false);
  assert.equal(actor.effects.length, 0);
});
