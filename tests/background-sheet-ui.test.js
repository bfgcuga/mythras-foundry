import test from 'node:test';
import assert from 'node:assert/strict';
import { installHost,documentDouble,collection,clickAndWait } from './helpers/ui.js';
import {createBackgroundDraft,culturePassionDrafts,serializeBackgroundDraft,parseBackgroundDraft} from '../scripts/rules/background-generation.js';
import {CULTURES} from '../scripts/data/backgrounds.js';

test('el asistente materializa pasiones al validarlas y actualiza sin duplicarlas',async t=>{
  const {document}=installHost(t,'<button data-background-navigation="next"></button>');
  const {CharacterSheet}=await import('../scripts/sheets/character-sheet.js');
  const draft=createBackgroundDraft();draft.cultureKey=CULTURES[0].key;draft.stage='passions';draft.passions=culturePassionDrafts(CULTURES[0]);
  const actor=documentDouble({system:{backgroundDraft:serializeBackgroundDraft(draft)}});
  const sheet=new CharacterSheet({actor});sheet.element=document.body;sheet._onRender({},{});
  assert.equal(actor.items.filter(i=>i.type==='passion').length,0);
  await clickAndWait(document.querySelector('button'));
  assert.equal(parseBackgroundDraft(actor.system.backgroundDraft).stage,'socialClass');
  assert.equal(actor.items.filter(i=>i.type==='passion').length,3);
  const updated=parseBackgroundDraft(actor.system.backgroundDraft);updated.stage='passions';updated.passions[0].objectDescription='La capitana';await actor.update({'system.backgroundDraft':serializeBackgroundDraft(updated)});
  await clickAndWait(document.querySelector('button'));
  assert.equal(actor.items.filter(i=>i.type==='passion').length,3);assert.ok(actor.items.some(i=>i.name.includes('La capitana')));
});
test('el asistente crea, edita e importa estilos conservando sus perfiles y rasgos',async t=>{
  const {document}=installHost(t,'<button data-background-style-action="create" data-phase="culture" data-style="culture:0"></button>');
  const {CharacterSheet}=await import('../scripts/sheets/character-sheet.js?style-test');
  const draft=createBackgroundDraft();draft.cultureKey=CULTURES[0].key;
  const actor=documentDouble({system:{backgroundDraft:serializeBackgroundDraft(draft)}});
  const sheet=new CharacterSheet({actor});sheet.element=document.body;sheet._onRender({},{});
  const button=document.querySelector('button');await clickAndWait(button);
  let styles=actor.items.filter(i=>i.type==='combatStyle');assert.equal(styles.length,1);assert.equal(styles[0].opened,true);
  styles[0].opened=false;button.dataset.backgroundStyleAction='edit';await clickAndWait(button);assert.equal(styles[0].opened,true);
  const source={id:'packStyle',name:'Lanceros',type:'combatStyle',system:{weaponProfiles:[{key:'lanza',name:'Lanza'}],traitRefs:[{key:'montado'}]},toObject(){return {name:this.name,type:this.type,system:structuredClone(this.system)};}};
  game.packs=collection([{collection:'world.styles',title:'Estilos',documentName:'Item',visible:true,getIndex:async()=>[source],getDocument:async()=>source}]);
  let selection=0;foundry.applications.api.DialogV2.input=async()=>selection++===0?'world.styles':'packStyle';
  button.dataset.backgroundStyleAction='select-pack';await clickAndWait(button);
  const imported=actor.items.find(i=>i.name==='Lanceros');assert.ok(imported);assert.deepEqual(imported.system.weaponProfiles,source.system.weaponProfiles);assert.deepEqual(imported.system.traitRefs,source.system.traitRefs);assert.equal(imported.opened,true);
  const size=actor.items.length;selection=0;await clickAndWait(button);assert.equal(actor.items.length,size);
  button.dataset.backgroundStyleAction='select-learned';foundry.applications.api.DialogV2.input=async()=>imported.id;await clickAndWait(button);assert.equal(actor.items.length,size);
});
