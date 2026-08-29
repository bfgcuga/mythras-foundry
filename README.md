# Mythras Foundry

El Combat Tracker representa cada asalto de Mythras mediante `Combat.round` y
mantiene ciclos internos mientras queden puntos de acción. Ataques, paradas y
evasiones consumen un PA; los participantes agotados o derrotados se omiten y
los PA se restauran al comenzar un asalto y al terminar el combate. Las tiradas
de iniciativa se publican en el chat, agrupadas cuando el tracker lanza varias.
Una opción mundial activa por defecto conserva el d10 original y actualiza el
total del tracker cuando cambian las penalizaciones de iniciativa.
Solo los empates usan un d100 secundario porque las consecuencias del sistema
se aplican secuencialmente, en vez de simular actuaciones simultáneas.

Sistema independiente de Mythras básico revisado para Foundry Virtual Tabletop 13.
El proyecto no está publicado en el catálogo oficial de Foundry; las versiones
instalables se distribuyen mediante las releases de GitHub.

## Estado actual

El sistema incluye actualmente:

- hojas Application V2 para personajes, PNJ y todos los tipos de Item;
- creación de personajes por tiradas, intercambio, reparto de puntos o
  asignación libre desde los mínimos;
- asistente de trasfondo con cultura, profesión, clase social, edad, pasiones,
  habilidades, estilos de combate, dinero, equipo inicial y tiradas opcionales
  y únicas para familia, reputación, conexiones y matrimonio;
- atributos derivados, recursos, experiencia, fatiga, heridas por localización,
  carga e iniciativa modificada por armadura, con una pestaña en las hojas de
  personaje y PNJ que desglosa sus penalizaciones, estados y totales aplicados;
  el estado Incapacitado se refleja en
  el token y conserva por separado sus causas automáticas y manuales, mientras
  Cegado y Derribado imponen sus dificultades mínimas desde el HUD o la hoja;
  Inconsciente reduce habilidades y atributos efectivos a cero e impide atacar
  y defenderse, mientras Aturdido impide atacar. Sangrando y Ahogándose abren tiradas de Aguante al comenzar
  cada asalto, mientras Desangrándose pierde Fatiga automáticamente;
  Sorprendido modifica iniciativa, defensa, acciones ofensivas y el primer
  efecto de combate, con vencimiento al final del asalto;
- alcance detallado opcional mediante relaciones tácticas por pareja de
  combatientes, acción interactiva Cambiar Alcance y vista global desde el
  Combat Tracker; el DJ puede crear, corregir o eliminar relaciones y elegir
  entre las armas cuerpo a cuerpo empuñadas por cada participante; la vista
  incluye una referencia desplegable de categorías y efectos del alcance;
- Bloqueo Pasivo declarado durante la preparación del asalto, con selección de
  localizaciones conectadas por la anatomía, estado declarado o pasado visible
  por combatiente, opción de agacharse tras el escudo y cancelación al atacar o
  parar con el arma; al combatir con arma y escudo, el ataque propone primero
  el arma y el Bloqueo Pasivo propone primero el escudo, conservando ambas
  alternativas; las tablas de localizaciones de personaje y PNJ muestran
  además qué zonas conserva protegidas;
- combate a distancia con distancia manual, bandas y penalización por TAM y
  circunstancias; Apuntar, Recargar, munición numérica opcional, cobertura
  localizada y desvíos al disparar a una melé comparten la transacción de chat;
- catálogo contextual de acciones proactivas compartido por personajes y PNJ:
  Afianzarse, Aprestar Arma, Forcejear, Maniobrar, Mover, Ponerse en Pie,
  Retrasar, Titubear y Cargar se registran en el combate y gastan PA una sola
  vez. El movimiento es una declaración táctica, Retrasar abre ventanas de
  interrupción ordenadas por iniciativa y las acciones de magia y montura se
  conservan como confirmaciones guiadas;
