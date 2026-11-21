export const LABELS = [
  "plastic",
  "metal",
  "paper",
  "cardboard",
  "food_organics",
  "glass",
];
export const NAMES = {
  plastic: "พลาสติก",
  metal: "โลหะ",
  paper: "กระดาษ",
  cardboard: "กระดาษแข็ง",
  food_organics: "เศษอาหาร",
  glass: "แก้ว",
  unknown: "ไม่แน่ใจ / นอกขอบเขต",
};
export const COLORS = {
  plastic: "#24785b",
  metal: "#3a6c92",
  paper: "#99712d",
  cardboard: "#9a5640",
  food_organics: "#648137",
  glass: "#417e82",
  unknown: "#63736e",
};
export function decision(probs, threshold) {
  if (
    probs.length !== LABELS.length + 1 ||
    probs.some((p) => !Number.isFinite(p) || p < 0 || p > 1) ||
    Math.abs(probs.reduce((a, b) => a + b, 0) - 1) > 0.01
  )
    throw new Error("ผลโมเดลไม่ถูกต้อง");
  const ranked = probs
    .map((p, i) => ({ label: [...LABELS, "unknown"][i], p }))
    .sort((a, b) => b.p - a.p);
  return {
    label: ranked[0].p >= threshold ? ranked[0].label : "unknown",
    top: ranked[0].label,
    confidence: ranked[0].p,
    ranked,
  };
}
export function guidance(label, condition) {
  if (condition === "hazardous")
    return "แยกเก็บและส่งจุดรับขยะอันตรายของพื้นที่ อย่าใส่รวมกับวัสดุรีไซเคิลทั่วไป";
  if (label === "unknown")
    return "ระบบไม่สามารถระบุประเภทได้อย่างมั่นใจ กรุณาถ่ายภาพวัตถุหนึ่งชิ้นให้ชัดเจน หรือสอบถามผู้ดูแลจุดรับวัสดุ ผ้า แบตเตอรี่ ขยะอันตราย และบรรจุภัณฑ์หลายชั้นอยู่นอกขอบเขตของระบบ";
  if (!condition)
    return "เลือกสภาพของสิ่งของด้านล่าง เพื่อดูคำแนะนำที่เหมาะสม ภาพอย่างเดียวบอกชนิดพลาสติกหรือการปนเปื้อนไม่ได้";
  if (condition === "hazardous")
    return "แยกเก็บและส่งจุดรับขยะอันตรายของพื้นที่ อย่าใส่รวมกับวัสดุรีไซเคิลทั่วไป";
  if (label === "food_organics")
    return "แยกเศษอาหารออกจากบรรจุภัณฑ์ แล้วส่งถังอินทรีย์หรือระบบจัดการเศษอาหารที่พื้นที่รองรับ";
  if (condition === "dirty")
    return ["paper", "cardboard"].includes(label)
      ? "แยกส่วนที่สะอาดและแห้งออกก่อน ส่วนเปียกหรือเปื้อนอาหารให้ตรวจข้อกำหนดจุดรับในพื้นที่ ไม่ควรปนกับกระดาษรีไซเคิลสะอาด"
      : "เทของเหลวและเศษอาหารออก ทำความสะอาดเมื่อเหมาะสม แล้วตรวจชนิดวัสดุและเงื่อนไขจุดรับก่อนส่งรีไซเคิล";
  return {
    plastic:
      "ตรวจสัญลักษณ์ชนิดพลาสติกและชนิดที่จุดรับยอมรับ เทของเหลวและทำให้แห้งก่อนส่งรีไซเคิล",
    metal:
      "ถ้าเป็นกระป๋องหรือโลหะทั่วไปที่จุดรับยอมรับ ให้เทของเหลวและทำให้แห้ง ภาชนะสารเคมีหรือมีแรงดันต้องแยกตามข้อกำหนด",
    paper:
      "เก็บให้สะอาดและแห้ง แยกกระดาษเคลือบหรือหลายชั้น แล้วตรวจชนิดที่จุดรับยอมรับ",
    cardboard:
      "แกะวัสดุอื่นที่ถอดได้ พับให้แบนและเก็บให้แห้งก่อนส่งจุดรับกระดาษแข็ง",
    glass:
      "เทของเหลวออก แยกฝาและวัสดุอื่นเมื่อทำได้ เก็บขวดหรือภาชนะแก้วอย่างระมัดระวัง แล้วตรวจเงื่อนไขจุดรับในพื้นที่ หากแตกให้ห่อและติดข้อความเตือน ไม่ปะปนกับขวดแก้วทั่วไป",
  }[label];
}
export function metrics(rows) {
  const labels = [...LABELS, "unknown"];
  const matrix = labels.map(() => labels.map(() => 0));
  for (const r of rows) {
    const i = labels.indexOf(r.truth),
      j = labels.indexOf(r.prediction);
    if (i >= 0 && j >= 0) matrix[i][j]++;
  }
  const n = matrix.flat().reduce((a, b) => a + b, 0);
  const correct = matrix.reduce((a, row, i) => a + row[i], 0);
  const f1 = LABELS.map((_, i) => {
    const tp = matrix[i][i],
      fp = matrix.reduce((s, row) => s + row[i], 0) - tp,
      fn = matrix[i].reduce((s, v) => s + v, 0) - tp;
    return 2 * tp + fp + fn ? (2 * tp) / (2 * tp + fp + fn) : 0;
  });
  return {
    n,
    accuracy: n ? correct / n : 0,
    macroF1: f1.reduce((a, b) => a + b, 0) / LABELS.length,
    matrix,
    labels,
    coverage: n ? rows.filter((r) => r.prediction !== "unknown").length / n : 0,
  };
}
export const CSV_FIELDS = [
  "id",
  "created_at",
  "model_version",
  "source",
  "prediction",
  "top_label",
  "confidence",
  "threshold",
  "latency_ms",
  "truth",
  "condition",
  "device",
  "unaided_label",
];
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function toCSV(rows) {
  return (
    "\uFEFF" +
    [
      CSV_FIELDS.map(csvCell).join(","),
      ...rows.map((r) => CSV_FIELDS.map((k) => csvCell(r[k])).join(",")),
    ].join("\r\n")
  );
}
export function readRecords(storage) {
  try {
    const rows = JSON.parse(storage.getItem("wastevision-tests-v1") || "[]");
    return Array.isArray(rows)
      ? rows
          .filter(
            (r) =>
              r &&
              [...LABELS, "unknown"].includes(r.truth) &&
              [...LABELS, "unknown"].includes(r.prediction) &&
              Number.isFinite(r.confidence) &&
              r.confidence >= 0 &&
              r.confidence <= 1,
          )
          .slice(-1000)
      : [];
  } catch {
    return [];
  }
}
