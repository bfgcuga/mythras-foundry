import { evasionWinner } from "./combat.js";
import { combatRollLuckAllowed } from "./combat-luck-availability.js";
import { damageLocationChoices } from "./combat-damage.js";
import { actorDisplayName, tokenDisplayName } from "./document-names.js";
import { combatCanBeCancelled } from "./combat-cancellation.js";

const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const localize = (key) => game.i18n.localize(key);
const sideEntry = (combat, side) => side === "attacker" ? combat.attacker : combat.defender;

function combatEntryDisplayName(entry) {
  if (!entry) return "";
  const token = entry.tokenUuid && globalThis.fromUuidSync?.(entry.tokenUuid);
  if (token) return tokenDisplayName(token);
  const actor = entry.actorUuid && globalThis.fromUuidSync?.(entry.actorUuid)
    || game.actors.get(entry.actorId);
  return actorDisplayName(actor) || entry.actorName || "";
}

const resultLabel = (result) => result ? localize(`MYTHRASF.RollResult.${result}`) : localize("MYTHRASF.Combat.PendingClassification");
const DIFFICULTIES = Object.freeze(["automatic", "veryEasy", "easy", "standard", "hard",
  "formidable", "herculean", "impossible"]);

export function difficultyTone(difficulty) {
  const standard = DIFFICULTIES.indexOf("standard");
  const index = DIFFICULTIES.indexOf(difficulty);
  if (index < 0 || index === standard) return "neutral";
  return index < standard ? "bonus" : "penalty";
}

export function targetTone(target, baseTarget) {
  const difference = Number(target) - Number(baseTarget);
  return difference > 0 ? "bonus" : difference < 0 ? "penalty" : "neutral";
}

function rollOutcome(value, result) {
  const resultClass = result ? ` mythras-chat-result--${result}` : "";
  return `<strong class="combat-roll-outcome${resultClass}"><span class="mythras-chat-roll-value">${Number(value)}</span> ${escape(resultLabel(result))}</strong>`;
}

export function woundCheckOutcomeKey(check, combat = null) {
  if (check?.source !== "wound" || check.resolution?.manual) return null;
  const severity = check.woundSeverity ?? check.label;
  const resisted = check.resolution?.winner === "left";
  const legacyLocation = (combat?.defender?.locations ?? []).find((entry) =>
    entry.id === (check.locationId ?? combat?.damage?.locationId));
  const kind = check.locationKind ?? legacyLocation ?? {};
  const extremity = Boolean(kind.extremity
    ?? ["arm", "leg", "wing", "tail"].includes(kind.category ?? kind.hpClass));
  const leg = Boolean(kind.leg ?? (kind.category ?? kind.hpClass) === "leg");
  if (severity === "serious") {
    if (resisted) return "seriousResisted";
    if (!extremity) return "seriousFailedBody";
    return leg ? "seriousFailedLeg" : "seriousFailedArm";
  }
  if (severity === "major") {
    if (!extremity) return resisted ? "majorResistedBody" : "majorFailedBody";
    return resisted ? "majorResistedExtremity" : "majorFailedExtremity";
  }
  return null;
}

