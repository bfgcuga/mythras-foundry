const armor = ({ key, name, armorPoints, era }) => ({
  buildKey: key,
  name,
  type: "armor",
  img: "icons/svg/breastplate.svg",
  system: {
    quantity: 1,
    weight: 0,
    value: 0,
    location: "",
    equipped: false,
    armorPoints,
    era,
    coverage: "",
    description: ""
  },
  flags: { "mythras-foundry": { source: "mythras-imperative-srd" } }
});

export const ANCIENT_ARMOR_SOURCES = Object.freeze([
  armor({ key: "pieles-cueros", name: "Pieles/Cueros", armorPoints: 1, era: "ancient" }),
  armor({ key: "aketon-gambeson", name: "Aketón/Gambesón", armorPoints: 2, era: "ancient" }),
  armor({ key: "linotorax", name: "Linotórax", armorPoints: 3, era: "ancient" }),
  armor({ key: "brigandina", name: "Brigandina", armorPoints: 4, era: "ancient" }),
  armor({ key: "placa-hoplita", name: "Placa Hoplita", armorPoints: 5, era: "ancient" }),
  armor({ key: "cota-malla", name: "Cota de Malla", armorPoints: 6, era: "ancient" }),
  armor({ key: "malla-plaqueada", name: "Malla Plaqueada", armorPoints: 7, era: "ancient" })
]);

export const MODERN_ARMOR_SOURCES = Object.freeze([
  armor({ key: "chaqueta-moto", name: "Chaqueta de Moto", armorPoints: 1, era: "modern" }),
  armor({ key: "equipo-deportivo", name: "Equipo Deportivo", armorPoints: 2, era: "modern" }),
  armor({ key: "tela-balistica", name: "Tela Balística", armorPoints: 3, era: "modern" }),
  armor({ key: "chaleco-antibalas", name: "Chaleco Antibalas", armorPoints: 4, era: "modern" }),
  armor({ key: "equipo-antidisturbios", name: "Equipo Antidisturbios", armorPoints: 5, era: "modern" }),
  armor({ key: "chaleco-antibalas-tipo-i", name: "Chaleco Antibalas Tipo I", armorPoints: 6, era: "modern" }),
  armor({ key: "chaleco-antibalas-tipo-ii", name: "Chaleco Antibalas Tipo II", armorPoints: 7, era: "modern" }),
  armor({ key: "chaleco-antibalas-tipo-iii", name: "Chaleco Antibalas Tipo III", armorPoints: 8, era: "modern" }),
  armor({ key: "chaleco-antibalas-tipo-iv", name: "Chaleco Antibalas Tipo IV", armorPoints: 10, era: "modern" })
]);

export const FUTURISTIC_ARMOR_SOURCES = Object.freeze([
  armor({ key: "armadura-corporal-liquida", name: "Armadura Corporal Líquida", armorPoints: 4, era: "futuristic" }),
  armor({ key: "malla-adaptativa", name: "Malla Adaptativa", armorPoints: 6, era: "futuristic" }),
  armor({ key: "armadura-asalto-ligera", name: "Armadura de Asalto Ligera", armorPoints: 8, era: "futuristic" }),
  armor({ key: "armadura-asalto-completa", name: "Armadura de Asalto Completa", armorPoints: 12, era: "futuristic" })
]);

export const ARMOR_SOURCES = Object.freeze([
  ...ANCIENT_ARMOR_SOURCES,
  ...MODERN_ARMOR_SOURCES,
  ...FUTURISTIC_ARMOR_SOURCES
]);
