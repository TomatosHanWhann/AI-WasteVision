"""Reproducible SSDLite transfer: cached frozen COCO features, trained waste heads.

Validation selects epoch/threshold; untouched test produces localization, counting
and calibration statistics. Never interpret confidence as per-image accuracy.
"""
from pathlib import Path
from collections import Counter, defaultdict
from functools import partial
import csv, hashlib, json, random, time, argparse, subprocess, sys
import numpy as np
import torch
from torch import nn
from PIL import Image
from torchvision.models.detection import ssdlite320_mobilenet_v3_large, SSDLite320_MobileNet_V3_Large_Weights
from torchvision.models.detection.ssdlite import SSDLiteClassificationHead
from torchvision.ops import box_iou, nms
from sklearn.isotonic import IsotonicRegression

ROOT=Path(__file__).resolve().parent; APP=ROOT.parent; SEED=42
LABELS=['plastic','metal','paper','cardboard','food_organics','glass','film','multilayer','foam','battery','electronics','bulb','pressurised','broken_glass','unknown']
TACO={0:'metal',1:'battery',2:'multilayer',3:'multilayer',4:'plastic',5:'plastic',6:'glass',7:'plastic',8:'metal',9:'broken_glass',10:'metal',11:'pressurised',12:'metal',13:'cardboard',14:'cardboard',15:'cardboard',16:'multilayer',17:'cardboard',18:'cardboard',19:'cardboard',20:'multilayer',21:'plastic',22:'foam',23:'glass',24:'plastic',25:'food_organics',26:'glass',27:'plastic',28:'metal',29:'plastic',30:'paper',31:'unknown',32:'paper',33:'paper',34:'paper',35:'multilayer',36:'film',37:'plastic',38:'film',39:'multilayer',40:'film',41:'film',42:'multilayer',43:'plastic',44:'plastic',45:'plastic',46:'foam',47:'plastic',48:'unknown',49:'plastic',50:'metal',51:'unknown',52:'metal',53:'unknown',54:'multilayer',55:'plastic',56:'paper',57:'foam',58:'unknown',59:'unknown'}
EW=['battery','glass','electronics','bulb','unknown','metal','electronics','electronics','food_organics','electronics','paper','plastic']

def load_rows(reviewed=None):
    rows=[]; root=ROOT/'data/taco'; d=json.loads((root/'annotations.json').read_text())
    anns=defaultdict(list)
    for a in d['annotations']:anns[a['image_id']].append(a)
    for im in d['images']:
        path=root/im['file_name']
        if not path.exists():continue
        group='taco:'+str(im['id']); h=int(hashlib.sha256(group.encode()).hexdigest()[:8],16)%100
        split='train' if h<70 else 'validation' if h<85 else 'test'
        boxes=[];labels=[]
        for a in anns[im['id']]:
            x,y,w,h=a['bbox']
            if w<2 or h<2:continue
            boxes.append([x/im['width']*320,y/im['height']*320,(x+w)/im['width']*320,(y+h)/im['height']*320]);labels.append(LABELS.index(TACO[a['category_id']])+1)
        if boxes:rows.append(dict(path=path,group=group,split=split,domain='taco',boxes=boxes,labels=labels))
    root=ROOT/'data/ewaste'
    for folder,split in [('train','train'),('valid','validation'),('test','test')]:
        for path in sorted((root/folder/'images').glob('*.jpg')):
            boxes=[];labels=[]
            for line in (root/folder/'labels'/path.with_suffix('.txt').name).read_text().splitlines():
                values=list(map(float,line.split()));c=values[0]
                if len(values)==5:
                    x,y,w,h=values[1:];box=[(x-w/2)*320,(y-h/2)*320,(x+w/2)*320,(y+h/2)*320]
                else:
                    points=np.array(values[1:]).reshape(-1,2);box=[*points.min(0)*320,*points.max(0)*320]
                box=np.clip(box,0,320).tolist()
                if box[2]<=box[0] or box[3]<=box[1]:continue
                boxes.append(box);labels.append(LABELS.index(EW[int(c)])+1)
            if boxes:rows.append(dict(path=path,group='ewaste:'+path.name.split('_jpg.rf.')[0],split=split,domain='ewaste',boxes=boxes,labels=labels))
    if reviewed:
        file=Path(reviewed).resolve();d=json.loads(file.read_text(encoding='utf-8'))
        if d.get('reviewed_only') is not True:raise ValueError('Only reviewed data can be imported')
        for im in d['images']:
            path=(file.parent/im['file_name']).resolve()
            if not path.is_relative_to(file.parent):raise ValueError('Invalid reviewed image path')
            group=im['group'];h=int(hashlib.sha256(group.encode()).hexdigest()[:8],16)%100
            split='train' if h<70 else 'validation' if h<85 else 'test'
            objects=im['objects']
            if any(x['label'] not in LABELS or len(x['box'])!=4 or not all(0<=v<=1 for v in x['box']) for x in objects):raise ValueError('Invalid reviewed labels')
            if objects:rows.append(dict(path=path,group=group,split=split,domain='reviewed-user-contribution',boxes=[[v*320 for v in x['box']] for x in objects],labels=[LABELS.index(x['label'])+1 for x in objects]))
    # Resolve augmented-source overlap in favor of held-out data; never train it.
    rank={'train':0,'validation':1,'test':2};groups={};hashes={}
    for r in rows:
        r['sha256']=hashlib.sha256(r['path'].read_bytes()).hexdigest()
        groups[r['group']]=max(groups.get(r['group'],'train'),r['split'],key=rank.get)
        hashes[r['sha256']]=max(hashes.get(r['sha256'],'train'),r['split'],key=rank.get)
    rows=[r for r in rows if r['split']==groups[r['group']] and r['split']==hashes[r['sha256']]]
    return rows

