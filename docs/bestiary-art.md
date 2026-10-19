# Ilustraciones del bestiario

Las cuatro láminas entregadas por el usuario cubren los 67 diseños del JSON:
no queda ninguna criatura pendiente de ilustración. Los recortes conservan sus
píxeles y fondo negro en WebP sin pérdida, con lienzos rectangulares, encuadres
individuales y ocho píxeles de margen. No se amplía artificialmente la resolución.
Las máscaras separan fragmentos de figuras vecinas; la última cuadrícula se
recorta por el interior de las líneas divisorias.

## Cobertura y asignación

Hay 92 recortes: 67 diseños asignados y 25 alternativas o figuras adicionales.
Los 67 diseños cubren los 116 Actors. Los cinco tipos elementales comparten
ilustración entre sus diez volúmenes y los cinco enjambres comparten la suya.
La miniatura del compendio y el retrato de ficha usan `Actor.img`; el token usa
la misma ruta en `prototypeToken.texture.src`.

Las imágenes se asignan por identidad visual, no por posición: las tres primeras
láminas contienen repeticiones y criaturas ajenas al JSON. La cuarta completa
los 16 diseños pendientes. El cadáver demacrado de la tercera lámina se interpreta
como necrófago. La mantícora y el vampiro muestran variantes aladas en las
ilustraciones suministradas. Los rasgos visuales no cambian reglas ni anatomías.

La asignación se aplica al catálogo completo después de generar sus variantes.
Así el Ofidio no hereda accidentalmente el retrato del hombre lagarto del que se
deriva su perfil. Los identificadores de los Actors no cambian.

## Fuentes y reproducción

- `assets/creatures/`: 67 ilustraciones distribuidas con el sistema.
- `scripts/art/creature-descriptions.json`: los 67 nombres y descripciones originales.
- `scripts/art/bestiary-regions.json` y `bestiary-*-regions.json`: nombres,
  archivos, regiones y correspondencias de las cuatro láminas.
- `scripts/art/extract_bestiary*.py`: extracción con Python y Pillow. Cada
  script recibe la ruta de su lámina; el primero utiliza la versión sin rótulos.
  Los originales esperados son de 1536 × 1024 píxeles.
- `node scripts/art/build-art-manifest.mjs`: reconstruye el registro de imágenes
  y `output/criaturas-imagenes-pendientes.json`, actualmente una lista vacía.
- `node scripts/dev/build-packs.mjs creatures`: reconstruye el compendio.
- `python scripts/art/archive_bestiary.py`: empaqueta las cuatro láminas extraídas.
  `output/bestiario-imagenes.zip` contiene los 92 recortes y sus manifiestos;
  las 25 alternativas quedan bajo `sin-asignar/`.

Los originales se conservan en la ubicación proporcionada por el usuario. Las
vistas de revisión y el ZIP se generan en `output/`; las imágenes asignadas y
la metadata reproducible se mantienen en el repositorio.
