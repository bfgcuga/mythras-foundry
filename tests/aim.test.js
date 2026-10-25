import test from "node:test";
import assert from "node:assert/strict";
import { installHost, collection, documentDouble, setPath } from "./helpers/ui.js";
import { aimState, aimEligibility, expireAimAtTurnEnd, expireCombatAims, actionPointSpendingChange } from "../scripts/rules/aim.js";
import { applyAimRequest, registerAimRuntime } from "../scripts/rules/aim-runtime.js";
import { declareAim, readyAim } from "../scripts/rules/ranged-actions.js";
import { effectiveActionPointMaximum } from "../scripts/rules/action-points.js";
import { getActionPointRules } from "../scripts/settings.js";
import { combineRangedDifficulty } from "../scripts/rules/ranged-combat.js";

function setup(t, type = 'character') {
  installHost(t); let serial = 0; const hooks = {};
  foundry.utils.randomID = () => `request-${++serial}`;
  foundry.utils.getProperty = (object, path) => path.split('.').reduce((value,key) => value?.[key], object);
  foundry.utils.setProperty = setPath;
  Hooks.on = (event, callback) => { hooks[event] = callback; };
  game.socket = { on() {}, emit() {} };
  game.users = collection([{ id: 'gm', active: true, isGM: true }, { id: 'owner', active: true }]);
  const actor = documentDouble({ id: 'a', uuid: 'Actor.a', type, flags: {}, system: { strength: 12,
    dexterity: 12, intelligence: 12, constitution: 12, size: 12, resources: { actionPoints: { value: 2 } } },
    testUserPermission: user => user.id === 'owner' });
  const maximum = effectiveActionPointMaximum(actor, getActionPointRules());
  actor.system.resources.actionPoints.value = maximum;
  const merge = (target, source) => {
    for (const [key,value] of Object.entries(source)) {
      if (key.startsWith('-=')) delete target[key.slice(2)];
      else if (value && typeof value === 'object' && !Array.isArray(value)) merge(target[key] ??= {}, value);
      else target[key] = value;
    }
  };
  actor.update = async (change, options = {}) => {
    const expanded = {}; for (const [key,value] of Object.entries(change)) setPath(expanded,key,structuredClone(value));
    hooks.preUpdateActor?.(actor, expanded, options);
    merge(actor, expanded);
  };
  actor.setFlag = async (scope,key,value) => actor.update({ [`flags.${scope}.${key}`]: value });
  actor.unsetFlag = async (scope,key) => { delete actor.flags[scope]?.[key]; };
  const weapon = documentDouble({ id: 'bow', type: 'weapon', name: 'Arco', system: { equipped: true,
    activeModeKey: 'ranged', modes: [{ key: 'ranged', weaponType: 'ranged' }] } });
  actor.items.push(weapon);
  const target = { uuid: 'Scene.s.Token.t', actor: { uuid: 'Actor.other' } };
  const combat = { id: 'combat', round: 1, turn: 0, started: true, combatants: collection([{ id: 'c', actor }]),
    getFlag: () => null, advanced: 0, mythrasTurnEconomy: { cycle: 1 } };
  combat.combatant = combat.combatants[0]; combat.turns = combat.combatants;
  combat.nextTurn = async () => { await expireAimAtTurnEnd(combat); combat.advanced++; };
  game.combat = combat; game.combats = collection([combat]); game.user.targets = new Set([target]);
  const old = globalThis.fromUuid; globalThis.fromUuid = async uuid => uuid === target.uuid ? target : null;
  t.after(() => old ? globalThis.fromUuid = old : delete globalThis.fromUuid);
  registerAimRuntime();
  const request = () => ({ id: `operation-${++serial}`, userId: 'gm', combatId: combat.id, combatantId: 'c',
    round: combat.round, weaponId: weapon.id, modeKey: 'ranged', targetTokenUuid: target.uuid });
  const ready = () => readyAim(actor, { combat, weaponId: weapon.id, modeKey: 'ranged', targetTokenUuid: target.uuid });
  return { actor, weapon, combat, target, maximum, hooks, request, ready };
}

for (const type of ['character','npc']) test(`Apuntar consume todos los PA y pasa turno una sola vez (${type})`, async t => {
  const f = setup(t,type); assert.ok(f.maximum > 0);
  const request = f.request(); const result = await applyAimRequest(request);
  assert.equal(result.spent, f.maximum);
  assert.equal(f.actor.system.resources.actionPoints.value, 0);
  assert.equal(f.combat.advanced, 1); assert.equal(aimState(f.actor,f.combat).phase,'preparing');
  await applyAimRequest(request);
  assert.equal(f.combat.advanced, 1); assert.equal(f.actor.system.resources.actionPoints.value,0);
});

test('el cambio de ciclo no concede beneficio; el siguiente asalto lo concede sin acumular', async t => {
  const f = setup(t); await applyAimRequest(f.request());
  f.combat.mythrasTurnEconomy.cycle = 5; assert.equal(f.ready(),null);
  await expireCombatAims(f.combat,2); f.combat.round = 2;
  assert.equal(f.ready().phase,'ready');
  assert.equal(f.ready().readyRound,2);
  const result = combineRangedDifficulty('standard',[3],Boolean(f.ready()));
  assert.equal(result.steps,2);
  await f.actor.update({ 'system.resources.actionPoints.value': f.maximum }, { mythrasRoundRestore: { combatId: 'combat', round: 2 } });
  await assert.rejects(applyAimRequest(f.request()), /prolongarse/);
  assert.equal(f.actor.system.resources.actionPoints.value,f.maximum);
  await expireCombatAims(f.combat,3); f.combat.round = 3;
  assert.equal(f.ready(),null);
});

