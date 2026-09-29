import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const src = join(root, "src");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await esbuild.build({
  entryPoints: [join(src, "background.ts"), join(src, "main.ts")],
  bundle: true,
  outdir: dist,
  format: "esm",
  target: ["chrome120"],
  platform: "browser",
  logLevel: "info",
});

cpSync(join(src, "app.html"), join(dist, "app.html"));
cpSync(join(src, "app.css"), join(dist, "app.css"));
cpSync(join(root, "manifest.json"), join(dist, "manifest.json"));

console.log("Built app/dist");
