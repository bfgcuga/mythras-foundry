# Duplicidades y clasificación de pruebas

Pasos 3 y 4 de la revisión, 5 de septiembre de 2026, sobre el commit
`b869295fae1cb86fb8d4d70535677f6b8d8ffefa`. Se clasifican individualmente los
53 casos de los 10 archivos de la [primera revisión](test-review.md).
Se contrastan además las pruebas de integridad y los casos relacionados citados
abajo. La clasificación se conserva como diagnóstico histórico; el paso 5 ya
implementa las correcciones de este alcance, con destinos y límites descritos al
final. No es una auditoría exhaustiva de todas las pruebas.

## Comparación con el validador

Se leyó completo [validate-project.mjs](../scripts/dev/validate-project.mjs).
La coincidencia de archivos leídos no implica que dos comprobaciones detecten
el mismo error.

| Área | Qué hace `check` | Qué añaden las pruebas | Decisión |
| --- | --- | --- | --- |
| Idiomas | Lee y parsea los JSON declarados. | [localization](../tests/localization.test.js) detecta colisiones al expandir claves, diferencias ES/EN, claves literales ausentes, codificación dañada y etiquetas principales incorrectas. | Conservar esas garantías. El parseo compartido es una precondición, no motivo para quitar casos. |
| Compendios | Comprueba que cada directorio declarado existe y no está vacío. | [manifest](../tests/manifest.test.js) verifica nombres, etiquetas, tipos, rutas y unicidad de rutas. | Complementarios; mejorar el caso de referencias como se explica abajo. |
| Imágenes | Lee módulos y estilos declarados; no recorre las imágenes de los objetos. | [compendium-images](../tests/compendium-images.test.js) comprueba archivos de imágenes y asignación; [item-icons](../tests/item-icons.test.js) verifica iconos predeterminados. | Mantener protección. Revisar límites de cobertura y dependencia de carpetas/cantidades. |
| JavaScript | Ejecuta `node --check` sobre `.js` y `.mjs` de `scripts/`. | Las pruebas ejercitan funciones y casos límite; importar un módulo también puede descubrir errores sintácticos. | No son equivalentes: no todos los módulos se importan en los tests y sintaxis válida no implica comportamiento correcto. |
| Estilos y plantillas | Lee el CSS declarado como archivo; no valida su cascada ni las plantillas. | Los casos revisados verifican controles, estructura o texto CSS. | Su debilidad no procede de duplicar `check`, sino de comprobar texto en lugar del resultado. |
| Publicación | Verifica URL de descarga/versionado y etiqueta opcional. | Los 53 casos revisados no cubren esas invariantes. | Mantener en `check`. |

No se ha encontrado un caso completo de los 53 que deba eliminarse porque
`check` ya cubra lo mismo. Tampoco se propone eliminar las pruebas de integridad
citadas por ese motivo. En los pasos 3 y 4 solo se compararon aserciones; la ejecución posterior
al cambio está recogida al final.

## Duplicidades y solapamientos entre pruebas

