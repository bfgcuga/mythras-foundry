# Catálogo de estados

El selector del token ordena conjuntamente todos los estados por su nombre
localizado. Aquí se separan por origen para facilitar su revisión.

## Mythras (29 entradas)

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
| Enredado | `entangled` |
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

## Básicos de Foundry conservados (30 entradas de referencia)

Corresponden a los estados básicos indicados en la revisión del selector de
Foundry 13. No incluyen los sustituidos por Mythras ni estados de otros módulos.
Los identificadores de escudos admiten variantes de mayúsculas y alias para
compatibilidad; esos alias no crean estados adicionales. La composición real
depende de la configuración de Foundry y los módulos instalados.

| Estado | ID de referencia |
| --- | --- |
| Asustado | `fear` |
| Aturdido | `stun` |
| Bendecido | `bless` |
| Ciego | `blind` |
| Congelado | `cold` |
| Corroyéndose | `corrode` |
| Debilitado | `weaken` |
| Degenerándose | `degen` |
| Dormido | `asleep` |
| Electrocutado | `shock` |
| Enfermo | `disease` |
| Envenenado | `poison` |
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
| Silenciado | `silence` |
| Sordo | `deaf` |
| Volando | `fly` |

Traducir estos marcadores no añade aplicación automática por venenos o
enfermedades. Muerto sí es utilizado por el flujo de muerte de Mythras.
Aturdido (`stun` / `stunned`), Ciego/Cegado (`blind` / `blinded`) y Silenciado
(`silence` / `silenced`) son entradas distintas: esta mejora no las fusiona.

## Iconos propios

Los 57 dibujos de las láminas aportadas por el usuario se guardan como PNG de
144 × 144 en `assets/icons/statuses/`, con nombres correspondientes a sus IDs.
`catalog.json` registra la correspondencia con las filas de la lámina, los
centros de recorte y los alias. Se conserva el fondo de color original.
Aturdido (`stun` / `stunned`) y Silenciado (`silence` / `silenced`) comparten dibujo.

`scripts/data/status-icons.js` centraliza las rutas para el selector del token,
el catálogo de Mythras, el gestor de estados y la creación de ActiveEffects.
Al cargar el mundo, el DJ principal actualiza los iconos predeterminados de los
efectos existentes en actores y tokens no vinculados, conservando imágenes
personalizadas. No modifica las reglas ni los identificadores de los estados.
