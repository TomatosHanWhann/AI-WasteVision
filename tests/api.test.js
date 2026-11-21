import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { api } from "../worker/index.js";
import model from "../public/model/metadata.json" with { type: "json" };

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON;");
  sqlite.exec(
    readFileSync(
      new URL("../drizzle/0000_solid_cerise.sql", import.meta.url),
      "utf8",
    ),
  );
  const wrap = (sql, values = []) => ({
    bind: (...args) => wrap(sql, args),
    async first() {
      return sqlite.prepare(sql).get(...values) || null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...values) };
    },
    async run() {
      const result = sqlite.prepare(sql).run(...values);
      return { meta: { changes: Number(result.changes) } };
    },
  });
  const env = {
    PHONE_HASH_SECRET: "test-only-secret-at-least-thirty-two-characters",
    DB: {
      prepare: (sql) => wrap(sql),
      async batch(queries) {
        sqlite.exec("BEGIN");
        try {
          const values = [];
          for (const q of queries) values.push(await q.run());
          sqlite.exec("COMMIT");
          return values;
        } catch (e) {
          sqlite.exec("ROLLBACK");
          throw e;
        }
      },
    },
  };
  const call = async (
    path,
    body,
    cookie = "",
    origin = "https://wastevision.test",
  ) => {
    const headers = {
      origin,
      "x-wastevision-client": "web",
      "content-type": "application/json",
    };
    if (cookie) headers.cookie = cookie;
    const response = await api(
      new Request("https://wastevision.test/api/" + path, {
        method: body ? "POST" : "GET",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
      cookieHeader: response.headers.get("set-cookie"),
    };
  };
  const scan = (image = "a".repeat(64)) => ({
    source: "upload",
    label: "plastic",
    confidence: 1,
    modelVersion: model.model_version,
    imageDigest: image,
  });
  return { sqlite, call, scan };
}
test("API persists the same card across sessions and awards one item exactly once", async () => {
  const { sqlite, call, scan } = fixture();
  try {
    assert.equal((await call("card")).status, 401);
    assert.equal(
      (await call("card", { phone: "0990000000", consent: false })).status,
      400,
    );
    assert.equal(
      (
        await call(
          "card",
          { phone: "0990000000", consent: true },
          "",
          "https://other.test",
        )
      ).status,
      403,
    );
    const opened = await call("card", { phone: "0990000000", consent: true });
    assert.equal(opened.status, 200);
    assert.equal(opened.data.total, 0);
    assert.match(opened.cookieHeader, /HttpOnly; SameSite=Strict/);
    assert.match(opened.cookieHeader, /Secure/);
    const cookie = opened.cookie;
    assert.equal(
      (await call("scan-ticket", { ...scan(), source: "example" }, cookie))
        .status,
      400,
    );
    assert.equal(
      (await call("scan-ticket", { ...scan(), label: "unknown" }, cookie))
        .status,
      400,
    );
    const ticket = (await call("scan-ticket", scan(), cookie)).data.ticket;
    const point = await call(
      "points",
      { ticket, condition: "clean", confirm: true },
      cookie,
    );
    assert.equal(point.status, 200);
    assert.equal(point.data.total, 1);
    assert.equal(
      (
        await call(
          "points",
          { ticket, condition: "clean", confirm: true },
          cookie,
        )
      ).status,
      409,
    );
    const duplicate = (await call("scan-ticket", scan(), cookie)).data.ticket;
    assert.equal(
      (
        await call(
          "points",
          { ticket: duplicate, condition: "dirty", confirm: true },
          cookie,
        )
      ).status,
      409,
    );
    const again = await call("card", {
      phone: "+66 99 000 0000",
      consent: true,
    });
    assert.equal(again.data.total, 1);
    assert.equal(again.data.phoneMasked, "0••-•••-0000");
    const stored = sqlite.prepare("SELECT * FROM members").all();
    assert.equal(stored.length, 1);
    assert.ok(!JSON.stringify(stored).includes("0990000000"));
    await call("card/close", {}, cookie);
    assert.equal((await call("card", undefined, cookie)).status, 401);
  } finally {
    sqlite.close();
  }
});
test("API blocks cross-card tickets and awards grade A at exactly 1000", async () => {
  const { sqlite, call, scan } = fixture();
  try {
    const first = await call("card", { phone: "0990000000", consent: true });
    const second = await call("card", { phone: "0990000001", consent: true });
    const ticket = (await call("scan-ticket", scan(), first.cookie)).data
      .ticket;
    assert.equal(
      (
        await call(
          "points",
          { ticket, condition: "clean", confirm: true },
          second.cookie,
        )
      ).status,
      400,
    );
    const member = sqlite
      .prepare("SELECT id FROM members WHERE suffix=?")
      .get("0000").id;
    const insert = sqlite.prepare(
      "INSERT INTO sorting_events VALUES(?,?,?,?,?,?,?)",
    );
    sqlite.exec("BEGIN");
    for (let i = 0; i < 999; i++)
      insert.run(
        "fixture-" + i,
        member,
        "fixture-image-" + i,
        "plastic",
        "clean",
        model.model_version,
        Date.now() - 172800000,
      );
    sqlite.exec("COMMIT");
    const earned = await call(
      "points",
      { ticket, condition: "clean", confirm: true },
      first.cookie,
    );
    assert.equal(earned.data.total, 1000);
    assert.equal(earned.data.grade, "A");
    assert.equal(earned.data.remaining, 0);
    const before = sqlite
      .prepare("SELECT COUNT(*) AS n FROM sorting_events")
      .get().n;
    assert.equal(
      (
        await call(
          "points",
          { ticket, condition: "hazardous", confirm: true },
          first.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS n FROM sorting_events").get().n,
      before,
    );
  } finally {
    sqlite.close();
  }
});
test("API applies the per-day item limit without overwriting earlier points", async () => {
  const { sqlite, call, scan } = fixture();
  try {
    const opened = await call("card", { phone: "0990000000", consent: true });
    const member = sqlite.prepare("SELECT id FROM members").get().id;
    const insert = sqlite.prepare(
      "INSERT INTO sorting_events VALUES(?,?,?,?,?,?,?)",
    );
    for (let i = 0; i < 100; i++)
      insert.run(
        "day-" + i,
        member,
        "day-image-" + i,
        "glass",
        "clean",
        model.model_version,
        Date.now(),
      );
    const ticket = (await call("scan-ticket", scan(), opened.cookie)).data
      .ticket;
    assert.equal(
      (
        await call(
          "points",
          { ticket, condition: "clean", confirm: true },
          opened.cookie,
        )
      ).status,
      409,
    );
    assert.equal(
      (await call("card", undefined, opened.cookie)).data.total,
      100,
    );
  } finally {
    sqlite.close();
  }
});
