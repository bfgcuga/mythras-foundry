import { actorDisplayName } from "./document-names.js";
import { INCAPACITATED_STATUS_ID } from "./incapacitated.js";
import { applyTimedCondition } from "./timed-condition-runtime.js";
import { timedConditionSource, TIMED_CONDITION_FLAG,
  TIMED_CONDITION_SCOPE } from "./timed-conditions.js";
import { MYTHRAS_STATUS_EFFECTS } from "./statuses.js";
import { hitLocationDisplayName } from "./hit-locations.js";

const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const locationStatuses = new Set(["stunnedLocation", "stunnedTorso"]);

export function statusAssignmentCatalog() {
  return Object.freeze([
    Object.freeze({ id: INCAPACITATED_STATUS_ID, name: "MYTHRASF.Status.Incapacitated",
      img: "icons/svg/unconscious.svg", assignment: "incapacitated",
      description: `MYTHRASF.Status.Description.${INCAPACITATED_STATUS_ID}` }),
    ...MYTHRAS_STATUS_EFFECTS
  ]);
}

export function normalizeStatusDuration({ unit = "manual", value = 1 } = {}) {
  const normalizedUnit = ["actorTurn", "round"].includes(unit) ? unit : "manual";
  return Object.freeze({ unit: normalizedUnit,
    value: normalizedUnit === "manual" ? null : Math.max(1, Math.floor(Number(value) || 1)),
    phase: normalizedUnit === "round" ? "endRound" : normalizedUnit === "actorTurn"
      ? "endActorTurn" : "manual" });
}

function activeCombatFor(actor) {
  return game.combats?.find?.((combat) => combat.started
    && combat.combatants.some((entry) => entry.actor?.uuid === actor.uuid)) ?? null;
}

async function applySimpleStatus(actor, status, { duration, locationId = "" } = {}) {
  const combat = activeCombatFor(actor);
  if (duration.unit === "round" && !combat) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.StatusManager.RoundRequiresCombat"));
    return null;
  }
  const combatData = combat ? { uuid: combat.uuid, round: combat.round,
    cycle: combat.mythrasTurnEconomy?.cycle, turn: combat.turn } : null;
  const source = timedConditionSource({ key: status.id, statusId: status.id,
    combat: combatData, locationId, duration: {
      unit: duration.unit, phase: duration.phase, value: duration.value,
      remaining: duration.value, skipCurrentTurn: duration.unit === "actorTurn"
    } });
  const existing = Array.from(actor.effects ?? []).find((effect) =>
    effect.statuses?.has?.(status.id));
  if (existing) {
    await existing.update({ [`flags.${TIMED_CONDITION_SCOPE}.${TIMED_CONDITION_FLAG}`]: source });
    return existing;
  }
  const [effect] = await applyTimedCondition(actor, { key: status.id, statusId: status.id,
    name: game.i18n.localize(status.name), img: status.img, combat: combatData, locationId,
    duration: { unit: duration.unit, phase: duration.phase, value: duration.value,
      remaining: duration.value, skipCurrentTurn: duration.unit === "actorTurn" } });
  return effect ?? null;
}

async function applyConfiguredStatus(status, actor, token) {
  if (status.assignment === "incapacitated") {
    await actor.toggleStatusEffect(INCAPACITATED_STATUS_ID, { active: true });
    return true;
  }
  const openers = {
    acid: game.mythrasFoundry?.hazards?.acid?.open,
    fire: game.mythrasFoundry?.hazards?.fire?.open,
    suffocation: game.mythrasFoundry?.hazards?.suffocation?.open,
    dying: game.mythrasFoundry?.conditions?.dying?.open
  };
  if (status.assignment === "exsanguination") {
    return game.mythrasFoundry?.conditions?.exsanguination?.apply?.(actor) ?? null;
  }
  return openers[status.assignment]?.({ actor, token }) ?? null;
}

