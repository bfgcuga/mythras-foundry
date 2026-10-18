import test from 'node:test';
import assert from 'node:assert/strict';
import { installHost, documentDouble, collection, setPath, render, css } from './helpers/ui.js';
import { maneuverCandidates, chooseManeuverRivals } from '../scripts/rules/maneuver-runtime.js';
import { applyManeuverProtection, maneuverAttackRestriction, releaseManeuverRival, removeManeuverProtection } from '../scripts/rules/maneuver-protection.js';
import { applyContestResponse, applyContestLuck, requestContestActionConfirmation, activateContestCard } from '../scripts/rules/contest-chat.js';
import { requestCombatAction, executeAction, registerCombatActionSocket } from '../scripts/rules/combat-action-runtime.js';
import { expireRoundConditions } from '../scripts/rules/timed-condition-runtime.js';
import { ensureEngagement, setRelationPosition, validateReachAttack, combatantForActor } from '../scripts/rules/engagement-runtime.js';
import { prepareActiveStatusControls } from '../scripts/ui/penalties.js';
import { ruleHelpButton } from '../scripts/ui/rule-help.js';

const scope = 'mythras-foundry';
function setup(t) {
  const host = installHost(t);
  let serial = 0;
  const docs = new Map(); const warnings = [];
  for (const [key, value] of Object.entries({
    fromUuid: async uuid => docs.get(uuid), fromUuidSync: uuid => docs.get(uuid),
    Roll: { fromData: value => value },
    ChatMessage: { getSpeaker: ({actor}) => ({actor: actor.id}), create: async data => makeMessage(data) }
  })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
    t.after(()=>old ? Object.defineProperty(globalThis,key,old) : delete globalThis[key]);
  }
  foundry.utils.randomID = () => `id${++serial}`;
  Hooks.callAll = () => {};
  game.i18n.has = key => game.i18n.localize(key) !== key;
  ui.notifications.warn = message => warnings.push(message);
  game.users = collection([{id:'gm',isGM:true,active:true},{id:'owner',active:true},{id:'other',active:true}]);
  game.user.targets = new Set();
  function makeActor(id, type = 'npc') {
    const actor = documentDouble({id,uuid:`Actor.${id}`,name:id === 'a' ? 'Hodei' : `Rival ${id}`,type,
      system:{strength:12,size:12,fatigueLevel:'fresh',resources:{actionPoints:{value:3},luckPoints:{value:3}}},
      effects:collection(),statuses:new Set(),testUserPermission:user=>user.id==='owner'});
    actor.items = collection([documentDouble({id:`evade-${id}`,name:'Evadir',type:'skill',system:{slug:'evadir',total:70}})]);
    actor.items[0].actor = actor;
    actor.createEmbeddedDocuments = async (type,sources) => sources.map(source => {
      const effect = documentDouble({...structuredClone(source),id:`effect${++serial}`,statuses:new Set(source.statuses)});
      actor.effects.push(effect); source.statuses.forEach(id=>actor.statuses.add(id)); return effect;
    });
    actor.deleteEmbeddedDocuments = async (type,ids) => {
      actor.effects = collection(actor.effects.filter(effect=>!ids.includes(effect.id)));
      actor.statuses = new Set(actor.effects.flatMap(effect=>[...effect.statuses]));
    };
    docs.set(actor.uuid,actor); game.actors.push(actor); return actor;
  }
  function makeToken(actor,id) {
    const token = {id,uuid:`Scene.s.Token.${id}`,name:`Token ${id}`,actor,parent:{id:'s'},texture:{src:'portrait.png'},hidden:false};
    actor.token = token; docs.set(token.uuid,token);
    canvas.tokens.placeables.push({document:token,actor,isVisible:true}); return token;
  }
  function makeMessage(data = {}) {
    const message = documentDouble({id:`message${++serial}`,uuid:`ChatMessage.${serial}`,rolls:[],...data});
    const update = message.update;
    message.update = async change => {
      if (change.flags) {
        message.flags = foundry.utils.mergeObject(message.flags ?? {},change.flags);
        change = {...change}; delete change.flags;
      }
      return update(change);
    };
    docs.set(message.uuid,message); return message;
  }
  const actors = ['a','b','c','d'].map(id=>makeActor(id,id==='a'?'character':'npc'));
  const tokens = actors.map((actor,index)=>makeToken(actor,String(index)));
  const combat = documentDouble({id:'combat',uuid:'Combat.combat',scene:{id:'s'},started:true,round:2,turn:0,
    combatants:collection(actors.map((actor,index)=>({id:String(index),actor,token:tokens[index]}))),
    flags:{[scope]:{combatActions:{actions:{},delays:{},braces:{},movements:{}},tacticalState:{relations:{}}}}});
  combat.setFlag = async (scope,key,value) => { setPath(combat,`flags.${scope}.${key}`,value); };
  combat.combatant = combat.combatants[0]; combat.turns = combat.combatants;
  combat.advanced = 0; combat.nextTurn = async()=>{combat.advanced++;};
  combat.combatants.forEach(entry=>entry.parent=combat);
  game.combats = collection([combat]);game.combat=combat;
  game.mythrasFoundry.party.getActiveParty=()=>({memberIds:['a']});
  game.mythrasFoundry.combat={isCoordinator:()=>true};
  function makeAction(rivals=tokens.slice(1)) {
    const message=makeMessage();
    const action={id:`action${++serial}`,key:'maneuver',status:'resolving',revision:0,
      actorName:'Old',actorUuid:actors[0].uuid,tokenUuid:tokens[0].uuid,combatantId:'0',combatId:combat.id,
      round:combat.round,userId:'owner',messageUuid:message.uuid,parameters:{rivalTokenUuids:rivals.map(token=>token.uuid)}};
    combat.flags[scope].combatActions.actions[action.id]=action;
    return {action,message};
  }
  async function respondAll(message, rolls=[50,30,60,90]) {
    const participants=message.getFlag(scope,'contest').participants;
    await Promise.all(participants.map((entry,index)=>applyContestResponse(message,{revision:0,participantId:entry.id,
      userId:'gm',rawRoll:rolls[index],serializedRoll:{total:rolls[index]},config:{abilityId:entry.abilityId,difficulty:'standard'}})));
  }
  return {...host,actors,tokens,combat,docs,warnings,makeToken,makeAction,makeMessage,respondAll};
}

