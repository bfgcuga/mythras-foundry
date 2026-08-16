import { effectiveActionPointMaximum, combatantActionPointState } from "../rules/action-points.js";
import { composedInitiative, nextCombatPosition, splitComposedInitiative,
  TURN_ECONOMY_SCHEMA_VERSION, uniqueActorEntries } from "../rules/combat-turns.js";
import { getActionPointRules } from "../settings.js";
import { resolveActorConditions } from "../rules/actor-conditions.js";
import { advanceActorTurnConditions, expireRoundConditions,
  bindSurpriseEffects, revealSurprisedTurn } from "../rules/timed-condition-runtime.js";
import { prepareRoundConsequences } from "../rules/round-consequences.js";

const SCOPE = "mythras-foundry";
const FLAG = "turnEconomy";

function coordinator() {
  return game.users.filter((user) => user.active && user.isGM)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0]?.id ?? game.user.id;
}

export function isCombatCoordinator() { return coordinator() === game.user.id; }

export async function restoreCombatActors(combat) {
  if (!isCombatCoordinator()) return;
  for (const combatant of uniqueActorEntries(combat?.combatants)) {
    const actor = combatant.actor;
    if (!actor) continue;
    await actor.update({ "system.resources.actionPoints.value":
      effectiveActionPointMaximum(actor, getActionPointRules()) });
  }
}

function hasPendingExchange(combatant) {
  return game.messages?.some((message) => {
    const reach = message.getFlag?.(SCOPE, "reachChange");
    if (reach?.status === "awaitingResponse" && reach.actorCombatantId === combatant?.id) return true;
    const exchange = message.getFlag?.(SCOPE, "combat");
    return exchange?.turnEconomy && !exchange.turnEconomy.turnAdvanced
      && exchange.turnEconomy.combatantId === combatant?.id
      && ["awaitingDefense", "awaitingEffects", "resolved"].includes(exchange.status);
  });
}

export async function synchronizeCombatantActionPoints(combatant) {
  if (!isCombatCoordinator() || !combatant?.actor) return;
  const maximum = combatant.isDefeated ? 0
    : effectiveActionPointMaximum(combatant.actor, getActionPointRules());
  const current = Number(combatant.actor.system.resources?.actionPoints?.value ?? 0);
  const desired = Math.min(current, maximum);
  if (current !== desired) {
    await combatant.actor.update({ "system.resources.actionPoints.value": desired });
  }
  const combat = combatant.parent;
  if (combat?.started && combat.combatant?.id === combatant.id && maximum === 0
    && !hasPendingExchange(combatant)) await combat.nextTurn();
}

export class MythrasCombat extends Combat {
  get mythrasTurnEconomy() {
    return this.getFlag(SCOPE, FLAG) ?? { schemaVersion: TURN_ECONOMY_SCHEMA_VERSION,
      revision: 0, cycle: 1, lastRestoredRound: 0, transitioning: false };
  }

  async startCombat() {
    const started = await super.startCombat();
    if (coordinator() !== game.user.id) return started;
    await bindSurpriseEffects(this);
    await this.restoreActionPoints({ round: Math.max(1, this.round || 1) });
    await this.update({ turn: null });
    Hooks.callAll("mythrasRoundPreparing", this, this.round);
    const queue = await prepareRoundConsequences(this);
    if (!queue.some((entry) => entry.status === "pending")) await this.completeRoundPreparation(queue);
    return this;
  }

