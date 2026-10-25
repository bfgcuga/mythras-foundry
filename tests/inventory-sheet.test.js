import test from "node:test";
import assert from "node:assert/strict";
import { InventorySheetController, inventoryItemsForActor,
  isNaturalWeapon, itemRepairUpdate, prepareInventoryView } from "../scripts/ui/inventory-sheet.js";

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

test("reparar restaura durabilidad y elimina inutilizada sin recuperar ni equipar", async () => {
  globalThis.game = { i18n: { localize: key => key, format: (key, data) => data.item } };
  let checked = false;
  let cancelled = false;
  globalThis.foundry = { utils: { escapeHTML: value => value }, applications: { api: {
    DialogV2: { input: async options => {
      assert.match(options.content, /name="repairConditions" required/);
      return cancelled ? null : options.ok.callback(null, { form: { elements: {
        repairConditions: { checked }
      } } });
    } }
  } } };
  const updates = [];
  const bow = { id: "bow", name: "Bow", type: "weapon", system: { inoperable: true,
    thrown: true, equipped: false, currentHitPoints: 0, maxHitPoints: 8 },
    async update(change) { updates.push(change); } };
  const controller = new InventorySheetController({ actor: { items: new Map([[bow.id, bow]]) }, isEditable: true });
  const event = { preventDefault() {}, currentTarget: {
    closest: () => ({ dataset: { itemId: "bow" } }) } };
  await controller.repairInoperableWeapon(event);
  assert.deepEqual(updates, []);
  checked = true; cancelled = true;
  await controller.repairInoperableWeapon(event);
  assert.deepEqual(updates, []);
  cancelled = false;
  await controller.repairInoperableWeapon(event);
  assert.deepEqual(updates, [{ "system.currentHitPoints": 8, "system.inoperable": false }]);
  controller.sheet.isEditable = false;
  await controller.repairInoperableWeapon(event);
  assert.equal(updates.length, 1);
});

test("el inventario ofrece reparación para daños e inutilización y la omite en objetos intactos", () => {
  globalThis.game = { i18n: { localize: key => key } };
  const sword = weapon("sword", [{ key: "sword", handsRequired: 1, grip: "1 mano" }]);
  Object.assign(sword.system, { currentHitPoints: 3, maxHitPoints: 8 });
  const armor = { id: "armor", type: "armor", system: { armorPoints: 0, maxArmorPoints: 6 } };
  const intact = { id: "intact", type: "armor", system: { armorPoints: 6, maxArmorPoints: 6 } };
  const equipment = { id: "bag", type: "equipment", system: {} };
  assert.deepEqual(itemRepairUpdate(armor), { "system.armorPoints": 6 });
  assert.equal(itemRepairUpdate(intact), null);
  assert.equal(itemRepairUpdate(equipment), null);
  const rows = prepareInventoryView([sword, armor, intact, equipment]).rows;
  assert.deepEqual(rows.filter(row => row.damagedForRepair).map(row => row.id).sort(), ["armor", "sword"]);
});