test('Maniobrar spends one AP, rolls once per token, confirms partial protection and expires at round end',async t=>{
  const f=setup(t); const {actors,tokens,combat}=f;
  // Execute the public action entry point with a confirmed selector.
  foundry.applications.api.DialogV2.wait=async()=>tokens.slice(1).map(token=>token.uuid);
  await requestCombatAction(actors[0],'maneuver');
  const action=Object.values(combat.flags[scope].combatActions.actions)[0];
  const message=f.docs.get(action.messageUuid);
  assert.equal(actors[0].system.resources.actionPoints.value,2);
  assert.equal(action.status,'awaitingContest'); assert.equal(combat.advanced,0);
  await f.respondAll(message);
  const contest=message.getFlag(scope,'contest');
  assert.equal(contest.status,'resolved'); assert.equal(message.rolls.length,4);
  assert.equal(actors[0].effects.length,0); assert.equal(combat.advanced,0);
  assert.equal(actors[1].system.resources.actionPoints.value,3);
  assert.match(message.content,/Pendiente de confirmar/);
  combat.flags[scope].tacticalState.relations['0::1']={id:'0::1',status:'engaged',position:'neutral',sides:{'0':{combatantId:'0'},'1':{combatantId:'1'}}};
  await requestContestActionConfirmation(message,{revision:contest.revision,userId:'owner'});
  assert.equal(combat.advanced,1); assert.equal(action.status,'resolved');
  assert.equal(combat.flags[scope].tacticalState.relations['0::1'].status,'disengaged');
  assert.equal(maneuverAttackRestriction(combat,tokens[1].uuid,tokens[0])?.id,actors[0].effects[0].id);
  assert.equal(maneuverAttackRestriction(combat,tokens[2].uuid,tokens[0]),null);
  assert.ok(maneuverAttackRestriction(combat,tokens[3].uuid,tokens[0]));
  assert.equal(actors[0].effects.length,1);
  const controls=prepareActiveStatusControls(actors[0]);
  assert.match(controls[0].label,/Token 1, Token 3/);
  const html=render('templates/actor/parts/penalties-tab.hbs',{activeStatusControls:controls,hasActiveStatusControls:true,editable:true});
  assert.match(html,/Protegido por maniobra/);
  const before=message.content;
  await requestContestActionConfirmation(message,{revision:contest.revision,userId:'owner'});
  assert.equal(combat.advanced,1);assert.equal(message.content,before);
  assert.doesNotMatch(message.content,/data-contest-action="luck"|data-contest-action="confirm-action"|data-contest-action="reopen"/);
  await expireRoundConditions(combat);
  assert.equal(actors[0].effects.length,0);
});

