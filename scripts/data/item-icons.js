export const ITEM_TYPE_ICONS = Object.freeze({
  skill: "icons/svg/book.svg",
  combatStyle: "systems/mythras-foundry/assets/icons/combat-style.svg",
  culture: "icons/svg/village.svg",
  profession: "icons/svg/upgrade.svg",
  passion: "systems/mythras-foundry/assets/icons/passion.svg",
  equipment: "icons/svg/item-bag.svg",
  weapon: "icons/svg/sword.svg",
  hitLocation: "icons/svg/blood.svg"
});

export function defaultItemIcon(type) {
  return ITEM_TYPE_ICONS[type] ?? "icons/svg/item-bag.svg";
}
