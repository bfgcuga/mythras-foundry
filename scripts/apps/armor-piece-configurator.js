import { armorDefaultName } from "../data/armor.js";
import { armorPieceTypeForLocation } from "../rules/armor.js";
import { hitLocationDisplayName } from "../rules/hit-locations.js";

export const ARMOR_PIECE_TYPES = Object.freeze([
  "helmet", "cuirass", "skirt", "greaves", "bracers", "other"
]);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
}

export const armorPieceDefaultName = armorDefaultName;

export async function configureNewArmorPiece(item) {
  const { DialogV2 } = foundry.applications.api;
  const locations = item.parent?.items.filter((candidate) => candidate.type === "hitLocation") ?? [];
  const options = locations.map((location) =>
    `<option value="${escapeHtml(location.id)}">${escapeHtml(hitLocationDisplayName(location))}</option>`).join("");
  const result = await DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Armor.Piece.ConfigureTitle") },
    content: `<div class="mythras-foundry armor-piece-config-dialog">
      <label><span>${escapeHtml(game.i18n.localize("MYTHRASF.Armor.AssignedLocation"))}</span>
        <select name="coveredLocationId" class="sheet-field-editable">
          <option value="">${escapeHtml(game.i18n.localize("MYTHRASF.Armor.Unassigned"))}</option>
          ${options}
        </select>
      </label>
    </div>`,
    buttons: [{
      action: "configure",
      label: game.i18n.localize("MYTHRASF.Armor.Piece.Create"),
      icon: "fas fa-check",
      default: true,
      callback: (event, button) => {
        const id = button.form.elements.coveredLocationId.value;
        if (!id) {
          ui.notifications.warn(game.i18n.localize("MYTHRASF.Armor.CoverageRequired"));
          return null;
        }
        return id;
      }
    }, {
      action: "cancel",
      label: game.i18n.localize("MYTHRASF.Cancel"),
      icon: "fas fa-times"
    }],
    rejectClose: false
  });
  if (!result) {
    await item.delete();
    return false;
  }
  const referenceLocation = item.system.referenceLocation || "special";
  const profileName = item.system.profileName || game.i18n.localize("TYPES.Item.armor");
  await item.update({
    name: armorDefaultName(referenceLocation, profileName),
    "system.pieceType": armorPieceTypeForLocation(referenceLocation),
    "system.coveredLocationIds": [result],
    "system.coverageMigrated": true,
    "system.equipped": false
  });
  return true;
}
