import { evasionWinner } from "./combat.js";
import { pinConsequenceHtml } from "./weapon-pin-runtime.js";
import { combatRollLuckAllowed } from "./combat-luck-availability.js";
import { actorDisplayName, tokenDisplayName } from "./document-names.js";
import { combatCanBeCancelled } from "./combat-cancellation.js";
import { combatEffectCheckPhase, combatEffectIsAutomated } from "./combat-effects.js";

const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const localize = (key) => game.i18n.localize(key);
const sideEntry = (combat, side) => side === "attacker" ? combat.attacker : combat.defender;

function weaponDamageFormulaHtml(damage) {
  if (!damage.maximizedWeaponDice || !Array.isArray(damage.weaponFormulaParts)) {
    return escape(damage.weaponFormula ?? "0");
  }
  return damage.weaponFormulaParts.map((part) => part?.maximized
    ? `<span class="combat-damage-maximized">${escape(part.text)}</span>`
    : escape(part?.text)).join("");
}

function damageBreakdownLabel(damage) {
  if (!damage.maximizedWeaponDice) return escape(localize("MYTHRASF.Combat.DamageBreakdown"));
  const highlighted = `<span class="combat-damage-maximized">${escape(localize(
    "MYTHRASF.Combat.DamageMaximizedWord"))}</span>`;
  return game.i18n.format("MYTHRASF.Combat.DamageMaximized", { maximized: highlighted });
}

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
  const woundLuck = wound && severity === "major" && combat.damage?.status === "proposed"
    && !(combat.effects?.selections ?? []).some((effect) => effect.status === "pending")
    ? `<button type="button" class="combat-wound-luck-button"
      data-combat-action="wound-luck" data-check-id="${escape(check.id)}"
      title="${escape(localize("MYTHRASF.Combat.WoundCheck.Luck"))}"
      aria-label="${escape(localize("MYTHRASF.Combat.WoundCheck.Luck"))}"><i class="fas fa-clover"
      aria-hidden="true"></i><span>${escape(localize("MYTHRASF.Combat.WoundCheck.Luck"))}</span></button>` : "";
  const checkReady = !wound || ["applied", "unavailable", "missedLocation"]
    .includes(combat.damage?.status);
  if (check.status === "pending") return `<article class="combat-check-entry"><header><strong>${escape(
    title)}</strong>${help}</header><div class="combat-check-detail"><strong>${escape(localize(
      "MYTHRASF.Combat.CheckReasonLabel"))}</strong><span>${escape(reason)}</span></div><div class="combat-check-detail"><strong>${escape(
      localize("MYTHRASF.Combat.CheckTest"))}</strong><span>${escape(wound
        ? localize("MYTHRASF.Combat.WoundCheck.Test") : check.label)}</span></div>${woundLuck}<div class="combat-check-actions">${checkReady ? `<button type="button" data-combat-action="resolve-check" data-check-id="${escape(
      check.id)}" title="${escape(localize("MYTHRASF.Combat.CheckRoll"))}">${escape(localize(
        "MYTHRASF.Combat.CheckRoll"))}</button>` : `<small>${escape(localize(
        "MYTHRASF.Combat.WoundCheck.ApplyDamageFirst"))}</small>`}</div></article>`;
  if (check.resolution?.manual) return `<article class="combat-check-entry"><header><strong>${escape(
    title)}</strong>${help}</header><div class="mythras-chat-row"><span>${escape(localize(
      "MYTHRASF.Combat.CheckOutcomeLabel"))}</span><strong>${escape(localize(
        "MYTHRASF.Combat.CheckManual"))}</strong></div>${check.resolution.note ? `<p>${escape(
          check.resolution.note)}</p>` : ""}</article>`;
  const resolution = check.resolution ?? {};
  const opposed = resolution.opposed ?? {};
  const resisted = resolution.winner === "left";
  const outcomeKey = woundCheckOutcomeKey(check, combat);
  const effectConsequence = check.status === "rolled"
    ? localize("MYTHRASF.Combat.CheckPendingConsequence")
    : check.consequence?.key === "prone"
      ? localize("MYTHRASF.Combat.EffectConsequence.prone")
    : check.consequence?.key === "blinded"
      ? game.i18n.format("MYTHRASF.Combat.EffectConsequence.blinded", {
        turns: Number(check.consequence.turns ?? 0) })
      : check.consequence?.key === "suppressed"
        ? game.i18n.format("MYTHRASF.Combat.EffectConsequence.suppressed", {
          turns: Number(check.consequence.turns ?? 1) })
        : check.consequence?.key === "takeWeaponTooStrong"
          ? localize("MYTHRASF.Combat.EffectConsequence.takeWeaponTooStrong")
        : check.consequence?.key === "disarmTooStrong"
          ? localize("MYTHRASF.Combat.EffectConsequence.disarmTooStrong")
          : check.consequence?.key === "disarmResisted"
            ? localize("MYTHRASF.Combat.EffectConsequence.disarmResisted")
            : ["disarmChoice", "disarmThrown", "disarmTaken"].includes(check.consequence?.key)
              ? game.i18n.format(`MYTHRASF.Combat.EffectConsequence.${check.consequence.key}`, {
                weapon: check.consequence.weaponName, distance: check.consequence.distance })
              : localize("MYTHRASF.Combat.EffectConsequence.resisted");
  const outcome = outcomeKey ? localize(`MYTHRASF.Combat.WoundCheck.Outcome.${outcomeKey}`)
    : effectConsequence;
  const abilityRoll = resolution.automaticResistance
    ? `<div class="mythras-chat-row"><span>${escape(localize(
      "MYTHRASF.Combat.Disarm.StrengthLimit"))}</span><strong class="mythras-chat-result--failure">${escape(localize(
        check.effectKey === "arrebatar-arma"
          ? check.automaticResistance ? "MYTHRASF.Combat.EffectConsequence.takeWeaponTooStrong"
            : "MYTHRASF.Combat.EffectConsequence.disarmResisted"
          : "MYTHRASF.Combat.EffectConsequence.disarmTooStrong"))}</strong></div>`
    : resolution.automaticFailure
    ? `<div class="mythras-chat-row"><span>${escape(localize(
      "MYTHRASF.Suffocation.Endurance"))}</span><strong class="combat-roll-outcome mythras-chat-result--failure">${escape(localize(
        "MYTHRASF.Combat.WoundCheck.AutomaticFailure"))}</strong></div>`
    : `<div class="mythras-chat-row"><span>${escape(resolution.abilityName ?? localize(
      "MYTHRASF.Suffocation.Endurance"))} (1d100 / ${Number(resolution.target ?? 0)}%)</span>${rollOutcome(
        resolution.rawRoll ?? 0, resolution.result)}</div>`;
  const pendingDecision = check.status === "rolled" ? `<div class="combat-check-actions"><button type="button" class="sheet-icon-button mythras-chat-luck-button" data-combat-action="check-luck" data-check-id="${escape(check.id)}" title="${escape(localize("MYTHRASF.Combat.CheckLuckReroll"))}" aria-label="${escape(localize("MYTHRASF.Combat.CheckLuckReroll"))}"><i class="fas fa-clover" aria-hidden="true"></i></button><button type="button" data-combat-action="confirm-check" data-check-id="${escape(check.id)}" title="${escape(localize("MYTHRASF.Combat.WoundCheck.ConfirmResult"))}">${escape(localize("MYTHRASF.Combat.WoundCheck.ConfirmResult"))}</button></div>` : "";
  const luckHistory = (resolution.luckHistory ?? []).map((attempt) => `<small class="mythras-chat-luck-spent">${Number(attempt.rawRoll)} — ${escape(game.i18n.format("MYTHRASF.Luck.SpentBy", { actor: attempt.spenderName }))}</small>`).join("");
  return `<article class="combat-check-entry"><header><strong>${escape(title)}</strong>${help}</header>
    ${abilityRoll}
    ${resolution.weaponName ? `<div class="mythras-chat-row"><span>${escape(localize(
      "MYTHRASF.Combat.Disarm.TargetWeapon"))}</span><strong>${escape(resolution.weaponName)} (${escape(
        resolution.weaponSize)})</strong></div><div class="mythras-chat-row"><span>${escape(localize(
          "MYTHRASF.Chat.Difficulty"))}</span><strong>${escape(localize(
            `MYTHRASF.Difficulty.${resolution.difficulty ?? "standard"}`))}</strong></div>` : ""}
    ${typeof resolution.biped === "boolean" ? `<div class="mythras-chat-row"><span>${escape(localize(
      "MYTHRASF.Combat.Trip.Biped"))}</span><strong>${escape(localize(resolution.biped
        ? "MYTHRASF.Yes" : "MYTHRASF.No"))}</strong></div><div class="mythras-chat-row"><span>${escape(localize(
          "MYTHRASF.Chat.Difficulty"))}</span><strong>${escape(localize(
            `MYTHRASF.Difficulty.${resolution.difficulty}`))}</strong></div>` : ""}
    ${luckHistory}
    <div class="mythras-chat-row"><span>${escape(localize(
      "MYTHRASF.Combat.WoundCheck.OpposedAttack"))}</span>${rollOutcome(
        opposed.rawRoll ?? 0, opposed.result)}</div>
    <div class="mythras-chat-total mythras-chat-result--${resisted ? "success" : "failure"}"><span>${escape(localize(
      "MYTHRASF.Combat.CheckOutcomeLabel"))}</span><strong>${escape(localize(
        `MYTHRASF.Combat.CheckOutcome.${resisted ? "resisted" : "failed"}`))}</strong></div>
    <div class="combat-check-detail combat-check-consequence"><strong>${escape(localize(
      "MYTHRASF.Combat.CheckConsequence"))}:</strong><span>${escape(outcome)}</span></div>${pendingDecision}</article>`;
}

