"""Recorded visual review of the downloaded contact sheet; not auto-labelled truth."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'public'/'examples'/'catalog.json'
rows=json.loads(path.read_text(encoding='utf-8'))
glass={'8850999220000','8850999133003','8851123212021','8851123240291'}
metal={'8851123241236','8851123241373','8855790000028','8855790000783','8855790000844','0873099000011'}
reviewed=[]
for row in rows:
    code=row['id'].removeprefix('thai-')
    if code=='8851876201549':continue # Back of an ambiguous transparent pouch; exclude.
    if code in glass:row['label']='glass'
    if code in metal:row['label']='metal'
    if code in {'8858891304507','8858891304538'}:row['brand']='ชิซึโอกะ'
    if code=='8858891301537':row['brand']='เย็นเย็น'
    kind={'glass':'ขวดแก้ว','metal':'กระป๋องโลหะ','plastic':'ขวดพลาสติก','unknown':'บรรจุภัณฑ์หลายชั้น'}[row['label']]
    row['name']=kind+' '+row['brand']
    row['reviewed']=True;row['reviewed_on']='2026-11-21'
    row['review_method']='Visual inspection of full contact sheet; main visible packaging, excluding cap/label.'
    if row['label']=='unknown':row['note']='วัสดุหลายชั้นอยู่นอกขอบเขต ต้องตรวจชนิดบรรจุภัณฑ์และเงื่อนไขจุดรับ ไม่ควรตีความผล AI ว่ารีไซเคิลได้'
    reviewed.append(row)
for label in ['plastic','metal','glass','unknown']:
    subset=[r for r in reviewed if r['label']==label]
    for i,row in enumerate(subset):
        row['split']=('validation' if i%2==0 else 'test') if label=='unknown' else 'test' if i>=len(subset)-max(1,round(len(subset)*.2)) else 'validation' if i>=len(subset)-max(1,round(len(subset)*.2))-max(1,round(len(subset)*.2)) else 'train'
path.write_text(json.dumps(reviewed,ensure_ascii=False,indent=2),encoding='utf-8')
print('Visually reviewed',len(reviewed),'product photos;',len({r['brand'] for r in reviewed}),'brands')
# Remove earlier unreferenced official promotional imagery, not the attributed photos.
for old in (ROOT/'public'/'examples').glob('*.webp'):
    if old.name.startswith(('ichitan-','yenyen-','tansansu-')):old.unlink()
