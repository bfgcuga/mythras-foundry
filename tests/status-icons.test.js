import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { statusIcon, statusIconUpdates } from "../scripts/data/status-icons.js";
import { MYTHRAS_STATUS_EFFECTS } from "../scripts/rules/statuses.js";
import { CORE_STATUS_IDS } from "../scripts/ui/status-catalog.js";

test("todos los estados tienen un PNG cuadrado y las variantes comparten dibujo", () => {
  for (const id of [...CORE_STATUS_IDS, "incapacitated", ...MYTHRAS_STATUS_EFFECTS.map((s) => s.id)]) {
    const img = statusIcon(id);
    assert.ok(img, id);
    const path = new URL(`../${img.replace("systems/mythras-foundry/", "")}`, import.meta.url);
    assert.ok(existsSync(path), id);
    const png = readFileSync(path);
    assert.equal(png.readUInt32BE(16), 144, id);
    assert.equal(png.readUInt32BE(20), 144, id);
  }
  assert.equal(statusIcon("stun"), statusIcon("stunned"));
  assert.equal(statusIcon("silence"), statusIcon("silenced"));
  assert.equal(statusIcon("shieldfire"), statusIcon("fireShield"));
});

test("la actualización de efectos existentes conserva imágenes personalizadas y es idempotente", () => {
  const effects = [
    { id: "old", img: "icons/svg/blood.svg", statuses: new Set(["bleeding"]) },
    { id: "new", img: statusIcon("poison"), statuses: new Set(["poison"]) },
    { id: "custom", img: "worlds/my-world/custom.png", statuses: new Set(["poison"]) },
    { id: "other", img: "icons/svg/aura.svg", statuses: new Set(["unknown"]) }
  ];
  assert.deepEqual(statusIconUpdates(effects), [{ _id: "old", img: statusIcon("bleeding") }]);
  assert.deepEqual(statusIconUpdates([{ ...effects[0], img: statusIcon("bleeding") }]), []);
});