- el cuadro de acciones de Combate permanece siempre visible y muestra el coste
  y la causa localizada cuando una acción no puede utilizarse;
- el cuadro de acciones encabeza la pestaña Combate tanto en personajes como en PNJ;
  todas las hojas usan pestañas elevadas con una superficie activa de papel;
- los encabezados de Actor usan texto, separadores y controles claros propios
  sobre la superficie roja, sin heredar el contraste de la superficie de papel;
- Estado reúne estados activos, penalizaciones y Fatiga. Personajes y PNJ
  comparten también las vistas operativas de Combate e Inventario; los ataques
  naturales permanecen en Combate sin tratarse como objetos transportados. La
  hoja de personaje añade Trasfondo narrativo y una silueta humana interactiva
  vinculada por datos
  canónicos a sus localizaciones de golpe;
- antes de cada tirada física, personaje y PNJ permiten decidir si una Herida
  Grave aumenta su dificultad y si una localización inutilizada o lisiada hace
  imposible esa acción concreta;
  las Heridas Críticas consolidan además una lesión permanente por localización,
  reducen sus PG máximos y pueden anular resultados de la tirada de impacto;
- habilidades y tiradas porcentuales configurables por dificultad, tiradas
  limitadas o reforzadas, modificadores visibles y gasto de suerte para repetir
  o invertir los dados, con resultados presentados en tarjetas de chat; una
  pifia marca automáticamente la habilidad o estilo empleado para su futura
  mejora de experiencia; las hojas incluyen además una tirada especial con
  nombre y porcentaje libres para resolver fórmulas o probabilidades puntuales;
- tiradas contra dificultad, enfrentadas y diferenciales con modalidad
  individual, de equipo o eliminatoria configurable de forma independiente para
  cada lado; los equipos admiten portavoz, miembro mayor o menor y tiradas
  individuales, mientras que en una eliminatoria el primer miembro que responde
  aporta el dado común. Las instancias de un mismo PNJ se tratan por separado;
- armas con varios modos, estilos de combate, familiaridad y rasgos
  reutilizables; antes de tirar, los ataques muestran la dificultad elegida y
  la impuesta por estados y situación, permiten aplicar habilidades limitadas o
  reforzadas y previsualizan el objetivo efectivo; blanco, declaraciones,
  circunstancias a distancia y ajustes de la tirada se reúnen en un único
  diálogo de ataque. Después crean intercambios diferenciales interactivos con
  Parar, Evadir o renunciar a la defensa, respetando el momento de declaración
  para la regla compartida de porcentajes superiores al 100 %; los impactos
  resuelven tamaño de parada, golpe contenido, daño, localización y armadura y
  proponen al DJ o propietario defensor la aplicación de PG y heridas. Antes
  del daño, el ganador selecciona o renuncia a sus efectos de combate; la
  tarjeta filtra los 44 efectos por lado, tirada y arma, automatiza los
  modificadores compatibles y ordena las tiradas de Aguante de efectos antes
  que las derivadas de heridas; el daño muestra por separado la fórmula del
  arma, el bonificador, los resultados evaluados, el total y el d20 de
  localización. Las pruebas causadas por heridas muestran motivo, habilidad,
  d100, objetivo, ataque enfrentado, resultado y consecuencia; una ayuda
  contextual mantiene fuera de la tarjeta la explicación extensa;
- armaduras por piezas, materiales y localizaciones, con comprobación de ajuste
  y conflictos de equipación;
- inventario jerárquico por persona y propiedades, contenedores, monedas,
  transferencias y compras con cambio;
- catálogo extensible que combina los compendios oficiales con fuentes de Items
  configuradas por el mundo, permite filtrar categorías y compendios, buscar sin
  perder el foco y ordenar por nombre, clase o precio;
- creador homebrew para los once tipos de Item, con selección o creación de un
  compendio mundial, imagen elegida mediante el navegador de Foundry y acceso
  desde Ajustes o una macro exclusiva del DJ; las armas y estilos continúan su
  edición en versiones acotadas de sus hojas completas;
