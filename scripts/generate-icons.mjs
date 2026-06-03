import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const source = path.join(root, "assets", "boodschap-icon-source.svg");

const outputs = [
  { file: "public/icons/favicon-16.png", size: 16 },
  { file: "public/icons/favicon-32.png", size: 32 },
  { file: "public/icons/apple-touch-icon.png", size: 180 },
  { file: "public/icons/icon-192.png", size: 192 },
  { file: "public/icons/icon-512.png", size: 512 },
  { file: "app/icon.png", size: 512 },
  { file: "app/apple-icon.png", size: 180 },
];

async function writeIcon(file, size) {
  const out = path.join(root, file);
  await mkdir(path.dirname(out), { recursive: true });
  await sharp(source)
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`Wrote ${file} (${size}x${size})`);
}

async function writeMaskable() {
  const size = 512;
  const inner = Math.round(size * 0.72);
  const out = path.join(root, "public/icons/icon-maskable-512.png");
  await sharp(source)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 45, g: 106, b: 79, alpha: 1 },
    })
    .extend({
      top: Math.floor((size - inner) / 2),
      bottom: Math.ceil((size - inner) / 2),
      left: Math.floor((size - inner) / 2),
      right: Math.ceil((size - inner) / 2),
      background: { r: 45, g: 106, b: 79, alpha: 1 },
    })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log("Wrote public/icons/icon-maskable-512.png");
}

await Promise.all(outputs.map(({ file, size }) => writeIcon(file, size)));
await writeMaskable();
console.log("Done.");
