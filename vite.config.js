import "./scripts/tool-environment.mjs";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { mkdir, cp, rm } from "node:fs/promises";
export default defineConfig({
  base: "/",
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: { main: "index.html", presentation: "presentation.html" },
        },
      },
    },
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: "server" }, inspectorPort: false }),
    {
      name: "sites-metadata",
      async closeBundle() {
        await rm("dist/server/.dev.vars", { force: true });
        await mkdir("dist/.openai", { recursive: true });
        await cp(".openai/hosting.json", "dist/.openai/hosting.json");
        await cp("drizzle", "dist/.openai/drizzle", { recursive: true });
      },
    },
  ],
  build: { target: "es2022" },
  optimizeDeps: { exclude: ["onnxruntime-web"] },
});
