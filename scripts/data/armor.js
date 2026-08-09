import { MYTHRAS_REVISED_SOURCE } from "./sources.js";
import { ARMOR_MATERIAL_MODIFIERS, ARMOR_REFERENCE_LOCATIONS,
  armorPieceTypeForLocation } from "../rules/armor.js";

export const ARMOR_PROFILES = Object.freeze([
  { key: "natural-cured", name: "Natural/curtida", construction: "flexible",
    examples: "Pieles, cuero", armorPoints: 1, encumbrance: 2, value: 20,
    material: "leather", era: "all" },
  { key: "padded-reinforced", name: "Acolchada/reforzada", construction: "flexible",
    examples: "Gambesón, cuero endurecido", armorPoints: 2, encumbrance: 1, value: 80,
    material: "linen", era: "all" },
  { key: "laminated", name: "Laminada", construction: "flexible",
    examples: "Linotórax, bezanteada", armorPoints: 3, encumbrance: 2, value: 180,
    material: "linen", era: "ancient-medieval" },
  { key: "scales", name: "Escamas", construction: "flexible",
    examples: "Brigantina, lamelar", armorPoints: 4, encumbrance: 3, value: 320,
    material: "bronze", era: "ancient-renaissance" },
  { key: "cuirass", name: "Coraza", construction: "rigid",
    examples: "Coraza de hoplita", armorPoints: 5, encumbrance: 4, value: 500,
    material: "bronze", era: "ancient-renaissance" },
  { key: "mail", name: "Mallas", construction: "rigid",
    examples: "Cota de mallas o anillos", armorPoints: 6, encumbrance: 5, value: 900,
    material: "iron", era: "ancient-renaissance" },
  { key: "plate-mail", name: "Placa y mallas", construction: "rigid",
    examples: "Loriga segmentada", armorPoints: 7, encumbrance: 6, value: 1400,
    material: "iron", era: "medieval-industrial" },
  { key: "articulated-plate", name: "Articulada de placas", construction: "rigid",
    examples: "Completa de campaña", armorPoints: 8, encumbrance: 7, value: 2400,
    material: "iron", era: "medieval-industrial" }
]);

export const ARMOR_LOCATION_NAMES = Object.freeze({
  rightLeg: "Greba derecha",
  leftLeg: "Greba izquierda",
  abdomen: "Faldar",
  chest: "Peto",
  rightArm: "Brazal derecho",
  leftArm: "Brazal izquierdo",
  head: "Yelmo",
  special: "Pieza de armadura"
});

export const ARMOR_MATERIAL_NAMES = Object.freeze({
  steel: "acero", bronze: "bronce", shell: "caparazón", leather: "cuero",
  iron: "hierro", bone: "hueso", linen: "lino", ivory: "marfil", stone: "piedra",
  chitin: "quitina", silk: "seda"
});

export function armorDefaultName(referenceLocation, material) {
  const piece = ARMOR_LOCATION_NAMES[referenceLocation] ?? ARMOR_LOCATION_NAMES.special;
  const materialName = ARMOR_MATERIAL_NAMES[material] ?? String(material ?? "").trim();
  return materialName ? `${piece} de ${materialName}` : piece;
}

function armorPiece(profile, referenceLocation) {
  const name = armorDefaultName(referenceLocation, profile.material);
  const buildKey = `${profile.key}-${referenceLocation.replace(/[A-Z]/g,
    (letter) => `-${letter.toLowerCase()}`)}`;
  return {
    buildKey,
    name,
    type: "armor",
    img: "systems/mythras-foundry/assets/icons/armor.svg",
    system: {
      source: MYTHRAS_REVISED_SOURCE,
      quantity: 1,
      weight: profile.encumbrance * ARMOR_MATERIAL_MODIFIERS[profile.material],
      value: profile.value,
      location: "",
      equipped: false,
      profileKey: profile.key,
      profileName: profile.name,
      pieceType: armorPieceTypeForLocation(referenceLocation),
      construction: profile.construction,
      material: profile.material,
      materialModifier: ARMOR_MATERIAL_MODIFIERS[profile.material],
      referenceLocation,
      designedSize: 0,
      designedBuild: "",
      armorPoints: profile.armorPoints,
      armorPointsFormula: "",
      baseEncumbrance: profile.encumbrance / ARMOR_MATERIAL_MODIFIERS[profile.material],
      baseValue: profile.value,
      locationValues: {},
      armorRulesVersion: 3,
      coveredLocationIds: [],
      coverageMigrated: true,
      penalty: 0,
      era: profile.era,
      coverage: "",
      description: `<p><strong>${profile.name}</strong> (${profile.examples}). Protege una sola localización con ${profile.armorPoints} PA. Con su material habitual tiene CRG ${profile.encumbrance}; al cambiar el material se aplica el multiplicador correspondiente.</p>`
    },
    flags: { "mythras-foundry": { source: "mythras-basic-revised" } }
  };
}

export const ARMOR_SOURCES = Object.freeze(ARMOR_PROFILES.flatMap((profile) =>
  ARMOR_REFERENCE_LOCATIONS.map((location) => armorPiece(profile, location))));
