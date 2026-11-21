"""Collect attributed product photos; labels need visual review before ML use.
Open Food Facts images CC BY-SA 3.0. These are NOT physical field-test photos.
"""
from pathlib import Path
import hashlib,json,urllib.request,urllib.parse,urllib.error,time
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
QUERIES=[('ichitan','อิชิตัน','plastic',6),('singha water','สิงห์','plastic',3),('m-150','เอ็ม-150','glass',4),('carabao','คาราบาว','glass',4),('shark energy','ชาร์ค','metal',3),('tipco','ทิปโก้','unknown',2),('mama instant','มาม่า','unknown',2)]
def fetch(url):
    for attempt in range(4):
        try:return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'AIWasteVision-EducationalPrototype/2.0'}),timeout=25).read()
        except urllib.error.HTTPError as error:
            if error.code not in [429,500,502,503,504] or attempt==3:raise
            time.sleep(2**(attempt+1))
def main():
    target=ROOT/'public'/'examples';target.mkdir(exist_ok=True);records=[];seen=set()
    for query,brand,label,limit in QUERIES:
        url='https://world.openfoodfacts.org/cgi/search.pl?'+urllib.parse.urlencode({'search_terms':query,'search_simple':1,'action':'process','json':1,'page_size':limit+4})
        cache=ROOT/'ml'/'cache'/('off-'+query.replace(' ','-')+'.json');cache.parent.mkdir(exist_ok=True)
        try:
            if not cache.exists():cache.write_bytes(fetch(url))
            products=json.loads(cache.read_text(encoding='utf-8')).get('products',[])
        except Exception as error:print(query,error,flush=True);continue
        used=0
        for p in products:
            image=p.get('image_front_url');code=p.get('code')
            if not image or not code or code in seen:continue
            name='thai-'+code
            try:
                dest=target/f'{name}.jpg';data=dest.read_bytes() if dest.exists() else fetch(image);dest.write_bytes(data)
                with Image.open(dest) as im:
                    if min(im.size)<80:dest.unlink();continue
            except Exception as error:print(code,error,flush=True);continue
            seen.add(code);used+=1
            records.append({'id':name,'brand':brand,'name':p.get('product_name_th') or p.get('product_name') or brand,'label':label,'image':f'examples/{name}.jpg','source_url':'https://world.openfoodfacts.org/product/'+code,'image_url':image,'sha256':hashlib.sha256(data).hexdigest(),'split':('train' if used%5 in [1,2,3] else 'validation' if used%5==4 else 'test'),'kind':'product-photograph','license':'CC BY-SA 3.0','credit':'Open Food Facts contributors','reviewed':False,'packaging':p.get('packaging'),'note':'ภาพผลิตภัณฑ์เพื่อการศึกษา ไม่ใช่หลักฐานการทดสอบภาคสนาม'})
            print(brand,code,label,flush=True)
            if used>=limit:break
        time.sleep(1)
    (target/'catalog.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    sheet=Image.new('RGB',(250*5,300*((len(records)+4)//5)),'#e8ece8')
    for i,r in enumerate(records):
        with Image.open(ROOT/'public'/r['image']) as im:
            im=im.convert('RGB');im.thumbnail((230,255));tile=Image.new('RGB',(250,300),'white');tile.paste(im,((250-im.width)//2,0));draw=ImageDraw.Draw(tile);draw.text((5,263),r['id'],fill='black');draw.text((5,279),r['label'],fill='black');sheet.paste(tile,((i%5)*250,(i//5)*300))
    (ROOT/'tmp').mkdir(exist_ok=True);sheet.save(ROOT/'tmp'/'thai-catalogue.jpg')
if __name__=='__main__':main()
