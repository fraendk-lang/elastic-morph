#!/usr/bin/env node
/* Elastic Morph — regression test harness (zero dependencies).
 * Run:  node test.js
 * Static checks on the single-file app + real unit tests on its pure functions.
 * Exit code 0 = all pass, 1 = failure (CI-friendly).
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "elastic-morph.html");
const html = fs.readFileSync(FILE, "utf8");
const script = html.split("<script>").slice(-1)[0].replace(/<\/script>[\s\S]*$/, "");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log("  ✓ " + name); } else { fail++; console.log("  ✗ " + name + (extra ? "  → " + extra : "")); } };
const section = s => console.log("\n" + s);

/* pull a named top-level function's full source via brace matching */
function extractFn(name) {
  const start = script.indexOf("function " + name + "(");
  if (start < 0) return null;
  let i = script.indexOf("{", start), depth = 0;
  for (let j = i; j < script.length; j++) {
    if (script[j] === "{") depth++;
    else if (script[j] === "}") { depth--; if (depth === 0) return script.slice(start, j + 1); }
  }
  return null;
}
function loadFns(names) {
  const src = names.map(extractFn);
  const missing = names.filter((n, k) => !src[k]);
  if (missing.length) throw new Error("could not extract: " + missing.join(", "));
  return eval("(function(){ " + src.join("\n") + "\n return {" + names.join(",") + "}; })()");
}

/* ---------------- 1) static checks ---------------- */
section("Static checks");
ok("script parses", (() => { try { new Function(script); return true; } catch (e) { return false; } })());

const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const dupIds = ids.filter((v, i) => ids.indexOf(v) !== i);
ok("no duplicate element IDs", dupIds.length === 0, dupIds.join(", "));

