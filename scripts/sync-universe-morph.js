#!/usr/bin/env node
/* Sync built Elastic Morph → Elastic Universe public/morph/ (embed, MP3-only demo). */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEFAULT_UNIVERSE = path.join(ROOT, "..", "Claude Code Landingpage Elastic Field", "elastic-universe-landing");
const UNIVERSE_ROOT = process.env.UNIVERSE_ROOT || process.argv[2] || DEFAULT_UNIVERSE;
const MORPH_OUT = path.join(UNIVERSE_ROOT, "public", "morph");

const COPY_FILES = [
  "elastic-morph.html",
  "sw.js",
  "manifest.webmanifest",
];

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  const kb = (fs.statSync(dest).size / 1024).toFixed(0);
  console.log("  ✓", path.relative(UNIVERSE_ROOT, dest), `(${kb} KB)`);
}

console.log("\nSync Elastic Morph → Universe\n");
console.log("Ziel:", MORPH_OUT);

if (!fs.existsSync(UNIVERSE_ROOT)) {
  console.error("\nUniverse-Repo nicht gefunden:", UNIVERSE_ROOT);
  console.error("Setze UNIVERSE_ROOT=/pfad/zum/elastic-universe-landing\n");
  process.exit(1);
}

const html = path.join(ROOT, "elastic-morph.html");
if (!fs.readFileSync(html, "utf8").includes("initCreatorTextV110")) {
  console.error("\nelastic-morph.html ist nicht v110 — zuerst: npm run build\n");
  process.exit(1);
}

fs.mkdirSync(MORPH_OUT, { recursive: true });

console.log("\nApp:");
for (const f of COPY_FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) {
    console.warn("  ⚠ fehlt:", f);
    continue;
  }
  copyFile(src, path.join(MORPH_OUT, f));
}

console.log("\nDemo (MP3 only — kein WAV im Universe-Embed):");
const demoDir = path.join(MORPH_OUT, "assets", "demo");
fs.mkdirSync(demoDir, { recursive: true });

const manifestSrc = path.join(ROOT, "assets", "demo", "demo.json");
const meta = JSON.parse(fs.readFileSync(manifestSrc, "utf8"));
const mp3Files = (meta.files || []).filter(f => /\.mp3$/i.test(f));
if (!mp3Files.length) {
  console.error("  ✗ Keine MP3 in demo.json — npm run encode:demo");
  process.exit(1);
}
for (const f of mp3Files) {
  const src = path.join(ROOT, "assets", "demo", f);
  if (!fs.existsSync(src)) {
    console.error("  ✗ fehlt:", f);
    process.exit(1);
  }
  copyFile(src, path.join(demoDir, f));
}
const universeMeta = { ...meta, files: mp3Files, notes: (meta.notes || "") + " Universe embed: MP3 only." };
fs.writeFileSync(path.join(demoDir, "demo.json"), JSON.stringify(universeMeta, null, 2) + "\n");
console.log("  ✓ demo.json (MP3-only)");

const ver = (fs.readFileSync(path.join(ROOT, "sw.js"), "utf8").match(/elastic-morph-v(\d+)/) || [])[1] || "?";
console.log("\n✓ Universe Morph sync v" + ver + "\n");
