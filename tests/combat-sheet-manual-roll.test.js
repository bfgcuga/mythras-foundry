import test from "node:test";
import assert from "node:assert/strict";
import { installHost, collection, documentDouble, clickAndWait } from "./helpers/ui.js";

test("el selector transmite Shift a la tirada real y cancelar no ataca",async t=>{
  const {document}=installHost(t,`<div data-item-id="sword" data-mode-key="melee"><select data-combat-style><option value="__untrained__">Sin entrenamiento</option></select><span data-action="edit-item">Espada</span><button data-action="roll-weapon-attack"></button></div>`);
  const requests=[];
  t.mock.module('../scripts/rules/combat-chat.js',{exports:{createAttackMessage:async request=>requests.push(request)}});
  const {CombatSheetController}=await import('../scripts/ui/combat-sheet.js');
  const weapon={id:'sword',type:'weapon',name:'Espada',system:{equipped:true,activeModeKey:'melee',currentHitPoints:8,maxHitPoints:8,modes:[{key:'melee',weaponType:'melee',profileKey:'espada',damage:'1d8',familiarity:'untrained'}]}};
  const actor=documentDouble({items:collection([weapon]),system:{strength:12,dexterity:11}});
  const controller=new CombatSheetController({actor,element:document.body,isEditable:true},{resolveSituationalDifficulty:async d=>d});controller.bind();
  foundry.applications.api.DialogV2.wait=async()=>0;
  for(const shiftKey of [true,false]){await controller.chooseWeaponAttack({shiftKey});await new Promise(r=>setImmediate(r));assert.equal(requests.at(-1)?.manual,shiftKey);assert.equal(requests.at(-1)?.weapon,weapon);}
  assert.equal(requests.length,2);foundry.applications.api.DialogV2.wait=async()=>null;
  await controller.chooseWeaponAttack({shiftKey:true});assert.equal(requests.length,2);
});
