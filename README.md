# Mythras Foundry

El Combat Tracker representa cada asalto de Mythras mediante `Combat.round` y
mantiene ciclos internos mientras queden puntos de acción. Ataques, paradas y
evasiones consumen un PA; los participantes agotados o derrotados se omiten y
los PA se restauran al comenzar un asalto y al terminar el combate. Los empates
de iniciativa usan un d100 secundario porque las consecuencias del sistema se
aplican secuencialmente, en vez de simular actuaciones simultáneas.

Sistema independiente de Mythras básico revisado para Foundry Virtual Tabletop 13.
El proyecto no está publicado en el catálogo oficial de Foundry; las versiones
instalables se distribuyen mediante las releases de GitHub.

## Estado actual

El sistema incluye actualmente:

- hojas Application V2 para personajes, PNJ y todos los tipos de Item;
- creación de personajes por tiradas, intercambio, reparto de puntos o
  asignación libre desde los mínimos;
- asistente de trasfondo con cultura, profesión, clase social, edad, pasiones,
  habilidades, estilos de combate, dinero y equipo inicial;
- atributos derivados, recursos, experiencia, fatiga, heridas por localización,
  carga e iniciativa modificada por armadura, con una pestaña en las hojas de
  personaje y PNJ que desglosa sus penalizaciones, estados y totales aplicados;
  el estado Incapacitado se refleja en
  el token y conserva por separado sus causas automáticas y manuales, mientras
  Cegado y Derribado imponen sus dificultades mínimas desde el HUD o la hoja;
  Inconsciente reduce habilidades y atributos efectivos a cero, y Aturdido
  impide atacar. Sangrando y Ahogándose abren tiradas de Aguante al comenzar
  cada asalto, mientras Desangrándose pierde Fatiga automáticamente;
  Sorprendido modifica iniciativa, defensa, acciones ofensivas y el primer
  efecto de combate, con vencimiento al final del asalto;
- alcance detallado opcional mediante relaciones tácticas por pareja de
  combatientes, acción interactiva Cambiar Alcance y vista global desde el
  Combat Tracker;
- Bloqueo Pasivo declarado durante la preparación del asalto, con selección de
  localizaciones contiguas, opción de agacharse tras el escudo y cancelación al
  atacar o parar con el arma;
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
- Estado reúne estados activos, penalizaciones y Fatiga. La hoja de personaje
  añade Trasfondo narrativo y una silueta humana interactiva vinculada por datos
  canónicos a sus localizaciones de golpe;
- antes de cada tirada física, personaje y PNJ permiten decidir si una Herida
  Grave aumenta su dificultad y si una localización inutilizada o amputada hace
  imposible esa acción concreta;
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
  reutilizables; los ataques crean intercambios diferenciales interactivos con
  Parar, Evadir o renunciar a la defensa, respetando el momento de declaración
  para la regla compartida de porcentajes superiores al 100 %; los impactos
  resuelven tamaño de parada, golpe contenido, daño, localización y armadura y
  proponen al DJ o propietario defensor la aplicación de PG y heridas. Antes
  del daño, el ganador selecciona o renuncia a sus efectos de combate; la
  tarjeta filtra los 44 efectos por lado, tirada y arma, automatiza los
  modificadores compatibles y ordena las tiradas de Aguante de efectos antes
  que las derivadas de heridas;
- armaduras por piezas, materiales y localizaciones, con comprobación de ajuste
  y conflictos de equipación;
- inventario jerárquico por persona y propiedades, contenedores, monedas,
  transferencias y compras con cambio;
- catálogo extensible que combina los compendios oficiales con fuentes de Items
  configuradas por el mundo;
- creador homebrew para los once tipos de Item, con selección o creación de un
  compendio mundial, imagen elegida mediante el navegador de Foundry y acceso
  desde Ajustes o una macro exclusiva del DJ; las armas y estilos continúan su
  edición en versiones acotadas de sus hojas completas;
- PNJ y criaturas con anatomías configurables, valores manuales o derivados y
  tokens no enlazados generados de forma independiente mediante fórmulas;
- gestor de grupos activos y macros que consumen la API pública del sistema;
- interfaz localizada en español e inglés;
- migraciones automáticas de datos heredados al abrir un mundo con un GM activo.

La implementación usa Mythras básico revisado como perfil predeterminado. Los
Puntos de Acción conservan sus dos modos válidos: un valor fijo —2 por defecto—
o el cálculo a partir de INT y DES.

El trabajo futuro confirmado, sus dependencias y las decisiones todavía
abiertas se mantienen en [`docs/roadmap.md`](docs/roadmap.md).

## Compendios

El manifiesto declara doce compendios generados a partir de fuentes canónicas:

- habilidades, culturas y profesiones;
- armas, equipo y piezas de armadura;
- rasgos, efectos de combate, estilos de combate y criaturas;
- macros y tablas de clase social.

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
```

También expone `party` para consultar o abrir el gestor de grupos, `homebrew`
para abrir el creador de Items y `traits` para consultar rasgos y registrar reglas
de rasgo adicionales. La forma exacta de estas APIs se define en
`scripts/api/party-api.js`, `scripts/apps/item-catalog.js`,
`scripts/apps/homebrew-item-creator.js` y `scripts/rules/traits.js`.

## Publicación

Publicar significa crear y subir una etiqueta anotada que coincida exactamente
con `system.json`. El procedimiento completo está documentado en `AGENTS.md`.
En resumen, tras superar pruebas y validación se incrementan conjuntamente
`version` y la URL `download`, se sube el commit a `main` y después la etiqueta
`v<versión>`.

La etiqueta activa `.github/workflows/release.yml`, que vuelve a ejecutar las
pruebas, reconstruye los compendios, valida la etiqueta, crea
`mythras-foundry.zip` y publica la release con el ZIP y `system.json`.
