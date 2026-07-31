export const ITEM_TYPE_ICONS = Object.freeze({
  skill: "icons/svg/book.svg",
  combatStyle: "icons/svg/sword.svg",
  culture: "icons/svg/village.svg",
  profession: "icons/svg/upgrade.svg",
  passion: "icons/svg/heart.svg",
  equipment: "icons/svg/item-bag.svg",
  weapon: "icons/svg/sword.svg"
});

export function defaultItemIcon(type) {
  return ITEM_TYPE_ICONS[type] ?? "icons/svg/item-bag.svg";
}
