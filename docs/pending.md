# Trabajo pendiente

Este documento reúne trabajo confirmado que todavía no tiene una posición en el
roadmap. No expresa orden de ejecución. Cuando una tarea adquiera prioridad y
alcance cerrado debe trasladarse a [`roadmap.md`](roadmap.md).

## Combate y automatización

- Diseñar y revisar una matriz general de compatibilidad entre efectos de
  combate. «Dañar Arma» ya distingue los efectos ligados al daño corporal o a
  las defensas del golpe de las consecuencias independientes, pero el mismo
  criterio deberá generalizarse cuando se automaticen nuevas interacciones.
- Revisar si «Cancelar» debe seguir disponible después de confirmar la elección
  de efectos de combate, ya que actualmente impide cerrar automáticamente un
  intercambio terminal y avanzar la iniciativa.
- Eliminar las notas moradas temporales «Automatizado» y «No automatizado» de
  la tarjeta de ataque cuando deje de ser necesario auditar visualmente la
  cobertura de automatización de los efectos de combate.
- Ampliar las consecuencias persistentes de efectos que todavía dependen de
  geometría o decisiones narrativas, incluidos Alcance, Cambiar Alcance,
  Retirada, Bloqueo Pasivo y fuentes liberables.
- Completar la automatización de magia y monturas cuando existan esos
  subsistemas; hasta entonces sus efectos figuran como no automatizados y no
  interrumpen el intercambio.
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

## Menús

- Inventariar los menús del sistema e indicar cuáles tienen un encabezado con
  título equivalente al de la hoja de personaje y cuáles carecen de él. Tras la
  revisión, aplicar ese formato compartido a todos los menús donde corresponda.

## Trasfondo narrativo

La pestaña Trasfondo ya existe y contiene historia, descripción, personalidad,
motivaciones, familia, relaciones, secretos y notas. Queda por decidir:

- si la descripción física debe desglosarse en edad aparente, altura, peso,
  complexión, cabello, ojos y rasgos distintivos;
- si la galería de imágenes compartida debe incorporarse también a la hoja de
  PNJ.

## Deuda técnica no priorizada

- Extraer el asistente de creación de trasfondo de `character-sheet.js` para
  separar preparación, sincronización de Items y materialización.
- Evaluar una infraestructura común para transacciones interactivas a partir de
  los patrones ya separados en combate; no abstraer sin consumidores adicionales
  estables en combate, concursos, alcance y consecuencias de asalto.
