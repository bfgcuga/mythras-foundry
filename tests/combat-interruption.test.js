import test from "node:test";
import assert from "node:assert/strict";
import { collection, documentDouble, setPath, render, dom } from "./helpers/ui.js";
import { applyInterruptionRequest, combatInterruption, canStartProactiveAction, interruptionBlocksMessage,
  bindInterruptionAction, finishInterruptionAction, submitInterruption, activateInterruptionCard,
  registerInterruptionSocket } from "../scripts/rules/combat-interruption.js";
import { spendActorActionPoint } from "../scripts/rules/combat-resource-runtime.js";
import { executeAction, decorateCombatActionButtons, registerCombatActionSocket } from "../scripts/rules/combat-action-runtime.js";
import { reloadRangedWeapon } from "../scripts/rules/ranged-actions.js";
import { advanceCombatExchange, applyCombatExchangeCancellation } from "../scripts/rules/combat-exchange-runtime.js";

const scope = "mythras-foundry";
function setup(t, { paid = false, type = "character" } = {}) {
  const docs = new Map(); let serial = 0;
  const makeActor = (id, owner, actorType = "character") => {
    const actor = documentDouble({ id, uuid: `Actor.${id}`, name: id, type: actorType,
      system: { strength: 12, dexterity: 12, intelligence: 12, constitution: 12, size: 12,
        resources: { actionPoints: { value: 2 } } }, flags: {} });
    actor.testUserPermission = user => user.id === owner;
    actor.setFlag = async (namespace, key, value) => setPath(actor, `flags.${namespace}.${key}`, value);
    actor.createEmbeddedDocuments = async (kind, entries) => {
      const result = entries.map(data => documentDouble({ ...data, id: `e${++serial}` }));
      actor.effects.push(...result); return result;
    };
    actor.deleteEmbeddedDocuments = async (kind, ids) => { actor.effects = actor.effects.filter(e => !ids.includes(e.id)); };
    docs.set(actor.uuid, actor); return actor;
  };
  const actor = makeActor("waiting", "owner", type);
  const other = makeActor("active", "other");
  const entries = collection([{ id: "a", actor, initiative: 20 }, { id: "b", actor: other, initiative: 10 }]);
  const combat = documentDouble({ id: "combat", uuid: "Combat.combat", started: true, round: 1, turn: 1,
    combatants: entries, turns: entries, flags: { [scope]: { combatActions: { schemaVersion: 2, actions: {},
      delays: { a: { status: "reserved", payment: "onReaction", declaredRound: 1, declaredCycle: 1, expiresRound: 1, expiresCycle: 2 } } } } },
    mythrasTurnEconomy: { revision: 2, cycle: 1 } });
  Object.defineProperty(combat, "combatant", { get: () => entries[combat.turn] });
  combat.setFlag = async (namespace, key, value) => setPath(combat, `flags.${namespace}.${key}`, structuredClone(value));
  combat.advanced = 0; combat.nextTurn = async () => { combat.advanced++; combat.turn = 0; };
  const owner = { id: "owner", active: true, isGM: false };
  const gm = { id: "gm", active: true, isGM: true };
  const messages = collection();
  function message(flags) {
    const doc = documentDouble({ id: `m${++serial}`, uuid: `ChatMessage.m${serial}`, flags: { [scope]: flags } });
    docs.set(doc.uuid, doc); messages.push(doc); return doc;
  }
  let original;
  if (paid) original = message({ combat: { status: "awaitingDefense", revision: 0,
    attacker: { actorUuid: other.uuid }, defender: { actorUuid: actor.uuid },
    turnEconomy: { combatId: combat.id, combatantId: "b", round: 1, attackSpent: true, turnAdvanced: false } } });
  const globals = { game: { user: owner, users: collection([owner, gm, { id: "other" }]), combat,
    combats: collection([combat]), messages, actors: new Map([[actor.id, actor], [other.id, other]]),
    i18n: { localize: x => x, format: (key, data) => `${key} ${data.actor}` },
    mythrasFoundry: { combat: { isCoordinator: () => true } } },
    foundry: { utils: { randomID: () => `id${++serial}`, deepClone: structuredClone,
      escapeHTML: value => String(value).replaceAll("<", "&lt;") } },
    ChatMessage: { create: async data => { const doc = message(data.flags[scope]); doc.content = data.content; return doc; } },
    fromUuid: async uuid => docs.get(uuid), Hooks: { callAll() {} },
    ui: { chat: { updateMessage() {} }, notifications: { info() {}, warn() {} } } };
  for (const [key, value] of Object.entries(globals)) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => old ? Object.defineProperty(globalThis, key, old) : delete globalThis[key]);
  }
  const begin = () => submitInterruption(combat, "begin", { combatantId: "a" });
  return { combat, actor, other, gm, owner, original, message, begin };
}