test('ties and mutual failures grant no protection; stale or unauthorized confirmation is rejected',async t=>{
  const f=setup(t);const {action,message}=f.makeAction(f.tokens.slice(1,3));
  await executeAction(f.combat,action);
  await f.respondAll(message,[90,90,90]);
  let contest=message.getFlag(scope,'contest');
  assert.match(message.content,/Sin restricción por maniobra/);
  assert.equal(await requestContestActionConfirmation(message,{revision:contest.revision,userId:'other'}),false);
  f.combat.round++;
  assert.equal(await requestContestActionConfirmation(message,{revision:contest.revision,userId:'owner'}),false);
  f.combat.round--;
  await requestContestActionConfirmation(message,{revision:contest.revision,userId:'owner'});
  assert.equal(f.actors[0].effects.length,0);assert.equal(f.combat.advanced,1);
});

test('Luck recalculates every duel before confirmation and is locked after applying consequences',async t=>{
  const f=setup(t);const {action,message}=f.makeAction(f.tokens.slice(1,2));
  await executeAction(f.combat,action);await f.respondAll(message,[50,60]);
  const contest=message.getFlag(scope,'contest');
  await applyContestLuck(message,{revision:contest.revision,participantId:contest.initiatorId,userId:'owner',luckActorId:'a',rawRoll:4});
  assert.equal(f.actors[0].system.resources.luckPoints.value,2);
  assert.match(message.content,/No puede atacarte/);
  await requestContestActionConfirmation(message,{revision:message.getFlag(scope,'contest').revision,userId:'owner'});
  assert.ok(maneuverAttackRestriction(f.combat,f.tokens[1].uuid,f.tokens[0]));
  await applyContestLuck(message,{revision:message.getFlag(scope,'contest').revision,participantId:contest.initiatorId,userId:'owner',luckActorId:'a',rawRoll:95});
  assert.equal(f.actors[0].system.resources.luckPoints.value,2);
});

test('selection respects token visibility and identity, preselects current targets, and supports select all/none',async t=>{
  const f=setup(t);f.tokens[3].hidden=true;canvas.tokens.placeables[3].isVisible=false;
  f.tokens[2].actor.items=collection();
  const candidates=maneuverCandidates(canvas.tokens.placeables,f.tokens[0].uuid,{isGM:false},[canvas.tokens.placeables[1]]);
  assert.equal(candidates.length,2);assert.equal(candidates[0].selected,true);assert.equal(candidates[1].hasEvade,false);
  assert.equal(maneuverCandidates(canvas.tokens.placeables,f.tokens[0].uuid,{isGM:true}).length,3);
  game.user.targets=new Set([canvas.tokens.placeables[1]]);
  foundry.applications.api.DialogV2.wait=async options=>{
    document.body.innerHTML=`<form>${options.content}<button data-action="confirm"></button></form>`;
    options.render(null,{element:document.body});
    const boxes=[...document.querySelectorAll('input[name=rival]')];
    assert.equal(boxes[0].checked,true);assert.equal(boxes[1].disabled,true);
    document.querySelector('[data-maneuver-select=all]').click();
    assert.equal(boxes.filter(box=>box.checked).length,2);
    document.querySelector('[data-maneuver-select=none]').click();
    assert.equal(boxes.some(box=>box.checked),false);
    assert.equal(document.querySelector('[data-action=confirm]').disabled,true);
    return null;
  };
  assert.equal(await chooseManeuverRivals(f.actors[0],f.tokens[0].uuid),null);
  assert.equal(f.actors[0].system.resources.actionPoints.value,3);
});

