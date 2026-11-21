# AI WasteVision

เว็บภาษาไทยสำหรับทดลองจำแนก **พลาสติก / โลหะ / กระดาษ / กระดาษแข็ง / เศษอาหาร** ด้วยโมเดลที่ฝึกจริง ภาพประมวลผลบนอุปกรณ์ผู้ใช้ ไม่ต้องมีบัญชีหรือ API key

**เว็บทดลอง:** https://ai-wastevision-th.tenderheron1024.chatgpt.site

## เริ่มพัฒนาเว็บ (ไม่ต้องฝึกโมเดลใหม่)

ติดตั้ง Node.js 22 ขึ้นไปและ Git จากนั้นเปิด terminal:

```sh
git clone https://github.com/TomatosHanWhann/AI-WasteVision.git
cd AI-WasteVision
npm ci
npm run build
npm run dev
```

เปิด URL ที่ terminal แสดง โดยทั่วไปคือ `http://127.0.0.1:5173` รุ่นโมเดลอยู่ใน repository แล้ว `npm run build` เตรียม runtime WASM ที่ต้องใช้ด้วย กล้องทำงานบน localhost หรือ HTTPS; เปิดเว็บผ่าน IP แบบ HTTP อาจใช้กล้องไม่ได้ แต่ยังเลือกภาพได้

## ทดลองใช้

1. เปิดกล้องแล้วถ่ายภาพ หรือเลือก JPG / PNG / WebP ไม่เกิน 15 MB
2. จัดให้มีวัตถุหลักหนึ่งชิ้นตรงกลาง ระบบใช้ภาพสี่เหลี่ยมจัตุรัสกลางภาพ
3. กด **วิเคราะห์ภาพ** ดูประเภท คะแนนทั้ง 5 และผลปฏิเสธเมื่อคะแนนต่ำ
4. เลือกสภาพสิ่งของเพื่ออ่านคำแนะนำ จุดรับแต่ละพื้นที่อาจมีเงื่อนไขต่างกัน
5. เลือกคำตอบจริงและอุปกรณ์ แล้วกดบันทึก ไปที่ **ผลทดสอบของฉัน** เพื่อส่งออก CSV
6. ใช้ **แชร์ให้เพื่อน** เพื่อแสดง QR Code ของ URL ที่เปิดอยู่

ประวัติเก็บใน localStorage ของเบราว์เซอร์นั้น ไม่รวมอัตโนมัติระหว่างคนและไม่เก็บรูป ส่ง CSV ให้ผู้รับผิดชอบ QA รวบรวมก่อนล้างข้อมูลเว็บ รูปตัวอย่างเป็นภาพจากชุดทดสอบเดิม แยกจากผลทดสอบหน้างานด้วยคอลัมน์ `source`

## ผลโมเดลรุ่นแรก

MobileNetV2 pretrained ImageNet + multinomial logistic classifier (frozen feature transfer), seed 42

| ตัวชี้วัด | ค่าที่วัดได้ |
| --- | --- |
| จำนวนภาพ 5 ประเภท | 3,083 |
| ฝึก / validation / test | 2,156 / 462 / 465 |
| Accuracy บน test ก่อนปฏิเสธ | 86.67% |
| Macro F1 บน test ก่อนปฏิเสธ | 0.8660 |
| เกณฑ์คะแนนสำหรับรับจำแนก | 0.95 |
| สัดส่วนภาพในขอบเขตที่รับจำแนก | 42.58% |
| ปฏิเสธภาพนอกขอบเขต (252 ภาพ) | 78.97% |

**ข้อจำกัดที่ต้องอ่าน:** นี่คือการแบ่งตามภาพ ไม่ได้ยืนยันว่าวัตถุจริงเดียวกันไม่ข้ามชุด จึงยังไม่ผ่านเกณฑ์ holdout ตามวัตถุในแผน คะแนน 86.67% เป็นผลก่อนปฏิเสธ ไม่ใช่ความแม่นยำของทุกผลที่เว็บยอมรับ เกณฑ์ 0.95 ค่อนข้างเข้มงวดและอาจปฏิเสธภาพในขอบเขตจำนวนมาก ภาพนอกขอบเขตบางภาพยังได้คะแนนสูง

ยังไม่มีการเก็บภาพบริบทไทย การทดลองวัตถุใหม่จริง การวัด Chrome/Safari บนมือถือจริง หรือการทดลองผู้ใช้ประมาณ 10 คน ดู [แผน QA](docs/TESTING.md)

