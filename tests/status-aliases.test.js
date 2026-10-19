import test from "node:test";
import assert from "node:assert/strict";
import { canonicalSpecialStatuses, canonicalStatusIds } from "../scripts/data/status-aliases.js";
import { statusIconUpdates } from "../scripts/data/status-icons.js";
import { prepareStatusCatalog } from "../scripts/ui/status-catalog.js";
const i18n = { lang: "es", localize: (key) => key };

test("el selector conserva solo los estados canónicos en arrays y objetos", () => {
  const entries = ["stun", "stunned", "silence", "silenced", "blind", "blinded", "custom"]
    .map((id) => ({ id, name: id }));
  for (const input of [entries, Object.fromEntries(entries.map((s) => [s.id, s]))]) {
    const result = prepareStatusCatalog(input, i18n);
    assert.deepEqual(Object.values(result).map((s) => s.id).sort(), ["blinded", "custom", "silenced", "stunned"]);
  }
});

test("migra identificadores sin borrar efectos ni alterar duraciones o iconos personalizados", () => {
  const effect = { id: "legacy", statuses: new Set(["stun", "stunned", "silence", "other"]),
    img: "worlds/custom.png", duration: { rounds: 3 }, disabled: true,
    flags: { "mythras-foundry": { timedCondition: { key: "stun", statusId: "stun", remaining: 2 } } } };
  assert.deepEqual(statusIconUpdates([effect]), [{ _id: "legacy", statuses: ["stunned", "silenced", "other"],
    "flags.mythras-foundry.timedCondition.key": "stunned",
    "flags.mythras-foundry.timedCondition.statusId": "stunned" }]);
  assert.deepEqual(effect.duration, { rounds: 3 });
  assert.deepEqual(statusIconUpdates([{ ...effect, statuses: new Set(["stunned", "silenced", "other"]) }]), []);
});

test("la ceguera especial de Foundry apunta al estado canónico sin alterar otros estados", () => {
  assert.deepEqual(canonicalSpecialStatuses({ BLIND: "blind", DEFEATED: "dead", INVISIBLE: "invisible" }),
    { BLIND: "blinded", DEFEATED: "dead", INVISIBLE: "invisible" });
  assert.deepEqual(canonicalStatusIds(["blind", "blinded", "stun"]), ["blinded", "stunned"]);
});
