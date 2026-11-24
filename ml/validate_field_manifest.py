"""Validate team-labelled physical-item splits before a new training experiment.
CSV: path,label,split,physical_item_id,session_id,consent,license
All paths are relative to the manifest directory. No training or auto-split.
"""
import csv
import hashlib
import json
import sys
from pathlib import Path

def validate(path):
    path=Path(path).resolve()
    with path.open(encoding='utf-8-sig') as source: rows=list(csv.DictReader(source))
    required={'path','label','split','physical_item_id','session_id','consent','license'}
    if not rows or not required.issubset(rows[0]): raise ValueError('Missing rows/required columns')
    seen={}; counts={s:0 for s in ['train','validation','test']}
    for r in rows:
        labels={'plastic','metal','paper','cardboard','food_organics','glass','film','multilayer','foam','battery','electronics','bulb','pressurised','broken_glass','unknown'}
        if r['split'] not in counts or r['label'] not in labels or not r['physical_item_id'] or not r['session_id']: raise ValueError('Invalid label/split/group')
        if r['consent']!='yes' or not r['license']: raise ValueError('Consent and data rights must be recorded')
        if r.get('group_id') and r['group_id'] != r['physical_item_id']: raise ValueError('group_id must match physical_item_id')
        image=(path.parent/r['path']).resolve()
        if not image.is_relative_to(path.parent) or not image.is_file(): raise ValueError('Invalid/missing image path')
        digest=hashlib.sha256(image.read_bytes()).hexdigest()
        for key in ['item:'+r['physical_item_id'],'session:'+r['session_id'],'sha:'+digest]:
            if key in seen and seen[key]!=r['split']: raise ValueError('Cross-split leakage: '+key)
            seen[key]=r['split']
        counts[r['split']]+=1
    if not all(counts.values()): raise ValueError('Every split needs images')
    return {'images':len(rows),'splits':counts,'checks':['physical-item-disjoint','session-disjoint','sha256-disjoint','consent-and-rights-present'],'limitation':'Validates recorded IDs, not the truth of labels or physical identity. Detection additionally needs reviewed bounding boxes.'}
if __name__=='__main__': print(json.dumps(validate(sys.argv[1]),indent=2))
