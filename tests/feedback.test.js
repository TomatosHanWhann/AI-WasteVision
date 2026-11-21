import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import detector from "../public/model/detector-metadata.json" with { type: "json" };
const data = (extra = {}) => ({
  consent: true,
  source: "upload",
  modelVersion: detector.model_version,
  imageDigest: "e".repeat(64),
  expectedCount: 2,
  items: [
    {
      id: 1,
      label: "plastic",
      truth: "plastic",
      box: [0.1, 0.1, 0.4, 0.4],
      confidence: 0.75,
    },
    {
      id: 2,
      label: "metal",
      truth: "battery",
      box: [0.6, 0.6, 0.9, 0.9],
      confidence: 0.8,
    },
  ],
  ...extra,
});
test("rejected feedback is excluded from public statistics and oversized bodies are bounded", async () => {
  const { call, sqlite, env } = fixture();
  try {
    assert.equal(
      (await call("feedback", data({ padding: "x".repeat(751000) }))).status,
      413,
    );
    const saved = await call("feedback", data());
    assert.equal(saved.status, 200);
    const result = await call(
      "review/decision",
      { id: saved.data.id, status: "rejected" },
      "",
      undefined,
      { authorization: "Bearer " + env.REVIEW_ADMIN_SECRET },
    );
    assert.equal(result.status, 200);
    assert.equal((await call("quality")).data.versions.length, 0);
  } finally {
    sqlite.close();
  }
});
test("feedback requires explicit consent; reported accuracy remains separate from reviewed evidence", async () => {
  const { call, sqlite } = fixture();
  try {
    assert.equal(
      (await call("feedback", data({ consent: false }))).status,
      400,
    );
    assert.equal(
      (await call("feedback", data({ source: "example" }))).status,
      400,
    );
    assert.equal(
      (
        await call(
          "feedback",
          data({ items: [...data().items, { ...data().items[0] }] }),
        )
      ).status,
      400,
    );
    const saved = await call("feedback", data());
    assert.equal(saved.status, 200);
    assert.equal((await call("feedback", data())).status, 409);
    const q = await call("quality");
    assert.equal(q.data.versions[0].user_correct, 1);
    assert.equal(q.data.versions[0].predictions, 2);
    assert.equal(q.data.versions[0].reviewed_submissions, 0);
    assert.equal((await call("review/export")).status, 403);
    assert.equal(
      (
        await call("feedback/delete", {
          id: saved.data.id,
          deleteToken: "wrong",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("feedback/delete", {
          id: saved.data.id,
          deleteToken: saved.data.deleteToken,
        })
      ).status,
      200,
    );
    assert.equal((await call("quality")).data.versions.length, 0);
  } finally {
    sqlite.close();
  }
});
test("images require separate consent and review needs an actual image and corrected boxes", async () => {
  const { call, sqlite, images, env } = fixture();
  try {
    const image = "data:image/jpeg;base64,/9j/2Q==";
    assert.equal(
      (await call("feedback", data({ image, imageConsent: false }))).status,
      400,
    );
    const saved = await call("feedback", data({ image, imageConsent: true }));
    assert.equal(saved.status, 200);
    assert.equal(images.size, 1);
    const headers = { authorization: "Bearer " + env.REVIEW_ADMIN_SECRET };
    assert.equal(
      (
        await call(
          "review/decision",
          {
            id: saved.data.id,
            status: "reviewed",
            objects: [
              { label: "plastic", box: [0.1, 0.1, 0.4, 0.4] },
              { label: "battery", box: [0.6, 0.6, 0.9, 0.9] },
            ],
          },
          "",
          undefined,
          headers,
        )
      ).status,
      200,
    );
    const q = (await call("quality")).data.versions[0];
    assert.equal(q.reviewed_correct, 1);
    assert.equal(q.reviewed_truth, 2);
    assert.equal(q.reviewed_predictions, 2);
    const exported = await call(
      "review/export",
      undefined,
      "",
      undefined,
      headers,
    );
    assert.equal(exported.data.reports[0].status, "reviewed");
    assert.equal(exported.data.reports[0].delete_key, undefined);
    await call("feedback/delete", {
      id: saved.data.id,
      deleteToken: saved.data.deleteToken,
    });
    assert.equal(images.size, 0);
  } finally {
    sqlite.close();
  }
});
test("multi-object points allow separate confirmed items and block battery claims", async () => {
  const { call, sqlite } = fixture();
  try {
    const card = await call("card", { phone: "0990000000", consent: true });
    const scan = {
      mode: "multiple",
      source: "upload",
      label: "battery",
      confidence: 1,
      modelVersion: detector.model_version,
      imageDigest: "f".repeat(64),
    };
    assert.equal((await call("scan-ticket", scan, card.cookie)).status, 400);
    for (const [i, label] of ["plastic", "metal"].entries()) {
      const ticket = await call(
        "scan-ticket",
        { ...scan, label, imageDigest: String(i + 1).repeat(64) },
        card.cookie,
      );
      assert.equal(ticket.status, 200);
      const p = await call(
        "points",
        { ticket: ticket.data.ticket, confirm: true, condition: "clean" },
        card.cookie,
      );
      assert.equal(p.data.total, i + 1);
    }
  } finally {
    sqlite.close();
  }
});
