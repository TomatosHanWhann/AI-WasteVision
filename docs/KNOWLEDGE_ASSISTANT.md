# ค้นคำแนะนำภาษาไทยและทางต่อยอด RAG

## ใช้งานจริง

เปิดเว็บ → วิธีใช้งาน → ค้นคำแนะนำการคัดแยก → พิมพ์ชนิดวัสดุหรือเลือกคำถามตัวอย่าง → อ่านบันทึกสรุปและเปิดแหล่งอ้างอิง ระบบค้นบนอุปกรณ์ ไม่ส่งคำถามไปเซิร์ฟเวอร์ ไม่ผูกเบอร์/บัตร ไม่เก็บประวัติคำถาม

Corpus `public/knowledge/waste-guide.json` มี 8 หัวข้อ เป็นบันทึกสรุปที่เขียนเพื่อโครงงานจากแหล่งข้อมูล ไม่ใช่บทความเต็มหรือการรับรองโดยหน่วยงาน ใช้ character n-gram 2/3/4, TF-IDF, cosine similarity ร่วมกับการตรวจหัวข้อและปฏิเสธบางเจตนาที่ไม่มีข้อมูล เช่น พิกัดใกล้ตัว ราคา หรือองค์ประกอบสารเคมี คะแนนค้นคืนไม่ใช่ความมั่นใจของโมเดลภาพ

แหล่งต้นทางที่ตรวจวันที่ 24 พฤศจิกายน 2026:

- [กรุงเทพมหานคร · How to ทิ้ง](https://greener.bangkok.go.th/waste-recycle/how-to-ting/)
- [กรมควบคุมมลพิษ · คู่มือแนวทางการลด คัดแยก และใช้ประโยชน์ขยะมูลฝอย](https://www.pcd.go.th/wp-content/uploads/2020/05/pcdnew-2020-05-24_03-44-03_908956.pdf)

แหล่งอ้างอิงบางแห่งอาจมีคำแนะนำที่ไม่เหมาะกับทุกสภาพวัตถุ เราไม่คัดลอกเนื้อหาทั้งหน้าเข้าระบบ โดยเฉพาะวิธีจัดการแบตเตอรี่ชำรุด ให้ใช้กฎและคำแนะนำติดต่อผู้รับจัดการเดิม ตรวจทบทวนเนื้อหา/ลิงก์เมื่อหน่วยงานเปลี่ยนข้อมูล ไม่มีการ crawl หรือดึงหน้าเว็บสดขณะผู้ใช้ถาม

## API สำหรับทดลองและบูรณาการ

`POST /api/advice` JSON `{"question":"กล่องนมต้องล้างไหม"}` พร้อม `x-wastevision-client:web` และ same origin ตาม API เดิม ไม่ต้องมีบัตร ผลประกอบด้วย answer, sources, abstained, method, corpusVersion และ notice ใช้ rate limit เดิม ไม่บันทึกข้อความคำถามใน D1 API นี้ยังไม่เรียก LLM

## ประเมินการค้นคืน

`npm run evaluate:retrieval` สร้าง `ml/results/retrieval-evaluation.json` จากคำถาม 24 ข้อ (ตอบได้ 18 / นอกขอบเขต 6) วัด Hit@1, Hit@3, การปฏิเสธนอกขอบเขต, false abstention และเวลา CPU

นี่คือ developer-authored regression set ที่เห็นระหว่างพัฒนาและแก้กฎ ไม่ใช่ independent holdout แม้ได้ 100% ก็ไม่ใช่ความถูกต้อง 100% ของคำตอบจริง ควรให้เพื่อน/ผู้ใช้สร้างคำถามใหม่ที่ผู้พัฒนาไม่เห็นและให้ผู้ตรวจประเมินความถูกต้อง/แหล่งอ้างอิงก่อนใช้เป็นหลักฐานทั่วไป

## Local LLM / API: เครื่องมือทดลองที่ยังไม่ได้รันจริง

เตรียม `scripts/compare-llm.mjs` ให้ใช้ corpus และคำถามชุดเดียวกัน ส่งเฉพาะคำถามสังเคราะห์กับบันทึกสรุป ไม่มีภาพหรือเบอร์ผู้ใช้ ข้ออันตราย/นอกขอบเขตใช้ curated fallback ไม่ให้ LLM แต่งวิธีจัดการ

1. **Local:** ติดตั้ง Ollama และโมเดลที่มีสิทธิ์ใช้ให้เหมาะกับ RAM/VRAM ตั้ง `OLLAMA_MODEL` เป็นชื่อที่มีจริงในเครื่อง จากนั้นรัน `node scripts/compare-llm.mjs ollama tmp/ollama-run.json` เชื่อมเฉพาะ `127.0.0.1:11434/api/chat`
2. **API:** ตั้ง `OPENROUTER_MODEL` และ `OPENROUTER_API_KEY` ใน environment ฝั่งผู้พัฒนา แล้วรัน `node scripts/compare-llm.mjs openrouter tmp/openrouter-run.json` ตรวจราคา/สิทธิ์/ข้อกำหนด provider ก่อนรัน คำสั่งนี้อาจมีค่าใช้จ่าย ไม่ใส่ key ใน source หรือ frontend
3. กำหนด quantization และบันทึกชื่อ artifact จริงของ local model, CPU/GPU/RAM, cold/warm runs, token usage, latency median/p95 อย่าอ้างการเปรียบเทียบ quantization หากยังไม่ได้รันแต่ละรุ่น
4. ผล raw อยู่ `tmp/` ที่ไม่เข้า Git ตรวจข้อความทุกข้อ กรอกช่อง supported_by_sources/correct_citations/appropriate_thai/reviewer แล้วสรุปจำนวนคำตอบที่ผ่าน ไม่ถือว่ามี `[citation]` แล้วแปลว่าคำตอบถูก
5. ยังไม่มี LLM ติดตั้งหรือ API key ที่นำมาทดสอบในรอบนี้ จึงไม่มีคะแนนคุณภาพ local/API ไม่มีรายงานค่าใช้จ่ายจริง และไม่มีการเปิด LLM ให้ผู้ชมเว็บใช้

เอกสาร API: [Ollama chat](https://docs.ollama.com/api/chat), [OpenRouter chat completions](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion)

ก่อนต่อ LLM กับเว็บจริงต้องทดสอบ factual grounding, refusal, prompt injection และแหล่งอ้างอิงที่ผิด รวมถึงกำหนด quota/budget, consent สำหรับการส่งข้อความไป provider และ timeout/fallback ใน Worker โดยไม่ให้คำตอบที่สร้างใหม่แทนกฎความปลอดภัยเดิม