| Casos contrastados | Evidencia y alcance | Resolución propuesta |
| --- | --- | --- |
| `manifest`: nombres de contenido / referencias internas | La igualdad contra `EXPECTED_PACKS` ya garantiza los tres nombres `skills`, `cultures`, `professions`. Sin embargo, `Object.fromEntries` oculta entradas repetidas y la segunda prueba comprueba la unicidad de rutas. | Quitar solo la reiteración de los tres nombres al mejorar ese caso; conservar unicidad y añadir unicidad de nombres. **No eliminar el caso entero.** |
| `style-standards`: daño maximizado y secciones / [combat-effects](../tests/combat-effects.test.js): hoja editable | Ambos exigen que `combat-effect-sheet-description` preceda a `combat-effect-sheet-summary`. El primero añade daño maximizado, formato y CSS; el segundo añade edición y restricciones. | Fusionar la comprobación repetida del orden en el contrato de la hoja de efecto; conservar por separado la presentación de daño maximizado y las restricciones. |
| `sheet-reorganization`: acciones y vistas compartidas / `hit-location-table`: preparador y parcial compartidos | Repiten la inclusión de `combat-tab.hbs` en PNJ. Inventario, permisos anatómicos y acciones tácticas son garantías diferentes. | Consolidar solo la inclusión de parciales en un contrato común de composición de hojas. Mantener los escenarios propios. |
| `style-standards`: editables transparentes, ficha de arma, ficha de estilo y recuadros de Item | Comparten la intención de transparencia, pero buscan selectores diferentes que podrían divergir. No son duplicados exactos. | Centralizar la comprobación de superficies con variantes por tipo de hoja, preservando la cobertura específica; integrar el caso de recuadros en ese contrato. |
| `sheet-reorganization`: herida grave / [wound-consequences](../tests/wound-consequences.test.js) y [combat-wound-runtime](../tests/combat-wound-runtime.test.js) | La prueba pura ya comprueba `disableLocation` y `dropHeldItem`. El runtime solo exige que haya algún estado, consecuencia o actualización mediante un OR. No verifica exactamente todos los efectos que busca la prueba estática. | Fusionar tras fortalecer el runtime: actualización de `disabled`, aturdimiento `1d3`, selección del objeto y ausencia del estado antiguo. No borrar la estática suponiendo cobertura completa actual. |
| `special-roll`: tono del objetivo / [combat-chat](../tests/combat-chat.test.js): tonos | Comparten la regla bonus/penalty, pero prueban consumidores distintos; la segunda ejecuta `targetTone` del renderizador de combate. | Mejorar la prueba de tirada especial; la prueba del helper de combate no garantiza que el Item use el tono correcto. |
| Tirada manual desde hoja / [system-roll](../tests/system-roll.test.js) | El helper prueba Shift + DJ; la hoja debe propagar el evento a través del selector de arma. | Conservar ambas responsabilidades y mejorar la prueba de propagación. No son duplicadas. |
| Menú táctico / [engagement-runtime](../tests/engagement-runtime.test.js) | Persistir la retirada de una relación no garantiza que el menú deje de ofrecerla; mostrar botones no garantiza que activen la operación correcta. | Mejorar la prueba del menú con escenarios de renderizado y acciones; conservar los tests del servicio. |
| Familiaridad en `style-standards` / `localization` | El escáner de localización comprueba claves literales completas; `MYTHRASF.Familiarity.${key}` se construye dinámicamente. | Conservar la comprobación explícita de esas claves al mejorar el caso. No asumir cobertura por el escáner. |

Se comprobó en memoria el ejemplo del manifiesto: añadir una copia del primer
compendio deja idéntico el resultado de `Object.fromEntries`, pero hace fallar
la condición de unicidad de rutas. Es evidencia de solapamiento parcial, no de
redundancia completa. No se alteró `system.json`.

## Criterios de clasificación

- **Conservar:** protege un resultado relevante con evidencia suficiente para
  esta revisión; no implica cobertura exhaustiva de todos los límites.
- **Mejorar:** mantener el objetivo y sustituir aserciones de escritura o
  presencia global por datos, HTML generado, eventos o estilos aplicados, según
  corresponda. No exige introducir una plataforma visual completa.
- **Fusionar:** integrar las partes solapadas en el destino indicado,
  conservando los escenarios únicos. No significa crear un test monolítico ni
  eliminar antes de que exista cobertura equivalente.
- **Eliminar:** retirar el caso sin reemplazo funcional porque no protege un
  comportamiento del producto ni un contrato técnico necesario.

El uso de regex no determina la clasificación: buscar contenido en HTML
realmente generado puede ser útil; buscar una frase en el código no demuestra
que se ejecute. Las recomendaciones CSS deben evitar tanto pasar con reglas
comentadas como fallar por espacios equivalentes. Los cambios puramente
estéticos sin contrato estable pueden quedar en revisión visual.

## Clasificación individual de los 53 casos

Los números corresponden al orden de los casos en cada archivo en este commit.
Cada fila incluye la descripción original y una recomendación principal.

### style-standards.test.js

[Código](../tests/style-standards.test.js)

