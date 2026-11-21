import * as ort from "onnxruntime-web/wasm";
import { decision } from "./domain.js";
let session, metadata, loading;
const base = import.meta.env.BASE_URL;
ort.env.wasm.wasmPaths = new URL(base + "ort/", location.href).href;
ort.env.wasm.numThreads = 1;
export async function loadModel() {
  if (session) return metadata;
  if (!loading)
    loading = (async () => {
      const response = await fetch(base + "model/metadata.json");
      if (!response.ok) throw new Error("โหลดข้อมูลโมเดลไม่ได้");
      metadata = await response.json();
      session = await ort.InferenceSession.create(
        base + "model/wastevision.onnx",
        { executionProviders: ["wasm"], graphOptimizationLevel: "all" },
      );
      return metadata;
    })().catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}
export function imageTensor(source) {
  const w = source.videoWidth || source.naturalWidth || source.width,
    h = source.videoHeight || source.naturalHeight || source.height;
  if (!w || !h) throw new Error("ภาพยังไม่พร้อม");
  const side = Math.min(w, h),
    canvas = document.createElement("canvas");
  canvas.width = 224;
  canvas.height = 224;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 224, 224);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "low";
  ctx.drawImage(
    source,
    Math.floor((w - side) / 2),
    Math.floor((h - side) / 2),
    side,
    side,
    0,
    0,
    224,
    224,
  );
  const data = ctx.getImageData(0, 0, 224, 224).data,
    out = new Float32Array(3 * 224 * 224);
  const mean = [0.485, 0.456, 0.406],
    std = [0.229, 0.224, 0.225];
  for (let c = 0; c < 3; c++)
    for (let i = 0; i < 224 * 224; i++)
      out[c * 224 * 224 + i] = (data[i * 4 + c] / 255 - mean[c]) / std[c];
  return new ort.Tensor("float32", out, [1, 3, 224, 224]);
}
export async function predict(source) {
  await loadModel();
  const start = performance.now(),
    tensor = imageTensor(source);
  const result = await session.run({ image: tensor });
  try {
    return {
      ...decision(Array.from(result.probabilities.data), metadata.threshold),
      latency: Math.round(performance.now() - start),
      version: metadata.model_version,
      threshold: metadata.threshold,
    };
  } finally {
    tensor.dispose();
    Object.values(result).forEach((x) => x.dispose());
  }
}
