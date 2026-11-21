import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/500.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "./style.css";
import {
  createIcons,
  Camera,
  Upload,
  ScanLine,
  Leaf,
  FlaskConical,
  BarChart3,
  Users,
  ShieldCheck,
  Download,
  X,
  RotateCcw,
  Check,
  ArrowUpRight,
  Recycle,
  ImagePlus,
  CircleHelp,
  Trash2,
  Share2,
} from "lucide";
import QRCode from "qrcode";
import {
  LABELS,
  NAMES,
  COLORS,
  guidance,
  metrics,
  toCSV,
  readRecords,
} from "./domain.js";
import { loadModel, predict } from "./inference.js";

const $ = (id) => document.getElementById(id);
const base = import.meta.env.BASE_URL;
const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const icons = () =>
  createIcons({
    icons: {
      Camera,
      Upload,
      ScanLine,
      Leaf,
      FlaskConical,
      BarChart3,
      Users,
      ShieldCheck,
      Download,
      X,
      RotateCcw,
      Check,
      ArrowUpRight,
      Recycle,
      ImagePlus,
      CircleHelp,
      Trash2,
      Share2,
    },
  });
const options = (empty = "เลือกคำตอบจริง") =>
  `<option value="">${empty}</option>` +
  [...LABELS, "unknown"]
    .map((l) => `<option value="${l}">${NAMES[l]}</option>`)
    .join("");
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const percent = (x) => `${(x * 100).toFixed(1)}%`;
let records = [];
try {
  records = readRecords(localStorage);
} catch {
  /* Storage can be denied by browser policy. */
}
let meta,
  ready = false,
  busy = false,
  stream = null,
  current = null,
  sourceType = "",
  result = null,
  objectURL = null;
