# Roadmap

Este documento enumera, en orden, los próximos pasos acordados del proyecto.
El trabajo confirmado que todavía no tiene prioridad ni posición se mantiene en
[`pending.md`](pending.md). Las funcionalidades terminadas se describen en
[`README.md`](../README.md) y las decisiones técnicas vigentes en
[`architecture.md`](architecture.md).

## 1. Revisar la lógica y la implementación de las acciones

Revisar las acciones del sistema una por una, contrastando su comportamiento
actual con las reglas aplicables. Identificar las que tienen lógica incorrecta,
implementación incompleta o resolución únicamente guiada, y corregir o completar
su flujo según corresponda. Comprobar requisitos, disponibilidad, coste en PA,
tiradas, consecuencias y cierre o avance del turno, con pruebas de los
comportamientos corregidos. La revisión determinará el alcance concreto de las
acciones diferenciales pendientes del punto 5.

## 2. Revisar las resoluciones manuales de flujos interactivos

Revisar todas las apariciones de «Resolver manualmente» y determinar, caso por
caso, si la acción es reglamentaria o debe sustituirse por la tirada o decisión
correspondiente. Evitar cierres accidentales, consecuencias omitidas y bloqueos
en intercambios, estados y peligros.

## 3. Definir y aplicar la matriz de permisos y visibilidad

Definir el comportamiento de `NONE`, `LIMITED`, `OBSERVER` y `OWNER` antes de
ampliar las hojas. La matriz debe cubrir:

- permiso para abrir cada hoja;
- pestañas y datos visibles;
- campos editables;
- acciones y tiradas permitidas;
- visibilidad de las pestañas administrativas de Items;
- si `OBSERVER` puede tirar o únicamente consultar.

Aplicar después la matriz de forma coherente a personajes, PNJ e Items y cubrir
los límites relevantes con pruebas.

## 4. Separar las responsabilidades de las consecuencias de asalto

Separar en `round-consequences.js` el modelo de cola, los ejecutores, el
renderizado y el transporte antes de ampliar significativamente los peligros.
Conservar las transiciones y validaciones actuales mediante pruebas durante la
extracción. Las fronteras y restricciones del refactor están detalladas en
[`refactoring.md`](refactoring.md).

## 5. Integrar las acciones diferenciales pendientes

Conectar Forcejear, Ponerse en Pie y Cargar con la transacción
diferencial completa. El catálogo ya conserva coste, participantes y parámetros,
pero la resolución de esas acciones sigue siendo guiada. Maniobrar ya utiliza
una enfrentada de Evadir con una respuesta individual por rival y confirmación
de consecuencias.

## 6. Implementar venenos, enfermedades y trampas

Incorporar reglas, configuración, resolución, persistencia y presentación para
venenos, enfermedades y trampas sobre la infraestructura separada de
consecuencias. Mantener fuera de este alcance las inclemencias y macros de clima
hasta que sus reglas estén definidas.

## 7. Implementar Entrenar Habilidad

Desarrollar el flujo completo de entrenamiento, incluyendo requisitos, coste o
tiempo aplicable, resolución, persistencia y presentación en la hoja.
