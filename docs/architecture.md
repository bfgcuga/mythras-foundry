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
- `scripts/migrations/`: transformaciones idempotentes de datos heredados,
  agrupadas por actores, objetos de combate y contenido. `index.js` conserva el
  único orden de ejecución de las migraciones de mundo.
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
duplicadas. El hook `ready` del entrypoint solo comprueba ese GM e invoca
`runWorldMigrations`; las inicializaciones idempotentes de un Actor recién
creado pasan por el mismo coordinador.

Los personajes usan `prototypeToken.actorLink: true`: sus tokens de escena abren
el mismo Actor persistente del directorio y no mantienen un `ActorDelta`
independiente. La migración enlaza los tokens de personaje antiguos, por lo que su
delta obsoleto deja de aplicarse. Los PNJ conservan `actorLink: false` porque cada token materializa
una instancia propia de las fórmulas de su plantilla.

## Modelos y cálculos derivados

La galería de personaje se persiste en `system.gallery` como una colección de
referencias `{ src, title }`. Su interfaz vive en el parcial reutilizable
`templates/actor/parts/gallery-tab.hbs`; actualmente solo la monta la hoja de
personaje, dejando abierta su adopción posterior por la hoja de PNJ.

La automatización de Maximizar Daño selecciona primero los dados del arma con
más caras y conserva partes estructuradas de la fórmula para distinguir en la
tarjeta los valores sustituidos sin almacenar HTML en el estado de combate.

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
- `scripts/rules/skill-roll-resolution.js` adapta esa instantánea a las tiradas
  de habilidad. Character y PNJ solicitan primero al jugador la incidencia de
  heridas graves o localizaciones inutilizadas y entregan la decisión al mismo
  resolvedor, que devuelve en una sola operación la dificultad impuesta y el
  desglose localizado de fatiga, heridas, estados y carga. La dificultad elegida
  en el diálogo permanece separada y se combina allí una única vez;
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

Las hojas de personaje y PNJ comparten los parciales y preparadores de las
pestañas Combate e Inventario. Combate conserva una única jerarquía de acciones,
localizaciones, armas y estilos; las diferencias del PNJ, como la durabilidad de
un arma natural vinculada a una localización, se resuelven al preparar los datos.
Inventario comparte monederos, propiedades, contenedores y operaciones. Las
armas cuyos modos son íntegramente naturales permanecen visibles en Combate y
se excluyen del Inventario para ambos tipos de Actor. Esta clasificación solo
decide la presentación del inventario: no crea automáticamente Puño/Patada ni
concede por sí misma capacidad de ataque o parada.

Cada Actor persiste `system.morphologyKey`. Los personajes parten de `humanoid`,
los PNJ de `custom`, y las criaturas oficiales declaran una morfología cuando su
tabla coincide inequívocamente. `scripts/rules/morphologies.js` es el catálogo
canónico del humanoide y las trece morfologías no humanas del manual. Cada Item
de localización conserva `morphologyKey + locationKey` como identidad semántica;
`nameKey` permanece como compatibilidad y la presentación se resuelve con el
idioma del usuario. Las zonas personalizadas conservan nombre literal y claves
vacías.

La migración versionada de morfología solo identifica coincidencias exactas,
marca el resto como `custom` y nunca reconstruye ni elimina Items. La migración
versionada anterior de Actor se ejecuta
una vez por versión y es la fuente única para
completar sus siete zonas, consolidar duplicados y reasignar referencias antes de
eliminarlos. Las criaturas mantienen su tabla anatómica en `scripts/data/creatures.js`:
las zonas equivalentes pueden reutilizar las mismas claves de presentación, pero
la recuperación de zonas ausentes se realiza contra la criatura canónica y nunca
inyecta una anatomía humana en un PNJ.
La marca `flags.mythras-foundry.hitLocationMigrationVersion` separa esa reparación
de la edición ordinaria: después de reconciliar un Actor, borrar, renombrar o
añadir zonas personalizadas no provoca que el arranque las restaure o sustituya.
Las hojas ofrecen una selección de morfología separada de su aplicación: cambiar
el selector solo guarda la elección. En modo edición del personaje, o desde el
PNJ fuente en su propio modo de edición y nunca desde un token sintético,
«Aplicar morfología» crea
primero el conjunto canónico, conserva por clave las heridas permanentes, el
estado compatible y la armadura natural, y reasigna armaduras, armas naturales,
efectos activos, Bloqueo Pasivo y Cobertura; solo después elimina las zonas
anteriores. Si una herida permanente pertenece a una zona sin equivalencia, la
operación se bloquea. `custom` no tiene plantilla aplicable. Mensajes e
intercambios históricos mantienen sus instantáneas y pueden quedar obsoletos de
forma segura. Las referencias a IDs ya
inexistentes se detectan en la preparación compartida de inventario y combate y
se presentan con un fondo rojo semántico.
Las piezas humanas (`Yelmo`, `Peto`, `Faldar`, `Brazal` y `Greba`) solo se
autoasignan por referencia semántica a zonas `humanoid`; el rango histórico se
mantiene como compatibilidad. Para morfologías no humanas se usa la `Pieza de
armadura`, cuya cobertura guarda directamente el ID de la zona escogida. Una
aplicación de morfología conserva las piezas genéricas cuando puede mapear su ID
anterior a una zona semánticamente equivalente. Al pasar a una morfología no
humana, las piezas humanas quedan sin asignar y desequipadas.
Las declaraciones de Bloqueo Pasivo almacenan una instantánea para representar el
estado del asalto, pero el diálogo y su validación reconstruyen las opciones desde
las localizaciones actuales del Actor combatiente. De este modo, una reparación de
anatomía realizada con el asalto ya preparado no vuelve a ofrecer IDs eliminados.
Para Actors sintéticos, la resolución prioriza el documento vivo expuesto por el
combatiente y solo usa el UUID persistido como respaldo, pues el UUID de una
instancia de token no siempre se materializa como un Actor al resolverlo.

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
Inconsciente impiden iniciar ataques; Inconsciente también impide defenderse,
mientras Aturdido permite las defensas.
Los estados temporales administrados son `ActiveEffect` con
`flags.mythras-foundry.timedCondition`. Los turnos se descuentan únicamente al
terminar el turno propio; las duraciones de asalto vencen en `mythrasRoundEnd`
y los plazos en minutos u horas permanecen manuales. Las fuentes son
independientes, por lo que retirar una no elimina otros bloqueos equivalentes.
Sangrando y Ahogándose crean una cola de Aguante antes del primer turno del
asalto. Esas tiradas resuelven su objetivo efectivo en el momento de lanzar los
dados mediante `resolveSkillRollConditions`, por lo que incorporan la Fatiga,
heridas y estados vigentes. Desangrándose crea una única entrada automática por Actor y pierde un
nivel de Fatiga, sin tirada, durante esa misma preparación. Su efecto manual
permanece hasta retirarlo y fuera de combate no avanza. Sorprendido bloquea la
defensa hasta su iniciativa, las acciones ofensivas durante el asalto y aporta
un hueco ofensivo al primer ataque exitoso.

