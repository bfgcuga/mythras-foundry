# Guía visual de las hojas de Mythras Foundry

Estas reglas se aplican a todas las hojas, pestañas, parciales y diálogos del sistema. Antes de crear estilos locales, se deben reutilizar las variables y componentes compartidos de `styles/mythras-foundry.css`.

## Paleta y superficies

- Fondo principal: `--mythras-paper` (`#dfcda8`).
- Superficie estándar de papel: combina `--mythras-paper-overlay` y `--mythras-paper-texture` sobre `--mythras-paper`. Se aplica a todas las hojas del sistema y a los mensajes que contienen `mythras-chat-card`.
- Toda hoja de documento —personaje, PNJ y objeto— incluye la clase `mythras-paper-sheet`; no se crean hojas con una superficie de ventana diferente.
- Fondo de panel: `--mythras-panel` (`rgba(255, 249, 226, 0.42)`).
- Texto: `--mythras-ink` (`#302e2a`).
- Acento: `--mythras-accent` (`#3d3933`).
- Bordes: `--mythras-border` (`#9c8766`).
- No usar fondos grises heredados de Foundry en controles de las hojas.
- El color del usuario o del tipo de mensaje de Foundry no sustituye la superficie de papel de los mensajes del sistema. Los colores semánticos se reservan para resultados, avisos y estados internos de la tarjeta.

## Campos editables y de solo lectura

- Los campos editables no tienen color de fondo: `input`, `select` y `textarea` son transparentes y se distinguen del papel mediante el borde compartido. La clase `sheet-field-editable` conserva este mismo tratamiento y nunca introduce una superficie coloreada.
- Los valores de solo lectura usan `sheet-field-readonly`, sin color de fondo o con fondo transparente para integrarse visualmente con `--mythras-paper`.
- No usar fondos de panel, tarjetas o colores alternativos para distinguir valores de solo lectura equivalentes.
- Una misma clase debe conservar el mismo significado en encabezados, formularios, tablas y pestañas: la apariencia nunca debe depender de que el valor sea un `input`, `output` o `span`.
- Los bordes, subrayados o formas especiales pueden expresar la función del dato, pero no deben contradecir la distinción de superficie entre editable y solo lectura.

## Tipografía de datos

- Las tablas, sus cabeceras, sus valores y sus controles usan `--mythras-font-size-table` (`0.8rem`). Una misma tabla no reduce por separado encabezados, selectores o filas.
- Los subtítulos que separan bloques dentro de un panel usan `--mythras-font-size-section` (`0.9rem`).
- `--mythras-font-size-auxiliary` (`0.72rem`) se reserva para notas, ayudas o metadatos secundarios; no se usa para información operativa ni para hacer que una tabla entre.
- Si una tabla no cabe al tamaño normal de la hoja, se ajustan primero la cuadrícula, los espacios y el reparto de columnas. No se reduce la tipografía de forma local para evitar el desbordamiento.

## Valores penalizados

- Un valor afectado por una penalización muestra primero su valor base sin modificar y, únicamente si cambia, el valor efectivo entre paréntesis inmediatamente después.
- El contenedor usa `penalized-value` y el valor entre paréntesis usa `penalized-value-modifier`, que lo identifica en rojo sin reducir su tamaño de letra.
- Este patrón se aplica por igual a porcentajes, atributos derivados, recursos máximos y cualquier otro valor operativo. No se sustituye el valor base ni se muestra el paréntesis cuando ambos valores coinciden.
- Los valores base y efectivos proceden de ayudantes puros compartidos; la plantilla solo decide si representa el modificador.

## Botones con iconos