| Caso | Clasificación | Motivo y destino |
| --- | --- | --- |
| 1. hojas y mensajes Mythras comparten la superficie de papel | Mejorar | Verificar clases de ventana y superficie aplicable por documento; no la mera presencia en archivos. |
| 2. los diálogos Mythras aplican la superficie de papel a la ventana completa | Mejorar | Ejecutar el hook con un diálogo y comprobar las clases de su ventana, sin fijar sintaxis de optional chaining. |
| 3. la suerte simple es repetible y usa el personaje participante del grupo activo | Mejorar | Ejercitar usos repetidos de Suerte y selección de pagador; mover esta garantía al dominio de tiradas. |
| 4. el diálogo de tirada separa origen, efecto y dificultad final | Mejorar | Comprobar desglose y objetivo generado para aumento, reducción e igualdad; colores sin exigir espacios o frases de AGENTS. |
| 5. el ataque reutiliza los ajustes porcentuales sin configurar un concurso | Mejorar | Ejercitar configuración y cancelación; comprobar que cancelar no consume PA. Separar del test de apariencia. |
| 6. el daño maximizado se identifica y la hoja de efecto apila sus secciones | Fusionar | Orden de secciones: integrar en combat-effects, hoja editable. Conservar daño maximizado y su marcador en una prueba de presentación de daño. |
| 7. la familiaridad de combate muestra descriptores localizados y solo penaliza cuando procede | Mejorar | Conservar claves dinámicas de familiaridad; comprobar cuándo aparece penalización, sin exigir la redacción «sin penalización». |
| 8. la superficie compartida queda registrada como estándar visual | Eliminar | Solo exige tres fragmentos de prosa de AGENTS. La revisión de documentación cubre ese propósito; no protege ejecución ni presentación. |
| 9. todos los campos editables son transparentes y el estándar prohíbe fondos coloreados | Mejorar | Comprobar superficies de controles representativos; integrar variantes de Item del caso 23. Eliminar requisitos de prosa y formato CSS. |
| 10. todos los atributos derivados ofrecen el tooltip retrasado compartido | Mejorar | Comprobar atributos con tooltip y retardo mayor de un segundo; no imponer nombre de constante o exactamente 1100 ms. |
| 11. los cuatro métodos de características comparten fila y libre usa campos editables | Mejorar | Comprobar métodos disponibles y campos editables/límites; permitir CSS y orden de clases equivalentes. |
| 12. catálogo e inventario alinean cabeceras y filas con la misma cuadrícula | Mejorar | Verificar alineación compartida por tabla, evitando exigir selectores contiguos y saltos de línea concretos. |
| 13. la pestaña de penalizaciones usa una tabla semántica y tipografía compartida | Mejorar | Separar tabla semántica y controles de estado de registro/hooks; ejecutar los comportamientos de estado con sus dependencias. |
| 14. la ficha de arma separa modos por tipo y expone parámetros de rasgo | Mejorar | Verificar campos visibles por modo y parámetros de rasgos; compartir la garantía de transparencia sin perder la variante arma. |
| 15. la ficha de arma envía una sola moneda y combate muestra los PG actuales | Mejorar | Comprobar formulario de arma renderizado y dato actual de PG en filas; no extraer secciones mediante límites textuales frágiles. |
| 16. las acciones de modo y rasgo son distintas y la durabilidad natural se explica | Mejorar | Comprobar acciones diferenciadas y ayuda de durabilidad, sin fijar orden de clases o permitir coincidencias fuera del control. |
| 17. la configuración de arma separa ejemplar y situación del personaje | Mejorar | Verificar agrupación de campos de ejemplar y situación en el formulario generado. |
| 18. la ficha de estilo resume asociaciones y separa el cálculo no editable | Mejorar | Verificar resumen, cálculo readonly y datos aceptados; no fijar el texto de super.defineSchema. |
| 19. el asistente crea o importa estilos y delega armas y rasgos en su hoja | Mejorar | Ejercitar crear/importar/editar y sincronización de estilos, preservando rasgos; no delimitar métodos por sus nombres privados. |
| 20. los mensajes de chat usan exclusivamente el hook HTML compatible | Mejorar | Registrar hooks con un doble y comprobar evento HTML y callback, sin imponer escritura literal de Hooks.on. |
| 21. equipo inicial y pasiones respetan asociaciones y cuadrículas compartidas | Mejorar | Separar compatibilidad de equipo con modos y presentación de pasiones; retirar el requisito de anchura exacta 720. |
| 22. las pasiones validadas se materializan durante el asistente | Mejorar | Ejercitar sincronización de pasiones por fase y revisión; verificar Items resultantes en vez de nombres de métodos privados. |
| 23. las hojas de Item y el creador usan recuadros discretos sin superficie propia | Fusionar | Integrar transparencias y fieldsets de Item/creador en el contrato del caso 9, con variantes específicas; conservar el marco discreto. |