  async nextTurn() {
    if (coordinator() !== game.user.id) return this;
    if (hasPendingExchange(this.combatant)) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Tracker.PendingExchange"));
      return this;
    }
    const economy = this.mythrasTurnEconomy;
    if (economy.transitioning) return this;
    const history = [...(economy.conditionHistory ?? [])];
    if (this.combatant?.actor) await advanceActorTurnConditions(this.combatant.actor, history);
    const states = this.turns.map((entry) => ({ ...combatantActionPointState(entry,
      effectiveActionPointMaximum(entry.actor, getActionPointRules())),
    canTakeProactiveTurn: resolveActorConditions(entry.actor, {
      baseAttributes: entry.actor?.system?.baseAttributes ?? entry.actor?.system?.attributes ?? {}
    }).capabilities.canTakeProactiveTurn }));
    const next = nextCombatPosition({ turns: states, currentIndex: this.turn ?? -1,
      round: this.round ?? 0, cycle: economy.cycle ?? 1 });
    for (const index of next.skipped ?? []) {
      if (this.turns[index]?.actor) await advanceActorTurnConditions(this.turns[index].actor, history);
    }
    if (next.transition === "round") return this.nextRound();
    const flags = { ...economy, schemaVersion: TURN_ECONOMY_SCHEMA_VERSION,
      cycle: next.cycle, revision: Number(economy.revision ?? 0) + 1,
      conditionHistory: history, transitioning: false };
    await this.update({ turn: next.turn, [`flags.${SCOPE}.${FLAG}`]: flags });
    await revealSurprisedTurn(this.combatant?.actor);
    if (next.transition === "cycle") Hooks.callAll("mythrasCycleStart", this, next.cycle);
    return this;
  }

  async nextRound() {
    if (coordinator() !== game.user.id) return this;
    const round = Math.max(1, Number(this.round ?? 0) + 1);
    Hooks.callAll("mythrasRoundEnd", this, this.round ?? 0);
    const history = [...(this.mythrasTurnEconomy.conditionHistory ?? [])];
    await expireRoundConditions(this, history);
    await this.restoreActionPoints({ round });
    await this.update({ round, turn: null,
      [`flags.${SCOPE}.${FLAG}.conditionHistory`]: history });
    Hooks.callAll("mythrasRoundPreparing", this, round);
    const queue = await prepareRoundConsequences(this);
    if (!queue.some((entry) => entry.status === "pending")) await this.completeRoundPreparation(queue);
    return this;
  }

  async completeRoundPreparation(queue = []) {
    const economy = this.mythrasTurnEconomy;
    if (!economy.roundPreparing && this.turn != null) return this;
    await this.setFlag(SCOPE, FLAG, { ...economy, roundQueue: queue,
      roundPreparing: false, revision: Number(economy.revision ?? 0) + 1 });
    await this.selectFirstAvailable();
    await revealSurprisedTurn(this.combatant?.actor);
    Hooks.callAll("mythrasRoundStart", this, this.round);
    return this;
  }

  async restoreActionPoints({ round = this.round ?? 1 } = {}) {
    const economy = this.mythrasTurnEconomy;
    if (Number(economy.lastRestoredRound) === Number(round)) return;
    for (const combatant of uniqueActorEntries(this.combatants)) {
      const actor = combatant.actor;
      if (!actor || this.actorInAnotherStartedCombat(actor)) {
        if (actor) ui.notifications.warn(game.i18n.format("MYTHRASF.Tracker.MultipleCombats", { actor: actor.name }));
        continue;
      }
      const maximum = combatant.isDefeated ? 0
        : effectiveActionPointMaximum(actor, getActionPointRules());
      await actor.update({ "system.resources.actionPoints.value": maximum });
    }
    await this.setFlag(SCOPE, FLAG, { ...economy, schemaVersion: TURN_ECONOMY_SCHEMA_VERSION,
      cycle: 1, lastRestoredRound: round, revision: Number(economy.revision ?? 0) + 1,
      transitioning: false });
  }

  async selectFirstAvailable() {
    const index = this.turns.findIndex((entry) => {
      const state = combatantActionPointState(entry,
        effectiveActionPointMaximum(entry.actor, getActionPointRules()));
      const canTakeTurn = resolveActorConditions(entry.actor, { baseAttributes:
        entry.actor?.system?.baseAttributes ?? entry.actor?.system?.attributes ?? {}
      }).capabilities.canTakeProactiveTurn;
      return state.eligible && state.current > 0 && canTakeTurn;
    });
    if (index >= 0 && this.turn !== index) await this.update({ turn: index });
  }

  actorInAnotherStartedCombat(actor) {
    return game.combats.some((combat) => combat.id !== this.id && combat.started
      && combat.combatants.some((entry) => entry.actor?.uuid === actor.uuid));
  }

  async rollInitiative(ids, { updateTurn = true, messageOptions = {} } = {}) {
    ids = typeof ids === "string" ? [ids] : Array.from(ids ?? []);
    const updates = [];
    const occupied = new Map();
    for (const combatant of this.combatants) {
      if (ids.includes(combatant.id)) continue;
      const data = combatant.getFlag(SCOPE, "initiative")
        ?? splitComposedInitiative(combatant.initiative);
      if (!occupied.has(data.primary)) occupied.set(data.primary, new Set());
      occupied.get(data.primary).add(data.tieBreak);
    }
    for (const id of ids) {
      const combatant = this.combatants.get(id);
      if (!combatant?.actor) continue;
      const maximum = effectiveActionPointMaximum(combatant.actor, getActionPointRules());
      const base = combatant.actor.system.baseAttributes ?? combatant.actor.system.attributes ?? {};
      const bonus = maximum === 0 ? 0 : Number(resolveActorConditions(combatant.actor,
        { baseAttributes: base }).attributes.initiative ?? 0);
      const primaryRoll = await new Roll(`1d10 + ${bonus}`).evaluate();
      const primary = Number(primaryRoll.total);
      const used = occupied.get(primary) ?? new Set();
      let tieRoll; let attempts = 0;
      do { tieRoll = await new Roll("1d100").evaluate(); attempts += 1; }
      while (used.has(Number(tieRoll.total)) && attempts < 120);
      const tieBreak = Number(tieRoll.total);
      const collision = used.has(tieBreak) ? used.size - 99 : 0;
      used.add(tieBreak); occupied.set(primary, used);
      updates.push({ _id: id, initiative: composedInitiative(primary, tieBreak, collision),
        [`flags.${SCOPE}.initiative`]: { primary, tieBreak,
          collision, surprisePenaltyApplied: combatant.actor.statuses?.has?.("surprised") ?? false,
          primaryRoll: primaryRoll.toJSON(), tieBreakRoll: tieRoll.toJSON() } });
    }
    if (updates.length) await this.updateEmbeddedDocuments("Combatant", updates);
    if (updateTurn) await this.selectFirstAvailable();
    return this;
  }

  async ensureInitiativeTieBreaks() {
    if (!isCombatCoordinator()) return;
    const groups = new Map();
    for (const entry of this.combatants) {
      if (entry.initiative == null) continue;
      const stored = entry.getFlag(SCOPE, "initiative");
      const data = stored ?? splitComposedInitiative(entry.initiative);
      if (!groups.has(data.primary)) groups.set(data.primary, []);
      groups.get(data.primary).push({ entry, data, stored });
    }
    const updates = [];
    for (const [primary, group] of groups) {
      if (group.length < 2) continue;
      const used = new Set();
      for (const candidate of group) {
        let tieBreak = candidate.stored?.primary === primary
          ? Number(candidate.stored.tieBreak) : 0;
        if (!tieBreak || used.has(tieBreak)) {
          let roll;
          let attempts = 0;
          do { roll = await new Roll("1d100").evaluate(); attempts += 1; }
          while (used.has(Number(roll.total)) && attempts < 120);
          tieBreak = Number(roll.total);
        }
        const collision = used.has(tieBreak) ? used.size - 99 : 0;
        used.add(tieBreak);
        updates.push({ _id: candidate.entry.id,
          initiative: composedInitiative(primary, tieBreak, collision),
          [`flags.${SCOPE}.initiative`]: { primary, tieBreak, collision } });
      }
    }
    if (updates.length) await this.updateEmbeddedDocuments("Combatant", updates,
      { mythrasTieBreak: true });
  }
}
