export const STATUS_ALIASES = Object.freeze({
  stun: "stunned", silence: "silenced", blind: "blinded"
});

export function canonicalStatusId(id) {
  return STATUS_ALIASES[id] ?? id;
}

export function canonicalStatusIds(statuses = []) {
  return [...new Set(Array.from(statuses, canonicalStatusId))];
}

// Minimal updates preserve durations, sources, disabled state and custom images.
export function statusAliasUpdate(effect) {
  const previous = Array.from(effect.statuses ?? []);
  const statuses = canonicalStatusIds(previous);
  if (statuses.length === previous.length && statuses.every((id, i) => id === previous[i])) return {};
  const update = { statuses };
  const condition = effect.flags?.["mythras-foundry"]?.timedCondition;
  if (condition) {
    for (const field of ["key", "statusId"]) {
      if (STATUS_ALIASES[condition[field]]) {
        update[`flags.mythras-foundry.timedCondition.${field}`] = canonicalStatusId(condition[field]);
      }
    }
  }
  return update;
}

export function canonicalSpecialStatuses(special = {}) {
  return Object.fromEntries(Object.entries(special).map(([key, id]) => [key, canonicalStatusId(id)]));
}
