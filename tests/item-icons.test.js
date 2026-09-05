import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {ITEM_TYPE_ICONS,defaultItemIcon} from '../scripts/data/item-icons.js';
import {installHost} from './helpers/ui.js';

test('todos los tipos de Item realmente registrados tienen icono predeterminado',async t=>{
  installHost(t);CONFIG.Actor.dataModels={};CONFIG.Item.dataModels={};
  game.settings.register=()=>{};game.settings.registerMenu=()=>{};
  foundry.documents={collections:{Actors:{registerSheet:()=>{}},Items:{registerSheet:()=>{}}}};
  globalThis.loadTemplates=async()=>{};t.after(()=>delete globalThis.loadTemplates);
  let init;Hooks.once=(event,callback)=>{if(event==='init')init=callback;};
  const {registerSystemInitialization}=await import('../scripts/system/registration.js');registerSystemInitialization();await init();
  assert.deepEqual(Object.keys(ITEM_TYPE_ICONS).sort(),Object.keys(CONFIG.Item.dataModels).sort());
  for(const type of Object.keys(CONFIG.Item.dataModels)){
    const icon=defaultItemIcon(type);assert.ok(icon);assert.match(icon,/\.svg$/);
    if(icon.startsWith('systems/mythras-foundry/'))assert.ok(existsSync(new URL(icon.replace('systems/mythras-foundry/','../'),import.meta.url)),icon);
    else assert.ok(icon.startsWith('icons/'),icon);
  }
  assert.notEqual(defaultItemIcon('skill'),defaultItemIcon('passion'));assert.notEqual(defaultItemIcon('culture'),defaultItemIcon('profession'));
});
