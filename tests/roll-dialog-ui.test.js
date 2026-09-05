import test from 'node:test';
import assert from 'node:assert/strict';
import {installHost,dom,documentDouble,es} from './helpers/ui.js';
import {openAttackRollDialog,activateSkillRollDialog} from '../scripts/apps/skill-roll-dialog.js';

test('el diálogo de ataque separa modificadores y actualiza el objetivo efectivo',async t=>{
  const {window}=installHost(t);let dialog;
  foundry.applications.api.DialogV2.wait=async config=>{dialog=config;return null;};
  const actor=documentDouble();const ability={name:'Espada',system:{total:60},actor};
  assert.equal(await openAttackRollDialog(ability,{modifiers:[{source:'Herida',effect:'Difícil',type:'penalty'},{source:'Apoyo',effect:'+1',type:'bonus'}]}),null);
  const page=dom(`<form>${dialog.content}</form>`);t.after(()=>page.window.close());const form=page.window.document.querySelector('form');
  activateSkillRollDialog(form);
  assert.equal(form.querySelector('[name=resolutionMode]'),null);
  assert.deepEqual([...form.querySelectorAll('.skill-roll-modifier > span')].map(el=>el.textContent),['Herida','Apoyo']);
  for(const [difficulty,target,tone]of [['easy',90,'bonus'],['hard',40,'penalty'],['standard',60,'neutral']]){
    form.elements.difficulty.value=difficulty;form.elements.difficulty.dispatchEvent(new page.window.Event('change',{bubbles:true}));
    const final=form.querySelector('[data-final-target-value]');assert.equal(final.hidden,difficulty==='standard');
    assert.equal(form.querySelector('[data-base-target-value]').textContent,'60%');
    if(!final.hidden){assert.equal(final.textContent,`(${target}%)`);assert.ok(final.classList.contains(`skill-roll-target--${tone}`));}
  }
  assert.equal(dialog.buttons.find(button=>button.action==='cancel').callback(),null);
});
test('cancelar el ataque no gasta PA y la familiaridad se informa solo si penaliza',async t=>{
  installHost(t);const {createAttackMessage}=await import('../scripts/rules/combat-chat.js');
  const actor=documentDouble({system:{resources:{actionPoints:{value:2}}}});
  const defender=documentDouble({id:'defender',uuid:'Actor.defender'});
  canvas.tokens.placeables=[{actor:defender,document:{uuid:'Scene.s.Token.d'},name:'Defensor',visible:true}];
  let content='';foundry.applications.api.DialogV2.wait=async config=>{content=config.content;return null;};
  for(const familiarity of ['included','similar','untrained','broadlySimilar','reasonablyDifferent','substantiallyDifferent']){
    assert.ok(es[`MYTHRASF.Familiarity.${familiarity}`]);
    await createAttackMessage({actor,weapon:{system:{}},mode:{weaponType:'melee'},resolution:{target:60,difficulty:'standard',familiarity}});
    const page=dom(content);t.after(()=>page.window.close());
    const source=[...page.window.document.querySelectorAll('.skill-roll-modifier')].map(el=>el.textContent).join(' ');
    assert.equal(source.includes(es[`MYTHRASF.Familiarity.${familiarity}`]),!['included','similar','untrained'].includes(familiarity));
    assert.equal(actor.system.resources.actionPoints.value,2);assert.equal(actor.updates.length,0);
  }
});
