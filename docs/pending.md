# Trabajo pendiente

Este documento reúne trabajo confirmado que todavía no tiene una posición en el
roadmap. No expresa orden de ejecución. Cuando una tarea adquiera prioridad y
alcance cerrado debe trasladarse a [`roadmap.md`](roadmap.md).

## Combate y automatización

- Diseñar y revisar una matriz general de compatibilidad entre efectos de
  combate. «Dañar Arma» ya distingue los efectos ligados al daño corporal o a
  las defensas del golpe de las consecuencias independientes, pero el mismo
  criterio deberá generalizarse cuando se automaticen nuevas interacciones.
- Revisar si «Cancelar» debe seguir disponible después de confirmar la elección
  de efectos de combate, ya que actualmente impide cerrar automáticamente un
  intercambio terminal y avanzar la iniciativa.
- Eliminar las notas moradas temporales «Automatizado» y «No automatizado» de
  la tarjeta de ataque cuando deje de ser necesario auditar visualmente la
  cobertura de automatización de los efectos de combate.
- Ampliar las consecuencias persistentes de efectos que todavía dependen de
  geometría o decisiones narrativas, incluidos Alcance, Cambiar Alcance,
  Bloqueo Pasivo y fuentes liberables. Los efectos Abrir Distancia, Cerrar
  Distancia y Retirada están completos y quedan fuera de este pendiente;
  no requieren movimiento de tokens ni comprobaciones de geometría adicionales.
  La inmovilización de armas ya
  identifica el Item y su captor, resuelve su liberación enfrentada y se limpia
  al destrabarse. Agarrar ya vincula captor, bloquea distancia y retirada y
  resuelve la liberación enfrentada. Enredar ya conserva su fuente y localización,
  bloquea movimiento u objetos, aplica su dificultad y resuelve liberación y
  derribo posterior.
- Completar la automatización de magia y monturas cuando existan esos
  subsistemas; hasta entonces sus efectos figuran como no automatizados y no
  interrumpen el intercambio.
- Valorar múltiples coberturas simultáneas por combatiente. Antes de
  implementarlas hay que definir cómo se combinan protección, localizaciones y
  cobertura completa.
- Realizar la revisión estética final del menú de situación táctica cuando sus
  controles, permisos y operaciones estén estabilizados.

## Hoja de arma

- Permitir eliminar manualmente estados del arma desde el desplegable de estados
  de Configuración para corregir situaciones en las que falle la lógica automática.
  La hoja ya explica los estados activos y permite editar «Inutilizada»; queda
  añadir la retirada de los demás estados desde ese desplegable. La corrección
  debe limpiar también los indicadores y efectos relacionados, de modo que el
  arma no conserve bloqueos incoherentes ni referencias de combate obsoletas.
  Es una herramienta de corrección manual, complementaria a las acciones
  habituales de liberación, extracción y recuperación.

## Armaduras y morfologías

- Revisar si las piezas anatómicas humanas —yelmos, petos, faldares, brazales y
  grebas— deben poder utilizarse en morfologías no humanas cuando exista una
  zona semánticamente equivalente. Si se admite parcialmente, definir una
  matriz explícita de compatibilidad entre tipo de pieza y morfología, evitando
  equivalencias absurdas como asignar automáticamente un yelmo humano a la
  cabeza de una araña gigante. Valorar como solución un rasgo explícito
  «Humanoide», independiente de `system.morphologyKey`: la morfología seguiría
  definiendo la tabla anatómica y el rasgo permitiría usar piezas humanas solo
  en las zonas que declaren una equivalencia compatible (`head`, `chest`,
  `abdomen`, brazos o piernas). La compatibilidad no debe deducirse únicamente
  del nombre o del rango d20. Hasta resolverlo, estas piezas solo se asignan
  automáticamente a anatomías humanoides y las demás emplean «Pieza de
  armadura» vinculada a una localización concreta.

## Peligros

Los Items de trampas, venenos y enfermedades, sus nueve ejemplos y tiradas
guiadas ya están implementados. Su alcance actual deja al DJ el seguimiento
de aparición, duración, condiciones específicas, curación y secuelas; Envenenado
y Enfermo ya se activan automáticamente al aplicar la aflicción o perder la
resistencia. No hay una ampliación temporal automática acordada.

- Definir el alcance de las inclemencias del tiempo —frío, calor, exposición u
  otros peligros— antes de crear sus macros.
- Crear las macros de clima una vez definidas esas reglas.

El método porcentual para multitudes no requiere automatización: corresponde a
una resolución directa del Game Master.

## Creación de personajes

- Enumerar las tablas aleatorias adicionales realmente aplicables, como
  comunidad o edad, antes de implementarlas. Las tablas familiares, reputación,
  conexiones, matrimonio y acontecimientos de trasfondo ya existen.
- Sustituir la edición directa del JSON de culturas y profesiones por un editor
  visual con menús y habilidades arrastrables.

## Menús

- Inventariar los menús del sistema e indicar cuáles tienen un encabezado con
  título equivalente al de la hoja de personaje y cuáles carecen de él. Tras la
  revisión, aplicar ese formato compartido a todos los menús donde corresponda.

## Deuda técnica no priorizada

- Resolver la contradicción de `architecture.md` sobre el orden de aplicación
  del daño y las comprobaciones de Aguante: unos párrafos sitúan la aplicación
  de PG antes de las consecuencias dependientes de la resistencia, mientras
  que el párrafo sobre la cola de comprobaciones secundarias exige resolverlas
  antes de aplicar los PG. Contrastar ambas descripciones con los runtimes y
  sus pruebas y documentar el flujo vigente de forma coherente, distinguiendo
  comprobaciones de efectos y de heridas y sus fases.
- Aplicar los candidatos sin prioridad descritos en
  [`refactoring.md`](refactoring.md): extraer el asistente de creación de
  trasfondo, aligerar la fachada de combate y el registro principal de hooks,
  modularizar con cautela la hoja de estilos y sustituir pruebas acopladas a la
  implementación por contratos observables.
- Evaluar una infraestructura común para transacciones interactivas a partir de
  los patrones ya separados en combate; no abstraer sin consumidores adicionales
  estables en combate, concursos, alcance y consecuencias de asalto.