test("Interrumpir abre una elección gratuita, bloquea el turno original y permite cancelar", async t => {
  const f = setup(t);
  assert.equal(await f.begin(), true);
  assert.equal(f.actor.system.resources.actionPoints.value, 2);
  assert.equal(canStartProactiveAction(f.combat, f.combat.combatants.get("a")), true);
  assert.equal(canStartProactiveAction(f.combat, f.combat.combatants.get("b")), false);
  assert.equal(await f.begin(), false);
  assert.equal(await submitInterruption(f.combat, "cancel"), true);
  assert.equal(f.combat.getFlag(scope, "combatActions").delays.a.status, "reserved");
  assert.equal(f.combat.advanced, 0);
});

test("una única acción inmediata consume un PA y Esperando sin mover iniciativa", async t => {
  const f = setup(t);
  await f.begin();
  const order = f.combat.turns.map(e => [e.id, e.initiative]);
  assert.equal(await spendActorActionPoint(f.actor, { actionKind: "immediate" }), true);
  assert.equal(await spendActorActionPoint(f.actor), false);
  assert.equal(f.combat.getFlag(scope, "combatActions").delays.a.status, "consumed");
  assert.equal(f.actor.system.resources.actionPoints.value, 1);
  await finishInterruptionAction(f.combat, "a");
  assert.equal(combatInterruption(f.combat).phase, "awaitingDecision");
  assert.equal(f.combat.turn, 1); assert.equal(f.combat.advanced, 0);
  assert.deepEqual(f.combat.turns.map(e => [e.id, e.initiative]), order);
  assert.deepEqual(f.combat.mythrasTurnEconomy, { revision: 2, cycle: 1 });
});

test("solo el DJ decide y una respuesta afirmativa cobra una vez si no había declaración pagada", async t => {
  const f = setup(t);
  await f.begin(); await spendActorActionPoint(f.actor, { actionKind: "immediate" });
  await finishInterruptionAction(f.combat, "a");
  assert.equal(await submitInterruption(f.combat, "prevent"), false);
  game.user = f.gm;
  await Promise.all([submitInterruption(f.combat, "prevent"), submitInterruption(f.combat, "prevent")]);
  assert.equal(f.other.system.resources.actionPoints.value, 1);
  assert.equal(f.combat.advanced, 1);
});

test("impedir un ataque prepagado no cobra de nuevo ni permite reembolsarlo después", async t => {
  const f = setup(t, { paid: true });
  await f.begin();
  assert.equal(interruptionBlocksMessage(f.original), true);
  await spendActorActionPoint(f.actor, { actionKind: "immediate" });
  await finishInterruptionAction(f.combat, "a");
  game.user = f.gm; await submitInterruption(f.combat, "prevent");
  assert.equal(f.other.system.resources.actionPoints.value, 2);
  assert.equal(f.original.getFlag(scope, "combat").impeded, true);
  assert.equal(f.original.getFlag(scope, "combat").turnEconomy.turnAdvanced, true);
  assert.equal(f.combat.advanced, 1);
  const result = await applyCombatExchangeCancellation(f.original, f.original.getFlag(scope, "combat"));
  assert.equal(result, false);
});

test("No reanuda la declaración suspendida sin gasto ni avance", async t => {
  const f = setup(t, { paid: true });
  await f.begin(); await spendActorActionPoint(f.actor, { actionKind: "immediate" });
  await finishInterruptionAction(f.combat, "a");
  game.user = f.gm; await submitInterruption(f.combat, "continue");
  assert.equal(interruptionBlocksMessage(f.original), false);
  assert.equal(f.original.getFlag(scope, "combat").status, "awaitingDefense");
  assert.equal(f.combat.advanced, 0);
});

