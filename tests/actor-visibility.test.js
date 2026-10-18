import test from "node:test";
import assert from "node:assert/strict";
import { installHost, render, documentDouble, clickAndWait, collection } from "./helpers/ui.js";
import { actorVisibility, canViewActor, visibleSheetTab } from "../scripts/ui/actor-visibility.js";
import { SYSTEM_SETTING_DEFINITIONS, SETTING_KEYS } from "../scripts/settings.js";
import { GallerySheetController } from "../scripts/ui/gallery-sheet.js";

const keys = ["showOtherActorWeapons", "showOtherActorLocations", "showOtherActorStatus", "showOtherActorResources"];
function context(actor) {
  return { hitLocationTemplateMode: true, canManageMorphology: true, canDeleteHitLocations: true, actor, visibility: actorVisibility(actor), editable: false,
    headerStatus: { magicPoints: "MAGIC_SENTINEL", luckPoints: "LUCK_SENTINEL", wound: "HERIDA", fatigue: "FATIGA", actionPoints: { base: 2 } },
    hitLocationTable: { rows: [{ item: { id: "head", system: { currentHitPoints: 4 } }, displayName: "CABEZA", showDisabledControl: true }] },
    meleeCombatWeapons: [{ item: { id: "sword" }, displayName: "ESPADA", mode: {}, styleOptions: [{ name: "Espadachin", selected: true }] }],
    rangedCombatWeapons: [{ item: { id: "bow" }, displayName: "ARCO", mode: {}, styleOptions: [] }],
    activeStatusControls: [{ id: "prone", label: "TUMBADO" }], hasActiveStatusControls: true,
    fatigueRows: [{ key: "fresh", levelLabel: "Fresco" }] };
}

test("actor access denies NONE, permits LIMITED and OBSERVER, and owners and GM ignore visibility settings", t => {
  installHost(t); game.user = { isGM: false };
  game.settings.get = () => false;
  const actor = documentDouble({ isOwner: false });
  for (const level of [0, 1, 2, 3]) {
    actor.isOwner = level === 3;
    actor.testUserPermission = (user, permission) => level >= ({ LIMITED: 1, OWNER: 3 }[permission]);
    assert.equal(canViewActor(actor), level >= 1);
    const visibility = actorVisibility(actor);
    for (const key of ["weapons", "locations", "status", "resources", "combat"]) assert.equal(visibility[key], level === 3);
  }
  actor.isOwner = false; game.user.isGM = true;
  assert.equal(canViewActor(actor), true); assert.equal(actorVisibility(actor).full, true);
  for (const key of ["weapons", "locations", "status", "resources"]) assert.equal(actorVisibility(actor)[key], true);
});

test("both consultation sheets omit restricted HTML and follow all 16 combinations of world settings", t => {
  const { document } = installHost(t); game.user = { isGM: false };
  for (const type of ["character", "npc"]) {
    const actor = documentDouble({ type, isOwner: false, system: { identity: {}, gallery: [{ src: "image.png", title: "IMAGEN" }],
      narrative: { history: "PUBLIC_HISTORY", secrets: "PRIVATE_SECRET", notes: "PRIVATE_NOTE" } } });
    for (let mask = 0; mask < 16; mask++) {
      game.settings.get = (scope, key) => Boolean(mask & (1 << keys.indexOf(key)));
      const data = context(actor);
      document.body.innerHTML = render(`templates/actor/${type}-sheet.hbs`, data);
      const has = selector => Boolean(document.querySelector(selector));
      assert.equal(has('.combat-paper-melee-weapons'), data.visibility.weapons);
      assert.equal(has('.combat-paper-ranged-weapons'), data.visibility.weapons);
      assert.equal(has('.combat-paper-locations'), data.visibility.locations);
      assert.equal(has('[data-tab="combat"]'), data.visibility.combat);
      assert.equal(has('[data-tab="penalties"]'), data.visibility.status);
      assert.equal(document.body.textContent.includes('MAGIC_SENTINEL'), data.visibility.resources);
      assert.equal(document.body.textContent.includes('LUCK_SENTINEL'), data.visibility.resources);
      assert.match(document.body.textContent, /HERIDA/);
      assert.equal(has('[data-tab="gallery"]'), true);
      assert.equal(has('[data-tab="narrative"]'), type === 'character');
      assert.equal(has('[data-tab="inventory"], [data-tab="character"], [data-tab="general"]'), false);
      assert.equal(has('[data-combat-action-key], [data-action="edit-item"], [data-action="roll-weapon-attack"], [data-action="toggle-equipped"], [data-action="toggle-edit-mode"], [data-action="add-gallery-image"]'), false);
      assert.equal(has('input:not(:disabled),select:not(:disabled),textarea:not([readonly]):not(:disabled)'), false);
      assert.equal(document.body.innerHTML.includes('PRIVATE_SECRET'), false);
      assert.equal(document.body.innerHTML.includes('PRIVATE_NOTE'), false);
      if (type === 'character') assert.match(document.body.textContent, /PUBLIC_HISTORY/);
      assert.equal(visibleSheetTab(document.body, 'inventory'), document.querySelector('[data-tab]').dataset.tab);
    }
  }
});

