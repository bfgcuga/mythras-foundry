import { resolveConditions, statusDescriptors } from "./condition-resolver.js";

export const BLINDED_STATUS_ID = "blinded";
export const PRONE_STATUS_ID = "prone";
export const UNCONSCIOUS_STATUS_ID = "unconscious";
export const STUNNED_STATUS_ID = "stunned";
export const BLEEDING_STATUS_ID = "bleeding";
export const DROWNING_STATUS_ID = "drowning";
export const SURPRISED_STATUS_ID = "surprised";

export const MYTHRAS_STATUS_EFFECTS = Object.freeze([
  { id: BLINDED_STATUS_ID, name: "MYTHRASF.Status.Blinded",
    img: "icons/svg/blind.svg", skillDifficulty: "herculean" },
  { id: PRONE_STATUS_ID, name: "MYTHRASF.Status.Prone",
    img: "icons/svg/falling.svg", skillDifficulty: "formidable" },
  { id: UNCONSCIOUS_STATUS_ID, name: "MYTHRASF.Status.Unconscious",
    img: "icons/svg/unconscious.svg", skillDifficulty: "impossible", zeroAttributes: true,
    canAttack: false },
  { id: STUNNED_STATUS_ID, name: "MYTHRASF.Status.Stunned",
    img: "icons/svg/daze.svg", canAttack: false },
  { id: BLEEDING_STATUS_ID, name: "MYTHRASF.Status.Bleeding",
    img: "icons/svg/blood.svg", pendingRoundAutomation: true },
  { id: DROWNING_STATUS_ID, name: "MYTHRASF.Status.Drowning",
    img: "icons/svg/drowning.svg", pendingRoundAutomation: true },
  { id: SURPRISED_STATUS_ID, name: "MYTHRASF.Status.Surprised",
    img: "icons/svg/mystery-man.svg", pendingDevelopment: true }
]);

export function activeStatusRules(statuses = new Set()) {
  return MYTHRAS_STATUS_EFFECTS.filter((status) => statuses.has(status.id));
}

export function activeSkillStatusPenalties(statuses = new Set()) {
  return activeStatusRules(statuses)
    .filter((status) => status.skillDifficulty)
    .map(({ id, name, skillDifficulty }) => ({ id, name, skillDifficulty }));
}

export function canActorAttack(statuses = new Set()) {
  return resolveConditions({ descriptors: statusDescriptors(activeStatusRules(statuses)) })
    .capabilities.canAttack;
}

export function applyStatusAttributes(attributes = {}, statuses = new Set()) {
  return { ...resolveConditions({ baseAttributes: attributes,
    descriptors: statusDescriptors(activeStatusRules(statuses)) }).attributes };
}

export function statusSkillDifficulty(statuses = new Set()) {
  return resolveConditions({ descriptors: statusDescriptors(activeStatusRules(statuses)) })
    .difficulties.general;
}
