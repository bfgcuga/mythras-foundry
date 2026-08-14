export const INCAPACITATED_STATUS_ID = "incapacitated";
export const INCAPACITATED_FLAG_SCOPE = "mythras-foundry";
export const INCAPACITATED_MANUAL_FLAG = "incapacitatedManual";

const FATIGUE_ORDER = Object.freeze([
  "fresh", "winded", "tired", "wearied", "exhausted", "debilitated",
  "incapacitated", "semiConscious", "comatose", "dead"
]);

export function automaticIncapacitatedCauses({ fatigueKey = "fresh",
  woundLevel = "healthy" } = {}) {
  const causes = [];
  if (FATIGUE_ORDER.indexOf(fatigueKey) >= FATIGUE_ORDER.indexOf("incapacitated")) {
    causes.push("fatigue");
  }
  if (woundLevel === "major") causes.push("majorWound");
  return causes;
}

export function incapacitatedCauses({ fatigueKey = "fresh", woundLevel = "healthy",
  manual = false } = {}) {
  return [
    ...automaticIncapacitatedCauses({ fatigueKey, woundLevel }),
    ...(manual ? ["manual"] : [])
  ];
}
