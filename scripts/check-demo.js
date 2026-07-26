#!/usr/bin/env node
/* Launch Phase 1 — prüft Demo-Track + MP3-Pipeline (schneller Load) */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEMO_DIR = path.join(ROOT, "assets", "demo");
const MANIFEST = path.join(DEMO_DIR, "demo.json");
const MP3_TARGET_MB = 6;
const MP3_WARN_MB = 8;

let ok = true;
const say = (good, msg) => {
  console.log((good ? "  ✓ " : "  ✗ ") + msg);
  if (!good) ok = false;
};
const hint = msg => console.log("  → " + msg);

const mb = p => (fs.statSync(p).size / 1024 / 1024).toFixed(2);

console.log("\nDemo-Track Check (Launch Phase 1)\n");

if (!fs.existsSync(MANIFEST)) {
  say(false, "assets/demo/demo.json fehlt");
  process.exit(1);
}

let meta;
try {
  meta = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
} catch (e) {
  say(false, "demo.json ist kein gültiges JSON");
  process.exit(1);
}

const files = meta.files || ["elastic-morph-demo.mp3", "elastic-morph-demo.wav"];
const resolved = files.map(f => ({ name: f, path: path.join(DEMO_DIR, f) }));
const existing = resolved.filter(x => fs.existsSync(x.path));
const mp3 = existing.find(x => /\.mp3$/i.test(x.name));
const wav = existing.find(x => /\.wav$/i.test(x.name));
const primary = existing[0] || null;

if (!existing.length) {
  say(false, "Keine Demo-Audio-Datei — nur Fallback (synthetisch)");
  hint("Lege MP3 oder WAV in assets/demo/ ab und passe demo.json an.");
} else {
  say(true, primary ? `Primär (demo.json): ${primary.name} (${mb(primary.path)} MB)` : "Audio vorhanden");
  existing.slice(1).forEach(x => console.log(`  · Fallback: ${x.name} (${mb(x.path)} MB)`));
}

if (wav && !mp3) {
  say(false, "Nur WAV — MP3 fehlt (langsamer Erstload)");
  hint("npm run encode:demo");
} else if (mp3) {
  const size = parseFloat(mb(mp3.path));
  say(size <= MP3_WARN_MB, size <= MP3_TARGET_MB
    ? `MP3-Größe OK (${mb(mp3.path)} MB, Ziel ≤ ${MP3_TARGET_MB} MB)`
    : size <= MP3_WARN_MB
      ? `MP3 etwas groß (${mb(mp3.path)} MB) — optional kürzen oder 192k re-encode`
      : `MP3 zu groß (${mb(mp3.path)} MB) — npm run encode:demo oder kürzen`);
}

if (mp3 && wav) {
  const mp3Newer = fs.statSync(mp3.path).mtimeMs >= fs.statSync(wav.path).mtimeMs;
  say(mp3Newer, mp3Newer ? "MP3 ist aktuell (≥ WAV-Datum)" : "MP3 älter als WAV — npm run encode:demo");
}

const mp3First = files.some(f => /\.mp3$/i.test(f));
if (existing.length && !mp3First && mp3) {
  console.log("  ⚠ demo.json: MP3 sollte vor WAV stehen (schnellerer Load)");
}

const title = (meta.title || "").trim();
const artist = (meta.artist || "").trim();
const placeholder = /DEIN|PLACEHOLDER|TBD/i.test(title + artist);
say(!placeholder && title.length > 1, placeholder ? "demo.json: Titel/Künstler noch Platzhalter" : `Metadaten: «${title}» — ${artist}`);

console.log("");
if (!existing.length) {
  process.exit(1);
}
process.exit(ok ? 0 : 1);
