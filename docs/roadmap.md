# Roadmap

Este documento enumera, en orden, los próximos pasos acordados del proyecto.
El trabajo confirmado que todavía no tiene prioridad ni posición se mantiene en
[`pending.md`](pending.md). Las funcionalidades terminadas se describen en
[`README.md`](../README.md) y las decisiones técnicas vigentes en
[`architecture.md`](architecture.md).

## 1. Completar la división del coordinador de combate

Extraer de `combat-chat.js` la aplicación documental completa de daño y la
ejecución inmediata de efectos. El estado, la validación, el renderizado, el
socket, la preparación del daño y las consecuencias de heridas ya están
separados.

Se considerará terminado cuando las transiciones de daño y efectos tengan
servicios y pruebas propios, sus dependencias Foundry sean explícitas y
`combat-chat.js` se limite a componerlos y conservar la API pública.

## 2. Completar las opciones fundamentales de ataque y parada

- Garantizar que todo personaje pueda atacar con el perfil estable
  `puno-patada`: usar un estilo compatible cuando exista y, en caso contrario,
  el porcentaje efectivo de la habilidad básica `pelea`.
- Asociar la tirada y una posible pifia a la habilidad realmente utilizada.
- Permitir parar con armas naturales únicamente cuando el Actor posea el rasgo
  `formidable-natural-weapons`. Las armas manufacturadas no dependen de él.
- Cubrir ambos comportamientos con pruebas.

## 3. Completar Elegir Localización sobre extremidades lisiadas

Al elegir una extremidad afectada por una lesión permanente, tirar `1d3` para
determinar si se alcanza la parte restante. Esta resolución no debe reutilizar
la tirada aleatoria de localización que descarta resultados anulados.

## 4. Integrar las acciones diferenciales pendientes

Conectar Forcejear, Maniobrar, Ponerse en Pie y Cargar con la transacción
diferencial completa. El catálogo ya conserva coste, participantes y parámetros,
pero la resolución sigue siendo guiada.

## 5. Implementar Entrenar Habilidad

Desarrollar el flujo completo de entrenamiento, incluyendo requisitos, coste o
tiempo aplicable, resolución, persistencia y presentación en la hoja.
