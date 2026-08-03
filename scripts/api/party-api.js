import { normalizePartyConfig } from "../rules/parties.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createPartyApi({ getConfig, getActors, openManager = null }) {
  const config = () => normalizePartyConfig(getConfig());
  const getParty = (id) => {
    const party = config().parties.find((candidate) => candidate.id === id);
    return party ? clone(party) : null;
  };
  const getMembers = (id) => {
    const party = config().parties.find((candidate) => candidate.id === id);
    if (!party) return [];
    const actors = getActors();
    return party.memberIds
      .map((actorId) => actors.get(actorId))
      .filter((actor) => actor?.type === "character");
  };

  return Object.freeze({
    get parties() {
      return clone(config().parties);
    },
    getActiveParty() {
      const current = config();
      const party = current.parties.find((candidate) => candidate.id === current.activePartyId);
      return party ? clone(party) : null;
    },
    getActiveMembers() {
      const current = config();
      return getMembers(current.activePartyId);
    },
    openManager() {
      return openManager?.() ?? null;
    },
    getParty,
    getMembers
  });
}