function combatCheckHtml(check, combat) {
  const wound = check.source === "wound";
  const actor = combatEntryDisplayName(sideEntry(combat, check.actorSide ?? "defender"));
  const severity = check.woundSeverity ?? check.label;
  const title = wound ? game.i18n.format("MYTHRASF.Combat.WoundCheck.Title", {
    actor, wound: localize(`MYTHRASF.Wound.${severity}`), location: check.locationName ?? "—"
  }) : check.label;
  const reason = wound ? game.i18n.format("MYTHRASF.Combat.WoundCheck.Reason", {
    wound: localize(`MYTHRASF.Wound.${severity}`), location: check.locationName ?? "—"
  }) : game.i18n.format("MYTHRASF.Combat.CheckReason.Effect", { effect: check.label });
  const help = `<button type="button" class="sheet-icon-button combat-check-help"
    data-combat-action="check-help" data-check-id="${escape(check.id)}"
    title="${escape(localize("MYTHRASF.Combat.CheckHelp"))}"
    aria-label="${escape(localize("MYTHRASF.Combat.CheckHelp"))}"><i class="fas fa-question"
    aria-hidden="true"></i></button>`;
  const woundLuck = wound && severity === "major"
    && !(combat.effects?.selections ?? []).some((effect) => effect.status === "pending")
    ? `<button type="button" class="sheet-icon-button mythras-chat-luck-button"
      data-combat-action="wound-luck" data-check-id="${escape(check.id)}"
      title="${escape(localize("MYTHRASF.Combat.WoundCheck.Luck"))}"
      aria-label="${escape(localize("MYTHRASF.Combat.WoundCheck.Luck"))}"><i class="fas fa-clover"
      aria-hidden="true"></i></button>` : "";
  if (check.status === "pending") return `<article class="combat-check-entry"><header><strong>${escape(
    title)}</strong>${help}</header><div class="mythras-chat-row"><span>${escape(localize(
      "MYTHRASF.Combat.CheckReasonLabel"))}</span><span>${escape(reason)}</span></div><div class="mythras-chat-row"><span>${escape(
      localize("MYTHRASF.Combat.CheckTest"))}</span><strong>${escape(wound
        ? localize("MYTHRASF.Combat.WoundCheck.Test") : check.label)}</strong>${woundLuck}</div><div class="combat-check-actions"><button type="button" data-combat-action="resolve-check" data-check-id="${escape(
      check.id)}" title="${escape(localize("MYTHRASF.Combat.CheckRoll"))}">${escape(localize(
        "MYTHRASF.Combat.CheckRoll"))}</button><button type="button" data-combat-action="resolve-check-manual" data-check-id="${escape(
      check.id)}" title="${escape(localize("MYTHRASF.CombatEffect.ResolveManual"))}">${escape(localize(
        "MYTHRASF.CombatEffect.ResolveManual"))}</button></div></article>`;
  if (check.resolution?.manual) return `<article class="combat-check-entry"><header><strong>${escape(
    title)}</strong>${help}</header><div class="mythras-chat-row"><span>${escape(localize(
      "MYTHRASF.Combat.CheckOutcomeLabel"))}</span><strong>${escape(localize(
        "MYTHRASF.Combat.CheckManual"))}</strong></div>${check.resolution.note ? `<p>${escape(
          check.resolution.note)}</p>` : ""}</article>`;
  const resolution = check.resolution ?? {};
  const opposed = resolution.opposed ?? {};
  const resisted = resolution.winner === "left";
  const outcomeKey = woundCheckOutcomeKey(check, combat);
  const outcome = outcomeKey ? localize(`MYTHRASF.Combat.WoundCheck.Outcome.${outcomeKey}`)
    : localize(`MYTHRASF.Combat.CheckOutcome.${resisted ? "resisted" : "failed"}`);
  const abilityRoll = resolution.automaticFailure
    ? `<div class="mythras-chat-row"><span>${escape(localize(
      "MYTHRASF.Suffocation.Endurance"))}</span><strong>${escape(localize(
        "MYTHRASF.Combat.WoundCheck.AutomaticFailure"))}</strong></div>`
    : `<div class="mythras-chat-row"><span>${escape(resolution.abilityName ?? localize(
      "MYTHRASF.Suffocation.Endurance"))} (1d100 / ${Number(resolution.target ?? 0)}%)</span><strong><span
      class="mythras-chat-roll-value">${Number(resolution.rawRoll ?? 0)}</span> ${escape(resultLabel(
        resolution.result))}</strong></div>`;
  return `<article class="combat-check-entry"><header><strong>${escape(title)}</strong>${help}</header>
    ${abilityRoll}
    <div class="mythras-chat-row"><span>${escape(localize(
      "MYTHRASF.Combat.WoundCheck.OpposedAttack"))}</span><strong><span class="mythras-chat-roll-value">${Number(
        opposed.rawRoll ?? 0)}</span> ${escape(resultLabel(opposed.result))}</strong></div>
    <div class="mythras-chat-total"><span>${escape(localize(
      "MYTHRASF.Combat.CheckOutcomeLabel"))}</span><strong>${escape(localize(
        `MYTHRASF.Combat.CheckOutcome.${resisted ? "resisted" : "failed"}`))}</strong></div>
    <div class="mythras-chat-row combat-check-consequence"><span>${escape(localize(
      "MYTHRASF.Combat.CheckConsequence"))}</span><strong>${escape(outcome)}</strong></div></article>`;
}

