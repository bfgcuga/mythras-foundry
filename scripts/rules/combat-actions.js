export const COMBAT_ACTION_SCHEMA_VERSION = 1;

export const COMBAT_ACTIONS = Object.freeze({
  attack: { type: "proactive", cost: 1, observable: true },
  changeReach: { type: "proactive", cost: 1, observable: true, requiresCombat: true },
  passiveBlock: { type: "setup", cost: 0, observable: false, requiresCombat: true },
  aim: { type: "proactive", cost: 1, observable: true, requiresCombat: true },
  reload: { type: "proactive", cost: 1, observable: true, requiresCombat: true },
  seekCover: { type: "proactive", cost: 1, observable: true, requiresCombat: true },
  brace: { type: "proactive", cost: 1, observable: true, requiresCombat: true },
  readyWeapon: { type: "proactive", cost: 1, observable: true, requiresCombat: true },
  struggle: { type: "proactive", cost: 1, observable: true, requiresCombat: true },
  maneuver: { type: "proactive", cost: 1, observable: true, requiresCombat: true },
  move: { type: "proactive", cost: 1, observable: true, requiresCombat: true },
  stand: { type: "proactive", cost: 1, observable: true, requiresCombat: true },
  charge: { type: "proactive", cost: 1, observable: true, guided: true, requiresCombat: true },
  delay: { type: "proactive", cost: 1, observable: false, requiresCombat: true },
  hesitate: { type: "proactive", cost: 1, observable: false, requiresCombat: true },
  mount: { type: "proactive", cost: 1, observable: true, guided: true, requiresCombat: true },
  retainMagic: { type: "proactive", cost: 1, observable: true, guided: true, requiresCombat: true },
  useMagic: { type: "proactive", cost: 1, observable: true, guided: true, requiresCombat: true },
  counterspell: { type: "reactive", cost: 1, guided: true, requiresCombat: true },
  interrupt: { type: "reactive", cost: 0, requiresDelay: true, requiresCombat: true }
});

export function emptyCombatActionState() {
  return { schemaVersion: COMBAT_ACTION_SCHEMA_VERSION, revision: 0, actions: {},
    delays: {}, movements: {}, braces: {}, maneuverRestrictions: {}, readyProgress: {} };
}

export function normalizeCombatActionState(value = {}) {
  const empty = emptyCombatActionState();
  return { ...empty, ...value, actions: { ...(value.actions ?? {}) },
    delays: { ...(value.delays ?? {}) }, movements: { ...(value.movements ?? {}) },
    braces: { ...(value.braces ?? {}) },
    maneuverRestrictions: { ...(value.maneuverRestrictions ?? {}) },
    readyProgress: { ...(value.readyProgress ?? {}) } };
}

export function isEngaged(relations = {}, combatantId) {
  return Object.values(relations).some((relation) => relation.status === "engaged"
    && Object.hasOwn(relation.sides ?? {}, combatantId));
}

export function delayIsValid(delay, { round, cycle, turnSerial = 0 } = {}) {
  if (!delay || delay.status !== "reserved") return false;
  if (Number(round) < Number(delay.expiresRound)) return true;
  if (Number(round) > Number(delay.expiresRound)) return false;
  if (Number(cycle) < Number(delay.expiresCycle)) return true;
  if (Number(cycle) > Number(delay.expiresCycle)) return false;
  return Number(turnSerial) < Number(delay.expiresTurnSerial ?? Infinity);
}

export function availableCombatActions({ inCombat = false, isActive = false, actionPoints = 0,
  canTakeProactiveTurn = true, canAttack = true, engaged = false, prone = false,
  hasRangedWeapon = false, hasPreparedWeapon = false, hasRestraint = false,
  hasDelay = false, canCharge = false } = {}) {
  const available = {};
  for (const [key, definition] of Object.entries(COMBAT_ACTIONS)) {
    let allowed = definition.type !== "proactive" || (inCombat && isActive
      && actionPoints >= definition.cost && canTakeProactiveTurn);
    if (definition.requiresCombat && !inCombat) allowed = false;
    if (key === "attack") allowed &&= canAttack && hasPreparedWeapon;
    if (["aim", "reload"].includes(key)) allowed &&= hasRangedWeapon;
    if (["brace", "readyWeapon", "passiveBlock"].includes(key)) allowed &&= hasPreparedWeapon;
    if (key === "struggle") allowed &&= hasRestraint;
    if (key === "move") allowed &&= !engaged;
    if (key === "stand") allowed &&= prone;
    if (key === "charge") allowed &&= canCharge && hasPreparedWeapon;
    if (key === "delay") allowed &&= !hasDelay;
    if (definition.type === "reactive") allowed = inCombat && actionPoints >= definition.cost;
    if (key === "interrupt") allowed &&= hasDelay;
    available[key] = allowed;
  }
  return Object.freeze(available);
}

