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

Las fórmulas y tablas deben contrastarse con la edición de Mythras Imperativo
elegida antes de considerar estable una release.

## Desarrollo

Las reglas puras están separadas de la API de Foundry para poder probarlas:

```powershell
npm test
npm run check
```

`npm run check` valida la sintaxis, los archivos declarados en el manifiesto y
la coherencia entre la versión y la URL de descarga.

## Publicación

Las releases se crean automáticamente al subir una etiqueta:

```powershell
git tag -a v0.0.10 -m "Versión 0.0.10"
git push origin v0.0.10
```

La automatización rechaza la publicación si la etiqueta no coincide con la
versión declarada en `system.json`.
