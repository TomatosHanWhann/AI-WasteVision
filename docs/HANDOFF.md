# ส่งต่องาน

เริ่มที่README.md: มีลิงก์หลัก สถานะรุ่นทดลอง วิธีใช้ โครงสร้างระบบ API runtime/secret การเปิดเครื่องพัฒนา การฝึก การเผยแพร่ การให้สิทธิ์GitHub/Sites และผลQAที่ยังไม่ครบ ไม่ต้องอาศัยประวัติแชต

รอบล่าสุดเปลี่ยนUIเป็นmobile-first Italian luxury และเพิ่มcard-controllerป้องกันคำขอแข่งกัน โมเดลและthresholdเดิมไม่เปลี่ยน งานคงอยู่ในrepositoryและSitesโครงการเดิม ไม่มีการแบ่งงานให้บุคคลอื่น

ก่อนแก้ให้pull สร้างbranch รันnpm ci/test/build และเปิดPR การฝึกต้องแยกcandidate versionและcommitweights+metadata+reportร่วมกัน อ่านDETECTION_MODEL_CARD.mdและCONTINUOUS_IMPROVEMENT.mdก่อนอ้างความแม่นยำหรือใช้feedbackฝึก

Production secretอยู่ในSitesเท่านั้น GitHub collaboratorไม่ได้สิทธิ์ฐานข้อมูลหรือpublishโดยอัตโนมัติ ห้ามเปลี่ยนPHONE_HASH_SECRETโดยไม่มีแผนย้ายข้อมูล ไม่ลบหรือแก้migrationที่applyแล้ว ไม่เพิ่มseedแต้มในproduction

สถานะการตรวจUIรอบนี้อยู่USER_JOURNEY_QA.md มีข้อจำกัดComputer Useช่วงupload จึงยังไม่เรียกว่าQAทุกฟังก์ชันผ่านครบวงจร ต้องตรวจกล้อง/อัปโหลด/แต้ม/feedbackบนอุปกรณ์จริงต่อ


## อัปเดต CE564

อ่านส่วนอัปเดต 24 พฤศจิกายนใน README พร้อม docs/SLIDES_READY.md, COURSE_ALIGNMENT.md, EXPERIMENTS.md, KNOWLEDGE_ASSISTANT.md และ AI_USAGE_DISCLOSURE.md มีการค้น TF-IDF ใช้จริง แต่ LLM local/API เป็นเครื่องมือทดลองที่ยังต้องตั้งค่า ไม่มีการเปลี่ยน weights production
