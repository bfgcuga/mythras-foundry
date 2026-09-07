const WEAPON_RESTRICTION_LABELS = Object.freeze({
  "": "—",
  unarmed: "Pelea",
  ranged: "Armas a distancia",
  trapping: "Armas atrapadoras",
  bludgeoning: "Armas contundentes",
  cutting: "Armas cortantes",
  siegeOrRanged: "Armas de asedio o a distancia",
  small: "Armas pequeñas",
  piercing: "Armas perforantes",
  shieldOrBludgeoning: "Escudos o armas contundentes",
  axeOrTwoHanded: "Hachas o armas a dos manos"
});

const ROLL_RESTRICTION_LABELS = Object.freeze({
  "": "—",
  attackerCritical: "Crítico del atacante",
  defenderCritical: "Crítico del defensor",
  attackerFumble: "Pifia del atacante",
  opponentFumble: "Pifia del oponente",
  winnerCritical: "Solo crítico",
  seeDescription: "Ver descripción"
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function contentLink(uuid, label) {
  return `<a class="content-link" draggable="true" data-link data-uuid="${uuid}">`
    + `<i class="fas fa-file-lines" aria-hidden="true"></i>${escapeHtml(label)}</a>`;
}

function yesNo(value) {
  return value ? '<span aria-label="Sí">X</span>' : "";
}

function restrictionLabel(labels, value) {
  return labels[value ?? ""] ?? escapeHtml(value);
}

function effectSummaryTable(effects, pageUuid) {
  const rows = effects.map((effect) => `<tr>
    <th scope="row">${contentLink(pageUuid(`combat-effect-${effect.buildKey}`), effect.name)}</th>
    <td>${yesNo(effect.system.offensive)}</td>
    <td>${yesNo(effect.system.defensive)}</td>
    <td>${restrictionLabel(WEAPON_RESTRICTION_LABELS, effect.system.weaponRestriction)}</td>
    <td>${restrictionLabel(ROLL_RESTRICTION_LABELS, effect.system.rollRestriction)}</td>
    <td>${yesNo(effect.system.stackable)}</td>
  </tr>`).join("");
  return `<article class="mythras-reference">
    <p>Selecciona el nombre de un efecto para consultar su descripción completa.</p>
    <div class="mythras-reference-table-wrapper">
      <table class="mythras-reference-table">
        <thead><tr>
          <th scope="col">Efecto de combate</th>
          <th scope="col">Ofensivo</th>
          <th scope="col">Defensivo</th>
          <th scope="col">Tipo de arma específica</th>
          <th scope="col">Tirada específica</th>
          <th scope="col">Apilable</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </article>`;
}

function impaleTable(effect) {
  if (!effect.system.tableColumns.length) return "";
  const headings = effect.system.tableColumns.map((column) =>
    `<th scope="col">${escapeHtml(column)}</th>`).join("");
  const rows = effect.system.tableRows.map((row) => `<tr>${row.map((cell, index) => index
    ? `<td>${escapeHtml(cell)}</td>`
    : `<th scope="row">${escapeHtml(cell)}</th>`).join("")}</tr>`).join("");
  return `<div class="mythras-reference-table-wrapper"><table class="mythras-reference-table">
    <thead><tr>${headings}</tr></thead><tbody>${rows}</tbody>
  </table></div><p class="mythras-reference-note">${escapeHtml(effect.system.tableNote)}</p>`;
}

function effectPage(effect, indexUuid) {
  const properties = [
    effect.system.offensive ? "Ofensivo" : null,
    effect.system.defensive ? "Defensivo" : null,
    effect.system.stackable ? "Apilable" : null
  ].filter(Boolean);
  const weapon = restrictionLabel(WEAPON_RESTRICTION_LABELS, effect.system.weaponRestriction);
  const roll = restrictionLabel(ROLL_RESTRICTION_LABELS, effect.system.rollRestriction);
  return `<article class="mythras-reference mythras-reference-detail">
    <p class="mythras-reference-back">${contentLink(indexUuid, "Volver a la tabla de efectos")}</p>
    <dl class="mythras-reference-properties">
      <div><dt>Tipo</dt><dd>${properties.length ? properties.join(", ") : "—"}</dd></div>
      <div><dt>Arma específica</dt><dd>${weapon}</dd></div>
      <div><dt>Tirada específica</dt><dd>${roll}</dd></div>
    </dl>
    <h2>Descripción</h2>
    <p>${escapeHtml(effect.system.description)}</p>
    ${impaleTable(effect)}
  </article>`;
}

const CHARACTERISTIC_LABELS = Object.freeze({
  strength: "FUE", constitution: "CON", dexterity: "DES", size: "TAM",
  intelligence: "INT", power: "POD", charisma: "CAR"
});

function skillFormula(skill) {
  const first = CHARACTERISTIC_LABELS[skill.system.characteristic1];
  const second = CHARACTERISTIC_LABELS[skill.system.characteristic2];
  return first === second ? `${first} ×2` : `${first}+${second}`;
}

function skillCategory(skill) {
  if (skill.system.group === "magic") return "Mágicas";
  return skill.system.category === "basic" ? "Básicas" : "Profesionales";
}

function skillLinks(skills, pageUuid) {
  return `<ul>${skills.map((skill) =>
    `<li>${contentLink(pageUuid(`skill-${skill.system.slug}`), skill.name)}</li>`).join("")}</ul>`;
}

function skillTables(skill) {
  return (skill.system.referenceTables ?? []).map((table) => {
    const headings = table.columns.map((column) =>
      `<th scope="col">${escapeHtml(column)}</th>`).join("");
    const rows = table.rows.map((row) => `<tr>${row.map((cell, index) => index
      ? `<td>${escapeHtml(cell)}</td>`
      : `<th scope="row">${escapeHtml(cell)}</th>`).join("")}</tr>`).join("");
    return `<h2>${escapeHtml(table.name)}</h2><div class="mythras-reference-table-wrapper">
      <table class="mythras-reference-table"><thead><tr>${headings}</tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }).join("");
}

function skillPage(skill, pageUuid) {
  return `<article class="mythras-reference mythras-reference-detail">
    <p class="mythras-reference-back">${contentLink(pageUuid("skills-alphabetical"),
    "Índice alfabético")} · ${contentLink(pageUuid("skills-by-category"),
    "Índice por categorías")}</p>
    <dl class="mythras-reference-properties">
      <div><dt>Categoría</dt><dd>${skillCategory(skill)}</dd></div>
      <div><dt>Valor inicial</dt><dd>${skillFormula(skill)}</dd></div>
      <div><dt>Fuente</dt><dd>${escapeHtml(skill.system.source)}</dd></div>
    </dl>
    <h2>Descripción</h2>
    <p>${escapeHtml(skill.system.description).replaceAll(" • ", "<br>• ")}</p>
    ${skillTables(skill)}
  </article>`;
}

export function referenceJournalSources(combatEffects, skillSources = []) {
  const effects = [...combatEffects].sort((left, right) =>
    left.name.localeCompare(right.name, "es"));
  const skills = [...skillSources].sort((left, right) => left.name.localeCompare(right.name, "es"));
  const categoryOrder = ["Básicas", "Profesionales", "Mágicas"];
  return [{
    buildKey: "mythras-reference",
    name: "Referencia de Mythras",
    img: "icons/svg/book.svg",
    pages: [
      {
        buildKey: "index",
        name: "Índice",
        content: ({ pageUuid }) => `<article class="mythras-reference mythras-reference-home">
          <p>Consulta las reglas y catálogos del sistema desde este índice.</p>
          <nav aria-label="Índice de referencia"><ul>
            <li>${contentLink(pageUuid("combat-effects"), "Efectos de combate")}</li>
            <li>${contentLink(pageUuid("skills-alphabetical"), "Habilidades: índice alfabético")}</li>
            <li>${contentLink(pageUuid("skills-by-category"), "Habilidades por categorías")}</li>
          </ul></nav>
        </article>`
      },
      {
        buildKey: "combat-effects",
        name: "Efectos de combate",
        content: ({ pageUuid }) => effectSummaryTable(effects, pageUuid)
      },
      ...effects.map((effect) => ({
        buildKey: `combat-effect-${effect.buildKey}`,
        name: effect.name,
        content: ({ pageUuid }) => effectPage(effect, pageUuid("combat-effects"))
      })),
      {
        buildKey: "skills-alphabetical",
        name: "Habilidades: índice alfabético",
        content: ({ pageUuid }) => `<article class="mythras-reference">
          <p>Índice completo de habilidades básicas, profesionales y mágicas.</p>
          ${skillLinks(skills, pageUuid)}
        </article>`
      },
      {
        buildKey: "skills-by-category",
        name: "Habilidades por categorías",
        content: ({ pageUuid }) => `<article class="mythras-reference">
          ${categoryOrder.map((category) => `<h2>${category}</h2>${skillLinks(
    skills.filter((skill) => skillCategory(skill) === category), pageUuid)}`).join("")}
        </article>`
      },
      ...skills.map((skill) => ({
        buildKey: `skill-${skill.system.slug}`,
        name: skill.name,
        content: ({ pageUuid }) => skillPage(skill, pageUuid)
      }))
    ]
  }];
}
