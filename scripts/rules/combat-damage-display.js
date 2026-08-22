function activeResults(die) {
  return Array.from(die?.results ?? []).filter((entry) => entry.active !== false
    && !entry.discarded).map((entry) => Number(entry.result));
}

function expandDice(formula, dice) {
  return String(formula ?? "0").replace(/(\d*)d(\d+)/gi, (notation, countText) => {
    const die = dice.shift();
    if (!die) return notation;
    const count = Number(countText || 1);
    const results = activeResults(die).slice(0, count);
    if (!results.length) return notation;
    return results.length === 1 ? String(results[0]) : `(${results.join(" + ")})`;
  }).replace(/\s*\+\s*-/g, " - ").replace(/\s+/g, " ").trim();
}

export function evaluatedDamageExpression(roll, formulas = []) {
  const dice = Array.from(roll?.dice ?? []);
  return formulas.filter((formula, index) => index < 2 || String(formula ?? "0") !== "0")
    .map((formula) => expandDice(formula, dice)).join(" + ")
    .replace(/\s*\+\s*-/g, " - ");
}
