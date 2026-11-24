# การทดลองสำหรับ CE564

## 1. HOG + สี + Linear SVM เทียบผล MobileNetV2 เดิม

รันจริงวันที่ 24 พฤศจิกายน 2026 สคริปต์ `ml/benchmark_baseline.py` ใช้ไฟล์ภาพตาม `ml/results/split-manifest.csv` เดิม ตรวจชื่อ/label ของ test ให้ตรงกับ archived predictions และปฏิเสธชื่อซ้ำที่จับคู่ไม่ได้

| ระบบ | ภาพทดสอบประเภทที่รู้จัก | Accuracy ก่อนปฏิเสธผล | Macro F1 (6 ประเภท) |
| --- | ---: | ---: | ---: |
| HOG + colour histogram + Linear SVM | 532 | 60.15% | 0.6033 |
| MobileNetV2 features + classifier รุ่น v2 (ผลเดิมที่จับคู่ภาพตรงกัน) | 532 | 82.14% | 0.8423 |

Accuracy ต่างกันประมาณ 21.99 percentage points การเปรียบเทียบนี้สนับสนุนการเลือกใช้ representation จาก pretrained CNN ในระบบปัจจุบัน ไม่ใช่ข้อพิสูจน์ว่า CNN ทุกแบบดีกว่า ML ทุกงาน และไม่ใช่ผลพัฒนา weights ใหม่

### การออกแบบ

- รูป baseline: RGB 64×64; gradient จาก grayscale; unsigned orientation 9 bins; cell 8×8; block 2×2 cells พร้อม L2 normalization; colour histogram ช่องละ 16 bins
- StandardScaler fit เฉพาะ train แล้ว LinearSVC แบบ class-balanced, seed42, dual solver, tolerance0.001, max10000 iterations
- ทดลอง C=0.01/0.1/1.0 บน train เดิม เลือกจาก validation macro F1 เท่านั้น ผลเลือก C=0.01 (validation F1 ประมาณ0.5605) ไม่ refit ด้วย test
- ปฏิเสธ group/SHA256 ข้าม split; split เดิมยังไม่ยืนยันว่าแยกตามวัตถุจริง
- เทียบเฉพาะ test truth 6 ประเภทเดียวกันทั้งสองระบบ หาก CNN ทำนาย unknown จะนับเป็นผิด/false negative ไม่ตัดภาพนั้นทิ้ง
- Baseline ไม่ใช้ unknown เป็นคลาสฝึก แต่ CNN เดิมใช้ unknown และให้น้ำหนักภาพไทยเพิ่ม จึงเป็นการเทียบระบบสองแนวทางที่ตั้งค่าไว้ ไม่ใช่ controlled architecture-only ablation
- CNN ใช้ผลทำนาย v2 ที่บันทึกไว้ ไม่ได้ฝึกหรือวัดเวลาใหม่ในรอบนี้ ขนาดภาพและ preprocessing ต่างกันตามแต่ละระบบ
- ไม่ใช้เวลา batch prediction ของ SVM ไปอ้างว่าเร็วกว่า CNN เพราะยังไม่รวม feature extraction/กล้อง/อุปกรณ์และไม่ใช่ benchmark เดียวกัน

### ทำซ้ำและตรวจหลักฐาน

ติดตั้ง environment ตาม `ml/requirements.txt` และเตรียมไฟล์ข้อมูลตาม manifest เดิมก่อน รัน:

```sh
python ml/benchmark_baseline.py
```

ผลลัพธ์: `ml/results/course-baseline.json` (C ที่ทดลอง, split counts, confusion matrix, SHA256 manifest, ข้อจำกัด) และ `course-baseline-predictions.csv` (คำตอบ baseline/CNN รายภาพ) cache ใน `ml/cache/course-hog.npz` ไม่เข้า Git ยังไม่ส่งออก baseline ไปใช้บนเว็บ

## 2. การค้นคืนคำแนะนำภาษาไทย

Corpus 8 หัวข้อ ใช้ character n-gram TF-IDF + cosine + explicit topic และกฎปฏิเสธขอบเขต รัน `npm run evaluate:retrieval`

| ตัววัด | ผลในชุดคำถามของผู้พัฒนา |
| --- | --- |
| คำถามที่มีคำตอบตรงหัวข้ออันดับแรก | 18/18 |
| คำถามที่มีคำตอบอยู่ใน 3 อันดับแรก | 18/18 |
| ปฏิเสธคำถามนอกขอบเขต | 6/6 |
| ปฏิเสธผิดในคำถามที่ตอบได้ | 0/18 |

**เป็นชุด regression ที่ใช้ระหว่างพัฒนาและแก้กฎแล้ว ไม่ใช่ independent test** ตัวเลขนี้ไม่ใช่ความถูกต้อง100%ของคำแนะนำหรือ LLM และไม่ใช้แทนความแม่นยำโมเดลภาพ p95 ใน JSON เป็นเวลาค้นใน Node บนเครื่องพัฒนา ไม่ใช่เวลา end-to-end บนมือถือ

## 3. การทดลองที่เตรียมไว้ แต่ยังไม่มีผลจริง

- เก็บขยะใช้แล้วไทยและแยกตาม physical item/session ก่อนฝึก: มี template/validator และคำแนะนำ ยังไม่ได้เก็บชุดใหม่
- เพิ่มข้อมูลไทย/ปรับ frozen backbone แล้วเทียบ candidate กับ SSDLite v3: ยังไม่ฝึก ไม่อ้าง recall ดีขึ้น
- LLM local-vs-API: มี CLI/คำถาม/prompt/แบบตรวจ แต่ยังไม่มีโมเดล local หรือ API key ให้รัน จึงยังไม่มีคะแนน quality, latency หรือ cost ของ LLM
- ชุดคำถามอิสระจากผู้ใช้: ยังต้องเก็บโดยไม่ให้ผู้พัฒนาเห็นก่อนกำหนดการประเมิน

ก่อนเผยแพร่ candidate ต้องรายงาน recall รายหมวดอันตราย, count MAE, calibration, false negatives, latency บนอุปกรณ์จริง และ regression ทั้งเว็บ ไม่เลือกรุ่นจากภาพ test ที่นำไปสาธิตซ้ำ
