import { automaticIncapacitatedCauses, INCAPACITATED_FLAG_SCOPE,
  INCAPACITATED_MANUAL_FLAG, INCAPACITATED_STATUS_ID } from "../rules/incapacitated.js";
import { activeStatusRules, STUNNED_STATUS_ID,
  UNCONSCIOUS_STATUS_ID } from "../rules/statuses.js";
import { TIMED_CONDITION_FLAG, TIMED_CONDITION_SCOPE } from "../rules/timed-conditions.js";
import { hitLocationDisplayName } from "../rules/hit-locations.js";

export function prepareActiveStatusControls(actor, { fatigueKey = "fresh",
  woundLevel = "healthy" } = {}) {
  const activeStatuses = activeStatusRules(actor.statuses);
  const automatic = automaticIncapacitatedCauses({ fatigueKey, woundLevel });
  const configured = Array.isArray(CONFIG.statusEffects)
    ? CONFIG.statusEffects : Object.values(CONFIG.statusEffects ?? {});
  const configuredById = new Map(configured.map((status) => [status.id, status]));
  const mythrasById = new Map(activeStatuses.map((status) => [status.id, status]));
  return [
    ...(actor.statuses.has(INCAPACITATED_STATUS_ID) ? [{
      id: INCAPACITATED_STATUS_ID,
      label: game.i18n.localize("MYTHRASF.Status.Incapacitated"),
      locked: automatic.length > 0,
      note: automatic.length > 0
        ? game.i18n.format("MYTHRASF.Status.IncapacitatedActiveCauses", {
          causes: automatic.map((cause) => game.i18n.localize(
            `MYTHRASF.Status.IncapacitatedCause.${cause}`)).join(", ")
        }) : ""
    }] : []),
    ...Array.from(actor.statuses).filter((id) => id !== INCAPACITATED_STATUS_ID)
      .map((id) => {
        const status = mythrasById.get(id);
        const foundryStatus = configuredById.get(id);
        const name = status?.name ?? foundryStatus?.name ?? foundryStatus?.label ?? id;
        const timed = Array.from(actor.effects ?? []).map((effect) =>
          effect.getFlag?.(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG))
          .filter((condition) => condition?.statusId === id);
        const durationNote = timed.map((condition) => {
          const duration = condition.unit === "actorTurn"
            ? game.i18n.format("MYTHRASF.Status.TurnsRemaining", { remaining: condition.remaining })
            : condition.unit === "dyingRounds"
              ? game.i18n.format("MYTHRASF.Dying.RoundsRemainingValue", {
                remaining: condition.remaining })
            : condition.unit === "round" ? game.i18n.localize("MYTHRASF.Status.UntilRoundEnd")
              : condition.durationNote ?? game.i18n.localize("MYTHRASF.Status.ManualDuration");
          const item = condition.locationId ? actor.items.get(condition.locationId) : null;
          const location = item ? hitLocationDisplayName(item) : "";
          const source = condition.sourceName ? game.i18n.format("MYTHRASF.Status.Source", {
            source: condition.sourceName }) : "";
          return [duration, location, source].filter(Boolean).join(" — ");
        })
          .join("; ");
        return {
          id,
          label: game.i18n.has(name) ? game.i18n.localize(name) : name,
          locked: false,
          note: durationNote
        };
      })
  ];
}

