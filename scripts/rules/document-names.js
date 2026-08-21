export function sourceActor(actor) {
  if (!actor) return null;
  return game.actors?.get(actor.token?.actorId ?? actor.id) ?? actor;
}

export function actorDisplayName(actor) {
  if (!actor) return "";
  if (actor.type === "character") return sourceActor(actor)?.name ?? actor.name ?? "";
  return actor.isToken ? actor.token?.name ?? actor.name ?? "" : actor.name ?? "";
}

export function tokenDisplayName(token) {
  if (!token) return "";
  if (token.actor?.type === "character") return actorDisplayName(token.actor);
  return token.document?.name ?? token.name ?? actorDisplayName(token.actor);
}

export function actorSpeaker(actor) {
  return { ...ChatMessage.getSpeaker({ actor }), alias: actorDisplayName(actor) };
}
