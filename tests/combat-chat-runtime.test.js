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
