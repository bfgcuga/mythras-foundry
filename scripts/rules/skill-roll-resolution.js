import { actorConditionState, actorLoadState, resolveActorConditions
} from "./actor-conditions.js";
import { conditionLevel } from "./condition-resolver.js";
import { skillUsesStrengthOrDexterity } from "./encumbrance.js";

const defaultLocalize = (key) => game.i18n.localize(key);
const defaultFormat = (key, data) => game.i18n.format(key, data);

export function resolveSkillRollConditions(actor, item, { woundImpact = {},
  baseDifficulty = "standard", loadState = actorLoadState(actor),
  localize = defaultLocalize, format = defaultFormat } = {}) {
  const physical = skillUsesStrengthOrDexterity(item);
  const state = actorConditionState(actor, { loadState });
  const resolution = resolveActorConditions(actor, { baseDifficulty, physical,
    situational: Boolean(woundImpact.seriousPenalty), loadState });
  const modifiers = [];

  const fatigue = conditionLevel(state.fatigueKey);
  if (fatigue.key !== "fresh") modifiers.push({
    source: format("MYTHRASF.SkillRoll.FatigueSource", {
      level: localize(`MYTHRASF.Fatigue.Level.${state.fatigueKey}`)
    }),
    effect: localize(`MYTHRASF.Difficulty.${fatigue.skillDifficulty}`),
    type: "penalty"
  });
  if (state.woundLevel === "major") modifiers.push({
    source: localize("MYTHRASF.Wound.major"),
    effect: localize("MYTHRASF.Difficulty.herculean"), type: "penalty"
  });
  if (state.manuallyIncapacitated) modifiers.push({
    source: localize("MYTHRASF.Status.IncapacitatedManual"),
    effect: localize("MYTHRASF.Difficulty.herculean"), type: "penalty"
  });
  for (const status of state.statuses.filter((entry) => entry.skillDifficulty)) {
    modifiers.push({ source: localize(status.name),
      effect: localize(`MYTHRASF.Difficulty.${status.skillDifficulty}`), type: "penalty" });
  }
  if (physical && Number(loadState.difficultySteps ?? 0) > 0) modifiers.push({
    source: localize("MYTHRASF.SkillRoll.EncumbranceSource"),
    effect: localize(`MYTHRASF.Encumbrance.Penalty.${loadState.key}`), type: "penalty"
  });
  if (woundImpact.seriousPenalty) modifiers.push({
    source: localize("MYTHRASF.Wound.serious"),
    effect: localize("MYTHRASF.SkillRoll.OneDifficultyStep"), type: "penalty"
  });
  if (woundImpact.unusableMember) modifiers.push({
    source: localize("MYTHRASF.Wound.UnusableMember"),
    effect: localize("MYTHRASF.Fatigue.NoActivity"), type: "penalty"
  });

  return Object.freeze({ difficulty: woundImpact.unusableMember
    ? "impossible" : resolution.difficulty, modifiers: Object.freeze(modifiers),
  physical, resolution });
}
