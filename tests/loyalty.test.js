import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhone,
  cardSummary,
  hmac,
  signTicket,
  verifyTicket,
} from "../worker/rules.js";
test("Thai phone normalization has a single account key and rejects non-phone input", () => {
  assert.equal(normalizePhone("+66 81 234 5678"), "0812345678");
  assert.equal(normalizePhone("081-234-5678"), "0812345678");
  for (const value of [
    "0012345678",
    "081234567",
    "<script>",
    "081234567890",
    null,
  ])
    assert.throws(() => normalizePhone(value));
});
test("A grade starts at exactly 1000 confirmed items and progress never overflows", () => {
  assert.equal(cardSummary(999, "0000").grade, null);
  assert.equal(cardSummary(1000, "0000").grade, "A");
  assert.equal(cardSummary(1001, "0000").progress, 100);
  assert.equal(cardSummary(1000, "0000").remaining, 0);
});
test("phone digests are stable only for the same server secret", async () => {
  const a = await hmac("secret-one", "phone:0812345678");
  assert.equal(a, await hmac("secret-one", "phone:0812345678"));
  assert.notEqual(a, await hmac("secret-two", "phone:0812345678"));
  assert.ok(!a.includes("0812345678"));
});
test("scan tickets cannot move to another member, change material, or survive expiry", async () => {
  const secret = "test-secret",
    expires = Date.now() + 60000;
  const token = await signTicket(secret, {
    member: "member-a",
    expires,
    label: "plastic",
  });
  assert.equal(
    (await verifyTicket(secret, token, "member-a")).label,
    "plastic",
  );
  await assert.rejects(() => verifyTicket(secret, token, "member-b"));
  await assert.rejects(() => verifyTicket(secret, token + "x", "member-a"));
  await assert.rejects(() =>
    verifyTicket(secret, token, "member-a", expires + 1),
  );
});
