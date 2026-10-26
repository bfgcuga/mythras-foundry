import test from "node:test";
import assert from "node:assert/strict";
import { render, dom, installHost, documentDouble } from "./helpers/ui.js";
const template="templates/item/item-sheet.hbs";
function rendered(t,path,context){ const page=dom(render(path,context));t.after(()=>page.window.close());return page.window.document; }

test("las hojas comparten una sola vista de Combate, Inventario y Estado",t=>{
  for(const type of ["character","npc"]){
    const doc=rendered(t,`templates/actor/${type}-sheet.hbs`,{actor:{system:{}},system:{},editable:true,inventorySections:[{id:"person",label:"Persona",editable:true}]});
    for(const tab of ["combat","inventory","penalties"]) assert.equal(doc.querySelectorAll(`[data-tab-content='${tab}']`).length,1);
    for(const action of ["buy-item","transfer-money"])assert.ok(doc.querySelector(`[data-tab-content='inventory'] [data-action='${action}']`),`${type}: ${action}`);
    for(const action of ["attack","changeReach","aim","reload","seekCover"])assert.equal(doc.querySelectorAll(`[data-combat-action-key='${action}']`).length,1);
    assert.match(doc.querySelector('[data-combat-action-key="seekCover"]').textContent, /Buscar cobertura/);
    assert.equal(doc.querySelectorAll('.combat-paper-locations').length,1);
    assert.ok(doc.querySelector("[data-tab-content='penalties'] .combat-paper-fatigue"));
    assert.equal(doc.querySelector("[data-tab-content='combat'] [data-fatigue-level]"),null);
  }
});
test("los paneles de Combate conservan el orden operativo en el DOM",t=>{
  const doc=rendered(t,"templates/actor/parts/combat-tab.hbs",{});
  const panels=[".combat-action-panel",".combat-paper-locations",".combat-paper-melee-weapons",".combat-paper-ranged-weapons",".combat-paper-styles"].map(selector=>{const el=doc.querySelector(selector);assert.ok(el,selector);return el;});
  for(let i=1;i<panels.length;i++)assert.ok(panels[i-1].compareDocumentPosition(panels[i])&4);
});
test("Interrumpir es la primera acción circunstancial y conserva el formato destacado",t=>{
  const doc=rendered(t,"templates/actor/parts/combat-tab.hbs",{});
  const actions=doc.querySelectorAll(".combat-tactical-actions [data-combat-action-key]");
  assert.equal(actions[0]?.dataset.combatActionKey,"interrupt");
  assert.ok(actions[0].classList.contains("sheet-action-attention"));
  assert.equal(actions[1]?.dataset.combatActionKey,"recoverImpaledWeapon");
});
test("los campos libres de características conservan valor y mínimo",t=>{
  const doc=rendered(t,"templates/actor/parts/characteristics.hbs",{isFreeAllocation:true,characteristicRows:[{key:"strength",label:"FUE",value:12,minimum:3}]});
  const field=doc.querySelector("input[name='system.strength']");assert.equal(field.value,"12");assert.equal(field.min,"3");assert.ok(field.classList.contains("sheet-field-editable"));
});
test("los controles de Estado reflejan bloqueo y permisos y la tabla es semántica",t=>{
  for(const editable of [true,false]){
    const doc=rendered(t,"templates/actor/parts/penalties-tab.hbs",{editable,hasActiveStatusControls:true,activeStatusControls:[{id:"blinded",label:"Cegado"},{id:"incapacitated",label:"Incapacitado",locked:true}],penalties:{hasRows:true,rows:[{label:"Fatiga",skills:"Difícil"}]}});
    assert.equal(doc.querySelector("[data-status-toggle='blinded']").disabled,!editable);assert.equal(doc.querySelector("[data-status-toggle='incapacitated']").disabled,true);
    assert.ok(doc.querySelector("thead th[scope='col']"));assert.equal(doc.querySelector("tbody th[scope='row']").textContent,"Fatiga");
  }
});
test("la ficha de arma envía una sola moneda y separa ejemplar de situación",t=>{
  const doc=rendered(t,template,{isWeapon:true,item:{actor:{},system:{currency:"sp",quantity:2,currentHitPoints:7}}});
  assert.equal(doc.querySelectorAll("[name='system.currency']").length,1);
  for(const key of ["quantity","currentHitPoints"])assert.ok(doc.querySelector(`.weapon-copy-editor [name='system.${key}']`));
  for(const key of ["activeModeKey","equipped"])assert.ok(doc.querySelector(`.weapon-situation-editor [name='system.${key}']`));
  assert.ok(doc.querySelector("[data-action='view-item-image']"));
  assert.ok(doc.querySelector(".weapon-modes-toolbar .sheet-add-button"));
});
test("la ficha de estilo conserva asociaciones y cálculo no editable",t=>{
  const doc=rendered(t,template,{isSkillLike:true,isCombatStyle:true,item:{system:{}},combatStyleWeaponProfiles:[{name:"Lanza"}],combatStyleTraitReferences:[{name:"Montado"}]});
  const summary=[...doc.querySelectorAll('.combat-style-name-summary')].map(el=>el.textContent);assert.deepEqual(summary,["Lanza","Montado"]);
  assert.ok(doc.querySelector("[data-combat-style-tab-content='calculation'] output.sheet-field-readonly"));
  for(const key of ["weapons","traits","bonus"])assert.equal(doc.querySelector(`[name='system.${key}']`),null);
});
test("la tabla de localizaciones muestra PG actuales y controles de anatomía según contexto",t=>{
  for(const allowed of [true,false]){
    const doc=rendered(t,"templates/actor/parts/hit-location-table.hbs",{canManageMorphology:allowed,canApplyMorphology:allowed,table:{rows:[{item:{id:"arm",system:{currentHitPoints:-2}},displayName:"Brazo"}]}});
    assert.equal(Boolean(doc.querySelector("[data-action='apply-morphology']")),allowed);
    assert.match(doc.body.textContent,/Brazo/);
    assert.equal(doc.querySelector(".location-current").textContent,"-2");
  }
});