test('new engagements and attacks are blocked without detailed reach; attacking releases only the named rival',async t=>{
  const f=setup(t);const [actor]=f.actors;const [own,b,c]=f.tokens;
  await applyManeuverProtection(actor,own.uuid,[b,c],f.combat,'one');
  const mode={weaponType:'melee',reach:'M'};
  assert.equal(await ensureEngagement(f.combat,b.actor,actor,{},mode),null);
  for(const weaponType of ['melee','ranged','siege']) {
    assert.deepEqual(await validateReachAttack(f.combat,b.actor,actor,{}, {...mode,weaponType}),{allowed:false,reason:'maneuver'});
  }
  const relation={id:'0::1',status:'disengaged',sides:{'0':{combatantId:'0',tokenUuid:own.uuid},'1':{combatantId:'1',tokenUuid:b.uuid}}};
  f.combat.flags[scope].tacticalState.relations[relation.id]=relation;
  assert.equal(await setRelationPosition(f.combat,relation.id,'neutral'),null);
  await releaseManeuverRival(f.combat,actor,b.uuid,own.uuid);
  assert.equal(maneuverAttackRestriction(f.combat,b.uuid,own),null);
  assert.ok(maneuverAttackRestriction(f.combat,c.uuid,own));
  await applyManeuverProtection(actor,own.uuid,[c,f.tokens[3]],f.combat,'two');
  assert.equal(actor.effects.length,1);
  assert.equal(actor.effects[0].flags[scope].timedCondition.restrictedTokenUuids.length,2);
  await releaseManeuverRival(f.combat,actor,c.uuid,own.uuid);
  await releaseManeuverRival(f.combat,actor,f.tokens[3].uuid,own.uuid);
  assert.equal(actor.effects.length,0);
});

test('protection and status removal distinguish tokens sharing one Actor',async t=>{
  const f=setup(t);const actor=f.actors[0];const token2=f.makeToken(actor,'second');
  await applyManeuverProtection(actor,f.tokens[0].uuid,[f.tokens[1]],f.combat,'one');
  await applyManeuverProtection(actor,token2.uuid,[f.tokens[2]],f.combat,'two');
  assert.equal(maneuverAttackRestriction(f.combat,f.tokens[1].uuid,token2),null);
  assert.ok(maneuverAttackRestriction(f.combat,f.tokens[2].uuid,token2));
  assert.match(prepareActiveStatusControls(actor)[0].label,/Token 2/);
  assert.doesNotMatch(prepareActiveStatusControls(actor)[0].label,/Token 1/);
  assert.equal(combatantForActor(f.combat,actor,f.tokens[0].uuid).id,'0');
  await removeManeuverProtection(actor,token2.uuid);
  assert.equal(actor.effects.length,1);
});

test('fixed Evade rejects alternate abilities and double responses without consuming rival AP',async t=>{
  const f=setup(t);const {action,message}=f.makeAction([f.tokens[1]]);
  await executeAction(f.combat,action);const contest=message.getFlag(scope,'contest');
  const participant=contest.participants[1];
  f.actors[1].items.push(documentDouble({id:'other',type:'skill',system:{slug:'musculo',total:100}}));
  await applyContestResponse(message,{revision:0,participantId:participant.id,userId:'gm',rawRoll:20,config:{abilityId:'other'}});
  assert.equal(message.getFlag(scope,'contest').participants[1].pending,true);
  await f.respondAll(message,[50,30]);
  const saved=message.getFlag(scope,'contest').revision;
  await applyContestResponse(message,{revision:0,participantId:participant.id,userId:'gm',rawRoll:4,config:{abilityId:participant.abilityId}});
  assert.equal(message.getFlag(scope,'contest').revision,saved);
  assert.equal(f.actors[1].system.resources.actionPoints.value,3);
});

