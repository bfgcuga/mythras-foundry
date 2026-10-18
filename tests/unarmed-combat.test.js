import test from "node:test";
import assert from "node:assert/strict";
import { intrinsicUnarmedWeapon, resolveUnarmedAbility, unarmedAbilities,
  unarmedParrySize, unarmedTouchState } from "../scripts/rules/unarmed-combat.js";
import { availableCombatActions } from "../scripts/rules/combat-actions.js";
import { installHost, collection, documentDouble, render, dom } from "./helpers/ui.js";

const brawl = () => documentDouble({ id: "brawl", type: "skill", name: "Pelea",
  system: { slug: "pelea", total: 47 } });
const style = (id, total, profiles = ["puno-patada"], traitRefs = []) =>
  documentDouble({ id, type: "combatStyle", name: id,
    system: { total, weaponProfiles: profiles.map((key) => ({ key })), traitRefs } });
const humanoid = (items = [brawl()], type = "character") => documentDouble({ type,
  items: collection(items), system: { morphologyKey: "humanoid" } });

test("Puño/Patada es intrínseco a personajes y PNJ humanoides sin crear Items", () => {
  for (const type of ["character", "npc"]) {
    const actor = humanoid([], type);
    const weapon = intrinsicUnarmedWeapon(actor);
    assert.equal(weapon.id, "");
    assert.equal(weapon.intrinsicKey, "puno-patada");
    assert.equal(weapon.system.profileKey, "puno-patada");
    assert.equal(weapon.system.modes[0].damage, "1d3");
    assert.equal(weapon.system.modes[0].size, "P");
    assert.equal(weapon.system.modes[0].reach, "T");
    assert.equal(weapon.system.modes[0].damageModifierMode, "full");
    assert.equal(actor.items.length, 0);
    actor.system.morphologyKey = "custom";
    assert.equal(intrinsicUnarmedWeapon(actor), null);
  }
});

test("ofrece Pelea y estilos explícitos, preselecciona el mejor y rechaza otros estilos", () => {
  const actor = humanoid([brawl(), style("low", 25), style("high", 80),
    style("Artes marciales", 99, ["espada"])]);
  assert.deepEqual(unarmedAbilities(actor).map((item) => item.id), ["high", "low", "brawl"]);
  assert.equal(resolveUnarmedAbility(actor).ability.id, "high");
  const resolution = resolveUnarmedAbility(actor, "brawl");
  assert.equal(resolution.target, 47);
  assert.equal(resolution.style, null);
  assert.equal(resolveUnarmedAbility(actor, "Artes marciales").ability, undefined);
  assert.equal(resolveUnarmedAbility(humanoid()).ability.id, "brawl");
});

test("Maestría sin Armas solo modifica la parada del estilo empleado", () => {
  assert.equal(unarmedParrySize(brawl()), "P");
  assert.equal(unarmedParrySize(style("normal", 70)), "P");
  assert.equal(unarmedParrySize(style("master", 70, undefined,
    [{ key: "maestria-sin-armas" }])), "M");
});

test("Toque no se deduce de una posición neutral ni del alcance desactivado", () => {
  const relation = { status: "engaged", position: "shorter", sides:
    { a: { reach: "T" }, b: { reach: "L" } } };
  assert.equal(unarmedTouchState(relation), "allowed");
  assert.equal(unarmedTouchState({ ...relation, position: "longer" }), "blocked");
  assert.equal(unarmedTouchState({ ...relation, position: "neutral" }), "unknown");
  assert.equal(unarmedTouchState({ ...relation, status: "disengaged" }), "blocked");
  assert.equal(unarmedTouchState(relation, false), "unknown");
  assert.equal(unarmedTouchState(null), "unknown");
  assert.equal(unarmedTouchState({ ...relation, status: "removed" }), "unknown");
  assert.equal(unarmedTouchState({ ...relation, sides: { a: { reach: "T" } } }), "unknown");
});

test("la acción Atacar no exige un Item y no habilita Bloqueo Pasivo por ello", () => {
  const actions = availableCombatActions({ inCombat: true, isActive: true,
    actionPoints: 2, hasUnarmedAttack: true });
  assert.equal(actions.attack, true);
  assert.equal(actions.passiveBlock, false);
});