test("No reanuda una acción general cuya ejecución quedó suspendida tras declararse", async t => {
  const f = setup(t);
  const actions = f.combat.getFlag(scope, "combatActions");
  actions.actions.original = { id: "original", key: "move", type: "proactive", combatantId: "b",
    cost: 1, spent: true, status: "resolving", revision: 0, parameters: { mode: "walk" } };
  await f.combat.setFlag(scope, "combatActions", actions);
  await f.begin();
  await executeAction(f.combat, actions.actions.original);
  assert.equal(f.combat.getFlag(scope, "combatActions").actions.original.status, "resolving");
  await spendActorActionPoint(f.actor, { actionKind: "immediate" });
  await finishInterruptionAction(f.combat, "a");
  game.user = f.gm; await submitInterruption(f.combat, "continue");
  assert.equal(f.combat.getFlag(scope, "combatActions").actions.original.status, "resolved");
  assert.equal(f.combat.advanced, 1);
  assert.equal(f.other.system.resources.actionPoints.value, 2);
});

test("una respuesta obsoleta no cobra ni avanza otro turno", async t => {
  const f = setup(t);
  await f.begin(); await spendActorActionPoint(f.actor, { actionKind: "immediate" });
  await finishInterruptionAction(f.combat, "a");
  game.user = f.gm; f.combat.round = 2;
  assert.equal(await submitInterruption(f.combat, "prevent"), false);
  assert.equal(f.other.system.resources.actionPoints.value, 2);
  assert.equal(f.combat.advanced, 0);
});

test("un ataque fuera de turno espera defensas y efectos antes de la decisión", async t => {
  const f = setup(t);
  await f.begin(); await spendActorActionPoint(f.actor, { actionKind: "attack" });
  const state = { status: "awaitingDefense", revision: 0,
    turnEconomy: { combatId: f.combat.id, combatantId: "a", round: 1,
      interruptionId: combatInterruption(f.combat).id, attackSpent: true, turnAdvanced: false } };
  const attack = f.message({ combat: state });
  await bindInterruptionAction(f.combat, "a", { kind: "attack", messageUuid: attack.uuid });
  assert.equal(await finishInterruptionAction(f.combat, "a"), false);
  Object.assign(state, { status: "resolved", consequencesApplied: true, damage: { status: "applied" } });
  const advanced = await advanceCombatExchange(attack, state, { combatById: () => f.combat, render: () => "resolved" });
  assert.equal(advanced, true);
  assert.equal(combatInterruption(f.combat).phase, "awaitingDecision");
  assert.equal(f.combat.advanced, 0);
});

test("el mensaje del DJ se crea después del ataque, sus efectos y su daño", async t => {
  const f = setup(t);
  const decisionMessages = () => game.messages.filter(message => message.getFlag(scope, 'interruption'));
  await f.begin();
  assert.equal(decisionMessages().length, 0);
  await spendActorActionPoint(f.actor, { actionKind: 'attack' });
  const state = { status: 'awaitingDefense', revision: 0,
    turnEconomy: { combatId: f.combat.id, combatantId: 'a', round: 1,
      interruptionId: combatInterruption(f.combat).id, attackSpent: true, turnAdvanced: false } };
  const attack = f.message({ combat: state });
  await bindInterruptionAction(f.combat, 'a', { kind: 'attack', messageUuid: attack.uuid });
  const advance = () => advanceCombatExchange(attack, state, {
    force: true, combatById: () => f.combat, render: () => 'attack'
  });
  assert.equal(await advance(), false);
  assert.equal(decisionMessages().length, 0);
  state.status = 'awaitingEffects';
  assert.equal(await advance(), false);
  assert.equal(decisionMessages().length, 0);
  Object.assign(state, { status: 'resolved', effects: { checks: [{ status: 'pending' }] }, damage: { status: 'ready' } });
  assert.equal(await advance(), false);
  state.effects.checks[0].status = 'resolved';
  assert.equal(await advance(), false);
  assert.equal(decisionMessages().length, 0);
  state.damage.status = 'applied';
  assert.equal(await advance(), true);
  assert.equal(decisionMessages().length, 1);
  assert.ok(game.messages.indexOf(decisionMessages()[0]) > game.messages.indexOf(attack));
  assert.equal(combatInterruption(f.combat).phase, 'awaitingDecision');
  assert.equal(f.combat.advanced, 0);
});

