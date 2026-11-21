# การเผยแพร่

ใช้โครงการ Sites เดิมใน `.openai/hosting.json` และคงผู้ชมแบบ public ลิงก์ปัจจุบัน: https://ai-wastevision-th.tenderheron1024.chatgpt.site

## Runtime

Vite + Cloudflare Worker; static assets อยู่ `dist/client`, Worker อยู่ `dist/server/index.js` และ config อยู่ `dist/server/wrangler.json` ฐานข้อมูล D1 binding `DB` เปิดผ่าน hosting metadata; migrations ที่สร้างด้วย Drizzle อยู่ `drizzle/` และคัดลอกเป็น `dist/.openai/drizzle/` ตอน build

กำหนด `PHONE_HASH_SECRET` เป็น secret สุ่มที่มีความยาวเพียงพอผ่าน Sites runtime ก่อน deploy ห้ามใส่ค่าจริงลง Git ห้ามเปลี่ยน secret โดยไม่มีแผนย้ายข้อมูล เพราะ HMAC ของสมาชิกเดิมจะเปลี่ยน `.dev.vars` ใช้เฉพาะท้องถิ่นและถูกลบออกจาก build output โดย build hook

## ขั้นตอน

1. รัน `npm test`, `python ml/check_model.py`, `npm run build`
2. ตรวจว่าไม่มี `.dev.vars` ใน artifact และมี presentation.html, โมเดล, runtime, migration ครบ
3. ใช้ source workflow ของ Sites เพื่อ commit/push และสร้าง archive จาก dist ของ source เดียวกัน
4. บันทึก version ด้วย exact commit SHA และ archive แล้ว deploy saved version
5. ตรวจหน้า public, metadata, การโหลดโมเดล, บัตร และ persistence หลังเปิด session ใหม่
6. push commit เดียวกันไป GitHub เพื่อให้ทีมแก้ต่อได้

GitHub Actions ตรวจโค้ด/build/model แต่ไม่ publish Sites อัตโนมัติ หากย้าย host ต้องมี Worker/D1 หรือ backend ที่เทียบเท่า การส่ง dist/client ขึ้น static host เพียงอย่างเดียวจะใช้บัตรไม่ได้

ย้อนกลับให้คืนทั้ง Worker, assets, โมเดล และ metadata ที่ตรงกัน หลีกเลี่ยงการย้อน schema ที่ทำให้ข้อมูลหาย HTTPS จำเป็นต่อกล้องและ cookie Secure
