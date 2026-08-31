import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMBAT_EFFECT_ROLL_RESTRICTIONS, COMBAT_EFFECT_WEAPON_RESTRICTIONS,
  canonicalCombatEffectStage, combatEffectEligible, combatEffectResolutionPhase,
  combatEffectIsAutomated, combatEffectRule, combatEffectSelectionHighlight,
  combatEffectSlug, combatEffectSlotsBySide, initialCombatEffectStatus,
  maximizeDamageFormula, mergeCombatEffectDocuments,
  opposedEffectWinner, orderedCombatChecks, validateEffectSelections } from "../scripts/rules/combat-effects.js";

const source = JSON.parse(readFileSync(
  new URL("../data/mythras_efectos_combate.json", import.meta.url), "utf8"));
const effects = source.efectos_combate.map((entry) => ({
  key: combatEffectSlug(entry.nombre), name: entry.nombre,
  offensive: entry.ofensivo, defensive: entry.defensivo,
  weaponRestriction: entry.tipo_arma_especifica ?? "",
  rollRestriction: entry.tirada_especifica ?? "", stackable: entry.apilable,
  ...combatEffectRule({ key: combatEffectSlug(entry.nombre) })
}));

test("todos los efectos oficiales tienen una fase canónica de resolución", () => {
  const classified = effects.map((effect) => ({ effect,
    rule: combatEffectRule({ key: effect.key }) }));
  assert.equal(classified.length, source.efectos_combate.length);
  classified.forEach(({ rule }) => assert.equal(canonicalCombatEffectStage(rule.stage), rule.stage));
  assert.equal(combatEffectRule({ key: "cegar-oponente" }).stage, "beforeDamage");
  assert.equal(combatEffectRule({ key: "elegir-localizacion" }).stage, "beforeLocation");
  assert.equal(combatEffectRule({ key: "empalar" }).stage, "damageRoll");
  assert.equal(combatEffectRule({ key: "aturdir-localizacion" }).stage, "afterDamage");
  assert.equal(combatEffectRule({ key: "forzar-rendicion" }).replacesDamage, true);
  assert.equal(combatEffectResolutionPhase({ stage: "afterEffect" }), "afterDamage");
  assert.equal(combatEffectIsAutomated({ key: "cegar-oponente", ruleKey: "guided" }), true);
  assert.equal(combatEffectIsAutomated({ key: "agarrar", ruleKey: "guided" }), false);
  assert.equal(initialCombatEffectStatus({ key: "agarrar", ruleKey: "guided" }),
    "notAutomated");
});

test("Sorpresa puede conceder efectos ofensivos aunque gane la defensa", () => {
  assert.deepEqual(combatEffectSlotsBySide({ winner: "defender", differential: 2,
    surprise: 1 }), { attacker: 1, defender: 2 });
  assert.deepEqual(combatEffectSlotsBySide({ winner: "attacker", differential: 2,
    surprise: 1 }), { attacker: 3, defender: 0 });
});

test("Muerte Silenciosa solo es elegible en el ataque que consume Sorpresa", () => {
  const effect = { key: "muerte-silenciosa", offensive: true, defensive: false,
    weaponRestriction: "", rollRestriction: "" };
  assert.equal(combatEffectEligible(effect, { winner: "attacker", surpriseAttack: false }), false);
  assert.equal(combatEffectEligible(effect, { winner: "attacker", surpriseAttack: true }), true);
});

test("el catálogo canónico contiene 44 efectos y la tabla completa de empalamiento", () => {
  assert.equal(effects.length, 44);
  assert.equal(new Set(effects.map((effect) => effect.key)).size, 44);
  assert.equal(source.tabla_empalamiento.columnas.length, 6);
  assert.equal(source.tabla_empalamiento.filas.length, 5);
  assert.match(source.tabla_empalamiento.regla_adicional, /\+10 TAM/);
  assert.equal(source.fuente, "Mythras básico revisado");
});

test("el catálogo solo conserva restricciones canónicas y rechaza texto libre", () => {
  assert.ok(source.efectos_combate.every((entry) =>
    COMBAT_EFFECT_WEAPON_RESTRICTIONS.includes(entry.tipo_arma_especifica ?? "")
    && COMBAT_EFFECT_ROLL_RESTRICTIONS.includes(entry.tirada_especifica ?? "")));
  assert.equal(combatEffectEligible({ offensive: true, defensive: false,
    weaponRestriction: "Armas perforantes", rollRestriction: "" }, {
    winner: "attacker", weaponMode: { weaponType: "melee", impalingSize: "M" }
  }), false);
});