function combatConsequenceHtml(entry, index) {
  if (entry.key === "pinWeapon") return pinConsequenceHtml(entry, index);
  const label = escape(localize(`MYTHRASF.Combat.Consequence.${entry.key}`));
  if (["disarmChoice", "disarmTaken", "disarmThrown"].includes(entry.key)) {
    if (entry.status === "pending") return `<div class="combat-disarm-choice"><p>${escape(
      game.i18n.format("MYTHRASF.Combat.Disarm.ChoicePrompt", { weapon: entry.weaponName }))}</p>
      <div class="combat-check-actions"><button type="button" data-combat-action="disarm-take"
        data-consequence-index="${index}" title="${escape(localize(
          "MYTHRASF.Combat.Disarm.Take"))}">${escape(localize("MYTHRASF.Combat.Disarm.Take"))}</button>
      <button type="button" data-combat-action="disarm-throw" data-consequence-index="${index}"
        title="${escape(localize("MYTHRASF.Combat.Disarm.Throw"))}">${escape(localize(
          "MYTHRASF.Combat.Disarm.Throw"))}</button></div></div>`;
    const key = entry.key === "disarmTaken" ? "disarmTaken" : "disarmThrown";
    return `<div class="mythras-chat-total mythras-chat-result--success"><span>${escape(localize(
      "MYTHRASF.Combat.Disarm.Summary"))}</span><strong>${escape(game.i18n.format(
        `MYTHRASF.Combat.EffectConsequence.${key}`, { weapon: entry.weaponName,
          distance: entry.distance }))}</strong></div>`;
  }
  if (entry.key === "dropHeldItem") {
    if (entry.status === "resolved") {
      const item = entry.itemName || localize("MYTHRASF.Combat.DropHeldItem.None");
      return `<div class="mythras-chat-row"><span>${escape(localize(
        "MYTHRASF.Combat.Consequence.droppedItem"))}</span><strong>${escape(item)}</strong></div>`;
    }
    const choices = (entry.itemChoices ?? []).map((item) =>
      `<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("");
    return `<div class="combat-drop-held-item"><p>${escape(game.i18n.format(
      "MYTHRASF.Combat.DropHeldItem.Prompt", { location: entry.locationName ?? "—" }))}</p>
      <label><span>${label}</span><select data-drop-held-item="${index}"><option value="">${escape(
        localize("MYTHRASF.Combat.DropHeldItem.None"))}</option>${choices}</select></label>
      <button type="button" data-combat-action="drop-held-item" data-consequence-index="${index}"
        title="${escape(localize("MYTHRASF.Combat.DropHeldItem.Confirm"))}">${escape(localize(
          "MYTHRASF.Combat.DropHeldItem.Confirm"))}</button></div>`;
  }
  return `<div class="mythras-chat-row"><span>${label}</span><strong>${escape(entry.status)}</strong>${entry.status === "pending" ? `<button type="button" data-combat-action="resolve-consequence" data-consequence-index="${index}" data-gm-only>${escape(localize("MYTHRASF.CombatEffect.ResolveManual"))}</button>` : ""}</div>`;
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
    position: { width: 480 },
    content: `<div class="mythras-foundry mythras-dialog"><p>${escape(content)}</p></div>`,
    buttons: [{ action: "close", label: localize("MYTHRASF.Close"), icon: "fas fa-times" }],
    rejectClose: false
  });
}

export function renderCombatExchange(combat) {
  const resolved = ["resolved", "awaitingEffects", "awaitingRuse"].includes(combat.status)
    ? combat.resolution : null;
  const attack = resolved?.attack ?? combat.attackClassification;
  const defense = resolved?.defense;
  const defenseName = combat.defender.defense?.type ? localize(`MYTHRASF.Combat.Defense.${combat.defender.defense.type}`) : localize("MYTHRASF.Combat.PendingDefense");
  const defenseActions = ["awaitingDefense", "awaitingAccidentalDefense"].includes(combat.status) ? `<div class="combat-defense-actions"><button type="button" data-combat-action="parry" title="${escape(localize("MYTHRASF.Combat.Parry"))}">${escape(localize("MYTHRASF.Combat.Parry"))}</button><button type="button" data-combat-action="evade" title="${escape(localize("MYTHRASF.Combat.Evade"))}">${escape(localize("MYTHRASF.Combat.Evade"))}</button>${combat.ranged ? `<button type="button" data-combat-action="cover" title="${escape(localize("MYTHRASF.Ranged.Cover"))}">${escape(localize("MYTHRASF.Ranged.Cover"))}</button>` : ""}<button type="button" data-combat-action="none" title="${escape(localize("MYTHRASF.Combat.NoDefense"))}">${escape(localize("MYTHRASF.Combat.NoDefense"))}</button></div>` : "";
  const evadeWinner = resolved?.defense?.type === "evade" ? evasionWinner(resolved) : undefined;
  const outcome = resolved ? `<div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Combat.Advantage"))}</span><strong>${resolved.advantage > 0 ? "+" : ""}${resolved.advantage}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.Effects"))}</span><strong>${resolved.effects} — ${escape(resolved.winner ? localize(`MYTHRASF.Combat.Winner.${resolved.winner}`) : localize("MYTHRASF.Combat.NoWinner"))}</strong></div>${evadeWinner !== undefined ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.EvasionOutcome"))}</span><strong>${escape(evadeWinner ? localize(`MYTHRASF.Combat.Winner.${evadeWinner}`) : localize("MYTHRASF.Combat.NoWinner"))}</strong></div>` : ""}` : "";
  const penalty = resolved?.sharedPenalty ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.Over100Penalty"))}</span><strong class="skill-roll-modifier-effect--penalty">−${resolved.sharedPenalty}</strong></div>` : "";
  const luck = (side) => `<button type="button" class="sheet-icon-button mythras-chat-luck-button" data-combat-action="luck" data-side="${side}" title="${escape(localize("MYTHRASF.Luck.Use"))}" aria-label="${escape(localize("MYTHRASF.Luck.Use"))}"><i class="fas fa-clover" aria-hidden="true"></i></button>`;
  const rollLuckAllowed = combatRollLuckAllowed(combat);
  let damageHtml = "";
  if (combat.damage?.status === "ready") damageHtml = `<button type="button" data-combat-action="roll-damage" title="${escape(localize("MYTHRASF.Combat.RollDamage"))}">${escape(localize("MYTHRASF.Combat.RollDamage"))}</button>`;
  if (combat.damage?.status === "missedLocation") {
    const locationRollRow = combat.damage.locationRoll == null ? ""
      : `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.LocationRoll"))} (1d20)</span><strong class="mythras-chat-roll-value">${combat.damage.locationRoll}</strong></div>`;
    const permanentWoundRollRow = combat.damage.permanentWoundHitRoll == null ? ""
      : `<div class="mythras-chat-row"><span>${escape(game.i18n.format(
        "MYTHRASF.Combat.PermanentWoundHitRoll", {
          location: combat.damage.permanentWoundLocationName,
          severity: combat.damage.permanentWoundSeverity
        }))} (1d3)</span><strong class="mythras-chat-roll-value">${combat.damage.permanentWoundHitRoll}</strong></div>`;
    const missedKey = combat.damage.permanentWoundHitRoll == null
      ? "MYTHRASF.Combat.NoHitLocation" : "MYTHRASF.Combat.PermanentWoundHitFailed";
    damageHtml = `<fieldset class="combat-damage-panel"><legend>${escape(localize("MYTHRASF.Chat.Damage"))}</legend>${locationRollRow}${permanentWoundRollRow}<div class="combat-card-warning">${escape(localize(missedKey))}</div></fieldset>`;
  } else if (["rolled", "proposed", "stale", "applying", "applied"].includes(combat.damage?.status)) {
    const damage = combat.damage;
    if (damage.targetType === "weapon") {
      const sourceName = damage.weaponTarget?.source?.weaponName ?? "—";
      const targetName = damage.weaponTarget?.target?.weaponName ?? damage.locationName ?? "—";
      const result = damage.resultingWound ?? (Number(damage.afterHitPoints) <= 0
        ? "broken" : Number(damage.afterHitPoints) < Number(damage.beforeHitPoints)
          ? "damaged" : "unharmed");
      const appliedRows = damage.status === "applied"
        ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.HitPointsBeforeAfter"))}</span><strong>${damage.beforeHitPoints} → ${damage.afterHitPoints}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Result"))}</span><strong class="weapon-durability-${escape(result)}">${escape(localize(`MYTHRASF.Weapon.Durability.${result}`))}</strong></div>`
        : `<button type="button" data-combat-action="apply-damage" title="${escape(localize("MYTHRASF.Combat.ApplyWeaponDamage"))}">${escape(localize("MYTHRASF.Combat.ApplyWeaponDamage"))}</button>`;
      damageHtml = `<fieldset class="combat-damage-panel combat-weapon-damage-panel"><legend>${escape(localize("MYTHRASF.CombatEffect.DamageWeapon"))}</legend><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.DamageSourceWeapon"))}</span><strong>${escape(sourceName)}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.TargetWeapon"))}</span><strong>${escape(targetName)}</strong></div><div class="mythras-chat-row"><span>${damageBreakdownLabel(damage)}</span><strong>${escape(localize("MYTHRASF.Combat.DamageWeapon"))} (${weaponDamageFormulaHtml(damage)}) + ${escape(localize("MYTHRASF.Combat.DamageBonus"))} (${escape(damage.modifierFormula ?? "0")})</strong>${["proposed", "stale"].includes(damage.status) ? luck("damage") : ""}</div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.DamageDice"))}</span><strong>${escape(damage.rollExpression ?? damage.resultExpression ?? damage.rawRoll)}</strong></div><div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Chat.Result"))}</span><strong>${damage.rawRoll}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Armor"))}</span><strong>${damage.armorPoints ?? "—"}</strong></div>${damage.ignoredArmorTypes?.length ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.BypassArmor.Type"))}</span><strong>${damage.ignoredArmorTypes.map((type) => escape(localize(`MYTHRASF.Combat.BypassArmor.${type}`))).join(", ")}</strong></div>` : ""}<div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Chat.PenetratingDamage"))}</span><strong>${damage.penetratingDamage ?? "—"}</strong></div>${damage.status === "stale" ? `<p class="combat-card-warning">${escape(localize("MYTHRASF.Combat.DamageStale"))}</p>` : ""}${appliedRows}</fieldset>`;
    } else {
    const extraordinary = damage.extraordinaryFormula && damage.extraordinaryFormula !== "0"
      ? ` + ${escape(localize("MYTHRASF.Combat.DamageExtraordinary"))} (${escape(damage.extraordinaryFormula)})` : "";
    const permanentWoundHitRow = damage.permanentWoundHitRoll == null ? ""
      : `<div class="mythras-chat-row"><span>${escape(game.i18n.format(
        "MYTHRASF.Combat.PermanentWoundHitRoll", {
          location: damage.permanentWoundLocationName, severity: damage.permanentWoundSeverity
        }))} (1d3)</span><strong class="mythras-chat-roll-value">${damage.permanentWoundHitRoll}</strong></div>`;
    const locationRow = `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.HitLocation"))}</span><strong>${escape(damage.locationName ?? "—")}</strong></div>`;
    const containedBlowRow = damage.containedBlow
      ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.AfterContainedBlow"))}</span><strong>${damage.afterContainedBlow ?? "—"}</strong></div>` : "";
    const rangeRow = combat.ranged?.band === "long"
      ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Ranged.LongRangeDamage"))}</span><strong>${damage.beforeRange} → ${damage.afterRange}</strong></div>` : "";
    const activeParryRow = damage.activeParry
      ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.ParryReduction"))}</span><strong>${escape(localize(`MYTHRASF.Combat.ParryType.${damage.parryType}`))}: ${damage.afterParry ?? "—"}</strong></div>` : "";
    const passiveBlockRows = damage.passiveBlock
      ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Status.PassiveBlock"))}</span><strong>${escape(damage.passiveBlock.weaponName)} (${escape(damage.passiveBlock.weaponSize)})</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.AfterPassiveBlock"))}</span><strong>${escape(localize(`MYTHRASF.Combat.ParryType.${damage.passiveBlockType ?? "none"}`))}: ${damage.afterPassiveBlock ?? "—"}</strong></div>` : "";
    damageHtml = `<fieldset class="combat-damage-panel"><legend>${escape(localize("MYTHRASF.Chat.Damage"))}</legend><div class="mythras-chat-row"><span>${damageBreakdownLabel(damage)}</span><strong>${escape(localize("MYTHRASF.Combat.DamageWeapon"))} (${weaponDamageFormulaHtml(damage)}) + ${escape(localize("MYTHRASF.Combat.DamageBonus"))} (${escape(damage.modifierFormula ?? "0")})${extraordinary}</strong>${["proposed", "stale"].includes(damage.status) ? luck("damage") : ""}</div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.DamageDice"))}</span><strong>${escape(damage.rollExpression ?? damage.resultExpression ?? damage.rawRoll)}</strong></div><div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Chat.Result"))}</span><strong>${damage.rawRoll}</strong></div>${damage.locationRoll != null ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.LocationRoll"))} (1d20)</span><strong class="mythras-chat-roll-value">${damage.locationRoll}</strong></div>` : ""}${locationRow}${permanentWoundHitRow}${rangeRow}${containedBlowRow}${activeParryRow}${passiveBlockRows}<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Armor"))}</span><strong>${damage.armorPoints ?? "—"}</strong></div>${damage.ignoredArmorTypes?.length ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.BypassArmor.Type"))}</span><strong>${damage.ignoredArmorTypes.map((type) => escape(localize(`MYTHRASF.Combat.BypassArmor.${type}`))).join(", ")}</strong></div>` : ""}<div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Chat.PenetratingDamage"))}</span><strong>${damage.penetratingDamage ?? "—"}</strong></div>${damage.push?.triggered ? `<div class="combat-card-warning">${escape(game.i18n.format("MYTHRASF.Combat.PushSummary", { distance: damage.push.distance, excess: damage.push.excess }))}</div>` : ""}${damage.status === "stale" ? `<p class="combat-card-warning">${escape(localize("MYTHRASF.Combat.DamageStale"))}</p>` : ""}${damage.status === "applied" ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.HitPointsBeforeAfter"))}</span><strong>${damage.beforeHitPoints} → ${damage.afterHitPoints}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Wound"))}</span><strong>${escape(localize(`MYTHRASF.Wound.${damage.resultingWound}`))}</strong></div>${damage.permanentWound ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.PermanentWound.Severity"))} (1d3: ${damage.permanentWoundRoll})</span><strong>${damage.permanentWound.severity}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.PermanentWound.Description"))}</span><strong>${escape(damage.permanentWound.description)}</strong></div>` : ""}${["serious", "major"].includes(damage.resultingWound) ? `<p class="combat-card-warning">${escape(localize("MYTHRASF.Combat.WoundCheck.Detected"))}</p>` : ""}` : `<button type="button" data-combat-action="apply-damage" title="${escape(localize("MYTHRASF.Combat.ApplyDamage"))}">${escape(localize("MYTHRASF.Combat.ApplyDamage"))}</button>`}</fieldset>`;
    if (damage.status === "applied") {
      const wound = escape(localize(`MYTHRASF.Wound.${damage.resultingWound}`));
      damageHtml = damageHtml.replace(`<strong>${wound}</strong>`,
        `<strong class="combat-wound-outcome wound-${escape(damage.resultingWound)}">${wound}</strong>`);
    }
    if (damage.cover) damageHtml = damageHtml.replace(
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Armor"))}</span>`,
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Ranged.Cover"))}</span><strong>${escape(damage.cover.source)}: −${damage.cover.absorbed}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Armor"))}</span>`);
    if (damage.alternateRoll) damageHtml = damageHtml.replace("</fieldset>",
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.CombatEffect.ImpaleDiscarded"))}</span><strong class="mythras-chat-roll-value">${damage.alternateRoll.rawRoll}</strong></div></fieldset>`);
    if (damage.woundLuck) damageHtml = damageHtml.replace("</fieldset>",
      `<div class="mythras-chat-row"><span>${escape(localize(
        "MYTHRASF.Combat.WoundCheck.LuckSpent"))}</span><strong>−1</strong></div></fieldset>`);
    }
  }
  const selectedEffects = (combat.effects?.selections ?? []).map((effect) => {
    const automationKey = combatEffectIsAutomated(effect) ? "AutomatedDebug" : "NotAutomatedDebug";
    return effect.waived
    ? `<li>${escape(localize("MYTHRASF.CombatEffect.Waive"))}</li>`
    : `<li><button type="button" class="sheet-icon-button" data-combat-action="open-effect" data-effect-uuid="${escape(effect.uuid)}" title="${escape(localize("MYTHRASF.CombatEffect.Open"))}"><i class="fas fa-book-open" aria-hidden="true"></i></button> ${escape(effect.name)} ${effect.automaticSuccess ? `<strong class="combat-effect-automatic">${escape(localize("MYTHRASF.CombatEffect.AutomaticSuccess"))}</strong>` : ""} <small class="combat-effect-debug-note" title="${escape(localize("MYTHRASF.CombatEffect.DebugNoteTitle"))}">${escape(localize(`MYTHRASF.CombatEffect.${automationKey}`))}</small></li>`;
  }).join("");
  const replacedEffects = (combat.effects?.replacedSelections ?? []).map((effect) =>
    `<div class="combat-card-warning">${escape(game.i18n.format(
      "MYTHRASF.CombatEffect.Ruse.Replaced", { effect: effect.name }))}</div>`).join("");
  const rusePending = combat.status === "awaitingRuse"
    ? `<fieldset class="combat-effects-panel combat-ruse-panel"><legend>${escape(localize(
      "MYTHRASF.CombatEffect.Ruse.Title"))}</legend>${(combat.effects?.pendingRuses ?? []).map(
      (entry) => `<p class="combat-card-warning">${escape(game.i18n.format(
        "MYTHRASF.CombatEffect.Ruse.Blocked", { effect: entry.blockedEffectName }))}</p>`).join("")}
      <button type="button" data-combat-action="choose-ruse-replacement" title="${escape(localize(
        "MYTHRASF.CombatEffect.Ruse.Choose"))}">${escape(localize(
          "MYTHRASF.CombatEffect.Ruse.Choose"))}</button></fieldset>` : "";
  const effectsHtml = combat.status === "awaitingEffects"
    ? `<fieldset class="combat-effects-panel"><legend>${escape(localize("MYTHRASF.CombatEffect.Pending"))}</legend><button type="button" data-combat-action="choose-effects" title="${escape(localize("MYTHRASF.CombatEffect.Select"))}">${escape(localize("MYTHRASF.CombatEffect.Select"))}</button></fieldset>`
    : selectedEffects ? `<fieldset class="combat-effects-panel"><legend>${escape(localize("MYTHRASF.CombatEffect.Selected"))}</legend><ol>${selectedEffects}</ol></fieldset>` : "";
  const allChecks = combat.effects?.checks ?? [];
  const selections = combat.effects?.selections ?? [];
  const beforeDamageChecks = allChecks.filter((check) => check.source === "effect"
    && ["beforeDamage", "damage"].includes(combatEffectCheckPhase(check, selections)));
  const afterDamageChecks = ["applied", "unavailable", "missedLocation"]
    .includes(combat.damage?.status) ? allChecks.filter((check) => check.source === "effect"
      && combatEffectCheckPhase(check, selections) === "afterDamage") : [];
  const woundChecks = combat.damage?.status === "applied"
    ? allChecks.filter((check) => check.source === "wound") : [];
  const beforeDamageChecksHtml = beforeDamageChecks.length
    ? `<fieldset class="combat-checks-panel"><legend>${escape(localize("MYTHRASF.Combat.BeforeDamageResolution"))}</legend>${beforeDamageChecks.map((check) => combatCheckHtml(check, combat)).join("")}</fieldset>` : "";
  const afterDamageChecksHtml = `${afterDamageChecks.length ? `<fieldset class="combat-checks-panel"><legend>${escape(localize("MYTHRASF.Combat.EffectResolution"))}</legend>${afterDamageChecks.map((check) => combatCheckHtml(check, combat)).join("")}</fieldset>` : ""}${woundChecks.length ? `<fieldset class="combat-checks-panel"><legend>${escape(localize("MYTHRASF.Combat.WoundResolution"))}</legend>${woundChecks.map((check) => combatCheckHtml(check, combat)).join("")}</fieldset>` : ""}`;
  const consequencesHtml = (combat.consequences ?? []).length ? `<fieldset><legend>${escape(localize("MYTHRASF.Combat.Consequences"))}</legend>${combat.consequences.map(combatConsequenceHtml).join("")}</fieldset>` : "";
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
  return `<section class="mythras-combat-card mythras-chat-card" data-combat-revision="${combat.revision}"><div class="mythras-chat-title">${escape(localize("MYTHRASF.Combat.ExchangeTitle"))}</div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.StatusLabel"))}</span><strong>${escape(localize(`MYTHRASF.Combat.Status.${combat.status}`))}</strong></div>${cancelled}${tracker}<div class="mythras-chat-details"><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.Attacker"))}</span><strong>${escape(combatEntryDisplayName(combat.attacker))}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.Defender"))}</span><strong>${escape(combatEntryDisplayName(combat.defender))}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.WeaponAndStyle"))}</span><strong>${escape(`${combat.attacker.weaponName} — ${combat.attacker.styleName}`)}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.DeclarationMoment"))}</span><strong>${escape(localize(`MYTHRASF.Combat.Declaration.${combat.predeclared ? "before" : "after"}`))}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.ContainedBlow"))}</span><strong>${escape(localize(combat.declarations?.containedBlow ? "MYTHRASF.Yes" : "MYTHRASF.No"))}</strong></div></div>${rangedHtml}${adjustmentHtml}<div class="combat-exchange-side"><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.AttackRoll"))} (${attack?.target ?? combat.attacker.target}%)</span>${rollOutcome(combat.attacker.rawRoll, attack?.result)}${rollLuckAllowed ? luck("attacker") : ""}</div></div><div class="combat-exchange-side"><div class="mythras-chat-row"><span>${escape(defenseName)}${defense?.target != null ? ` (${defense.target}%)` : ""}</span>${defense?.rawRoll == null ? "<strong>—</strong>" : rollOutcome(defense.rawRoll, defense.result)}${defense?.rawRoll != null && rollLuckAllowed ? luck("defender") : ""}</div></div>${penalty}${outcome}${replacedEffects}${effectsHtml}${rusePending}${beforeDamageChecksHtml}${damageHtml}${afterDamageChecksHtml}${consequencesHtml}${defenseActions}${accidental}<div data-combat-gm-actions>${cancel}${close}</div></section>`;
}
