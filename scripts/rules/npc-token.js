import { materializeNpc, NpcGenerationError, shouldGenerateNpcToken } from "./npc-generation.js";

export async function evaluateNpcFormula(formula) {
  if (typeof Roll.validate === "function" && !Roll.validate(formula)) {
    throw new Error(game.i18n.localize("MYTHRASF.Npc.InvalidFormula"));
  }
  const roll = await new Roll(formula).evaluate();
  return roll.total;
}

export async function prepareNpcToken(token) {
  const actor = game.actors.get(token.actorId);
  if (!actor || !shouldGenerateNpcToken({ actorType: actor.type,
    actorLink: token.actorLink || token.isLinked })) return false;
  try {
    const generated = await materializeNpc(actor.toObject(), evaluateNpcFormula);
    generated.system.generatedInstance = true;
    const delta = { system: generated.system, items: generated.items };
    if (token.delta) token.delta.updateSource(delta);
    else token.updateSource({ delta });
    return true;
  } catch (error) {
    notifyGenerationError(error);
    return false;
  }
}

export async function regenerateNpcActor(actor) {
  if (!game.user.isGM || actor?.type !== "npc" || !actor.isToken || actor.token?.isLinked) {
    return false;
  }
  try {
    const generated = await materializeNpc(actor.toObject(), evaluateNpcFormula);
    generated.system.generatedInstance = true;
    await actor.update({ system: generated.system });
    const updates = generated.items.map((item) => ({ ...item, _id: item._id ?? item.id }));
    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
    ui.notifications.info(game.i18n.localize("MYTHRASF.Npc.Regenerated"));
    return true;
  } catch (error) {
    notifyGenerationError(error);
    return false;
  }
}

function notifyGenerationError(error) {
  const details = error instanceof NpcGenerationError
    ? error.failures.map((failure) => `${failure.label}: ${failure.message}`).join("; ")
    : error?.message ?? String(error);
  console.error("Mythras Foundry | NPC generation failed", error);
  ui.notifications.warn(game.i18n.format("MYTHRASF.Npc.GenerationFailed", { details }));
}
