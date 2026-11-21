# เผยแพร่เว็บ

เว็บเป็น static build ไม่มี backend และไม่มี secret สำหรับ inference โมเดลและ runtime โหลดจาก host เดียวกัน `npm run build` สร้าง `dist/` พร้อมใช้งาน

## เว็บทดลองที่ส่งมอบ

https://ai-wastevision-th.tenderheron1024.chatgpt.site

Hosting: Sites โดย `.openai/hosting.json` เก็บ project ID และ dist directory ไม่มี credential/token อยู่ใน Git การแก้ GitHub เพียงอย่างเดียว **ยังไม่เผยแพร่ขึ้น Sites อัตโนมัติ** ต้อง build + publish รุ่นใหม่ผ่าน Sites จาก source commit ที่ตรวจแล้ว

## ทางเลือกที่ทีมดูแลจาก GitHub ได้เอง

ใช้ Cloudflare Pages หรือ Vercel เชื่อม private repository นี้ เลือก production branch `main`, build `npm run build`, output `dist`, Node.js 22 ไม่ต้องเพิ่ม environment variable ทุกครั้งที่ merge main ผู้ให้บริการจึงจะ build/deploy อัตโนมัติ ต้องมีบัญชีและเชื่อม GitHub ของเจ้าของด้วยตัวเอง ไม่จำเป็นต้องเปลี่ยน repo เป็น public

หากเลือก GitHub Pages ให้ตรวจสิทธิ์ Pages ของแผนบัญชีสำหรับ private repository ก่อน และใช้ base path `/AI-WasteVision/` กับ Vite อย่างถูกต้อง ไม่ควรเปิดเผย repository เพียงเพื่อให้ได้ลิงก์ demo

## ตรวจหลังเผยแพร่

เปิด URL จากมือถือคนละเครือข่าย รอโมเดลพร้อม ลองภาพจริงหนึ่งภาพ และส่งออก CSV ตรวจว่า `/model/metadata.json` เป็นรุ่นเดียวกับโมเดล เปิด HTTPS เท่านั้นเมื่อใช้กล้อง ตั้ง cache ของไฟล์ model/metadata ให้ revalidate เมื่อเปลี่ยนรุ่น หลีกเลี่ยง cache ยาวกับชื่อโมเดลคงที่

เมื่อ rollback ให้คืนทั้งไฟล์โมเดล metadata และโค้ดจาก commit เดียวกัน อย่าคืนเฉพาะ weights เพราะ label order หรือ preprocessing อาจต่างกัน
