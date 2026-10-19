"""Extract the supplied bestiary without redrawing or resampling its creatures.
Usage: python scripts/art/extract_bestiary.py SOURCE.png
Coordinates refer to the 1536 x 1024 unlabelled source. Black is preserved.
"""
import sys, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from silhouette import main_silhouette
ROOT = Path(__file__).resolve().parents[2]
# Individually traced regions, rather than a regular grid: silhouettes cross row boundaries.
REGIONS = [
('Acéfalo','acefalo',[(12,4),(209,4),(209,231),(12,231)]),
('Araña gigante','arana-gigante',[(211,5),(498,5),(498,235),(211,235)]),
('Arpía','arpia',[(500,3),(793,3),(793,224),(500,224)]),
('Asipatra','asipatra',[(794,0),(1083,0),(1083,213),(794,223)]),
('Babuino','babuino',[(1047,223),(1085,127),(1091,5),(1298,5),(1298,232),(1047,232)]),
('Bagini','bagini',[(1299,4),(1536,4),(1536,230),(1299,230)]),
('Bakru','bakru',[(14,244),(160,244),(160,464),(14,464)]),
('Basilisco/Cocatriz','basilisco-cocatriz',[(160,238),(408,238),(418,300),(451,316),(451,462),(160,468)]),
('Bonnacon','bonnacon',[(420,237),(758,237),(758,467),(464,484),(452,434),(452,307)]),
('Caballo','caballo',[(769,239),(1001,239),(1001,482),(769,482)]),
('Cangrejo gigante','cangrejo-gigante',[(1002,259),(1322,259),(1322,473),(1002,473)]),
('Centauro','centauro',[(1323,230),(1530,230),(1530,506),(1323,506)]),
('Cocodrilo/Caimán','cocodrilo-caiman',[(0,506),(320,506),(306,612),(303,715),(0,715)]),
('Cíclope','ciclope',[(303,612),(320,506),(345,484),(465,463),(472,570),(554,733),(495,750),(309,750)]),
('Dragón','dragon',[(503,493),(674,493),(697,472),(762,474),(877,547),(877,733),(566,733),(552,692),(514,650)]),
('Elfo','elfo',[(878,498),(1055,498),(1055,759),(878,759)]),
('Enano','enano',[(1056,533),(1243,533),(1243,660),(1210,700),(1210,737),(1056,737)]),
('Escarabajo gigante','escarabajo-gigante',[(1244,529),(1536,529),(1536,740),(1244,740)]),
('Escorpión gigante','escorpion-gigante',[(0,744),(287,744),(287,1012),(0,1012)]),
('Esqueleto','esqueleto',[(284,750),(466,750),(466,1012),(284,1012)]),
('Gigante','gigante',[(467,771),(551,771),(576,735),(670,735),(729,795),(729,1017),(467,1017)]),
('Gorgona','gorgona',[(730,734),(948,734),(987,877),(987,999),(730,999)]),
('Grifo/Hipogrifo','grifo-hipogrifo',[(949,765),(1330,750),(1330,1008),(992,1008),(992,870)]),
('Híbrido del Caos','hibrido-del-caos',[(1331,751),(1530,751),(1530,1008),(1331,1008)])
]
source = Image.open(sys.argv[1]).convert('RGB')
if source.size != (1536,1024):
    raise ValueError(f'Expected 1536x1024, got {source.size}')
manifest=[]
preview=Image.new('RGB',(1000,4*240),(25,25,25))
draw=ImageDraw.Draw(preview)
for i,(name,slug,polygon) in enumerate(REGIONS):
    mask=Image.new('L',source.size); ImageDraw.Draw(mask).polygon(polygon,fill=255)
    isolated=Image.new('RGB',source.size); isolated.paste(source,mask=mask)
    # Tight trim leaves native pixels intact, including dark internal shading.
    bounds=isolated.point(lambda v: 255 if v>12 else 0).getbbox()
    crop=main_silhouette(isolated.crop(bounds))
    framed=Image.new('RGB',(crop.width+16,crop.height+16)); framed.paste(crop,(8,8))
    path=ROOT/'assets/creatures'/f'{slug}.webp'
    framed.save(path,lossless=True,method=6)
    manifest.append({'nombre':name,'archivo':f'assets/creatures/{slug}.webp','region':polygon,'size':list(framed.size)})
    thumb=framed.copy(); thumb.thumbnail((160,205))
    x=(i%6)*166+(166-thumb.width)//2; y=(i//6)*240
    preview.paste(thumb,(x,y)); draw.text(((i%6)*166+4,y+211),name,fill='white')
(ROOT/'scripts/art/bestiary-regions.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
preview.save(ROOT/'output/bestiario-recortes.jpg',quality=92)
print(f'Extracted {len(manifest)} creatures')
