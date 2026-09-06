import { hasTrait } from "./traits.js";

export function combatStyleAllowsSilentDeath(actor, styleId) {
  const style = actor?.items?.get?.(styleId);
  return style?.type === "combatStyle" && hasTrait(style, "asesinato");
}

const normalize = (value) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export const COMBAT_EFFECT_STAGES = Object.freeze([
  "beforeDamage", "damageRoll", "beforeLocation", "beforeArmor",
  "afterPenetration", "afterDamage", "woundChecks"
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
  "arrebatar-arma": { ruleKey: "guided", stage: "beforeDamage", target: "opponent" },
  "derribar-oponente": { ruleKey: "guided", stage: "beforeDamage", target: "opponent" },
  agarrar: { ruleKey: "guided", stage: "beforeDamage", target: "opponent" },
  "abrir-distancia": { ruleKey: "guided", stage: "beforeDamage", target: "self" },
  alzarse: { ruleKey: "guided", stage: "beforeDamage", target: "self" },
  ardid: { ruleKey: "guided", stage: "beforeDamage", target: "self" },
  "cerrar-distancia": { ruleKey: "guided", stage: "beforeDamage", target: "self" },
  "danar-arma": { ruleKey: "damageWeapon", stage: "damageRoll", replacesDamage: true },
  "disparo-y-a-cubierto": { ruleKey: "guided", stage: "beforeDamage", target: "self" },
  liberarse: { ruleKey: "guided", stage: "beforeDamage", target: "self" },
  "mantenerse-firme": { ruleKey: "guided", stage: "afterPenetration", target: "self",
    damageTarget: "opponent" },
  "recarga-rapida": { ruleKey: "guided", stage: "beforeDamage", target: "self" },
  retirada: { ruleKey: "guided", stage: "beforeDamage", target: "self" },
  "elegir-localizacion": { ruleKey: "chooseLocation", stage: "beforeLocation",
    damageTarget: "opponent" },
  empalar: { ruleKey: "impale", stage: "damageRoll", requiresWound: true,
    damageTarget: "opponent" },
  "maximizar-dano": { ruleKey: "maximizeDamage", stage: "damageRoll" },
  "mejorar-parada": { ruleKey: "improveParry", stage: "beforeDamage",
    damageTarget: "opponent" },
  "sortear-parada": { ruleKey: "bypassParry", stage: "beforeDamage",
    damageTarget: "opponent" },
  "superar-armadura": { ruleKey: "bypassArmor", stage: "beforeArmor",
    damageTarget: "opponent" },
  "hender-armadura": { ruleKey: "guided", stage: "beforeArmor", damageTarget: "opponent" },
  "sortear-cobertura": { ruleKey: "guided", stage: "beforeArmor", damageTarget: "opponent" },
  golpetazo: { ruleKey: "bash", stage: "afterPenetration", damageTarget: "opponent" },
  "potenciar-penetracion": { ruleKey: "guided", stage: "afterPenetration",
    damageTarget: "opponent" },
  "tiro-apuntado": { ruleKey: "aimedShot", stage: "beforeLocation",
    damageTarget: "opponent" },
  "arruinar-conjuro": { ruleKey: "guided", stage: "afterDamage", requiresWound: true,
    damageTarget: "opponent" },
  "forzar-rendicion": { ruleKey: "guided", stage: "beforeDamage", replacesDamage: true,
    damageTarget: "opponent" },
  "aturdir-localizacion": { ruleKey: "guided", stage: "afterDamage", requiresWound: true,
    endurance: true, damageTarget: "opponent" },
  desangrar: { ruleKey: "guided", stage: "afterDamage", requiresWound: true,
    endurance: true, damageTarget: "opponent" },
  "tumbar-oponente": { ruleKey: "guided", stage: "afterDamage", requiresWound: true,
    endurance: true, damageTarget: "opponent" },
  enredar: { ruleKey: "guided", stage: "beforeDamage", damageTarget: "opponent" },
  "escoger-objetivo": { ruleKey: "guided", stage: "beforeDamage",
    damageTarget: "opponent" },
  "herida-accidental": { ruleKey: "guided", stage: "beforeDamage",
    damageTarget: "opponent" },
  "marcar-enemigo": { ruleKey: "guided", stage: "beforeDamage",
    damageTarget: "opponent" },
  "muerte-silenciosa": { ruleKey: "guided", stage: "beforeDamage",
    damageTarget: "opponent" },
  "desarmar-oponente": { ruleKey: "guided", stage: "beforeDamage", target: "opponent" },
  "inmovilizar-arma": { ruleKey: "guided", stage: "beforeDamage", target: "opponent" }
});

