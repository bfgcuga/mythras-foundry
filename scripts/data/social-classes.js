import { MYTHRAS_REVISED_SOURCE } from "./sources.js";

const socialClass = (key, name, range, moneyModifier, titles, resources) => Object.freeze({
  key, name, range: Object.freeze(range), moneyModifier, titles, resources
});

export const SOCIAL_CLASSES_BY_CULTURE = Object.freeze({
  barbara: Object.freeze([
    socialClass("outcast", "Paria", [1, 5], 0.25, "Exiliado, proscrito.",
      "Nada, salvo la ropa que lleva puesta, y quizá algo de armamento personal."),
    socialClass("slave", "Esclavo", [6, 15], 0.5, "Caxtos, esclavo, peón, siervo, thrall.",
      "Reside en las propiedades de su dueño. Posee algunos objetos de valor sentimental."),
    socialClass("freeman", "Hombre libre", [16, 80], 1,
      "Churl, feine, jornalero, karl, liberto, plebeyo.",
      "Granja o alojamiento en alquiler. Posee sus propias herramientas o ganado y armas simples."),
    socialClass("burgher", "Burgués", [81, 95], 3,
      "Ealdorman, flaith, hauldr, reeve, thane.",
      "Posee una casa y una granja, negocio o barco; mobiliario, herramientas, armas y armadura, montura, sirvientes o esclavos y el respaldo de los conciudadanos."),
    socialClass("ruler", "Gobernante", [96, 100], 5,
      "Cacique, cyning, eorl, jarl, rey.",
      "Como un burgués, pero vive en un gran salón, posee bienes de gran calidad y cuenta con la lealtad del país o de una región.")
  ]),
  civilizada: Object.freeze([
    socialClass("outcast", "Paria", [1, 2], 0.25,
      "Indigente, mendigo, pordiosero, vagabundo.",
      "Nada, salvo la ropa que lleva puesta, y quizá algo de armamento personal."),
    socialClass("slave", "Esclavo", [3, 20], 0.5,
      "Cautivo, ilota, propiedad, siervo.",
      "Reside en las propiedades de su dueño. Posee algunos objetos de valor sentimental."),
    socialClass("freeman", "Hombre libre", [21, 70], 1,
      "Arrendatario, campesino, ciudadano, proletario, vasallo.",
      "Granja o alojamiento en alquiler. Posee sus propias herramientas o ganado y armas simples."),
    socialClass("burgher", "Burgués", [71, 95], 3,
      "Alguacil, équite, funcionario, magistrado, senescal, guardián.",
      "Posee una casa y una granja, negocio o barco; mobiliario, herramientas, armas y armadura, montura, sirvientes o esclavos y el respaldo de los conciudadanos."),
    socialClass("aristocrat", "Aristócrata", [96, 99], 5,
      "Arconte, barón, conde, duque, lord, nabab, noble, oligarca, patricio, sátrapa.",
      "Posee varias propiedades, grandes granjas o negocios, bienes caros, monturas, numerosos sirvientes o esclavos y la lealtad de los habitantes de la región."),
    socialClass("ruler", "Gobernante", [100, 100], 10,
      "Califa, dictador, emperador, faraón, imperator, magnate, maharajá, pachá, potentado, príncipe, rajá, sha, sultán, tirano, zar.",
      "Como un aristócrata, pero con posesiones de calidad inestimable y la lealtad de un dominio o nación.")
  ]),
  nomada: Object.freeze([
    socialClass("outcast", "Paria", [1, 5], 0.25, "Proscrito, rebelde.",
      "Nada, salvo la ropa que lleva puesta y quizá armamento personal. Una montura o bote si es apropiado."),
    socialClass("slave", "Esclavo", [6, 10], 0.5,
      "Convicto, desviado, prisionero, thrall.",
      "Reside en tierras conquistadas o en la yurta o navío de su dueño. Posee objetos sentimentales y algunas herramientas o armas simples."),
    socialClass("freeman", "Hombre libre", [11, 90], 1,
      "Allegado, arad, haran, súbdito.",
      "Posee montura, carro o bote, una yurta, algo de ganado, armas, armadura simple y uno o dos esclavos."),
    socialClass("ruler", "Gobernante", [91, 100], 3,
      "Cacique, emir, jeque, kan, khaqan, señor del mar.",
      "Posee muchas monturas, carros o botes, una gran yurta, ganado, buenas armas y armadura, esclavos y la lealtad de la tribu y sus pueblos conquistados.")
  ]),
  primitiva: Object.freeze([
    socialClass("outcast", "Paria", [1, 5], 0.25, "Proscrito.",
      "Un arma y algunos abalorios."),
    socialClass("freeman", "Hombre libre", [6, 80], 1, "Miembro de la tribu.",
      "Un hogar simple, herramientas y armas primitivas."),
    socialClass("ruler", "Gobernante", [81, 100], 2, "Anciano, cacique.",
      "Gran salón, pieles valiosas, tótems, trofeos, herramientas, utensilios, armas primitivas ornamentadas, armadura simple y el respaldo de la tribu.")
  ])
});

export const STARTING_MONEY_BY_CULTURE = Object.freeze({
  barbara: Object.freeze({ formula: "4d6x50", silverPerPoint: 50 }),
  civilizada: Object.freeze({ formula: "4d6x75", silverPerPoint: 75 }),
  nomada: Object.freeze({ formula: "4d6x25", silverPerPoint: 25 }),
  primitiva: Object.freeze({ formula: "4d6x10", silverPerPoint: 10 })
});

export function socialClassesForCulture(cultureKey) {
  return SOCIAL_CLASSES_BY_CULTURE[cultureKey] ?? [];
}

export function getSocialClass(cultureKey, classKey) {
  return socialClassesForCulture(cultureKey).find((entry) => entry.key === classKey);
}

export function resolveSocialClass(cultureKey, roll) {
  const result = Math.max(1, Math.min(100, Number(roll) || 1));
  return socialClassesForCulture(cultureKey)
    .find((entry) => result >= entry.range[0] && result <= entry.range[1]);
}

export function calculateStartingMoney(cultureKey, socialClassKey, diceTotal) {
  const money = STARTING_MONEY_BY_CULTURE[cultureKey];
  const classEntry = getSocialClass(cultureKey, socialClassKey);
  if (!money || !classEntry) return 0;
  return Number(diceTotal) * money.silverPerPoint * classEntry.moneyModifier;
}

export const SOCIAL_CLASS_TABLE_SOURCES = Object.entries(SOCIAL_CLASSES_BY_CULTURE)
  .map(([cultureKey, entries]) => ({
    buildKey: `social-class-${cultureKey}`,
    cultureKey,
    name: `Clase social: ${{
      barbara: "Bárbara", civilizada: "Civilizada", nomada: "Nómada", primitiva: "Primitiva"
    }[cultureKey]}`,
    formula: "1d100",
    source: MYTHRAS_REVISED_SOURCE,
    results: entries
  }));
