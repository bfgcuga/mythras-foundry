# Guía de refactorización

Este documento registra los límites estructurales que conviene mejorar sin
confundirlos con funcionalidades pendientes. El orden efectivo de ejecución lo
determina [`roadmap.md`](roadmap.md); los candidatos aún sin prioridad permanecen
en [`pending.md`](pending.md).

## Prioridad planificada

### Consecuencias de asalto

`scripts/rules/round-consequences.js` reúne actualmente el modelo y la
persistencia de la cola, los ejecutores de consecuencias, el renderizado HTML y
el transporte mediante mensajes y eventos. Antes de ampliar los peligros debe
separarse en fronteras equivalentes a las ya empleadas por el combate:

- un modelo puro para construir y validar la cola;
- ejecutores que reciban explícitamente sus dependencias de Foundry;
- un renderizador sin escrituras documentales;
- un adaptador de mensajes, sockets y eventos.

La extracción debe conservar el esquema persistido, la reanudación de entradas
pendientes y las transiciones actuales. Este trabajo ocupa una posición explícita
en el roadmap.

## Candidatos sin prioridad

### Asistente de creación de trasfondo

`scripts/sheets/character-sheet.js` combina la hoja general con la preparación,
navegación y validación del asistente, la sincronización provisional de Items y
su materialización final. Debe extraerse un controlador del asistente y separar
la sincronización y materialización en servicios comprobables. La hoja debe
conservar únicamente la adaptación entre Application V2, eventos y esos
servicios.

### Fachada de combate interactivo

La división vigente en runtimes y renderizador es la arquitectura que debe
preservarse. `scripts/rules/combat-chat.js` sigue actuando como una fachada
grande porque además de componer dependencias presenta diálogos y despacha las
acciones de la tarjeta. Cuando vuelva a crecer, extraer primero un registro
declarativo de acciones, los diálogos por fase y la política de permisos y
visibilidad. No devolver escrituras documentales a esta fachada ni rehacer los
runtimes que ya poseen una responsabilidad estable.

### Registro de hooks del sistema

`scripts/mythras-foundry.js` debe tender a ser un punto de composición mínimo.
Los hooks que aún contiene pueden agruparse por dominio —Actor, Item, estados y
Token— en módulos de registro, manteniendo explícitos el orden de inicialización
y las protecciones frente a ejecuciones duplicadas.

### Hoja de estilos compartida

`styles/mythras-foundry.css` es la fuente canónica de variables y componentes;
dividirlo no debe fragmentar esos contratos. Si su crecimiento dificulta el
mantenimiento, puede separarse en fuentes ordenadas por tema, controles, hojas,
chat y diálogos, generando o importando un único punto de entrada. Antes de la
separación deben caracterizarse el orden de cascada y los selectores compartidos.

### Pruebas acopladas a la implementación

Las pruebas que inspeccionan cadenas de código o una estructura privada deben
migrarse gradualmente a contratos observables. Se priorizan los casos ya
identificados en [`test-review.md`](test-review.md): estándares de estilo,
reorganización de hojas, vista táctica, galería, gesto de tirada manual y tiradas
especiales. Los reemplazos deben compilar las plantillas reales, disparar los
eventos correspondientes y comprobar HTML, llamadas y persistencia resultantes.

## Criterios de ejecución

- Refactorizar por una frontera cada vez y ejecutar primero sus pruebas y
  consumidores directos.
- Mantener compatibles los esquemas persistidos y las APIs públicas salvo que
  exista una migración explícita.
- No crear una infraestructura genérica de transacciones interactivas hasta que
  combate, concursos, alcance o consecuencias aporten al menos dos consumidores
  estables con el mismo contrato.
- Tratar el tamaño de un archivo como una señal, no como el objetivo: la
  extracción debe reducir responsabilidades o acoplamiento verificables.
- Ejecutar la suite completa cuando el cambio atraviese varias capas o modifique
  infraestructura compartida, conforme a [`testing-policy.md`](testing-policy.md).
