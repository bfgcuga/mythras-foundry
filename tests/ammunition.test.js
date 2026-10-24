import test from "node:test";
import assert from "node:assert/strict";
import { installHost, collection, documentDouble, setPath, render, dom } from "./helpers/ui.js";
import { AMMUNITION_SOURCES } from "../scripts/data/equipment.js";
import { WEAPON_SOURCES } from "../scripts/data/weapons.js";
import { normalizeInventorySources } from "../scripts/rules/inventory-ammunition.js";
import { ammunitionChoices, ammunitionStock, ammunitionProblem } from "../scripts/rules/ammunition.js";
import { requestAmmunitionOperation, reconcileAmmunition, registerAmmunitionRuntime } from "../scripts/rules/ammunition-runtime.js";
import { migrateActorAmmunition } from "../scripts/migrations/ammunition-migrations.js";
import { totalCarriedEncumbrance } from "../scripts/rules/encumbrance.js";
import { weaponCanEquip } from "../scripts/rules/weapon-durability.js";
import { prepareInventoryView } from "../scripts/ui/inventory-sheet.js";
import { passiveBlockFor } from "../scripts/rules/engagement-runtime.js";

function setup(t) {
  installHost(t); let serial = 0;
  foundry.utils.randomID = () => `operation-${++serial}`;
  game.users = collection([{ id: 'gm', active: true, isGM: true }]);
  const actor = documentDouble({ id: 'a', uuid: 'Actor.a', system: { resources: { actionPoints: { value: 10 } } } });
  const add = source => {
    const item = documentDouble({ ...structuredClone(source), id: source._id || source.id || `item-${++serial}` });
    item.actor = actor;
    item.toObject = () => ({ _id: item.id, name: item.name, type: item.type, img: item.img,
      system: structuredClone(item.system), flags: structuredClone(item.flags || {}) });
    actor.items.push(item); return item;
  };
  actor.createEmbeddedDocuments = async (type, sources) => normalizeInventorySources(sources).map(add);
  actor.deleteEmbeddedDocuments = async (type, ids) => { actor.items = collection(actor.items.filter(item => !ids.includes(item.id))); };
  actor.updateEmbeddedDocuments = async (type, updates) => {
    for (const update of updates) { const { _id, ...change } = update; await actor.items.get(_id).update(change); }
  };
  const combat = { started: true, round: 1, turn: 0, combatants: collection([{ id: 'c', actor }]),
    getFlag: () => null };
  combat.combatant = combat.combatants[0]; combat.turns = combat.combatants;
  game.combat = combat; game.combats = collection([combat]);
  const bow = () => add({ name: 'Arco', type: 'weapon', system: { equipped: true, activeModeKey: 'ranged',
    modes: [{ key: 'ranged', weaponType: 'ranged', ammoUse: 'projectile', ammoType: 'arrow',
      ammoLoaded: 0, reloadActions: 2, ammoCapacity: 1, reloadProgress: 0 }] } });
  const arrows = (quantity = 12, extra = {}) => add({ name: 'Flechas', type: 'equipment', system: {
    category: 'ammunition', ammoType: 'arrow', quantity, ammunitionUnitVersion: 1, ...extra } });
  const op = (weapon, kind, options = {}) => requestAmmunitionOperation(actor, {
    kind, weaponId: weapon.id, modeKey: 'ranged', ...options
  });
  return { actor, combat, add, bow, arrows, op };
}

test('comprar dos fajos conserva precio y carga total y crea 24 proyectiles una sola vez', () => {
  const source = structuredClone(AMMUNITION_SOURCES[0]); source.system.quantity = 2;
  source.system.weight = 1.2;
  const [item] = normalizeInventorySources([source]);
  assert.equal(item.name, 'Flechas'); assert.equal(item.system.quantity, 24);
  assert.equal(item.system.value * 24, source.system.value * 2);
  assert.equal(item.system.weight * 24, source.system.weight * 2);
  assert.equal(totalCarriedEncumbrance([item]), totalCarriedEncumbrance([source]));
  assert.deepEqual(normalizeInventorySources([item]), [item]);
  const zero = structuredClone(source); zero.system.weight = 0; zero.system.quantity = 40;
  assert.equal(totalCarriedEncumbrance(normalizeInventorySources([zero])), totalCarriedEncumbrance([zero]));
});