export const COMBAT_EFFECT_RULE_KEYS = Object.freeze([
  ...new Set(["guided", ...Object.values(COMBAT_EFFECT_RULES).map((rule) => rule.ruleKey)])
]);

const AUTOMATED_GUIDED_EFFECTS = Object.freeze(new Set([
  "agarrar", "arrebatar-arma", "derribar-oponente", "marcar-enemigo",
  "abrir-distancia", "alzarse", "aprovechar-la-ventaja", "ardid", "aturdir-localizacion", "cegar-oponente",
  "cerrar-distancia", "desangrar", "desequilibrar-oponente", "disparo-de-supresion",
  "inmovilizar-arma", "desarmar-oponente", "muerte-silenciosa", "retirada", "tumbar-oponente"
]));

export function combatEffectIsAutomated(effect) {
  return effect?.ruleKey !== "guided" || AUTOMATED_GUIDED_EFFECTS.has(effect?.key);
}

export function initialCombatEffectStatus(effect) {
  if (effect?.requiresWound) return "conditional";
  return combatEffectIsAutomated(effect) ? "active" : "notAutomated";
}

export function combatEffectSlug(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function combatEffectRule(effect) {
  return COMBAT_EFFECT_RULES[effect?.key ?? combatEffectSlug(effect?.name)]
    ?? { ruleKey: "guided", stage: "beforeDamage", target: "opponent" };
}

export function canonicalCombatEffectStage(stage) {
  if (stage === "afterEffect") return "afterDamage";
  return COMBAT_EFFECT_STAGES.includes(stage) ? stage : "beforeDamage";
}

export function combatEffectResolutionPhase(effect) {
  const stage = canonicalCombatEffectStage(effect?.stage);
  if (stage === "afterDamage") return "afterDamage";
  if (stage === "woundChecks") return "woundChecks";
  if (["damageRoll", "beforeLocation", "beforeArmor", "afterPenetration"].includes(stage)) {
    return "damage";
  }
  return "beforeDamage";
}

export function combatEffectPendingPhase(effect) {
  if (effect?.requiresWound && effect?.status === "pending") return "afterDamage";
  return combatEffectResolutionPhase(effect);
}

export function combatEffectCheckPhase(check, selections = []) {
  if (check?.source === "wound") return "woundChecks";
  const effect = selections.find((entry) => entry.key === check?.effectKey
    && Number(entry.slot) === Number(check?.effectSlot)
    && (!check?.effectSide || entry.side === check.effectSide));
  return combatEffectResolutionPhase(effect);
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

function combatWeaponType(context = {}) {
  const attackMode = normalize(context.attackMode);
  if (attackMode === "melee") return "melee";
  if (attackMode === "ranged") return "ranged";
  return normalize(context.weaponMode?.weaponType);
}

function matchesWeaponRestriction(restriction, context) {
  const wanted = String(restriction ?? "").trim();
  if (!wanted) return true;
  if (!COMBAT_EFFECT_WEAPON_RESTRICTIONS.includes(wanted)) return false;
  const mode = context.weaponMode ?? {};
  const type = combatWeaponType(context);
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
  if (context.grabbed && ["abrir-distancia", "cerrar-distancia", "retirada"].includes(effect?.key)) return false;
  if (!effect || !["attacker", "defender"].includes(context.winner)) return false;
  if (context.winner === "attacker" && !effect.offensive) return false;
  if (context.winner === "defender" && !effect.defensive) return false;
  if (effect.key === "danar-arma") {
    if (context.defenseType !== "parry") return false;
    const target = context.winner === "attacker"
      ? context.parryWeaponDurable : context.attackerWeaponDurable;
    if (!target) return false;
  }
  if (effect.key === "muerte-silenciosa"
    && (!context.surpriseAttack || !context.silentDeathAllowed)) return false;
  if (effect.key === "ardid" && !context.activeCombat) return false;
  if (effect.key === "elegir-localizacion" && ["ranged", "siege"].includes(
    combatWeaponType(context))) {
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

export function combatRuseTargetEffects(effects = []) {
  return effects.filter((effect) => effect?.key !== "ardid" && effect?.offensive
    && effect?.target !== "self");
}

export function eligibleCombatRuseReplacements(effects = [], context = {}) {
  return effects.filter((effect) => effect?.key !== "ardid" && effect?.defensive
    && combatEffectEligible(effect, { ...context, winner: "defender" }));
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
  const chosen = selections.filter((entry) => !entry?.waived)
    .map((entry) => catalog.get(entry.key)).filter(Boolean);
  if (!combatEffectSelectionsCompatible(chosen)) return { valid: false, reason: "compatibility" };
  return { valid: true, reason: null };
}

export function combatEffectSelectionsCompatible(effects = []) {
  if (!effects.some((effect) => effect.key === "danar-arma")) return true;
  return !effects.some((effect) => effect.key !== "danar-arma"
    && effect.damageTarget === "opponent");
}

export function combatWeaponDamagePlan(combat) {
  const effect = (combat?.effects?.selections ?? []).find((entry) =>
    !entry.waived && entry.key === "danar-arma");
  if (!effect || combat?.defender?.defense?.type !== "parry") return null;
  const defensive = effect.side === "defender";
  const sourceEntry = defensive ? combat.defender : combat.attacker;
  const targetEntry = defensive ? combat.attacker : combat.defender;
  const sourceWeaponId = defensive ? combat.defender.defense.weaponId : combat.attacker.weaponId;
  const sourceModeKey = defensive ? combat.defender.defense.modeKey : combat.attacker.modeKey;
  const targetWeaponId = defensive ? combat.attacker.weaponId : combat.defender.defense.weaponId;
  return { effectSide: effect.side, sourceSide: effect.side,
    targetSide: defensive ? "attacker" : "defender", sourceEntry, targetEntry,
    sourceWeaponId, sourceModeKey, targetWeaponId };
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

export function maximizeDamageFormulaDetails(formula, count = 0) {
  const source = String(formula);
  const dice = Array.from(source.matchAll(/(\d*)d(\d+)/gi), (match, index) => ({
    index, offset: match.index, text: match[0], amount: Number(match[1] || 1),
    sides: Number(match[2]), maximized: 0
  }));
  let remaining = Math.max(0, Math.trunc(Number(count) || 0));
  for (const die of [...dice].sort((left, right) =>
    right.sides - left.sides || left.index - right.index)) {
    die.maximized = Math.min(die.amount, remaining);
    remaining -= die.maximized;
    if (!remaining) break;
  }
  const parts = [];
  let offset = 0;
  for (const die of dice) {
    if (die.offset > offset) parts.push({ text: source.slice(offset, die.offset), maximized: false });
    if (die.maximized) parts.push({ text: String(die.maximized * die.sides), maximized: true });
    const rest = die.amount - die.maximized;
    if (die.maximized && rest) parts.push({ text: " + ", maximized: false });
    if (rest) parts.push({ text: `${rest}d${die.sides}`, maximized: false });
    offset = die.offset + die.text.length;
  }
  if (offset < source.length) parts.push({ text: source.slice(offset), maximized: false });
  return { formula: parts.map((part) => part.text).join(""), parts,
    maximizedDice: dice.reduce((total, die) => total + die.maximized, 0) };
}

export function maximizeDamageFormula(formula, count = 0) {
  return maximizeDamageFormulaDetails(formula, count).formula;
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
