"""Extract rectangular, black-backed assets from the last supplied bestiary sheet."""
from pathlib import Path
import sys,json
from PIL import Image,ImageDraw
from silhouette import main_silhouette
ROOT=Path(__file__).resolve().parents[2]
# Names describe the visible figures; only supported correspondences are assigned.
ROWS=[
('Pantera','pantera',(0,0,218,224),False),
('Tigre','tigre',(202,0,388,230),True),
('Serpiente gigante','serpiente-gigante',(370,7,564,226),True),
('Oso','oso',(559,0,801,227),True),
('Uro','uro',(797,0,1056,226),True),
('Rinoceronte','rinoceronte',(1051,0,1308,222),False),
('Trasgo (alternativa)','trasgo-alternativa',(1298,0,1536,224),False),
('Wyvern','wyvern',(0,224,287,446),True),
('Rata gigante','rata-gigante',(213,241,469,442),False),
('Araña gigante (alternativa)','arana-gigante-alternativa',(452,233,705,459),False),
('Espectro','espectro',(685,211,948,481),False),
('Elemental de tierra (alternativa)','elemental-tierra-alternativa',(915,226,1153,484),False),
('Árbol viviente (alternativa)','arbol-viviente-alternativa',(1129,215,1338,484),False),
('Ondina','ondina',(1334,219,1536,482),True),
('Salamandra','salamandra',(0,441,215,704),True),
('Gnomo','gnomo',(205,439,435,711),True),
('Silfo','silfo',(432,441,633,714),True),
('Mujer serpiente (alternativa)','mujer-serpiente',(624,444,858,714),False),
('Sirena','sirena',(840,462,1084,715),False),
('Reptil con vela dorsal','reptil-vela-dorsal',(1080,465,1340,716),False),
('Jabalí monstruoso','jabali-monstruoso',(1320,478,1536,707),False),
('Minotauro (alternativa)','minotauro-alternativa',(0,702,232,1003),False),
('Sátiro','satiro',(222,715,382,1003),False),
('Necrófago','necrofago',(377,715,607,1003),True),
('Caracol monstruoso','caracol-monstruoso',(580,739,858,1007),False),
('Gusano gigante (alternativa)','gusano-gigante-alternativa',(850,715,1100,1003),False),
('Monstruo ocular','monstruo-ocular',(1080,714,1310,977),False),
('Planta carnívora','planta-carnivora',(1277,705,1536,1007),False)]
# Exclude neighbouring silhouettes that enter a bounding rectangle. Output remains rectangular.
CUTS={
 'tigre':[[(0,0),(19,0),(19,144),(0,184)],[(0,182),(15,207),(15,230),(0,230)]],
 'serpiente-gigante':[[(0,74),(17,100),(17,219),(0,219)]],
 'oso':[[(0,0),(13,0),(13,137),(0,201)]],
 'uro':[[(0,146),(13,146),(13,226),(0,226)]],
 'rinoceronte':[[(0,134),(10,134),(10,222),(0,222)]],
 'wyvern':[[(214,117),(287,85),(287,222),(216,222)]],
 'rata-gigante':[[(0,0),(72,0),(72,39),(0,39)],[(0,137),(22,137),(22,201),(0,201)]],
 'espectro':[[(0,0),(140,0),(140,12),(0,12)],[(0,69),(24,95),(24,197),(0,248)],[(0,232),(110,232),(110,270),(0,270)]],
 'elemental-tierra-alternativa':[[(0,0),(19,0),(19,58),(0,58)],[(0,132),(22,155),(22,210),(0,251)]],
 'arbol-viviente-alternativa':[[(0,130),(25,130),(25,269),(0,269)]],
 'reptil-vela-dorsal':[[(0,0),(60,0),(60,22),(0,22)],[(170,0),(260,0),(260,18),(170,18)]],
 'salamandra':[[(200,0),(215,0),(215,263),(200,263)]],
 'gnomo':[[(0,0),(16,0),(16,191),(0,237)]],
 'silfo':[[(0,211),(11,211),(11,273),(0,273)]],
 'mujer-serpiente':[[(0,0),(12,0),(12,39),(0,39)]],
 'sirena':[[(0,81),(12,81),(12,130),(0,130)]],
 'necrofago':[[(0,243),(11,243),(11,288),(0,288)]],
 'caracol-monstruoso':[[(0,16),(23,16),(23,88),(0,88)],[(0,162),(20,162),(20,268),(0,268)]],
 'gusano-gigante-alternativa':[[(0,164),(14,164),(14,288),(0,288)]],
 'monstruo-ocular':[[(0,0),(45,0),(45,18),(0,18)],[(0,161),(12,161),(12,263),(0,263)]]
}
source=Image.open(sys.argv[1]).convert('RGB'); assert source.size==(1536,1024)
preview=Image.new('RGB',(1162,960),(25,25,25)); d=ImageDraw.Draw(preview); manifest=[]
for i,(name,slug,box,assign) in enumerate(ROWS):
 crop=source.crop(box); mask=Image.new('L',crop.size,255); m=ImageDraw.Draw(mask)
 for polygon in CUTS.get(slug,[]): m.polygon(polygon,fill=0)
 clean=Image.new('RGB',crop.size); clean.paste(crop,mask=mask)
 if slug not in ['gnomo','silfo']: clean=main_silhouette(clean)
 framed=Image.new('RGB',(clean.width+16,clean.height+16));framed.paste(clean,(8,8))
 directory='assets/creatures' if assign else 'output/bestiario-sin-asignar'
 path=ROOT/directory/f'{slug}.webp';path.parent.mkdir(parents=True,exist_ok=True);framed.save(path,lossless=True,method=6)
 manifest.append({'nombre':name,'archivo':f'{directory}/{slug}.webp','rectangulo':box,'asignada':assign})
 thumb=framed.copy();thumb.thumbnail((160,205));preview.paste(thumb,((i%7)*166+(166-thumb.width)//2,(i//7)*240)); d.text(((i%7)*166+3,(i//7)*240+211),name,fill='white')
(ROOT/'scripts/art/bestiary-third-regions.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
preview.save(ROOT/'output/bestiario-recortes-3.jpg',quality=92)
print(f'{sum(r[3] for r in ROWS)} assigned; {sum(not r[3] for r in ROWS)} archived')
