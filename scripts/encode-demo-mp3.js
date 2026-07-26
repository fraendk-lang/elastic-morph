#!/usr/bin/env node
/* Encodes assets/demo/*.wav → MP3 for faster demo load (Launch Phase 1). */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEMO_DIR = path.join(ROOT, "assets", "demo");
const MANIFEST = path.join(DEMO_DIR, "demo.json");
const FFMPEG = path.join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg");
const force = process.argv.includes("--force");

if (!fs.existsSync(FFMPEG)) {
  console.error("ffmpeg-static missing — run: npm install");
  process.exit(1);
}

const wavs = fs.readdirSync(DEMO_DIR).filter(f => f.toLowerCase().endsWith(".wav"));
if (!wavs.length) {
  console.error("No WAV in assets/demo/");
  process.exit(1);
}

console.log("\nDemo MP3 encode\n");

for (const wav of wavs) {
  const mp3 = wav.replace(/\.wav$/i, ".mp3");
  const inPath = path.join(DEMO_DIR, wav);
  const outPath = path.join(DEMO_DIR, mp3);
  if (!force && fs.existsSync(outPath) && fs.statSync(outPath).mtimeMs >= fs.statSync(inPath).mtimeMs) {
    const sizeMb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
    console.log("Skip (aktuell):", mp3, sizeMb + " MB — --force zum Neuencodieren");
    continue;
  }
  console.log("Encoding", wav, "→", mp3);
  execFileSync(FFMPEG, [
    "-y", "-i", inPath,
    "-codec:a", "libmp3lame", "-b:a", "192k",
    outPath,
  ], { stdio: "inherit" });
  const sizeMb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log("✓", mp3, sizeMb + " MB");
}

if (fs.existsSync(MANIFEST)) {
  try {
    const meta = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    const files = meta.files || [];
    const mp3Names = wavs.map(w => w.replace(/\.wav$/i, ".mp3"));
    const wavNames = wavs;
    const other = files.filter(f => !mp3Names.includes(f) && !wavNames.includes(f));
    meta.files = [...mp3Names, ...wavNames, ...other];
    fs.writeFileSync(MANIFEST, JSON.stringify(meta, null, 2) + "\n");
    console.log("✓ demo.json — MP3 zuerst in files[]");
  } catch (e) {
    console.warn("demo.json nicht aktualisiert:", e.message);
  }
}

console.log("\nPrüfen: npm run check:demo\n");
