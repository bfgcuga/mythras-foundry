export function grabData(effect) {
  return effect?.getFlag?.("mythras-foundry", "timedCondition")
    ?? effect?.flags?.["mythras-foundry"]?.timedCondition;
}

export function activeGrabs(actor) {
  return Array.from(actor?.effects ?? []).filter((effect) => !effect.disabled
    && !effect.isSuppressed && grabData(effect)?.key === "grabbed");
}

export function isGrabbed(actor) {
  return activeGrabs(actor).length > 0 || Boolean(actor?.statuses?.has?.("grabbed"));
}
