# Roadmap

Este documento enumera, en orden, los próximos pasos acordados del proyecto.
El trabajo confirmado que todavía no tiene prioridad ni posición se mantiene en
[`pending.md`](pending.md). Las funcionalidades terminadas se describen en
[`README.md`](../README.md) y las decisiones técnicas vigentes en
[`architecture.md`](architecture.md).

## 1. Completar las opciones fundamentales de ataque y parada

- Garantizar que todo personaje pueda atacar con el perfil estable
  `puno-patada`: usar un estilo compatible cuando exista y, en caso contrario,
  el porcentaje efectivo de la habilidad básica `pelea`.
- Asociar la tirada y una posible pifia a la habilidad realmente utilizada.
- Permitir parar con armas naturales únicamente cuando el Actor posea el rasgo
  `formidable-natural-weapons`. Las armas manufacturadas no dependen de él.
- Cubrir ambos comportamientos con pruebas.

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
extracción.

## 5. Integrar las acciones diferenciales pendientes

Conectar Forcejear, Maniobrar, Ponerse en Pie y Cargar con la transacción
diferencial completa. El catálogo ya conserva coste, participantes y parámetros,
pero la resolución sigue siendo guiada.

## 6. Implementar venenos, enfermedades y trampas

Incorporar reglas, configuración, resolución, persistencia y presentación para
venenos, enfermedades y trampas sobre la infraestructura separada de
consecuencias. Mantener fuera de este alcance las inclemencias y macros de clima
hasta que sus reglas estén definidas.

## 7. Implementar Entrenar Habilidad

Desarrollar el flujo completo de entrenamiento, incluyendo requisitos, coste o
tiempo aplicable, resolución, persistencia y presentación en la hoja.
