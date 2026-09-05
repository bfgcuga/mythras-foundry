# Revisión de pruebas de estructura y estilos

Revisión acotada del 5 de septiembre de 2026. Cubre la ejecución completa y la
inspección de estructura y estilos. La continuación con los pasos 3 y 4 se
documenta en [duplicidades y clasificación](test-classification.md). Este informe conserva el diagnóstico previo a los cambios; el paso 5 y su
verificación actual están en la clasificación.

## Ejecución de referencia

- Commit del código: `b869295fae1cb86fb8d4d70535677f6b8d8ffefa`.
- Árbol inicial: cambios de documentación en `README.md` y
  `docs/test-inventory.md`; sin cambios locales en código o pruebas.
- Node `v24.19.0`, Windows. `npm` no estaba disponible en el PATH de esta sesión.
- Se ejecutó directamente el comando del script `test` de `package.json`, con
  salida TAP explícita: `node --test --test-reporter=tap "tests/*.test.js"`.
- 96 archivos; **616 pruebas aprobadas**, 0 fallidas, canceladas, omitidas o TODO.
- Duración del runner: **3697,7215 ms**; tiempo total medido: **3,835 s**.
- No hubo fallos que atribuir a cambios en curso. Es una medición individual,
  no un estudio de rendimiento ni de intermitencia.
- No se ejecutó `npm run check`: corresponde a otra comprobación, fuera de los
  dos pasos solicitados.

El inventario anterior conserva su carácter de instantánea: sus 95 archivos y
605 casos pertenecen a un estado previo del árbol, no a esta ejecución.

## Alcance inspeccionado

Se leyeron las aserciones de estos 10 archivos (53 casos). En 42 casos se
comprueba texto de fuentes, plantillas, CSS o documentación; los otros 11
ejecutan funciones y comprueban sus resultados. Esta distinción no equivale a
decidir que deban eliminarse 42 pruebas.

| Archivo | Casos | Observación |
| --- | ---: | --- |
| [style-standards.test.js](../tests/style-standards.test.js) | 23 | Todos estáticos. Mezcla estándares visuales con Suerte, creación de estilos, pasiones y hooks. Exige frases, espacios y fragmentos de implementación. |
| [sheet-reorganization.test.js](../tests/sheet-reorganization.test.js) | 11 | Ocho estáticos; tres ejecutan silueta, riesgos de heridas y apertura del diálogo. Los estáticos mezclan organización, esquemas y consecuencias de heridas. |
| [tactical-overview-ui.test.js](../tests/tactical-overview-ui.test.js) | 2 | Ambos estáticos. El primero reúne filtrado, permisos, botones, eventos y tamaño de ventana sin ejecutar esas operaciones. |
| [hit-location-table.test.js](../tests/hit-location-table.test.js) | 8 | Cuatro estáticos y cuatro funcionales. La preservación de heridas, referencias rotas y preparación de filas sí se ejercitan con datos. |
| [character-gallery.test.js](../tests/character-gallery.test.js) | 1 | Comprueba declaración del esquema, inclusión del parcial y nombres de acciones; no prueba añadir, abrir o eliminar imágenes. |
| [combat-sheet-manual-roll.test.js](../tests/combat-sheet-manual-roll.test.js) | 1 | Busca `shiftKey`, `manual` y construcción de `MouseEvent`; no ejecuta el gesto ni verifica la llamada resultante. |
| [special-roll.test.js](../tests/special-roll.test.js) | 3 | Busca botones, llamadas y un ternario concreto; no ejecuta la configuración ni la incorporación al concurso. |
| [combat-sheet-preferences.test.js](../tests/combat-sheet-preferences.test.js) | 1 | Ejecuta el ordenado de alternativas de ataque. Protege el resultado sin fijar el algoritmo. |
| [tactical-overview-names.test.js](../tests/tactical-overview-names.test.js) | 1 | Ejecuta el renderizador con personajes y tokens PNJ y comprueba el HTML generado; no solo el código fuente. |
| [inventory-sheet.test.js](../tests/inventory-sheet.test.js) | 2 | Ejecuta el filtrado de armas naturales y mixtas. Casos de comportamiento relevantes. |

