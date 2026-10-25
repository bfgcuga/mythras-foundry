# Arquitectura del sistema

Este documento resume la estructura estable del repositorio y las fuentes de
verdad que deben consultarse antes de cambiar modelos, reglas o compendios.
Los límites estructurales candidatos a extracción, sin alterar esta arquitectura
vigente, se mantienen en [`refactoring.md`](refactoring.md).

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
- la clase de documento de Item y los modelos de los catorce tipos de Item;
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

La galería de personajes y PNJ se persiste en `system.gallery` como una colección
de referencias `{ src, title }`. Ambas hojas comparten el parcial
`templates/actor/parts/gallery-tab.hbs` y el controlador `gallery-sheet.js`: los
propietarios y el GM gestionan las imágenes; LIMITED y OBSERVER pueden ampliarlas.

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
pestañas Combate e Inventario. Combate separa acciones activas y gratuitas en
dos recuadros y conserva una única jerarquía de
localizaciones, armas y estilos; las diferencias del PNJ, como la durabilidad de
un arma natural vinculada a una localización, se resuelven al preparar los datos.
Inventario comparte monederos, propiedades, contenedores y operaciones. Las
armas cuyos modos son íntegramente naturales permanecen visibles en Combate y
se excluyen del Inventario para ambos tipos de Actor. Esta clasificación no
concede por sí misma capacidad de ataque o parada.

`scripts/rules/unarmed-combat.js` prepara un perfil intrínseco y transitorio para
Actors `character` y `npc` con `system.morphologyKey: humanoid`, reutilizando
`UNARMED_WEAPON_SOURCE`: no crea un documento Item ni ocupa manos o inventario.
La preparación compartida de Combate omite las filas del perfil `puno-patada`
que ya existan como Items, sin borrarlas ni ocultar otras armas naturales.
Pelea y los estilos con ese perfil explícito son las habilidades elegibles; se
preselecciona el estilo de mayor porcentaje y, si no existe, Pelea. No se deduce
la compatibilidad del nombre de un estilo ni se aplica familiaridad a esta opción.

Las instantáneas de ataque y defensa identifican el perfil mediante
`intrinsicKey: puno-patada`, separado de un `weaponId` vacío. `abilityId` identifica
la habilidad usada y `styleId` se conserva cuando es un estilo, para sus rasgos.
El daño reconstruye el perfil sin resolver un Item inexistente; las pifias,
incluidas las repeticiones de Suerte, se registran en la habilidad seleccionada.
Las tarjetas antiguas que solo poseen `styleId` mantienen su lectura compatible.
El perfil usa daño 1d3, Modificador de Daño completo, Tamaño Pequeño y alcance T.
La parada usa Tamaño Medio únicamente si el estilo elegido tiene
`maestria-sin-armas`; Pelea conserva Pequeño.

La parada intrínseca requiere Toque. Una relación táctica trabada con dos alcances
válidos y posición no neutral determina la distancia; si no es T, se rechaza.
Sin alcance detallado o sin distancia determinada se pide confirmación explícita,
persistida como `touchConfirmed` en la defensa. Una relación destrabada no permite
parar sin armas. El coordinador reconstruye las opciones desde el Actor y la
relación vigentes antes de gastar PA; no acepta porcentajes ni tamaños enviados
por el cliente. Cancelar el selector o denegar Toque no crea una defensa.
Las relaciones y los selectores de alcance también admiten el perfil intrínseco,
sin introducir distancias basadas en coordenadas del lienzo.

Las armas naturales reales se identifican mediante `isNaturalWeaponMode` y solo
pueden parar si su Actor posee el rasgo canónico `formidable-natural-weapons`
(Armas Naturales Formidables), consultado mediante `hasTrait`. Conservan sus
propios tamaños y alcances. Esta restricción no afecta a armas manufacturadas ni
a la parada intrínseca humanoide. El perfil intrínseco no tiene durabilidad ni
puede desarmarse, transferirse o inmovilizarse como un Item.

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
eliminarlos. Las criaturas se reúnen en `scripts/data/creatures.js`; los perfiles del básico
revisado viven en `scripts/data/revised-creature-profiles.js` y se adaptan en
`revised-creatures.js` usando los constructores de `creature-helpers.js`. La
[matriz de cobertura](bestiary-coverage.md) documenta las exclusiones y la
conservación de valores impresos. Los 55 perfiles elementales y de enjambre se definen en `global-creatures.js`.
Los PNJ añaden `hitPointMode` (`localized` por defecto o `global`) y
`absentCharacteristics` (vacío por defecto), sin migrar anatomías existentes.
`health.js` centraliza clasificación, límites de PG, validación y dependencias
de características. El modo global requiere un único Item de localización 1–20,
con PG máximos manuales positivos y sin lesión permanente. Cambiar el selector
no crea, elimina ni fusiona zonas; hay que preparar primero la anatomía.

`npc-health-runtime.js` valida configuración y actualizaciones, limita los PG a
0 y emite el aviso de agotamiento solo en el cliente que originó la transición
positivo→0. Los daños de combate, directo, fuego, ácido y caída comparten esta
interpretación. Las condiciones del Actor ignoran la gravedad anatómica de la
reserva y no incapacitan a 0 PG. Estados impuestos expresamente se conservan.
Los valores internos de características ausentes son solo compatibilidad del
modelo: sin fórmulas ni tiradas propias; los atributos dependientes pasan a
manual, sin curación ni fatiga automática por CON ausente y sin carga por FUE
ausente. La generación de tokens conserva estas reglas y las fórmulas de PG.