`Agonizando` conserva un contador de asaltos que se descuenta durante la misma
preparación. Una nueva fuente solo reemplaza el efecto si su contador es
estrictamente menor, de modo que una herida posterior nunca retrasa la muerte.
Al llegar a cero se aplica el estado especial nativo Muerto/Derrotado y se
sincronizan los combatientes del Actor. Las heridas críticas de combate y de
peligros comparten el criterio central: extremidad, Ritmo de curación ×60;
zona vital con Aguante superado, ×2; zona vital con Aguante fallado, muerte.
La Fatiga que alcanza `dead` utiliza la misma integración nativa.

Ácido usa dos estados temporales administrados, `Salpicadura de ácido` e
`Inmersión en ácido`. Cada efecto conserva concentración, exposición y una
selección libre de localizaciones o la opción aleatoria. La fórmula de daño
depende solo de la concentración y se evalúa por separado para cada localización.
La primera aplicación es inmediata y, al preparar cada asalto,
cada efecto crea una entrada bloqueante: el DJ decide aplicar el daño, omitirlo
durante ese asalto o retirar el estado. No existe daño automático. Aplicar u
omitir consume una revisión de la duración limitada de una salpicadura; una
inmersión continúa hasta retirarla. Fuera de combate la revisión queda pausada.
Cuando el DJ aplica daño, la tirada corroe una sola capa: primero la pieza
equipada con más PA y, cuando ya no queda ninguna, la armadura natural;
únicamente el exceso alcanza los PG.

Fuego reutiliza la resolución de daño localizado, pero permanece deliberadamente
dirigido por el DJ: ignora los PA y aplica una tirada independiente a cada
localización seleccionada. `Ardiendo` es un estado manual con una configuración
recordada de Intensidad, fórmula y localizaciones. Al preparar cada asalto crea
una entrada bloqueante en la cola existente; el DJ debe aplicar el daño, omitirlo
durante ese asalto o extinguir el estado. La tabla de ignición y el alcance por
Intensidad son informativos: el sistema no decide ignición ni propagación.

Caídas es un peligro puntual sin estado ni integración con la cola de asalto.
`scripts/rules/fall.js` calcula la distancia efectiva tras TAM, Acrobacias y
superficie blanda; añade los dados por gran tamaño, objeto o velocidad de
vehículo, y aplica tiradas independientes a localizaciones aleatorias sin
consultar PA. Una superficie peligrosa añade una fórmula configurable y una
tirada independiente a cada localización dañada por la caída. En vehículos,
los metros por asalto se muestran también como
metros por segundo usando asaltos de cinco segundos y la equivalencia de reglas
para daño es velocidad dividida entre dos. La API pública es
`game.mythrasFoundry.hazards.fall`.

Asfixia usa un efecto temporal `Asfixiándose`, pero no aplica desgaste hasta
agotar el tiempo calculado desde Aguante y la preparación inicial. Cada
preparación de asalto avanza cinco segundos de forma idempotente; una vez
alcanzado el umbral, añade una entrada bloqueante de Aguante a la misma cola de
consecuencias. Crítico, éxito, fallo y pifia producen respectivamente 0, 1,
`1d2` y `1d3` niveles de Fatiga. Retirar el estado detiene el contador. La
recuperación posterior queda fuera del sistema.

Las solicitudes grupales de Fatiga viven en flags versionados del mensaje de
chat y no dependen de un combate. El DJ escoge grupo, participantes, Atletismo,
Músculo o Aguante y dificultad. Cada respuesta valida revisión, pertenencia y
propiedad en el coordinador, incorpora el `Roll` al mensaje y empeora un nivel
de Fatiga únicamente ante fallo o pifia. La API pública es
`game.mythrasFoundry.fatigueChecks.open()`.

El compendio de macros incluye el lanzador exclusivo del DJ «Aplicación de daño
o estados». Presenta botones y delega en las APIs públicas de daño directo,
Ácido, Fuego, Caída, Fatiga grupal, Asfixia/Ahogamiento, Desangrándose,
Agonizando o el gestor de estados; no duplica ninguna regla de resolución.

El daño directo vive en `scripts/rules/direct-damage.js` y no mantiene estado.
Acepta una cantidad fija o una fórmula evaluada independientemente por cada
localización seleccionada; alternativamente resuelve una sola zona mediante
`1d20`. Modifica directamente los PG sin consultar ni deteriorar armadura,
publica una tarjeta agrupada y delega las consecuencias de heridas en el mismo
flujo que Ácido, Fuego y Caída. Su API es
`game.mythrasFoundry.hazards.damage`.