No es una auditoría de todos los tests estáticos del repositorio. En particular,
no se han revisado exhaustivamente las comprobaciones de interfaz contenidas
en otros archivos de combate, catálogos o configuración.

## Evidencia comprobada sin modificar archivos

Se ejecutaron los 23 callbacks síncronos de `style-standards.test.js` con un
lector de archivos sustituido en memoria. Se mantuvieron `node:assert/strict`
y los cuerpos originales de los casos. El lector real sirvió de control y cada
variación se ejecutó aisladamente. No se abrió Foundry ni se renderizó CSS.

| Lectura proporcionada a los casos | Resultado | Interpretación |
| --- | --- | --- |
| Archivos originales | 23 aprobados | Control del procedimiento. |
| CSS entero dentro de un comentario, neutralizando primero los cierres de comentario internos | 23 aprobados | Las búsquedas encuentran texto aunque ninguna regla CSS esté activa. |
| Sustituir las cuatro apariciones de `color: #a1241b !important` por `color:  #a1241b !important` | 22 aprobados, 1 fallo | Dos espacios conservan el CSS, pero falla «el diálogo de tirada separa origen, efecto y dificultad final». |
| En AGENTS, sustituir «Superficie estándar de papel» por «Superficie común de papel» | 22 aprobados, 1 fallo | Falla «la superficie compartida queda registrada como estándar visual» sin cambiar la instrucción sustantiva. |

Una primera variación que cambió solo la primera aparición del color pasó los
23 casos; la coincidencia requerida seguía presente en otra regla. Esto refuerza
la necesidad de no interpretar la presencia global de un fragmento como prueba
de que está aplicado al elemento correcto.

## Hallazgos y valoración

1. **La ejecución completa es barata en este entorno.** Esta medición no
   justifica reducir la suite por duración. El riesgo identificado es el coste
   de mantener comprobaciones que no representan bien el comportamiento.
2. **Las pruebas CSS ofrecen una garantía limitada.** Las búsquedas no resuelven
   cascada, selectores aplicables, reglas inactivas, dimensiones o desbordamiento.
   Por ejemplo, los colores en `style-standards` y los anchos exactos del menú
   táctico pueden existir sin determinar la apariencia final.
3. **Hay dependencias innecesarias de escritura.** Los espacios exactos, el
   orden de clases, nombres de variables y frases de AGENTS generan posibles
   falsas alarmas. También se fija `TOOLTIP_DELAY_MS = 1100`, aunque el estándar
   establece más de un segundo, y un radio exacto de `0.45rem` para las pestañas.
4. **Algunos títulos prometen más de lo que ejercitan.** Buscar la expresión de
   permisos no comprueba sus distintas combinaciones; encontrar `shiftKey` no
   demuestra su propagación; encontrar llamadas de Suerte o pasiones no prueba
   que se ejecuten correctamente. Son objetivos importantes con evidencia débil.
5. **Sí hay contratos estructurales que merece la pena proteger.** Botones con
   acciones públicas, tablas semánticas, disponibilidad en ambas hojas y uso del
   hook compatible tienen un propósito concreto. Revisar su mecanismo no implica
   desechar ese propósito. El chequeo de una frase de AGENTS tiene menor valor
   funcional que esos contratos.
6. **No todas las regex son el problema.** El caso de nombres tácticos busca
   contenido en HTML producido por una función real con datos concretos. Esa
   comprobación protege un resultado observable y admite cambiar la implementación.

La clasificación posterior concreta las recomendaciones para estos 53 casos.
Las correcciones de este alcance ya están implementadas; véase el cierre del
paso 5 en la clasificación. La medición de referencia anterior se conserva como
resultado histórico, no como resultado de la suite actual.