### sheet-reorganization.test.js

[Código](../tests/sheet-reorganization.test.js)

| Caso | Clasificación | Motivo y destino |
| --- | --- | --- |
| 1. las acciones tácticas permanecen reunidas y visibles en ambas hojas | Mejorar | Verificar acciones en el panel generado; compartir la inclusión de parciales con el caso 2, manteniendo la ubicación táctica. |
| 2. personaje y PNJ comparten Combate e Inventario | Fusionar | Consolidar inclusión de parciales con hit-location-table caso 1. Mantener Inventario, moneda y acciones como escenarios propios; no fijar constructores. |
| 3. Combate de personaje conserva el orden operativo de sus paneles | Mejorar | Comprobar el orden operativo requerido, permitiendo implementarlo con otra cuadrícula. |
| 4. todas las navegaciones usan pestañas elevadas con superficie activa | Mejorar | Verificar estado activo/inactivo y contrato de pestañas; el radio exacto 0.45rem no es requisito estable. |
| 5. los encabezados oscuros conservan contraste propio en campos, líneas y botones | Mejorar | Comprobar colores aplicados a encabezado y controles; la mera declaración de variables no prueba contraste. |
| 6. Estado contiene Fatiga y Combate ya no la duplica | Mejorar | Verificar una sola representación de Fatiga en Estado en ambas hojas, mediante composición/renderizado. |
| 7. Trasfondo, lesión permanente y silueta canónica quedan modelados | Mejorar | Separar datos narrativos, lesión y silueta; validar esquema/datos y controles sin imponer texto del constructor. |
| 8. la orientación frontal refleja las localizaciones laterales de la silueta | Conservar | Ejecuta la conversión frontal/posterior y comprueba lados y cabeza. |
| 9. las consecuencias narrativas distinguen herida grave y miembro inutilizable | Conservar | Distingue lesiones graves y localizaciones inutilizadas con datos concretos. |
| 10. la consulta de heridas no descarta tiradas mediante una clasificación física | Conservar | Ejecuta el diálogo y comprueba que una habilidad no física también recibe la consulta de herida. |
| 11. una herida grave inutiliza la localización sin reutilizar Aturdir Localización | Fusionar | Integrar en wound-consequences/combat-wound-runtime: fortalecer actualización y estados exactos antes de retirar las búsquedas estáticas. |

### tactical-overview-ui.test.js

[Código](../tests/tactical-overview-ui.test.js)

| Caso | Clasificación | Motivo y destino |
| --- | --- | --- |
| 1. el menú táctico filtra armas y mantiene sus acciones dentro de la ventana | Mejorar | Dividir escenarios de filtrado, permisos y acciones; ejecutar renderizador/controlador. Retirar anchura 960 y sintaxis exacta de listeners. |
| 2. las tablas tácticas conservan el contenido transparente y destacan sus cabeceras | Mejorar | Verificar transparencia y cabeceras por elemento; porcentajes 18/24 no son contrato general. No confundir con transparencia de otras hojas. |

### hit-location-table.test.js

[Código](../tests/hit-location-table.test.js)