El gestor de estados `game.mythrasFoundry.conditions.statuses` consume directamente
`MYTHRAS_STATUS_EFFECTS`, muestra la explicación localizada de cada entrada y permite
duración manual, por turnos propios o por asaltos. Los estados con configuración propia
delegan en su flujo especializado. Todo estado nuevo debe registrarse en ese catálogo y
añadir `MYTHRASF.Status.Description.<id>` en ambos idiomas; de este modo queda incorporado
automáticamente al gestor y al macro «Aplicación de daño o estados».

La Fatiga periódica de combate comparte la cola bloqueante de preparación del
asalto. Cada combatiente conserva en sus flags un contador idempotente de asaltos
completados y vence cada `ceil(CON / 5)` asaltos. Al avanzar, se resuelve durante
la preparación del asalto siguiente; al terminar el combate se liquida el último
asalto antes de cerrarlo. Los personajes solicitan Aguante a sus propietarios;
los PNJ resuelven la misma tirada en el coordinador. Ambas rutas calculan el
objetivo con `roundEnduranceTarget` y el resolvedor común de condiciones, y solo publican el resultado
si pierden un nivel, salvo que el ajuste mundial
`showNpcCombatFatigueChecks` habilite el flujo completo. Éxito y crítico no
causan pérdida; fallo y pifia incrementan la Fatiga en un nivel.

El estado táctico vive en `flags.mythras-foundry.tacticalState` del `Combat`.
Contiene relaciones versionadas por pareja de combatientes, declaraciones de
Bloqueo Pasivo por asalto, coberturas y la colección versionada `ruses`. Cada
Ardid identifica propietario, rival, efecto vigilado, intercambio de origen,
estado y revisión. Las versiones anteriores se normalizan con la colección
vacía; al terminar el combate se elimina junto con el resto del estado táctico.
El alcance es relacional (`longer`, `shorter` o
`neutral`) y no se deriva de las coordenadas del lienzo. Cambiar Alcance se
coordina mediante mensajes revisables y comparte coordinador y permisos con los
intercambios de ataque. Cada lado de una relación conserva explícitamente el
arma y modo empuñados; el DJ puede sustituirlos o eliminar la relación desde la
vista táctica sin alterar los Items de los actores. Una relación eliminada queda
suprimida durante el encuentro para que la detección automática no la regenere;
crear deliberadamente la misma pareja vuelve a activarla. Al finalizar el
encuentro se elimina todo el estado táctico.
Las tablas de la vista táctica son la superficie de corrección: el DJ edita en
ellas relaciones, armas y todas las coberturas; los propietarios pueden
gestionar el Bloqueo Pasivo y la cobertura de sus propios actores y el resto de
jugadores conserva esos controles deshabilitados.
Desde esa misma vista el DJ puede cancelar o reactivar una declaración de
Bloqueo Pasivo y volver a abrir su selector para corregir arma, localizaciones
y postura; estas operaciones sincronizan el efecto temporal de agacharse.
La preparación de cada asalto posterior reutiliza como valores iniciales el arma,
las localizaciones y la postura de la declaración inmediatamente anterior si
siguen disponibles. La misma instantánea habilita una repetición directa; el
coordinador vuelve a validarla con las reglas actuales antes de persistirla.
Mientras una declaración permanece activa, el selector de Parar conserva todas
las opciones, pero preselecciona una alternativa al arma que mantiene el bloqueo
si el defensor empuña otra arma válida.
Cancelar ese selector no crea una defensa ni altera el intercambio: la tarjeta
permanece a la espera para que el defensor elija de nuevo entre sus respuestas.
La disponibilidad de PA se comprueba también en el cliente antes de configurar
la defensa. Sin PA se ocultan Parar y Evadir, se mantiene cualquier respuesta
pasiva válida y «No defenderse» se presenta como «Sin puntos de acción»; el
coordinador conserva después la validación autoritativa antes de gastar el PA.

La comprobación automática de contigüidad del Bloqueo Pasivo es un ajuste de
mundo desactivado por defecto, porque las anatomías extrañas pueden requerir el
criterio del DJ. Cuando se activa, la contigüidad humana es anatómica, no el
orden de los rangos del d20: el pecho conecta cabeza, abdomen y brazos, y el
abdomen conecta las piernas. Las anatomías personalizadas sin categorías
humanas conservan como alternativa el orden de sus rangos. Un combatiente con
dos armas manufacturadas de una mano puede dedicar cualquiera de ellas a
proteger una localización aunque no tenga el rasgo Bloqueo Pasivo. La cola de
preparación muestra todos los combatientes elegibles y diferencia de forma
explícita por declarar, declarado y pasado.

El mismo estado táctico conserva perfiles de cobertura física por combatiente:
fuente, protección y localizaciones cubiertas. Se aplica entre parada y
armadura; no tiene PG automáticos y su deterioro queda en manos del DJ. La
corrección del DJ del menú táctico crea, modifica, desactiva o elimina estos
perfiles y, por tanto, altera directamente su aplicación a personajes y PNJ.

El estado equipado determina efectos y cálculos, mientras que la estructura de
inventario determina qué objetos se transportan y dónde se guardan.

Las tiradas de habilidad se resuelven en `scripts/rules/skill-roll.js`; el
diálogo de ajustes, el documento de Item y la interacción de suerte de la tarjeta
consumen esos mismos objetivos y umbrales para no duplicar reglas.

Toda tirada visible iniciada por un control del sistema pasa por
`scripts/rules/system-roll.js`. El servicio evalúa con `Roll` de Foundry y, solo
para el Gamemaster que activa el control con Shift, construye el mismo `Roll`
evaluado a partir de un valor validado para cada dado físico. El gesto se captura
en el control y se transmite como dato efímero; no existe un modo persistente ni
se guarda una marca que diferencie el resultado. Las tiradas automáticas sin un
control propio permanecen aleatorias.

