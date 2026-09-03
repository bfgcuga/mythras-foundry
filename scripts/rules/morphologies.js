import { calculateLocationHitPoints, HUMAN_HIT_LOCATIONS } from "./hit-locations.js";

const zone = (locationKey, name, rangeStart, rangeEnd, role = "standard") => Object.freeze({
  locationKey, name, rangeStart, rangeEnd, role
});

const Z = zone;
const humanoid = HUMAN_HIT_LOCATIONS.map((entry) => Z(entry.nameKey, entry.name,
  entry.rangeStart, entry.rangeEnd, entry.hpClass === "arm" ? "arm" : entry.category));

export const MORPHOLOGIES = Object.freeze({
  humanoid: humanoid,
  arachnid: [Z("rearRightLeg", "Pata trasera derecha", 1, 2, "limb"), Z("rearLeftLeg", "Pata trasera izquierda", 3, 4, "limb"), Z("middleRightLeg", "Pata media derecha", 5, 6, "limb"), Z("middleLeftLeg", "Pata media izquierda", 7, 8, "limb"), Z("frontRightLeg", "Pata delantera derecha", 9, 10, "limb"), Z("frontLeftLeg", "Pata delantera izquierda", 11, 12, "limb"), Z("abdomen", "Abdomen", 13, 14, "abdomen"), Z("frontalRightLeg", "Pata frontal derecha", 15, 16, "limb"), Z("frontalLeftLeg", "Pata frontal izquierda", 17, 18, "limb"), Z("cephalothorax", "Cefalotórax", 19, 20, "chest")],
  tailedArachnid: [Z("tail", "Cola", 1, 2, "limb"), Z("rearRightLeg", "Pata trasera derecha", 3, 3, "limb"), Z("rearLeftLeg", "Pata trasera izquierda", 4, 4, "limb"), Z("middleRightLeg", "Pata media derecha", 5, 5, "limb"), Z("middleLeftLeg", "Pata media izquierda", 6, 6, "limb"), Z("frontRightLeg", "Pata delantera derecha", 7, 7, "limb"), Z("frontLeftLeg", "Pata delantera izquierda", 8, 8, "limb"), Z("thorax", "Tórax", 9, 12, "chest"), Z("rightPincer", "Pinza derecha", 13, 15, "arm"), Z("leftPincer", "Pinza izquierda", 16, 18, "arm"), Z("cephalothorax", "Cefalotórax", 19, 20, "chest")],
  wingedBiped: [Z("rightLeg", "Pierna derecha", 1, 3, "limb"), Z("leftLeg", "Pierna izquierda", 4, 6, "limb"), Z("abdomen", "Abdomen", 7, 9, "abdomen"), Z("chest", "Pecho", 10, 10, "chest"), Z("rightWing", "Ala derecha", 11, 12, "arm"), Z("leftWing", "Ala izquierda", 13, 14, "arm"), Z("rightArm", "Brazo derecho", 15, 16, "arm"), Z("leftArm", "Brazo izquierdo", 17, 18, "arm"), Z("head", "Cabeza", 19, 20, "head")],
  tailedBiped: [Z("tail", "Cola", 1, 3, "limb"), Z("rightLeg", "Pierna derecha", 4, 5, "limb"), Z("leftLeg", "Pierna izquierda", 6, 7, "limb"), Z("abdomen", "Abdomen", 8, 10, "abdomen"), Z("chest", "Pecho", 11, 14, "chest"), Z("rightArm", "Brazo derecho", 15, 16, "arm"), Z("leftArm", "Brazo izquierdo", 17, 18, "arm"), Z("head", "Cabeza", 19, 20, "head")],
  centauroid: [Z("rearRightLeg", "Pata trasera derecha", 1, 3, "limb"), Z("rearLeftLeg", "Pata trasera izquierda", 4, 6, "limb"), Z("hindquarters", "Cuartos traseros", 7, 8, "abdomen"), Z("forequarters", "Cuartos delanteros", 9, 10, "chest"), Z("frontRightLeg", "Pata delantera derecha", 11, 12, "limb"), Z("frontLeftLeg", "Pata delantera izquierda", 13, 14, "limb"), Z("chest", "Pecho", 15, 16, "chest"), Z("rightArm", "Brazo derecho", 17, 17, "arm"), Z("leftArm", "Brazo izquierdo", 18, 18, "arm"), Z("head", "Cabeza", 19, 20, "head")],
  draconian: [Z("tail", "Cola", 1, 2, "limb"), Z("rearRightLeg", "Pata trasera derecha", 3, 4, "limb"), Z("rearLeftLeg", "Pata trasera izquierda", 5, 6, "limb"), Z("hindquarters", "Cuartos traseros", 7, 8, "abdomen"), Z("rightWing", "Ala derecha", 9, 10, "arm"), Z("leftWing", "Ala izquierda", 11, 12, "arm"), Z("forequarters", "Cuartos delanteros", 13, 14, "chest"), Z("frontRightLeg", "Pata delantera derecha", 15, 16, "limb"), Z("frontLeftLeg", "Pata delantera izquierda", 17, 18, "limb"), Z("head", "Cabeza", 19, 20, "head")],
  serpentine: [Z("tailTip", "Punta de la cola", 1, 2, "limb"), Z("rearFinalSection", "Sección trasera final", 3, 4, "abdomen"), Z("rearInitialSection", "Sección trasera inicial", 5, 7, "abdomen"), Z("middleFinalSection", "Sección media final", 8, 10, "abdomen"), Z("middleCentralSection", "Sección media central", 11, 13, "chest"), Z("middleInitialSection", "Sección media inicial", 14, 16, "chest"), Z("frontFinalSection", "Sección delantera final", 17, 17, "chest"), Z("frontInitialSection", "Sección delantera inicial", 18, 18, "chest"), Z("head", "Cabeza", 19, 20, "head")],
  wingedQuadruped: [Z("rearRightLeg", "Pata trasera derecha", 1, 2, "limb"), Z("rearLeftLeg", "Pata trasera izquierda", 3, 4, "limb"), Z("hindquarters", "Cuartos traseros", 5, 7, "abdomen"), Z("forequarters", "Cuartos delanteros", 8, 10, "chest"), Z("rightWing", "Ala derecha", 11, 12, "arm"), Z("leftWing", "Ala izquierda", 13, 14, "arm"), Z("frontRightLeg", "Pata delantera derecha", 15, 16, "limb"), Z("frontLeftLeg", "Pata delantera izquierda", 17, 18, "limb"), Z("head", "Cabeza", 19, 20, "head")],
  tailedQuadruped: [Z("tail", "Cola", 1, 3, "limb"), Z("rearRightLeg", "Pata trasera derecha", 4, 5, "limb"), Z("rearLeftLeg", "Pata trasera izquierda", 6, 7, "limb"), Z("hindquarters", "Cuartos traseros", 8, 10, "abdomen"), Z("forequarters", "Cuartos delanteros", 11, 14, "chest"), Z("frontRightLeg", "Pata delantera derecha", 15, 16, "limb"), Z("frontLeftLeg", "Pata delantera izquierda", 17, 18, "limb"), Z("head", "Cabeza", 19, 20, "head")],
  insect: [Z("rearRightLeg", "Pata trasera derecha", 1, 1, "limb"), Z("rearLeftLeg", "Pata trasera izquierda", 2, 2, "limb"), Z("middleRightLeg", "Pata media derecha", 3, 3, "limb"), Z("middleLeftLeg", "Pata media izquierda", 4, 4, "limb"), Z("abdomen", "Abdomen", 5, 9, "abdomen"), Z("thorax", "Tórax", 10, 13, "chest"), Z("frontRightLeg", "Pata delantera derecha", 14, 14, "limb"), Z("frontLeftLeg", "Pata delantera izquierda", 15, 15, "limb"), Z("head", "Cabeza", 16, 20, "head")],
  wingedInsect: [Z("rearRightLeg", "Pata trasera derecha", 1, 1, "limb"), Z("rearLeftLeg", "Pata trasera izquierda", 2, 2, "limb"), Z("metathorax", "Metatórax", 3, 4, "abdomen"), Z("middleRightLeg", "Pata media derecha", 5, 5, "limb"), Z("middleLeftLeg", "Pata media izquierda", 6, 6, "limb"), Z("prothorax", "Protórax", 7, 10, "chest"), Z("rightWing", "Ala derecha", 11, 12, "arm"), Z("leftWing", "Ala izquierda", 13, 14, "arm"), Z("rightForearm", "Antebrazo derecho", 15, 16, "arm"), Z("leftForearm", "Antebrazo izquierdo", 17, 18, "arm"), Z("head", "Cabeza", 19, 20, "head")],
  dorsalFinnedSwimmer: [Z("tail", "Cola", 1, 3, "limb"), Z("dorsalFin", "Aleta dorsal", 4, 6, "arm"), Z("hindquarters", "Cuartos traseros", 7, 10, "abdomen"), Z("forequarters", "Cuartos delanteros", 11, 14, "chest"), Z("rightFlipper", "Aleta derecha", 15, 16, "arm"), Z("leftFlipper", "Aleta izquierda", 17, 18, "arm"), Z("head", "Cabeza", 19, 20, "head")],
  pachyderm: [Z("rearRightLeg", "Pata trasera derecha", 1, 2, "limb"), Z("rearLeftLeg", "Pata trasera izquierda", 3, 4, "limb"), Z("hindquarters", "Cuartos traseros", 5, 8, "abdomen"), Z("forequarters", "Cuartos delanteros", 9, 12, "chest"), Z("frontRightLeg", "Pata delantera derecha", 13, 14, "limb"), Z("frontLeftLeg", "Pata delantera izquierda", 15, 16, "limb"), Z("trunk", "Trompa", 17, 17, "arm"), Z("head", "Cabeza", 18, 20, "head")]
});