| Caso | Clasificación | Motivo y destino |
| --- | --- | --- |
| 1. personaje y PNJ consumen un único preparador y un único parcial de localizaciones | Mejorar | Contrato común con sheet-reorganization caso 2; conservar permisos anatómicos y edición por tipo de Actor con resultados observables. |
| 2. las referencias de localización rotas reciben el indicador visual compartido | Mejorar | Renderizar referencia válida/rota en cada vista y comprobar indicador/ayuda solo cuando corresponda. |
| 3. restaurar anatomía humana conserva la herida permanente reconocible | Conservar | Comprueba preservación de lesión permanente, PG, descripción y estado al restaurar anatomía. |
| 4. detecta armaduras y armas que apuntan a IDs de localización borrados | Conservar | Distingue referencias borradas de armaduras, armas naturales y armas independientes. |
| 5. el esquema permite nombres personalizados sin clave traducible | Mejorar | Validar un nombre personalizado y nameKey vacío mediante el esquema, no una regex que puede alcanzar otro StringField. |
| 6. d20 y Localización alinean igual sus cabeceras y datos | Mejorar | Conservar esta variante de alineación d20/localización: no duplica la alineación de catálogo/inventario, que tiene otras columnas. |
| 7. el preparador común resuelve estados, armadura y bloqueo pasivo | Conservar | Ejecuta preparación de armadura, bloqueo, estado y exceso de PG. |
| 8. el preparador presenta el nombre localizado de la localización | Conservar | Comprueba traducción del nombre mostrado sin modificar el documento fuente. |

### character-gallery.test.js

[Código](../tests/character-gallery.test.js)

| Caso | Clasificación | Motivo y destino |
| --- | --- | --- |
| 1. la galería de personaje usa datos estructurados y un parcial reutilizable | Mejorar | Conservar esquema, parcial y acciones; probar datos y HTML generado. No afirmar que se han probado las operaciones de galería por encontrar botones. |

### combat-sheet-manual-roll.test.js

[Código](../tests/combat-sheet-manual-roll.test.js)

| Caso | Clasificación | Motivo y destino |
| --- | --- | --- |
| 1. el selector general de ataque conserva Shift al lanzar el arma elegida | Mejorar | Ejercitar Shift a través del selector de arma y verificar la opción recibida por la tirada; system-roll no cubre esta propagación. |

### special-roll.test.js

[Código](../tests/special-roll.test.js)

| Caso | Clasificación | Motivo y destino |
| --- | --- | --- |
| 1. character and NPC skill tabs expose the Special roll | Mejorar | Comprobar disponibilidad en ambas hojas y propagación de Shift mediante renderizado y eventos. |
| 2. Special rolls accept a name and percentage and can enter a contest | Mejorar | Ejecutar configuración con nombre/porcentaje y entrada al concurso; conservar cancelación y valores transmitidos. |
| 3. a higher effective target is rendered as a bonus | Mejorar | Comprobar tono en salida del consumidor Item para aumento, reducción e igualdad; el helper de combate no sustituye esta cobertura. |

### combat-sheet-preferences.test.js

[Código](../tests/combat-sheet-preferences.test.js)

| Caso | Clasificación | Motivo y destino |
| --- | --- | --- |
| 1. el ataque propone primero el arma y conserva el escudo como alternativa | Conservar | Comprueba orden de preferencias conservando escudo y arco; no fija el algoritmo. |

### tactical-overview-names.test.js

[Código](../tests/tactical-overview-names.test.js)

| Caso | Clasificación | Motivo y destino |
| --- | --- | --- |
| 1. el menú táctico resuelve personajes y PNJ con los nombres compartidos | Conservar | Ejecuta HTML de personajes y tokens PNJ, comprueba nombres efectivos y referencia de alcance. |

### inventory-sheet.test.js

[Código](../tests/inventory-sheet.test.js)

| Caso | Clasificación | Motivo y destino |
| --- | --- | --- |
| 1. las armas íntegramente naturales no forman parte del inventario | Conservar | Ejecuta exclusión de armas naturales y preservación de la manufacturada. |
| 2. un arma con algún modo manufacturado permanece en el inventario | Conservar | Comprueba la excepción de armas con modos mixtos; no está cubierta por el caso anterior. |

