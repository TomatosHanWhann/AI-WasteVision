import { readFile, writeFile, mkdir } from "node:fs/promises";
import { retrieveAdvice } from "../src/knowledge.js";
const cases = JSON.parse(
  await readFile(new URL("../tests/retrieval-cases.json", import.meta.url)),
);
const results = cases.map((c) => {
  const start = performance.now();
  const r = retrieveAdvice(c.question);
  return {
    ...c,
    returned: r.sources.map((s) => s.id),
    abstained: r.abstained,
    latency_ms: performance.now() - start,
  };
});
const known = results.filter((r) => r.expected),
  unknown = results.filter((r) => !r.expected);
const rate = (a, test) => a.filter(test).length / a.length;
const report = {
  corpus_version: retrieveAdvice("กล่องนมล้างไหม").corpusVersion,
  cases: results.length,
  answerable_cases: known.length,
  unanswerable_cases: unknown.length,
  hit_at_1: rate(known, (r) => r.returned[0] === r.expected),
  hit_at_3: rate(known, (r) => r.returned.includes(r.expected)),
  abstention_accuracy: rate(unknown, (r) => r.abstained),
  false_abstention_rate: rate(known, (r) => r.abstained),
  retrieval_p95_ms: results.map((r) => r.latency_ms).sort((a, b) => a - b)[
    Math.ceil(results.length * 0.95) - 1
  ],
  limitations: [
    "Small developer-authored regression set, not independent field evaluation.",
    "Retrieval hit is not answer correctness, LLM accuracy, safety validation or user satisfaction.",
    "Threshold and vocabulary were designed for this curated corpus; no claim of unseen-question generalisation.",
  ],
  results,
};
await mkdir(new URL("../ml/results/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../ml/results/retrieval-evaluation.json", import.meta.url),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