Las tiradas que crean un mensaje
nuevo incluyen el objeto en `ChatMessage.rolls`; las que actualizan una tarjeta
existente o no generan mensaje usan `scripts/rules/dice-animation.js`. Este
puente conserva el modo de tirada y emite la animación sincronizada cuando Dice
So Nice está activo, incluidos los resultados elegidos si su API los admite, sin
convertir el módulo en una dependencia obligatoria.

Las tiradas interactivas se modelan en `scripts/rules/contest-rolls.js`. Este
módulo puro conserva el dado bruto separado de su clasificación, aplica la
reducción común por objetivos superiores a 100 y separa el tipo de resolución
—dificultad, enfrentada o diferencial— de la modalidad de cada lado
—individual, equipo o eliminatoria—. Los equipos eligen mejor miembro, peor
miembro, representante designado o tiradas individuales de todos sus miembros
sin convertir esas reglas en tipos de tirada.
`scripts/rules/contest-chat.js` persiste
el estado versionado en `flags.mythras-foundry.contest`, valida revisión y
propiedad, y elige al DJ activo o al autor como coordinador de respaldo. Cada
participante conserva el UUID de su instancia de Actor para distinguir tokens
sintéticos procedentes del mismo PNJ. En eliminatorias todos los miembros quedan
pendientes y una cola serializada convierte la primera respuesta válida en el
dado común; las posteriores se rechazan por revisión obsoleta. Las
tarjetas antiguas y las tiradas simples no requieren migración.
Las tiradas simples y cada participante interactivo pueden gastar suerte
repetidas veces sobre su último dado mientras dispongan de puntos. El historial
permanece en la tarjeta; en las tiradas enfrentadas cada cambio vuelve a resolver
la comparación completa. En ambos casos sólo pueden gastar suerte los personajes
participantes que pertenecen al grupo activo.
Las tiradas de Fatiga de combate de la cola de asalto siguen la misma distinción:
el propietario repite o invierte su propio d100, mientras un miembro del grupo
activo puede gastar Suerte para obligar a repetir el d100 de un rival. Cada cambio
reclasifica la tirada y recalcula su pérdida de Fatiga; si la Fatiga del Actor ya
cambió por otra causa, la tirada deja de admitir Suerte para no revertir efectos
posteriores.
`scripts/rules/skills.js` centraliza además el registro persistente de pifias:
toda pifia de una habilidad o estilo de combate marca `system.fumbled`, incluidas
las respuestas interactivas y las repeticiones por Suerte.
`scripts/rules/document-names.js` es la fuente común de nombres operativos: los
personajes usan el nombre actual del Actor del directorio y los PNJ sintéticos el
nombre individual de su TokenDocument. Las tiradas especiales se coordinan desde
`scripts/rules/special-roll.js` y reutilizan los mismos diálogos y resoluciones.
Cuando una tarjeta interactiva recibe una respuesta, sus `rolls` se amplían con
objetos Roll reconstruidos; así Foundry y Dice So Nice procesan también paradas,
tiradas de equipo, respuestas enfrentadas y daño.

Los ataques interactivos se persisten como transacciones versionadas en
`flags.mythras-foundry.combat`. `scripts/rules/combat.js` resuelve de forma pura
la clasificación y ventaja diferencial, incluido el fallo automático al no
defenderse. Si la defensa estaba predeclarada, ataque y defensa comparten la
reducción por el mayor porcentaje superior a 100; una defensa tardía conserva
la clasificación ya obtenida por el ataque. `scripts/rules/combat-chat.js`
coordina por socket la respuesta de Parar, Evadir o no defenderse, valida
revisión y propiedad y permite modificar ambos dados mediante suerte.
En esas tiradas, el diálogo enumera los participantes controlables con puntos
disponibles y registra cuál paga. El propietario del dado puede repetirlo o
invertir sus cifras; el rival solo puede gastar Suerte para obligar a repetirlo.
El coordinador vuelve a validar pagador, propiedad, modo y saldo antes de
aceptar la modificación.
Antes de consumir PA, puntería o munición, el ataque reúne el blanco, las
declaraciones, las circunstancias a distancia y los ajustes porcentuales en un
único diálogo sin la configuración de concurso. Los grados favorables y
adversos de la dificultad elegida e impuesta se suman alrededor de Estándar
después de aplicar habilidades limitadas o reforzadas; la transacción
conserva la base, esos ajustes y el objetivo efectivo como una sola fuente para
la clasificación, la tarjeta y las repeticiones por suerte.
El daño, la localización y la armadura continúan en la misma transacción. Parar reduce el
daño según el tamaño de ambas armas; una parada activa se aplica primero y el
bloqueo pasivo de la localización se evalúa después únicamente si queda daño
por mitigar. Si interviene, la declaración se consume al confirmar la aplicación
del daño; una propuesta cancelada u obsoleta no la consume. La tarjeta omite
las etapas de mitigación que no hayan intervenido. Evadir decide si existe impacto comparando
primero el grado y después el dado más alto. La tarjeta conserva una instantánea
de armadura y PG, pero solo el DJ o el propietario defensor puede confirmar la
aplicación. Los cambios concurrentes convierten la propuesta en obsoleta y
obligan a recalcularla. La transacción enlaza además el combatiente, asalto,
ciclo y revisión del turno: el ataque y las defensas activas gastan un PA y el
tracker solo avanza cuando la tarjeta queda confirmada. Mientras no se haya
aplicado daño, un estado o un cambio táctico al blanco, la transacción puede
cancelarse: `scripts/rules/combat-cancellation.js` decide esa frontera,
`combat-chat.js` restituye los PA gastados y el turno permanece en su posición.

