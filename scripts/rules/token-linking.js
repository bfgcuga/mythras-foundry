export function characterTokenLinkUpdates(tokens, actors) {
  return Array.from(tokens ?? []).filter((token) => {
    const actor = actors?.get?.(token.actorId);
    return actor?.type === "character" && !token.actorLink;
  }).map((token) => ({ _id: token.id, actorLink: true }));
}
