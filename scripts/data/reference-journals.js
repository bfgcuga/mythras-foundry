import { weaponReferenceHtml } from "../rules/weapon-reference.js";

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

function mainIndexLink(pageUuid) {
  return `<p class="mythras-reference-back">${contentLink(pageUuid("index"),
    "Volver al índice principal")}</p>`;
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
    ${mainIndexLink(pageUuid)}
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

const TRAIT_TYPE_LABELS = Object.freeze({
  weapon: "Rasgos de armas",
  combatStyle: "Rasgos de estilos de combate",
  creature: "Rasgos de criaturas"
});

const TRAIT_INDEX_KEYS = Object.freeze({
  weapon: "weapon-traits",
  combatStyle: "combat-style-traits",
  creature: "creature-traits"
});

function traitLinks(traits, pageUuid) {
  return `<ul>${traits.map((trait) =>
    `<li>${contentLink(pageUuid(`trait-${trait.buildKey}`), trait.name)}</li>`).join("")}</ul>`;
}

function traitPage(trait, pageUuid) {
  const indexKey = TRAIT_INDEX_KEYS[trait.system.traitType];
  return `<article class="mythras-reference mythras-reference-detail">
    <p class="mythras-reference-back">${contentLink(pageUuid(indexKey),
    `Volver a ${TRAIT_TYPE_LABELS[trait.system.traitType].toLowerCase()}`)} · ${contentLink(
    pageUuid("index"), "Índice principal")}</p>
    <dl class="mythras-reference-properties">
      <div><dt>Tipo</dt><dd>${TRAIT_TYPE_LABELS[trait.system.traitType]}</dd></div>
      <div><dt>Fuente</dt><dd>${escapeHtml(trait.system.source)}</dd></div>
    </dl>
    <h2>Descripción</h2>
    <p>${escapeHtml(trait.system.description)}</p>
  </article>`;
}

function referenceList(entries, prefix, pageUuid) {
  return `<ul>${entries.map((entry) =>
    `<li>${contentLink(pageUuid(`${prefix}-${entry.buildKey ?? entry.system.key}`), entry.name)}</li>`
  ).join("")}</ul>`;
}

function backgroundRules(source) {
  try { return JSON.parse(source.system.rules || "{}"); } catch { return {}; }
}

function namedSkills(values, skillNames) {
  return (values ?? []).map((value) => skillNames.get(value) ?? String(value)
    .replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase())).join(", ") || "—";
}

function backgroundPage(source, kind, pageUuid, skillNames) {
  const rules = backgroundRules(source);
  const professional = (rules.professional ?? []).map((skill) => skill.label).join(", ") || "—";
  const choices = (rules.choices ?? []).map((choice) => `${choice.label}: ${choice.options
    .map((option) => option.label).join(" / ")}`).join("<br>") || "—";
  return `<article class="mythras-reference mythras-reference-detail">
    <p class="mythras-reference-back">${contentLink(pageUuid(`${kind}s`),
    `Volver al índice de ${kind === "culture" ? "culturas" : "profesiones"}`)} · ${contentLink(
    pageUuid("index"), "Índice principal")}</p>
    <dl class="mythras-reference-properties">
      <div><dt>Habilidades básicas</dt><dd>${escapeHtml(namedSkills(rules.basic, skillNames))}</dd></div>
      <div><dt>Habilidades profesionales</dt><dd>${escapeHtml(professional)}</dd></div>
      <div><dt>Elecciones</dt><dd>${choices}</dd></div>
      <div><dt>Estilos de combate</dt><dd>${escapeHtml((rules.styles ?? []).join(", ") || "—")}</dd></div>
      <div><dt>Fuente</dt><dd>${escapeHtml(source.system.source)}</dd></div>
    </dl>
    ${source.system.description ? `<h2>Descripción</h2><p>${escapeHtml(source.system.description)}</p>` : ""}
  </article>`;
}

const EQUIPMENT_CATEGORY_LABELS = Object.freeze({ service: "Servicios y alojamiento", clothing: "Ropa",
  food: "Comida y bebida", livestock: "Animales", general: "Equipo general", item: "Equipo general",
  ammunition: "Munición", container: "Contenedores", vehicle: "Vehículos", property: "Propiedades" });
const CURRENCY_LABELS = Object.freeze({ copper: "PC", silver: "PP", gold: "PO" });

