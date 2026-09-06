import { wornArmorPoints } from "./armor.js";

export function bypassArmorProtection(location, armors, selections = []) {
  const natural = Math.max(0, Number(location?.system?.armorPoints ?? 0));
  const worn = wornArmorPoints(location, armors);
  const effects = selections.filter((effect) => !effect.waived && effect.ruleKey === "bypassArmor");
  const available = ["natural", "worn"].filter((key) => (key === "natural" ? natural : worn) > 0);
  const preferred = effects[0]?.parameters?.armorType;
  const ignored = effects.length >= available.length && effects.length > 0 ? available
    : effects.length ? [available.includes(preferred) ? preferred : available.includes("worn") ? "worn" : "natural"] : [];
  return { natural, worn, ignored,
    effective: (ignored.includes("natural") ? 0 : natural) + (ignored.includes("worn") ? 0 : worn) };
}

export async function chooseBypassArmor(actor, selections, { Dialog, localize, escape }) {
  const effects = selections.filter((effect) => !effect.waived && effect.ruleKey === "bypassArmor");
  if (!effects.length) return true;
  const armors = actor?.items?.filter((item) => item.type === "armor") ?? [];
  const locations = actor?.items?.filter((item) => item.type === "hitLocation") ?? [];
  const both = locations.some((location) => {
    const protection = bypassArmorProtection(location, armors);
    return protection.natural > 0 && protection.worn > 0;
  });
  if (effects.length >= 2 || !both) return true;
  const choice = await Dialog.wait({
    window: { title: localize("MYTHRASF.Combat.BypassArmor.Title") },
    content: `<div class="mythras-foundry mythras-dialog"><fieldset><legend>${escape(localize(
      "MYTHRASF.Combat.BypassArmor.Title"))}</legend><label><span>${escape(localize(
      "MYTHRASF.Combat.BypassArmor.Type"))}</span><select name="armorType">
      <option value="worn">${escape(localize("MYTHRASF.Combat.BypassArmor.worn"))}</option>
      <option value="natural">${escape(localize("MYTHRASF.Combat.BypassArmor.natural"))}</option>
      </select></label></fieldset></div>`,
    buttons: [{ action: "confirm", default: true, label: localize("MYTHRASF.CombatEffect.ConfirmSelection"),
      callback: (event, button) => button.form.elements.armorType.value },
    { action: "cancel", label: localize("MYTHRASF.Cancel"), callback: () => null }],
    rejectClose: false
  });
  if (!["natural", "worn"].includes(choice)) return false;
  effects[0].parameters = { ...effects[0].parameters, armorType: choice };
  return true;
}
