import { totalArmorPoints, wornArmorPoints } from "../rules/armor.js";
import { combatantForActor, tacticalState } from "../rules/engagement-runtime.js";

export function prepareHitLocationTable({ actor, armor = [], combat = null,
  armorPointLabel = "PA" } = {}) {
  const locations = Array.from(actor?.items ?? []).filter((item) => item.type === "hitLocation")
    .sort((left, right) => Number(left.system.rangeStart) - Number(right.system.rangeStart));
  const equippedArmor = armor.filter((item) => item.system.equipped);
  const combatant = combatantForActor(combat, actor, actor?.token?.uuid);
  const block = combatant ? tacticalState(combat).passiveBlocks?.[combatant.id] : null;
  const blockedIds = new Set(block?.status === "active"
    && Number(block.round) === Number(combat?.round) ? block.locationIds : []);
  return {
    hasNaturalArmor: locations.some((item) => Number(item.system.armorPoints ?? 0) > 0),
    rows: locations.map((item) => ({
      item,
      naturalArmor: Number(item.system.armorPoints ?? 0),
      wornArmor: wornArmorPoints(item, equippedArmor),
      totalArmor: totalArmorPoints(item, equippedArmor),
      armorOptions: armor.filter((piece) =>
        (piece.system.coveredLocationIds ?? []).includes(item.id))
        .map((piece) => ({ value: piece.id,
          label: `${piece.name} (${Number(piece.system.armorPoints ?? 0)} ${armorPointLabel})` })),
      equippedArmorId: equippedArmor.find((piece) =>
        (piece.system.coveredLocationIds ?? []).includes(item.id))?.id ?? "",
      showDisabledControl: item.system.woundLevel === "serious",
      disabled: item.system.woundLevel === "major" || Boolean(item.system.disabled),
      crippled: Number(item.system.permanentWound?.severity ?? 0) > 0,
      permanentWound: item.system.permanentWound,
      maximumDisplay: {
        base: Number(item.system.permanentWound?.originalMaxHitPoints)
          || Number(item.system.maxHitPoints),
        effective: Number(item.system.maxHitPoints),
        penalized: Number(item.system.permanentWound?.originalMaxHitPoints) > 0
          && Number(item.system.permanentWound.originalMaxHitPoints)
            !== Number(item.system.maxHitPoints)
      },
      passiveBlocked: blockedIds.has(item.id)
    }))
  };
}
