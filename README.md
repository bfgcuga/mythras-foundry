# Mythras Foundry

Sistema independiente de Mythras Imperativo para Foundry Virtual Tabletop 13.
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
  penalizaciones, carga e iniciativa modificada por armadura;
- habilidades y tiradas porcentuales con resultados de crítico, éxito, fallo y
  pifia presentados en tarjetas de chat;
- armas con varios modos, estilos de combate, familiaridad, rasgos reutilizables
  y resolución de ataques;
- armaduras por piezas, materiales y localizaciones, con comprobación de ajuste
  y conflictos de equipación;
- inventario jerárquico por persona y propiedades, contenedores, monedas,
  transferencias y compras con cambio;
- catálogo extensible que combina los compendios oficiales con fuentes de Items
  configuradas por el mundo;
- creador homebrew para los diez tipos de Item, con selección o creación de un
  compendio mundial, imagen elegida mediante el navegador de Foundry y acceso
  desde Ajustes o una macro exclusiva del DJ; las armas y estilos continúan su
  edición en versiones acotadas de sus hojas completas;
- PNJ y criaturas con anatomías configurables, valores manuales o derivados y
  tokens no enlazados generados de forma independiente mediante fórmulas;
- gestor de grupos activos y macros que consumen la API pública del sistema;
- interfaz localizada en español e inglés;
- migraciones automáticas de datos heredados al abrir un mundo con un GM activo.

La implementación usa Mythras Imperativo como perfil predeterminado. Los Puntos
de Acción pueden configurarse como un valor fijo —2 por defecto— o calcularse a
partir de INT y DES. Las diferencias pendientes de perfil se identifican en el
código con `RULESET DIFFERENCE` y `TODO(rules-profile)`.

Queda pendiente sustituir el JSON de reglas de selección de culturas y
profesiones por un editor visual basado en menús y habilidades arrastrables.

## Compendios

El manifiesto declara diez compendios generados a partir de los módulos de
`scripts/data/`:

- habilidades, culturas y profesiones;
- armas, equipo y piezas de armadura;
- rasgos y criaturas;
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
