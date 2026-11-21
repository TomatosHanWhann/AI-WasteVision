import model from "../public/model/metadata.json" with { type: "json" };
import {
  normalizePhone,
  cardSummary,
  hmac,
  signTicket,
  verifyTicket,
} from "./rules.js";
const COOKIE = "wv_card";
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json;charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });
const cookie = (value, secure, maxAge = 604800) =>
  `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
async function input(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError("รูปแบบข้อมูลไม่ถูกต้อง", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("ไม่มีข้อมูลสำหรับดำเนินรายการ");
  let raw = "",
    size = 0;
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      throw new ApiError("ข้อมูลมีขนาดเกินกำหนด", 413);
    }
    raw += decoder.decode(value, { stream: true });
  }
  raw += decoder.decode();
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError("รูปแบบข้อมูลไม่ถูกต้อง");
  }
}
async function readCard(db, id) {
  const member = await db
    .prepare("SELECT suffix FROM members WHERE id=?")
    .bind(id)
    .first();
  const count = await db
    .prepare("SELECT COUNT(*) AS n FROM sorting_events WHERE member_id=?")
    .bind(id)
    .first();
  const recent = await db
    .prepare(
      "SELECT material,created_at FROM sorting_events WHERE member_id=? ORDER BY created_at DESC LIMIT 5",
    )
    .bind(id)
    .all();
  return cardSummary(Number(count.n), member.suffix, recent.results);
}
async function session(request, env) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new ApiError("กรุณาระบุหมายเลขโทรศัพท์เพื่อเปิดบัตรสะสม", 401);
  const id = await hmac(env.PHONE_HASH_SECRET, "session:" + token);
  const row = await env.DB.prepare(
    "SELECT member_id FROM card_sessions WHERE id=? AND expires_at>?",
  )
    .bind(id, Date.now())
    .first();
  if (!row)
    throw new ApiError("หมดเวลาการใช้งาน กรุณาเปิดบัตรสะสมอีกครั้ง", 401);
  return { id, member: row.member_id };
}
export async function api(request, env) {
  const url = new URL(request.url);
  const now = Date.now();
  if (
    !env.DB ||
    typeof env.PHONE_HASH_SECRET !== "string" ||
    env.PHONE_HASH_SECRET.length < 32
  )
    return json(
      { error: "ระบบบัตรสะสมยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง" },
      503,
    );
  try {
    if (!["GET", "POST"].includes(request.method))
      throw new ApiError("วิธีส่งข้อมูลไม่ถูกต้อง", 405);
    if (
      request.method === "POST" &&
      (request.headers.get("origin") !== url.origin ||
        request.headers.get("x-wastevision-client") !== "web" ||
        request.headers.get("sec-fetch-site") === "cross-site")
    )
      throw new ApiError("ไม่สามารถดำเนินรายการจากแหล่งที่มานี้", 403);
    // Raw IP and raw phone are never persisted or logged.
    const bucket = Math.floor(now / 60000);
    const ip = request.headers.get("cf-connecting-ip") || "local";
    const limitKey = await hmac(env.PHONE_HASH_SECRET, `rate:${ip}:${bucket}`);
    const limit = await env.DB.prepare(
      "INSERT INTO request_limits(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count",
    )
      .bind(limitKey, now + 120000)
      .first();
    if (limit.count > 40)
      throw new ApiError(
        "มีรายการต่อเนื่องจำนวนมาก กรุณารอหนึ่งนาทีแล้วลองใหม่",
        429,
      );
    if (url.pathname === "/api/card" && request.method === "POST") {
      const data = await input(request);
      if (data.consent !== true)
        throw new ApiError("กรุณายืนยันการใช้หมายเลขโทรศัพท์สำหรับบัตรสะสม");
      const phone = normalizePhone(data.phone);
      const member = await hmac(env.PHONE_HASH_SECRET, "phone:" + phone);
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO members(id,suffix,created_at) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING",
        ).bind(member, phone.slice(-4), now),
        env.DB.prepare(
          "INSERT INTO card_sessions(id,member_id,expires_at) VALUES(?,?,?)",
        ).bind(
          await hmac(env.PHONE_HASH_SECRET, "session:" + token),
          member,
          now + 604800000,
        ),
        env.DB.prepare("DELETE FROM card_sessions WHERE expires_at<?").bind(
          now,
        ),
        env.DB.prepare("DELETE FROM request_limits WHERE expires_at<?").bind(
          now,
        ),
      ]);
      return json(await readCard(env.DB, member), 200, {
        "set-cookie": cookie(token, url.protocol === "https:"),
      });
    }
    if (url.pathname === "/api/card" && request.method === "GET") {
      const s = await session(request, env);
      return json(await readCard(env.DB, s.member));
    }
    if (url.pathname === "/api/card/close" && request.method === "POST") {
      const s = await session(request, env);
      await env.DB.prepare("DELETE FROM card_sessions WHERE id=?")
        .bind(s.id)
        .run();
      return json({ closed: true }, 200, {
        "set-cookie": cookie("", url.protocol === "https:", 0),
      });
    }
    if (url.pathname === "/api/scan-ticket" && request.method === "POST") {
      const s = await session(request, env),
        data = await input(request);
      if (
        !["camera", "upload"].includes(data.source) ||
        !model.labels.includes(data.label) ||
        !Number.isFinite(data.confidence) ||
        data.confidence < model.threshold ||
        data.confidence > 1 ||
        data.modelVersion !== model.model_version ||
        !/^[a-f0-9]{64}$/.test(data.imageDigest || "")
      )
        throw new ApiError(
          "รายการนี้ไม่เข้าเงื่อนไขสะสมแต้ม กรุณาใช้ภาพของท่านและผลที่ระบบจำแนกได้",
        );
      const ticket = await signTicket(env.PHONE_HASH_SECRET, {
        id: crypto.randomUUID(),
        member: s.member,
        image: data.imageDigest,
        label: data.label,
        version: model.model_version,
        expires: now + 600000,
      });
      return json({ ticket });
    }
    if (url.pathname === "/api/points" && request.method === "POST") {
      const s = await session(request, env),
        data = await input(request);
      if (data.confirm !== true || !["clean", "dirty"].includes(data.condition))
        throw new ApiError("กรุณายืนยันการคัดแยกและระบุสภาพวัสดุ");
      const t = await verifyTicket(
        env.PHONE_HASH_SECRET,
        data.ticket,
        s.member,
        now,
      );
      if (
        !model.labels.includes(t.label) ||
        !/^[a-f0-9]{64}$/.test(t.image || "") ||
        t.version !== model.model_version
      )
        throw new ApiError("รายการวิเคราะห์ไม่ถูกต้อง");
      const start = new Date(now);
      start.setUTCHours(0, 0, 0, 0);
      const statement = env.DB.prepare(
        "INSERT INTO sorting_events(id,member_id,image_digest,material,condition,model_version,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM sorting_events WHERE member_id=? AND created_at>=?)<100 ON CONFLICT DO NOTHING",
      ).bind(
        t.id,
        s.member,
        t.image,
        t.label,
        data.condition,
        t.version,
        now,
        s.member,
        start.getTime(),
      );
      const insert = await statement.run();
      if (!insert.meta.changes) {
        const duplicate = await env.DB.prepare(
          "SELECT id FROM sorting_events WHERE member_id=? AND image_digest=?",
        )
          .bind(s.member, t.image)
          .first();
        throw new ApiError(
          duplicate
            ? "ภาพนี้ได้รับแต้มแล้ว ไม่สามารถสะสมซ้ำได้"
            : "ครบจำนวนรายการต่อวัน กรุณากลับมาใช้งานในวันถัดไป",
          409,
        );
      }
      return json({ ...(await readCard(env.DB, s.member)), awarded: 1 });
    }
    return json({ error: "ไม่พบรายการที่ร้องขอ" }, 404);
  } catch (e) {
    return json(
      {
        error:
          e instanceof ApiError ||
          e.message?.startsWith("กรุณา") ||
          e.message?.startsWith("รายการ")
            ? e.message
            : "ไม่สามารถดำเนินรายการได้ กรุณาลองใหม่",
      },
      e.status || 400,
    );
  }
}
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith("/api/"))
      return api(request, env);
    return env.ASSETS.fetch(request);
  },
};