Cada criatura mantiene su tabla anatómica:
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
y los plazos en minutos u horas permanecen manuales. El alcance temporal se
considera completo y se limita al Combat Tracker: no se automatiza tiempo real
ni tiempo mundial fuera de él. Las fuentes son
independientes, por lo que retirar una no elimina otros bloqueos equivalentes.
Sangrando y Ahogándose crean una cola de Aguante antes del primer turno del
asalto. Esas tiradas resuelven su objetivo efectivo en el momento de lanzar los
dados mediante `resolveSkillRollConditions`, por lo que incorporan la Fatiga,
heridas y estados vigentes. Desangrándose crea una única entrada automática por Actor y pierde un
nivel de Fatiga, sin tirada, durante esa misma preparación. Se reconoce tanto
el estado nativo sin flags como la condición gestionada de Desangrar; se omiten
efectos desactivados o suprimidos y varias fuentes se agrupan en una entrada
estable por combatiente. La pérdida usa el Actor actual del combatiente y la
cola conserva su resolución para no repetirla al preparar de nuevo el mismo
asalto. El mensaje identifica al Actor y el nivel perdido. Su efecto manual
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
Abrir Distancia, Cerrar Distancia y Retirada están completamente implementados.
Los dos primeros ajustan la relación de alcance y Retirada destraba al personaje
del rival correspondiente. Su alcance funcional es relacional: no requieren
mover tokens ni añadir comprobaciones de geometría del lienzo.
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
La protección exige que la respuesta elegida sea «Cobertura» y que la localización
impactada figure en el perfil activo. La ocultación del diálogo es un ajuste
independiente de dificultad; no asigna protección. La cobertura completa penetrable
añade un grado al disparo. La instantánea del ataque guarda fuente, protección y
nombres de localizaciones para mostrar la cobertura declarada al atacar; el daño
consulta el perfil táctico activo al resolverse. El chat desglosa distancia/TAM y
circunstancias en grados, la intensidad del viento y las dificultades seleccionada,
previa al disparo y final, sin atribuir el total únicamente a la distancia.


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
nombre individual de su TokenDocument. Las tiradas de iniciativa, individuales y
grupales, usan este mismo resolver en cada recuadro; el remitente de la tirada
individual conserva ese nombre, sin depender del nombre almacenado del Combatant.
Las tiradas especiales se coordinan desde
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
«Ráfaga» y «Redoblar Ataque» usan esta misma frontera transaccional: su resolución
inmediata marca `turnEconomy.retainTurn`, identifica el motivo en
`retainTurnReason` y hace irreversible el intercambio. Al cerrarlo,
`advanceCombatExchange` sella la tarjeta y su revisión, pero omite `nextTurn`;
el combatiente activo puede iniciar otro ataque, que consume su propio PA por
el flujo ordinario. La elegibilidad exige combate activo y, respectivamente,
un ataque desarmado o un arma de Tamaño Pequeño.

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
disponibilidad de Retrasar. El controlador persiste su estado en
`flags.mythras-foundry.combatActions`: las colecciones de acciones, reservas de
Retrasar, movimiento y progresos de Aprestar comparten una revisión. Los mapas
históricos de Afianzarse y restricciones de Maniobrar se conservan por
compatibilidad del esquema, pero no son fuentes de efectos operativos. Las tarjetas usan el mismo coordinador por
socket que el resto del combate. Las acciones guiadas conservan su coste,
parámetros, usuario y confirmación sin crear reglas de magia o monturas que el
sistema todavía no representa.

Forcejear es una acción genérica definitiva, sujeta a aprobación del DJ. No exige
una restricción activa: conserva los requisitos generales de turno y PA. Exige
descripción antes de gastar 1 PA; el diálogo permite validar o cancelar. Validar
solo se habilita al completar la descripción y marcar la aprobación del DJ. Su
tarjeta publica la descripción y queda pendiente de resolución manual, con un
único botón de validación que cierra la acción y avanza el turno. No realiza
tiradas ni elimina restricciones; las liberaciones específicas son independientes.

`actionAvailability` continúa siendo la API booleana compatible. Las hojas usan
`actionPresentation`, que añade coste y causa estable de indisponibilidad sin
eliminar acciones del DOM. Los controladores especializados de alcance,
bloqueo, cobertura, apuntado y recarga siguen siendo sus fuentes de verdad.
La acción genérica admite una descripción opcional: confirmar con el campo vacío
o solo espacios también gasta un PA y publica la acción. Cancelar no gasta PA.
La descripción se publica cuando existe y la acción se resuelve automáticamente
con el avance habitual del turno. Bloqueo Pasivo
es gratuito y no exige turno propio ni PA: la hoja abre la declaración pendiente
o el mismo editor de corrección de situación táctica cuando ya no hay una
declaración pendiente, incluso si todavía no existe un bloqueo guardado.
`free-combat-actions.js` gestiona Hablar, Hacer gestos, Soltar arma y Valorar
situación desde el parcial compartido por personajes y PNJ. Comprueba propiedad
del Actor y no usa la economía de turnos ni PA. Soltar arma desequipa
el Item elegido y consume su bloqueo pasivo si estaba activo; excluye armas
naturales y vuelve a validar la
elección después del diálogo. Valorar situación advierte sobre la traba sin
consultarla como restricción y reutiliza Percepción con el resolvedor común de
condiciones y el diálogo de impacto de heridas.

Ponerse en Pie abre un diálogo con la traba táctica detectada y permite corregirla
sin modificar las relaciones tácticas. Sin traba retira Tumbado automáticamente.
Con traba, `stand-runtime.js` valida los oponentes elegidos antes de gastar el PA
y reutiliza la tarjeta de enfrentadas: cada participante elige Músculo o Atletismo.
La confirmación retira Tumbado solo si el iniciador vence a todos los oponentes;
empates, fallos mutuos o derrotas conservan la postura. Los rivales no gastan PA.
El turno avanza al confirmar las consecuencias; permisos, revisión y vigencia
del asalto impiden aplicar respuestas obsoletas o duplicadas.

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
En las hojas, la durabilidad colorea únicamente el nombre del arma; la mano de
equipación, el porcentaje y el botón de tirada conservan su semántica visual
propia y no aparentan penalizaciones inexistentes.

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