test('gastar PA, incluso antes del turno propio, impide apuntar aunque se reponga el contador', async t => {
  const f = setup(t);
  await f.actor.update({ 'system.resources.actionPoints.value': f.maximum-1 });
  await f.actor.update({ 'system.resources.actionPoints.value': f.maximum });
  await assert.rejects(applyAimRequest(f.request()), /ninguno/);
  assert.equal(f.combat.advanced,0);
  await f.actor.update({ 'system.resources.actionPoints.value': f.maximum+1 }, { mythrasActionPointRefund: true });
  await f.actor.update({ 'system.resources.actionPoints.value': f.maximum }, { mythrasActionPointAdjustment: true });
  assert.equal(aimEligibility(f.actor,f.combat),'');
});

test('cancelar el selector no consume PA ni crea un apuntado', async t => {
  const f = setup(t); foundry.applications.api.DialogV2.wait = async () => null;
  await declareAim(f.actor);
  assert.equal(f.actor.system.resources.actionPoints.value,f.maximum); assert.equal(f.combat.advanced,0);
  assert.equal(aimState(f.actor,f.combat),null);
});

test('el coordinador rechaza propietario ajeno, turno ajeno e interrupciones', async t => {
  const f = setup(t); const request = f.request(); request.userId='other';
  assert.equal(await applyAimRequest(request),false);
  f.combat.combatant = { id: 'other' };
  await assert.rejects(applyAimRequest(f.request()));
  f.combat.combatant = f.combat.combatants[0];
  f.combat.getFlag = (scope,key) => key==='combatInterruption' ? { phase:'choosing', combatantId:'c' } : null;
  await assert.rejects(applyAimRequest(f.request()));
  assert.equal(f.actor.system.resources.actionPoints.value,f.maximum);
});

test('otra acción de pago cancela el beneficio; terminar el turno sin disparar también', async t => {
  const f = setup(t); await applyAimRequest(f.request()); f.combat.round = 2;
  await f.actor.update({ 'system.resources.actionPoints.value': f.maximum }, { mythrasRoundRestore: { combatId:'combat',round:2 } });
  await f.actor.update({ 'system.resources.actionPoints.value': f.maximum-1 });
  assert.equal(f.ready(),null);
  f.actor.flags['mythras-foundry'].rangedAim = { schemaVersion:2,combatId:'combat',readyRound:2 };
  await expireAimAtTurnEnd(f.combat);
  assert.equal(aimState(f.actor,f.combat),null);
});

test('las coordenadas y la elevación no registran un cancelador de apuntado', t => {
  const f=setup(t); assert.equal(f.hooks.updateToken,undefined);
  const legacy = { schemaVersion:1,combatId:'combat',weaponId:'bow',modeKey:'ranged',targetTokenUuid:f.target.uuid };
  f.actor.flags['mythras-foundry']={rangedAim:legacy};
  assert.equal(f.ready(),null);
  f.actor.flags['mythras-foundry'].rangedAim={...legacy,schemaVersion:2,readyRound:2};
  f.combat.round=2;
  assert.equal(readyAim(f.actor,{combat:f.combat,weaponId:'other',modeKey:'ranged',targetTokenUuid:f.target.uuid}),null);
  assert.ok(f.ready());
});


test('el jugador declara por socket y el DJ consume los PA y avanza su turno', async t => {
  const f=setup(t); let handler; const gm=game.users.get('gm'); const owner=game.users.get('owner');
  owner.targets = new Set([f.target]);
  game.socket.on=(channel,callback)=>{handler=callback;};
  game.socket.emit=async(channel,message)=>{
    if(message.action==='wholeRoundAim') {game.user=gm; await handler(message);}
    else if(message.action==='wholeRoundAimResult') {game.user=owner; await handler(message);}
  };
  registerAimRuntime();
  foundry.applications.api.DialogV2.wait=async()=> 'bow:ranged';
  ui.notifications.info=()=>{};
  game.user=owner;
  await declareAim(f.actor);
  assert.equal(f.actor.system.resources.actionPoints.value,0);
  assert.equal(f.combat.advanced,1);
  assert.equal(aimState(f.actor,f.combat).readyRound,2);
});

test('cerrar combate elimina el estado preparado y un fallo documental no consume ni avanza', async t=>{
  const f=setup(t); const update=f.actor.update;
  f.actor.update=async()=>{throw new Error('write rejected');};
  await assert.rejects(applyAimRequest(f.request()),/write rejected/);
  assert.equal(f.actor.system.resources.actionPoints.value,f.maximum);
  assert.equal(f.combat.advanced,0);
  f.actor.update=update;
  await applyAimRequest(f.request());
  await expireCombatAims(f.combat);
  assert.equal(aimState(f.actor,f.combat),null);
});


test('la entrada pública de acciones también utiliza Apuntar de asalto completo', async t=>{
  const f=setup(t);
  const {requestCombatAction}=await import('../scripts/rules/combat-action-runtime.js');
  foundry.applications.api.DialogV2.wait=async()=> 'bow:ranged';
  ui.notifications.info=()=>{};
  await requestCombatAction(f.actor,'aim');
  assert.equal(f.actor.system.resources.actionPoints.value,0);
  assert.equal(f.combat.advanced,1);
  assert.equal(aimState(f.actor,f.combat).schemaVersion,2);
});
