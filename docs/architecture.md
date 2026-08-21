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
- `scripts/system/`: composición del ciclo de vida de Foundry. El registro de
  documentos, hojas y API vive en `registration.js`; los hooks transversales de
  interfaz viven en `ui-hooks.js`.
- `scripts/ui/`: adaptadores de presentación reutilizables, incluido el registro
  declarativo de eventos de las hojas.
- `templates/`, `styles/` y `lang/`: presentación Handlebars, tema compartido y
  localizaciones. Las reglas visuales obligatorias están en `AGENTS.md`.
- `tests/`: pruebas con el runner nativo de Node. Cubren reglas, datos, manifiesto,
  localización y estándares estáticos de la interfaz.

## Registro y ciclo de vida

`scripts/mythras-foundry.js` es el único módulo declarado por `system.json` y el
punto de composición del sistema. Delega cada grupo de registros estable en
`scripts/system/`, para que el entrypoint no acumule implementación de interfaz
o configuración.

Durante `init` registra:

- los modelos `character` y `npc`;
- la clase de documento de Item y los modelos de los once tipos de Item;
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
- `scripts/rules/actor-conditions.js` es el adaptador común que reúne esas fuentes
  desde un Actor ya preparado. Character, PNJ, hojas y límites de recursos deben
  consumirlo en lugar de reconstruir por separado carga, heridas o estados;
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
Los estados temporales administrados son `ActiveEffect` con
`flags.mythras-foundry.timedCondition`. Los turnos se descuentan únicamente al
terminar el turno propio; las duraciones de asalto vencen en `mythrasRoundEnd`
y los plazos en minutos u horas permanecen manuales. Las fuentes son
independientes, por lo que retirar una no elimina otros bloqueos equivalentes.
Sangrando y Ahogándose crean una cola de Aguante antes del primer turno del
asalto; Desangrándose pierde Fatiga automáticamente. Sorprendido bloquea la
defensa hasta su iniciativa, las acciones ofensivas durante el asalto y aporta
un hueco ofensivo al primer ataque exitoso.

El estado táctico vive en `flags.mythras-foundry.tacticalState` del `Combat`.
Contiene relaciones versionadas por pareja de combatientes y declaraciones de
Bloqueo Pasivo por asalto. El alcance es relacional (`longer`, `shorter` o
`neutral`) y no se deriva de las coordenadas del lienzo. Cambiar Alcance se
coordina mediante mensajes revisables y comparte coordinador y permisos con los
intercambios de ataque.

El mismo estado táctico conserva perfiles de cobertura física por combatiente:
fuente, protección y localizaciones cubiertas. Se aplica entre parada y
armadura; no tiene PG automáticos y su deterioro queda en manos del DJ.

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

Los ataques interactivos se persisten como transacciones versionadas en
`flags.mythras-foundry.combat`. `scripts/rules/combat.js` resuelve de forma pura
la clasificación y ventaja diferencial, incluido el fallo automático al no
defenderse. Si la defensa estaba predeclarada, ataque y defensa comparten la
reducción por el mayor porcentaje superior a 100; una defensa tardía conserva
la clasificación ya obtenida por el ataque. `scripts/rules/combat-chat.js`
coordina por socket la respuesta de Parar, Evadir o no defenderse, valida
revisión y propiedad y permite modificar ambos dados mediante suerte. El daño,
la localización y la armadura continúan en la misma transacción. Parar reduce el
daño según el tamaño de ambas armas; Evadir decide si existe impacto comparando
primero el grado y después el dado más alto. La tarjeta conserva una instantánea
de armadura y PG, pero solo el DJ o el propietario defensor puede confirmar la
aplicación. Los cambios concurrentes convierten la propuesta en obsoleta y
obligan a recalcularla. La transacción enlaza además el combatiente, asalto,
ciclo y revisión del turno: el ataque y las defensas activas gastan un PA y el
tracker solo avanza cuando la tarjeta queda cerrada.

`MythrasCombat` extiende el documento nativo de Foundry. `Combat.round`
representa el asalto y `flags.mythras-foundry.turnEconomy.cycle` los recorridos
adicionales de iniciativa mientras alguien conserve PA. El máximo efectivo se
obtiene del resolvedor compartido de condiciones; `Defeated` lo fuerza a cero.
La iniciativa publicada combina `1d10 + iniciativa` con un d100 secundario en
la fracción, garantizando un orden total. Esta sustitución deliberada de la
simultaneidad permite aplicar de forma segura las transacciones secuenciales.

