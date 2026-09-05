import test, { after } from "node:test";
import assert from "node:assert/strict";
import postcss from "postcss";
import { css, dom } from "./helpers/ui.js";

const page = dom(`<div class="mythras-foundry mythras-paper-sheet"><div class="window-content">
<div class="sheet-header"><label>Nombre</label><input></div>
<input><select><option>Valor</option></select><textarea></textarea><output class="sheet-field-readonly">42</output>
<div class="item-sheet-content weapon-item-sheet"><fieldset><legend>Arma</legend><input class="sheet-field-editable"><textarea></textarea></fieldset></div>
<div class="item-sheet-content combat-style-item-sheet"><input></div><div class="homebrew-creator-content"><fieldset><legend>Crear</legend><textarea></textarea></fieldset></div>
<div class="skill-roll-modifier"><span>Origen</span><strong class="skill-roll-modifier-effect--penalty">-1</strong><strong class="skill-roll-modifier-effect--bonus">+1</strong></div>
<div class="catalog-header"></div><ul class="catalog-results"><li></li></ul>
<div class="inventory-tree-head"></div><div class="inventory-tree"><ul class="item-list"><li></li></ul></div>
<table class="penalties-table"><thead><tr><th>Fuente</th></tr></thead><tbody><tr><td>Dato</td></tr></tbody></table>
<div class="combat-location-head"><span></span><span>Localización</span></div><div class="combat-location-line"><span>d20</span></div>
<div class="mythras-foundry tactical-overview-menu"><table><thead><tr><th>Cabecera</th></tr></thead><tbody><tr><td>Dato</td></tr></tbody></table></div>
</div></div><li class="chat-message mythras-chat-message"><section class="mythras-chat-card"></section></li>`, css);
after(()=>page.window.close());
const element = selector => { const node=page.window.document.querySelector(selector); assert.ok(node,selector); return node; };
const style = selector => page.window.getComputedStyle(element(selector));
const transparent = selector => assert.equal(style(selector).backgroundColor,"rgba(0, 0, 0, 0)",selector);

test("las ventanas y mensajes tienen las capas compartidas de papel activas",()=>{
  for(const selector of [".window-content",".chat-message"]){
    assert.match(style(selector).backgroundImage,/--mythras-paper-overlay/);
    assert.match(style(selector).backgroundImage,/--mythras-paper-texture/);
  }
});
test("campos y recuadros conservan transparencia en cada tipo de hoja",()=>{
  for(const selector of [".window-content > input",".window-content > select",".window-content > textarea",".sheet-field-readonly",
    ".weapon-item-sheet input",".weapon-item-sheet textarea",".combat-style-item-sheet input",".homebrew-creator-content textarea",".item-sheet-content fieldset",".homebrew-creator-content fieldset"]) transparent(selector);
  const rules=postcss.parse(css); let border; rules.walkRules(rule=>{ if(rule.selectors?.includes(".mythras-foundry .item-sheet-content fieldset")) rule.walkDecls("border",decl=>border=decl.value); }); assert.equal(border?.split(/\s+/)[0],"1px");
});
test("origen y modificadores tienen estilos distintos en los elementos correspondientes",()=>{
  assert.match(style(".skill-roll-modifier > span").color,/mythras-ink/);
  assert.equal(style(".skill-roll-modifier-effect--penalty").color,"rgb(161, 36, 27)");
  assert.equal(style(".skill-roll-modifier-effect--bonus").color,"rgb(63, 113, 56)");
});
test("cabeceras y filas comparten cuadrícula en catálogo e inventario",()=>{
  for(const [header,row]of [[".catalog-header",".catalog-results li"],[".inventory-tree-head",".inventory-tree .item-list li"]]){
    assert.notEqual(style(header).gridTemplateColumns,"");
    assert.equal(style(header).gridTemplateColumns,style(row).gridTemplateColumns);
  }
});
test("la tabla de penalizaciones conserva tipografía y texto multilínea",()=>{
  assert.match(style(".penalties-table").fontSize,/mythras-font-size-table/);
  assert.equal(style(".penalties-table td").whiteSpace,"normal");
  transparent(".penalties-table td");
});
test("d20 y localización mantienen la alineación de su columna",()=>{
  assert.equal(style(".combat-location-head > span:nth-child(2)").textAlign,"left");
  assert.equal(style(".combat-location-line > span:first-child").textAlign,"center");
});
test("las tablas tácticas no añaden superficie y distinguen su cabecera",()=>{
  transparent(".tactical-overview-menu table");
  assert.equal(style(".tactical-overview-menu table").backgroundImage,"none");
  const active=postcss.parse(css);let background;active.walkRules(rule=>{if(rule.selectors?.includes(".mythras-foundry.tactical-overview-menu thead th"))rule.walkDecls("background-color",decl=>background=decl.value);});assert.equal(background,"var(--mythras-header-accent)");
});
test("el contrato de papel detecta CSS comentado y admite formato equivalente",()=>{
  const reformatted=postcss.parse(css).toResult({map:false}).css.replaceAll(": ",":  ");
  for(const [sheet,expected]of [[reformatted,true],[`/*${css.replaceAll("*/","* /")}*/`,false]]){
    const sample=dom('<div class="mythras-foundry"><div class="window-content"></div></div>',sheet);
    const background=sample.window.getComputedStyle(sample.window.document.querySelector('.window-content')).backgroundImage;
    assert.equal(background.includes("mythras-paper-texture"),expected);
    sample.window.close();
  }
});