test('un fajo de dardos genera doce ejemplares utilizables, con precio total del fajo', () => {
  const source = AMMUNITION_SOURCES.find(item => item.system.thrownProfile);
  const items = normalizeInventorySources([source]);
  assert.equal(items.length, 12);
  assert.ok(items.every(item => item.type === 'weapon' && item.system.quantity === 1
    && item.system.modes.some(mode => mode.ammoUse === 'thrown')));
  assert.ok(Math.abs(items.reduce((sum, item) => sum + item.system.value, 0) - source.system.value) < 1e-9);
});

test('selección compatible excluye propiedades, incluye contenedores y conserva existencias agotadas', t => {
  const f = setup(t); const weapon = f.bow(); const stock = f.arrows(0);
  const home = f.add({ type: 'equipment', system: { category: 'property' } });
  f.arrows(10, { parentContainerId: home.id });
  const bag = f.add({ type: 'equipment', system: { isContainer: true, category: 'container' } });
  const carried = f.arrows(7, { parentContainerId: bag.id });
  f.add({ type: 'equipment', system: { category: 'ammunition', ammoType: 'bolt', quantity: 20 } });
  assert.deepEqual(ammunitionChoices(f.actor, weapon, weapon.system.modes[0]).map(s => s.item.id), [stock.id, carried.id]);
});

test('recargar dos acciones no descuenta existencias; disparar descuenta exactamente una, también al repetir la petición', async t => {
  const f = setup(t), weapon = f.bow(), stock = f.arrows();
  const first = await f.op(weapon, 'reload', { itemId: stock.id });
  assert.equal(first.completed, false); assert.equal(stock.system.quantity, 12);
  assert.equal(weapon.system.modes[0].reloadProgress, 1);
  await f.op(weapon, 'reload', { itemId: stock.id });
  assert.equal(weapon.system.modes[0].ammoLoaded, 1);
  assert.equal(stock.system.quantity, 12);
  const result = await f.op(weapon, 'shoot', { id: 'shot' });
  assert.equal(result.total, 11); assert.equal(result.name, 'Flechas');
  assert.equal(weapon.system.modes[0].ammoLoaded, 0);
  assert.deepEqual(await f.op(weapon, 'shoot', { id: 'shot' }), result);
  assert.equal(stock.system.quantity, 11);
  assert.equal(f.actor.system.resources.actionPoints.value, 8);
});

