"""Evaluate the exact ONNX file with the deployed top-10/NMS contract."""
from pathlib import Path
import csv,json,hashlib,argparse
import numpy as np
import torch,onnxruntime as ort
from torchvision.ops import nms
from sklearn.isotonic import IsotonicRegression
from PIL import Image
from train_detector import ROOT,APP,LABELS,load_rows,tensor,measure,match

def main():
 args=argparse.ArgumentParser();args.add_argument("--reviewed");args=args.parse_args();
 torch.set_num_threads(4);rows=load_rows(args.reviewed);folder=APP/'public/model';metadata=json.loads((folder/'detector-metadata.json').read_text())
 options=ort.SessionOptions();options.intra_op_num_threads=4;session=ort.InferenceSession(str(folder/'detector.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
 sets={s:[r for r in rows if r['split']==s] for s in ['validation','test']};preds={}
 for split,subset in sets.items():
  result=[]
  for i,r in enumerate(subset):
   boxes,probabilities=session.run(None,{'image':tensor(r['path'])[None].numpy()});boxes=boxes[0]*320;p=probabilities[0,:,1:];labels=p.argmax(1)+1;scores=p.max(1);ids=np.flatnonzero(scores>=.02);ids=ids[np.argsort(-scores[ids])[:150]];keep=nms(torch.tensor(boxes[ids]),torch.tensor(scores[ids]),.45)[:10].numpy();ids=ids[keep];result.append({'boxes':boxes[ids],'scores':scores[ids],'labels':labels[ids]})
   if i%200==0:print(f'ONNX {split} {i}/{len(subset)}',flush=True)
  preds[split]=result
 threshold=max(np.linspace(.15,.75,13),key=lambda t:measure(preds['validation'],sets['validation'],float(t))[0]['f1']);threshold=round(float(threshold),4)
 validation,vr=measure(preds['validation'],sets['validation'],threshold);test,tr=measure(preds['test'],sets['test'],threshold)
 calibration=IsotonicRegression(y_min=0,y_max=1,out_of_bounds='clip').fit([x[0] for x in vr],[x[1] for x in vr])
 selected=[x for x in tr if x[0]>=threshold];cal=calibration.predict([x[0] for x in selected]);correct=np.array([x[1] for x in selected]);test['calibration_brier']=float(np.mean((cal-correct)**2));ece=0
 for low in np.arange(0,1,.1):
  ids=(cal>=low)&(cal<(low+.1) if low<.9 else cal<=1)
  if ids.any():ece+=float(ids.mean()*abs(cal[ids].mean()-correct[ids].mean()))
 test['calibration_ece']=ece;aps=[]
 for minimum in np.arange(.5,.951,.05):
  records=[x for p,r in zip(preds['test'],sets['test']) for x in match(p,r,float(minimum))];classaps=[]
  for label in range(1,len(LABELS)+1):
   count=sum(r['labels'].count(label) for r in sets['test'])
   if not count:continue
   xs=sorted([x for x in records if x[2]==label],reverse=True);t=np.cumsum([x[1] for x in xs]);precision=t/np.maximum(1,np.arange(1,len(xs)+1));recall=t/count;classaps.append(float(np.mean([max(precision[recall>=v],default=0) for v in np.linspace(0,1,101)])))
  aps.append(float(np.mean(classaps)))
 test['map50_95']=float(np.mean(aps));metadata.update({'threshold':threshold,'test':test,'validation':validation,'evaluation_runtime':'Exact ONNX export, top 150 candidates, class-agnostic NMS 0.45, maximum 10 objects; RGB Pillow bilinear 320 stretch','epoch_selection_candidate_limit':30,'calibration':{'method':'validation isotonic regression; object correctness means same class and IoU >= 0.5','x':calibration.X_thresholds_.tolist(),'y':calibration.y_thresholds_.tolist(),'validation_predictions':len(vr)}})
 (folder/'detector-metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8');(ROOT/'results/detection-evaluation.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
 with (ROOT/'results/detection-predictions.csv').open('w',newline='',encoding='utf-8') as f:
  w=csv.writer(f);w.writerow(['source_group','domain','truth_count','predicted_count','true_positive_at_iou50','predicted_objects']);
  for r,p in zip(sets['test'],preds['test']):
   selected=p['scores']>=threshold;items=[{'label':LABELS[int(label)-1],'raw_score':float(score),'box':(box/320).tolist()} for label,score,box in zip(p['labels'][selected],p['scores'][selected],p['boxes'][selected])];w.writerow([r['group'],r['domain'],len(r['labels']),len(items),sum(x[1] for x in match(p,r) if x[0]>=threshold),json.dumps(items)])
 examples=APP/'public/detection-examples';catalog=[]
 for domain in ['taco','ewaste']:
  choices=[r for r in sets['test'] if r['domain']==domain and 2<=len(r['labels'])<=5]
  if len(choices)<3:choices += [r for r in sets['test'] if r['domain']==domain and len(r['labels'])==1]
  choices=sorted(choices,key=lambda r:r['group'])[:3]
  for i,r in enumerate(choices):
   name=f'{domain}-representative-{i}.jpg';Image.open(r['path']).convert('RGB').save(examples/name,quality=88);catalog.append({'image':'detection-examples/'+name,'source':domain,'ground_truth_count':len(r['labels']),'source_group':r['group'],'note':'Deterministic held-out examples by source group and 1–5 visible annotated objects; not selected by model score','license':'CC BY 4.0','source_url':'https://doi.org/10.5281/zenodo.3587843' if domain=='taco' else 'https://doi.org/10.17632/77383kmdnw.1'})
 (examples/'catalog.json').write_text(json.dumps(catalog,indent=2),encoding='utf-8')
 referenced={Path(x['image']).name for x in catalog}
 for image in examples.glob('*.jpg'):
  if image.name not in referenced:image.unlink()
 print(json.dumps({'test':test,'threshold':threshold}),flush=True)

if __name__=='__main__':main()
