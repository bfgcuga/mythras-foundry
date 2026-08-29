# Trabajo pendiente

Este documento reúne trabajo confirmado que todavía no tiene una posición en el
roadmap. No expresa orden de ejecución. Cuando una tarea adquiera prioridad y
alcance cerrado debe trasladarse a [`roadmap.md`](roadmap.md).

## Combate y automatización

- Ampliar las consecuencias persistentes de efectos que todavía dependen de
  geometría o decisiones narrativas, incluidos Alcance, Cambiar Alcance,
  Retirada, Bloqueo Pasivo y fuentes liberables.
- Completar la automatización de magia y monturas cuando existan esos
  subsistemas; hasta entonces sus acciones permanecen guiadas.
- Valorar múltiples coberturas simultáneas por combatiente. Antes de
  implementarlas hay que definir cómo se combinan protección, localizaciones y
  cobertura completa.
- Realizar la revisión estética final del menú de situación táctica cuando sus
  controles, permisos y operaciones estén estabilizados.

## Estados y tiempo

- Revisar conjuntamente el catálogo del sistema y los estados nativos de
  Foundry: equivalencias, integración de visión —por ejemplo, Cegado—, estados
  nativos útiles y estados prescindibles.
- Ampliar el motor temporal cuando existan acciones generales, alcance y tiempo
  mundial que lo necesiten. Las duraciones por turno y asalto y las
  consecuencias actuales de Sangrando, Desangrándose, Agonizando, Ahogándose y
  Sorpresa ya están integradas con el Combat Tracker.

## Peligros

- Implementar reglas y herramientas para venenos, enfermedades y trampas.
- Definir el alcance de las inclemencias del tiempo —frío, calor, exposición u
  otros peligros— antes de crear sus macros.
- Crear las macros de clima una vez definidas esas reglas.

El método porcentual para multitudes no requiere automatización: corresponde a
una resolución directa del Game Master.

## Creación de personajes

- Enumerar las tablas aleatorias adicionales realmente aplicables, como
  comunidad o edad, antes de implementarlas. Las tablas familiares, reputación,
  conexiones, matrimonio y acontecimientos de trasfondo ya existen.
- Sustituir la edición directa del JSON de culturas y profesiones por un editor
  visual con menús y habilidades arrastrables.

## Trasfondo narrativo

La pestaña Trasfondo ya existe y contiene historia, descripción, personalidad,
motivaciones, familia, relaciones, secretos y notas. Queda por decidir:

- si la descripción física debe desglosarse en edad aparente, altura, peso,
  complexión, cabello, ojos y rasgos distintivos;
- si debe añadirse una galería variable de imágenes del personaje.

## Permisos y visibilidad

Antes de cambiar las hojas debe definirse una matriz para `NONE`, `LIMITED`,
`OBSERVER` y `OWNER` que distinga:

- permiso para abrir una hoja;
- pestañas visibles;
- datos editables;
- acciones y tiradas permitidas;
- visibilidad de pestañas administrativas de Items;
- si `OBSERVER` puede tirar o únicamente consultar.

## Deuda técnica no priorizada

- Extraer el asistente de creación de trasfondo de `character-sheet.js` para
  separar preparación, sincronización de Items y materialización.
- Separar en `round-consequences.js` el modelo de cola, los ejecutores, el
  renderizado y el transporte antes de ampliar significativamente los peligros.
- Evaluar una infraestructura común para transacciones interactivas solo después
  de terminar la división de combate; no abstraer antes de disponer de patrones
  estables en combate, concursos, alcance y consecuencias de asalto.