export async function openCombatCheckHelp(check, combat) {
  const severity = check.woundSeverity ?? check.label;
  const outcomeKey = woundCheckOutcomeKey(check, combat);
  const content = check.source === "wound"
    ? game.i18n.format("MYTHRASF.Combat.WoundCheck.Help", {
      actor: combatEntryDisplayName(sideEntry(combat, check.actorSide ?? "defender")),
      wound: localize(`MYTHRASF.Wound.${severity}`), location: check.locationName ?? "—",
      consequence: outcomeKey ? localize(`MYTHRASF.Combat.WoundCheck.Outcome.${outcomeKey}`)
        : localize("MYTHRASF.Combat.WoundCheck.PendingOutcome")
    }) : game.i18n.format("MYTHRASF.Combat.CheckHelpEffect", { effect: check.label });
  await foundry.applications.api.DialogV2.wait({
    window: { title: localize("MYTHRASF.Combat.CheckHelp") },
    content: `<div class="mythras-foundry mythras-dialog"><p>${escape(content)}</p></div>`,
    buttons: [{ action: "close", label: localize("MYTHRASF.Close"), icon: "fas fa-times" }],
    rejectClose: false
  });
}

export function renderCombatExchange(combat) {
  const resolved = ["resolved", "awaitingEffects"].includes(combat.status) ? combat.resolution : null;
  const attack = resolved?.attack ?? combat.attackClassification;
  const defense = resolved?.defense;
  const defenseName = combat.defender.defense?.type ? localize(`MYTHRASF.Combat.Defense.${combat.defender.defense.type}`) : localize("MYTHRASF.Combat.PendingDefense");
  const defenseActions = ["awaitingDefense", "awaitingAccidentalDefense"].includes(combat.status) ? `<div class="combat-defense-actions"><button type="button" data-combat-action="parry" title="${escape(localize("MYTHRASF.Combat.Parry"))}">${escape(localize("MYTHRASF.Combat.Parry"))}</button><button type="button" data-combat-action="evade" title="${escape(localize("MYTHRASF.Combat.Evade"))}">${escape(localize("MYTHRASF.Combat.Evade"))}</button>${combat.ranged ? `<button type="button" data-combat-action="cover" title="${escape(localize("MYTHRASF.Ranged.Cover"))}">${escape(localize("MYTHRASF.Ranged.Cover"))}</button>` : ""}<button type="button" data-combat-action="none" title="${escape(localize("MYTHRASF.Combat.NoDefense"))}">${escape(localize("MYTHRASF.Combat.NoDefense"))}</button></div>` : "";
  const evadeWinner = resolved?.defense?.type === "evade" ? evasionWinner(resolved) : undefined;
  const outcome = resolved ? `<div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Combat.Advantage"))}</span><strong>${resolved.advantage > 0 ? "+" : ""}${resolved.advantage}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.Effects"))}</span><strong>${resolved.effects} — ${escape(resolved.winner ? localize(`MYTHRASF.Combat.Winner.${resolved.winner}`) : localize("MYTHRASF.Combat.NoWinner"))}</strong></div>${evadeWinner !== undefined ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.EvasionOutcome"))}</span><strong>${escape(evadeWinner ? localize(`MYTHRASF.Combat.Winner.${evadeWinner}`) : localize("MYTHRASF.Combat.NoWinner"))}</strong></div>` : ""}` : "";
  const penalty = resolved?.sharedPenalty ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.Over100Penalty"))}</span><strong class="skill-roll-modifier-effect--penalty">−${resolved.sharedPenalty}</strong></div>` : "";
  const luck = (side) => `<button type="button" class="sheet-icon-button mythras-chat-luck-button" data-combat-action="luck" data-side="${side}" title="${escape(localize("MYTHRASF.Luck.Use"))}" aria-label="${escape(localize("MYTHRASF.Luck.Use"))}"><i class="fas fa-clover" aria-hidden="true"></i></button>`;
  const rollLuckAllowed = combatRollLuckAllowed(combat);
  const locationOptions = damageLocationChoices(combat).map((location) => `<option value="${escape(location.id)}" ${location.id === combat.damage?.locationId ? "selected" : ""}>${escape(location.name)}</option>`).join("");
  let damageHtml = "";
  const guidedBeforeDamage = (combat.effects?.selections ?? []).some((effect) =>
    effect.status === "pending" && !effect.requiresWound);
  if (combat.damage?.status === "ready" && !guidedBeforeDamage) damageHtml = `<button type="button" data-combat-action="roll-damage" title="${escape(localize("MYTHRASF.Combat.RollDamage"))}">${escape(localize("MYTHRASF.Combat.RollDamage"))}</button>`;
  if (combat.damage?.status === "missedLocation") {
    damageHtml = `<fieldset class="combat-damage-panel"><legend>${escape(localize("MYTHRASF.Chat.Damage"))}</legend><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.LocationRoll"))} (1d20)</span><strong class="mythras-chat-roll-value">${combat.damage.locationRoll}</strong></div><div class="combat-card-warning">${escape(localize("MYTHRASF.Combat.NoHitLocation"))}</div></fieldset>`;
  } else if (["rolled", "proposed", "stale", "applying", "applied"].includes(combat.damage?.status)) {
    const damage = combat.damage;
    const extraordinary = damage.extraordinaryFormula && damage.extraordinaryFormula !== "0"
      ? ` + ${escape(localize("MYTHRASF.Combat.DamageExtraordinary"))} (${escape(damage.extraordinaryFormula)})` : "";
    damageHtml = `<fieldset class="combat-damage-panel"><legend>${escape(localize("MYTHRASF.Chat.Damage"))}</legend><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.DamageBreakdown"))}</span><strong>${escape(localize("MYTHRASF.Combat.DamageWeapon"))} (${escape(damage.weaponFormula ?? "0")}) + ${escape(localize("MYTHRASF.Combat.DamageBonus"))} (${escape(damage.modifierFormula ?? "0")})${extraordinary}</strong>${["proposed", "stale"].includes(damage.status) ? luck("damage") : ""}</div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.DamageDice"))}</span><strong>${escape(damage.rollExpression ?? damage.resultExpression ?? damage.rawRoll)}</strong></div><div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Chat.Result"))}</span><strong>${damage.rawRoll}</strong></div>${damage.locationRoll != null ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.LocationRoll"))} (1d20)</span><strong class="mythras-chat-roll-value">${damage.locationRoll}</strong></div>` : ""}<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.AfterContainedBlow"))}</span><strong>${damage.afterContainedBlow ?? "—"}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.ParryReduction"))}</span><strong>${escape(localize(`MYTHRASF.Combat.ParryType.${damage.parryType ?? "none"}`))}: ${damage.afterParry ?? "—"}</strong></div><label><span>${escape(localize("MYTHRASF.Combat.HitLocation"))}</span><select data-damage-location ${damage.status === "applied" ? "disabled" : ""}>${locationOptions}</select></label><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Armor"))}</span><strong>${damage.armorPoints ?? "—"}</strong></div><div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Chat.PenetratingDamage"))}</span><strong>${damage.penetratingDamage ?? "—"}</strong></div>${damage.push?.triggered ? `<div class="combat-card-warning">${escape(game.i18n.format("MYTHRASF.Combat.PushSummary", { distance: damage.push.distance, excess: damage.push.excess }))}</div>` : ""}${damage.status === "stale" ? `<p class="combat-card-warning">${escape(localize("MYTHRASF.Combat.DamageStale"))}</p>` : ""}${damage.status === "applied" ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.AppliedHitPoints"))}</span><strong>${damage.beforeHitPoints} → ${damage.afterHitPoints}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Wound"))}</span><strong>${escape(localize(`MYTHRASF.Wound.${damage.resultingWound}`))}</strong></div>${damage.permanentWound ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.PermanentWound.Severity"))} (1d3: ${damage.permanentWoundRoll})</span><strong>${damage.permanentWound.severity}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.PermanentWound.Description"))}</span><strong>${escape(damage.permanentWound.description)}</strong></div>` : ""}${["serious", "major"].includes(damage.resultingWound) ? `<p class="combat-card-warning">${escape(localize("MYTHRASF.Combat.WoundCheck.Detected"))}</p>` : ""}` : `<button type="button" data-combat-action="apply-damage" title="${escape(localize("MYTHRASF.Combat.ApplyDamage"))}">${escape(localize("MYTHRASF.Combat.ApplyDamage"))}</button>`}</fieldset>`;
    if (damage.status === "applied") {
      const wound = escape(localize(`MYTHRASF.Wound.${damage.resultingWound}`));
      damageHtml = damageHtml.replace(`<strong>${wound}</strong>`,
        `<strong class="combat-wound-outcome wound-${escape(damage.resultingWound)}">${wound}</strong>`);
    }
    if (damage.passiveBlock) damageHtml = damageHtml.replace(
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.ParryReduction"))}</span>`,
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Status.PassiveBlock"))}</span><strong>${escape(damage.passiveBlock.weaponName)} (${escape(damage.passiveBlock.weaponSize)})</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.ParryReduction"))}</span>`);
    if (combat.ranged?.band === "long") damageHtml = damageHtml.replace(
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.AfterContainedBlow"))}</span>`,
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Ranged.LongRangeDamage"))}</span><strong>${damage.beforeRange} → ${damage.afterRange}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.AfterContainedBlow"))}</span>`);
    if (damage.cover) damageHtml = damageHtml.replace(
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Armor"))}</span>`,
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Ranged.Cover"))}</span><strong>${escape(damage.cover.source)}: −${damage.cover.absorbed}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Armor"))}</span>`);
    if (damage.alternateRoll) damageHtml = damageHtml.replace("</fieldset>",
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.CombatEffect.ImpaleDiscarded"))}</span><strong class="mythras-chat-roll-value">${damage.alternateRoll.rawRoll}</strong></div></fieldset>`);
    if (damage.woundLuck) damageHtml = damageHtml.replace("</fieldset>",
      `<div class="mythras-chat-row"><span>${escape(localize(
        "MYTHRASF.Combat.WoundCheck.LuckSpent"))}</span><strong>−1</strong></div></fieldset>`);
  }
  const selectedEffects = (combat.effects?.selections ?? []).map((effect) => effect.waived
    ? `<li>${escape(localize("MYTHRASF.CombatEffect.Waive"))}</li>`
    : `<li><button type="button" class="sheet-icon-button" data-combat-action="open-effect" data-effect-uuid="${escape(effect.uuid)}" title="${escape(localize("MYTHRASF.CombatEffect.Open"))}"><i class="fas fa-book-open" aria-hidden="true"></i></button> ${escape(effect.name)}${effect.status === "pending" ? ` — ${escape(localize("MYTHRASF.CombatEffect.Guided"))} <button type="button" data-combat-action="resolve-effect" data-effect-slot="${effect.slot}" title="${escape(localize("MYTHRASF.CombatEffect.ResolveManual"))}">${escape(localize("MYTHRASF.CombatEffect.ResolveManual"))}</button>` : ""}</li>`).join("");
  const effectsHtml = combat.status === "awaitingEffects"
    ? `<fieldset class="combat-effects-panel"><legend>${escape(localize("MYTHRASF.CombatEffect.Pending"))}</legend><button type="button" data-combat-action="choose-effects" title="${escape(localize("MYTHRASF.CombatEffect.Select"))}">${escape(localize("MYTHRASF.CombatEffect.Select"))}</button></fieldset>`
    : selectedEffects ? `<fieldset class="combat-effects-panel"><legend>${escape(localize("MYTHRASF.CombatEffect.Selected"))}</legend><ol>${selectedEffects}</ol></fieldset>` : "";
  const checksHtml = (combat.effects?.checks ?? []).length ? `<fieldset class="combat-checks-panel"><legend>${escape(localize("MYTHRASF.Combat.Checks"))}</legend>${combat.effects.checks.map((check) => combatCheckHtml(check, combat)).join("")}</fieldset>` : "";
  const consequencesHtml = (combat.consequences ?? []).length ? `<fieldset><legend>${escape(localize("MYTHRASF.Combat.Consequences"))}</legend>${combat.consequences.map((entry, index) => `<div class="mythras-chat-row"><span>${escape(localize(`MYTHRASF.Combat.Consequence.${entry.key}`))}</span><strong>${escape(entry.status)}</strong>${entry.status === "pending" ? `<button type="button" data-combat-action="resolve-consequence" data-consequence-index="${index}" data-gm-only>${escape(localize("MYTHRASF.CombatEffect.ResolveManual"))}</button>` : ""}</div>`).join("")}</fieldset>` : "";
  const tracker = combat.turnEconomy ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Tracker.Position"))}</span><strong>${escape(game.i18n.format("MYTHRASF.Tracker.RoundCycle", { round: combat.turnEconomy.round, cycle: combat.turnEconomy.cycle }))}</strong></div>` : "";
  const close = combat.turnEconomy && !combat.turnEconomy.turnAdvanced
    ? `<button type="button" data-combat-action="close-exchange" data-gm-only title="${escape(localize("MYTHRASF.Tracker.CloseExchange"))}">${escape(localize("MYTHRASF.Tracker.CloseExchange"))}</button>` : "";
  const rangedHtml = combat.ranged ? `<fieldset><legend>${escape(localize("MYTHRASF.Ranged.Attack"))}</legend><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Ranged.Distance"))}</span><strong>${combat.ranged.distance} m</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Ranged.BandLabel"))}</span><strong>${escape(localize(`MYTHRASF.Ranged.Band.${combat.ranged.band}`))}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Difficulty"))}</span><strong>${escape(localize(`MYTHRASF.Difficulty.${combat.ranged.difficulty}`))}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Ranged.Power"))}</span><strong>${escape(combat.ranged.power)} → ${escape(combat.ranged.effectivePower)}</strong></div>${combat.ranged.ammunition?.tracking ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Ranged.Ammunition"))}</span><strong>${combat.ranged.ammunition.loaded}/${combat.ranged.ammunition.reserve}</strong></div>` : ""}${combat.ranged.accidentalEligible ? `<p class="combat-card-warning">${escape(localize("MYTHRASF.Ranged.AccidentalPending"))}</p>` : ""}</fieldset>` : "";
  const rollConfiguration = combat.attacker.rollConfiguration;
  const adjustmentHtml = rollConfiguration ? `<fieldset><legend>${escape(localize("MYTHRASF.SkillRoll.Modifiers"))}</legend>
    <div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Difficulty"))}</span><strong class="skill-roll-modifier-effect--${difficultyTone(combat.attacker.difficulty)}">${escape(localize(`MYTHRASF.Difficulty.${combat.attacker.difficulty}`))}</strong></div>
    ${["limited", "reinforced"].filter((key) => rollConfiguration[key]).map((key) => {
      const value = rollConfiguration[key];
      return `<div class="mythras-chat-row"><span>${escape(localize(`MYTHRASF.SkillRoll.${key === "limited" ? "Limited" : "Reinforced"}`))}</span><strong>${escape(value.abilityName)} (${escape(value.actorName)}, ${value.target}%)</strong></div>`;
    }).join("")}
    <div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.SkillRoll.FinalSkillValue"))}</span><strong class="penalized-value"><span>${rollConfiguration.baseTarget}%</span>${combat.attacker.target !== rollConfiguration.baseTarget ? ` <span class="skill-roll-target--${targetTone(combat.attacker.target, rollConfiguration.baseTarget)}">(${combat.attacker.target}%)</span>` : ""}</strong></div></fieldset>` : "";
  const accidental = combat.status === "awaitingAccidentalTarget" ? `<button type="button" data-combat-action="accidental-target" data-gm-only title="${escape(localize("MYTHRASF.Ranged.ChooseAccidentalTarget"))}">${escape(localize("MYTHRASF.Ranged.ChooseAccidentalTarget"))}</button>` : "";
  const cancelled = combat.status === "cancelled"
    ? `<p class="combat-card-warning">${escape(localize("MYTHRASF.Combat.CancelledNotice"))}</p>` : "";
  const cancel = combatCanBeCancelled(combat)
    ? `<button type="button" data-combat-action="cancel" data-gm-only title="${escape(localize("MYTHRASF.Contest.Cancel"))}">${escape(localize("MYTHRASF.Contest.Cancel"))}</button>` : "";
  return `<section class="mythras-combat-card mythras-chat-card" data-combat-revision="${combat.revision}"><div class="mythras-chat-title">${escape(localize("MYTHRASF.Combat.ExchangeTitle"))}</div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.StatusLabel"))}</span><strong>${escape(localize(`MYTHRASF.Combat.Status.${combat.status}`))}</strong></div>${cancelled}${tracker}<div class="mythras-chat-details"><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.Attacker"))}</span><strong>${escape(combatEntryDisplayName(combat.attacker))}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.Defender"))}</span><strong>${escape(combatEntryDisplayName(combat.defender))}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.WeaponAndStyle"))}</span><strong>${escape(`${combat.attacker.weaponName} — ${combat.attacker.styleName}`)}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.DeclarationMoment"))}</span><strong>${escape(localize(`MYTHRASF.Combat.Declaration.${combat.predeclared ? "before" : "after"}`))}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.ContainedBlow"))}</span><strong>${escape(localize(combat.declarations?.containedBlow ? "MYTHRASF.Yes" : "MYTHRASF.No"))}</strong></div></div>${rangedHtml}${adjustmentHtml}<div class="combat-exchange-side"><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.AttackRoll"))} (${attack?.target ?? combat.attacker.target}%)</span>${rollOutcome(combat.attacker.rawRoll, attack?.result)}${rollLuckAllowed ? luck("attacker") : ""}</div></div><div class="combat-exchange-side"><div class="mythras-chat-row"><span>${escape(defenseName)}${defense?.target != null ? ` (${defense.target}%)` : ""}</span>${defense?.rawRoll == null ? "<strong>—</strong>" : rollOutcome(defense.rawRoll, defense.result)}${defense?.rawRoll != null && rollLuckAllowed ? luck("defender") : ""}</div></div>${penalty}${outcome}${effectsHtml}${damageHtml}${checksHtml}${consequencesHtml}${defenseActions}${accidental}<div data-combat-gm-actions>${cancel}${close}</div></section>`;
}
