# Cobertura del bestiario de Mythras básico revisado

El compendio `creatures` contiene 60 perfiles del básico revisado, extraídos de
las páginas 237–289, además del Xenomorfo anterior del SRD. Los 58 bloques de
estadísticas del documento dan lugar a 59 fichas al separar Wyrm y Wyvern; la
variante ofidia descrita en la página 262 completa los 60 perfiles.

Se actualizan Hombre lagarto, Hormiga gigante, Mantícora y Oso conservando sus
claves de Actor. Las entradas compartidas Basilisco/Cocatriz, Cocodrilo/Caimán,
Grifo/Hipogrifo y Orco/Trasgo mantienen los nombres conjuntos del libro.

## Representación

- Fuente de los perfiles y sus Items: `mythras-basic-revised`, con página en
  `flags.mythras-foundry.sourcePage`; los rasgos muestran también la referencia
  legible «Mythras básico revisado».
- Se conservan los valores medios, fórmulas, INT/INS, atributos publicados,
  habilidades, pasiones, magia y PA/PG individuales. Una característica ausente
  (normalmente CAR en animales) usa el mínimo técnico del modelo, 1, sin fórmula.
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

## Excluidos por incompatibilidad del modelo actual

| Criatura o grupo | Páginas | Motivo |
| --- | --- | --- |
| Elementales: gnomo, ondina, salamandra, silfo y sombra | 249–251 | Carecen de CON/TAM y de localizaciones; usan volumen, PG globales y protección contra daño mágico. El modelo actual exige características físicas y resuelve heridas por localización. Una zona ficticia no reproduciría su inmunidad a heridas graves/críticas ni su disipación a 0 PG. |
| Enjambres | 254–255 | Solo tienen TAM, daño colectivo sobre varias zonas, PG globales y desgaste progresivo de protección. No encajan en el Actor individual con anatomía y siete características. |

El vampiro corporal sí está incluido. Sus formas opcionales de niebla y horda de
ratas se describen como cambios manuales: no se crean Actors incorpóreos o
colectivos con características ficticias.

## Comprobaciones

`tests/creatures.test.js` verifica cobertura de perfiles, fuente, atributos,
porcentajes, PA/PG, anatomías excepcionales, vínculos de armas y daños con o sin
modificador. `tests/morphologies.test.js` contrasta las tablas tipadas con el
catálogo canónico. La compilación usa `build-packs.mjs` y produce el compendio de
Actors con sus Items embebidos y referencias deterministas.