test('dos armas no pueden cargar el mismo proyectil, ni con peticiones concurrentes', async t => {
  const f = setup(t), left = f.bow(), right = f.bow(), stock = f.arrows(1);
  left.system.modes[0].reloadActions = right.system.modes[0].reloadActions = 1;
  const results = await Promise.allSettled([f.op(left, 'reload', { itemId: stock.id }), f.op(right, 'reload', { itemId: stock.id })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(ammunitionStock(f.actor, stock.id).loaded, 1);
  assert.equal(stock.system.quantity, 1);
  assert.equal(f.actor.system.resources.actionPoints.value, 9);
});

test('cambiar munición libera la carga anterior y reinicia el progreso sin descontar objetos', async t => {
  const f = setup(t), weapon = f.bow(), oldStock = f.arrows(), newStock = f.arrows(5);
  Object.assign(weapon.system.modes[0], { ammoItemId: oldStock.id, ammoLoaded: 1, reloadProgress: 1 });
  await f.op(weapon, 'reload', { itemId: newStock.id });
  assert.equal(weapon.system.modes[0].ammoLoaded, 0);
  assert.equal(weapon.system.modes[0].reloadProgress, 1);
  assert.equal(weapon.system.modes[0].ammoItemId, newStock.id);
  assert.equal(ammunitionStock(f.actor, oldStock.id).available, 12);
  assert.equal(newStock.system.quantity, 5);
});

for (const cause of ['quantity', 'move', 'delete', 'type']) test(`una edición de munición (${cause}) invalida cargas sin consumir PA`, async t => {
  const f = setup(t), weapon = f.bow(), stock = f.arrows(1);
  Object.assign(weapon.system.modes[0], { ammoItemId: stock.id, ammoLoaded: 1 });
  if (cause === 'quantity') stock.system.quantity = 0;
  if (cause === 'type') stock.system.ammoType = 'bolt';
  if (cause === 'delete') await f.actor.deleteEmbeddedDocuments('Item', [stock.id]);
  if (cause === 'move') {
    const home = f.add({ type: 'equipment', system: { category: 'property' } }); stock.system.parentContainerId = home.id;
  }
  assert.equal(await reconcileAmmunition(f.actor), 1);
  assert.equal(weapon.system.modes[0].ammoLoaded, 0);
  await assert.rejects(f.op(weapon, 'shoot'));
  assert.equal(f.actor.system.resources.actionPoints.value, 10);
});

test('lanzar conserva el ejemplar rojo, bloquea ataques y bloqueo pasivo; recuperar no repara ni equipa', async t => {
  const f = setup(t);
  const source = structuredClone(WEAPON_SOURCES.find(item => item.buildKey === 'jabalina'));
  source.system.equipped = true;
  const weapon = f.add(source);
  await f.op(weapon, 'shoot', { id: 'throw' });
  assert.ok(f.actor.items.get(weapon.id)); assert.equal(weapon.system.thrown, true);
  assert.equal(weapon.system.equipped, false); assert.equal(weaponCanEquip(weapon), false);
  assert.equal(weaponCanEquip(weapon, { allowThrown: true }), true);
  assert.deepEqual(await f.op(weapon, 'shoot', { id: 'throw' }), { thrown: true, name: weapon.name, consumed: 1 });
  const state = { passiveBlocks: { c: { weaponId: weapon.id, round: 1, status: 'active', locationIds: ['head'] } } };
  f.combat.getFlag = () => state;
  assert.equal(passiveBlockFor(f.combat, 'c', 'head'), null);
  const rows = prepareInventoryView(f.actor.items).rows;
  const page = dom(render('templates/actor/parts/inventory-tree.hbs', { items: rows, editable: true }));
  t.after(() => page.window.close());
  assert.ok(page.window.document.querySelector('.weapon-thrown [data-action="recover-thrown-weapon"]'));
  weapon.system.inoperable = true; weapon.system.lodged = true;
  await assert.rejects(f.op(weapon, 'recover'));
  weapon.system.lodged = false;
  await f.op(weapon, 'recover');
  assert.equal(weapon.system.thrown, false); assert.equal(weapon.system.inoperable, true);
  assert.equal(weapon.system.equipped, false); assert.equal(weaponCanEquip(weapon), false);
  assert.equal(weaponCanEquip(weapon, { allowThrown: true }), false);
});

test('migración suma reservas y carga a los fajos existentes y es idempotente', async t => {
  const f = setup(t);
  const pack = f.add(structuredClone(AMMUNITION_SOURCES[0]));
  const weapon = f.bow(); weapon.system.profileKey = 'arco-corto';
  Object.assign(weapon.system.modes[0], { ammoUse: '', ammoType: '', ammoLoaded: 1, ammoReserve: 5, reloadProgress: 1 });
  await migrateActorAmmunition(f.actor);
  assert.equal(pack.system.quantity, 12);
  const stock = f.actor.items.get(weapon.system.modes[0].ammoItemId);
  assert.equal(stock.system.quantity, 6); assert.equal(weapon.system.modes[0].ammoLoaded, 1);
  assert.equal(weapon.system.modes[0].reloadProgress, 0);
  const before = f.actor.items.map(item => item.toObject());
  await migrateActorAmmunition(f.actor);
  assert.deepEqual(f.actor.items.map(item => item.toObject()), before);
  assert.equal(f.actor.items.filter(item => item.type === 'equipment').reduce((sum, item) => sum + item.system.quantity, 0), 18);
});

test('migración divide armas apiladas sin duplicar ejemplares al repetirla', async t => {
  const f = setup(t), source = structuredClone(WEAPON_SOURCES.find(item => item.buildKey === 'jabalina'));
  source.system.quantity = 3; source.system.modes[0].ammunitionVersion = 0;
  f.add(source);
  await migrateActorAmmunition(f.actor); await migrateActorAmmunition(f.actor);
  assert.equal(f.actor.items.length, 3);
  assert.ok(f.actor.items.every(item => item.system.quantity === 1));
});

test('migración conserva reservas de perfiles propios sin compatibilidad configurada', async t => {
  const f = setup(t), weapon = f.bow();
  Object.assign(weapon.system.modes[0], { ammoType: '', ammoLoaded: 1, ammoReserve: 9 });
  await migrateActorAmmunition(f.actor);
  assert.equal(weapon.system.modes[0].ammoReserve, 9);
  assert.equal(f.actor.items.length, 1);
});


test('todos los modos oficiales de lanzamiento de objetos se clasifican como arrojadizos', () => {
  for (const key of ['daga', 'hachuela', 'lanza-corta', 'red', 'tridente', 'jabalina']) {
    const source = WEAPON_SOURCES.find(item => item.buildKey === key);
    assert.equal(source.system.modes.find(mode => mode.weaponType === 'ranged').ammoUse, 'thrown', key);
  }
});

test('la incorporación central del Actor transforma compras y arrastres, también en ejemplares múltiples', async t => {
  setup(t);
  Actor.prototype.createEmbeddedDocuments = async function(type, data) { this.received = data; return data; };
  const { MythrasActor } = await import('../scripts/documents/mythras-actor.js');
  const actor = new MythrasActor(); actor.type = 'character'; actor.system = {}; actor.items = [];
  const created = await actor.createEmbeddedDocuments('Item', [AMMUNITION_SOURCES[0], AMMUNITION_SOURCES.at(-1)]);
  assert.equal(created.length, 13);
  assert.equal(created[0].system.quantity, 12);
  assert.equal(created[0].name, 'Flechas');
  assert.equal(created.filter(item => item.type === 'weapon').length, 12);
});

test('el coordinador comprueba propiedad y confirma una petición repetida sin descontar dos veces', async t => {
  const f = setup(t), weapon = f.bow(), stock = f.arrows(1);
  Object.assign(weapon.system.modes[0], { ammoItemId: stock.id, ammoLoaded: 1 });
  let handler; const messages = [];
  game.socket = { on: (channel, callback) => { handler = callback; }, emit: (channel, message) => messages.push(message) };
  game.users.push({ id: 'owner', active: true }, { id: 'other', active: true });
  f.actor.testUserPermission = user => user.id === 'owner';
  const old = globalThis.fromUuid; globalThis.fromUuid = async () => f.actor;
  t.after(() => { if (old) globalThis.fromUuid = old; else delete globalThis.fromUuid; });
  registerAmmunitionRuntime();
  const request = { id: 'socket-shot', kind: 'shoot', actorUuid: f.actor.uuid, weaponId: weapon.id, modeKey: 'ranged', userId: 'other' };
  await handler({ action: 'inventoryAmmunition', request });
  assert.equal(stock.system.quantity, 1); assert.equal(messages.length, 0);
  request.userId = 'owner';
  await handler({ action: 'inventoryAmmunition', request });
  await handler({ action: 'inventoryAmmunition', request });
  assert.equal(stock.system.quantity, 0); assert.equal(messages.length, 2);
  assert.deepEqual(messages[0].result, messages[1].result);
  assert.equal(f.actor.items.get(stock.id), stock);
});

test('el fallo de escritura no consume munición ni conserva el PA cobrado', async t => {
  const f = setup(t), weapon = f.bow(), stock = f.arrows(1);
  weapon.system.modes[0].reloadActions = 1;
  f.actor.updateEmbeddedDocuments = async () => { throw new Error('write rejected'); };
  await assert.rejects(f.op(weapon, 'reload', { itemId: stock.id }), /write rejected/);
  assert.equal(f.actor.system.resources.actionPoints.value, 10);
  assert.equal(stock.system.quantity, 1); assert.equal(weapon.system.modes[0].ammoLoaded, 0);
});

test('el hook de traslado de un contenedor invalida sus cargas y no entra en recursión', async t => {
  const f = setup(t), weapon = f.bow(), bag = f.add({ type: 'equipment', system: { category: 'container', isContainer: true } });
  const stock = f.arrows(1, { parentContainerId: bag.id });
  Object.assign(weapon.system.modes[0], { ammoItemId: stock.id, ammoLoaded: 1 });
  const hooks = {};
  Hooks.on = (event, callback) => { hooks[event] = callback; };
  game.socket = { on() {} };
  registerAmmunitionRuntime();
  bag.system.category = 'property';
  await hooks.updateItem(bag, {}, {}, 'gm');
  assert.equal(weapon.system.modes[0].ammoLoaded, 0);
  assert.equal(stock.system.quantity, 1);
});