export const MORPHOLOGY_KEYS = Object.freeze(["custom", ...Object.keys(MORPHOLOGIES)]);
export const MORPHOLOGY_LOCATION_KEYS = Object.freeze([...new Set(Object.values(MORPHOLOGIES)
  .flat().map((entry) => entry.locationKey))]);

const roleMechanics = (role) => ({
  category: ["arm", "limb"].includes(role) ? "limb" : role === "head" ? "head"
    : role === "chest" ? "chest" : role === "abdomen" ? "abdomen" : "other",
  hpClass: role === "arm" ? "arm" : role === "chest" ? "chest"
    : role === "abdomen" ? "abdomen" : "standard",
  armorEncumbranceMultiplier: role === "arm" ? 1 : role === "chest" ? 3
    : role === "abdomen" ? 2 : 1.5,
  armorCostPercentage: role === "arm" ? 7.5 : role === "chest" ? 25
    : role === "abdomen" ? 20 : role === "head" ? 10 : 15
});

export function morphologyLocationData(actorSystem, morphologyKey) {
  return (MORPHOLOGIES[morphologyKey] ?? []).map((entry) => {
    const mechanics = roleMechanics(entry.role);
    const maximum = calculateLocationHitPoints(actorSystem?.constitution, actorSystem?.size,
      mechanics.hpClass);
    return { name: entry.name, type: "hitLocation", system: {
      morphologyKey, locationKey: entry.locationKey, nameKey: entry.locationKey,
      rangeStart: entry.rangeStart, rangeEnd: entry.rangeEnd, ...mechanics,
      autoCalculate: true, maxHitPoints: maximum, currentHitPoints: maximum,
      armorPoints: 0,
      armorFactorsVersion: 3, disabled: false,
      permanentWound: { severity: 0, roll: 0, originalMaxHitPoints: 0,
        effectiveMaxHitPoints: 0, lostHitResults: 0, description: "" }
    } };
  });
}

