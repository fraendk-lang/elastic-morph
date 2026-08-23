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

/* pull a GLSL function's full source via brace matching, anchored on its exact signature
   (GLSL functions aren't JS `function` declarations, so extractFn can't find them) */
function extractGlslFn(signature) {
  const start = script.indexOf(signature);
  if (start < 0) return null;
  let i = script.indexOf("{", start), depth = 0;
  for (let j = i; j < script.length; j++) {
    if (script[j] === "{") depth++;
    else if (script[j] === "}") { depth--; if (depth === 0) return script.slice(start, j + 1); }
  }
  return null;
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
ok("FX3_DEFS has 10 effects", (fx3Defs.match(/\["/g) || []).length === 10);
const fx3StateKeys = (() => { const m = script.match(/fx3:\s*\{([^}]+)\}/); return m ? [...m[1].matchAll(/(\w+):\s*false/g)].map(x => x[1]) : []; })();
const fx3DefKeys = [...fx3Defs.matchAll(/\["(\w+)"/g)].map(x => x[1]);
ok("fx3 state keys match FX3_DEFS", fx3StateKeys.length === 10 && fx3StateKeys.every(k => fx3DefKeys.includes(k)));
ok("function toggleFX3 defined", script.includes("function toggleFX3("));
["anamorphflare", "letterbox", "doubleexposure", "dustscratches", "chromafringe", "bleachpulse"].forEach(k =>
  ok("applyPostFX3 handles f3." + k, script.includes("f3." + k)));
ok("Alt+digit toggles FX Rack III", script.includes('e.altKey') && script.includes('toggleFX3(def3[0])') && script.includes('/^Digit([0-9])$/'));
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
ok("v99 dna toggle", script.includes("dnaOn") && script.includes("initDnaAndImageV99") && script.includes("dnaOnChk"));
ok("v99 image presets", script.includes("IMAGE_PRESETS") && script.includes("applyImagePreset") && script.includes("imgPresetRow"));
ok("v99 image modes", script.includes("drawImageLayerV99") && script.includes("parallax") && script.includes("zoompulse"));
ok("v100 dna shortcut", script.includes("toggleDna") && script.includes("initDnaShortcutAndImagePresetsB"));
ok("v100 image presets B", script.includes("IMAGE_PRESETS_B") && script.includes("imgPresetRowB"));
ok("v99 dna boot", script.includes("initDnaAndImageV99()"));
ok("v100 dna boot", script.includes("initDnaShortcutAndImagePresetsB()"));
ok("v100 dna key main", script.includes('if (typeof toggleDna === "function") toggleDna()'));
ok("v101 cover mode", script.includes("drawImageLayersFront") && script.includes("imgCoverMode"));
ok("v102 cover export", script.includes("applyCoverExportPreset") && script.includes("COVER_EXPORT_PRESETS"));
ok("v102 cover boot", script.includes("initCoverExportV102()"));
ok("v103 calm match", script.includes("trackCalmProfile") && script.includes("applyCalmMatch") && script.includes("calmBeatMul"));
ok("v103 calm boot", script.includes("initCalmMatchV103()"));
ok("v104 lyrics studio", script.includes("initLyricsStudioV104") && script.includes("applyLyricsStudioPreset"));
ok("v104 lyrics presets", script.includes("LYRICS_STUDIO_PRESETS") && script.includes("Lyrics Studio"));
ok("v105 music objects", script.includes("drawCassette") && script.includes("drawWaveformMonitor"));
ok("v105 cassette preset", script.includes('id: "cassette"') && script.includes('id: "waveformMonitor"'));
ok("v105 preset insert after tape", script.includes("tapeIdx") && script.includes("MUSIC_OBJECT_PRESETS"));
ok("v105 card previews", script.includes("renderMusicObjectCardPreview"));
ok("v107 social pipeline", script.includes("initSocialPipelineV107") && script.includes("postReadyShortUrl"));
ok("v107 universe handoff", script.includes("handoffExportToUniversePostReady") && script.includes("elastic-universe:morph-export"));
ok("v107 showcase reel", script.includes("applyShowcaseReelPreset") && script.includes("Showcase · 60s Reel"));
ok("v108 export CTA", script.includes("initCreatorExportUXV108") && script.includes("creatorExportCTA"));
ok("v109 quick export", script.includes("initCreatorQuickExportV109") && script.includes("creatorExportHQ"));
ok("v110 creator text", script.includes("initCreatorTextV110") && script.includes("creatorTextRow"));
ok("v110 lyrics sheet", script.includes("creatorLyricsSheet") && script.includes("openCreatorLyricsSheetV110"));
ok("v110 release card", script.includes("applyReleaseCardPresetV110") && script.includes("creatorReleaseCardBtn"));
ok("v110 auto fill", script.includes("parseTitleArtistFromFilenameV110") && script.includes("patchLoadFileAutoFillV110"));
ok("v111 bg video filter", script.includes("initBgVidFiltersV111") && script.includes("bgVidFilter"));
ok("v111 bg video filter css", script.includes("bgVidFilterCSS") && script.includes("coverFilterCSS"));
ok("v112 bg video filter fix", script.includes("initBgVidFilterFixV112") && script.includes("bgVidScratchCanvas"));
ok("demo encode script", fs.existsSync(path.join(__dirname, "scripts/encode-demo-mp3.js")));
ok("universe sync script", fs.existsSync(path.join(__dirname, "scripts/sync-universe-morph.js")));
ok("v101 no duplicate d key", !script.match(/wireDnaShortcut[\s\S]{0,220}addEventListener\("keydown"/));

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

/* ---------------- v113: bloom / layer B / fonts ---------------- */
section("v113 — visual polish");
ok("bloom alpha ceiling raised to 0.55", script.includes("Math.min(0.55, P.bloom"));
ok("bloom baseline term raised to 0.22", script.includes("0.22 + S.loudness * 0.19 + S.beat * 0.05"));
ok("bloom idle/hero multiplier raised", script.includes("dnaLive ? 1 : (heroOpen ? 0.7 : 0.6)"));
ok("bloom buffer at 1/4 resolution", script.includes("Math.round(canvas.width / 4))") && script.includes("bloom buffer at 1/4 resolution"));
ok("layer B weighted picker exists", script.includes("function pickLayerBType"));
ok("layer B generic set covers the 5 cliché types", (() => {
  const m = script.match(/LAYERB_GENERIC = new Set\(\[([^\]]+)\]\)/);
  if (!m) return false;
  const ids = (m[1].match(/"(\w+)"/g) || []).map(s => s.replace(/"/g, ""));
  return ["bars", "grid", "waveform", "starfield", "spectrumRing"].every(id => ids.includes(id));
})());
ok("autoVjStep uses the weighted picker", script.includes("S.layerB.type = pickLayerBType(R)"));
ok("grid overlay has beat-coupled glow on loud cells", script.includes('ctx.shadowBlur = v > 0.55 ? 6 + S.beat * 10 : 0;'));
ok("waveform overlay has beat-coupled glow", script.includes('ctx.shadowBlur = 6 + S.beat * 14;'));
ok("bars overlay has beat-coupled glow on loud bars", script.includes('ctx.shadowBlur = v > 0.5 ? 6 + S.beat * 12 : 0;'));

/* v113: self-hosted font bundle */
["sansAlt", "serifAlt", "monoAlt", "condensed", "handwritten", "variable"].forEach(k =>
  ok("TEXT_FONTS has " + k, new RegExp("\\b" + k + ":\\s*\\{[^}]*fam:").test(script)));
["sansAlt", "serifAlt", "monoAlt", "condensed", "handwritten", "variable"].forEach(k =>
  ok("<option> for " + k + " exists", html.includes('value="' + k + '"')));
const FONT_FILES = ["space-grotesk-500", "space-grotesk-700", "fraunces-400", "fraunces-700",
  "jetbrains-mono-500", "jetbrains-mono-700", "anton-400", "caveat-500", "caveat-700",
  "bricolage-grotesque-500", "bricolage-grotesque-800"];
FONT_FILES.forEach(f => ok("font file exists: " + f, fs.existsSync(path.join(__dirname, "assets/fonts", f + ".woff2"))));
// Caveat (500/700) gets a higher budget: it's a 352-glyph connected script font with
// GSUB/GPOS ligature tables for letter-joining — a narrower unicode subset only saved ~1KB,
// and dropping the ligature tables would visibly degrade the letterforms (accepted in the
// v113 font-bundle commit; actual files are ~49.7-49.8KB, so 52KB leaves real headroom).
const FONT_BUDGET = f => (f === "caveat-500" || f === "caveat-700") ? 52 * 1024 : 40 * 1024;
FONT_FILES.forEach(f => ok("font file under budget: " + f, (() => {
  const p = path.join(__dirname, "assets/fonts", f + ".woff2");
  return fs.existsSync(p) && fs.statSync(p).size < FONT_BUDGET(f);
})()));
ok("@font-face rules present for all 6 families", ["Space Grotesk", "Fraunces", "JetBrains Mono", "Anton", "Caveat", "Bricolage Grotesque"]
  .every(fam => html.includes('font-family: "' + fam + '"') || html.includes("font-family: " + fam + ";")));
const swSrc = fs.readFileSync(path.join(__dirname, "sw.js"), "utf8");
FONT_FILES.forEach(f => ok("sw.js precaches " + f, swSrc.includes(f + ".woff2")));
// Regression guard: build.js bumps APP_VERSION into sw.js's CACHE string at build time —
// this class of bug (sw.js left on a stale version, so the old cache never busts) shipped
// once already and was fixed by hand in round 1; catch it automatically from here on.
const buildSrc = fs.readFileSync(path.join(__dirname, "build.js"), "utf8");
const appVersionMatch = buildSrc.match(/const APP_VERSION = (\d+)/);
ok("build.js APP_VERSION matches sw.js CACHE string", !!appVersionMatch &&
  swSrc.includes(`elastic-morph-v${appVersionMatch[1]}`));
// C2: package.json's version drifted from APP_VERSION before (98.0.0 vs v113) --
// extend the same guard so it can't happen silently again.
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
ok("package.json version matches build.js APP_VERSION", !!appVersionMatch &&
  pkg.version.split(".")[0] === appVersionMatch[1]);

/* ---------------- blend-mode expansion ---------------- */
section("Blend-mode expansion");
const BLEND_VALUES = ["lighter", "screen", "source-over", "multiply", "overlay", "difference", "color-dodge", "hard-light", "hue"];
const lbBlendBlock = (html.match(/<select id="lbBlend"[^>]*>([\s\S]*?)<\/select>/) || [])[1] || "";
const shBlendBlock = (html.match(/<select id="shBlend"[^>]*>([\s\S]*?)<\/select>/) || [])[1] || "";
ok("#lbBlend has all 9 blend values", BLEND_VALUES.every(v => lbBlendBlock.includes(`value="${v}"`)));
ok("#shBlend has all 9 blend values", BLEND_VALUES.every(v => shBlendBlock.includes(`value="${v}"`)));
ok("#lbBlend and #shBlend have the same option count", (lbBlendBlock.match(/<option/g) || []).length === 9 &&
  (shBlendBlock.match(/<option/g) || []).length === 9);

/* ---------------- Layer B modulation ---------------- */
section("Layer B modulation");
ok("function lfoWave defined", script.includes("function lfoWave("));
try {
  const { lfoWave } = loadFns(["lfoWave"]);
  ok("lfoWave sine at phase 0 is 0", Math.abs(lfoWave("sine", 0)) < 1e-9);
  ok("lfoWave sine at phase 0.25 is 1", Math.abs(lfoWave("sine", 0.25) - 1) < 1e-9);
  ok("lfoWave square at phase 0 is 1", lfoWave("square", 0) === 1);
  ok("lfoWave square at phase 0.6 is -1", lfoWave("square", 0.6) === -1);
  ok("lfoWave triangle at phase 0 is -1", Math.abs(lfoWave("triangle", 0) - (-1)) < 1e-9);
  ok("lfoWave triangle at phase 0.5 is 1", Math.abs(lfoWave("triangle", 0.5) - 1) < 1e-9);
  ok("lfoWave wraps phase >1 the same as phase %1", lfoWave("sine", 1.25) === lfoWave("sine", 0.25));
} catch (e) {
  ok("lfoWave sine at phase 0 is 0", false, e.message);
  ok("lfoWave sine at phase 0.25 is 1", false);
  ok("lfoWave square at phase 0 is 1", false);
  ok("lfoWave square at phase 0.6 is -1", false);
  ok("lfoWave triangle at phase 0 is -1", false);
  ok("lfoWave triangle at phase 0.5 is 1", false);
  ok("lfoWave wraps phase >1 the same as phase %1", false);
}
ok("S.layerB has opLfo default with depth 0", /opLfo:\s*\{\s*rate:\s*0\.3,\s*depth:\s*0,\s*shape:\s*"sine"\s*\}/.test(script));
ok("S.layerB has scaleLfo default with depth 0", /scaleLfo:\s*\{\s*rate:\s*0\.3,\s*depth:\s*0,\s*shape:\s*"sine"\s*\}/.test(script));
ok("projectData excludes all 4 layerB phase accumulators", /const\s*\{\s*_spin,\s*_hue,\s*_opPhase,\s*_scPhase,\s*\.\.\.rest\s*\}\s*=\s*S\.layerB/.test(script));
ok("drawLayerB does not use clamp01 (out of scope)", (() => {
  const fn = extractFn("drawLayerB");
  return fn && !fn.includes("clamp01(");
})());
["lbOpLfoRate", "lbOpLfoDepth", "lbOpLfoShape", "lbScLfoRate", "lbScLfoDepth", "lbScLfoShape"].forEach(id =>
  ok("control exists: " + id, html.includes('id="' + id + '"')));

/* ---------------- DNA flow motion (curl noise) ---------------- */
section("DNA flow motion (curl noise)");
ok("function flowNoise defined", script.includes("function flowNoise("));
ok("function curlFlow defined", script.includes("function curlFlow("));
try {
  const { flowNoise, curlFlow } = loadFns(["flowNoise", "curlFlow"]);
  const testPoints = [[0, 0], [1.3, -0.7], [5, 5], [-2.2, 3.1]];
  const allFinite = testPoints.every(([x, y]) => {
    const v = curlFlow(x, y);
    return v && Number.isFinite(v.x) && Number.isFinite(v.y);
  });
  ok("curlFlow returns finite {x,y} for sample points", allFinite);
  const v1 = curlFlow(0, 0), v2 = curlFlow(0.06, 0);
  ok("curlFlow varies across nearby points (not a constant field)",
    Math.abs(v1.x - v2.x) > 1e-6 || Math.abs(v1.y - v2.y) > 1e-6);
  ok("flowNoise is a plain number", typeof flowNoise(1, 1) === "number");
} catch (e) {
  ok("curlFlow returns finite {x,y} for sample points", false, e.message);
  ok("curlFlow varies across nearby points (not a constant field)", false);
  ok("flowNoise is a plain number", false);
}
ok("flow branch uses curlFlow instead of noise2-as-angle", (() => {
  const fn = extractFn("drawScene");
  return fn && fn.includes("curlFlow(pt.fx") && !fn.includes("noise2(pt.fx * 1.8 + seed * 0.07, pt.fy * 1.8 + S.time * 0.15) * Math.PI * 2");
})());

/* ---------------- Background Video blend-mode parity ---------------- */
section("Background Video blend-mode parity");
const bgVidBlendBlock = (html.match(/<select id="bgVidBlend"[^>]*>([\s\S]*?)<\/select>/) || [])[1] || "";
["source-over", "screen", "lighter", "overlay", "multiply", "soft-light", "difference", "color-dodge", "hard-light", "hue"].forEach(v =>
  ok("#bgVidBlend has " + v, bgVidBlendBlock.includes('value="' + v + '"')));

/* ---------------- export auto-exposure fix (A1) ---------------- */
section("Export auto-exposure fix (A1)");
ok("applyAutoExposure runs during export (no early return)", (() => {
  const fn = extractFn("patchWhiteoutFix");
  return fn && !fn.includes("if (S.exporting) return;");
})());
ok("drawScene resets lumAvg on export-start transition", (() => {
  const fn = extractFn("patchWhiteoutFix");
  return fn && fn.includes("S.exporting && !S._wasExporting") &&
    fn.includes("S.lumAvg = 0;") && fn.includes("S._lumPrev = null;") &&
    fn.includes("S._wasExporting = S.exporting;");
})());
ok("reset happens before _drawScene runs (frame 1 of export benefits)", (() => {
  const fn = extractFn("patchWhiteoutFix");
  if (!fn) return false;
  const resetIdx = fn.indexOf("S._wasExporting = S.exporting;");
  const drawIdx = fn.indexOf("_drawScene(dt);");
  return resetIdx >= 0 && drawIdx >= 0 && resetIdx < drawIdx;
})());

/* ---------------- projectData: fx3/master/bgVid serialization (A5) ---------------- */
section("projectData: fx3/master/bgVid serialization (A5)");
ok("projectData includes fx3", (() => {
  const fn = extractFn("projectData");
  return fn && fn.includes("fx3: { ...S.fx3 }");
})());
ok("projectData includes master", (() => {
  const fn = extractFn("projectData");
  return fn && fn.includes("master: { ...S.master }");
})());
ok("projectData includes bgVid settings but not el/src (blob URL, not restorable)", (() => {
  const fn = extractFn("projectData");
  return fn && fn.includes("bgVid:") && !fn.includes("bgVid: { ...S.bgVid }") &&
    !/bgVid:[^}]*\bel\b/.test(fn) && !/bgVid:[^}]*\bsrc\b/.test(fn);
})());
ok("applyProject restores fx3 booleans (mirrors fx2's pattern)", (() => {
  const fn = extractFn("applyProject");
  return fn && fn.includes("for (const k in S.fx3)");
})());
ok("applyProject restores master", (() => {
  const fn = extractFn("applyProject");
  return fn && fn.includes("Object.assign(S.master");
})());
ok("applyProject restores bgVid settings", (() => {
  const fn = extractFn("applyProject");
  return fn && fn.includes("Object.assign(S.bgVid");
})());

/* ---------------- FX Rack III integration (A3/A4/A6) ---------------- */
section("FX Rack III integration (A3/A4/A6)");
ok("A3: brightFxActive covers all 6 additive fx3 effects", (() => {
  const fn = extractFn("brightFxActive");
  return fn && ["anamorphflare", "bleachpulse", "doubleexposure", "dustscratches", "lensflare", "lightleak"]
    .every(k => fn.includes("f3." + k));
})());
ok("A4: autoVjStep clears fx3 alongside fx/fx2", (() => {
  const fn = extractFn("autoVjStep");
  return fn && fn.includes("Object.keys(S.fx3).forEach(k => S.fx3[k] = false)");
})());
ok("A4: autoVjStep's single brightener pool includes fx3 entries", (() => {
  const fn = extractFn("autoVjStep");
  return fn && ["anamorphflare", "bleachpulse", "doubleexposure", "dustscratches", "lensflare", "lightleak"]
    .every(k => fn.includes('["fx3", "' + k + '"]'));
})());
ok("A4: autoVjStep syncs fx3 UI after curating", (() => {
  const fn = extractFn("autoVjStep");
  return fn && fn.includes("syncFX3UI()");
})());
ok("A6: FX-rack keyboard shortcuts are disabled in Creator mode", (() => {
  return script.includes('if (S.uiMode !== "creator") {') &&
    script.includes("number keys 1–9 + 0 toggle the 10 FX");
})());

/* ---------------- exposure/flash guard follow-ups (A2/C1/C6) ---------------- */
section("Exposure/flash guard follow-ups (A2/C1/C6)");
ok("A2: sampleFrameLum excludes letterbox bars from the luminance sample", (() => {
  const fn = extractFn("sampleFrameLum");
  return fn && fn.includes("S.fx3.letterbox") && fn.includes("letterboxBarH(H)") &&
    fn.includes("H - 2 * barH");
})());
ok("A2: letterbox bar height uses the shared helper (single source of truth)", (() => {
  const fn = extractFn("applyPostFX3");
  return fn && fn.includes("letterboxBarH(H)");
})());
ok("C1: dustscratches uses seededRand, not Math.random()", (() => {
  const fn = extractFn("applyPostFX3");
  if (!fn) return false;
  const start = fn.indexOf("f3.dustscratches");
  const end = fn.indexOf("f3.chromafringe");
  const block = fn.slice(start, end);
  return block.includes("seededRand(") && !block.includes("Math.random()");
})());
ok("C6: FX3 beat-triggered brighteners respect reduceFlash", (() => {
  const fn = extractFn("applyPostFX3");
  return fn && fn.includes("f3.lensflare && !S.reduceFlash") &&
    fn.includes("f3.anamorphflare && !S.reduceFlash") &&
    fn.includes("f3.bleachpulse && !S.reduceFlash");
})());

/* ---------------- keyboard ignores open modals (C4) ---------------- */
section("Keyboard ignores open modals (C4)");
ok("C4: keydown handler bails when any modal has aria-hidden=false", script.includes('document.querySelector(\'[aria-hidden="false"]\')'));

/* ---------------- SW offline coverage: landing/legal + demo MP3 (C3) ---------------- */
section("SW offline coverage: landing/legal + demo MP3 (C3)");
const swSrc2 = fs.readFileSync(path.join(__dirname, "sw.js"), "utf8");
ok("SHELL_ASSETS still fail-loud for the app itself (unchanged)", swSrc2.includes('"elastic-morph.html"') && swSrc2.includes("c.addAll(SHELL_ASSETS)"));
["index.html", "impressum.html", "datenschutz.html"].forEach(f =>
  ok("EXTRA_ASSETS precaches " + f, new RegExp("EXTRA_ASSETS[\\s\\S]*?\"" + f + "\"").test(swSrc2)));
ok("EXTRA_ASSETS precaches the demo MP3 (not the 51MB WAV)", swSrc2.includes('"assets/demo/Elastic Field - Dust Reel.mp3"') && !swSrc2.includes(".wav"));
ok("EXTRA_ASSETS installs best-effort via Promise.allSettled, not addAll",
  swSrc2.includes("...EXTRA_ASSETS.map(url => c.add(url))") && swSrc2.includes("Promise.allSettled(["));
["index.html", "impressum.html", "datenschutz.html"].forEach(f =>
  ok(f + " exists on disk", fs.existsSync(path.join(__dirname, f))));
ok("demo MP3 exists on disk", fs.existsSync(path.join(__dirname, "assets/demo/Elastic Field - Dust Reel.mp3")));

/* ---------------- Pixelate modulation pilot ---------------- */
section("Pixelate modulation pilot");
const pixelateBlock = (script.match(/if \(fx\.pixelate\) \{[\s\S]*?\n  \}/) || [])[0] || "";
ok("Pixelate block-size drift present", pixelateBlock.includes("Math.sin(S.time * 0.25)"));
ok("Pixelate sharpness crossfade present", pixelateBlock.includes("Math.sin(S.time * 0.1)"));
ok("Sharpness crossfade skips the extra draw near soft=0 (perf)", pixelateBlock.includes("soft > 0.02"));
ok("Both draws sample the same downsized buffer (no second downscale)", (() => {
  const drawImageCalls = pixelateBlock.match(/ctx\.drawImage\(fxC, 0, 0, sw, sh, 0, 0, W, H\)/g) || [];
  return drawImageCalls.length === 2;
})());

/* ---------------- Scene Banks 4→16 expansion ---------------- */
section("Scene Banks: 16-slot data model");
ok("SCENE_LABELS has 16 letters A–P", script.includes('const SCENE_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];'));
ok("normalizeScenes iterates 16 slots", (() => {
  const fn = extractFn("normalizeScenes");
  return fn && fn.includes("i < 16");
})());
ok("saveScene bounds check allows indices up to 15", script.includes("idx < 0 || idx > 15"));

/* ---------------- Scene Banks: Basis Szene storage (Task 2) ---------------- */
section("Scene Banks: Basis Szene storage");
ok("SCENE_BASIS_LS key defined", script.includes('const SCENE_BASIS_LS = "elasticMorph.sceneBasis";'));
ok("loadBasisScene defined", script.includes("function loadBasisScene()"));
ok("saveBasisScene defined with quota-guard + toast", script.includes("function saveBasisScene()") && script.includes('showAppToast("Basis Szene gespeichert.'));
ok("recallBasisScene defined", script.includes("function recallBasisScene()"));

/* ---------------- Scene Banks: two-bank toggle panel UI (Task 3) ---------------- */
section("Scene Banks: two-bank toggle panel UI");
ok(".scene-bank-toggle CSS defined", html.includes(".scene-bank-toggle"));
ok("activeSceneBank state + setActiveSceneBank helper defined", script.includes("let activeSceneBank = 1;") && script.includes("function setActiveSceneBank(n)"));
ok("renderScenes renders both bank toggle buttons", (() => {
  const fn = extractFn("patchSceneBank");
  return fn && fn.includes("scene-bank-toggle") && fn.includes("Bank 1 (A–H)") && fn.includes("Bank 2 (I–P)");
})());
ok("renderScenes always shows the Basis Szene row", (() => {
  const fn = extractFn("patchSceneBank");
  return fn && fn.includes("recallBasisScene") && fn.includes("saveBasisScene");
})());

/* ---------------- Scene Banks: keyboard shortcuts (Task 4) ---------------- */
section("Scene Banks: keyboard shortcuts");
ok("B recalls Basis Szene, Shift+B triggers blackout (Caps-Lock-safe: checks e.shiftKey, not key case)", script.includes('if ((e.key === "b" || e.key === "B") && !e.shiftKey) { noteBRemapOnce(); recallBasisScene(); }') && script.includes('if ((e.key === "b" || e.key === "B") && e.shiftKey) { e.preventDefault(); noteBRemapOnce(); $("blackoutBtn").click(); }'));
ok("Shift+1-8 recalls within the active bank", script.includes('/^Digit[1-8]$/.test(e.code)') && script.includes("(activeSceneBank - 1) * 8"));
ok("Tab toggles the active scene bank", script.includes('e.key === "Tab"') && script.includes('setActiveSceneBank(activeSceneBank === 1 ? 2 : 1)'));
ok("Tab toggle is scoped to when the scene bank panel is visible (doesn't hijack global Tab navigation)", script.includes('e.key === "Tab" && $("sceneBank")?.offsetParent != null'));
ok("B_REMAP_LS key + noteBRemapOnce defined, shown at most once via localStorage flag", script.includes('const B_REMAP_LS = "elasticMorph.bRemapNoticeShown";') && (() => {
  const fn = extractFn("noteBRemapOnce");
  return fn && fn.includes("localStorage.getItem(B_REMAP_LS)") && fn.includes("localStorage.setItem(B_REMAP_LS,") && fn.includes("showAppToast(");
})());
ok("Listener 3 bails on open modal (guard parity with listener 1)", (() => {
  const idx = script.indexOf("/* extra keyboard:");
  const block = script.slice(idx, idx + 700);
  return block.includes('document.querySelector(\'[aria-hidden="false"]\')');
})());
ok("Escape still closes overlays even while a modal is open (guard must not block Escape itself)", (() => {
  const idx = script.indexOf("/* extra keyboard:");
  const block = script.slice(idx, idx + 700);
  const escapeIdx = block.indexOf('e.key === "Escape"');
  const guardIdx = block.indexOf('document.querySelector(\'[aria-hidden="false"]\')');
  return escapeIdx >= 0 && guardIdx >= 0 && escapeIdx < guardIdx;
})());

/* ---------------- DNA grid visual polish ---------------- */
section("Visual DNA grid: larger preset previews");
ok("#presetGrid/#customGrid + .preset-card sizing enlarged (48px -> 120px previews)", (() => {
  const idx = html.indexOf('#presetGrid, #customGrid {');
  if (idx < 0) return false;
  const block = html.slice(idx, idx + 900);
  return block.includes('minmax(220px, 1fr)); gap: 14px;')
    && block.includes('padding: 16px;')
    && block.includes('.preset-card .swatch { height: 120px; border-radius: 8px; margin-bottom: 12px; }')
    && block.includes('.preset-card .pcanvas { display: block; width: 100%; height: 120px; border-radius: 8px; margin-bottom: 12px; }');
})());

/* ---------------- ArrowUp/Down preset switch ---------------- */
section("ArrowUp/Down preset switch");
ok("flashLookSwipe accepts an optional glyph override, defaults preserved", (() => {
  const fn = extractFn("flashLookSwipe");
  return !!fn && fn.includes("function flashLookSwipe(name, dir, index, total, glyph)")
    && fn.includes('(glyph || (dir > 0 ? "→ " : "← "))');
})());
ok("cyclePresetLook defined, cycles full PRESETS list with wrap-around", (() => {
  const fn = extractFn("cyclePresetLook");
  return !!fn && fn.includes("PRESETS.indexOf(S.preset)")
    && fn.includes("(idx + delta + PRESETS.length) % PRESETS.length")
    && fn.includes("applyPreset(PRESETS[idx])")
    && fn.includes("hapticLookPulse()")
    && !fn.includes("getCreatorLookPicks");
})());
/* superseded by the more complete "plain ArrowUp/Down guard against Shift..." assertion below,
   once Shift+ArrowUp/Down was added alongside the plain bindings */

/* ---------------- Welcome overlay: welSkip aria-hidden fix ---------------- */
section("Welcome overlay: welSkip must not capture a stale closeWelcome reference");
ok("welSkip listener uses dynamic lookup (arrow fn), not a direct function reference captured at registration time", (() => {
  const idx = script.indexOf('$("welSkip").addEventListener("click"');
  if (idx < 0) return false;
  const line = script.slice(idx, script.indexOf("\n", idx));
  return line.includes('() => closeWelcome()');
})());

/* ---------------- SDF Blob (raymarchStyle): triangular lattice network-glow ---------------- */
section("SDF Blob shader: glowing triangular-lattice network with pulsing nodes");
ok("raymarchStyle builds a triangular lattice (3 line families) with node glow at their crossings", (() => {
  const fn = extractGlslFn("vec3 raymarchStyle(vec2 uv){");
  return !!fn
    && /vec3 g = vec3\(/.test(fn)
    && fn.includes("float lines = lx + ly + lz")
    && fn.includes("float nodes = lx*ly + ly*lz + lx*lz")
    && fn.includes("mix(hotA, hotB, mixT)")
    && fn.includes("applyEyeCatcherFX(col, uv)");
})());

/* ---------------- Shader eye-catcher palette + FX ---------------- */
section("Shader eye-catcher palette + FX (Aurora/Gyroid/Feedback/SDF Blob)");

ok("applyEyeCatcherFX helper defined with self-bloom, chromatic-tilt, and grain", (() => {
  const fn = extractGlslFn("vec3 applyEyeCatcherFX(vec3 col, vec2 uv){");
  return !!fn
    && /col\s*\+=\s*col\s*\*\s*col/.test(fn)                 // self-bloom
    && /col\.r\s*\*=/.test(fn) && /col\.b\s*\*=/.test(fn)    // chromatic channel tilt
    && /hash\(uv\s*\*/.test(fn);                             // grain via hash noise
})());

[
  ["auroraStyle", "vec3 auroraStyle(vec2 uv){", "auroraA", "auroraB"],
  ["gyroidStyle", "vec3 gyroidStyle(vec2 uv){", "gyroidA", "gyroidB"],
  ["feedbackStyle", "vec3 feedbackStyle(vec2 uv){", "feedbackA", "feedbackB"],
].forEach(([name, sig, a, b]) => {
  ok(name + " mixes a named two-color palette and calls applyEyeCatcherFX", (() => {
    const fn = extractGlslFn(sig);
    return !!fn
      && fn.includes("mix(" + a + ", " + b + ", ")
      && fn.includes("applyEyeCatcherFX(col, uv)");
  })());
});

[
  ["fluidStyle", "vec3 fluidStyle(vec2 uv){"],
  ["metaStyle", "vec3 metaStyle(vec2 uv){"],
  ["tunnelStyle", "vec3 tunnelStyle(vec2 uv){"],
  ["electricStyle", "vec3 electricStyle(vec2 uv){"],
  ["chromeStyle", "vec3 chromeStyle(vec2 uv){"],
  ["strobeStyle", "vec3 strobeStyle(vec2 uv){"],
  ["warehouseStyle", "vec3 warehouseStyle(vec2 uv){"],
  ["laserStyle", "vec3 laserStyle(vec2 uv){"],
].forEach(([name, sig]) => {
  ok(name + " untouched (no applyEyeCatcherFX call)", (() => {
    const fn = extractGlslFn(sig);
    return !!fn && !fn.includes("applyEyeCatcherFX");
  })());
});

/* ---------------- FX Posterize: crisp edges instead of smudged bands ---------------- */
section("FX Posterize: quantizes without pre-blurring, so band edges stay hard");
ok("posterize downsample uses imageSmoothingEnabled = false before quantizing (no blur baked in before the color-band crush)", (() => {
  const idx = script.indexOf("if (fx.posterize) {");
  if (idx < 0) return false;
  const block = script.slice(idx, idx + 700);
  return block.includes('fxctx.imageSmoothingEnabled = false;\n    fxctx.drawImage(canvas, 0, 0, pw, ph);')
    && block.includes("Math.round(d[i] / step) * step");
})());

/* ---------------- Shift+ArrowUp/Down: Layer B overlay cycling ---------------- */
section("Shift+ArrowUp/Down cycles Layer B overlay types");
ok("cycleLayerBType defined, cycles LAYERB_TYPES with wrap-around and updates the lbType select", (() => {
  const fn = extractFn("cycleLayerBType");
  return !!fn
    && fn.includes("LAYERB_TYPES.findIndex(([id]) => id === S.layerB.type)")
    && fn.includes("(idx + delta + LAYERB_TYPES.length) % LAYERB_TYPES.length")
    && fn.includes('$("lbType").value = id')
    && fn.includes("flashLookSwipe(label,");
})());
ok("Arrow keys route to mutually-exclusive cyclers by modifier: plain -> preset, Shift -> Layer B, Option -> Shader style", (() => {
  const idx = script.indexOf('e.key === "ArrowRight"');
  if (idx < 0) return false;
  const block = script.slice(idx, idx + 700);
  return block.includes('if (e.key === "ArrowDown" && !e.shiftKey && !e.altKey) { e.preventDefault(); cyclePresetLook(1); }')
    && block.includes('if (e.key === "ArrowUp" && !e.shiftKey && !e.altKey) { e.preventDefault(); cyclePresetLook(-1); }')
    && block.includes('if (e.key === "ArrowDown" && e.shiftKey && !e.altKey) { e.preventDefault(); cycleLayerBType(1); }')
    && block.includes('if (e.key === "ArrowUp" && e.shiftKey && !e.altKey) { e.preventDefault(); cycleLayerBType(-1); }')
    && block.includes('if (e.key === "ArrowDown" && e.altKey && !e.shiftKey) { e.preventDefault(); cycleShaderStyle(1); }')
    && block.includes('if (e.key === "ArrowUp" && e.altKey && !e.shiftKey) { e.preventDefault(); cycleShaderStyle(-1); }');
})());
ok("cycleShaderStyle defined, cycles SHADER_STYLE_ID with wrap-around, updates the shStyle select, and derives the toast label from its option text (not a duplicated label list)", (() => {
  const fn = extractFn("cycleShaderStyle");
  return !!fn
    && fn.includes("Object.keys(SHADER_STYLE_ID)")
    && fn.includes("(idx + delta + ids.length) % ids.length")
    && fn.includes('sel.value = id')
    && fn.includes('option[value="${id}"]')
    && fn.includes("flashLookSwipe(label,");
})());

/* ---------------- Named Palette System ---------------- */
section("Named Palette System — data model");

ok("NAMED_PALETTES defined with exactly 6 entries (toxic/sunset/deepsea/cherry/solar/void)", (() => {
  const m = script.match(/const NAMED_PALETTES = \[([\s\S]*?)\n\];/);
  if (!m) return false;
  const ids = [...m[1].matchAll(/id:\s*"(\w+)"/g)].map(x => x[1]);
  const want = ["toxic", "sunset", "deepsea", "cherry", "solar", "void"];
  return ids.length === 6 && want.every(id => ids.includes(id));
})());

ok("S.palette initial state has mode/namedId defaults", script.includes(
  'palette: { on: false, hue: 280, spread: 50, sat: 85, mode: "hsl", namedId: "toxic" },'
));

ok("applyTemplate palette-merge defaults include mode/namedId", script.includes(
  'Object.assign(S.palette, { on: false, hue: 280, spread: 50, sat: 85, mode: "hsl", namedId: "toxic" }, tpl.palette);'
));

/* ---------------- summary ---------------- */
console.log("\n" + "─".repeat(40));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