`MythrasCombat` extiende el documento nativo de Foundry. `Combat.round`
representa el asalto y `flags.mythras-foundry.turnEconomy.cycle` los recorridos
adicionales de iniciativa mientras alguien conserve PA. El máximo efectivo se
obtiene del resolvedor compartido de condiciones; `Defeated` lo fuerza a cero.
La iniciativa publicada combina `1d10 + iniciativa`. La tirada original se conserva en el
combatiente y, si la opción mundial correspondiente está activa, el total se recalcula con la
iniciativa efectiva cuando cambian Fatiga, heridas, armadura o estados. Una transacción de
combate abierta aplaza el cambio hasta cerrarse. Cuando dos resultados
coinciden, añade un d100 secundario en la fracción para garantizar un orden
total. La fracción solo se presenta en el tracker para grupos empatados. Las
tiradas individuales crean una tarjeta de chat y las selecciones múltiples del
tracker comparten una tarjeta agregada. Esta sustitución deliberada de la
simultaneidad permite aplicar de forma segura las transacciones secuenciales.

Las pruebas enfrentadas provocadas por heridas graves y críticas se conservan dentro de
`combat.effects.checks`. Cada entrada de herida identifica gravedad, localización y clase
anatómica. Su tarjeta presenta por separado el d100 y grado de Aguante, la tirada original
opuesta, el resultado de la oposición y la consecuencia aplicable. Ambas tiradas y el
resultado resistido o no resistido consumen los tonos semánticos compartidos. El `Roll` serializado se
añade al mensaje al resolver la prueba; la explicación extensa se abre desde la ayuda
contextual de la propia entrada.

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
`assets/Silueta`. El ajuste de mundo `silhouetteOrientation` decide si las
localizaciones izquierdas y derechas se proyectan como vista frontal o dorsal.
La vinculación solo se activa para `humanoid` y usa rangos, categoría y clase de
PG humanos, nunca nombres traducidos. Las localizaciones canónicas conservan en
`system.locationKey` su clave anatómica estable y en `Item.name` su nombre
canónico castellano;
`hitLocationDisplayName` resuelve la etiqueta para el idioma de cada usuario sin
reescribir el documento. Al editar la etiqueta localizada desde la hoja se
eliminan las claves y el nombre pasa a ser personalizado y literal;
los nombres complejos y las anatomías personalizadas no se alteran. La lesión consolidada reside en
`hitLocation.system.permanentWound`: conserva gravedad, tirada, máximo original,
máximo efectivo, resultados del d20 anulados y descripción. El máximo operativo
de la localización es siempre el efectivo; los recálculos por CON/TAM y la
generación de PNJ reaplican la lesión mediante los ayudantes puros de
`scripts/rules/hit-locations.js`. El ajuste de mundo
`permanentWoundHitLocationRule` decide cómo afecta una mutilación al impacto:
`checkD3`, valor predeterminado, conserva el rango original y exige que `1d3`
supere la gravedad en cada impacto; `reduceD20Range` aplica los resultados d20
anulados de la regla oficial. «Elegir Localización» exige siempre el 1d3. El
coordinador valida el modo activo, incorpora el dado al mensaje y convierte el
impacto en `missedLocation` cuando alcanza la parte ausente. Los textos de
Trasfondo residen en
`CharacterData.system.narrative`, mientras que el panel de heridas permanentes
edita directamente sus Items de localización.

Las cinco tablas porcentuales de familia y conexiones se definen una sola vez
en `scripts/data/family-tables.js`. Esa fuente genera el compendio RollTable y
alimenta la fase opcional del asistente. El asistente resuelve además sus dados
secundarios, el procedimiento de matrimonio y la distribución entre campos
narrativos. `backgroundDraft.familyRolls` conserva los bloqueos, resultados y
textos originales hasta completar la creación; cada resultado se aplica de
inmediato a `CharacterData.system.narrative` y sigue siendo texto editable.

La tabla 1d100 de acontecimientos se define en
`scripts/data/background-events.js`, que genera el compendio RollTable y
resuelve las tiradas correspondientes a la edad al abandonar esa fase del
asistente. `backgroundDraft.backgroundEventRolls` evita repetirlas al navegar
entre fases y conserva la historia anterior; los resultados se anteponen en
`CharacterData.system.narrative.history` como «Posible trasfondo», seguidos de
«Notas del jugador» cuando ya existía texto.

Una Herida Crítica aplicada por el flujo de combate tira `1d3` si la localización
no ha alcanzado gravedad 3, fuerza una mejora mínima de un grado y actualiza la
lesión junto con sus PG. En extremidades, los resultados anulados se retiran
desde el inicio del intervalo; una tirada aleatoria que cae en ellos termina el
ataque sin localización ni daño.

La tabla operativa de localizaciones de personaje y PNJ tiene una única fuente
de presentación. `scripts/ui/hit-location-table.js` prepara filas, armadura y
Bloqueo Pasivo, y ambas hojas renderizan
`templates/actor/parts/hit-location-table.hbs`. Las diferencias de edición de
una plantilla de PNJ se expresan únicamente mediante parámetros del parcial; no
se mantienen copias de columnas o filas en las plantillas de Actor.

Las navegaciones de pestañas de Actor y de Item comparten el mismo patrón
visual: pestañas inactivas oscurecidas, borde superior redondeado y pestaña
activa fundida con la superficie de papel. Los botones auxiliares que viven en
la misma barra no se tratan como pestañas.

Los encabezados de Actor son una superficie cromática independiente: usan
`--mythras-header-ink`, `--mythras-header-line` y
`--mythras-header-control` para campos, separadores y botones. No deben heredar
el contraste de componentes equivalentes situados sobre el papel.