«Arrebatar Arma» reutiliza las pruebas enfrentadas y Suerte de Desarmar, sin
ajuste por Tamaño. La resistencia usa Estilo de Combate contra la tirada original
del lado desarmado. FUE rival ≥ 2 × FUE propia cancela el efecto automáticamente.
Al perder el rival, el coordinador copia el Item equipado al vencedor y elimina
el original; si falla la eliminación, revierte la copia.

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
«Forzar Fallo» reutiliza este mismo contrato. La validación exige que la selección
contenga exactamente otro efecto reconocido por `combatEffectRequiresResistance`;
al persistirla, ese compañero recibe `automaticSuccess` y un `automaticSource`
de tipo `forceFailure`. La prueba queda resuelta internamente como fallo automático
sin evaluar dados ni habilitar Suerte, y «Forzar Fallo» no genera una prueba propia.
«Potenciar Penetración» exige una autorización del DJ validada por el coordinador,
con el mismo patrón remoto que Forzar Rendición. Tras aplicar el primer daño,
`applyProposedCombatDamage` solo abre `penetration.awaitingTarget` si hubo daño
penetrante. La tarjeta conserva la instantánea del primer blanco y permite al
propietario del atacante escoger otro token visible. La transición tira una nueva
localización, toma la mitad redondeada hacia arriba del daño ya ajustado por alcance
y prepara una segunda propuesta contra la armadura y PG del nuevo blanco. Las
selecciones y pruebas del primer impacto se conservan solo para visualización y
no participan en el segundo cálculo.
«Sortear Cobertura» usa la misma autorización coordinada y se identifica mediante
la selección canónica, no por el texto del efecto. `refreshCombatDamageProposal`
omite tanto la protección como el desglose de cobertura cuando está presente,
pero conserva alcance, parada, bloqueo pasivo y armadura. Si se combina con
«Potenciar Penetración», el DJ confirma ambos permisos antes de persistir la
selección; el segundo impacto no hereda ninguno de los dos efectos.
«Escoger Objetivo» comparte el protocolo de autorización del DJ, pero conserva
como propietario de la decisión al defensor original. Tras la autorización,
`chosenTarget.awaitingTarget` bloquea el daño hasta que ese propietario o el DJ
elija cualquier otro token visible; la interfaz y la transición omiten a propósito
validaciones de alcance, adyacencia, línea de tiro y participación en combate.
`applyChosenTargetTransition` sustituye la instantánea del defensor, convierte la
tirada atacante en impacto automático, elimina las selecciones y pruebas para que
la nueva víctima no reciba Efectos de Combate y vuelve a habilitar el daño normal.
«Herida Accidental» realiza la misma sustitución sin intervención adicional: el
Actor atacante pasa a ocupar la instantánea del defensor y su combatiente se usa
como destino de cualquier estado táctico. La resolución conserva la fórmula de
daño del ataque, descarta efectos y defensas y deja que el flujo ordinario tire
una localización aleatoria. `accidentalWound.ignoresArmor` identifica el ataque
desarmado; al preparar la propuesta anula protección natural y equipada, además
de impedir que cobertura o bloqueo pasivo reduzcan este daño autoinfligido.
La fase posterior al daño de «Empalar» exige daño penetrante y una herida. El
módulo `impalement.js` traduce TAM de criatura y tamaño de empalamiento a la
tabla oficial. El ActiveEffect canónico `impaled` guarda el Item serializado,
modo, fórmula, localización, propietario y rasgo Barbada; solo después de crear
esa custodia se elimina el arma de su Actor, con reversión si falla la operación.
`actor-conditions.js` reduce todos los empalamientos activos a la peor penalización,
sin sumarlas. La acción `recoverImpaledWeapon` aparece únicamente en turno propio
para combatientes trabados con una víctima empalada, consume 1 PA y aplica el
ajuste compartido de competiciones de fuerza a Músculo. Al vencer restaura el
Item desequipado, elimina el efecto y aplica daño directo a la localización sin
armadura ni Modificador de Daño; Barbada decide entre daño completo y mitad.
`combat-bash.js` mantiene puro el cálculo de «Golpetazo»: valida que el TAM del
blanco no supere el doble del atacante y divide el daño previo a cualquier
mitigación entre dos para escudos o entre tres para armas contundentes, siempre
redondeando hacia abajo. La fase posterior al daño guarda esa distancia sin
mover tokens. Su dependencia de interfaz pregunta por la colisión y, si existe,
permite elegir Atletismo o Acrobacias, aplica dificultad Difícil y serializa el
resultado en la resolución del efecto para que la tarjeta lo conserve.
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
Las pruebas de efectos independientes del daño se conservan completas al
preparar o recalcular la propuesta, cambiar la localización o repetir el daño
con Suerte: estado, resultado, historial de Suerte, opciones y consecuencia.
`independentCombatEffectChecks` identifica estas pruebas por su selección
vigente y por no requerir herida, sin una lista paralela de nombres de efectos.
Las pruebas de heridas y de efectos condicionados al daño sí se recalculan
cuando cambia la tirada o la localización.
La tarjeta conserva visibles los resultados previos y nunca bloquea el daño por
un efecto sin automatizar: esos efectos quedan cerrados como `notAutomated` sin
pedir notas ni confirmaciones. Las pruebas automatizadas pueden resolverse en su
fase sin ocultar «Tirar daño». Así, «Cegar oponente» se presenta antes del daño,
mientras Aturdir, Desangrar y
Tumbar solo aparecen después de aplicarlo si su condición se activó.
«Superar Armadura» está completo. `combat-bypass-armor.js` calcula los PA
efectivos separando protección natural y equipada; esta última conserva el
máximo de las prendas que cubren la localización. Con un uso, si el rival tiene
ambos tipos superpuestos, la selección pide cuál ignorar y el coordinador guarda
`parameters.armorType` (`natural` o `worn`). Dos usos ignoran ambos tipos.
Si la localización impactada solo tiene uno, se ignora ese tipo automáticamente.
La propuesta conserva la protección total como instantánea para detectar cambios,
aplica solo los PA no ignorados e identifica `ignoredArmorTypes` en la tarjeta.
La elección persiste al recalcular el daño o repetirlo con Suerte; no se modifican
los PA de los documentos de armadura ni la protección natural de la localización.
«Marcar Enemigo» está terminado como efecto exclusivamente narrativo: su
selección se resuelve sin cambios documentales, estados ni pruebas adicionales.
«Muerte Silenciosa» está completo. Su elegibilidad consulta el rasgo canónico
`asesinato` (Asesinato) del Estilo de Combate identificado por `attacker.styleId`,
mediante `hasTrait`; el nombre del estilo y los rasgos de otros estilos no
habilitan el efecto. Esta condición se exige tanto al listar opciones como al
validar la selección en el coordinador, junto con Sorpresa y arma pequeña.
«Desangrar» está completamente implementado con la resistencia de Aguante,
el estado de desangramiento y la pérdida de Fatiga por asalto. El tratamiento
y la reapertura por esfuerzos no se van a automatizar y no son trabajo pendiente
de este efecto.
«Tumbar Oponente» está completamente implementado con la resistencia de Aguante
y la aplicación de Incapacitado. La duración manual es intencionada: el efecto
no debe gestionar la recuperación ni necesita automatizarla para estar completo.
«Enredar» crea una condición manual por fuente y localización después de resolver
el impacto. Sus metadatos estables conservan captor, arma de enredo, localización,
clase anatómica y, en un brazo, el Item sostenido. `entanglement.js` centraliza
las consultas: las piernas anulan movimiento, las zonas vitales aumentan un grado
la dificultad general y los brazos bloquean el Item y participan en la consulta
previa de todas las tiradas. La víctima puede iniciar una enfrentada de Músculo
por 1 PA y el captor obtiene en su siguiente turno la acción destacada para usar
la tirada original en un intento de Derribar Oponente. Dañar o desarmar el arma
fuente elimina su traba; «Liberarse» elimina Enredar, Agarrar e Inmovilizar Arma.
«Forzar Rendición» usa una autorización remota previa: el cliente solicitante
envía la selección al DJ coordinador, que es quien muestra la confirmación y
aplica la transición con su identidad; una denegación devuelve el control al
selector sin mutar el intercambio. La transición rechaza selecciones sin esa
autorización, marca el daño como no disponible y crea una prueba de Voluntad
enfrentada a la tirada original cuyo resultado queda como consecuencia narrativa.
«Hender Armadura» comparte el conducto ordinario de daño, pero
`armor-durability.js` resuelve por separado la capa afectada y sus umbrales. La
protección total absorbe primero el daño posterior a parada, bloqueo y cobertura;
el exceso reduce los PA de la pieza equipada más fuerte o de la protección
natural, y únicamente lo que resta después llega a los PG. `maxArmorPoints`
conserva el valor original en armaduras y localizaciones con compatibilidad para
documentos antiguos. A cero PA, una pieza se desequipa y `armorCanEquip` impide
equiparla; la tarjeta persiste el desglose completo y las hojas derivan los
estados visuales sin guardar una etiqueta redundante.
«Inutilizar Arma» persiste `system.inoperable` en el arma atacante. Es una marca
operativa independiente de los PG: `weaponCanEquip` la excluye de todos los
selectores compartidos de ataque y parada, pero no la clasifica como destruida.
Inventario y Combate derivan su presentación de esa marca; la acción de reparar
en Inventario exige confirmar las condiciones acordadas con el DJ, restaura
los PG máximos de armas o los PA máximos de armaduras y restablece la marca a
`false`. `itemRepairUpdate` centraliza disponibilidad y actualización, también
para equipo que disponga de PG. No cobra dinero ni cambia equipación,
lanzamiento o inmovilización. El equipo genérico actual no tiene durabilidad.
«Tiro Apuntado» resuelve el d20 de localización antes de evaluar el daño y abre
una elección explícita con todas las localizaciones del defensor. Conserva por
separado `rolledLocationId` y la localización finalmente elegida. La interfaz
explica la restricción de contigüidad, pero deliberadamente no mantiene un grafo
anatómico ni filtra opciones según el orden de la tabla.
«Disparo de Supresión» se filtra en `combatEffectEligible` mediante el modo a
distancia del ataque y la presencia de un arma a distancia equipada en el blanco.
Su prueba independiente de Voluntad conserva la tirada de ataque como oposición
aunque el daño sea cero. Al fallar crea durante un turno propio la condición
canónica `suppressed`; `timedAttackRestriction` rechaza cualquier modo `ranged` o
`siege`, sin restringir ataques cuerpo a cuerpo ni el resto de acciones.
Empalar
participa en `damageRoll`, aplica su doble tirada automáticamente y no crea una
confirmación narrativa posterior.
Como ayuda temporal de desarrollo, cada selección muestra en morado
«Automatizado» o «No automatizado»; estas notas no forman parte de la interfaz
final y su retirada está registrada en `docs/pending.md`.
La tarjeta presenta la etiqueta «Consecuencia:» sobre su explicación para que
el texto operativo disponga del ancho completo del panel.
Las condiciones medidas en turnos propios se descuentan normalmente desde
`MythrasCombat.nextTurn`. La tarjeta resuelta de «Titubear» muestra directamente
«El personaje ha perdido una acción», sin ayuda emergente. «Titubear» realiza
ese consumo al resolver la acción y
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
movimiento, preparación y munición consumida.

