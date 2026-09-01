import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("el selector general de ataque conserva Shift al lanzar el arma elegida", async () => {
  const source = await readFile(new URL("../scripts/ui/combat-sheet.js", import.meta.url), "utf8");
  assert.match(source, /chooseWeaponAttack\(event\)/);
  assert.match(source, /const manual = Boolean\(event\?\.shiftKey\)/);
  assert.match(source, /new MouseEvent\("click", \{[\s\S]*shiftKey: manual/);
  assert.match(source, /createAttackMessage\([\s\S]*manual \}/);
});
