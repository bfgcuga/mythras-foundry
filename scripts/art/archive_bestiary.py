"""Package all four extracted sheets, including alternatives and coverage reports."""
from pathlib import Path
import json,zipfile
ROOT=Path(__file__).resolve().parents[2]
files=['bestiary-regions.json','bestiary-second-regions.json','bestiary-third-regions.json','bestiary-fourth-regions.json']
rows=[]
for name in files:
 for row in json.loads((ROOT/'scripts/art'/name).read_text(encoding='utf8')):
  rows.append({**row,'lamina':files.index(name)+1,'asignada':row.get('asignada',True)})
missing=json.loads((ROOT/'output/criaturas-imagenes-pendientes.json').read_text(encoding='utf8'))
report={'recortes':len(rows),'disenos_asignados':sum(r['asignada'] for r in rows),'alternativas_sin_asignar':sum(not r['asignada'] for r in rows),'criaturas_pendientes':missing,'imagenes':rows}
(ROOT/'output/bestiario-manifiesto.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
with zipfile.ZipFile(ROOT/'output/bestiario-imagenes.zip','w',zipfile.ZIP_DEFLATED) as z:
 for row in rows:
  path=ROOT/row['archivo']; destination=row['archivo'] if row['asignada'] else 'sin-asignar/'+path.name
  z.write(path,destination)
 z.write(ROOT/'output/bestiario-manifiesto.json','manifest.json')
 z.write(ROOT/'output/criaturas-imagenes-pendientes.json','criaturas-imagenes-pendientes.json')
 z.write(ROOT/'docs/bestiary-art.md','LEEME.md')
print(f"Archived {len(rows)} images: {report['disenos_asignados']} assigned, {report['alternativas_sin_asignar']} alternatives.")
