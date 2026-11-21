export function normalizePhone(value) {
  if (typeof value !== "string" || value.length > 30)
    throw new Error("กรุณาระบุหมายเลขโทรศัพท์มือถือให้ถูกต้อง");
  let phone = value.replace(/[\s()-]/g, "");
  if (phone.startsWith("+66")) phone = "0" + phone.slice(3);
  if (!/^0[689]\d{8}$/.test(phone))
    throw new Error("กรุณาระบุหมายเลขโทรศัพท์มือถือไทย 10 หลัก");
  return phone;
}
export function cardSummary(total, suffix, recent = []) {
  if (!Number.isSafeInteger(total) || total < 0)
    throw new Error("Invalid points");
  return {
    total,
    points: total,
    goal: 1000,
    grade: total >= 1000 ? "A" : null,
    remaining: Math.max(0, 1000 - total),
    progress: Math.min(100, total / 10),
    phoneMasked: "0••-•••-" + suffix,
    recent,
  };
}
export async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function signTicket(secret, data) {
  const payload = btoa(JSON.stringify(data))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  return payload + "." + (await hmac(secret, "ticket:" + payload));
}
export async function verifyTicket(secret, ticket, member, now = Date.now()) {
  if (typeof ticket !== "string" || ticket.length > 1600)
    throw new Error("รายการวิเคราะห์ไม่ถูกต้อง");
  const [payload, signature, ...extra] = ticket.split(".");
  const expected = await hmac(secret, "ticket:" + payload);
  let diff = expected.length ^ (signature?.length || 0);
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ (signature?.charCodeAt(i) || 0);
  if (diff || extra.length) throw new Error("รายการวิเคราะห์ไม่ถูกต้อง");
  let data;
  try {
    data = JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/")));
  } catch {
    throw new Error("รายการวิเคราะห์ไม่ถูกต้อง");
  }
  if (
    data.member !== member ||
    !Number.isFinite(data.expires) ||
    data.expires < now ||
    data.expires > now + 11 * 60 * 1000
  )
    throw new Error("รายการหมดอายุ กรุณาวิเคราะห์ภาพอีกครั้ง");
  return data;
}
