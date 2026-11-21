import { OBJECT_NAMES, iou } from "../src/detection-domain.js";
import { hmac } from "./rules.js";
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const validBox = (b) =>
  Array.isArray(b) &&
  b.length === 4 &&
  b.every((x) => Number.isFinite(x) && x >= 0 && x <= 1) &&
  b[2] > b[0] &&
  b[3] > b[1];
async function admin(request, env) {
  const value = request.headers.get("authorization");
  if (
    !env.REVIEW_ADMIN_SECRET ||
    env.REVIEW_ADMIN_SECRET.length < 32 ||
    !value?.startsWith("Bearer ")
  )
    fail("ไม่มีสิทธิ์เข้าถึงข้อมูลตรวจทาน", 403);
  const a = await hmac(env.REVIEW_ADMIN_SECRET, value.slice(7)),
    b = await hmac(env.REVIEW_ADMIN_SECRET, env.REVIEW_ADMIN_SECRET);
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  if (diff) fail("ไม่มีสิทธิ์เข้าถึงข้อมูลตรวจทาน", 403);
}
export async function feedbackApi(request, env, { json, input, modelVersion }) {
  const u = new URL(request.url),
    path = u.pathname;
  if (path === "/api/quality" && request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT model_version,COUNT(*) AS submissions,SUM(predicted_count) AS predictions,SUM(user_correct) AS user_correct,SUM(ABS(predicted_count-expected_count)) AS count_error,SUM(CASE WHEN predicted_count=expected_count THEN 1 ELSE 0 END) AS exact_count,SUM(CASE WHEN status='reviewed' THEN 1 ELSE 0 END) AS reviewed_submissions,SUM(CASE WHEN status='reviewed' THEN predicted_count ELSE 0 END) AS reviewed_predictions,SUM(CASE WHEN status='reviewed' THEN json_extract(reviewed_items,'$.correct') ELSE 0 END) AS reviewed_correct,SUM(CASE WHEN status='reviewed' THEN reviewed_count ELSE 0 END) AS reviewed_truth FROM analysis_feedback WHERE status!='rejected' GROUP BY model_version`,
    ).all();
    return json({
      versions: rows.results,
      notice:
        "ข้อมูลผู้ใช้เป็นการรายงานโดยสมัครใจและอาจมีอคติ ผลที่ตรวจทานไม่ใช่การทดสอบอิสระแบบสุ่ม และไม่ใช้แทน holdout",
    });
  }
  if (path === "/api/feedback" && request.method === "POST") {
    const d = await input(request, 750000);
    if (
      d.consent !== true ||
      !["camera", "upload"].includes(d.source) ||
      d.modelVersion !== modelVersion ||
      !/^[a-f0-9]{64}$/.test(d.imageDigest || "") ||
      !Array.isArray(d.items) ||
      d.items.length > 10 ||
      !Number.isInteger(d.expectedCount) ||
      d.expectedCount < 0 ||
      d.expectedCount > 30
    )
      fail("ข้อมูลการประเมินไม่ครบถ้วนหรือยังไม่ได้ให้ความยินยอม");
    const ids = new Set();
    for (const x of d.items) {
      if (
        !Number.isInteger(x.id) ||
        x.id < 1 ||
        x.id > 10 ||
        ids.has(x.id) ||
        !OBJECT_NAMES[x.label] ||
        !Object.hasOwn(OBJECT_NAMES, x.label) ||
        !Object.hasOwn({ ...OBJECT_NAMES, not_waste: "" }, x.truth) ||
        !validBox(x.box) ||
        !Number.isFinite(x.confidence) ||
        x.confidence < 0 ||
        x.confidence > 1
      )
        fail("ข้อมูลสิ่งของไม่ถูกต้อง");
      ids.add(x.id);
    }
    const items = d.items.map((x) => ({
      id: x.id,
      label: x.label,
      truth: x.truth,
      box: x.box,
      confidence: x.confidence,
    }));
    const id = crypto.randomUUID(),
      token = crypto.randomUUID() + crypto.randomUUID();
    let imageKey = null;
    if (d.image) {
      if (
        d.imageConsent !== true ||
        !env.BUCKET ||
        typeof d.image !== "string" ||
        !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(d.image) ||
        d.image.length > 690000
      )
        fail("ยังไม่สามารถรับภาพเพื่อการศึกษาได้ หรือไม่ได้ยินยอมให้ส่งภาพ");
      const bytes = Uint8Array.from(atob(d.image.split(",")[1]), (c) =>
        c.charCodeAt(0),
      );
      if (
        bytes.length < 4 ||
        bytes[0] !== 255 ||
        bytes[1] !== 216 ||
        bytes[2] !== 255
      )
        fail("ไฟล์ภาพไม่ถูกต้อง");
      imageKey = "feedback/" + id + ".jpg";
      await env.BUCKET.put(imageKey, bytes, {
        httpMetadata: { contentType: "image/jpeg" },
      });
    }
    try {
      await env.DB.prepare(
        "INSERT INTO analysis_feedback(id,model_version,source,image_key,image_digest,items,expected_count,predicted_count,user_correct,delete_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      )
        .bind(
          id,
          d.modelVersion,
          d.source,
          imageKey,
          await hmac(env.PHONE_HASH_SECRET, "feedback:" + d.imageDigest),
          JSON.stringify(items),
          d.expectedCount,
          items.length,
          items.filter((x) => x.truth === x.label).length,
          await hmac(env.PHONE_HASH_SECRET, "delete:" + token),
          Date.now(),
        )
        .run();
    } catch (e) {
      if (imageKey) await env.BUCKET.delete(imageKey);
      if (String(e).includes("UNIQUE"))
        fail("ภาพนี้มีข้อมูลประเมินในรุ่นนี้แล้ว", 409);
      throw e;
    }
    return json({
      id,
      deleteToken: token,
      status: "pending",
      imageStored: !!imageKey,
      message: "บันทึกข้อมูลแล้ว รอการตรวจทานก่อนใช้ฝึกโมเดล",
    });
  }
  if (path === "/api/feedback/delete" && request.method === "POST") {
    const d = await input(request);
    if (
      typeof d.id !== "string" ||
      typeof d.deleteToken !== "string" ||
      d.deleteToken.length > 100
    )
      fail("รหัสรายการไม่ถูกต้อง");
    const row = await env.DB.prepare(
      "SELECT image_key,delete_key FROM analysis_feedback WHERE id=?",
    )
      .bind(d.id)
      .first();
    if (
      !row ||
      row.delete_key !==
        (await hmac(env.PHONE_HASH_SECRET, "delete:" + d.deleteToken))
    )
      fail("ไม่พบรายการหรือรหัสลบไม่ถูกต้อง", 403);
    if (row.image_key) await env.BUCKET.delete(row.image_key);
    await env.DB.prepare("DELETE FROM analysis_feedback WHERE id=?")
      .bind(d.id)
      .run();
    return json({ deleted: true });
  }
  if (path.startsWith("/api/review/")) {
    await admin(request, env);
    if (path === "/api/review/export" && request.method === "GET") {
      const after = u.searchParams.get("after") || "";
      if (after.length > 50) fail("cursor ไม่ถูกต้อง");
      const rows = await env.DB.prepare(
        "SELECT id,model_version,source,image_key,items,expected_count,predicted_count,status,reviewed_items,reviewed_count,created_at FROM analysis_feedback WHERE id>? ORDER BY id LIMIT 100",
      )
        .bind(after)
        .all();
      return json({
        reports: rows.results,
        next: rows.results.length === 100 ? rows.results.at(-1).id : null,
      });
    }
    if (path === "/api/review/image" && request.method === "GET") {
      const row = await env.DB.prepare(
        "SELECT image_key FROM analysis_feedback WHERE id=?",
      )
        .bind(u.searchParams.get("id") || "")
        .first();
      if (!row?.image_key) fail("ไม่มีภาพสำหรับตรวจทาน", 404);
      const image = await env.BUCKET.get(row.image_key);
      if (!image) fail("ไม่พบภาพ", 404);
      return new Response(image.body, {
        headers: {
          "content-type": "image/jpeg",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }
    if (path === "/api/review/decision" && request.method === "POST") {
      const d = await input(request, 16000);
      if (!["reviewed", "rejected"].includes(d.status))
        fail("สถานะตรวจทานไม่ถูกต้อง");
      const row = await env.DB.prepare(
        "SELECT items,image_key FROM analysis_feedback WHERE id=?",
      )
        .bind(d.id)
        .first();
      if (!row) fail("ไม่พบรายการ", 404);
      let reviewed = null,
        count = null;
      if (d.status === "reviewed") {
        if (
          !row.image_key ||
          !Array.isArray(d.objects) ||
          d.objects.length > 30 ||
          d.objects.some(
            (x) => !Object.hasOwn(OBJECT_NAMES, x.label) || !validBox(x.box),
          )
        )
          fail("การตรวจยืนยันต้องมีภาพและตำแหน่งวัตถุจริงที่ตรวจทานแล้ว");
        const used = new Set();
        let correct = 0;
        for (const p of JSON.parse(row.items)) {
          let best = -1,
            overlap = 0;
          d.objects.forEach((t, i) => {
            const value = iou(p.box, t.box);
            if (!used.has(i) && p.label === t.label && value > overlap) {
              overlap = value;
              best = i;
            }
          });
          if (overlap >= 0.5) {
            correct++;
            used.add(best);
          }
        }
        reviewed = JSON.stringify({
          objects: d.objects,
          correct,
          reviewedAt: Date.now(),
        });
        count = d.objects.length;
      }
      await env.DB.prepare(
        "UPDATE analysis_feedback SET status=?,reviewed_items=?,reviewed_count=? WHERE id=?",
      )
        .bind(d.status, reviewed, count, d.id)
        .run();
      return json({ saved: true });
    }
  }
  return null;
}
