export function calculateResourceValue(current, maximum, action) {
  const safeMaximum = Math.max(0, Number(maximum) || 0);
  const safeCurrent = Math.min(
    safeMaximum,
    Math.max(0, Number(current) || 0)
  );

  if (action === "increase") return Math.min(safeMaximum, safeCurrent + 1);
  if (action === "decrease") return Math.max(0, safeCurrent - 1);
  if (action === "restore") return safeMaximum;
  return safeCurrent;
}