export async function openStatusAssignmentDialog({ actor = null, token = null } = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.StatusManager.GMOnly")); return null;
  }
  if (!actor) {
    const controlled = canvas.tokens?.controlled ?? [];
    if (controlled.length !== 1 || !["character", "npc"].includes(controlled[0]?.actor?.type)) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.StatusManager.SelectOneToken"));
      return null;
    }
    token = controlled[0]; actor = token.actor;
  }
  const catalog = statusAssignmentCatalog();
  const locations = actor.items.filter((item) => item.type === "hitLocation")
    .sort((left, right) => Number(left.system.rangeStart) - Number(right.system.rangeStart));
  const cards = catalog.map((status, index) => `<label class="status-assignment-card"
    data-status-card="${escape(status.id)}" title="${escape(game.i18n.localize(status.description))}">
      <input type="radio" class="sheet-state-box" name="statusId" value="${escape(status.id)}"
        ${index === 0 ? "checked" : ""} aria-label="${escape(game.i18n.localize(status.name))}">
      <img src="${escape(status.img)}" alt="">
      <span><strong>${escape(game.i18n.localize(status.name))}</strong>
        <small>${escape(game.i18n.localize(status.description))}</small></span>
      ${actor.statuses?.has?.(status.id) ? `<em>${escape(game.i18n.localize(
        "MYTHRASF.StatusManager.Active"))}</em>` : ""}
    </label>`).join("");
  const result = await foundry.applications.api.DialogV2.wait({
    classes: ["mythras-foundry", "mythras-paper-sheet", "status-assignment-window"],
    window: { title: game.i18n.localize("MYTHRASF.StatusManager.Title"), resizable: true },
    position: { width: 780, height: 700 },
    content: `<div class="mythras-dialog status-assignment-dialog">
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.StatusManager.Target"))}</legend>
        <div class="sheet-field-readonly">${escape(actorDisplayName(actor))}</div></fieldset>
      <fieldset class="status-assignment-catalog"><legend>${escape(game.i18n.localize(
        "MYTHRASF.StatusManager.Status"))}</legend>${cards}</fieldset>
      <fieldset data-status-duration><legend>${escape(game.i18n.localize(
        "MYTHRASF.StatusManager.DurationLabel"))}</legend>
        <select class="sheet-field-editable" name="durationUnit">
          ${["manual", "actorTurn", "round"].map((unit) => `<option value="${unit}">${escape(
            game.i18n.localize(`MYTHRASF.StatusManager.DurationOption.${unit}`))}</option>`).join("")}
        </select>
        <label data-duration-value hidden><span>${escape(game.i18n.localize(
          "MYTHRASF.StatusManager.DurationValue"))}</span>
          <input type="number" class="sheet-field-editable" name="durationValue" min="1" step="1" value="1"></label>
      </fieldset>
      <fieldset data-status-location hidden><legend>${escape(game.i18n.localize(
        "MYTHRASF.StatusManager.Location"))}</legend>
        <select class="sheet-field-editable" name="locationId"><option value="">${escape(
          game.i18n.localize("MYTHRASF.StatusManager.NoLocation"))}</option>${locations.map(
            (location) => `<option value="${escape(location.id)}">${escape(hitLocationDisplayName(location))}</option>`
          ).join("")}</select></fieldset>
      <p class="status-assignment-configured" data-configured-help hidden>${escape(
        game.i18n.localize("MYTHRASF.StatusManager.ConfiguredHelp"))}</p>
    </div>`,
    buttons: [{ action: "apply", label: game.i18n.localize("MYTHRASF.StatusManager.Apply"),
      icon: "fas fa-person-circle-plus", default: true, callback: (event, button) => ({
        statusId: button.form.elements.statusId.value,
        durationUnit: button.form.elements.durationUnit.value,
        durationValue: Number(button.form.elements.durationValue.value),
        locationId: button.form.elements.locationId.value }) },
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), icon: "fas fa-times",
      callback: () => null }],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form");
      const refresh = () => {
        const status = catalog.find((entry) => entry.id === form.elements.statusId.value);
        const timed = status?.assignment === "timed";
        form.querySelector("[data-status-duration]").hidden = !timed;
        form.querySelector("[data-duration-value]").hidden = !timed
          || form.elements.durationUnit.value === "manual";
        form.querySelector("[data-status-location]").hidden = !locationStatuses.has(status?.id);
        form.querySelector("[data-configured-help]").hidden = timed;
      };
      form.addEventListener("change", refresh); refresh();
    }, rejectClose: false
  });
  if (!result) return null;
  const status = catalog.find((entry) => entry.id === result.statusId);
  if (!status) return null;
  if (status.assignment !== "timed") return applyConfiguredStatus(status, actor, token);
  return applySimpleStatus(actor, status, {
    duration: normalizeStatusDuration({ unit: result.durationUnit, value: result.durationValue }),
    locationId: result.locationId
  });
}

export function createStatusAssignmentApi() {
  return Object.freeze({ open: openStatusAssignmentDialog, list: statusAssignmentCatalog });
}
