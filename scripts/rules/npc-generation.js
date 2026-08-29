import { CHARACTERISTIC_KEYS } from "./derived-attributes.js";
import { calculateNpcAttributes, NPC_OVERRIDE_KEYS } from "./npc.js";

export class NpcGenerationError extends Error {
  constructor(failures) {
    super(failures.map((failure) => `${failure.label}: ${failure.message}`).join("; "));
    this.name = "NpcGenerationError";
    this.failures = failures;
  }
}

export function shouldGenerateNpcToken({ actorType, actorLink = false } = {}) {
  return actorType === "npc" && !actorLink;
}

export async function materializeNpc(source, evaluateFormula) {
  const actor = clone(source);
  const failures = [];

  for (const key of CHARACTERISTIC_KEYS) {
    await applyFormula({
      formula: actor.system?.characteristicFormulas?.[key],
      label: `system.${key}`,
      min: 1,
      integer: true,
      evaluateFormula,
      failures,
      apply: (value) => { actor.system[key] = value; }
    });
  }

  for (const key of NPC_OVERRIDE_KEYS) {
    const override = actor.system?.attributeOverrides?.[key];
    if (override?.mode !== "manual") continue;
    await applyFormula({
      formula: override.formula,
      label: `system.attributeOverrides.${key}`,
      min: 0,
      integer: true,
      evaluateFormula,
      failures,
      apply: (value) => { override.value = value; }
    });
  }

  for (const item of actor.items ?? []) {
    await materializeItem(item, evaluateFormula, failures);
  }

  if (failures.length) throw new NpcGenerationError(failures);

  const attributes = calculateNpcAttributes(actor.system);
  actor.system.resources ??= {};
  for (const [resourceKey, maximumKey] of [
    ["actionPoints", "actionPointsMax"],
    ["magicPoints", "magicPointsMax"],
    ["luckPoints", "luckPointsMax"]
  ]) {
    actor.system.resources[resourceKey] ??= {};
    actor.system.resources[resourceKey].value = Math.max(0, Number(attributes[maximumKey] ?? 0));
  }

  return actor;
}

async function materializeItem(item, evaluateFormula, failures) {
  const system = item.system ??= {};
  if (["skill", "combatStyle"].includes(item.type) && system.valueMode === "manual") {
    await applyFormula({ formula: system.generationFormula, label: `${item.name}.manualValue`,
      min: 0, integer: true, evaluateFormula, failures,
      apply: (value) => { system.manualValue = value; } });
  }
  if (item.type === "passion") {
    await applyFormula({ formula: system.generationFormula, label: `${item.name}.value`,
      min: 0, integer: true, evaluateFormula, failures,
      apply: (value) => { system.value = value; system.structured = false; } });
  }
  if (item.type === "equipment" || item.type === "weapon" || item.type === "armor") {
    await applyFormula({ formula: system.quantityFormula, label: `${item.name}.quantity`,
      min: 0, integer: true, evaluateFormula, failures,
      apply: (value) => { system.quantity = value; } });
  }
  if (item.type === "hitLocation" || item.type === "weapon") {
    await applyFormula({ formula: system.maxHitPointsFormula,
      label: `${item.name}.maxHitPoints`, min: item.type === "hitLocation" ? 1 : 0,
      integer: true, evaluateFormula, failures,
      apply: (value) => { system.maxHitPoints = value; } });
    system.currentHitPoints = Number(system.maxHitPoints ?? 0);
    if (item.type === "hitLocation" && isLocationCrippled(item)) {
      const original = Number(system.maxHitPoints);
      const severity = Number(system.permanentWound.severity);
      const effective = permanentWoundMaximum(original, severity);
      system.permanentWound.originalMaxHitPoints = original;
      system.permanentWound.effectiveMaxHitPoints = effective;
      system.permanentWound.lostHitResults = permanentWoundLostHitResults(item, severity);
      system.maxHitPoints = effective;
      system.currentHitPoints = effective;
    }
  }
  if (["hitLocation", "weapon", "armor"].includes(item.type)) {
    await applyFormula({ formula: system.armorPointsFormula,
      label: `${item.name}.armorPoints`, min: 0, integer: true, evaluateFormula, failures,
      apply: (value) => { system.armorPoints = value; } });
  }
}

async function applyFormula({ formula, label, min, integer, evaluateFormula, failures, apply }) {
  const expression = String(formula ?? "").trim();
  if (!expression) return;
  if (expression.includes("@")) {
    failures.push({ label, message: "data references are not allowed" });
    return;
  }
  try {
    const result = Number(await evaluateFormula(expression));
    if (!Number.isFinite(result)) throw new Error("result is not finite");
    if (integer && !Number.isInteger(result)) throw new Error("result must be an integer");
    if (result < min) throw new Error(`result must be at least ${min}`);
    apply(result);
  } catch (error) {
    failures.push({ label, message: error?.message ?? String(error) });
  }
}

function clone(value) {
  return globalThis.structuredClone
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}
import { isLocationCrippled, permanentWoundMaximum,
  permanentWoundLostHitResults } from "./hit-locations.js";