test("los modos de arma renderizan sus campos y parámetros de rasgo",t=>{
  for(const type of ['melee','ranged','siege']){
    const mode={key:type,modeIndex:0,displayName:type,isRanged:type==='ranged',isSiege:type==='siege',traitReferences:[{uuid:'trait',key:'test',name:'Rasgo',referenceIndex:0,parameters:[{label:'Nivel',parameterIndex:0,value:3}]}]};
    const doc=rendered(t,template,{isWeapon:true,editable:true,item:{system:{}},weaponModes:[mode],weaponDurabilityHelp:'La localización determina la durabilidad'});
    assert.ok(doc.querySelector(`.weapon-mode-fields-${type}`));assert.equal(doc.querySelectorAll('.weapon-mode-fields').length,1);
    assert.equal(doc.querySelector('[name="system.modes.0.traitRefs.0.parameters.0.value"]').value,'3');
    const trait=doc.querySelector('[data-action=select-weapon-trait]');assert.ok(trait.querySelector('.fa-tag'));assert.equal(trait.classList.contains('sheet-add-button'),false);
    assert.match(doc.querySelector('.weapon-advanced-help').textContent,/localización/);
  }
});
test("las referencias rotas se muestran solo en las filas afectadas de cada vista",t=>{
  for(const broken of [true,false]){
    const entry={name:'Espada',displayName:'Espada',brokenLocationReference:broken,item:{id:'sword',name:'Espada',system:{}}};
    for(const [path,context] of [['inventory-tree',{items:[entry]}],['inventory-list',{items:[entry],weaponTable:true}],['combat-tab',{meleeCombatWeapons:[entry]}]]){
      const doc=rendered(t,`templates/actor/parts/${path}.hbs`,context);
      const button=doc.querySelector('[data-action=edit-item]');assert.ok(button,path);assert.equal(button.classList.contains('broken-location-reference'),broken);
      if(broken)assert.ok(button.title);
    }
  }
});
test("la hoja de efecto mantiene descripción antes de resumen y tabla accesible",t=>{
  const doc=rendered(t,template,{isCombatEffect:true,item:{system:{tableColumns:['Localización','Valor'],tableRows:[['Brazo','3']]}},combatEffectHasTable:true});
  const description=doc.querySelector('.combat-effect-sheet-description'),summary=doc.querySelector('.combat-effect-sheet-summary');assert.ok(description.compareDocumentPosition(summary)&4);
  assert.equal(doc.querySelectorAll('thead th[scope=col]').length,2);assert.equal(doc.querySelector('tbody th[scope=row]').textContent.trim(),'Brazo');
});


