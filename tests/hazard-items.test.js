import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAP_SOURCES, POISON_SOURCES, DISEASE_SOURCES } from "../scripts/data/hazard-items.js";
import { hazardActors, hazardProfile, resolveHazardContest, trapDamageReference,
  TRAP_DAMAGE_TABLE } from "../scripts/rules/hazard-items.js";
import { deterministicPackId } from "../scripts/dev/pack-ids.mjs";
import { buildHomebrewItem } from "../scripts/rules/homebrew-items.js";
import { installHost, schemaDefaults, render, dom, documentDouble, clickAndWait }
  from "./helpers/ui.js";

const sources = [...TRAP_SOURCES, ...POISON_SOURCES, ...DISEASE_SOURCES];

test("los nueve ejemplos conservan potencia, daño, aparición y excepciones del manual", () => {
  assert.deepEqual(sources.map((entry) => entry.name), ["Techo aplastante", "Foso", "Trampa de venablo",
    "Pócima somnífera", "Polvo de loto", "Veneno de cobra", "Pirohoxia", "Succión del alma", "Viruela roja"]);
  assert.deepEqual(TRAP_SOURCES.map(({ system }) => [system.difficulty, system.damage, system.armorIgnored]),
    [[80, "2d8", true], [60, "2d6", true], [75, "2d8", false]]);
  assert.deepEqual(POISON_SOURCES.map(({ system }) => system.potency), [60, 90, 75]);
  assert.deepEqual(DISEASE_SOURCES.map(({ system }) => system.potency), [80, 65, 50]);
  const cobra = POISON_SOURCES[2];
  assert.match(cobra.system.cure, /permanente/);
  assert.equal(cobra.system.variants[0].onset, "Instantáneo");
  assert.equal(cobra.system.variants[1].onset, "1d6+4 minutos");
  assert.match(cobra.system.stages[2].onset, /1d6\+6 horas/);
  assert.match(cobra.system.stages[3].effect, /permanentemente 1 PG\/día/);
  assert.match(POISON_SOURCES[1].system.variants[1].effect, /coma interminable/);
  assert.match(DISEASE_SOURCES[1].system.effect, /1 punto por día/);
  assert.match(DISEASE_SOURCES[2].system.stages[1].effect, /no recuperable/);
  for (const source of sources) {
    assert.ok(source.system.description.length > 600, source.name);
    assert.match(source.system.source, /pág\./);
    assert.match(deterministicPackId(`${source.type}.${source.buildKey}`), /^[a-f0-9]{16}$/);
    assert.equal(buildHomebrewItem(source.type, { name: source.name }).type, source.type);
  }
  const manifest = JSON.parse(readFileSync(new URL("../system.json", import.meta.url)));
  for (const type of ["trap", "poison", "disease"]) assert.ok(type in manifest.documentTypes.Item);
  for (const name of ["traps", "poisons", "diseases"]) assert.ok(manifest.packs.some((pack) => pack.name === name));
});

test("la tabla de daño cubre todos los límites sin extrapolar valores fuera de 1-100", () => {
  for (const row of TRAP_DAMAGE_TABLE) {
    assert.equal(trapDamageReference(row[0]), row);
    assert.equal(trapDamageReference(row[1]), row);
  }
  assert.equal(trapDamageReference(0), null);
  assert.equal(trapDamageReference(101), null);
});

test("las enfrentadas usan grados, desempate, fallo mutuo y penalización compartida", () => {
  const resolve = (actorRoll, hazardRoll, actorTarget = 80, hazardTarget = 60) =>
    resolveHazardContest({ actorTarget, hazardTarget, actorRoll, hazardRoll });
  assert.equal(resolve(7, 50).comparisons[0].winnerId, "actor");
  assert.equal(resolve(40, 50).comparisons[0].winnerId, "hazard");
  assert.equal(resolve(40, 40).comparisons[0].reason, "exactTie");
  assert.equal(resolve(90, 95).comparisons[0].reason, "mutualFailure");
  assert.equal(resolve(90, 95).comparisons[0].repeatable, true);
  const above = resolve(50, 40, 150, 120);
  assert.equal(above.penalty, 50);
  assert.deepEqual(above.participants.map((entry) => entry.target), [100, 70]);
});

test("las variantes mantienen su perfil y las etapas compartidas sin mutar el Item", () => {
  const item = structuredClone(POISON_SOURCES[2]);
  const before = structuredClone(item);
  const profile = hazardProfile(item, 1);
  assert.equal(profile.application, "Inyectado");
  assert.equal(profile.potency, 75);
  assert.equal(profile.stages, item.system.stages);
  assert.deepEqual(item, before);
  assert.equal(hazardProfile(item, -1), item.system);
});

