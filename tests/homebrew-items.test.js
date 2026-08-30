import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HOMEBREW_ITEM_TYPES, buildHomebrewItem, homebrewPackName }
  from "../scripts/rules/homebrew-items.js";

test("el creador homebrew cubre todos los tipos Item del sistema", () => {
  assert.deepEqual(new Set(HOMEBREW_ITEM_TYPES), new Set([
    "skill", "combatStyle", "culture", "profession", "passion",
    "equipment", "weapon", "armor", "hitLocation", "trait", "combatEffect"
  ]));
  for (const type of HOMEBREW_ITEM_TYPES) {
    const fields = { name: `Prueba ${type}`, rules: "{}", objectDescription: "Prueba" };
    assert.equal(buildHomebrewItem(type, fields).type, type);
  }
});

test("registra el menú GM, la API y los formularios del creador", () => {
  const entrypoint = readFileSync(new URL("../scripts/system/registration.js", import.meta.url), "utf8");
  const template = readFileSync(new URL(
    "../templates/apps/homebrew-item-creator.hbs", import.meta.url), "utf8");
  assert.match(entrypoint, /registerMenu\("mythras-foundry", "homebrewItemCreator"/);
  assert.match(entrypoint, /homebrew: createHomebrewApi\(\)/);
  for (const type of ["Skill", "CombatStyle", "Background", "Passion", "Equipment",
    "Weapon", "Armor", "HitLocation", "Trait", "CombatEffect"]) {
    assert.match(template, new RegExp(`is${type}`));
  }
});

test("normaliza el nombre de un compendio mundial", () => {
  assert.equal(homebrewPackName("Campaña de Áitor"), "campana-de-aitor");
  assert.equal(homebrewPackName("***"), "mythras-homebrew");
});

test("crea armas funcionales con un modo y durabilidad completa", () => {
  const item = buildHomebrewItem("weapon", {
    name: "Lanza lunar", weaponType: "ranged", damage: "1d8", maxHitPoints: 9
  });
  assert.equal(item.system.activeModeKey, "ranged");
  assert.equal(item.system.currentHitPoints, 9);
  assert.equal(item.system.modes[0].damage, "1d8");
  assert.deepEqual(item.system.modes[0].traitRefs, []);
});

test("conserva la imagen elegida y trata el peso histórico del equipo como carga", () => {
  const item = buildHomebrewItem("equipment", {
    name: "Mochila", img: "worlds/campana/mochila.webp", encumbrance: 2, value: 15
  });
  assert.equal(item.img, "worlds/campana/mochila.webp");
  assert.equal(item.system.weight, 2);
  assert.equal(item.system.value, 15);
});

test("el creador delega armas y estilos en versiones acotadas de sus hojas", () => {
  const app = readFileSync(new URL(
    "../scripts/apps/homebrew-item-creator.js", import.meta.url), "utf8");
  const sheet = readFileSync(new URL(
    "../templates/item/item-sheet.hbs", import.meta.url), "utf8");
  assert.match(app, /document\.sheet\.creationMode/);
  assert.match(sheet, /unless creationMode[^]*data-weapon-tab="instance"/);
  assert.match(sheet, /unless creationMode[^]*data-combat-style-tab="calculation"/);
});

test("crea localizaciones y armaduras con valores operativos", () => {
  const location = buildHomebrewItem("hitLocation", {
    name: "Ala", rangeStart: 2, rangeEnd: 5, maxHitPoints: 4, autoCalculate: "on"
  });
  assert.equal(location.system.currentHitPoints, 4);
  assert.equal(location.system.autoCalculate, true);
  const armor = buildHomebrewItem("armor", { name: "Protección alar" });
  assert.equal(armor.system.referenceLocation, "special");
  assert.equal(armor.system.material, "leather");
});

test("crea efectos homebrew con restricciones canónicas utilizables", () => {
  const effect = buildHomebrewItem("combatEffect", { name: "Ataque lunar",
    offensive: "on", weaponRestriction: "ranged", rollRestriction: "attackerCritical" });
  assert.equal(effect.system.weaponRestriction, "ranged");
  assert.equal(effect.system.rollRestriction, "attackerCritical");
  assert.equal(effect.system.ruleKey, "guided");
  assert.throws(() => buildHomebrewItem("combatEffect", { name: "Inválido",
    weaponRestriction: "Armas de luna" }), /invalid-combat-effect-restriction/);
});

test("culturas y profesiones exigen reglas JSON con forma de objeto", () => {
  assert.equal(buildHomebrewItem("culture", { name: "Insular", rules: "{}" })
    .system.key, "insular");
  assert.throws(() => buildHomebrewItem("profession", { name: "Vigía", rules: "[]" }),
    /invalid-rules/);
});