def tensor(path):
    with Image.open(path) as im:a=np.asarray(im.convert('RGB').resize((320,320),Image.Resampling.BILINEAR),dtype=np.float32).copy()/127.5-1
    return torch.from_numpy(a).permute(2,0,1)

def predictions(model,features,anchors,threshold=.02):
    out=model.head(features); results=[]
    for logits,delta in zip(out['cls_logits'],out['bbox_regression']):
        scores,labels=logits.softmax(-1)[:,1:].max(-1);labels=labels+1
        boxes=model.box_coder.decode_single(delta,anchors).clamp(0,320)
        idx=torch.where(scores>=threshold)[0];idx=idx[scores[idx].argsort(descending=True)[:150]]
        keep=nms(boxes[idx],scores[idx],.45)[:30];idx=idx[keep]
        results.append({'boxes':boxes[idx].detach().numpy(),'scores':scores[idx].detach().numpy(),'labels':labels[idx].numpy()})
    return results

def match(pred,target,threshold=.5):
    truth=np.array(target['boxes']); labels=np.array(target['labels']); used=set();correct=[]
    order=np.argsort(-pred['scores'])
    ious=box_iou(torch.tensor(pred['boxes']),torch.tensor(truth,dtype=torch.float32)).numpy() if len(pred['boxes']) else np.zeros((0,len(truth)))
    for i in order:
        candidates=[j for j in range(len(truth)) if j not in used and labels[j]==pred['labels'][i]]
        j=max(candidates,key=lambda j:ious[i,j],default=-1)
        ok=j>=0 and ious[i,j]>=threshold
        if ok:used.add(j)
        correct.append((float(pred['scores'][i]),int(ok),int(pred['labels'][i])))
    return correct