- PNJ y criaturas con anatomías configurables, valores manuales o derivados y
  tokens no enlazados generados de forma independiente mediante fórmulas;
- gestor de grupos activos y macros que consumen la API pública del sistema;
- macro lanzadora de DJ «Aplicación de daño o estados», con botones para daño
  directo, Ácido, Fuego, Caída, Fatiga, Ahogamiento/Asfixia, Desangrándose,
  Agonizando y un gestor reescalable que explica y asigna todos los estados registrados, con
  duración manual, por turnos propios o por asaltos cuando corresponde;
- macro puntual de DJ para aplicar una cantidad fija o una fórmula de daño a
  varias localizaciones elegidas o a una aleatoria; aplica directamente a PG,
  ignora armadura y ejecuta las consecuencias compartidas de heridas;
- macro de DJ para aplicar `Desangrándose`; el estado permanece hasta retirarlo
  y reduce automáticamente un nivel de Fatiga al preparar cada asalto;
- macro de DJ para aplicar `Agonizando` con contador libre, Ritmo de curación ×2
  o ×60; el contador baja al inicio de cada asalto, nunca puede ampliarse y al
  llegar a cero aplica el estado nativo Muerto/Derrotado de Foundry;
- solicitud de tiradas de Fatiga para miembros seleccionados de cualquier
  grupo, con habilidad y dificultad configurables, resolución individual desde
  el chat y pérdida automática de un nivel al fallar;
- Fatiga periódica en combate cada `ceil(CON / 5)` asaltos completados: los personajes
  resuelven Aguante al finalizar el asalto —o desde la preparación bloqueante
  del siguiente— y los PNJ tiran
  automáticamente; por defecto solo se publican los PNJ que incrementan su
  Fatiga, con una opción mundial para mostrar todas sus tiradas;
- macro de DJ para ácido débil, fuerte o concentrado, con salpicaduras de
  duración limitada e inmersiones persistentes; ambos estados crean una
  revisión obligatoria por asalto en la que el DJ aplica, omite o retira el
  ácido, y solo al aplicarlo se deteriora por capas la armadura equipada y
  natural y alcanza las localizaciones seleccionadas —o una aleatoria— con el
  exceso;
- macro de DJ para fuego de Intensidad 1–5, con fórmula y localizaciones bajo
  control manual; el estado Ardiendo crea una resolución obligatoria al inicio
  de cada asalto sin automatizar ignición ni propagación;
- macro puntual de DJ para caídas normales, desde vehículos y de objetos, con
  ajuste por TAM, Acrobacias, superficie y tiradas independientes en
  localizaciones aleatorias que ignoran los PA; las superficies peligrosas
  admiten una fórmula adicional aplicada por separado a cada zona alcanzada;
- macro de DJ para iniciar Asfixia según Aguante y preparación; cuenta asaltos
  de cinco segundos y, agotado el aire, solicita Aguante cada asalto y aplica
  automáticamente la pérdida de Fatiga correspondiente;
- interfaz localizada en español e inglés;
- migraciones automáticas de datos heredados al abrir un mundo con un GM activo.

La implementación usa Mythras básico revisado como perfil predeterminado. Los
Puntos de Acción conservan sus dos modos válidos: un valor fijo —2 por defecto—
o el cálculo a partir de INT y DES.

El trabajo futuro confirmado, sus dependencias y las decisiones todavía
abiertas se mantienen en [`docs/roadmap.md`](docs/roadmap.md).

## Compendios

El manifiesto declara trece compendios generados a partir de fuentes canónicas:

- habilidades, culturas y profesiones;
- armas, equipo y piezas de armadura;
- rasgos, efectos de combate, estilos de combate y criaturas;
- macros, tablas de clase social, acontecimientos de trasfondo y tablas de
  familia y conexiones.