Las consecuencias de Herida Grave y Crítica clasifican la zona mediante
`woundLocationKind`: para anatomía humana usa los rangos canónicos y para otras
anatomías recurre a categoría y clase de PG estructuradas. La amputación es una
decisión permanente editada exclusivamente desde la hoja de la localización;
las listas de combate solo la muestran cuando está activa.

La dependencia narrativa entre una tirada y una localización no se deduce
automáticamente. Antes de cada tirada, si existen localizaciones afectadas, la
hoja consulta por separado si usa una zona con Herida Grave —un grado
adicional— y si depende de una zona marcada como inutilizada —tirada
imposible—.
La consulta no clasifica la tirada como física o no física: esa decisión queda
siempre en manos del jugador o del DJ.

La inutilización de una localización se conserva en `system.disabled`. Una
Herida Grave que inutiliza una extremidad marca ese campo y la consulta de
tiradas lo consume directamente. `stunnedLocation` pertenece exclusivamente al
efecto de combate «Aturdir Localización» y no representa inutilización ni se
vincula a la recuperación de puntos de golpe. Cuando la curación eleva los PG
de una localización inutilizada hasta el estado de Herida Leve, la misma
actualización desmarca `system.disabled`.

Las consultas de ese modelo se realizan mediante los ayudantes puros de
`scripts/rules/hit-locations.js`: `isLocationDisabled(location)` representa
exclusivamente la casilla de inutilización, `isLocationCrippled(location)`
representa exclusivamente una lesión permanente con gravedad positiva y
`locationWoundState(location)` deriva `healthy`, `minor`, `serious` o
`major` de los PG actuales y máximos. Las vistas no consultan directamente los
campos persistentes para reconstruir esos conceptos. `stunnedLocation` sigue
siendo un efecto de combate independiente y no forma parte de estos ayudantes.

Al producirse una Herida Grave se aplica Aturdido durante `1d3` turnos. La
herida continúa derivándose de los PG y no dispone de un estado duplicado. En
un brazo, fallar Aguante crea en la misma tarjeta una consecuencia guiada para
identificar qué objeto estaba sostenido en esa mano. El selector ofrece todas
las armas y escudos empuñados, además de «Ningún objeto», porque el sistema no
presupone lateralidad ni orden de equipación. Al confirmarla, el objeto elegido
cambia a no equipado, permanece en el inventario y el intercambio puede cerrar.
Las consecuencias inmediatas se aplican al confirmar el daño; las que dependen
de Aguante esperan a que su prueba se resuelva.

`scripts/rules/wound-consequences.js` es la fuente común para las consecuencias
anatómicas de Herida Grave y Crítica. Produce un plan puro a partir de gravedad,
clase de localización y éxito o fallo de Aguante; combate y peligros ejecutan
ese mismo plan. La forma de resolver Aguante depende del origen: el daño de un
ataque mantiene la oposición de Aguante contra la tirada de ataque, mientras
que ácido, fuego, caídas y daño directo, al no disponer de tirada de ataque,
realizan una tirada simple de `1d100` contra Aguante. Esta tirada simple se
aplica tanto a heridas graves como críticas y en cualquier localización.

La condición lisiada se deriva exclusivamente de `system.permanentWound` y no
implica por sí misma inutilización. Una Herida Crítica marca la lesión
permanente, pero ni activa visualmente la casilla de inutilizada ni incorpora la
localización a la consulta de tiradas salvo que `system.disabled` también esté
marcado.

La transacción de combate usa el esquema 9 e intercala `awaitingEffects` entre
la defensa y el daño. El número de huecos procede de la ventaja diferencial;
el propietario del ganador o el DJ selecciona efectos válidos o renuncias; esa
selección bloquea la suerte de ataque y defensa. Cuando no existen huecos, la
confirmación automática conserva la suerte hasta tirar el daño. Los huecos se conservan por
lado para admitir simultáneamente el efecto adicional de Sorpresa y una ventaja
defensiva. `scripts/rules/combat-effects.js`
contiene únicamente metadatos de ejecución, filtros y ayudantes puros. El texto
reglamentario canónico reside en `data/mythras_efectos_combate.json` y genera el
compendio `combat-effects`, incluido el cuadro de empalamiento dentro del Item
Empalar. La fuente oficial de esas entradas es `Mythras básico revisado`. Las
referencias de atacante y defensor no cambian al aplicar «Dañar Arma».
`damage.weaponTarget` registra por separado los actores e Items que originan y
reciben el daño: ofensivamente usa el arma atacante contra el arma de parada;
defensivamente usa el arma de parada y el modificador de su portador contra el
arma atacante. El objetivo se vuelve a resolver por ID y sus PA y PG se validan
antes de actualizarlo. Los estados `intact`, `damaged` y `broken` se derivan en
`scripts/rules/weapon-durability.js`; no se persisten. Una rotura limita los PG
a cero y desequipa el Item, mientras una reparación por encima de cero vuelve a
permitir equiparlo.

La compatibilidad de «Dañar Arma» no depende de que el otro efecto tenga como
objetivo al oponente, sino de que participe en el conducto de daño corporal o
en las defensas que protegen de ese golpe. Esos efectos declaran
`damageTarget: opponent` en los metadatos de ejecución y son incompatibles al
redirigirse el daño al arma. Las consecuencias independientes —por ejemplo
Agarrar, Arrebatar Arma o Derribar Oponente— siguen siendo compatibles, igual
que Maximizar Daño, cuyos dados sí pueden aplicarse al arma. Tumbar Oponente es
incompatible porque su regla exige que el rival sufra al menos una Herida Leve.

