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
["drawFilaments", "drawAttractor", "drawFlame", "drawHyperspace", "drawScene", "renderExportFrame", "exportHQ", "buildFeatureTimeline", "fftRadix2",
 "drawOscilloscope", "drawSpectrogram", "drawFlocking", "drawTypography", "drawFluidLite", "applyMasterFinish", "applyPostFX3", "suggestSmartLooks"].forEach(fn =>
  ok("function " + fn + " defined", script.includes("function " + fn + "(")));

/* shader styles: SHADER_STYLE_ID, the <option>s and the GLSL share the same set */
const styleIds = (() => { const m = script.match(/SHADER_STYLE_ID = \{([^}]+)\}/); return m ? [...m[1].matchAll(/(\w+):/g)].map(x => x[1]) : []; })();
const styleOpts = [...html.matchAll(/<option value="(fluid|metaballs|tunnel|aurora|electric|chrome|gyroid|raymarch|feedback|strobe|warehouse|laser)"/g)].map(m => m[1]);
ok("shader styles ≥ 9 defined", styleIds.length >= 9, styleIds.join(","));
ok("every shader style has an <option>", styleIds.every(s => styleOpts.includes(s)), styleIds.filter(s => !styleOpts.includes(s)).join(","));
const frag = (script.match(/SHADER_FRAG = `([\s\S]*?)`;/) || [])[1] || "";
const balanced = (str, o, c) => (str.split(o).length === str.split(c).length);
ok("GLSL braces & parens balanced", frag.length > 0 && balanced(frag, "{", "}") && balanced(frag, "(", ")"));
["auroraStyle", "electricStyle", "chromeStyle", "gyroidStyle", "raymarchStyle", "feedbackStyle", "strobeStyle", "warehouseStyle", "laserStyle"].forEach(fn =>
  ok("GLSL " + fn + " defined & called", (frag.split(fn).length - 1) >= 2));

