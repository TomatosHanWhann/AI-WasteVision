export const OBJECT_NAMES = {
  plastic: "ภาชนะพลาสติก",
  metal: "โลหะ / กระป๋อง",
  paper: "กระดาษ",
  cardboard: "กระดาษแข็ง",
  food_organics: "เศษอาหาร",
  glass: "ภาชนะแก้ว",
  film: "ถุง / ฟิล์มพลาสติก",
  multilayer: "บรรจุภัณฑ์หลายชั้น",
  foam: "โฟม",
  battery: "ถ่าน / แบตเตอรี่",
  electronics: "อุปกรณ์อิเล็กทรอนิกส์",
  bulb: "หลอดไฟ",
  pressurised: "ภาชนะมีแรงดัน",
  broken_glass: "แก้วแตก",
  unknown: "ยังระบุประเภทไม่ได้",
};
export const SPECIAL = new Set([
  "battery",
  "electronics",
  "bulb",
  "pressurised",
  "broken_glass",
]);
export function disposal(label, condition = "", profile = "five") {
  if (condition === "damaged" && label !== "battery")
    return disposal("battery", condition, profile);
  const special =
    SPECIAL.has(label) ||
    ["hazardous", "damaged", "infectious"].includes(condition);
  if (condition === "infectious")
    return {
      group: "infectious",
      color: "red",
      name: "มูลฝอยติดเชื้อ",
      action:
        "แยกนำส่งจุดรับมูลฝอยติดเชื้อตามข้อกำหนดของพื้นที่ ไม่ทิ้งรวมกับขยะทั่วไป",
      eligible: false,
    };
  if (label === "battery")
    return {
      group: "special",
      color: "orange",
      name: "จุดรับถ่านและแบตเตอรี่",
      action:
        condition === "damaged"
          ? "กรณีบวม รั่ว หรือร้อนผิดปกติ ให้หยุดใช้งาน ไม่ชาร์จ เจาะ หรือแกะ และติดต่อผู้รับกำจัดที่รองรับแบตเตอรี่ชำรุดก่อนส่ง"
          : "แยกจากขยะทั่วไปและรีไซเคิล สำหรับแบตเตอรี่ลิเธียมสภาพปกติให้ปิดขั้วด้วยเทปฉนวนก่อนนำส่งจุดรับ ห้ามแกะอุปกรณ์เพื่อถอดแบตเตอรี่ที่ติดตั้งภายในเอง",
      eligible: false,
    };
  if (label === "electronics")
    return {
      group: "special",
      color: "orange",
      name: "จุดรับขยะอิเล็กทรอนิกส์",
      action:
        "แยกนำส่งจุดรับ E-waste ตรวจชนิดที่รับ ลบข้อมูลส่วนบุคคลก่อนส่ง และไม่แกะชิ้นส่วนหรือแบตเตอรี่ที่ติดตั้งภายใน",
      eligible: false,
    };
  if (label === "bulb" || label === "pressurised" || condition === "hazardous")
    return {
      group: "hazardous",
      color: profile === "four" ? "red" : "orange",
      name: "จุดรับขยะอันตราย",
      action:
        label === "bulb"
          ? "เก็บแยกโดยป้องกันการแตก ไม่บดหรือทิ้งรวมกับขยะทั่วไป และตรวจเงื่อนไขจุดรับหลอดไฟ"
          : "แยกจากขยะทั่วไป ไม่เจาะ บีบอัด หรือเผาภาชนะ และนำส่งจุดรับขยะอันตรายที่รองรับ",
      eligible: false,
    };
  if (label === "broken_glass")
    return {
      group: "special",
      color: "orange",
      name: "จุดรับวัสดุมีคมตามข้อกำหนดพื้นที่",
      action:
        "หลีกเลี่ยงการหยิบด้วยมือเปล่า ใส่ภาชนะแข็งที่ป้องกันการทะลุ ติดป้าย “แก้วแตก” และตรวจเงื่อนไขจุดรับก่อนนำส่ง",
      eligible: false,
    };
  if (label === "unknown" || !OBJECT_NAMES[label])
    return {
      group: "unknown",
      color: "gray",
      name: "ตรวจสอบเพิ่มเติมก่อนทิ้ง",
      action:
        "ถ่ายภาพใกล้ ตรวจฉลากและวัสดุด้วยตนเอง ระบบยังไม่สามารถแนะนำถังได้อย่างเหมาะสม",
      eligible: false,
    };
  if (label === "food_organics")
    return {
      group: "organic",
      color: "green",
      name: "ถังสีเขียว · ขยะอินทรีย์",
      action: "แยกบรรจุภัณฑ์ออกก่อน และตรวจข้อกำหนดของจุดรับเศษอาหาร",
      eligible: !!condition && !special,
    };
  if (["multilayer", "foam", "film"].includes(label))
    return {
      group: "general",
      color: "blue",
      name: "ถังสีน้ำเงิน · ขยะทั่วไป",
      action:
        "ตรวจจุดรับเฉพาะชนิดก่อน หากไม่มีจุดรับที่ยอมรับให้แยกเป็นขยะทั่วไป ไม่เหมารวมกับพลาสติกรีไซเคิล",
      eligible: !!condition && !special,
    };
  if (condition === "dirty")
    return {
      group: "check",
      color: "gray",
      name: "ทำความสะอาดหรือตรวจจุดรับก่อน",
      action:
        "เทเศษอาหารหรือของเหลวออก หากทำให้สะอาดและจุดรับยอมรับจึงส่งรีไซเคิล วัสดุปนเปื้อนที่ทำความสะอาดไม่ได้ให้ตรวจแนวทางขยะทั่วไปของพื้นที่",
      eligible: true,
    };
  return {
    group: "recycle",
    color: "yellow",
    name: "ถังสีเหลือง · ขยะรีไซเคิล",
    action:
      "แยกให้สะอาดและแห้ง ตรวจชนิดวัสดุและเงื่อนไขจุดรับ สีถังเป็นแนวทางประกอบ ไม่ใช่การรับรองว่ารีไซเคิลได้ทุกชนิด",
    eligible: condition === "clean",
  };
}
export function iou(a, b) {
  const x = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])),
    y = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const intersection = x * y;
  return (
    intersection /
    Math.max(
      1e-12,
      (a[2] - a[0]) * (a[3] - a[1]) +
        (b[2] - b[0]) * (b[3] - b[1]) -
        intersection,
    )
  );
}
export function suppress(candidates, threshold = 0.45, limit = 10) {
  const sorted = candidates
    .filter(
      (x) =>
        Number.isFinite(x.rawConfidence) &&
        x.rawConfidence >= 0 &&
        x.rawConfidence <= 1 &&
        x.box.length === 4 &&
        x.box.every(Number.isFinite) &&
        x.box[2] > x.box[0] &&
        x.box[3] > x.box[1],
    )
    .sort((a, b) => b.rawConfidence - a.rawConfidence);
  const kept = [];
  for (const item of sorted) {
    if (kept.every((x) => iou(x.box, item.box) < threshold)) {
      kept.push(item);
      if (kept.length === limit) break;
    }
  }
  return kept;
}
export function calibratedScore(raw, calibration) {
  const { x, y } = calibration;
  if (raw <= x[0]) return y[0];
  for (let i = 1; i < x.length; i++)
    if (raw <= x[i])
      return (
        y[i - 1] +
        ((y[i] - y[i - 1]) * (raw - x[i - 1])) /
          Math.max(1e-12, x[i] - x[i - 1])
      );
  return y.at(-1);
}
export function roundConfidence(items) {
  return items.length
    ? items.reduce((s, x) => s + x.confidence, 0) / items.length
    : null;
}