test("la fila intrínseca usa plantilla real, selector de habilidad y ningún control de Item", async (t) => {
  installHost(t);
  const { prepareIntrinsicCombatView } = await import("../scripts/ui/combat-sheet.js");
  for (const type of ["character", "npc"]) {
    const row = prepareIntrinsicCombatView(humanoid([brawl(), style("martial", 80)], type), () => "hard");
    assert.equal(row.baseTarget, 80);
    assert.equal(row.effectiveTarget, 54);
    const page = dom(render("templates/actor/parts/combat-tab.hbs", { meleeCombatWeapons: [row] }));
    t.after(() => page.window.close());
    const line = page.window.document.querySelector('[data-intrinsic-key="puno-patada"]');
    assert.ok(line);
    assert.equal(line.querySelector('[data-action="edit-item"]'), null);
    assert.equal(line.querySelector('[data-action="toggle-equipped"]'), null);
    assert.equal(line.querySelector('[data-action="roll-weapon-attack"]').disabled, false);
    assert.deepEqual([...line.querySelectorAll("[data-combat-style] option")].map((el) => el.value),
      ["martial", "brawl"]);
    assert.equal(line.querySelector("[data-combat-style]").value, "martial");
  }
});

test("la preparación compartida oculta el Puño/Patada heredado sin borrar Items ni otras armas naturales", async (t) => {
  installHost(t);
  const { prepareCombatWeaponViews } = await import("../scripts/ui/combat-sheet.js");
  const actor = humanoid();
  const legacy = { ...intrinsicUnarmedWeapon(actor), id: "legacy-unarmed", intrinsicKey: undefined };
  const claws = { ...intrinsicUnarmedWeapon(actor), id: "claws", intrinsicKey: undefined,
    name: "Garras", system: { ...legacy.system, profileKey: "claws" } };
  actor.items.push(legacy, claws);
  const rows = prepareCombatWeaponViews({ actor, weapons: [legacy, claws], styles: [],
    hitLocations: [], resolveDifficulty: (difficulty) => difficulty });
  assert.equal(rows.length, 2);
  assert.ok(rows.find((row) => row.item.id === "claws"));
  assert.equal(rows.filter((row) => row.intrinsicKey).length, 1);
  assert.equal(actor.items.get("legacy-unarmed"), legacy);
  const { preparedMeleeWeapons } = await import("../scripts/rules/engagement-runtime.js");
  const tactical = preparedMeleeWeapons(actor);
  assert.equal(tactical.length, 2);
  assert.equal(tactical.filter((entry) => entry.weapon.intrinsicKey).length, 1);
});

test("las opciones de parada exigen el rasgo natural y validan Toque sin confiar en el cliente", async (t) => {
  installHost(t);
  const { parryChoices, canonicalParryDefense } = await import("../scripts/rules/combat-chat.js");
  const actor = humanoid([brawl(), style("martial", 80, undefined, [{ key: "maestria-sin-armas" }])]);
  const choices = parryChoices(actor);
  assert.equal(choices.length, 2);
  assert.equal(choices[0].weaponSize, "M");
  assert.equal(choices[1].weaponSize, "P");
  assert.equal(canonicalParryDefense(actor, null, choices[1]), null);
  const canonical = canonicalParryDefense(actor, null,
    { ...choices[1], target: 999, weaponSize: "D", touchConfirmed: true });
  assert.equal(canonical.target, 47);
  assert.equal(canonical.weaponSize, "P");
  assert.equal(canonical.touchConfirmed, true);
  actor.items.splice(0, 1);
  assert.equal(canonicalParryDefense(actor, null, { ...choices[1], touchConfirmed: true }), null);

  const natural = { id: "claws", type: "weapon", name: "Garras", system: { equipped: true,
    activeModeKey: "claws", profileKey: "claws", modes: [{ key: "claws", handsRequired: 0,
      reach: "C", size: "G", weaponType: "melee" }] } };
  const creature = documentDouble({ type: "npc", system: { morphologyKey: "custom" },
    items: collection([natural, style("claw-style", 60, ["claws"])]) });
  assert.equal(parryChoices(creature).length, 0);
  creature.items.push({ type: "trait", name: "Un nombre traducido", system: { key: "formidable-natural-weapons" } });
  assert.equal(parryChoices(creature)[0].weaponSize, "G");
  creature.items.pop();
  natural.system.modes[0].handsRequired = 1;
  assert.equal(parryChoices(creature).length, 1);
});

test("la parada usa el alcance táctico actual, incluido un cambio mientras el diálogo está abierto", async (t) => {
  installHost(t);
  const { parryChoices, canonicalParryDefense } = await import("../scripts/rules/combat-chat.js");
  const actor = humanoid();
  const relation = { status: "engaged", position: "shorter",
    sides: { a: { reach: "L" }, d: { reach: "T" } } };
  game.settings.get = () => true;
  game.combats.push({ id: "tracker", getFlag: () => ({ relations: { "a::d": relation } }) });
  const combat = { turnEconomy: { combatId: "tracker", combatantId: "a", defenderCombatantId: "d" } };
  const choice = parryChoices(actor, combat)[0];
  assert.equal(choice.touch, "allowed");
  assert.ok(canonicalParryDefense(actor, combat, choice));
  relation.position = "longer";
  assert.equal(parryChoices(actor, combat).length, 0);
  assert.equal(canonicalParryDefense(actor, combat, { ...choice, touchConfirmed: true }), null);
});

