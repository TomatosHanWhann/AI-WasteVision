import { NAMES } from "./domain.js";
import { OBJECT_NAMES } from "./detection-domain.js";
export async function cardRequest(path, body) {
  const response = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    headers: body
      ? { "content-type": "application/json", "x-wastevision-client": "web" }
      : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("ไม่สามารถติดต่อระบบบัตรสะสมได้ กรุณาลองใหม่");
  }
  if (!response.ok) {
    const error = new Error(data.error || "ไม่สามารถดำเนินรายการได้");
    error.status = response.status;
    throw error;
  }
  return data;
}
export function renderCard(card, escape) {
  return `<div class="loyalty-card"><div class="card-top"><span>WasteVision AI</span><span class="grade-mark">${card.grade === "A" ? "A" : "—"}</span></div><p>หมายเลข ${escape(card.phoneMasked)}</p><strong>${Number(card.total).toLocaleString("th-TH")} <small>ชิ้น</small></strong><div class="loyalty-progress" role="progressbar" aria-label="ความคืบหน้าสู่ระดับ A" aria-valuemin="0" aria-valuemax="1000" aria-valuenow="${Math.min(1000, Number(card.total))}"><span style="width:${Math.min(100, Number(card.progress))}%"></span></div><div class="card-bottom"><span>${Number(card.points).toLocaleString("th-TH")} แต้ม</span><span>${card.grade === "A" ? "ระดับ A · บรรลุเป้าหมาย" : `อีก ${Number(card.remaining).toLocaleString("th-TH")} ชิ้นสู่ระดับ A`}</span></div></div><div class="card-next"><a class="button primary full" href="#scan">จำแนกขยะเพื่อสะสมแต้ม</a></div><section class="card-history"><h2>รายการล่าสุด</h2>${card.recent?.length ? `<ul>${card.recent.map((r) => `<li><span>${OBJECT_NAMES[r.material] || NAMES[r.material] || "วัสดุ"}</span><time>${escape(new Date(r.created_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }))}</time><strong>+1</strong></li>`).join("")}</ul>` : "<p>ยังไม่มีรายการสะสม เริ่มจากวิเคราะห์ภาพและยืนยันการคัดแยกหนึ่งชิ้น</p>"}</section>`;
}