- Acciones integradas en filas —tirar, equipar, eliminar y similares— usan `sheet-icon-button`. Su fondo es transparente.
- La acción de añadir dentro de un panel usa `sheet-add-button`, es circular y emplea el fondo `--mythras-paper`.
- Añadir siempre se representa con `<i class="fas fa-plus" aria-hidden="true"></i>`; no usar un carácter `+` suelto.
- Eliminar se representa con `fas fa-trash`; no usar `×` cuando la acción sea un botón de icono.
- Todo botón de icono debe tener `aria-label`; si su significado puede no ser evidente, también `title`.
- Las clases funcionales (`combat-panel-add`, `skill-group-add`, etc.) pueden acompañar a las clases compartidas, pero no deben redefinir colores, fondo, borde o iconografía.
- Todos los botones deben proporcionar un tooltip descriptivo mediante `title`, `aria-label` o texto visible. El sistema lo muestra tras mantener el puntero durante más de un segundo; no crear tooltips locales con otro retardo o apariencia.

## Coherencia entre pestañas

- Una misma acción debe conservar icono, clase visual, estado hover y significado en Character, Combate e Inventario.
- Los estilos específicos de una pestaña se limitan a colocación, dimensiones o distribución. La apariencia común vive en las clases compartidas.
- Los estados activos se indican preferentemente mediante color, opacidad o el propio icono, manteniendo transparente el fondo de los botones integrados.
- Los controles de equipación usan `equipment-state-toggle`: atenuados cuando están inactivos y a opacidad completa cuando están equipados. El icono debe representar el objeto (`fas fa-hand` para manos, `fas fa-vest` para armadura), nunca un check genérico.
- Cuando una misma colección se gestiona desde Inventario y otra pestaña operativa, ambas vistas deben ofrecer el mismo control de equipación y mostrar el conjunto completo; el estado equipado filtra efectos y cálculos, no la visibilidad del objeto.

## Selectores compactos de estado

- Los estados booleanos o las alternativas mutuamente excluyentes que se presentan como una casilla compacta usan la clase compartida `sheet-state-box`.
- `sheet-state-box` conserva el recuadro, la marca interior, el foco y los colores empleados por «Entrenado» y «Pifia», tanto sobre `checkbox` como sobre `radio`.
- Cuando solo puede elegirse una opción de una lista se usa semánticamente `input type="radio"` con un mismo `name`; la apariencia cuadrada no debe sustituir esa semántica.
- Cada selector debe tener una etiqueta visible asociada o un `aria-label` localizado.

## Paneles y recuadros

- El recuadro estándar es un `fieldset` con un `legend` como hijo directo.
- El `legend` contiene únicamente el título, queda centrado y abre de forma nativa un hueco en la línea superior del marco.
- No simular este patrón mediante un encabezado separado y bordes parciales en elementos consecutivos.
- Los paneles reutilizan los estilos globales de `fieldset` y `legend`; las clases locales solo ajustan distribución o espaciado.
- Si el panel permite añadir elementos, el botón `sheet-add-button` se coloca en la esquina superior derecha sin desplazar el `legend`.
- Las hojas de Item y sus asistentes de creación siguen el tratamiento visual de la hoja de arma: recuadros de un píxel, discretos y transparentes, sin una superficie propia sobre el papel.

## Mensajes de chat

- Los mensajes usan `mythras-chat-card`, con un título `mythras-chat-title` ligeramente mayor y separado por una línea horizontal, sin subrayado adicional.
- Bonificaciones, penalizaciones, objetivos, tiradas y recursos se muestran en filas `mythras-chat-row` con una etiqueta explícita; nunca se presentan números sin indicar qué representan.
- Todas las tiradas usan el mismo patrón: una fila etiquetada con el tipo de tirada y su fórmula entre paréntesis, seguida del resultado. No se mezclan tarjetas con representaciones automáticas de dados diferentes.
- El valor obtenido directamente de los dados usa `mythras-chat-roll-value`: únicamente el valor de la derecha aparece dentro de un recuadro compacto. Los modificadores y bonificaciones, siempre etiquetados y con signo, no usan ese recuadro.
- Los resultados de tiradas usan estados cromáticos compartidos: verde discreto para éxito, rojo discreto para fallo y variantes más saturadas para crítico y pifia. Debajo se muestran los rangos aplicados de crítico y pifia como leyenda auxiliar.
- Los datos relacionados se separan mediante filas y espacios visuales, no como una frase continua.
- El resultado o total operativo usa `mythras-chat-total`, con borde y valor en negrita.
- Las tarjetas interactivas de combate conservan sus controles, pero siguen la misma jerarquía de título, desglose etiquetado y total destacado.