La munición física reside en los Items de categoría `ammunition`: `ammoType`
es el identificador de compatibilidad y `quantity` el total, incluidos los
proyectiles cargados. Los modos guardan `ammoUse` (`none`, `projectile`,
`thrown`), `ammoType`, `ammoItemId`, `ammoLoaded`, `ammoCapacity` y
`reloadProgress`. `ammoReserve` queda únicamente como dato legado de conversión.
Los ayudantes puros de `ammunition.js` calculan cargas compartidas y disponibilidad
con `inventoryCarried`; no ofrecen existencias almacenadas en propiedades o
vehículos. Cada acción de recarga cuesta 1 PA y, una vez persistida, el coordinador avanza
el turno propio o finaliza la acción de interrupción para que decida el DJ. Las
peticiones repetidas no vuelven a cobrar ni a avanzar. Cambiar de selección libera la
carga anterior y reinicia el progreso; cancelar el diálogo no cambia el estado.

`ammunition-runtime.js` serializa recargas y disparos por actor en el primer DJ
activo; los clientes solicitan la operación por socket y reciben confirmación.
El coordinador comprueba propiedad, modo activo, equipación, compatibilidad,
existencias, cargas y PA. Cada disparo modifica munición y modo en una petición
de actualización de Items, registra el resultado por identificador de operación
y evita repetir el gasto al recibir la misma petición. Las repeticiones con
Suerte y cancelaciones posteriores no reponen proyectiles. Los hooks de
actualización y eliminación invalidan cargas si cambia el tipo, se agota el
recuento o se mueve la munición o su contenedor fuera del equipo transportado.
La celda de recarga de Combate muestra acciones realizadas/requeridas con «Acc.»
y el número de proyectiles disponibles con «Munic», en dos líneas con etiquetas
accesibles y tooltips. El
ayudante puro muestra el progreso completo mientras el arma permanece cargada.

