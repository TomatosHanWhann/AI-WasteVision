// Owner-only export/review tool. No review interface or credentials are public.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const [command, destination] = process.argv.slice(2);
const origin =
  process.env.WASTEVISION_ORIGIN ||
  "https://ai-wastevision-th.tenderheron1024.chatgpt.site";
const secret = process.env.REVIEW_ADMIN_SECRET;
if (
  !["export", "dataset", "publish"].includes(command) ||
  !destination ||
  !secret ||
  secret.length < 32
)
  throw new Error(
    "Usage: REVIEW_ADMIN_SECRET=<owner secret> node scripts/review-feedback.mjs export|dataset <ignored directory> OR publish <review-decisions.json>",
  );
const base = new URL(origin);
if (base.protocol !== "https:" && base.hostname !== "127.0.0.1")
  throw new Error("HTTPS required");
async function request(path, body) {
  const r = await fetch(new URL(path, base), {
    headers: {
      authorization: "Bearer " + secret,
      ...(body
        ? {
            "content-type": "application/json",
            "x-wastevision-client": "web",
            origin: base.origin,
          }
        : {}),
    },
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r;
}
const pause = () => new Promise((r) => setTimeout(r, 2100));
if (command === "publish") {
  const decisions = JSON.parse(await readFile(resolve(destination), "utf8"));
  for (const d of decisions) {
    if (!["reviewed", "rejected"].includes(d.status)) continue;
    await request("/api/review/decision", d);
    await pause();
  }
  console.log(
    "Submitted explicit review decisions. No model training or deployment was started.",
  );
} else {
  const directory = resolve(destination);
  await mkdir(directory, { recursive: true });
  let after = "",
    reports = [];
  do {
    const page = await (
      await request("/api/review/export?after=" + encodeURIComponent(after))
    ).json();
    reports.push(...page.reports);
    after = page.next;
    await pause();
  } while (after);
  const images = [];
  for (const r of reports) {
    if (
      !/^[a-f0-9-]{36}$/.test(r.id) ||
      !r.image_key ||
      (command === "dataset" && r.status !== "reviewed")
    )
      continue;
    const file = r.id + ".jpg";
    const image = await request("/api/review/image?id=" + r.id);
    await writeFile(
      join(directory, file),
      new Uint8Array(await image.arrayBuffer()),
    );
    await pause();
    if (r.status === "reviewed")
      images.push({
        file_name: file,
        group: "reviewed:" + r.id,
        objects: JSON.parse(r.reviewed_items).objects,
      });
  }
  if (command === "export") {
    await writeFile(
      join(directory, "reports.json"),
      JSON.stringify(reports, null, 2),
    );
    await writeFile(
      join(directory, "review-decisions.json"),
      JSON.stringify(
        reports
          .filter((x) => x.status === "pending" && x.image_key)
          .map((x) => ({
            id: x.id,
            status: "pending",
            objects: JSON.parse(x.items).map((y) => ({
              label: y.label,
              box: y.box,
            })),
          })),
        null,
        2,
      ),
    );
    console.log(
      "Exported private review material. Inspect each image and correct every box/class before setting status=reviewed. Pending templates are not training labels.",
    );
  } else {
    await writeFile(
      join(directory, "annotations.json"),
      JSON.stringify({ reviewed_only: true, images }, null, 2),
    );
    console.log(
      `Exported ${images.length} reviewed images. Retraining is a separate explicit step.`,
    );
  }
}
