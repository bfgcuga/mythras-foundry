import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { bindStruggleApproval, actionCard, activateCombatActionCard, executeAction } from "../scripts/rules/combat-action-runtime.js";
import { COMBAT_ACTIONS, movementDistance } from "../scripts/rules/combat-actions.js";
import { readFileSync } from "node:fs";

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

test('standard action cards offer the shared help button', t => {
  const { action, root } = fixture(t);
  for (const key of Object.keys(COMBAT_ACTIONS).filter(key => key !== "struggle")) {
    root.innerHTML = actionCard({ ...action, key, status: 'resolved' });
    const help = root.querySelector(`[data-action-help="${key}"]`);
    assert.ok(help, key);
    assert.ok(help.classList.contains('mythras-help-button'));
    assert.ok(help.getAttribute('aria-label'));
  }
});

test('every standard action displays its effect directly in the card in every phase', t => {
  const { action, root } = fixture(t);
  for (const key of Object.keys(COMBAT_ACTIONS).filter(key => key !== "struggle")) {
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

test('movement cards show mode and maximum distance followed by the optional description', t => {
  const { action, root } = fixture(t);
  const translations = JSON.parse(readFileSync(new URL('../lang/es.json', import.meta.url), 'utf8'));
  game.i18n.localize = key => translations[key] ?? key;
  game.i18n.format = (key, data) => game.i18n.localize(key).replace('{distance}', data.distance);
  foundry.utils.escapeHTML = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  for (const [mode, word, distance] of [['walk', 'andando', 6], ['run', 'corriendo', 18], ['sprint', 'esprintando', 30]]) {
    assert.equal(movementDistance(6, mode), distance);
    root.innerHTML = actionCard({ ...action, key: 'move', parameters: {
      mode, distance, direction: '<b>Hasta la puerta</b>' } });
    const description = root.querySelector('.combat-action-description');
    assert.equal(description.textContent, `Gasta un PA para moverse ${word} hasta ${distance} metros.`);
    assert.equal(description.nextElementSibling.textContent, '<b>Hasta la puerta</b>');
    assert.equal(description.nextElementSibling.querySelector('b'), null);
    assert.doesNotMatch(root.textContent, /Afianzado|automáticamente|token/);
  }
  root.innerHTML = actionCard({ ...action, key: 'move', parameters: { mode: 'walk', distance: 0 } });
  assert.equal(root.querySelectorAll('p').length, 1);
  assert.equal(movementDistance(0, 'run'), 0);
  assert.equal(movementDistance(3, 'sprint'), 15);
});


test('generic action resolves with its description and advances the turn', async t => {
  const { action, combat, root } = fixture(t);
  action.key = 'generic'; action.note = 'Abrir la puerta';
  combat.combatant = { id: 'c' };
  let advanced = 0; combat.nextTurn = async () => { advanced++; };
  await executeAction(combat, action);
  assert.equal(action.status, 'resolved');
  assert.equal(advanced, 1);
  root.innerHTML = actionCard(action);
  assert.match(root.textContent, /Abrir la puerta/);
  assert.equal(root.querySelector('[data-action-transaction]'), null);
});

test('Forcejear publica solo la descripción y una validación manual sin aplicar restricciones', async t => {
  const { action, root, actor, combat } = fixture(t);
  Object.assign(action, { key: 'struggle', note: 'Abrir una puerta atascada', status: 'resolving' });
  await executeAction(combat, action);
  assert.equal(action.status, 'awaitingConfirmation');
  assert.equal(actor.effects.length, 0);
  root.innerHTML = actionCard(action);
  assert.equal(root.querySelector('.combat-action-description').textContent, action.note);
  assert.equal(root.querySelectorAll('button').length, 1);
  assert.ok(root.querySelector('[data-action-transaction="confirm"]'));
  root.innerHTML = actionCard({ ...action, status: 'resolved' });
  assert.equal(root.querySelectorAll('button').length, 0);
});

test('Forcejear exige descripción y tick de aprobación antes de habilitar Validar', t => {
  const { root } = fixture(t);
  root.innerHTML = '<textarea name="note"></textarea><input type="checkbox" name="gmApproved"><button data-action="ok">Validar</button>';
  bindStruggleApproval(root);
  const note = root.querySelector('textarea'), tick = root.querySelector('input'), button = root.querySelector('button');
  const change = (el, event) => el.dispatchEvent(new root.ownerDocument.defaultView.Event(event));
  assert.equal(button.disabled, true);
  note.value = 'Forcejear con una puerta'; change(note, 'input');
  assert.equal(button.disabled, true);
  tick.checked = true; change(tick, 'change');
  assert.equal(button.disabled, false);
  tick.checked = false; change(tick, 'change');
  assert.equal(button.disabled, true);
  tick.checked = true; note.value = '   '; change(note, 'input');
  assert.equal(button.disabled, true);
});
