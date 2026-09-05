import test from "node:test";
import assert from "node:assert/strict";
import { installHost,render,documentDouble,clickAndWait } from './helpers/ui.js';

test("la galería renderiza sus datos y ejecuta añadir, abrir y eliminar",async t=>{
  const {document}=installHost(t);
  const actor=documentDouble({system:{gallery:[{src:'worlds/test/old.png',title:'Anterior'}]}});
  game.world={id:'test'};
  foundry.applications.apps.FilePicker=class {constructor(config){this.config=config;}async browse(){await this.config.callback('worlds/test/nueva-imagen.png');}};
  const opened=[];foundry.applications.apps.ImagePopout=class {constructor(config){opened.push(config);}render(){}};
  const {CharacterSheet}=await import('../scripts/sheets/character-sheet.js');
  document.body.innerHTML=render('templates/actor/parts/gallery-tab.hbs',{editable:true,gallery:actor.system.gallery});
  const sheet=new CharacterSheet({actor});sheet._onRender({},{});
  await clickAndWait(document.querySelector('[data-action=add-gallery-image]'));
  assert.deepEqual(actor.system.gallery,[{src:'worlds/test/old.png',title:'Anterior'},{src:'worlds/test/nueva-imagen.png',title:'nueva imagen'}]);
  await clickAndWait(document.querySelector('[data-action=view-gallery-image]'));assert.equal(opened[0].src,'worlds/test/old.png');
  await clickAndWait(document.querySelector('[data-action=remove-gallery-image]'));assert.equal(actor.system.gallery.length,1);assert.equal(actor.system.gallery[0].title,'nueva imagen');
});
