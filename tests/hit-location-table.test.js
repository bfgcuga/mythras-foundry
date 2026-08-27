import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { prepareHitLocationTable } from "../scripts/ui/hit-location-table.js";

test("personaje y PNJ consumen un único preparador y un único parcial de localizaciones", async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const [characterSheet, npcSheet, characterTemplate, npcTemplate, registration] =
    await Promise.all([read("scripts/sheets/character-sheet.js"), read("scripts/sheets/npc-sheet.js"),
      read("templates/actor/parts/combat-tab.hbs"), read("templates/actor/npc-sheet.hbs"),
      read("scripts/system/registration.js")]);
  for (const source of [characterSheet, npcSheet]) {
    assert.match(source, /prepareHitLocationTable\(\{ actor: this\.actor/);
    assert.doesNotMatch(source, /passiveBlockLocationIds|hitLocations\.map\(\(item\) => \(\{/);
  }
  assert.match(characterTemplate, /templates\/actor\/parts\/hit-location-table\.hbs/);
  assert.match(npcTemplate, /templates\/actor\/parts\/combat-tab\.hbs/);
  for (const source of [characterTemplate, npcTemplate]) {
    assert.doesNotMatch(source, /class="combat-location-line/);
  }
  assert.match(registration, /templates\/actor\/parts\/hit-location-table\.hbs/);
});

test("d20 y Localización alinean igual sus cabeceras y datos", async () => {
  const styles = await readFile(new URL("../styles/mythras-foundry.css", import.meta.url), "utf8");
  assert.match(styles, /combat-location-head > span:nth-child\(2\)[\s\S]*?text-align: left/);
  assert.match(styles, /combat-location-line > span:first-child[\s\S]*?text-align: center/);
});

test("el preparador común resuelve estados, armadura y bloqueo pasivo", () => {
  const location = { id: "chest", type: "hitLocation", name: "Pecho", system: {
    rangeStart: 10, rangeEnd: 12, armorPoints: 1, woundLevel: "major",
    currentHitPoints: 2, maxHitPoints: 1, disabled: false,
    permanentWound: { severity: 3, originalMaxHitPoints: 6,
      effectiveMaxHitPoints: 1, lostHitResults: 0 } } };
  const armor = { id: "mail", type: "armor", name: "Cota", system: {
    equipped: true, armorPoints: 4, coveredLocationIds: ["chest"] } };
  const actor = { uuid: "Actor.hodei", token: { uuid: "Scene.s.Token.hodei" },
    items: [location, armor] };
  const combatant = { id: "combatant", actor, token: actor.token };
  const combat = { round: 2, combatants: [combatant], getFlag: () => ({ passiveBlocks: {
    combatant: { status: "active", round: 2, locationIds: ["chest"] }
  } }) };
  const table = prepareHitLocationTable({ actor, armor: [armor], combat, armorPointLabel: "PA" });
  assert.equal(table.hasNaturalArmor, true);
  assert.deepEqual({ disabled: table.rows[0].disabled, crippled: table.rows[0].crippled,
    passiveBlocked: table.rows[0].passiveBlocked, totalArmor: table.rows[0].totalArmor },
  { disabled: true, crippled: true, passiveBlocked: true, totalArmor: 5 });
  assert.equal(table.rows[0].overMaximum, true);
  assert.equal(table.rows[0].armorOptions[0].label, "Cota (4 PA)");
});
