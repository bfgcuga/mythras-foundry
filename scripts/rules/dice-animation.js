/**
 * Evaluate a Foundry roll and, when Dice So Nice is active, broadcast its 3D
 * animation. Use this for rolls which update an existing chat card (or do not
 * create a ChatMessage); rolls included in a newly-created message should rely
 * on that message's `rolls` collection instead.
 */
export async function evaluateAnimatedRoll(formula) {
  const roll = await new Roll(formula).evaluate();
  const dice3d = game.dice3d;
  if (typeof dice3d?.showForRoll !== "function") return roll;

  const visibility = {};
  ChatMessage.applyRollMode?.(visibility, game.settings.get("core", "rollMode"));
  try {
    await dice3d.showForRoll(
      roll,
      game.user,
      true,
      visibility.whisper ?? null,
      Boolean(visibility.blind)
    );
  } catch (error) {
    console.warn("Mythras Foundry | Dice So Nice animation failed", error);
  }
  return roll;
}
