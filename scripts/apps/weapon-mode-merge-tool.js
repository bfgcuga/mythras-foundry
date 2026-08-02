import { mergedWeaponModes, weaponMergeCandidates } from "../rules/weapon-mode-merge.js";
const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
export class WeaponModeMergeTool extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = { id: "mythras-weapon-mode-merge", classes: ["mythras-foundry"], window: { title: "MYTHRASF.Weapon.MergeTool" }, position: { width: 620, height: 600 }, actions: { merge: WeaponModeMergeTool.#merge } };
  static PARTS = { main: { template: "systems/mythras-foundry/templates/apps/weapon-mode-merge.hbs" } };
  async _prepareContext(options) { return { ...(await super._prepareContext(options)), groups: weaponMergeCandidates(game.actors) }; }
  static async #merge(event, target) {
    const panel = target.closest("[data-actor-id]");
    const actor = game.actors.get(panel?.dataset.actorId);
    const keeper = actor?.items.get(panel.querySelector("[data-keeper]")?.value);
    const donors = [...panel.querySelectorAll("[data-donor]:checked")].map((input) => actor.items.get(input.value)).filter((item) => item && item.id !== keeper?.id);
    if (!keeper || !donors.length) return ui.notifications.warn(game.i18n.localize("MYTHRASF.Weapon.SelectDonors"));
    if (!await DialogV2.confirm({ window: { title: game.i18n.localize("MYTHRASF.Weapon.MergeConfirm") }, content: `<p>${game.i18n.format("MYTHRASF.Weapon.MergeConfirmText", { keeper: keeper.name, count: donors.length })}</p>` })) return;
    await keeper.update({ "system.modes": mergedWeaponModes(keeper, donors) });
    await actor.deleteEmbeddedDocuments("Item", donors.map((item) => item.id));
    ui.notifications.info(game.i18n.localize("MYTHRASF.Weapon.MergeComplete"));
    this.render({ force: true });
  }
}
