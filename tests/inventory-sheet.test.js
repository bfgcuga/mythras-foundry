import test from "node:test";
import assert from "node:assert/strict";
import { InventorySheetController, inventoryItemsForActor,
  isNaturalWeapon } from "../scripts/ui/inventory-sheet.js";

const weapon = (id, modes, durabilitySource = "independent") => ({
  id, name: id, type: "weapon", system: { modes, durabilitySource }
});

test("las armas íntegramente naturales no forman parte del inventario", () => {
  const fist = weapon("fist", [{ key: "unarmed", handsRequired: 0, grip: "Natural" }]);
  const claw = weapon("claw", [{ key: "claw", handsRequired: 0, grip: "Natural" }],
    "hitLocation");
  const sword = weapon("sword", [{ key: "sword", handsRequired: 1, grip: "1 mano" }]);
  assert.equal(isNaturalWeapon(fist), true);
  assert.equal(isNaturalWeapon(claw), true);
  assert.equal(isNaturalWeapon(sword), false);
  assert.deepEqual(inventoryItemsForActor([fist, claw, sword]).map((item) => item.id), ["sword"]);
});

test("un arma con algún modo manufacturado permanece en el inventario", () => {
  const mixed = weapon("mixed", [
    { key: "natural", handsRequired: 0, grip: "Natural" },
    { key: "tool", handsRequired: 1, grip: "1 mano" }
  ]);
  assert.equal(isNaturalWeapon(mixed), false);
});

test("reparar un arma inutilizada solo elimina su marca operativa", async () => {
  const updates = [];
  const bow = { id: "bow", type: "weapon", system: { inoperable: true,
    currentHitPoints: 5, maxHitPoints: 8 }, async update(change) { updates.push(change); } };
  const items = new Map([[bow.id, bow]]);
  const controller = new InventorySheetController({ actor: { items }, isEditable: true });
  await controller.repairInoperableWeapon({ preventDefault() {}, currentTarget: {
    closest: () => ({ dataset: { itemId: "bow" } }) } });
  assert.deepEqual(updates, [{ "system.inoperable": false }]);
  assert.equal(bow.system.currentHitPoints, 5);
});