`packs/` contiene la salida LevelDB y no se versiona. Se reconstruye de forma
determinista antes de validar o empaquetar una versión.

## Desarrollo

Requisitos: Node.js y npm. Instala las dependencias y ejecuta:

```powershell
npm install
npm test
npm run build:packs
npm run check
```

- `npm test` ejecuta las pruebas unitarias y las comprobaciones de catálogo,
  manifiesto, localización, estilos e iconos.
- `npm run build:packs` genera `.build/packs-src/` y compila `packs/` mediante la
  CLI oficial de Foundry VTT.
- `npm run check` comprueba la sintaxis JavaScript, los recursos declarados en
  `system.json`, los idiomas, los compendios y la coherencia entre versión y URL
  de descarga.
- `node scripts/dev/build-packs.mjs macros` reconstruye únicamente el compendio
  indicado; sin nombres, el comando reconstruye todos los compendios.
- `npm run check -- v<versión>` comprueba además que la etiqueta indicada
  coincida con la versión del manifiesto.

Las reglas de dominio se mantienen como módulos puros bajo `scripts/rules/` para
que puedan probarse sin ejecutar Foundry. La arquitectura y las fuentes de verdad
se describen en [docs/architecture.md](docs/architecture.md).

## API para macros y módulos

El sistema publica `game.mythrasFoundry` durante `init`:

```js
const party = game.mythrasFoundry.party.getActiveMembers();
game.mythrasFoundry.shop.open({ actorUuid: actor.uuid });
game.mythrasFoundry.homebrew.open(); // Solo DJ.
game.mythrasFoundry.hazards.damage.open(); // Solo DJ; daño localizado puntual.
game.mythrasFoundry.hazards.acid.open(); // Solo DJ; usa el token controlado.
game.mythrasFoundry.hazards.fire.open(); // Solo DJ; usa el token controlado.
game.mythrasFoundry.hazards.fall.open(); // Solo DJ; aplicación puntual.
game.mythrasFoundry.hazards.suffocation.open(); // Solo DJ; inicia el contador.
game.mythrasFoundry.fatigueChecks.open(); // Solo DJ; solicitud grupal en chat.
game.mythrasFoundry.conditions.exsanguination.open(); // Solo DJ; aplica el estado.
game.mythrasFoundry.conditions.statuses.open(); // Solo DJ; catálogo y asignación de estados.
game.mythrasFoundry.conditions.dying.open(); // Solo DJ; aplica Agonizando.
```

También expone `party` para consultar o abrir el gestor de grupos, `homebrew`
para abrir el creador de Items y `traits` para consultar rasgos y registrar reglas
de rasgo adicionales. `hazards.damage`, `hazards.acid`, `hazards.fire`, `hazards.fall` y
`hazards.suffocation` abren sus
diálogos o permiten aplicar configuraciones estructuradas desde otra macro. La
forma exacta de estas APIs se define en
`scripts/api/party-api.js`, `scripts/apps/item-catalog.js`,
`scripts/apps/homebrew-item-creator.js`, `scripts/rules/direct-damage.js`, `scripts/rules/acid.js`,
`scripts/rules/fire.js`, `scripts/rules/fall.js`, `scripts/rules/suffocation.js`,
`scripts/rules/dying.js` y
`scripts/rules/traits.js`.

## Publicación

Publicar significa crear y subir una etiqueta anotada que coincida exactamente
con `system.json`. El procedimiento completo está documentado en `AGENTS.md`.
En resumen, tras superar pruebas y validación se incrementan conjuntamente
`version` y la URL `download`, se sube el commit a `main` y después la etiqueta
`v<versión>`.

La etiqueta activa `.github/workflows/release.yml`, que vuelve a ejecutar las
pruebas, reconstruye los compendios, valida la etiqueta, crea
`mythras-foundry.zip` y publica la release con el ZIP y `system.json`.
