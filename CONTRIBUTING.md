# ทำงานร่วมกันแบบง่าย

## เริ่มแต่ละงาน

```sh
git switch main
git pull --ff-only
git switch -c feature/ชื่อส่วนงาน
```

แบ่งงาน: AI ดู `ml/` และ `public/model/`, Web ดู `src/`, QA ดู `docs/` และ CSV ทดสอบ ประสานกันก่อนเปลี่ยนชื่อคลาส ลำดับ labels การเตรียมภาพ หรือโครงสร้าง metadata เพราะกระทบทุกส่วน

## ส่งให้เพื่อนตรวจ

```sh
npm test
npm run build
git add ชื่อไฟล์ที่แก้
git commit -m "อธิบายสิ่งที่แก้"
git push -u origin feature/ชื่อส่วนงาน
```

เปิด Pull Request บน GitHub บอกว่าแก้ปัญหาอะไร ทดสอบอย่างไร และแนบภาพหน้าจอถ้าเปลี่ยน UI ให้เพื่อนตรวจอย่างน้อยหนึ่งคนก่อน merge ห้าม force push main ใช้ branch สั้น ๆ หนึ่งเรื่องต่อ PR หาก conflict ให้คุยกับเจ้าของไฟล์และเก็บการเปลี่ยนแปลงทั้งสองฝั่งอย่างเหมาะสม

## สิ่งที่ไม่ใส่ Git

ไม่ commit `.env`, token, รหัสผ่าน, ภาพส่วนตัว, `.venv`, `node_modules`, dataset ขนาดใหญ่ หรือ build output โมเดล ONNX (~9 MB) และผลประเมินรุ่นที่ใช้ต้อง commit คู่กัน อย่าใส่ชื่อผู้ทดสอบหรือข้อมูลระบุตัวตนใน field-test CSV

## เมื่อเปลี่ยนโมเดล

เปลี่ยน `model_version` ให้เป็นรุ่นใหม่ใน `ml/train.py` ก่อนฝึก บันทึก source/split/seed และความต่างของผล อัปเดต model card และ README ให้ตรงกัน หากเป็นการเปรียบเทียบ Model A/B ต้องใช้ holdout เดียวกันที่ล็อกไว้ ห้ามใช้ test เพื่อเลือก hyperparameter หรือปรับ threshold

เจ้าของ repository เพิ่มเพื่อนที่ Settings > Collaborators ได้ โดยเพื่อนต้องตอบรับคำเชิญ ไม่จำเป็นต้องแชร์รหัสผ่านหรือ token
