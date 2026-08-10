export const TRAIT_TYPES = Object.freeze(["combatStyle", "creature", "weapon", "other"]);

export const traitSlug = (value) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

export function normalizeTraitParameters(parameters = []) {
  const seen = new Set();
  const normalized = [];
  for (const parameter of parameters ?? []) {
    const key = traitSlug(parameter?.key);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push({ key, value: String(parameter?.value ?? "") });
  }
  return normalized;
}

export function traitReference(trait, parameters = []) {
  return {
    uuid: String(trait?.uuid ?? trait?.sourceUuid ?? ""),
    key: traitSlug(trait?.system?.key ?? trait?.key ?? trait?.buildKey ?? trait?.name),
    name: String(trait?.name ?? "").trim(),
    parameters: normalizeTraitParameters(parameters)
  };
}

export function normalizeTraitReference(reference) {
  return traitReference({
    uuid: reference?.uuid,
    key: reference?.key,
    name: reference?.name
  }, reference?.parameters);
}

export function mergeTraitReferences(current = [], incoming = []) {
  const references = current.map(normalizeTraitReference);
  const uuids = new Set(references.map((reference) => reference.uuid).filter(Boolean));
  const keys = new Set(references.map((reference) => reference.key).filter(Boolean));
  let added = 0;
  let duplicates = 0;
  for (const candidate of incoming.map(normalizeTraitReference)) {
    if (!candidate.uuid && !candidate.key) continue;
    if ((candidate.uuid && uuids.has(candidate.uuid)) || (candidate.key && keys.has(candidate.key))) {
      duplicates += 1;
      continue;
    }
    references.push(candidate);
    if (candidate.uuid) uuids.add(candidate.uuid);
    if (candidate.key) keys.add(candidate.key);
    added += 1;
  }
  return { references, added, duplicates };
}

export function removeTraitReference(references = [], identity = "") {
  return references.map(normalizeTraitReference).filter((reference) => (
    reference.uuid !== identity && reference.key !== traitSlug(identity)
  ));
}

export function traitReferences(owner, { modeKey = "" } = {}) {
  if (!owner) return [];
  if (owner.type === "trait") return [traitReference(owner)];
  const embeddedTraits = Array.from(owner.items ?? [])
    .filter((item) => item.type === "trait")
    .map((item) => traitReference(item));
  if (embeddedTraits.length > 0) return mergeTraitReferences([], embeddedTraits).references;
  const direct = owner.system?.traitRefs ?? [];
  if (!modeKey || owner.type !== "weapon") return direct.map(normalizeTraitReference);
  const mode = (owner.system?.modes ?? []).find((candidate) => candidate.key === modeKey);
  return mergeTraitReferences(direct, mode?.traitRefs ?? []).references;
}

export function hasTrait(owner, key, options = {}) {
  const normalized = traitSlug(key);
  return traitReferences(owner, options).some((reference) => reference.key === normalized);
}

const traitRuleResolvers = new Map();

export function registerTraitRule(key, resolver) {
  const normalized = traitSlug(key);
  if (!normalized || typeof resolver !== "function") throw new TypeError("Invalid trait rule resolver");
  traitRuleResolvers.set(normalized, resolver);
}

export function unregisterTraitRule(key) {
  traitRuleResolvers.delete(traitSlug(key));
}

export function resolveTraitRules(owner, context = {}, options = {}) {
  return traitReferences(owner, options).flatMap((reference) => {
    const resolver = traitRuleResolvers.get(reference.key);
    if (!resolver) return [];
    const result = resolver({ owner, reference, context });
    return Array.isArray(result) ? result : result == null ? [] : [result];
  });
}

export function parseLegacyTraitText(value, catalog = []) {
  const byName = new Map(catalog.map((trait) => [traitSlug(trait.name), trait]));
  const references = [];
  const unknown = [];
  for (const raw of String(value ?? "").split(/[,;\n]/).map((entry) => entry.trim()).filter(Boolean)) {
    const passive = raw.match(/^Bloqueo Pasivo\s+(\d+)\s+Localizaciones$/i);
    const lookup = passive ? "bloqueo-pasivo" : traitSlug(raw.replace(/\*$/, ""));
    const trait = byName.get(lookup) ?? catalog.find((candidate) => (
      traitSlug(candidate.system?.key ?? candidate.key ?? candidate.buildKey) === lookup
    ));
    if (!trait) {
      unknown.push(raw);
      continue;
    }
    references.push(traitReference(trait, passive
      ? [{ key: "locations", value: passive[1] }] : []));
  }
  return { references: mergeTraitReferences([], references).references, legacyText: unknown.join(", ") };
}