export function combatActionPresentation(context = {}) {
  const available = availableCombatActions(context);
  return Object.freeze(Object.fromEntries(Object.entries(COMBAT_ACTIONS).map(([key, definition]) => {
    let reason = "";
    if (!available[key]) {
      if ((definition.requiresCombat || definition.type === "proactive") && !context.inCombat) {
        reason = "combatRequired";
      }
      else if (definition.type === "proactive" && !context.isActive) reason = "activeTurnRequired";
      else if (Number(context.actionPoints ?? 0) < definition.cost) reason = "actionPoints";
      else if (!context.canTakeProactiveTurn) reason = "proactiveBlocked";
      else if (key === "attack" && !context.canAttack) reason = "attackBlocked";
      else if (key === "attack" && !context.hasPreparedWeapon) reason = "preparedWeapon";
      else if (["aim", "reload"].includes(key) && !context.hasRangedWeapon) reason = "rangedWeapon";
      else if (["brace", "readyWeapon", "passiveBlock"].includes(key) && !context.hasPreparedWeapon) reason = "preparedWeapon";
      else if (key === "struggle" && !context.hasRestraint) reason = "restraint";
      else if (key === "move" && context.engaged) reason = "engaged";
      else if (key === "stand" && !context.prone) reason = "notProne";
      else if (key === "charge" && !context.canCharge) reason = "chargeMovement";
      else if (key === "delay" && context.hasDelay) reason = "delayReserved";
      else reason = "unavailable";
    }
    return [key, Object.freeze({ key, available: Boolean(available[key]), cost: definition.cost, reason })];
  })));
}

export function movementDeclaration({ mode, round, cycle = 1, targetTokenUuid = "",
  direction = "", userId = "", previous = null, now = Date.now() }) {
  if (!["stationary", "walk", "run", "sprint"].includes(mode)) throw new Error("Invalid movement mode");
  const continuous = ["run", "sprint"].includes(mode) && ["run", "sprint"].includes(previous?.mode)
    && Number(previous.round) === Number(round) - 1;
  return { schemaVersion: 1, mode, round: Number(round), cycle: Number(cycle), targetTokenUuid,
    direction, continuousFromPreviousRound: continuous, userId, updatedAt: now };
}

export function chargeEligibility(movement, currentRound) {
  const eligible = ["run", "sprint"].includes(movement?.mode)
    && Number(movement?.round) <= Number(currentRound) - 1;
  return { eligible, reason: eligible ? "" : "movement" };
}

export function chargeModifiers({ locomotion = "biped", mountedLancer = false } = {}) {
  return Object.freeze({ difficultySteps: mountedLancer ? 0 : 1,
    damageModifierSteps: locomotion === "quadruped" ? 2 : 1, weaponSizeSteps: 1 });
}

export function braceSize(size, kind = "push") {
  const value = Math.max(0, Number(size) || 0);
  return Math.ceil(value * (kind === "bash" ? 2 : 1.5));
}

export function contestWinner(left, right) {
  const leftLevel = Number(left?.level ?? 0); const rightLevel = Number(right?.level ?? 0);
  if (leftLevel !== rightLevel) return leftLevel > rightLevel ? "left" : "right";
  const leftRoll = Number(left?.roll ?? 0); const rightRoll = Number(right?.roll ?? 0);
  if (leftRoll === rightRoll) return "tie";
  return leftRoll > rightRoll ? "left" : "right";
}

export function interruptPriority(candidates = []) {
  return [...candidates].sort((left, right) => Number(right.initiative ?? -Infinity)
    - Number(left.initiative ?? -Infinity) || String(left.combatantId).localeCompare(String(right.combatantId)))[0] ?? null;
}
