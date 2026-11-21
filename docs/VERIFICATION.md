# ผลตรวจที่รันจริง

วันที่ 21 พฤศจิกายน 2026 (Asia/Bangkok) แยกจากแผน QA ที่ยังต้องเก็บเพิ่ม

| ส่วน | ผลและหลักฐาน |
| --- | --- |
| โมเดล | ฝึกจริงจาก RealWaste, 5 คลาส 3,083 ภาพ เลือก C/threshold จาก validation |
| Export | ตรวจ PyTorch/ONNX parity และประเมิน test ทุกภาพผ่าน ONNX export จริง |
| Contract | `ml/check_model.py` ผ่าน hash, labels, shape, ONNX checker, metadata ตรง report |
| Domain tests | `npm test` ผ่าน 5 กรณี ครอบคลุม rejection, hazardous condition, metric, CSV และ bad storage |
| Build | `npm run build` ผ่าน สร้าง static assets/ฟอนต์/โมเดล/runtime |
| Dependency | หลังอัปเดต Vite เป็น 7.3.8 npm install รายงาน 0 vulnerabilities ณ เวลาตรวจ |
| Chrome inference | เปิดเว็บ local ผ่าน Chrome จริง โมเดล WASM โหลดสำเร็จ พลาสติกตัวอย่างได้คะแนนสูงสุด 58.3% → reject; เศษอาหาร 96.8% → accepted, inference 111–183 ms ในการทดลองนี้ ไม่ใช่ benchmark มือถือ |
| Guidance | เปลี่ยนสภาพสะอาดเพื่อดูคำแนะนำเศษอาหารได้ ทดสอบกฎ hazardous ด้วย unit tests |
| Test log | ยืนยัน ground truth พลาสติกที่ถูก reject แสดงเป็นผิดใน metrics พร้อม confusion matrix; เปิดหน้าใหม่แล้วอ่านประวัติเดิมได้ |
| CSV | ดาวน์โหลดไฟล์ผ่านปุ่มจริง ตรวจไฟล์ที่ได้มี UTF-8 ภาษาไทย model_version, source, prediction, confidence, threshold, truth, latency และ condition ครบ |
| QR/share | เปิด dialog สร้าง QR ของ URL ปัจจุบัน และกดคัดลอกได้รับข้อความสำเร็จ |
| UI | ดูภาพหน้าจอ desktop 1440 และ mobile 390; mobile scrollWidth=390 ไม่มี horizontal overflow; reviewer ตรวจและยืนยันแก้ finding เรื่องเอกสารทิศทางแล้ว |

## ขอบเขตที่ยังไม่ตรวจยืนยัน

- กล้องจริงและการกดสิทธิ์กล้องบนอุปกรณ์ผู้ใช้ ไม่ได้เปิดกล้องส่วนตัวระหว่างการพัฒนา
- การเลือกไฟล์ผ่าน automation ถูกบล็อกโดยสิทธิ์ “Allow access to file URLs” ของส่วนขยาย ChatGPT ใน Chrome ไม่ได้แก้สิทธิ์ให้ผู้ใช้ จึงยังไม่นับ flow upload แบบ end-to-end ว่าผ่านอัตโนมัติ
- Safari/iPhone และ Android จริง, เวลา p95, แสงหน้างาน, ชุดวัตถุใหม่ 40+10 และการทดลองผู้ใช้ประมาณ 10 คนยังต้องทำ
- Chrome ที่ใช้ตรวจมี third-party VoiceIn overlay ใน screenshot; overlay ไม่ใช่ส่วนหนึ่งของเว็บ

ชุดทดสอบภาพมี Accuracy 86.67% / Macro F1 0.866 ก่อน rejection เป็น exploratory image split ไม่ใช่หลักฐานผ่าน physical-item holdout
