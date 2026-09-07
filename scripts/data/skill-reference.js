const NAME_ALIASES = Object.freeze({ "juegos-de-manos": "juego-de-manos" });
const TABLE_SKILLS = Object.freeze({
  "Acciones de Primeros Auxilios": "primeros-auxilios",
  "Fluidez lingüística": "idioma"
});

const normalize = (value) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function cleanDescription(name, description) {
  let result = String(description ?? "")
    .replaceAll("refugio;el", "refugio; el")
    .replaceAll("másavanzados.Para", "más avanzados. Para ")
    .replaceAll("ocuando lascondiciones", "o cuando las condiciones");
  if (name === "Voluntad") {
    result = result.replace(/ Las Habilidades Profesionales varían[\s\S]*$/, "");
  }
  return result.trim();
}

export function fullSkillSources(skillSources, document) {
  const entries = new Map(document.habilidades.map((entry) => [normalize(entry.nombre), entry]));
  const tables = new Map();
  for (const table of document.tablas ?? []) {
    const slug = TABLE_SKILLS[table.nombre];
    if (slug) tables.set(slug, [...(tables.get(slug) ?? []), table]);
  }
  return skillSources.map((source) => {
    const lookup = NAME_ALIASES[source.system.slug] ?? source.system.slug;
    const entry = entries.get(lookup);
    if (!entry) throw new Error(`Falta la descripción completa de la habilidad ${source.name}.`);
    return {
      ...source,
      name: entry.nombre,
      system: {
        ...source.system,
        description: cleanDescription(entry.nombre, entry.descripcion),
        referenceTables: (tables.get(source.system.slug) ?? []).map((table) => ({
          name: table.nombre,
          columns: table.columnas,
          rows: table.filas
        }))
      }
    };
  });
}

