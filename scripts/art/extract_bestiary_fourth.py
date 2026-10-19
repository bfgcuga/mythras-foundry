"""Extract the sixteen missing designs from the supplied ruled sheet."""
from pathlib import Path
import sys,json
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2]
ROWS=[
('Mantis gigante','mantis-gigante',(5,6,300,317)),
('Mediano','mediano',(305,6,585,317)),
('Momia','momia',(590,6,855,317)),
('Pantotauro','pantotauro',(860,6,1174,317)),
('Quimera','quimera',(1180,6,1532,317)),
('Serpiente marina','serpiente-marina',(5,322,300,634)),
('Simio alado','simio-alado',(305,322,585,634)),
('Slargr','slargr',(590,322,855,634)),
('Smilodon','smilodon',(860,322,1174,634)),
('Tiburón','tiburon',(1180,322,1532,634)),
('Troll','troll',(5,640,249,1012)),
('Wyrm','wyrm',(254,640,569,1012)),
('Ofidio','ofidio',(574,640,771,1012)),
('Sombra','sombra',(776,640,1024,1012)),
('Enjambre','enjambre',(1029,640,1274,1012)),
('Xenomorfo','xenomorfo',(1279,640,1532,1012))]
source=Image.open(sys.argv[1]).convert('RGB');assert source.size==(1536,1024)
preview=Image.new('RGB',(1200,880),(25,25,25));d=ImageDraw.Draw(preview);manifest=[]
for i,(name,slug,box) in enumerate(ROWS):
 crop=source.crop(box)
 framed=Image.new('RGB',(crop.width+16,crop.height+16));framed.paste(crop,(8,8))
 path=ROOT/'assets/creatures'/f'{slug}.webp';framed.save(path,lossless=True,method=6)
 manifest.append({'nombre':name,'archivo':f'assets/creatures/{slug}.webp','rectangulo':box,'asignada':True})
 thumb=framed.copy();thumb.thumbnail((190,245));x=(i%6)*200+(200-thumb.width)//2;y=(i//6)*290
 preview.paste(thumb,(x,y));d.text(((i%6)*200+4,y+257),name,fill='white')
(ROOT/'scripts/art/bestiary-fourth-regions.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
preview.save(ROOT/'output/bestiario-recortes-4.jpg',quality=94)
print('Extracted 16 missing designs.')
