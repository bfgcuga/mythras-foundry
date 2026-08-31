import test from "node:test";
import assert from "node:assert/strict";
import { consumeSurpriseEffectBonus, consumeWeaponModeAmmunition, spendActorActionPoint,
  spendActorLuckPoint } from "../scripts/rules/combat-resource-runtime.js";

function actor(resources) {
  return { system: { resources }, updates: [], async update(change) { this.updates.push(change); } };
}

test("los recursos de combate se consumen de forma atómica en el servicio documental", async () => {
  const subject = actor({ actionPoints: { value: 2 }, luckPoints: { value: 1 } });
  assert.equal(await spendActorActionPoint(subject), true);
  assert.equal(await spendActorLuckPoint(subject), true);
  assert.deepEqual(subject.updates, [
    { "system.resources.actionPoints.value": 1 },
    { "system.resources.luckPoints.value": 0 }
  ]);
});

test("la munición actualiza solo el modo empleado", async () => {
  const weapon = { system: { modes: [{ key: "bow", ammoTracking: true, ammoLoaded: 1,
    ammoReserve: 3, reloadProgress: 0 }, { key: "club", ammoLoaded: 0 }] },
    async update(change) { this.change = change; } };
  const ammunition = await consumeWeaponModeAmmunition(weapon, weapon.system.modes[0]);
  assert.equal(ammunition.loaded, 0);
  assert.equal(weapon.change["system.modes"][1].key, "club");
});

test("Sorpresa se consume una sola vez", async () => {
  const effect = { getFlag: () => ({ key: "surprised", bonusConsumed: false }),
    async update(change) { this.change = change; } };
  const defender = { effects: new Map([["surprise", effect]]) };
  const combat = { surprise: { eligible: true, consumed: false, effectId: "surprise" } };
  assert.equal(await consumeSurpriseEffectBonus(defender, combat,
    { scope: "scope", flag: "timed" }), 1);
  assert.equal(combat.surprise.consumed, true);
  assert.equal(effect.change["flags.scope.timed"].bonusConsumed, true);
  assert.equal(await consumeSurpriseEffectBonus(defender, combat,
    { scope: "scope", flag: "timed" }), 0);
});
