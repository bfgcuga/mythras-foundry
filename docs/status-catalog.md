# Catálogo de estados

El selector del token ordena conjuntamente todos los estados por su nombre
localizado. Aquí se separan por origen para facilitar su revisión.

## Mythras (31 entradas)

Incluye los estados de Foundry sustituidos por definiciones propias. Las dos
fases de Sorprendido comparten nombre en el selector, pero tienen distinto ID.

| Estado | ID |
| --- | --- |
| Afianzado | `braced` |
| Agachado tras el escudo | `crouchedBehindShield` |
| Agarrado | `grabbed` |
| Agonizando | `dying` |
| Ahogándose | `drowning` |
| Ardiendo | `burning` |
| Arma inmovilizada | `weaponPinned` |
| Asfixiándose | `suffocating` |
| Aturdido | `stunned` |
| Cegado | `blinded` |
| Derribado | `prone` |
| Desangrándose | `exsanguinating` |
| Desequilibrado | `offBalance` |
| Empalado | `impaled` |
| Enfermo | `disease` |
| Enredado | `entangled` |
| Envenenado | `poison` |
| Esperando | `waiting` |
| Incapacitado | `incapacitated` |
| Inconsciente | `unconscious` |
| Inmersión en ácido | `acidImmersion` |
| Localización aturdida | `stunnedLocation` |
| Presionado | `pressed` |
| Protegido por maniobra | `maneuverProtected` |
| Salpicadura de ácido | `acidSplash` |
| Sangrando | `bleeding` |
| Silenciado | `silenced` |
| Sorprendido | `surprised` |
| Sorprendido (fase ofensiva) | `surprisedOffensive` |
| Suprimido | `suppressed` |
| Torso aturdido | `stunnedTorso` |

## Básicos de Foundry conservados (25 entradas de referencia)

Corresponden a los estados básicos indicados en la revisión del selector de
Foundry 13. No incluyen los sustituidos por Mythras ni estados de otros módulos.
Los identificadores de escudos admiten variantes de mayúsculas y alias para
compatibilidad; esos alias no crean estados adicionales. La composición real
depende de la configuración de Foundry y los módulos instalados.

| Estado | ID de referencia |
| --- | --- |
| Asustado | `fear` |
| Bendecido | `bless` |
| Congelado | `cold` |
| Corroyéndose | `corrode` |
| Debilitado | `weaken` |
| Degenerándose | `degen` |
| Dormido | `asleep` |
| Electrocutado | `shock` |
| Escudo de fuego | `shieldFire` |
| Escudo de hielo | `shieldIce` |
| Escudo mágico | `shieldMagic` |
| Escudo sagrado | `shieldHoly` |
| Excavando | `burrow` |
| Invisible | `invisible` |
| Levitando | `hover` |
| Maldito | `curse` |
| Marcado | `mark` |
| Muerto | `dead` |
| Paralizado | `paralysis` |
| Potenciado | `empower` |
| Regenerándose | `regen` |
| Restringido | `restrain` |
| Seleccionado como objetivo | `target` |
| Sordo | `deaf` |
| Volando | `fly` |

Envenenado (`poison`) y Enfermo (`disease`) pertenecen al catálogo de Mythras:
se activan al aplicar el Item, al perder su resistencia o al confirmar daño de
esa aflicción. El DJ retira el marcador cuando corresponda; no se automatizan
sus tiempos ni efectos específicos. Muerto es utilizado por el flujo de muerte.
Aturdido, Cegado y Silenciado tienen una sola entrada: `stunned`, `blinded` y
`silenced`. Los alias antiguos `stun`, `blind` y `silence` se retiran del selector
y se normalizan al crear o actualizar estados. La migración de actores y tokens
no vinculados sustituye esos identificadores sin borrar efectos ni modificar
sus duraciones, fuentes o imágenes personalizadas. La referencia especial
`CONFIG.specialStatusEffects.BLIND` apunta a `blinded` para conservar la ceguera
de Foundry. No se fusionan documentos ActiveEffect independientes, que pueden
representar fuentes o duraciones diferentes.

## Iconos propios

Los 57 dibujos de las láminas aportadas por el usuario se guardan como PNG de
144 × 144 en `assets/icons/statuses/`, con nombres correspondientes a sus IDs.
`catalog.json` registra la correspondencia con las filas de la lámina, los
centros de recorte y los alias. Los PNG activos usan fondo negro opaco. La variante anterior con fondo de color
se conserva en `assets/icons/statuses/obsolete/colored-background/`.
Aturdido (`stun` / `stunned`) y Silenciado (`silence` / `silenced`) comparten dibujo.

`scripts/data/status-icons.js` centraliza las rutas para el selector del token,
el catálogo de Mythras, el gestor de estados y la creación de ActiveEffects.
Al cargar el mundo, el DJ principal actualiza los iconos predeterminados de los
efectos existentes en actores y tokens no vinculados, conservando imágenes
personalizadas. La migración de alias descrita arriba normaliza los identificadores antiguos.

La variante negra procede de una edición de la lámina con la herramienta
integrada `image_gen`: conservar los 57 símbolos y su posición, sustituir los
fondos de color por negro puro y aclarar los contornos oscuros para tamaños
pequeños. La lámina resultante se conserva en
`docs/artwork/status-icons-black-sheet.png`; se divide en 12 columnas y 5 filas
iguales y cada celda se guarda a 144 × 144. La última fila tiene nueve dibujos.
El selector reconoce también variantes de ID y etiquetas básicas de Foundry
(por ejemplo `sleep`, `frozen`, `upgrade`, `downgrade`) al traducir y asignar iconos.

La legibilidad de los iconos está validada por el usuario en Foundry. Se da por
completada la puesta en orden del catálogo. Cegado no requiere automatismos
adicionales de visión; no quedan comprobaciones de ese tipo pendientes.
