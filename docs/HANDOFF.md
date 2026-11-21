# ส่งต่องานทีม 3 คน

## สิ่งที่มีแล้ว

โมเดล baseline ฝึกจริงจาก RealWaste 5 ประเภท, ไฟล์ ONNX ที่เว็บเรียกใช้, pipeline ฝึก/ส่งออก/ประเมิน, รายงานพร้อม prediction รายภาพ, เว็บภาษาไทย, กล้อง/เลือกภาพ/ผล/คำแนะนำ/QR, ประวัติและ CSV บนอุปกรณ์, unit tests และ CI

## งานถัดไป

| ผู้รับผิดชอบ | งาน | หลักฐานส่งต่อ |
| --- | --- | --- |
| AI | เก็บภาพบริบทไทย สร้าง manifest แยกตามวัตถุ ล็อก holdout ฝึก Model B | manifest, model version, evaluation ของ A/B บน holdout เดียวกัน |
| Web | ทดสอบกล้องจริงบน Android/iPhone และข้อผิดพลาด permission | browser/device log และวิดีโอ demo |
| QA | วัตถุใหม่ 40+10 ชิ้น และผู้ใช้ประมาณ 10 คน | CSV ไม่ระบุตัวตน, confusion matrix, เวลา, ข้อผิดพลาด |

## การตัดสินใจที่ทีมต้องรู้

- ใช้ vanilla JavaScript/Vite เพื่อมีจุดแก้น้อย ไม่ต้องเรียน backend หรือจัดการ API key
- ใช้ ONNX แทน TF.js แต่ยังเป็น MobileNetV2 และ client-side inference ตามเป้าหมายในแผน
- ไม่มีฐานข้อมูลส่วนกลาง; แต่ละคน export CSV ให้ QA รวมเอง
- เกณฑ์คะแนน 0.95 เลือกจาก validation อย่าง conservative อย่าลดเพื่อทำให้ผล demo ดูมั่นใจโดยไม่มีผลวัดรองรับ
- เป็น feature-transfer baseline ยังไม่ได้ fine-tune backbone หรือฝึกภาพไทย
- Accuracy/Macro F1 ชุดภาพไม่ได้ยืนยันคุณภาพกับวัตถุใหม่ ผลตามแผนส่วนนี้ยังคงเป็นงานทีม
- ไม่ได้เพิ่ม collaborator โดยไม่มีรายชื่อ ให้เจ้าของเพิ่มเพื่อนด้วย GitHub account ของแต่ละคน

## ปัญหาที่พบบ่อย

โหลดโมเดลไม่ได้: ตรวจเน็ตและ `public/model/` กับ runtime จาก `npm run build` กดโหลดใหม่; กล้องไม่ได้: ใช้ HTTPS/localhost เปิด permission หรืออัปโหลด; ผลส่วนมากไม่แน่ใจ: ถ่ายทีละชิ้นกลางภาพในแสงพอดีและอ่านข้อจำกัด threshold; CSV ของเพื่อนไม่ปรากฏ: เป็น localStorage คนละเบราว์เซอร์ ต้องรวมไฟล์เอง
