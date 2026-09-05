# Inventario de pruebas

**Inventario histórico anterior a la revisión.** Los cambios del paso 5 y sus
archivos de destino se documentan en [la clasificación](test-classification.md).

Instantánea del árbol de trabajo del 5 de septiembre de 2026: 95 archivos y 605 casos declarados. Incluye cambios locales todavía sin publicar. Este documento no certifica su ejecución ni se actualiza automáticamente; la fuente de verdad es tests/.

## Qué comprueban

- Reglas: cálculos de habilidades, combate, daño, estados, equipo y creación de personajes.
- Servicios de ejecución: actualizaciones y coordinación con dependencias simuladas; no equivalen a una partida real en Foundry.
- Datos: contenido y referencias de catálogos, compendios, traducciones e imágenes.
- Interfaz: estructura de código, plantillas y CSS. Estas comprobaciones no verifican visualmente una ventana renderizada.

Cada caso se enumera con su descripción original, que expresa el comportamiento esperado. Algunos archivos mezclan varias clases de comprobación.

## Cómo ejecutarlas

Todas: `npm test`.

Un archivo: `node --experimental-test-module-mocks --test tests/skill-roll.test.js`.

Un caso por su nombre: `node --test --test-name-pattern="96-00" tests/skill-roll.test.js`.

La validación del proyecto se ejecuta por separado con `npm run check`.

## Índice

