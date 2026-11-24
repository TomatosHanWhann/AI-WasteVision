import { initAdvice } from "./advice-ui.js";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/500.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "@fontsource/noto-serif-thai/500.css";
import "@fontsource/noto-serif-thai/600.css";
import "@fontsource/bodoni-moda/500.css";
import "./style.css";
import {
  createIcons,
  Camera,
  Upload,
  ScanLine,
  Leaf,
  BookOpen,
  CreditCard,
  ShieldCheck,
  Check,
  X,
  Recycle,
  CircleHelp,
  Share2,
} from "lucide";
import QRCode from "qrcode";
import { LABELS, NAMES, COLORS, guidance } from "./domain.js";
import { layout, icon } from "./views.js";
import { renderMulti, clearBoxes, initReceipt } from "./multi-ui.js";
import { cardRequest, renderCard } from "./loyalty.js";
import { createCardController } from "./card-controller.js";
const $ = (id) => document.getElementById(id);
const base = import.meta.env.BASE_URL;
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const pct = (value) => (Number(value) * 100).toFixed(1) + "%";
const icons = () =>
  createIcons({
    icons: {
      Camera,
      Upload,
      ScanLine,
      Leaf,
      BookOpen,
      CreditCard,
      ShieldCheck,
      Check,
      X,
      Recycle,
      CircleHelp,
      Share2,
    },
  });
const motion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
document.querySelector("#app").innerHTML = layout();
icons();
initReceipt();
let model,
  engine,
  modelLoading,
  ready = false,
  busy = false,
  imageLoading = false,
  stream = null,
  current = null,
  sourceType = "",
  result = null,
  objectURL = null;
let imageEpoch = 0,
  cameraEpoch = 0,
  cameraPending = false,
  examples = [],
  exampleFilter = "all",
  card = null,
  awardBusy = false;