let cameraEpoch = 0;
let cameraPending = false;
document.querySelector("#app").innerHTML = `
  <a class="skip-link" href="#content">ข้ามไปเนื้อหา</a>
  <header class="topbar"><a class="brand" href="#scan" aria-label="AI WasteVision หน้าสแกน"><span class="brand-mark">${icon("recycle")}</span><span>WasteVision<span class="brand-ai">AI</span></span></a><span class="project-label">พื้นที่ทดลองแยกขยะด้วยภาพ</span><button id="share" class="share-button">${icon("share-2")}<span>แชร์ให้เพื่อน</span></button></header>
  <div class="workspace">
    <nav class="navigation" aria-label="เมนูหลัก"><a href="#scan" data-tab="scan">${icon("scan-line")}<span>สแกนสิ่งของ</span></a><a href="#tests" data-tab="tests">${icon("flask-conical")}<span>ผลทดสอบของฉัน</span><span id="log-count" class="nav-count">0</span></a><a href="#model" data-tab="model">${icon("bar-chart-3")}<span>รู้จักโมเดล</span></a><a href="#team" data-tab="team">${icon("users")}<span>สำหรับทีมพัฒนา</span></a><div class="nav-foot">ภาพของคุณอยู่บนอุปกรณ์นี้<br>ไม่ต้องสมัครสมาชิก</div></nav>
    <main id="content">
      <section id="page-scan" class="page">
        <div class="page-heading"><div><h1>ชิ้นนี้ แยกอย่างไรดี?</h1><p>ถ่ายให้ชัดทีละชิ้น แล้วให้ AI ช่วยดูประเภทวัสดุ</p></div><span class="version-badge">เวอร์ชันทดลอง</span></div>
        <div class="scan-layout">
          <section class="scanner" aria-labelledby="scanner-title"><div class="panel-heading"><h2 id="scanner-title">ภาพสิ่งของ</h2><span class="subtle">กล้อง / อัปโหลด</span></div>
            <div class="viewfinder" id="viewfinder"><div id="empty-view" class="empty-view"><div class="focus-mark">${icon("scan-line")}</div><h3>วางสิ่งของไว้กลางภาพ</h3><p>ใช้พื้นหลังเรียบ แสงพอดี<br>ให้เห็นสิ่งของครบทั้งชิ้น</p></div><img id="preview-image" alt="ภาพที่เลือกสำหรับจำแนก โดยระบบใช้พื้นที่สี่เหลี่ยมจัตุรัสตรงกลาง" hidden /><video id="camera-video" autoplay playsinline muted hidden></video><span class="crop-hint" id="crop-hint" hidden>พื้นที่กลางภาพที่ AI ใช้วิเคราะห์</span><button id="clear-image" class="icon-button clear-image" aria-label="ล้างภาพและปิดกล้อง" hidden>${icon("x")}</button></div>
            <div class="capture-actions"><button id="open-camera" class="button primary">${icon("camera")}เปิดกล้อง</button><button id="choose-file" class="button secondary">${icon("upload")}เลือกภาพ</button><input id="file-input" type="file" accept="image/jpeg,image/png,image/webp" hidden /></div>
            <button id="capture" class="button primary full" hidden>${icon("camera")}ถ่ายภาพนี้</button>
            <div class="challenge-line"><label><input id="challenge" type="checkbox" /> ลองตอบเองก่อนดู AI</label><select id="unaided" aria-label="คำตอบของคุณก่อนดู AI" hidden>${options("คุณคิดว่าเป็นวัสดุอะไร?")}</select></div>
            <button id="analyze" class="button analyze full" disabled>${icon("scan-line")}วิเคราะห์ภาพ</button>
            <p id="model-status" class="model-status" role="status" aria-live="polite">กำลังโหลดโมเดลครั้งแรก…</p><button id="retry-model" class="text-button" hidden>ลองโหลดโมเดลอีกครั้ง</button>
            <p id="scan-error" class="error-message" role="alert" hidden></p>
            <div class="privacy-note">${icon("shield-check")}<span>วิเคราะห์บนอุปกรณ์ของคุณ ภาพไม่ถูกส่งไปเก็บบนเซิร์ฟเวอร์</span></div>
          </section>
          <aside class="result-column"><section class="result-panel" aria-labelledby="result-title"><div class="panel-heading"><h2 id="result-title">ผลการจำแนก</h2><span id="result-state" class="subtle">รอภาพของคุณ</span></div><div id="result-content" aria-live="polite"><div class="result-empty"><div class="material-stack"><span>พลาสติก</span><span>กระดาษ</span><span>โลหะ</span></div><h3>รู้วัสดุ ก่อนเลือกถัง</h3><p>AI แยกได้ 5 ประเภท พร้อมแสดง<br>ความมั่นใจและคำแนะนำตามสภาพสิ่งของ</p></div></div></section>
            <section class="scope-note"><h3>${icon("circle-help")}ก่อนเริ่มทดลอง</h3><p>รองรับวัตถุหลักหนึ่งชิ้นต่อภาพ ยังไม่รองรับแก้ว ผ้า แบตเตอรี่ ขยะอันตราย หรือการนับหลายชิ้น</p><p>ผล AI อาจผิดได้ และไม่ได้ยืนยันว่าจุดรับในพื้นที่ของคุณรับวัสดุนั้นเสมอ</p></section>
          </aside>
        </div>
        <section class="sample-section"><div><h2>ยังไม่มีภาพ? ลองจากชุดทดสอบ</h2><p>ภาพจริงจาก RealWaste ที่กันไว้ทดสอบ ไม่ใช่หลักฐานทดสอบหน้างาน</p></div><div class="samples">${LABELS.map((l) => `<button class="sample" data-sample="${l}"><img src="${base}samples/${l}.jpg" alt="ตัวอย่าง${NAMES[l]}จาก RealWaste" loading="lazy" /><span>${NAMES[l]}</span></button>`).join("")}</div><p class="source-credit">ภาพ: Single, Iranmanesh & Raad · RealWaste (2023) · CC BY 4.0</p></section>
      </section>
      <section id="page-tests" class="page" hidden><div class="page-heading"><div><h1>ผลทดสอบของฉัน</h1><p>ยืนยันคำตอบจริงทีละภาพ เพื่อดูว่าระบบช่วยได้แค่ไหน</p></div><button id="export" class="button secondary">${icon("download")}ส่งออก CSV</button></div><div class="notice">ข้อมูลเก็บเฉพาะเบราว์เซอร์นี้ ไม่รวมผลของเพื่อน และไม่มีการเก็บภาพ การล้างข้อมูลเว็บจะลบประวัติด้วย</div><div id="test-summary"></div><div class="table-scroll"><table id="records-table"><caption>ผลที่คุณยืนยันแล้ว</caption><thead><tr><th>เวลาทดสอบ</th><th>AI ตอบ</th><th>ความมั่นใจ</th><th>คำตอบจริง</th><th>เวลา</th><th>แหล่งภาพ</th></tr></thead><tbody id="records-body"></tbody></table></div><div id="local-matrix"></div><p class="caption">Macro F1 คิดจาก 5 ประเภท โดยนับการปฏิเสธภาพที่มีคำตอบจริงใน 5 ประเภทเป็นคำตอบผิด จำนวนตัวอย่างน้อยหรือคลาสไม่ครบยังสรุปประสิทธิภาพไม่ได้</p><div class="delete-row"><button id="delete-records" class="text-button danger">${icon("trash-2")}ล้างผลทดสอบในเครื่อง</button><span id="delete-confirm" hidden>ต้องการล้างทั้งหมด? <button id="confirm-delete" class="text-button danger">ยืนยันล้างข้อมูล</button><button id="cancel-delete" class="text-button">ยกเลิก</button></span></div></section>
      <section id="page-model" class="page" hidden><div class="page-heading"><div><h1>รู้จักโมเดลที่กำลังใช้</h1><p>ดูที่มาของผล ขอบเขต และสิ่งที่ยังต้องทดสอบ</p></div></div><div id="model-details"><p>กำลังโหลดข้อมูลโมเดล…</p></div></section>
      <section id="page-team" class="page prose" hidden><div class="page-heading"><div><h1>พัฒนาต่อด้วยกัน</h1><p>โค้ด โมเดล และหลักฐานการทดลอง อยู่ใน GitHub เดียวกัน</p></div></div><a class="button primary external" href="https://github.com/TomatosHanWhann/AI-WasteVision" target="_blank" rel="noopener">เปิด GitHub ของทีม ${icon("arrow-up-right")}</a><h2>แบ่งงานให้เดินต่อได้ง่าย</h2><dl class="team-list"><div><dt>AI / ข้อมูล</dt><dd>เก็บภาพวัตถุในพื้นที่ แบ่งข้อมูลตามวัตถุจริง ฝึกโมเดลและส่งออกผลประเมินใน <code>ml/</code></dd></div><div><dt>เว็บ / การใช้งาน</dt><dd>แก้หน้าจอ กล้อง และการทำนายใน <code>src/</code> โมเดลที่เว็บเรียกใช้อยู่ใน <code>public/model/</code></dd></div><div><dt>QA / รายงาน</dt><dd>ทดสอบวัตถุใหม่ แสง และอุปกรณ์ ส่งออก CSV ใช้คู่มือและแบบบันทึกใน <code>docs/</code></dd></div></dl><h2>ก่อนรวมงาน</h2><p>สร้าง branch ของตัวเอง แก้เฉพาะส่วนที่รับผิดชอบ รันการทดสอบ แล้วเปิด Pull Request ให้เพื่อนตรวจ อ่าน README และ CONTRIBUTING ใน repository เพื่อเริ่มต้น</p><h2>สิ่งที่ต้องเก็บต่อก่อนสรุปโครงงาน</h2><p>ภาพบริบทไทย ชุดทดสอบวัตถุใหม่ที่ไม่เคยฝึก 40 ชิ้นและนอกขอบเขต 10 ชิ้น ผลกล้องบน Chrome / Safari และการทดลองกับผู้ใช้ตามแผน ตัวเลขจากชุดภาพไม่สามารถใช้แทนการทดสอบเหล่านี้ได้</p></section>
      <footer>AI WasteVision <span>ทดลอง เรียนรู้ แล้วแยกให้เหมาะกับพื้นที่</span><a href="#model">ขอบเขตของ AI</a></footer>
    </main>
  </div>
  <dialog id="share-dialog" aria-labelledby="share-title"><div class="panel-heading"><h2 id="share-title">ชวนเพื่อนมาทดลอง</h2><button id="close-share" class="icon-button" aria-label="ปิด">${icon("x")}</button></div><canvas id="qr" aria-label="QR Code เปิดเว็บนี้"></canvas><p>สแกนเพื่อเปิดบนมือถือ</p><input id="share-url" readonly aria-label="ลิงก์เว็บไซต์" /><button id="copy-url" class="button primary full">คัดลอกลิงก์</button><p id="copy-status" role="status"></p></dialog>
  <div id="toast" class="toast" role="status" hidden></div>`;
