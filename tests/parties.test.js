import test from "node:test";
import assert from "node:assert/strict";

import { createPartyApi } from "../scripts/api/party-api.js";
import { normalizePartyConfig, removeParty, sanitizePartyConfig } from "../scripts/rules/parties.js";

const characters = [
  { id: "hero-a", name: "A", type: "character", folder: "old" },
  { id: "hero-b", name: "B", type: "character", folder: "new" },
  { id: "npc", name: "NPC", type: "npc" }
];

test("normaliza grupos, miembros duplicados y grupo activo", () => {
  assert.deepEqual(normalizePartyConfig({
    activePartyId: "missing",
    parties: [
      { id: "main", name: " Principal ", memberIds: ["hero-a", "hero-a"] },
      { id: "main", name: "Duplicado", memberIds: [] },
      { id: "empty", name: "", memberIds: [] }
    ]
  }), {
    version: 1,
    activePartyId: "main",
    parties: [{ id: "main", name: "Principal", memberIds: ["hero-a"] }]
  });
});

test("el saneado conserva solo actores de personaje existentes", () => {
  const config = sanitizePartyConfig({
    activePartyId: "main",
    parties: [{ id: "main", name: "Grupo", memberIds: ["hero-a", "npc", "deleted"] }]
  }, characters);
  assert.deepEqual(config.parties[0].memberIds, ["hero-a"]);
});

test("eliminar el grupo activo selecciona el primer grupo restante", () => {
  const config = removeParty({
    activePartyId: "one",
    parties: [
      { id: "one", name: "Uno", memberIds: [] },
      { id: "two", name: "Dos", memberIds: [] }
    ]
  }, "one");
  assert.equal(config.activePartyId, "two");
});

test("la API resuelve miembros sin depender de nombre o carpeta", () => {
  let config = {
    activePartyId: "main",
    parties: [{ id: "main", name: "Grupo", memberIds: ["hero-a", "deleted", "npc"] }]
  };
  const actors = new Map(characters.map((actor) => [actor.id, actor]));
  const api = createPartyApi({ getConfig: () => config, getActors: () => actors });

  assert.deepEqual(api.getActiveMembers(), [characters[0]]);
  characters[0].name = "Renombrado";
  characters[0].folder = "otra";
  assert.equal(api.getMembers("main")[0].name, "Renombrado");
  const exposed = api.parties;
  exposed[0].name = "Mutado";
  assert.equal(api.getParty("main").name, "Grupo");

  config = { activePartyId: "", parties: [] };
  assert.equal(api.getActiveParty(), null);
  assert.deepEqual(api.getActiveMembers(), []);
});

test("la API puede delegar la apertura del gestor", () => {
  const manager = { rendered: true };
  const api = createPartyApi({
    getConfig: () => ({}),
    getActors: () => new Map(),
    openManager: () => manager
  });
  assert.equal(api.openManager(), manager);
});
