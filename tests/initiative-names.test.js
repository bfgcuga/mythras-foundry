import test from "node:test";
import assert from "node:assert/strict";

test("la iniciativa individual y grupal resuelve nombres actuales aunque el Combatant esté obsoleto", async (t) => {
  t.mock.module("../scripts/rules/action-points.js", { namedExports: {
    ...await import("../scripts/rules/action-points.js"),
    currentActionPoints: () => 2, effectiveActionPointMaximum: () => 2,
    combatantActionPointState: () => ({})
  } });
  t.mock.module("../scripts/rules/actor-conditions.js", { namedExports: {
    ...await import("../scripts/rules/actor-conditions.js"),
    resolveActorConditions: () => ({ attributes: { initiative: 12 } })
  } });
  let die = 0;
  t.mock.module("../scripts/rules/system-roll.js", { namedExports: {
    ...await import("../scripts/rules/system-roll.js"),
    manualRollRequested: () => false,
    evaluateSystemRoll: async () => ({ total: ++die, toJSON: () => ({ total: die }) }),
    runSystemRollAction: (action) => action()
  } });
  const messages = [];
  const globals = {
    Combat: class {},
    game: { actors: new Map([["hero", { name: "Hodei" }], ["npc", { name: "Vikingo" }]]),
      settings: { get: () => false }, i18n: { localize: (key) => key, format: (key) => key } },
    ChatMessage: { getSpeaker: () => ({ actor: "hero", alias: "prueba final" }),
      create: async (data) => messages.push(data) }
  };
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
  const { MythrasCombat } = await import("../scripts/documents/mythras-combat.js");
  const hero = { id: "hero", type: "character", name: "prueba final", isToken: true,
    token: { actorId: "hero" }, system: {} };
  const npc = { id: "npc", type: "npc", name: "Vikingo", isToken: true,
    token: { actorId: "npc" }, system: {} };
  const entries = [
    { id: "h", actor: hero, name: "prueba final", token: { actor: hero, _source: { name: "prueba final" } } },
    { id: "n", actor: npc, name: "a", token: { actor: npc, _source: { name: "Vikingo 2" }, name: "a" } }
  ].map((entry) => ({ ...entry, initiative: null, getFlag: () => null }));
  const combat = new MythrasCombat();
  combat.combatants = entries;
  combat.combatants.get = (id) => entries.find((entry) => entry.id === id);
  combat.updateEmbeddedDocuments = async () => {};
  for (const entry of entries) {
    await combat.rollInitiative(entry.id, { updateTurn: false });
  }
  await combat.rollInitiative(["h", "n"], { updateTurn: false });
  for (const [index, name] of ["Hodei", "Vikingo 2"].entries()) {
    assert.match(messages[index].content, new RegExp(`<legend>${name}</legend>`));
    assert.equal(messages[index].speaker.alias, name);
    assert.match(messages[2].content, new RegExp(`<legend>${name}</legend>`));
  }
  for (const message of messages) assert.doesNotMatch(message.content, /prueba final|<legend>a<\/legend>/);
});