`normalizeInventorySources` es la entrada común desde
`MythrasActor.createEmbeddedDocuments`: transforma paquetes comerciales en
unidades al comprar o arrastrar, preservando valor y carga agregados mediante
precio/peso unitarios y `zeroEncumbranceUnits` para la regla de objetos de ENC 0.
No fusiona existencias automáticamente y conserva los Items con cantidad cero;
su venta no produce ingresos. Los fajos arrojadizos generan ejemplares de arma.
La metadata comercial (`packageSize`, `unitName`, `ammunitionProfile` y
`thrownProfile`) conserva las claves y presentación de los compendios.

`ammunition-migrations.js` convierte los fajos ya embebidos y las reservas
antiguas, también en actores sintéticos. Cada reserva más carga se incorpora
como una existencia adicional marcada por su origen y se vincula al modo;
no se deduplica con la munición previa. `ammunitionUnitVersion`,
`ammunitionVersion` y los marcadores de origen permiten repetir o reanudar
la conversión sin multiplicar cantidades. Conserva lo cargado y reinicia el
progreso incompleto. Los perfiles sin compatibilidad identificable mantienen
sus contadores hasta configurar un tipo. Las pilas arrojadizas se separan en
Items de cantidad 1; el asistente de combinación de modos no propone fusionar
copias con el mismo conjunto de modos.

Lanzar un ejemplar marca `system.thrown`, lo desequipa y bloquea todos sus modos
mediante `weaponCanEquip`, incluido el bloqueo pasivo. La resolución de daño del
lanzamiento ya registrado puede usar su instantánea aunque esté lanzado.
La recuperación manual desde Inventario solo elimina ese estado y mantiene el
arma desequipada y sus demás restricciones. Si Empalar la deja clavada,
`system.lodged` bloquea Recuperar; el efecto conserva la referencia al Item
original y su propietario. La extracción recupera ese ejemplar sin duplicarlo
(o lo transfiere si lo extrae otro actor). Quitar el efecto libera la retención,
sin reparar ni equipar el arma.

Apuntar usa `rangedAim` de esquema 3 en el Actor, con combate, combatiente,
arma, modo, blanco, asalto de declaración y asalto de disponibilidad. `aim.js`
concentra elegibilidad y caducidad; `aim-runtime.js` valida la petición en el
coordinador, consume 1 PA por acción, persiste el estado y avanza turno. Las
peticiones repetidas no vuelven a pagar ni a avanzar. Solo se declara en el
turno propio y fuera de interrupciones, sin gasto previo de PA y con el máximo
efectivo disponible al empezar. Continuar exige elegir Apuntar en cada turno
propio, con el mismo arma, modo y blanco. El coste es 1 PA por acción; los PA
restantes permiten defenderse y cancelar el apuntado. Solo completar todas las
acciones concede el beneficio; pasar sin apuntar o cerrar un asalto con PA
pendientes cancela la preparación. El esquema anterior se descarta sin reembolso.

El hook `preUpdateActor` registra el gasto efectivo por combate/asalto en
`actionPointSpending`: ataques, defensas, otras reacciones y deducciones directas.
Solo reembolsos explícitos reducen ese gasto; reponer PA manualmente no habilita
Apuntar. Restaurar los PA al inicio del asalto reinicia el registro, y los
ajustes por cambio del máximo no cuentan como acciones. La declaración y el
registro se guardan en la misma actualización de Actor bajo el bloqueo de PA.

El apuntado queda «preparando» durante el asalto de declaración y «preparado»
desde el comienzo del siguiente; cambiar únicamente de ciclo no lo habilita.
Compensa como máximo un grado adverso del disparo, sin mejorar la dificultad
inicial. No se puede prolongar ni acumular. Se consume al atacar, incluso con
otra arma o blanco (en ese caso sin beneficio). Otra acción activa, parar,
evadir, pasar el turno preparado, perder disponibilidad del arma o capacidad
de atacar lo cancela. Las acciones gratuitas de hablar o gesticular no lo hacen.
Los cambios de coordenadas y elevación del token tampoco lo cancelan.
El siguiente cambio de asalto o el cierre/eliminación del combate elimina el
beneficio no utilizado. Los apuntados heredados del esquema 1 se descartan sin
modificar PA durante la migración.

Los desvíos al disparar a una
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

Los quince compendios declarados en `system.json` deben mantenerse sincronizados
con las llamadas de construcción de `build-packs.mjs`. Cualquier cambio en sus
fuentes requiere ejecutar `npm run build:packs` antes de `npm run check`.

El compendio `reference` contiene un único `JournalEntry` multipágina. Su portada
es el índice extensible de categorías; la tabla de efectos de combate y cada una
de sus páginas descriptivas se derivan del mismo catálogo canónico que construye
`combat-effects`. Los diarios y sus páginas usan identificadores deterministas,
por lo que los enlaces UUID internos permanecen estables entre reconstrucciones.
Las descripciones reglamentarias empaquetadas de habilidades proceden de
`data/mythras_habilidades.json`; `fullSkillSources` las combina con los slugs y
campos operativos de `ALL_SKILL_SOURCES`, añade las tablas específicas de
Primeros Auxilios e Idioma y alimenta tanto `skills` como `reference`. El Journal
genera un índice alfabético completo y otro separado en habilidades básicas,
profesionales y mágicas. Las copias ya embebidas en Actores no se sobrescriben.
Los rasgos se derivan directamente de `TRAIT_SOURCES` y se organizan en tres
índices según `traitType`: armas, estilos de combate y criaturas. Todas las
páginas de índice del Journal enlazan de vuelta a su portada principal.
La página de armas genera cinco tablas estáticas desde `WEAPON_SOURCES`. El botón
de referencia completa abre `WeaponReference`, que vuelve a leer el compendio
oficial y los packs mundiales configurados en `catalogSources`; las armas se
clasifican por cada modo y conservan UUID y procedencia, sin modificar el Journal.
`CULTURE_SOURCES`, `PROFESSION_SOURCES`, `EQUIPMENT_SOURCES` y
`COMBAT_STYLE_SOURCES` alimentan también la referencia. Culturas y profesiones
exponen las reglas estructuradas de generación; los estilos enumeran sus perfiles
de arma y rasgos; el equipo se agrupa en tablas por categoría. El botón de su
índice abre el catálogo existente, cuya lectura dinámica incorpora los packs
personales de `catalogSources`, mientras las páginas oficiales siguen siendo
deterministas y reproducibles durante la construcción.