test("los efectos homebrew se combinan con los oficiales y pueden sustituir una clave", () => {
  const official = { uuid: "official", type: "combatEffect", system: { key: "custom" } };
  const homebrew = { uuid: "homebrew", type: "combatEffect", system: { key: "custom" } };
  const extra = { uuid: "extra", type: "combatEffect", system: { key: "extra" } };
  const ignored = { uuid: "weapon", type: "weapon", system: { key: "weapon" } };
  assert.deepEqual(mergeCombatEffectDocuments([[official], [homebrew, extra, ignored]])
    .map((entry) => entry.uuid), ["homebrew", "extra"]);
});

test("la elegibilidad respeta lado, crítico y capacidades estructuradas del arma", () => {
  const context = { winner: "attacker", attackResult: "critical", defenseResult: "failure",
    weaponMode: { weaponType: "melee", size: "M", impalingSize: "M", effects: "Empalar" } };
  assert.equal(combatEffectEligible(effects.find((effect) => effect.key === "empalar"), context), true);
  assert.equal(combatEffectEligible(effects.find((effect) => effect.key === "mejorar-parada"), context), false);
  assert.equal(combatEffectEligible(effects.find((effect) => effect.key === "sortear-parada"), context), true);
  assert.equal(combatEffectEligible(effects.find((effect) => effect.key === "desangrar"), context), false);
});

test("Elegir Localización respeta alcance corto, situación y cobertura completa", () => {
  const choose = effects.find((effect) => effect.key === "elegir-localizacion");
  const context = { winner: "attacker", attackResult: "success", defenseResult: "failure",
    weaponMode: { weaponType: "ranged", size: "G", effects: "" }, rangedBand: "short" };
  assert.equal(combatEffectEligible(choose, context), false);
  assert.equal(combatEffectEligible(choose, { ...context, rangedTargetStationary: true }), true);
  assert.equal(combatEffectEligible(choose, { ...context, rangedTargetStationary: true,
    completeCover: true }), false);
  assert.equal(combatEffectEligible(choose, { ...context, rangedBand: "long",
    attackResult: "critical" }), true);
});

test("la selección admite renuncias y solo duplica efectos apilables", () => {
  const context = { winner: "attacker", attackResult: "critical", defenseResult: "failure",
    weaponMode: { weaponType: "melee", size: "M", effects: "" } };
  const maximize = effects.find((effect) => effect.key === "maximizar-dano");
  const choose = effects.find((effect) => effect.key === "elegir-localizacion");
  assert.equal(validateEffectSelections({ slots: 2, selections: [
    { key: maximize.key }, { key: maximize.key }
  ], effects, context }).valid, true);
  assert.equal(validateEffectSelections({ slots: 2, selections: [
    { key: choose.key }, { key: choose.key }
  ], effects, context }).reason, "stacking");
  assert.equal(validateEffectSelections({ slots: 2, selections: [
    { key: choose.key }, { waived: true }
  ], effects, context }).valid, true);
});

test("la selección resalta críticos propios y pifias del rival según el lado", () => {
  assert.equal(combatEffectSelectionHighlight({ rollRestriction: "winnerCritical" },
    "attacker"), "critical");
  assert.equal(combatEffectSelectionHighlight({ rollRestriction: "attackerCritical" },
    "attacker"), "critical");
  assert.equal(combatEffectSelectionHighlight({ rollRestriction: "defenderCritical" },
    "defender"), "critical");
  assert.equal(combatEffectSelectionHighlight({ rollRestriction: "opponentFumble" },
    "attacker"), "fumble");
  assert.equal(combatEffectSelectionHighlight({ rollRestriction: "attackerFumble" },
    "defender"), "fumble");
  assert.equal(combatEffectSelectionHighlight({ rollRestriction: "attackerFumble" },
    "attacker"), "");
});

test("maximizar daño sustituye dados de izquierda a derecha sin alterar el resto", () => {
  assert.equal(maximizeDamageFormula("2d6 + 1d4 + 3", 1), "6 + 1d6 + 1d4 + 3");
  assert.equal(maximizeDamageFormula("2d6 + 1d4 + 3", 3), "12 + 4 + 3");
});

