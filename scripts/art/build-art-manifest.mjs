import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const files=['bestiary-regions.json','bestiary-second-regions.json','bestiary-third-regions.json','bestiary-fourth-regions.json'];
const entries=files.flatMap(file=>JSON.parse(readFileSync(new URL(file,import.meta.url),'utf8')).filter(r=>r.asignada!==false));
const registry=Object.fromEntries(entries.map(r=>[r.nombre,'systems/mythras-foundry/'+r.archivo]));
const moduleText='// User-supplied illustrations. The same asset serves portrait, compendium thumbnail and token.\n'
+'export const CREATURE_ART = Object.freeze('+JSON.stringify(registry,null,2)+');\n\n'
+'export function withCreatureArt(source) {\n'
+'  const family = source.name.replace(/ \\((?:\\d+ m³|TAM \\d+)\\)$/, \"\");\n'
+'  const img = CREATURE_ART[family];\n'
+'  if (!img) return source;\n'
+'  return { ...source, img, prototypeToken: { ...source.prototypeToken,\n'
+'    texture: { ...source.prototypeToken.texture, src: img } } };\n'
+'}\n';
writeFileSync(new URL('../data/creature-art.js',import.meta.url),moduleText);
console.log(`Registered ${entries.length} illustrations.`);

const descriptions=JSON.parse(readFileSync(new URL("creature-descriptions.json",import.meta.url),"utf8").replace(/^\uFEFF/,""));
const output=new URL("../../output/",import.meta.url);
mkdirSync(output,{recursive:true});
writeFileSync(new URL("criaturas-imagenes-pendientes.json",output),JSON.stringify(descriptions.filter(row=>!registry[row.nombre]),null,2)+"\n");
