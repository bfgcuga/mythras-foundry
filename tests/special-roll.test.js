import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("character and NPC skill tabs expose the Special roll", () => {
  const character = fs.readFileSync(new URL("../templates/actor/character-sheet.hbs", import.meta.url), "utf8");
  const skillOverview = fs.readFileSync(new URL("../templates/actor/parts/skill-overview.hbs", import.meta.url), "utf8");
  const npc = fs.readFileSync(new URL("../templates/actor/npc-sheet.hbs", import.meta.url), "utf8");
  const characterSheet = fs.readFileSync(new URL("../scripts/sheets/character-sheet.js", import.meta.url), "utf8");
  const npcSheet = fs.readFileSync(new URL("../scripts/sheets/npc-sheet.js", import.meta.url), "utf8");
  for (const template of [character, npc]) assert.match(template, /data-action="roll-special"/);
  assert.match(character, /group=basicSkillGroup[\s\S]*?showSpecialRoll=true/);
  assert.match(skillOverview, /\{\{#if showSpecialRoll\}\}[\s\S]*data-action="roll-special"[\s\S]*\{\{\/if\}\}[\s\S]*<\/fieldset>/);
  assert.doesNotMatch(character, /paper-skill-actions[\s\S]*<section class="paper-skill-columns/);
  for (const sheet of [characterSheet, npcSheet]) assert.match(sheet, /rollSpecial\(this\.actor\)/);
});

test("Special rolls accept a name and percentage and can enter a contest", () => {
  const special = fs.readFileSync(new URL("../scripts/rules/special-roll.js", import.meta.url), "utf8");
  const dialog = fs.readFileSync(new URL("../scripts/apps/skill-roll-dialog.js", import.meta.url), "utf8");
  assert.match(special, /openSpecialRollSetup\(actor\)/);
  assert.match(special, /openSkillRollDialog\(ability\)/);
  assert.match(special, /createContestMessage\(ability, configured, initialRoll\)/);
  assert.match(dialog, /name="specialName"/);
  assert.match(dialog, /name="specialTarget"/);
  assert.match(dialog, /participantSpecialTarget-/);
});

test("a higher effective target is rendered as a bonus", () => {
  const item = fs.readFileSync(new URL("../scripts/documents/mythras-item.js", import.meta.url), "utf8");
  assert.match(item, /targets\.target > targets\.baseTarget \? "bonus" : "penalty"/);
});