test("cancelar la elección no deja una tarjeta de decisión anticipada en el chat", async t => {
  const f = setup(t);
  await f.begin(); await submitInterruption(f.combat, 'cancel');
  assert.equal(game.messages.filter(message => message.getFlag(scope, 'interruption')).length, 0);
});

test("cancelar un ataque reembolsado restaura la espera y reanuda el turno", async t => {
  const f = setup(t);
  await f.begin(); await spendActorActionPoint(f.actor, { actionKind: "attack" });
  const exchange = { status: "awaitingDefense", revision: 0, attacker: { actorUuid: f.actor.uuid }, defender: {},
    turnEconomy: { combatId: f.combat.id, combatantId: "a", round: 1, attackSpent: true,
      interruptionId: combatInterruption(f.combat).id, turnAdvanced: false } };
  const attack = f.message({ combat: exchange });
  await bindInterruptionAction(f.combat, "a", { kind: "attack", messageUuid: attack.uuid });
  await applyCombatExchangeCancellation(attack, exchange, { clone: structuredClone, resolveActor: async () => f.actor, render: () => "cancelled" });
  assert.equal(f.actor.system.resources.actionPoints.value, 2);
  assert.equal(f.combat.getFlag(scope, "combatActions").delays.a.status, "reserved");
  assert.equal(f.actor.effects.length, 1);
  assert.equal(combatInterruption(f.combat), null);
  assert.equal(f.combat.advanced, 0);
});

test("la reacción habitual durante la elección consume la espera y cierra la elección", async t => {
  const f = setup(t);
  await f.begin(); await spendActorActionPoint(f.actor, { reactive: true });
  assert.equal(f.actor.system.resources.actionPoints.value, 1);
  assert.equal(combatInterruption(f.combat), null);
  assert.equal(f.combat.advanced, 0);
});

test("una acción general guiada y su confirmación no terminan el turno interrumpido", async t => {
  const f = setup(t);
  await f.begin(); await spendActorActionPoint(f.actor);
  const actions = f.combat.getFlag(scope, "combatActions");
  actions.actions.guided = { id: "guided", key: "charge", type: "proactive", combatantId: "a", status: "resolving", revision: 0 };
  await f.combat.setFlag(scope, "combatActions", actions);
  await bindInterruptionAction(f.combat, "a", { kind: "general", actionId: "guided" });
  await executeAction(f.combat, actions.actions.guided);
  assert.equal(combatInterruption(f.combat).phase, "resolving");
  const action = f.combat.getFlag(scope, "combatActions").actions.guided;
  assert.equal(action.status, "awaitingConfirmation");
  let callback;
  game.socket = { on: (channel, handler) => { callback = handler; } };
  registerCombatActionSocket();
  await callback({ action: "combatAction", combatId: f.combat.id, actionId: action.id,
    operation: "confirm", revision: action.revision, userId: f.owner.id });
  assert.equal(combatInterruption(f.combat).phase, "awaitingDecision");
  assert.equal(f.combat.advanced, 0);
});

test("Recargar usa la oportunidad fuera de turno y finaliza tras actualizar el arma", async t => {
  const f = setup(t);
  const weapon = documentDouble({ id: "bow", name: "Arco", type: "weapon", system: {
    equipped: true, activeModeKey: "ranged", modes: [{ key: "ranged", weaponType: "ranged",
      ammoUse: 'projectile', ammoType: 'arrow', ammoItemId: 'arrows', ammoCapacity: 1, ammoLoaded: 0, reloadActions: 1, reloadProgress: 0 }] } });
  const arrows = documentDouble({ id: 'arrows', name: 'Flechas', type: 'equipment', system: { category: 'ammunition', ammoType: 'arrow', quantity: 3 } });
  weapon.actor = f.actor;
  f.actor.items.push(weapon, arrows);
  f.actor.updateEmbeddedDocuments = async (type, updates) => {
    for (const { _id, ...update } of updates) await f.actor.items.get(_id).update(update);
  };
  let dialog = 0;
  foundry.applications = { api: { DialogV2: { wait: async () => dialog++ ? 'arrows' : 'bow:ranged' } } };
  await f.begin(); await reloadRangedWeapon(f.actor);
  assert.equal(weapon.system.modes[0].ammoLoaded, 1);
  assert.equal(arrows.system.quantity, 3);
  assert.equal(f.actor.system.resources.actionPoints.value, 1);
  assert.equal(combatInterruption(f.combat).phase, "awaitingDecision");
  assert.equal(f.combat.advanced, 0);
});

