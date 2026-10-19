# Cobertura del bestiario de Mythras básico revisado

El compendio `creatures` contiene 115 perfiles del básico revisado, extraídos de
las páginas 237–289, además del Xenomorfo anterior del SRD. Los 58 bloques de
estadísticas del documento dan lugar a 59 fichas al separar Wyrm y Wyvern; la
variante ofidia descrita en la página 262 completa los 60 perfiles corporales.
Se añaden 50 elementales (cinco tipos en volúmenes 1–10 m³) y cinco enjambres
representativos de TAM 3, 9, 15, 22 y 30.

Se actualizan Hombre lagarto, Hormiga gigante, Mantícora y Oso conservando sus
claves de Actor. Las entradas compartidas Basilisco/Cocatriz, Cocodrilo/Caimán,
Grifo/Hipogrifo y Orco/Trasgo mantienen los nombres conjuntos del libro.

## Representación

Las notas mágicas y la descripción del PNJ muestran como texto legible el HTML
heredado del compendio, conservando párrafos y entidades. Editar otros campos no
sobrescribe ese HTML; las ediciones explícitas de estas notas se guardan como
texto simple. También funciona con actores ya importados, sin reimportación.

- Fuente de los perfiles y sus Items: `mythras-basic-revised`, con página en
  `flags.mythras-foundry.sourcePage`; los rasgos muestran también la referencia
  legible «Mythras básico revisado».
- Se conservan los valores medios, fórmulas, INT/INS, atributos publicados,
  habilidades, pasiones, magia y PA/PG individuales. Una característica ausente
  en los perfiles globales se marca en `absentCharacteristics`, aparece como
  «No aplica» y no aporta su mínimo técnico interno a los cálculos. Los perfiles
  corporales anteriores conservan su representación de CAR no publicado.
- Los atributos impresos son overrides manuales: esto conserva los PA adicionales
  del pulpo y la quimera, las penalizaciones de iniciativa incluidas por el libro
  y los 0 PM del zombi. No se recalculan desde los promedios redondeados.
- Las tablas se comparan con las morfologías existentes por zona y rango exacto;
  se normalizan sinónimos como pata central/media y frontal/delantera. Las tablas
  que difieren mantienen `custom`, aunque la forma general recuerde otra
  plantilla. Por ejemplo, la serpiente gigante no usa los rangos de `serpentine`.
- Los PG y PA naturales son los impresos, con cálculo automático de PG desactivado.
  Las armas naturales enlazan con la zona indicada por el libro; una referencia
  genérica a una pata, brazo, ala o tentáculo elige el miembro derecho/delantero
  correspondiente. Las distintas cabezas de la quimera se vinculan por nombre.
- El daño impreso incluye a menudo el modificador de daño. El adaptador lo separa
  cuando aparece explícitamente; arrollar, constricción, ballestas y otros ataques
  que ya incluyen todo su daño no lo suman de nuevo. Daños narrativos como «Fuego»
  o «Presa» se conservan en efectos y notas, con daño físico automático 0.
- Veneno, enfermedad, inmunidades, magia, miradas, regeneración, rasgos opcionales
  y pérdida de PA por cabezas/extremidades requieren aplicación manual. Las notas
  de la ficha recogen las reglas particulares y las alternativas del perfil.
- Ofidio intercambia FUE/POD y TAM/INT, reduce dos PA naturales, recalcula PG, PM,
  iniciativa y MD para sus valores, sustituye Artesanía por Saber y añade mordisco
  venenoso. Conserva los porcentajes publicados y los 3 PA de la plantilla.
- Las variantes narrativas de talla, reina, especie o transformación pueden
  prepararse manualmente desde estos perfiles; no se generan combinaciones
  arbitrarias de esas opciones como nuevos Actors.

## Integración de elementales y enjambres

Los 55 perfiles usan `hitPointMode: "global"`: una única localización «Cuerpo»,
rango 1–20 y PG manuales. Los elementales conservan los PG medios publicados y
su fórmula de generación `1d6 + 6 × volumen`. Los enjambres tienen PG iguales a
su TAM. Ninguno genera consecuencias anatómicas por perder PG; al pasar de un
valor positivo a 0 se emite una sola advertencia para resolución manual. No se
aplican automáticamente muerte, incapacitación ni disipación. Curar por encima
de 0 permite que un nuevo agotamiento vuelva a producir el aviso.

La protección elemental figura como PA de la reserva global. El director valida
primero la inmunidad mundana, el tipo de daño mágico y el elemento opuesto; el
sistema no clasifica hechizos ni duplica daño elemental automáticamente. Engullir
y los ataques colectivos de enjambres se describen para aplicación manual.

Los elementales carecen de CON, TAM y CAR; los enjambres solo tienen TAM.
Los atributos necesarios tienen overrides manuales y los porcentajes son los
publicados. Sin CON no se calcula curación ni se programan comprobaciones de
fatiga de combate. Sin FUE no se calcula carga. Sin TAM se omite el ajuste
automático de tiro por tamaño y se avisa al director; Golpetazo y la penalización
de empalamiento requieren resolución manual. Las caídas sin TAM requieren una
fórmula y número de localizaciones elegidos manualmente. Una habilidad que
dependa de una característica ausente necesita porcentaje manual para tirarse.

Ya no quedan familias principales del documento excluidas del compendio.
Las variantes narrativas de talla, reinas y especies siguen siendo adaptaciones
manuales de las plantillas, no entradas independientes de cada combinación.

El vampiro corporal sí está incluido. Sus formas opcionales de niebla y horda de
ratas se describen como cambios manuales: no se crean Actors incorpóreos o
colectivos con características ficticias.

## Comprobaciones

`tests/global-health.test.js` cubre los nuevos perfiles, generación, daños de
combate y peligros, edición e importación de la reserva, ausencia de consecuencias
anatómicas y aviso de agotamiento. `tests/creatures.test.js` verifica cobertura de perfiles, fuente, atributos,
porcentajes, PA/PG, anatomías excepcionales, vínculos de armas y daños con o sin
modificador. `tests/morphologies.test.js` contrasta las tablas tipadas con el
catálogo canónico. La compilación usa `build-packs.mjs` y produce el compendio de
Actors con sus Items embebidos y referencias deterministas.

## Ilustraciones

Las cuatro láminas del usuario cubren los 67 diseños del JSON y los 116 Actors,
con imágenes compartidas entre tamaños de elementales y enjambres. No queda
ningún diseño pendiente. La cobertura visual y los comandos de extracción se
mantienen en [bestiary-art.md](bestiary-art.md).
