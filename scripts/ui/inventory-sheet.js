import { weaponHandsRequired } from "../rules/equipment.js";
import { itemEncumbrance } from "../rules/encumbrance.js";
import { inventoryLocation, inventoryRows, inventorySections } from "../rules/inventory.js";
import { isNaturalWeaponMode } from "../rules/passive-block.js";
import { weaponModes } from "../rules/weapon-modes.js";
import { weaponDurabilityState } from "../rules/weapon-durability.js";

export function isNaturalWeapon(weapon) {
  if (weapon?.type !== "weapon") return false;
  const modes = weaponModes(weapon);
  return modes.length > 0 && modes.every((mode) => isNaturalWeaponMode(mode));
}

export function inventoryItemsForActor(items = []) {
  return Array.from(items).filter((item) => ["equipment", "weapon", "armor"].includes(item.type)
    && !isNaturalWeapon(item));
}

export function prepareInventoryView(items = []) {
  const inventoryItems = inventoryItemsForActor(items);
  const prepareRows = (sectionItems) => inventoryRows(sectionItems).map((row) => ({ ...row,
    handsRequired: row.isWeapon ? weaponHandsRequired(row.item) : 0,
    encumbrance: itemEncumbrance(row.item),
    priceLabel: `${Number(row.system.value ?? 0)} ${game.i18n.localize(
      `MYTHRASF.Currency.${row.system.currency ?? "silver"}`)}`,
    locationLabel: inventoryLocation(row.item, inventoryItems) === "person"
      ? game.i18n.localize("MYTHRASF.Item.Carried")
      : inventoryLocation(row.item, inventoryItems),
    groupLabel: game.i18n.localize(`MYTHRASF.Inventory.Category.${row.groupKey}`),
    durabilityState: row.isWeapon ? weaponDurabilityState(row.item) : "",
    broken: row.isWeapon && weaponDurabilityState(row.item) === "broken",
    damaged: row.isWeapon && weaponDurabilityState(row.item) === "damaged",
    categoryLabel: row.isWeapon ? game.i18n.localize("TYPES.Item.weapon")
      : row.isArmor ? game.i18n.localize("TYPES.Item.armor")
        : game.i18n.localize(`MYTHRASF.ItemClass.${row.system.category}`)
  }));
  return {
    items: inventoryItems,
    rows: prepareRows(inventoryItems),
    sections: inventorySections(inventoryItems).map((section) => ({
      ...section,
      label: section.property?.name ?? game.i18n.localize("MYTHRASF.Inventory.OnPerson"),
      rows: prepareRows(section.items)
    }))
  };
}

export class InventorySheetController {
  constructor(sheet) {
    this.sheet = sheet;
  }

  get actor() { return this.sheet.actor; }
  get element() { return this.sheet.element; }
  get editable() { return this.sheet.isEditable; }

  bind() {
    this.element.querySelectorAll("[data-action='toggle-container']").forEach((button) =>
      button.addEventListener("click", (event) => this.toggleContainer(event)));
    this.element.querySelectorAll("[data-action='sell-item']").forEach((button) =>
      button.addEventListener("click", (event) => this.sellItem(event)));
    this.element.querySelectorAll("[data-property-funds]").forEach((field) =>
      field.addEventListener("change", (event) => this.updatePropertyFunds(event)));
    this.element.querySelectorAll("[data-action='buy-item']").forEach((button) =>
      button.addEventListener("click", (event) => game.mythrasFoundry?.shop?.open?.({
        actorUuid: this.actor.uuid,
        destinationId: event.currentTarget.dataset.walletId ?? "person"
      })));
    this.element.querySelectorAll("[data-action='transfer-money']").forEach((button) =>
      button.addEventListener("click", (event) => this.transferMoney(event)));
    this.activateDragAndDrop();
  }

