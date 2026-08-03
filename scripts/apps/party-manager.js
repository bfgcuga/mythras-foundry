import { normalizePartyConfig, removeParty, sanitizePartyConfig } from "../rules/parties.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const SETTING = "parties";

export class PartyManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "mythras-party-manager",
    classes: ["mythras-foundry", "party-manager"],
    window: { title: "MYTHRASF.Party.Manager" },
    position: { width: 680, height: 700 },
    actions: {
      create: PartyManager.#create,
      delete: PartyManager.#delete,
      save: PartyManager.#save
    }
  };

  static PARTS = {
    main: { template: "systems/mythras-foundry/templates/apps/party-manager.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actors = game.actors.filter((actor) => actor.type === "character")
      .sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang));
    const config = normalizePartyConfig(game.settings.get("mythras-foundry", SETTING));
    return {
      ...context,
      parties: config.parties.map((party) => ({
        ...party,
        active: party.id === config.activePartyId,
        actors: actors.map((actor) => ({
          id: actor.id,
          name: actor.name,
          img: actor.img,
          member: party.memberIds.includes(actor.id)
        }))
      }))
    };
  }

  static async #create() {
    if (!game.user.isGM) return;
    const name = await DialogV2.input({
      window: { title: game.i18n.localize("MYTHRASF.Party.Create") },
      content: `<div class="mythras-foundry"><label class="party-name-dialog"><span>${
        game.i18n.localize("MYTHRASF.Party.Name")
      }</span><input type="text" name="name" class="sheet-field-editable" autofocus required></label></div>`,
      ok: {
        label: game.i18n.localize("MYTHRASF.Add"),
        icon: "fas fa-plus",
        callback: (event, button) => button.form.elements.name.value.trim()
      }
    });
    if (!name) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Party.NameRequired"));
      return;
    }
    const config = PartyManager.#readForm.call(this);
    if (!config) return;
    const id = foundry.utils.randomID();
    config.parties.push({ id, name, memberIds: [] });
    if (!config.activePartyId) config.activePartyId = id;
    await game.settings.set("mythras-foundry", SETTING, config);
    this.render({ force: true });
  }

  static async #delete(event, target) {
    if (!game.user.isGM) return;
    const partyId = target.closest("[data-party-id]")?.dataset.partyId;
    const config = PartyManager.#readForm.call(this);
    if (!config) return;
    const party = config.parties.find((candidate) => candidate.id === partyId);
    if (!party) return;
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("MYTHRASF.Party.Delete") },
      content: `<p>${game.i18n.format("MYTHRASF.Party.DeleteConfirm", {
        name: foundry.utils.escapeHTML(party.name)
      })}</p>`
    });
    if (!confirmed) return;
    await game.settings.set("mythras-foundry", SETTING, removeParty(config, partyId));
    this.render({ force: true });
  }

  static async #save() {
    if (!game.user.isGM) return;
    const config = PartyManager.#readForm.call(this);
    if (!config) return;
    await game.settings.set("mythras-foundry", SETTING, config);
    ui.notifications.info(game.i18n.localize("MYTHRASF.Party.Saved"));
    this.render({ force: true });
  }

  static #readForm() {
    const parties = [...this.element.querySelectorAll("[data-party-id]")].map((panel) => ({
      id: panel.dataset.partyId,
      name: panel.querySelector("[data-party-name]")?.value.trim() ?? "",
      memberIds: [...panel.querySelectorAll("[data-party-member]:checked")]
        .map((field) => field.value)
    }));
    if (parties.some((party) => !party.name)) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Party.NameRequired"));
      return null;
    }
    const activePartyId = this.element.querySelector("[data-party-active]:checked")?.value ?? "";
    return sanitizePartyConfig({ activePartyId, parties }, game.actors);
  }
}