function error(message) {
  $("scan-error").textContent = message;
  $("scan-error").hidden = !message;
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("toast").hidden = true), 4500);
}
function sync() {
  const locked = busy || imageLoading || awardBusy;
  $("scan-mode").disabled = locked || !!modelLoading;
  $("result-content").setAttribute("aria-busy", String(busy));
  $("analyze").setAttribute("aria-busy", String(busy || !!modelLoading));
  if (!busy) {
    $("analyze").innerHTML =
      icon("scan-line") +
      (ready
        ? "วิเคราะห์ภาพ"
        : modelLoading
          ? "กำลังโหลดโมเดล…"
          : "เตรียมระบบวิเคราะห์");
    icons();
  }
  $("analyze").disabled =
    !ready || locked || !current || !!stream || cameraPending;
  $("choose-file").disabled = locked;
  $("open-camera").disabled = locked || cameraPending;
  $("clear-image").disabled = locked;
  document
    .querySelectorAll("[data-example]")
    .forEach((el) => (el.disabled = locked));
}
function stopCamera() {
  cameraEpoch++;
  cameraPending = false;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  $("camera-video").srcObject = null;
  $("camera-video").hidden = true;
  $("capture").hidden = true;
}
function releaseURL() {
  if (objectURL) {
    URL.revokeObjectURL(objectURL);
    objectURL = null;
  }
}
function emptyResult(text = "เลือกภาพและเริ่มวิเคราะห์เพื่อดูประเภทวัสดุ") {
  result = null;
  clearBoxes();
  $("result-state").textContent = current
    ? "ภาพพร้อมสำหรับวิเคราะห์"
    : "ยังไม่ได้เลือกภาพ";
  $("result-content").innerHTML =
    `<div class="result-empty"><h3>${current ? "ภาพพร้อมสำหรับวิเคราะห์" : "ตรวจประเภทวัสดุก่อนคัดแยก"}</h3><p>${esc(text)}</p></div>`;
}
async function showImage(url, source) {
  stopCamera();
  error("");
  const epoch = ++imageEpoch;
  imageLoading = true;
  sync();
  try {
    const im = new Image();
    im.decoding = "async";
    im.src = url;
    await im.decode();
    if (im.width * im.height > 40000000)
      throw new Error(
        "ภาพมีความละเอียดสูงเกินไป กรุณาย่อภาพให้ไม่เกิน 40 ล้านพิกเซล",
      );
    if (epoch !== imageEpoch) return false;
    current = im;
    sourceType = source;
    $("preview-image").src = url;
    $("preview-image").hidden = false;
    $("empty-view").hidden = true;
    $("crop-hint").hidden = false;
    $("clear-image").hidden = false;
    $("crop-frame").hidden = true;
    emptyResult();
    return true;
  } catch (e) {
    throw new Error(
      e.message.startsWith("ภาพมี")
        ? e.message
        : "ไม่สามารถอ่านภาพได้ กรุณาเลือกไฟล์ JPG, PNG หรือ WebP ที่เปิดดูได้",
    );
  } finally {
    if (epoch === imageEpoch) imageLoading = false;
    sync();
  }
}
async function uploadFile(file) {
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    error("รองรับไฟล์ JPG, PNG และ WebP กรุณาแปลงไฟล์ HEIC ก่อนเลือกภาพ");
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    error("ไฟล์มีขนาดเกิน 15 MB กรุณาย่อภาพแล้วเลือกใหม่");
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    if (await showImage(url, "upload")) {
      releaseURL();
      objectURL = url;
    } else URL.revokeObjectURL(url);
  } catch (e) {
    URL.revokeObjectURL(url);
    error(e.message);
  }
}
$("choose-file").onclick = () => $("file-input").click();
$("file-input").onchange = (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  void uploadFile(file);
};
$("open-camera").onclick = async () => {
  error("");
  if (!navigator.mediaDevices?.getUserMedia) {
    error(
      "เบราว์เซอร์นี้ไม่สามารถเปิดกล้องได้ กรุณาใช้ HTTPS หรือเลือกภาพจากอุปกรณ์",
    );
    return;
  }
  stopCamera();
  const epoch = cameraEpoch;
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
    if (epoch !== cameraEpoch || document.hidden) {
      incoming.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = incoming;
    const video = $("camera-video");
    video.srcObject = stream;
    video.hidden = false;
    await video.play();
    if (epoch !== cameraEpoch) return;
    $("preview-image").hidden = true;
    $("empty-view").hidden = true;
    $("crop-hint").hidden = true;
    $("crop-frame").hidden = true;
    $("clear-image").hidden = false;
    $("capture").hidden = false;
    current = null;
    emptyResult("เลือก “ถ่ายภาพ” เมื่อจัดวัตถุอยู่กลางกรอบ");
  } catch (e) {
    if (epoch !== cameraEpoch) return;
    stopCamera();
    error(
      e.name === "NotAllowedError"
        ? "ยังไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาตรวจสิทธิ์กล้องของเว็บไซต์ หรือเลือกภาพจากอุปกรณ์"
        : "ไม่สามารถเปิดกล้องได้ กรุณาตรวจการเชื่อมต่อกล้องแล้วลองใหม่ หรือเลือกภาพจากอุปกรณ์",
    );
  } finally {
    if (epoch === cameraEpoch) cameraPending = false;
    sync();
  }
};
$("capture").onclick = async () => {
  if (busy || imageLoading) return;
  const video = $("camera-video");
  if (!video.videoWidth) {
    error("กล้องยังไม่พร้อม กรุณารอสักครู่แล้วถ่ายภาพอีกครั้ง");
    return;
  }
  $("capture").disabled = true;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.94),
    );
    if (!blob) throw new Error("ไม่สามารถบันทึกภาพได้ กรุณาถ่ายภาพใหม่");
    const url = URL.createObjectURL(blob);
    try {
      await showImage(url, "camera");
      releaseURL();
      objectURL = url;
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  } catch (e) {
    error(e.message);
  } finally {
    $("capture").disabled = false;
  }
};
$("clear-image").onclick = () => {
  imageEpoch++;
  imageLoading = false;
  stopCamera();
  releaseURL();
  current = null;
  sourceType = "";
  $("preview-image").removeAttribute("src");
  $("preview-image").hidden = true;
  $("empty-view").hidden = false;
  $("crop-hint").hidden = true;
  $("crop-frame").hidden = true;
  $("clear-image").hidden = true;
  error("");
  emptyResult();
  sync();
};
async function initModel() {
  if (ready) return;
  if (modelLoading) return modelLoading;
  $("retry-model").hidden = true;
  $("model-status").textContent = "กำลังโหลดโมเดลครั้งแรก กรุณารอสักครู่";
  modelLoading = (async () => {
    try {
      engine =
        $("scan-mode").value === "multiple"
          ? await import("./detection.js")
          : await import("./inference.js");
      const activeMetadata =
        $("scan-mode").value === "multiple"
          ? await engine.loadDetector()
          : await engine.loadModel();
      if ($("scan-mode").value !== "multiple") model = activeMetadata;
      ready = true;
      $("model-status").textContent = "โมเดลพร้อมสำหรับวิเคราะห์บนอุปกรณ์นี้";
      renderEvaluation();
    } catch (e) {
      $("model-status").textContent =
        "ไม่สามารถโหลดโมเดลได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่";
      $("retry-model").hidden = false;
    } finally {
      modelLoading = null;
      sync();
    }
  })();
  sync();
  return modelLoading;
}
$("retry-model").onclick = initModel;
$("scan-mode").onchange = () => {
  ready = false;
  emptyResult();
  void initModel();
};
$("analyze").onclick = async () => {
  if (!current || busy || !ready) return;
  busy = true;
  sync();
  error("");
  $("result-state").textContent = "กำลังวิเคราะห์ภาพ";
  $("analyze").textContent = "กำลังวิเคราะห์ภาพ…";
  try {
    result =
      $("scan-mode").value === "multiple"
        ? await engine.detect(current)
        : await engine.predict(current);
    result.source = sourceType;
    result.imageDigest = await engine.imageDigest(current);
    renderResult();
    if (matchMedia("(max-width:680px)").matches)
      $("result-title").scrollIntoView({ behavior: motion(), block: "start" });
  } catch (e) {
    emptyResult("ไม่สามารถวิเคราะห์ภาพได้ กรุณาเลือกภาพใหม่แล้วลองอีกครั้ง");
    error(
      "ไม่สามารถวิเคราะห์ภาพได้ กรุณาเลือกภาพใหม่ หรือโหลดหน้าเว็บไซต์อีกครั้ง",
    );
  } finally {
    busy = false;
    $("analyze").innerHTML = icon("scan-line") + "วิเคราะห์ภาพ";
    icons();
    sync();
  }
};
function renderResult() {
  if (result.mode === "multiple") {
    renderMulti({
      result,
      source: current,
      getCard: () => card,
      setCard: (next) => {
        card = next;
        showCard();
      },
      setBusy: (value) => {
        awardBusy = value;
        sync();
      },
    });
    return;
  }
  const r = result,
    unknown = r.label === "unknown";
  $("result-state").textContent = r.latency.toLocaleString("th-TH") + " ms";
  $("result-content").innerHTML =
    `<div class="prediction ${unknown ? "uncertain" : ""}"><span class="prediction-label">${unknown ? "ผลวิเคราะห์ต้องตรวจสอบเพิ่มเติม" : "ประเภทวัสดุที่ระบบคาดการณ์"}</span><h3>${unknown ? "ไม่สามารถระบุได้อย่างมั่นใจ" : NAMES[r.label]}</h3><p>${unknown ? `คะแนนสูงสุด ${NAMES[r.top]} ${pct(r.confidence)} · เกณฑ์รับจำแนก ${pct(r.threshold)}` : `คะแนนความมั่นใจ ${pct(r.confidence)}`}</p></div><div class="probabilities" aria-label="คะแนนความมั่นใจแต่ละประเภท">${r.ranked.map((x) => `<div class="probability"><span>${NAMES[x.label]}</span><div class="bar"><span style="width:${x.p * 100}%;background:${COLORS[x.label]}"></span></div><span>${pct(x.p)}</span></div>`).join("")}</div><p class="caption confidence-note">คะแนนความมั่นใจไม่ใช่การรับรองความถูกต้อง ภาพนอกขอบเขตอาจได้รับคะแนนสูงได้</p><div class="sorting"><h4>ระบุสภาพวัสดุ</h4><label class="sr-only" for="condition">สภาพวัสดุ</label><select id="condition"><option value="">เลือกสภาพเพื่อประกอบคำแนะนำ</option><option value="clean">สะอาดและแห้ง / เศษอาหารทั่วไป</option><option value="dirty">เปียกหรือเปื้อนอาหาร</option><option value="hazardous">อันตราย / สารเคมี / ภาชนะมีแรงดัน</option></select><p id="guidance">${guidance(r.label, "")}</p></div><div class="award-area"><div id="award-content"></div><p id="award-message" role="status"></p></div>`;
  $("condition").onchange = () => {
    $("guidance").textContent = guidance(r.label, $("condition").value);
    updateAward();
  };
  updateAward();
  icons();
}
function updateAward() {
  if (!result || result.mode === "multiple" || !$("award-content")) return;
  const area = $("award-content");
  if (result.awarded) {
    area.innerHTML = `<p class="award-success">${icon("check")}บันทึกการคัดแยกแล้ว ได้รับ 1 แต้ม</p><a href="#card">ตรวจยอดสะสม</a>`;
    icons();
    return;
  }
  if (result.source === "example") {
    area.innerHTML =
      '<p class="caption">ภาพนี้เป็นตัวอย่างประกอบการศึกษา ไม่สามารถใช้สะสมแต้มได้</p>';
    return;
  }
  if (result.label === "unknown") {
    area.innerHTML =
      '<p class="caption">รายการนี้ยังไม่เข้าเงื่อนไขสะสมแต้ม กรุณาใช้ภาพที่ระบบระบุประเภทได้อย่างมั่นใจ</p>';
    return;
  }
  if (!card) {
    area.innerHTML =
      '<p>เปิดบัตรสะสมเพื่อบันทึกรายการที่ท่านคัดแยก</p><a class="button secondary full" href="#card">เปิดบัตรสะสมแต้ม</a>';
    return;
  }
  const condition = $("condition").value;
  area.innerHTML = `<p class="caption">การยืนยันหนึ่งครั้งนับเป็นหนึ่งชิ้น ภาพเดิมไม่สามารถสะสมซ้ำได้</p><button id="award-point" class="button primary full" ${!["clean", "dirty"].includes(condition) || awardBusy ? "disabled" : ""}>${icon("check")}ยืนยันการคัดแยก 1 ชิ้น</button>`;
  icons();
  $("award-point").onclick = async () => {
    if (awardBusy || !result) return;
    awardBusy = true;
    sync();
    const expected = result;
    $("award-message").textContent = "กำลังบันทึกรายการ";
    updateAward();
    try {
      const ticket = await cardRequest("scan-ticket", {
        source: expected.source,
        label: expected.label,
        confidence: expected.confidence,
        modelVersion: expected.version,
        imageDigest: expected.imageDigest,
      });
      const next = await cardRequest("points", {
        ticket: ticket.ticket,
        condition,
        confirm: true,
      });
      card = next;
      expected.awarded = true;
      showCard();
      if (result === expected)
        $("award-message").textContent =
          "ยอดสะสมปัจจุบัน " + next.total.toLocaleString("th-TH") + " ชิ้น";
    } catch (e) {
      if (e.status === 401) {
        card = null;
        showCard();
      }
      $("award-message").textContent = e.message;
    } finally {
      awardBusy = false;
      sync();
      updateAward();
    }
  };
}
function showCard() {
  $("card-form").hidden = !!card;
  $("active-card").hidden = !card;
  $("refresh-card").hidden = !card;
  $("close-card").hidden = !card;
  if (card) $("active-card").innerHTML = renderCard(card, esc);
  else $("active-card").innerHTML = "";
  updateAward();
  icons();
}
const cardController = createCardController({
  request: cardRequest,
  onChange: (next) => {
    card = next;
    showCard();
  },
  onMessage: (message) => ($("card-message").textContent = message),
  onPending: (pending) => {
    for (const id of [
      "open-card",
      "close-card",
      "refresh-card",
      "phone",
      "phone-consent",
    ])
      $(id).disabled = pending;
    $("card-form").setAttribute("aria-busy", String(pending));
  },
});
$("card-form").onsubmit = async (event) => {
  event.preventDefault();
  const opened = await cardController.open(
    $("phone").value,
    $("phone-consent").checked,
  );
  if (opened.success) {
    $("phone").value = "";
    $("phone-consent").checked = false;
  }
};
function refreshCard(silent = false) {
  return cardController.refresh(silent);
}
$("refresh-card").onclick = () => refreshCard();
$("close-card").onclick = () => cardController.close();

