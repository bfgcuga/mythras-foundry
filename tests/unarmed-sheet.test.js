import test from "node:test";
import assert from "node:assert/strict";
import { installHost, collection, documentDouble, render } from "./helpers/ui.js";

test("cambiar de estilo a Pelea actualiza el porcentaje y transmite la habilidad y Shift al ataque", async (t) => {
  const { document } = installHost(t);
  const requests = [];
  t.mock.module("../scripts/rules/combat-chat.js", { exports: {
    createAttackMessage: async (request) => requests.push(request) } });
  const { CombatSheetController, prepareIntrinsicCombatView } = await import("../scripts/ui/combat-sheet.js");
  const actor = documentDouble({ system: { morphologyKey: "humanoid" }, items: collection([
    { id: "brawl", type: "skill", name: "Pelea", system: { slug: "pelea", total: 45 } },
    { id: "martial", type: "combatStyle", name: "Arte", system: { total: 75,
      weaponProfiles: [{ key: "puno-patada" }] } }
  ]) });
  const row = prepareIntrinsicCombatView(actor, () => "standard");
  document.body.innerHTML = render("templates/actor/parts/combat-tab.hbs", { meleeCombatWeapons: [row] });
  const controller = new CombatSheetController({ actor, element: document.body, isEditable: true },
    { resolveSituationalDifficulty: async (difficulty) => difficulty });
  controller.bind();
  const select = document.querySelector("[data-combat-style]");
  select.value = "brawl";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  assert.equal(document.querySelector("strong.penalized-value").textContent, "45%");
  await controller.rollWeaponAttack({ preventDefault() {}, shiftKey: true,
    currentTarget: document.querySelector('[data-action="roll-weapon-attack"]') });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].resolution.ability.id, "brawl");
  assert.equal(requests[0].resolution.style, null);
  assert.equal(requests[0].weapon.id, "");
  assert.equal(requests[0].manual, true);
});
