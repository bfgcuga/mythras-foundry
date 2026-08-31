const CANCELLED = Symbol("manual-roll-cancelled");

export class ManualRollCancelledError extends Error {
  constructor() {
    super("Manual roll cancelled");
    this.name = "ManualRollCancelledError";
  }
}

export async function runSystemRollAction(action) {
  try { return await action(); }
  catch (error) {
    if (error instanceof ManualRollCancelledError) return null;
    throw error;
  }
}

export function manualRollRequested(source = null, user = globalThis.game?.user) {
  const keyboard = globalThis.game?.keyboard;
  const held = keyboard?.downKeys?.has?.("ShiftLeft") || keyboard?.downKeys?.has?.("ShiftRight")
    || keyboard?.isModifierActive?.("Shift");
  const shifted = typeof source === "boolean" ? source : Boolean(source?.shiftKey ?? held);
  return Boolean(user?.isGM && shifted);
}

export function diceRequirements(formula) {
  const requirements = [];
  const expression = String(formula ?? "");
  const pattern = /(^|[^\w])(?:(\d+)\s*)?d(\d+)/gi;
  let match;
  while ((match = pattern.exec(expression))) {
    const number = Number(match[2] ?? 1);
    const faces = Number(match[3]);
    if (!Number.isInteger(number) || number < 1 || !Number.isInteger(faces) || faces < 2) continue;
    requirements.push({ number, faces });
  }
  return requirements;
}

export function validateManualDice(requirements, values) {
  const flat = Array.from(values ?? []);
  const expected = requirements.reduce((count, die) => count + die.number, 0);
  if (flat.length !== expected) return false;
  let index = 0;
  for (const requirement of requirements) {
    for (let die = 0; die < requirement.number; die += 1) {
      const value = Number(flat[index]);
      if (!Number.isInteger(value) || value < 1 || value > requirement.faces) return false;
      index += 1;
    }
  }
  return true;
}

function escape(value) {
  return globalThis.foundry?.utils?.escapeHTML?.(String(value)) ?? String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function dialogContent(formula, requirements) {
  let index = 0;
  const groups = requirements.map(({ number, faces }) => {
    const inputs = Array.from({ length: number }, (_, offset) => {
      const label = game.i18n.format("MYTHRASF.ManualRoll.DieLabel", {
        die: offset + 1, faces
      });
      const input = `<label><span>${escape(label)}</span><input class="sheet-field-editable"
        type="number" name="die-${index++}" min="1" max="${faces}" step="1"
        required aria-label="${escape(label)}"></label>`;
      return input;
    }).join("");
    return `<fieldset><legend>${escape(`${number}d${faces}`)}</legend><div class="manual-roll-dice">${inputs}</div></fieldset>`;
  }).join("");
  return `<div class="mythras-foundry mythras-dialog manual-roll-dialog">
    <p>${escape(game.i18n.format("MYTHRASF.ManualRoll.Formula", { formula }))}</p>
    ${groups}<p class="manual-roll-error" role="alert" hidden>${escape(game.i18n.localize("MYTHRASF.ManualRoll.Invalid"))}</p>
  </div>`;
}

export async function requestManualDice(formula, requirements = diceRequirements(formula)) {
  if (!requirements.length) return [];
  const { DialogV2 } = foundry.applications.api;
  const result = await DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.ManualRoll.Title") },
    content: dialogContent(formula, requirements),
    buttons: [{
      action: "roll",
      label: game.i18n.localize("MYTHRASF.ManualRoll.Accept"),
      icon: "fas fa-check",
      default: true,
      callback: (event, button) => {
        const inputs = Array.from(button.form.querySelectorAll("input[name^='die-']"));
        const values = inputs.map((input) => input.value === "" ? NaN : Number(input.value));
        const valid = validateManualDice(requirements, values);
        for (const input of inputs) {
          const value = input.value === "" ? NaN : Number(input.value);
          input.setCustomValidity(Number.isInteger(value) && value >= Number(input.min)
            && value <= Number(input.max) ? "" : game.i18n.localize("MYTHRASF.ManualRoll.Invalid"));
        }
        button.form.querySelector(".manual-roll-error")?.toggleAttribute("hidden", valid);
        if (!valid) {
          inputs.find((input) => !input.checkValidity())?.reportValidity();
          return false;
        }
        return values;
      }
    }, {
      action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), icon: "fas fa-times",
      callback: () => CANCELLED
    }],
    rejectClose: false
  });
  if (result === CANCELLED || result == null || result === false) throw new ManualRollCancelledError();
  return result;
}

export function createManualRoll(formula, values) {
  const roll = new Roll(formula);
  const dice = Array.from(roll.dice ?? []);
  const requirements = dice.map((die) => ({ number: die.number, faces: die.faces }));
  if (!validateManualDice(requirements, values)) throw new RangeError("Invalid manual die result");
  let index = 0;
  for (const die of dice) {
    die.results = Array.from({ length: die.number }, () => ({ result: Number(values[index++]), active: true }));
    die._evaluated = true;
  }
  roll._evaluated = true;
  roll._total = roll._evaluateTotal();
  return roll;
}

export async function evaluateSystemRoll(formula, { event = false, manual = false } = {}) {
  if (!manualRollRequested(Boolean(manual) || Boolean(event?.shiftKey))) {
    return new Roll(formula).evaluate();
  }
  const values = await requestManualDice(formula);
  return createManualRoll(formula, values);
}

async function animateRoll(roll) {
  const dice3d = game.dice3d;
  if (typeof dice3d?.showForRoll !== "function") return;
  const visibility = {};
  ChatMessage.applyRollMode?.(visibility, game.settings.get("core", "rollMode"));
  try {
    await dice3d.showForRoll(roll, game.user, true, visibility.whisper ?? null,
      Boolean(visibility.blind));
  } catch (error) {
    console.warn("Mythras Foundry | Dice So Nice animation failed", error);
  }
}

export async function evaluateAnimatedSystemRoll(formula, options = {}) {
  const roll = await evaluateSystemRoll(formula, options);
  await animateRoll(roll);
  return roll;
}

export function createDiceApi() {
  return Object.freeze({
    roll: evaluateSystemRoll,
    animatedRoll: evaluateAnimatedSystemRoll,
    isManualGesture: (event) => manualRollRequested(event)
  });
}