function renderExamples() {
  const visible = examples.filter(
    (x) => exampleFilter === "all" || x.label === exampleFilter,
  );
  $("example-empty").hidden = !!visible.length;
  $("examples").innerHTML = visible
    .map(
      (x) =>
        `<button class="example-tile" data-example="${esc(x.id)}"><div class="example-photo"><img src="${base + esc(x.image)}" alt="${esc(x.name)}" loading="lazy"/></div><span>${esc(x.brand || NAMES[x.label])}</span><small>${esc(x.name)}</small><em>${x.label === "multiple" ? "คำตอบชุดข้อมูล " + x.ground_truth_count + " ชิ้น" : x.label === "unknown" ? "วัสดุหลายชั้น · ตรวจสอบวัสดุ" : NAMES[x.label]}</em></button>`,
    )
    .join("");
  document.querySelectorAll("[data-example]").forEach(
    (button) =>
      (button.onclick = async () => {
        const example = examples.find((x) => x.id === button.dataset.example);
        try {
          if (
            example.label === "multiple" &&
            $("scan-mode").value !== "multiple"
          ) {
            $("scan-mode").value = "multiple";
            ready = false;
            void initModel();
          }
          await showImage(base + example.image, "example");
          releaseURL();
          if (example.label === "unknown") error(example.note);
          $("viewfinder").scrollIntoView({
            behavior: motion(),
            block: "center",
          });
        } catch (e) {
          error(e.message);
        }
      }),
  );
  sync();
}
$("example-filters").onclick = (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  exampleFilter = button.dataset.filter;
  document
    .querySelectorAll("[data-filter]")
    .forEach((el) => el.setAttribute("aria-pressed", String(el === button)));
  renderExamples();
};
async function initExamples() {
  try {
    const response = await fetch(base + "examples/catalog.json");
    if (!response.ok) throw new Error();
    const data = await response.json();
    examples = data.filter((x) => x.reviewed === true);
    const heroIds = [
      "thai-8850999320007",
      "thai-8851123212021",
      "thai-8855790000844",
    ];
    const hero = heroIds
      .map((id) => examples.find((x) => x.id === id))
      .filter(Boolean);
    $("intro-visual").innerHTML =
      hero
        .map(
          (x) =>
            `<figure><img src="${base + esc(x.image)}" alt="${esc(x.name)}"/><figcaption><span>${esc(x.brand)}</span><strong>${NAMES[x.label]}</strong></figcaption></figure>`,
        )
        .join("") + "<p>ตัวอย่างบรรจุภัณฑ์จากภาพผลิตภัณฑ์จริง</p>";
    $("source-links").innerHTML = examples
      .map(
        (x) =>
          `<a href="${esc(x.source_url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`,
      )
      .join("");
  } catch {
    $("source-links").textContent = "ยังไม่สามารถอ่านรายการภาพผลิตภัณฑ์ได้";
  }
  examples.push(
    ...LABELS.map((l) => ({
      id: "material-" + l,
      name: "ตัวอย่างวัสดุ " + NAMES[l],
      brand: "วัสดุทั่วไป",
      label: l,
      image: "samples/" + l + ".jpg",
      note: "ภาพวัสดุจาก RealWaste",
    })),
  );
  try {
    const r = await fetch(base + "detection-examples/catalog.json");
    if (r.ok) {
      const data = await r.json();
      examples.push(
        ...data.map((x, i) => ({
          ...x,
          id: "detection-" + i,
          name: "ภาพทดสอบหลายชิ้น " + (i + 1),
          brand: "ชุดข้อมูล " + x.source,
          label: "multiple",
        })),
      );
    }
  } catch {}
  renderExamples();
}
function renderEvaluation() {
  if (!model) return;
  const known = model.labels.reduce(
    (sum, l) => sum + (model.split_counts.test[l] || 0),
    0,
  );
  const thai = model.domain_evaluation?.["thai-product"];
  $("evaluation-summary").innerHTML =
    `<p>โมเดลจำแนกวัสดุ ${model.labels.length} ประเภท ประเมินด้วยภาพที่กันไว้ ${known.toLocaleString("th-TH")} ภาพ ได้ความถูกต้อง ${pct(model.test_accuracy)} ก่อนใช้เกณฑ์ปฏิเสธผล และค่า Macro F1 ${model.test_macro_f1.toFixed(3)}</p><p>เมื่อใช้เกณฑ์ความมั่นใจ ${pct(model.threshold)} ระบบรับจำแนกภาพในขอบเขต ${pct(model.test_known_coverage)} ของชุดทดสอบ ตัวเลขนี้ยังไม่ใช่ผลทดสอบวัตถุใหม่ในสถานที่จริง</p>` +
    (thai
      ? `<p>ชุดทดสอบภาพผลิตภัณฑ์ไทยในขอบเขตมีเพียง ${thai.known_test_images} ภาพ ได้ความถูกต้อง ${pct(thai.accuracy_before_rejection)} จึงยังไม่เพียงพอสำหรับยืนยันประสิทธิภาพกับบรรจุภัณฑ์ไทย ภาพผลิตภัณฑ์ใช้ประกอบการศึกษา ไม่ทดแทนการประเมินภาคสนาม</p>`
      : "");
}
async function readMetadata() {
  try {
    const response = await fetch(base + "model/metadata.json");
    if (response.ok) {
      model = await response.json();
      renderEvaluation();
    }
  } catch {
    $("evaluation-summary").textContent =
      "ยังไม่สามารถอ่านข้อมูลการประเมินได้ กรุณาโหลดหน้าใหม่";
  }
}
function route() {
  const alias = { team: "about", model: "about", tests: "card" };
  let target = location.hash.slice(1) || "about";
  target = alias[target] || target;
  if (!["about", "guide", "scan", "card"].includes(target)) target = "about";
  if (target !== "scan") stopCamera();
  document
    .querySelectorAll(".page")
    .forEach((page) => (page.hidden = page.id !== "page-" + target));
  document.querySelectorAll("[data-tab]").forEach((link) => {
    if (link.dataset.tab === target) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (target === "scan") void initModel();
  if (target === "card") void refreshCard(true);
  sync();
}
window.addEventListener("hashchange", () => {
  route();
  const heading = document.querySelector(".page:not([hidden]) h1");
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
  window.scrollTo({ top: 0, behavior: "instant" });
});
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
      color: { dark: "#283127", light: "#fffdf8" },
    });
  } catch {
    $("copy-status").textContent =
      "ไม่สามารถสร้าง QR Code ได้ กรุณาใช้ลิงก์ด้านล่าง";
  }
};
$("close-share").onclick = () => $("share-dialog").close();
$("copy-url").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("share-url").value);
    $("copy-status").textContent = "คัดลอกลิงก์เรียบร้อยแล้ว";
  } catch {
    $("share-url").select();
    $("copy-status").textContent = "กรุณาคัดลอกข้อความลิงก์ที่เลือกไว้";
  }
};
initAdvice();
route();
void initExamples();
void readMetadata();
void readDetectionEvaluation();
void refreshCard(true);

