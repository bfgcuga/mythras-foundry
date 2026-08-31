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

## 2. Integrar las acciones diferenciales pendientes

Conectar Forcejear, Maniobrar, Ponerse en Pie y Cargar con la transacción
diferencial completa. El catálogo ya conserva coste, participantes y parámetros,
pero la resolución sigue siendo guiada.

## 3. Implementar Entrenar Habilidad

Desarrollar el flujo completo de entrenamiento, incluyendo requisitos, coste o
tiempo aplicable, resolución, persistencia y presentación en la hoja.