def measure(preds,rows,threshold):
    records=[]; truths=Counter();count_errors=[];exact=[]
    for p,r in zip(preds,rows):
        truths.update(r['labels']);records.extend(match(p,r));n=int((p['scores']>=threshold).sum());count_errors.append(abs(n-len(r['labels'])));exact.append(n==len(r['labels']))
    aps=[];per={}
    for label in range(1,len(LABELS)+1):
        xs=sorted([x for x in records if x[2]==label],reverse=True);tp=np.cumsum([x[1] for x in xs]);fp=np.arange(1,len(xs)+1)-tp
        recall=tp/max(1,truths[label]);precision=tp/np.maximum(1,tp+fp)
        ap=float(np.mean([max(precision[recall>=v],default=0) for v in np.linspace(0,1,101)]))
        if truths[label]:aps.append(ap)
        selected=[x for x in xs if x[0]>=threshold];t=sum(x[1] for x in selected);per[LABELS[label-1]]={'truth_objects':truths[label],'precision':t/max(1,len(selected)),'recall':t/max(1,truths[label]),'ap50':ap}
    selected=[x for x in records if x[0]>=threshold];t=sum(x[1] for x in selected);p=t/max(1,len(selected));r=t/max(1,sum(truths.values()))
    return dict(precision=p,recall=r,f1=2*p*r/max(1e-8,p+r),map50=float(np.mean(aps)),count_mae=float(np.mean(count_errors)),count_exact_match=float(np.mean(exact)),true_objects=sum(truths.values()),predicted_objects=len(selected),per_class=per),records

class Export(nn.Module):
    def __init__(self,model,anchors):super().__init__();self.backbone=model.backbone;self.head=model.head;self.register_buffer('anchors',anchors)
    def forward(self,image):
        features=list(self.backbone(image).values());out=self.head(features)
        # SSD box coder weights are (10,10,5,5). Export decoding, run NMS in JS.
        a=self.anchors;wh=a[:,2:]-a[:,:2];center=(a[:,2:]+a[:,:2])/2
        d=out['bbox_regression'];c=d[:,:,:2]/10*wh+center;s=torch.exp(torch.clamp(d[:,:,2:]/5,max=4.1351666))*wh
        return torch.cat([c-s/2,c+s/2],-1).clamp(0,320)/320,out['cls_logits'].softmax(-1)

