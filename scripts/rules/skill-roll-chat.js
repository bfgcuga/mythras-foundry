import { classifyRoll, renderRollLine, renderRollResult, rollThresholdRanges } from "../documents/mythras-item.js";
import { invertD100 } from "./skill-roll.js";
import { evaluateAnimatedRoll } from "./dice-animation.js";
import { recordAbilityFumble } from "./skills.js";

const pendingLuckMessages = new Set();

export async function activateSkillRollCard(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const button = root?.querySelector?.("[data-action='spend-luck']");
  if (!button || button.dataset.listenerAttached) return;
  const data = message.getFlag("mythras-foundry", "skillRoll");
  const actor = data?.actorUuid ? await fromUuid(data.actorUuid) : null;
  button.hidden = !canUseSimpleRollLuck(actor);
  button.dataset.listenerAttached = "true";
  button.addEventListener("click", async (event) => {
    if (pendingLuckMessages.has(message.id)) return;
    pendingLuckMessages.add(message.id);
    button.disabled = true;
    try { await spendLuck(message, event.shiftKey); }
    finally { pendingLuckMessages.delete(message.id); button.disabled = false; }
  });
}

async function spendLuck(message, manual = false) {
  const data = message.getFlag("mythras-foundry", "skillRoll");
  const actor = data?.actorUuid ? await fromUuid(data.actorUuid) : null;
  if (!canUseSimpleRollLuck(actor)) return;
  const luck = Number(actor.system.resources?.luckPoints?.value ?? 0);
  if (luck < 1) return ui.notifications.warn(game.i18n.localize("MYTHRASF.Luck.None"));
  const { DialogV2 } = foundry.applications.api;
  const choice = await DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Luck.Title") },
    content: `<div class="mythras-foundry mythras-dialog luck-spend-dialog"><p>${game.i18n.localize("MYTHRASF.Luck.Confirm")}</p></div>`,
    buttons: [
      { action: "reroll", label: game.i18n.localize("MYTHRASF.Luck.Reroll"), icon: "fas fa-dice-d20", callback: () => "reroll" },
      { action: "invert", label: game.i18n.localize("MYTHRASF.Luck.Invert"), icon: "fas fa-arrow-right-arrow-left", callback: () => "invert" },
      { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), icon: "fas fa-times" }
    ], rejectClose: false
  });
  if (!choice) return;
  const previous = [...(data.rolls ?? [])];
  const current = previous.at(-1);
  const roll = choice === "reroll" ? await evaluateAnimatedRoll("1d100",
    { manual }) : null;
  const value = choice === "reroll" ? roll.total : invertD100(current);
  const result = classifyRoll(value, data.target, data.criticalTarget);
  await recordAbilityFumble(actor?.items.get(data.itemId), result);
  const card = document.createElement("div");
  card.innerHTML = message.content;
  const label = card.querySelector(".mythras-chat-roll-line")?.dataset.rollLabel ?? "MYTHRASF.Chat.SkillRoll";
  card.querySelector(".mythras-chat-roll-line")?.replaceWith(fragment(renderRollLine(value, { previous, label })));
  card.querySelector(".mythras-chat-result-block")?.replaceWith(fragment(renderRollResult(result, rollThresholdRanges(data.target, data.criticalTarget))));
  await actor.update({ "system.resources.luckPoints.value": luck - 1 });
  await message.update({ content: card.innerHTML, rolls: roll ? [...message.rolls, roll] : message.rolls,
    "flags.mythras-foundry.skillRoll.rolls": [...previous, value] });
}

function canUseSimpleRollLuck(actor) {
  if (!actor || (!game.user.isGM && !actor.isOwner)) return false;
  const identity = actor.parent?.actorId ?? actor.token?.actorId ?? actor.id;
  const activeParty = game.mythrasFoundry?.party?.getActiveParty?.();
  return (activeParty?.memberIds ?? []).includes(identity);
}

function fragment(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}