Las acciones generales se definen en `scripts/rules/combat-actions.js`, que no
depende de Foundry y calcula disponibilidad, movimiento, cargas, Afianzarse y
prioridad de interrupción. El controlador persiste su estado en
`flags.mythras-foundry.combatActions`: las colecciones de acciones, reservas de
Retrasar, movimiento, Afianzarse, restricciones de Maniobrar y progresos de
Aprestar comparten una revisión. Las tarjetas usan el mismo coordinador por
socket que el resto del combate. Las acciones guiadas conservan su coste,
parámetros, usuario y confirmación sin crear reglas de magia o monturas que el
sistema todavía no representa.

`actionAvailability` continúa siendo la API booleana compatible. Las hojas usan
`actionPresentation`, que añade coste y causa estable de indisponibilidad sin
eliminar acciones del DOM. Los controladores especializados de alcance,
bloqueo, cobertura, apuntado y recarga siguen siendo sus fuentes de verdad.

La silueta se monta desde `scripts/ui/body-silhouette.js` incrustando el SVG de
`assets/Silueta`. Vincula regiones mediante rangos, categoría y clase de PG
humanos, nunca mediante nombres traducidos. `hitLocation.system.amputated` es
independiente de inutilización y herida. Los textos de Trasfondo residen en
`CharacterData.system.narrative`.

Las navegaciones de pestañas de Actor y de Item comparten el mismo patrón
visual: pestañas inactivas oscurecidas, borde superior redondeado y pestaña
activa fundida con la superficie de papel. Los botones auxiliares que viven en
la misma barra no se tratan como pestañas.

Las consecuencias de Herida Grave y Crítica clasifican la zona mediante
`woundLocationKind`: para anatomía humana usa los rangos canónicos y para otras
anatomías recurre a categoría y clase de PG estructuradas. La amputación es una
decisión permanente editada exclusivamente desde la hoja de la localización;
las listas de combate solo la muestran cuando está activa.

La dependencia narrativa entre una tirada física y una localización no se
deduce automáticamente. Antes de cada tirada física, la hoja consulta por
separado si usa una zona con Herida Grave —un grado adicional— y si depende de
una zona inutilizada o amputada —tirada imposible—. Las tiradas no físicas no
abren esta consulta.

La transacción de combate usa el esquema 7 e intercala `awaitingEffects` entre
la defensa y el daño. El número de huecos procede de la ventaja diferencial;
el propietario del ganador o el DJ selecciona efectos válidos o renuncias y la
confirmación bloquea la suerte de ataque y defensa. Los huecos se conservan por
lado para admitir simultáneamente el efecto adicional de Sorpresa y una ventaja
defensiva. `scripts/rules/combat-effects.js`
contiene únicamente metadatos de ejecución, filtros y ayudantes puros. El texto
reglamentario canónico reside en `data/mythras_efectos_combate.json` y genera el
compendio `combat-effects`, incluido el cuadro de empalamiento dentro del Item
Empalar. Los efectos no modelados se conservan como resoluciones guiadas y
confirmadas, sin inventar geometría, turnos ni estados persistentes.

Los modos `ranged` y `siege` añaden a la transacción una instantánea `ranged`
con metros declarados, banda, TAM, fuentes de dificultad, potencia efectiva,
movimiento, preparación y munición consumida. Apuntar vive temporalmente en un
flag del Actor vinculado a combate, arma y blanco. Los desvíos al disparar a una
melé usan `awaitingAccidentalTarget` y `awaitingAccidentalDefense`, conservando
el dado, PA y proyectil originales.

Las comprobaciones secundarias forman una cola persistida: primero se resuelven
las tiradas de Aguante de efectos, después se confirma su consecuencia y por
último se resuelven las tiradas de Aguante de heridas. Solo entonces puede
aplicarse la propuesta de PG.

## Compendios

Los módulos de `scripts/data/` son la fuente de verdad de los compendios. El
script `scripts/dev/build-packs.mjs` genera documentos con identificadores
deterministas en `.build/packs-src/` y compila la salida LevelDB en `packs/`.
Ambos directorios son artefactos generados e ignorados por Git.

El contenido propio de una campaña se guarda en compendios mundiales `Item` y no
en `scripts/data/`. El creador homebrew permite seleccionar uno existente o
crearlo, lo registra como fuente del catálogo y genera un documento inicial
válido mediante `scripts/rules/homebrew-items.js`.

Los doce compendios declarados en `system.json` deben mantenerse sincronizados
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
