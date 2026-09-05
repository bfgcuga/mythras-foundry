import test from "node:test";
import assert from "node:assert/strict";
import { evaluatedDamageExpression } from "../scripts/rules/combat-damage-display.js";

test("muestra los resultados individuales de arma y bonificador", () => {
  const roll = { dice: [
    { results: [{ result: 6, active: true }] },
    { results: [{ result: 2, active: true }] }
  ] };
  assert.equal(evaluatedDamageExpression(roll, ["1d8 + 1", "-1d2", "0"]), "6 + 1 - 2");
});

test("expande varios dados y conserva el daño extraordinario", () => {
  const roll = { dice: [
    { results: [{ result: 3 }, { result: 5 }] },
    { results: [{ result: 2 }] }
  ] };
  assert.equal(evaluatedDamageExpression(roll, ["2d6", "0", "1d4 + 1"]),
    "(3 + 5) + 0 + 2 + 1");
});

test("la tarjeta destaca únicamente los dados de arma maximizados",async t=>{
  const {installHost,dom}=await import('./helpers/ui.js');installHost(t);
  const {renderCombatExchange}=await import('../scripts/rules/combat-chat-renderer.js');
  for(const maximizedWeaponDice of [0,1]){
    const combat={status:'resolved',attacker:{},defender:{},damage:{status:'rolled',targetType:'weapon',weaponFormula:'1d8 + 1',weaponFormulaParts:[{text:'8',maximized:true},{text:' + 1'}],maximizedWeaponDice,rawRoll:9}};
    const page=dom(renderCombatExchange(combat));t.after(()=>page.window.close());
    const marks=[...page.window.document.querySelectorAll('.combat-damage-maximized')];
    assert.equal(marks.length,maximizedWeaponDice?2:0);
    if(maximizedWeaponDice)assert.equal(marks.at(-1).textContent,'8');
  }
});