icons();
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("toast").hidden = true), 4000);
}
function error(message) {
  $("scan-error").textContent = message;
  $("scan-error").hidden = !message;
}
function sync() {
  $("analyze").disabled =
    !ready ||
    busy ||
    cameraPending ||
    !current ||
    !!stream ||
    ($("challenge").checked && !$("unaided").value);
  $("open-camera").disabled = busy || cameraPending;
  $("choose-file").disabled = busy;
  document
    .querySelectorAll("[data-sample]")
    .forEach((b) => (b.disabled = busy));
  $("clear-image").disabled = busy;
}
function stopCamera() {
  cameraEpoch++;
  cameraPending = false;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  $("camera-video").srcObject = null;
  $("camera-video").hidden = true;
  $("capture").hidden = true;
}
function clearResult() {
  result = null;
  $("result-state").textContent = "รอวิเคราะห์ภาพ";
  $("result-content").innerHTML =
    '<div class="result-empty"><h3>ภาพพร้อมแล้ว</h3><p>กด “วิเคราะห์ภาพ” เพื่อดูผลของ AI</p></div>';
}
function releaseURL() {
  if (objectURL) {
    URL.revokeObjectURL(objectURL);
    objectURL = null;
  }
}
async function showImage(url, source) {
  stopCamera();
  error("");
  const im = new Image();
  im.decoding = "async";
  im.src = url;
  try {
    await im.decode();
    if (im.width * im.height > 40000000)
      throw new Error(
        "ภาพมีความละเอียดสูงเกินไป กรุณาย่อภาพให้ไม่เกิน 40 ล้านพิกเซล",
      );
  } catch (e) {
    throw new Error(
      e.message.startsWith("ภาพมี")
        ? e.message
        : "อ่านภาพไม่ได้ กรุณาใช้ไฟล์ JPG, PNG หรือ WebP ที่เปิดดูได้",
    );
  }
  current = im;
  sourceType = source;
  $("preview-image").src = url;
  $("preview-image").hidden = false;
  $("empty-view").hidden = true;
  $("crop-hint").hidden = false;
  $("clear-image").hidden = false;
  $("unaided").value = "";
  clearResult();
  sync();
}
$("choose-file").onclick = () => $("file-input").click();
$("file-input").onchange = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    error("ใช้ไฟล์ JPG, PNG หรือ WebP กรุณาแปลงไฟล์ HEIC ก่อนอัปโหลด");
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    error("ไฟล์ใหญ่เกิน 15 MB กรุณาย่อภาพแล้วเลือกใหม่");
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    await showImage(url, "upload");
    releaseURL();
    objectURL = url;
  } catch (e) {
    URL.revokeObjectURL(url);
    error(e.message);
  }
};
document.querySelectorAll("[data-sample]").forEach(
  (b) =>
    (b.onclick = async () => {
      try {
        await showImage(
          base + "samples/" + b.dataset.sample + ".jpg",
          "dataset-example",
        );
        releaseURL();
        $("viewfinder").scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "center",
        });
      } catch (e) {
        error(e.message);
      }
    }),
);
$("open-camera").onclick = async () => {
  error("");
  if (!navigator.mediaDevices?.getUserMedia) {
    error("เบราว์เซอร์นี้เปิดกล้องไม่ได้ กรุณาใช้ HTTPS หรือเลือกอัปโหลดภาพ");
    return;
  }
  $("open-camera").disabled = true;
  stopCamera();
  const requestEpoch = cameraEpoch;
  cameraPending = true;
  sync();
  try {
    const incoming = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 1280 },
      },
      audio: false,
    });
    if (requestEpoch !== cameraEpoch || document.hidden) {
      incoming.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = incoming;
    const video = $("camera-video");
    video.srcObject = stream;
    video.hidden = false;
    await video.play();
    if (requestEpoch !== cameraEpoch) return;
    $("preview-image").hidden = true;
    $("empty-view").hidden = true;
    $("crop-hint").hidden = false;
    $("clear-image").hidden = false;
    $("capture").hidden = false;
    current = null;
    clearResult();
  } catch (e) {
    if (requestEpoch !== cameraEpoch) return;
    stopCamera();
    error(
      e.name === "NotAllowedError"
        ? "ยังไม่ได้รับอนุญาตกล้อง เปิดสิทธิ์กล้องในเบราว์เซอร์ หรือเลือกอัปโหลดภาพ"
        : "เปิดกล้องไม่สำเร็จ ตรวจว่ากล้องไม่ได้ถูกใช้งาน แล้วลองใหม่หรืออัปโหลดภาพ",
    );
  } finally {
    if (requestEpoch === cameraEpoch) cameraPending = false;
    sync();
  }
};
$("capture").onclick = async () => {
  try {
    const video = $("camera-video");
    if (!video.videoWidth) throw new Error("กล้องยังไม่พร้อม ลองอีกครั้ง");
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d").drawImage(video, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.93));
    if (!blob) throw new Error("บันทึกภาพไม่สำเร็จ ลองถ่ายใหม่");
    const url = URL.createObjectURL(blob);
    await showImage(url, "camera");
    releaseURL();
    objectURL = url;
  } catch (e) {
    error(e.message);
  }
};
$("clear-image").onclick = () => {
  stopCamera();
  releaseURL();
  current = null;
  sourceType = "";
  result = null;
  $("preview-image").removeAttribute("src");
  $("preview-image").hidden = true;
  $("empty-view").hidden = false;
  $("crop-hint").hidden = true;
  $("clear-image").hidden = true;
  $("unaided").value = "";
  clearResult();
  $("result-state").textContent = "รอภาพของคุณ";
  error("");
  sync();
};
$("challenge").onchange = () => {
  $("unaided").hidden = !$("challenge").checked;
  sync();
};
$("unaided").onchange = sync;
$("analyze").onclick = async () => {
  if (busy || !current) return;
  busy = true;
  sync();
  error("");
  $("result-state").textContent = "กำลังวิเคราะห์…";
  $("analyze").textContent = "กำลังวิเคราะห์…";
  try {
    result = await predict(current);
    result.source = sourceType;
    result.unaided = $("challenge").checked ? $("unaided").value : "";
    renderResult();
    if (matchMedia("(max-width:680px)").matches)
      $("result-title").scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
  } catch (e) {
    error("วิเคราะห์ไม่สำเร็จ ลองเลือกภาพใหม่หรือโหลดหน้าอีกครั้ง");
    $("result-state").textContent = "วิเคราะห์ไม่สำเร็จ";
    console.error(e);
  } finally {
    busy = false;
    $("analyze").innerHTML = icon("scan-line") + "วิเคราะห์ภาพ";
    icons();
    sync();
  }
};
function renderResult() {
  const r = result,
    unknown = r.label === "unknown";
  $("result-state").textContent = `${r.latency.toLocaleString()} ms`;
  $("result-content").innerHTML =
    `<div class="prediction ${unknown ? "uncertain" : ""}"><span class="prediction-label">${unknown ? "AI ยังไม่แน่ใจ" : "AI คาดว่าเป็น"}</span><h3>${unknown ? "ควรตรวจสอบด้วยตัวเอง" : NAMES[r.label]}</h3><p>${unknown ? `คะแนนสูงสุด: ${NAMES[r.top]} ${percent(r.confidence)} ต่ำกว่าเกณฑ์ ${percent(r.threshold)}` : `คะแนนความมั่นใจ ${percent(r.confidence)}`}</p></div><div class="probabilities" aria-label="คะแนนทุกประเภท">${r.ranked.map((x) => `<div class="probability"><span>${NAMES[x.label]}</span><div class="bar"><span style="width:${x.p * 100}%;background:${COLORS[x.label]}"></span></div><span>${percent(x.p)}</span></div>`).join("")}</div><p class="caption confidence-note">คะแนนความมั่นใจของโมเดล ไม่ใช่ความแม่นยำที่รับประกัน ภาพนอกขอบเขตอาจได้คะแนนสูงได้</p><div class="sorting"><h4>สภาพสิ่งของเป็นอย่างไร?</h4><select id="condition" aria-label="สภาพสิ่งของ"><option value="">เลือกสภาพก่อนดูคำแนะนำ</option><option value="clean">สะอาดและแห้ง / เศษอาหารทั่วไป</option><option value="dirty">เปียกหรือเปื้อนอาหาร</option><option value="hazardous">อันตราย / สารเคมี / ภาชนะมีแรงดัน</option></select><p id="guidance">${guidance(r.label, "")}</p></div><details class="confirm-test" open><summary>ช่วยบันทึกผลทดสอบนี้</summary><p>เลือกคำตอบจริงจากการตรวจสิ่งของ ไม่จำเป็นต้องตรงกับ AI</p><label for="truth">คำตอบจริง</label><select id="truth">${options()}</select><label for="test-device">อุปกรณ์ที่ใช้</label><select id="test-device"><option value="phone">มือถือ</option><option value="tablet">แท็บเล็ต</option><option value="desktop">คอมพิวเตอร์</option></select>${r.unaided ? `<p class="caption">ก่อนดู AI คุณตอบ: ${NAMES[r.unaided]}</p>` : ""}<button id="save-record" class="button secondary full" disabled>${icon("check")}ยืนยันและบันทึกผล</button><p id="save-status" role="status"></p></details>`;
  $("test-device").value = matchMedia("(max-width:700px)").matches
    ? "phone"
    : "desktop";
  $("condition").onchange = () =>
    ($("guidance").textContent = guidance(r.label, $("condition").value));
  $("truth").onchange = () => ($("save-record").disabled = !$("truth").value);
  $("save-record").onclick = () => {
    const row = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      model_version: r.version,
      source: r.source,
      prediction: r.label,
      top_label: r.top,
      confidence: Number(r.confidence.toFixed(6)),
      threshold: r.threshold,
      latency_ms: r.latency,
      truth: $("truth").value,
      condition: $("condition").value || "unspecified",
      device: $("test-device").value,
      unaided_label: r.unaided,
    };
    const next = [...records, row].slice(-1000);
    try {
      localStorage.setItem("wastevision-tests-v1", JSON.stringify(next));
      records = next;
      $("save-record").disabled = true;
      $("truth").disabled = true;
      $("test-device").disabled = true;
      $("condition").disabled = true;
      $("save-status").textContent = "บันทึกแล้ว ดูได้ที่ “ผลทดสอบของฉัน”";
      updateTests();
    } catch {
      $("save-status").textContent =
        "บันทึกไม่ได้ เบราว์เซอร์อาจปิดพื้นที่จัดเก็บ กรุณาเปิดสิทธิ์แล้วลองใหม่";
    }
  };
  icons();
}
function matrixHTML(matrix, labels, title) {
  return `<div class="table-scroll matrix"><table><caption>${title}</caption><thead><tr><th>จริง ↓ / AI →</th>${labels.map((l) => `<th>${NAMES[l]}</th>`).join("")}</tr></thead><tbody>${matrix.map((row, i) => `<tr><th>${NAMES[labels[i]]}</th>${row.map((v, j) => `<td class="${i === j ? "diagonal" : ""}">${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function updateTests() {
  $("log-count").textContent = records.length;
  $("export").disabled = !records.length;
  $("delete-records").disabled = !records.length;
  const m = metrics(records);
  $("test-summary").innerHTML = records.length
    ? `<dl class="stats"><div><dt>ภาพที่ยืนยันแล้ว</dt><dd>${m.n}</dd></div><div><dt>ตอบตรงคำตอบจริง</dt><dd>${percent(m.accuracy)}</dd></div><div><dt>Macro F1 · 5 ประเภท</dt><dd>${m.macroF1.toFixed(3)}</dd></div><div><dt>สัดส่วนที่ AI รับจำแนก</dt><dd>${percent(m.coverage)}</dd></div></dl>`
    : '<div class="empty-log"><h2>ยังไม่มีผลที่ยืนยัน</h2><p>เริ่มจากสแกนภาพ แล้วเลือกคำตอบจริงใต้ผล AI</p><a class="button primary" href="#scan">เริ่มทดลอง</a></div>';
  $("records-body").innerHTML = records
    .slice()
    .reverse()
    .map(
      (r) =>
        `<tr><td>${esc(new Date(r.created_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }))}</td><td>${NAMES[r.prediction]}</td><td>${percent(r.confidence)}</td><td>${NAMES[r.truth]}</td><td>${Number(r.latency_ms) || 0} ms</td><td>${{ camera: "กล้อง", upload: "อัปโหลด", "dataset-example": "ตัวอย่างชุดข้อมูล" }[r.source] || "อื่น ๆ"}</td></tr>`,
    )
    .join("");
  $("records-table").hidden = !records.length;
  $("local-matrix").innerHTML = records.length
    ? matrixHTML(m.matrix, m.labels, "Confusion matrix · ผลในเบราว์เซอร์นี้")
    : "";
}
$("export").onclick = () => {
  const url = URL.createObjectURL(
    new Blob([toCSV(records)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download =
    "wastevision-tests-" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("delete-records").onclick = () => ($("delete-confirm").hidden = false);
$("cancel-delete").onclick = () => ($("delete-confirm").hidden = true);
$("confirm-delete").onclick = () => {
  try {
    localStorage.removeItem("wastevision-tests-v1");
    records = [];
    updateTests();
    $("delete-confirm").hidden = true;
    toast("ล้างผลทดสอบแล้ว");
  } catch {
    toast("ล้างข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
  }
};
function renderModel() {
  if (!meta) return;
  const m = meta;
  $("model-details").innerHTML =
    `<div class="model-intro"><div><h2>MobileNetV2 + ตัวจำแนก 5 ประเภท</h2><p>เรียนรู้ลักษณะภาพจาก ImageNet แล้วฝึกตัวจำแนกด้วยภาพ RealWaste ประมวลผลผ่าน ONNX Runtime บนเบราว์เซอร์ โดยไม่ใช้บริการ AI แบบเสียเงิน</p><p class="caption">เวอร์ชัน <code>${esc(m.model_version)}</code> · เกณฑ์รับจำแนก ${percent(m.threshold)}</p></div><span class="model-icon">${icon("leaf")}</span></div><div class="notice">ผลด้านล่างเป็นการแบ่งตามภาพ ยังไม่ได้ยืนยันว่าแยกตามวัตถุจริง จึงเป็นผลสำรวจเบื้องต้น และยังไม่ถือว่าผ่านเกณฑ์ทดสอบของแผน</div><dl class="stats"><div><dt>Accuracy · ชุดภาพทดสอบ</dt><dd>${percent(m.test_accuracy)}</dd></div><div><dt>Macro F1 · ชุดภาพทดสอบ</dt><dd>${m.test_macro_f1.toFixed(3)}</dd></div><div><dt>ภาพ 5 ประเภทที่ทดสอบ</dt><dd>${LABELS.reduce((s, l) => s + m.split_counts.test[l], 0)}</dd></div><div><dt>ปฏิเสธภาพนอกขอบเขต*</dt><dd>${m.test_unknown_rejection_rate === null ? "ยังไม่วัด" : percent(m.test_unknown_rejection_rate)}</dd></div></dl>${matrixHTML(m.confusion_matrix, LABELS, "Confusion matrix · ชุดภาพ RealWaste ก่อนใช้เกณฑ์ปฏิเสธ")}<p class="caption">*ทดสอบกับแก้ว ผ้า พืช และขยะผสมใน RealWaste ไม่ครอบคลุมวัตถุอื่นทุกชนิด เมื่อใช้เกณฑ์ปฏิเสธ ระบบรับจำแนกภาพในขอบเขต ${percent(m.test_known_coverage)} ของชุดทดสอบ</p><h2>ข้อมูลและวิธีทดสอบ</h2><div class="table-scroll"><table><caption>จำนวนภาพที่ใช้ในแต่ละส่วน</caption><thead><tr><th>วัสดุ</th><th>ฝึก</th><th>ตรวจสอบ</th><th>ทดสอบ</th></tr></thead><tbody>${[...LABELS, "unknown"].map((l) => `<tr><th>${NAMES[l]}</th><td>${m.split_counts.train[l]}</td><td>${m.split_counts.validation[l]}</td><td>${m.split_counts.test[l]}</td></tr>`).join("")}</tbody></table></div><p>Seed ${m.seed} · เลือกค่าการฝึกและเกณฑ์ปฏิเสธด้วยชุดตรวจสอบเท่านั้น เก็บชุดทดสอบไว้ประเมินโมเดลที่ส่งออกจริง ตรวจภาพซ้ำแบบไฟล์ตรงกันแล้ว แต่ยังอาจมีภาพวัตถุเดียวกันข้ามชุดได้</p><h2>สิ่งที่ยังต้องพิสูจน์</h2><ul class="limitations"><li>วัตถุใหม่และภาพบริบทไทย รวมถึงพื้นหลังและแสงที่ต่างจากข้อมูลฝึก</li><li>ความเร็วบนมือถือและเบราว์เซอร์จริง โดยเป้าหมายหลังโหลดโมเดลคือไม่เกิน 2 วินาทีต่อภาพ</li><li>การใช้กับคนประมาณ 10 คน และประโยชน์เทียบกับการแยกเอง</li><li>ภาพนอกขอบเขตอาจมีความมั่นใจสูง การปฏิเสธด้วยคะแนนเป็นเพียงวิธีเบื้องต้น</li></ul><p>อ้างอิงข้อมูล: <a href="https://archive.ics.uci.edu/dataset/908/realwaste" target="_blank" rel="noopener">RealWaste — Single, Iranmanesh & Raad (2023), CC BY 4.0</a></p><a class="text-button" href="${base}model/metadata.json" target="_blank" rel="noopener">เปิดผลประเมินและรายละเอียดโมเดล JSON</a>`;
  icons();
}
async function initModel() {
  ready = false;
  sync();
  $("retry-model").hidden = true;
  $("model-status").textContent = "กำลังโหลดโมเดลครั้งแรก… อาจใช้เวลาสักครู่";
  try {
    meta = await loadModel();
    ready = true;
    $("model-status").textContent = "โมเดลพร้อม · วิเคราะห์ภาพบนอุปกรณ์นี้";
    renderModel();
  } catch (e) {
    $("model-status").textContent =
      "โหลดโมเดลไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่";
    $("retry-model").hidden = false;
    $("model-details").textContent =
      "ยังโหลดข้อมูลโมเดลไม่ได้ กลับหน้าสแกนเพื่อลองโหลดใหม่";
    console.error(e);
  } finally {
    sync();
  }
}
$("retry-model").onclick = initModel;
function route() {
  const tab = ["scan", "tests", "model", "team"].includes(
    location.hash.slice(1),
  )
    ? location.hash.slice(1)
    : "scan";
  if (tab !== "scan") stopCamera();
  document
    .querySelectorAll(".page")
    .forEach((el) => (el.hidden = el.id !== "page-" + tab));
  document.querySelectorAll("[data-tab]").forEach((el) => {
    if (el.dataset.tab === tab) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
  sync();
}
window.addEventListener("hashchange", route);
window.addEventListener("pagehide", () => {
  stopCamera();
  releaseURL();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopCamera();
    sync();
  }
});
$("share").onclick = async () => {
  const url = location.origin + location.pathname;
  $("share-url").value = url;
  $("copy-status").textContent = "";
  $("share-dialog").showModal();
  try {
    await QRCode.toCanvas($("qr"), url, {
      width: 216,
      margin: 2,
      color: { dark: "#123e35", light: "#ffffff" },
    });
  } catch {
    $("copy-status").textContent = "สร้าง QR ไม่สำเร็จ ใช้ลิงก์ด้านล่างได้";
  }
};
$("close-share").onclick = () => $("share-dialog").close();
$("copy-url").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("share-url").value);
    $("copy-status").textContent = "คัดลอกลิงก์แล้ว";
  } catch {
    $("share-url").select();
    $("copy-status").textContent =
      "เลือกข้อความลิงก์แล้ว กรุณาคัดลอกด้วยตัวเอง";
  }
};
updateTests();
route();
initModel();
