import test from "node:test";
import assert from "node:assert/strict";
import { actorDisplayName, actorSpeaker, tokenDisplayName } from "../scripts/rules/document-names.js";

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
});