«Desarmar oponente» reutiliza el conducto de pruebas enfrentadas y Suerte. La
prueba conserva el arma elegida y el ajuste de dificultad derivado de ambos
Tamaños, y se cancela automáticamente si la FUE de la víctima supera el doble
de la del ganador. Al fallar la resistencia se desequipa el arma y se evalúa el
Modificador de Daño. Si existe una mano libre, una consecuencia persistente de
la tarjeta permite transferir el Item o arrojarlo; el coordinador vuelve a
validar documentos, permisos y capacidad de manos antes de la transferencia.

«Inmovilizar arma» guarda una condición `weaponPinned` por arma en los
ActiveEffects del portador: `timedCondition.weaponId` identifica el Item y
`sourceActorUuid`/`sourceTokenUuid` identifican al captor. No cambia `equipped`
ni duplica el estado en el Item. `weapon-pinning.js` ofrece las consultas puras
para hojas, ataques, paradas, bloqueo pasivo y acciones; un efecto desactivado
o cuyo Item desapareció no bloquea otras armas. La tarjeta del intercambio
ofrece al ganador elegir el arma, bajo revisión y permisos del coordinador.
`weapon-pin-runtime.js` mantiene una tarjeta `weaponRelease` persistente: cobra
1 PA al iniciar en el turno propio, cada propietario elige Músculo o Pelea y
el DJ coordinador tira y compara con la reducción compartida por encima de
100 %. Solo ganar elimina esa condición; empate o fallo la conservan. La otra
parte no paga PA. Las solicitudes se serializan y un intento pendiente impide
iniciar otro para el mismo actor. Requiere un DJ conectado. Cambiar una relación
a destrabada, eliminarla o aplicar Retirada elimina las inmovilizaciones entre
esos dos actores, conservando las de terceros. El efecto figura como automatizado.
El gestor de estados usa la asignación configurada `weaponPin` para elegir
arma y captor; no crea una condición genérica sin vínculo al Item.

Las
restricciones persistidas usan exclusivamente identificadores estables e
independientes del idioma. El constructor del compendio rechaza cualquier valor
fuera de los catálogos cerrados; la hoja y el creador homebrew solo ofrecen los
valores canónicos admitidos. La ejecución consume la regla, fase y booleanos
técnicos persistidos en cada Item. Los efectos automáticos
condicionados a causar daño, como Empalar, quedan resueltos al confirmar que
existe daño penetrante. La tarjeta aplica primero el daño y habilita después,
en paneles separados, las comprobaciones de efectos y de heridas; los efectos
guiados no pueden resolverse antes de completar esa fase de daño. Los
efectos no modelados se conservan como resoluciones guiadas y
confirmadas, sin inventar geometría, turnos ni estados persistentes.
La selección de combate combina el compendio oficial con todos los compendios
de Items configurados en `catalogSources`, toma únicamente documentos
`combatEffect` con clave y permite que una fuente homebrew posterior sustituya
una clave oficial de forma determinista. Las restricciones cerradas definen el
esquema funcional del Item, no limitan el compendio del que puede proceder.
El diálogo identifica la selección mediante el encabezado rojizo compartido,
muestra en cada hueco el nombre y la descripción del efecto elegido, y solo
presenta parámetros cuando la regla los necesita en esta fase (actualmente, la
localización de «Elegir localización» y la clave secreta del efecto vigilado por
«Ardid»); la selección no recoge notas libres. El coordinador valida esa clave
contra el catálogo y nunca la presenta en la tarjeta pública.
Las opciones restringidas a un crítico propio se resaltan en verde suave y las
restringidas a una pifia del rival, en rojo suave; la clasificación procede de
`rollRestriction` y del lado que realiza la selección, no del texto descriptivo.
Una Herida Crítica en una extremidad registra directamente el daño, la lesión
permanente y sus estados mecánicos; no crea una confirmación narrativa
pendiente. Si no queda otra resolución guiada, el intercambio se considera
terminado y avanza automáticamente tras aplicar el daño.

Al confirmar efectos ofensivos, el coordinador consume como máximo un Ardid
activo que coincida por defensor, rival y clave. La selección ofensiva se mueve
a `replacedSelections` para auditoría, deja de participar en compatibilidad y
cálculos, y el intercambio entra en `awaitingRuse`. Solo el propietario o el DJ
pueden confirmar la sustitución. Esta añade una selección defensiva
extraordinaria, sin consumir diferencial ni permitir renuncia, con
`automaticSuccess` y un `automaticSource` estructurado que referencia el Ardid.
Después se reanuda cualquier selección defensiva ordinaria pendiente y, a
continuación, el flujo normal de daño.

