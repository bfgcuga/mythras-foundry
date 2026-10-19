// Estadísticas de Mythras básico revisado, págs. 237-289.
// Los daños de armas incluyen aquí el modificador impreso; el adaptador lo separa.
export const REVISED_CREATURE_PROFILES = Object.freeze([
  {
    "key": "acefalo",
    "name": "Acéfalo",
    "page": 237,
    "characteristics": {
      "FUE": { "value": 13, "formula": "2d6+6" },
      "CON": { "value": 11, "formula": "3d6" },
      "TAM": { "value": 13, "formula": "2d6+6" },
      "DES": { "value": 13, "formula": "2d6+6" },
      "INT": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 3,
    "magicPoints": 11,
    "initiative": 11,
    "damageModifier": "+1d2",
    "movement": "8m",
    "armor": "Normalmente cuero",
    "traits": "Ninguno",
    "magic": "Magia Común 56% (Confusión, Coordinación, Flecha Ígnea)",
    "locations": [
      [1, 3, "Pierna derecha", 1, 5],
      [4, 6, "Pierna izquierda", 1, 5],
      [7, 10, "Abdomen", 0, 6],
      [11, 14, "Pecho/Cara", 0, 7],
      [15, 17, "Brazo derecho", 1, 4],
      [18, 20, "Brazo izquierdo", 1, 4]
    ],
    "skills": [
      ["Aguante", 52],
      ["Atletismo", 56],
      ["Evadir", 46],
      ["Músculo", 46],
      ["Percepción", 44],
      ["Rastrear", 54],
      ["Supervivencia", 52],
      ["Voluntad", 52]
    ],
    "passions": [
      ["Amor por la Soledad", 88],
      ["Suspicaz con los Extraños", 80]
    ],
    "styles": [
      ["Cazador acéfalo (arco, boleadoras, honda)", 66],
      ["Postura defensiva (escudo, lanza)", 56]
    ],
    "weapons": [
      ["Arco corto", "G", "15/100/200", "1d6+1d2", "4/4"],
      ["Boleadoras", "-", "10/25/30", "1d4", "2/2 (Enredar)"],
      ["Escudo heraldo", "G", "C", "1d4+1d2", "6/12"],
      ["Honda", "G", "-", "1d8", "1/2"],
      ["Lanza corta", "M", "L", "1d8+1+1d2", "4/5"]
    ]
  },
  {
    "key": "arana-gigante",
    "name": "Araña gigante",
    "page": 238,
    "characteristics": {
      "FUE": { "value": 20, "formula": "3d6+9" },
      "CON": { "value": 17, "formula": "3d6+6" },
      "TAM": { "value": 29, "formula": "3d6+18" },
      "DES": { "value": 20, "formula": "3d6+9" },
      "INS": { "value": 9, "formula": "2d6+2" },
      "POD": { "value": 4, "formula": "1d6" }
    },
    "actionPoints": 3,
    "magicPoints": 4,
    "initiative": 15,
    "damageModifier": "+1d10",
    "movement": "10m.",
    "armor": "Exoesqueleto",
    "traits": "Adherencia, Apresar, Sentido de la Tierra, Venenoso",
    "magic": "Ninguna",
    "locations": [
      [1, 2, "Pata trasera derecha", 4, 9],
      [3, 4, "Pata trasera izquierda", 4, 9],
      [5, 6, "Pata central derecha", 4, 9],
      [7, 8, "Pata central izquierda", 4, 9],
      [9, 10, "Pata delantera derecha", 4, 9],
      [11, 12, "Pata delantera izquierda", 4, 9],
      [13, 14, "Abdomen", 4, 12],
      [15, 16, "Pata frontal derecha", 4, 9],
      [17, 18, "Pata frontal izquierda", 4, 9],
      [19, 20, "Cefalotórax", 4, 11]
    ],
    "skills": [
      ["Aguante", 64],
      ["Atletismo", 80],
      ["Evadir", 80],
      ["Músculo", 69],
      ["Percepción", 53],
      ["Sigilo", 69],
      ["Voluntad", 48]
    ],
    "passions": [],
    "styles": [
      ["Horror de ocho patas (mandíbulas, patas)", 80]
    ],
    "weapons": [
      ["Mandíbulas", "G", "T", "1d6+1d10", "Como cabeza"],
      ["Patas", "G", "ML", "Presa", "Como pata"]
    ]
  },
  {
    "key": "arpia",
    "name": "Arpía",
    "page": 239,
    "characteristics": {
      "FUE": { "value": 11, "formula": "3d6" },
      "CON": { "value": 11, "formula": "3d6" },
      "TAM": { "value": 13, "formula": "1d6+9" },
      "DES": { "value": 20, "formula": "4d6+6" },
      "INT": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 4, "formula": "1d6" }
    },
    "actionPoints": 3,
    "magicPoints": 11,
    "initiative": 17,
    "damageModifier": "0",
    "movement": "4m, 12m (Volando)",
    "armor": "Plumas",
    "traits": "Ataque en Picado, Volador",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Pata derecha", 1, 5],
      [4, 6, "Pata izquierda", 1, 5],
      [7, 9, "Abdomen", 1, 6],
      [10, 12, "Pecho", 0, 7],
      [13, 15, "Ala derecha", 1, 4],
      [16, 18, "Ala izquierda", 1, 4],
      [19, 20, "Cabeza", 0, 5]
    ],
    "skills": [
      ["Aguante", 42],
      ["Atletismo", 51],
      ["Engañar", 57],
      ["Evadir", 60],
      ["Músculo", 44],
      ["Percepción", 64],
      ["Volar", 71],
      ["Voluntad", 42]
    ],
    "passions": [
      ["Amor por el Sufrimiento", 95],
      ["Avaricia", 99],
      ["Rencor", 95]
    ],
    "styles": [
      ["Agarrones y zarpazos (garras)", 71]
    ],
    "weapons": [
      ["Garras", "M", "M", "1d4", "Como pata"]
    ]
  },
  {
    "key": "asipatra",
    "name": "Asipatra",
    "page": 239,
    "characteristics": {
      "FUE": { "value": 13, "formula": "1d6+9" },
      "CON": { "value": 11, "formula": "3d6" },
      "TAM": { "value": 10, "formula": "1d6+6" },
      "DES": { "value": 20, "formula": "4d6+6" },
      "INS": { "value": 12, "formula": "2d6+5" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 3,
    "magicPoints": 7,
    "initiative": 16,
    "damageModifier": "0",
    "movement": "12m. (Volando)",
    "armor": "Plumas de metal",
    "traits": "Ataque en Picado, Inmunidad (Filos), Volador",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Pata derecha", 6, 5],
      [4, 6, "Pata izquierda", 6, 5],
      [7, 9, "Abdomen", 6, 6],
      [10, 12, "Pecho", 6, 7],
      [13, 15, "Ala derecha", 6, 5],
      [16, 18, "Ala izquierda", 6, 5],
      [19, 20, "Cabeza", 6, 5]
    ],
    "skills": [
      ["Aguante", 62],
      ["Atletismo", 32],
      ["Evadir", 60],
      ["Músculo", 23],
      ["Percepción", 59],
      ["Volar", 72],
      ["Voluntad", 54]
    ],
    "passions": [],
    "styles": [
      ["Cortar en rodajas (alas y garras)", 72]
    ],
    "weapons": [
      ["Alas cortantes", "M", "M", "1d6", "Como ala"],
      ["Garras", "P", "C", "1d4", "Como pata"]
    ]
  },
  {
    "key": "babuino",
    "name": "Babuino",
    "page": 240,
    "characteristics": {
      "FUE": { "value": 10, "formula": "1d6+6" },
      "CON": { "value": 11, "formula": "3d6" },
      "TAM": { "value": 10, "formula": "1d6+6" },
      "DES": { "value": 17, "formula": "3d6+6" },
      "INS": { "value": 14, "formula": "2d6+7" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 3,
    "magicPoints": 7,
    "initiative": 16,
    "damageModifier": "-1d2",
    "movement": "8m.",
    "armor": "Pelaje",
    "traits": "Visión Nocturna",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Pata derecha", 1, 5],
      [4, 6, "Pata izquierda", 1, 5],
      [7, 9, "Abdomen", 1, 6],
      [10, 12, "Pecho", 1, 7],
      [13, 15, "Brazo derecho", 1, 4],
      [16, 18, "Brazo izquierdo", 1, 4],
      [19, 20, "Cabeza", 1, 5]
    ],
    "skills": [
      ["Acrobacias", 57],
      ["Aguante", 42],
      ["Atletismo", 47],
      ["Evadir", 74],
      ["Músculo", 40],
      ["Percepción", 61],
      ["Sigilo", 61],
      ["Supervivencia", 58],
      ["Voluntad", 54]
    ],
    "passions": [],
    "styles": [
      ["Gresca feroz (lanzar objeto, mordisco, puño)", 67]
    ],
    "weapons": [
      ["Mordisco", "P", "T", "1d4-1d2", "Como cabeza"],
      ["Objeto arrojado", "P", "-", "1d3-1d2", "Depende del objeto"],
      ["Puñetazo", "P", "T", "1d3-1d2", "Como brazo"]
    ]
  },
  {
    "key": "bagini",
    "name": "Bagini",
    "page": 241,
    "characteristics": {
      "FUE": { "value": 19, "formula": "2d6+12" },
      "CON": { "value": 13, "formula": "2d6+6" },
      "TAM": { "value": 13, "formula": "2d6+6" },
      "DES": { "value": 17, "formula": "3d6+6" },
      "INT": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 3,
    "magicPoints": 11,
    "initiative": 15,
    "damageModifier": "+1d4",
    "movement": "8m.",
    "armor": "Piel",
    "traits": "Sentir la Vida, Visión Nocturna, Vampirismo.",
    "magic": "Magia Común 62% (Glamour, Sueño)",
    "locations": [
      [1, 3, "Pata derecha", 1, 5],
      [4, 6, "Pata izquierda", 1, 5],
      [7, 9, "Abdomen", 1, 6],
      [10, 12, "Pecho", 1, 7],
      [13, 15, "Brazo derecho", 1, 4],
      [16, 18, "Brazo izquierdo", 1, 4],
      [19, 20, "Cabeza", 1, 5]
    ],
    "skills": [
      ["Aguante", 56],
      ["Atletismo", 56],
      ["Evadir", 64],
      ["Músculo", 72],
      ["Influencia", 62],
      ["Percepción", 54],
      ["Seducción", 64],
      ["Sigilo", 50],
      ["Voluntad", 62]
    ],
    "passions": [
      ["Amor por el Sexo", 80],
      ["Hambre Insaciable", 80],
      ["Odio a los Mortales", 75]
    ],
    "styles": [
      ["Seducción salvaje (garras, mordisco, presa)", 67]
    ],
    "weapons": [
      ["Garras", "M", "M", "1d3+1d4", "Como brazo"],
      ["Mordisco", "M", "T", "1d2+1d4", "Como cabeza"]
    ]
  },
  {
    "key": "bakru",
    "name": "Bakru",
    "page": 242,
    "characteristics": {
      "FUE": { "value": 2, "formula": "1d3" },
      "CON": { "value": 5, "formula": "1d6+1" },
      "TAM": { "value": 2, "formula": "1d3" },
      "DES": { "value": 17, "formula": "3d6+6" },
      "INT": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 17, "formula": "3d6+6" },
      "CAR": { "value": 13, "formula": "2d6+6" }
    },
    "actionPoints": 3,
    "magicPoints": 17,
    "initiative": 15,
    "damageModifier": "-1d8",
    "movement": "6m",
    "armor": "Piel de madera",
    "traits": "Inmunidad (Armas Mundanas)",
    "magic": "Devoción 60%, Exhortación 66%, Magia Común 70%.",
    "locations": [
      [1, 3, "Pierna derecha", 1, 2],
      [4, 6, "Pierna izquierda", 1, 2],
      [7, 9, "Abdomen", 1, 3],
      [10, 12, "Pecho", 1, 4],
      [13, 15, "Brazo derecho", 1, 1],
      [16, 18, "Brazo izquierdo", 1, 1],
      [19, 20, "Cabeza", 1, 2]
    ],
    "stylesText": "Ninguno",
    "skills": [
      ["Acrobacias", 59],
      ["Aguante", 30],
      ["Atletismo", 49],
      ["Conocimiento Local", 66],
      ["Engañar", 66],
      ["Evadir", 74],
      ["Juego de Manos", 70],
      ["Músculo", 24],
      ["Percepción", 70],
      ["Sigilo", 70],
      ["Voluntad", 74]
    ],
    "passions": [
      ["Hacer Travesuras", 88],
      ["Sentirse Ofendido", 75]
    ],
    "styles": [],
    "weapons": []
  },
  {
    "key": "basilisco-cocatriz",
    "name": "Basilisco/Cocatriz",
    "page": 243,
    "characteristics": {
      "FUE": { "value": 5, "formula": "1d6+1" },
      "CON": { "value": 11, "formula": "3d6" },
      "TAM": { "value": 5, "formula": "1d6+1" },
      "DES": { "value": 13, "formula": "2d6+6" },
      "INS": { "value": 11, "formula": "2d6+4" },
      "POD": { "value": 19, "formula": "2d6+12" }
    },
    "actionPoints": 2,
    "magicPoints": 19,
    "initiative": 12,
    "damageModifier": "-1d6",
    "movement": "6m",
    "armor": "Escamas",
    "traits": "Ataque de Mirada, Aterrador, Sentir la Vida.",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Cola", 1, 4],
      [4, 5, "Pata derecha", 1, 4],
      [6, 7, "Pata izquierda", 1, 4],
      [8, 10, "Cuartos traseros", 1, 5],
      [11, 14, "Cuartos delanteros", 1, 6],
      [15, 16, "Ala derecha", 1, 3],
      [17, 18, "Ala izquierda", 1, 3],
      [19, 20, "Cabeza", 1, 4]
    ],
    "stylesText": "Ataque de Mirada (ver descripción).",
    "skills": [
      ["Aguante", 52],
      ["Atletismo", 48],
      ["Evadir", 66],
      ["Músculo", 30],
      ["Percepción", 69],
      ["Voluntad", 78]
    ],
    "passions": [],
    "styles": [],
    "weapons": []
  },
  {
    "key": "bonnacon",
    "name": "Bonnacon",
    "page": 243,
    "characteristics": {
      "FUE": { "value": 19, "formula": "2d6+12" },
      "CON": { "value": 16, "formula": "2d6+9" },
      "TAM": { "value": 26, "formula": "4d6+12" },
      "DES": { "value": 13, "formula": "2d6+6" },
      "INS": { "value": 11, "formula": "2d6+4" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 2,
    "magicPoints": 7,
    "initiative": 12,
    "damageModifier": "+1d8",
    "movement": "10m",
    "armor": "Piel gruesa",
    "traits": "Arrollar, Venenoso (Heces)",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Pata trasera derecha", 2, 9],
      [4, 6, "Pata trasera izquierda", 2, 9],
      [7, 9, "Cuartos traseros", 2, 10],
      [10, 12, "Cuartos delanteros", 2, 11],
      [13, 15, "Pata delantera derecha", 2, 9],
      [16, 18, "Pata delantera izquierda", 2, 9],
      [19, 20, "Cabeza", 2, 9]
    ],
    "skills": [
      ["Aguante", 62],
      ["Atletismo", 62],
      ["Evadir", 46],
      ["Músculo", 65],
      ["Percepción", 38],
      ["Voluntad", 34]
    ],
    "passions": [],
    "styles": [
      ["Cornada e incapacitación (cuernos)", 72]
    ],
    "weapons": [
      ["Arrollar", "E", "C", "2d8", "Como patas"],
      ["Cuernos", "M", "C", "1d10+1d8", "Como cabeza"]
    ]
  },
  {
    "key": "caballo",
    "name": "Caballo",
    "page": 244,
    "characteristics": {
      "FUE": { "value": 22, "formula": "2d6+15" },
      "CON": { "value": 13, "formula": "2d6+6" },
      "TAM": { "value": 31, "formula": "2d6+24" },
      "DES": { "value": 10, "formula": "2d6+3" },
      "INS": { "value": 11, "formula": "2d6+4" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 2,
    "magicPoints": 7,
    "initiative": 11,
    "damageModifier": "+1d12",
    "movement": "12m",
    "armor": "Piel",
    "traits": "Ninguno",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Pata trasera derecha", 1, 9],
      [4, 6, "Pata trasera izquierda", 1, 9],
      [7, 9, "Cuartos traseros", 1, 10],
      [10, 12, "Cuartos delanteros", 1, 11],
      [13, 14, "Pata delantera derecha", 1, 8],
      [15, 16, "Pata delantera izquierda", 1, 8],
      [17, 20, "Cabeza", 1, 9]
    ],
    "skills": [
      ["Aguante", 66],
      ["Atletismo", 52],
      ["Evadir", 40],
      ["Músculo", 83],
      ["Percepción", 48],
      ["Voluntad", 34]
    ],
    "passions": [],
    "styles": [
      ["Encabritarse y corcovear (pezuñas)", 62]
    ],
    "weapons": [
      ["Pezuñas", "E", "L", "1d6+1d12", "Como pata"]
    ]
  },
  {
    "key": "cangrejo-gigante",
    "name": "Cangrejo gigante",
    "page": 244,
    "characteristics": {
      "FUE": { "value": 19, "formula": "2d6+12" },
      "CON": { "value": 17, "formula": "3d6+6" },
      "TAM": { "value": 26, "formula": "4d6+12" },
      "DES": { "value": 17, "formula": "3d6+6" },
      "INS": { "value": 9, "formula": "2d6+2" },
      "POD": { "value": 4, "formula": "1d6" }
    },
    "actionPoints": 3,
    "magicPoints": 4,
    "initiative": 13,
    "damageModifier": "+1d8",
    "movement": "6m",
    "armor": "Caparazón",
    "traits": "Armas Naturales Formidables, Excavador.",
    "magic": "Ninguna",
    "locations": [
      [1, 1, "Cuarta pata derecha", 8, 8],
      [2, 2, "Cuarta pata izquierda", 8, 8],
      [3, 3, "Tercera pata derecha", 8, 8],
      [4, 4, "Tercera pata izquierda", 8, 8],
      [5, 5, "Segunda pata derecha", 8, 8],
      [6, 6, "Segunda pata izquierda", 8, 8],
      [7, 7, "Primera pata derecha", 8, 8],
      [8, 8, "Primera pata izquierda", 8, 8],
      [9, 10, "Abdomen", 8, 10],
      [11, 16, "Cefalotórax", 8, 11],
      [17, 18, "Pinza derecha", 8, 11],
      [19, 20, "Pinza izquierda", 8, 9]
    ],
    "skills": [
      ["Aguante", 64],
      ["Atletismo", 56],
      ["Evadir", 54],
      ["Músculo", 75],
      ["Percepción", 43],
      ["Voluntad", 38]
    ],
    "passions": [],
    "styles": [
      ["Crustáceo avasallador (pinzas)", 76]
    ],
    "weapons": [
      ["Pinza primaria", "E", "L", "1d8+1d8", "Como pinza derecha"],
      ["Pinza secundaria", "G", "M", "1d8+1d8", "Como pinza izquierda"]
    ]
  },
  {
    "key": "centauro",
    "name": "Centauro",
    "page": 246,
    "characteristics": {
      "FUE": { "value": 17, "formula": "3d6+6" },
      "CON": { "value": 11, "formula": "3d6" },
      "TAM": { "value": 29, "formula": "3d6+18" },
      "DES": { "value": 11, "formula": "3d6" },
      "INT": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 16, "formula": "2d6+9" },
      "CAR": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 2,
    "magicPoints": 16,
    "initiative": 12,
    "damageModifier": "+1d4",
    "movement": "12m",
    "armor": "Piel en sus partes equinas. Cualquier armadura en sus Localizaciones humanas, o barda en las equinas.",
    "traits": "Arrollar",
    "magic": "Los especialistas pueden seguir cualquier tradición mágica.",
    "locations": [
      [1, 3, "Pata trasera derecha", 1, 8],
      [4, 6, "Pata trasera izquierda", 1, 8],
      [7, 8, "Cuartos traseros", 1, 9],
      [9, 10, "Cuartos delanteros", 1, 10],
      [11, 12, "Pata delantera derecha", 1, 8],
      [13, 14, "Pata delantera izquierda", 1, 8],
      [15, 16, "Pecho", 0, 7],
      [17, 17, "Brazo derecho", 0, 4],
      [18, 18, "Brazo izquierdo", 0, 4],
      [19, 20, "Cabeza", 0, 5]
    ],
    "skills": [
      ["Aguante", 52],
      ["Atletismo", 58],
      ["Conocimiento Local", 66],
      ["Enseñar", 64],
      ["Evadir", 62],
      ["Músculo", 70],
      ["Música", 62],
      ["Pelea", 58],
      ["Percepción", 49],
      ["Perspicacia", 59],
      ["Saber (Varios)", 66],
      ["Voluntad", 62]
    ],
    "passions": [],
    "styles": [
      ["Guerrero centauro (arco corto, escudo, lanza)", 68]
    ],
    "weapons": [
      ["Arco corto", "G", "15/100/200", "1d6+1d4", "4/4"],
      ["Arrollar", "E", "M", "2d10", "Como pata"],
      ["Escudo pelta", "G", "C", "1d4+1d4", "4/12"],
      ["Lanza corta", "M", "L", "1d8+1+1d4", "4/5"],
      ["Pezuñas", "G", "M", "1d6+1d4", "Como pata"]
    ]
  },
  {
    "key": "cocodrilo-caiman",
    "name": "Cocodrilo/Caimán",
    "page": 246,
    "characteristics": {
      "FUE": { "value": 25, "formula": "2d6+18" },
      "CON": { "value": 19, "formula": "2d6+12" },
      "TAM": { "value": 37, "formula": "2d6+30" },
      "DES": { "value": 16, "formula": "2d6+9" },
      "INS": { "value": 12, "formula": "2d6+5" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 3,
    "magicPoints": 7,
    "initiative": 13,
    "damageModifier": "+2d6",
    "movement": "6m",
    "armor": "Escamas duras",
    "traits": "Camuflaje, Nadador, Sangre Fría",
    "magic": "Ninguno",
    "locations": [
      [1, 3, "Cola", 5, 12],
      [4, 5, "Pata trasera derecha", 5, 12],
      [6, 7, "Pata trasera izquierda", 5, 12],
      [8, 10, "Cuartos traseros", 5, 13],
      [11, 14, "Cuartos delanteros", 5, 14],
      [15, 16, "Pata delantera derecha", 5, 12],
      [17, 18, "Pata delantera izquierda", 5, 12],
      [19, 20, "Cabeza", 5, 13]
    ],
    "skills": [
      ["Aguante", 78],
      ["Atletismo", 41],
      ["Evadir", 32],
      ["Músculo", 92],
      ["Nadar", 74],
      ["Percepción", 49],
      ["Voluntad", 44]
    ],
    "passions": [],
    "styles": [
      ["Muerte al acecho (barrido con cola, fauces)", 71]
    ],
    "weapons": [
      ["Cola", "E", "L", "1d8+2d6", "Como cola"],
      ["Fauces", "E", "M", "1d10+2d6", "Como cabeza"]
    ]
  },
  {
    "key": "ciclope",
    "name": "Cíclope",
    "page": 247,
    "characteristics": {
      "FUE": { "value": 31, "formula": "2d6+24" },
      "CON": { "value": 25, "formula": "2d6+18" },
      "TAM": { "value": 38, "formula": "4d6+24" },
      "DES": { "value": 11, "formula": "3d6" },
      "INT": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 13, "formula": "2d6+6" },
      "CAR": { "value": 4, "formula": "1d6" }
    },
    "actionPoints": 2,
    "magicPoints": 13,
    "initiative": 12,
    "damageModifier": "+2d6",
    "movement": "10m",
    "armor": "Piel peluda (tren inferior)",
    "traits": "Inmunidad (Fuego)",
    "magic": "Magia Común 65% (Garrotazo, Mano de Hierro).",
    "locations": [
      [1, 3, "Pierna derecha", 4, 13],
      [4, 6, "Pierna izquierda", 4, 13],
      [7, 9, "Abdomen", 4, 14],
      [10, 12, "Pecho", 2, 15],
      [13, 15, "Brazo derecho", 2, 12],
      [16, 18, "Brazo izquierdo", 2, 12],
      [19, 20, "Cabeza", 2, 13]
    ],
    "skills": [
      ["Aguante", 80],
      ["Artesanía (Herrería)", 64],
      ["Atletismo", 62],
      ["Conocimiento Local", 56],
      ["Evadir", 42],
      ["Músculo", 109],
      ["Pelea", 72],
      ["Percepción", 56],
      ["Saber (Ganadería)", 66],
      ["Voluntad", 66]
    ],
    "passions": [
      ["Amor por los Tesoros y la Metalurgia", 85],
      ["Contrariarse por las Intrusiones", 80]
    ],
    "styles": [
      ["Objeto contundente enorme (clava, martillo)", 82]
    ],
    "weapons": [
      ["Clava ciclópea", "C", "I", "2d10+2d6", "4/270"],
      ["Martillo de la forja", "E", "L", "1d10+3+2d6", "6/325"],
      ["Pisotón", "E", "L", "1d8+2d6", "Como pierna"],
      ["Roca arrojada", "D", "-", "4d6", "4/-"]
    ]
  },
  {
    "key": "dragon",
    "name": "Dragón",
    "page": 249,
    "characteristics": {
      "FUE": { "value": 31, "formula": "2d6+24" },
      "CON": { "value": 31, "formula": "2d6+24" },
      "TAM": { "value": 50, "formula": "4d6+36" },
      "DES": { "value": 19, "formula": "2d6+12" },
      "INT": { "value": 19, "formula": "2d6+12" },
      "POD": { "value": 19, "formula": "2d6+12" },
      "CAR": { "value": 19, "formula": "2d6+12" }
    },
    "actionPoints": 4,
    "magicPoints": 19,
    "initiative": 19,
    "damageModifier": "+2d8",
    "movement": "12m, 18m (Volando)",
    "armor": "Escamas duras",
    "traits": "Aliento de Llamas, Armas Naturales Formidables, Arrollar, Ataque en Picado, Aterrador, Engullir, Inmunidad (Fuego), Sangre Fría, Visión en la Oscuridad, Volador.",
    "magic": "Magia Común 78% (Buscar Tesoro, Colmillo Afilado, Confusión, Contramagia, Comunicación Mental, Coordinación, Curar, Glamour, Limpiar, Maldición, Pantalla Espiritual, Vigor, Vista Mágica).",
    "locations": [
      [1, 2, "Cola", 8, 17],
      [3, 4, "Pata trasera derecha", 8, 17],
      [5, 6, "Pata trasera izquierda", 8, 17],
      [7, 8, "Cuartos traseros", 8, 18],
      [9, 10, "Ala derecha", 8, 16],
      [11, 12, "Ala izquierda", 8, 16],
      [13, 14, "Cuartos delanteros", 8, 19],
      [15, 16, "Pata delantera derecha", 8, 17],
      [17, 18, "Pata delantera izquierda", 8, 17],
      [19, 20, "Cabeza", 8, 17]
    ],
    "skills": [
      ["Aguante", 92],
      ["Atletismo", 80],
      ["Conocimiento Local", 68],
      ["Engañar", 78],
      ["Enseñar", 58],
      ["Evadir", 68],
      ["Músculo", 120],
      ["Percepción", 78],
      ["Perspicacia", 78],
      ["Saber (Dragón)", 68],
      ["Volar", 90],
      ["Voluntad", 78]
    ],
    "passions": [
      ["Amor por las Intrigas", 84],
      ["Aborrecer la Debilidad", 80],
      ["Codiciar Tesoros", 99],
      ["Despreciar a Criaturas Inferiores", 90]
    ],
    "styles": [
      ["Muerte y destrucción (barrido de cola, garras, mordisco)", 90],
      ["Aliento de llamas", 80]
    ],
    "weapons": [
      ["Aliento de llamas", "Especial", "Especial", "4d6", "-"],
      ["Arrollar", "C", "T", "4d8", "-"],
      ["Cola", "D", "ML", "1d10+2d8", "Como cola"],
      ["Garras", "D", "L", "1d10+2d8", "Como pata"],
      ["Mordisco", "D", "L", "1d12+2d8", "Como cabeza"]
    ]
  },
  {
    "key": "elfo",
    "name": "Elfo",
    "page": 252,
    "characteristics": {
      "FUE": { "value": 11, "formula": "3d6" },
      "CON": { "value": 11, "formula": "3d6" },
      "TAM": { "value": 16, "formula": "2d6+9" },
      "DES": { "value": 11, "formula": "3d6" },
      "INT": { "value": 16, "formula": "2d6+9" },
      "POD": { "value": 13, "formula": "2d6+6" },
      "CAR": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 3,
    "magicPoints": 13,
    "initiative": 14,
    "damageModifier": "+1d2",
    "movement": "6m",
    "armor": "Ninguna. Los guerreros pueden usar cualquier armadura.",
    "traits": "Sentir la Vida, Visión Nocturna.",
    "magic": "Magia Común 64% (Cuchilla Roma, Dormir, Glamour, Luz, Movilidad, Vigor). Los especialistas prefieren el Teísmo, pero pueden practicar cualquier disciplina.",
    "locations": [
      [1, 3, "Pierna derecha", 0, 6],
      [4, 6, "Pierna izquierda", 0, 6],
      [7, 9, "Abdomen", 0, 7],
      [10, 12, "Pecho", 0, 8],
      [13, 15, "Brazo derecho", 0, 5],
      [16, 18, "Brazo izquierdo", 0, 5],
      [19, 20, "Cabeza", 0, 6]
    ],
    "skills": [
      ["Aguante", 42],
      ["Atletismo", 52],
      ["Conocimiento Local", 72],
      ["Costumbres", 72],
      ["Engañar", 67],
      ["Evadir", 52],
      ["Músculo", 47],
      ["Pelea", 42],
      ["Percepción", 69],
      ["Perspicacia", 69],
      ["Saber (Faerie)", 62],
      ["Voluntad", 56]
    ],
    "passions": [],
    "styles": [
      ["Guerrero elfo (arco, escudo, espada, lanza)", 62]
    ],
    "weapons": [
      ["Arco largo", "E", "15/125/250", "1d8+1d2", "4/7"],
      ["Escudo heraldo", "G", "C", "1d4+1d2", "6/12"],
      ["Espada larga", "M", "L", "1d8+1d2", "6/12"],
      ["Lanza larga", "G", "ML", "1d10+1+1d2", "4/10"]
    ]
  },
  {
    "key": "enano",
    "name": "Enano",
    "page": 254,
    "characteristics": {
      "FUE": { "value": 16, "formula": "2d6+9" },
      "CON": { "value": 16, "formula": "2d6+9" },
      "TAM": { "value": 11, "formula": "1d3+9" },
      "DES": { "value": 11, "formula": "3d6" },
      "INT": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 2,
    "magicPoints": 11,
    "initiative": 12,
    "damageModifier": "+1d2",
    "movement": "4m",
    "armor": "Ninguna. Los guerreros prefieren las armaduras pesadas.",
    "traits": "Sentido de la Tierra,Visión Nocturna.",
    "magic": "Magia Común 42% (Cerrojo, Garrotazo, Luz, Poderío, Pulir, Reparar). Los especialistas prefieren la Hechicería, pero pueden practicar cualquier disciplina.",
    "locations": [
      [1, 3, "Pierna derecha", 0, 6],
      [4, 6, "Pierna izquierda", 0, 6],
      [7, 9, "Abdomen", 0, 7],
      [10, 12, "Pecho", 0, 8],
      [13, 15, "Brazo derecho", 0, 5],
      [16, 18, "Brazo izquierdo", 0, 5],
      [19, 20, "Cabeza", 0, 6]
    ],
    "skills": [
      ["Aguante", 72],
      ["Atletismo", 47],
      ["Artesanía (Albañilería)", 64],
      ["Artesanía (Metalurgia)", 64],
      ["Conocimiento Local", 56],
      ["Costumbres", 76],
      ["Engañar", 54],
      ["Evadir", 42],
      ["Músculo", 66],
      ["Pelea", 57],
      ["Percepción", 54],
      ["Perspicacia", 44],
      ["Saber (Subterráneo)", 66],
      ["Supervivencia", 47],
      ["Voluntad", 42]
    ],
    "passions": [],
    "styles": [
      ["Guerrero enano (ballesta, escudo, hacha, martillo)", 67]
    ],
    "weapons": [
      ["Ballesta pesada", "E", "20/150/300", "1d10", "4/8"],
      ["Escudo vikingo", "G", "C", "1d4+1d2", "4/12"],
      ["Gran martillo", "E", "L", "1d10+3+1d2", "4/10"],
      ["Hacha de batalla", "M", "M", "1d6+1+1d2", "4/8"]
    ]
  },
  {
    "key": "escarabajo-gigante",
    "name": "Escarabajo gigante",
    "page": 255,
    "characteristics": {
      "FUE": { "value": 19, "formula": "2d6+12" },
      "CON": { "value": 17, "formula": "3d6+6" },
      "TAM": { "value": 19, "formula": "2d6+12" },
      "DES": { "value": 13, "formula": "2d6+6" },
      "INS": { "value": 9, "formula": "2d6+2" },
      "POD": { "value": 4, "formula": "1d6" }
    },
    "actionPoints": 2,
    "magicPoints": 4,
    "initiative": 11,
    "damageModifier": "+1d6",
    "movement": "12m",
    "armor": "Quitina",
    "traits": "Armas Naturales Formidables, Excavador",
    "magic": "Ninguna",
    "locations": [
      [1, 1, "Pata trasera derecha", 5, 7],
      [2, 2, "Pata trasera izquierda", 5, 7],
      [3, 3, "Pata central derecha", 5, 7],
      [4, 4, "Pata central izquierda", 5, 7],
      [5, 9, "Abdomen", 5, 9],
      [10, 13, "Tórax", 5, 10],
      [14, 14, "Pata delantera derecha", 5, 7],
      [15, 15, "Pata delantera izquierda", 5, 7],
      [16, 20, "Cabeza", 5, 8]
    ],
    "skills": [
      ["Aguante", 74],
      ["Atletismo", 62],
      ["Evadir", 26],
      ["Músculo", 68],
      ["Percepción", 53],
      ["Voluntad", 38]
    ],
    "passions": [],
    "styles": [
      ["Escarabajo mordedor (mandíbulas)", 72]
    ],
    "weapons": [
      ["Mandíbulas", "M", "T", "1d6+1d6", "Como cabeza"]
    ]
  },
  {
    "key": "escorpion-gigante",
    "name": "Escorpión gigante",
    "page": 256,
    "characteristics": {
      "FUE": { "value": 19, "formula": "2d6+12" },
      "CON": { "value": 17, "formula": "3d6+6" },
      "TAM": { "value": 22, "formula": "2d6+15" },
      "DES": { "value": 16, "formula": "2d6+9" },
      "INS": { "value": 9, "formula": "2d6+2" },
      "POD": { "value": 4, "formula": "1d6" }
    },
    "actionPoints": 3,
    "magicPoints": 4,
    "initiative": 13,
    "damageModifier": "+1d8",
    "movement": "8m",
    "armor": "Quitina",
    "traits": "Adherencia, Armas Naturales Formidables, Excavador, Venenoso",
    "magic": "Ninguna",
    "locations": [
      [1, 2, "Cola", 6, 8],
      [3, 3, "Pata trasera derecha", 6, 7],
      [4, 4, "Pata trasera izquierda", 6, 7],
      [5, 5, "Pata central derecha", 6, 7],
      [6, 6, "Pata central izquierda", 6, 7],
      [7, 7, "Pata delantera derecha", 6, 7],
      [8, 8, "Pata delantera izquierda", 6, 7],
      [9, 12, "Tórax", 6, 9],
      [13, 15, "Pinza derecha", 6, 8],
      [16, 18, "Pinza izquierda", 6, 8],
      [19, 20, "Cefalotórax", 6, 10]
    ],
    "skills": [
      ["Aguante", 64],
      ["Atletismo", 65],
      ["Evadir", 72],
      ["Músculo", 71],
      ["Percepción", 53],
      ["Sigilo", 65],
      ["Voluntad", 48]
    ],
    "passions": [],
    "styles": [
      ["Horror escurridizo (aguijón, pinzas)", 75]
    ],
    "weapons": [
      ["Aguijón", "G", "ML", "1d6+1d8+Veneno", "Como cabeza"],
      ["Pinzas", "E", "L", "1d8+1d8", "Como pinza"]
    ]
  },
  {
    "key": "esqueleto",
    "name": "Esqueleto",
    "page": 257,
    "characteristics": {
      "FUE": { "value": 12, "formula": "" },
      "CON": { "value": 12, "formula": "" },
      "TAM": { "value": 13, "formula": "" },
      "DES": { "value": 16, "formula": "" },
      "INT": { "value": 11, "formula": "" },
      "POD": { "value": 16, "formula": "" }
    },
    "actionPoints": 3,
    "magicPoints": 16,
    "initiative": 14,
    "damageModifier": "0",
    "movement": "6m",
    "armor": "Ninguna",
    "traits": "Muerto Viviente",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Pierna derecha", 0, 5],
      [4, 6, "Pierna izquierda", 0, 5],
      [7, 9, "Abdomen", 0, 6],
      [10, 12, "Pecho", 0, 7],
      [13, 15, "Brazo derecho", 0, 4],
      [16, 18, "Brazo izquierdo", 0, 4],
      [19, 20, "Cabeza", 0, 5]
    ],
    "skills": [
      ["Aguante", 44],
      ["Atletismo", 68],
      ["Evadir", 72],
      ["Músculo", 45],
      ["Pelea", 68],
      ["Percepción", 57],
      ["Voluntad", 72]
    ],
    "passions": [],
    "styles": [
      ["Guerrero esquelético (escudo pelta, espada, lanza)", 68]
    ],
    "weapons": [
      ["Escudo pelta", "G", "C", "1d4", "4/12"],
      ["Espada corta", "M", "C", "1d6", "6/8"],
      ["Lanza corta", "M", "L", "1d8+1", "4/5"]
    ]
  },
  {
    "key": "gigante",
    "name": "Gigante",
    "page": 257,
    "characteristics": {
      "FUE": { "value": 22, "formula": "2d6+15" },
      "CON": { "value": 19, "formula": "2d6+12" },
      "TAM": { "value": 28, "formula": "2d6+21" },
      "DES": { "value": 11, "formula": "3d6" },
      "INT": { "value": 11, "formula": "3d6" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 2,
    "magicPoints": 11,
    "initiative": 11,
    "damageModifier": "+1d10",
    "movement": "12m",
    "armor": "Piel gruesa",
    "traits": "Arrollar",
    "magic": "Algunos pueden tener Magia Común",
    "locations": [
      [1, 3, "Pierna derecha", 3, 10],
      [4, 6, "Pierna izquierda", 3, 10],
      [7, 9, "Abdomen", 3, 11],
      [10, 12, "Pecho", 3, 12],
      [13, 15, "Brazo derecho", 3, 9],
      [16, 18, "Brazo izquierdo", 3, 9],
      [19, 20, "Cabeza", 3, 10]
    ],
    "skills": [
      ["Aguante", 68],
      ["Atletismo", 53],
      ["Evadir", 42],
      ["Músculo", 80],
      ["Pelea", 63],
      ["Percepción", 42],
      ["Voluntad", 42]
    ],
    "passions": [
      ["Amor por las plantas de habichuelas", 60],
      ["Avaricia", 75],
      ["Odio a los Ingleses", 90]
    ],
    "styles": [
      ["Aporrear y destrozar (clava, gran clava, mazo)", 73],
      ["Patear y pisotear", 63]
    ],
    "weapons": [
      ["Arrollar (pisotón)", "G", "M", "2d10", "Como pierna"],
      ["Patada", "G", "M", "1d6+1d10", "Como pierna"],
      ["Rama de árbol", "D", "ML", "2d8+1d10", "4/30"]
    ]
  },
  {
    "key": "gorgona",
    "name": "Gorgona",
    "page": 259,
    "characteristics": {
      "FUE": { "value": 17, "formula": "3d6+6" },
      "CON": { "value": 16, "formula": "2d6+9" },
      "TAM": { "value": 17, "formula": "3d6+6" },
      "DES": { "value": 17, "formula": "3d6+6" },
      "INT": { "value": 16, "formula": "2d6+9" },
      "POD": { "value": 16, "formula": "2d6+9" },
      "CAR": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 3,
    "magicPoints": 16,
    "initiative": 14,
    "damageModifier": "+1d4",
    "movement": "6m",
    "armor": "Escamas en las Localizaciones serpentinas, armadura de hoplita en el torso.",
    "traits": "Ataque de Mirada, Aterrador, Inmunidad (Venenos), Venenoso.",
    "magic": "Devoción 57%, Exhortación 67% (Cautivar, Disipar Magia, Ilusión, Miedo).",
    "locations": [
      [1, 3, "Punta de la Cola", 4, 6],
      [4, 6, "Centro de la Cola", 4, 7],
      [7, 9, "Cuerpo inferior", 4, 8],
      [10, 12, "Pecho", 5, 9],
      [13, 15, "Brazo derecho", 5, 6],
      [16, 18, "Brazo izquierdo", 5, 6],
      [19, 20, "Cabeza", 2, 7]
    ],
    "skills": [
      ["Aguante", 72],
      ["Atletismo", 64],
      ["Engañar", 57],
      ["Evadir", 74],
      ["Músculo", 74],
      ["Percepción", 72],
      ["Perspicacia", 62],
      ["Rastrear", 62],
      ["Seducción", 67],
      ["Voluntad", 72]
    ],
    "passions": [
      ["Amor por la Soledad", 90],
      ["Odio a la Belleza", 70],
      ["Resentimiento hacia los Mortales", 70]
    ],
    "styles": [
      ["Gorgona terrorífica (arco, cabellos de serpiente, cola, mirada, zarpas)", 74]
    ],
    "weapons": [
      ["Arco recurvado", "E", "15/125/250", "1d8+1d4", "4/8"],
      ["Cabellos de serpiente", "P", "C", "Veneno", "Como cabeza"],
      ["Cola", "G", "L", "1d6+1d4", "Como cola"],
      ["Mirada", "Especial", "Especial", "Especial (ver descripción)", "-"],
      ["Zarpas", "M", "C", "1d4+1d4", "Como brazo"]
    ]
  },
  {
    "key": "grifo-hipogrifo",
    "name": "Grifo/Hipogrifo",
    "page": 260,
    "characteristics": {
      "FUE": { "value": 23, "formula": "3d6+12" },
      "CON": { "value": 17, "formula": "3d6+6" },
      "TAM": { "value": 35, "formula": "3d6+24" },
      "DES": { "value": 23, "formula": "3d6+12" },
      "INS": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 19, "formula": "2d6+12" }
    },
    "actionPoints": 3,
    "magicPoints": 11,
    "initiative": 18,
    "damageModifier": "+1d12",
    "movement": "8m, 18m (Volando)",
    "armor": "Piel y plumas",
    "traits": "Ataque en Picado, Volador",
    "magic": "Ninguna",
    "locations": [
      [1, 2, "Pata trasera derecha", 1, 11],
      [3, 4, "Pata trasera izquierda", 1, 11],
      [5, 7, "Cuartos traseros", 1, 12],
      [8, 10, "Cuartos delanteros", 2, 13],
      [11, 12, "Ala derecha", 2, 10],
      [13, 14, "Ala izquierda", 2, 10],
      [15, 16, "Pata delantera derecha", 2, 11],
      [17, 18, "Pata delantera izquierda", 2, 11],
      [19, 20, "Cabeza", 2, 11]
    ],
    "skills": [
      ["Aguante", 64],
      ["Atletismo", 76],
      ["Evadir", 66],
      ["Músculo", 78],
      ["Percepción", 64],
      ["Volar", 76],
      ["Voluntad", 52]
    ],
    "passions": [],
    "styles": [
      ["Muerte desde el cielo (garras, pico)", 86]
    ],
    "weapons": [
      ["Garras", "E", "L", "1d8+1d12", "Como pata"],
      ["Pico", "E", "M", "1d10+1d12", "Como cabeza"]
    ]
  },
  {
    "key": "hibrido-del-caos",
    "name": "Híbrido del Caos",
    "page": 261,
    "characteristics": {
      "FUE": { "value": 13, "formula": "2d6+6" },
      "CON": { "value": 16, "formula": "1d6+12" },
      "TAM": { "value": 13, "formula": "2d6+6" },
      "DES": { "value": 11, "formula": "3d6" },
      "INT": { "value": 11, "formula": "3d6" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 2,
    "magicPoints": 11,
    "initiative": 11,
    "damageModifier": "+1d2",
    "movement": "8m",
    "armor": "Piel gruesa",
    "traits": "Inmunidad a las Enfermedades, Rasgo Caótico",
    "magic": "Magia Común 48%. Los especialistas tienen o bien Devoción 58% y Exhortación 58% o Atadura 58% y Trance 57%",
    "locations": [
      [1, 3, "Pierna derecha", 1, 7],
      [4, 6, "Pierna izquierda", 1, 7],
      [7, 9, "Abdomen", 1, 8],
      [10, 12, "Pecho", 1, 9],
      [13, 15, "Brazo derecho", 1, 6],
      [16, 18, "Brazo izquierdo", 1, 6],
      [19, 20, "Cabeza", 1, 7]
    ],
    "skills": [
      ["Aguante", 62],
      ["Atletismo", 44],
      ["Conocimiento Local", 52],
      ["Evadir", 42],
      ["Músculo", 46],
      ["Pelea", 54],
      ["Percepción", 62],
      ["Supervivencia", 67],
      ["Voluntad", 52]
    ],
    "passions": [
      ["Amor por el Caos", 88],
      ["Odio a Todo el Mundo", 80]
    ],
    "styles": [
      ["Saqueador híbrido (clava, escudo, lanza)", 64]
    ],
    "weapons": [
      ["Clava", "M", "C", "1d6+1d2", "4/4"],
      ["Cuernos", "M", "C", "1d4+1d2", "Como cabeza"],
      ["Escudo tarja", "G", "C", "1d3+1+1d2", "4/9"],
      ["Lanza corta", "M", "L", "1d8+1+1d2", "4/5"]
    ]
  },
  {
    "key": "hombre-jabali",
    "name": "Hombre jabalí",
    "page": 262,
    "characteristics": {
      "FUE": { "value": 16, "formula": "2d6+9" },
      "CON": { "value": 16, "formula": "2d6+9" },
      "TAM": { "value": 16, "formula": "2d6+9" },
      "DES": { "value": 13, "formula": "2d6+6" },
      "INT": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 3,
    "magicPoints": 11,
    "initiative": 13,
    "damageModifier": "+1d4",
    "movement": "6m",
    "armor": "Piel con cerdas",
    "traits": "Excavador, Frenesí, Intimidar, Rasgo Caótico (si es producto del Caos)",
    "magic": "Magia Común 56% (Confusión, Coordinación, Flecha Ígnea)",
    "locations": [
      [1, 3, "Pierna derecha", 1, 7],
      [4, 6, "Pierna izquierda", 1, 7],
      [7, 9, "Abdomen", 1, 8],
      [10, 12, "Pecho", 1, 9],
      [13, 15, "Brazo derecho", 1, 6],
      [16, 18, "Brazo izquierdo", 1, 6],
      [19, 20, "Cabeza", 1, 7]
    ],
    "skills": [
      ["Aguante", 62],
      ["Atletismo", 59],
      ["Conocimiento Local", 66],
      ["Evadir", 56],
      ["Músculo", 62],
      ["Pelea", 59],
      ["Percepción", 64],
      ["Supervivencia", 67],
      ["Voluntad", 62]
    ],
    "passions": [
      ["Amor por el Caos", 88],
      ["Odio a Intrusos", 80]
    ],
    "styles": [
      ["Hombre jabalí guerrero (colmillos, escudo, lanza)", 62]
    ],
    "weapons": [
      ["Colmillos", "M", "T", "1d4+1d4", "Como cabeza"],
      ["Escudo pelta", "G", "C", "1d4+1d4", "4/12"],
      ["Lanza corta", "M", "L", "1d8+1+1d4", "4/5"]
    ]
  },
  {
    "key": "lizard-man",
    "name": "Hombre lagarto",
    "page": 263,
    "characteristics": {
      "FUE": { "value": 16, "formula": "2d6+9" },
      "CON": { "value": 13, "formula": "2d6+6" },
      "TAM": { "value": 16, "formula": "2d6+9" },
      "DES": { "value": 13, "formula": "2d6+6" },
      "INT": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 3,
    "magicPoints": 11,
    "initiative": 13,
    "damageModifier": "+1d4",
    "movement": "6m",
    "armor": "Escamas duras. Los guerreros pueden usar cualquier armadura",
    "traits": "Sangre Fría, Visión Nocturna",
    "magic": "Los especialistas practican Animismo o Teísmo",
    "locations": [
      [1, 3, "Cola", 3, 6],
      [4, 5, "Pierna derecha", 3, 6],
      [6, 7, "Pierna izquierda", 3, 6],
      [8, 10, "Abdomen", 3, 7],
      [11, 14, "Pecho", 3, 8],
      [15, 16, "Brazo derecho", 3, 5],
      [17, 18, "Brazo izquierdo", 3, 5],
      [19, 20, "Cabeza", 3, 6]
    ],
    "skills": [
      ["Aguante", 66],
      ["Atletismo", 59],
      ["Artesanía (Cualquiera Primitiva)", 56],
      ["Conocimiento Local", 66],
      ["Costumbres", 56],
      ["Evadir", 56],
      ["Músculo", 62],
      ["Nadar", 69],
      ["Pelea", 59],
      ["Percepción", 54],
      ["Perspicacia", 44],
      ["Voluntad", 52]
    ],
    "passions": [
      ["Lealtad a la Tribu", 90],
      ["Odio a Enemigos", 80]
    ],
    "styles": [
      ["Guerrero hombre lagarto (escudo tarja, hacha de piedra, lanza corta)", 69]
    ],
    "weapons": [
      ["Coletazo", "M", "L", "1d4+1d4", "Como cola"],
      ["Escudo tarja", "G", "C", "1d3+1+1d4", "4/9"],
      ["Garras", "M", "T", "1d4+1d4", "Como brazo"],
      ["Hacha de piedra", "M", "M", "1d6+1+1d4", "4/8"],
      ["Lanza corta", "M", "L", "1d8+1+1d4", "4/5"],
      ["Mordisco", "M", "M", "1d6+1d4", "Como cabeza"]
    ]
  },
  {
    "key": "giant-ant",
    "name": "Hormiga gigante",
    "page": 264,
    "characteristics": {
      "FUE": { "value": 14, "formula": "4d6" },
      "CON": { "value": 17, "formula": "3d6+6" },
      "TAM": { "value": 14, "formula": "4d6" },
      "DES": { "value": 13, "formula": "2d6+6" },
      "INS": { "value": 9, "formula": "2d6+2" },
      "POD": { "value": 4, "formula": "1d6" }
    },
    "actionPoints": 2,
    "magicPoints": 4,
    "initiative": 11,
    "damageModifier": "+1d2",
    "movement": "12 m.",
    "armor": "Quitina",
    "traits": "Armas Naturales Formidables, Mente Colmena, Venenoso",
    "magic": "Ninguna",
    "locations": [
      [1, 1, "Pata trasera derecha", 4, 6],
      [2, 2, "Pata trasera izquierda", 4, 6],
      [3, 3, "Pata central derecha", 4, 6],
      [4, 4, "Pata central izquierda", 4, 6],
      [5, 9, "Abdomen", 4, 8],
      [10, 13, "Tórax", 4, 9],
      [14, 14, "Pata frontal derecha", 4, 6],
      [15, 15, "Pata frontal izquierda", 4, 6],
      [16, 20, "Cabeza", 4, 7]
    ],
    "skills": [
      ["Aguante", 74],
      ["Atletismo", 67],
      ["Evadir", 56],
      ["Músculo", 68],
      ["Percepción", 53],
      ["Rastrear", 66],
      ["Voluntad", 48]
    ],
    "passions": [],
    "styles": [
      ["Asalto formícido (aguijón, mandíbulas)", 67]
    ],
    "weapons": [
      ["Aguijón", "M", "M", "1d4+1d2", "Como abdomen"],
      ["Mandíbulas", "M", "T", "1d6+1d2", "Como cabeza"]
    ]
  },
  {
    "key": "iqari",
    "name": "Iqari",
    "page": 265,
    "characteristics": {
      "FUE": { "value": 23, "formula": "3d6+12" },
      "CON": { "value": 13, "formula": "2d6+6" },
      "TAM": { "value": 19, "formula": "2d6+12" },
      "DES": { "value": 19, "formula": "2d6+12" },
      "INT": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 3,
    "magicPoints": 11,
    "initiative": 14,
    "damageModifier": "+1d8",
    "movement": "6m, 18m (Volando)",
    "armor": "Plumas, faldilla y grebas de cuero",
    "traits": "Ataque en Picado, Volador",
    "magic": "Los iqari suelen practicar Misticismo (Meditación 56% y Misticismo 54%). Los chamanes especialistas también aprenden Animismo (Trance 64% y Atadura 62%).",
    "locations": [
      [1, 3, "Pata derecha", 2, 7],
      [4, 6, "Pata izquierda", 2, 7],
      [7, 9, "Abdomen", 3, 8],
      [10, 10, "Pecho", 0, 9],
      [11, 12, "Ala derecha", 0, 7],
      [13, 14, "Ala izquierda", 0, 7],
      [15, 16, "Brazo derecho", 1, 6],
      [17, 18, "Brazo izquierdo", 1, 6],
      [19, 20, "Cabeza", 2, 7]
    ],
    "skills": [
      ["Aguante", 56],
      ["Atletismo", 62],
      ["Chillido Paralizante", 62],
      ["Evadir", 58],
      ["Lengua de Signos", 54],
      ["Músculo", 62],
      ["Pelea", 72],
      ["Percepción", 64],
      ["Sigilo", 52],
      ["Supervivencia", 54],
      ["Volar", 82],
      ["Voluntad", 52]
    ],
    "passions": [],
    "styles": [
      ["Guerrero iqari (garra, golpe de ala, lanza, pico)", 72]
    ],
    "weapons": [
      ["Garra", "M", "C", "1d6+1d8", "Como pata"],
      ["Golpe de ala", "G", "ML", "1d3+1d8", "Como ala"],
      ["Lanza larga", "G", "ML", "1d10+1+1d8", "4/10"],
      ["Pico", "M", "T", "1d4+1d8", "Como cabeza"]
    ]
  },
  {
    "key": "jabali",
    "name": "Jabalí",
    "page": 266,
    "characteristics": {
      "FUE": { "value": 16, "formula": "2d6+9" },
      "CON": { "value": 16, "formula": "2d6+9" },
      "TAM": { "value": 17, "formula": "3d6+6" },
      "DES": { "value": 11, "formula": "3d6" },
      "INS": { "value": 11, "formula": "2d6+4" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 2,
    "magicPoints": 7,
    "initiative": 11,
    "damageModifier": "+1d4",
    "movement": "8m",
    "armor": "Piel con cerdas",
    "traits": "Excavador, Frenesí",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Pata trasera derecha", 2, 7],
      [4, 6, "Pata trasera izquierda", 2, 7],
      [7, 9, "Cuartos traseros", 2, 8],
      [10, 12, "Cuartos delanteros", 2, 9],
      [13, 15, "Pata delantera derecha", 2, 7],
      [16, 18, "Pata delantera izquierda", 2, 7],
      [19, 20, "Cabeza", 2, 7]
    ],
    "skills": [
      ["Aguante", 62],
      ["Atletismo", 57],
      ["Evadir", 42],
      ["Músculo", 63],
      ["Percepción", 48],
      ["Voluntad", 32]
    ],
    "passions": [],
    "styles": [
      ["Gruñidor colmilludo (colmillos)", 67]
    ],
    "weapons": [
      ["Colmillos", "M", "C", "1d6+1d4", "Como cabeza"]
    ]
  },
  {
    "key": "lagarto-gigante",
    "name": "Lagarto gigante",
    "page": 267,
    "characteristics": {
      "FUE": { "value": 19, "formula": "2d6+12" },
      "CON": { "value": 13, "formula": "2d6+6" },
      "TAM": { "value": 19, "formula": "2d6+12" },
      "DES": { "value": 16, "formula": "1d6+12" },
      "INS": { "value": 12, "formula": "2d6+5" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 3,
    "magicPoints": 7,
    "initiative": 14,
    "damageModifier": "+1d6",
    "movement": "10m",
    "armor": "Escamas duras",
    "traits": "Adherencia (algunos), Intimidar, Sangre Fría.",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Cola", 3, 7],
      [4, 5, "Pata trasera derecha", 3, 7],
      [6, 7, "Pata trasera izquierda", 3, 7],
      [8, 10, "Cuartos traseros", 3, 8],
      [11, 14, "Cuartos delanteros", 3, 9],
      [15, 16, "Pata delantera derecha", 3, 6],
      [17, 18, "Pata delantera izquierda", 3, 6],
      [19, 20, "Cabeza", 3, 7]
    ],
    "skills": [
      ["Aguante", 56],
      ["Atletismo", 65],
      ["Evadir", 72],
      ["Músculo", 58],
      ["Percepción", 68],
      ["Rastrear", 55],
      ["Sigilo", 68],
      ["Voluntad", 44]
    ],
    "passions": [],
    "styles": [
      ["Cazador escamoso (garras, mordisco)", 67]
    ],
    "weapons": [
      ["Garras", "M", "M", "1d4+1d6", "Como pata"],
      ["Mordisco", "M", "T", "1d6+1d6", "Como cabeza"]
    ]
  },
  {
    "key": "leon",
    "name": "León",
    "page": 267,
    "characteristics": {
      "FUE": { "value": 19, "formula": "2d6+12" },
      "CON": { "value": 11, "formula": "3d6" },
      "TAM": { "value": 22, "formula": "2d6+15" },
      "DES": { "value": 17, "formula": "3d6+6" },
      "INS": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 3,
    "magicPoints": 7,
    "initiative": 15,
    "damageModifier": "+1d8",
    "movement": "8m",
    "armor": "Piel y melena",
    "traits": "Intimidar, Visión Nocturna",
    "magic": "Ninguna",
    "locations": [
      [1, 2, "Pata trasera derecha", 1, 7],
      [3, 4, "Pata trasera izquierda", 1, 7],
      [5, 7, "Cuartos traseros", 1, 8],
      [8, 10, "Cuartos delanteros", 1, 9],
      [11, 13, "Pata delantera derecha", 1, 7],
      [14, 16, "Pata delantera izquierda", 1, 7],
      [17, 20, "Cabeza", 3, 7]
    ],
    "skills": [
      ["Aguante", 52],
      ["Atletismo", 66],
      ["Evadir", 54],
      ["Músculo", 61],
      ["Percepción", 50],
      ["Voluntad", 44]
    ],
    "passions": [],
    "styles": [
      ["Matarreyes (mordisco, zarpas)", 76]
    ],
    "weapons": [
      ["Mordisco", "G", "C", "1d8+1d8", "Como cabeza"],
      ["Zarpas", "G", "M", "1d6+1d8", "Como pata"]
    ]
  },
  {
    "key": "lobo",
    "name": "Lobo",
    "page": 268,
    "characteristics": {
      "FUE": { "value": 8, "formula": "1d3+6" },
      "CON": { "value": 11, "formula": "3d6" },
      "TAM": { "value": 8, "formula": "1d3+6" },
      "DES": { "value": 11, "formula": "3d6" },
      "INS": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 2,
    "magicPoints": 7,
    "initiative": 12,
    "damageModifier": "-1d2",
    "movement": "8m",
    "armor": "Piel",
    "traits": "Visión Nocturna",
    "magic": "Ninguna",
    "locations": [
      [1, 2, "Pata trasera derecha", 1, 4],
      [3, 4, "Pata trasera izquierda", 1, 4],
      [5, 7, "Cuartos traseros", 1, 5],
      [8, 10, "Cuartos delanteros", 1, 6],
      [11, 13, "Pata delantera derecha", 1, 4],
      [14, 16, "Pata delantera izquierda", 1, 4],
      [17, 20, "Cabeza", 1, 4]
    ],
    "skills": [
      ["Aguante", 62],
      ["Atletismo", 59],
      ["Evadir", 52],
      ["Músculo", 36],
      ["Percepción", 60],
      ["Rastrear", 64],
      ["Voluntad", 44]
    ],
    "passions": [],
    "styles": [
      ["Manada salvaje (mordisco)", 59]
    ],
    "weapons": [
      ["Mordisco", "P", "T", "1d4-1d2", "Como cabeza"]
    ]
  },
  {
    "key": "mamut",
    "name": "Mamut",
    "page": 269,
    "characteristics": {
      "FUE": { "value": 47, "formula": "2d6+40" },
      "CON": { "value": 31, "formula": "2d6+24" },
      "TAM": { "value": 63, "formula": "2d6+56" },
      "DES": { "value": 11, "formula": "3d6" },
      "INS": { "value": 11, "formula": "2d6+4" },
      "POD": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 2,
    "magicPoints": 11,
    "initiative": 11,
    "damageModifier": "+2d10",
    "movement": "10m",
    "armor": "Piel y pelaje lanudo",
    "traits": "Arrollar, Intimidar",
    "magic": "Ninguna",
    "locations": [
      [1, 2, "Pata trasera derecha", 9, 19],
      [3, 4, "Pata trasera izquierda", 9, 19],
      [5, 8, "Cuartos traseros", 9, 20],
      [9, 12, "Cuartos delanteros", 9, 21],
      [13, 14, "Pata delantera derecha", 9, 19],
      [15, 16, "Pata delantera izquierda", 9, 19],
      [17, 17, "Trompa", 9, 18],
      [18, 20, "Cabeza", 9, 19]
    ],
    "skills": [
      ["Aguante", 92],
      ["Atletismo", 58],
      ["Evadir", 22],
      ["Músculo", 130],
      ["Percepción", 52],
      ["Voluntad", 52]
    ],
    "passions": [],
    "styles": [
      ["Destrucción arrolladora (arrollar, colmillos, trompa)", 78]
    ],
    "weapons": [
      ["Arrollar", "C", "T", "4d10", "Como pata"],
      ["Colmillos", "C", "ML", "1d12+2d10", "Como cabeza"],
      ["Trompa", "C", "ML", "1d10+2d10", "Como trompa"]
    ]
  },
  {
    "key": "manticore",
    "name": "Mantícora",
    "page": 270,
    "characteristics": {
      "FUE": { "value": 22, "formula": "2d6+15" },
      "CON": { "value": 16, "formula": "2d6+9" },
      "TAM": { "value": 25, "formula": "2d6+18" },
      "DES": { "value": 17, "formula": "3d6+6" },
      "INS": { "value": 14, "formula": "2d6+7" },
      "POD": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 3,
    "magicPoints": 11,
    "initiative": 16,
    "damageModifier": "+1d10",
    "movement": "10m",
    "armor": "Piel, melena y quitina",
    "traits": "Frenesí, Rasgo Caótico, Salto, Venenoso",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Cola", 6, 9],
      [4, 5, "Pata trasera derecha", 3, 9],
      [6, 7, "Pata trasera izquierda", 3, 9],
      [8, 10, "Cuartos traseros", 3, 10],
      [11, 14, "Cuartos delanteros", 3, 11],
      [15, 16, "Pata delantera derecha", 3, 9],
      [17, 18, "Pata delantera izquierda", 3, 9],
      [19, 20, "Cabeza", 5, 9]
    ],
    "skills": [
      ["Aguante", 72],
      ["Atletismo", 69],
      ["Evadir", 74],
      ["Músculo", 61],
      ["Percepción", 65],
      ["Rastrear", 60],
      ["Sigilo", 71],
      ["Voluntad", 62]
    ],
    "passions": [],
    "styles": [
      ["Cazahombres (aguijón, garras, mordisco, púas)", 79]
    ],
    "weapons": [
      ["Aguijón", "E", "L", "1d8+1d10+ Veneno", "Como cola"],
      ["Garras", "G", "M", "1d6+1d10", "Como pata"],
      ["Mordisco", "M", "T", "1d4+1d10", "Como cabeza"],
      ["Púas arrojadizas", "G", "--", "1d6+1d10+ Veneno", ""]
    ]
  },
  {
    "key": "mantis-gigante",
    "name": "Mantis gigante",
    "page": 270,
    "characteristics": {
      "FUE": { "value": 13, "formula": "2d6+6" },
      "CON": { "value": 13, "formula": "2d6+6" },
      "TAM": { "value": 19, "formula": "2d6+12" },
      "DES": { "value": 25, "formula": "2d6+18" },
      "INS": { "value": 9, "formula": "2d6+2" },
      "POD": { "value": 4, "formula": "1d6" }
    },
    "actionPoints": 3,
    "magicPoints": 4,
    "initiative": 17,
    "damageModifier": "+1d4",
    "movement": "6m, 10m (Volando)",
    "armor": "Quitina",
    "traits": "Apresar, Camuflaje, Volador",
    "magic": "Ninguna",
    "locations": [
      [1, 1, "Pata trasera derecha", 3, 6],
      [2, 2, "Pata trasera izquierda", 3, 6],
      [3, 4, "Metatórax", 3, 8],
      [5, 5, "Pata central derecha", 3, 6],
      [6, 6, "Pata central izquierda", 3, 6],
      [7, 10, "Protórax", 3, 9],
      [11, 12, "Ala derecha", 3, 6],
      [13, 14, "Ala izquierda", 3, 6],
      [15, 16, "Antebrazo derecho", 3, 6],
      [17, 18, "Antebrazo izquierdo", 3, 6],
      [19, 20, "Cabeza", 3, 7]
    ],
    "skills": [
      ["Aguante", 56],
      ["Atletismo", 78],
      ["Evadir", 80],
      ["Músculo", 72],
      ["Percepción", 53],
      ["Sigilo", 74],
      ["Volar", 68],
      ["Voluntad", 48]
    ],
    "passions": [],
    "styles": [
      ["Muerte invisible (antebrazos, mordisco)", 78]
    ],
    "weapons": [
      ["Antebrazo", "G", "ML", "1d6+1d4", "Como antebrazo"],
      ["Mordisco", "M", "M", "1d4+1d4", "Como cabeza"]
    ]
  },
  {
    "key": "mediano",
    "name": "Mediano",
    "page": 272,
    "characteristics": {
      "FUE": { "value": 8, "formula": "2d6+1" },
      "CON": { "value": 11, "formula": "3d6" },
      "TAM": { "value": 8, "formula": "1d3+6" },
      "DES": { "value": 14, "formula": "3d6+3" },
      "INT": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 3,
    "magicPoints": 11,
    "initiative": 14,
    "damageModifier": "-1d2",
    "movement": "4m",
    "armor": "Ninguna",
    "traits": "Ninguno",
    "magic": "Generalmente ninguna. Hay, sin embargo, especialistas medianos que pueden seguir cualquier disciplina mágica.",
    "locations": [
      [1, 3, "Pierna derecha", 0, 4],
      [4, 6, "Pierna izquierda", 0, 4],
      [7, 9, "Abdomen", 0, 5],
      [10, 12, "Pecho", 0, 6],
      [13, 15, "Brazo derecho", 0, 3],
      [16, 18, "Brazo izquierdo", 0, 3],
      [19, 20, "Cabeza", 0, 4]
    ],
    "skills": [
      ["Aguante", 62],
      ["Artesanía (Cualquiera)", 57],
      ["Atletismo", 42],
      ["Conocimiento Local", 66],
      ["Costumbres", 66],
      ["Engañar", 46],
      ["Evadir", 68],
      ["Juego de Manos", 55],
      ["Músculo", 36],
      ["Pelea", 42],
      ["Percepción", 64],
      ["Perspicacia", 54],
      ["Región", 66],
      ["Saber (Agricultura)", 56],
      ["Sigilo", 67],
      ["Voluntad", 52]
    ],
    "passions": [],
    "styles": [
      ["Alguacil mediano (escudo, espada, honda)", 52]
    ],
    "weapons": [
      ["Escudo rodela", "M", "C", "1d3-1d2", "6/9"],
      ["Espada corta de mediano", "P", "C", "1d4+1-1d2", "6/8"],
      ["Honda", "G", "10/150/300", "1d8", "1/2"]
    ]
  },
  {
    "key": "minotauro",
    "name": "Minotauro",
    "page": 273,
    "characteristics": {
      "FUE": { "value": 17, "formula": "3d6+6" },
      "CON": { "value": 13, "formula": "2d6+6" },
      "TAM": { "value": 22, "formula": "2d6+15" },
      "DES": { "value": 10, "formula": "2d6+3" },
      "INT": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 2,
    "magicPoints": 11,
    "initiative": 12,
    "damageModifier": "+1d6",
    "movement": "8m",
    "armor": "Cuernos y piel. Los guerreros pueden llevar cualquier armadura.",
    "traits": "Arrollar, Intimidar.",
    "magic": "Algunas manadas pueden tener chamanes o sacerdotes especialistas. Tienden a rechazar la Hechicería.",
    "locations": [
      [1, 3, "Pierna derecha", 0, 7],
      [4, 6, "Pierna izquierda", 0, 7],
      [7, 9, "Abdomen", 0, 8],
      [10, 12, "Pecho", 0, 9],
      [13, 15, "Brazo derecho", 0, 6],
      [16, 18, "Brazo izquierdo", 0, 6],
      [19, 20, "Cabeza", 3, 7]
    ],
    "skills": [
      ["Aguante", 66],
      ["Atletismo", 57],
      ["Conocimiento Local", 56],
      ["Costumbres", 66],
      ["Evadir", 40],
      ["Músculo", 79],
      ["Pelea", 57],
      ["Percepción", 54],
      ["Perspicacia", 44],
      ["Saber (Ganadería)", 66],
      ["Voluntad", 42]
    ],
    "passions": [],
    "styles": [
      ["Guerrero minotauro (cornada, escudo hoplón, gran hacha, lanza corta)", 67]
    ],
    "weapons": [
      ["Arrollar", "D", "T", "2d6", "Como pierna"],
      ["Cornada", "G", "M", "1d8+1d6", "Como cabeza"],
      ["Escudo hoplón", "E", "C", "1d4+1d6", "6/15"],
      ["Gran hacha de minotauro", "D", "ML", "2d8+2+1d6", "6/12"],
      ["Lanza corta de minotauro", "E", "ML", "1d10+1+1d6", "4/10"]
    ]
  },
  {
    "key": "momia",
    "name": "Momia",
    "page": 274,
    "characteristics": {
      "FUE": { "value": 20, "formula": "3d6+9" },
      "CON": { "value": 20, "formula": "3d6+9" },
      "TAM": { "value": 13, "formula": "2d6+6" },
      "DES": { "value": 11, "formula": "3d6" },
      "INT": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 22, "formula": "1d6+18" },
      "CAR": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 2,
    "magicPoints": 22,
    "initiative": 12,
    "damageModifier": "+1d6",
    "movement": "6m",
    "armor": "Como la criatura original, más los vendajes y la armadura con que fue enterrada.",
    "traits": "Inmunidad a las Enfermedades, Inmunidad al Veneno, Muerto Viviente, Sentir la Vida.",
    "magic": "Algunas pueden retener las Habilidades mágicas que poseyeran en vida.",
    "locations": [
      [1, 3, "Pierna derecha", 2, 7],
      [4, 6, "Pierna izquierda", 2, 7],
      [7, 9, "Abdomen", 2, 8],
      [10, 12, "Pecho", 2, 9],
      [13, 15, "Brazo derecho", 2, 6],
      [16, 18, "Brazo izquierdo", 2, 6],
      [19, 20, "Cabeza", 2, 7]
    ],
    "skills": [
      ["Aguante", 70],
      ["Atletismo", 51],
      ["Evadir", 42],
      ["Músculo", 63],
      ["Pelea", 71],
      ["Percepción", 63],
      ["Voluntad", 84]
    ],
    "passions": [],
    "styles": [
      ["Estrangulador vengativo (manos)", 71]
    ],
    "weapons": [
      ["Manos", "P", "T", "1d3+1d6", "Como brazo"]
    ]
  },
  {
    "key": "necrofago",
    "name": "Necrófago",
    "page": 275,
    "characteristics": {
      "FUE": { "value": 17, "formula": "3d6+6" },
      "CON": { "value": 14, "formula": "3d6+3" },
      "TAM": { "value": 13, "formula": "2d6+6" },
      "DES": { "value": 14, "formula": "3d6+3" },
      "INS": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 4, "formula": "1d6" }
    },
    "actionPoints": 3,
    "magicPoints": 4,
    "initiative": 14,
    "damageModifier": "+1d2",
    "movement": "6m",
    "armor": "Piel endurecida. Llevarán armadura si fueron enterrados con ella.",
    "traits": "Muerto Viviente, Regeneración, Sentir la Muerte.",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Pierna derecha", 1, 6],
      [4, 6, "Pierna izquierda", 1, 6],
      [7, 9, "Abdomen", 1, 7],
      [10, 12, "Pecho", 1, 8],
      [13, 15, "Brazo derecho", 1, 5],
      [16, 18, "Brazo izquierdo", 1, 5],
      [19, 20, "Cabeza", 1, 6]
    ],
    "skills": [
      ["Aguante", 58],
      ["Atletismo", 51],
      ["Evadir", 48],
      ["Músculo", 50],
      ["Pelea", 71],
      ["Percepción", 47],
      ["Voluntad", 38]
    ],
    "passions": [],
    "styles": [
      ["Horror inmortal (dientes, garras)", 71]
    ],
    "weapons": [
      ["Dientes", "P", "T", "1d3+1d2", "Como cabeza"],
      ["Garras", "P", "T", "1d4+1d2", "Como brazo"]
    ]
  },
  {
    "key": "ogro",
    "name": "Ogro",
    "page": 276,
    "characteristics": {
      "FUE": { "value": 19, "formula": "2d6+12" },
      "CON": { "value": 16, "formula": "2d6+9" },
      "TAM": { "value": 25, "formula": "2d6+18" },
      "DES": { "value": 11, "formula": "3d6" },
      "INT": { "value": 10, "formula": "2d6+3" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 2,
    "magicPoints": 11,
    "initiative": 8,
    "damageModifier": "+1d8",
    "movement": "8m",
    "armor": "Retales de piel y cuero.",
    "traits": "Ninguno",
    "magic": "Los más inteligentes pueden conocer Magia Común o Animismo.",
    "locations": [
      [1, 3, "Pierna derecha", 2, 9],
      [4, 6, "Pierna izquierda", 2, 9],
      [7, 9, "Abdomen", 2, 10],
      [10, 12, "Pecho", 2, 11],
      [13, 15, "Brazo derecho", 2, 8],
      [16, 18, "Brazo izquierdo", 2, 8],
      [19, 20, "Cabeza", 2, 9]
    ],
    "skills": [
      ["Aguante", 62],
      ["Atletismo", 50],
      ["Conocimiento Local", 40],
      ["Evadir", 42],
      ["Músculo", 84],
      ["Pelea", 60],
      ["Percepción", 38],
      ["Rastrear", 56],
      ["Supervivencia", 53],
      ["Voluntad", 42]
    ],
    "passions": [],
    "styles": [
      ["Cosas grandes y contundentes (clava)", 70]
    ],
    "weapons": [
      ["Clava de ogro", "G", "L", "1d10+1d8", "4/10"]
    ]
  },
  {
    "key": "orco-trasgo",
    "name": "Orco/Trasgo",
    "page": 277,
    "characteristics": {
      "FUE": { "value": 11, "formula": "2d6+4" },
      "CON": { "value": 14, "formula": "3d6+3" },
      "TAM": { "value": 11, "formula": "2d6+4" },
      "DES": { "value": 11, "formula": "3d6" },
      "INT": { "value": 11, "formula": "1d6+7" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 2,
    "magicPoints": 11,
    "initiative": 11,
    "damageModifier": "0",
    "movement": "6m",
    "armor": "Piel gruesa. Algunos pueden llevar armaduras saqueadas.",
    "traits": "Visión Nocturna.",
    "magic": "Algunos pueden tener Magia Común o especialistas sacerdotes o chamanes.",
    "locations": [
      [1, 3, "Pierna derecha", 1, 5],
      [4, 6, "Pierna izquierda", 1, 5],
      [7, 9, "Abdomen", 1, 6],
      [10, 12, "Pecho", 1, 7],
      [13, 15, "Brazo derecho", 1, 4],
      [16, 18, "Brazo izquierdo", 1, 4],
      [19, 20, "Cabeza", 1, 5]
    ],
    "skills": [
      ["Aguante", 48],
      ["Atletismo", 52],
      ["Engañar", 57],
      ["Evadir", 62],
      ["Músculo", 42],
      ["Pelea", 52],
      ["Percepción", 61],
      ["Voluntad", 42]
    ],
    "passions": [
      ["Amor (Hacer Daño)", 80],
      ["Odio (Luz)", 90],
      ["Odio (No Trasgos)", 95]
    ],
    "styles": [
      ["Guerrero trasgo (escudo, espada corta, honda, lanza)", 62]
    ],
    "weapons": [
      ["Escudo tarja", "G", "C", "1d3+1", "4/9"],
      ["Espada corta", "M", "C", "1d6", "6/8"],
      ["Honda", "G", "10/150/300", "1d8", "1/2"],
      ["Lanza corta", "M", "L", "1d8+1", "4/5"]
    ]
  },
  {
    "key": "bear",
    "name": "Oso",
    "page": 277,
    "characteristics": {
      "FUE": { "value": 25, "formula": "2d6+18" },
      "CON": { "value": 13, "formula": "2d6+6" },
      "TAM": { "value": 34, "formula": "4d6+20" },
      "DES": { "value": 13, "formula": "2d6+6" },
      "INS": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 3,
    "magicPoints": 7,
    "initiative": 13,
    "damageModifier": "+1d12",
    "movement": "8m",
    "armor": "Piel gruesa",
    "traits": "Intimidar, Visión Nocturna",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Pata trasera derecha", 3, 10],
      [4, 6, "Pata trasera izquierda", 3, 10],
      [7, 9, "Cuartos traseros", 3, 11],
      [10, 12, "Cuartos delanteros", 3, 12],
      [13, 15, "Pata delantera derecha", 3, 10],
      [16, 18, "Pata delantera izquierda", 3, 10],
      [19, 20, "Cabeza", 3, 10]
    ],
    "skills": [
      ["Aguante", 66],
      ["Atletismo", 68],
      ["Evadir", 46],
      ["Músculo", 79],
      ["Nadar", 68],
      ["Percepción", 60],
      ["Rastrear", 66],
      ["Sigilo", 66],
      ["Supervivencia", 60],
      ["Voluntad", 44]
    ],
    "passions": [],
    "styles": [
      ["Furia úrsida (garras, mordisco)", 78]
    ],
    "weapons": [
      ["Garra", "E", "L", "1d8+1d12", "Como pata"],
      ["Mordisco", "G", "C", "1d8+1d12", "Como cabeza"]
    ]
  },
  {
    "key": "pantotauro",
    "name": "Pantotauro",
    "page": 278,
    "characteristics": {
      "FUE": { "value": 17, "formula": "3d6+6" },
      "CON": { "value": 13, "formula": "2d6+6" },
      "TAM": { "value": 17, "formula": "3d6+6" },
      "DES": { "value": 19, "formula": "2d6+12" },
      "INT": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 3,
    "magicPoints": 11,
    "initiative": 15,
    "damageModifier": "+1d4",
    "movement": "8m",
    "armor": "Pieles y faldilla de cuero.",
    "traits": "Intimidar,Visión Nocturna.",
    "magic": "Los especialistas pueden usar cualquier disciplina mágica.",
    "locations": [
      [1, 3, "Pierna derecha", 1, 6],
      [4, 6, "Pierna izquierda", 1, 6],
      [7, 9, "Abdomen", 2, 7],
      [10, 12, "Pecho", 1, 8],
      [13, 15, "Brazo derecho", 1, 5],
      [16, 18, "Brazo izquierdo", 1, 5],
      [19, 20, "Cabeza", 1, 6]
    ],
    "skills": [
      ["Aguante", 56],
      ["Atletismo", 66],
      ["Conocimiento Local", 56],
      ["Evadir", 78],
      ["Músculo", 54],
      ["Pelea", 76],
      ["Percepción", 64],
      ["Rastrear", 56],
      ["Sigilo", 72],
      ["Supervivencia", 54],
      ["Voluntad", 52]
    ],
    "passions": [],
    "styles": [
      ["Guerrero pantotauro (garra, honda, lanza, mordisco)", 76]
    ],
    "weapons": [
      ["Garra", "M", "M", "1d6+1d4", "Como brazo"],
      ["Honda", "G", "10/150/300", "1d8", "1/2"],
      ["Lanza corta", "M", "L", "1d8+1+1d4", "4/5"],
      ["Mordisco", "M", "T", "1d4+1d4", "Como cabeza"]
    ]
  },
  {
    "key": "pulpo-gigante",
    "name": "Pulpo gigante",
    "page": 279,
    "characteristics": {
      "FUE": { "value": 22, "formula": "2d6+15" },
      "CON": { "value": 19, "formula": "2d6+12" },
      "TAM": { "value": 28, "formula": "2d6+21" },
      "DES": { "value": 22, "formula": "2d6+15" },
      "INS": { "value": 14, "formula": "2d6+7" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 6,
    "magicPoints": 7,
    "initiative": 18,
    "damageModifier": "+1d10",
    "movement": "2m (Tierra), 8m (Agua)",
    "armor": "Piel gomosa",
    "traits": "Apresar, Armas Naturales Formidables, Camuflaje, Múltiples Extremidades, Regeneración (le crecen los tentáculos perdidos a su Ritmo de Curación en Puntos de Golpe al día), Nadador, Venenoso.",
    "magic": "Ninguna",
    "locations": [
      [1, 2, "Tentáculo 1", 1, 10],
      [3, 4, "Tentáculo 2", 1, 10],
      [5, 6, "Tentáculo 3", 1, 10],
      [7, 8, "Tentáculo 4", 1, 10],
      [9, 10, "Tentáculo 5", 1, 10],
      [11, 12, "Tentáculo 6", 1, 10],
      [13, 14, "Tentáculo 7", 1, 10],
      [15, 16, "Tentáculo 8", 1, 10],
      [17, 18, "Cuerpo", 1, 12],
      [19, 20, "Cabeza", 1, 11]
    ],
    "skills": [
      ["Aguante", 68],
      ["Atletismo", 87],
      ["Evadir", 74],
      ["Músculo", 80],
      ["Nadar", 71],
      ["Percepción", 61],
      ["Sigilo", 76],
      ["Voluntad", 54]
    ],
    "passions": [],
    "styles": [
      ["Condenación ondulante (pico, tentáculos)", 84]
    ],
    "weapons": [
      ["Pico", "M", "T", "1d6+1d10", "Como cabeza"],
      ["Tentáculos", "E", "ML", "1d8+1d10", "Como tentáculo"]
    ]
  },
  {
    "key": "quimera",
    "name": "Quimera",
    "page": 280,
    "characteristics": {
      "FUE": { "value": 19, "formula": "2d6+12" },
      "CON": { "value": 13, "formula": "2d6+6" },
      "TAM": { "value": 25, "formula": "2d6+18" },
      "DES": { "value": 16, "formula": "2d6+9" },
      "INS": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 13, "formula": "2d6+6" }
    },
    "actionPoints": 5,
    "magicPoints": 13,
    "initiative": 15,
    "damageModifier": "+1d8",
    "movement": "10m",
    "armor": "Melena y piel",
    "traits": "Aliento de Llamas, Inmunidad (Armas Mundanas), Múltiples Cabezas, Venenoso.",
    "magic": "Ninguna",
    "locations": [
      [1, 2, "Cola de serpiente", 1, 7],
      [3, 4, "Pata trasera derecha", 1, 8],
      [5, 6, "Pata trasera izquierda", 1, 8],
      [7, 8, "Cuartos traseros", 1, 9],
      [9, 10, "Cabeza de cabra", 1, 8],
      [11, 14, "Cuartos delanteros", 1, 10],
      [15, 16, "Pata delantera derecha", 1, 8],
      [17, 18, "Pata delantera izquierda", 1, 8],
      [19, 20, "Cabeza de león", 2, 8]
    ],
    "skills": [
      ["Aguante", 66],
      ["Atletismo", 55],
      ["Evadir", 62],
      ["Músculo", 68],
      ["Percepción", 56],
      ["Voluntad", 66]
    ],
    "passions": [],
    "styles": [
      ["Caos quimérico (cabeza de cabra, cabeza de león, cabeza de serpiente, zarpas)", 75]
    ],
    "weapons": [
      ["Aliento de cabra", "Especial", "Especial", "Fuego", "-"],
      ["Cabeza de león", "G", "T", "1d6+1d8", "Como cabeza de león"],
      ["Cabeza de serpiente", "M", "L", "1d4+Veneno", "Como cola de serpiente"],
      ["Cuernos de cabra", "G", "L", "1d10+1d8", "Como cabeza de cabra"],
      ["Zarpas", "G", "M", "1d6+1d8", "Como pata"]
    ]
  },
  {
    "key": "serpiente-gigante",
    "name": "Serpiente gigante",
    "page": 280,
    "characteristics": {
      "FUE": { "value": 20, "formula": "3d6+9" },
      "CON": { "value": 23, "formula": "3d6+12" },
      "TAM": { "value": 41, "formula": "3d6+30" },
      "DES": { "value": 19, "formula": "2d6+12" },
      "INS": { "value": 12, "formula": "2d6+5" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 3,
    "magicPoints": 7,
    "initiative": 16,
    "damageModifier": "+2d6",
    "movement": "8m",
    "armor": "Escamas",
    "traits": "Apresar, Ataque de Mirada (Hipnotismo) o Camuflaje, Sangre Fría.",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Punta de la cola", 4, 13],
      [4, 5, "Sección trasera final", 4, 13],
      [6, 7, "Sección trasera inicial", 4, 13],
      [8, 9, "Sección media final", 4, 14],
      [10, 12, "Sección media central", 4, 14],
      [13, 14, "Sección media inicial", 4, 14],
      [15, 16, "Sección delantera final", 4, 13],
      [17, 18, "Sección delantera inicial", 4, 13],
      [19, 20, "Cabeza", 4, 13]
    ],
    "skills": [
      ["Aguante", 66],
      ["Atletismo", 79],
      ["Evadir", 68],
      ["Músculo", 91],
      ["Percepción", 59],
      ["Sigilo", 71],
      ["Voluntad", 54]
    ],
    "passions": [],
    "styles": [
      ["Abrazo de la muerte (coletazo, constricción, mordisco)", 79]
    ],
    "weapons": [
      ["Coletazo", "D", "ML", "1d6+2d6", "Como punta de la cola"],
      ["Constricción", "D", "T", "2d6", "Como sección"],
      ["Mordisco", "E", "ML", "1d8+2d6", "Como cabeza"]
    ]
  },
  {
    "key": "serpiente-marina",
    "name": "Serpiente marina",
    "page": 281,
    "characteristics": {
      "FUE": { "value": 37, "formula": "2d6+30" },
      "CON": { "value": 25, "formula": "2d6+18" },
      "TAM": { "value": 67, "formula": "2d6+60" },
      "DES": { "value": 19, "formula": "2d6+12" },
      "INS": { "value": 10, "formula": "2d6+3" },
      "POD": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 3,
    "magicPoints": 11,
    "initiative": 15,
    "damageModifier": "+2d10",
    "movement": "8m (Nadando)",
    "armor": "Escamas",
    "traits": "Aterrador, Engullir, Nadador",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Cola", 6, 19],
      [4, 5, "Aleta trasera derecha", 6, 18],
      [6, 7, "Aleta trasera izquierda", 6, 18],
      [8, 10, "Cuartos traseros", 6, 20],
      [11, 14, "Cuartos delanteros", 6, 21],
      [15, 16, "Aleta delantera derecha", 6, 18],
      [17, 18, "Aleta delantera izquierda", 6, 18],
      [19, 20, "Cabeza", 6, 19]
    ],
    "skills": [
      ["Aguante", 90],
      ["Evadir", 58],
      ["Músculo", 124],
      ["Nadar", 82],
      ["Percepción", 51],
      ["Sigilo", 59],
      ["Voluntad", 52]
    ],
    "passions": [],
    "styles": [
      ["Azote de los mares (coletazo, mordisco)", 86]
    ],
    "weapons": [
      ["Coletazo", "C", "ML", "1d10+2d10", "Como cola"],
      ["Mordisco", "C", "ML", "1d12+2d10", "Como cabeza"]
    ]
  },
  {
    "key": "simio-alado",
    "name": "Simio alado",
    "page": 282,
    "characteristics": {
      "FUE": { "value": 19, "formula": "2d6+12" },
      "CON": { "value": 16, "formula": "2d6+9" },
      "TAM": { "value": 22, "formula": "2d6+15" },
      "DES": { "value": 13, "formula": "2d6+6" },
      "INS": { "value": 14, "formula": "2d6+7" },
      "POD": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 3,
    "magicPoints": 11,
    "initiative": 14,
    "damageModifier": "+1d8",
    "movement": "4m, 8m (Volando).",
    "armor": "Piel",
    "traits": "Armas Naturales Formidables, Ataque en Picado, Volador.",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Pata derecha", 2, 8],
      [4, 6, "Pata izquierda", 2, 8],
      [7, 9, "Abdomen", 2, 9],
      [10, 10, "Pecho", 2, 10],
      [11, 12, "Ala derecha", 0, 8],
      [13, 14, "Ala izquierda", 0, 8],
      [15, 16, "Brazo derecho", 2, 7],
      [17, 18, "Brazo izquierdo", 2, 7],
      [19, 20, "Cabeza", 2, 8]
    ],
    "skills": [
      ["Aguante", 62],
      ["Atletismo", 62],
      ["Evadir", 46],
      ["Músculo", 71],
      ["Percepción", 55],
      ["Volar", 62],
      ["Voluntad", 52]
    ],
    "passions": [],
    "styles": [
      ["Desmembrador (golpe de ala, mordisco, puños)", 72]
    ],
    "weapons": [
      ["Golpe de ala", "M", "L", "1d3+1d8", "Como ala"],
      ["Mordisco", "M", "T", "1d3+1d8", "Como cabeza"],
      ["Puños", "M", "M", "1d4+1d8", "Como brazo"]
    ]
  },
  {
    "key": "slargr",
    "name": "Slargr",
    "page": 282,
    "characteristics": {
      "FUE": { "value": 22, "formula": "2d6+15" },
      "CON": { "value": 19, "formula": "2d6+12" },
      "TAM": { "value": 25, "formula": "2d6+18" },
      "DES": { "value": 13, "formula": "2d6+6" },
      "INT": { "value": 11, "formula": "2d6+4" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 2,
    "magicPoints": 11,
    "initiative": 12,
    "damageModifier": "+1d10",
    "movement": "6m",
    "armor": "Escamas duras",
    "traits": "Apresar, Armas Naturales Formidables, Camuflaje, Sentir la Sangre.",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Cola", 2, 9],
      [4, 5, "Pata derecha", 3, 9],
      [6, 7, "Pata izquierda", 3, 9],
      [8, 10, "Abdomen", 3, 10],
      [11, 14, "Pecho", 3, 11],
      [15, 16, "Brazo derecho", 4, 8],
      [17, 18, "Brazo izquierdo", 4, 8],
      [19, 20, "Cabeza", 4, 9]
    ],
    "skills": [
      ["Aguante", 68],
      ["Atletismo", 55],
      ["Evadir", 46],
      ["Músculo", 77],
      ["Percepción", 62],
      ["Rastrear", 70],
      ["Sigilo", 64],
      ["Voluntad", 52]
    ],
    "passions": [],
    "styles": [
      ["Cazador slargr (coletazo, garras, mordisco)", 75]
    ],
    "weapons": [
      ["Garras", "G", "M", "1d8+1d10", "Como brazo"],
      ["Coletazo", "G", "L", "1d6+1d10", "Como cola"],
      ["Mordisco", "G", "C", "1d8+1d10", "Como cabeza"]
    ]
  },
  {
    "key": "smilodon",
    "name": "Smilodon",
    "page": 283,
    "characteristics": {
      "FUE": { "value": 22, "formula": "2d6+15" },
      "CON": { "value": 13, "formula": "2d6+6" },
      "TAM": { "value": 32, "formula": "2d6+25" },
      "DES": { "value": 16, "formula": "2d6+9" },
      "INS": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 3,
    "magicPoints": 7,
    "initiative": 15,
    "damageModifier": "+1d12",
    "movement": "8m",
    "armor": "Piel",
    "traits": "Intimidar, Salto, Visión Nocturna.",
    "magic": "Ninguna",
    "locations": [
      [1, 2, "Pata trasera derecha", 2, 9],
      [3, 4, "Pata trasera izquierda", 2, 9],
      [5, 7, "Cuartos traseros", 2, 10],
      [8, 10, "Cuartos delanteros", 2, 11],
      [11, 13, "Pata delantera derecha", 2, 9],
      [14, 16, "Pata delantera izquierda", 2, 9],
      [17, 20, "Cabeza", 2, 9]
    ],
    "skills": [
      ["Aguante", 66],
      ["Atletismo", 78],
      ["Evadir", 52],
      ["Músculo", 84],
      ["Percepción", 50],
      ["Rastrear", 66],
      ["Sigilo", 69],
      ["Voluntad", 44]
    ],
    "passions": [],
    "styles": [
      ["Emboscada de smilodon (dientes, garras)", 78]
    ],
    "weapons": [
      ["Dientes", "E", "M", "1d10+1d12", "Como cabeza"],
      ["Garras", "G", "M", "1d8+1d12", "Como pata"]
    ]
  },
  {
    "key": "tiburon",
    "name": "Tiburón",
    "page": 283,
    "characteristics": {
      "FUE": { "value": 25, "formula": "2d6+18" },
      "CON": { "value": 16, "formula": "2d6+9" },
      "TAM": { "value": 42, "formula": "2d6+35" },
      "DES": { "value": 16, "formula": "2d6+9" },
      "INS": { "value": 10, "formula": "2d6+3" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 3,
    "magicPoints": 7,
    "initiative": 13,
    "damageModifier": "+2d6",
    "movement": "12m (Nadando)",
    "armor": "Piel gruesa",
    "traits": "Frenesí, Nadador, Sentir la Sangre.",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Cola", 2, 12],
      [4, 6, "Aleta dorsal", 2, 11],
      [7, 10, "Cuartos traseros", 2, 13],
      [11, 14, "Cuartos delanteros", 2, 14],
      [15, 16, "Aleta derecha", 2, 11],
      [17, 18, "Aleta izquierda", 2, 11],
      [19, 20, "Cabeza", 2, 12]
    ],
    "skills": [
      ["Aguante", 62],
      ["Evadir", 52],
      ["Músculo", 87],
      ["Nadar", 81],
      ["Percepción", 57],
      ["Voluntad", 34]
    ],
    "passions": [],
    "styles": [
      ["¡Tiburón! (mordisco)", 81]
    ],
    "weapons": [
      ["Mordisco", "D", "M", "1d10+2d6", "Como cabeza"]
    ]
  },
  {
    "key": "tigre",
    "name": "Tigre",
    "page": 284,
    "characteristics": {
      "FUE": { "value": 22, "formula": "2d6+15" },
      "CON": { "value": 13, "formula": "2d6+6" },
      "TAM": { "value": 25, "formula": "2d6+18" },
      "DES": { "value": 19, "formula": "2d6+12" },
      "INS": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 3,
    "magicPoints": 7,
    "initiative": 16,
    "damageModifier": "+1d10",
    "movement": "8m",
    "armor": "Piel",
    "traits": "Camuflaje, Intimidar, Visión Nocturna.",
    "magic": "Ninguna",
    "locations": [
      [1, 2, "Pata trasera derecha", 2, 8],
      [3, 4, "Pata trasera izquierda", 2, 8],
      [5, 7, "Cuartos traseros", 2, 9],
      [8, 10, "Cuartos delanteros", 2, 10],
      [11, 13, "Pata delantera derecha", 2, 8],
      [14, 16, "Pata delantera izquierda", 2, 8],
      [17, 20, "Cabeza", 2, 8]
    ],
    "skills": [
      ["Aguante", 66],
      ["Atletismo", 71],
      ["Evadir", 68],
      ["Músculo", 68],
      ["Percepción", 60],
      ["Rastrear", 56],
      ["Sigilo", 72],
      ["Voluntad", 54]
    ],
    "passions": [],
    "styles": [
      ["Muerte a rayas (garras, mordisco)", 81]
    ],
    "weapons": [
      ["Garras", "G", "M", "1d6+1d10", "Como pata"],
      ["Mordisco", "G", "C", "1d8+1d10", "Como cabeza"]
    ]
  },
  {
    "key": "troll",
    "name": "Troll",
    "page": 285,
    "characteristics": {
      "FUE": { "value": 20, "formula": "3d6+9" },
      "CON": { "value": 17, "formula": "3d6+6" },
      "TAM": { "value": 23, "formula": "3d6+12" },
      "DES": { "value": 11, "formula": "3d6" },
      "INT": { "value": 10, "formula": "2d6+3" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 2,
    "magicPoints": 11,
    "initiative": 11,
    "damageModifier": "+1d8",
    "movement": "8m",
    "armor": "Piel gruesa y verrugosa.",
    "traits": "Inmunidad (Armas Mundanas), Visión en la Oscuridad.",
    "magic": "Algunos trolls conocen Magia Común 48% (Oscuridad o Extinguir más 1d3 adicionales).",
    "locations": [
      [1, 3, "Pierna derecha", 3, 8],
      [4, 6, "Pierna izquierda", 3, 8],
      [7, 9, "Abdomen", 3, 9],
      [10, 12, "Pecho", 3, 10],
      [13, 15, "Brazo derecho", 3, 7],
      [16, 18, "Brazo izquierdo", 3, 7],
      [19, 20, "Cabeza", 3, 8]
    ],
    "skills": [
      ["Aguante", 64],
      ["Atletismo", 51],
      ["Engañar", 47],
      ["Evadir", 42],
      ["Músculo", 73],
      ["Pelea", 71],
      ["Percepción", 51],
      ["Sigilo", 61],
      ["Voluntad", 42]
    ],
    "passions": [
      ["Desprecio por los Machos Cabríos", 90],
      ["Obsesión con Lugar/Cosa", 95]
    ],
    "styles": [
      ["Furia troll (clava, lanzar roca, mazo, puño)", 61]
    ],
    "weapons": [
      ["Clava troll", "G", "M", "1d8+1d8", "4/10"],
      ["Mazo troll", "D", "ML", "1d12+3+1d8", "4/10"],
      ["Puños", "G", "M", "1d4+1d8", "Como brazo"],
      ["Roca arrojada", "G", "5/10/20", "1d6+1d8", "--"]
    ]
  },
  {
    "key": "unicornio",
    "name": "Unicornio",
    "page": 286,
    "characteristics": {
      "FUE": { "value": 28, "formula": "2d6+21" },
      "CON": { "value": 13, "formula": "2d6+6" },
      "TAM": { "value": 37, "formula": "2d6+30" },
      "DES": { "value": 19, "formula": "2d6+12" },
      "INS": { "value": 14, "formula": "2d6+7" },
      "POD": { "value": 19, "formula": "2d6+12" }
    },
    "actionPoints": 3,
    "magicPoints": 19,
    "initiative": 17,
    "damageModifier": "+2d6",
    "movement": "12m",
    "armor": "Piel",
    "traits": "Armas Naturales Formidables, Arrollar, Sentir la Vida.",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Pata trasera derecha", 1, 10],
      [4, 6, "Pata trasera izquierda", 1, 10],
      [7, 9, "Cuartos traseros", 1, 11],
      [10, 12, "Cuartos delanteros", 1, 12],
      [13, 14, "Pata delantera derecha", 1, 9],
      [15, 16, "Pata delantera izquierda", 1, 9],
      [17, 20, "Cabeza", 1, 10]
    ],
    "skills": [
      ["Aguante", 66],
      ["Atletismo", 77],
      ["Evadir", 78],
      ["Músculo", 85],
      ["Percepción", 73],
      ["Sigilo", 73],
      ["Voluntad", 78]
    ],
    "passions": [],
    "styles": [
      ["Centinela indómito (cuerno, pezuñas)", 87]
    ],
    "weapons": [
      ["Arrollar", "D", "T", "4d6", "Como pata"],
      ["Cuerno", "E", "L", "1d10+2d6", "Como cabeza"]
    ]
  },
  {
    "key": "uro",
    "name": "Uro",
    "page": 286,
    "characteristics": {
      "FUE": { "value": 31, "formula": "2d6+24" },
      "CON": { "value": 21, "formula": "3d6+10" },
      "TAM": { "value": 38, "formula": "4d6+24" },
      "DES": { "value": 7, "formula": "2d6" },
      "INS": { "value": 11, "formula": "2d6+4" },
      "POD": { "value": 7, "formula": "2d6" }
    },
    "actionPoints": 2,
    "magicPoints": 7,
    "initiative": 9,
    "damageModifier": "+2d6",
    "movement": "12 m.",
    "armor": "Piel gruesa",
    "traits": "Arrollar, Intimidar.",
    "magic": "Ninguna",
    "locations": [
      [1, 2, "Pata trasera derecha", 4, 12],
      [3, 4, "Pata trasera izquierda", 4, 12],
      [5, 7, "Cuartos traseros", 4, 13],
      [8, 10, "Cuartos delanteros", 4, 14],
      [11, 13, "Pata delantera derecha", 4, 11],
      [14, 16, "Pata delantera izquierda", 4, 11],
      [17, 20, "Cabeza", 4, 12]
    ],
    "skills": [
      ["Aguante", 82],
      ["Atletismo", 58],
      ["Evadir", 34],
      ["Músculo", 89],
      ["Percepción", 38],
      ["Voluntad", 38]
    ],
    "passions": [],
    "styles": [
      ["Cornear y lanzar (arrollar, cuernos)", 68]
    ],
    "weapons": [
      ["Arrollar", "D", "T", "4d6", "Como pata"],
      ["Cuernos", "E", "M", "1d10+2d6", "Como cabeza"]
    ]
  },
  {
    "key": "vampiro",
    "name": "Vampiro",
    "page": 287,
    "characteristics": {
      "FUE": { "value": 22, "formula": "(3d6)*2" },
      "CON": { "value": 11, "formula": "3d6" },
      "TAM": { "value": 13, "formula": "2d6+6" },
      "DES": { "value": 22, "formula": "(3d6)*2" },
      "INT": { "value": 13, "formula": "2d6+6" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 3,
    "magicPoints": 11,
    "initiative": 18,
    "damageModifier": "+1d4",
    "movement": "6m",
    "armor": "Ninguna",
    "traits": "Alergia (Luz Solar), Ataque de Mirada (Dominación), Inmunidad (Armas Mundanas), Muerto Viviente, Vampirismo, Visión en la Oscuridad, Vulnerabilidad (Especial).",
    "magic": "Algunos vampiros retienen las Habilidades mágicas que tuvieran en vida.",
    "locations": [
      [1, 3, "Pierna derecha", 0, 5],
      [4, 6, "Pierna izquierda", 0, 5],
      [7, 9, "Abdomen", 0, 6],
      [10, 12, "Pecho", 0, 7],
      [13, 15, "Brazo derecho", 0, 4],
      [16, 18, "Brazo izquierdo", 0, 4],
      [19, 20, "Cabeza", 0, 5]
    ],
    "stylesText": "Generalmente combate usando la Habilidad de Pelea.",
    "skills": [
      ["Aguante", 62],
      ["Atletismo", 74],
      ["Engañar", 54],
      ["Evadir", 64],
      ["Influencia", 62],
      ["Músculo", 65],
      ["Pelea", 84],
      ["Percepción", 54],
      ["Seducción", 64],
      ["Sigilo", 75],
      ["Voluntad", 62]
    ],
    "passions": [
      ["Aborrecer la Vida", 80],
      ["Ambicionar el Poder", 95],
      ["Amor por la Seducción", 90]
    ],
    "styles": [],
    "weapons": [
      ["Mordisco", "M", "T", "1d4+1d4", "Como cabeza"],
      ["Puños", "M", "C", "1d3+1d4", "Como brazo"]
    ]
  },
  {
    "key": "wyrm",
    "name": "Wyrm",
    "page": 288,
    "characteristics": {
      "FUE": { "value": 25, "formula": "2d6+18" },
      "CON": { "value": 19, "formula": "2d6+12" },
      "TAM": { "value": 44, "formula": "4d6+30" },
      "DES": { "value": 19, "formula": "2d6+12" },
      "INS": { "value": 12, "formula": "2d6+5" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 3,
    "magicPoints": 11,
    "initiative": 16,
    "damageModifier": "+2d6",
    "movement": "8m (Tierra), 16 (Volando).",
    "armor": "Escamas",
    "traits": "Frenesí, Sangre Fría, Visión en la Oscuridad, Voladora.",
    "magic": "Ninguna",
    "locations": [
      [1, 4, "Cola", 6, 12],
      [5, 8, "Cuartos traseros", 6, 14],
      [9, 12, "Cuartos delanteros", 6, 15],
      [13, 15, "Ala derecha", 6, 13],
      [16, 18, "Ala izquierda", 6, 13],
      [19, 20, "Cabeza", 6, 14]
    ],
    "skills": [
      ["Aguante", 78],
      ["Atletismo", 64],
      ["Evadir", 68],
      ["Músculo", 89],
      ["Percepción", 63],
      ["Volar", 74],
      ["Voluntad", 62]
    ],
    "passions": [],
    "styles": [
      ["Terror draconiano (barrido de cola, mordisco)", 84]
    ],
    "weapons": [
      ["Cola", "D", "ML", "1d10+2d6", "Como cola"],
      ["Mordisco", "D", "L", "1d12+2d6", "Como cabeza"]
    ]
  },
  {
    "key": "wyvern",
    "name": "Wyvern",
    "page": 288,
    "characteristics": {
      "FUE": { "value": 25, "formula": "2d6+18" },
      "CON": { "value": 19, "formula": "2d6+12" },
      "TAM": { "value": 44, "formula": "4d6+30" },
      "DES": { "value": 19, "formula": "2d6+12" },
      "INS": { "value": 12, "formula": "2d6+5" },
      "POD": { "value": 11, "formula": "3d6" },
      "CAR": { "value": 11, "formula": "3d6" }
    },
    "actionPoints": 3,
    "magicPoints": 11,
    "initiative": 16,
    "damageModifier": "+2d6",
    "movement": "8m (Tierra), 16 (Volando).",
    "armor": "Escamas",
    "traits": "Frenesí, Sangre Fría, Visión en la Oscuridad, Voladora.",
    "magic": "Ninguna",
    "locations": [
      [1, 3, "Cola", 6, 12],
      [4, 5, "Pata trasera derecha", 6, 13],
      [6, 7, "Pata trasera izquierda", 6, 13],
      [8, 10, "Cuartos traseros", 6, 14],
      [11, 14, "Cuartos delanteros", 6, 15],
      [15, 16, "Ala derecha", 6, 13],
      [17, 18, "Ala izquierda", 6, 13],
      [19, 20, "Cabeza", 6, 14]
    ],
    "skills": [
      ["Aguante", 78],
      ["Atletismo", 64],
      ["Evadir", 68],
      ["Músculo", 89],
      ["Percepción", 63],
      ["Volar", 74],
      ["Voluntad", 62]
    ],
    "passions": [],
    "styles": [
      ["Terror draconiano (barrido de cola, mordisco)", 84]
    ],
    "weapons": [
      ["Cola", "D", "ML", "1d10+2d6", "Como cola"],
      ["Mordisco", "D", "L", "1d12+2d6", "Como cabeza"]
    ]
  },
  {
    "key": "zombi",
    "name": "Zombi",
    "page": 289,
    "characteristics": {
      "FUE": { "value": 9, "formula": "3d6-2" },
      "CON": { "value": 9, "formula": "3d6-2" },
      "TAM": { "value": 11, "formula": "2d6+4" },
      "DES": { "value": 9, "formula": "3d6-2" },
      "INS": { "value": 11, "formula": "2d6+4" },
      "POD": { "value": 9, "formula": "3d6-2" },
      "CAR": { "value": 9, "formula": "3d6-2" }
    },
    "actionPoints": 2,
    "magicPoints": 0,
    "initiative": 10,
    "damageModifier": "-1d2",
    "movement": "6m",
    "armor": "Ninguna",
    "traits": "Muerto Viviente",
    "magic": "Algunos pueden retener las Habilidades mágicas que tuvieran en vida.",
    "locations": [
      [1, 3, "Pierna derecha", 0, 4],
      [4, 6, "Pierna izquierda", 0, 4],
      [7, 9, "Abdomen", 0, 5],
      [10, 12, "Pecho", 0, 6],
      [13, 15, "Brazo derecho", 0, 3],
      [16, 18, "Brazo izquierdo", 0, 3],
      [19, 20, "Cabeza", 0, 4]
    ],
    "stylesText": "Suelen combatir usando Pelea.",
    "skills": [
      ["Aguante", 58],
      ["Atletismo", 38],
      ["Evadir", 38],
      ["Músculo", 40],
      ["Pelea", 58],
      ["Percepción", 40],
      ["Voluntad", 48]
    ],
    "passions": [
      ["Cerebros…", 99]
    ],
    "styles": [],
    "weapons": [
      ["Mordisco", "P", "T", "1+ Enfermedad", "Como cabeza"],
      ["Puños", "P", "C", "1d3-1d2", "Como brazo"]
    ]
  }
]);