## Validación y publicación

La selección y mantenimiento de pruebas siguen [docs/testing-policy.md](testing-policy.md).

`npm test` es la comprobación funcional principal. Requiere Node 24.19 o posterior.
Las pruebas de interfaz compilan las plantillas reales con Handlebars, ejercitan
controladores y eventos en jsdom y analizan reglas CSS activas con PostCSS.
`tests/helpers/ui.js` proporciona dobles de las fronteras de Foundry; no replica
su validación de modelos ni sustituye la comprobación visual en una partida.
Los mocks de módulos usan la API experimental del runner de Node.
El filtrado del equipo inicial por perfiles de cualquier modo, clase social y
dotación reside en el helper puro `startingEquipmentWeapons`, consumido por la hoja.

`npm run check` valida la
sintaxis de todos los módulos, los recursos del manifiesto, los JSON de idioma,
la presencia de compendios y la URL versionada de descarga.

`.github/workflows/release.yml` se ejecuta al subir una etiqueta `v*`: instala
dependencias, prueba, reconstruye compendios, valida la coincidencia entre
etiqueta y manifiesto, empaqueta los archivos de ejecución y crea la release.
El procedimiento manual y su orden obligatorio se mantienen en `AGENTS.md`.

## Agarres y competiciones de fuerza

`grappling.js` identifica las presas activas vinculadas al captor. Agarrar requiere
confirmar alcance de Pelea y miembro libre; no modela miembros anatómicos. El
estado canónico `grabbed` se aplica antes del daño y conserva Actor y token de
origen. El selector de estados también permite elegir un captor. La víctima no
puede usar Cambiar Distancia ni Abrir Distancia, Cerrar Distancia o Retirada;
la elegibilidad y la ejecución verifican el estado vigente. La edición táctica
del DJ permanece disponible como operación administrativa.

`weapon-pin-runtime.js` comparte la transacción de liberación para armas y
agarres mediante `kind`: valida propietario, turno, PA y fuente activa, cobra
1 PA una sola vez y retira únicamente la fuente elegida si vence la víctima.
Empates y fallos conservan la presa. El botón de agarre precede al de arma y
reutiliza su estilo de atención.

`strength-contests.js` compara grados de los modificadores de daño preparados,
incluidos valores negativos. Solo penaliza a quien usa Músculo y tiene un
modificador inferior: acumula la diferencia sobre su dificultad antes del
ajuste compartido de porcentajes superiores a 100. Las enfrentadas generales
y la liberación comparten el ayudante. Pelea no recibe esta penalización. En
enfrentadas con varios rivales se usa el modificador más alto del bando rival;
las pruebas contra dificultad y las diferenciales conservan sus reglas.

«Derribar Oponente» crea una prueba enfrentada antes del daño contra la tirada
original del lado que eligió el efecto. `combat-trip.js` prepara habilidades y
objetivos y ofrece el selector explícito de bípedo, sin inferir anatomía. La opción «No»
añade Atletismo a Músculo, Evadir y Acrobacias y mejora un grado la dificultad
efectiva de todas ellas, después de las condiciones del Actor. La elección,
dificultad y objetivo se conservan en la resolución y en sus repeticiones de
Suerte. El fallo aplica el estado canónico `prone` de duración manual; no usa
la incapacitación de «Tumbar oponente».


### Afianzamiento y ayuda de acciones

Las transacciones de acciones reutilizan `actorDisplayName` y `actorSpeaker`;
no usan `Combatant.name`, que puede conservar el nombre inicial de un token.
La tarjeta consulta el Actor vigente al regenerarse y conserva el nombre guardado
si el combatiente ya no existe. Las ayudas de reglas del chat se abren mediante
un botón con interrogación en círculo y un `DialogV2`, como las ayudas de
comprobaciones de combate; el tooltip compartido solo describe el botón.

Afianzado (`braced`) pertenece al catálogo canónico de estados y se representa
mediante un ActiveEffect, visible y retirable en Estado tanto en PJ como en PNJ.
Afianzarse no duplica el efecto si ya está activo. Mover lo elimina. El mapa
`combatActions.braces` se conserva solo para compatibilidad de lectura del esquema;
las nuevas acciones no lo escriben y el indicador táctico consulta el estado.
`braceSize` conserva el cálculo situacional de TAM (×1,5 ante Empujones y ×2 ante
Golpetazos); el estado no modifica el TAM base. El recuadro compartido de Estado
se titula «Modificadores aplicados» porque reúne ajustes positivos y negativos.


### Maniobrar: enfrentada y protección por token

`maneuver-runtime.js` valida la selección de tokens de la escena, exige Evadir
antes de cobrar 1 PA y conecta la acción con `contest-chat.js`. La escena de
referencia procede del TokenDocument del ejecutor, tanto al validar la selección
como al iniciar la enfrentada después de una interrupción. No depende de que el
combate esté vinculado a una escena ni de la escena que esté viendo el
coordinador. Se rechazan tokens de otras escenas y selecciones inválidas antes
de gastar PA. La tarjeta de la
acción se transforma en la enfrentada existente: un iniciador individual frente
a un equipo con respuestas individuales. Cada propietario o el DJ tira Evadir;
las respuestas no gastan PA. No hay inferencia de bandos: el selector respeta la
visibilidad, preselecciona objetivos actuales e incluye marcar/desmarcar todos.
Los participantes sin Evadir se muestran deshabilitados y con explicación.

