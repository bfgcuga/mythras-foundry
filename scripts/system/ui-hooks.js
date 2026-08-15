import { activateContestResponseDialog, activateSkillRollDialog } from "../apps/skill-roll-dialog.js";
import { activateCombatCard } from "../rules/combat-chat.js";
import { activateContestCard, registerContestSocket } from "../rules/contest-chat.js";
import { activateSkillRollCard } from "../rules/skill-roll-chat.js";
import { activateActionPointSettingVisibility } from "../settings.js";
import { activateDelayedTooltips } from "../ui/tooltips.js";

function activateChatCards(message, html) {
  activateCombatCard(message, html);
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
  Hooks.once("ready", registerContestSocket);
  Hooks.on("renderApplicationV2", (application, element) => activateApplicationUi(element));
  Hooks.on("renderApplication", (application, html) => {
    activateApplicationUi(html instanceof HTMLElement ? html : html?.[0]);
  });
}
