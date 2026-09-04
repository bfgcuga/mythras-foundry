const COMBAT_SOCKET_ACTIONS = Object.freeze([
  "combatDefense", "combatLuck", "combatEffects", "combatRuseReplacement", "combatDamage", "combatDamageLuck",
  "combatApplyDamage", "combatCheck", "combatWoundLuck",
  "combatDropHeldItem", "combatDisarmChoice"
]);

export function registerCombatSocketRuntime({ socket, messages, users, currentUserId,
  coordinator, handlers, flagScope = "mythras-foundry" }) {
  socket.on(`system.${flagScope}`, async (request) => {
    if (!COMBAT_SOCKET_ACTIONS.includes(request?.action)) return;
    const message = messages.get(request.messageId);
    const combat = message?.getFlag(flagScope, "combat");
    if (!combat || coordinator(users, combat.authorUserId) !== currentUserId) return;
    const handler = handlers[request.action];
    if (handler) await handler(message, request);
  });
}