test('la celda de recarga muestra progreso y munición con abreviaturas y etiquetas accesibles', t => {
  const doc = rendered(t, 'templates/actor/parts/combat-tab.hbs', { rangedCombatWeapons: [{
    item: { id: 'bow' }, mode: { key: 'ranged', reload: '99', reloadActions: 2 },
    ammunition: { tracking: true, name: 'Flechas', total: 20, loaded: 0, available: 20, completedActions: 1, actions: 2 },
    styleOptions: []
  }] });
  const cell = doc.querySelector('[data-item-id="bow"] .combat-reload-status');
  assert.deepEqual([...cell.children].map(element => element.textContent), ['1/2 Acc.', '20 Munic']);
  assert.ok([...cell.children].every(element => element.title && element.getAttribute('aria-label')));
  assert.doesNotMatch(cell.textContent, /Flechas|Total|Cargada|Disponible|99|Â/);
});


test("la consulta del arma presenta textos de selectores y permite activar edición", async t => {
  const { document } = installHost(t);
  const { MythrasItemSheet } = await import("../scripts/sheets/item-sheet.js");
  document.body.innerHTML = render(template, { isWeapon: true, editable: true,
    item: { system: { era: "A-I", inoperable: true, lodged: true, thrown: true } },
    weaponActiveStates: ["Empalada en un rival: no está disponible."],
    weaponEraChoices: [{ value: "A-I", label: "Antigüedad–Era industrial" }],
    weaponModes: [{ weaponType: "melee", isMelee: true, damage: "1d8" }],
    weaponTypeChoices: [{ value: "melee", label: "Cuerpo a cuerpo" }] });
  const sheet = new MythrasItemSheet({ document: { type: "weapon" } });
  sheet.item = { type: "weapon" };
  sheet.setPosition = () => {};
  const editableMarkup = document.body.innerHTML;
  sheet._onRender({}, {});
  const panel = document.querySelector('[data-weapon-tab-content="modes"]');
  assert.ok(panel.classList.contains("weapon-consultation"));
  assert.equal(panel.querySelector("select").nextElementSibling.textContent, "Cuerpo a cuerpo");
  assert.equal(panel.querySelector("input").nextElementSibling.textContent, "—");
  panel.querySelector('[data-action="toggle-weapon-edit"]').click();
  assert.equal(sheet._weaponEditing.modes, true);
  assert.equal(sheet._weaponEditing.instance, undefined);
  assert.ok(document.querySelector('[data-weapon-tab-content="instance"]').classList.contains("weapon-consultation"));
  assert.ok(document.querySelector(".weapon-state-help"));
  assert.equal(document.querySelector(".weapon-state-help").open, false);
  assert.ok(document.querySelector('[name="system.inoperable"]').checked);
  const era = document.querySelector('select[name="system.era"]');
  assert.equal(era.value, "A-I");
  assert.equal(era.nextElementSibling.textContent, "Antigüedad–Era industrial");
  assert.match(document.querySelector(".weapon-active-states").textContent, /Empalada/);
  const configuration = document.querySelector('[data-weapon-tab-content="instance"]');
  const inoperable = configuration.querySelector('[name="system.inoperable"]');
  assert.equal(inoperable.disabled, true);
  assert.equal(inoperable.nextElementSibling, null);
  assert.doesNotMatch(inoperable.closest("label").textContent, /Sí|No/);
  configuration.querySelector('[data-action="toggle-weapon-edit"]').click();
  assert.equal(sheet._weaponEditing.instance, true);
  document.body.innerHTML = editableMarkup;
  sheet._onRender({}, {});
  assert.equal(document.querySelector('[name="system.inoperable"]').disabled, false);
  assert.equal(document.querySelector('[name="system.inoperable"]').checked, true);
  assert.equal(document.querySelector('[data-weapon-tab-content="instance"]').classList.contains("weapon-consultation"), false);
  for (const name of ["thrown", "lodged"]) {
    assert.equal(document.querySelector(`.weapon-status-editor [name="system.${name}"]`), null);
  }
});
