import {
  OBJECT_NAMES,
  SPECIAL,
  disposal,
  roundConfidence,
} from "./detection-domain.js";
import { cardRequest } from "./loyalty.js";
const $ = (id) => document.getElementById(id);
const percent = (n) => (n * 100).toFixed(1) + " / 100";
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const options = (extra = false) =>
  Object.entries({
    ...OBJECT_NAMES,
    ...(extra ? { not_waste: "ไม่ใช่ขยะ / ตรวจจับเกิน" } : {}),
  })
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");
export function clearBoxes() {
  if ($("object-overlay")) $("object-overlay").innerHTML = "";
}
function receipts() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("wv-feedback-receipts") || "[]",
    );
    return Array.isArray(saved)
      ? saved.filter(
          (x) =>
            typeof x?.id === "string" && typeof x?.deleteToken === "string",
        )
      : [];
  } catch {
    return [];
  }
}
export function initReceipt() {
  const button = $("delete-feedback");
  const all = receipts();
  const latest = all.at(-1);
  button.hidden = !latest;
  button.textContent =
    "ลบข้อมูลประเมินล่าสุดที่ส่งจากอุปกรณ์นี้" +
    (all.length > 1 ? " (" + all.length + " รายการที่เก็บรหัสไว้)" : "");
  button.onclick = async () => {
    button.disabled = true;
    try {
      await cardRequest("feedback/delete", latest);
      const current = receipts().filter((x) => x.id !== latest.id);
      localStorage.setItem("wv-feedback-receipts", JSON.stringify(current));
      initReceipt();
      $("feedback-receipt").textContent = "ลบข้อมูลประเมินและภาพที่แนบแล้ว";
    } catch (e) {
      $("feedback-receipt").textContent = e.message;
    } finally {
      button.disabled = false;
    }
  };
}

