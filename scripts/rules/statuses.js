import { resolveConditions, statusDescriptors } from "./condition-resolver.js";

export const BLINDED_STATUS_ID = "blinded";
export const PRONE_STATUS_ID = "prone";
export const UNCONSCIOUS_STATUS_ID = "unconscious";
export const STUNNED_STATUS_ID = "stunned";
export const BLEEDING_STATUS_ID = "bleeding";
export const DROWNING_STATUS_ID = "drowning";
export const SURPRISED_STATUS_ID = "surprised";
export const SURPRISED_OFFENSIVE_STATUS_ID = "surprisedOffensive";
export const PRESSED_STATUS_ID = "pressed";
export const OFF_BALANCE_STATUS_ID = "offBalance";
export const SUPPRESSED_STATUS_ID = "suppressed";
export const SERIOUS_WOUND_STATUS_ID = "seriousWound";
export const STUNNED_LOCATION_STATUS_ID = "stunnedLocation";
export const EXSANGUINATING_STATUS_ID = "exsanguinating";
export const SILENCED_STATUS_ID = "silenced";
export const STUNNED_TORSO_STATUS_ID = "stunnedTorso";
export const CROUCHED_BEHIND_SHIELD_STATUS_ID = "crouchedBehindShield";
export const ACID_SPLASH_STATUS_ID = "acidSplash";
export const ACID_IMMERSION_STATUS_ID = "acidImmersion";
export const BURNING_STATUS_ID = "burning";
export const SUFFOCATING_STATUS_ID = "suffocating";
export const DYING_STATUS_ID = "dying";

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
    img: "icons/svg/blood.svg", roundAutomation: "resistance" },
  { id: DROWNING_STATUS_ID, name: "MYTHRASF.Status.Drowning",
    img: "systems/mythras-foundry/assets/icons/suffocation.svg", roundAutomation: "resistance" },
  { id: SURPRISED_STATUS_ID, name: "MYTHRASF.Status.Surprised",
    img: "icons/svg/mystery-man.svg", initiativePenalty: 10, canAttack: false,
    canDefend: false },
  { id: SURPRISED_OFFENSIVE_STATUS_ID, name: "MYTHRASF.Status.Surprised",
    img: "icons/svg/mystery-man.svg", canAttack: false },
  { id: PRESSED_STATUS_ID, name: "MYTHRASF.Status.Pressed",
    img: "icons/svg/sword.svg", canAttack: false },
  { id: OFF_BALANCE_STATUS_ID, name: "MYTHRASF.Status.OffBalance",
    img: "icons/svg/falling.svg", canAttack: false },
  { id: SUPPRESSED_STATUS_ID, name: "MYTHRASF.Status.Suppressed",
    img: "icons/svg/target.svg" },
  { id: SERIOUS_WOUND_STATUS_ID, name: "MYTHRASF.Status.SeriousWound",
    img: "icons/svg/blood.svg", canAttack: false },
  { id: STUNNED_LOCATION_STATUS_ID, name: "MYTHRASF.Status.StunnedLocation",
    img: "icons/svg/daze.svg" },
  { id: STUNNED_TORSO_STATUS_ID, name: "MYTHRASF.Status.StunnedTorso",
    img: "icons/svg/daze.svg", canAttack: false, canTakeProactiveTurn: false },
  { id: EXSANGUINATING_STATUS_ID, name: "MYTHRASF.Status.Exsanguinating",
    img: "icons/svg/blood.svg", roundAutomation: "automatic",
    assignment: "exsanguination" },
  { id: SILENCED_STATUS_ID, name: "MYTHRASF.Status.Silenced",
    img: "icons/svg/silenced.svg" },
  { id: CROUCHED_BEHIND_SHIELD_STATUS_ID, name: "MYTHRASF.Status.CrouchedBehindShield",
    img: "icons/svg/shield.svg" },
  { id: ACID_SPLASH_STATUS_ID, name: "MYTHRASF.Status.AcidSplash", img: "icons/svg/acid.svg",
    assignment: "acid" },
  { id: ACID_IMMERSION_STATUS_ID, name: "MYTHRASF.Status.AcidImmersion", img: "icons/svg/acid.svg",
    assignment: "acid" },
  { id: BURNING_STATUS_ID, name: "MYTHRASF.Status.Burning", img: "icons/svg/fire.svg",
    assignment: "fire" },
  { id: SUFFOCATING_STATUS_ID, name: "MYTHRASF.Status.Suffocating",
    img: "systems/mythras-foundry/assets/icons/suffocation.svg", assignment: "suffocation" },
  { id: DYING_STATUS_ID, name: "MYTHRASF.Status.Dying", img: "icons/svg/skull.svg",
    canAttack: false, canTakeProactiveTurn: false, assignment: "dying" }
].map((status) => Object.freeze({ assignment: "timed", ...status,
  description: `MYTHRASF.Status.Description.${status.id}` })));

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

export function actorCapabilities(statuses = new Set()) {
  return resolveConditions({ descriptors: statusDescriptors(activeStatusRules(statuses)) })
    .capabilities;
}

export function applyStatusAttributes(attributes = {}, statuses = new Set()) {
  return { ...resolveConditions({ baseAttributes: attributes,
    descriptors: statusDescriptors(activeStatusRules(statuses)) }).attributes };
}

export function statusSkillDifficulty(statuses = new Set()) {
  return resolveConditions({ descriptors: statusDescriptors(activeStatusRules(statuses)) })
    .difficulties.general;
}
