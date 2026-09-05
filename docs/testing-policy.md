# Política de pruebas

La finalidad de las pruebas es detectar regresiones relevantes y permitir cambiar
la implementación con confianza. No se busca maximizar el número de casos ni
repetir comprobaciones sin evidencia nueva. Esta política se aplica al desarrollo
y mantenimiento; la publicación conserva los requisitos de [AGENTS.md](../AGENTS.md).

## Qué ejecutar y en qué orden

1. Identificar el comportamiento cambiado y sus consumidores directos. Consultar
   las pruebas existentes de esa área antes de añadir casos o ejecutar la suite.
2. Ejecutar los archivos afectados. Ante un fallo, aislar el caso por nombre para
   corregirlo; después volver a ejecutar el conjunto afectado, no solo ese caso.
3. Ampliar a los consumidores y escenarios relacionados cuando cambie un contrato
   compartido, aparezca un fallo fuera del área inicial o el alcance sea incierto.
4. Ejecutar la suite completa al cerrar cambios transversales: infraestructura de
   pruebas, dependencias de desarrollo, modelos o servicios compartidos por varias
   áreas. También cuando no pueda acotarse con confianza el impacto o se solicite
   una validación integral del proyecto.
5. Ejecutar `check` cuando cambien módulos de ejecución, recursos declarados,
   idiomas, compendios o manifiesto. Si cambian fuentes de compendios, reconstruir
   los afectados antes de validarlos. `check` y los tests son complementarios.
6. Antes de publicar, ejecutar siempre la suite completa, construir los compendios
   que necesiten actualización y validar el proyecto y la etiqueta de versión,
   siguiendo el flujo de publicación de AGENTS. Un resultado focalizado no cumple
   este requisito.

No se ejecuta toda la suite después de cada edición. Una tarea acotada puede
cerrarse con las comprobaciones pertinentes sin afirmar que se ha validado todo
el proyecto. Una ejecución satisfactoria no se repite mientras no haya cambios
relevantes posteriores, fallos o dudas nuevas. Antes de publicar se comprueba que
los resultados corresponden al contenido que se va a publicar.

| Cambio | Comprobación habitual |
| --- | --- |
| Documentación sin efecto en ejecución | Revisar contenido, enlaces y diff; no lanzar tests por rutina. |
| Regla o corrección localizada | Pruebas de esa regla y de los consumidores afectados; `check` si cambia código de ejecución. |
| Plantilla o controlador de hoja/diálogo | HTML generado, eventos, permisos y datos afectados; revisar en Foundry si cambia apariencia o integración que el DOM simulado no representa. |
| CSS compartido | Contratos de estilos afectados y revisión visual de las vistas relevantes; ampliar la suite si cambia un contrato usado por varias áreas. |
| Catálogo, imagen o traducción | Integridad correspondiente; reconstrucción si afecta a compendios y `check`. |
| Infraestructura, dependencias o cambio transversal | Suite completa y comprobaciones de proyecto aplicables. |
| Validación integral o publicación | Suite completa y `check`; para publicar, además construcción y validación explícita de versión según AGENTS. |

## Qué pruebas añadir o mantener

- Cada caso debe proteger un resultado, una regla, un límite o un contrato estable.
  Su título debe describir lo que realmente comprueba.
- Para una corrección de comportamiento, añadir o ajustar un caso que detecte el
  error concreto, cuando sea viable. Reutilizar escenarios existentes; no añadir
  pruebas para cambios triviales o para repetir literalmente la implementación.
- Preferir reglas puras con datos concretos. Para interfaz, ejecutar plantillas,
  controladores y eventos reales; limitar los dobles a las fronteras de Foundry.
- Comprobar efectos relevantes conjuntamente: persistencia, gasto, permisos o
  cancelación. Un OR que acepta cualquiera de ellos puede ocultar una regresión.
- Conservar comprobaciones de integridad que aporten garantías diferentes a
  `check`: nombres/rutas únicos, recursos existentes, claves dinámicas o registro
  completo. Recorrer el catálogo vigente en lugar de fijar cantidades accidentales.
- Usar aserciones de código fuente solo para contratos que necesiten proteger
  explícitamente esa fuente. No exigir frases de documentación, espacios, orden
  de clases, nombres privados ni una expresión concreta cuando importa su efecto.
- En CSS, comprobar reglas activas o estilos aplicables. No aceptar comentarios
  como evidencia de una regla ni rechazar formato equivalente. Una medida exacta
  solo se fija cuando constituye un requisito del producto.
- Fusionar únicamente garantías solapadas. Antes de retirar un caso, identificar
  qué errores dejaría de detectar y dónde quedan cubiertos sus escenarios únicos.
  No eliminar ni relajar pruebas solo para obtener una suite verde.

No hay un objetivo de cantidad de tests ni un porcentaje de cobertura obligatorio.
Las revisiones se acotan por cambios, fallos, fragilidad o duplicidad observados;
no se vuelve a auditar todo el repositorio en cada tarea.

## Comandos

Requiere Node.js 24.19 o posterior y las dependencias instaladas con `npm install`.

```powershell
# Un área; se pueden indicar varios archivos explícitamente.
node --experimental-test-module-mocks --test tests/starting-equipment.test.js

# Aislar un caso durante el diagnóstico.
node --experimental-test-module-mocks --test --test-name-pattern="equipo inicial" tests/starting-equipment.test.js

# Suite completa y validación independiente.
npm test
npm run check

# Reconstrucción selectiva, cuando corresponda.
node scripts/dev/build-packs.mjs macros

# Validación explícita de la etiqueta prevista antes de publicar.
npm run check -- v<versión>
```

El flag de mocks de módulos forma parte de `npm test`; la API de Node sigue siendo
experimental. El [inventario](test-inventory.md) es una instantánea histórica:
para elegir los archivos actuales se consulta `tests/` y la
[clasificación con los destinos de la revisión](test-classification.md).

## Límites y comunicación de resultados

jsdom no equivale a Foundry ni a un navegador que mida disposición visual.
PostCSS permite comprobar declaraciones activas, pero no certifica contraste
perceptivo ni presentación final. Los dobles de campos inspeccionan metadatos;
no prueban la validación real de los modelos de Foundry. Los detalles de la
infraestructura están en [arquitectura](architecture.md#validación-y-publicación).

Cuando corresponda una comprobación visual o de integración y no esté disponible,
indicar qué falta; no presentarla como realizada ni convertirla en una aprobación
manual obligatoria para tareas que no la necesitan.

Al cerrar una tarea, resumir qué se comprobó, si la ejecución fue focalizada o
completa y los fallos o límites relevantes. Si se mide tiempo, tratarlo como una
observación de esa ejecución, no como un benchmark. Informar de los fallos sin
atribuirlos a cambios previos sin evidencia. Una comprobación fallida sigue abierta
hasta corregirla o explicar de forma concreta el bloqueo.
