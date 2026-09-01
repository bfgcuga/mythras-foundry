import { classifyContestRoll, differentialAdvantage } from "./contest-rolls.js";

export const FAMILIARITY_LEVELS = Object.freeze([
  "included",
  "similar",
  "broadlySimilar",
  "reasonablyDifferent",
  "substantiallyDifferent"
]);

export const UNTRAINED_COMBAT_STYLE_ID = "__untrained__";
export const WEAPON_SIZE_ORDER = Object.freeze(["small", "medium", "large", "huge", "enormous"]);

const WEAPON_SIZE_ALIASES = Object.freeze({
  p: "small", pequena: "small", small: "small", s: "small",
  m: "medium", media: "medium", medium: "medium",
  g: "large", grande: "large", large: "large", l: "large",
  e: "huge", enorme: "huge", huge: "huge", h: "huge",
  d: "enormous", descomunal: "enormous", enormous: "enormous", x: "enormous"
});

export function normalizeWeaponSize(value) {
  const key = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();
  return WEAPON_SIZE_ALIASES[key] ?? null;
}

export function parryReduction(attackingSize, defendingSize) {
  const attack = WEAPON_SIZE_ORDER.indexOf(normalizeWeaponSize(attackingSize));
  const defense = WEAPON_SIZE_ORDER.indexOf(normalizeWeaponSize(defendingSize));
  if (attack < 0 || defense < 0) return { type: "unknown", divisor: 1 };
  if (defense >= attack) return { type: "full", divisor: Infinity };
  if (defense === attack - 1) return { type: "half", divisor: 2 };
  return { type: "none", divisor: 1 };
}

export function evasionWinner(exchange) {
  if (exchange?.defense?.type !== "evade") return null;
  const grade = { fumble: 0, failure: 1, success: 2, critical: 3 };
  const attackGrade = grade[exchange.attack?.result] ?? -1;
  const defenseGrade = grade[exchange.defense?.result] ?? -1;
  if (attackGrade !== defenseGrade) return attackGrade > defenseGrade ? "attacker" : "defender";
  const attackRoll = Number(exchange.attack?.rawRoll);
  const defenseRoll = Number(exchange.defense?.rawRoll);
  if (attackRoll === defenseRoll) return null;
  return attackRoll > defenseRoll ? "attacker" : "defender";
}

export function combatAttackHits(exchange) {
  if (!["success", "critical"].includes(exchange?.attack?.result)) return false;
  return exchange?.defense?.type === "evade" ? evasionWinner(exchange) === "attacker" : true;
}

export function resolveDamage({ rolledDamage = 0, containedBlow = false,
  parry = { type: "none" }, passiveBlock = { type: "none" }, coverPoints = 0,
  armorPoints = 0, targetSize = 0 } = {}) {
  const rolled = Math.max(0, Number(rolledDamage) || 0);
  const afterContainedBlow = containedBlow ? Math.ceil(rolled / 2) : rolled;
  const beforeMitigation = afterContainedBlow;
  const afterParry = parry.type === "full" ? 0 : parry.type === "half"
    ? Math.ceil(afterContainedBlow / 2) : afterContainedBlow;
  const afterPassiveBlock = passiveBlock.type === "full" ? 0 : passiveBlock.type === "half"
    ? Math.ceil(afterParry / 2) : afterParry;
  const cover = Math.max(0, Number(coverPoints) || 0);
  const afterCover = Math.max(0, afterPassiveBlock - cover);
  const armor = Math.max(0, Number(armorPoints) || 0);
  const penetratingDamage = Math.max(0, afterCover - armor);
  const size = Math.max(0, Number(targetSize) || 0);
  const push = beforeMitigation > size ? {
    triggered: true, excess: beforeMitigation - size,
    distance: Math.ceil((beforeMitigation - size) / 5)
  } : { triggered: false, excess: 0, distance: 0 };
  return { rolledDamage: rolled, containedBlow: Boolean(containedBlow), afterContainedBlow,
    beforeMitigation, parryType: parry.type, afterParry,
    passiveBlockType: passiveBlock.type, afterPassiveBlock,
    coverPoints: cover, afterCover, armorPoints: armor, penetratingDamage, push };
}

export function normalizeWeaponProfile(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseWeaponProfileReferences(value) {
  return String(value ?? "")
    .split(/[,;\n]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ key: normalizeWeaponProfile(name), name }));
}

export function styleIncludesWeapon(style, weapon) {
  const key = weapon?.system?.profileKey || normalizeWeaponProfile(weapon?.name);
  return (style?.system?.weaponProfiles ?? []).some((profile) => profile.key === key);
}