| Archivo | Casos |
| --- | ---: |
| [acid.test.js](#acidtestjs) | 6 |
| [actor-conditions.test.js](#actor-conditionstestjs) | 3 |
| [armor-coverage.test.js](#armor-coveragetestjs) | 7 |
| [armor.test.js](#armortestjs) | 5 |
| [background-events.test.js](#background-eventstestjs) | 4 |
| [background-generation.test.js](#background-generationtestjs) | 25 |
| [basic-skills.test.js](#basic-skillstestjs) | 6 |
| [catalog.test.js](#catalogtestjs) | 11 |
| [character-gallery.test.js](#character-gallerytestjs) | 1 |
| [character-generation.test.js](#character-generationtestjs) | 5 |
| [combat-actions.test.js](#combat-actionstestjs) | 7 |
| [combat-cancellation.test.js](#combat-cancellationtestjs) | 6 |
| [combat-chat-runtime.test.js](#combat-chat-runtimetestjs) | 5 |
| [combat-chat.test.js](#combat-chattestjs) | 19 |
| [combat-check-runtime.test.js](#combat-check-runtimetestjs) | 1 |
| [combat-damage-display.test.js](#combat-damage-displaytestjs) | 2 |
| [combat-damage-runtime.test.js](#combat-damage-runtimetestjs) | 14 |
| [combat-damage.test.js](#combat-damagetestjs) | 6 |
| [combat-disarm.test.js](#combat-disarmtestjs) | 3 |
| [combat-effect-runtime.test.js](#combat-effect-runtimetestjs) | 7 |
| [combat-effects.test.js](#combat-effectstestjs) | 21 |
| [combat-exchange-runtime.test.js](#combat-exchange-runtimetestjs) | 1 |
| [combat-fatigue.test.js](#combat-fatiguetestjs) | 6 |
| [combat-luck-availability.test.js](#combat-luck-availabilitytestjs) | 3 |
| [combat-resource-runtime.test.js](#combat-resource-runtimetestjs) | 3 |
| [combat-response-runtime.test.js](#combat-response-runtimetestjs) | 2 |
| [combat-sheet-manual-roll.test.js](#combat-sheet-manual-rolltestjs) | 1 |
| [combat-sheet-preferences.test.js](#combat-sheet-preferencestestjs) | 1 |
| [combat-style-weapons.test.js](#combat-style-weaponstestjs) | 7 |
| [combat-styles.test.js](#combat-stylestestjs) | 3 |
| [combat-turns.test.js](#combat-turnstestjs) | 7 |
| [combat-wound-runtime.test.js](#combat-wound-runtimetestjs) | 2 |
| [combat.test.js](#combattestjs) | 35 |
| [compendium-images.test.js](#compendium-imagestestjs) | 4 |
| [condition-resolver.test.js](#condition-resolvertestjs) | 9 |
| [contest-coordination.test.js](#contest-coordinationtestjs) | 9 |
| [contest-rolls.test.js](#contest-rollstestjs) | 12 |
| [creatures.test.js](#creaturestestjs) | 8 |
| [derived-attributes.test.js](#derived-attributestestjs) | 7 |
| [dice-animation.test.js](#dice-animationtestjs) | 3 |
| [direct-damage.test.js](#direct-damagetestjs) | 3 |
| [document-names.test.js](#document-namestestjs) | 6 |
| [dying.test.js](#dyingtestjs) | 4 |
| [encumbrance.test.js](#encumbrancetestjs) | 5 |
| [engagement-runtime.test.js](#engagement-runtimetestjs) | 5 |
| [engagements.test.js](#engagementstestjs) | 13 |
| [equipment.test.js](#equipmenttestjs) | 10 |
| [exsanguination.test.js](#exsanguinationtestjs) | 2 |
| [fall.test.js](#falltestjs) | 6 |
| [family-tables.test.js](#family-tablestestjs) | 8 |
| [fatigue-check-chat.test.js](#fatigue-check-chattestjs) | 3 |
| [fatigue.test.js](#fatiguetestjs) | 7 |
| [fire.test.js](#firetestjs) | 4 |
| [hit-location-table.test.js](#hit-location-tabletestjs) | 8 |
| [homebrew-items.test.js](#homebrew-itemstestjs) | 9 |
| [incapacitated.test.js](#incapacitatedtestjs) | 4 |
| [initiative-chat.test.js](#initiative-chattestjs) | 2 |
| [inventory-sheet.test.js](#inventory-sheettestjs) | 2 |
| [item-icons.test.js](#item-iconstestjs) | 1 |
| [item-names.test.js](#item-namestestjs) | 2 |
| [localization.test.js](#localizationtestjs) | 4 |
| [macros.test.js](#macrostestjs) | 16 |
| [manifest.test.js](#manifesttestjs) | 2 |
| [migrations.test.js](#migrationstestjs) | 8 |
| [morphologies.test.js](#morphologiestestjs) | 10 |
| [npc-generation.test.js](#npc-generationtestjs) | 4 |
| [npc.test.js](#npctestjs) | 6 |
| [parties.test.js](#partiestestjs) | 5 |
| [passions.test.js](#passionstestjs) | 3 |
| [penalties.test.js](#penaltiestestjs) | 2 |
| [penalty-summary.test.js](#penalty-summarytestjs) | 6 |
| [ranged-combat.test.js](#ranged-combattestjs) | 6 |
| [resources.test.js](#resourcestestjs) | 2 |
| [settings.test.js](#settingstestjs) | 9 |
| [sheet-reorganization.test.js](#sheet-reorganizationtestjs) | 11 |
| [skill-roll-resolution.test.js](#skill-roll-resolutiontestjs) | 5 |
| [skill-roll.test.js](#skill-rolltestjs) | 10 |
| [skills.test.js](#skillstestjs) | 10 |
| [social-classes.test.js](#social-classestestjs) | 5 |
| [special-roll.test.js](#special-rolltestjs) | 3 |
| [starting-equipment.test.js](#starting-equipmenttestjs) | 3 |
| [status-assignment.test.js](#status-assignmenttestjs) | 3 |
| [statuses.test.js](#statusestestjs) | 12 |
| [style-standards.test.js](#style-standardstestjs) | 23 |
| [suffocation.test.js](#suffocationtestjs) | 5 |
| [system-roll.test.js](#system-rolltestjs) | 4 |
| [tactical-overview-names.test.js](#tactical-overview-namestestjs) | 1 |
| [tactical-overview-ui.test.js](#tactical-overview-uitestjs) | 2 |
| [timed-conditions.test.js](#timed-conditionstestjs) | 6 |
| [token-linking.test.js](#token-linkingtestjs) | 2 |
| [traits.test.js](#traitstestjs) | 7 |
| [weapon-durability.test.js](#weapon-durabilitytestjs) | 2 |
| [weapon-modes.test.js](#weapon-modestestjs) | 5 |
| [weapons.test.js](#weaponstestjs) | 7 |
| [wound-consequences.test.js](#wound-consequencestestjs) | 5 |

## acid.test.js

[Abrir código](../tests/acid.test.js) · 6 casos

- las concentraciones de ácido conservan las fórmulas de Mythras.
- el daño corroe una sola capa y solo el exceso alcanza la localización.
- la capa equipada más fuerte gana con desempate estable.
- la tirada inicial forma parte de la duración y la inmersión no vence.
- los estados de salpicadura e inmersión preparan revisiones distintas.
- la selección de ácido admite varias localizaciones o una tirada aleatoria.

## actor-conditions.test.js

[Abrir código](../tests/actor-conditions.test.js) · 3 casos

- reúne una única instantánea de condiciones a partir de un Actor.
- personajes y PNJ comparten carga y resolución contextual.
- el estado Incapacitado heredado conserva el suelo aunque aún no tenga bandera.

## armor-coverage.test.js

[Abrir código](../tests/armor-coverage.test.js) · 7 casos

- las piezas normales resuelven automáticamente su localización humana.
- las piezas humanas usan claves semánticas solo en anatomías humanoides.
- varias capas aplican solo el PA más alto y conservan la armadura natural.
- la CRG de todas las piezas equipadas se acumula y penaliza iniciativa hacia arriba.
- los materiales modifican la CRG y no los PA.
- la pieza especial usa el coste más alto configurado.
- las armaduras flexibles admiten ±1 TAM y las rígidas exigen el TAM exacto.

## armor.test.js

[Abrir código](../tests/armor.test.js) · 5 casos

- el compendio contiene una pieza por perfil y localización.
- todas las piezas proceden de Mythras básico revisado y cubren una sola localización.
- los nombres predeterminados combinan localización y perfil, no material.
- cada perfil crea ocho piezas con su material predeterminado.
- los perfiles reproducen la tabla de PA, CRG y coste por localización.

## background-events.test.js

[Abrir código](../tests/background-events.test.js) · 4 casos

- la tabla de acontecimientos cubre sin huecos todos los resultados de 1d100.
- los acontecimientos preceden las notas previas del jugador.
- el borrador conserva las tiradas para no repetirlas al volver a la edad.
- el manifiesto y el asistente registran los acontecimientos de trasfondo.

## background-generation.test.js

[Abrir código](../tests/background-generation.test.js) · 25 casos

- cada cultura propone tres pasiones editables.
- el catálogo coincide con las veinticuatro profesiones del documento.
- las cuatro culturas indican la fuente Mythras básico revisado.
- las veinticuatro profesiones indican la fuente Mythras básico revisado.
- cada cultura solo accede a las profesiones indicadas.
- las profesiones nuevas conservan sus habilidades y magia de referencia.
- las categorías de edad determinan puntos gratuitos y aumento máximo.
- las habilidades culturales coinciden con las listas del documento.
- todas las referencias de culturas y profesiones existen en el compendio.
- la cultura exige tres profesionales, permite omitir el estilo y reparte 100 puntos.
- la asignación cultural aplica los límites 5-15 de la página 13.
- las especializaciones distintas crean habilidades independientes.
- la misma especialización de cultura y profesión se fusiona.
- Magia Común adquirida por varias fases conserva una sola habilidad.
- el personaje se completa antes de retirar las marcas temporales.
- la asignación nunca sobrepasa el presupuesto de la fase.
- la edición de puntos culturales salta al mínimo y respeta el máximo.
- la profesión aplica los límites configurados sin obligar a mejorar todo.
- la fase libre exige habilidad adicional, especialización y 150 puntos.
- curación no exige especialización en la fase libre.
- la edad limita el aumento individual de los puntos gratuitos.
- la habilidad libre puede mejorar una habilidad ya adquirida.
- la habilidad libre puede ser un estilo de combate.
- la profesión admite estilos de combate adicionales independientes.
- un estilo ofrecido por la profesión puede dejarse vacío.

## basic-skills.test.js

[Abrir código](../tests/basic-skills.test.js) · 6 casos

- el catálogo contiene todas las habilidades básicas de Imperativo.
- el catálogo incluye las nueve habilidades mágicas del documento de referencia.
- el catálogo completo contiene básicas y profesionales sin duplicados.
- el catálogo profesional coincide exactamente con el documento de referencia.
- todas las habilidades del compendio indican su fuente.
- Costumbres y Lengua Materna conservan su +40 inicial.

## catalog.test.js

[Abrir código](../tests/catalog.test.js) · 11 casos

- clasifica todos los tipos comerciales actuales.
- busca por fragmentos sin distinguir acentos ni mayúsculas.
- combina filtros de categoría mediante unión.
- ordena monedas por equivalencia sin cambiar el precio original.
- ordena por nombre, clase y precio en ambos sentidos.
- filtra por compendios seleccionados.
- elimina duplicados por UUID y normaliza fuentes configuradas.
- la compra usa la moneda del precio cuando es suficiente.
- rompe la mínima moneda superior necesaria y devuelve las vueltas.
- no usa monedas inferiores para pagar un precio superior.
- la interfaz emite arrastre Item estándar y reserva la gestión homebrew al DJ.

## character-gallery.test.js

[Abrir código](../tests/character-gallery.test.js) · 1 casos

- la galería de personaje usa datos estructurados y un parcial reutilizable.

## character-generation.test.js

[Abrir código](../tests/character-generation.test.js) · 5 casos

- ofrece asignación libre junto a los tres métodos existentes.
- libre conserva valores generados y solo inicia mínimos sin método previo.
- la asignación parte de los mínimos y dispone de 44 puntos.
- la asignación no baja de mínimos ni supera 75 puntos.
- solo se intercambian características obtenidas con los mismos dados.

## combat-actions.test.js

[Abrir código](../tests/combat-actions.test.js) · 7 casos

- las acciones proactivas solo aparecen en el turno propio con PA.
- traba, postura y fuentes restringen únicamente sus acciones.
- el movimiento conserva continuidad entre asaltos completos.
- carga y afianzamiento redondean siempre hacia arriba.
- las oposiciones desempatan por dado alto y la interrupción por iniciativa.
- el esquema táctico normaliza colecciones antiguas.
- Titubear consume condiciones de turno propio sin duplicarlas al avanzar.

## combat-cancellation.test.js

[Abrir código](../tests/combat-cancellation.test.js) · 6 casos

- el ataque puede cancelarse hasta aplicar una consecuencia.
- cancelar restituye ambos PA y no solicita avanzar el tracker.
- cerrar un intercambio terminal avanza aunque todavía pueda cancelarse.
- el cierre forzado resuelve los pasos pendientes sin cancelar daño aplicado.
- una herida crítica de extremidad terminada no necesita consecuencia narrativa.
- una tirada de herida provisional impide cerrar hasta aceptar su resultado.

## combat-chat-runtime.test.js

[Abrir código](../tests/combat-chat-runtime.test.js) · 5 casos

- el runtime de socket enruta únicamente acciones válidas al coordinador.
- un cliente que no coordina no ejecuta la mutación.
- el runtime enruta el gasto de suerte de una herida crítica.
- el runtime enruta la elección del objeto soltado.
- el runtime enruta la respuesta extraordinaria de Ardid.

## combat-chat.test.js

[Abrir código](../tests/combat-chat.test.js) · 19 casos

- el primer DJ activo coordina y el autor es el respaldo.
- paradas y daño se incorporan como Roll al mensaje interactivo.
- la parada prefiere el arma que no mantiene el bloqueo pasivo.
- la tarjeta solo muestra las mitigaciones de daño realmente aplicadas.
- la localización aparece inmediatamente después de su tirada.
- Elegir localización presenta las instantáneas con el nombre localizado.
- cancelar el selector de parada no produce una defensa parcial.
- la tarjeta descarta parar y evadir antes del diálogo si no quedan PA.
- las pruebas de heridas distinguen oposición y consecuencia anatómica.
- una tirada sin localización cierra el daño sin reasignarlo.
- la respuesta de combate rechaza estado, revision, propiedad y tipo invalidos.
- la tarjeta clasifica dificultad y objetivo con los colores compartidos.
- la prueba de herida crítica ofrece reducirla mediante Suerte.
- el daño precede a la prueba de Aguante de la herida.
- las resistencias automatizadas no ocultan ni bloquean el daño.
- las heridas graves y críticas permiten Suerte antes de aplicar consecuencias.
- las pruebas de efectos admiten habilidad elegida, Suerte y consecuencia automatizada.
- la suerte de combate permite elegir pagador y limita la tirada ajena a repetir.
- el fallo de Aguante en un brazo resuelve en la tarjeta qué objeto se suelta.

## combat-check-runtime.test.js

[Abrir código](../tests/combat-check-runtime.test.js) · 1 casos

- una prueba de efecto espera Suerte y confirmación antes de aplicar la consecuencia.

## combat-damage-display.test.js

[Abrir código](../tests/combat-damage-display.test.js) · 2 casos

- muestra los resultados individuales de arma y bonificador.
- expande varios dados y conserva el daño extraordinario.

## combat-damage-runtime.test.js

[Abrir código](../tests/combat-damage-runtime.test.js) · 14 casos

- la aplicación documental comprueba la instantánea de PG y armadura.
- el daño ordinario actualiza únicamente los PG de la localización.
- una herida crítica consolida la lesión permanente en la misma escritura.
- el daño a un arma no crea lesiones permanentes.
- la transición de daño marca applying y applied alrededor de la escritura.
- una instantánea documental distinta deja la propuesta obsoleta.
- un fallo documental restaura la propuesta sin avanzar.
- el bloqueo pasivo se consume únicamente al aplicar el daño que ha mitigado.
- la regla alternativa conserva el d20 y aplica después el 1d3.
- la regla alternativa convierte en fallo un 1d3 insuficiente.
- Elegir Localización exige el 1d3 incluso con la regla oficial.
- una parada parcial permite aplicar después el bloqueo pasivo.
- una parada completa no aplica ni marca el bloqueo pasivo.
- la propuesta contra un arma usa su instancia, PA y limita sus PG a cero.

## combat-damage.test.js

[Abrir código](../tests/combat-damage.test.js) · 6 casos

- la fase de daño conserva resoluciones previas y ordena efectos antes que heridas.
- Elegir Localización limita las opciones de la propuesta de daño.
- Empalar aplica su automatización sin dejar una confirmación manual.
- una resistencia no condicionada al daño se conserva al recalcular la propuesta.
- un efecto condicionado no automatizado se cierra sin crear pruebas.
- la suerte reduce una herida crítica al mínimo exacto de herida grave.

## combat-disarm.test.js

[Abrir código](../tests/combat-disarm.test.js) · 3 casos

- el tamaño del arma atacante desplaza la dificultad del desarme.
- el desarme limita la FUE de la víctima al doble de la atacante.
- la mano libre y las armas arrebatables proceden del equipo activo.

## combat-effect-runtime.test.js

[Abrir código](../tests/combat-effect-runtime.test.js) · 7 casos

- el lado afectado distingue efectos propios y contra el oponente.
- un estado gestionado conserva origen, combate y duración.
- los efectos inmediatos aplican estados, alcance y pruebas pendientes.
- una prueba de efecto no resistida ejecuta su consecuencia.
- una prueba resistida resuelve el efecto sin aplicar documentos.
- el éxito automático hace fallar la resistencia sin tirar.
- las resistencias automáticas condicionadas esperan su fase.

## combat-effects.test.js

[Abrir código](../tests/combat-effects.test.js) · 21 casos

- todos los efectos oficiales tienen una fase canónica de resolución.
- Sorpresa puede conceder efectos ofensivos aunque gane la defensa.
- Ardid exige combate activo y separa objetivos de sustituciones defensivas.
- Muerte Silenciosa solo es elegible en el ataque que consume Sorpresa.
- el catálogo canónico contiene 44 efectos y la tabla completa de empalamiento.
- el catálogo solo conserva restricciones canónicas y rechaza texto libre.
- los efectos homebrew se combinan con los oficiales y pueden sustituir una clave.
- la elegibilidad respeta lado, crítico y capacidades estructuradas del arma.
- las restricciones a distancia respetan el modo usado en el ataque.
- Elegir Localización respeta alcance corto, situación y cobertura completa.
- la selección admite renuncias y solo duplica efectos apilables.
- Dañar arma solo es elegible con una parada y un objetivo material.
- Dañar arma separa efectos de daño corporal de consecuencias independientes.
- Dañar arma conserva lados y dirige fuente y objetivo exactos.
- la selección resalta críticos propios y pifias del rival según el lado.
- maximizar daño prioriza los dados mayores sin alterar el orden de la fórmula.
- las comprobaciones de efectos preceden siempre a las de heridas.
- las tiradas enfrentadas de los efectos desempatan con el dado más alto.
- la hoja de Empalar usa una tabla semántica y el compendio nace del JSON canónico.
- la hoja de efecto es editable, restringe sus valores y usa booleanos visuales.
- el diálogo de selección muestra descripciones y solo pide parámetros reglados.

## combat-exchange-runtime.test.js

[Abrir código](../tests/combat-exchange-runtime.test.js) · 1 casos

- cerrar un intercambio terminal obsoleto lo sella sin mover otro turno.

## combat-fatigue.test.js

[Abrir código](../tests/combat-fatigue.test.js) · 6 casos

- calcula el intervalo de fatiga de combate redondeando CON hacia arriba.
- solo cuenta asaltos terminados y conserva el vencimiento al repetir la preparación.
- vence al completar los asaltos correspondientes a CON.
- la tirada periódica solo pierde un nivel al fallar.
- Aguante periódico aplica fatiga y las demás condiciones de habilidad.
- la Suerte de fatiga distingue tirada propia y rival y recalcula la pérdida.

## combat-luck-availability.test.js

[Abrir código](../tests/combat-luck-availability.test.js) · 3 casos

- permite Suerte tras ataque y parada cuando no hay efectos que elegir.
- permite Suerte mientras los efectos aún no se han elegido.
- bloquea Suerte después de elegir efectos o tirar el daño.

## combat-resource-runtime.test.js

[Abrir código](../tests/combat-resource-runtime.test.js) · 3 casos

- los recursos de combate se consumen de forma atómica en el servicio documental.
- la munición actualiza solo el modo empleado.
- Sorpresa se consume una sola vez.

## combat-response-runtime.test.js

[Abrir código](../tests/combat-response-runtime.test.js) · 2 casos

- el blanco accidental sustituye al defensor y persiste la transición.
- Ardid sustituye la selección atacante y concede un efecto automático.

## combat-sheet-manual-roll.test.js

[Abrir código](../tests/combat-sheet-manual-roll.test.js) · 1 casos

- el selector general de ataque conserva Shift al lanzar el arma elegida.

## combat-sheet-preferences.test.js

[Abrir código](../tests/combat-sheet-preferences.test.js) · 1 casos

- el ataque propone primero el arma y conserva el escudo como alternativa.

## combat-style-weapons.test.js

[Abrir código](../tests/combat-style-weapons.test.js) · 7 casos

- un arma de varios modos heredados aporta un único perfil.
- varios modos con el mismo perfil usan el nombre físico.
- los perfiles propios de los modos se ofrecen por separado.
- la incorporación conserva el orden y evita duplicados.
- la entrada manual admite comas, punto y coma y líneas.
- la lista no impone un límite artificial.
- eliminar un perfil conserva los demás y cambia la compatibilidad disponible.

## combat-styles.test.js

[Abrir código](../tests/combat-styles.test.js) · 3 casos

- el compendio incluye los diez estilos de ejemplo del manual.
- todas las armas y rasgos de los estilos apuntan a entradas existentes.
- las alternativas del cuadro se conservan completas.

## combat-turns.test.js

[Abrir código](../tests/combat-turns.test.js) · 7 casos

- recalcula la iniciativa conservando el resultado original del d10.
- la iniciativa compuesta conserva el orden principal y el desempate.
- avanza dentro del ciclo y omite participantes sin acciones.
- un recorrido completo crea otro ciclo si quedan acciones.
- sin acciones pendientes solicita un asalto nuevo.
- omite un turno exclusivamente proactivo pero conserva sus acciones.
- deduplica actores enlazados y conserva actores sintéticos.

## combat-wound-runtime.test.js

[Abrir código](../tests/combat-wound-runtime.test.js) · 2 casos

- las opciones de soltar incluyen únicamente armas equipadas que ocupan manos.
- una herida grave aplica sus consecuencias mediante dependencias explícitas.

## combat.test.js

[Abrir código](../tests/combat.test.js) · 35 casos

- el modelo semántico mantiene inutilizada, lisiada y herida independientes.
- las consecuencias de heridas reconocen brazos y piernas por anatomía canónica.
- normaliza y migra referencias textuales de armas.
- un estilo compatible aplica su porcentaje completo.
- varios estilos compatibles conservan la elección explícita.
- la familiaridad reduce el estilo por grados oficiales.
- un arma sustancialmente diferente usa FUE + DES.
- un arma sin estilo puede usarse sin entrenamiento con FUE + DES.
- sin entrenamiento no sustituye un estilo que incluye el arma.
- la armadura nunca produce daño negativo.
- la tabla humana calcula los siete valores para CON 10 y TAM 10.
- solo los nombres humanos estándar admiten normalización al castellano.
- las localizaciones estándar se presentan por idioma sin reescribir su nombre.
- las localizaciones humanas separan carga y porcentaje de precio de armadura.
- los umbrales de herida usan los PV máximos.
- la curación hasta herida leve recupera una localización inutilizada.
- el estado general usa la herida más grave de todas las localizaciones.
- la penalizacion del encabezado deriva del nivel de herida.
- cualquier herida grave activa la consulta situacional.
- una tirada localiza el rango correspondiente o devuelve null.
- la lesión permanente progresa, redondea y conserva el máximo original.
- los resultados anulados desde el inicio no impactan ninguna localización.
- el 1d3 de una extremidad mutilada falla según su nivel de gravedad.
- la regla alternativa conserva el rango d20 completo.
- una defensa predeclarada comparte la mayor reduccion por encima de 100.
- una defensa tardia no reclasifica ni reduce el ataque.
- no defenderse es un fallo automatico sin dado ni reduccion compartida.
- la cobertura es una defensa pasiva y se aplica antes de la armadura.
- una defensa puede obtener efectos contra un ataque fallido.
- Evadir desempata grados iguales con el dado mas alto.
- la parada compara las cinco categorias de tamaño.
- golpe contenido y parada parcial dividen redondeando hacia arriba.
- una parada completa y la armadura nunca producen daño negativo.
- el bloqueo pasivo se aplica después de una parada parcial.
- una parada completa deja sin daño que mitigar al bloqueo pasivo.

## compendium-images.test.js

[Abrir código](../tests/compendium-images.test.js) · 4 casos

- todas las imágenes asignadas a armaduras existen.
- todas las armas reciben una imagen existente.
- las nuevas imagenes de equipo se asignan a entradas existentes.
- ningun objeto del compendio conserva un icono generico.

## condition-resolver.test.js

[Abrir código](../tests/condition-resolver.test.js) · 9 casos

- los productores omiten efectos neutros y conservan estados informativos.
- herida crítica e incapacitación manual establecen el suelo de condición.
- una fatiga peor prevalece sobre los suelos de incapacitación.
- los suelos se combinan antes de los incrementos contextuales.
- combina transformaciones de fatiga, carga y armadura en orden.
- inconsciente anula atributos y junto con aturdido bloquea ataques.
- una herida crítica anula PA y ataque aunque el máximo base sea superior a tres.
- el contexto decide carga y herida grave sin mutar descriptores.
- los modelos y hojas de personaje y PNJ consumen el resolvedor compartido.

## contest-coordination.test.js

[Abrir código](../tests/contest-coordination.test.js) · 9 casos

- an active GM coordinates before the author, with author fallback.
- response validation rejects ownership, duplicates and stale revisions.
- contest UI uses the shared card, pending state and ownership visibility.
- Luck spenders only need to be active-party participants.
- contest setup is limited to scene tokens and rivals choose their ability later.
- contest setup preserves each token instance even when actors share an identity.
- opposed responses open adjustments while elimination accepts the first configured roller.
- configured contest cards separate sides and name multi-member team winners.
- resolution and participation are configured as independent axes.

## contest-rolls.test.js

[Abrir código](../tests/contest-rolls.test.js) · 12 casos

- opposed rolls prefer grade, then the higher successful roll.
- a Luck reroll that becomes critical is recalculated above a higher success.
- mutual failure and exact ties can start a new round.
- the complete differential matrix follows the Mythras table.
- the highest excess over 100 is subtracted from everybody.
- each opponent is compared independently.
- team representatives support highest, lowest and designated.
- elimination applies one die to every individual target.
- an individual can oppose a team represented by its highest member.
- every member of an individually rolling team contests the opponent.
- an elimination side drops failures before opposing the individual.
- team and elimination modes also resolve directly against difficulty.

## creatures.test.js

[Abrir código](../tests/creatures.test.js) · 8 casos

- el bestiario incluye las cinco criaturas solicitadas.
- cada criatura cubre exactamente el d20 y conserva anatomía propia.
- las localizaciones genéricas de criaturas usan claves traducibles.
- las fórmulas de características usan solo dados y aritmética.
- todas las armas naturales vinculadas apuntan a una localización existente.
- el compendio de rasgos contiene claves únicas y cubre todas las referencias.
- el manifiesto registra los tipos y compendios nuevos.
- los identificadores de compendio son deterministas y únicos.

## derived-attributes.test.js

[Abrir código](../tests/derived-attributes.test.js) · 7 casos

- Mythras Imperativo concede siempre dos puntos de acción.
- los puntos de acción calculados siguen los tramos de INT + DES.
- modificador de experiencia respeta los límites de tramo.
- curación y suerte comparten progresión por tramos.
- iniciativa redondea hacia arriba.
- el ritmo de movimiento humano de Imperativo es seis.
- modificador de daño conserva estructura y etiqueta.

## dice-animation.test.js

[Abrir código](../tests/dice-animation.test.js) · 3 casos

- evaluateAnimatedRoll evaluates a Foundry Roll without requiring Dice So Nice.
- evaluateAnimatedRoll broadcasts Dice So Nice with the active roll visibility.
- interactive card updates append real Foundry rolls.

## direct-damage.test.js

[Abrir código](../tests/direct-damage.test.js) · 3 casos

- el daño directo admite una cantidad específica.
- el daño directo conserva fórmulas y la selección aleatoria.
- el daño directo resta PG sin absorción de armadura.

## document-names.test.js

[Abrir código](../tests/document-names.test.js) · 6 casos

- characters always use the current directory Actor name.
- unlinked NPCs use each TokenDocument name.
- an instance name edited in the synthetic Actor overrides the stale Token name.
- renaming an unlinked token Actor from its sheet also renames that Token.
- sheet updates do not rename linked tokens or templates.
- the NPC sheet persists name changes through the shared token-aware updater.

## dying.test.js

[Abrir código](../tests/dying.test.js) · 4 casos

- Agonizando calcula las tres duraciones permitidas.
- Agonizando solo se sustituye por un contador estrictamente menor.
- todas las heridas críticas comparten el mismo criterio de desenlace.
- Agonizando se descuenta al principio de cada asalto.

## encumbrance.test.js

[Abrir código](../tests/encumbrance.test.js) · 5 casos

- los umbrales de carga usan FUE x2, x3 y x4.
- la carga reduce movimiento según el estado.
- la armadura equipada cuenta a la mitad y la transportada completa.
- las armas usan su CRG y cada veinte objetos de CRG cero suman uno.
- solo FUE, DES y estilos de combate reciben la dificultad por carga.

## engagement-runtime.test.js

[Abrir código](../tests/engagement-runtime.test.js) · 5 casos

- el estado táctico normaliza ardides y los consume uno a uno.
- eliminar una relación la suprime durante el encuentro para que no se recree.
- la corrección del DJ crea, modifica, desactiva y elimina coberturas.
- la corrección del DJ desactiva el bloqueo y retira el efecto de agacharse.
- la corrección del DJ reactiva un bloqueo válido en el asalto actual.

## engagements.test.js

[Abrir código](../tests/engagements.test.js) · 13 casos

- las relaciones usan una identidad estable y el alcance largo con dos grados.
- la situación muestra el alcance favorecido de las armas relacionadas.
- el alcance impide al arma corta y convierte el arma larga en pomo.
- el bloqueo pasivo exige capacidad exacta y localizaciones contiguas.
- la comprobación de contigüidad puede desactivarse.
- un arma manufacturada puede bloquear una localización al luchar con dos armas.
- las armas naturales no cuentan para habilitar el bloqueo pasivo con dos armas.
- el bloqueo pasivo propone primero el escudo sin ocultar otras armas.
- el bloqueo pasivo reconstruye las localizaciones desde el Actor vivo.
- el diálogo resuelve el Actor sintético desde el combatiente activo.
- el bloqueo pasivo reutiliza la declaración del asalto anterior.
- la tarjeta de inicio agrupa fatiga y distribuye el bloqueo sin estados redundantes.
- las localizaciones humanas forman una red anatómica y no el orden del d20.

## equipment.test.js

[Abrir código](../tests/equipment.test.js) · 10 casos

- el compendio clasifica todos los objetos y conserva su fuente.
- la casa predeterminada es una propiedad contenedora.
- viviendas alquiladas y en propiedad se comportan como propiedades.
- el ganado usa una imagen local estable.
- los vehículos usan una imagen local estable.
- los objetos dentro de propiedades o vehículos no cuentan como transportados.
- el inventario genera filas jerárquicas y respeta contenedores plegados.
- el inventario separa la persona de cada propiedad.
- las categorías se ordenan según la presentación del inventario.
- cada categoría del inventario comienza con una separación visual.

## exsanguination.test.js

[Abrir código](../tests/exsanguination.test.js) · 2 casos

- Desangrándose es permanente y se procesa al inicio del asalto.
- un Actor enlazado solo genera una pérdida automática por asalto.

## fall.test.js

[Abrir código](../tests/fall.test.js) · 6 casos

- la tabla de caída determina dados y localizaciones.
- TAM pequeño reduce distancia y TAM grande aumenta el daño.
- Acrobacias y superficie blanda reducen la distancia antes de consultar la tabla.
- el vehículo convierte velocidad por asalto y reproduce el ejemplo de 20 metros.
- un objeto suma dados por TAM al daño de la distancia y afecta una zona.
- la superficie peligrosa suma su daño en cada localización alcanzada.

## family-tables.test.js

[Abrir código](../tests/family-tables.test.js) · 8 casos

- las cinco tablas cubren sin huecos todos los resultados de 1d100.
- hermanos y familia extendida resuelven sus fórmulas secundarias.
- reputación distribuye aleatoriamente cada relación compuesta.
- conexiones realiza de una a cuatro tiradas y reparte sus tipos.
- matrimonio respeta el diez por ciento y el valor de Influencia.
- el texto generado preserva las notas previas una sola vez.
- los borradores antiguos reciben almacenamiento de tiradas compatible.
- manifiesto, plantilla y asistente registran la nueva fase.

## fatigue-check-chat.test.js

[Abrir código](../tests/fatigue-check-chat.test.js) · 3 casos

- la dificultad transforma el objetivo y estándar lo conserva.
- la respuesta exige revisión vigente, participante pendiente y propiedad.
- el selector de participantes usa la lista vertical compartida.

## fatigue.test.js

[Abrir código](../tests/fatigue.test.js) · 7 casos

- la tabla contiene los diez niveles de fatiga en orden.
- la fatiga aplica movimiento, iniciativa y puntos de acción.
- los niveles sin actividad anulan los atributos operativos.
- la dificultad de fatiga nunca mejora una dificultad existente.
- una herida critica equivale como minimo a incapacitado.
- el estado incapacitado manual establece el mismo suelo.
- una herida grave situacional aumenta un grado la dificultad.

## fire.test.js

[Abrir código](../tests/fire.test.js) · 4 casos

- las cinco intensidades conservan daño, ignición y ejemplo.
- la configuración permite fórmula propia y localizaciones libres sin duplicados.
- el fuego resta el daño completo sin consultar armadura.
- la cola deduplica actores enlazados y conserva PNJ sintéticos.

## hit-location-table.test.js

[Abrir código](../tests/hit-location-table.test.js) · 8 casos

- personaje y PNJ consumen un único preparador y un único parcial de localizaciones.
- las referencias de localización rotas reciben el indicador visual compartido.
- restaurar anatomía humana conserva la herida permanente reconocible.
- detecta armaduras y armas que apuntan a IDs de localización borrados.
- el esquema permite nombres personalizados sin clave traducible.
- d20 y Localización alinean igual sus cabeceras y datos.
- el preparador común resuelve estados, armadura y bloqueo pasivo.
- el preparador presenta el nombre localizado de la localización.

## homebrew-items.test.js

[Abrir código](../tests/homebrew-items.test.js) · 9 casos

- el creador homebrew cubre todos los tipos Item del sistema.
- registra el menú GM, la API y los formularios del creador.
- normaliza el nombre de un compendio mundial.
- crea armas funcionales con un modo y durabilidad completa.
- conserva la imagen elegida y trata el peso histórico del equipo como carga.
- el creador delega armas y estilos en versiones acotadas de sus hojas.
- crea localizaciones y armaduras con valores operativos.
- crea efectos homebrew con restricciones canónicas utilizables.
- culturas y profesiones exigen reglas JSON con forma de objeto.

## incapacitated.test.js

[Abrir código](../tests/incapacitated.test.js) · 4 casos

- fatiga incapacitado o peor produce la causa automática.
- la herida critica y la fatiga conservan causas independientes.
- la causa manual coexiste con las causas automáticas.
- la presencia del estado consulta efectos reales y no estados derivados obsoletos.

## initiative-chat.test.js

[Abrir código](../tests/initiative-chat.test.js) · 2 casos

- la tarjeta individual muestra dado, bonificador y total sin desempate.
- la tarjeta grupal reúne participantes y muestra desempate solo donde existe.

## inventory-sheet.test.js

[Abrir código](../tests/inventory-sheet.test.js) · 2 casos

- las armas íntegramente naturales no forman parte del inventario.
- un arma con algún modo manufacturado permanece en el inventario.

## item-icons.test.js

[Abrir código](../tests/item-icons.test.js) · 1 casos

- cada tipo de Item del sistema tiene un icono predeterminado.

## item-names.test.js

[Abrir código](../tests/item-names.test.js) · 2 casos

- los nombres nuevos se numeran por tipo y reutilizan huecos.
- solo se sustituyen nombres genéricos de creación.

## localization.test.js

[Abrir código](../tests/localization.test.js) · 4 casos

- los catálogos español e inglés contienen las mismas claves.
- todas las claves de localización literales usadas por la interfaz existen.
- el catálogo español no contiene texto con codificación dañada.
- las etiquetas principales de la hoja están traducidas al castellano.

## macros.test.js

[Abrir código](../tests/macros.test.js) · 16 casos

- el compendio incluye la macro de experiencia del grupo.
- el compendio incluye una macro GM para abrir el gestor de grupos.
- el compendio incluye una macro GM para aplicar ácido mediante la API pública.
- el compendio incluye una macro GM para aplicar daño directo.
- el compendio incluye una macro GM para aplicar Desangrándose.
- el compendio incluye una macro GM para aplicar Agonizando.
- el compendio incluye un lanzador común de peligros y fatiga.
- el lanzador presenta el título con el encabezado rojizo compartido.
- el compendio incluye una macro GM para asignar estados.
- el compendio incluye una macro GM para aplicar fuego mediante la API pública.
- el compendio incluye una macro GM para aplicar caídas mediante la API pública.
- el compendio incluye una macro GM para aplicar asfixia mediante la API pública.
- el compendio incluye una macro GM para solicitar tiradas de fatiga.
- el compendio incluye un lanzador ligero para el catálogo.
- el compendio incluye una macro GM para abrir el creador homebrew.
- las copias antiguas de macros oficiales reciben el formato actualizado.

## manifest.test.js

[Abrir código](../tests/manifest.test.js) · 2 casos

- los compendios muestran únicamente el nombre de su contenido.
- las referencias internas conservan identificadores de compendio válidos.

## migrations.test.js

[Abrir código](../tests/migrations.test.js) · 8 casos

- la migración de habilidades conserva su transformación idempotente.
- los valores por defecto migrados se resuelven por dominio.
- la migración traduce localizaciones humanas estándar y conserva nombres complejos.
- la reparación humana elimina duplicados, conserva referencias y repone huecos.
- la reparación de criaturas restaura su anatomía y religa armas naturales.
- una anatomía ya reconciliada queda bajo control del usuario.
- la migración tipa anatomías exactas sin reconstruirlas y deja ambiguas como custom.
- el entrypoint solo invoca el coordinador de migraciones.

## morphologies.test.js

[Abrir código](../tests/morphologies.test.js) · 10 casos

- el catálogo contiene humanoide, trece morfologías no humanas y custom.
- todas las plantillas cubren 1–20 sin huecos ni solapamientos.
- las localizaciones derivan PV y factores anatómicos de forma coherente.
- la identificación solo tipa anatomías exactas.
- las criaturas oficiales tipadas coinciden exactamente con su plantilla.
- una herida permanente incompatible bloquea el reemplazo.
- el reemplazo conserva heridas y armadura natural de zonas equivalentes.
- las referencias anidadas conservan IDs ajenos y eliminan destinos borrados.
- daño y Elegir localización consumen sin supuestos humanos una morfología no humana.
- al aplicar una anatomía no humana solo la pieza genérica conserva cobertura.

## npc-generation.test.js

[Abrir código](../tests/npc-generation.test.js) · 4 casos

- materializa en orden, recalcula recursos y restaura PG actuales.
- un fallo no modifica la fuente ni devuelve un resultado parcial.
- rechaza referencias de datos y resultados fuera de rango.
- solo se generan tokens NPC no enlazados.

## npc.test.js

[Abrir código](../tests/npc.test.js) · 6 casos

- las habilidades conservan el cálculo derivado de los personajes.
- una habilidad manual usa directamente su porcentaje.
- los atributos NPC admiten overrides sin cambiar las características planas.
- INT e INS comparten el mismo dato interno.
- un arma natural toma PA y PG de su localización.
- el modificador de daño manual conserva la fórmula para cada ataque.

## parties.test.js

[Abrir código](../tests/parties.test.js) · 5 casos

- normaliza grupos, miembros duplicados y grupo activo.
- el saneado conserva solo actores de personaje existentes.
- eliminar el grupo activo selecciona el primer grupo restante.
- la API resuelve miembros sin depender de nombre o carpeta.
- la API puede delegar la apertura del gestor.

## passions.test.js

[Abrir código](../tests/passions.test.js) · 3 casos

- cada tipo de objeto aplica la base de pasión correcta.
- la pasión separa base, creación, experiencia y ajuste manual.
- una pasión antigua conserva exactamente su porcentaje.

## penalties.test.js

[Abrir código](../tests/penalties.test.js) · 2 casos

- un valor solo se marca cuando el efectivo cambia.
- un recurso temporal nunca supera el maximo penalizado.

## penalty-summary.test.js

[Abrir código](../tests/penalty-summary.test.js) · 6 casos

- resume por separado las fuentes y los totales contextuales.
- una herida critica establece incapacitado como suelo.
- una fatiga peor que incapacitado prevalece sobre la herida critica.
- la causa manual de incapacitado aplica las mismas consecuencias.
- los estados de habilidad se combinan antes de los incrementos por grados.
- inconsciente reduce a cero los atributos totales.

## ranged-combat.test.js

[Abrir código](../tests/ranged-combat.test.js) · 6 casos

- parses and classifies numeric range profiles.
- continues the distance and size progression.
- accumulates ranged difficulty and aim removes one adverse step.
- long range damage rounds upward and power drops.
- optional ammunition consumes and reloads by actions.
- detects an accidental melee target only inside the margin.

## resources.test.js

[Abrir código](../tests/resources.test.js) · 2 casos

- los controles de recursos respetan cero y el máximo.
- restaurar rellena el recurso hasta su máximo.

## settings.test.js

[Abrir código](../tests/settings.test.js) · 9 casos

- registra todas las opciones del sistema con claves centralizadas.
- entrega a Foundry definiciones mutables sin alterar el catálogo.
- compone y normaliza los límites de puntos profesionales.
- la clase social se elige por defecto y admite modo aleatorio.
- compone las reglas de puntos de acción desde los ajustes del mundo.
- compone y normaliza los límites de puntos culturales.
- solo muestra el valor fijo cuando se selecciona ese método.
- lee y escribe opciones usando siempre el identificador del sistema.
- usa valores seguros antes de que Foundry permita leer ajustes.

## sheet-reorganization.test.js

[Abrir código](../tests/sheet-reorganization.test.js) · 11 casos

- las acciones tácticas permanecen reunidas y visibles en ambas hojas.
- personaje y PNJ comparten Combate e Inventario.
- Combate de personaje conserva el orden operativo de sus paneles.
- todas las navegaciones usan pestañas elevadas con superficie activa.
- los encabezados oscuros conservan contraste propio en campos, líneas y botones.
- Estado contiene Fatiga y Combate ya no la duplica.
- Trasfondo, lesión permanente y silueta canónica quedan modelados.
- la orientación frontal refleja las localizaciones laterales de la silueta.
- las consecuencias narrativas distinguen herida grave y miembro inutilizable.
- la consulta de heridas no descarta tiradas mediante una clasificación física.
- una herida grave inutiliza la localización sin reutilizar Aturdir Localización.

## skill-roll-resolution.test.js

[Abrir código](../tests/skill-roll-resolution.test.js) · 5 casos

- personaje y PNJ pueden resolver todos los modificadores en una sola operación.
- la herida crítica se informa sin duplicar la fatiga fresca.
- la decisión sobre miembro inutilizado prevalece sin ocultar su procedencia.
- la dificultad base se combina una sola vez con la carga física.
- las dos hojas delegan la tirada de habilidad en el resolvedor común.

## skill-roll.test.js

[Abrir código](../tests/skill-roll.test.js) · 10 casos

- 01-05 siempre tiene éxito y el umbral crítico prevalece.
- una habilidad limitada queda topada y una reforzada suma el 20% hacia arriba.
- la dificultad se aplica después del ajuste y el crítico usa el objetivo efectivo.
- los grados favorables y adversos se combinan alrededor de estándar.
- limitada y reforzada pueden aplicarse juntas de forma independiente.
- invertir conserva los dos dígitos y trata 00 como 100.
- 96-00 siempre falla.
- 99 y 00 son pifia hasta 100%; por encima solo 00.
- la leyenda muestra los rangos de crítico y pifia aplicados.
- la línea de tirada conserva la suerte para usos repetidos.

## skills.test.js

[Abrir código](../tests/skills.test.js) · 10 casos

- separa la base de las mejoras por fase.
- admite característica duplicada y bonificación inicial fija.
- una pifia concede un +1 a la futura mejora de experiencia.
- la mejora usa 1d4+1 cuando 1d100+INT alcanza la habilidad.
- la mejora es +1 si falla y suma otro +1 por pifia.
- adquirir una habilidad o estilo de combate cuesta tres tiradas de experiencia.
- el modo de edición permite adquirir habilidades y estilos sin coste.
- al llegar a cero se limpian las pifias de habilidades y estilos.
- una pifia marca automáticamente la habilidad o estilo que ha tirado.
- una pifia de personaje actualiza la habilidad del Actor fuente.

## social-classes.test.js

[Abrir código](../tests/social-classes.test.js) · 5 casos

- las cuatro tablas sociales cubren todo el intervalo de 1d100.
- los umbrales sociales extremos coinciden con las tablas.
- el dinero inicial combina cultura, 4d6 y clase social.
- la selección social exige clase y tirada de dinero.
- el compendio ofrece una tabla rollable por cultura.

## special-roll.test.js

[Abrir código](../tests/special-roll.test.js) · 3 casos

- character and NPC skill tabs expose the Special roll.
- Special rolls accept a name and percentage and can enter a contest.
- a higher effective target is rendered as a bonus.

## starting-equipment.test.js

[Abrir código](../tests/starting-equipment.test.js) · 3 casos

- las seis clases sociales tienen reglas de equipo inicial.
- la tirada de ropa sustituye la fórmula en la descripción.
- las elecciones exigen cantidades exactas y localizaciones de armadura únicas.

## status-assignment.test.js

[Abrir código](../tests/status-assignment.test.js) · 3 casos

- el gestor incluye Incapacitado y todo el catálogo canónico de estados.
- normaliza duraciones manuales, por turnos propios y por asaltos.
- cada estado asignable dispone de explicación en ambos idiomas.

## statuses.test.js

[Abrir código](../tests/statuses.test.js) · 12 casos

- cegado establece dificultad herculea.
- inconsciente pone habilidades y atributos derivados a cero.
- aturdido e inconsciente impiden atacar, pero los demás estados no.
- inconsciente impide atacar y defenderse, mientras aturdido permite defenderse.
- sangrando y ahogándose exigen resistencia por asalto.
- ácido se registra como estado sin imponer una penalización adicional.
- ardiendo se registra como estado neutral resuelto por la cola del DJ.
- asfixiándose se registra como estado neutral antes de exigir Aguante.
- agonizando se registra y bloquea los ataques.
- sorprendido penaliza iniciativa y bloquea ataque y defensa.
- derribado establece dificultad formidable.
- varios estados conservan la peor dificultad y sus fuentes.

## style-standards.test.js

[Abrir código](../tests/style-standards.test.js) · 23 casos

- hojas y mensajes Mythras comparten la superficie de papel.
- los diálogos Mythras aplican la superficie de papel a la ventana completa.
- la suerte simple es repetible y usa el personaje participante del grupo activo.
- el diálogo de tirada separa origen, efecto y dificultad final.
- el ataque reutiliza los ajustes porcentuales sin configurar un concurso.
- el daño maximizado se identifica y la hoja de efecto apila sus secciones.
- la familiaridad de combate muestra descriptores localizados y solo penaliza cuando procede.
- la superficie compartida queda registrada como estándar visual.
- todos los campos editables son transparentes y el estándar prohíbe fondos coloreados.
- todos los atributos derivados ofrecen el tooltip retrasado compartido.
- los cuatro métodos de características comparten fila y libre usa campos editables.
- catálogo e inventario alinean cabeceras y filas con la misma cuadrícula.
- la pestaña de penalizaciones usa una tabla semántica y tipografía compartida.
- la ficha de arma separa modos por tipo y expone parámetros de rasgo.
- la ficha de arma envía una sola moneda y combate muestra los PG actuales.
- las acciones de modo y rasgo son distintas y la durabilidad natural se explica.
- la configuración de arma separa ejemplar y situación del personaje.
- la ficha de estilo resume asociaciones y separa el cálculo no editable.
- el asistente crea o importa estilos y delega armas y rasgos en su hoja.
- los mensajes de chat usan exclusivamente el hook HTML compatible.
- equipo inicial y pasiones respetan asociaciones y cuadrículas compartidas.
- las pasiones validadas se materializan durante el asistente.
- las hojas de Item y el creador usan recuadros discretos sin superficie propia.

## suffocation.test.js

[Abrir código](../tests/suffocation.test.js) · 5 casos

- el icono local de asfixia existe.
- la preparación y la actividad ajustan el tiempo de Aguante.
- cada asalto consume cinco segundos y la tirada comienza al alcanzar el umbral.
- las fracciones de segundo se conservan antes de convertir a asaltos.
- la preparación del mismo asalto no avanza dos veces el contador.

## system-roll.test.js

[Abrir código](../tests/system-roll.test.js) · 4 casos

- manual roll gesture is exclusive to a shifted Gamemaster action.
- die requirements preserve every physical die in mixed formulas.
- manual die validation requires integers within each die range.
- a manual roll has normal evaluated dice and no disclosure metadata.

## tactical-overview-names.test.js

[Abrir código](../tests/tactical-overview-names.test.js) · 1 casos

- el menú táctico resuelve personajes y PNJ con los nombres compartidos.

## tactical-overview-ui.test.js

[Abrir código](../tests/tactical-overview-ui.test.js) · 2 casos

- el menú táctico filtra armas y mantiene sus acciones dentro de la ventana.
- las tablas tácticas conservan el contenido transparente y destacan sus cabeceras.

## timed-conditions.test.js

[Abrir código](../tests/timed-conditions.test.js) · 6 casos

- las duraciones configurables por asaltos se reducen hasta expirar.
- una condición aplicada durante el turno actual se arma sin descontarse.
- Titubear consume incluso la condición aplicada durante el turno actual.
- varios turnos solo descuentan uno por final de turno propio.
- las duraciones de asalto solo vencen en su combate.
- la matriz periódica y la fatiga respetan sus límites.

## token-linking.test.js

[Abrir código](../tests/token-linking.test.js) · 2 casos

- los tokens de personaje se enlazan y los PNJ conservan instancias independientes.
- la creación configura personajes enlazados y PNJ independientes.

## traits.test.js

[Abrir código](../tests/traits.test.js) · 7 casos

- el compendio comparte un unico tipo de Item para los 83 rasgos.
- los requisitos grupales son datos estructurados y no forman parte del nombre.
- el texto antiguo se convierte en referencias y conserva lo desconocido.
- las armas oficiales usan referencias estructuradas incluso por modo.
- la consulta y el registro de reglas dependen de claves estables.
- las referencias duplicadas no se incorporan dos veces.
- las criaturas consultan sus rasgos embebidos con la API compartida.

## weapon-durability.test.js

[Abrir código](../tests/weapon-durability.test.js) · 2 casos

- la durabilidad deriva estados sin persistirlos.
- el daño de arma usa PA, limita PG a cero y clasifica el resultado.

## weapon-modes.test.js

[Abrir código](../tests/weapon-modes.test.js) · 5 casos

- un arma antigua produce un modo equivalente sin perder su estilo.
- un modo hereda el perfil físico o puede sobrescribirlo.
- las claves duplicadas se detectan.
- el nombre físico solo añade un sufijo cuando el modo lo necesita.
- el asistente conserva datos físicos y solo combina modos.

## weapons.test.js

[Abrir código](../tests/weapons.test.js) · 7 casos

- el compendio contiene las 63 armas revisadas y el ataque sin armas de Imperativo.
- todas las entradas conservan fuente, coste, época y perfil reutilizable.
- Puño/Patada conserva los datos de Mythras Imperativo.
- los siete objetos con varios usos reúnen sus modos en una sola entrada.
- las columnas especiales de distancia y asedio quedan estructuradas.
- los escudos conservan sus localizaciones de bloqueo pasivo.
- el compendio no duplica datos de modo ni conserva peso o rasgos de texto.

## wound-consequences.test.js

[Abrir código](../tests/wound-consequences.test.js) · 5 casos

- una herida grave siempre aturde y el fallo decide la consecuencia anatómica.
- una herida crítica comparte las consecuencias de extremidad y zona vital.
- la resolución manual conserva solo las consecuencias independientes de Aguante.
- el ejecutor común aplica las acciones en orden.
- los peligros resuelven Aguante como tirada simple sin oponente.
