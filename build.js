#!/usr/bin/env node
/* Elastic Morph — mini build: injects modular src/ into the single-file app.
 * Run:  node build.js
 * Output: elastic-morph.html (in-place merge at BUILD-INJECT-V58 marker)
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const HTML = path.join(ROOT, "elastic-morph.html");
const MARKER = "/* @BUILD-INJECT-V58 */";
const BOOT = "/* ---- boot ---- */";
const APP_VERSION = 95;
const MODULES = ["src/inject-v58.js", "src/inject-v59.js", "src/inject-v60.js", "src/inject-v61.js", "src/inject-v62.js", "src/inject-v63.js", "src/inject-v64.js", "src/inject-v65.js", "src/inject-v66.js", "src/inject-v67.js", "src/inject-v68.js", "src/inject-v69.js", "src/inject-v70.js", "src/inject-v71.js", "src/inject-v72.js", "src/inject-v73.js", "src/inject-v74.js", "src/inject-v75.js", "src/inject-v76.js", "src/inject-v77.js", "src/inject-v78.js", "src/inject-v79.js", "src/inject-v80.js", "src/inject-v81.js", "src/inject-v82.js", "src/inject-v83.js", "src/inject-v84.js", "src/inject-v85.js", "src/inject-v86.js", "src/inject-v87.js", "src/inject-v88.js", "src/inject-v89.js", "src/inject-v90.js", "src/inject-v91.js", "src/inject-v93.js", "src/inject-v95.js"];

let html = fs.readFileSync(HTML, "utf8");
if (!html.includes(MARKER)) {
  console.error("Build marker missing:", MARKER);
  process.exit(1);
}

const inject = MODULES.map(f => {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.error("Missing:", f); process.exit(1); }
  return fs.readFileSync(p, "utf8");
}).join("\n\n");

const mIdx = html.indexOf(MARKER);
const bIdx = html.indexOf(BOOT, mIdx);
if (bIdx < 0) {
  console.error("Boot section not found after marker");
  process.exit(1);
}

html = html.slice(0, mIdx + MARKER.length) + "\n\n" + inject + "\n\n" + html.slice(bIdx);
fs.writeFileSync(HTML, html);

const SW = path.join(ROOT, "sw.js");
if (fs.existsSync(SW)) {
  let sw = fs.readFileSync(SW, "utf8");
  sw = sw.replace(/const CACHE = "elastic-morph-v\d+"/, `const CACHE = "elastic-morph-v${APP_VERSION}"`);
  fs.writeFileSync(SW, sw);
}

console.log("✓ Merged " + MODULES.join(" + ") + " into elastic-morph.html (v" + APP_VERSION + ")");
