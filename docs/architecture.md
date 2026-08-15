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
- fatiga, heridas, carga, armadura y estados producen descriptores semánticos
  mediante `scripts/rules/condition-resolver.js`; el resolvedor puro combina sus
  suelos, incrementos, transformaciones y bloqueos en un orden único;
- los descriptores son datos derivados transitorios y no se persisten en Actor.
  El resultado común contiene condición, atributos efectivos, variantes de
  dificultad, capacidades y el desglose trazable consumido por hojas, tiradas y
  límites de recursos;
- `scripts/rules/penalty-summary.js` adapta ese resultado para la pestaña de
  penalizaciones. Los ayudantes históricos de fatiga, carga, armadura y estados
  permanecen como adaptadores compatibles y no contienen una segunda
  implementación de las reglas;
- `scripts/rules/incapacitated.js` identifica por separado las causas de
  Incapacitado. `MythrasActor` sincroniza un único estado de Foundry con las
  causas automáticas —fatiga y herida crítica— y la bandera manual del Actor;
- la hoja representa el valor base y el efectivo con los ayudantes compartidos
  de penalizaciones.

La pestaña de penalizaciones de personajes y PNJ es contextual: la tabla solo
incluye fuentes con un efecto activo y conserva siempre superficies transparentes. Todos los
estados activos del token se muestran antes de la tabla como controles para
retirarlos; los que tienen consecuencias mecánicas aparecen además en la tabla.
Los estados inactivos no ocupan espacio en la pestaña.

El estado Incapacitado de Foundry es una representación semántica y visual, no
una segunda fuente de cambios numéricos. Sus consecuencias proceden de las
reglas de condición compartidas. Mientras exista una causa automática no puede
retirarse el estado; una causa manual puede coexistir con ellas sin perderse
cuando se resuelva una herida o cambie la fatiga.

Los estados manuales Cegado y Derribado también son `statusEffects` de Foundry.
Solo establecen una dificultad mínima de habilidad —Hercúlea y Formidable,
respectivamente— mediante `scripts/rules/statuses.js`; no transforman los
atributos derivados. Si coinciden varios estados se conserva la peor dificultad
mínima antes de aplicar incrementos por grados.

Los estados manuales adicionales se resuelven en el mismo módulo. Inconsciente
establece la dificultad Imposible —objetivo cero— y transforma a cero los
atributos derivados efectivos sin modificar sus valores base. Aturdido e
Inconsciente impiden iniciar ataques, pero Aturdido no impide las defensas.
Sangrando y Ahogándose son estados semánticos sin automatización temporal hasta
que el sistema disponga de asaltos y turnos de combate.
Sorprendido también se registra como estado semántico manual, sin efectos
mecánicos hasta que se complete la regla pendiente indicada en el roadmap.

El estado equipado determina efectos y cálculos, mientras que la estructura de
inventario determina qué objetos se transportan y dónde se guardan.

Las tiradas de habilidad se resuelven en `scripts/rules/skill-roll.js`; el
diálogo de ajustes, el documento de Item y la interacción de suerte de la tarjeta
consumen esos mismos objetivos y umbrales para no duplicar reglas.

Las tiradas interactivas se modelan en `scripts/rules/contest-rolls.js`. Este
módulo puro conserva el dado bruto separado de su clasificación, aplica la
reducción común por objetivos superiores a 100 y separa el tipo de resolución
—dificultad, enfrentada o diferencial— de la modalidad de cada lado
—individual, equipo o eliminatoria—. Los equipos eligen mejor miembro, peor
miembro, representante designado o tiradas individuales de todos sus miembros
sin convertir esas reglas en tipos de tirada.
`scripts/rules/contest-chat.js` persiste
el estado versionado en `flags.mythras-foundry.contest`, valida revisión y
propiedad, y elige al DJ activo o al autor como coordinador de respaldo. Las
tarjetas antiguas y las tiradas simples no requieren migración.
Las tiradas simples y cada participante interactivo pueden gastar suerte
repetidas veces sobre su último dado mientras dispongan de puntos. El historial
permanece en la tarjeta; en las tiradas enfrentadas cada cambio vuelve a resolver
la comparación completa. En ambos casos sólo pueden gastar suerte los personajes
participantes que pertenecen al grupo activo.

## Compendios

Los módulos de `scripts/data/` son la fuente de verdad de los compendios. El
script `scripts/dev/build-packs.mjs` genera documentos con identificadores
deterministas en `.build/packs-src/` y compila la salida LevelDB en `packs/`.
Ambos directorios son artefactos generados e ignorados por Git.

El contenido propio de una campaña se guarda en compendios mundiales `Item` y no
en `scripts/data/`. El creador homebrew permite seleccionar uno existente o
crearlo, lo registra como fuente del catálogo y genera un documento inicial
válido mediante `scripts/rules/homebrew-items.js`.

Los once compendios declarados en `system.json` deben mantenerse sincronizados
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