test("alcance y liberación esperan el resultado documental antes de preguntar al DJ", async t => {
  for (const [kind, flag, actorKey] of [["reach", "reachChange", "actorCombatantId"], ["release", "weaponRelease", "combatantId"]]) {
    const f = setup(t);
    await f.begin(); await spendActorActionPoint(f.actor, { actionKind: kind });
    const message = f.message({ [flag]: { status: "pending", combatId: f.combat.id, [actorKey]: "a" } });
    await bindInterruptionAction(f.combat, "a", { kind, messageUuid: message.uuid });
    assert.equal(await finishInterruptionAction(f.combat, "a"), false);
    await message.update({ [`flags.${scope}.${flag}.status`]: "resolved" });
    assert.equal(await finishInterruptionAction(f.combat, "a"), true);
    assert.equal(f.combat.advanced, 0);
  }
});

test("la tarjeta persistida permite que solo el DJ vea los controles de decisión", async t => {
  const f = setup(t);
  await f.begin(); await spendActorActionPoint(f.actor, { actionKind: "immediate" });
  await finishInterruptionAction(f.combat, "a");
  // Re-read the persisted reference, as on reconnect.
  const session = structuredClone(f.combat.getFlag(scope, "combatInterruption"));
  const message = await fromUuid(session.messageUuid);
  const view = dom(message.content); t.after(() => view.window.close());
  const old = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
  globalThis.HTMLElement = view.window.HTMLElement;
  t.after(() => old ? Object.defineProperty(globalThis, "HTMLElement", old) : delete globalThis.HTMLElement);
  activateInterruptionCard(message, view.window.document.body);
  assert.equal(view.window.document.querySelector("[data-interruption-operation='prevent']").hidden, true);
  game.user = f.gm;
  activateInterruptionCard(message, view.window.document.body);
  assert.equal(view.window.document.querySelector("[data-interruption-operation='prevent']").hidden, false);
  assert.equal(combatInterruption(f.combat).phase, "awaitingDecision");
});

test("propietarios ajenos no abren ni consumen una interrupción", async t => {
  const f = setup(t);
  assert.equal(await applyInterruptionRequest({ combatId: f.combat.id, combatantId: "a", operation: "begin", userId: "other" }), false);
  await f.begin();
  assert.equal(await applyInterruptionRequest({ combatId: f.combat.id, sessionId: combatInterruption(f.combat).id,
    operation: "claim", userId: "other" }), false);
  assert.equal(f.actor.system.resources.actionPoints.value, 2);
});

test("el jugador solicita la oportunidad y el gasto al coordinador por socket", async t => {
  const f = setup(t);
  let handler;
  game.mythrasFoundry.combat.isCoordinator = () => game.user.isGM;
  game.socket = {
    on(channel, callback) { handler = callback; },
    emit(channel, request) {
      game.user = request.action === "combatInterruptionReply" ? f.owner : f.gm;
      void handler(request);
    }
  };
  registerInterruptionSocket();
  assert.equal(await f.begin(), true);
  assert.equal(game.user.id, f.owner.id);
  assert.equal(await spendActorActionPoint(f.actor, { actionKind: "immediate" }), true);
  assert.equal(f.actor.system.resources.actionPoints.value, 1);
  assert.equal(game.user.id, f.owner.id);
  assert.equal(await finishInterruptionAction(f.combat, "a"), true);
  assert.equal(combatInterruption(f.combat).phase, "awaitingDecision");
  assert.equal(f.combat.advanced, 0);
});

test("una espera caducada no abre una interrupción y el turno propio tampoco", async t => {
  const f = setup(t);
  f.combat.round = 2;
  assert.equal(await f.begin(), false);
  f.combat.round = 1; f.combat.turn = 0;
  assert.equal(await f.begin(), false);
  assert.equal(f.actor.system.resources.actionPoints.value, 2);
});