## Balance

Conservar: **11** · Mejorar: **37** · Fusionar: **4** · Eliminar: **1**. Total: **53 casos**.

Estas cifras clasifican casos existentes; no predicen cuántas pruebas quedarían después de dividir escenarios o fusionar contratos. Solo se propone eliminar sin reemplazo el caso que exige frases de AGENTS. Las fusiones requieren conservar primero sus garantías únicas.

## Observaciones adicionales de integridad

- `manifest`: conservar el caso del catálogo esperado; mejorar el de referencias eliminando los tres nombres reiterados, manteniendo unicidad de rutas y comprobando además nombres únicos. Eliminarlo completo perdería una garantía.
- `localization`: conservar colisiones (ambos idiomas), paridad, claves usadas, codificación y etiquetas principales. Las etiquetas exactas representan vocabulario visible del producto, a diferencia de una frase explicativa de AGENTS.
- `compendium-images`: mejorar los tres casos de existencia para enumerar la cobertura prevista sin depender innecesariamente de conteos fijos o carpetas. El caso de iconos genéricos identifica «personalizado» por una carpeta concreta: mejorar ese criterio conservando la garantía de ilustración. `check` no sustituye ninguno.
- `item-icons`: mejorar la lista de tipos comprobados para contrastarla con los tipos realmente registrados y comprobar los recursos locales correspondientes; la lista actual no incluye `combatEffect`. Mantener los iconos distintos que tienen significado funcional.

Estas observaciones adicionales no se incluyen en el balance de 53 casos. No se ha clasificado de forma exhaustiva cada caso de los archivos usados como contraste.

## Verificación del diagnóstico

Se contrastaron fuentes y aserciones, se comprobó en memoria el contraejemplo del manifiesto y se verificaron las 53 correspondencias entre títulos y decisiones. Se revisaron enlaces locales y el diff de documentación. La ejecución funcional de referencia sigue siendo la del informe anterior; no se presenta como una ejecución nueva.

La implementación se completó en el paso 5 descrito a continuación. El roadmap
funcional y AGENTS no cambian: continúa siendo obligatoria la suite completa
antes de publicar.

## Paso 5: correcciones implementadas

Se han aplicado las decisiones de los 53 casos revisados y las observaciones
adicionales de integridad. Las 11 pruebas clasificadas para conservar mantienen
sus escenarios. Se elimina sin reemplazo la exigencia de frases de AGENTS;
las fusiones conservan sus garantías en los destinos siguientes.

