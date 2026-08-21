import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { actorDisplayName, actorSpeaker, tokenDisplayName,
  updateActorFromSheet } from "../scripts/rules/document-names.js";

test("characters always use the current directory Actor name", () => {
  globalThis.game = { actors: new Map([["actor-id", { name: "Hodei" }]]) };
  const actor = { id: "synthetic", type: "character", name: "prueba final",
    isToken: true, token: { actorId: "actor-id", name: "prueba final" } };
  assert.equal(actorDisplayName(actor), "Hodei");
  assert.equal(tokenDisplayName({ actor, document: { name: "prueba final" } }), "Hodei");
  globalThis.ChatMessage = { getSpeaker: () => ({ actor: "actor-id", alias: "prueba final" }) };
  assert.deepEqual(actorSpeaker(actor), { actor: "actor-id", alias: "Hodei" });
});

test("unlinked NPCs use each TokenDocument name", () => {
  globalThis.game = { actors: new Map() };
  const actor = { id: "npc", type: "npc", name: "Hombre lagarto", isToken: true,
    token: { name: "Hombre lagarto 1" } };
  assert.equal(actorDisplayName(actor), "Hombre lagarto 1");
  assert.equal(tokenDisplayName({ actor, document: { name: "Hombre lagarto 2" } }), "Hombre lagarto 2");
  assert.equal(tokenDisplayName({ actor, document: { _source: { name: "Hombre lagarto 3" },
    name: "Hombre lagarto" } }), "Hombre lagarto 3");
});

test("renaming an unlinked token Actor from its sheet also renames that Token", async () => {
  const tokenUpdates = [];
  const token = { name: "Hombre lagarto", isLinked: false,
    update: async (changes) => { tokenUpdates.push(changes); Object.assign(token, changes); } };
  const actor = { name: "Hombre lagarto", isToken: true, token,
    update: async (changes) => { Object.assign(actor, changes); } };
  await updateActorFromSheet(actor, { name: "Hombre lagarto 2", "system.notes": "" });
  assert.equal(actor.name, "Hombre lagarto 2");
  assert.equal(token.name, "Hombre lagarto 2");
  assert.deepEqual(tokenUpdates, [{ name: "Hombre lagarto 2" }]);
});

test("sheet updates do not rename linked tokens or templates", async () => {
  for (const actor of [
    { name: "Plantilla", isToken: false },
    { name: "Enlazado", isToken: true, token: { name: "Token", isLinked: true } }
  ]) {
    let tokenUpdated = false;
    if (actor.token) actor.token.update = async () => { tokenUpdated = true; };
    actor.update = async (changes) => { Object.assign(actor, changes); };
    await updateActorFromSheet(actor, { name: "Nuevo nombre" });
    assert.equal(tokenUpdated, false);
  }
});

test("the NPC sheet persists name changes through the shared token-aware updater", () => {
  const sheet = fs.readFileSync(new URL("../scripts/sheets/npc-sheet.js", import.meta.url), "utf8");
  assert.match(sheet, /submitOnChange: true/);
  assert.match(sheet, /updateActorFromSheet\(this\.actor, formData\.object\)/);
});
