import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { characterTokenLinkUpdates } from "../scripts/rules/token-linking.js";

test("los tokens de personaje se enlazan y los PNJ conservan instancias independientes", () => {
  const actors = new Map([
    ["hero", { type: "character" }],
    ["creature", { type: "npc" }]
  ]);
  const updates = characterTokenLinkUpdates([
    { id: "hero-unlinked", actorId: "hero", actorLink: false },
    { id: "hero-linked", actorId: "hero", actorLink: true },
    { id: "creature-unlinked", actorId: "creature", actorLink: false }
  ], actors);
  assert.deepEqual(updates, [{ _id: "hero-unlinked", actorLink: true }]);
});

test("la creación configura personajes enlazados y PNJ independientes", async () => {
  const entrypoint = await readFile(new URL("../scripts/mythras-foundry.js", import.meta.url),
    "utf8");
  assert.match(entrypoint,
    /type === "character"\) actor\.updateSource\(\{ "prototypeToken\.actorLink": true \}\)/);
  assert.match(entrypoint,
    /type === "npc"\) actor\.updateSource\(\{ "prototypeToken\.actorLink": false \}\)/);
});
