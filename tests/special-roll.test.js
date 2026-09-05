import test from "node:test";
import * as systemRoll from "../scripts/rules/system-roll.js";
import assert from "node:assert/strict";
import { installHost,documentDouble,dom,collection,clickAndWait } from './helpers/ui.js';

test("la tirada especial transmite nombre, porcentaje, concurso y modo manual",async t=>{
  installHost(t);const rolled=[],contests=[];
  t.mock.module('../scripts/rules/system-roll.js',{exports:{...systemRoll,evaluateSystemRoll:async(formula,options)=>{rolled.push({formula,...options});return {total:42};}}});
  t.mock.module('../scripts/rules/contest-chat.js',{exports:{createContestMessage:async(...args)=>{contests.push(args);}}});
  const {rollSpecial}=await import('../scripts/rules/special-roll.js');
  const actor=documentDouble();let step=0;
  foundry.applications.api.DialogV2.wait=async config=>{
    const page=dom(`<form>${config.content}</form>`);t.after(()=>page.window.close());const form=page.window.document.querySelector('form');
    if(step++===0){form.elements.name.value='Orientarse';form.elements.target.value='73';return config.buttons[0].callback(null,{form});}
    return {difficulty:'hard',contest:{resolutionMode:'opposed',sides:{initiator:{mode:'individual'}}}};
  };
  await rollSpecial(actor,{manual:true});assert.equal(contests.length,1);assert.equal(contests[0][0].name,'Orientarse');assert.equal(contests[0][0].system.total,73);assert.equal(contests[0][1].targets.target,49);assert.deepEqual(rolled,[{formula:'1d100',manual:true}]);
  foundry.applications.api.DialogV2.wait=async()=>null;await rollSpecial(actor);assert.equal(contests.length,1);assert.equal(rolled.length,1);
});
test("la tirada del Item presenta aumento, reducción e igualdad sin inspeccionar ternarios",async t=>{
  installHost(t);
  // Module mocks are restored per test; import a fresh consumer after installing them.
  const messages=[];t.mock.module('../scripts/rules/system-roll.js',{exports:{...systemRoll,evaluateSystemRoll:async()=>({total:42})}});
  const {MythrasItem}=await import('../scripts/documents/mythras-item.js?target-tone');
  globalThis.ChatMessage={getSpeaker:()=>({}),applyRollMode:()=>{},create:async data=>{messages.push(data);return data;}};t.after(()=>delete globalThis.ChatMessage);
  const item=new MythrasItem();Object.assign(item,{id:'special',name:'Prueba',type:'skill',system:{total:60},actor:documentDouble()});
  for(const [difficulty,tone]of [['easy','bonus'],['hard','penalty'],['standard',null]]){
    foundry.applications.api.DialogV2.wait=async()=>({difficulty,contest:{resolutionMode:'difficulty',sides:{initiator:{mode:'individual'}}}});
    await item.rollSkill();const page=dom(messages.at(-1).content);t.after(()=>page.window.close());
    assert.equal(Boolean(page.window.document.querySelector('.skill-roll-modifier-effect--bonus')),tone==='bonus');assert.equal(Boolean(page.window.document.querySelector('.skill-roll-modifier-effect--penalty')),tone==='penalty');
  }
});

test('ambas hojas ofrecen la tirada especial y transmiten Shift',async t=>{
  const {document}=installHost(t);
  const calls=[];t.mock.module('../scripts/rules/special-roll.js',{exports:{rollSpecial:async(actor,options)=>calls.push({actor,...options})}});
  const {render,read}=await import('./helpers/ui.js');
  t.mock.method(globalThis,'fetch',async path=>{assert.equal(path,'systems/mythras-foundry/assets/Silueta/Silueta.svg');return {ok:true,text:async()=>read('assets/Silueta/Silueta.svg')};});
  const {CharacterSheet}=await import('../scripts/sheets/character-sheet.js');
  const {NpcSheet}=await import('../scripts/sheets/npc-sheet.js');
  for(const [Sheet,type]of [[CharacterSheet,'character'],[NpcSheet,'npc']]){
    const actor=documentDouble({type});document.body.innerHTML=render(`templates/actor/${type}-sheet.hbs`,{actor,system:actor.system});
    const button=document.querySelector('[data-action=roll-special]');assert.ok(button,type);
    const sheet=new Sheet({actor});sheet.element=document.body;sheet._onRender({},{});
    for(const shiftKey of [true,false]){await clickAndWait(button,{shiftKey});assert.equal(calls.at(-1).actor,actor);assert.equal(calls.at(-1).manual,shiftKey);}
  }
  assert.equal(calls.length,4);
});
