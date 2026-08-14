import test from "node:test";
import assert from "node:assert/strict";
import { applySharedOver100Penalty, compareOpposed, differentialAdvantage,
  resolveContest, selectTeamRepresentative } from "../scripts/rules/contest-rolls.js";

test("opposed rolls prefer grade, then the higher successful roll", () => {
  assert.equal(compareOpposed({ id: "a", result: "critical", rawRoll: 4 }, { id: "b", result: "success", rawRoll: 70 }).winnerId, "a");
  assert.equal(compareOpposed({ id: "a", result: "success", rawRoll: 35 }, { id: "b", result: "success", rawRoll: 62 }).winnerId, "b");
});

test("a Luck reroll that becomes critical is recalculated above a higher success", () => {
  const result = resolveContest({ type: "opposed", initiatorId: "hero", participants: [
    { id: "hero", target: 25, rawRoll: 1 }, { id: "ant", target: 53, rawRoll: 15 }
  ] });
  assert.equal(result.participants.find((entry) => entry.id === "hero").result, "critical");
  assert.equal(result.participants.find((entry) => entry.id === "ant").result, "success");
  assert.equal(result.comparisons[0].winnerId, "hero");
  assert.equal(result.comparisons[0].reason, "grade");
});

test("mutual failure and exact ties can start a new round", () => {
  assert.equal(compareOpposed({ id: "a", result: "failure", rawRoll: 80 }, { id: "b", result: "fumble", rawRoll: 100 }).reason, "mutualFailure");
  assert.equal(compareOpposed({ id: "a", result: "success", rawRoll: 40 }, { id: "b", result: "success", rawRoll: 40 }).reason, "exactTie");
});

test("the complete differential matrix follows the Mythras table", () => {
  const grades = ["critical", "success", "failure", "fumble"];
  const expected = [[0, 1, 2, 3], [-1, 0, 1, 2], [-2, -1, 0, 0], [-3, -2, 0, 0]];
  grades.forEach((left, row) => grades.forEach((right, column) =>
    assert.equal(differentialAdvantage(left, right), expected[row][column])));
});

test("the highest excess over 100 is subtracted from everybody", () => {
  const result = applySharedOver100Penalty([{ id: "a", target: 130, rawRoll: 90 }, { id: "b", target: 85, rawRoll: 60 }]);
  assert.equal(result.penalty, 30);
  assert.deepEqual(result.participants.map((entry) => entry.target), [100, 55]);
});

test("each opponent is compared independently", () => {
  const result = resolveContest({ type: "opposed", initiatorId: "a", participants: [
    { id: "a", target: 70, rawRoll: 50 }, { id: "b", target: 50, rawRoll: 40 }, { id: "c", target: 50, rawRoll: 80 }
  ] });
  assert.equal(result.comparisons.length, 2);
  assert.equal(result.comparisons[0].winnerId, "a");
  assert.equal(result.comparisons[1].winnerId, "a");
});

test("team representatives support highest, lowest and designated", () => {
  const members = [{ id: "a", target: 40 }, { id: "b", target: 80 }];
  assert.equal(selectTeamRepresentative(members).id, "b");
  assert.equal(selectTeamRepresentative(members, { inverse: true }).id, "a");
  assert.equal(selectTeamRepresentative(members, { designatedId: "a" }).id, "a");
});

test("elimination applies one die to every individual target", () => {
  const result = resolveContest({ type: "elimination", designatedId: "a", participants: [
    { id: "a", target: 70, rawRoll: 55 }, { id: "b", target: 40 }, { id: "c", target: 60 }
  ] });
  assert.equal(result.commonRoll, 55);
  assert.deepEqual(result.continuingIds, ["a", "c"]);
  assert.deepEqual(result.eliminatedIds, ["b"]);
});
