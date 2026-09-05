import test from 'node:test';
import assert from 'node:assert/strict';
import {installHost,documentDouble,clickAndWait} from './helpers/ui.js';

test('la Suerte simple admite usos repetidos solo por un participante autorizado',async t=>{
  const {document}=installHost(t);
  const {activateSkillRollCard}=await import('../scripts/rules/skill-roll-chat.js');
  const actor=documentDouble({system:{resources:{luckPoints:{value:3}}}});
  globalThis.fromUuid=async()=>actor;t.after(()=>delete globalThis.fromUuid);
  const message=documentDouble({id:'message',content:'<div class="mythras-chat-roll-line"></div><div class="mythras-chat-result-block"></div>',rolls:[],flags:{'mythras-foundry':{skillRoll:{actorUuid:actor.uuid,target:60,criticalTarget:6,rolls:[73]}}}});
  foundry.applications.api.DialogV2.wait=async()=> 'invert';
  for(const expected of [37,73]){
    document.body.innerHTML='<button data-action="spend-luck"></button>';await activateSkillRollCard(message,document.body);
    const button=document.querySelector('button');assert.equal(button.hidden,false);await clickAndWait(button);
    assert.equal(message.getFlag('mythras-foundry','skillRoll').rolls.at(-1),expected);
  }
  assert.equal(actor.system.resources.luckPoints.value,1);assert.deepEqual(message.getFlag('mythras-foundry','skillRoll').rolls,[73,37,73]);
  for(const [member,owner,gm]of [[false,true,true],[true,false,false]]){
    game.mythrasFoundry.party.getActiveParty=()=>({memberIds:member?[actor.id]:[]});actor.isOwner=owner;game.user.isGM=gm;
    document.body.innerHTML='<button data-action="spend-luck"></button>';await activateSkillRollCard(message,document.body);
    const button=document.querySelector('button');assert.equal(button.hidden,true);await clickAndWait(button);assert.equal(actor.system.resources.luckPoints.value,1);
  }
});
