import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

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

const iconSizes = [16, 32, 64, 128];
const iconsDir = join(dist, "icons");
mkdirSync(iconsDir, { recursive: true });
const logo = join(root, "..", "assets", "logo.png");
const trimmed = await sharp(logo).trim({ threshold: 12 }).png().toBuffer();
for (const size of iconSizes) {
  await sharp(trimmed)
    .resize(size, size, { fit: "fill" })
    .png()
    .toFile(join(iconsDir, `icon-${size}.png`));
}

console.log("Built app/dist");
