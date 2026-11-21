"""Reproducible MobileNetV2 feature-transfer baseline and browser ONNX export.

This default split is image-level, NOT a physical-item holdout. Supply --manifest
with path,label,split,group_id for a team-reviewed item-disjoint experiment.
Unknown images are used only for rejection validation/test, never head training.
"""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import random
import time

import numpy as np
from PIL import Image, ImageOps
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
import torch
from torch import nn
from torchvision.models import mobilenet_v2, MobileNet_V2_Weights

ROOT = Path(__file__).resolve().parent
APP = ROOT.parent
LABELS = ['plastic', 'metal', 'paper', 'cardboard', 'food_organics']
FOLDERS = {'Plastic':'plastic', 'Metal':'metal', 'Paper':'paper', 'Cardboard':'cardboard', 'Food Organics':'food_organics'}
SEED = 42
SIZE = 224

def prepare_image(path):
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert('RGB')
        w, h = im.size
        side = min(w, h)
        im = im.crop(((w-side)//2, (h-side)//2, (w+side)//2, (h+side)//2))
        im = im.resize((SIZE, SIZE), Image.Resampling.BILINEAR)
        x = np.array(im, dtype=np.float32).transpose(2, 0, 1) / 255
    return (x - np.array([.485,.456,.406], dtype=np.float32)[:,None,None]) / np.array([.229,.224,.225],dtype=np.float32)[:,None,None]

def collect_rows(manifest):
    if manifest:
        with Path(manifest).open(encoding='utf-8-sig') as f:
            rows = list(csv.DictReader(f))
        groups = {}
        for row in rows:
            if row['split'] not in ('train','validation','test') or row['label'] not in LABELS+['unknown']:
                raise ValueError('Invalid label/split')
            group = row.get('group_id','').strip()
            if not group:
                raise ValueError('Every custom-manifest row needs a physical group_id')
            if group in groups and groups[group] != row['split']:
                raise ValueError(f'Physical item crosses splits: {group}')
            groups[group] = row['split']
            row['path'] = str((Path(manifest).resolve().parent / row['path']).resolve())
        method = 'physical-group-manifest'
    else:
        paths = sorted((ROOT / 'data').rglob('*.jpg'))
        if not paths:
            raise FileNotFoundError('Run python ml/download_data.py first')
        rows = []
        for folder in sorted({p.parent for p in paths}):
            files = [p for p in paths if p.parent == folder]
            label = FOLDERS.get(folder.name, 'unknown')
            train, rest = train_test_split(files, test_size=.30, random_state=SEED)
            val, test = train_test_split(rest, test_size=.5, random_state=SEED)
            for split, items in [('train',train),('validation',val),('test',test)]:
                for p in items:
                    if label == 'unknown' and split == 'train':
                        continue
                    rows.append({'path':str(p.resolve()), 'label':label, 'split':split, 'group_id':''})
        method = 'stratified-image-level-exploratory'
    seen = {}
    for row in rows:
        digest = hashlib.sha256(Path(row['path']).read_bytes()).hexdigest()
        if digest in seen and seen[digest] != row['split']:
            raise ValueError('Exact duplicate crosses splits; review dataset before training')
        seen[digest] = row['split']
        row['sha256'] = digest
    for split in ['train','validation','test']:
        if {r['label'] for r in rows if r['split']==split and r['label']!='unknown'} != set(LABELS):
            raise ValueError(f'Missing supported class in {split}')
    return rows, method

class Features(nn.Module):
    def __init__(self, backbone):
        super().__init__()
        self.features = backbone.features
    def forward(self, x):
        return self.features(x).mean([2,3])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest')
    parser.add_argument('--threads',type=int,default=4)
    args = parser.parse_args()
    random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)
    torch.set_num_threads(args.threads)
    rows, method = collect_rows(args.manifest)
    print(f'{len(rows)} images; {method}', flush=True)
    cache = ROOT / 'cache'; cache.mkdir(exist_ok=True)
    signature = hashlib.sha256(('mobilenet-v2-imagenet-v2-center224-bilinear-v1'+''.join(r['sha256'] for r in rows)).encode()).hexdigest()
    cachefile = cache / f'{signature}.npy'
    torch.hub.set_dir(str(cache / 'torch'))
    backbone = mobilenet_v2(weights=MobileNet_V2_Weights.IMAGENET1K_V2).eval()
    extractor = Features(backbone).eval()
    if cachefile.exists():
        X = np.load(cachefile)
    else:
        parts = []; started = time.time()
        with torch.inference_mode():
            for start in range(0,len(rows),32):
                batch = torch.from_numpy(np.stack([prepare_image(r['path']) for r in rows[start:start+32]]))
                parts.append(extractor(batch).numpy())
                if start % 320 == 0:
                    print(f'Features {min(start+32,len(rows))}/{len(rows)} ({time.time()-started:.0f}s)',flush=True)
        X = np.concatenate(parts); np.save(cachefile,X)
    y = np.array([LABELS.index(r['label']) if r['label'] in LABELS else -1 for r in rows])
    splits = np.array([r['split'] for r in rows])
    tr = (splits=='train') & (y>=0); va=(splits=='validation') & (y>=0); te=(splits=='test') & (y>=0)
    # Select regularization solely on validation data. The test split stays untouched.
    candidates = []
    for c in [.01,.1,1.,10.]:
        head = LogisticRegression(C=c,max_iter=2500,class_weight='balanced',random_state=SEED)
        head.fit(X[tr],y[tr])
        score = f1_score(y[va],head.predict(X[va]),average='macro')
        candidates.append((score,c,head))
        print(f'C={c}; validation macro F1={score:.4f}',flush=True)
    _, best_c, head = max(candidates,key=lambda t:t[0])
    p = head.predict_proba(X)
    # Conservative heuristic; validation only, NOT a guaranteed OOD detector.
    known_conf = p[va].max(1)
    unknown_val = (splits=='validation') & (y<0)
    rejection = []
    for threshold in np.arange(.50,.951,.025):
        known_accept = float((known_conf>=threshold).mean())
        unknown_reject = float((p[unknown_val].max(1)<threshold).mean()) if unknown_val.any() else 0
        rejection.append((.5*(known_accept+unknown_reject),float(threshold)))
    threshold = max(rejection,key=lambda t:t[0])[1] if unknown_val.any() else .75
    linear = nn.Linear(1280,5)
    with torch.no_grad():
        linear.weight.copy_(torch.tensor(head.coef_,dtype=torch.float32))
        linear.bias.copy_(torch.tensor(head.intercept_,dtype=torch.float32))
    model = nn.Sequential(extractor,linear,nn.Softmax(dim=1)).eval()
    out = APP / 'public' / 'model'; out.mkdir(parents=True,exist_ok=True)
    model_path = out / 'wastevision.onnx'
    sample = torch.from_numpy(prepare_image(rows[np.flatnonzero(te)[0]]['path'])).unsqueeze(0)
    torch.onnx.export(model,sample,str(model_path),input_names=['image'],output_names=['probabilities'],opset_version=17,dynamo=False)
    import onnxruntime as ort
    sess = ort.InferenceSession(str(model_path),providers=['CPUExecutionProvider'])
    onnx_p = sess.run(None,{'image':sample.numpy()})[0]
    with torch.inference_mode():
        torch_p = model(sample).numpy()
    parity = float(np.max(np.abs(onnx_p-torch_p)))
    if parity>1e-4:
        raise ValueError(f'ONNX parity failed: {parity}')
    # All held-out images pass through the exact deployed export, not just the head.
    exported = []
    latencies = []
    test_indexes = np.flatnonzero(splits=='test')
    for index in test_indexes:
        xx = prepare_image(rows[index]['path'])[None]
        before = time.perf_counter()
        exported.append(sess.run(None,{'image':xx})[0][0])
        latencies.append((time.perf_counter()-before)*1000)
    exported = np.array(exported)
    test_y = y[test_indexes]; known = test_y>=0
    pred = exported[known].argmax(1)
    report = {
        'model_version':'realwaste-mobilenetv2-v1', 'created_at':datetime.now(timezone.utc).isoformat(),
        'seed':SEED,'labels':LABELS,'split_method':method,
        'physical_item_holdout_verified':method=='physical-group-manifest',
        'selected_C':best_c,'validation_macro_f1':float(f1_score(y[va],head.predict(X[va]),average='macro')),
        'test_accuracy':float(accuracy_score(test_y[known],pred)),
        'test_macro_f1':float(f1_score(test_y[known],pred,average='macro')),
        'confusion_matrix':confusion_matrix(test_y[known],pred,labels=range(5)).tolist(),
        'classification_report':classification_report(test_y[known],pred,target_names=LABELS,output_dict=True),
        'split_counts':{s:{label:sum(r['split']==s and r['label']==label for r in rows) for label in LABELS+['unknown']} for s in ['train','validation','test']},
        'threshold':round(threshold,3),
        'test_known_coverage':float((exported[known].max(1)>=threshold).mean()),
        'test_unknown_rejection_rate':float((exported[~known].max(1)<threshold).mean()) if (~known).any() else None,
        'onnx_parity_max_error':parity,
        'desktop_python_inference_median_ms':float(np.median(latencies)),
        'model_sha256':hashlib.file_digest(model_path.open('rb'),'sha256').hexdigest(),
        'limitations':['Exploratory image split is not proof of generalization to unseen physical objects.', 'No Thai-local domain adaptation or human/device field test has been collected.', 'Softmax threshold cannot reliably detect every out-of-scope image.', 'Python latency is not browser or mobile latency.'],
        'source':{'name':'RealWaste','url':'https://archive.ics.uci.edu/dataset/908/realwaste','license':'CC BY 4.0','authors':'Single, Iranmanesh, Raad (2023)'},
        'preprocessing':{'crop':'center square','resize':[224,224],'interpolation':'bilinear','layout':'NCHW','scale':255,'mean':[.485,.456,.406],'std':[.229,.224,.225]},
    }
    (out/'metadata.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    results = ROOT/'results'; results.mkdir(exist_ok=True)
    (results/'evaluation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    with (results/'split-manifest.csv').open('w',newline='',encoding='utf-8') as f:
        w = csv.DictWriter(f,fieldnames=['path','label','split','group_id','sha256']);w.writeheader()
        for r in rows:
            w.writerow({**r,'path':str(Path(r['path']).relative_to(ROOT)).replace('\\','/') if Path(r['path']).is_relative_to(ROOT) else r['path']})
    with (results/'test-predictions.csv').open('w',newline='',encoding='utf-8') as f:
        w=csv.writer(f);w.writerow(['path','truth','prediction','confidence','decision','latency_ms'])
        for j,idx in enumerate(test_indexes):
            probs=exported[j]; conf=float(probs.max()); label=LABELS[probs.argmax()]
            w.writerow([Path(rows[idx]['path']).name,rows[idx]['label'],label,conf,label if conf>=threshold else 'unknown',latencies[j]])
    # Actual held-out examples for reproducible browser checks; label dataset evidence.
    samples = APP/'public'/'samples';samples.mkdir(exist_ok=True)
    for label in LABELS:
        r=next(r for r in rows if r['split']=='test' and r['label']==label)
        with Image.open(r['path']) as im:
            im.convert('RGB').save(samples/f'{label}.jpg',quality=90)
    print(json.dumps({k:report[k] for k in ['test_accuracy','test_macro_f1','threshold','test_unknown_rejection_rate','onnx_parity_max_error']},indent=2),flush=True)

if __name__ == '__main__':
    main()
