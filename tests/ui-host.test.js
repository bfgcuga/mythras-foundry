import test from "node:test";
import assert from "node:assert/strict";
import { installHost, dom, documentDouble, render } from "./helpers/ui.js";

test("los hooks registran el evento de chat compatible y decoran la ventana del diálogo",async t=>{
  const {document}=installHost(t,'<div id="window"><div class="mythras-dialog"></div></div>');
  const {registerUiHooks}=await import('../scripts/system/ui-hooks.js');
  const hooks=new Map();Hooks.on=(key,fn)=>hooks.set(key,fn);registerUiHooks();
  assert.equal(typeof hooks.get('renderChatMessageHTML'),'function');assert.equal(hooks.has('renderChatMessage'),false);
  const root=document.getElementById('window');hooks.get('renderApplicationV2')({},root);
  assert.ok(root.classList.contains('mythras-paper-sheet'));assert.ok(root.classList.contains('mythras-foundry'));
  const other=document.createElement('div');hooks.get('renderApplicationV2')({},other);assert.equal(other.classList.contains('mythras-paper-sheet'),false);
});
test("los tooltips se muestran después de un segundo y se retiran al salir",async t=>{
  const {document,window}=installHost(t,'<button title="  Tirar  habilidad  ">Tirar</button>');
  const {activateDelayedTooltips}=await import('../scripts/ui/tooltips.js');
  t.mock.timers.enable({apis:['setTimeout']});
  activateDelayedTooltips(document.body);activateDelayedTooltips(document.body);
  const button=document.querySelector('button');button.dispatchEvent(new window.Event('mouseenter'));
  t.mock.timers.tick(1000);assert.equal(document.querySelector('[role=tooltip]'),null);
  t.mock.timers.runAll();assert.equal(document.querySelector('[role=tooltip]').textContent,'Tirar habilidad');
  assert.equal(document.querySelectorAll('[role=tooltip]').length,1);
  button.dispatchEvent(new window.Event('mouseleave'));assert.equal(document.querySelector('[role=tooltip]'),null);
});
test("los modelos declaran anatomía, narración, galería y moneda sin inspeccionar su código",async t=>{
  installHost(t); const {CharacterData}=await import('../scripts/data/character-data.js');
  const {NpcData}=await import('../scripts/data/npc-data.js');
  const {HitLocationData,CombatStyleData}=await import('../scripts/data/item-data.js');
  const character=CharacterData.defineSchema();
  for(const key of ['history','description','personality','motivation','goals','beliefs','siblings','parents','partner','children','extendedFamily','familyReputation','familyConnections','allies','contacts','rivals','enemies','secrets','notes']) assert.ok(character.narrative.fields[key],key);
  assert.ok(character.gallery.element.fields.src);assert.ok(character.gallery.element.fields.title);
  assert.ok(NpcData.defineSchema().currency.fields);
  const location=HitLocationData.defineSchema();assert.equal(location.nameKey.options.initial,'');assert.equal(location.nameKey.options.blank,true);assert.ok(location.permanentWound.fields.severity);
  const style=CombatStyleData.defineSchema();assert.ok(style.culturePoints);assert.equal(style.weapons,undefined);assert.equal(style.traits,undefined);
});

test("las hojas preparan permisos anatómicos, tooltip y métodos de creación",async t=>{
  const {document}=installHost(t);const {schemaDefaults}=await import('./helpers/ui.js');
  const {CharacterData}=await import('../scripts/data/character-data.js');const {NpcData}=await import('../scripts/data/npc-data.js');
  const {CharacterSheet}=await import('../scripts/sheets/character-sheet.js');const {NpcSheet}=await import('../scripts/sheets/npc-sheet.js');
  const {MythrasItemSheet}=await import('../scripts/sheets/item-sheet.js');
  for(const Sheet of [CharacterSheet,NpcSheet,MythrasItemSheet])assert.ok(Sheet.DEFAULT_OPTIONS.classes.includes('mythras-paper-sheet'));
  for(const [Sheet,Model,type]of [[CharacterSheet,CharacterData,'character'],[NpcSheet,NpcData,'npc']]){
    const actor=documentDouble({type,system:schemaDefaults(Model.defineSchema())});actor.system.attributes={magicPointsMax:10,luckPointsMax:2,damageModifier:{label:"0"}};actor.toObject=()=>({system:actor.system});
    const sheet=new Sheet({actor});sheet.element=document.body;
    for(const [editable,editMode,token]of [[true,true,false],[true,false,false],[false,true,false],[true,true,true]]){
      sheet.isEditable=editable;sheet._editMode=editMode;actor.isToken=token;
      const context=await sheet._prepareContext({});assert.equal(context.canManageMorphology,editable&&editMode&&(type==='character'||!token));
      assert.equal(context.canDeleteHitLocations,context.canManageMorphology);
      if(type==='character'){
        const html=render('templates/actor/character-sheet.hbs',context);const page=dom(html);t.after(()=>page.window.close());
        assert.equal(page.window.document.querySelectorAll('[data-mythras-tooltip]').length,Object.keys(context.attributeTooltips).length);
        assert.equal(context.generationMethods.length,4);
      }
    }
  }
});
