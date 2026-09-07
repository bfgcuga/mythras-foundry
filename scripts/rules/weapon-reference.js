const GROUPS = Object.freeze([
  { key: "oneHanded", title: "Armas cuerpo a cuerpo de una mano" },
  { key: "twoHanded", title: "Armas cuerpo a cuerpo de dos manos" },
  { key: "shields", title: "Escudos" },
  { key: "ranged", title: "Armas a distancia" },
  { key: "siege", title: "Armas de asedio" }
]);
const DEFAULT_LABELS = Object.freeze({
  open: "Abrir referencia completa", openHint: "Incluir armas de los compendios personales",
  weapon: "Arma", shield: "Escudo", damage: "Daño", damageModifier: "Mod. daño",
  power: "Potencia", size: "Tamaño", reach: "Alcance", reload: "Recarga",
  effects: "Efectos de combate", impalingSize: "Tamaño de empalamiento", encumbrance: "CRG",
  durability: "PA/PG", crew: "Dotación", traits: "Rasgos", era: "Época", cost: "Coste",
  source: "Procedencia", yes: "Sí", half: "Mitad", no: "No"
});

const escape = (value) => String(value ?? "").replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");
const shown = (value) => value === "" || value == null ? "—" : escape(value);
const currencies = { copper: "MC", silver: "PP", gold: "MO" };

function groupKey(mode) {
  if (mode.weaponType === "shield") return "shields";
  if (mode.weaponType === "ranged") return "ranged";
  if (mode.weaponType === "siege") return "siege";
  if (mode.weaponType === "melee" && Number(mode.handsRequired) === 1) return "oneHanded";
  if (mode.weaponType === "melee" && Number(mode.handsRequired) >= 2) return "twoHanded";
  return null;
}

function traitNames(mode) {
  const structured = (mode.traitRefs ?? []).map((trait) => trait.name || trait.key);
  return structured.length ? structured.join(", ") : mode.traits ?? "";
}

export function weaponReferenceGroups(weapons, labels = DEFAULT_LABELS) {
  const rows = Object.fromEntries(GROUPS.map((group) => [group.key, []]));
  for (const weapon of weapons.filter((entry) => entry?.type === "weapon")) {
    for (const mode of weapon.system?.modes ?? []) {
      const key = groupKey(mode);
      if (!key) continue;
      rows[key].push({
        name: mode.name || weapon.name, uuid: weapon.uuid ?? "", source: weapon.packLabel ?? "",
        damage: mode.damage, damageModifier: mode.damageModifierMode === "full" ? labels.yes
          : mode.damageModifierMode === "half" ? labels.half : labels.no,
        size: mode.size, reach: mode.range || mode.reach, reload: mode.reloadActions ?? mode.reload,
        effects: mode.effects, impalingSize: mode.impalingSize,
        encumbrance: weapon.system.encumbrance, armorPoints: weapon.system.armorPoints,
        hitPoints: weapon.system.maxHitPoints, traits: traitNames(mode), era: weapon.system.era,
        cost: `${Number(weapon.system.value ?? 0)} ${currencies[weapon.system.currency ?? "silver"] ?? weapon.system.currency}`,
        crew: [mode.crewMinimum, mode.crewMaximum].filter((value) => Number(value) > 0).join("–")
      });
    }
  }
  return GROUPS.map((group) => ({ ...group, rows: rows[group.key].sort((left, right) =>
    left.name.localeCompare(right.name, "es")) }));
}

function nameCell(row) {
  return row.uuid ? `<a class="content-link" draggable="true" data-link data-uuid="${escape(row.uuid)}">${escape(row.name)}</a>`
    : escape(row.name);
}

export function weaponReferenceHtml(weapons, {
  dynamic = false, includeSource = false, labels = DEFAULT_LABELS, groupTitles = {}
} = {}) {
  return `<article class="mythras-reference mythras-weapon-reference">
    ${dynamic ? "" : `<button type="button" class="mythras-reference-open-weapons" title="${escape(labels.openHint)}">${escape(labels.open)}</button>`}
    ${weaponReferenceGroups(weapons, labels).map((group) => {
    const ranged = ["ranged", "siege"].includes(group.key);
    const headers = ranged
      ? [labels.weapon, labels.damage, labels.damageModifier, labels.power, labels.reach,
        labels.reload, labels.effects, labels.impalingSize, labels.encumbrance,
        labels.durability, ...(group.key === "siege" ? [labels.crew] : []), labels.traits,
        labels.era, labels.cost]
      : [group.key === "shields" ? labels.shield : labels.weapon, labels.damage, labels.size,
        labels.reach, labels.effects, labels.encumbrance, labels.durability, labels.traits,
        labels.era, labels.cost];
    if (includeSource) headers.push(labels.source);
    const body = group.rows.map((row) => {
      const cells = ranged
        ? [nameCell(row), shown(row.damage), shown(row.damageModifier), shown(row.size), shown(row.reach), shown(row.reload), shown(row.effects), shown(row.impalingSize), shown(row.encumbrance), `${shown(row.armorPoints)}/${shown(row.hitPoints)}`, ...(group.key === "siege" ? [shown(row.crew)] : []), shown(row.traits), shown(row.era), shown(row.cost)]
        : [nameCell(row), shown(row.damage), shown(row.size), shown(row.reach), shown(row.effects), shown(row.encumbrance), `${shown(row.armorPoints)}/${shown(row.hitPoints)}`, shown(row.traits), shown(row.era), shown(row.cost)];
      if (includeSource) cells.push(shown(row.source));
      return `<tr>${cells.map((cell, index) => index ? `<td>${cell}</td>` : `<th scope="row">${cell}</th>`).join("")}</tr>`;
    }).join("");
    return `<h2>${escape(groupTitles[group.key] ?? group.title)}</h2><div class="mythras-reference-table-wrapper"><table class="mythras-reference-table"><thead><tr>${headers.map((header) => `<th scope="col">${escape(header)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
  }).join("")}
  </article>`;
}
