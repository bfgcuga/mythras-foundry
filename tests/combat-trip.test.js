import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { tripResistanceChoices, chooseTripResistance } from "../scripts/rules/combat-trip.js";
import { applyImmediateCombatEffects, applyCombatEffectCheckConsequence } from "../scripts/rules/combat-effect-runtime.js";
import { combatEffectRule, initialCombatEffectStatus } from "../scripts/rules/combat-effects.js";

const actor = { items: ["musculo", "evadir", "acrobacias", "atletismo", "aguante"].map((slug) => ({
  id: slug, name: slug, type: "skill", system: { slug, total: 60 }
})) };

test("Derribar añade Atletismo y mejora todas las resistencias un grado solo para no bípedos", () => {
  const biped = tripResistanceChoices(actor);
  assert.deepEqual(biped.map((entry) => entry.ability.id), ["musculo", "evadir", "acrobacias"]);
  assert.ok(biped.every((entry) => entry.target === 60 && entry.difficulty === "standard"));
  const other = tripResistanceChoices(actor, false);
  assert.deepEqual(other.map((entry) => entry.ability.id), ["musculo", "evadir", "acrobacias", "atletismo"]);
  assert.ok(other.every((entry) => entry.target === 90 && entry.difficulty === "easy"));
  assert.ok(tripResistanceChoices(actor, false, "formidable").every((entry) =>
    entry.difficulty === "hard" && entry.target === 40));
});

test("el selector comienza en Sí, actualiza objetivos y elimina Atletismo al volver a Sí", async () => {
  let spec;
  const Dialog = { wait: async (options) => { spec = options; return null; } };
  await chooseTripResistance(actor, "standard", { Dialog, localize: (key) => key, escape: (s) => s });
  const dom = new JSDOM(`<form>${spec.content}<button data-action="roll"></button></form>`);
  spec.render(null, { element: dom.window.document });
  const form = dom.window.document.querySelector("form");
  assert.equal(form.elements.biped.value, "yes");
  assert.equal(form.elements.ability.options.length, 3);
  form.elements.biped.value = "no";
  form.elements.biped.dispatchEvent(new dom.window.Event("change"));
  assert.equal(form.elements.ability.options.length, 4);
  form.elements.ability.value = "atletismo";
  const selected = spec.buttons[0].callback(null, { form });
  assert.equal(selected.ability.id, "atletismo");
  assert.equal(selected.biped, false);
  assert.equal(selected.target, 90);
  form.elements.biped.value = "yes";
  form.elements.biped.dispatchEvent(new dom.window.Event("change"));
  assert.equal(form.elements.ability.options.length, 3);
  assert.notEqual(form.elements.ability.value, "atletismo");
  assert.equal(form.elements.target.textContent, "60%");
  assert.equal(spec.buttons[1].callback(), null);
});

test("Derribar enfrenta la tirada original de ambos lados y solo aplica prone al perder", async () => {
  for (const side of ["attacker", "defender"]) for (const winner of ["left", "right"]) {
    const effect = { key: "derribar-oponente", name: "Derribar Oponente", side, slot: 0,
      ...combatEffectRule({ key: "derribar-oponente" }) };
    assert.equal(initialCombatEffectStatus(effect), "active");
    assert.equal(effect.stage, "beforeDamage");
    const state = { attacker: { actorUuid: "a" }, defender: { actorUuid: "d" },
      effects: { selections: [effect], checks: [] } };
    const conditions = [];
    const deps = { resolveActor: async (token, id) => ({ uuid: id }), localize: (key) => key,
      applyCondition: async (target, condition) => conditions.push({ target, condition }) };
    await applyImmediateCombatEffects(state, { uuid: "message" }, deps);
    const check = state.effects.checks[0];
    assert.equal(check.opposedSide, side);
    assert.equal(check.actorSide, side === "attacker" ? "defender" : "attacker");
    assert.equal(check.status, "pending");
    check.resolution = { winner };
    await applyCombatEffectCheckConsequence(state, check, actor, deps);
    assert.equal(conditions.length, winner === "right" ? 1 : 0);
    if (winner === "right") {
      assert.equal(conditions[0].target.uuid, side === "attacker" ? "d" : "a");
      assert.equal(conditions[0].condition.statusId, "prone");
      assert.equal(conditions[0].condition.duration.unit, "manual");
      assert.equal(check.consequence.key, "prone");
    }
  }
});
