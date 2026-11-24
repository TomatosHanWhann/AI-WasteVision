// Opt-in evaluation tool; never exposed to anonymous visitors or given card data.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { retrieveAdvice, buildMessages } from "../src/knowledge.js";
const [provider, destination] = process.argv.slice(2);
if (!["ollama", "openrouter"].includes(provider) || !destination)
  throw new Error(
    "Usage: node scripts/compare-llm.mjs ollama|openrouter tmp/llm-run.json",
  );
const output = resolve(destination);
const tmp = resolve("tmp") + "/";
if (!output.replaceAll("\\", "/").startsWith(tmp.replaceAll("\\", "/")))
  throw new Error(
    "Save raw generated responses under ignored tmp/ only; review before publishing",
  );
const model =
  process.env[provider === "ollama" ? "OLLAMA_MODEL" : "OPENROUTER_MODEL"];
if (!model)
  throw new Error(
    "Set the provider model environment variable explicitly; model availability and terms vary",
  );
if (provider === "openrouter" && !process.env.OPENROUTER_API_KEY)
  throw new Error("Set OPENROUTER_API_KEY in your environment");
const cases = JSON.parse(
  await readFile(new URL("../tests/retrieval-cases.json", import.meta.url)),
);
const results = [];
for (const c of cases) {
  const retrieval = retrieveAdvice(c.question);
  if (
    retrieval.abstained ||
    retrieval.sources.some((s) => ["battery", "bulb"].includes(s.id))
  ) {
    results.push({
      question: c.question,
      mode: "curated-fallback",
      answer: retrieval.answer,
    });
    continue;
  }
  const messages = buildMessages(c.question, retrieval),
    started = performance.now();
  const url =
    provider === "ollama"
      ? "http://127.0.0.1:11434/api/chat"
      : "https://openrouter.ai/api/v1/chat/completions";
  const body =
    provider === "ollama"
      ? {
          model,
          messages,
          stream: false,
          options: { temperature: 0, num_predict: 400 },
        }
      : { model, messages, stream: false, temperature: 0, max_tokens: 400 };
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    headers: {
      "content-type": "application/json",
      ...(provider === "openrouter"
        ? { authorization: "Bearer " + process.env.OPENROUTER_API_KEY }
        : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok)
    throw new Error("Provider failed with HTTP " + response.status);
  const r = await response.json();
  const answer =
    provider === "ollama"
      ? r.message?.content
      : r.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim())
    throw new Error("Provider returned no answer");
  results.push({
    question: c.question,
    expected: c.expected,
    sources: retrieval.sources.map((s) => s.id),
    answer,
    latency_ms: performance.now() - started,
    usage: r.usage || {
      input_tokens: r.prompt_eval_count,
      output_tokens: r.eval_count,
    },
    review: {
      supported_by_sources: null,
      correct_citations: null,
      appropriate_thai: null,
      reviewer: null,
    },
  });
}
await mkdir(resolve("tmp"), { recursive: true });
await writeFile(
  output,
  JSON.stringify(
    {
      provider,
      model,
      created_at: new Date().toISOString(),
      prompt_version: "grounded-thai-v1",
      note: "Raw model outputs, not approved advice. Human review required. No automatic quality or cost claims.",
      results,
    },
    null,
    2,
  ),
);
console.log("Saved comparison for human review: " + output);