| Contrato original | Destino actual y evidencia |
| --- | --- |
| Superficies, controles transparentes, recuadros, pestañas, cabeceras, cuadrículas y tipografía | [style-standards](../tests/style-standards.test.js): estilos sobre elementos de DOM y declaraciones CSS activas. Incluye un contraejemplo con todo el CSS comentado y una variante de espaciado equivalente. |
| Composición Character/PNJ, acciones, Fatiga, orden, campos libres, permisos, PG, modos/rasgos, moneda, referencias rotas y hoja de efecto | [sheet-ui](../tests/sheet-ui.test.js): compila las plantillas reales y consulta controles y tablas. El orden descripción/resumen queda aquí; se retira su repetición de `combat-effects`. |
| Ventanas, registro del hook HTML, tooltips retrasados, metadatos de modelos y preparación de permisos | [ui-host](../tests/ui-host.test.js): ejecuta registro, eventos con reloj simulado, `defineSchema` y `_prepareContext`. |
| Suerte repetible y elección del participante autorizado | [skill-roll-chat-ui](../tests/skill-roll-chat-ui.test.js): dos inversiones, gasto y exclusión por grupo/propiedad. |
| Ajustes del ataque, cancelación sin gasto y familiaridad | [roll-dialog-ui](../tests/roll-dialog-ui.test.js): HTML del diálogo, cambios de dificultad, callback de cancelación y claves dinámicas. |
| Marcador de daño maximizado | [combat-damage-display](../tests/combat-damage-display.test.js): tarjeta generada con y sin dados maximizados. |
| Herida grave sin estado antiguo | [combat-wound-runtime](../tests/combat-wound-runtime.test.js): exige conjuntamente aturdimiento `1d3`, localización inutilizada y elección del objeto; sustituye el OR permisivo. |
| Crear, editar/importar estilos y materializar/revisar pasiones | [background-sheet-ui](../tests/background-sheet-ui.test.js): acciones de la hoja, Items resultantes, conservación de perfiles/rasgos y ausencia de duplicados. |
| Equipo inicial compatible con modos y estilos | [starting-equipment](../tests/starting-equipment.test.js): perfil heredado, segundo modo compatible, clase simple, dotación y ausencia de estilos. El filtro se extrae sin cambiar su comportamiento y la hoja consume ese helper. |
| Galería y gesto manual | [character-gallery](../tests/character-gallery.test.js) y [combat-sheet-manual-roll](../tests/combat-sheet-manual-roll.test.js): añadir/ver/eliminar imágenes y transmisión de Shift a través del selector de arma. |
| Tirada especial y tono del objetivo | [special-roll](../tests/special-roll.test.js): botones en ambas hojas, Shift, configuración, concurso, cancelación y salida del Item para aumento/reducción/igualdad. |
| Situación táctica | [tactical-overview-ui](../tests/tactical-overview-ui.test.js): filtrado, permisos DJ/propietario/observador y retirada de una relación con actualización del menú. |
| Integridad | `manifest` conserva el catálogo esperado y exige nombres/rutas únicos; `compendium-images` recorre todos los recursos y distingue ilustración de icono predeterminado sin fijar carpetas ni cantidades; `item-icons` contrasta con el registro real, incluido `combatEffect`. |

### Infraestructura y límites

Se añaden Handlebars, jsdom y PostCSS como dependencias de desarrollo. Node
24.19 o posterior permite usar la API vigente de mocks de módulos; `npm test`
habilita su flag experimental y el workflow configura Node 24. Las dependencias
no se incorporan al paquete del sistema. Se mantiene npm como procedimiento
documentado; pnpm se utilizó únicamente para instalar las dependencias en esta
sesión, donde npm no estaba disponible.

Los dobles representan las fronteras de Foundry, no otra implementación del
sistema. Se ejecutan reglas, plantillas y controladores reales. Los campos de
modelo comprueban sus metadatos declarados, **no la validación real de Foundry**.
jsdom no mide disposición visual y tiene límites en variables CSS, `color-mix`
y cascada; para esos contratos se comprueban declaraciones activas aplicables
a los elementos mediante PostCSS, sin afirmar que se haya verificado el
contraste perceptivo ni una ventana real. No se añade una plataforma E2E.

### Comprobaciones realizadas

- Suite completa: **613 pruebas aprobadas en 101 archivos**, sin fallos,
  cancelaciones, omisiones ni TODO; Node `v24.19.0`, Windows, unos **7,8 s** en la ejecución final (junto con el validador).
- `node scripts/dev/validate-project.mjs`: **proyecto válido para 0.1.73**.
- Las comprobaciones focalizadas permitieron corregir el aislamiento de imports
  en la tirada especial. Después se repitieron la suite completa y el validador
  sobre el estado final. Node solo avisa del carácter experimental de los mocks.
- Revisión del diff y de README, arquitectura, roadmap, pendientes e informes.
  Se retira de pendientes esta revisión ya realizada. El inventario inicial y
  las mediciones previas quedan identificados como históricos.

El número total cambia por dividir escenarios y fusionar contratos; no se usa
como indicador de calidad. La duración es una medición aislada, no un benchmark.
La revisión queda cerrada dentro de este alcance; no certifica que el resto de
las pruebas del repositorio se haya auditado individualmente. No se publica versión.

## Paso 6: política documentada

La [política de pruebas](testing-policy.md) fija ejecución proporcional al impacto,
criterios de mantenimiento, límites y comunicación de resultados. AGENTS remite
a esa fuente permanente; README y arquitectura enlazan el procedimiento. No
cambia el orden del roadmap ni los requisitos de publicación.
