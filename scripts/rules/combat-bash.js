export function bashKnockback({ damage = 0, weaponType = "", attackerSize = 0,
  targetSize = 0 } = {}) {
  const sourceSize = Math.max(0, Number(attackerSize) || 0);
  const victimSize = Math.max(0, Number(targetSize) || 0);
  const allowed = sourceSize > 0 && victimSize <= sourceSize * 2;
  const divisor = weaponType === "shield" ? 2 : 3;
  return { allowed, divisor, distance: allowed
    ? Math.floor(Math.max(0, Number(damage) || 0) / divisor) : 0 };
}
