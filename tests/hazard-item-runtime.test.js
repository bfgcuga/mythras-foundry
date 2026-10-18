import test from "node:test";
import assert from "node:assert/strict";
import { installHost, documentDouble, collection } from "./helpers/ui.js";
import { TRAP_SOURCES, POISON_SOURCES } from "../scripts/data/hazard-items.js";

test("las acciones de peligros respetan diálogos, permisos, protecciones y cancelación", async (t) => {
  const { foundry } = installHost(t);
  const originalMessage = globalThis.ChatMessage;
  const originalRoll = globalThis.Roll;
  t.after(() => { globalThis.ChatMessage = originalMessage; globalThis.Roll = originalRoll; });
  const messages = [], formulas = [], applied = [], dialogs = [];
  let answers = [], totals = [];
  const rolls = await import("../scripts/rules/system-roll.js");
  t.mock.module("../scripts/rules/system-roll.js", { namedExports: { ...rolls,
    evaluateSystemRoll: async (formula) => { formulas.push(formula); return { total: totals.shift(), toJSON: () => ({}) }; }
  } });
  t.mock.module("../scripts/rules/direct-damage.js", { namedExports: {
    applyDirectDamage: async (actor, configuration) => { applied.push({ actor, configuration }); return configuration; }
  } });
  globalThis.ChatMessage = { create: async (data) => { messages.push(data); return data; }, getSpeaker: () => ({}) };
  globalThis.Roll = { validate: (formula) => /^\d+d\d+(\+\d+)?$/.test(formula) };
  const ability = documentDouble({ id: "evade", name: "Evadir", type: "skill",
    system: { slug: "evadir", total: 80, characteristic1: "dexterity", characteristic2: "dexterity" } });
  const location = documentDouble({ id: "arm", type: "hitLocation", name: "Brazo",
    system: { rangeStart: 1, rangeEnd: 20, armorPoints: 3, currentHitPoints: 5, maxHitPoints: 5 } });
  const actor = documentDouble({ name: "Víctima", system: { strength: 12, fatigueLevel: "fresh" },
    items: collection([ability, location]) });
  ability.actor = actor;
  game.actors = collection([actor]);
  foundry.applications.api.DialogV2.wait = async (configuration) => { dialogs.push(configuration); return answers.shift() ?? null; };
  const { rollHazardCheck, rollHazardDamage } = await import("../scripts/rules/hazard-item-runtime.js");
  const reset = () => { answers = []; totals = []; messages.length = formulas.length = applied.length = dialogs.length = 0; actor.isOwner = true; game.user.isGM = true; };

  await t.test("cancelar la selección o la configuración no tira ni publica", async () => {
    reset(); answers = [null];
    assert.equal(await rollHazardCheck(TRAP_SOURCES[0]), null);
    answers = [{ ability: 0, variant: -1 }, null];
    assert.equal(await rollHazardCheck(TRAP_SOURCES[0]), null);
    assert.equal(formulas.length, 0); assert.equal(messages.length, 0);
  });

  await t.test("una alternativa Difícil usa la dificultad elegida y publica ambos resultados", async () => {
    reset(); answers = [{ ability: 0, variant: 1 }, { difficulty: "hard" }]; totals = [20, 50];
    const result = await rollHazardCheck(POISON_SOURCES[2]);
    assert.equal(result.participants[0].target, 54);
    assert.equal(result.participants[1].target, 75);
    assert.deepEqual(formulas, ["1d100", "1d100"]);
    assert.equal(messages.length, 1);
    assert.match(messages[0].content, /Mordedura/);
    assert.match(messages[0].content, /Asfixia/);
    assert.doesNotMatch(messages[0].content, /MYTHRASF\./);
    assert.equal(applied.length, 0);
    assert.equal(location.system.currentHitPoints, 5);
  });

  await t.test("un no propietario no puede tirar y perder permisos durante el diálogo cancela", async () => {
    reset(); actor.isOwner = false;
    assert.equal(await rollHazardCheck(TRAP_SOURCES[0]), null);
    assert.equal(dialogs.length, 0);
    actor.isOwner = true;
    const wait = foundry.applications.api.DialogV2.wait;
    foundry.applications.api.DialogV2.wait = async () => { actor.isOwner = false; return { ability: 0, variant: -1 }; };
    assert.equal(await rollHazardCheck(TRAP_SOURCES[0]), null);
    foundry.applications.api.DialogV2.wait = wait;
    assert.equal(formulas.length, 0);
  });

  await t.test("el daño sin objetivo solo tira y no altera PG", async () => {
    reset(); answers = [{ actor: "", variant: -1 }]; totals = [10];
    await rollHazardDamage(TRAP_SOURCES[2]);
    assert.deepEqual(formulas, ["2d8"]);
    assert.equal(applied.length, 0);
    assert.equal(messages.length, 1);
  });

  await t.test("cancelar la confirmación conserva la tirada sin aplicar daño", async () => {
    reset(); answers = [{ actor: "0", variant: -1 }, null]; totals = [10, 5];
    await rollHazardDamage(TRAP_SOURCES[2]);
    assert.equal(applied.length, 0);
    assert.equal(messages.length, 1);
    assert.match(dialogs[1].content, /value="7"/);
    assert.equal(location.system.currentHitPoints, 5);
  });

  await t.test("el daño confirmado usa la cantidad final una sola vez y la localización tirada", async () => {
    reset(); answers = [{ actor: "0", variant: -1 }, 4]; totals = [10, 5];
    await rollHazardDamage(TRAP_SOURCES[2]);
    assert.equal(applied.length, 1);
    assert.deepEqual(applied[0].configuration, { mode: "fixed", amount: 4, locationIds: ["arm"] });
    assert.deepEqual(formulas, ["2d8", "1d20"]);
    reset(); answers = [{ actor: "0", variant: -1 }, 10]; totals = [10, 5];
    await rollHazardDamage(TRAP_SOURCES[0]);
    assert.match(dialogs[1].content, /value="10"/);
  });

  await t.test("solo el DJ puede aplicar daño y una fórmula inválida no tira", async () => {
    reset(); game.user.isGM = false; answers = [{ actor: "0", variant: -1 }];
    assert.equal(await rollHazardDamage(TRAP_SOURCES[0]), null);
    assert.equal(formulas.length, 0);
    reset(); answers = [{ actor: "", variant: -1 }];
    const broken = structuredClone(TRAP_SOURCES[0]); broken.system.damage = "invalid";
    assert.equal(await rollHazardDamage(broken), null);
    assert.equal(formulas.length, 0);
    assert.equal(applied.length, 0);
  });
});