`automaticSuccess` es una propiedad general de la selección, no una excepción
del efecto Ardid. Los efectos inmediatos se ejecutan normalmente; sus tiradas de
resistencia se registran como fallo automático, sin tirada ni Suerte. Los
efectos condicionados esperan primero a que exista daño o herida y entonces
omiten su resistencia. Los efectos cuya consecuencia aún es guiada conservan
la marca automática visible y su cierre manual actual. La cancelación y el
cierre forzado reconocen `awaitingRuse` para que ningún intercambio quede
bloqueado.
Mientras la prueba de Aguante de una Herida Crítica siga pendiente, el
propietario de la víctima o el DJ puede gastar uno de sus puntos de Suerte para
reducirla a Herida Grave. La propuesta eleva los PG de la localización a
`1 - PG máximos`, el primer valor del intervalo Grave, vuelve a preparar la
prueba de Aguante con esa gravedad y aplica después únicamente sus
consecuencias. Cambiar la localización o repetir el daño invalida esta reducción.
El daño se aplica antes de habilitar la prueba de Aguante de la herida: primero
se consolidan los PG y las consecuencias inmediatas y después se resuelven las
consecuencias dependientes de la oposición. El gasto de Suerte permanece antes
de aplicar el daño porque modifica tanto su cantidad como la gravedad resultante.
El resultado de Aguante de una Herida Grave o Crítica queda provisional antes
de ejecutar sus consecuencias. Su propietario puede gastar Suerte para repetirlo
o aceptarlo; únicamente la aceptación consolida las consecuencias anatómicas.
Las resistencias de efectos siguen el mismo estado provisional y admiten Suerte
antes de aceptar el resultado. «Cegar oponente» ofrece Evadir y los estilos de
combate aplicables a un escudo equipado; tras una resistencia fallida y aceptada
tira 1d3, aplica Cegado y conserva esa duración como consecuencia mostrada.
La propiedad `stage` es la fuente de verdad del orden. `beforeDamage` contiene
las resoluciones independientes; `damageRoll`, `beforeLocation`, `beforeArmor` y `afterPenetration`
sitúan modificaciones dentro del cálculo; `afterDamage` agrupa consecuencias
que necesitan conocer penetración o herida, y `woundChecks` queda reservado a
las comprobaciones anatómicas. El valor histórico `afterEffect` se normaliza a
`afterDamage`; los efectos nuevos sin una fase válida usan `beforeDamage`.
La tarjeta conserva visibles los resultados previos y nunca bloquea el daño por
un efecto sin automatizar: esos efectos quedan cerrados como `notAutomated` sin
pedir notas ni confirmaciones. Las pruebas automatizadas pueden resolverse en su
fase sin ocultar «Tirar daño». Así, «Cegar oponente» se presenta antes del daño,
mientras Aturdir, Desangrar y
Tumbar solo aparecen después de aplicarlo si su condición se activó. Empalar
participa en `damageRoll`, aplica su doble tirada automáticamente y no crea una
confirmación narrativa posterior.
Como ayuda temporal de desarrollo, cada selección muestra en morado
«Automatizado» o «No automatizado»; estas notas no forman parte de la interfaz
final y su retirada está registrada en `docs/pending.md`.
La tarjeta presenta la etiqueta «Consecuencia:» sobre su explicación para que
el texto operativo disponga del ancho completo del panel.
Las condiciones medidas en turnos propios se descuentan normalmente desde
`MythrasCombat.nextTurn`. «Titubear» realiza ese consumo al resolver la acción y
marca el avance posterior para no repetirlo; así el contador progresa incluso si
el cambio de turno dependiente del coordinador no llega a completarse.
«Cerrar intercambio y avanzar» permite al DJ resolver conjuntamente cualquier
paso todavía pendiente —con una nota opcional— sin deshacer el daño ni tratar
el intercambio como cancelado. En un intercambio terminal que aún admite
cancelación, como el fallo simultáneo de ataque y defensa, el cierre explícito
confirma el resultado y avanza el tracker; el avance automático espera para
conservar la oportunidad de corregirlo mediante Cancelar. Una resolución manual
individual tampoco exige una nota para poder completarse.

La tarjeta interactiva se divide por responsabilidades sin alterar el esquema
persistido del intercambio ni las exportaciones públicas de `combat-chat.js`:

- `combat-exchange-state.js` contiene selección del coordinador, validación de
  respuestas y detección del estado terminal;
- `combat-damage.js` controla las opciones de localización y prepara, en orden,
  las comprobaciones derivadas de efectos y heridas;
- `combat-damage-runtime.js` verifica que la instantánea de PG y armadura siga
  vigente, gobierna la transición `proposed` → `applying` → `applied`, restaura
  la propuesta si falla la escritura y aplica documentalmente los PG y la lesión
  permanente en una única operación; recibe de forma explícita la resolución de
  documentos y usuarios, el evaluador de dados, el renderizador y los ejecutores
  empleados por Foundry;
- `combat-effect-runtime.js` determina el Actor afectado y ejecuta los efectos
  inmediatos o posteriores a una prueba: estados temporales, cambios de alcance,
  apilamiento y creación de comprobaciones pendientes. La resolución de Actor,
  Combat, dados, condiciones y relaciones se entrega mediante dependencias
  explícitas;
- `combat-response-runtime.js` aplica las transiciones autoritativas de defensa,
  elección de efectos, Suerte y blanco accidental;
- `combat-check-runtime.js` resuelve las comprobaciones regladas y las
  confirmaciones manuales de efectos;
- `combat-exchange-runtime.js` gobierna avance, cierre, cancelación, reembolso
  de PA y consecuencias pendientes;
- `combat-resource-runtime.js` concentra las escrituras de PA, Suerte, munición
  y consumo de Sorpresa;
- `wound-consequences.js` produce el plan anatómico común y
  `combat-wound-runtime.js` lo ejecuta sobre documentos y estados;
- `combat-chat-renderer.js` transforma el estado en HTML y prepara la ayuda
  visual, sin modificar documentos ni el intercambio; los resultados de dado,
  dificultades, objetivos efectivos y heridas reutilizan las clases cromáticas
  compartidas con las tiradas de habilidad y las hojas;
- `combat-chat-runtime.js` valida y enruta las acciones recibidas por socket;
- `combat-chat.js` conserva la fachada compatible, reúne las dependencias de
  Foundry y presenta los diálogos. No actualiza documentos directamente: delega
  cada transición y escritura en los servicios anteriores.

Los modos `ranged` y `siege` añaden a la transacción una instantánea `ranged`
con metros declarados, banda, TAM, fuentes de dificultad, potencia efectiva,
movimiento, preparación y munición consumida. Apuntar vive temporalmente en un
flag del Actor vinculado a combate, arma y blanco. Los desvíos al disparar a una
melé usan `awaitingAccidentalTarget` y `awaitingAccidentalDefense`, conservando
el dado, PA y proyectil originales. La elegibilidad de efectos distingue el
modo efectivo de la transacción (`melee` o `ranged`) de las capacidades de la
instantánea del arma, para que un arma con varios modos solo habilite los
efectos correspondientes al ataque declarado.

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