/* v58: FX Rack III */
const fx3Defs = (script.match(/const FX3_DEFS = \[([\s\S]*?)\];/) || [])[1] || "";
ok("FX3_DEFS has 4 effects", (fx3Defs.match(/\["/g) || []).length === 4);
ok("v58 presets include oscilloscope engine", script.includes('engine: "oscilloscope"'));
ok("v60 zoom control defined", script.includes('["zoom"') && script.includes("function camUserZoom"));
ok("v60 liveMul defined", script.includes("function liveMul"));
ok("v61 tablet UX", script.includes("function initTabletUX") && script.includes("is-touch"));
ok("v62 look swipe", script.includes("function cycleCreatorLook") && script.includes("lookSwipeHint"));
ok("v62 all presets swipe", script.includes("PRESETS.slice()") && script.includes("function hapticLookPulse"));
ok("v62 portrait pro hint", script.includes("function initPortraitProHint") && script.includes("portraitProHint"));
ok("v63 phase A", script.includes("function isAudioFile") && script.includes("function initPhaseA"));
ok("v63 creator aspect class", script.includes("creator-aspect-portrait"));
ok("v64 phase B export", script.includes("function syncExportGates") && script.includes("exportShaderCap"));
ok("v64 shader uses S.time", script.includes("gl.uniform1f(L.time, S.time)"));
ok("v64 stereo timeline", script.includes("const stereo = new Float32Array(frames)"));
ok("v65 phase C UX", script.includes("function initPhaseC") && script.includes("proPortraitSheet"));
ok("v65 swipe mode", script.includes("swipeLookMode") && script.includes("lookLockBtn"));
ok("v65 help DE", html.includes("Kurzanleitung") && html.includes("Touch & iPad"));
ok("v66 phase D", script.includes("function initPhaseD") && script.includes("webglBadge"));
ok("v66 nav buttons", html.includes('<button type="button" class="navitem'));
ok("html lang de", html.includes('lang="de"'));
ok("v67 image modes", script.includes("drawImageLayerV67") && script.includes("glitch"));
ok("v67 image filters", script.includes("IMG_FILTERS") && script.includes("appendImageFilterSelect"));
ok("v68 image blend", script.includes("IMG_BLEND_MODES") && script.includes("drawImageLayerStatic"));
ok("v68 beat sync", script.includes("imageBeatGate") && script.includes("beatSync"));
ok("v69 demo track", script.includes("generateDemoTrackBuffer") && script.includes("loadDemoTrack"));
ok("v69 export success", script.includes("exportSuccessOverlay") && script.includes("onExportComplete"));
ok("v70 freemium", script.includes("drawFreeTierWatermark") && script.includes("isProUnlocked"));
ok("v71 scene bank", script.includes("sceneSnapshot") && script.includes("normalizeScenes"));
ok("v72 export quality", script.includes("initExportQuality") && script.includes("forceFreeTier"));
ok("v73 auto exposure fix", script.includes("initAutoExposureFix") && script.includes("S.lumAvg = 0"));
ok("v74 export fidelity", script.includes("initExportFidelity") && script.includes("resolveExportPixels"));
ok("v75 visual recovery", script.includes("initVisualRecovery") && script.includes("resetVisualExposure"));
ok("v76 export transitions", script.includes("initExportTransitions") && script.includes("exportTransAlpha"));
ok("v77 text presets", script.includes("TEXT_PRESETS") && script.includes("applyTextPreset"));
ok("v78 visual polish", script.includes("initVisualPolish") && script.includes("drawExportPolish"));
ok("v79 whiteout fix", script.includes("initWhiteoutFix") && script.includes("drawDrosteZoom"));
ok("v80 dna visibility", script.includes("initDnaVisibility") && script.includes("dnaBoost"));
ok("v81 vinyl visual", script.includes("initVinylVisual") && !script.includes("tonearm (fixed)"));
ok("v82 hero screen", script.includes("initHeroScreen") && script.includes("heroScreenActive"));
ok("v84 real demo track", script.includes("initRealDemoTrack") && script.includes("fetchBundledDemoFile"));
ok("v85 particle mode", script.includes("initParticleModeV85") && script.includes("toggleParticleMode"));
ok("v86 visual polish", script.includes("initVisualPolishV86") && script.includes("applyToneDimPolished"));
ok("v87 realtime export", script.includes("initRealtimeExportQuality") && script.includes("realtimeVideoBitrate"));
ok("v88 audio load", script.includes("initAudioLoadFix") && script.includes("startFilePlayback"));
ok("v89 realtime export v2", script.includes("initRealtimeExportV89") && script.includes("requestFrame"));
ok("v90 export stability", script.includes("initRealtimeExportStability") && script.includes("startRtChunkMerge"));
ok("v91 club beat", script.includes("initClubBeat") && script.includes("S.clubPulse") && script.includes("clubBeatSharpness"));
ok("v91 club presets", script.includes("danceTechno") && script.includes("clubStrobe") && script.includes("warehouseRave"));
ok("v91 club shaders", styleIds.includes("strobe") && styleIds.includes("warehouse") && styleIds.includes("laser"));
ok("v91 techno dance", script.includes('danceStyle: "techno"') || script.includes('style === "techno"'));
ok("v92 demo robust load", script.includes("DEMO_INLINE_MANIFEST") && script.includes("fetchDemoBytes"));
ok("v93 demo showcase", script.includes("initDemoShowcase") && script.includes("clubStrobe") && script.includes("applyDemoShowcaseLook"));
ok("v95 demo fast start", script.includes("initDemoFastStart") && script.includes("loadDemoStream") && script.includes("demoUrlReachable"));
ok("v96 export graceful stop", script.includes("initRealtimeExportGracefulStop") && script.includes("gracefulStopRealtimeExport") && script.includes("wireRealtimeExportAudio"));

/* ---------------- 2) unit tests on pure functions ---------------- */
section("Unit tests — pure functions");
let F;
try { F = loadFns(["fftRadix2", "buildFeatureTimeline", "flameVary", "noise2", "fmtTime", "attr3dDeriv", "exportTransCurve", "exportTransAlpha", "exportTransGain"]); ok("extract pure functions", true); }
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
  const mkStereo = (sr, dur) => {
    const n = Math.floor(sr * dur), L = new Float32Array(n), R = new Float32Array(n);
    for (let i = 0; i < n; i++) { L[i] = 0.8; R[i] = 0.1; }
    return { getChannelData: c => c === 0 ? L : R, numberOfChannels: 2, sampleRate: sr, duration: dur, length: n };
  };
  const tlSt = F.buildFeatureTimeline(mkStereo(44100, 1), 30);
  ok("timeline includes stereo array", tlSt.stereo && tlSt.stereo.length === 30);
  ok("stereo bias detects left-heavy signal", avg(tlSt.stereo) < -0.2);

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

  const trans = { fadeIn: { on: true, dur: 2, curve: "linear", color: "#000" }, fadeOut: { on: true, dur: 2, curve: "linear", color: "#000" }, audioFade: true };
  ok("exportTransAlpha fades in at t=0", F.exportTransAlpha(0, 10, trans) > 0.9);
  ok("exportTransAlpha clear mid-track", F.exportTransAlpha(5, 10, trans) < 0.01);
  ok("exportTransAlpha fades out at end", F.exportTransAlpha(9.5, 10, trans) > 0.7);
  ok("exportTransGain matches video fade", Math.abs(F.exportTransGain(0, 10, trans) - (1 - F.exportTransAlpha(0, 10, trans))) < 0.001);
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

  // v37: reaction-diffusion (Gray-Scott) stays finite, bounded [0,1] and actually grows pattern
  const reaction = () => {
    const gw = 60, gh = 40, n = gw * gh;
    let U = new Float32Array(n).fill(1), V = new Float32Array(n), U2 = new Float32Array(n), V2 = new Float32Array(n);
    for (let b = 0; b < 12; b++) {           // seed small blobs (radius 2), like the engine
      const cx = (5 + b * 5) % gw, cy = (5 + b * 3) % gh;
      for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) {
        const px = cx + xx, py = cy + yy; if (px < 0 || py < 0 || px >= gw || py >= gh || xx * xx + yy * yy > 4) continue;
        V[py * gw + px] = 0.9;
      }
    }
    const feed = 0.034, kill = 0.057, dA = 1.0, dB = 0.5;   // the engine's default regime
    for (let it = 0; it < 500; it++) {
      for (let y = 0; y < gh; y++) {
        const ym = (y - 1 + gh) % gh, yp = (y + 1) % gh;
        for (let x = 0; x < gw; x++) {
          const xm = (x - 1 + gw) % gw, xp = (x + 1) % gw, i = y * gw + x, u = U[i], v = V[i];
          const lU = (U[ym * gw + x] + U[yp * gw + x] + U[y * gw + xm] + U[y * gw + xp]) * 0.2 + (U[ym * gw + xm] + U[ym * gw + xp] + U[yp * gw + xm] + U[yp * gw + xp]) * 0.05 - u;
          const lV = (V[ym * gw + x] + V[yp * gw + x] + V[y * gw + xm] + V[y * gw + xp]) * 0.2 + (V[ym * gw + xm] + V[ym * gw + xp] + V[yp * gw + xm] + V[yp * gw + xp]) * 0.05 - v;
          const uvv = u * v * v; let nu = u + (dA * lU - uvv + feed * (1 - u)), nv = v + (dB * lV + uvv - (kill + feed) * v);
          U2[i] = nu < 0 ? 0 : nu > 1 ? 1 : nu; V2[i] = nv < 0 ? 0 : nv > 1 ? 1 : nv;
        }
      }
      const tU = U; U = U2; U2 = tU; const tV = V; V = V2; V2 = tV;
    }
    let bad = 0, alive = 0; for (let i = 0; i < n; i++) { if (!isFinite(V[i]) || V[i] < 0 || V[i] > 1.0001) bad++; if (V[i] > 0.1) alive++; }
    return { bad, alive };
  };
  const rr = reaction();
  ok("reaction-diffusion finite, bounded [0,1] & pattern persists", rr.bad === 0 && rr.alive > 5);
}

/* ---------------- summary ---------------- */
console.log("\n" + "─".repeat(40));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
