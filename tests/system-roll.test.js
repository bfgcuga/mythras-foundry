import test from "node:test";
import assert from "node:assert/strict";
import { createManualRoll, diceRequirements, manualRollRequested,
  validateManualDice } from "../scripts/rules/system-roll.js";

test("manual roll gesture is exclusive to a shifted Gamemaster action", () => {
  assert.equal(manualRollRequested({ shiftKey: true }, { isGM: true }), true);
  assert.equal(manualRollRequested({ shiftKey: false }, { isGM: true }), false);
  assert.equal(manualRollRequested({ shiftKey: true }, { isGM: false }), false);
});

test("die requirements preserve every physical die in mixed formulas", () => {
  assert.deepEqual(diceRequirements("1d100"), [{ number: 1, faces: 100 }]);
  assert.deepEqual(diceRequirements("4d6"), [{ number: 4, faces: 6 }]);
  assert.deepEqual(diceRequirements("1d20+2"), [{ number: 1, faces: 20 }]);
  assert.deepEqual(diceRequirements("1d8+1d4-1"), [
    { number: 1, faces: 8 }, { number: 1, faces: 4 }
  ]);
});

test("manual die validation requires integers within each die range", () => {
  const dice = [{ number: 2, faces: 6 }, { number: 1, faces: 4 }];
  assert.equal(validateManualDice(dice, [1, 6, 4]), true);
  for (const values of [[], [1, 6], [0, 6, 4], [1, 7, 4], [1, 6, 4.5], [1, 6, NaN]]) {
    assert.equal(validateManualDice(dice, values), false);
  }
});

test("a manual roll has normal evaluated dice and no disclosure metadata", () => {
  const OriginalRoll = globalThis.Roll;
  class FakeRoll {
    constructor(formula) {
      this.formula = formula;
      this.dice = diceRequirements(formula).map(({ number, faces }) => ({ number, faces }));
    }
    _evaluateTotal() {
      const dice = this.dice.flatMap((die) => die.results.map((result) => result.result));
      return dice[0] + dice[1] - 1;
    }
    toJSON() {
      return { formula: this.formula, total: this._total, evaluated: this._evaluated,
        dice: this.dice };
    }
  }
  globalThis.Roll = FakeRoll;
  try {
    const roll = createManualRoll("1d8+1d4-1", [7, 3]);
    assert.equal(roll.total ?? roll._total, 9);
    assert.equal(roll._evaluated, true);
    assert.deepEqual(roll.dice.map((die) => die.results[0].result), [7, 3]);
    assert.doesNotMatch(JSON.stringify(roll.toJSON()), /manual|chosen|edited/i);
  } finally { globalThis.Roll = OriginalRoll; }
});
