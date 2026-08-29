import { classifyContestRoll } from "./contest-rolls.js";
import { applyDeath } from "./death.js";
import { evaluateAnimatedRoll } from "./dice-animation.js";
import { applyDying, criticalWoundOutcome } from "./dying.js";
import { woundLocationKind } from "./hit-locations.js";
import { recordAbilityFumble } from "./skills.js";
import { applyTimedCondition } from "./timed-condition-runtime.js";

const successResults = new Set(["success", "critical"]);

export function woundConsequencePlan({ wound, locationKind = {}, enduranceSucceeded = null,
  healingRate = 1, penetratingDamage = 0 } = {}) {
  const { extremity = false, leg = false } = locationKind;
  const actions = [];
  if (wound === "serious") {
    actions.push(Object.freeze({ type: "stunned", durationFormula: "1d3" }));
    if (enduranceSucceeded === false && extremity) {
      actions.push(Object.freeze({ type: "disableLocation" }));
      if (leg) actions.push(Object.freeze({ type: "prone" }));
    }
    if (enduranceSucceeded === false && !extremity) actions.push(Object.freeze({
      type: "unconscious", durationNote: `${Math.max(1, Number(penetratingDamage) || 1)} minutes`
    }));
  }
  if (wound === "major") {
    if (extremity) {
      actions.push(Object.freeze({ type: "prone" }));
      const dying = criticalWoundOutcome({ extremity: true, healingRate });
      actions.push(Object.freeze({ type: "dying", ...dying }));
      if (enduranceSucceeded === false) actions.push(Object.freeze({ type: "unconscious" }));
    } else {
      actions.push(Object.freeze({ type: "unconscious" }));
      if (enduranceSucceeded === true) {
        const dying = criticalWoundOutcome({ enduranceSucceeded: true, healingRate });
        actions.push(Object.freeze({ type: "dying", ...dying }));
      }
      if (enduranceSucceeded === false) actions.push(Object.freeze({ type: "death" }));
    }
  }
  return Object.freeze({ wound, requiresEndurance: ["serious", "major"].includes(wound),
    enduranceSucceeded, actions: Object.freeze(actions) });
}

export async function executeWoundConsequencePlan(plan, handlers = {}) {
  const results = [];
  for (const action of plan?.actions ?? []) {
    const handler = handlers[action.type];
    results.push({ action, result: handler ? await handler(action) : null });
  }
  return results;
}

export async function rollSimpleWoundEndurance(actor) {
  const skill = actor?.items?.find((item) => item.type === "skill"
    && item.system.slug === "aguante");
  if (!skill) return Object.freeze({ succeeded: false, roll: null, target: 0,
    result: "failure" });
  const roll = await evaluateAnimatedRoll("1d100",
    { speaker: ChatMessage.getSpeaker({ actor }) });
  const target = Number(skill.system.total ?? 0);
  const result = classifyContestRoll(roll.total, target);
  await recordAbilityFumble(skill, result);
  return Object.freeze({ succeeded: successResults.has(result), roll, target, result });
}

const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

export function hazardWoundConsequenceRows(consequence) {
  if (!consequence) return "";
  const endurance = consequence.enduranceRoll ? `<div class="mythras-chat-row"><span>${escape(
    game.i18n.localize("MYTHRASF.Suffocation.Endurance"))} (1d100)</span><strong><span class="mythras-chat-roll-value">${Number(
    consequence.enduranceRoll.total)}</span> / ${Number(consequence.enduranceTarget)} — ${escape(
    game.i18n.localize(`MYTHRASF.RollResult.${consequence.enduranceResult}`))}</strong></div>` : "";
  const outcome = consequence.outcome ? `<div class="mythras-chat-row"><span>${escape(
    game.i18n.localize("MYTHRASF.Dying.Outcome"))}</span><strong>${escape(
    consequence.outcome === "dead" ? game.i18n.localize("MYTHRASF.Dying.OutcomeDead")
      : game.i18n.format("MYTHRASF.Dying.OutcomeDying", { rounds: consequence.rounds }))}</strong></div>` : "";
  return endurance + outcome;
}

export async function applyHazardWoundConsequences(actor, location, before, after,
  { sourceStatus = "MYTHRASF.Status.Acid" } = {}) {
  if (before === after || !["serious", "major"].includes(after)) return null;
  const sourceName = game.i18n.localize(sourceStatus);
  const endurance = await rollSimpleWoundEndurance(actor);
  const plan = woundConsequencePlan({ wound: after, locationKind: woundLocationKind(location),
    enduranceSucceeded: endurance.succeeded,
    healingRate: actor.system.attributes?.healingRate });
  let outcome = null; let rounds = 0;
  await executeWoundConsequencePlan(plan, {
    stunned: async (action) => {
      const duration = await evaluateAnimatedRoll(action.durationFormula);
      return applyTimedCondition(actor, { name: game.i18n.localize("MYTHRASF.Status.Stunned"),
        img: "icons/svg/daze.svg", key: "stunned", statusId: "stunned",
        source: { name: sourceName }, locationId: location.id,
        duration: { unit: "actorTurn", value: duration.total } });
    },
    disableLocation: () => location.update({ "system.disabled": true }),
    prone: () => applyTimedCondition(actor, { name: game.i18n.localize("MYTHRASF.Status.Prone"),
      img: "icons/svg/falling.svg", key: "prone", statusId: "prone",
      source: { name: sourceName }, locationId: location.id, duration: { unit: "manual" } }),
    unconscious: (action) => applyTimedCondition(actor, {
      name: game.i18n.localize("MYTHRASF.Status.Unconscious"),
      img: "icons/svg/unconscious.svg", key: "unconscious", statusId: "unconscious",
      source: { name: sourceName }, locationId: location.id, duration: { unit: "manual" },
      metadata: action.durationNote ? { durationNote: action.durationNote } : undefined }),
    dying: async (action) => {
      const dying = await applyDying(actor, { rounds: action.rounds, mode: action.mode,
        locationId: location.id, sourceName });
      outcome = dying ? "dying" : "dead"; rounds = dying?.remaining ?? 0;
      return dying;
    },
    death: async () => { await applyDeath(actor); outcome = "dead"; }
  });
  return { wound: after, outcome, rounds, enduranceRoll: endurance.roll,
    enduranceTarget: endurance.target, enduranceResult: endurance.result };
}
