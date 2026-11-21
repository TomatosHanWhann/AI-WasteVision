# AI WasteVision

ระบบภาษาไทยสำหรับเรียนรู้การคัดแยกขยะจากภาพ รองรับพลาสติก โลหะ กระดาษ กระดาษแข็ง เศษอาหาร และแก้ว พร้อมผลนอกขอบเขต โมเดล ONNX ทำงานบนอุปกรณ์ ภาพไม่ถูกส่งไปจัดเก็บบนเซิร์ฟเวอร์

**เว็บไซต์:** https://ai-wastevision-th.tenderheron1024.chatgpt.site

## เริ่มพัฒนา

ต้องใช้ Node.js 22.12 ขึ้นไป และ Git

```sh
git clone https://github.com/TomatosHanWhann/AI-WasteVision.git
cd AI-WasteVision
npm ci
```

คัดลอก `.dev.vars.example` เป็น `.dev.vars` สำหรับสภาพแวดล้อมท้องถิ่นเท่านั้น แล้วรัน:

```sh
npm run db:local
npm run dev
```

เปิด URL ที่ terminal แสดง กล้องต้องใช้ localhost หรือ HTTPS การจำแนกไม่ต้องมีบัญชี ส่วนบัตรสะสมแต้มต้องมี Worker + D1 และ `PHONE_HASH_SECRET` จึงไม่สามารถใช้ static hosting เพียงอย่างเดียวได้

## ความสามารถ

- หน้าเกี่ยวกับระบบและ `presentation.html` สำหรับนำเสนอ พร้อมคู่มือและข้อจำกัด
- กล้อง/เลือก JPG, PNG, WebP สูงสุด 15 MB; วิเคราะห์สิ่งของหลักหนึ่งชิ้นด้วยโมเดลจริง
- คะแนนวัสดุหกประเภทและผลนอกขอบเขต พร้อมคำแนะนำตามสภาพสิ่งของ
- ภาพผลิตภัณฑ์ 23 ภาพจาก 9 แบรนด์ที่พบในประเทศไทย และตัวอย่าง RealWaste หกประเภท พร้อมที่มา
- บัตรสะสมแต้มด้วยหมายเลขโทรศัพท์ไทย 1 รายการที่ยืนยัน = 1 แต้ม ครบ 1,000 ชิ้นแสดงระดับ A
- ภาพตัวอย่าง ผลไม่แน่ใจ และสภาพอันตรายไม่เพิ่มแต้ม; ภาพเดิมไม่เพิ่มซ้ำในบัตรเดิม จำกัด 100 รายการต่อวัน
- QR และลิงก์แบ่งปันเว็บไซต์ ไม่มีหน้าภายในทีมบนเว็บสาธารณะ

บัตรนี้เป็นต้นแบบที่ไม่มี OTP ผู้ที่ทราบเบอร์อาจเรียกดูยอดของเบอร์นั้นได้ ไม่เหมาะกับรางวัลที่มีมูลค่าหรือข้อมูลส่วนบุคคลเพิ่มเติม ยอดเป็นการยืนยันของผู้ใช้ ไม่ใช่หลักฐานรับขยะจริงหรือระบบป้องกันการทุจริตสมบูรณ์ เซิร์ฟเวอร์เก็บ HMAC ของเบอร์ เลขท้ายสี่หลัก session และรายการยืนยัน ไม่เก็บเบอร์เต็มหรือภาพ

## โครงสร้าง

```text
src/views.js         เนื้อหาและหน้าจอสาธารณะ
src/main.js          กล้อง ผลวิเคราะห์ เส้นทาง และบัตร
src/inference.js     เตรียมภาพและ ONNX Runtime Web
src/domain.js        กฎการจำแนกและคำแนะนำ
src/loyalty.js       ติดต่อ API บัตร
worker/              API, session, HMAC และกฎสะสมแต้ม
db/, drizzle/        schema และ migrations
public/model/        โมเดลและ metadata
public/examples/     ภาพผลิตภัณฑ์และแหล่งที่มา
ml/                  ฝึก ส่งออก รายงาน และ manifest
docs/                หลักฐานตรวจงานและคู่มือพัฒนา
```

## โมเดลและหลักฐาน

MobileNetV2 ImageNet frozen features + balanced logistic classifier มีหกวัสดุและคลาส unknown ที่ฝึกจริง ใช้ภาพเต็มรักษาสัดส่วน เติมพื้นขาวเป็น 224×224 ไม่ตัดกลางภาพ เลือก hyperparameter และเกณฑ์ปฏิเสธจาก validation เท่านั้น

ผลปัจจุบันอยู่ใน `ml/results/evaluation.json` และ `public/model/metadata.json` พร้อมผลรายภาพและ split manifest อ่าน `docs/MODEL_CARD.md` ก่อนอ้างความแม่นยำ ภาพ RealWaste แบ่งตามภาพ ส่วนผลิตภัณฑ์แยกตาม SKU ยังไม่ใช่การประเมินวัตถุใช้แล้วในสภาพแวดล้อมไทยหรือการรับรองการจำแนกแบรนด์

## ตรวจและฝึก

```sh
npm test
npm run build
python ml/check_model.py
```

การฝึกต้องใช้ Python และ `ml/requirements.txt`; รัน `ml/download_data.py` แล้ว `ml/train.py` ภาพแบรนด์ที่ตรวจทานแล้วอยู่ใน repository พร้อม catalog; อย่ารันตัวรวบรวมทับป้ายกำกับที่ตรวจแล้วโดยไม่ตรวจทานใหม่ ข้อมูลและ feature cache ไม่เข้า Git หากมีภาพวัตถุจริงให้ใช้ manifest ตาม `ml/manifest.example.csv` เก็บทุกภาพของชิ้นเดียวกันไว้ split เดียว

## เผยแพร่

Sites ใช้โครงการเดิมใน `.openai/hosting.json` พร้อม D1 binding `DB` และ secret `PHONE_HASH_SECRET` ที่เก็บใน runtime เท่านั้น ไม่ใส่ secret ลง Git การ push GitHub ยังไม่เผยแพร่ Sites อัตโนมัติ ต้อง build/push/save/deploy source commit เดียวกัน ดู `docs/DEPLOYMENT.md`

แหล่งข้อมูล: RealWaste CC BY 4.0, Open Food Facts photographs CC BY-SA 3.0 ดูเครดิตและ URL รายภาพใน catalog ภาพผลิตภัณฑ์ไม่ได้แสดงถึงความร่วมมือหรือการรับรองจากเจ้าของแบรนด์ Repository ยังเป็น private; เว็บทดลองเปิดให้ผู้มีลิงก์
