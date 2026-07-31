import test from "node:test";
import assert from "node:assert/strict";

import { ITEM_TYPE_ICONS, defaultItemIcon } from "../scripts/data/item-icons.js";

test("cada tipo de Item del sistema tiene un icono predeterminado", () => {
  for (const type of [
    "skill", "combatStyle", "culture", "profession", "passion", "equipment", "weapon"
  ]) {
    assert.match(ITEM_TYPE_ICONS[type], /^icons\/svg\/.+\.svg$/);
  }
  assert.notEqual(defaultItemIcon("skill"), defaultItemIcon("passion"));
  assert.notEqual(defaultItemIcon("culture"), defaultItemIcon("profession"));
});
