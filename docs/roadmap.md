# Roadmap

Este documento reúne únicamente trabajo futuro confirmado. Las funcionalidades
terminadas se describen en `README.md` y las decisiones técnicas vigentes en
`docs/architecture.md`.

## Reglas y automatización

### Integración de tiradas con combate

- Integrar el motor interactivo con ataques, defensas, daño y efectos de
  combate.

### Estados y penalizaciones

- Automatizar Sangrando y Ahogándose cuando existan asaltos de combate. Mientras
  permanezca cualquiera de esos estados se realizará una tirada de Aguante en
  cada asalto: éxito crítico sin efecto; éxito, pérdida de 1 nivel de Fatiga;
  fracaso, pérdida de 1d2 niveles; pifia, pérdida de 1d3 niveles.
- Definir e implementar los efectos mecánicos de Sorprendido. Por ahora existe
  como estado manual y visual de Foundry, sin modificadores automáticos.
- Revisar conjuntamente el catálogo propio de estados y los estados nativos de
  Foundry antes de reducir los iconos disponibles en el HUD. Identificar qué
  estados equivalentes deben fusionarse, qué integraciones nativas resultan
  útiles para las reglas de Mythras —por ejemplo, la visión del token al estar
  Cegado—, qué estados de Foundry conviene incorporar al sistema y cuáles pueden
  eliminarse sin perder funcionalidad ni compatibilidad relevante.
- Añadir contadores de duración a los estados cuando se implemente el tiempo de
  combate. Su avance y vencimiento deberán vincularse explícitamente a asaltos
  y turnos, compartiendo la misma fuente temporal que Sangrando, Ahogándose y
  cualquier otra automatización periódica.

### Macros de daño y peligros

- Crear macros para ácido, caídas e inclemencias del tiempo.
- Antes de implementarlas, concretar si sólo calculan o también aplican daño a
  tokens seleccionados.
- Definir los parámetros de ácido, como intensidad, duración, localización y
  daño continuado.
- Definir los parámetros de las caídas, como altura, superficie, armadura y
  localización.
- Delimitar qué peligros cubren las inclemencias: frío, calor, exposición u
  otros efectos ambientales.

El método porcentual para multitudes no requiere implementación: es una
resolución directa del Game Master.

## Creación de personajes

### Tablas aleatorias

- Crear RollTables para familia, conexiones y las demás tablas aplicables a la
  creación de personajes.
- Enumerar antes de implementarlas el conjunto exacto de tablas: familia,
  conexiones, acontecimientos, comunidad, clase social, edad u otras.
- Decidir si además de existir como RollTables se integrarán como botones del
  asistente de creación. Si existen ambas vías, deberán compartir una única
  fuente de datos.

### Editor visual de culturas y profesiones

- Sustituir la edición directa del JSON de reglas por menús y habilidades
  arrastrables.

## Hoja de personaje

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