test("pestañas activas e inactivas conservan superficies distintas en cada navegación",()=>{
  const sheet=postcss.parse(css);
  for(const [group,attribute]of [['sheet-tabs','data-tab'],['weapon-sheet-tabs','data-weapon-tab'],['combat-style-sheet-tabs','data-combat-style-tab'],['armor-sheet-tabs','data-armor-tab']]){
    const sample=dom(`<div class="mythras-foundry"><nav class="${group}"><button ${attribute}="one"></button><button class="active" ${attribute}="two"></button></nav></div>`);
    try{
      const backgrounds=[...sample.window.document.querySelectorAll('button')].map(button=>{
        let value;sheet.walkRules(rule=>{if(rule.selectors.some(selector=>button.matches(selector)))rule.nodes.filter(n=>n.type==='decl'&&n.prop==='background').forEach(n=>value=n.value);});return value;
      });
      assert.deepEqual(backgrounds,['var(--mythras-tab-inactive)','var(--mythras-paper)']);
    }finally{sample.window.close();}
  }
});

test("las cabeceras declaran tinta y borde propios sobre su superficie oscura",()=>{
  const sheet=postcss.parse(css);
  for(const type of ['character','npc']){
    const sample=dom(`<div class="mythras-foundry"><div class="${type}-sheet-content"><header class="sheet-header"><label>Nombre</label><input><button class="portrait-edit">Editar</button></header></div></div>`);
    try{
      for(const node of sample.window.document.querySelectorAll('label,input,button')){
        const declarations=[];sheet.walkRules(rule=>{if(rule.selectors.some(selector=>node.matches(selector)))declarations.push(...rule.nodes.filter(n=>n.type==='decl'));});
        assert.ok(declarations.some(d=>d.prop==='color'&&d.value==='var(--mythras-header-ink)'&&d.important));
        if(node.tagName!=='LABEL')assert.ok(declarations.some(d=>d.prop==='border-color'&&d.value==='var(--mythras-header-line)'));
      }
    }finally{sample.window.close();}
  }
});

test("cabecera y filas de pasiones comparten distribución y tamaño de tabla",()=>{
  const sample=dom('<div class="mythras-foundry"><div class="paper-passion-header"></div><div class="paper-passion-row"></div></div>',css);
  try{
    const [header,row]=[...sample.window.document.querySelectorAll('.paper-passion-header,.paper-passion-row')].map(n=>sample.window.getComputedStyle(n));
    assert.notEqual(header.gridTemplateColumns,'');assert.equal(header.gridTemplateColumns,row.gridTemplateColumns);assert.match(header.fontSize,/mythras-font-size-table/);
  }finally{sample.window.close();}
});
