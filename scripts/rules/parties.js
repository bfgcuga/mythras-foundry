export const PARTY_CONFIG_VERSION = 1;

export function normalizePartyConfig(value = {}) {
  const parties = [];
  const seenIds = new Set();
  for (const candidate of Array.isArray(value?.parties) ? value.parties : []) {
    const id = String(candidate?.id ?? "").trim();
    const name = String(candidate?.name ?? "").trim();
    if (!id || !name || seenIds.has(id)) continue;
    seenIds.add(id);
    parties.push({
      id,
      name,
      memberIds: [...new Set((Array.isArray(candidate.memberIds) ? candidate.memberIds : [])
        .map((memberId) => String(memberId ?? "").trim()).filter(Boolean))]
    });
  }
  const requestedActiveId = String(value?.activePartyId ?? "").trim();
  return {
    version: PARTY_CONFIG_VERSION,
    activePartyId: seenIds.has(requestedActiveId) ? requestedActiveId : (parties[0]?.id ?? ""),
    parties
  };
}

export function sanitizePartyConfig(value, actors = []) {
  const config = normalizePartyConfig(value);
  const characterIds = new Set(actors
    .filter((actor) => actor?.type === "character")
    .map((actor) => actor.id));
  return {
    ...config,
    parties: config.parties.map((party) => ({
      ...party,
      memberIds: party.memberIds.filter((id) => characterIds.has(id))
    }))
  };
}

export function removeParty(value, partyId) {
  const config = normalizePartyConfig(value);
  const parties = config.parties.filter((party) => party.id !== partyId);
  return normalizePartyConfig({
    ...config,
    activePartyId: config.activePartyId === partyId ? (parties[0]?.id ?? "")
      : config.activePartyId,
    parties
  });
}