## Implementación

- Variables de tema y componentes compartidos se definen una sola vez en `styles/mythras-foundry.css`.
- Los diálogos de tirada enumeran por separado cada modificador y su procedencia: el origen conserva `--mythras-ink`, las penalizaciones se muestran en rojo y los bonificadores en verde. La dificultad combinada se presenta después en un recuadro independiente.
- Al final del diálogo se muestra el valor propio de la habilidad y, solo cuando cambia, el objetivo final calculado inmediatamente después entre paréntesis; el objetivo es rojo si disminuye y verde si aumenta.
- Antes de añadir CSS, comprobar si el patrón ya existe. Si será usado en dos o más lugares, crear o ampliar una clase compartida.
- Las nuevas vistas deben usar elementos semánticos, textos localizados y controles accesibles.
- Los valores derivados que aparecen en una hoja y participan en reglas deben proceder del mismo ayudante puro. No duplicar cálculos entre la preparación de contexto, plantillas y resolución de combate.
- En celdas de tabla con altura disponible, priorizar texto multilínea mediante `overflow-wrap` y `white-space: normal`. Si el contenido variable aún desborda, puede aplicarse ajuste progresivo de fuente con un mínimo legible; no truncar con elipsis por defecto cuando la fila admite varias líneas.
- Encabezados y valores de una tabla deben compartir exactamente la misma cuadrícula y alineación. Los iconos auxiliares se posicionan fuera del flujo cuando puedan desplazar visualmente el dato principal de su columna.
- En listas y tablas de inventario, la acción de eliminar ocupa siempre la última columna y queda alineada al extremo derecho, independientemente de las columnas opcionales del tipo de Item.

## Publicación de versiones

- En este repositorio, «publicar» significa completar el flujo hasta crear y subir la etiqueta de versión; subir únicamente los commits a `main` no publica una versión instalable.
- La publicación se realiza con Git, directamente sobre `main`, sin depender de GitHub CLI ni de la creación de un pull request.
- Antes de publicar, comprobar que el árbol de trabajo contiene únicamente los cambios previstos, ejecutar todos los tests y validar el proyecto. Los archivos ajenos al alcance no se incorporan al commit sin autorización.
- Incrementar la versión de parche de `system.json` y actualizar en el mismo cambio la versión incluida en la URL `download`.
- La etiqueta sigue el formato `v<versión>`, por ejemplo `v0.0.100`, y debe coincidir exactamente con la versión declarada en `system.json`.
- Validar explícitamente la versión mediante `node scripts/dev/validate-project.mjs v<versión>` antes de crear la etiqueta.
- Crear un commit para el cambio de versión y subir primero `main` a `origin`.
- Verificar que la etiqueta no exista ni local ni remotamente. Después crear una etiqueta anotada sobre el commit de versión y subirla a `origin`.
- El orden esperado es: tests, validación, actualización de `system.json`, commit, `git push origin main`, `git tag -a v<versión> -m "Mythras Foundry <versión>"` y `git push origin v<versión>`.
- La subida de la etiqueta activa `.github/workflows/release.yml`, que crea la release y adjunta `system.json` y `mythras-foundry.zip`.
- Al finalizar, informar de la versión, el commit y la etiqueta publicados. No afirmar que la release terminó correctamente solo porque se subió la etiqueta; si es necesario confirmar el resultado, comprobar el workflow o la release por separado.

# Mantenimiento del contexto y la documentación del proyecto

El repositorio debe actuar como la memoria persistente del proyecto. No depender de conversaciones anteriores para conocer decisiones, convenciones, estado o próximos pasos.

