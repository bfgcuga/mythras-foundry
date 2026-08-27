import { activateContestResponseDialog, activateSkillRollDialog } from "../apps/skill-roll-dialog.js";
import { activateCombatCard, registerCombatSocket } from "../rules/combat-chat.js";
import { activateContestCard, registerContestSocket } from "../rules/contest-chat.js";
import { activateSkillRollCard } from "../rules/skill-roll-chat.js";
import { activateActionPointSettingVisibility } from "../settings.js";
import { activateDelayedTooltips } from "../ui/tooltips.js";
import { effectiveActionPointMaximum } from "../rules/action-points.js";
import { getActionPointRules } from "../settings.js";
import { isCombatCoordinator, restoreCombatActors,
  synchronizeCombatantActionPoints,
  synchronizeCombatantInitiative } from "../documents/mythras-combat.js";
import { activateRoundConsequenceCard,
  registerRoundConsequenceSocket } from "../rules/round-consequences.js";
import { initializeSurpriseEffect } from "../rules/timed-condition-runtime.js";
import { initializeExsanguinatingEffect } from "../rules/exsanguination.js";
import { initializeDyingEffect } from "../rules/dying.js";
import { activateReachCard, openTacticalOverview, registerReachSocket } from "../rules/reach-chat.js";
import { registerTacticalSocket } from "../rules/engagement-runtime.js";
import { activateCombatActionCard, combatActionState,
  registerCombatActionSocket } from "../rules/combat-action-runtime.js";
import { actorDisplayName, tokenDisplayName } from "../rules/document-names.js";
import { activateFatigueCheckCard, registerFatigueCheckSocket }
  from "../rules/fatigue-check-chat.js";

