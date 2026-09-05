import test from 'node:test';
import assert from 'node:assert/strict';
import {installHost,documentDouble,collection,dom,clickAndWait} from './helpers/ui.js';
import {renderTacticalOverview,openTacticalOverview} from '../scripts/rules/reach-chat.js';
function encounter(){
  const sword={id:'sword',type:'weapon',name:'Espada',system:{equipped:true,activeModeKey:'melee',modes:[{key:'melee',weaponType:'melee',reach:'M'}]}};
  const bow={id:'bow',type:'weapon',name:'Arco',system:{equipped:true,modes:[{key:'ranged',weaponType:'ranged',reach:'L'}]}};
  const spare={...sword,id:'spare',name:'Reserva',system:{...sword.system,equipped:false}};
  const actor=documentDouble({items:collection([sword,bow,spare])});
  const fighter={id:'fighter',actor};const rival={id:'rival',actor:documentDouble({id:'enemy',name:'Enemigo',items:collection([sword])})};
  const relation={status:'engaged',position:'neutral',sides:{fighter:{combatantId:'fighter',weaponId:'sword',modeKey:'melee',weaponName:'Espada'},rival:{combatantId:'rival',weaponId:'sword',modeKey:'melee',weaponName:'Espada'}}};
  let state={revision:1,relations:{live:relation,removed:{...relation,status:'removed'}},passiveBlocks:{fighter:{combatantId:'fighter',status:'active',locationIds:[]}},covers:{fighter:{combatantId:'fighter',status:'active',locationIds:[],source:'Muro',protection:3}}};
  return {combatants:collection([fighter,rival]),getFlag:()=>state,setFlag:async(scope,flag,value)=>{state=value;}};
}
test('el menú filtra relaciones retiradas y armas no preparadas para melé',t=>{
  installHost(t);const combat=encounter();const page=dom(renderTacticalOverview(combat));t.after(()=>page.window.close());const doc=page.window.document;
  assert.equal(doc.querySelectorAll('[data-relation-row]').length,1);assert.equal(doc.querySelector('[data-relation-row]').dataset.relationRow,'live');
  assert.deepEqual([...doc.querySelector('[name=rowLeftWeapon]').options].map(o=>o.value),['sword|melee']);
  for(const button of doc.querySelectorAll('button')){assert.equal(button.type,'button');assert.ok(button.title||button.getAttribute('aria-label')||button.textContent.trim());}
});
test('el menú distingue permisos de DJ, propietario y observador',t=>{
  installHost(t);for(const [gm,owner]of [[true,false],[false,true],[false,false]]){
    game.user.isGM=gm;const combat=encounter();combat.combatants[0].actor.isOwner=owner;
    const page=dom(renderTacticalOverview(combat));t.after(()=>page.window.close());const doc=page.window.document;
    assert.equal(doc.querySelector('[data-tactical-action=remove-relation]').disabled,!gm);
    for(const action of ['deactivate-block','save-cover-row','remove-cover-row'])assert.equal(doc.querySelector(`[data-tactical-action=${action}]`).disabled,!(gm||owner));
  }
});
test('el botón de retirar relación modifica el encuentro y refresca sin cerrar la ventana',async t=>{
  const {document}=installHost(t);game.combat=encounter();ui.notifications.info=()=>{};
  foundry.applications.api.DialogV2.wait=async config=>{
    document.body.innerHTML=`<form>${config.content}</form>`;const dialog={element:document.body, window:{content:document.body}};config.render(null,dialog);
    assert.equal(config.window.resizable,true);assert.deepEqual(config.buttons.map(b=>b.action),['close']);
    const reference=document.querySelector('details');reference.open=true;
    await clickAndWait(document.querySelector('[data-tactical-action=remove-relation]'));
    assert.equal(game.combat.getFlag().relations.live.status,'removed');assert.equal(document.querySelectorAll('[data-relation-row]').length,0);assert.equal(document.querySelector('details').open,true);
  };
  await openTacticalOverview();
});