test("both sheet controllers deny NONE and reject observer form submissions and action clicks", async t => {
  const { document } = installHost(t); game.user = { isGM: false };
  const { CharacterSheet } = await import('../scripts/sheets/character-sheet.js');
  const { NpcSheet } = await import('../scripts/sheets/npc-sheet.js');
  for (const [type, Sheet] of [['character', CharacterSheet], ['npc', NpcSheet]]) {
    const actor = documentDouble({ type, isOwner: false });
    actor.testUserPermission = () => false;
    const sheet = new Sheet({ actor });
    assert.throws(() => sheet._canRender({}), /acceso|AccessDenied/i);
    actor.testUserPermission = (user, permission) => permission === "LIMITED";
    assert.doesNotThrow(() => sheet._canRender({}));
    await Sheet._onSubmitForm.call(sheet, null, null, { object: { name: 'NO' } });
    assert.equal(actor.updates.length, 0);
    document.body.innerHTML = '<button data-tab="gallery" disabled></button><section data-tab-content="gallery"></section><button data-action="roll-skill"></button><button data-action="toggle-edit-mode"></button>';
    sheet._activeTab = 'inventory'; sheet._onRender({}, {});
    assert.equal(sheet._activeTab, 'gallery');
    assert.equal(document.querySelector('[data-tab="gallery"]').disabled, false);
    await clickAndWait(document.querySelector('[data-action="toggle-edit-mode"]'));
    assert.equal(Boolean(sheet._editMode), false);
    assert.equal(actor.updates.length, 0);
    game.user.isGM = true;
    await Sheet._onSubmitForm.call(sheet, null, null, { object: { name: 'GM' } });
    assert.equal(actor.name, 'GM'); game.user.isGM = false;
  }
});

test("NPC gallery persists images for owners and only opens images for observers", async t => {
  const { document } = installHost(t); game.user = { isGM: false }; game.world = { id: 'test' };
  const actor = documentDouble({ type: 'npc', system: { gallery: [] } });
  const opened = [];
  foundry.applications.apps.FilePicker = class { constructor(options) { this.options = options; } async browse() { await this.options.callback('worlds/test/npc-image.png'); } };
  foundry.applications.apps.ImagePopout = class { constructor(options) { opened.push(options); } render() {} };
  const { NpcSheet } = await import('../scripts/sheets/npc-sheet.js');
  const sheet = new NpcSheet({ actor });
  document.body.innerHTML = render('templates/actor/parts/gallery-tab.hbs', { editable: true, gallery: [] });
  sheet._onRender({}, {});
  await clickAndWait(document.querySelector('[data-action="add-gallery-image"]'));
  assert.deepEqual(actor.system.gallery, [{ src: 'worlds/test/npc-image.png', title: 'npc image' }]);
  actor.isOwner = false;
  document.body.innerHTML = render('templates/actor/parts/gallery-tab.hbs', { editable: false, gallery: actor.system.gallery });
  new GallerySheetController(sheet).bind();
  await clickAndWait(document.querySelector('[data-action="view-gallery-image"]'));
  assert.equal(opened[0].src, actor.system.gallery[0].src);
  await new GallerySheetController(sheet).add(); assert.equal(actor.system.gallery.length, 1);
  actor.isOwner = true;
  document.body.innerHTML = render('templates/actor/parts/gallery-tab.hbs', { editable: true, gallery: actor.system.gallery });
  new GallerySheetController(sheet).bind();
  await clickAndWait(document.querySelector('[data-action="remove-gallery-image"]'));
  assert.equal(actor.system.gallery.length, 0);
});

test("visibility settings default to true and refresh open source and token sheets once", t => {
  installHost(t);
  let renders = 0;
  const app = { actor: { type: 'character' }, render: () => renders++ };
  const tokenApp = { actor: { type: 'npc', isToken: true }, render: () => renders++ };
  foundry.applications.instances = new Map([['source', app], ['token', tokenApp]]);
  game.actors = collection([{ apps: { app } }]);
  for (const key of keys) {
    const { options } = SYSTEM_SETTING_DEFINITIONS.find(entry => entry.key === SETTING_KEYS[key]);
    assert.equal(options.default, true); assert.equal(options.scope, 'world');
    const before = renders; options.onChange(); assert.equal(renders - before, 2);
  }
});


test("NPC gallery schema starts empty and owners retain private narrative and full tabs", async t => {
  const { document } = installHost(t);
  const { NpcData } = await import('../scripts/data/npc-data.js');
  assert.deepEqual(NpcData.defineSchema().gallery.options.initial, []);
  const actor = documentDouble({ system: { narrative: { secrets: 'OWNER_SECRET', notes: 'OWNER_NOTE' } } });
  document.body.innerHTML = render('templates/actor/character-sheet.hbs', { actor, editable: true, visibility: actorVisibility(actor) });
  assert.match(document.body.textContent, /OWNER_SECRET/); assert.match(document.body.textContent, /OWNER_NOTE/);
  assert.ok(document.querySelector('[data-tab="character"]'));
  assert.ok(document.querySelector('[data-tab="inventory"]'));
});
