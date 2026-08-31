const normalize = (value) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export const COMBAT_EFFECT_STAGES = Object.freeze([
  "beforeDamage", "damageRoll", "beforeLocation", "beforeArmor",
  "afterPenetration", "afterEffect", "woundChecks"
]);

export const COMBAT_EFFECT_WEAPON_RESTRICTIONS = Object.freeze([
  "", "unarmed", "ranged", "trapping", "bludgeoning", "cutting", "siegeOrRanged",
  "small", "piercing", "shieldOrBludgeoning", "axeOrTwoHanded"
]);

export const COMBAT_EFFECT_ROLL_RESTRICTIONS = Object.freeze([
  "", "attackerCritical", "defenderCritical", "attackerFumble", "opponentFumble",
  "winnerCritical", "seeDescription"
]);

export const COMBAT_EFFECT_RULES = Object.freeze({
  "abrir-distancia": { ruleKey: "guided", stage: "afterEffect", target: "self" },
  alzarse: { ruleKey: "guided", stage: "afterEffect", target: "self" },
  ardid: { ruleKey: "guided", stage: "afterEffect", target: "self" },
  "cerrar-distancia": { ruleKey: "guided", stage: "afterEffect", target: "self" },
  "disparo-y-a-cubierto": { ruleKey: "guided", stage: "afterEffect", target: "self" },
  liberarse: { ruleKey: "guided", stage: "afterEffect", target: "self" },
  "mantenerse-firme": { ruleKey: "guided", stage: "afterEffect", target: "self" },
  "recarga-rapida": { ruleKey: "guided", stage: "afterEffect", target: "self" },
  retirada: { ruleKey: "guided", stage: "afterEffect", target: "self" },
  "elegir-localizacion": { ruleKey: "chooseLocation", stage: "beforeLocation" },
  empalar: { ruleKey: "impale", stage: "damageRoll", requiresWound: true },
  "maximizar-dano": { ruleKey: "maximizeDamage", stage: "damageRoll" },
  "mejorar-parada": { ruleKey: "improveParry", stage: "beforeDamage" },
  "sortear-parada": { ruleKey: "bypassParry", stage: "beforeDamage" },
  "superar-armadura": { ruleKey: "bypassArmor", stage: "beforeArmor" },
  golpetazo: { ruleKey: "bash", stage: "afterPenetration" },
  "tiro-apuntado": { ruleKey: "aimedShot", stage: "beforeLocation" },
  "aturdir-localizacion": { ruleKey: "guided", stage: "afterEffect", requiresWound: true,
    endurance: true },
  desangrar: { ruleKey: "guided", stage: "afterEffect", requiresWound: true,
    endurance: true },
  "tumbar-oponente": { ruleKey: "guided", stage: "afterEffect", requiresWound: true,
    endurance: true }
});

export const COMBAT_EFFECT_RULE_KEYS = Object.freeze([
  ...new Set(["guided", ...Object.values(COMBAT_EFFECT_RULES).map((rule) => rule.ruleKey)])
]);

