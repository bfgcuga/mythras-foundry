"""Rectangular native-resolution crops from the second supplied sheet."""
from pathlib import Path
import json, sys
from PIL import Image,ImageDraw
from silhouette import main_silhouette
ROOT=Path(__file__).resolve().parents[2]
rows=[
('Hombre jabalí','hombre-jabali',(0,0,193,243),True),
('Hombre lagarto','hombre-lagarto',(194,0,407,245),True),
('Hormiga gigante','hormiga-gigante',(386,25,673,241),True),
('Iqari','iqari',(671,0,968,254),True),
('Jabalí','jabali',(969,21,1210,233),True),
('Lagarto gigante','lagarto-gigante',(1211,16,1536,219),True),
('León','leon',(0,246,237,464),True),
('Lobo','lobo',(221,260,432,466),True),
('Mamut','mamut',(434,222,728,473),True),
('Mantícora','manticora',(729,233,1077,483),True),
('Minotauro','minotauro',(1077,233,1296,491),True),
('Hombre lagarto (alternativa)','hombre-lagarto-alternativa',(1298,219,1518,485),False),
('Ogro','ogro',(0,464,213,727),True),
('Orco/Trasgo','orco-trasgo',(216,473,461,725),True),
('Caballo alado (por identificar)','caballo-alado',(409,461,701,723),False),
('Búho gigante (por identificar)','buho-gigante',(701,482,1060,718),False),
('Masa gelatinosa (por identificar)','masa-gelatinosa',(961,495,1310,735),False),
('Árbol viviente (por identificar)','arbol-viviente',(1308,473,1536,723),False),
('Unicornio','unicornio',(0,725,237,991),True),
('Vampiro','vampiro',(232,723,508,1002),True),
('Hombre lobo (por identificar)','hombre-lobo',(505,718,730,990),False),
('Zombi','zombi',(726,721,925,994),True),
('Gusano gigante (por identificar)','gusano-gigante',(927,733,1222,995),False),
('Pulpo gigante','pulpo-gigante',(1210,720,1536,993),True)]
source=Image.open(sys.argv[1]).convert('RGB')
assert source.size==(1536,1024)
manifest=[]; preview=Image.new('RGB',(1000,960),(25,25,25)); d=ImageDraw.Draw(preview)
for i,(name,slug,box,assign) in enumerate(rows):
    crop=source.crop(box)
    # Remove adjacent figures only outside the subject, leaving a rectangular black canvas.
    mask=Image.new('L',crop.size,255); m=ImageDraw.Draw(mask)
    exclusions={
      'hombre-lagarto':[[(192,0),(213,0),(213,139),(184,111)]],
      'hormiga-gigante':[[(0,150),(30,150),(30,216),(0,216)],[(90,196),(287,196),(287,216),(90,216)]],
      'iqari':[[(240,231),(297,231),(297,254),(240,254)]],
      'mamut':[[(0,238),(68,238),(68,251),(0,251)]],
      'manticora':[[(0,0),(204,0),(204,25),(0,25)]],
      'hombre-lagarto-alternativa':[[(0,246),(220,246),(220,266),(0,266)]],
      'lobo':[[(0,135),(17,163),(17,206),(0,206)],[(100,194),(211,194),(211,206),(100,206)]],
      'orco-trasgo':[[(193,0),(245,0),(245,83),(216,69)]],
      'caballo-alado':[[(0,130),(52,130),(52,207),(0,217)],[(0,0),(292,0),(292,26),(184,26),(152,0)]],
      'buho-gigante':[[(0,0),(21,0),(21,98),(0,98)],[(305,105),(359,94),(359,236),(260,236)]],
      'masa-gelatinosa':[[(0,0),(82,0),(82,110),(0,110)],[(330,218),(349,218),(349,240),(330,240)]],
      'pulpo-gigante':[[(0,0),(48,0),(48,17),(0,17)]],
      'arbol-viviente':[[(0,194),(18,194),(18,250),(0,250)],[(0,0),(201,0),(201,18),(0,18)]],
      'gusano-gigante':[[(283,185),(295,185),(295,262),(283,262)]]
    }
    for poly in exclusions.get(slug,[]): m.polygon(poly,fill=0)
    image=Image.new('RGB',crop.size); image.paste(crop,mask=mask)
    image=main_silhouette(image)
    framed=Image.new('RGB',(image.width+16,image.height+16)); framed.paste(image,(8,8))
    directory='assets/creatures' if assign else 'output/bestiario-sin-asignar'
    path=ROOT/directory/f'{slug}.webp'; path.parent.mkdir(parents=True,exist_ok=True); framed.save(path,lossless=True,method=6)
    manifest.append({'nombre':name,'archivo':f'{directory}/{slug}.webp','rectangulo':box,'asignada':assign})
    thumb=framed.copy(); thumb.thumbnail((160,205)); preview.paste(thumb,((i%6)*166+(166-thumb.width)//2,(i//6)*240)); d.text(((i%6)*166+3,(i//6)*240+213),name,fill='white')
(ROOT/'scripts/art/bestiary-second-regions.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
preview.save(ROOT/'output/bestiario-recortes-2.jpg',quality=92)
print(f'{sum(r[3] for r in rows)} assigned; {sum(not r[3] for r in rows)} archived')
