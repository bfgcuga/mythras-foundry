export const ARMOR_PIECE_TYPES = Object.freeze([
  "helmet", "cuirass", "greaves", "bracers", "other"
]);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
}

export function armorPieceDefaultName(pieceType, profileName, format = (key, data) =>
  `${key}:${data.profile}`) {
  if (pieceType === "other") return profileName;
  return format(`MYTHRASF.Armor.Piece.DefaultName.${pieceType}`, { profile: profileName });
}

export async function configureNewArmorPiece(item) {
  const { DialogV2 } = foundry.applications.api;
  const actor = item.parent;
  const locations = actor?.items.filter((candidate) => candidate.type === "hitLocation") ?? [];
  const typeOptions = ARMOR_PIECE_TYPES.map((type) =>
    `<option value="${type}">${escapeHtml(game.i18n.localize(`MYTHRASF.Armor.Piece.Type.${type}`))}</option>`
  ).join("");
  const locationOptions = locations.map((location) => `<label class="armor-piece-location-option">
    <input type="checkbox" class="sheet-state-box" name="coveredLocationIds" value="${escapeHtml(location.id)}">
    <span>${escapeHtml(location.name)}</span>
  </label>`).join("");
  const result = await DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Armor.Piece.ConfigureTitle") },
    content: `<div class="mythras-foundry armor-piece-config-dialog">
      <label><span>${escapeHtml(game.i18n.localize("MYTHRASF.Armor.Piece.TypeLabel"))}</span>
        <select name="pieceType" class="sheet-field-editable">${typeOptions}</select></label>
      <label><span>${escapeHtml(game.i18n.localize("MYTHRASF.Armor.Piece.NameLabel"))}</span>
        <input type="text" name="pieceName" class="sheet-field-editable"
          placeholder="${escapeHtml(game.i18n.localize("MYTHRASF.Armor.Piece.NamePlaceholder"))}"></label>
      <fieldset><legend>${escapeHtml(game.i18n.localize("MYTHRASF.Armor.Coverage"))}</legend>
        <div class="armor-piece-location-options">${locationOptions}</div>
      </fieldset>
    </div>`,
    buttons: [{
      action: "configure",
      label: game.i18n.localize("MYTHRASF.Armor.Piece.Create"),
      icon: "fas fa-check",
      default: true,
      callback: (event, button) => {
        const form = button.form;
        const coveredLocationIds = [...form.querySelectorAll("input[name='coveredLocationIds']:checked")]
          .map((field) => field.value);
        if (!coveredLocationIds.length) {
          ui.notifications.warn(game.i18n.localize("MYTHRASF.Armor.CoverageRequired"));
          return null;
        }
        return {
          pieceType: form.elements.pieceType.value,
          pieceName: form.elements.pieceName.value.trim(),
          coveredLocationIds
        };
      }
    }, {
      action: "cancel",
      label: game.i18n.localize("MYTHRASF.Cancel"),
      icon: "fas fa-times"
    }],
    rejectClose: false
  });
  if (!result?.coveredLocationIds?.length) {
    await item.delete();
    return false;
  }
  const profileName = item.system.profileName || item.name;
  await item.update({
    name: result.pieceName || armorPieceDefaultName(
      result.pieceType, profileName, (key, data) => game.i18n.format(key, data)
    ),
    "system.pieceType": result.pieceType,
    "system.coveredLocationIds": result.coveredLocationIds,
    "system.coverageMigrated": true,
    "system.equipped": false
  });
  return true;
}
