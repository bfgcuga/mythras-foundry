/**
 * Evaluate a Foundry roll and, when Dice So Nice is active, broadcast its 3D
 * animation. Use this for rolls which update an existing chat card (or do not
 * create a ChatMessage); rolls included in a newly-created message should rely
 * on that message's `rolls` collection instead.
 */
export { evaluateAnimatedSystemRoll as evaluateAnimatedRoll } from "./system-roll.js";

export function appendSerializedRolls(message, ...serializedRolls) {
  const additions = serializedRolls.filter(Boolean).map((data) => Roll.fromData(data));
  return [...Array.from(message?.rolls ?? []), ...additions];
}