function equipmentIndex(equipment, pageUuid) {
  const groups = new Map();
  for (const entry of equipment) {
    const category = entry.system.category ?? "general";
    groups.set(category, [...(groups.get(category) ?? []), entry]);
  }
  return `<article class="mythras-reference">${mainIndexLink(pageUuid)}
    <p><button type="button" class="mythras-reference-open-catalog"
      title="Abrir catálogo completo" aria-label="Abrir catálogo completo"><i class="fas fa-store"
      aria-hidden="true"></i> Abrir catálogo completo y fuentes personales</button></p>
    ${[...groups].map(([category, entries]) => `<h2>${escapeHtml(
    EQUIPMENT_CATEGORY_LABELS[category] ?? category)}</h2><div class="mythras-reference-table-wrapper">
      <table class="mythras-reference-table"><thead><tr><th scope="col">Objeto</th>
      <th scope="col">Peso</th><th scope="col">Coste</th><th scope="col">Época</th></tr></thead>
      <tbody>${entries.map((entry) => `<tr><th scope="row">${contentLink(
    pageUuid(`equipment-${entry.buildKey}`), entry.name)}</th><td>${escapeHtml(entry.system.weight)}</td>
      <td>${escapeHtml(entry.system.value)} ${CURRENCY_LABELS[entry.system.currency] ?? ""}</td>
      <td>${escapeHtml(entry.system.era || "—")}</td></tr>`).join("")}</tbody></table></div>`).join("")}
  </article>`;
}

function equipmentPage(entry, pageUuid) {
  return `<article class="mythras-reference mythras-reference-detail">
    <p class="mythras-reference-back">${contentLink(pageUuid("equipment"),
    "Volver al índice de objetos generales")} · ${contentLink(pageUuid("index"), "Índice principal")}</p>
    <dl class="mythras-reference-properties">
      <div><dt>Categoría</dt><dd>${escapeHtml(EQUIPMENT_CATEGORY_LABELS[entry.system.category]
    ?? entry.system.category)}</dd></div><div><dt>Peso</dt><dd>${escapeHtml(entry.system.weight)}</dd></div>
      <div><dt>Coste</dt><dd>${escapeHtml(entry.system.value)} ${CURRENCY_LABELS[entry.system.currency]
    ?? ""}</dd></div><div><dt>Época</dt><dd>${escapeHtml(entry.system.era || "—")}</dd></div>
      <div><dt>Fuente</dt><dd>${escapeHtml(entry.system.source)}</dd></div>
    </dl>${entry.system.description ? `<h2>Descripción</h2><p>${escapeHtml(entry.system.description)}</p>` : ""}
  </article>`;
}

function combatStylePage(style, pageUuid) {
  return `<article class="mythras-reference mythras-reference-detail">
    <p class="mythras-reference-back">${contentLink(pageUuid("combat-styles"),
    "Volver al índice de estilos de combate")} · ${contentLink(pageUuid("index"), "Índice principal")}</p>
    <dl class="mythras-reference-properties">
      <div><dt>Armas</dt><dd>${escapeHtml(style.system.weaponProfiles.map((weapon) => weapon.name).join(", ") || "—")}</dd></div>
      <div><dt>Rasgos</dt><dd>${escapeHtml(style.system.traitRefs.map((trait) => trait.name).join(", ") || "—")}</dd></div>
      <div><dt>Valor inicial</dt><dd>FUE+DES</dd></div>
      <div><dt>Fuente</dt><dd>${escapeHtml(style.system.source)}</dd></div>
    </dl>${style.system.description ? `<h2>Descripción</h2><p>${escapeHtml(style.system.description)}</p>` : ""}
  </article>`;
}

