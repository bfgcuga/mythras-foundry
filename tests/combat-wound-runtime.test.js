import test from "node:test";
import assert from "node:assert/strict";
import { applyCombatWoundConsequences, heldCombatItemChoices
} from "../scripts/rules/combat-wound-runtime.js";

test("las opciones de soltar incluyen únicamente armas equipadas que ocupan manos", () => {
  const actor = { items: [{ id: "sword", name: "Espada", type: "weapon", img: "sword.png",
    system: { equipped: true, activeModeKey: "one", modes: [{ key: "one", handsRequired: 1 }] } },
  { id: "pack", name: "Mochila", type: "equipment", system: { equipped: true } }] };
  assert.deepEqual(heldCombatItemChoices(actor),
    [{ id: "sword", name: "Espada", img: "sword.png" }]);
});

test("una herida grave aplica sus consecuencias mediante dependencias explícitas", async () => {
  const combat = { damage: { resultingWound: "serious", penetratingDamage: 4 },
    effects: { checks: [] }, consequences: [] };
  const defender = { system: { attributes: { healingRate: 2 } }, items: [] };
  const location = { id: "arm", name: "Brazo", system: { locationType: "arm" },
    async update(change) { this.change = change; } };
  const statuses = [];
  const result = await applyCombatWoundConsequences(combat, defender, location, {
    evaluateRoll: async () => ({ total: 2 }), addStatus: async (...args) => statuses.push(args),
    applyDying: async () => {}, applyDeath: async () => {} });
  assert.equal(result, true);
  assert.ok(statuses.length > 0 || combat.consequences.length > 0 || location.change);
});
