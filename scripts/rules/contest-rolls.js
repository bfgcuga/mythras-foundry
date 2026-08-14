export const CONTEST_TYPES = Object.freeze({
  simple: "simple", opposed: "opposed", differential: "differential",
  team: "team", inverseTeam: "inverseTeam", elimination: "elimination"
});

export const CONTEST_GRADES = Object.freeze({
  fumble: 0, failure: 1, success: 2, critical: 3
});

export function classifyContestRoll(rawRoll, target) {
  const roll = Math.max(1, Math.min(100, Math.trunc(Number(rawRoll) || 1)));
  const effectiveTarget = Math.max(0, Number(target) || 0);
  const criticalTarget = Math.max(1, Math.ceil(effectiveTarget / 10));
  if (roll === 100 || (effectiveTarget <= 100 && roll === 99)) return "fumble";
  if (roll >= 96) return "failure";
  if (roll <= criticalTarget) return "critical";
  if (roll <= 5 || roll <= effectiveTarget) return "success";
  return "failure";
}

export function applySharedOver100Penalty(participants = []) {
  const maximum = Math.max(0, ...participants.map((entry) => Number(entry.target) || 0));
  const penalty = Math.max(0, maximum - 100);
  return {
    penalty,
    participants: participants.map((entry) => {
      const target = Math.max(0, (Number(entry.target) || 0) - penalty);
      const result = entry.rawRoll == null ? null : classifyContestRoll(entry.rawRoll, target);
      return { ...entry, targetBeforeContest: Number(entry.target) || 0, target,
        criticalTarget: Math.max(1, Math.ceil(target / 10)), result };
    })
  };
}

export function compareOpposed(protagonist, antagonist) {
  const protagonistGrade = CONTEST_GRADES[protagonist.result] ?? -1;
  const antagonistGrade = CONTEST_GRADES[antagonist.result] ?? -1;
  const protagonistSucceeded = protagonistGrade >= CONTEST_GRADES.success;
  const antagonistSucceeded = antagonistGrade >= CONTEST_GRADES.success;
  if (!protagonistSucceeded && !antagonistSucceeded) return { winnerId: null, reason: "mutualFailure", repeatable: true };
  if (protagonistGrade !== antagonistGrade) {
    return { winnerId: protagonistGrade > antagonistGrade ? protagonist.id : antagonist.id, reason: "grade", repeatable: false };
  }
  if (Number(protagonist.rawRoll) !== Number(antagonist.rawRoll)) {
    return { winnerId: Number(protagonist.rawRoll) > Number(antagonist.rawRoll) ? protagonist.id : antagonist.id,
      reason: "higherRoll", repeatable: false };
  }
  return { winnerId: null, reason: "exactTie", repeatable: true };
}

const DIFFERENTIAL = Object.freeze({
  critical: Object.freeze({ critical: 0, success: 1, failure: 2, fumble: 3 }),
  success: Object.freeze({ critical: -1, success: 0, failure: 1, fumble: 2 }),
  failure: Object.freeze({ critical: -2, success: -1, failure: 0, fumble: 0 }),
  fumble: Object.freeze({ critical: -3, success: -2, failure: 0, fumble: 0 })
});

export function differentialAdvantage(protagonistResult, antagonistResult) {
  return DIFFERENTIAL[protagonistResult]?.[antagonistResult] ?? 0;
}

export function selectTeamRepresentative(participants, { inverse = false, designatedId = null } = {}) {
  if (designatedId) return participants.find((entry) => entry.id === designatedId) ?? null;
  return participants.reduce((selected, entry) => {
    if (!selected) return entry;
    return inverse
      ? (Number(entry.target) < Number(selected.target) ? entry : selected)
      : (Number(entry.target) > Number(selected.target) ? entry : selected);
  }, null);
}

export function resolveContest({ type, participants = [], initiatorId, designatedId = null } = {}) {
  const adjusted = applySharedOver100Penalty(participants);
  const entries = adjusted.participants;
  if (type === CONTEST_TYPES.opposed || type === CONTEST_TYPES.differential) {
    const protagonist = entries.find((entry) => entry.id === initiatorId);
    const comparisons = entries.filter((entry) => entry.id !== initiatorId).map((antagonist) => ({
      antagonistId: antagonist.id,
      ...(type === CONTEST_TYPES.opposed
        ? compareOpposed(protagonist, antagonist)
        : { advantage: differentialAdvantage(protagonist.result, antagonist.result) })
    }));
    return { type, penalty: adjusted.penalty, participants: entries, comparisons };
  }
  const representative = selectTeamRepresentative(entries, {
    inverse: type === CONTEST_TYPES.inverseTeam,
    designatedId: type === CONTEST_TYPES.elimination ? designatedId : null
  });
  const commonRoll = representative?.rawRoll ?? entries.find((entry) => entry.rawRoll != null)?.rawRoll;
  const resolved = entries.map((entry) => ({ ...entry, rawRoll: commonRoll,
    result: commonRoll == null ? null : classifyContestRoll(commonRoll, entry.target) }));
  if (type === CONTEST_TYPES.elimination) {
    return { type, penalty: adjusted.penalty, representativeId: representative?.id ?? null,
      commonRoll, participants: resolved,
      continuingIds: resolved.filter((entry) => ["critical", "success"].includes(entry.result)).map((entry) => entry.id),
      eliminatedIds: resolved.filter((entry) => ["failure", "fumble"].includes(entry.result)).map((entry) => entry.id) };
  }
  const representativeResult = resolved.find((entry) => entry.id === representative?.id)?.result ?? null;
  return { type, penalty: adjusted.penalty, representativeId: representative?.id ?? null,
    commonRoll, result: representativeResult, participants: resolved };
}

