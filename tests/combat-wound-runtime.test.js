import test from "node:test";
import assert from "node:assert/strict";
import { applyCombatWoundConsequences, heldCombatItemChoices
} from "../scripts/rules/combat-wound-runtime.js";

test("las opciones de soltar incluyen únicamente armas equipadas que ocupan manos", () => {
  const actor = { items: [{ id: "sword", name: "Espada", type: "weapon", img: "sword.png",
    system: { equipped: true, activeModeKey: "one", modes: [{ key: "one", handsRequired: 1 }] } },
  { id: "pack", name: "Mochila", type: "equipment", system: { equipped: true } }] };
  assert.deepEqual(heldCombatItemChoices(actor),
    [{ id: "sword", name: "Espada", img: "sword.png" }]);
});

test("una herida grave aplica exactamente aturdimiento, inutilización y elección del objeto", async () => {
  const combat = {damage:{resultingWound:"serious",penetratingDamage:4},effects:{checks:[{id:"wound-arm",source:"wound",status:"resolved",resolution:{winner:"right"}}]},consequences:[]};
  const defender={system:{attributes:{healingRate:2}},items:[{id:"sword",name:"Espada",type:"weapon",system:{equipped:true,modes:[{key:"melee",handsRequired:1}]}}]};
  const changes=[];const location={id:"arm",name:"Brazo",system:{category:"limb",hpClass:"arm"},async update(change){changes.push(change);}};
  const statuses=[],formulas=[];
  assert.equal(await applyCombatWoundConsequences(combat,defender,location,{evaluateRoll:async formula=>{formulas.push(formula);return {total:2};},addStatus:async(c,e,status)=>statuses.push(status),applyDying:async()=>assert.fail("No debe agonizar"),applyDeath:async()=>assert.fail("No debe morir")}),true);
  assert.deepEqual(formulas,["1d3"]);assert.deepEqual(changes,[{"system.disabled":true}]);assert.deepEqual(statuses,[{key:"stunned",statusId:"stunned",turns:2,locationId:"arm"}]);
  assert.equal(combat.consequences.length,1);assert.equal(combat.consequences[0].key,"dropHeldItem");assert.deepEqual(combat.consequences[0].itemChoices.map(i=>i.id),["sword"]);
});