test('action cards use the shared help component and help opens the rule explanation',async t=>{
  const f=setup(t);const {action,message}=f.makeAction([f.tokens[1]]);
  await executeAction(f.combat,action);
  let opened;
  foundry.applications.api.DialogV2.wait=async options=>{opened=options;};
  document.body.innerHTML=message.content;
  activateContestCard(message,document.body);
  const help=document.querySelector('[data-contest-action=help]');
  assert.equal(help.outerHTML,document.createRange().createContextualFragment(ruleHelpButton('data-contest-action="help"')).firstChild.outerHTML);
  help.click();assert.match(opened.content,/hasta el final del asalto/);
  assert.ok(css.includes('.mythras-chat-card .mythras-help-button'));
});


test('cancelled and missing-skill selections never spend AP; duplicate execution preserves pending rolls',async t=>{
  const f=setup(t);
  foundry.applications.api.DialogV2.wait=async()=>null;
  await requestCombatAction(f.actors[0],'maneuver');
  assert.equal(f.actors[0].system.resources.actionPoints.value,3);
  assert.equal(Object.values(f.combat.flags[scope].combatActions.actions).length,0);
  f.actors[1].items=collection();
  foundry.applications.api.DialogV2.wait=async()=>[f.tokens[1].uuid];
  await requestCombatAction(f.actors[0],'maneuver');
  assert.equal(f.actors[0].system.resources.actionPoints.value,3);
  const {action,message}=f.makeAction([f.tokens[2]]);
  await executeAction(f.combat,action);
  const before=message.getFlag(scope,'contest');
  await executeAction(f.combat,action);
  assert.equal(message.getFlag(scope,'contest'),before);
});

test('waiting never pauses a manoeuvre for interruption and spends only one initiator AP',async t=>{
  const f=setup(t);let onSocket;
  game.socket={on:(channel,callback)=>{onSocket=callback;}};
  registerCombatActionSocket();
  f.combat.flags[scope].combatActions.delays['1']={status:'reserved'};
  foundry.applications.api.DialogV2.wait=async()=>[f.tokens[1].uuid];
  await requestCombatAction(f.actors[0],'maneuver');
  const action=Object.values(f.combat.flags[scope].combatActions.actions)[0];
  assert.equal(action.status,'awaitingContest');
  assert.deepEqual(action.interruptCandidates,[]);
  await onSocket({action:'combatAction',operation:'pass',combatId:f.combat.id,actionId:action.id,
    revision:action.revision,combatantId:'1',userId:'gm'});
  assert.equal(action.status,'awaitingContest');
  assert.equal(f.actors[0].system.resources.actionPoints.value,2);
  assert.equal(f.combat.advanced,0);
});

test('exact successful ties end without protection and an outright win protects against every rival',async t=>{
  const f=setup(t);
  const first=f.makeAction([f.tokens[1]]);
  await executeAction(f.combat,first.action);await f.respondAll(first.message,[40,40]);
  await requestContestActionConfirmation(first.message,{revision:first.message.getFlag(scope,'contest').revision,userId:'owner'});
  assert.equal(f.actors[0].effects.length,0);
  const second=f.makeAction();
  await executeAction(f.combat,second.action);await f.respondAll(second.message,[4,30,60,90]);
  await requestContestActionConfirmation(second.message,{revision:second.message.getFlag(scope,'contest').revision,userId:'owner'});
  for(const token of f.tokens.slice(1)) assert.ok(maneuverAttackRestriction(f.combat,token.uuid,f.tokens[0]));
});

