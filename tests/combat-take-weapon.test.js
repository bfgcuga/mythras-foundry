import test from "node:test";
import assert from "node:assert/strict";
import { takeWeaponStrengthAllowed } from "../scripts/rules/combat-disarm.js";
import { combatEffectEligible, initialCombatEffectStatus } from "../scripts/rules/combat-effects.js";
import { applyImmediateCombatEffects, applyCombatEffectCheckConsequence } from "../scripts/rules/combat-effect-runtime.js";

function fixture(strength = 19) {
  const weapon = { id: "sword", name: "Sword", type: "weapon",
    system: { equipped: true, handsRequired: 2, size: "E" },
    toObject() { return { _id: this.id, name: this.name, type: this.type, system: { ...this.system } }; } };
  const items = [weapon]; items.get = (id) => items.find((item) => item.id === id);
  const gained = [];
  const source = { system: { strength: 10 }, async createEmbeddedDocuments(type, data) {
    gained.push(...data); return [{ id: "copy" }];
  }, async deleteEmbeddedDocuments() { gained.length = 0; } };
  const victim = { system: { strength }, items, async deleteEmbeddedDocuments(type, ids) {
    assert.deepEqual(ids, ["sword"]); items.splice(0, 1);
  } };
  const effect = { key: "arrebatar-arma", side: "attacker", slot: 0, name: "Arrebatar Arma" };
  const state = { attacker: { actorUuid: "source" }, defender: { actorUuid: "victim" },
    effects: { selections: [effect], checks: [] } };
  const deps = { resolveActor: async (token, id) => id === "source" ? source : victim };
  return { state, deps, victim, gained, items };
}

test("Arrebatar exige un intercambio desarmado y rechaza FUE igual al doble", async () => {
  const effect = { key: "arrebatar-arma", ruleKey: "guided", offensive: true, weaponRestriction: "unarmed" };
  assert.equal(initialCombatEffectStatus(effect), "active");
  for (const unarmed of [false, true]) assert.equal(combatEffectEligible(effect,
    { winner: "attacker", attackMode: "melee", unarmed }), unarmed);
  for (const strength of [19, 20, 21]) {
    const f = fixture(strength);
    assert.equal(takeWeaponStrengthAllowed({ system: { strength: 10 } }, f.victim), strength < 20);
    await applyImmediateCombatEffects(f.state, { uuid: "message" }, f.deps);
    const check = f.state.effects.checks[0];
    assert.equal(check.combatStyle, true);
    assert.equal(check.opposedSide, "attacker");
    assert.equal(check.status, strength < 20 ? "pending" : "resolved");
    if (strength >= 20) assert.equal(check.consequence.key, "takeWeaponTooStrong");
    assert.equal(f.gained.length, 0);
  }
});

test("Arrebatar transfiere el arma elegida solo si pierde el rival y revierte errores", async () => {
  for (const outcome of ["left", "right", "error"]) {
    const f = fixture();
    await applyImmediateCombatEffects(f.state, { uuid: "message" }, f.deps);
    const check = f.state.effects.checks[0];
    check.resolution = { winner: outcome === "left" ? "left" : "right", weaponId: "sword" };
    if (outcome === "error") f.victim.deleteEmbeddedDocuments = async () => { throw new Error("delete failed"); };
    const apply = () => applyCombatEffectCheckConsequence(f.state, check, f.victim, f.deps);
    if (outcome === "error") await assert.rejects(apply, /delete failed/);
    else await apply();
    assert.equal(f.gained.length, outcome === "right" ? 1 : 0);
    assert.equal(f.items.length, outcome === "right" ? 0 : 1);
    if (outcome === "right") {
      assert.equal(f.gained[0]._id, undefined);
      assert.equal(f.gained[0].system.equipped, true);
      assert.equal(check.consequence.key, "disarmTaken");
    }
  }
});