  async toggleContainer(event) {
    event.preventDefault();
    const item = this.actor.items.get(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    if (item?.type !== "equipment" || !item.system.isContainer) return;
    await item.update({ "system.collapsed": !item.system.collapsed });
  }

  async updatePropertyFunds(event) {
    if (!this.editable) return;
    const property = this.actor.items.get(event.currentTarget
      .closest("[data-inventory-destination]")?.dataset.inventoryDestination);
    if (property?.system.category !== "property") return;
    const denomination = event.currentTarget.dataset.propertyFunds;
    await property.update({ [`system.funds.${denomination}`]: Math.max(0,
      Number(event.currentTarget.value ?? 0)) });
  }

  async transferMoney(event) {
    event.preventDefault();
    if (!this.editable) return;
    const sourceId = event.currentTarget.dataset.walletId;
    const wallets = [{ id: "person", name: game.i18n.localize("MYTHRASF.Inventory.OnPerson") },
      ...this.actor.items.filter((item) => item.type === "equipment"
        && item.system.category === "property").map((item) => ({ id: item.id, name: item.name }))];
    const destinations = wallets.filter((wallet) => wallet.id !== sourceId);
    if (!destinations.length) return ui.notifications.warn(
      game.i18n.localize("MYTHRASF.Inventory.TransferNoDestination"));
    const options = destinations.map((wallet) => `<option value="${wallet.id}">${
      foundry.utils.escapeHTML(wallet.name)}</option>`).join("");
    const result = await foundry.applications.api.DialogV2.input({
      window: { title: game.i18n.localize("MYTHRASF.Inventory.Transfer") },
      content: `<div class="inventory-transfer-dialog">
        <label><span>${game.i18n.localize("MYTHRASF.Inventory.TransferDestination")}</span><select name="destination">${options}</select></label>
        <fieldset class="inventory-transfer-amounts"><legend>${game.i18n.localize("MYTHRASF.Inventory.TransferAmount")}</legend>
          <label><span>PC</span><input type="number" min="0" step="0.01" name="copper" value="0"></label>
          <label><span>PP</span><input type="number" min="0" step="0.01" name="silver" value="0"></label>
          <label><span>PO</span><input type="number" min="0" step="0.01" name="gold" value="0"></label>
        </fieldset></div>`,
      ok: { label: game.i18n.localize("MYTHRASF.Inventory.Transfer"), icon: "fas fa-right-left",
        callback: (dialogEvent, button) => ({
          destinationId: button.form.elements.destination.value,
          amounts: Object.fromEntries(["copper", "silver", "gold"].map((denomination) =>
            [denomination, Math.max(0, Number(button.form.elements[denomination].value) || 0)]))
        }) }
    });
    if (!result) return;
    const transfers = Object.entries(result.amounts).filter(([, amount]) => amount > 0);
    if (!transfers.length) return;
    const walletDocument = (id) => id === "person" ? this.actor : this.actor.items.get(id);
    const walletPath = (id, denomination) => id === "person"
      ? `system.currency.${denomination}` : `system.funds.${denomination}`;
    const source = walletDocument(sourceId);
    const destination = walletDocument(result.destinationId);
    if (!source || !destination) return;
    for (const [denomination, amount] of transfers) {
      const available = Number(foundry.utils.getProperty(source,
        walletPath(sourceId, denomination)) ?? 0);
      if (amount > available) return ui.notifications.warn(game.i18n.format(
        "MYTHRASF.Inventory.TransferInsufficient", {
          currency: game.i18n.localize(`MYTHRASF.Currency.${denomination}`)
        }));
    }
    const sourceUpdate = {};
    const destinationUpdate = {};
    for (const [denomination, amount] of transfers) {
      const sourcePath = walletPath(sourceId, denomination);
      const destinationPath = walletPath(result.destinationId, denomination);
      sourceUpdate[sourcePath] = Number(foundry.utils.getProperty(source, sourcePath) ?? 0) - amount;
      destinationUpdate[destinationPath] = Number(
        foundry.utils.getProperty(destination, destinationPath) ?? 0) + amount;
    }
    await source.update(sourceUpdate);
    await destination.update(destinationUpdate);
  }

  propertyContaining(item) {
    const byId = new Map(this.actor.items.map((entry) => [entry.id, entry]));
    const visited = new Set();
    let current = item;
    while (current?.system?.parentContainerId) {
      if (visited.has(current.system.parentContainerId)) return null;
      visited.add(current.system.parentContainerId);
      current = byId.get(current.system.parentContainerId);
      if (current?.system?.category === "property") return current;
    }
    return null;
  }

  async sellItem(event) {
    event.preventDefault();
    if (!this.editable) return;
    const item = this.actor.items.get(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    const value = Math.max(0, Number(item.system.value ?? 0))
      * Math.max(1, Number(item.system.quantity ?? 1));
    const denomination = item.system.currency ?? "silver";
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("MYTHRASF.Item.Sell") },
      content: `<p>${game.i18n.format("MYTHRASF.Item.SellConfirm", {
        item: foundry.utils.escapeHTML(item.name), value,
        currency: game.i18n.localize(`MYTHRASF.Currency.${denomination}`)
      })}</p>`
    });
    if (!confirmed) return;
    const property = this.propertyContaining(item);
    if (property) await property.update({ [`system.funds.${denomination}`]:
      Number(property.system.funds?.[denomination] ?? 0) + value });
    else await this.actor.update({ [`system.currency.${denomination}`]:
      Number(this.actor.system.currency?.[denomination] ?? 0) + value });
    await this.reparentChildren(item);
    await this.actor.deleteEmbeddedDocuments("Item", [item.id]);
  }

  async reparentChildren(item) {
    const updates = this.actor.items.filter((candidate) =>
      candidate.system?.parentContainerId === item.id).map((candidate) => ({
      _id: candidate.id, "system.parentContainerId": item.system.parentContainerId ?? ""
    }));
    if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);
  }

  activateDragAndDrop() {
    const inventory = this.element.querySelector("[data-tab-content='inventory']");
    if (!inventory || !this.editable) return;
    inventory.querySelectorAll("[data-item-id][draggable='true']").forEach((row) =>
      row.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain",
        JSON.stringify({ type: "Item", uuid: this.actor.items.get(row.dataset.itemId)?.uuid,
          mythrasInventoryItemId: row.dataset.itemId }))));
    inventory.querySelectorAll("[data-inventory-destination]").forEach((target) => {
      target.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        target.classList.add("inventory-drop-target");
      });
      target.addEventListener("dragleave", () => target.classList.remove("inventory-drop-target"));
      target.addEventListener("drop", (event) => this.dropItem(event, target));
    });
  }

  async dropItem(event, target) {
    event.preventDefault();
    event.stopPropagation();
    target.classList.remove("inventory-drop-target");
    let data;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
    if (data.type !== "Item") return;
    const destinationId = target.dataset.inventoryDestination === "person"
      ? "" : target.dataset.inventoryDestination;
    const destination = destinationId ? this.actor.items.get(destinationId) : null;
    if (destinationId && (!destination || !destination.system.isContainer)) return;
    const embedded = data.mythrasInventoryItemId
      ? this.actor.items.get(data.mythrasInventoryItemId) : null;
    if (embedded) {
      if (embedded.id === destinationId || embedded.system.category === "property") return;
      let ancestor = destination;
      while (ancestor) {
        if (ancestor.id === embedded.id) return;
        ancestor = this.actor.items.get(ancestor.system.parentContainerId);
      }
      await embedded.update({ "system.parentContainerId": destinationId });
      return;
    }
    const source = data.uuid ? await fromUuid(data.uuid) : null;
    if (!source || source.documentName !== "Item") return;
    const itemData = source.toObject();
    delete itemData._id;
    itemData.system.parentContainerId = destinationId;
    await this.actor.createEmbeddedDocuments("Item", [itemData]);
  }
}