test('real attack entry points reject protected targets before rolling or spending, and cancellation preserves protection',async t=>{
  const f=setup(t);
  const {createAttackMessage,createResolvedReactionAttack}=await import('../scripts/rules/combat-chat.js');
  const [protectedActor,attacker]=f.actors;
  await applyManeuverProtection(protectedActor,f.tokens[0].uuid,[f.tokens[1]],f.combat,'one');
  const weapon=documentDouble({id:'weapon',name:'Espada',type:'weapon',system:{equipped:true,weaponType:'melee',damage:'1d6',size:'M',reach:'M'}});
  attacker.items.push(weapon);
  for(const weaponType of ['melee','ranged']) {
    foundry.applications.api.DialogV2.wait=async()=>({difficulty:'standard',additional:{targetTokenUuid:f.tokens[0].uuid}});
    await createAttackMessage({actor:attacker,weapon,mode:{key:'melee',weaponType},resolution:{target:70,difficulty:'standard'}});
    assert.match(f.warnings.at(-1),/no puede atacar/);
    assert.equal(attacker.system.resources.actionPoints.value,3);
  }
  assert.equal(await createResolvedReactionAttack({tracker:f.combat,attackerCombatantId:'1',defenderCombatantId:'0',weaponId:'weapon',modeKey:'melee'}),null);
  assert.equal(attacker.system.resources.actionPoints.value,3);
  foundry.applications.api.DialogV2.wait=async()=>null;
  await createAttackMessage({actor:protectedActor,weapon,mode:{key:'melee',weaponType:'melee'},resolution:{target:70,difficulty:'standard'}});
  assert.ok(maneuverAttackRestriction(f.combat,f.tokens[1].uuid,f.tokens[0]));
});

test('accepting an attack releases only its rival even when the attack roll fails',async t=>{
  const f=setup(t);const {createAttackMessage}=await import('../scripts/rules/combat-chat.js');
  const actor=f.actors[0];actor.system.dexterity=12;actor.system.intelligence=12;
  await applyManeuverProtection(actor,f.tokens[0].uuid,f.tokens.slice(1,3),f.combat,'one');
  const weapon=documentDouble({id:'weapon',name:'Espada',type:'weapon',system:{equipped:true,weaponType:'melee',damage:'1d6',size:'M',reach:'M'}});
  actor.items.push(weapon);
  globalThis.Roll=class { constructor(){this.total=95;} async evaluate(){return this;} toJSON(){return {total:this.total};} };
  foundry.applications.api.DialogV2.wait=async()=>({difficulty:'standard',additional:{targetTokenUuid:f.tokens[1].uuid,predeclared:false}});
  const message=await createAttackMessage({actor,weapon,mode:{key:'melee',weaponType:'melee',size:'M',reach:'M',damage:'1d6'},resolution:{target:70,difficulty:'standard'}});
  assert.ok(message);
  assert.equal(message.getFlag(scope,'combat').attacker.rawRoll,95);
  assert.equal(maneuverAttackRestriction(f.combat,f.tokens[1].uuid,f.tokens[0]),null);
  assert.ok(maneuverAttackRestriction(f.combat,f.tokens[2].uuid,f.tokens[0]));
  assert.equal(actor.system.resources.actionPoints.value,2);
});

test('Maniobrar uses the initiator token scene when combat is not linked to a scene',async t=>{
  const f=setup(t);
  f.combat.scene=null;
  foundry.applications.api.DialogV2.wait=async()=>[f.tokens[1].uuid];
  await requestCombatAction(f.actors[0],'maneuver');
  const action=Object.values(f.combat.flags[scope].combatActions.actions)[0];
  assert.ok(action,'a scene-independent combat must accept rivals in the initiator scene');
  assert.equal(action.status,'awaitingContest');
  assert.equal(f.actors[0].system.resources.actionPoints.value,2);
  assert.equal(f.warnings.length,0);
});

test('Maniobrar rejects rivals in another scene before spending AP even without a linked combat scene',async t=>{
  const f=setup(t);
  f.combat.scene=null;f.tokens[1].parent={id:'other-scene'};
  foundry.applications.api.DialogV2.wait=async()=>[f.tokens[1].uuid];
  await requestCombatAction(f.actors[0],'maneuver');
  assert.equal(Object.values(f.combat.flags[scope].combatActions.actions).length,0);
  assert.equal(f.actors[0].system.resources.actionPoints.value,3);
  assert.match(f.warnings[0],/participantes de Maniobrar/);
});

test('Maniobrar revalidates the initiator scene after an interruption independently of the viewed or linked scene',async t=>{
  const f=setup(t);const {action,message}=f.makeAction([f.tokens[1]]);
  f.combat.scene={id:'different-linked-scene'};canvas.scene={id:'coordinator-viewed-scene'};
  await executeAction(f.combat,action);
  assert.equal(action.status,'awaitingContest');
  assert.equal(message.getFlag(scope,'contest').participants.length,2);
  assert.equal(f.warnings.length,0);
});
