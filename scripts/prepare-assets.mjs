import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

// Optimize generated presentation assets, without modifying the official logo/reference.
const source = process.argv[2];
if (!source)
  throw new Error("Pass the generated image directory as the first argument.");
const assets = {
  hero: "exec-2db4e23a-ef86-4813-a602-ed0977afb617.png",
  case: "exec-72d0b39e-fe2c-4905-af95-8e6556fe0b43.png",
  bag: "exec-e53c5d3a-0cba-410d-9227-ef093ba30d44.png",
  tray: "exec-1bd93495-14bb-4f58-93a0-ad29f8132f0a.png",
  organizer: "exec-6757ea1a-e53a-43e6-81a7-ce3ab38747e8.png",
  kit: "exec-b41e9921-28b4-4682-ad19-52d7edc3657b.png",
};
await mkdir("public/products", { recursive: true });
for (const [name, file] of Object.entries(assets)) {
  await sharp(path.join(source, file))
    .resize({ width: name === "hero" ? 1536 : 800, withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(`public/products/${name}.webp`);
}
const aliases = {
  "case-grafite": "case",
  "bag-compact": "bag",
  "tray-pocket": "tray",
  "organizer-essential": "organizer",
  "kit-urban": "hero",
};
for (const [name, base] of Object.entries(aliases)) {
  await sharp(`public/products/${base}.webp`)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(`public/products/${name}.webp`);
}
console.log("Prepared 11 local WebP presentation assets.");
