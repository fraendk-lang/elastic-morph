#!/usr/bin/env node
/* Launch Phase 1 — prüft ob ein echter Demo-Track bereitliegt */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEMO_DIR = path.join(ROOT, "assets", "demo");
const MANIFEST = path.join(DEMO_DIR, "demo.json");

let ok = true;
const say = (good, msg) => {
  console.log((good ? "  ✓ " : "  ✗ ") + msg);
  if (!good) ok = false;
};

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
const found = files.map(f => path.join(DEMO_DIR, f)).find(p => fs.existsSync(p));

say(!!found, found ? `Audio: ${path.basename(found)} (${(fs.statSync(found).size / 1024 / 1024).toFixed(2)} MB)` : "Keine Demo-Audio-Datei — nur Fallback (synthetisch)");

const title = (meta.title || "").trim();
const artist = (meta.artist || "").trim();
const placeholder = /DEIN|PLACEHOLDER|TBD/i.test(title + artist);
say(!placeholder && title.length > 1, placeholder ? "demo.json: Titel/Künstler noch Platzhalter" : `Metadaten: «${title}» — ${artist}`);

console.log("");
if (!found) {
  console.log("→ Lege elastic-morph-demo.mp3 in assets/demo/ ab und passe demo.json an.\n");
}
process.exit(ok && found ? 0 : found ? 0 : 1);