async function readDetectionEvaluation() {
  try {
    const r = await fetch(base + "model/detector-metadata.json");
    if (!r.ok) return;
    const m = await r.json(),
      t = m.test;
    $("detection-evaluation").innerHTML =
      `<p>โมเดลตรวจจับ ${m.labels.length} กลุ่ม · ภาพทดสอบ ${m.split_counts.test.toLocaleString("th-TH")} ภาพ และวัตถุจริง ${t.true_objects.toLocaleString("th-TH")} ชิ้น</p><dl class="evaluation-numbers"><div><dt>Precision ของรายการที่ตรวจพบ</dt><dd>${pct(t.precision)}</dd></div><div><dt>Recall ของวัตถุจริง</dt><dd>${pct(t.recall)}</dd></div><div><dt>mAP@0.50–0.95</dt><dd>${pct(t.map50_95)}</dd></div><div><dt>จำนวนตรงทั้งหมดต่อภาพ</dt><dd>${pct(t.count_exact_match)}</dd></div><div><dt>ความคลาดเคลื่อนจำนวนเฉลี่ย</dt><dd>${t.count_mae.toFixed(2)} ชิ้น</dd></div></dl><p class="caption">วัดจากชุดข้อมูลสาธารณะที่กันไว้ ไม่ใช่ผลภาคสนามไทย Precision ตรวจทั้งประเภทและกรอบที่ทับวัตถุจริงอย่างน้อย 50% คะแนนความมั่นใจรายชิ้นผ่านการปรับเทียบ แต่ยังมีความคลาดเคลื่อนได้</p>`;
    const q = await cardRequest("quality");
    const rows = q.versions || [];
    $("community-evaluation").innerHTML = rows.length
      ? rows
          .map(
            (x) =>
              `<p>รุ่น ${esc(x.model_version)} · ผู้ใช้ส่ง ${Number(x.submissions).toLocaleString("th-TH")} ภาพ · ตอบตรงตามผู้ใช้รายงาน ${Number(x.predictions) ? pct(Number(x.user_correct) / Number(x.predictions)) : "ยังไม่มีรายการ"} (${Number(x.predictions)} รายการ) · ผ่านตรวจทาน ${Number(x.reviewed_submissions)} ภาพ</p><p>คลาดเคลื่อนจำนวนตามผู้ใช้รายงานเฉลี่ย ${(Number(x.count_error) / Math.max(1, Number(x.submissions))).toFixed(2)} ชิ้นต่อภาพ · Precision หลังตรวจทาน ${Number(x.reviewed_predictions) ? pct(Number(x.reviewed_correct) / Number(x.reviewed_predictions)) : "ยังไม่มีข้อมูล"} · Recall หลังตรวจทาน ${Number(x.reviewed_truth) ? pct(Number(x.reviewed_correct) / Number(x.reviewed_truth)) : "ยังไม่มีข้อมูล"}</p>`,
          )
          .join("") +
        '<p class="caption">ข้อมูลสมัครใจอาจมีอคติและไม่ใช่ชุดทดสอบอิสระ การเพิ่มข้อมูลไม่ได้รับประกันว่าโมเดลจะแม่นยำขึ้น</p>'
      : "ยังไม่มีข้อมูลประเมินจากผู้ใช้";
  } catch {
    $("community-evaluation").textContent = "ยังไม่สามารถอ่านสถิติจากผู้ใช้ได้";
  }
}