ผลละเอียดและหลักฐานอยู่ใน `ml/results/evaluation.json`, `ml/results/test-predictions.csv`, `ml/results/split-manifest.csv` เว็บอ่าน metadata รุ่นเดียวกันจาก `public/model/metadata.json`

## โครงสร้างที่ทีมแก้ได้

```text
src/main.js           หน้าจอ กล้อง การยืนยันผล และการแชร์
src/style.css         รูปแบบหน้าจอและมือถือ
src/domain.js         คลาส กฎคำแนะนำ CSV และตัวชี้วัด
src/inference.js      เตรียมภาพและเรียกโมเดลบนเบราว์เซอร์
public/model/         โมเดล ONNX และ metadata ที่ใช้งานจริง
public/samples/       ภาพตัวอย่าง RealWaste พร้อมเครดิต
ml/                   ดาวน์โหลดข้อมูล ฝึก ส่งออก และประเมิน
docs/                 การทดสอบ ส่งต่องาน และเผยแพร่
tests/                การทดสอบกฎสำคัญ
```

## ฝึกโมเดลใหม่

ใช้ Python 3.13 รุ่น 64-bit ขั้นตอนนี้แยกจากการพัฒนาเว็บ ข้อมูลดาวน์โหลดประมาณ 657 MB และต้องมีพื้นที่ว่างสำหรับ zip/ภาพ/cache อย่างน้อย 3 GB

```sh
python -m venv .venv
# Windows PowerShell
.venv/Scripts/python -m pip install -r ml/requirements.txt
.venv/Scripts/python ml/download_data.py
.venv/Scripts/python ml/train.py
# macOS/Linux ใช้ .venv/bin/python แทน .venv/Scripts/python
npm run build
```

น้ำหนัก ImageNet จะดาวน์โหลดครั้งแรก การฝึกใช้ CPU ได้ ผลฝึกจะเขียนทับโมเดลและรายงานปัจจุบัน จึงควรทำบน branch ใหม่ `ml/cache` เก็บ feature cache เพื่อลดเวลาทดลองครั้งถัดไป

ถ้าทีมเก็บภาพตามวัตถุแล้ว ให้สร้าง CSV แบบ `ml/manifest.example.csv` และรัน `python ml/train.py --manifest path/to/manifest.csv` เส้นทางภาพอ้างจากโฟลเดอร์ที่มี CSV ทุกภาพของวัตถุเดียวกันต้องมี `group_id` เดียวกันและอยู่ split เดียว สคริปต์ตรวจทั้ง group และไฟล์ภาพซ้ำข้าม split ชุด default จะไม่อ้างว่า item-disjoint

## ตรวจงานก่อนส่ง

```sh
npm test
npm run build
```

GitHub Actions รันสองคำสั่งนี้ทุก push และ Pull Request รวมถึงตรวจ hash/รูปแบบโมเดล การตรวจ browser และกล้องจริงทำตาม `docs/TESTING.md` CI ไม่ได้อ้างว่าแทนการทดสอบบนมือถือจริง

## เผยแพร่และทำงานร่วมกัน

อ่าน [CONTRIBUTING.md](CONTRIBUTING.md), [คู่มือเผยแพร่](docs/DEPLOYMENT.md), [บันทึกส่งต่องาน](docs/HANDOFF.md) และ [model card](docs/MODEL_CARD.md)

ใช้ ONNX Runtime Web แทน TF.js ที่เสนอในแผน เพื่อส่งออกจาก Python/PyTorch ได้โดยตรง แต่ยังคงสถาปัตยกรรม static web + client inference ไม่มี backend รับภาพ

## แหล่งข้อมูลและสิทธิ์

- RealWaste: Single, S., Iranmanesh, S., & Raad, R. (2023), UCI, DOI [10.24432/C5SS4G](https://doi.org/10.24432/C5SS4G), CC BY 4.0 ภาพตัวอย่างถูกย่อ/บีบอัดจากต้นฉบับ
- [Torchvision MobileNetV2](https://docs.pytorch.org/vision/stable/models/generated/torchvision.models.mobilenet_v2.html) pretrained ImageNet1K V2; ดูสิทธิ์และเงื่อนไขข้อมูลต้นทางก่อนใช้นอกโครงงาน
- ONNX Runtime (MIT), Lucide (ISC), Noto Sans Thai (OFL-1.1), QRCode (MIT), Vite (MIT)

โค้ดยังไม่ได้กำหนดใบอนุญาตเผยแพร่สาธารณะของทีม Repository คงสถานะ private ตามเดิม เว็บทดลองเท่านั้นที่เปิดให้ผู้มีลิงก์เข้าถึงได้