export function combatEffectSlug(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function combatEffectRule(effect) {
  return COMBAT_EFFECT_RULES[effect?.key ?? combatEffectSlug(effect?.name)]
    ?? { ruleKey: "guided", stage: "afterEffect", target: "opponent" };
}

export function mergeCombatEffectDocuments(documentGroups = []) {
  const byKey = new Map();
  for (const document of documentGroups.flat()) {
    const key = String(document?.system?.key ?? "").trim();
    if (document?.type === "combatEffect" && key) byKey.set(key, document);
  }
  return [...byKey.values()];
}

function effectNames(mode = {}) {
  return new Set(String(mode.effects ?? "").split(/[,;\n]/).map(normalize).filter(Boolean));
}

function matchesWeaponRestriction(restriction, context) {
  const wanted = String(restriction ?? "").trim();
  if (!wanted) return true;
  if (!COMBAT_EFFECT_WEAPON_RESTRICTIONS.includes(wanted)) return false;
  const mode = context.weaponMode ?? {};
  const type = normalize(mode.weaponType);
  const size = normalize(mode.size);
  const names = effectNames(mode);
  const has = (name) => names.has(normalize(name));
  if (wanted === "unarmed") return type === "melee" && context.unarmed === true;
  if (wanted === "ranged") return ["ranged", "siege"].includes(type);
  if (wanted === "siegeOrRanged") return ["ranged", "siege"].includes(type);
  if (wanted === "shieldOrBludgeoning") {
    return type === "shield" || has("Golpetazo") || has("Aturdir Localización");
  }
  if (wanted === "small") return ["p", "small"].includes(size);
  if (wanted === "piercing") return Boolean(mode.impalingSize) || has("Empalar");
  if (wanted === "cutting") return has("Desangrar");
  if (wanted === "trapping") return has("Enredar");
  if (wanted === "bludgeoning") return has("Golpetazo") || has("Aturdir Localización");
  if (wanted === "axeOrTwoHanded") {
    return Number(mode.handsRequired) === 2 || has("Hender Armadura");
  }
  return false;
}

function matchesRollRestriction(restriction, context) {
  const wanted = String(restriction ?? "").trim();
  if (!wanted || wanted === "seeDescription") return true;
  if (!COMBAT_EFFECT_ROLL_RESTRICTIONS.includes(wanted)) return false;
  const own = context.winner === "attacker" ? context.attackResult : context.defenseResult;
  const opponent = context.winner === "attacker" ? context.defenseResult : context.attackResult;
  if (wanted === "attackerCritical") return context.attackResult === "critical";
  if (wanted === "defenderCritical") return context.defenseResult === "critical";
  if (wanted === "attackerFumble") return context.attackResult === "fumble";
  if (wanted === "opponentFumble") return opponent === "fumble";
  if (wanted === "winnerCritical") return own === "critical";
  return true;
}

export function combatEffectEligible(effect, context = {}) {
  if (!effect || !["attacker", "defender"].includes(context.winner)) return false;
  if (context.winner === "attacker" && !effect.offensive) return false;
  if (context.winner === "defender" && !effect.defensive) return false;
  if (effect.key === "muerte-silenciosa" && !context.surpriseAttack) return false;
  if (effect.key === "elegir-localizacion" && ["ranged", "siege"].includes(
    normalize(context.weaponMode?.weaponType))) {
    if (context.completeCover) return false;
    if (context.attackResult !== "critical" && !(context.rangedBand === "short"
      && (context.rangedTargetStationary || context.rangedTargetUnaware))) return false;
  }
  return matchesWeaponRestriction(effect.weaponRestriction, context)
    && matchesRollRestriction(effect.rollRestriction, context);
}

export function eligibleCombatEffects(effects, context) {
  return effects.filter((effect) => combatEffectEligible(effect, context));
}

export function combatEffectSelectionHighlight(effect, side) {
  const restriction = String(effect?.rollRestriction ?? "").trim();
  if (restriction === "winnerCritical"
    || (side === "attacker" && restriction === "attackerCritical")
    || (side === "defender" && restriction === "defenderCritical")) return "critical";
  if (restriction === "opponentFumble"
    || (side === "defender" && restriction === "attackerFumble")) return "fumble";
  return "";
}

export function validateEffectSelections({ slots = 0, selections = [], effects = [], context = {} }) {
  if (selections.length !== slots) return { valid: false, reason: "slots" };
  const catalog = new Map(effects.map((effect) => [effect.key, effect]));
  const counts = new Map();
  for (const selection of selections) {
    if (selection?.waived === true) continue;
    const effect = catalog.get(selection?.key);
    if (!effect || !combatEffectEligible(effect, context)) return { valid: false, reason: "eligibility" };
    const count = (counts.get(effect.key) ?? 0) + 1;
    if (count > 1 && !effect.stackable) return { valid: false, reason: "stacking" };
    counts.set(effect.key, count);
  }
  return { valid: true, reason: null };
}

export function selectedEffectCount(selections, ruleKey) {
  return selections.filter((entry) => !entry.waived && entry.ruleKey === ruleKey).length;
}

export function combatEffectSlotsBySide({ winner, differential = 0, surprise = 0 } = {}) {
  return Object.freeze({
    attacker: (winner === "attacker" ? Math.max(0, Number(differential) || 0) : 0)
      + Math.max(0, Number(surprise) || 0),
    defender: winner === "defender" ? Math.max(0, Number(differential) || 0) : 0
  });
}

export function maximizeDamageFormula(formula, count = 0) {
  let remaining = Math.max(0, Number(count) || 0);
  return String(formula).replace(/(\d*)d(\d+)/gi, (match, amountText, sidesText) => {
    if (!remaining) return match;
    const amount = Number(amountText || 1);
    const sides = Number(sidesText);
    const maximized = Math.min(amount, remaining);
    remaining -= maximized;
    const rest = amount - maximized;
    return [maximized ? String(maximized * sides) : "", rest ? `${rest}d${sides}` : ""]
      .filter(Boolean).join(" + ");
  });
}

export function orderedCombatChecks(checks = []) {
  return [...checks].sort((left, right) => {
    const priority = { effect: 0, wound: 1 };
    return (priority[left.source] ?? 2) - (priority[right.source] ?? 2)
      || Number(left.order ?? 0) - Number(right.order ?? 0);
  });
}

export function opposedEffectWinner(left, right) {
  const grade = { fumble: 0, failure: 1, success: 2, critical: 3 };
  const leftGrade = grade[left?.result] ?? -1;
  const rightGrade = grade[right?.result] ?? -1;
  if (leftGrade !== rightGrade) return leftGrade > rightGrade ? "left" : "right";
  const leftRoll = Number(left?.rawRoll);
  const rightRoll = Number(right?.rawRoll);
  if (leftRoll === rightRoll) return null;
  return leftRoll > rightRoll ? "left" : "right";
}
