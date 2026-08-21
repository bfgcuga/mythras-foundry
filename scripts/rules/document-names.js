export function sourceActor(actor) {
  if (!actor) return null;
  return game.actors?.get(actor.token?.actorId ?? actor.id) ?? actor;
}

export function actorDisplayName(actor) {
  if (!actor) return "";
  if (actor.type === "character") return sourceActor(actor)?.name ?? actor.name ?? "";
  if (!actor.isToken) return actor.name ?? "";
  const sourceName = sourceActor(actor)?.name;
  if (actor.name && actor.name !== sourceName) return actor.name;
  return actor.token?.name ?? actor.name ?? "";
}

export function tokenDisplayName(token) {
  if (!token) return "";
  if (token.actor?.type === "character") return actorDisplayName(token.actor);
  const actorName = token.actor?.name;
  if (token.actor?.isToken && actorName && actorName !== sourceActor(token.actor)?.name) {
    return actorName;
  }
  return token.document?._source?.name ?? token._source?.name
    ?? token.document?.name ?? token.name ?? actorDisplayName(token.actor);
}

export function actorSpeaker(actor) {
  return { ...ChatMessage.getSpeaker({ actor }), alias: actorDisplayName(actor) };
}

export async function updateActorFromSheet(actor, changes) {
  const updatesName = Object.prototype.hasOwnProperty.call(changes ?? {}, "name");
  const token = actor.isToken && !actor.token?.isLinked ? actor.token : null;
  const requestedName = updatesName ? String(changes.name ?? "") : null;
  await actor.update(changes);
  if (token && requestedName !== null) await token.update({ name: requestedName });
}