test("las comprobaciones de efectos preceden siempre a las de heridas", () => {
  assert.deepEqual(orderedCombatChecks([
    { id: "w", source: "wound", order: 0 }, { id: "e2", source: "effect", order: 2 },
    { id: "e1", source: "effect", order: 1 }
  ]).map((entry) => entry.id), ["e1", "e2", "w"]);
});

test("las tiradas enfrentadas de los efectos desempatan con el dado más alto", () => {
  assert.equal(opposedEffectWinner({ result: "success", rawRoll: 72 },
    { result: "success", rawRoll: 41 }), "left");
  assert.equal(opposedEffectWinner({ result: "failure", rawRoll: 90 },
    { result: "success", rawRoll: 10 }), "right");
});

test("la hoja de Empalar usa una tabla semántica y el compendio nace del JSON canónico", () => {
  const template = readFileSync(new URL("../templates/item/item-sheet.hbs", import.meta.url), "utf8");
  const builder = readFileSync(new URL("../scripts/dev/build-packs.mjs", import.meta.url), "utf8");
  const model = readFileSync(new URL("../scripts/data/item-data.js", import.meta.url), "utf8");
  assert.match(template, /<table class="combat-effect-table"><thead>/);
  assert.match(template, /<th scope="col">/);
  assert.match(template, /<th scope="row">/);
  assert.match(builder, /data\/mythras_efectos_combate\.json/);
  assert.match(builder, /source: MYTHRAS_REVISED_SOURCE/);
  assert.match(builder, /COMBAT_EFFECT_WEAPON_RESTRICTIONS\.includes/);
  assert.match(model, /export class CombatEffectData/);
});

test("la hoja de efecto es editable, restringe sus valores y usa booleanos visuales", () => {
  const template = readFileSync(new URL("../templates/item/item-sheet.hbs", import.meta.url), "utf8");
  const sheet = readFileSync(new URL("../scripts/sheets/item-sheet.js", import.meta.url), "utf8");
  const combat = readFileSync(new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8");
  assert.match(template, /name="system\.source"/);
  assert.match(template, /name="system\.description"/);
  assert.match(template, /name="system\.weaponRestriction">{{selectOptions/);
  assert.match(template, /name="system\.rollRestriction">{{selectOptions/);
  assert.ok(template.indexOf("combat-effect-sheet-description")
    < template.indexOf("combat-effect-sheet-summary"));
  for (const field of ["offensive", "defensive", "stackable", "requiresWound", "endurance"]) {
    assert.match(template, new RegExp(`type="checkbox"[^>]*sheet-state-box[^>]*name="system\\.${field}"`));
  }
  assert.match(sheet, /this\.item\.type === "combatEffect"[\s\S]*?width: 740, height: 640/);
  assert.match(combat, /ruleKey: item\.system\.ruleKey/);
  assert.match(combat, /requiresWound: Boolean\(item\.system\.requiresWound\)/);
  assert.match(combat, /SETTING_KEYS\.catalogSources/);
  assert.match(combat, /mergeCombatEffectDocuments\(groups\)/);
  assert.match(combat, /initialCombatEffectStatus\(effect\)/);
  const renderer = readFileSync(new URL("../scripts/rules/combat-chat-renderer.js",
    import.meta.url), "utf8");
  assert.match(renderer, /combat-effect-debug-note/);
  assert.doesNotMatch(renderer, /data-combat-action="resolve-effect"/);
});

test("el diálogo de selección muestra descripciones y solo pide parámetros reglados", () => {
  const combat = readFileSync(new URL("../scripts/rules/combat-chat.js", import.meta.url), "utf8");
  assert.match(combat, /position: \{ width: 760 \}/);
  assert.match(combat, /class="mythras-launcher-title"/);
  assert.match(combat, /MYTHRASF\.CombatEffect\.SelectionTitle/);
  assert.match(combat, /MYTHRASF\.CombatEffect\.ConfirmSelection/);
  assert.match(combat, /data-effect-description=/);
  assert.match(combat, /effect\.description/);
  assert.match(combat, /effect\?\.ruleKey !== "chooseLocation"/);
  assert.doesNotMatch(combat, /name="note-\$\{index\}"/);
});
