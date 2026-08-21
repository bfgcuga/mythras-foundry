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
  assert.match(script, /contestLuckContext\(game\.user, contest, button\.dataset\.participantId, \{ requirePoints: false \}\)\.spenders\.length/);
  assert.match(script, /sheet-icon-button mythras-chat-luck-button contest-luck-button/);
  assert.match(script, /contest-roll-attempt contest-roll-attempt--current/);
  assert.match(css, /\.contest-roll-attempts \{ display: grid/);
});

test("Luck spenders only need to be active-party participants", () => {
  const script = fs.readFileSync(new URL("../scripts/rules/contest-chat.js", import.meta.url), "utf8");
  assert.match(script, /getActiveParty\?\.\(\)/);
  assert.match(script, /actorIdentity\(contestActor\(participant\)\)/);
  assert.match(script, /return partyIds\.has\(identity\) && participantIds\.has\(identity\)/);
  assert.match(script, /participant\.actorUuid && globalThis\.fromUuidSync/);
  assert.match(script, /entry\.actorId === actorIdentity\(candidate\)/);
  assert.doesNotMatch(script, /playerOwned/);
  assert.match(script, /spenders\.length === 1/);
  assert.match(script, /type="hidden" name="luckActorId"/);
});

test("contest setup is limited to scene tokens and rivals choose their ability later", () => {
  const dialog = fs.readFileSync(new URL("../scripts/apps/skill-roll-dialog.js", import.meta.url), "utf8");
  assert.match(dialog, /canvas\?\.tokens\?\.placeables/);
  assert.doesNotMatch(dialog, /const seen = new Set\(\)/);
  assert.match(dialog, /actorId: actorIdentity\(actor\), actorUuid: actorReference\(actor\), actorName: actorLabel\(actor\)/);
  assert.match(dialog, /abilityId: null, abilityName: null, difficulty: null, target: null/);
  assert.match(dialog, /skill-roll-adjustment-fields/);
  assert.match(dialog, /<div class="skill-roll-participants" hidden>/);
  assert.match(dialog, /resolutionMode === "difficulty"[\s\S]*participants: \[\], valid: true/);
  assert.match(dialog, /ability\.type === item\.type && ability\.name === item\.name \? "selected"/);
  assert.match(dialog, /node\.hidden = !initiatorGroup/);
  assert.match(dialog, /abilityName: side === "opponent" \? null : ability\.name/);
});

test("opposed responses open adjustments while elimination accepts the first configured roller", () => {
  const script = fs.readFileSync(new URL("../scripts/rules/contest-chat.js", import.meta.url), "utf8");
  const dialog = fs.readFileSync(new URL("../scripts/apps/skill-roll-dialog.js", import.meta.url), "utf8");
  assert.match(script, /openContestResponseDialog\(actor, participant\.abilityId, participant\.config\?\.difficulty\)/);
  assert.match(script, /side\?\.mode === "elimination"/);
  assert.match(script, /side\.representativeId = participant\.id/);
  assert.match(script, /contestResponseQueues/);
  assert.match(dialog, /name="abilityId"/);
  assert.match(dialog, /name="difficulty"/);
  assert.match(dialog, /adjustment\("limited", "Limited"\)/);
  assert.match(dialog, /adjustment\("reinforced", "Reinforced"\)/);
});

test("configured contest cards separate sides and name multi-member team winners", () => {
  const script = fs.readFileSync(new URL("../scripts/rules/contest-chat.js", import.meta.url), "utf8");
  assert.match(script, /<section class="contest-side contest-side--\$\{name\}">/);
  assert.match(script, /side\.mode === "team" && side\.representativeRule !== "individual" && side\.participantIds\.length > 1/);
  assert.match(script, /MYTHRASF\.Contest\.Team\.\$\{sideName\}/);
  assert.match(script, /contestRollHolder\(contest, request\.participantId\)/);
  assert.match(script, /contest-team-captain/);
});

test("resolution and participation are configured as independent axes", () => {
  const dialog = fs.readFileSync(new URL("../scripts/apps/skill-roll-dialog.js", import.meta.url), "utf8");
  assert.match(dialog, /const RESOLUTION_MODES = \["difficulty", "opposed", "differential"\]/);
  assert.match(dialog, /const SIDE_MODES = \["individual", "team", "elimination"\]/);
  assert.match(dialog, /const TEAM_RULES = \["highest", "lowest", "designated", "individual"\]/);
  assert.match(dialog, /name="initiatorMode"/);
  assert.match(dialog, /name="opponentMode"/);
  assert.doesNotMatch(dialog, /inverseTeam/);
});
