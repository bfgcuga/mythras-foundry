import { activateContestResponseDialog, activateSkillRollDialog } from "../apps/skill-roll-dialog.js";
import { activateCombatCard, registerCombatSocket } from "../rules/combat-chat.js";
import { activateContestCard, registerContestSocket } from "../rules/contest-chat.js";
import { activateSkillRollCard } from "../rules/skill-roll-chat.js";
import { activateActionPointSettingVisibility } from "../settings.js";
import { activateDelayedTooltips } from "../ui/tooltips.js";
import { effectiveActionPointMaximum } from "../rules/action-points.js";
import { getActionPointRules } from "../settings.js";
import { isCombatCoordinator, restoreCombatActors,
  synchronizeCombatantActionPoints } from "../documents/mythras-combat.js";
import { activateRoundConsequenceCard,
  registerRoundConsequenceSocket } from "../rules/round-consequences.js";
import { initializeSurpriseEffect } from "../rules/timed-condition-runtime.js";

function activateChatCards(message, html) {
  activateCombatCard(message, html);
  activateRoundConsequenceCard(message, html);
  activateSkillRollCard(message, html);
  activateContestCard(message, html);
}

function activateApplicationUi(element) {
  if (element?.querySelector?.(".mythras-dialog")) {
    element.classList.add("mythras-foundry", "mythras-paper-sheet");
  }
  if (element) {
    activateSkillRollDialog(element);
    activateContestResponseDialog(element);
  }
  activateDelayedTooltips(element);
  activateActionPointSettingVisibility(element);
}

export function registerUiHooks() {
  Hooks.on("renderChatMessageHTML", activateChatCards);
  Hooks.on("renderChatMessage", activateChatCards);
  Hooks.once("ready", async () => {
    registerContestSocket();
    registerCombatSocket();
    registerRoundConsequenceSocket();
    if (isCombatCoordinator()) {
      await Promise.all(game.combats.map((combat) => combat.ensureInitiativeTieBreaks?.()));
    }
  });
  Hooks.on("renderApplicationV2", (application, element) => activateApplicationUi(element));
  Hooks.on("renderApplication", (application, html) => {
    activateApplicationUi(html instanceof HTMLElement ? html : html?.[0]);
  });
  Hooks.on("renderCombatTracker", (application, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    const combat = application.viewed ?? game.combat ?? game.combats?.active;
    if (!root || !combat) return;
    const cycle = combat.getFlag("mythras-foundry", "turnEconomy")?.cycle ?? 1;
    const header = root.querySelector(".combat-tracker-header, header");
    if (header && !header.querySelector(".mythras-tracker-cycle")) {
      const badge = document.createElement("span");
      badge.className = "mythras-tracker-cycle";
      badge.textContent = game.i18n.format("MYTHRASF.Tracker.RoundCycle", {
        round: combat.round ?? 0, cycle });
      badge.title = game.i18n.localize("MYTHRASF.Tracker.CycleHint");
      header.append(badge);
    }
    for (const row of root.querySelectorAll("[data-combatant-id]")) {
      const entry = combat.combatants.get(row.dataset.combatantId);
      if (!entry?.actor || row.querySelector(".mythras-tracker-ap")) continue;
      const current = Number(entry.actor.system.resources?.actionPoints?.value ?? 0);
      const maximum = entry.isDefeated ? 0
        : effectiveActionPointMaximum(entry.actor, getActionPointRules());
      const badge = document.createElement("span");
      badge.className = "mythras-tracker-ap";
      badge.textContent = game.i18n.format("MYTHRASF.Tracker.ActionPoints", { current, maximum });
      badge.title = game.i18n.localize("MYTHRASF.Tracker.ActionPointsHint");
      row.querySelector(".token-name, .combatant-name")?.append(badge);
      const initiative = entry.getFlag("mythras-foundry", "initiative");
      const value = row.querySelector(".token-initiative, .initiative");
      if (value && initiative) value.title = game.i18n.format("MYTHRASF.Tracker.InitiativeHint", initiative);
    }
  });
  Hooks.on("updateCombatant", async (combatant, changed, options) => {
    if (Object.hasOwn(changed, "defeated")) await synchronizeCombatantActionPoints(combatant);
    if (Object.hasOwn(changed, "initiative") && !options.mythrasTieBreak) {
      await combatant.parent?.ensureInitiativeTieBreaks?.();
    }
  });
  Hooks.on("updateActor", async (actor, changed) => {
    if (!isCombatCoordinator() || !foundry.utils.hasProperty(changed,
      "system.resources.actionPoints.value")) return;
    for (const combat of game.combats.filter((entry) => entry.started)) {
      const combatant = combat.combatants.find((entry) => entry.actor?.uuid === actor.uuid);
      if (combatant) await synchronizeCombatantActionPoints(combatant);
    }
  });
  Hooks.on("deleteCombat", async (combat) => restoreCombatActors(combat));
  Hooks.on("combatEnd", async (combat) => restoreCombatActors(combat));
  const syncEffectActor = async (effect) => {
    const actor = effect.parent;
    if (!isCombatCoordinator() || actor?.documentName !== "Actor") return;
    for (const combat of game.combats.filter((entry) => entry.started)) {
      const combatant = combat.combatants.find((entry) => entry.actor?.uuid === actor.uuid);
      if (combatant) await synchronizeCombatantActionPoints(combatant);
    }
  };
  Hooks.on("createActiveEffect", async (effect) => {
    await initializeSurpriseEffect(effect);
    await syncEffectActor(effect);
  });
  Hooks.on("updateActiveEffect", syncEffectActor);
  Hooks.on("deleteActiveEffect", syncEffectActor);
}
