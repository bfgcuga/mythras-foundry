import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { ITEM_TYPE_ICONS, defaultItemIcon } from "../scripts/data/item-icons.js";

test("cada tipo de Item del sistema tiene un icono predeterminado", () => {
  for (const type of [
    "skill", "combatStyle", "culture", "profession", "passion", "equipment", "weapon", "hitLocation"
  ]) {
    assert.match(ITEM_TYPE_ICONS[type], /\.svg$/);
  }
  assert.notEqual(defaultItemIcon("skill"), defaultItemIcon("passion"));
  assert.notEqual(defaultItemIcon("culture"), defaultItemIcon("profession"));
  for (const icon of [defaultItemIcon("passion"), defaultItemIcon("combatStyle")]) {
    const relative = icon.replace("systems/mythras-foundry/", "../");
    assert.ok(existsSync(new URL(relative, import.meta.url)), `${icon} debe existir`);
  }
});