`createContestMessage` acepta un cuarto argumento opcional con `actionContext`,
`requiredAbilitySlug`, `initiatorTokenUuid` y `message` para reutilizar una tarjeta.
`openContestResponseDialog` acepta `requiredAbilitySlug` y no ofrece habilidades
alternativas ni tiradas especiales en ese caso. El coordinador vuelve a validar
la habilidad e impone las condiciones físicas del Actor al calcular el objetivo.
La cola por mensaje serializa respuestas, Suerte y confirmación. Para estas
acciones admite respuestas simultáneas de participantes distintos basadas en una
revisión anterior, siempre que sigan pendientes; rechaza duplicados y revisiones
futuras. Suerte conserva revisión estricta y se cobra en el coordinador.

Mientras falten tiradas o confirmación, la acción permanece `awaitingContest` y
no avanza el turno. La tarjeta permite Suerte hasta confirmar. El ejecutor o el
DJ confirma mediante `contestActionConfirm`; el coordinador verifica permisos,
combate y asalto vigentes, aplica únicamente las victorias del ejecutor y cierra
la acción una sola vez. Empates exactos y fallos mutuos terminan sin protección;
no se ofrecen repetir, reabrir ni Suerte tras confirmar esta acción.

`maneuver-protection.js` concentra el ActiveEffect canónico `maneuverProtected`
y la consulta de restricciones. La condición temporal conserva `combatUuid`,
`appliedRound`, `protectedTokenUuid`, `restrictedTokenUuids`, nombres auxiliares
y `actionIds`. Los UUID de TokenDocument son la identidad operativa; los nombres
solo sirven como respaldo de presentación. Maniobras sucesivas unen rivales sin
duplicados. Estado muestra «Protegido por maniobra (rivales…)» en PJ y PNJ y
permite retirarlo; una hoja de Actor sintético filtra por su token.

Confirmar destraba las relaciones existentes con los rivales vencidos mediante
la operación normal, incluidas sus limpiezas. La restricción bloquea ataques
cuerpo a cuerpo, a distancia y de reacción y la creación/reactivación de trabas,
aunque esté desactivado el alcance detallado. La interfaz informa del bloqueo y
los ejecutores vuelven a comprobarlo; seleccionar el token como objetivo sigue
permitido. Declarar un ataque válido contra un rival elimina solo a ese rival de
la protección propia, aunque falle. Cancelar o rechazar el ataque no la consume.
El efecto desaparece al vaciarse la lista, al final del asalto actual o al terminar
el combate. No se escribe un segundo registro en `maneuverRestrictions`.

Las ayudas de acciones, comprobaciones de combate y cobertura táctica usan
`ruleHelpButton` y `.mythras-help-button`, con el mismo icono, tamaño, alineación,
foco y hover. El clic abre un DialogV2 y el tooltip compartido describe el botón.

### Retrasar y Esperando

El esquema 2 de combatActions registra esperas por combatiente con pago diferido
(`payment: onReaction`). Retrasar cuesta cero PA pero requiere uno disponible y
pasa el turno. El efecto waiting referencia combate y combatiente; el registro
de espera gobierna su consumo. combat-waiting serializa gasto y caducidad por
actor. Las defensas, respuestas de alcance y reacciones generales retiran la
espera después de gastar su PA habitual, sin un segundo coste ni avance de turno.
La siguiente oportunidad del combatiente descuenta un PA si sigue esperando;
si queda a cero se omite su turno. El cierre de ronda liquida las esperas antes
de restaurar PA. Finalizar combate o eliminar combatiente limpia sin penalizar.
Las reservas anteriores ya estaban pagadas: la migración las invalida sin cobro
y reanuda las acciones suspendidas por ofertas antiguas de interrupción.


### Interrumpir durante Esperando

`combat-interruption.js` comparte la autorización de acciones fuera de turno y
coordina una sesión persistida en `flags.mythras-foundry.combatInterruption`, con
esquema propio 1. Las fases operativas son `choosing`, `resolving` y
`awaitingDecision`; guardan combatientes, ronda, ciclo, revisión de turno,
referencias de la declaración suspendida, gasto previo y acción elegida.
No se modifica el orden, la iniciativa ni la posición del tracker.

El botón Interrumpir es la primera acción circunstancial y reutiliza
`sheet-action-attention`. Seleccionarlo no cobra ni consume Esperando; habilita
una acción proactiva, excepto Retrasar, y ofrece cancelar la elección. Las
validaciones de turno de acciones generales, ataques, alcance, recarga,
apuntado, cobertura y liberación consultan el mismo contexto. El servicio de PA
reclama la oportunidad de forma coordinada: descuenta el coste normal, consume
la espera y bloquea una segunda acción. Una reacción habitual sigue teniendo su
flujo propio; si ocurre durante la elección, consume la espera y cancela esa
elección sin preguntar si se impidió una declaración.

La sesión bloquea los avances de turno/ronda y las mutaciones pendientes de la
declaración original. Los controladores enlazan su acción o mensaje con la
sesión y notifican el cierre únicamente al completar su resolución documental,
incluidas defensas, efectos y confirmaciones. La ejecución fuera de turno no
avanza condiciones de turno propio. Cancelar una elección mantiene la espera;
cancelar un ataque con reembolso restaura la espera mientras el turno capturado
siga vigente. Las consecuencias ya aplicadas no se revierten automáticamente.

La elección se indica en la hoja con su control de cancelación y no publica
una tarjeta anticipada en el chat. Solo al terminar la acción interruptora,
incluidas las defensas, efectos, comprobaciones y daño pendientes, se crea
la tarjeta persistente que permite únicamente al DJ decidir si la acción original
queda impedida. Si continúa, se desbloquea la resolución suspendida. Si se impide,
se cierran sus controles y pasos pendientes y se pasa una vez al siguiente turno:
el PA ya pagado se conserva como coste y solo se descuenta uno cuando no había
pago. La finalización por impedimento no utiliza la cancelación con reembolso.
Las solicitudes se serializan por combate; identificadores y fases impiden el
consumo repetido, y ronda/ciclo/revisión invalidan respuestas de otro turno.
Las sesiones válidas sobreviven a la recarga; las obsoletas o sin participante
se limpian. Finalizar/eliminar combate o eliminar participantes cierra la sesión.


