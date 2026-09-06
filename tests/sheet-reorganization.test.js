import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { askWoundRollImpact, woundRollRisks } from "../scripts/ui/wound-roll-dialog.js";
import { silhouetteRegionId } from "../scripts/ui/body-silhouette.js";

test("la orientación frontal refleja las localizaciones laterales de la silueta", () => {
  assert.equal(silhouetteRegionId("leftArm", "front"), "right-arm");
  assert.equal(silhouetteRegionId("rightLeg", "front"), "left-leg");
  assert.equal(silhouetteRegionId("leftArm", "back"), "left-arm");
  assert.equal(silhouetteRegionId("head", "front"), "head");
});

test("las consecuencias narrativas distinguen herida grave y miembro inutilizable", () => {
  const locations = [{ id: "arm", type: "hitLocation", name: "Brazo",
    system: { currentHitPoints: 0, maxHitPoints: 5, disabled: false,
      permanentWound: { severity: 0 } } },
  { id: "leg", type: "hitLocation", name: "Pierna",
    system: { currentHitPoints: 5, maxHitPoints: 5, disabled: false,
      permanentWound: { severity: 3 } } },
  { id: "other-arm", type: "hitLocation", name: "Otro brazo",
    system: { currentHitPoints: 5, maxHitPoints: 5, disabled: true,
      permanentWound: { severity: 0 } } }];
  const risks = woundRollRisks({ items: locations });
  assert.deepEqual(risks.serious.map((item) => item.id), ["arm"]);
  assert.deepEqual(risks.unusable.map((item) => item.id), ["other-arm"]);
});

test("la consulta de heridas no descarta tiradas mediante una clasificación física", async () => {
  const previousFoundry = globalThis.foundry;
  const previousGame = globalThis.game;
  let opened = false;
  globalThis.foundry = { utils: { escapeHTML: String }, applications: { api: { DialogV2: {
    wait: async () => { opened = true; return { seriousPenalty: true, unusableMember: false }; }
  } } } };
  globalThis.game = { i18n: { format: (key, data) => `${key}:${data.location}`,
    localize: (key) => key } };
  try {
    const actor = { items: [{ id: "arm", type: "hitLocation", name: "Brazo",
      system: { currentHitPoints: 0, maxHitPoints: 5, disabled: false,
        permanentWound: { severity: 0 } } }], effects: [] };
    const impact = await askWoundRollImpact(actor, { physical: false });
    assert.equal(opened, true);
    assert.equal(impact.seriousPenalty, true);
  } finally {
    globalThis.foundry = previousFoundry;
    globalThis.game = previousGame;
  }
});

test("los ataques tratan una extremidad enredada elegida como imposible", () => {
  for (const path of ["../scripts/sheets/character-sheet.js", "../scripts/sheets/npc-sheet.js"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /impact\.unusableMember \|\| impact\.entangledMember/);
  }
});
