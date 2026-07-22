#!/usr/bin/env node
/* Encodes assets/demo/*.wav → MP3 for faster demo load (Launch Phase 1). */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEMO_DIR = path.join(ROOT, "assets", "demo");
const FFMPEG = path.join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg");

if (!fs.existsSync(FFMPEG)) {
  console.error("ffmpeg-static missing — run: npm install ffmpeg-static --save-dev");
  process.exit(1);
}

const wavs = fs.readdirSync(DEMO_DIR).filter(f => f.toLowerCase().endsWith(".wav"));
if (!wavs.length) {
  console.error("No WAV in assets/demo/");
  process.exit(1);
}

for (const wav of wavs) {
  const mp3 = wav.replace(/\.wav$/i, ".mp3");
  const inPath = path.join(DEMO_DIR, wav);
  const outPath = path.join(DEMO_DIR, mp3);
  console.log("Encoding", wav, "→", mp3);
  execFileSync(FFMPEG, [
    "-y", "-i", inPath,
    "-codec:a", "libmp3lame", "-b:a", "192k",
    outPath,
  ], { stdio: "inherit" });
  const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log("✓", mp3, mb + " MB");
}
