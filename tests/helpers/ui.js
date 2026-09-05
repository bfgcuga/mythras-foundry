import fs from "node:fs";
import Handlebars from "handlebars";
import { JSDOM } from "jsdom";

export const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
export const css = read("styles/mythras-foundry.css");
export const es = JSON.parse(read("lang/es.json"));
const hbs = Handlebars.create();
hbs.registerHelper("localize", (key) => es[key] ?? key);
hbs.registerHelper("checked", (value) => value ? "checked" : "");
hbs.registerHelper("selectOptions", (choices, { hash }) => new hbs.SafeString(
  (Array.isArray(choices) ? choices : Object.entries(choices ?? {}).map(([value, label]) => ({ value, label })))
    .map((entry) => { const value = entry[hash.valueAttr ?? "value"]; const label = entry[hash.labelAttr ?? "label"];
      return `<option value="${hbs.escapeExpression(value)}" ${String(hash.selected) === String(value) ? "selected" : ""}>${hbs.escapeExpression(label)}</option>`; }).join("")));
for (const file of fs.readdirSync(new URL("../../templates/actor/parts/", import.meta.url))) {
  hbs.registerPartial(`systems/mythras-foundry/templates/actor/parts/${file}`, read(`templates/actor/parts/${file}`));
}
export function render(path, context = {}) { return hbs.compile(read(path))(context); }
export function dom(html, stylesheet = "") {
  return new JSDOM(`<!doctype html><html><head><style>${stylesheet}</style></head><body>${html}</body></html>`);
}
export function collection(entries = []) {
  const list = [...entries];
  list.get = (id) => list.find((entry) => entry.id === id);
  return list;
}
export function setPath(object, path, value) {
  const keys = path.split("."); const last = keys.pop();
  const target = keys.reduce((current, key) => current[key] ??= {}, object); target[last] = value;
}
export function documentDouble(data = {}) {
  const doc = { id: "actor", uuid: "Actor.actor", type: "character", isOwner: true,
    name: "Personaje", system: {}, items: collection(), effects: [], statuses: new Set(), ...data };
  doc.getFlag = (scope, key) => doc.flags?.[scope]?.[key];
  doc.updates = [];
  doc.update = async (change) => { doc.updates.push(change); for (const [key,value] of Object.entries(change)) setPath(doc,key,value); return doc; };
  doc.createEmbeddedDocuments = async (type, sources) => sources.map((source) => {
    const item = documentDouble({ ...source, id: `item-${doc.items.length}` });
    item.sheet = { render: () => { item.opened = true; } }; doc.items.push(item); return item;
  });
  doc.updateEmbeddedDocuments = async (type, changes) => Promise.all(changes.map(({_id,...change})=>doc.items.get(_id).update(change)));
  doc.deleteEmbeddedDocuments = async (type, ids) => { doc.items.splice(0,doc.items.length,...doc.items.filter(item=>!ids.includes(item.id))); };
  return doc;
}
// Doubles only for the host boundaries. Production rules, templates, controllers
// and schema declarations run unchanged; these fields do not emulate Foundry validation.
export function installHost(t, html = "") {
  const page = dom(html);
  const original = new Map();
  const put = (key,value) => { original.set(key,Object.getOwnPropertyDescriptor(globalThis,key)); Object.defineProperty(globalThis,key,{value,writable:true,configurable:true}); };
  class Field { constructor(options={}) { this.options=options; } }
  class SchemaField extends Field { constructor(fields,options={}) { super(options); this.fields=fields; } }
  class ArrayField extends Field { constructor(element,options={}) { super(options); this.element=element; } }
  class Sheet { constructor({ actor, document=actor }={}) { this.actor=actor??document; this.document=document; this.isEditable=true; this.element=globalThis.document.body; }
    _onRender() {} async _prepareContext() { return {}; } render() {} }
  const mergeObject=(a,b)=>{const result=structuredClone(a);for(const [k,v]of Object.entries(b)){result[k]=v&&typeof v==='object'&&!Array.isArray(v)?mergeObject(result[k]??{},v):v;}return result;};
  const foundry={ utils: {escapeHTML:hbs.escapeExpression,deepClone:structuredClone,mergeObject,randomID:()=>"test-id"},
    data:{fields:{StringField:Field,HTMLField:Field,BooleanField:Field,NumberField:Field,SchemaField,ArrayField}},
    abstract:{TypeDataModel:class {}}, applications:{sheets:{ActorSheetV2:Sheet,ItemSheetV2:Sheet},
      api:{ApplicationV2:Sheet,HandlebarsApplicationMixin:(base)=>base,DialogV2:{wait:async()=>null,input:async()=>null,confirm:async()=>false}},
      apps:{FilePicker:class {},ImagePopout:class {}}}};
  for(const key of ["window","document","HTMLElement","MouseEvent","Event","Node","HTMLInputElement"]) put(key,page.window[key]);
  put("foundry",foundry);
  put("game",{user:{id:"gm",isGM:true},i18n:{lang:"es",localize:key=>es[key]??key,format:(key,data)=>Object.entries(data??{}).reduce((s,[k,v])=>s.replaceAll(`{${k}}`,v),es[key]??key)},settings:{get:()=>undefined},actors:collection(),packs:collection(),combats:collection(),mythrasFoundry:{party:{getActiveParty:()=>({memberIds:["actor"]})}}});
  put("canvas",{tokens:{placeables:[],controlled:[]}});
  put("ui",{notifications:{warn:()=>{},error:(message)=>{throw Error(message);}}});
  put("Hooks",{on:()=>{},once:()=>{}});
  for(const key of ["Actor","Item","Combat","Combatant","ActiveEffect"]) put(key,class {});
  put("CONFIG",{Actor:{},Item:{},Combat:{},statusEffects:[]});
  t.after(()=>{page.window.close();for(const [key,descriptor]of original){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  return {page,foundry,document:page.window.document,window:page.window};
}
export async function clickAndWait(button, options={}) {
  button.dispatchEvent(new button.ownerDocument.defaultView.MouseEvent("click",{bubbles:true,...options}));
  await new Promise(resolve=>setImmediate(resolve));
}

export function schemaDefaults(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key,field])=>[key,field.fields?schemaDefaults(field.fields):typeof field.options.initial==='function'?field.options.initial():structuredClone(field.options.initial)]));
}
