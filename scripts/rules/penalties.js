export function penalizedValue(base, effective) {
  return { base, effective, penalized: effective !== base };
}

export function penalizedResource(value, baseMaximum, effectiveMaximum) {
  const current = Math.max(0, Number(value ?? 0));
  const baseMax = Math.max(0, Number(baseMaximum ?? 0));
  const effectiveMax = Math.max(0, Number(effectiveMaximum ?? 0));
  const effectiveCurrent = Math.min(current, effectiveMax);
  return {
    base: `${Math.min(current, baseMax)}/${baseMax}`,
    effective: `${effectiveCurrent}/${effectiveMax}`,
    effectiveCurrent,
    penalized: effectiveMax !== baseMax
  };
}