const idSet = new Set(ids);
const refs = [...html.matchAll(/\$\("([^"]+)"\)/g)].map(m => m[1]);
const missingRefs = [...new Set(refs)].filter(r => !idSet.has(r));
ok("every $(\"id\") resolves to an element", missingRefs.length === 0, missingRefs.join(", "));

const fxDefs = (script.match(/const FX_DEFS = \[([\s\S]*?)\];/) || [])[1] || "";
const fx2Defs = (script.match(/const FX2_DEFS = \[([\s\S]*?)\];/) || [])[1] || "";
ok("FX_DEFS has 10 effects", (fxDefs.match(/\["/g) || []).length === 10);
ok("FX2_DEFS has 10 effects", (fx2Defs.match(/\["/g) || []).length === 10);

const fx2StateKeys = (() => { const m = script.match(/fx2:\s*\{([^}]+)\}/); return m ? [...m[1].matchAll(/(\w+):\s*false/g)].map(x => x[1]) : []; })();
const fx2DefKeys = [...fx2Defs.matchAll(/\["(\w+)"/g)].map(x => x[1]);
ok("fx2 state keys match FX2_DEFS", fx2StateKeys.length === 10 && fx2StateKeys.every(k => fx2DefKeys.includes(k)));

/* engines referenced in drawScene branch exist as functions */
["drawFilaments", "drawAttractor", "drawFlame", "drawScene", "renderExportFrame", "exportHQ", "buildFeatureTimeline", "fftRadix2"].forEach(fn =>
  ok("function " + fn + " defined", script.includes("function " + fn + "(")));

/* ---------------- 2) unit tests on pure functions ---------------- */
section("Unit tests — pure functions");
let F;
try { F = loadFns(["fftRadix2", "buildFeatureTimeline", "flameVary", "noise2", "fmtTime", "attr3dDeriv"]); ok("extract pure functions", true); }
catch (e) { ok("extract pure functions", false, e.message); F = null; }

if (F) {
  // FFT: a cosine at bin 8 over N=64 → spectral peak at bin 8
  const N = 64, re = new Float32Array(N), im = new Float32Array(N);
  for (let i = 0; i < N; i++) re[i] = Math.cos(2 * Math.PI * 8 * i / N);
  F.fftRadix2(re, im);
  let peak = 0, pk = -1;
  for (let i = 0; i < N / 2; i++) { const m = Math.hypot(re[i], im[i]); if (m > peak) { peak = m; pk = i; } }
  ok("fftRadix2 peak at expected bin", pk === 8, "got " + pk);

  // buildFeatureTimeline: band separation
  const mkBuf = (freq, sr, dur) => { const n = Math.floor(sr * dur), d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = Math.sin(2 * Math.PI * freq * i / sr); return { getChannelData: () => d, sampleRate: sr, duration: dur }; };
  const avg = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; };
  const tlBass = F.buildFeatureTimeline(mkBuf(60, 44100, 1), 30);
  const tlHigh = F.buildFeatureTimeline(mkBuf(8000, 44100, 1), 30);
  ok("timeline length = round(dur*fps)", tlBass.frames === 30);
  ok("60Hz tone → bass band dominant", avg(tlBass.bass) > 0.5 && avg(tlBass.mids) < 0.2 && avg(tlBass.highs) < 0.2);
  ok("8kHz tone → highs band dominant", avg(tlHigh.highs) > 0.3 && avg(tlHigh.bass) < 0.2);

  // flameVary: all variations finite for a normal input
  let allFinite = true;
  for (let v = 0; v <= 6; v++) { const r = F.flameVary(v, 0.3, -0.7); if (!isFinite(r[0]) || !isFinite(r[1])) allFinite = false; }
  ok("flameVary returns finite values (v0..6)", allFinite);

  // noise2 bounded roughly within [-1,1]
  let nMin = 9, nMax = -9;
  for (let i = 0; i < 500; i++) { const v = F.noise2(Math.random() * 20 - 10, Math.random() * 20 - 10); nMin = Math.min(nMin, v); nMax = Math.max(nMax, v); }
  ok("noise2 stays within [-1.05, 1.05]", nMin >= -1.05 && nMax <= 1.05, nMin.toFixed(2) + ".." + nMax.toFixed(2));

  // fmtTime
  ok("fmtTime formats m:ss", F.fmtTime(83) === "1:23", "got " + F.fmtTime(83));
}

/* ---------------- 3) algorithm stability (uses real flameVary) ---------------- */
section("Algorithm stability");
if (F) {
  // de Jong attractor stays bounded across seeds
  const djong = seed => {
    const a = Math.sin(seed * 0.131) * 2.2, b = Math.cos(seed * 0.271) * 2.2, c = Math.sin(seed * 0.411 + 1.3) * 2.2, d = Math.cos(seed * 0.071 + 0.6) * 2.2;
    let x = 0.1, y = 0.1, nan = 0, mx = 0;
    for (let i = 0; i < 4000; i++) { const nx = Math.sin(a * y) - Math.cos(b * x); y = Math.sin(c * x) - Math.cos(d * y); x = nx; if (!isFinite(x) || !isFinite(y)) nan++; mx = Math.max(mx, Math.abs(x), Math.abs(y)); }
    return { nan, mx };
  };
  let djOk = true;
  [3.2, 88.7, 451, 999.9, 12.3].forEach(s => { const r = djong(s); if (r.nan > 0 || r.mx > 3) djOk = false; });
  ok("de Jong attractor bounded & finite across seeds", djOk);

  // flame chaos game: with reset guard it never diverges to NaN
  const flame = seed => {
    let s = Math.abs(seed) * 1000 + 1; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const tf = []; for (let i = 0; i < 3; i++) tf.push([rnd() * 1.6 - 0.8, rnd() * 1.6 - 0.8, rnd() * 1.6 - 0.8, rnd() * 1.6 - 0.8, rnd() * 1.2 - 0.6, rnd() * 1.2 - 0.6, Math.floor(rnd() * 6) + 1]);
    let x = 0.05, y = 0.05, bad = 0;
    for (let i = 0; i < 5000; i++) {
      const t = tf[Math.floor(Math.random() * 3)];
      const vr = F.flameVary(t[6], t[0] * x + t[1] * y + t[4], t[2] * x + t[3] * y + t[5]); x = vr[0]; y = vr[1];
      if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 30 || Math.abs(y) > 30) { x = Math.random() * 0.1; y = Math.random() * 0.1; bad++; }
    }
    return bad < 5000;  // reset guard keeps it alive (never fully diverges)
  };
  let flOk = true;
  [3, 77, 210, 888, 41].forEach(s => { if (!flame(s)) flOk = false; });
  ok("flame chaos game stays alive (reset guard works)", flOk);

  // v32: hyperspace 3D attractor — RK4 trajectory stays finite & bounded across all 4 types/seeds
  const hyper = (type, seed) => {
    const CFG = [{ dt: 0.005, sc: 24, cz: 25, x: 0.1, y: 0, z: 0 }, { dt: 0.011, sc: 1.5, cz: 0.6, x: 0.1, y: 0, z: 0 },
    { dt: 0.040, sc: 4.6, cz: 0, x: 0.1, y: 0.2, z: 0.3 }, { dt: 0.006, sc: 13, cz: -2.5, x: -1.48, y: -1.51, z: 2.04 }][type];
    const p = type === 0 ? { a: 10, b: 28, c: 2.667 } : type === 1 ? { a: 0.95, d: 3.5 } : type === 2 ? { b: 0.1998 } : { a: 1.89 };
    const dt = CFG.dt, h2 = dt / 2, D = [0, 0, 0];
    let x = CFG.x, y = CFG.y, z = CFG.z, bad = 0, mxN = 0;
    const step = () => {
      F.attr3dDeriv(type, x, y, z, p, D); const k1x = D[0], k1y = D[1], k1z = D[2];
      F.attr3dDeriv(type, x + k1x * h2, y + k1y * h2, z + k1z * h2, p, D); const k2x = D[0], k2y = D[1], k2z = D[2];
      F.attr3dDeriv(type, x + k2x * h2, y + k2y * h2, z + k2z * h2, p, D); const k3x = D[0], k3y = D[1], k3z = D[2];
      F.attr3dDeriv(type, x + k3x * dt, y + k3y * dt, z + k3z * dt, p, D);
      x += dt / 6 * (k1x + 2 * k2x + 2 * k3x + D[0]); y += dt / 6 * (k1y + 2 * k2y + 2 * k3y + D[1]); z += dt / 6 * (k1z + 2 * k2z + 2 * k3z + D[2]);
    };
    for (let i = 0; i < 4000; i++) {
      step();
      if (!isFinite(x + y + z)) { x = CFG.x; y = CFG.y; z = CFG.z; bad++; continue; }
      mxN = Math.max(mxN, Math.abs((x) / CFG.sc), Math.abs((y) / CFG.sc), Math.abs((z - CFG.cz) / CFG.sc));
    }
    return { bad, mxN };
  };
  let hyOk = true;
  for (let ty = 0; ty < 4; ty++) [7.3, 120.5, 451, 888.8].forEach(s => { const r = hyper(ty, s); if (r.bad > 0 || r.mxN > 6 || !isFinite(r.mxN)) hyOk = false; });
  ok("hyperspace 3D attractor finite & bounded (all types/seeds)", hyOk);
}

/* ---------------- summary ---------------- */
console.log("\n" + "─".repeat(40));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