test("Titubear fuera de turno conserva las condiciones de turno propio", async t => {
  const f = setup(t);
  f.actor.effects.push(documentDouble({ id: "timed", flags: { [scope]: { timedCondition: {
    key: "offBalance", unit: "actorTurn", remaining: 1 } } } }));
  await f.begin(); await spendActorActionPoint(f.actor);
  const actions = f.combat.getFlag(scope, "combatActions");
  const action = { id: "hesitate", key: "hesitate", type: "proactive", combatantId: "a", status: "resolving", revision: 0 };
  actions.actions.hesitate = action;
  await f.combat.setFlag(scope, "combatActions", actions);
  await bindInterruptionAction(f.combat, "a", { kind: "general", actionId: action.id });
  await executeAction(f.combat, action);
  assert.equal(f.actor.effects.length, 1);
  assert.equal(f.actor.effects[0].getFlag(scope, "timedCondition").remaining, 1);
  assert.equal(combatInterruption(f.combat).phase, "awaitingDecision");
  assert.equal(f.combat.advanced, 0);
});

test("el botón circunstancial y la elección se representan igual para personaje y PNJ", async t => {
  for (const type of ["character", "npc"]) {
    const f = setup(t, { type });
    const view = dom(render("templates/actor/parts/combat-tab.hbs"));
    t.after(() => view.window.close());
    const root = view.window.document.body;
    decorateCombatActionButtons(f.actor, root);
    const button = root.querySelector(".combat-tactical-actions [data-combat-action-key]");
    assert.equal(button.dataset.combatActionKey, "interrupt");
    assert.equal(button.hidden, false); assert.equal(button.disabled, false);
    assert.ok(button.classList.contains("sheet-action-attention"));
    await f.begin(); decorateCombatActionButtons(f.actor, root);
    assert.equal(root.querySelector("[data-interruption-cancel]").hidden, false);
    assert.equal(root.querySelector("[data-combat-action-key='move']").disabled, false);
    assert.equal(root.querySelector("[data-combat-action-key='delay']").disabled, true);
  }
});


test('Recargar pide configurar compatibilidad para un modo antiguo sin tipo', async t => {
  const f = setup(t);
  const weapon = documentDouble({ id: 'bow', type: 'weapon', system: { equipped: true,
    activeModeKey: 'ranged', modes: [{ key: 'ranged', weaponType: 'ranged', ammoTracking: true,
      ammoLoaded: 0, ammoReserve: 10 }] } });
  f.actor.items.push(weapon);
  let warning; ui.notifications.warn = text => { warning = text; };
  foundry.applications = { api: { DialogV2: { wait: async () => 'bow:ranged' } } };
  await f.begin(); await reloadRangedWeapon(f.actor);
  assert.equal(warning, 'MYTHRASF.Ranged.Inventory.SelectAmmunition');
  assert.equal(weapon.system.modes[0].ammoReserve, 10);
  assert.equal(f.actor.system.resources.actionPoints.value, 2);
});

test('Recargar preselecciona munición compatible y cancelar conserva estado y PA', async t => {
  const f = setup(t);
  const weapon = documentDouble({ id: 'bow', name: '<Arco>', type: 'weapon', system: {
    equipped: true, activeModeKey: 'ranged', modes: [{ key: 'ranged', weaponType: 'ranged',
      ammoUse: 'projectile', ammoType: 'arrow', ammoItemId: 'arrows', ammoCapacity: 1,
      ammoLoaded: 0, reloadProgress: 1, reloadActions: 2 }] } });
  const arrows = documentDouble({ id: 'arrows', type: 'equipment', name: 'Flechas',
    system: { category: 'ammunition', ammoType: 'arrow', quantity: 20 } });
  const bolts = documentDouble({ id: 'bolts', type: 'equipment', name: 'Virotes',
    system: { category: 'ammunition', ammoType: 'bolt', quantity: 12 } });
  f.actor.items.push(weapon, arrows, bolts);
  let calls = 0;
  foundry.applications = { api: { DialogV2: { wait: async options => {
    if (!calls++) return 'bow:ranged';
    const page = dom(options.content); t.after(() => page.window.close());
    const select = page.window.document.querySelector('[name="ammunition"]');
    assert.equal(select.value, 'arrows');
    assert.equal(select.options.length, 1);
    assert.match(options.content, /Inventory.ReloadHint/);
    return null;
  } } } };
  await f.begin(); await reloadRangedWeapon(f.actor);
  assert.equal(f.actor.system.resources.actionPoints.value, 2);
  assert.equal(weapon.system.modes[0].reloadProgress, 1);
  assert.equal(arrows.system.quantity, 20);
  assert.equal(combatInterruption(f.combat).phase, 'choosing');
});
