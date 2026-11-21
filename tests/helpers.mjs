import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { api } from "../worker/index.js";
import model from "../public/model/metadata.json" with { type: "json" };
export function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON;");
  for (const name of readdirSync(new URL("../drizzle/", import.meta.url))
    .filter((x) => x.endsWith(".sql"))
    .sort())
    sqlite.exec(
      readFileSync(new URL("../drizzle/" + name, import.meta.url), "utf8"),
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
  const images = new Map();
  const env = {
    REVIEW_ADMIN_SECRET: "test-admin-secret-at-least-thirty-two-characters",
    BUCKET: {
      async put(k, v) {
        images.set(k, v);
      },
      async delete(k) {
        images.delete(k);
      },
      async get(k) {
        return images.has(k) ? { body: images.get(k) } : null;
      },
    },
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
    extraHeaders = {},
  ) => {
    const headers = {
      origin,
      "x-wastevision-client": "web",
      "content-type": "application/json",
      ...extraHeaders,
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
  return { sqlite, call, scan, env, images };
}
