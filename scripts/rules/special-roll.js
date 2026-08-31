import { openSkillRollDialog, openSpecialRollSetup, SPECIAL_ABILITY_ID } from "../apps/skill-roll-dialog.js";
import { classifyRoll, renderRollLine, renderRollResult, rollThresholdRanges } from "../documents/mythras-item.js";
import { createContestMessage } from "./contest-chat.js";
import { actorSpeaker } from "./document-names.js";
import { evaluateSystemRoll } from "./system-roll.js";

const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

export async function rollSpecial(actor, { manual = false } = {}) {
  const setup = await openSpecialRollSetup(actor);
  if (!setup) return;
  const ability = { id: SPECIAL_ABILITY_ID, name: setup.name, type: "special", actor,
    system: { total: setup.target } };
  const configured = await openSkillRollDialog(ability);
  if (!configured) return;
  const interactive = configured.contest?.resolutionMode !== "difficulty"
    || configured.contest?.sides?.initiator?.mode !== "individual";
  if (interactive) {
    const initialRoll = configured.contest.sides.initiator.mode === "individual"
      ? await evaluateSystemRoll("1d100", { manual }) : null;
    return createContestMessage(ability, configured, initialRoll);
  }
  const { targets, limitedSkill, reinforcedSkill } = configured;
  const roll = await evaluateSystemRoll("1d100", { manual });
  const result = classifyRoll(roll.total, targets.target, targets.criticalTarget);
  const ranges = rollThresholdRanges(targets.target, targets.criticalTarget);
  const adjustments = [["Limited", limitedSkill], ["Reinforced", reinforcedSkill]]
    .filter((entry) => entry[1]).map(([key, item]) => `<div class="mythras-chat-row"><span>${game.i18n.localize(`MYTHRASF.SkillRoll.${key}`)}</span><strong>${escape(item.name)} (${Number(item.system.total ?? 0)}%)</strong></div>`).join("");
  const effective = targets.target === targets.baseTarget ? ""
    : `<div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.EffectiveTarget")}</span><strong class="skill-roll-modifier-effect--${targets.target > targets.baseTarget ? "bonus" : "penalty"}">${targets.target}%</strong></div>`;
  const messageData = { speaker: actorSpeaker(actor), rolls: [roll],
    content: `<section class="mythras-chat-card"><div class="mythras-chat-title">${escape(setup.name)}</div><div class="mythras-chat-details"><div class="mythras-chat-row"><span>${game.i18n.localize("MYTHRASF.Chat.BaseTarget")}</span><strong>${targets.baseTarget}%</strong></div>${adjustments}${effective}${renderRollLine(roll.total)}</div>${renderRollResult(result, ranges)}</section>`,
    flags: { "mythras-foundry": { skillRoll: { actorUuid: actor.uuid, itemId: null,
      target: targets.target, criticalTarget: targets.criticalTarget, rolls: [roll.total] } } } };
  ChatMessage.applyRollMode?.(messageData, game.settings.get("core", "rollMode"));
  return ChatMessage.create(messageData);
}