La arquitectura, las capas del repositorio y sus fuentes de verdad se documentan en `docs/architecture.md`. El estado funcional, los comandos de desarrollo y la API pública se resumen en `README.md`.

Al finalizar cada tarea, evaluar siempre si la implementación ha cambiado información que deba quedar disponible para futuras sesiones de trabajo.

## Actualización de AGENTS.md

Actualizar `AGENTS.md` únicamente cuando cambie información permanente o de larga duración, como:

- reglas generales de desarrollo;
- convenciones del proyecto;
- estructura relevante del repositorio;
- stack tecnológico;
- restricciones importantes;
- procedimientos habituales de ejecución, pruebas, compilación o despliegue;
- instrucciones que futuros agentes deban conocer antes de trabajar.

No utilizar `AGENTS.md` como diario de desarrollo.

No añadir a `AGENTS.md`:

- cada funcionalidad terminada;
- cada bug corregido;
- cambios triviales;
- decisiones temporales;
- detalles que puedan deducirse fácilmente del código;
- transcripciones o resúmenes extensos de conversaciones anteriores.

## Documentación complementaria

Cuando el proyecto disponga de documentación específica, actualizar el archivo correspondiente en lugar de acumular toda la información en `AGENTS.md`.

Por ejemplo:

- arquitectura y decisiones técnicas → documentación de arquitectura;
- modelo de datos → documentación del modelo de datos;
- funcionalidades terminadas, estado y próximos pasos → roadmap o documento de estado;
- procedimientos específicos → documentación técnica correspondiente.

Si esos documentos no existen y la información será importante para futuras sesiones, valorar crear un archivo apropiado dentro de `docs/`.

## Al comenzar una tarea

Antes de modificar código:

1. Leer este `AGENTS.md`.
2. Inspeccionar el estado actual del código relacionado con la tarea.
3. Consultar únicamente la documentación necesaria.
4. No asumir que una conversación anterior refleja el estado actual del repositorio.
5. Limitar la inspección al área relevante siempre que sea posible, evitando recorrer innecesariamente todo el proyecto.

La fuente de verdad es el estado actual del repositorio y su documentación.

## Al finalizar una tarea

Antes de considerar una tarea terminada, comprobar:

- [ ] La implementación solicitada está completa.
- [ ] Se han realizado las pruebas o comprobaciones relevantes disponibles.
- [ ] Se ha revisado el diff para evitar cambios accidentales o no relacionados.
- [ ] Se ha evaluado si `AGENTS.md` necesita actualización.
- [ ] Se ha evaluado si alguna documentación técnica necesita actualización.
- [ ] Se ha actualizado el roadmap o documento de estado si ha cambiado el progreso del proyecto.
- [ ] Se ha eliminado o corregido información que haya quedado obsoleta.
- [ ] La documentación describe el estado actual, no una intención anterior ya superada.

Esta revisión debe realizarse aunque finalmente no sea necesario modificar ningún archivo de documentación.

## Gestión eficiente del contexto

Para reducir consumo de contexto y trabajo repetido:

- mantener la documentación breve y actual;
- evitar duplicar la misma información en varios archivos;
- documentar decisiones importantes cuando se toman;
- no conservar explicaciones históricas que ya no sean necesarias para trabajar;
- no volver a investigar áreas del proyecto que ya estén documentadas de forma suficiente;
- inspeccionar solo los archivos relevantes para cada tarea;
- reutilizar patrones existentes antes de crear nuevas abstracciones.

Si una decisión será necesaria para realizar correctamente futuras tareas, debe quedar registrada en el repositorio.

Si una información solo explica cómo se llegó a una decisión, pero ya no es necesaria para trabajar con el estado actual del proyecto, normalmente no debe conservarse.

## Resumen al terminar

Al finalizar una tarea, proporcionar un resumen breve indicando:

1. qué se ha cambiado;
2. qué comprobaciones se han realizado;
3. qué documentación se ha actualizado;
4. qué queda pendiente, únicamente si es relevante.

No reproducir archivos completos ni grandes bloques de código salvo que se solicite expresamente.
