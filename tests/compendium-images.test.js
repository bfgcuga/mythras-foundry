import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ARMOR_SOURCES} from '../scripts/data/armor.js';
import {EQUIPMENT_SOURCES} from '../scripts/data/equipment.js';
import {WEAPON_SOURCES} from '../scripts/data/weapons.js';
import {defaultItemIcon} from '../scripts/data/item-icons.js';
const root=fileURLToPath(new URL('..',import.meta.url));
function localImage(source){
  assert.equal(typeof source.img,'string',source.name);
  assert.ok(source.img.startsWith('systems/mythras-foundry/'),`${source.name}: ${source.img}`);
  const file=resolve(root,source.img.slice('systems/mythras-foundry/'.length));const child=relative(root,file);
  assert.ok(!child.startsWith('..')&&!isAbsolute(child),source.img);assert.ok(existsSync(file),`${source.name}: ${source.img}`);
}
test('cada pieza anatómica tiene una ilustración local existente',()=>{
  assert.ok(ARMOR_SOURCES.length);for(const source of ARMOR_SOURCES){
    localImage(source);if(source.system.referenceLocation!=='special')assert.notEqual(source.img,defaultItemIcon('armor'),source.name);
  }
});
test('cada arma tiene una ilustración existente o la excepción explícita de Puño/Patada',()=>{
  assert.ok(WEAPON_SOURCES.length);for(const source of WEAPON_SOURCES){
    if(source.system.profileKey==='puno-patada'){assert.equal(source.img,'icons/svg/fist.svg');continue;}localImage(source);assert.notEqual(source.img,defaultItemIcon('weapon'),source.name);
  }
});
test('todo el equipo tiene ilustración local sin depender de una carpeta o cantidad fija',()=>{
  assert.ok(EQUIPMENT_SOURCES.length);for(const source of EQUIPMENT_SOURCES){localImage(source);assert.notEqual(source.img,defaultItemIcon(source.type),source.name);}
});
