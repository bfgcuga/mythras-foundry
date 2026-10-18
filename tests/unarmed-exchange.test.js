import test from "node:test";
import assert from "node:assert/strict";
import { installHost, collection, documentDouble, clickAndWait } from "./helpers/ui.js";
import { intrinsicUnarmedWeapon, resolveUnarmedAbility } from "../scripts/rules/unarmed-combat.js";

test("el ataque intrínseco registra Pelea, su pifia y tira daño sin resolver un Item", async (t) => {
  const { document } = installHost(t, '<section class="mythras-combat-card"><button data-combat-action="roll-damage"></button></section>');
  const skill = documentDouble({ id: "brawl", type: "skill", name: "Pelea", system: { slug: "pelea", total: 55 } });
  const actor = documentDouble({ items: collection([skill]), system: { morphologyKey: "humanoid",
    attributes: { damageModifier: "1d2" }, resources: { actionPoints: { value: 2 } } } });
  skill.actor = actor;
  const defender = documentDouble({ id: "defender", uuid: "Actor.defender" });
  const token = { actor: defender, document: { uuid: "Scene.s.Token.d" }, name: "Defensor", visible: true };
  canvas.tokens.placeables = [token];
  const originalUuid = globalThis.fromUuid;
  const originalMessage = globalThis.ChatMessage;
  globalThis.fromUuid = async (uuid) => uuid === actor.uuid ? actor
    : uuid === defender.uuid ? defender : { actor: defender };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async (data) => data };
  t.after(() => { globalThis.fromUuid = originalUuid; globalThis.ChatMessage = originalMessage; });
  const formulas = [];
  const systemRoll = await import("../scripts/rules/system-roll.js");
  t.mock.module("../scripts/rules/system-roll.js", { exports: { ...systemRoll,
    evaluateSystemRoll: async (formula) => {
      formulas.push(formula);
      const total = formula === "1d100" ? 100 : 3;
      return { total, result: String(total), dice: [], toJSON: () => ({ total, formula }) };
    } } });
  t.mock.module("../scripts/apps/skill-roll-dialog.js", { exports: {
    openAttackRollDialog: async () => ({ targets: { baseTarget: 55, adjustedTarget: 55,
      difficulty: "standard" }, additional: { targetTokenUuid: "Scene.s.Token.d" } }) } });
  const { createAttackMessage, activateCombatCard } = await import("../scripts/rules/combat-chat.js");
  const weapon = intrinsicUnarmedWeapon(actor);
  const created = await createAttackMessage({ actor, weapon, mode: weapon.system.modes[0],
    resolution: resolveUnarmedAbility(actor) });
  const combat = created.flags["mythras-foundry"].combat;
  assert.equal(combat.attacker.weaponId, "");
  assert.equal(combat.attacker.intrinsicKey, "puno-patada");
  assert.equal(combat.attacker.abilityId, "brawl");
  assert.equal(combat.attacker.styleId, "");
  assert.equal(skill.system.fumbled, true);
  assert.equal(actor.items.length, 1);
  assert.equal(actor.system.resources.actionPoints.value, 2);
  combat.status = "resolved";
  combat.damage.status = "ready";
  combat.resolution = { attack: { result: "success" } };
  let request;
  game.users = collection([{ id: "coordinator", active: true, isGM: true }]);
  game.socket = { emit: (channel, data) => { request = data; } };
  activateCombatCard({ id: "message", getFlag: () => combat }, document.body);
  await clickAndWait(document.querySelector("button"));
  assert.equal(request.action, "combatDamage");
  assert.equal(request.weaponFormula, "1d3");
  assert.equal(request.modifierFormula, "1d2");
  assert.match(formulas.at(-1), /1d3.*1d2/);
  assert.equal(actor.items.length, 1);

  const defenderBrawl = documentDouble({ id: "defender-brawl", type: "skill", name: "Pelea",
    system: { slug: "pelea", total: 40 } });
  defender.system.morphologyKey = "humanoid";
  defender.items.push(defenderBrawl);
  combat.status = "awaitingDefense";
  foundry.applications.api.DialogV2.wait = async () => "intrinsic:puno-patada:defender-brawl";
  for (const confirmation of [false, null, true]) {
    request = null;
    foundry.applications.api.DialogV2.confirm = async () => confirmation;
    document.body.innerHTML = '<section class="mythras-combat-card"><button data-combat-action="parry"></button></section>';
    activateCombatCard({ id: "message", getFlag: () => combat }, document.body);
    await clickAndWait(document.querySelector("button"));
    if (!confirmation) assert.equal(request, null);
    else {
      assert.equal(request.action, "combatDefense");
      assert.equal(request.defense.abilityId, "defender-brawl");
      assert.equal(request.defense.touchConfirmed, true);
      assert.equal(request.defense.weaponSize, "P");
    }
  }
});
