import { CONDITION_LEVELS } from "./condition-resolver.js";

export const TIMED_CONDITION_SCHEMA_VERSION = 1;
export const TIMED_CONDITION_FLAG = "timedCondition";
export const TIMED_CONDITION_SCOPE = "mythras-foundry";

export function timedConditionSource({ key, statusId = key, source = {}, combat = null,
  duration = {}, locationId = "", capabilities = {}, metadata = {} } = {}) {
  const remaining = ["actorTurn", "round"].includes(duration.unit)
    ? Math.max(1, Math.ceil(Number(duration.remaining ?? duration.value ?? 1))) : null;
  return Object.freeze({ schemaVersion: TIMED_CONDITION_SCHEMA_VERSION, key, statusId,
    sourceUuid: source.uuid ?? "", messageUuid: source.messageUuid ?? "",
    sourceName: source.name ?? "",
    sourceActorUuid: source.actorUuid ?? "", sourceTokenUuid: source.tokenUuid ?? "",
    combatUuid: combat?.uuid ?? source.combatUuid ?? "", appliedRound: combat?.round ?? null,
    appliedCycle: combat?.cycle ?? null, appliedTurn: combat?.turn ?? null,
    unit: duration.unit ?? "manual", phase: duration.phase ?? "manual",
    original: remaining ?? duration.value ?? null, remaining,
    skipCurrentTurn: Boolean(duration.skipCurrentTurn), locationId, capabilities,
    appliedAt: Date.now(), ...metadata });
}

export function advanceActorTurnDuration(condition, { consumeCurrent = false } = {}) {
  if (!condition || condition.unit !== "actorTurn") return { action: "keep", condition };
  if (condition.skipCurrentTurn && !consumeCurrent) return { action: "update",
    condition: { ...condition, skipCurrentTurn: false } };
  const remaining = Math.max(0, Number(condition.remaining ?? 1) - 1);
  const next = { ...condition, remaining, skipCurrentTurn: false };
  return remaining === 0 ? { action: "expire", condition: next }
    : { action: "update", condition: next };
}

export function expiresAtRoundEnd(condition, combatUuid) {
  return condition?.unit === "round" && condition.phase === "endRound"
    && (!condition.combatUuid || condition.combatUuid === combatUuid);
}

export function advanceRoundDuration(condition, combatUuid) {
  if (!expiresAtRoundEnd(condition, combatUuid)) return { action: "keep", condition };
  const remaining = Math.max(0, Number(condition.remaining ?? 1) - 1);
  return remaining === 0 ? { action: "expire", condition: { ...condition, remaining: 0 } }
    : { action: "update", condition: { ...condition, remaining } };
}

export function fatigueLossForResult(result, dieTotal = 1) {
  if (result === "critical") return 0;
  if (result === "success") return 1;
  if (result === "failure") return Math.max(1, Math.min(2, Number(dieTotal) || 1));
  return Math.max(1, Math.min(3, Number(dieTotal) || 1));
}

export function worsenFatigueLevel(current, steps = 1) {
  const index = Math.max(0, CONDITION_LEVELS.findIndex((entry) => entry.key === current));
  return CONDITION_LEVELS[Math.min(CONDITION_LEVELS.length - 1,
    index + Math.max(0, Number(steps) || 0))].key;
}
