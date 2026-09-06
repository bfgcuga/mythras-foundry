import test from "node:test";
import assert from "node:assert/strict";
import { registerCombatSocketRuntime } from "../scripts/rules/combat-chat-runtime.js";

test("el runtime de socket enruta únicamente acciones válidas al coordinador", async () => {
  let listener = null;
  const calls = [];
  const message = { getFlag: () => ({ authorUserId: "author" }) };
  registerCombatSocketRuntime({ socket: { on: (channel, callback) => {
    assert.equal(channel, "system.mythras-foundry"); listener = callback;
  } }, messages: new Map([["message", message]]), users: [], currentUserId: "gm",
  coordinator: () => "gm", handlers: { combatDamage: (...args) => calls.push(args) } });

  await listener({ action: "unknown", messageId: "message" });
  await listener({ action: "combatDamage", messageId: "message" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], message);
});

test("un cliente que no coordina no ejecuta la mutación", async () => {
  let listener = null; let called = false;
  registerCombatSocketRuntime({ socket: { on: (channel, callback) => { listener = callback; } },
    messages: new Map([["message", { getFlag: () => ({ authorUserId: "author" }) }]]),
    users: [], currentUserId: "player", coordinator: () => "gm",
    handlers: { combatDamage: () => { called = true; } } });
  await listener({ action: "combatDamage", messageId: "message" });
  assert.equal(called, false);
});

test("el runtime enruta el gasto de suerte de una herida crítica", async () => {
  let listener = null; let called = false;
  const message = { getFlag: () => ({ authorUserId: "author" }) };
  registerCombatSocketRuntime({ socket: { on: (channel, callback) => { listener = callback; } },
    messages: new Map([["message", message]]), users: [], currentUserId: "gm",
    coordinator: () => "gm", handlers: { combatWoundLuck: () => { called = true; } } });
  await listener({ action: "combatWoundLuck", messageId: "message" });
  assert.equal(called, true);
});

test("el runtime enruta la elección del objeto soltado", async () => {
  let called = false;
  const socket = { on: (channel, callback) => { socket.callback = callback; } };
  registerCombatSocketRuntime({ socket, messages: new Map([["m", {
    getFlag: () => ({ authorUserId: "author" }) }]]), users: [], currentUserId: "gm",
  coordinator: () => "gm", handlers: { combatDropHeldItem: () => { called = true; } } });
  await socket.callback({ action: "combatDropHeldItem", messageId: "m" });
  assert.equal(called, true);
});

test("el runtime enruta la respuesta extraordinaria de Ardid", async () => {
  let called = false;
  const socket = { on: (channel, callback) => { socket.callback = callback; } };
  registerCombatSocketRuntime({ socket, messages: new Map([["m", {
    getFlag: () => ({ authorUserId: "author" }) }]]), users: [], currentUserId: "gm",
  coordinator: () => "gm", handlers: { combatRuseReplacement: () => { called = true; } } });
  await socket.callback({ action: "combatRuseReplacement", messageId: "m" });
  assert.equal(called, true);
});

test("la autorización de rendición se ejecuta solo en el DJ coordinador", async () => {
  let called = false;
  const socket = { on: (channel, callback) => { socket.callback = callback; } };
  const message = { getFlag: () => ({ authorUserId: "author" }) };
  registerCombatSocketRuntime({ socket, messages: new Map([["m", message]]), users: [],
    currentUserId: "gm", coordinator: () => "gm",
    handlers: { combatSurrenderAuthorization: () => { called = true; } } });
  await socket.callback({ action: "combatSurrenderAuthorization", messageId: "m" });
  assert.equal(called, true);
});

test("la respuesta de autorización vuelve directamente al cliente destinatario", async () => {
  let received = null;
  const socket = { on: (channel, callback) => { socket.callback = callback; } };
  registerCombatSocketRuntime({ socket, messages: new Map(), users: [], currentUserId: "player",
    coordinator: assert.fail, handlers: {}, directHandlers: {
      combatSurrenderAuthorizationResult: (request) => { received = request; }
    } });
  const request = { action: "combatSurrenderAuthorizationResult", targetUserId: "player" };
  await socket.callback(request);
  assert.equal(received, request);
});

test("el runtime enruta la autorización y el segundo blanco de penetración", async () => {
  const calls = [];
  const socket = { on: (channel, callback) => { socket.callback = callback; } };
  registerCombatSocketRuntime({ socket, messages: new Map([["m", {
    getFlag: () => ({ authorUserId: "author" }) }]]), users: [], currentUserId: "gm",
  coordinator: () => "gm", handlers: {
    combatPenetrationAuthorization: () => calls.push("authorization"),
    combatPenetrationTarget: () => calls.push("target") } });
  await socket.callback({ action: "combatPenetrationAuthorization", messageId: "m" });
  await socket.callback({ action: "combatPenetrationTarget", messageId: "m" });
  assert.deepEqual(calls, ["authorization", "target"]);
});

test("el runtime enruta la autorización para sortear cobertura", async () => {
  let called = false;
  const socket = { on: (channel, callback) => { socket.callback = callback; } };
  registerCombatSocketRuntime({ socket, messages: new Map([["m", {
    getFlag: () => ({ authorUserId: "author" }) }]]), users: [], currentUserId: "gm",
  coordinator: () => "gm", handlers: {
    combatCoverAuthorization: () => { called = true; } } });
  await socket.callback({ action: "combatCoverAuthorization", messageId: "m" });
  assert.equal(called, true);
});

test("el runtime enruta la autorización y la víctima de Escoger Objetivo", async () => {
  const calls = [];
  const socket = { on: (channel, callback) => { socket.callback = callback; } };
  registerCombatSocketRuntime({ socket, messages: new Map([["m", {
    getFlag: () => ({ authorUserId: "author" }) }]]), users: [], currentUserId: "gm",
  coordinator: () => "gm", handlers: {
    combatChosenTargetAuthorization: () => calls.push("authorization"),
    combatChosenTarget: () => calls.push("target") } });
  await socket.callback({ action: "combatChosenTargetAuthorization", messageId: "m" });
  await socket.callback({ action: "combatChosenTarget", messageId: "m" });
  assert.deepEqual(calls, ["authorization", "target"]);
});
