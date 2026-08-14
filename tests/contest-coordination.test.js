import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { preferredContestCoordinator, validateContestResponse } from "../scripts/rules/contest-chat.js";

const contest = () => ({ status: "pending", revision: 2, participants: [{ id: "p1", pending: true }] });

test("an active GM coordinates before the author, with author fallback", () => {
  assert.equal(preferredContestCoordinator([{ id: "author", active: true }, { id: "gm", active: true, isGM: true }], "author"), "gm");
  assert.equal(preferredContestCoordinator([{ id: "author", active: true }, { id: "gm", active: false, isGM: true }], "author"), "author");
});

test("response validation rejects ownership, duplicates and stale revisions", () => {
  const user = { id: "u1", isGM: false }; const actor = { testUserPermission: () => true };
  assert.equal(validateContestResponse(contest(), { revision: 2, participantId: "p1", userId: "u1" }, { actor, user }), null);
  assert.equal(validateContestResponse(contest(), { revision: 1, participantId: "p1", userId: "u1" }, { actor, user }), "revision");
  const answered = contest(); answered.participants[0].pending = false;
  assert.equal(validateContestResponse(answered, { revision: 2, participantId: "p1", userId: "u1" }, { actor, user }), "duplicate");
  assert.equal(validateContestResponse(contest(), { revision: 2, participantId: "p1", userId: "u1" }, { actor: { testUserPermission: () => false }, user }), "ownership");
});

test("contest UI uses the shared card, pending state and ownership visibility", () => {
  const script = fs.readFileSync(new URL("../scripts/rules/contest-chat.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../styles/mythras-foundry.css", import.meta.url), "utf8");
  assert.match(script, /mythras-chat-card mythras-contest-card/);
  assert.match(script, /MYTHRASF\.Contest\.Pending/);
  assert.match(script, /button\.hidden = !game\.user\.isGM && !actor\?\.isOwner/);
  assert.match(css, /\.mythras-contest-card/);
  assert.match(script, /preferredContestCoordinator\(game\.users, contest\.authorUserId\) === game\.user\.id/);
  assert.match(script, /contest-luck-button/);
});

test("contest setup is limited to scene tokens and rivals choose their ability later", () => {
  const dialog = fs.readFileSync(new URL("../scripts/apps/skill-roll-dialog.js", import.meta.url), "utf8");
  assert.match(dialog, /canvas\?\.tokens\?\.placeables/);
  assert.match(dialog, /if \(!groupType\) return actor \? \{ actorId: actor\.id, actorName: actor\.name,/);
  assert.match(dialog, /abilityId: null, abilityName: null, difficulty: null, target: null/);
  assert.match(dialog, /skill-roll-adjustment-fields/);
});
