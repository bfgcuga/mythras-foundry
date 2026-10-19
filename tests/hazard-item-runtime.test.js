import test from "node:test";
import assert from "node:assert/strict";
import { installHost, documentDouble, collection } from "./helpers/ui.js";
import { TRAP_SOURCES, POISON_SOURCES, DISEASE_SOURCES } from "../scripts/data/hazard-items.js";

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
  const statuses = [];
  actor.toggleStatusEffect = async (id, options) => { statuses.push({ id, options }); actor.statuses.add(id); };
  ability.actor = actor;
  game.actors = collection([actor]);
  foundry.applications.api.DialogV2.wait = async (configuration) => { dialogs.push(configuration); return answers.shift() ?? null; };
  const { applyHazardStatus, openHazardApplication, rollHazardCheck, rollHazardDamage } = await import("../scripts/rules/hazard-item-runtime.js");
  const reset = () => { answers = []; totals = []; messages.length = formulas.length = applied.length = dialogs.length = 0; actor.isOwner = true; game.user.isGM = true; statuses.length = 0; actor.statuses.clear(); };

  await t.test("aplicar veneno o enfermedad activa un único marcador y respeta permisos", async () => {
    reset();
    assert.equal(await applyHazardStatus(POISON_SOURCES[0], actor), "poison");
    await applyHazardStatus(POISON_SOURCES[0], actor);
    assert.equal(await applyHazardStatus(DISEASE_SOURCES[0], actor), "disease");
    assert.deepEqual(statuses.map((entry) => entry.id), ["poison", "disease"]);
    assert.ok(statuses.every((entry) => entry.options.active === true));
    assert.equal(await applyHazardStatus(TRAP_SOURCES[0], actor), null);
    actor.isOwner = false;
    assert.equal(await applyHazardStatus(POISON_SOURCES[0], actor), null);
    assert.equal(statuses.length, 2);
  });

  await t.test("Aplicar permite elegir el primer personaje y cancelar no activa estados", async () => {
    reset(); answers = [null];
    assert.equal(await openHazardApplication(POISON_SOURCES[0]), null);
    assert.equal(statuses.length, 0);
    answers = [0];
    assert.equal(await openHazardApplication(DISEASE_SOURCES[0]), "disease");
    assert.match(messages[0].content, /Enfermo/);
    assert.equal(formulas.length, 0);
  });

  await t.test("la resistencia activa el marcador solo si gana el veneno o enfermedad", async () => {
    for (const source of [POISON_SOURCES[0], DISEASE_SOURCES[0]]) {
      for (const [actorRoll, hazardRoll, applies] of [[90, 10, true], [10, 90, false], [95, 95, false]]) {
        reset(); answers = [{ ability: 0, variant: -1 }, { difficulty: "standard" }]; totals = [actorRoll, hazardRoll];
        await rollHazardCheck(source);
        assert.equal(statuses.length, applies ? 1 : 0, `${source.type}: ${actorRoll}/${hazardRoll}`);
        if (applies) assert.equal(statuses[0].id, source.type);
      }
    }
  });

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

  await t.test("el daño de una aflicción activa su estado únicamente al confirmarlo", async () => {
    const poison = structuredClone(POISON_SOURCES[0]); poison.system.damage = "1d6";
    reset(); answers = [{ actor: "0", variant: -1 }, null]; totals = [4, 5];
    await rollHazardDamage(poison);
    assert.equal(statuses.length, 0);
    reset(); answers = [{ actor: "", variant: -1 }]; totals = [4];
    await rollHazardDamage(poison);
    assert.equal(statuses.length, 0);
    reset(); answers = [{ actor: "0", variant: -1 }, 1]; totals = [4, 5];
    await rollHazardDamage(poison);
    assert.equal(statuses[0].id, "poison");
    assert.equal(applied.length, 1);
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
