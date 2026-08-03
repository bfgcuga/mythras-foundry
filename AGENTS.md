# Guía visual de las hojas de Mythras Foundry

Estas reglas se aplican a todas las hojas, pestañas, parciales y diálogos del sistema. Antes de crear estilos locales, se deben reutilizar las variables y componentes compartidos de `styles/mythras-foundry.css`.

## Paleta y superficies

- Fondo principal: `--mythras-paper` (`#dfcda8`).
- Fondo de panel: `--mythras-panel` (`rgba(255, 249, 226, 0.42)`).
- Texto: `--mythras-ink` (`#302e2a`).
- Acento: `--mythras-accent` (`#3d3933`).
- Bordes: `--mythras-border` (`#9c8766`).
- No usar fondos grises heredados de Foundry en controles de las hojas.

## Campos editables y de solo lectura

- Los campos editables usan la superficie compartida `--mythras-field-editable` mediante la clase `sheet-field-editable`; deben distinguirse claramente del papel para comunicar que aceptan entrada.
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

## Mensajes de chat

- Los mensajes usan `mythras-chat-card`, con un título `mythras-chat-title` ligeramente mayor y subrayado.
- Bonificaciones, penalizaciones, objetivos, tiradas y recursos se muestran en filas `mythras-chat-row` con una etiqueta explícita; nunca se presentan números sin indicar qué representan.
- Los datos relacionados se separan mediante filas y espacios visuales, no como una frase continua.
- El resultado o total operativo usa `mythras-chat-total`, con borde y valor en negrita.
- Las tarjetas interactivas de combate conservan sus controles, pero siguen la misma jerarquía de título, desglose etiquetado y total destacado.

## Implementación

- Variables de tema y componentes compartidos se definen una sola vez en `styles/mythras-foundry.css`.
- Antes de añadir CSS, comprobar si el patrón ya existe. Si será usado en dos o más lugares, crear o ampliar una clase compartida.
- Las nuevas vistas deben usar elementos semánticos, textos localizados y controles accesibles.
- Los valores derivados que aparecen en una hoja y participan en reglas deben proceder del mismo ayudante puro. No duplicar cálculos entre la preparación de contexto, plantillas y resolución de combate.
- En celdas de tabla con altura disponible, priorizar texto multilínea mediante `overflow-wrap` y `white-space: normal`. Si el contenido variable aún desborda, puede aplicarse ajuste progresivo de fuente con un mínimo legible; no truncar con elipsis por defecto cuando la fila admite varias líneas.
- Encabezados y valores de una tabla deben compartir exactamente la misma cuadrícula y alineación. Los iconos auxiliares se posicionan fuera del flujo cuando puedan desplazar visualmente el dato principal de su columna.
- En listas y tablas de inventario, la acción de eliminar ocupa siempre la última columna y queda alineada al extremo derecho, independientemente de las columnas opcionales del tipo de Item.
