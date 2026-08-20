export const RANGED_BANDS = Object.freeze(["short", "effective", "long"]);
export const MOVEMENT_MODES = Object.freeze(["stationary", "walk", "run", "sprint"]);
const DIFFICULTIES = Object.freeze(["automatic", "veryEasy", "easy", "standard", "hard",
  "formidable", "herculean", "impossible"]);

export function parseRangeProfile(value) {
  if (value && typeof value === "object") {
    const profile = { short: Number(value.short), effective: Number(value.effective),
      long: Number(value.long) };
    return Object.values(profile).every((entry) => Number.isFinite(entry) && entry >= 0)
      && profile.short <= profile.effective && profile.effective <= profile.long ? profile : null;
  }
  const parts = String(value ?? "").trim().split("/").map((entry) => Number(entry.trim()));
  if (parts.length !== 3 || parts.some((entry) => !Number.isFinite(entry) || entry < 0)
    || parts[0] > parts[1] || parts[1] > parts[2]) return null;
  return { short: parts[0], effective: parts[1], long: parts[2] };
}

export function rangedBand(distance, profile) {
  const meters = Number(distance); const ranges = parseRangeProfile(profile);
  if (!ranges || !Number.isFinite(meters) || meters < 0) return "invalid";
  if (meters <= ranges.short) return "short";
  if (meters <= ranges.effective) return "effective";
  if (meters <= ranges.long) return "long";
  return "beyond";
}

const SIZE_COLUMNS = Object.freeze([10, 20, 40, 80, 150, 300]);

export function targetSizeColumn(size) {
  const numeric = Math.max(0, Number(size) || 0);
  const index = SIZE_COLUMNS.findIndex((limit) => numeric <= limit);
  return index < 0 ? SIZE_COLUMNS.length - 1 : index;
}

export function distanceSizeSteps(distance, size) {
  const meters = Math.max(1, Number(distance) || 1);
  const row = Math.max(0, Math.ceil(meters / 20) - 1);
  const column = targetSizeColumn(size);
  const table = [
    [0, 0, -1, -1, -2, -2], [1, 1, 0, -1, -1, -2],
    [2, 1, 1, 0, -1, -1], [2, 2, 1, 1, 0, -1],
    [3, 2, 2, 1, 1, 0], [3, 3, 2, 2, 1, 1],
    [4, 3, 3, 2, 2, 1]
  ];
  if (row < table.length) return table[row][column];
  return table.at(-1)[column] + Math.ceil((row - (table.length - 1)) / 2);
}

export function combineRangedDifficulty(baseDifficulty, modifiers = [], aim = false) {
  let steps = modifiers.reduce((sum, entry) => sum + Number(entry.steps ?? entry), 0);
  const aimApplied = aim && steps > 0;
  if (aimApplied) steps -= 1;
  const base = Math.max(0, DIFFICULTIES.indexOf(baseDifficulty));
  const index = Math.max(0, Math.min(DIFFICULTIES.length - 1, base + steps));
  return { difficulty: DIFFICULTIES[index], steps, aimApplied };
}

export function rangedAttackProfile({ distance, ranges, targetSize, baseDifficulty = "standard",
  modifiers = [], aim = false } = {}) {
  const band = rangedBand(distance, ranges);
  if (["invalid", "beyond"].includes(band)) return { valid: false, band };
  const distanceSteps = distanceSizeSteps(distance, targetSize);
  const combined = combineRangedDifficulty(baseDifficulty,
    [{ source: "distanceSize", steps: distanceSteps }, ...modifiers], aim);
  return { valid: true, band, distance: Number(distance), ranges: parseRangeProfile(ranges),
    targetSize: Number(targetSize) || 0, distanceSteps, ...combined };
}

export function applyLongRangeDamage(value, band) {
  return band === "long" ? Math.ceil(Math.max(0, Number(value) || 0) / 2) : Math.max(0, Number(value) || 0);
}

const POWER = Object.freeze(["P", "M", "G", "E", "D", "C"]);
export function reducePowerCategory(power, steps = 1) {
  const index = POWER.indexOf(String(power ?? "").toUpperCase());
  return index < 0 ? String(power ?? "") : POWER[Math.max(0, index - Math.max(0, steps))];
}

export function ammunitionState(mode = {}) {
  return { tracking: Boolean(mode.ammoTracking ?? mode.tracking), capacity: Math.max(1, Number(mode.ammoCapacity ?? mode.capacity) || 1),
    loaded: Math.max(0, Number(mode.ammoLoaded ?? mode.loaded) || 0), reserve: Math.max(0, Number(mode.ammoReserve ?? mode.reserve) || 0),
    reloadActions: Math.max(0, Number(mode.reloadActions ?? mode.reload) || 0),
    reloadProgress: Math.max(0, Number(mode.reloadProgress) || 0) };
}

export function canFireAmmunition(mode) {
  const state = ammunitionState(mode);
  return !state.tracking || state.loaded > 0;
}

export function consumeAmmunition(mode) {
  const state = ammunitionState(mode);
  return state.tracking ? { ...state, loaded: Math.max(0, state.loaded - 1), reloadProgress: 0 } : state;
}

export function advanceReload(mode) {
  const state = ammunitionState(mode);
  if (!state.tracking || state.reserve < 1 || state.loaded >= state.capacity) return { ...state, changed: false };
  const needed = Math.max(1, state.reloadActions);
  const progress = state.reloadProgress + 1;
  if (progress < needed) return { ...state, reloadProgress: progress, changed: true, completed: false };
  const transferred = Math.min(state.capacity - state.loaded, state.reserve);
  return { ...state, loaded: state.loaded + transferred, reserve: state.reserve - transferred,
    reloadProgress: 0, changed: true, completed: true };
}

export function isAccidentalMeleeHit({ rawRoll, modifiedTarget, normalTarget, meleePosition }) {
  return ["edge", "inside"].includes(meleePosition) && Number(rawRoll) > Number(modifiedTarget)
    && Number(rawRoll) <= Number(normalTarget);
}
