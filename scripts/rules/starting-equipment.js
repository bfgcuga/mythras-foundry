export const STARTING_EQUIPMENT_BY_CLASS = Object.freeze({
  outcast: Object.freeze({
    clothing: "Una muda de ropa harapienta y probablemente sucia.",
    weaponFormula: "1", weaponTier: "any", armorFormula: "1d6-3",
    armorLocationsFormula: "1d3", transport: []
  }),
  slave: Object.freeze({
    clothing: "Una o dos mudas de ropa de calidad adecuadas a la posición y tipo de trabajo realizado por el esclavo.",
    weaponFormula: "0", weaponTier: "none", armorFormula: "0",
    armorLocationsFormula: "0", transport: []
  }),
  freeman: Object.freeze({
    clothing: "Dos mudas de ropa común y sin adornos adecuadas al oficio del hombre libre.",
    weaponFormula: "1d2", weaponTier: "simple", armorFormula: "1d3",
    armorLocationsFormula: "1d6",
    transport: ["Su propia espalda", "Balsa", "Carretilla", "Bestia de carga"]
  }),
  burgher: Object.freeze({
    clothing: "1d6+1 mudas de ropa, hechas de tela de buena calidad y un nivel modesto de adornos.",
    clothingFormula: "1d6+1", weaponFormula: "1d3+1", weaponTier: "status",
    armorFormula: "1d2+2", armorLocationsFormula: "7",
    transport: ["Porteador contratado o esclavo", "Bote", "Carromato", "Animal de monta"]
  }),
  aristocrat: Object.freeze({
    clothing: "1d6+3 mudas de ropa, hechas de telas caras y con muchos adornos.",
    clothingFormula: "1d6+3", weaponFormula: "1d3+3", weaponTier: "quality",
    armorFormula: "1d2+3", armorLocationsFormula: "7",
    transport: ["Palanquín", "Barco", "Carruaje", "Varias monturas excelentes"]
  }),
  ruler: Object.freeze({
    clothing: "1d6+6 mudas de ropa, hechas de materiales escasos y muy valiosos, y tan opulentos como permita el buen gusto.",
    clothingFormula: "1d6+6", weaponFormula: "1d3+6", weaponTier: "quality",
    armorFormula: "1d2+4", armorLocationsFormula: "7",
    transport: ["Palanquín caro con porteadores", "Barco de guerra", "Carruaje exquisito", "Varias monturas magníficas"]
  })
});

export const SIMPLE_WEAPON_KEYS = Object.freeze(new Set([
  "clava", "cuchillo", "hachuela", "hacha-batalla", "honda", "lanza-corta",
  "lanza-larga", "jabalina", "piedra-roca"
]));

export function replaceFormula(text, formula, result) {
  return formula ? String(text).replace(formula, String(result)) : String(text);
}

export function startingEquipmentRule(classKey) {
  return STARTING_EQUIPMENT_BY_CLASS[classKey] ?? STARTING_EQUIPMENT_BY_CLASS.freeman;
}

export function validateStartingEquipment(selection, rolls) {
  const weapons = selection?.weapons ?? [];
  const armor = selection?.armor ?? [];
  if (weapons.length !== rolls.weaponCount || weapons.some((value) => !value)) return false;
  if (armor.length !== rolls.armorLocations || armor.some((value) => !value)
    || new Set(armor).size !== armor.length) return false;
  return !rolls.transportRequired || Boolean(selection?.transport);
}