export function resolveConfiguredContest({ resolutionMode = "difficulty", sides = {}, participants = [] } = {}) {
  const adjusted = applySharedOver100Penalty(participants);
  const byId = new Map(adjusted.participants.map((entry) => [entry.id, entry]));
  const initiator = resolveContestSide(sides.initiator, byId);
  const opponent = resolutionMode === "difficulty" ? null : resolveContestSide(sides.opponent, byId);
  const comparisons = [];
  if (opponent) {
    for (const protagonist of initiator.contenders) {
      for (const antagonist of opponent.contenders) {
        comparisons.push({ protagonistId: protagonist.id, antagonistId: antagonist.id,
          ...(resolutionMode === "differential"
            ? { advantage: differentialAdvantage(protagonist.result, antagonist.result) }
            : compareOpposed(protagonist, antagonist)) });
      }
    }
  }
  return { resolutionMode, penalty: adjusted.penalty, participants: adjusted.participants,
    sides: { initiator, opponent }, comparisons };
}

function resolveContestSide(side = {}, byId) {
  const members = (side.participantIds ?? []).map((id) => byId.get(id)).filter(Boolean);
  const mode = side.mode ?? "individual";
  if (mode === "individual") {
    const participant = members[0] ?? null;
    return { mode, participantIds: members.map((entry) => entry.id), representativeId: participant?.id ?? null,
      commonRoll: null, result: members.length === 1 ? participant?.result ?? null : null,
      contenders: members, memberResults: members,
      continuingIds: members.filter((entry) => successful(entry.result)).map((entry) => entry.id), eliminatedIds: [] };
  }
  if (mode === "team" && side.representativeRule === "individual") {
    return { mode, representativeRule: "individual", participantIds: members.map((entry) => entry.id),
      representativeId: null, commonRoll: null, result: null, contenders: members, memberResults: members,
      continuingIds: members.filter((entry) => successful(entry.result)).map((entry) => entry.id),
      eliminatedIds: members.filter((entry) => entry.result && !successful(entry.result)).map((entry) => entry.id) };
  }
  const representative = selectSideRepresentative(members, side);
  const commonRoll = representative?.rawRoll ?? members.find((entry) => entry.rawRoll != null)?.rawRoll ?? null;
  if (mode === "team") {
    const result = commonRoll == null || !representative ? null : classifyContestRoll(commonRoll, representative.target);
    const contender = representative ? { ...representative, rawRoll: commonRoll, result } : null;
    return { mode, participantIds: members.map((entry) => entry.id), representativeId: representative?.id ?? null,
      commonRoll, result, contenders: contender ? [contender] : [],
      memberResults: members.map((entry) => ({ ...entry, rawRoll: commonRoll, result })),
      continuingIds: result && successful(result) ? members.map((entry) => entry.id) : [], eliminatedIds: result && !successful(result) ? members.map((entry) => entry.id) : [] };
  }
  const evaluated = members.map((entry) => ({ ...entry, rawRoll: commonRoll,
    result: commonRoll == null ? null : classifyContestRoll(commonRoll, entry.target) }));
  return { mode, participantIds: members.map((entry) => entry.id), representativeId: representative?.id ?? null,
    commonRoll, result: null, contenders: evaluated.filter((entry) => successful(entry.result)), memberResults: evaluated,
    continuingIds: evaluated.filter((entry) => successful(entry.result)).map((entry) => entry.id),
    eliminatedIds: evaluated.filter((entry) => entry.result && !successful(entry.result)).map((entry) => entry.id) };
}

function selectSideRepresentative(members, side) {
  if (side.representativeRule === "designated" || side.mode === "elimination") {
    return members.find((entry) => entry.id === side.designatedId) ?? members[0] ?? null;
  }
  return selectTeamRepresentative(members, { inverse: side.representativeRule === "lowest" });
}

function successful(result) {
  return result === "success" || result === "critical";
}
