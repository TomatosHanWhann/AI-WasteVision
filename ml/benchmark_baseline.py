"""Reproducible HOG+colour/SVM baseline on the existing classification split.

Does not change deployed weights. C is selected on validation only. Archived
MobileNet predictions are aligned to the exact same test images for comparison.
The existing split is image-level, not a Thai physical-item holdout.
"""
import csv
import hashlib
import json
import time
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import LinearSVC

ROOT = Path(__file__).resolve().parent
LABELS = ['plastic', 'metal', 'paper', 'cardboard', 'food_organics', 'glass']

def feature(path):
    with Image.open(path) as im:
        rgb = np.asarray(ImageOps.exif_transpose(im).convert('RGB').resize((64, 64)), dtype=np.float32) / 255
    gray = rgb.mean(axis=2)
    dy, dx = np.gradient(gray)
    mag = np.hypot(dx, dy)
    bins = ((np.arctan2(dy, dx) % np.pi) * 9 / np.pi).astype(int).clip(0, 8)
    cells = np.zeros((8, 8, 9), dtype=np.float32)
    for y in range(8):
        for x in range(8):
            sl = np.s_[y*8:y*8+8, x*8:x*8+8]
            cells[y, x] = np.bincount(bins[sl].ravel(), weights=mag[sl].ravel(), minlength=9)
    blocks = []
    for y in range(7):
        for x in range(7):
            block = cells[y:y+2, x:x+2].ravel()
            blocks.extend(block / np.sqrt(np.sum(block**2) + 1e-6))
    colour = np.concatenate([np.histogram(rgb[:, :, c], bins=16, range=(0, 1), density=False)[0]/4096 for c in range(3)])
    return np.concatenate([blocks, colour]).astype(np.float32)

def main():
    rows = list(csv.DictReader((ROOT/'results/split-manifest.csv').open(encoding='utf-8')))
    # Six-way closed-set comparison: unknown is excluded for BOTH models.
    rows = [r for r in rows if r['label'] in LABELS]
    groups, hashes = {}, {}
    for r in rows:
        for key, table in [(r['group_id'], groups), (r['sha256'], hashes)]:
            if key:
                if key in table and table[key] != r['split']: raise ValueError('Cross-split leakage')
                table[key] = r['split']
    paths = [(ROOT/r['path']).resolve() for r in rows]
    if not all(p.is_file() for p in paths): raise FileNotFoundError('Download original datasets and Thai examples first')
    cache = ROOT/'cache/course-hog.npz'; cache.parent.mkdir(exist_ok=True)
    signature = hashlib.sha256(json.dumps([(r['path'], r['sha256']) for r in rows]).encode()).hexdigest()
    saved = np.load(cache) if cache.exists() else None
    started = time.perf_counter()
    if saved is not None and str(saved['signature']) == signature: X = saved['X']
    else:
        values = []
        for i, (p, r) in enumerate(zip(paths, rows)):
            if hashlib.sha256(p.read_bytes()).hexdigest() != r['sha256']: raise ValueError('Image hash changed: '+str(p))
            values.append(feature(p))
            if i % 500 == 0: print(f'Features {i}/{len(rows)}', flush=True)
        X = np.array(values); np.savez_compressed(cache, X=X, signature=signature)
    y = np.array([r['label'] for r in rows]); splits = np.array([r['split'] for r in rows])
    train, val, test = [np.where(splits == s)[0] for s in ['train', 'validation', 'test']]
    trials=[]; best=None; best_score=-1
    for c in [.01, .1, 1.0]:
        model = make_pipeline(StandardScaler(), LinearSVC(C=c, class_weight='balanced', random_state=42, max_iter=10000, dual=True, tol=1e-3))
        model.fit(X[train], y[train]); score=f1_score(y[val], model.predict(X[val]), labels=LABELS, average='macro', zero_division=0)
        trials.append({'C':c,'validation_macro_f1':float(score),'iterations':int(model[-1].n_iter_)})
        print(f'C={c}; validation macro F1={score:.4f}; iterations={model[-1].n_iter_}',flush=True)
        if score > best_score: best, best_score, best_c = model, score, c
    started_prediction = time.perf_counter(); predictions=best.predict(X[test]); batch_ms=(time.perf_counter()-started_prediction)*1000/len(test)
    def metrics(truth, pred): return {'images':len(truth),'accuracy':float(accuracy_score(truth,pred)),'macro_f1':float(f1_score(truth,pred,labels=LABELS,average='macro',zero_division=0)), 'confusion_matrix':confusion_matrix(truth,pred,labels=LABELS+['unknown']).tolist()}
    archived=list(csv.DictReader((ROOT/'results/test-predictions.csv').open(encoding='utf-8')))
    by_name={r['path']:r for r in archived}
    names=[paths[i].name for i in test]
    if len(set(names)) != len(names) or len(by_name) != len(archived): raise ValueError('Ambiguous archived file names')
    if not all(n in by_name and by_name[n]['truth']==y[i] for n,i in zip(names,test)): raise ValueError('Cannot align archived CNN predictions')
    cnn=[by_name[n]['prediction'] for n in names]
    report={'experiment':'ce564-hog-colour-svm-v1','seed':42,'task':'six-known-class-classification-before-rejection','manifest_sha256':hashlib.sha256((ROOT/'results/split-manifest.csv').read_bytes()).hexdigest(),'physical_item_holdout_verified':False,'labels':LABELS,'confusion_matrix_labels':LABELS+['unknown'],'split_counts':{s:int(sum(splits==s)) for s in ['train','validation','test']},'selection':'validation macro F1; test never used to select C','trials':trials,'selected_C':best_c,'baseline':metrics(y[test],predictions),'cnn_archived_same_images':metrics(y[test],cnn),'baseline_batch_prediction_ms_per_image_excludes_features':batch_ms,'elapsed_seconds':time.perf_counter()-started,'limitations':['Existing public and product images, not new Thai used-object field data.','Baseline excludes unknown training samples; deployed CNN was trained with unknown and extra Thai weights. This is a practical system comparison, not an architecture-only ablation.','CNN predictions are archived from v2, not retrained or timed in this run.','No inference latency comparison: feature extraction and device differences matter.']}
    (ROOT/'results/course-baseline.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    with (ROOT/'results/course-baseline-predictions.csv').open('w',encoding='utf-8',newline='') as f:
        w=csv.writer(f);w.writerow(['path','truth','baseline','cnn_archived']);w.writerows([[rows[i]['path'],y[i],p,c] for i,p,c in zip(test,predictions,cnn)])
    print(json.dumps({k:report[k] for k in ['selected_C','baseline','cnn_archived_same_images','elapsed_seconds']},indent=2),flush=True)
if __name__=='__main__': main()