const normalize = (value) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function morphologyLocationKey(location, morphologyKey = "") {
  const system = location?.system ?? location ?? {};
  const stored = String(system.locationKey || system.nameKey || "");
  const template = MORPHOLOGIES[morphologyKey] ?? [];
  if (stored && template.some((entry) => entry.locationKey === stored)) return stored;
  const name = normalize(location?.name);
  return template.find((entry) => normalize(entry.name) === name)?.locationKey ?? "";
}

export function semanticLocationKey(location, morphologyKey = "") {
  const stored = String(location?.system?.locationKey ?? location?.locationKey
    ?? location?.system?.nameKey ?? location?.nameKey ?? "");
  if (MORPHOLOGY_LOCATION_KEYS.includes(stored)) return stored;
  const scoped = morphologyLocationKey(location, morphologyKey);
  if (scoped) return scoped;
  const name = normalize(location?.name);
  const candidates = [...new Set(Object.values(MORPHOLOGIES).flat()
    .filter((entry) => normalize(entry.name) === name).map((entry) => entry.locationKey))];
  return candidates.length === 1 ? candidates[0] : "";
}

export function identifyMorphology(locations = []) {
  const entries = Array.from(locations);
  const matches = Object.entries(MORPHOLOGIES).filter(([, template]) =>
    template.length === entries.length && template.every((expected) => entries.some((location) => {
      const system = location.system ?? location;
      return Number(system.rangeStart) === expected.rangeStart
        && Number(system.rangeEnd) === expected.rangeEnd
        && (String(system.locationKey || system.nameKey || "") === expected.locationKey
          || normalize(location.name) === normalize(expected.name));
    })));
  return matches.length === 1 ? matches[0][0] : "custom";
}
