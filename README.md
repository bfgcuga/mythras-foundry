# Mythras Foundry

Sistema independiente de Mythras Imperativo para Foundry Virtual Tabletop.

## Estado

El proyecto está en desarrollo temprano y se prueba actualmente con Foundry V13.
No está publicado en el catálogo oficial de Foundry.

La primera fase incluye:

- personaje con siete características;
- generación y confirmación de características;
- atributos derivados y recursos actuales/máximos;
- habilidades reutilizables y tiradas porcentuales;
- equipo y armas como tipos de Item independientes;
- interfaz en español.
- compendio de habilidades generado desde fuentes legibles.

Las fórmulas y tablas deben contrastarse con la edición de Mythras Imperativo
elegida antes de considerar estable una release.

## Perfiles de reglas pendientes

La implementación actual usa Mythras Imperativo. Las diferencias conocidas
respecto a Mythras completo se marcan en el código con `RULESET DIFFERENCE` y
los puntos de extensión previstos con `TODO(rules-profile)`.

La primera diferencia registrada son los Puntos de Acción: Imperativo concede
siempre 2, mientras que Mythras completo los deriva de INT y DES. En una fase
posterior se podrá introducir un perfil de reglas para seleccionar el
comportamiento sin duplicar hojas, macros ni modelos de datos.

## Desarrollo

Las reglas puras están separadas de la API de Foundry para poder probarlas:

```powershell
npm test
npm run check
```

`npm run check` valida la sintaxis, los archivos declarados en el manifiesto y
la coherencia entre la versión y la URL de descarga.

`npm run build:packs` usa la CLI oficial de Foundry para compilar las fuentes
de habilidades en un compendio LevelDB compatible con V13. Las descripciones
del catálogo son resúmenes originales, no copias literales del manual.

### Grupos activos y macros

El gestor de grupos de los ajustes del sistema permite seleccionar un grupo activo.
Las macros pueden obtener sus personajes sin depender de las carpetas de actores:

```js
const party = game.mythrasFoundry.party.getActiveMembers();
for (const actor of party) {
  // Operación de la macro.
}
```

## Publicación

Las releases se crean automáticamente al subir una etiqueta:

```powershell
git tag -a v0.0.10 -m "Versión 0.0.10"
git push origin v0.0.10
```

La automatización rechaza la publicación si la etiqueta no coincide con la
versión declarada en `system.json`.
