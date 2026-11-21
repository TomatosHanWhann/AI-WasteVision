import { mkdir, copyFile, readdir } from "node:fs/promises";
const from = new URL("../node_modules/onnxruntime-web/dist/", import.meta.url);
const to = new URL("../public/ort/", import.meta.url);
await mkdir(to, { recursive: true });
const licenses = new URL("../public/licenses/", import.meta.url);
await mkdir(licenses, { recursive: true });
for (const [source, name] of [
  ["@fontsource/noto-sans-thai/LICENSE", "noto-sans-thai-OFL.txt"],
  ["lucide/LICENSE", "lucide-ISC.txt"],
  ["qrcode/license", "qrcode-MIT.txt"],
]) {
  await copyFile(
    new URL("../node_modules/" + source, import.meta.url),
    new URL(name, licenses),
  );
}
for (const name of await readdir(from)) {
  if (/^ort-wasm-simd-threaded\.(mjs|wasm)$/.test(name))
    await copyFile(new URL(name, from), new URL(name, to));
}