export function preparePenaltySummary(summary) {
  const difficulty = (key) => game.i18n.localize(`MYTHRASF.Difficulty.${key}`);
  const signed = (value) => value > 0 ? `−${value}` : "—";
  const movement = (row) => {
    if (row.movement === "subtract") return `−${row.movementPenalty} m`;
    if (row.movement === "half") return game.i18n.localize("MYTHRASF.Penalties.Half");
    if (["immobile", "impossible"].includes(row.movement)) return "0 m";
    return "—";
  };
  const { fatigue, wounds, encumbrance: load, armor, status } = summary.rows;
  const totals = summary.totals;
  const skillTotals = [{ label: game.i18n.localize("MYTHRASF.Penalties.General"),
    value: difficulty(totals.difficulties.general) }];
  if (totals.difficulties.hasPhysicalVariant) skillTotals.push({
    label: `${game.i18n.localize("MYTHRASF.Penalties.Physical")}*`,
    value: difficulty(totals.difficulties.physical)
  });
  if (totals.difficulties.hasSituationalVariant) skillTotals.push({
    label: `${game.i18n.localize("MYTHRASF.Penalties.Situational")}**`,
    value: difficulty(totals.difficulties.situational)
  });
  if (totals.difficulties.hasPhysicalVariant && totals.difficulties.hasSituationalVariant) {
    skillTotals.push({
      label: `${game.i18n.localize("MYTHRASF.Penalties.PhysicalSituational")}*,**`,
      value: difficulty(totals.difficulties.combined)
    });
  }
  const rows = [{
    active: fatigue.difficulty !== "standard" || fatigue.movement !== "none"
      || fatigue.initiativePenalty > 0 || fatigue.actionPointPenalty > 0,
    label: game.i18n.localize("MYTHRASF.Fatigue.Label"),
    skills: fatigue.difficulty === "standard" ? "—" : difficulty(fatigue.difficulty),
    movement: movement(fatigue), initiative: signed(fatigue.initiativePenalty),
    actionPoints: signed(fatigue.actionPointPenalty)
  }, {
    active: wounds.incapacitated || wounds.situationalSteps > 0,
    label: game.i18n.localize("MYTHRASF.Penalties.Wounds"),
    skills: wounds.incapacitated
      ? game.i18n.format("MYTHRASF.Penalties.MinimumDifficulty", {
        difficulty: difficulty("herculean") })
      : wounds.situationalSteps ? "+1**" : "—",
    movement: wounds.incapacitated ? "0 m" : "—",
    initiative: wounds.incapacitated ? "−8" : "—",
    actionPoints: wounds.incapacitated ? "−3" : "—"
  }, {
    active: load.difficultySteps > 0 || load.movement !== "none",
    label: game.i18n.localize("MYTHRASF.Header.Encumbrance"),
    skills: load.difficultySteps ? `+${load.difficultySteps}*` : "—",
    movement: load.movement === "subtract" ? "−2 m"
      : load.movement === "half" ? game.i18n.localize("MYTHRASF.Penalties.Half") : "—",
    initiative: "—", actionPoints: "—"
  }, {
    active: armor.initiativePenalty > 0,
    label: game.i18n.localize("MYTHRASF.Penalties.Armor"), skills: "—", movement: "—",
    initiative: signed(armor.initiativePenalty), actionPoints: "—"
  }, ...status.activeStatuses.filter((activeStatus) => activeStatus.skillDifficulty
    || activeStatus.zeroAttributes || activeStatus.canAttack === false).map((activeStatus) => ({
    active: true,
    label: game.i18n.localize(activeStatus.name),
    skills: activeStatus.id === UNCONSCIOUS_STATUS_ID ? "0"
      : activeStatus.id === STUNNED_STATUS_ID
        ? game.i18n.localize("MYTHRASF.Status.DefendOnly")
        : activeStatus.skillDifficulty ? difficulty(activeStatus.skillDifficulty) : "—",
    movement: activeStatus.zeroAttributes ? "0 m" : "—",
    initiative: activeStatus.zeroAttributes ? "0" : "—",
    actionPoints: activeStatus.zeroAttributes ? "0" : "—"
  })), {
    active: status.manuallyIncapacitated,
    label: game.i18n.localize("MYTHRASF.Status.IncapacitatedManual"),
    skills: status.manuallyIncapacitated
      ? game.i18n.format("MYTHRASF.Penalties.MinimumDifficulty", {
        difficulty: difficulty("herculean") }) : "—",
    movement: status.manuallyIncapacitated ? "0 m" : "—",
    initiative: status.manuallyIncapacitated ? "−8" : "—",
    actionPoints: status.manuallyIncapacitated ? "−3" : "—"
  }].filter((row) => row.active);
  return {
    rows, hasRows: rows.length > 0,
    showPhysicalNote: load.difficultySteps > 0 || load.movement !== "none",
    showSituationalNote: wounds.situationalSteps > 0,
    skillTotals,
    movementTotal: `${totals.movement.base} → ${totals.movement.effective} m`,
    initiativeTotal: `${totals.initiative.base} → ${totals.initiative.effective}`,
    actionPointTotal: `${totals.actionPoints.base} → ${totals.actionPoints.effective}`
  };
}

export function isManuallyIncapacitated(actor) {
  return Boolean(actor.getFlag(INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG));
}
