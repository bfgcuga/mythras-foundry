# Arquitectura del sistema

Este documento resume la estructura estable del repositorio y las fuentes de
verdad que deben consultarse antes de cambiar modelos, reglas o compendios.

## Capas

- `scripts/data/`: modelos de datos de Foundry y catálogos fuente mantenidos en
  JavaScript. Los catálogos de habilidades, trasfondos, armas, equipo, armaduras,
  rasgos, criaturas, macros y clases sociales viven aquí.
- `scripts/rules/`: lógica de dominio reutilizable y, siempre que es posible,
  pura. Los cálculos derivados deben implementarse aquí y consumirse tanto desde
  la preparación de documentos como desde hojas y resolución de combate.
- `scripts/documents/`: comportamiento de documentos Foundry. `MythrasItem`
  centraliza la preparación y las tiradas propias de los Items.
- `scripts/sheets/`: hojas Application V2 de personaje, PNJ e Item. Preparan el
  contexto de presentación y delegan los cálculos en `scripts/rules/`.
- `scripts/apps/`: aplicaciones auxiliares para catálogo, grupos, fuentes del
  catálogo, creación homebrew, configuración de armaduras y fusión de modos de
  arma.
- `scripts/api/`: APIs públicas que se publican bajo `game.mythrasFoundry`.
- `templates/`, `styles/` y `lang/`: presentación Handlebars, tema compartido y
  localizaciones. Las reglas visuales obligatorias están en `AGENTS.md`.
- `tests/`: pruebas con el runner nativo de Node. Cubren reglas, datos, manifiesto,
  localización y estándares estáticos de la interfaz.

## Registro y ciclo de vida

`scripts/mythras-foundry.js` es el único módulo declarado por `system.json` y el
punto de composición del sistema.

Durante `init` registra:

- los modelos `character` y `npc`;
- la clase de documento de Item y los modelos de los diez tipos de Item;
- hojas Application V2, ajustes y menús de administración;
- las APIs `game.mythrasFoundry.shop`, `homebrew`, `party` y `traits`;
- los parciales Handlebars compartidos.

Los hooks posteriores aplican límites de recursos, preparan actores nuevos,
materializan fórmulas de PNJ no enlazados y ejecutan migraciones idempotentes. Las
migraciones de mundo se reservan al primer GM activo para evitar escrituras
duplicadas.

## Modelos y cálculos derivados

Los esquemas persistentes de Actor están en `scripts/data/character-data.js` y
`scripts/data/npc-data.js`; los de Item, en `scripts/data/item-data.js`. Los
valores calculados no deben duplicarse en los esquemas o plantillas:

- atributos y máximos proceden de `scripts/rules/derived-attributes.js` y
  `scripts/rules/npc.js`;
- fatiga, heridas, carga y armadura transforman esos valores mediante sus módulos
  respectivos bajo `scripts/rules/`;
- la hoja representa el valor base y el efectivo con los ayudantes compartidos
  de penalizaciones.

El estado equipado determina efectos y cálculos, mientras que la estructura de
inventario determina qué objetos se transportan y dónde se guardan.

## Compendios

Los módulos de `scripts/data/` son la fuente de verdad de los compendios. El
script `scripts/dev/build-packs.mjs` genera documentos con identificadores
deterministas en `.build/packs-src/` y compila la salida LevelDB en `packs/`.
Ambos directorios son artefactos generados e ignorados por Git.

El contenido propio de una campaña se guarda en compendios mundiales `Item` y no
en `scripts/data/`. El creador homebrew permite seleccionar uno existente o
crearlo, lo registra como fuente del catálogo y genera un documento inicial
válido mediante `scripts/rules/homebrew-items.js`.

Los diez compendios declarados en `system.json` deben mantenerse sincronizados
con las llamadas de construcción de `build-packs.mjs`. Cualquier cambio en sus
fuentes requiere ejecutar `npm run build:packs` antes de `npm run check`.

## Validación y publicación

`npm test` es la comprobación funcional principal. `npm run check` valida la
sintaxis de todos los módulos, los recursos del manifiesto, los JSON de idioma,
la presencia de compendios y la URL versionada de descarga.

`.github/workflows/release.yml` se ejecuta al subir una etiqueta `v*`: instala
dependencias, prueba, reconstruye compendios, valida la coincidencia entre
etiqueta y manifiesto, empaqueta los archivos de ejecución y crea la release.
El procedimiento manual y su orden obligatorio se mantienen en `AGENTS.md`.
