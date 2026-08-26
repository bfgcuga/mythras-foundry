# Roadmap

Este documento reúne únicamente trabajo futuro confirmado. Las funcionalidades
terminadas se describen en `README.md` y las decisiones técnicas vigentes en
`docs/architecture.md`.

## Reglas y automatización

### Integración de tiradas con combate

- El Combat Tracker ya gestiona asaltos, ciclos, máximos efectivos, gasto de PA
  en ataques y defensas y desempates de iniciativa. La selección de los 44
  efectos de combate, sus resoluciones guiadas y los modificadores compatibles
  con daño, parada, localización y armadura también están disponibles.
- El combate a distancia ya resuelve distancia declarada, bandas, penalización
  por TAM y circunstancias, Apuntar, recarga, munición opcional, cobertura
  localizada y blancos accidentales al disparar a una melé.
- Los ataques de personaje y PNJ ya reutilizan el ajuste de tiradas generales
  para dificultad, habilidades limitadas o reforzadas y previsualización del
  objetivo, después de reunir los modificadores tácticos y antes de consumir
  recursos.
- El catálogo general ya registra acciones proactivas, acciones guiadas,
  movimiento, postura, Retrasar e interrupciones. Las acciones gratuitas no
  requieren automatización.
- Las hojas ya muestran siempre el catálogo de acciones con disponibilidad y
  motivo, reúnen Fatiga en Estado y ofrecen silueta y Trasfondo al personaje.
- Enlazar las oposiciones de Forcejear, Maniobrar y Ponerse en Pie y el ataque
  de Carga con la transacción diferencial completa; el catálogo ya conserva
  sus PA, participantes y parámetros, pero esas resoluciones permanecen
  confirmadas de forma guiada.
- Completar la automatización interna de magia y monturas cuando existan esos
  subsistemas; hasta entonces sus acciones conservan una resolución guiada.
- Ampliar las consecuencias persistentes de los efectos que todavía dependen
  de geometría o decisiones narrativas. Alcance, Cambiar Alcance, Retirada,
  Bloqueo Pasivo y las fuentes liberables ya disponen de estructura táctica.
- Completar Elegir Localización contra una extremidad lisiada: debe tirar `1d3`
  para comprobar si alcanza la parte restante, sin reutilizar la resolución
  aleatoria que ya descarta resultados de impacto anulados.
- Garantizar que todo personaje pueda usar el ataque canónico Puño/Patada sin
  convertirlo en un objeto transportado. Si algún estilo incluye el perfil
  estable `puno-patada`, la tirada debe usar ese estilo; si ninguno lo incluye,
  debe usar el porcentaje efectivo de la habilidad básica con `slug` estable
  `pelea`, no la resolución genérica sin entrenamiento basada en FUE + DES. La
  tirada y una posible pifia deben quedar asociadas a la habilidad empleada.
- Restringir las paradas activas con armas naturales: `parryChoices` solo debe
  ofrecerlas cuando el Actor posea el rasgo de criatura con clave estable
  `formidable-natural-weapons` (Armas Naturales Formidables). Las armas
  manufacturadas no dependen de este rasgo. Cubrir tanto la presencia como la
  ausencia del rasgo con pruebas.
- Valorar la migración de `tacticalState.covers` desde un único perfil por
  combatiente a múltiples coberturas simultáneas, definiendo cómo se combinan
  protección, localizaciones y cobertura completa en la resolución de impactos.
- Realizar una revisión estética final del menú de situación táctica una vez
  estabilizados sus controles, permisos y operaciones sobre las tres tablas.

### Estados y penalizaciones


- Ampliar el motor temporal ya disponible cuando se incorporen acciones
  generales, alcance y tiempo mundial. Las duraciones por turno y asalto,
  Sangrando, Desangrándose, Agonizando, Ahogándose, Sorpresa y las consecuencias temporales
  de heridas y efectos de combate ya están integradas con el tracker.
- Revisar conjuntamente el catálogo propio de estados y los estados nativos de
  Foundry antes de reducir los iconos disponibles en el HUD. Identificar qué
  estados equivalentes deben fusionarse, qué integraciones nativas resultan
  útiles para las reglas de Mythras —por ejemplo, la visión del token al estar
  Cegado—, qué estados de Foundry conviene incorporar al sistema y cuáles pueden
  eliminarse sin perder funcionalidad ni compatibilidad relevante.

### Macros de daño y peligros

- Implementar la lógica y las herramientas de juego para venenos, enfermedades
  y trampas.
- Crear macros para inclemencias del tiempo. Las caídas normales, desde
  vehículos y de objetos ya disponen de una macro puntual de daño.
- Delimitar qué peligros cubren las inclemencias: frío, calor, exposición u
  otros efectos ambientales.

El método porcentual para multitudes no requiere implementación: es una
resolución directa del Game Master.

## Creación de personajes

### Tablas aleatorias

- Las tablas de padres, hermanos, familia extendida, reputación y conexiones ya
  existen como RollTables y como tiradas opcionales de un solo uso dentro del
  asistente, compartiendo una única fuente de reglas. Matrimonio se resuelve
  como procedimiento guiado en la misma fase.
- La tabla 1d100 de acontecimientos de trasfondo ya existe como RollTable y la
  edad determina cuántas tiradas automáticas se anteponen a la historia del
  personaje sin perder sus notas anteriores.
- Enumerar antes de implementarlas las demás tablas aplicables: comunidad, edad
  u otras.

### Editor visual de culturas y profesiones

- Sustituir la edición directa del JSON de reglas por menús y habilidades
  arrastrables.

## Hoja de personaje

### Experiencia y entrenamiento

- Desarrollar la lógica de Entrenar Habilidad.

### Pestaña Trasfondo

- Añadir una pestaña dedicada a historia y descripción física detallada.
- Valorar campos estructurados para historia, apariencia, edad aparente, altura,
  peso, complexión, cabello, ojos, rasgos distintivos, familia, aliados,
  contactos, rivales, enemigos y notas.
- Valorar una galería variable de imágenes adicionales del personaje en lugar
  de reservar un número fijo de espacios.

## Permisos y visibilidad

- Revisar el comportamiento de hojas y acciones según los niveles de permiso de
  Foundry: `NONE`, `LIMITED`, `OBSERVER` y `OWNER`.
- Definir por separado permisos para abrir una hoja, ver cada pestaña, editar
  datos y ejecutar acciones o tiradas.
- Decidir si `OBSERVER` puede realizar tiradas o sólo consultar información.
- Revisar qué pestañas y controles de las hojas de Item son visibles para los
  jugadores. El Game Master podrá disponer de pestañas administrativas o de
  reglas que no necesiten los demás usuarios.
- Preparar una matriz explícita de permisos antes de implementar los cambios.

## Localización

- Auditar todos los textos visibles porque el castellano es el idioma oficial
  del sistema y aún aparecen etiquetas en inglés.
- Revisar hojas, pestañas, botones, cabeceras, tooltips, estados, dificultades,
  diálogos y formularios.
- Mantener sin traducir únicamente nombres propios o términos decididos
  expresamente como parte del modelo.