test("la defensa válida cobra un PA una sola vez y conserva la habilidad y la confirmación", async (t) => {
  installHost(t);
  const { applyCombatDefenseTransition } = await import("../scripts/rules/combat-response-runtime.js");
  const { canonicalParryDefense, parryChoices } = await import("../scripts/rules/combat-chat.js");
  const actor = humanoid();
  const combat = { status: "awaitingDefense", revision: 3, defender: {},
    attacker: { target: 40, rawRoll: 20 }, turnEconomy: { combatId: "tracker", defenderCombatantId: "d" } };
  const tracker = { started: true, combatants: collection([{ id: "d", actor }]), getFlag: () => ({}) };
  game.combats.push({ ...tracker, id: "tracker" });
  let payments = 0;
  const message = { getFlag: () => combat, update: async (change) => Object.assign(combat, change["flags.scope.combat"]) };
  const request = { revision: 3, userId: "gm", defense: { ...parryChoices(actor)[0],
    type: "parry", touchConfirmed: true, rawRoll: 30 } };
  const deps = { clone: structuredClone, flagScope: "scope", resolveActor: async () => actor,
    userById: () => ({ id: "gm", isGM: true }), warn: () => {}, localize: (key) => key,
    validateParry: canonicalParryDefense, combatById: () => tracker, actionPointRules: () => ({}),
    spendActionPoint: async () => { payments++; return true; }, consumePassiveBlock: async () => {},
    recordFumbles: async () => {}, consumeSurprise: async () => 0, render: () => "",
    appendRolls: () => [], advance: async () => {} };
  for (const rawRoll of [0, 101, 1.5]) {
    assert.equal(await applyCombatDefenseTransition(message,
      { ...request, defense: { ...request.defense, rawRoll } }, deps), false);
  }
  assert.equal(payments, 0);
  assert.equal(await applyCombatDefenseTransition(message, request, deps), true);
  assert.equal(combat.defender.defense.abilityId, "brawl");
  assert.equal(combat.defender.defense.touchConfirmed, true);
  assert.equal(await applyCombatDefenseTransition(message, request, deps), false);
  assert.equal(payments, 1);
});

test("Suerte registra la pifia en Pelea al repetir un ataque intrínseco", async (t) => {
  installHost(t);
  const { applyCombatLuckTransition } = await import("../scripts/rules/combat-response-runtime.js");
  const { recordAbilityFumble } = await import("../scripts/rules/skills.js");
  const actor = humanoid();
  actor.system.resources = { luckPoints: { value: 2 } };
  const combat = { status: "awaitingDefense", revision: 0, damage: { status: "unavailable" },
    attacker: { actorUuid: actor.uuid, abilityId: "brawl", styleId: "", target: 47, rawRoll: 20 },
    defender: { actorUuid: "Actor.other" } };
  const message = { getFlag: () => combat, update: async (change) => Object.assign(combat, change["flags.scope.combat"]) };
  const applied = await applyCombatLuckTransition(message, { revision: 0, side: "attacker",
    luckSide: "attacker", mode: "reroll", userId: "gm", rawRoll: 100 }, {
    clone: structuredClone, flagScope: "scope", resolveActor: async () => actor,
    userById: () => ({ id: "gm", isGM: true }), actorName: () => "Actor",
    recordFumble: recordAbilityFumble, recordFumbles: async () => {},
    render: () => "", appendRolls: () => [] });
  assert.equal(applied, true);
  assert.equal(actor.items.get("brawl").system.fumbled, true);
  assert.equal(actor.system.resources.luckPoints.value, 1);
});

test("el coordinador rechaza una parada inválida antes de cobrar PA o consumir el bloqueo", async (t) => {
  installHost(t);
  const { applyCombatDefenseTransition } = await import("../scripts/rules/combat-response-runtime.js");
  const actor = humanoid();
  const combat = { status: "awaitingDefense", revision: 3, defender: {}, turnEconomy: {} };
  let writes = 0;
  const request = { revision: 3, userId: "gm", defense: { type: "parry", intrinsicKey: "puno-patada", rawRoll: 30 } };
  const result = await applyCombatDefenseTransition({ getFlag: () => combat,
    update: async () => writes++ }, request, { clone: structuredClone, flagScope: "scope",
    resolveActor: async () => actor, userById: () => ({ id: "gm", isGM: true }),
    warn: () => {}, localize: (key) => key, validateParry: () => null,
    spendActionPoint: async () => { writes++; return true; }, consumePassiveBlock: async () => writes++ });
  assert.equal(result, false);
  assert.equal(writes, 0);
});
