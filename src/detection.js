import * as ort from "onnxruntime-web/wasm";
import {
  suppress,
  calibratedScore,
  roundConfidence,
} from "./detection-domain.js";
let session, metadata, pending;
const base = import.meta.env.BASE_URL;
ort.env.wasm.wasmPaths = new URL(base + "ort/", location.href).href;
ort.env.wasm.numThreads = 1;
export async function loadDetector() {
  if (session) return metadata;
  if (!pending)
    pending = (async () => {
      const r = await fetch(base + "model/detector-metadata.json");
      if (!r.ok) throw new Error("ไม่สามารถอ่านข้อมูลโมเดลตรวจจับ");
      metadata = await r.json();
      session = await ort.InferenceSession.create(
        base + "model/detector.onnx",
        { executionProviders: ["wasm"], graphOptimizationLevel: "all" },
      );
      return metadata;
    })().catch((e) => {
      pending = null;
      throw e;
    });
  return pending;
}
export async function detect(source) {
  await loadDetector();
  const start = performance.now();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 320;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, 320, 320);
  const rgba = ctx.getImageData(0, 0, 320, 320).data;
  const floats = new Float32Array(3 * 320 * 320);
  for (let c = 0; c < 3; c++)
    for (let i = 0; i < 320 * 320; i++)
      floats[c * 320 * 320 + i] = rgba[i * 4 + c] / 127.5 - 1;
  const tensor = new ort.Tensor("float32", floats, [1, 3, 320, 320]);
  let output;
  try {
    output = await session.run({ image: tensor });
    const boxes = output.boxes.data,
      probs = output.probabilities.data,
      classes = metadata.labels.length + 1,
      candidates = [];
    for (let i = 0; i < boxes.length / 4; i++) {
      let top = 1;
      for (let c = 2; c < classes; c++)
        if (probs[i * classes + c] > probs[i * classes + top]) top = c;
      const rawConfidence = probs[i * classes + top];
      if (rawConfidence >= metadata.threshold)
        candidates.push({
          label: metadata.labels[top - 1],
          rawConfidence,
          box: Array.from(boxes.slice(i * 4, i * 4 + 4)),
        });
    }
    candidates.sort((a, b) => b.rawConfidence - a.rawConfidence);
    const all = suppress(
      candidates.slice(0, metadata.raw_candidate_limit),
      metadata.nms_iou,
      30,
    );
    const objects = all.slice(0, 10).map((x, i) => ({
      ...x,
      id: i + 1,
      confidence: calibratedScore(x.rawConfidence, metadata.calibration),
    }));
    return {
      objects,
      confidence: roundConfidence(objects),
      truncated: all.length > 10,
      latency: Math.round(performance.now() - start),
      version: metadata.model_version,
      mode: "multiple",
    };
  } finally {
    tensor.dispose();
    if (output) Object.values(output).forEach((x) => x.dispose());
  }
}

export async function imageDigest(source) {
  const c = document.createElement("canvas");
  c.width = c.height = 320;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, 320, 320);
  const bytes = ctx.getImageData(0, 0, 320, 320).data;
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