test("solo se ofrecen personajes controlables y se conservan PNJ sintéticos distintos", () => {
  const a = { uuid: "Actor.a", isOwner: true, type: "character" };
  const b = { uuid: "Scene.s.Token.b.Actor.b", isOwner: true, type: "npc" };
  assert.deepEqual(hazardActors([a, { uuid: "Actor.hidden", isOwner: false, type: "npc" }],
    [{ actor: a }, { actor: b }]), [a, b]);
});

test("el modelo persiste perfiles completos, variantes y etapas editadas como arrays", async (t) => {
  const { foundry } = installHost(t);
  foundry.utils.expandObject = (flat) => {
    const expanded = {};
    for (const [path, value] of Object.entries(flat)) {
      const parts = path.split("."); const key = parts.pop();
      const target = parts.reduce((current, part) => current[part] ??= {}, expanded);
      target[key] = value;
    }
    return expanded;
  };
  const { HazardData } = await import("../scripts/data/item-data.js");
  const { HazardItemSheet } = await import("../scripts/sheets/hazard-item-sheet.js");
  const defaults = schemaDefaults(HazardData.defineSchema());
  assert.deepEqual(defaults.variants, []);
  assert.deepEqual(defaults.stages, []);
  for (const type of ["trap", "poison", "disease"]) {
    const item = documentDouble({ type, system: structuredClone(defaults) });
    const sheet = { item };
    await HazardItemSheet._onSubmitForm.call(sheet, null, null, { object: {
      name: "Editado", "system.variants.0.name": "Contacto",
      "system.variants.0.onset": "Instantáneo", "system.stages.0.name": "Secuela",
      "system.stages.0.effect": "Permanente" } });
    assert.ok(Array.isArray(item.system.variants));
    assert.equal(item.system.variants[0].onset, "Instantáneo");
    assert.equal(item.system.stages[0].effect, "Permanente");
    item.isOwner = false;
    await HazardItemSheet._onSubmitForm.call(sheet, null, null, { object: { name: "No permitido" } });
    assert.equal(item.updates.length, 1);
  }
});

test("la hoja muestra campos accesibles, variantes, etapas y referencias localizadas", async (t) => {
  installHost(t);
  const { hazardFields } = await import("../scripts/sheets/hazard-item-sheet.js");
  for (const source of sources) {
    const trap = source.type === "trap";
    const html = render("templates/item/hazard-item-sheet.hbs", {
      item: source, itemName: source.name, editable: true, isTrap: trap,
      hazardFields: hazardFields(source.system, "system", { trap }),
      hazardVariants: source.system.variants.map((profile, index) => ({ index,
        fields: hazardFields(profile, `system.variants.${index}`, { variant: true }) })),
      hazardStages: source.system.stages.map((stage, index) => ({ index,
        fields: hazardFields(stage, `system.stages.${index}`, { stage: true }) })),
      conditionRules: [{ name: "Agonía", effect: "Dolor" }], canRollDamage: trap
    });
    const page = dom(html); const document = page.window.document;
    assert.ok(document.querySelector("[data-hazard-action='resist']"));
    assert.equal(document.querySelectorAll("[data-collection='variants'][data-index]").length,
      source.system.variants.length);
    assert.equal(document.querySelectorAll("[data-collection='stages'][data-index]").length,
      source.system.stages.length);
    for (const control of document.querySelectorAll("input,select,textarea")) assert.ok(control.closest("label") || control.getAttribute("aria-label"), control.name);
    assert.doesNotMatch(html, /MYTHRASF\./);
    page.window.close();
  }
});

test("añadir y eliminar etapas desde la hoja persiste sin alterar otras etapas", async (t) => {
  const { document } = installHost(t, `<button data-hazard-action="add" data-collection="stages"></button><button data-hazard-action="delete" data-collection="stages" data-index="0"></button>`);
  const { HazardItemSheet } = await import("../scripts/sheets/hazard-item-sheet.js");
  const item = documentDouble({ type: "poison", system: { stages: [{ name: "Inicial" }], variants: [] } });
  const sheet = new HazardItemSheet({ document: item }); sheet.item = item;
  sheet._onRender({}, {});
  await clickAndWait(document.querySelector("button"));
  assert.equal(item.system.stages.length, 2);
  await clickAndWait(document.querySelector("[data-index]"));
  assert.equal(item.system.stages.length, 1);
  assert.equal(item.system.stages[0].name, "Etapa");
});