export function referenceJournalSources(combatEffects, skillSources = [], traitSources = [],
  weaponSources = [], cultureSources = [], professionSources = [], equipmentSources = [],
  combatStyleSources = []) {
  const effects = [...combatEffects].sort((left, right) =>
    left.name.localeCompare(right.name, "es"));
  const skills = [...skillSources].sort((left, right) => left.name.localeCompare(right.name, "es"));
  const traits = [...traitSources].sort((left, right) => left.name.localeCompare(right.name, "es"));
  const cultures = [...cultureSources].sort((left, right) => left.name.localeCompare(right.name, "es"));
  const professions = [...professionSources].sort((left, right) => left.name.localeCompare(right.name, "es"));
  const equipment = [...equipmentSources].sort((left, right) => left.name.localeCompare(right.name, "es"));
  const combatStyles = [...combatStyleSources].sort((left, right) => left.name.localeCompare(right.name, "es"));
  const skillNames = new Map(skills.map((skill) => [skill.system.slug, skill.name]));
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
            <li>${contentLink(pageUuid("weapon-traits"), "Rasgos de armas")}</li>
            <li>${contentLink(pageUuid("combat-style-traits"), "Rasgos de estilos de combate")}</li>
            <li>${contentLink(pageUuid("creature-traits"), "Rasgos de criaturas")}</li>
            <li>${contentLink(pageUuid("weapons"), "Armas")}</li>
            <li>${contentLink(pageUuid("cultures"), "Culturas")}</li>
            <li>${contentLink(pageUuid("professions"), "Profesiones")}</li>
            <li>${contentLink(pageUuid("equipment"), "Objetos generales")}</li>
            <li>${contentLink(pageUuid("combat-styles"), "Estilos de combate")}</li>
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
          ${mainIndexLink(pageUuid)}
          <p>Índice completo de habilidades básicas, profesionales y mágicas.</p>
          ${skillLinks(skills, pageUuid)}
        </article>`
      },
      {
        buildKey: "skills-by-category",
        name: "Habilidades por categorías",
        content: ({ pageUuid }) => `<article class="mythras-reference">
          ${mainIndexLink(pageUuid)}
          ${categoryOrder.map((category) => `<h2>${category}</h2>${skillLinks(
    skills.filter((skill) => skillCategory(skill) === category), pageUuid)}`).join("")}
        </article>`
      },
      ...skills.map((skill) => ({
        buildKey: `skill-${skill.system.slug}`,
        name: skill.name,
        content: ({ pageUuid }) => skillPage(skill, pageUuid)
      })),
      ...Object.entries(TRAIT_INDEX_KEYS).map(([traitType, buildKey]) => ({
        buildKey,
        name: TRAIT_TYPE_LABELS[traitType],
        content: ({ pageUuid }) => `<article class="mythras-reference">
          ${mainIndexLink(pageUuid)}
          <p>Selecciona un rasgo para consultar su descripción completa.</p>
          ${traitLinks(traits.filter((trait) => trait.system.traitType === traitType), pageUuid)}
        </article>`
      })),
      ...traits.map((trait) => ({
        buildKey: `trait-${trait.buildKey}`,
        name: trait.name,
        content: ({ pageUuid }) => traitPage(trait, pageUuid)
      })),
      {
        buildKey: "weapons",
        name: "Armas",
        content: ({ pageUuid }) => `<div class="mythras-reference">${mainIndexLink(pageUuid)}</div>${
          weaponReferenceHtml(weaponSources)}
        `
      },
      ...[["cultures", "Culturas", cultures, "culture"],
        ["professions", "Profesiones", professions, "profession"]].flatMap(
        ([indexKey, title, entries, prefix]) => [{ buildKey: indexKey, name: title,
          content: ({ pageUuid }) => `<article class="mythras-reference">${mainIndexLink(pageUuid)}
            <p>Selecciona una entrada para consultar sus habilidades y reglas.</p>${referenceList(
    entries, prefix, pageUuid)}</article>` }, ...entries.map((entry) => ({
          buildKey: `${prefix}-${entry.system.key}`, name: entry.name,
          content: ({ pageUuid }) => backgroundPage(entry, prefix, pageUuid, skillNames)
        }))]),
      { buildKey: "equipment", name: "Objetos generales",
        content: ({ pageUuid }) => equipmentIndex(equipment, pageUuid) },
      ...equipment.map((entry) => ({ buildKey: `equipment-${entry.buildKey}`, name: entry.name,
        content: ({ pageUuid }) => equipmentPage(entry, pageUuid) })),
      { buildKey: "combat-styles", name: "Estilos de combate",
        content: ({ pageUuid }) => `<article class="mythras-reference">${mainIndexLink(pageUuid)}
          <p>Selecciona un estilo para consultar las armas y rasgos que incluye.</p>${referenceList(
    combatStyles, "combat-style", pageUuid)}</article>` },
      ...combatStyles.map((style) => ({ buildKey: `combat-style-${style.buildKey}`, name: style.name,
        content: ({ pageUuid }) => combatStylePage(style, pageUuid) }))
    ]
  }];
}
