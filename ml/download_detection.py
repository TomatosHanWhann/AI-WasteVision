"""Download the original TACO release thumbnails; retain provenance and retry safely."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import json, urllib.request, time, hashlib
import zipfile, shutil
from PIL import Image
ROOT = Path(__file__).resolve().parent / 'data' / 'taco'
URL = 'https://raw.githubusercontent.com/pedropro/TACO/master/data/annotations.json'

def download(im):
    dest = ROOT / im['file_name']
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        try:
            with Image.open(dest) as image: image.verify()
            return True
        except Exception: pass
    url = im.get('flickr_640_url') or im.get('flickr_url')
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent':'AI-WasteVision educational research dataset preparation'})
            data = urllib.request.urlopen(req, timeout=25).read()
            tmp = dest.with_suffix('.part')
            tmp.write_bytes(data)
            with Image.open(tmp) as image: image.verify()
            tmp.replace(dest)
            return True
        except Exception:
            time.sleep(1 + attempt)
    return False

if __name__ == '__main__':
    ROOT.mkdir(parents=True, exist_ok=True)
    annotation = ROOT/'annotations.json'
    if not annotation.exists(): urllib.request.urlretrieve(URL, annotation)
    dataset = json.loads(annotation.read_text(encoding='utf-8'))
    good=0;failed=[]
    with ThreadPoolExecutor(max_workers=6) as pool:
        jobs={pool.submit(download,im):im for im in dataset['images']}
        for n,job in enumerate(as_completed(jobs),1):
            if job.result(): good+=1
            else: failed.append(jobs[job]['id'])
            if n%100==0:print(f'Downloaded {n}/{len(jobs)}; verified {good}',flush=True)
    report={'dataset':'TACO','source':'https://doi.org/10.5281/zenodo.3587843','release_license':'CC BY 4.0','authors':'Pedro F. Proenca and Pedro Simoes','annotation_sha256':hashlib.sha256(annotation.read_bytes()).hexdigest(),'downloaded_images':good,'failed_image_ids':failed,'note':'640px derivatives; original annotation coordinates scaled at load time. Individual image license fields retained unchanged.'}
    (ROOT/'download-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report),flush=True)
    # Original e-waste release includes both box and polygon YOLO annotations.
    ew=ROOT.parent/'ewaste';ew.mkdir(exist_ok=True);archive=ew/'source.zip'
    expected='f73b30286225c208e98b34f81eb5ffef7baf79e883039d2087e8db53f6ee284e'
    if not archive.exists() or hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:
        req=urllib.request.Request('https://data.mendeley.com/public-files/datasets/77383kmdnw/files/ad031b3c-13e5-4913-8cdd-71dccfab980f/file_downloaded',headers={'User-Agent':'Mozilla/5.0 AI-WasteVision educational dataset preparation'})
        with urllib.request.urlopen(req,timeout=90) as response,archive.open('wb') as output:shutil.copyfileobj(response,output)
    assert hashlib.sha256(archive.read_bytes()).hexdigest()==expected
    with zipfile.ZipFile(archive) as z:
        for name in z.namelist():
            if not (ew/name).resolve().is_relative_to(ew.resolve()):raise ValueError('Unsafe archive path')
        z.extractall(ew)
    (ew/'provenance.json').write_text(json.dumps({'source':'https://doi.org/10.17632/77383kmdnw.1','authors':'Tanzila Afrin and Azizul Abedin Azmi','license':'CC BY 4.0','archive_sha256':expected,'note':'Contains supplied train augmentations; grouped by original pre-Roboflow filename, overlap removed in training loader.'},indent=2),encoding='utf-8')
    print('E-waste archive verified and extracted',flush=True)
