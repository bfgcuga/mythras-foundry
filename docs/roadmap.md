# Roadmap

Este documento enumera, en orden, los próximos pasos acordados del proyecto.
El trabajo confirmado que todavía no tiene prioridad ni posición se mantiene en
[`pending.md`](pending.md). Las funcionalidades terminadas se describen en
[`README.md`](../README.md) y las decisiones técnicas vigentes en
[`architecture.md`](architecture.md).

## 1. Revisar las acciones activas

Revisar prioritariamente estas acciones:

- Buscar cobertura.
- Cambiar alcance.
- Forcejear.
- Retener Magia.
- Usar Magia.

Revisar las acciones del sistema una por una, contrastando su comportamiento
actual con las reglas aplicables. Identificar las que tienen lógica incorrecta,
implementación incompleta o resolución únicamente guiada, y corregir o completar
su flujo según corresponda. Comprobar requisitos, disponibilidad, coste en PA,
tiradas, consecuencias y cierre o avance del turno, con pruebas de los
comportamientos corregidos. La revisión determinará el alcance concreto de las
acciones diferenciales pendientes del punto 5.

Montar, Mover y Titubear ya están revisadas y aprobadas. La acción genérica
ya permite describir una acción, gastar un PA y publicarla en el chat.

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

## 4. Separar las responsabilidades de las consecuencias de asalto

Separar en `round-consequences.js` el modelo de cola, los ejecutores, el
renderizado y el transporte antes de ampliar significativamente los peligros.
Conservar las transiciones y validaciones actuales mediante pruebas durante la
extracción. Las fronteras y restricciones del refactor están detalladas en
[`refactoring.md`](refactoring.md).

## 5. Integrar las acciones diferenciales pendientes

Conectar Forcejear y Cargar con la transacción
diferencial completa. El catálogo ya conserva coste, participantes y parámetros,
pero la resolución de esas acciones sigue siendo guiada. Maniobrar ya utiliza
una enfrentada de Evadir con una respuesta individual por rival y confirmación
de consecuencias.

## 6. Implementar Entrenar Habilidad

Desarrollar el flujo completo de entrenamiento, incluyendo requisitos, coste o
tiempo aplicable, resolución, persistencia y presentación en la hoja.

## 7. Reparar armas y armaduras dañadas o destruidas

Diseñar acciones para reparar armas y armaduras dañadas o destruidas. Queda
por decidir si viven en la hoja del Item o en Inventario y cómo se calcula y
cobra su coste económico antes de restaurar sus PG o PA. No incluye la marca
«Inutilizada», cuya reparación gratuita ya se resuelve desde Inventario.
