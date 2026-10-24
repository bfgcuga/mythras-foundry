# Roadmap

Este documento enumera, en orden, los próximos pasos acordados del proyecto.
El trabajo confirmado que todavía no tiene prioridad ni posición se mantiene en
[`pending.md`](pending.md). Las funcionalidades terminadas se describen en
[`README.md`](../README.md) y las decisiones técnicas vigentes en
[`architecture.md`](architecture.md).

La revisión de estados está cerrada: catálogo traducido y ordenado, duplicados
unificados, iconos validados y activación automática de Envenenado y Enfermo.
El estado definitivo se describe en [`status-catalog.md`](status-catalog.md).

## 1. Revisar las acciones activas

Revisar prioritariamente estas acciones:

- Cambiar alcance.
- Retener Magia.
- Usar Magia.
- Apuntar.

Revisar las acciones del sistema una por una, contrastando su comportamiento
actual con las reglas aplicables. Identificar las que tienen lógica incorrecta,
implementación incompleta o resolución únicamente guiada, y corregir o completar
su flujo según corresponda. Comprobar requisitos, disponibilidad, coste en PA,
tiradas, consecuencias y cierre o avance del turno, con pruebas de los
comportamientos corregidos. La revisión determinará el alcance concreto de las
acciones diferenciales pendientes del punto 4.

Montar, Mover, Titubear y Buscar cobertura ya están revisadas y aprobadas.
La acción genérica ya permite describir una acción, gastar un PA y publicarla en el chat.

## 2. Revisar las resoluciones manuales de flujos interactivos

Revisar todas las apariciones de «Resolver manualmente» y determinar, caso por
caso, si la acción es reglamentaria o debe sustituirse por la tirada o decisión
correspondiente. Evitar cierres accidentales, consecuencias omitidas y bloqueos
en intercambios, estados y peligros.

## 3. Definir y aplicar los permisos y la visibilidad de Items

La matriz de actores ya está aplicada: GM y OWNER ven la hoja completa; LIMITED
y OBSERVER comparten la vista de consulta sin tiradas ni edición; NONE no abre
la hoja. Las opciones de mundo controlan armas, localizaciones, Estado y magia/
suerte para no propietarios. PJ y PNJ comparten Galería.

Queda definir y aplicar la matriz de Items: apertura de sus hojas, datos visibles,
campos editables, acciones permitidas y pestañas administrativas, con pruebas de
los límites relevantes. No ampliar automáticamente a Items la vista pública de
los actores.

## 4. Integrar las acciones diferenciales pendientes

Conectar Cargar con la transacción
diferencial completa. El catálogo ya conserva coste, participantes y parámetros,
pero la resolución de esta acción sigue siendo guiada. Maniobrar ya utiliza
una enfrentada de Evadir con una respuesta individual por rival y confirmación
de consecuencias.

## 5. Implementar Entrenar Habilidad

Desarrollar el flujo completo de entrenamiento, incluyendo requisitos, coste o
tiempo aplicable, resolución, persistencia y presentación en la hoja.

## 6. Refactorizar el motor de consecuencias de asalto

Separar en `round-consequences.js` el modelo de cola, los ejecutores, el
renderizado y el transporte, sin cambiar las reglas ni el comportamiento actual.
Conservar el esquema persistido, la reanudación de entradas pendientes y las
transiciones y validaciones actuales mediante pruebas durante la extracción.

Es una mejora de mantenimiento y no un requisito previo para los bloques
funcionales anteriores. Los Items de venenos, enfermedades y trampas y sus
tiradas guiadas no dependen de esta cola; su seguimiento temporal sigue a cargo
del DJ. Reconsiderar esta prioridad si se acuerda ampliar significativamente
las consecuencias automáticas de asalto. Las fronteras y restricciones están
detalladas en [`refactoring.md`](refactoring.md).

## 7. Reparar armas y armaduras dañadas o destruidas

Diseñar acciones para reparar armas y armaduras dañadas o destruidas. Queda
por decidir si viven en la hoja del Item o en Inventario y cómo se calcula y
cobra su coste económico antes de restaurar sus PG o PA. No incluye la marca
«Inutilizada», cuya reparación gratuita ya se resuelve desde Inventario.
