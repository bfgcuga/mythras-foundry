import test from "node:test";
import assert from "node:assert/strict";

import { isGenericItemName, nextNumberedItemName } from "../scripts/rules/item-names.js";

const es = (key) => ({
  "TYPES.Item.culture": "Cultura",
  "TYPES.Item.profession": "Profesión",
  "MYTHRASF.Item.New.culture": "Nueva cultura",
  "DOCUMENT.Item": "Item"
})[key] ?? key;

test("los nombres nuevos se numeran por tipo y reutilizan huecos", () => {
  const documents = [
    { type: "culture", name: "Cultura 1" },
    { type: "culture", name: "Cultura 3" },
    { type: "profession", name: "Profesión 2" }
  ];
  assert.equal(nextNumberedItemName("culture", documents, es), "Cultura 2");
  assert.equal(nextNumberedItemName("profession", documents, es), "Profesión 1");
});

test("solo se sustituyen nombres genéricos de creación", () => {
  assert.equal(isGenericItemName("Item", "culture", es), true);
  assert.equal(isGenericItemName("Nueva cultura", "culture", es), true);
  assert.equal(isGenericItemName("Civilizada", "culture", es), false);
});