Las tarjetas de acciones generales muestran la descripción localizada del efecto
directamente bajo el título en todas sus fases y ofrecen `ruleHelpButton` junto al estado,
no solo en Afianzarse y Maniobrar. Su diálogo explica el comportamiento
implementado y muestra estado, coste registrado y notas de la ejecución; las
descripciones se localizan en `MYTHRASF.Action.Description.<key>`, conservando
las explicaciones canónicas de los estados Afianzado y protección de Maniobrar.

Las tarjetas de enfrentadas sitúan la penalización por competición de fuerza
bajo la fila del participante, ocupando todas las columnas y con salto de línea.
El porcentaje y los dados conservan sus columnas sin incorporar explicaciones.


### Permisos y vista de consulta de actores

`actor-visibility.js` centraliza las capacidades de las hojas: GM y propietario
ven la hoja completa; LIMITED y OBSERVER abren la misma vista de consulta; NONE
no puede abrirla. Ambas hojas requieren como mínimo LIMITED y comprueban acceso
antes de renderizar. La consulta no enlaza acciones operativas ni admite envío
de formularios. El modo edición y los controladores de modificación exigen
propiedad o GM, además de la editabilidad habitual. Se mantienen los límites
anatómicos de los tokens.

La vista de consulta renderiza un encabezado de solo lectura y un cuerpo
compartido: Combate contiene únicamente localizaciones y armas; Estado muestra
sus estados y penalizaciones sin poder cambiarlos; Trasfondo del PJ excluye el
recuadro privado completo; Galería permite ampliar imágenes. Personaje/General,
Inventario, acciones y estilos no se renderizan. Los nombres de Items y la
silueta pública no abren documentos. La silueta permanece visible en el encabezado
independientemente del recuadro de localizaciones de Combate.

Las opciones de mundo `showOtherActorWeapons`, `showOtherActorLocations`,
`showOtherActorStatus` y `showOtherActorResources` son booleanas, verdaderas por
defecto y compartidas por PJ y PNJ. Solo restringen a jugadores no propietarios;
la última controla conjuntamente magia y suerte del encabezado. Ocultar Estado
no oculta sus indicadores del encabezado. Sin armas ni localizaciones se omite
Combate; una pestaña anterior no disponible se sustituye por la primera visible.
Cambiar estas opciones vuelve a renderizar las hojas abiertas, incluidas las de
tokens. Son reglas de presentación de estas hojas, sin modificar la distribución
de datos de documentos de Foundry ni las reglas de permisos de Items.

`gallery-sheet.js` comparte la gestión de `system.gallery` entre los dos tipos
de Actor y vuelve a comprobar propiedad antes de guardar. El PNJ usa el mismo
esquema de imágenes `{src, title}`, con una lista vacía inicial; no se reconstruyen
ni sobrescriben documentos existentes. El PNJ no incorpora una pestaña Trasfondo.

## Items de peligros y aflicciones

`trap`, `poison` y `disease` comparten `HazardData`: perfil editable, porcentaje
de dificultad/potencia, variantes completas y etapas descriptivas. Su hoja
`HazardItemSheet` conserva la superficie y componentes de las hojas de Item.
No requieren migración de mundo, porque son tipos nuevos con valores iniciales.

Las fuentes de `scripts/data/hazard-items.js` y sus descripciones de referencia
alimentan los compendios `traps`, `poisons` y `diseases` con identificadores
estables. `hazard-items.js` en reglas contiene las selecciones de perfiles y
adaptación pura al motor de enfrentadas existente. `hazard-item-runtime.js`
coordina selección del actor propietario, configuración de habilidad, tiradas y
chat. El daño aplicado requiere GM y confirmación de la cantidad final; resta
antes la armadura aplicable y delega esa cantidad fija a `applyDirectDamage`,
sin volver a tirar ni absorber protección dos veces. `applyHazardStatus` activa
los estados canónicos `poison` y `disease` al aplicar el Item, al perder una
resistencia o al confirmar daño de esa aflicción. Respeta permisos y no duplica
marcadores activos. La aplicación directa se ofrece en la hoja con selección
de objetivo. El mero inventario, las cancelaciones y las tiradas resistidas o
repetibles no los activan. Los tiempos, curación, retirada del marcador y efectos
específicos siguen a cargo del DJ; no se crea una cola temporal de aflicciones.

### Presentación del catálogo de estados del token

En `ready`, `scripts/ui/status-catalog.js` traduce los estados básicos de Foundry
y ordena conjuntamente todo `CONFIG.statusEffects` por el nombre localizado,
con las reglas alfabéticas del idioma activo. Conserva identificadores y metadatos, así como el formato array u objeto,
y asigna los iconos propios del catálogo. Los estados básicos conservados
son marcadores; `poison` y `disease` ya pertenecen al catálogo canónico de Mythras
y se activan desde el flujo de aplicación de aflicciones.
Los estados añadidos por otros módulos después de `ready` quedan fuera de esta
ordenación inicial.

Los iconos de estados se resuelven mediante `scripts/data/status-icons.js`,
compartido por el catálogo, la asignación y el hook `preCreateActiveEffect`.
Los PNG propios y la referencia de recortes viven en `assets/icons/statuses/`.
El coordinador de migraciones actualiza únicamente los iconos predeterminados
de efectos existentes, incluyendo actores de tokens no vinculados.

`status-aliases.js` unifica `stun`, `silence` y `blind` en `stunned`, `silenced`
y `blinded`. El catálogo oculta los alias; los hooks de ActiveEffect normalizan
sus identificadores y las migraciones los actualizan sin eliminar documentos.
Las referencias de `CONFIG.specialStatusEffects` también usan IDs canónicos,
incluida la ceguera de Foundry.

El catálogo aplica PNG opacos con fondo negro para que la presentación sea
coherente tanto en el HUD como en el canvas, sin depender de CSS. Las imágenes
con fondo de color anteriores se archivan en `assets/icons/statuses/obsolete/`.
