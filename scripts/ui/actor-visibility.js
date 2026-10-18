import { getSystemSetting, SETTING_KEYS } from "../settings.js";

export function canManageActor(actor, user = game.user) {
  return Boolean(user?.isGM || (actor?.testUserPermission
    ? actor.testUserPermission(user, "OWNER") : actor?.isOwner));
}

export function canViewActor(actor, user = game.user) {
  return canManageActor(actor, user) || Boolean(actor?.testUserPermission?.(user, "LIMITED"));
}

export function actorVisibility(actor, user = game.user) {
  const full = canManageActor(actor, user);
  const show = key => full || Boolean(getSystemSetting(SETTING_KEYS[key]));
  const weapons = show("showOtherActorWeapons");
  const locations = show("showOtherActorLocations");
  const status = show("showOtherActorStatus");
  return { full, restricted: !full, weapons, locations, status,
    hideWeapons: !weapons, hideLocations: !locations,
    resources: show("showOtherActorResources"), combat: full || weapons || locations };
}

export function visibleSheetTab(root, requested) {
  const tabs = Array.from(root.querySelectorAll("[data-tab]"), button => button.dataset.tab);
  return tabs.includes(requested) ? requested : tabs[0];
}

export function bindObserverSheet(sheet) {
  const root = sheet.element;
  root.querySelectorAll("[data-tab], [data-action='view-portrait'], [data-action='view-gallery-image']")
    .forEach(button => { button.disabled = false; });
  const activate = requested => {
    sheet._activeTab = visibleSheetTab(root, requested);
    root.querySelectorAll("[data-tab]").forEach(button =>
      button.classList.toggle("active", button.dataset.tab === sheet._activeTab));
    root.querySelectorAll("[data-tab-content]").forEach(panel =>
      panel.classList.toggle("active", panel.dataset.tabContent === sheet._activeTab));
  };
  root.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", event => {
    event.preventDefault(); activate(button.dataset.tab);
  }));
  activate(sheet._activeTab);
  root.querySelector("[data-action='view-portrait']")?.addEventListener("click", () =>
    new foundry.applications.apps.ImagePopout({ src: sheet.actor.img,
      uuid: sheet.actor.uuid, window: { title: sheet.actor.name } }).render(true));
}