def main():
    random.seed(SEED);np.random.seed(SEED);torch.manual_seed(SEED);torch.set_num_threads(4)
    args=argparse.ArgumentParser();args.add_argument("--reviewed");args.add_argument("--version",default="wastevision-ssdlite-v3");args=args.parse_args();
    if args.reviewed and args.version=="wastevision-ssdlite-v3":raise ValueError("Set a new --version for a candidate trained on reviewed user data")
    rows=load_rows(args.reviewed);print('Dataset',len(rows),Counter(r['split'] for r in rows),flush=True)
    model=ssdlite320_mobilenet_v3_large(weights=SSDLite320_MobileNet_V3_Large_Weights.DEFAULT).eval()
    old=model.head.classification_head;channels=[b[0][0].in_channels for b in old.module_list];a=model.anchor_generator.num_anchors_per_location()
    model.head.classification_head=SSDLiteClassificationHead(channels,a,len(LABELS)+1,partial(nn.BatchNorm2d,eps=.001,momentum=.03))
    for new,original in zip(model.head.classification_head.module_list,old.module_list):new[0].load_state_dict(original[0].state_dict())
    for p in model.backbone.parameters():p.requires_grad=False
    model.eval();cache=ROOT/'cache/detector-features.pt';cache.parent.mkdir(exist_ok=True)
    signature=hashlib.sha256(json.dumps([(r['sha256'],r['labels'],r['boxes']) for r in rows]).encode()).hexdigest()
    cached=torch.load(cache,weights_only=True) if cache.exists() else {}
    if cached.get('signature')==signature:
        fs=cached['features'];print('Reused feature cache',flush=True)
    else:
        fs=[[] for _ in channels];started=time.time()
        with torch.no_grad():
            for start in range(0,len(rows),16):
                out=list(model.backbone(torch.stack([tensor(r['path']) for r in rows[start:start+16]])).values())
                for i,f in enumerate(out):fs[i].append(f.to(torch.float16))
                if start%256==0:print(f'Features {start}/{len(rows)} ({time.time()-started:.0f}s)',flush=True)
        fs=[torch.cat(x) for x in fs];torch.save({'signature':signature,'features':fs},cache)
    from torchvision.models.detection.image_list import ImageList
    with torch.no_grad():anchors=model.anchor_generator(ImageList(torch.zeros(1,3,320,320),[(320,320)]),[f[:1].float() for f in fs])[0]
    targets=[{'boxes':torch.tensor(r['boxes'],dtype=torch.float32),'labels':torch.tensor(r['labels'])} for r in rows]
    matched=[model.proposal_matcher(box_iou(t['boxes'],anchors)) for t in targets]
    train=[i for i,r in enumerate(rows) if r['split']=='train'];val=[i for i,r in enumerate(rows) if r['split']=='validation'];test=[i for i,r in enumerate(rows) if r['split']=='test']
    optimizer=torch.optim.AdamW(model.head.parameters(),lr=.001,weight_decay=.0001);best=-1;best_state=None;history=[]
    def predict_ids(ids):
        preds=[]
        with torch.no_grad():
            for start in range(0,len(ids),16):preds.extend(predictions(model,[f[ids[start:start+16]].float() for f in fs],anchors))
        return preds
    started=time.time()
    for epoch in range(1,41):
        random.shuffle(train);losses=[];model.head.eval()
        for start in range(0,len(train),16):
            ids=train[start:start+16];optimizer.zero_grad();out=model.head([f[ids].float() for f in fs]);loss=sum(model.compute_loss([targets[i] for i in ids],out,[anchors]*len(ids),[matched[i] for i in ids]).values());loss.backward();torch.nn.utils.clip_grad_norm_(model.head.parameters(),10);optimizer.step();losses.append(float(loss.detach()))
        if epoch%5==0 or epoch==1:
            vp=predict_ids(val);m,_=measure(vp,[rows[i] for i in val],.35);history.append({'epoch':epoch,'loss':float(np.mean(losses)),'validation_map50':m['map50']});print(f'Epoch {epoch}; loss {np.mean(losses):.3f}; val mAP50 {m["map50"]:.3f}; elapsed {time.time()-started:.0f}s',flush=True)
            if m['map50']>best:best=m['map50'];best_state={k:v.detach().clone() for k,v in model.head.state_dict().items()};best_epoch=epoch
        if epoch==25:optimizer.param_groups[0]['lr']=.0002
    model.head.load_state_dict(best_state);vp=predict_ids(val)
    threshold=max(np.linspace(.15,.75,13),key=lambda t:measure(vp,[rows[i] for i in val],float(t))[0]['f1']);threshold=float(threshold)
    vm,vr=measure(vp,[rows[i] for i in val],threshold);tp=predict_ids(test);tm,tr=measure(tp,[rows[i] for i in test],threshold)
    # Monotone validation calibration, evaluated once on untouched test predictions.
    calibration=IsotonicRegression(y_min=0,y_max=1,out_of_bounds='clip').fit([x[0] for x in vr],[x[1] for x in vr])
    chosen=[x for x in tr if x[0]>=threshold];cal=calibration.predict([x[0] for x in chosen]) if chosen else np.array([])
    tm['calibration_brier']=float(np.mean((cal-np.array([x[1] for x in chosen]))**2)) if chosen else None
    ece=0
    for low in np.arange(0,1,.1):
        ids=(cal>=low)&(cal<(low+.1) if low<.9 else cal<=1)
        if ids.any():ece+=float(ids.mean()*abs(cal[ids].mean()-np.array([x[1] for x in chosen])[ids].mean()))
    tm['calibration_ece']=ece
    aps=[]
    for iou in np.arange(.5,.951,.05):
        # Match separately at every IoU and compute AP by class.
        rec=[x for p,r in zip(tp,[rows[i] for i in test]) for x in match(p,r,float(iou))];classaps=[]
        for label in range(1,len(LABELS)+1):
            n=sum(r['labels'].count(label) for r in [rows[i] for i in test])
            if not n:continue
            xs=sorted([x for x in rec if x[2]==label],reverse=True);t=np.cumsum([x[1] for x in xs]);pr=t/np.maximum(1,np.arange(1,len(xs)+1));re=t/n;classaps.append(np.mean([max(pr[re>=v],default=0) for v in np.linspace(0,1,101)]))
        aps.append(float(np.mean(classaps)))
    tm['map50_95']=float(np.mean(aps))
    out=APP/'public/model';export=Export(model,anchors).eval();sample=tensor(rows[test[0]]['path'])[None]
    torch.onnx.export(export,sample,str(out/'detector.onnx'),input_names=['image'],output_names=['boxes','probabilities'],opset_version=17,dynamo=False)
    import onnxruntime as ort
    sess=ort.InferenceSession(str(out/'detector.onnx'),providers=['CPUExecutionProvider']);actual=sess.run(None,{'image':sample.numpy()})
    with torch.no_grad():expected=export(sample)
    parity=max(float(np.max(np.abs(x-y.numpy()))) for x,y in zip(actual,expected));assert parity<1e-4
    (ROOT/'checkpoints').mkdir(exist_ok=True)
    torch.save({'head':model.head.state_dict(),'labels':LABELS},ROOT/'checkpoints/detector.pt')
    report={'model_version':args.version,'task':'object-detection','architecture':'COCO pretrained SSDLite320 MobileNetV3 frozen backbone; trained waste classification and regression heads','labels':LABELS,'input_size':320,'input_scale':'RGB / 127.5 - 1; bilinear stretch','threshold':round(threshold,4),'nms_iou':.45,'max_detections':10,'raw_candidate_limit':150,'best_epoch':best_epoch,'seed':SEED,'split_counts':dict(Counter(r['split'] for r in rows)),'source_counts':dict(Counter(r['domain'] for r in rows)),'unique_source_groups':len(set(r['group'] for r in rows)),'objects_by_split':{s:dict(Counter(LABELS[l-1] for r in rows if r['split']==s for l in r['labels'])) for s in ['train','validation','test']},'test':tm,'validation':vm,'calibration':{'method':'validation isotonic regression; object correctness means same class and IoU >= 0.5','x':calibration.X_thresholds_.tolist(),'y':calibration.y_thresholds_.tolist(),'validation_predictions':len(vr)},'history':history,'onnx_parity_max_error':parity,'model_sha256':hashlib.sha256((out/'detector.onnx').read_bytes()).hexdigest(),'physical_item_holdout_verified':False,'limitations':['Image/source split is not verified physical-item holdout.','Public datasets are not Thai field validation.','Rare pressurised and broken-glass categories may have low recall.','Scores apply only to detected objects, not missing objects or overall image accuracy.','No automatic training from unreviewed feedback.']}
    (out/'detector-metadata.json').write_text(json.dumps(report,indent=2),encoding='utf-8');(ROOT/'results/detection-evaluation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    with (ROOT/'results/detection-manifest.csv').open('w',newline='',encoding='utf-8') as f:
        w=csv.writer(f);w.writerow(['path','domain','group','split','sha256','objects']);w.writerows([[str(r['path'].relative_to(ROOT)),r['domain'],r['group'],r['split'],r['sha256'],len(r['labels'])] for r in rows])
    examples=APP/'public/detection-examples';examples.mkdir(exist_ok=True);catalog=[]
    for domain in ['taco','ewaste']:
        selected=sorted([i for i in test if rows[i]['domain']==domain],key=lambda i:len(rows[i]['labels']),reverse=True)[:3]
        for i in selected:
            name=f'{domain}-{i}.jpg';Image.open(rows[i]['path']).convert('RGB').save(examples/name,quality=88);catalog.append({'image':'detection-examples/'+name,'source':domain,'ground_truth_count':len(rows[i]['labels']),'source_group':rows[i]['group'],'note':'held-out dataset image, not a Thai field test'})
    (examples/'catalog.json').write_text(json.dumps(catalog,indent=2),encoding='utf-8');print(json.dumps({'test':tm,'threshold':threshold,'parity':parity}),flush=True)

    subprocess.run([sys.executable,str(ROOT/'evaluate_detector.py')]+(['--reviewed',args.reviewed] if args.reviewed else []),check=True)

if __name__=='__main__':main()
