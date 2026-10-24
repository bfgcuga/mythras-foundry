# Munición y armas arrojadizas

La tienda vende paquetes: comprar «Flechas (fajo de doce)» crea «Flechas» con
cantidad 12 en Inventario. Dos compras conservan dos existencias independientes;
la cantidad total es 24. El precio y la carga se reparten por unidad. Las
existencias agotadas permanecen con cantidad cero. Inventario muestra los costes
con un máximo de un decimal; los cálculos conservan el valor unitario exacto.

## Recargar y disparar

1. Equipa el modo de disparo del arma.
2. En tu turno, pulsa Recargar y elige el arma y una existencia compatible.
   La última utilizada aparece seleccionada si aún está disponible.
3. Cada uso cuesta 1 PA y pasa el turno, aunque falten acciones para cargar.
   Durante una interrupción, cierra la acción y devuelve la decisión al DJ.
   Al completar las acciones requeridas, el arma queda cargada. La cantidad del inventario todavía no cambia.
4. Al disparar, se descuenta una unidad del inventario y de la carga aunque
   el ataque falle. Suerte no consume otro proyectil.

La columna Recarga de Combate muestra el progreso con «Acc.» (por ejemplo,
`1/2 Acc.`) y debajo los proyectiles disponibles con «Munic» (`20 Munic`). Un arma cargada muestra `2/2`
si requiere dos acciones, y vuelve a `0/2` al disparar.

Total incluye las unidades cargadas. Disponible excluye las cargas de todas
las armas que usan la misma existencia. La munición transportada en un carcaj
u otro contenedor es elegible; la almacenada en propiedades o vehículos no.
Cambiar de existencia al recargar descarga lo anterior y comienza la recarga
normal con la nueva selección. Cancelar el diálogo no altera cargas ni PA.
Si modificas o retiras munición y las cargas dejan de ser válidas, se vacían
con un aviso y debes volver a recargar.

## Contenido propio

En el modo del arma configura «Uso de munición» y «Tipo de munición». Los
proyectiles externos requieren un tipo igual al de un Item de munición. Los
tipos oficiales son `arrow`, `bolt`, `sling`, `blowgun`, `atlatl-dart` y `siege`;
pueden usarse identificadores propios. Un modo arrojadizo lanza el propio Item.
«Sin munición» permite modos que no consumen proyectiles.

Los Items de munición propios admiten unidades por paquete y nombre por unidad
antes de incorporarlos al actor. Para crear existencias directamente en el
inventario usa unidades por paquete 1 y la cantidad real de proyectiles.

## Arrojadizas

Cada arma es un ejemplar. Tras lanzarla sigue en Inventario, aparece roja con
«Lanzada» y no puede atacar, parar ni aportar bloqueo pasivo. Pulsa Recuperar
cuando decidáis que se ha recogido: no cuesta PA y no la equipa automáticamente.
La recuperación no repara daños ni elimina restricciones. Un arma empalada
requiere primero su extracción normal.

## Conversión de mundos anteriores

El DJ principal convierte los fajos a unidades y crea existencias a partir de
la reserva y carga antiguas de cada modo identificado. Esas cantidades se
**suman** a la munición previamente comprada, tal como se acordó: no se presume
que representen los mismos proyectiles. Se conserva la carga y se reinicia el
progreso parcial. Los modos propios sin tipo reconocible mantienen sus datos
hasta configurar la compatibilidad. Repetir la migración no vuelve a sumar.