function activateChatCards(message, html) {
  activateCombatCard(message, html);
  activateRoundConsequenceCard(message, html);
  activateReachCard(message, html);
  activateSkillRollCard(message, html);
  activateContestCard(message, html);
  activateCombatActionCard(message, html);
  activateFatigueCheckCard(message, html);
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
  Hooks.once("ready", async () => {
    registerContestSocket();
    registerCombatSocket();
    registerRoundConsequenceSocket();
    registerReachSocket();
    registerTacticalSocket();
    registerCombatActionSocket();
    registerFatigueCheckSocket();
    if (isCombatCoordinator()) {
      await Promise.all(game.combats.map((combat) => combat.ensureInitiativeTieBreaks?.()));
      for (const combat of game.combats.filter((entry) => entry.started)) {
        for (const combatant of combat.combatants) {
          await synchronizeCombatantInitiative(combatant);
        }
      }
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
      const overview = document.createElement("button");
      overview.type = "button"; overview.className = "sheet-icon-button mythras-tactical-overview";
      overview.innerHTML = '<i class="fas fa-people-arrows-left-right" aria-hidden="true"></i>';
      overview.title = game.i18n.localize("MYTHRASF.Reach.Overview");
      overview.setAttribute("aria-label", overview.title);
      overview.addEventListener("click", () => openTacticalOverview());
      header.append(overview);
    }
    for (const row of root.querySelectorAll("[data-combatant-id]")) {
      const entry = combat.combatants.get(row.dataset.combatantId);
      if (!entry?.actor || row.querySelector(".mythras-tracker-ap")) continue;
      const name = entry.actor.type === "character" ? actorDisplayName(entry.actor)
        : tokenDisplayName(entry.token) || actorDisplayName(entry.actor);
      const nameContainer = row.querySelector(".token-name, .combatant-name");
      const nameElement = nameContainer?.querySelector?.("h4, .name, strong") ?? nameContainer;
      const textNode = Array.from(nameElement?.childNodes ?? []).find((node) =>
        node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (textNode && name) textNode.textContent = name;
      const current = Number(entry.actor.system.resources?.actionPoints?.value ?? 0);
      const maximum = entry.isDefeated ? 0
        : effectiveActionPointMaximum(entry.actor, getActionPointRules());
      const badge = document.createElement("span");
      badge.className = "mythras-tracker-ap";
      badge.textContent = game.i18n.format("MYTHRASF.Tracker.ActionPoints", { current, maximum });
      badge.title = game.i18n.localize("MYTHRASF.Tracker.ActionPointsHint");
      nameContainer?.append(badge);
      const initiative = entry.getFlag("mythras-foundry", "initiative");
      const value = row.querySelector(".token-initiative, .initiative");
      if (value && initiative) {
        const tied = Array.from(combat.combatants).filter((candidate) => {
          const data = candidate.getFlag("mythras-foundry", "initiative");
          return candidate.initiative != null && Number(data?.primary ?? Math.trunc(candidate.initiative))
            === Number(initiative.primary);
        }).length > 1;
        value.textContent = tied ? `${initiative.primary} (${initiative.tieBreak})`
          : String(initiative.primary);
        value.title = tied
          ? game.i18n.format("MYTHRASF.Tracker.InitiativeHint", initiative)
          : game.i18n.format("MYTHRASF.Tracker.InitiativeHintNoTie", initiative);
      }
      const actions = combatActionState(combat);
      const tactical = [];
      if (actions.delays[entry.id]?.status === "reserved") tactical.push(game.i18n.localize("MYTHRASF.Action.delay"));
      if (actions.braces[entry.id]?.status === "active") tactical.push(game.i18n.localize("MYTHRASF.Action.brace"));
      if (actions.movements[entry.id]) tactical.push(game.i18n.localize(`MYTHRASF.Action.Movement.${actions.movements[entry.id].mode}`));
      if (entry.actor.statuses?.has?.("prone")) tactical.push(game.i18n.localize("MYTHRASF.Status.Prone"));
      const block = combat.getFlag("mythras-foundry", "tacticalState")
        ?.passiveBlocks?.[entry.id];
      if (block?.status === "active" && Number(block.round) === Number(combat.round)) {
        const locations = (block.locationIds ?? []).map((id) => entry.actor.items.get(id)?.name)
          .filter(Boolean).join(", ");
        tactical.push(`${game.i18n.localize("MYTHRASF.Status.PassiveBlock")}: ${locations}`);
      }
      if (tactical.length) {
        const status = document.createElement("span"); status.className = "mythras-tracker-tactical";
        status.textContent = tactical.join(" · "); status.title = tactical.join(" · ");
        row.querySelector(".token-name, .combatant-name")?.append(status);
      }
    }
  });
  Hooks.on("updateCombatant", async (combatant, changed, options) => {
    if (Object.hasOwn(changed, "defeated")) await synchronizeCombatantActionPoints(combatant);
    if (Object.hasOwn(changed, "initiative") && !options.mythrasTieBreak) {
      await combatant.parent?.ensureInitiativeTieBreaks?.();
    }
  });
  Hooks.on("updateCombat", (combat, changed) => {
    if (!foundry.utils.hasProperty(changed, "flags.mythras-foundry.tacticalState")) return;
    for (const combatant of combat.combatants) combatant.actor?.sheet?.render?.();
  });
  Hooks.on("updateActor", async (actor, changed) => {
    if (!isCombatCoordinator()) return;
    for (const combat of game.combats.filter((entry) => entry.started)) {
      const combatant = combat.combatants.find((entry) => entry.actor?.uuid === actor.uuid);
      if (!combatant) continue;
      if (foundry.utils.hasProperty(changed, "system.resources.actionPoints.value")) {
        await synchronizeCombatantActionPoints(combatant);
      }
      await synchronizeCombatantInitiative(combatant);
    }
  });
  Hooks.on("deleteCombat", async (combat) => restoreCombatActors(combat));
  Hooks.on("combatEnd", async (combat) => {
    await restoreCombatActors(combat);
    if (isCombatCoordinator()) await combat.unsetFlag("mythras-foundry", "tacticalState");
  });
  const syncEffectActor = async (effect) => {
    const actor = effect.parent;
    if (!isCombatCoordinator() || actor?.documentName !== "Actor") return;
    for (const combat of game.combats.filter((entry) => entry.started)) {
      const combatant = combat.combatants.find((entry) => entry.actor?.uuid === actor.uuid);
      if (combatant) {
        await synchronizeCombatantActionPoints(combatant);
        await synchronizeCombatantInitiative(combatant);
      }
    }
  };
  Hooks.on("createActiveEffect", async (effect) => {
    await initializeSurpriseEffect(effect);
    await initializeExsanguinatingEffect(effect);
    await initializeDyingEffect(effect);
    await syncEffectActor(effect);
  });
  Hooks.on("updateActiveEffect", syncEffectActor);
  Hooks.on("deleteActiveEffect", syncEffectActor);
  const syncItemActor = async (item) => {
    const actor = item.parent;
    if (!isCombatCoordinator() || actor?.documentName !== "Actor") return;
    for (const combat of game.combats.filter((entry) => entry.started)) {
      const combatant = combat.combatants.find((entry) => entry.actor?.uuid === actor.uuid);
      if (combatant) await synchronizeCombatantInitiative(combatant);
    }
  };
  Hooks.on("createItem", syncItemActor);
  Hooks.on("updateItem", syncItemActor);
  Hooks.on("deleteItem", syncItemActor);
}