async function objectDigest(digest, box) {
  const bytes = new TextEncoder().encode(
    digest + ":" + box.map((x) => Math.round(x * 320)).join(","),
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
async function jpeg(source) {
  const canvas = document.createElement("canvas"),
    ratio = Math.min(1, 1024 / Math.max(source.width, source.height));
  canvas.width = Math.round(source.width * ratio);
  canvas.height = Math.round(source.height * ratio);
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  let data = canvas.toDataURL("image/jpeg", 0.7);
  if (data.length > 690000) data = canvas.toDataURL("image/jpeg", 0.45);
  if (data.length > 690000)
    throw new Error("ภาพยังมีขนาดใหญ่เกินไป กรุณาส่งเฉพาะข้อมูลประเมิน");
  return data;
}
export function renderMulti({ result: r, source, getCard, setCard, setBusy }) {
  const conditions = {},
    awarded = new Set();
  const items = r.objects;
  let processing = false,
    sent = false;
  function lock(value) {
    processing = value;
    setBusy(value);
    document
      .querySelectorAll(
        "#result-content input,#result-content select,#result-content button",
      )
      .forEach((el) => (el.disabled = value));
    if (!value) {
      update();
      $("send-feedback").disabled = sent || r.source === "example";
    }
  }
  $("result-state").textContent = `${r.latency.toLocaleString("th-TH")} ms`;
  $("result-content").innerHTML =
    `<div class="round-summary"><span>จำนวนที่ตรวจพบ</span><strong>${items.length}<small> ชิ้น</small></strong><p>${items.length ? `ความมั่นใจเฉลี่ยของรายการ ${percent(roundConfidence(items))}` : "ยังไม่สามารถระบุตำแหน่งขยะได้"}</p></div><p class="caption">คะแนนผ่านการปรับเทียบกับชุด validation ไม่ใช่ความแม่นยำของภาพนี้ และไม่รวมสิ่งที่ตรวจไม่พบ ${r.truncated ? "แสดงสูงสุด 10 ชิ้น กรุณาแบ่งกลุ่มแล้วถ่ายใหม่" : ""}</p><label class="field-label" for="bin-profile">รูปแบบถังของสถานที่</label><select id="bin-profile"><option value="five">5 ประเภท · สีส้มอันตราย / สีแดงติดเชื้อ</option><option value="four">4 ประเภท · สีแดงอันตราย</option></select><p class="caption">ตรวจป้ายบนถังและชนิดที่จุดรับยอมรับเสมอ</p><div class="detected-items">${items.map((x) => `<article class="detected-item" id="detected-${x.id}" tabindex="-1"><div class="detected-title"><span class="object-number">${x.id}</span><h3>คาดว่าเป็น${OBJECT_NAMES[x.label]}</h3><strong>${percent(x.confidence)}</strong></div><p class="caption">${x.confidence < 0.5 ? "ความมั่นใจต่ำ · ตรวจสอบประเภทก่อนทิ้ง · " : ""}คะแนนโมเดลดิบ ${(x.rawConfidence * 100).toFixed(1)}%</p><label for="object-condition-${x.id}">สภาพและข้อควรระวัง</label><select id="object-condition-${x.id}"><option value="">เลือกสภาพก่อนยืนยัน</option><option value="clean">สะอาด / สภาพปกติ</option><option value="dirty">เปื้อนอาหารหรือของเหลว</option><option value="hazardous">สารเคมี / อันตราย</option><option value="damaged">แบตเตอรี่บวม รั่ว หรือร้อนผิดปกติ</option><option value="infectious">ทราบว่าปนเปื้อนเชื้อหรือสารคัดหลั่ง</option></select><div id="object-disposal-${x.id}" class="disposal-result"></div><button class="button secondary full" id="object-award-${x.id}" disabled>ยืนยันการคัดแยกชิ้นที่ ${x.id}</button><p id="object-message-${x.id}" role="status"></p></article>`).join("")}</div><p class="safety-note">ภาพถ่ายไม่ยืนยันความปลอดภัย สารเคมี หรือการติดเชื้อได้ครบถ้วน หากพบอุปกรณ์ไฟฟ้า แบตเตอรี่ หรือวัตถุมีคม ให้ตรวจสอบแยกก่อนจัดการ แม้ระบบไม่ตรวจพบ</p><details class="feedback-panel"><summary>ร่วมประเมินผลการวิเคราะห์</summary><p>ตรวจคำตอบและจำนวนจริงเพื่อบันทึกสถิติ การส่งข้อมูลส่วนนี้ไม่เพิ่มแต้ม</p><form id="analysis-feedback"><div class="truth-items">${items.map((x) => `<label for="truth-${x.id}">คำตอบจริงของชิ้นที่ ${x.id}<select id="truth-${x.id}" required><option value="">ตรวจสอบแล้วเลือกคำตอบ</option>${options(true)}</select></label>`).join("")}</div><button type="button" class="text-button" id="confirm-all-truth" ${!items.length ? "hidden" : ""}>ยืนยันว่าประเภทที่ตรวจพบทั้งหมดถูกต้อง</button><label for="expected-count">จำนวนขยะจริงที่มองเห็นในภาพ รวมชิ้นที่ระบบตรวจไม่พบ</label><input id="expected-count" type="number" min="0" max="30" step="1" value="${items.length}" required/><label class="consent"><input id="count-confirm" type="checkbox" required/>ตรวจนับจำนวนจริงและตรวจคำตอบทุกรายการแล้ว</label><label class="consent"><input id="feedback-consent" type="checkbox" required/>ยินยอมส่งคำตอบ จำนวน และคะแนนแบบไม่ผูกกับบัตรสะสม เพื่อประเมินและพัฒนาระบบ</label><label class="consent"><input id="image-consent" type="checkbox"/>ยินยอมแนบภาพที่ลดขนาดเพื่อให้ผู้ดูแลตรวจทานและใช้พัฒนาโมเดล</label><p class="caption">ไม่ต้องแนบภาพก็ส่งสถิติได้ หากแนบภาพ โปรดใช้ภาพที่ท่านมีสิทธิ์และไม่มีบุคคลหรือข้อมูลส่วนตัว ข้อมูลจะรอตรวจทาน ไม่ถูกนำไปฝึกอัตโนมัติ และสามารถลบรายการล่าสุดจากอุปกรณ์นี้ได้</p><button id="send-feedback" class="button primary full" ${r.source === "example" ? "disabled" : ""}>ส่งผลประเมินโดยสมัครใจ</button><p id="feedback-status" role="status">${r.source === "example" ? "ภาพตัวอย่างไม่ใช้สะสมสถิติจากผู้ใช้" : ""}</p></form></details>`;
  const overlay = $("object-overlay");
  const boxHeight = (1000 * source.height) / source.width;
  overlay.setAttribute("viewBox", `0 0 1000 ${boxHeight}`);
  overlay.innerHTML = items
    .map((x) => {
      const b = x.box.map((n, i) => n * (i % 2 ? boxHeight : 1000));
      return `<g data-object="${x.id}" role="button" tabindex="0" aria-label="ดูผลชิ้นที่ ${x.id}"><rect x="${b[0]}" y="${b[1]}" width="${b[2] - b[0]}" height="${b[3] - b[1]}"/><text x="${b[0] + 8}" y="${Math.min(boxHeight - 10, b[1] + 30)}">${x.id}</text></g>`;
    })
    .join("");
  const focusObject = (el) =>
    $("detected-" + el.dataset.object)?.focus({ preventScroll: false });
  overlay.querySelectorAll("[data-object]").forEach((el) => {
    el.onclick = () => focusObject(el);
    el.onkeydown = (e) => {
      if (["Enter", " "].includes(e.key)) {
        e.preventDefault();
        focusObject(el);
      }
    };
  });
  function update() {
    for (const x of items) {
      const rule = disposal(
        x.confidence < 0.5 &&
          !SPECIAL.has(x.label) &&
          !["hazardous", "infectious", "damaged"].includes(conditions[x.id])
          ? "unknown"
          : x.label,
        conditions[x.id],
        $("bin-profile").value,
      );
      $("object-disposal-" + x.id).innerHTML =
        `<strong class="bin-label bin-${rule.color}">${escape(rule.name)}</strong><p>${escape(rule.action)}</p>`;
      $("object-award-" + x.id).disabled =
        processing ||
        awarded.has(x.id) ||
        x.confidence < 0.5 ||
        !rule.eligible ||
        r.source === "example" ||
        x.label === "unknown";
    }
  }
  for (const x of items) {
    $("object-condition-" + x.id).onchange = (e) => {
      conditions[x.id] = e.target.value;
      update();
    };
    $("object-award-" + x.id).onclick = async () => {
      if (processing) return;
      if (!getCard()) {
        location.hash = "card";
        return;
      }
      const button = $("object-award-" + x.id);
      button.disabled = true;
      lock(true);
      try {
        const t = await cardRequest("scan-ticket", {
          mode: "multiple",
          source: r.source,
          label: x.label,
          confidence: x.rawConfidence,
          modelVersion: r.version,
          imageDigest: await objectDigest(r.imageDigest, x.box),
        });
        const card = await cardRequest("points", {
          ticket: t.ticket,
          condition: conditions[x.id],
          confirm: true,
        });
        awarded.add(x.id);
        setCard(card);
        $("object-message-" + x.id).textContent = "บันทึกแล้ว +1 แต้ม";
      } catch (e) {
        $("object-message-" + x.id).textContent = e.message;
      } finally {
        lock(false);
        update();
      }
    };
  }
  $("bin-profile").onchange = update;
  update();
  $("confirm-all-truth").onclick = () =>
    items.forEach((x) => ($("truth-" + x.id).value = x.label));
  $("analysis-feedback").onsubmit = async (e) => {
    e.preventDefault();
    if (r.source === "example" || processing || sent) return;
    const button = $("send-feedback");
    button.disabled = true;
    lock(true);
    try {
      const data = {
        consent: $("feedback-consent").checked,
        imageConsent: $("image-consent").checked,
        source: r.source,
        modelVersion: r.version,
        imageDigest: r.imageDigest,
        expectedCount: Number($("expected-count").value),
        items: items.map((x) => ({
          id: x.id,
          label: x.label,
          truth: $("truth-" + x.id).value,
          box: x.box,
          confidence: x.confidence,
        })),
      };
      if (data.imageConsent) data.image = await jpeg(source);
      const saved = await cardRequest("feedback", data);
      let stored = true;
      try {
        const all = receipts();
        all.push({ id: saved.id, deleteToken: saved.deleteToken });
        localStorage.setItem("wv-feedback-receipts", JSON.stringify(all));
      } catch {
        stored = false;
      }
      sent = true;
      initReceipt();
      $("feedback-status").textContent =
        "บันทึกแล้ว · ข้อมูลอยู่ระหว่างรอตรวจทาน" +
        (stored
          ? ""
          : " · เบราว์เซอร์เก็บรหัสลบไม่ได้ โปรดเก็บรหัสนี้ไว้: " +
            JSON.stringify({ id: saved.id, deleteToken: saved.deleteToken }));
      button.textContent = "ส่งข้อมูลแล้ว";
    } catch (error) {
      $("feedback-status").textContent = error.message;
      button.disabled = false;
    } finally {
      lock(false);
    }
  };
}