export function resolveWeaponStyle({ weapon, styles, selectedStyleId, familiarity }) {
  const matching = styles.filter((style) => styleIncludesWeapon(style, weapon));
  const base = Number(weapon?.actor?.system?.strength ?? 0)
    + Number(weapon?.actor?.system?.dexterity ?? 0);
  if (matching.length === 0 && selectedStyleId === UNTRAINED_COMBAT_STYLE_ID) {
    return {
      style: null,
      matching,
      familiarity: "untrained",
      difficulty: "standard",
      target: base,
      usesBase: true,
      untrained: true
    };
  }
  const selected = styles.find((style) => style.id === selectedStyleId);
  const directStyle = matching.find((style) => style.id === selectedStyleId)
    ?? (matching.length === 1 ? matching[0] : null);
  if (directStyle) {
    return { style: directStyle, matching, familiarity: "included", difficulty: "standard",
      target: Number(directStyle.system.total ?? 0), usesBase: false, untrained: false };
  }

  const fallback = selected && !matching.includes(selected) ? selected : null;
  const level = FAMILIARITY_LEVELS.includes(familiarity) && familiarity !== "included"
    ? familiarity
    : "similar";
  const difficulties = {
    similar: "standard",
    broadlySimilar: "hard",
    reasonablyDifferent: "formidable",
    substantiallyDifferent: "standard"
  };
  const usesBase = level === "substantiallyDifferent";
  return {
    style: fallback,
    matching,
    familiarity: level,
    difficulty: difficulties[level],
    target: usesBase ? base : Number(fallback?.system?.total ?? base),
    usesBase,
    untrained: false
  };
}

export function difficultyTarget(value, difficulty = "standard") {
  const multipliers = { veryEasy: 2, easy: 1.5, standard: 1, hard: 2 / 3,
    formidable: 0.5, herculean: 0.2, impossible: 0 };
  return Math.max(0, Math.ceil(Number(value ?? 0) * (multipliers[difficulty] ?? 1)));
}

export function applyArmor(damage, armorPoints) {
  return Math.max(0, Number(damage ?? 0) - Math.max(0, Number(armorPoints ?? 0)));
}

export function damageModifierFormula(modifier, mode = "full") {
  if (typeof modifier === "string") {
    const formula = modifier.trim().replace(/^\+/, "");
    if (!formula || formula === "0" || mode === "none") return "0";
    if (mode === "half") return `ceil((${formula}) / 2)`;
    return formula;
  }
  const formula = String(modifier?.label ?? modifier ?? "").trim().replace(/^\+/, "");
  if (!formula || formula === "0" || formula === "None" || mode === "none") return "";
  if (mode === "half") return `ceil((${formula}) / 2)`;
  return formula;
}

export function resolveCombatExchange({ attack, defense = null, predeclared = false } = {}) {
  const attackTargetBeforeExchange = Math.max(0, Number(attack?.target) || 0);
  const defenseTargetBeforeExchange = Math.max(0, Number(defense?.target) || 0);
  const automaticFailure = !defense || ["none", "cover"].includes(defense.type);
  const sharedPenalty = predeclared && !automaticFailure
    ? Math.max(0, attackTargetBeforeExchange - 100, defenseTargetBeforeExchange - 100)
    : 0;
  const attackTarget = predeclared && !automaticFailure
    ? Math.max(0, attackTargetBeforeExchange - sharedPenalty)
    : attackTargetBeforeExchange;
  const defenseTarget = automaticFailure ? null : predeclared
    ? Math.max(0, defenseTargetBeforeExchange - sharedPenalty)
    : defenseTargetBeforeExchange;
  const attackResult = classifyContestRoll(attack?.rawRoll, attackTarget);
  const defenseResult = automaticFailure
    ? "failure"
    : classifyContestRoll(defense.rawRoll, defenseTarget);
  const advantage = differentialAdvantage(attackResult, defenseResult);
  return {
    predeclared: Boolean(predeclared),
    sharedPenalty,
    attack: { ...attack, targetBeforeExchange: attackTargetBeforeExchange,
      target: attackTarget, result: attackResult },
    defense: automaticFailure
      ? { ...(defense ?? {}), type: defense?.type ?? "none", targetBeforeExchange: null,
        target: null, rawRoll: null, result: "failure", automaticFailure: true }
      : { ...defense, targetBeforeExchange: defenseTargetBeforeExchange,
        target: defenseTarget, result: defenseResult, automaticFailure: false },
    advantage,
    winner: advantage > 0 ? "attacker" : advantage < 0 ? "defender" : null,
    effects: Math.abs(advantage)
  };
}
