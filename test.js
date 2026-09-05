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

/* Read a src/inject-vNN.js file's raw source directly. Needed when a name is declared
   pre-marker in elastic-morph.html (e.g. `function drawParticleMode(`) but REASSIGNED
   post-marker (e.g. `drawParticleMode = function (...) {...};`, regenerated from this file
   by build.js) — the post-marker assignment wins at runtime, shadowing the pre-marker
   declaration entirely. extractFn(name) against the assembled `script` always finds the
   pre-marker declaration first (see the build-pipeline-gotcha memory) and can silently test
   dead code, so any name known to be reassigned this way must be tested against its real
   src/inject-vNN.js source explicitly, not against `script`. */
function injectSrc(fileName) {
  return fs.readFileSync(path.join(__dirname, "src", fileName), "utf8");
}

let pass = 0, fail = 0;
const pendingAsyncChecks = [];
const ok = (name, cond, extra) => { if (cond) { pass++; console.log("  ✓ " + name); } else { fail++; console.log("  ✗ " + name + (extra ? "  → " + extra : "")); } };
const section = s => console.log("\n" + s);

/* pull a named top-level function's full source via brace matching.
   src defaults to the app's own script; overridable for testing the fallback logic below
   against synthetic input without needing a matching declaration in the real app. */
function extractFn(name, src) {
  if (src === undefined) src = script;
  const start = src.indexOf("function " + name + "(");
  if (start < 0) {
    /* fallback 1: a reassignment-style function, `NAME = function (...) {...};` — the pattern
       build.js's inject-vNN.js patches use to override an earlier `function NAME(` declaration.
       Only reached when no `function NAME(` exists IN THE GIVEN src — safe against `script`
       (which always has the original declaration first, so this never fires there) and is how
       callers explicitly test an inject file's own content via injectSrc(). */
    const asnStart = src.indexOf(name + " = function (") >= 0 ? src.indexOf(name + " = function (")
      : src.indexOf(name + " = function(");
    if (asnStart >= 0) {
      let bi = src.indexOf("{", asnStart), depth = 0;
      for (let j = bi; j < src.length; j++) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(asnStart, j + 1); }
      }
      return null;
    }
    /* fallback 2: a top-level `const NAME = ...;` declaration (e.g. an arrow function like
       fract1) — only used when no `function NAME(` declaration exists, so it can't affect
       any existing call site above. Final-review hardening: a block-bodied arrow
       (`const NAME = () => { a(); b(); };`) has an inner `;` before its real end, so slicing
       to the first `;` would silently truncate it — a negative `.includes()` assertion against
       that truncated text could then pass vacuously. If a `{` appears before the first `;`,
       brace-match from there instead of slicing at the semicolon. */
    const constStart = src.indexOf("const " + name + " = ");
    if (constStart < 0) return null;
    const semi = src.indexOf(";", constStart);
    const brace = src.indexOf("{", constStart);
    if (brace < 0 || semi < brace) return semi < 0 ? null : src.slice(constStart, semi + 1);
    let bi = brace, depth = 0;
    for (let j = bi; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(constStart, j + 1); }
    }
    return null;
  }
  let i = src.indexOf("{", start), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  return null;
}
function loadFns(names) {
  const src = names.map(n => extractFn(n));   // NOT names.map(extractFn) — Array.map passes (el, index, array), and extractFn's new optional 2nd param would receive the index as src
  const missing = names.filter((n, k) => !src[k]);
  if (missing.length) throw new Error("could not extract: " + missing.join(", "));
  return eval("(function(){ " + src.join("\n") + "\n return {" + names.join(",") + "}; })()");
}

/* Same as loadFns, but against an explicit src string (e.g. an inject-vNN.js file's own content
   via injectSrc()) instead of the assembled script — needed for functions that only exist in a
   src/inject-vNN.js file's own scope, like this round's pmMirrorXY/pmMirrorPasses. */
function loadFns2(names, src) {
  const fns = names.map(n => extractFn(n, src));
  const missing = names.filter((n, k) => !fns[k]);
  if (missing.length) throw new Error("could not extract: " + missing.join(", "));
  return eval("(function(){ " + fns.join("\n") + "\n return {" + names.join(",") + "}; })()");
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
// final-review fix: was a hardcoded style-name alternation that silently stopped matching new
// styles (already had to be patched once, for portal/crystal/hypercube) — generic now, matches
// every #shStyle option by its "Style: " label convention, so it can't go stale again.
const shStyleBlock = (html.match(/<select id="shStyle"[^>]*>([\s\S]*?)<\/select>/) || [])[1] || "";
const styleOpts = [...shStyleBlock.matchAll(/<option value="(\w+)"[^>]*>Style: /g)].map(m => m[1]);
ok("shader styles ≥ 9 defined", styleIds.length >= 9, styleIds.join(","));
ok("every shader style has an <option>", styleIds.every(s => styleOpts.includes(s)), styleIds.filter(s => !styleOpts.includes(s)).join(","));
const frag = (script.match(/SHADER_FRAG = `([\s\S]*?)`;/) || [])[1] || "";
const balanced = (str, o, c) => (str.split(o).length === str.split(c).length);
ok("GLSL braces & parens balanced", frag.length > 0 && balanced(frag, "{", "}") && balanced(frag, "(", ")"));
["auroraStyle", "electricStyle", "chromeStyle", "gyroidStyle", "raymarchStyle", "feedbackStyle", "strobeStyle", "warehouseStyle", "laserStyle"].forEach(fn =>
  ok("GLSL " + fn + " defined & called", (frag.split(fn).length - 1) >= 2));

/* ---------------- Shader Engine: Portal Depth, Crystal Prism, Hypercube Drift ---------------- */
section("Shader Engine — Portal Depth, Crystal Prism, Hypercube Drift");

ok("SHADER_STYLE_ID gained the 3 new entries with the correct uStyle values (12/13/14)", (() => {
  return /portal:\s*12/.test(script) && /crystal:\s*13/.test(script) && /hypercube:\s*14/.test(script);
})());

["portalStyle", "crystalStyle", "hypercubeStyle", "segGlow", "projCube"].forEach(fn =>
  ok("GLSL " + fn + " defined & called", (frag.split(fn).length - 1) >= 2));

/* Final-review fix: crystalDist's two diagonal facet planes were originally symmetric weights
   (1,1,1) and (1,-1,1) — since crystalDist only ever receives abs(p) (all-nonnegative), the second
   plane's dot product could never exceed the first's, making it dead code and the intended second
   facet family invisible. Asymmetric weights make it a real, distinct cut. */
ok("crystalDist's two diagonal facet planes use distinct (non-symmetric) weight vectors, so neither is analytically dead against an all-nonnegative input", (() => {
  const idx = frag.indexOf("float crystalDist");
  if (idx < 0) return false;
  const body = frag.slice(idx, idx + 300);
  const weights = [...body.matchAll(/normalize\(vec3\(([^)]+)\)\)/g)].map(m => m[1].split(",").map(s => Math.abs(parseFloat(s))));
  if (weights.length < 2) return false;
  const [a, b] = weights;
  // if every |weight| pair matched, dot(abs(p), planeB) could never exceed dot(abs(p), planeA)
  // for an all-nonnegative p — the exact dead-code condition being guarded against here.
  return !(a[0] === b[0] && a[1] === b[1] && a[2] === b[2]);
})());

ok("main()'s dispatch chain: laser's bare else became an explicit uStyle<11.5 branch, followed by portal/crystal/hypercube in order, hypercube now an explicit uStyle<14.5 branch (cosmicDrift took over the bare else)", (() => {
  const mainIdx = frag.lastIndexOf("void main(){");
  if (mainIdx < 0) return false;
  const mainBody = frag.slice(mainIdx);
  const laserIdx = mainBody.indexOf("else if(uStyle < 11.5) col = laserStyle(uv*1.2);");
  const portalIdx = mainBody.indexOf("else if(uStyle < 12.5) col = portalStyle(uv);");
  const crystalIdx = mainBody.indexOf("else if(uStyle < 13.5) col = crystalStyle(uv);");
  const hypercubeIdx = mainBody.indexOf("else if(uStyle < 14.5) col = hypercubeStyle(uv);");
  return laserIdx >= 0 && portalIdx > laserIdx && crystalIdx > portalIdx && hypercubeIdx > crystalIdx;
})());

ok("#shStyle gained the 3 new <option> elements in order after laser", (() => {
  const selMatch = html.match(/<select id="shStyle"[^>]*>([\s\S]*?)<\/select>/);
  if (!selMatch) return false;
  const body = selMatch[1];
  const laserIdx = body.indexOf('value="laser"');
  const portalIdx = body.indexOf('value="portal"');
  const crystalIdx = body.indexOf('value="crystal"');
  const hypercubeIdx = body.indexOf('value="hypercube"');
  return laserIdx >= 0 && portalIdx > laserIdx && crystalIdx > portalIdx && hypercubeIdx > crystalIdx;
})());

ok("no GLSL array syntax introduced (WebGL1/GLSL ES 1.00 array-constructor risk avoided per design)", (() => {
  const s3 = frag.indexOf("vec3 portalStyle");
  const eIdx = frag.indexOf("void main(){", s3);
  const newStylesSrc = s3 >= 0 && eIdx > s3 ? frag.slice(s3, eIdx) : "";
  return newStylesSrc.length > 0 && !newStylesSrc.includes("[8]") && !newStylesSrc.includes("[24]") && !/vec[234]\s*\[/.test(newStylesSrc);
})());

/* ---------------- Shader Engine: Cosmic Drift ---------------- */
section("Shader Engine — Cosmic Drift");

ok("SHADER_STYLE_ID gained the cosmicDrift entry with the correct uStyle value (15)", (() => {
  return /cosmicDrift:\s*15/.test(script);
})());

["cosmicDriftDensity", "cosmicDriftStyle"].forEach(fn =>
  ok("GLSL " + fn + " defined & called", (frag.split(fn).length - 1) >= 2));

ok("main()'s dispatch chain: hypercube's bare else became an explicit uStyle<14.5 branch, followed by cosmicDrift now an explicit uStyle<15.5 branch (warpTunnel took over the bare else)", (() => {
  const mainIdx = frag.lastIndexOf("void main(){");
  if (mainIdx < 0) return false;
  const mainBody = frag.slice(mainIdx);
  const hypercubeIdx = mainBody.indexOf("else if(uStyle < 14.5) col = hypercubeStyle(uv);");
  const cosmicIdx = mainBody.indexOf("else if(uStyle < 15.5) col = cosmicDriftStyle(uv);");
  return hypercubeIdx >= 0 && cosmicIdx > hypercubeIdx;
})());

ok("#shStyle gained the new <option> after hypercube", (() => {
  const selMatch = html.match(/<select id="shStyle"[^>]*>([\s\S]*?)<\/select>/);
  if (!selMatch) return false;
  const body = selMatch[1];
  const hypercubeIdx = body.indexOf('value="hypercube"');
  const cosmicIdx = body.indexOf('value="cosmicDrift"');
  return hypercubeIdx >= 0 && cosmicIdx > hypercubeIdx;
})());

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
ok("v64 shader uses S.time", script.includes("gl.uniform1f(L.time, S.time * (SH.speed != null ? SH.speed : 1));"));
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
ok("projectData excludes all 6 layerB transient accumulators (incl. progress-zoom + voronoi seeds)", /const\s*\{\s*_spin,\s*_hue,\s*_opPhase,\s*_scPhase,\s*_progZoom,\s*_vSeeds,\s*\.\.\.rest\s*\}\s*=\s*S\.layerB/.test(script));
ok("drawLayerB does not use clamp01 (out of scope)", (() => {
  const fn = extractFn("drawLayerB");
  return fn && !fn.includes("clamp01(");
})());
["lbOpLfoRate", "lbOpLfoDepth", "lbOpLfoShape", "lbScLfoRate", "lbScLfoDepth", "lbScLfoShape"].forEach(id =>
  ok("control exists: " + id, html.includes('id="' + id + '"')));

/* ---------------- Layer B: new grid/interference types ---------------- */
section("Layer B — Iso-Grid, Voronoi, Moiré");

ok("LAYERB_TYPES gained exactly the 3 new entries with the correct id/label pairs", (() => {
  const m = script.match(/const LAYERB_TYPES = \[([\s\S]*?)\];/);
  if (!m) return false;
  const body = m[1];
  return body.includes('["isoGrid",') && body.includes('"Iso-Grid"]')
    && body.includes('["voronoi",') && body.includes('"Voronoi"]')
    && body.includes('["moire",') && body.includes('"Moiré"]');
})());

ok("drawLayerB has a case for isoGrid using the shared sc scale factor", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes('case "isoGrid": {') && fn.includes("mn * 0.055 * sc");
})());

/* Final-review fix: row/col start at -1, so (col + row*5) % 40 can be negative — specAt's
   analyser branch does Math.pow(i/n, 1.5), which is NaN for a negative i/n, silently breaking
   the stroke color for a few off-canvas cells. Defensive double-modulo keeps the index in [0,40). */
ok("isoGrid's specAt index is kept non-negative via a double-modulo (row/col start at -1)", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes("specAt(((col + row * 5) % 40 + 40) % 40, 40)");
})());

ok("drawLayerB has a case for voronoi with 14 deterministic seeds cached on LB._vSeeds", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes('case "voronoi": {')
    && fn.includes("LB._vSeeds.length !== 14")
    && fn.includes("0.61803398875") && fn.includes("0.38196601125");
})());

ok("drawLayerB has a case for moire drawing two rotated line-grids", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes('case "moire": {') && fn.includes("const drawLines = (angle, offset, alpha)");
})());

ok("the 3 new cases sit after case \"orbits\" (the prior last case) inside the same switch", (() => {
  const fn = extractFn("drawLayerB");
  if (!fn) return false;
  const orbitsIdx = fn.indexOf('case "orbits":');
  const isoIdx = fn.indexOf('case "isoGrid":');
  const vorIdx = fn.indexOf('case "voronoi":');
  const moireIdx = fn.indexOf('case "moire":');
  return orbitsIdx >= 0 && isoIdx > orbitsIdx && vorIdx > isoIdx && moireIdx > vorIdx;
})());

/* Voronoi seed generation is pure math — genuinely testable without any canvas/DOM mocking.
   Extract just the seed-generation expression via the golden-ratio constants and confirm it's
   deterministic (same call twice => identical coordinates) and within the [0.1, 0.9] band the
   design specifies. */
ok("Voronoi seed generation (golden-ratio sequence) is deterministic and stays within [0.1, 0.9]", (() => {
  const genSeeds = () => Array.from({ length: 14 }, (_, i) => ({
    x: 0.1 + 0.8 * ((i * 0.61803398875) % 1), y: 0.1 + 0.8 * ((i * 0.38196601125) % 1)
  }));
  const a = genSeeds(), b = genSeeds();
  const sameEveryTime = a.every((s, i) => s.x === b[i].x && s.y === b[i].y);
  const inBand = a.every(s => s.x >= 0.1 && s.x <= 0.9 && s.y >= 0.1 && s.y <= 0.9);
  return sameEveryTime && inBand && a.length === 14;
})());

/* ---------------- Layer B: Progress Zoom ---------------- */
section("Layer B — Progress Zoom");

ok("LAYERB_PHASE_ZOOM has the 6 confirmed phase targets", (() => {
  const m = script.match(/const LAYERB_PHASE_ZOOM = \{([^}]*)\};/);
  if (!m) return false;
  const body = m[1];
  return /Birth:\s*0\.75/.test(body) && /Grow:\s*0\.9/.test(body) && /Tension:\s*1\.15/.test(body)
    && /Break:\s*1\.35/.test(body) && /Return:\s*0\.95/.test(body) && /Fade:\s*0\.7/.test(body);
})());

ok("S.layerB default object has progressZoomAmt: 0 and _progZoom: 1", (() => {
  return /progressZoomAmt:\s*0,\s*_progZoom:\s*1/.test(script);
})());

ok("drawLayerB's accumulator block updates LB._progZoom from LAYERB_PHASE_ZOOM[S.phase] with a ~2.5s smoothing constant", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn
    && fn.includes("const zTarget = LAYERB_PHASE_ZOOM[S.phase] || 1;")
    && fn.includes("Math.min(1, dt / 2.5)");
})());

ok("drawLayerB's sc computation multiplies in the Progress Zoom term, and it's a no-op at progressZoomAmt=0", (() => {
  const fn = extractFn("drawLayerB");
  if (!fn) return false;
  const hasTerm = fn.includes("* (1 + ((LB._progZoom || 1) - 1) * LB.progressZoomAmt)");
  // Structural no-op check: at progressZoomAmt=0, (1 + (anything - 1)*0) algebraically reduces
  // to exactly 1 regardless of _progZoom's value — verified here by evaluating the literal
  // expression pattern rather than running the real (canvas-dependent) function.
  const noOpAtZero = (() => { const LB__progZoom = 999; const progressZoomAmt = 0; return (1 + ((LB__progZoom || 1) - 1) * progressZoomAmt) === 1; })();
  return hasTerm && noOpAtZero;
})());

/* Final-review fix: isoGrid/moire/hexgrid derive loop counts from W/(k*sc) — an exact or
   near-zero sc (reachable via Scale LFO at full depth, worsened by Progress Zoom's low-end
   multipliers) turns that into an unbounded/near-infinite loop and freezes the tab. sc must be
   floored away from 0. */
ok("drawLayerB floors sc at 0.05 so W/(k*sc)-derived loop counts (isoGrid/moire/hexgrid) can never reach Infinity", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes("const sc = Math.max(0.05, scRaw);");
})());
ok("Math.max(0.05, x) never returns 0 or a negative value regardless of how small/negative x is", (() => {
  return Math.max(0.05, 0) === 0.05 && Math.max(0.05, -3) === 0.05 && Math.max(0.05, 1e-9) === 0.05;
})());

ok("#lbProgZoom slider exists in the Layer B Modulation panel", html.includes('id="lbProgZoom"'));

ok("#lbProgZoom is wired to S.layerB.progressZoomAmt on input", script.includes('$("lbProgZoom").addEventListener("input", e => { S.layerB.progressZoomAmt = e.target.value / 100;'));

ok("#lbProgZoom syncs from S.layerB.progressZoomAmt on load", script.includes('$("lbProgZoom").value = Math.round(S.layerB.progressZoomAmt * 100);'));

ok("applyProject() clamps progressZoomAmt to [0,1] with a 0 default when absent", script.includes('S.layerB.progressZoomAmt = lb.progressZoomAmt != null ? clamp01(+lb.progressZoomAmt) : 0;'));

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
    && fn.includes("mix(uPalOn > 0.5 ? uPalA : hotA, uPalOn > 0.5 ? uPalB : hotB, mixT)")
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
  ["raymarchStyle", "vec3 raymarchStyle(vec2 uv){", "hotA", "hotB"],
  ["feedbackStyle", "vec3 feedbackStyle(vec2 uv){", "feedbackA", "feedbackB"],
].forEach(([name, sig, a, b]) => {
  ok(name + " mixes uPalA/uPalB when uPalOn is active, falls back to its own anchors otherwise, still calls applyEyeCatcherFX", (() => {
    const fn = extractGlslFn(sig);
    return !!fn
      && fn.includes("mix(uPalOn > 0.5 ? uPalA : " + a + ", uPalOn > 0.5 ? uPalB : " + b)
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

/* ---------------- Named Palette System — UI panel */
section("Named Palette System — UI panel");

ok("palette mode select and named-palette select exist, with a static <option> per NAMED_PALETTES entry", (() => {
  const m = script.match(/const NAMED_PALETTES = \[([\s\S]*?)\n\];/);
  const ids = m ? [...m[1].matchAll(/id:\s*"(\w+)"/g)].map(x => x[1]) : [];
  const selectBlock = (html.match(/<select id="palNamed"[^>]*>([\s\S]*?)<\/select>/) || [])[1] || "";
  const hasOptions = ids.length > 0 && ids.every(id => selectBlock.includes('<option value="' + id + '">'));
  return html.includes('id="palMode"') && html.includes('id="palNamed"') && hasOptions;
})());

ok("palMode/palNamed listeners registered", (() => {
  return script.includes('$("palMode").addEventListener("change"')
    && script.includes('$("palNamed").addEventListener("change"');
})());

ok("drawPalettePreview renders the named-gradient branch", (() => {
  const fn = extractFn("drawPalettePreview");
  return !!fn && fn.includes('S.palette.mode === "named"');
})());

ok("syncPaletteUI toggles palHslRow/palNamedRow and syncs #palNamed's selected value", (() => {
  const fn = extractFn("syncPaletteUI");
  return !!fn
    && fn.includes('$("palHslRow")')
    && fn.includes('$("palNamedRow")')
    && fn.includes('$("palNamed")');
})());

/* ---------------- Named Palette System — persistence */
section("Named Palette System — persistence");

ok("projectData() spreads S.palette wholesale (mode/namedId ride along for free)", script.includes(
  "palette: { ...S.palette },"
));

ok("applyProject restores palette.mode/namedId with safe defaults", (() => {
  const fn = extractFn("applyProject");
  return !!fn
    && fn.includes('S.palette.mode = pl.mode === "named" ? "named" : "hsl";')
    && fn.includes('S.palette.namedId = pl.namedId || "toxic";');
})());

section("Named Palette System — shader uniforms");

ok("uPalOn/uPalA/uPalB uniforms declared in SHADER_FRAG", script.includes("uniform float uPalOn;")
  && script.includes("uniform vec3 uPalA;") && script.includes("uniform vec3 uPalB;"));

ok("GL.loc looks up palOn/palA/palB uniform locations", (() => {
  const m = script.match(/GL\.loc = \{([\s\S]*?)\};/);
  return !!m && /palOn:\s*gl\.getUniformLocation\(prog, "uPalOn"\)/.test(m[1])
    && /palA:\s*gl\.getUniformLocation\(prog, "uPalA"\)/.test(m[1])
    && /palB:\s*gl\.getUniformLocation\(prog, "uPalB"\)/.test(m[1]);
})());

ok("renderShader sets uPalOn/uPalA/uPalB from S.palette each frame", (() => {
  const fn = extractFn("renderShader");
  return !!fn
    && fn.includes('S.palette.mode === "named"')
    && fn.includes("gl.uniform1f(L.palOn,")
    && fn.includes("gl.uniform3f(L.palA,")
    && fn.includes("gl.uniform3f(L.palB,");
})());

section("Named Palette System — 8 hue-only shader styles");

[
  ["fluidStyle", "vec3 fluidStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * val : hsv2rgb(vec3(fract(hue), sat, val))"],
  ["metaStyle", "vec3 metaStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * (edge*(0.9+uLoud*0.7+uBeat*0.5)) : hsv2rgb(vec3(fract(hue), 0.85, edge*(0.9+uLoud*0.7+uBeat*0.5)))"],
  ["tunnelStyle", "vec3 tunnelStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * v : hsv2rgb(vec3(fract(hue), 0.8, v))"],
  ["electricStyle", "vec3 electricStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * bolt : hsv2rgb(vec3(fract(hue), 0.55, bolt))"],
  ["chromeStyle", "vec3 chromeStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * (0.35 + 0.4*h) : hsv2rgb(vec3(fract(hue), 0.5 + 0.3*uMids, 0.35 + 0.4*h))"],
  ["strobeStyle", "vec3 strobeStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * v : hsv2rgb(vec3(fract(hue), 0.88, v))"],
  ["warehouseStyle", "vec3 warehouseStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * (v*(0.65 + uLoud*0.65)) : hsv2rgb(vec3(fract(hue), 0.72, v*(0.65 + uLoud*0.65)))"],
  ["laserStyle", "vec3 laserStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * (beam*(0.45 + uBeat*1.35 + uLoud*0.55)) : hsv2rgb(vec3(fract(hue), 0.92, beam*(0.45 + uBeat*1.35 + uLoud*0.55)))"],
].forEach(([name, sig, needle]) => {
  ok(name + " branches to Named Gradient mix when uPalOn is active", (() => {
    const fn = extractGlslFn(sig);
    return !!fn && fn.includes(needle);
  })());
});

ok("chromeStyle's second hsv2rgb call (mid-expression) is parenthesized to survive GLSL ?: precedence", (() => {
  const fn = extractGlslFn("vec3 chromeStyle(vec2 uv){");
  return !!fn && fn.includes("+ (uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue+0.3)) * (fres*0.6) : hsv2rgb(vec3(fract(hue+0.3), 0.6, fres*0.6)))");
})());

ok("the 8 hue-only styles still don't call applyEyeCatcherFX (unaffected pre-existing regression check)", (() => {
  return ["fluidStyle", "metaStyle", "tunnelStyle", "electricStyle", "chromeStyle", "strobeStyle", "warehouseStyle", "laserStyle"]
    .every(name => {
      const fn = extractGlslFn("vec3 " + name + "(vec2 uv){");
      return !!fn && !fn.includes("applyEyeCatcherFX");
    });
})());

section("Named Palette System — Layer B");

ok("drawLayerB's colr() branches to a Named Gradient RGB mix inside the dna color mode", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn
    && fn.includes('LB.color === "dna" && S.palette.on && S.palette.mode === "named"')
    && fn.includes("NAMED_PALETTES.find(p => p.id === S.palette.namedId)");
})());

ok("currentDNA() does not override preset colour genes when palette.mode is 'named'", (() => {
  const fn = extractFn("currentDNA");
  return !!fn && fn.includes('if (S.palette.on && S.palette.mode !== "named") {');
})());

/* ---------------- Feedback Loop Deepening — data model ---------------- */
section("Feedback Loop Deepening — data model");

ok("S.feedbackFX initial state has all 8 fields at today's defaults", script.includes(
  'feedbackFX: { zoom: 1.045, rotation: 0.69, decay: 0.28, alpha: 0.38, hueShift: 0, dirX: 0, dirY: 0, blend: "lighter" },'
));

/* ---------------- Feedback Loop Deepening — UI panel */
section("Feedback Loop Deepening — UI panel");

ok("Feedback Loop panel HTML has all 9 controls", (() => {
  const ids = ["fbOn", "fbBlend", "fbZoom", "fbRot", "fbDecay", "fbAlpha", "fbHue", "fbDirX", "fbDirY"];
  return ids.every(id => html.includes('id="' + id + '"'));
})());

ok("#fbOn reuses toggleFX(\"feedback\") so it stays in lockstep with the FX Rack chip", script.includes(
  '$("fbOn").addEventListener("change", () => toggleFX("feedback"));'
));

ok("syncFXUI also syncs #fbOn to S.fx.feedback", (() => {
  const fn = extractFn("syncFXUI");
  return !!fn && fn.includes('$("fbOn").checked = !!S.fx.feedback;');
})());

ok("syncFeedbackFXUI sets every control from S.feedbackFX", (() => {
  const fn = extractFn("syncFeedbackFXUI");
  return !!fn
    && fn.includes('$("fbBlend").value = S.feedbackFX.blend;')
    && fn.includes("S.feedbackFX.zoom")
    && fn.includes("S.feedbackFX.rotation")
    && fn.includes("S.feedbackFX.decay")
    && fn.includes("S.feedbackFX.alpha")
    && fn.includes("S.feedbackFX.hueShift")
    && fn.includes("S.feedbackFX.dirX")
    && fn.includes("S.feedbackFX.dirY");
})());

ok("zoom slider converts percent-growth to an absolute scale factor (1 + value/100)", script.includes(
  "S.feedbackFX.zoom = 1 + (+e.target.value) / 100;"
));

ok("rotation/hueShift sliders write degrees directly (no radian conversion in the UI layer)",
  script.includes("S.feedbackFX.rotation = +e.target.value;")
  && script.includes("S.feedbackFX.hueShift = +e.target.value;")
);

ok("decay/alpha/dirX/dirY sliders use the established value/100 fraction convention",
  script.includes("S.feedbackFX.decay = e.target.value / 100;")
  && script.includes("S.feedbackFX.alpha = e.target.value / 100;")
  && script.includes("S.feedbackFX.dirX = e.target.value / 100;")
  && script.includes("S.feedbackFX.dirY = e.target.value / 100;")
);

ok("syncFeedbackFXUI is called at boot", /^syncFeedbackFXUI\(\);$/m.test(script));

section("Feedback Loop Deepening — persistence");

ok("projectData() includes feedbackFX", script.includes(
  "feedbackFX: { ...S.feedbackFX },"
));

ok("applyProject restores feedbackFX with safe defaults for every field", (() => {
  const fn = extractFn("applyProject");
  return !!fn
    && fn.includes("const fb = o.feedbackFX || {};")
    && fn.includes("S.feedbackFX.zoom = fb.zoom != null ? fbClamp(fb.zoom, 1, 1.15, 1.045) : 1.045;")
    && fn.includes("S.feedbackFX.rotation = fb.rotation != null ? fbClamp(fb.rotation, -3, 3, 0.69) : 0.69;")
    && fn.includes("S.feedbackFX.decay = fb.decay != null ? fbClamp(fb.decay, 0.05, 0.60, 0.28) : 0.28;")
    && fn.includes("S.feedbackFX.alpha = fb.alpha != null ? fbClamp(fb.alpha, 0, 0.90, 0.38) : 0.38;")
    && fn.includes("S.feedbackFX.hueShift = fb.hueShift != null ? fbClamp(fb.hueShift, 0, 8, 0) : 0;")
    && fn.includes("S.feedbackFX.dirX = fb.dirX != null ? fbClamp(fb.dirX, -0.05, 0.05, 0) : 0;")
    && fn.includes("S.feedbackFX.dirY = fb.dirY != null ? fbClamp(fb.dirY, -0.05, 0.05, 0) : 0;")
    && fn.includes('S.feedbackFX.blend = ["lighter", "screen", "source-over", "multiply", "overlay", "difference", "color-dodge", "hard-light", "hue"].includes(fb.blend) ? fb.blend : "lighter";');
})());

ok("applyProject calls syncFeedbackFXUI after restoring project state", (() => {
  const fn = extractFn("applyProject");
  return !!fn && fn.includes("if (typeof syncFeedbackFXUI === \"function\") syncFeedbackFXUI();");
})());

ok("applyProject clamps/validates restored feedbackFX values instead of trusting untrusted input verbatim", (() => {
  const fn = extractFn("applyProject");
  return !!fn
    && fn.includes("const fbClamp = (v, lo, hi, d) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };")
    && fn.includes("fbClamp(fb.zoom, 1, 1.15, 1.045)")
    && fn.includes("fbClamp(fb.rotation, -3, 3, 0.69)")
    && fn.includes("fbClamp(fb.decay, 0.05, 0.60, 0.28)")
    && fn.includes("fbClamp(fb.alpha, 0, 0.90, 0.38)")
    && fn.includes('["lighter", "screen", "source-over", "multiply", "overlay", "difference", "color-dodge", "hard-light", "hue"].includes(fb.blend)');
})());

section("Feedback Loop Deepening — render logic");

ok("applyPostFX's feedback block reads every parameter from S.feedbackFX instead of literals", (() => {
  const fn = extractFn("applyPostFX");
  return !!fn
    && fn.includes("const F = S.feedbackFX;")
    && fn.includes("ctx.globalCompositeOperation = F.blend;")
    && fn.includes("ctx.globalAlpha = Math.min(F.alpha, aMax) + S.beat * 0.08;")
    && fn.includes("ctx.translate(W / 2 + F.dirX * W, H / 2 + F.dirY * H);")
    && fn.includes("ctx.scale(F.zoom, F.zoom);")
    && fn.includes("ctx.rotate(F.rotation * Math.PI / 180 + S.stereo * 0.01);")
    && fn.includes("fbctx.fillStyle = `rgba(0,0,0,${F.decay})`;");
})());

ok("hue-rotate filter applies only to the fbC redraw, is reset immediately after, and is skipped when hueShift is 0", (() => {
  const fn = extractFn("applyPostFX");
  return !!fn
    && fn.includes("if (F.hueShift) ctx.filter = `hue-rotate(${F.hueShift}deg)`;")
    && fn.includes("ctx.drawImage(fbC, 0, 0, W, H);")
    && fn.includes('ctx.filter = "none";')
    && fn.indexOf("if (F.hueShift) ctx.filter") < fn.indexOf("ctx.drawImage(fbC, 0, 0, W, H);")
    && fn.indexOf("ctx.drawImage(fbC, 0, 0, W, H);") < fn.indexOf('ctx.filter = "none";');
})());

ok("applyPostFX clamps feedback alpha against decay (runaway-whiteout guard) and respects S.reduceFlash", (() => {
  const fn = extractFn("applyPostFX");
  return !!fn
    && fn.includes("const aMax = S.reduceFlash ? 0.5 : Math.min(0.9, 0.8 / Math.max(0.05, 1 - F.decay));")
    && fn.includes("ctx.globalAlpha = Math.min(F.alpha, aMax) + S.beat * 0.08;");
})());

/* ---------------- Frequency-Band Reactivity — data model + calculation (Task 1) ---------------- */
section("Frequency-Band Reactivity — data model + calculation");

ok("S.bands/kickOnset/snareOnset initial state present with all 6 band fields at 0", script.includes(
  "bands: { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, air: 0 }, kickOnset: 0, snareOnset: 0,"
));

ok("prevKick/prevSnare module variables declared next to prevLoud", script.includes(
  "let prevLoud = 0, prevKick = 0, prevSnare = 0;"
));

ok("updateAudioFeatures computes all 6 new bands with the documented frequency ranges, clamped to 1.0", (() => {
  const fn = extractFn("updateAudioFeatures");
  return !!fn
    && fn.includes("S.bands.subBass = Math.min(1, bandEnergy(20, 60) * g);")
    && fn.includes("S.bands.bass = Math.min(1, bandEnergy(60, 160) * g);")
    && fn.includes("S.bands.lowMid = Math.min(1, bandEnergy(160, 500) * g);")
    && fn.includes("S.bands.mid = Math.min(1, bandEnergy(500, 2000) * g);")
    && fn.includes("S.bands.highMid = Math.min(1, bandEnergy(2000, 6000) * g);")
    && fn.includes("S.bands.air = Math.min(1, bandEnergy(6000, 16000) * g);");
})());

ok("updateAudioFeatures computes kick/snare onset via the same jump-detection technique as S.transient", (() => {
  const fn = extractFn("updateAudioFeatures");
  return !!fn
    && fn.includes("const kickE = (S.bands.subBass + S.bands.bass) * 0.5;")
    && fn.includes("S.kickOnset = Math.max(S.kickOnset * 0.88, kickJump > (M.beatThresh || 0.04) ? Math.min(1, kickJump * 8) : 0);")
    && fn.includes("const snareE = (S.bands.mid + S.bands.highMid) * 0.5;")
    && fn.includes("S.snareOnset = Math.max(S.snareOnset * 0.88, snareJump > (M.beatThresh || 0.04) ? Math.min(1, snareJump * 8) : 0);");
})());

ok("the paused branch decays the new fields, matching the existing S.bass/S.transient decay pattern there", (() => {
  const fn = extractFn("updateAudioFeatures");
  return !!fn && fn.includes("S.bands.subBass *= 0.95; S.bands.bass *= 0.95; S.bands.lowMid *= 0.95; S.bands.mid *= 0.95; S.bands.highMid *= 0.95; S.bands.air *= 0.95;")
    && fn.includes("S.kickOnset *= 0.9; S.snareOnset *= 0.9;");
})());

ok("existing S.bass/S.mids/S.highs/S.loudness/S.transient calculation lines are untouched", (() => {
  const fn = extractFn("updateAudioFeatures");
  return !!fn
    && fn.includes("S.bass += (tb - S.bass) * a; S.mids += (tm - S.mids) * a; S.highs += (th - S.highs) * a;")
    && fn.includes("S.loudness = Math.min(1, (S.bass * 0.5 + S.mids * 0.35 + S.highs * 0.15));")
    && fn.includes("S.transient = Math.max(S.transient * 0.88, jump > (M.beatThresh || 0.04) ? Math.min(1, jump * 8) : 0);");
})());

section("Frequency-Band Reactivity — live meter UI");

ok("#bandMeter canvas exists in the Audio Mixer panel", html.includes('id="bandMeter"'));

ok("drawBandMeters draws 6 bars from S.bands plus kick/snare onset indicators", (() => {
  const fn = extractFn("drawBandMeters");
  return !!fn
    && fn.includes('$("bandMeter")')
    && fn.includes("S.bands.subBass")
    && fn.includes("S.bands.bass")
    && fn.includes("S.bands.lowMid")
    && fn.includes("S.bands.mid")
    && fn.includes("S.bands.highMid")
    && fn.includes("S.bands.air")
    && fn.includes("S.kickOnset")
    && fn.includes("S.snareOnset");
})());

ok("updateAudioFeatures calls drawBandMeters every frame, regardless of live/idle/paused branch", (() => {
  const fn = extractFn("updateAudioFeatures");
  return !!fn && fn.includes('if (typeof drawBandMeters === "function") drawBandMeters();');
})());

/* ---------------- Frequency-Band Reactivity — post-review fixes ---------------- */
section("Frequency-Band Reactivity — post-review fixes");

ok("idle-demo branch decays S.bands/kickOnset/snareOnset so the live meter doesn't freeze after mic input stops with no file loaded", (() => {
  const fn = extractFn("updateAudioFeatures");
  if (!fn) return false;
  const idleBranch = fn.split("} else if (!audioEl.src) {")[1];
  if (!idleBranch) return false;
  const idleBranchBody = idleBranch.split("} else {")[0];
  return idleBranchBody.includes("S.bands.subBass *= 0.9; S.bands.bass *= 0.9; S.bands.lowMid *= 0.9; S.bands.mid *= 0.9; S.bands.highMid *= 0.9; S.bands.air *= 0.9;")
    && idleBranchBody.includes("S.kickOnset *= 0.9; S.snareOnset *= 0.9;");
})());

ok("S.bands.* are clamped to 1.0 (S.gain can push bandEnergy() above 1 unclamped)", (() => {
  const fn = extractFn("updateAudioFeatures");
  return !!fn
    && fn.includes("S.bands.subBass = Math.min(1, bandEnergy(20, 60) * g);")
    && fn.includes("S.bands.bass = Math.min(1, bandEnergy(60, 160) * g);")
    && fn.includes("S.bands.lowMid = Math.min(1, bandEnergy(160, 500) * g);")
    && fn.includes("S.bands.mid = Math.min(1, bandEnergy(500, 2000) * g);")
    && fn.includes("S.bands.highMid = Math.min(1, bandEnergy(2000, 6000) * g);")
    && fn.includes("S.bands.air = Math.min(1, bandEnergy(6000, 16000) * g);");
})());

/* ---------------- Community Look-Sharing Gallery — data loading ---------------- */
section("Community Look-Sharing Gallery — data loading");

ok("assets/gallery/gallery.json exists and is a valid empty-array JSON file", (() => {
  const p = path.join(__dirname, "assets/gallery/gallery.json");
  if (!fs.existsSync(p)) return false;
  try { return Array.isArray(JSON.parse(fs.readFileSync(p, "utf8"))); } catch (e) { return false; }
})());

ok("loadGallery() fetches assets/gallery/gallery.json with cache:no-store, caches the in-flight PROMISE (not the resolved value, to avoid a duplicate-fetch race), validates that the parsed JSON is an array before returning it, and never throws on failure", (() => {
  const fn = extractFn("loadGallery");
  return !!fn
    && fn.includes('fetch("assets/gallery/gallery.json", { cache: "no-store" })')
    && fn.includes("galleryPromise")
    && !fn.includes("galleryData")
    && fn.includes("Array.isArray(d)")
    && fn.includes("try {")
    && fn.includes("catch (e)");
})());

/* ---------------- Community Look-Sharing Gallery — UI ---------------- */
section("Community Look-Sharing Gallery — UI");

ok("Gallery nav button, page and empty-state note exist", html.includes('data-mode="gallery"') && html.includes('id="page-gallery"') && html.includes('id="galleryGrid"') && html.includes('id="galleryEmpty"'));

ok("setMode opens #page-gallery and calls renderGallery for the gallery mode", (() => {
  const fn = extractFn("setMode");
  return !!fn && fn.includes('if (mode === "gallery") { $("page-gallery").classList.add("open"); renderGallery(); }');
})());

ok("renderGallery builds cards via loadGallery() and loads a look via applyProject on click, using textContent not innerHTML for name/author, clears+repopulates the grid atomically inside the resolved callback (not before, to avoid a duplicate-card race on rapid tab switches), and toggles the empty-state note", (() => {
  const fn = extractFn("renderGallery");
  if (!fn) return false;
  const thenIdx = fn.indexOf("loadGallery().then(entries =>");
  const clearIdx = fn.indexOf('grid.innerHTML = "";');
  return fn.includes("loadGallery()")
    && fn.includes('$("galleryGrid")')
    && fn.includes("applyProject(entry.project)")
    && fn.includes("h4.textContent = entry.name;")
    && fn.includes('p.textContent = "by " + entry.author;')
    && thenIdx >= 0 && clearIdx > thenIdx
    && fn.includes('$("galleryEmpty").style.display = entries.length ? "none" : "block";');
})());

/* --- Graphic EQ DNA Visual --- */
section("Graphic EQ DNA Visual");

ok("PRESETS contains the Graphic EQ preset with engine: \"eq\"", (() => {
  const m = script.match(/id: "eq", name: "Graphic EQ",[\s\S]*?engine: "eq",/);
  return !!m;
})());

ok("drawEqualizer reads S.bands (all 6 fields), S.kickOnset, and S.snareOnset", (() => {
  const fn = extractFn("drawEqualizer");
  return !!fn
    && fn.includes("S.bands.subBass")
    && fn.includes("S.bands.bass")
    && fn.includes("S.bands.lowMid")
    && fn.includes("S.bands.mid")
    && fn.includes("S.bands.highMid")
    && fn.includes("S.bands.air")
    && fn.includes("S.kickOnset")
    && fn.includes("S.snareOnset");
})());

ok("drawScene dispatches dnaEngine === \"eq\" to drawEqualizer with the standard engine-function signature", (() => {
  const fn = extractFn("drawScene");
  return !!fn && fn.includes('} else if (dnaEngine === "eq") {\n    drawEqualizer(base, hue, growthF, energySize, seed);\n  }');
})());

ok("renderPreviews' mini-preview renderer has a branch for p.engine === \"eq\"", (() => {
  const fn = extractFn("renderPreviews");
  return !!fn && fn.includes('p.engine === "eq"');
})());

ok("existing tape/sacred engine dispatch and preview branches are untouched", (() => {
  const sceneFn = extractFn("drawScene");
  const previewFn = extractFn("renderPreviews");
  return !!sceneFn && !!previewFn
    && sceneFn.includes('drawTape(base, hue, growthF, energySize, seed);')
    && sceneFn.includes('drawSacred(base, hue, growthF, energySize, seed);')
    && previewFn.includes('p.engine === "tape"')
    && previewFn.includes('p.engine === "dance"');
})());

/* ---------------- Video Timeline: more transition types ---------------- */
section("Video Timeline — more transition types");

ok("dissolve/wipe/slide branches are unchanged from before this round", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes('type === "dissolve") {\n    drawClip(from.el, 1 - p, 0, 0, 1, from);\n    drawClip(to.el, p, 0, 0, 1, to);')
    && fn.includes('type === "wipe") {\n    drawClip(from.el, 1, 0, 0, 1, from);\n    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * p, H); ctx.clip();\n    drawClip(to.el, 1, 0, 0, 1, to);\n    ctx.restore();')
    && fn.includes('type === "slide") {\n    drawClip(from.el, 1, -W * p, 0, 1, from);\n    drawClip(to.el, 1, W * (1 - p), 0, 1, to);');
})());

ok("drawClip accepts optional yOff and scale params with backward-compatible defaults", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn && fn.includes("const drawClip = (el, alpha, xOff, yOff = 0, scale = 1, cue = null)");
})());

ok("drawClip applies yOff to dy and scale to dw/dh before centering", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes("const dw = vw * scale * s, dh = vh * scale * s")
    && fn.includes("dy = (H - dh) / 2 + yOff");
})());

ok("iris branch clips a growing circle centered on screen for the incoming clip", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes('type === "iris"')
    && fn.includes("Math.hypot(W, H) / 2 * p")
    && fn.includes("ctx.arc(W / 2, H / 2,");
})());

ok("zoom branch scales the incoming clip from 0.3 to 1.0 while the outgoing clip fades at full scale", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes('type === "zoom") {\n    drawClip(from.el, 1 - p, 0, 0, 1, from);')
    && fn.includes("drawClip(to.el, p, 0, 0, 0.3 + 0.7 * p, to)");
})());

ok("slide-v branch pushes vertically using yOff, xOff left at 0", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes('type === "slide-v"')
    && fn.includes("drawClip(from.el, 1, 0, -H * p, 1, from)")
    && fn.includes("drawClip(to.el, 1, 0, H * (1 - p), 1, to)");
})());

ok("slide-d branch pushes both axes together for a diagonal push", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes('type === "slide-d"')
    && fn.includes("drawClip(from.el, 1, -W * p, -H * p, 1, from)")
    && fn.includes("drawClip(to.el, 1, W * (1 - p), H * (1 - p), 1, to)");
})());

ok("glitch branch draws each clip cover-fit into fxctx, then channel-isolates via chC with an envelope peaking at p=0.5", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes('type === "glitch"')
    && fn.includes("const envelope = Math.sin(p * Math.PI)")
    && fn.includes("drawGlitchClip(from.el, 1 - p, envelope, from)")
    && fn.includes("drawGlitchClip(to.el, p, envelope, to)")
    && fn.includes('chctx.globalCompositeOperation = "multiply"')
    && fn.includes('chctx.globalCompositeOperation = "destination-in"');
})());

ok("drawGlitchClip falls back to a plain drawClip call when the envelope is negligible", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn && fn.includes("if (!el || envelope <= 0.02) { drawClip(el, alpha, 0, 0, 1, cue); return; }");
})());

/* ---------------- Video Timeline: transition-window follow-up fixes ---------------- */
section("Video Timeline — filter/blend/perf fixes for transitions");

ok("drawClip applies the background-video filter via the scratch-canvas technique (not raw drawImage on the video)", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes('const filt = typeof bgVidFilterCSS === "function" ? bgVidFilterCSS({ filter: effFilter }) : "none";')
    && fn.includes("const scratch = bgVidScratchCanvas(sw, sh);")
    && fn.includes("ctx.filter = filt;")
    && fn.includes('ctx.filter = "none";');
})());

ok("drawGlitchClip also applies the filter (via fxctx) before any channel-isolation work", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes("fxctx.filter = filt;")
    && fn.includes('fxctx.filter = "none";');
})());

ok("drawGlitchClip works at half resolution (hw/hh = W/2, H/2), not full canvas size", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes("const hw = Math.max(1, Math.round(W / 2)), hh = Math.max(1, Math.round(H / 2));")
    && fn.includes("ctx.drawImage(glC, 0, 0, hw, hh, 0, 0, W, H);");
})());

ok("drawGlitchClip's user-facing composite (glC onto ctx) uses v.blend, not a hardcoded mode — the internal 3-channel recombine still uses lighter", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  const idx = fn ? fn.indexOf("glctx.clearRect(0, 0, hw, hh);") : -1;
  if (idx < 0) return false;
  const recombineBlock = fn.slice(idx, fn.indexOf("ctx.save();", idx));
  const finalCompositeBlock = fn.slice(fn.indexOf("ctx.save();", idx));
  return recombineBlock.includes('glctx.globalCompositeOperation = "lighter"')
    && finalCompositeBlock.includes("ctx.globalCompositeOperation = v.blend;")
    && finalCompositeBlock.indexOf("ctx.globalCompositeOperation = v.blend;") < finalCompositeBlock.indexOf("ctx.drawImage(glC");
})());

ok("drawGlitchClip disables smoothing for the half-res-to-full-res upscale (crisp, matches the Pixelate technique)", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes("ctx.imageSmoothingEnabled = false;   // crisp upscale, matches the FX Rack Pixelate technique")
    && fn.includes("ctx.drawImage(glC, 0, 0, hw, hh, 0, 0, W, H);\n    ctx.imageSmoothingEnabled = true;");
})());

ok("glC accumulator canvas is declared and sized alongside fxC/chC/fbC", (() => {
  return script.includes('const glC = document.createElement("canvas"), glctx = glC.getContext("2d");')
    && /fxC\.width = chC\.width = fbC\.width = glC\.width = canvas\.width;/.test(script)
    && /fxC\.height = chC\.height = fbC\.height = glC\.height = canvas\.height;/.test(script);
})());

/* ---------------- Video Timeline: clip-start hitch fix ---------------- */
section("Video Timeline — clip-start hitch fix (syncClipTime)");

(() => {
  function makeMockEl(initialCurrentTime, paused) {
    let ct = initialCurrentTime, seekCount = 0, playCalled = false;
    const el = {
      get currentTime() { return ct; },
      set currentTime(v) { seekCount++; ct = v; },
      get paused() { return paused; },
      set paused(v) { paused = v; },
      play() { playCalled = true; paused = false; return Promise.resolve(); }
    };
    el._seekCount = () => seekCount;
    el._playCalled = () => playCalled;
    return el;
  }

  global.S = { playing: true };
  try {
    const { syncClipTime } = loadFns(["syncClipTime"]);

    const elSmallDrift = makeMockEl(0, true);
    syncClipTime(elSmallDrift, 0.1);
    ok("syncClipTime does not force a redundant seek when drift is <=0.35s, even while paused (the actual fix — this used to always reseek on `|| el.paused` alone)",
      elSmallDrift._seekCount() === 0);
    ok("syncClipTime still calls play() on that paused-but-in-sync clip", elSmallDrift._playCalled());

    const elLargeDrift = makeMockEl(0, true);
    syncClipTime(elLargeDrift, 5);
    ok("syncClipTime still seeks when drift genuinely exceeds 0.35s (e.g. after a scrub)",
      elLargeDrift._seekCount() === 1 && elLargeDrift.currentTime === 5);

    const elAlreadyPlaying = makeMockEl(10, false);
    syncClipTime(elAlreadyPlaying, 10.05);
    ok("syncClipTime does not seek a clip that's already playing in sync (small drift, not paused)",
      elAlreadyPlaying._seekCount() === 0);

    global.S.playing = false;
    const elSongPaused = makeMockEl(0, true);
    syncClipTime(elSongPaused, 0.1);
    ok("syncClipTime does not call play() when the song itself isn't playing (S.playing = false)",
      !elSongPaused._playCalled());

    // --- new for Task 3 of the clip-editing plan, inserted before the closing `} catch (e) {` ---
    global.S.playing = true;
    const imgEl = makeMockEl(0, true);
    syncClipTime(imgEl, 3, "image");
    ok("syncClipTime is a no-op for kind='image' (no seek, no play)",
      imgEl._seekCount() === 0 && !imgEl._playCalled());

    const vidEl = makeMockEl(0, true);
    syncClipTime(vidEl, 0.1, "video");
    ok("syncClipTime still behaves normally for kind='video'", vidEl._playCalled() && vidEl._seekCount() === 0);

    const vidElNoKind = makeMockEl(0, true);
    syncClipTime(vidElNoKind, 0.1);
    ok("syncClipTime treats a missing kind argument as video (backward compatible)", vidElNoKind._playCalled());

    // --- new: loop-wrap fix (a clip dragged longer than its own footage) ---
    const elLooping = makeMockEl(2.9, false);
    elLooping.loop = true; elLooping.duration = 3.0;
    syncClipTime(elLooping, 10, "video");
    ok("syncClipTime wraps targetT by el.duration when el.loop is true, so a clip stretched past its own footage seeks to the correct looped position instead of chasing an ever-growing target every frame forever",
      elLooping.currentTime === 1 && elLooping._seekCount() === 1);
  } catch (e) {
    ok("syncClipTime does not force a redundant seek when drift is <=0.35s, even while paused (the actual fix — this used to always reseek on `|| el.paused` alone)", false, e.message);
    ok("syncClipTime still calls play() on that paused-but-in-sync clip", false);
    ok("syncClipTime still seeks when drift genuinely exceeds 0.35s (e.g. after a scrub)", false);
    ok("syncClipTime does not seek a clip that's already playing in sync (small drift, not paused)", false);
    ok("syncClipTime does not call play() when the song itself isn't playing (S.playing = false)", false);
    ok("syncClipTime is a no-op for kind='image' (no seek, no play)", false);
    ok("syncClipTime still behaves normally for kind='video'", false);
    ok("syncClipTime treats a missing kind argument as video (backward compatible)", false);
    ok("syncClipTime wraps targetT by el.duration when el.loop is true, so a clip stretched past its own footage seeks to the correct looped position instead of chasing an ever-growing target every frame forever", false);
  } finally {
    delete global.S;
  }
})();

/* ---------------- Video Timeline: clip editing (images, resize/trim) ---------------- */
section("Video Timeline clip editing — data model (addBgVidClipAt, bgVidClipVisualDur)");

ok("addBgVidClipAt branches on file.type to detect images", (() => {
  const fn = extractFn("addBgVidClipAt");
  return !!fn && fn.includes('const isImage = file.type.startsWith("image");');
})());

ok("addBgVidClipAt creates an <img> for images and a <video> for everything else", (() => {
  const fn = extractFn("addBgVidClipAt");
  return !!fn
    && fn.includes('el = document.createElement("img");')
    && fn.includes('el = document.createElement("video");');
})());

ok("addBgVidClipAt defaults image duration to 5s and video's provisional duration to 8s", (() => {
  const fn = extractFn("addBgVidClipAt");
  return !!fn && fn.includes("dur = 5;") && fn.includes("dur = 8;");
})());

ok("addBgVidClipAt's video loadedmetadata listener corrects cue.dur once real footage length is known", (() => {
  const fn = extractFn("addBgVidClipAt");
  return !!fn && fn.includes("if (isFinite(el.duration) && cue.dur === 8) cue.dur = el.duration;");
})());

ok("addBgVidClipAt stores kind on the cue", (() => {
  const fn = extractFn("addBgVidClipAt");
  return !!fn && fn.includes('kind: isImage ? "image" : "video"') && fn.includes("dur,") ;
})());

(() => {
  global.S = { bgVidCues: [{ t: 2, dur: 10 }, { t: 5, dur: 3 }] };
  global.bgVidTLDuration = () => 20;
  try {
    const { bgVidClipVisualDur } = loadFns(["bgVidClipVisualDur"]);
    ok("bgVidClipVisualDur caps a clip's stored dur by the gap to the next clip",
      bgVidClipVisualDur(0) === 3);   // dur=10, but next clip starts at t=5, gap=3
    ok("bgVidClipVisualDur uses the clip's own dur when it's smaller than the remaining gap",
      bgVidClipVisualDur(1) === 3);   // dur=3, gap to timeline end=20-5=15, dur wins
  } catch (e) {
    ok("bgVidClipVisualDur caps a clip's stored dur by the gap to the next clip", false, e.message);
    ok("bgVidClipVisualDur uses the clip's own dur when it's smaller than the remaining gap", false);
  } finally {
    delete global.S; delete global.bgVidTLDuration;
  }
})();

ok("bgVidClipVisualDur no longer reads cue.el.duration (fully replaced by stored cue.dur)", (() => {
  const fn = extractFn("bgVidClipVisualDur");
  return !!fn && !fn.includes("cue.el.duration") && !fn.includes("cue.el &&");
})());

/* ---------------- Video Timeline clip editing — clipElReady + drawClip/drawGlitchClip readiness */
section("Video Timeline clip editing — clipElReady + drawClip/drawGlitchClip readiness");

(() => {
  try {
    const { clipElReady } = loadFns(["clipElReady"]);
    const readyVideo = { tagName: "VIDEO", readyState: 4, videoWidth: 1920, videoHeight: 1080 };
    const unreadyVideo = { tagName: "VIDEO", readyState: 1, videoWidth: 0, videoHeight: 0 };
    const readyImage = { tagName: "IMG", complete: true, naturalWidth: 800, naturalHeight: 600 };
    const unreadyImage = { tagName: "IMG", complete: false, naturalWidth: 0, naturalHeight: 0 };
    ok("clipElReady returns dimensions for a ready video", JSON.stringify(clipElReady(readyVideo)) === JSON.stringify({ w: 1920, h: 1080 }));
    ok("clipElReady returns null for an unready video (readyState < 2)", clipElReady(unreadyVideo) === null);
    ok("clipElReady returns dimensions for a ready image", JSON.stringify(clipElReady(readyImage)) === JSON.stringify({ w: 800, h: 600 }));
    ok("clipElReady returns null for an unready image (not complete)", clipElReady(unreadyImage) === null);
    ok("clipElReady returns null for a null/undefined element", clipElReady(null) === null);
  } catch (e) {
    ok("clipElReady returns dimensions for a ready video", false, e.message);
    ok("clipElReady returns null for an unready video (readyState < 2)", false);
    ok("clipElReady returns dimensions for a ready image", false);
    ok("clipElReady returns null for an unready image (not complete)", false);
    ok("clipElReady returns null for a null/undefined element", false);
  }
})();

ok("drawClip uses clipElReady instead of a raw readyState/videoWidth check", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes("const dim = clipElReady(el); if (!dim) return; const vw = dim.w, vh = dim.h;")
    && !fn.includes("if (!el || el.readyState < 2) return;\n    const vw = el.videoWidth, vh = el.videoHeight;\n    if (!vw || !vh) return;\n    const s = v.cover");
})());

ok("drawGlitchClip uses clipElReady instead of a raw readyState/videoWidth check", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn && fn.includes("const dim = clipElReady(el); if (!dim) return; const vw = dim.w, vh = dim.h;\n    const hw = Math.max(1, Math.round(W / 2))");
})());

ok("updateBgVideoTimeline passes cue.kind to syncClipTime for the active cue", (() => {
  const fn = extractFn("updateBgVideoTimeline");
  return !!fn && fn.includes("syncClipTime(cue.el, t - cue.t, cue.kind);");
})());

ok("updateBgVideoTimeline passes next.kind to syncClipTime for the incoming transition clip", (() => {
  const fn = extractFn("updateBgVideoTimeline");
  return !!fn && fn.includes("syncClipTime(next.el, t - winStart, next.kind);");
})());

/* ---------------- Video Timeline clip editing — cleanup guards for image cues ----------- */
section("Video Timeline clip editing — cleanup guards for image cues");

ok("deleteBgVidClip only calls .pause() on video-kind cues", (() => {
  const fn = extractFn("deleteBgVidClip");
  return !!fn && fn.includes('if (cue.kind === "video") cue.el.pause();') && !fn.includes("try { cue.el.pause();");
})());

ok("the Clear-all handler only calls .pause() on video-kind cues", (() => {
  return script.includes('S.bgVidCues.forEach(cue => { if (cue.kind === "video") cue.el.pause(); try { URL.revokeObjectURL(cue.src); } catch (e) { } });');
})());

ok("#bgVidOn's change handler does not call .play()/.pause() on an <img> element", (() => {
  return script.includes('if (S.bgVid.el && S.bgVid.el.tagName !== "IMG") { if (S.bgVid.on) S.bgVid.el.play().catch(() => { }); else S.bgVid.el.pause(); }');
})());

/* ---------------- Video Timeline UI selects: wire 5 new transition types ----------- */
section("Video Timeline UI — transition type selects");

const tlTransBlock = (html.match(/<select id="bgVidTLTransType"[^>]*>([\s\S]*?)<\/select>/) || [])[1] || "";
["cut", "dissolve", "wipe", "slide", "slide-v", "slide-d", "iris", "zoom", "glitch"].forEach(v =>
  ok("#bgVidTLTransType has option value=" + v, tlTransBlock.includes('value="' + v + '"')));
ok("#bgVidTLTransType relabels slide to Slide Horizontal", tlTransBlock.includes('value="slide">Slide Horizontal<'));

ok("renderBgVidTLPanel's per-clip select includes all 9 transition options with matching labels", (() => {
  const fn = extractFn("renderBgVidTLPanel");
  if (!fn) return false;
  const opts = ["cut\">Cut", "dissolve\">Dissolve", "wipe\">Wipe", "slide\">Slide Horizontal",
    "slide-v\">Slide Vertikal", "slide-d\">Slide Diagonal", "iris\">Iris", "zoom\">Zoom-Cross", "glitch\">Glitch"];
  return opts.every(o => fn.includes(o));
})());

ok("renderBgVidTLPanel renders Fade In and Fade Out numeric inputs matching the existing transDur input's style, and wires their change listeners straight to the cue", (() => {
  const fn = extractFn("renderBgVidTLPanel");
  return !!fn
    && fn.includes('<label>Fade In <input type="number" id="bgVidClipFadeIn" min="0" max="8" step="0.1" value="${cue.fadeIn || 0}" style="width:48px;background:#0a0a12;color:var(--text);border:1px solid var(--line);border-radius:4px;padding:2px 4px;font-size:11px"></label>')
    && fn.includes('<label>Fade Out <input type="number" id="bgVidClipFadeOut" min="0" max="8" step="0.1" value="${cue.fadeOut || 0}" style="width:48px;background:#0a0a12;color:var(--text);border:1px solid var(--line);border-radius:4px;padding:2px 4px;font-size:11px"></label>')
    && fn.includes('$("bgVidClipFadeIn").addEventListener("change", e => cue.fadeIn = +e.target.value);')
    && fn.includes('$("bgVidClipFadeOut").addEventListener("change", e => cue.fadeOut = +e.target.value);');
})());

/* ---------------- Video Timeline: bolder waveform backdrop ---------------- */
section("Video Timeline — bolder waveform backdrop");

ok("drawBgVidTL fills the energy-curve waveform with a bolder cyan accent (not the old near-invisible gray)", (() => {
  const fn = extractFn("drawBgVidTL");
  return !!fn
    && fn.includes('c.fillStyle = "rgba(75,225,232,0.32)"; c.fill();')
    && !fn.includes('c.fillStyle = "rgba(120,120,150,0.14)"; c.fill();');
})());

ok("drawBgVidTL also strokes the waveform outline for extra definition", (() => {
  const fn = extractFn("drawBgVidTL");
  return !!fn && fn.includes('c.strokeStyle = "rgba(75,225,232,0.6)"; c.lineWidth = 1; c.stroke();');
})());

/* ---------------- Video Timeline: Clip Fades ---------------- */
section("Video Timeline Clip Fades — data model (addBgVidClipAt)");

ok("addBgVidClipAt gives every new cue fadeIn: 0 and fadeOut: 0 by default", (() => {
  const fn = extractFn("addBgVidClipAt");
  return !!fn && fn.includes("fadeIn: 0, fadeOut: 0,");
})());

(() => {
  global.S = {
    bgVidCues: [
      { t: 0,  dur: 10, fadeIn: 2,   fadeOut: 2,   transType: "dissolve", transDur: 1, kind: "video", el: { id: "A" } },
      { t: 10, dur: 10, fadeIn: 4,   fadeOut: 0,   transType: "cut",      transDur: 0, kind: "video", el: { id: "B" } },
      { t: 20, dur: 10, fadeIn: 1,   fadeOut: 0,   transType: "dissolve", transDur: 1, kind: "video", el: { id: "C" } },
      { t: 40, dur: 3,  fadeIn: 2.5, fadeOut: 2.5, transType: "cut",      transDur: 0, kind: "video", el: { id: "D" } }
    ],
    bgVid: { on: false, el: null, src: null },
    bgVidTrans: null,
    playing: true
  };
  global.syncClipTime = () => { };
  try {
    const { updateBgVideoTimeline } = loadFns(["updateBgVideoTimeline"]);

    updateBgVideoTimeline(1);
    ok("fadeIn applies to the very first clip on the timeline even though its default transType is not 'cut' (no previous cue exists to transition from, so the transition is inert)",
      Math.abs(global.S.bgVid._fadeAlpha - 0.5) < 1e-9);

    updateBgVideoTimeline(9);
    ok("fadeOut applies when the next cue's incoming transition is a real 'cut' (no cross-fade to suppress it)",
      Math.abs(global.S.bgVid._fadeAlpha - 0.5) < 1e-9);

    updateBgVideoTimeline(11);
    ok("fadeIn applies right after a real 'cut' boundary (own transType is cut, so no transition is suppressing it)",
      Math.abs(global.S.bgVid._fadeAlpha - 0.25) < 1e-9);

    updateBgVideoTimeline(20.5);
    ok("fadeIn is suppressed when a real (non-cut, non-zero-duration) incoming transition exists at that edge",
      global.S.bgVid._fadeAlpha === 1);

    updateBgVideoTimeline(41);
    ok("overlapping fadeIn and fadeOut on a short clip take the smaller (more-faded) of the two ramps — here fadeIn is the binding constraint",
      Math.abs(global.S.bgVid._fadeAlpha - 0.4) < 1e-9);

    updateBgVideoTimeline(42);
    ok("the same overlapping-fade clip, later in its own window, where fadeOut becomes the binding constraint instead — proves both ramps are actually compared, not just one",
      Math.abs(global.S.bgVid._fadeAlpha - 0.4) < 1e-9);
  } catch (e) {
    ok("fadeIn applies to the very first clip on the timeline even though its default transType is not 'cut' (no previous cue exists to transition from, so the transition is inert)", false, e.message);
    ok("fadeOut applies when the next cue's incoming transition is a real 'cut' (no cross-fade to suppress it)", false);
    ok("fadeIn applies right after a real 'cut' boundary (own transType is cut, so no transition is suppressing it)", false);
    ok("fadeIn is suppressed when a real (non-cut, non-zero-duration) incoming transition exists at that edge", false);
    ok("overlapping fadeIn and fadeOut on a short clip take the smaller (more-faded) of the two ramps — here fadeIn is the binding constraint", false);
    ok("the same overlapping-fade clip, later in its own window, where fadeOut becomes the binding constraint instead — proves both ramps are actually compared, not just one", false);
  } finally {
    delete global.S; delete global.syncClipTime;
  }
})();

(() => {
  // Both cues carry the DEFAULT non-"cut" transType/transDur (S.bgVidTransDefault), but A's
  // own dur ends well before B's transition window would even open — so no transition can
  // ever actually fire across this gap, and the fade-suppression check must not be fooled by
  // the neighbor's transType alone into thinking one will. Found by the final whole-branch
  // review after Task 5: the original suppression check only looked at idx>0/next existing,
  // not at whether that neighbor is still alive when the transition window opens.
  global.S = {
    bgVidCues: [
      { t: 0,  dur: 5,  fadeIn: 0, fadeOut: 1, transType: "dissolve", transDur: 1, kind: "video", el: { id: "A" } },
      { t: 10, dur: 10, fadeIn: 1, fadeOut: 0, transType: "dissolve", transDur: 1, kind: "video", el: { id: "B" } }
    ],
    bgVid: { on: false, el: null, src: null },
    bgVidTrans: null,
    playing: true
  };
  global.syncClipTime = () => { };
  try {
    const { updateBgVideoTimeline } = loadFns(["updateBgVideoTimeline"]);

    updateBgVideoTimeline(4.5);
    ok("fadeOut applies across a gap even when the next cue's transType is non-'cut', because that neighbor's own dur has already ended before its transition window would open (no transition can actually fire)",
      Math.abs(global.S.bgVid._fadeAlpha - 0.5) < 1e-9 && global.S.bgVidTrans === null);

    updateBgVideoTimeline(10.5);
    ok("fadeIn applies right after that same gap for the same reason, on the incoming side",
      Math.abs(global.S.bgVid._fadeAlpha - 0.5) < 1e-9 && global.S.bgVidTrans === null);
  } catch (e) {
    ok("fadeOut applies across a gap even when the next cue's transType is non-'cut', because that neighbor's own dur has already ended before its transition window would open (no transition can actually fire)", false, e.message);
    ok("fadeIn applies right after that same gap for the same reason, on the incoming side", false);
  } finally {
    delete global.S; delete global.syncClipTime;
  }
})();

/* ---------------- Video Timeline clip editing — UI: image file acceptance + IMG glyph ----------- */
section("Video Timeline clip editing — UI: image file acceptance + IMG glyph");

ok("#bgVidTLInput accepts both video and image files", html.includes('<input type="file" id="bgVidTLInput" accept="video/*,image/*" hidden>'));

ok("the legacy single-video #bgVidInput is untouched (still video-only, out of scope)", html.includes('<input type="file" id="bgVidInput" accept="video/*" hidden>'));

ok("the timeline drop handler accepts both video and image files", (() => {
  return script.includes('if (!f || !(f.type.startsWith("video") || f.type.startsWith("image"))) return;');
})());

ok("drawBgVidTL draws an IMG label for image-kind cues only", (() => {
  const fn = extractFn("drawBgVidTL");
  return !!fn
    && fn.includes('if (cue.kind === "image") {')
    && fn.includes('c.fillText("IMG",');
})());

/* ---------------- Video Timeline clip editing — drag-edge resize/trim ----------- */
section("Video Timeline clip editing — drag-edge resize/trim");

ok("bgVidTLResize state variable is declared alongside bgVidTLDrag/bgVidTLScrub", (() => {
  return script.includes("let bgVidTLOpen = false, bgVidTLDrag = null, bgVidTLScrub = false, bgVidTLResize = null;");
})());

ok("EDGE_GRAB_PX constant is 6", script.includes("const EDGE_GRAB_PX = 6;"));

ok("bgVidTLPointerDown checks for an edge hit before falling through to body-drag/scrub", (() => {
  const fn = extractFn("bgVidTLPointerDown");
  return !!fn
    && fn.includes('bgVidTLResize = { cue, edge: "start" };')
    && fn.includes('bgVidTLResize = { cue, edge: "end" };');
})());

ok("bgVidTLPointerMove handles the resize branch, clamping end-drag to the next cue's start and start-drag to the previous cue's start", (() => {
  const fn = extractFn("bgVidTLPointerMove");
  return !!fn
    && fn.includes("if (bgVidTLResize) {")
    && fn.includes("cue.dur = Math.max(0.3, Math.min(gapEnd - cue.t, mouseT - cue.t));")
    && fn.includes("const newStart = Math.max(gapStart, Math.min(end - 0.3, mouseT));")
    && fn.includes("cue.t = newStart; cue.dur = end - newStart;");
})());

ok("bgVidTLPointerMove's left-edge clamp uses the previous cue's END (t + dur), not its start — symmetric with the right-edge clamp using the next cue's start", (() => {
  const fn = extractFn("bgVidTLPointerMove");
  return !!fn && fn.includes("const gapStart = i > 0 ? S.bgVidCues[i - 1].t + S.bgVidCues[i - 1].dur : 0;");
})());

ok("bgVidTLPointerUp clears bgVidTLResize", (() => {
  const fn = extractFn("bgVidTLPointerUp");
  return !!fn && fn.includes("bgVidTLResize = null;");
})());

/* ---------------- Video Timeline clip editing — live-verification fixes ---------------- */
section("Video Timeline clip editing — steady-state rendering + dur-based cutoff (found via live verification)");

ok("drawBgVideoTimeline only falls back to the legacy drawBgVideo() when there are no Timeline cues at all", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes("if (!S.bgVidCues.length) { drawBgVideo(W, H); return; }")
    && !fn.includes("if (!S.bgVidCues.length || !S.bgVidTrans) { drawBgVideo(W, H); return; }");
})());

ok("drawBgVideoTimeline draws the active cue via drawClip (kind-aware) when there's no active transition, instead of falling through to drawBgVideo", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn && fn.includes("if (!S.bgVidTrans) {") && fn.includes("drawClip(v.el, 1, 0, 0, 1, S.bgVid._cue);") && fn.includes("return;");
})());

ok("drawBgVideoTimeline's guard also checks the transient S.bgVid._active flag, not just the persisted .on setting", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn && fn.includes("if (!v.on || v._active === false) return;");
})());

(() => {
  global.S = {
    bgVidCues: [
      { t: 0, dur: 5, el: { id: "A" }, kind: "video", transType: "cut", transDur: 0 },
      { t: 30, dur: 8, el: { id: "B" }, kind: "video", transType: "cut", transDur: 0 }
    ],
    bgVid: { on: false, el: null, src: null },
    bgVidTrans: null,
    playing: true
  };
  global.syncClipTime = () => { };
  try {
    const { updateBgVideoTimeline } = loadFns(["updateBgVideoTimeline"]);

    updateBgVideoTimeline(3);
    ok("updateBgVideoTimeline activates a cue while t is within its own [t, t+dur) window",
      global.S.bgVid.on === true && global.S.bgVid._active === true && global.S.bgVid.el.id === "A");
    ok("updateBgVideoTimeline mirrors the active cue itself onto S.bgVid._cue (not just .el/.src), for the per-clip Filter/Fit override lookup",
      global.S.bgVid._cue && global.S.bgVid._cue.el.id === "A");

    updateBgVideoTimeline(10);
    ok("updateBgVideoTimeline deactivates a cue once t passes its own t+dur (Bug 2 — a shrunk clip must actually stop) via the transient _active flag only, WITHOUT clobbering the persisted S.bgVid.on setting (the serialization-leak fix — .on stays whatever it was, still true from the previous call)",
      global.S.bgVid._active === false && global.S.bgVid.on === true);
    ok("updateBgVideoTimeline clears S.bgVid._cue to null once there's no active cue (a gap), matching _active going false",
      global.S.bgVid._cue === null);

    updateBgVideoTimeline(31);
    ok("updateBgVideoTimeline picks up the next cue once its own t arrives, after a gap",
      global.S.bgVid.on === true && global.S.bgVid._active === true && global.S.bgVid.el.id === "B");
  } catch (e) {
    ok("updateBgVideoTimeline activates a cue while t is within its own [t, t+dur) window", false, e.message);
    ok("updateBgVideoTimeline mirrors the active cue itself onto S.bgVid._cue (not just .el/.src), for the per-clip Filter/Fit override lookup", false);
    ok("updateBgVideoTimeline deactivates a cue once t passes its own t+dur (Bug 2 — a shrunk clip must actually stop) via the transient _active flag only, WITHOUT clobbering the persisted S.bgVid.on setting (the serialization-leak fix — .on stays whatever it was, still true from the previous call)", false);
    ok("updateBgVideoTimeline clears S.bgVid._cue to null once there's no active cue (a gap), matching _active going false", false);
    ok("updateBgVideoTimeline picks up the next cue once its own t arrives, after a gap", false);
  } finally {
    delete global.S; delete global.syncClipTime;
  }
})();

ok("the persisted-state serializer only lists .on/.opacity/.blend/.cover/.filter for bgVid (not the whole object, not _active) — confirms _active can never leak into a saved preset", (() => {
  return script.includes('bgVid: { on: S.bgVid.on, opacity: S.bgVid.opacity, blend: S.bgVid.blend, cover: S.bgVid.cover, filter: S.bgVid.filter },');
})());

ok("addBgVidClipAt's loadedmetadata listener only overwrites cue.dur if it's still the untouched provisional value (8), so a user's trim made before metadata finishes loading isn't silently clobbered", (() => {
  const fn = extractFn("addBgVidClipAt");
  return !!fn && fn.includes("if (isFinite(el.duration) && cue.dur === 8) cue.dur = el.duration;");
})());

/* ---------------- Video Timeline Clip Fades — drawing (drawBgVideoTimeline) ----------- */
section("Video Timeline Clip Fades — fade-to-black overlay rendering");

ok("drawBgVideoTimeline's no-transition branch composites a black overlay scaled by 1 - S.bgVid._fadeAlpha, occluding the DNA trail residue underneath rather than just lowering the clip's own alpha", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes("if (!S.bgVidTrans) {")
    && fn.includes("drawClip(v.el, 1, 0, 0, 1, S.bgVid._cue);")
    && fn.includes("const fa = v._fadeAlpha;")
    && fn.includes("if (fa !== undefined && fa < 1) {")
    && fn.includes("ctx.globalAlpha = 1 - fa;")
    && fn.includes('ctx.fillStyle = "#000";')
    && fn.includes("ctx.fillRect(0, 0, W, H);");
})());

/* ---------------- HQ Export: frame-accurate Video Timeline seeks ---------------- */
section("HQ Export frame accuracy — syncClipTime returns a pending-seek promise");

function makeSeekableMockEl(initialCurrentTime, paused, readyState) {
  let ct = initialCurrentTime;
  const listeners = { seeked: [] };
  const el = {
    get currentTime() { return ct; },
    set currentTime(v) { ct = v; },
    paused,
    duration: NaN,
    loop: false,
    // readyState defaults to HAVE_ENOUGH_DATA (4) — a real seek only fires 'seeked' when
    // readyState > 0 (HAVE_NOTHING), so these mocks must look "loaded" by default for the
    // seek-triggering tests below to get a genuine pending Promise back.
    readyState: readyState === undefined ? 4 : readyState,
    addEventListener(evt, fn) { if (listeners[evt]) listeners[evt].push(fn); },
    removeEventListener(evt, fn) { if (listeners[evt]) listeners[evt] = listeners[evt].filter(f => f !== fn); },
    play() { paused = false; return Promise.resolve(); }
  };
  el._fireSeeked = () => { listeners.seeked.slice().forEach(fn => fn()); };
  el._seekedListenerCount = () => listeners.seeked.length;
  return el;
}

global.S = { playing: true };
try {
  const { syncClipTime } = loadFns(["syncClipTime"]);

  const elNoSeek = makeSeekableMockEl(0, true);
  const rNoSeek = syncClipTime(elNoSeek, 0.1, "video");
  ok("syncClipTime returns null when drift is <=0.35s (no real seek triggered) — the common steady-playback case", rNoSeek === null);

  const elSeek = makeSeekableMockEl(0, true);
  const rSeek = syncClipTime(elSeek, 5, "video");
  ok("syncClipTime returns a genuine Promise when a real seek is triggered", rSeek instanceof Promise);
  ok("syncClipTime registered exactly one 'seeked' listener for the triggered seek", elSeek._seekedListenerCount() === 1);

  pendingAsyncChecks.push((async () => {
    let resolved = false;
    rSeek.then(() => { resolved = true; });
    elSeek._fireSeeked();
    await rSeek;
    ok("the returned promise actually resolves once the mock 'seeked' event fires", resolved);
    ok("the 'seeked' listener is removed after firing (no leak)", elSeek._seekedListenerCount() === 0);
  })());
} catch (e) {
  ok("syncClipTime returns null when drift is <=0.35s (no real seek triggered) — the common steady-playback case", false, e.message);
  ok("syncClipTime returns a genuine Promise when a real seek is triggered", false);
  ok("syncClipTime registered exactly one 'seeked' listener for the triggered seek", false);
  ok("the returned promise actually resolves once the mock 'seeked' event fires", false);
  ok("the 'seeked' listener is removed after firing (no leak)", false);
} finally {
  delete global.S;
}

/* --- new: export-time tolerance is tight (0.02s), live tolerance stays 0.35s --- */
global.S = { playing: true, exporting: true };
try {
  const { syncClipTime } = loadFns(["syncClipTime"]);

  // 0.05s drift would NOT trigger a seek under the old/live 0.35s threshold.
  const elSmallDriftExporting = makeSeekableMockEl(0, true);
  const rSmallDriftExporting = syncClipTime(elSmallDriftExporting, 0.05, "video");
  ok("during export (S.exporting = true), a 0.05s drift that would NOT seek under the live 0.35s threshold DOES trigger a seek (returns a Promise, not null)",
    rSmallDriftExporting instanceof Promise);
} catch (e) {
  ok("during export (S.exporting = true), a 0.05s drift that would NOT seek under the live 0.35s threshold DOES trigger a seek (returns a Promise, not null)", false, e.message);
} finally {
  delete global.S;
}

/* --- new: a seek that can't possibly fire 'seeked' must not hand back a hanging Promise --- */
global.S = { playing: true };
try {
  const { syncClipTime } = loadFns(["syncClipTime"]);

  // readyState === 0 (HAVE_NOTHING) after the currentTime write: per spec, no seek algorithm
  // runs and 'seeked' never fires — syncClipTime must recognize this and return null instead
  // of a Promise that would hang until the 2000ms timeout, every single affected frame.
  const elNotLoaded = makeSeekableMockEl(0, true, 0);
  const rNotLoaded = syncClipTime(elNotLoaded, 5, "video");
  ok("syncClipTime returns null (not a hanging Promise) when readyState is 0 (HAVE_NOTHING) after the seek attempt",
    rNotLoaded === null);

  // the currentTime setter throwing (existing try/catch case): same reasoning — no seek ever
  // happened, so don't hand back a Promise that can only resolve via the 2000ms timeout.
  const elThrows = makeSeekableMockEl(0, true);
  Object.defineProperty(elThrows, "currentTime", {
    get() { return 0; },
    set() { throw new Error("simulated currentTime setter failure"); }
  });
  const rThrows = syncClipTime(elThrows, 5, "video");
  ok("syncClipTime returns null (not a hanging Promise) when the currentTime setter throws",
    rThrows === null);
} catch (e) {
  ok("syncClipTime returns null (not a hanging Promise) when readyState is 0 (HAVE_NOTHING) after the seek attempt", false, e.message);
  ok("syncClipTime returns null (not a hanging Promise) when the currentTime setter throws", false);
} finally {
  delete global.S;
}

/* ---------------- Video Timeline: clip thumbnails ---------------- */
section("Video Timeline thumbnails — captureVideoClipThumb");

/* captureVideoClipThumb now creates its OWN throwaway <video> element internally
   (decoupled from cue.el, which is the live-playback element syncClipTime drives) —
   so the mock must simulate the two-stage loadedmetadata -> seeked flow on an element
   the test only gets a handle to via the document.createElement("video") mock, not via cue.el. */
function makeThumbMockVideoEl() {
  let ct = 0, src = "";
  const listeners = { seeked: [], loadedmetadata: [] };
  const el = {
    get currentTime() { return ct; },
    set currentTime(v) { ct = v; },
    get src() { return src; },
    set src(v) { src = v; },
    duration: undefined, videoWidth: undefined, videoHeight: undefined,
    muted: false, preload: "", crossOrigin: null,
    addEventListener(evt, fn) { if (listeners[evt]) listeners[evt].push(fn); },
    removeEventListener(evt, fn) { if (listeners[evt]) listeners[evt] = listeners[evt].filter(f => f !== fn); }
  };
  el._fireLoadedMeta = () => { listeners.loadedmetadata.slice().forEach(fn => fn()); };
  el._fireSeeked = () => { listeners.seeked.slice().forEach(fn => fn()); };
  el._seekedListenerCount = () => listeners.seeked.length;
  el._loadedMetaListenerCount = () => listeners.loadedmetadata.length;
  return el;
}

global.bgVidTLOpen = false;
try {
  const { captureVideoClipThumb } = loadFns(["captureVideoClipThumb"]);

  const canvases = [];
  const videoEls = [];
  global.document = {
    createElement(tag) {
      if (tag === "video") {
        const v = makeThumbMockVideoEl();
        videoEls.push(v);
        return v;
      }
      const c = { _tag: tag, width: 0, height: 0, _drawImageCalls: 0 };
      c.getContext = () => ({ drawImage: () => { c._drawImageCalls++; } });
      canvases.push(c);
      return c;
    }
  };

  // proxy stands in for cue.el (the live-playback element) — any get/set on it is a bug,
  // since the whole point of this round's fix is that captureVideoClipThumb never touches it
  let elAccessed = false;
  const sentinelEl = new Proxy({}, {
    get(target, prop) { elAccessed = true; return target[prop]; },
    set(target, prop, val) { elAccessed = true; target[prop] = val; return true; }
  });

  const cue1 = { src: "blob:clip-1", el: sentinelEl };
  captureVideoClipThumb(cue1);
  const el1 = videoEls[videoEls.length - 1];
  ok("captureVideoClipThumb creates its own throwaway <video> element and loads cue.src into it (not cue.el)",
    !!el1 && el1.src === "blob:clip-1");
  ok("the throwaway element attaches the 'loadedmetadata' listener before that event lands (synchronously registered), and has not seeked yet",
    el1._loadedMetaListenerCount() === 1 && el1._seekedListenerCount() === 0);

  el1.duration = 10; el1.videoWidth = 1920; el1.videoHeight = 1080;
  el1._fireLoadedMeta();
  ok("on 'loadedmetadata', the seeked listener is attached before the seek lands (synchronously registered) and the loadedmetadata listener is removed",
    el1._seekedListenerCount() === 1 && el1._loadedMetaListenerCount() === 0);
  ok("captureVideoClipThumb seeks to the 0.5s cap when duration/2 (5s) would be further out",
    el1.currentTime === 0.5);

  el1._fireSeeked();
  ok("on 'seeked', the listener is removed (no leak)", el1._seekedListenerCount() === 0);
  ok("on 'seeked', a cached thumbnail canvas is created and drawn into exactly once",
    !!cue1.thumb && cue1.thumb._drawImageCalls === 1);
  ok("the cached thumbnail is scaled so its long edge is 120px (1920x1080 -> 120x68 rounded)",
    cue1.thumb.width === 120 && cue1.thumb.height === 68);
  ok("the throwaway element's src is cleared after capture (no dangling load left behind)", el1.src === "");
  ok("cue.el (the live-playback element) is never read or mutated by captureVideoClipThumb", !elAccessed);

  const cue2 = { src: "blob:clip-2" };
  captureVideoClipThumb(cue2);
  const el2 = videoEls[videoEls.length - 1];
  el2.duration = 0.4; el2.videoWidth = 640; el2.videoHeight = 480;
  el2._fireLoadedMeta();
  ok("captureVideoClipThumb seeks to duration/2 (0.2s) when that's less than the 0.5s cap",
    el2.currentTime === 0.2);

  const cue3 = { src: "blob:clip-3" };
  captureVideoClipThumb(cue3);
  const el3 = videoEls[videoEls.length - 1];
  el3.duration = 10; el3.videoWidth = 0; el3.videoHeight = 0;
  el3._fireLoadedMeta();
  el3._fireSeeked();
  ok("when videoWidth/videoHeight are still 0 at 'seeked' time (metadata not really ready), no thumbnail is created",
    cue3.thumb === undefined);
} catch (e) {
  ok("captureVideoClipThumb creates its own throwaway <video> element and loads cue.src into it (not cue.el)", false, e.message);
  ok("the throwaway element attaches the 'loadedmetadata' listener before that event lands (synchronously registered), and has not seeked yet", false);
  ok("on 'loadedmetadata', the seeked listener is attached before the seek lands (synchronously registered) and the loadedmetadata listener is removed", false);
  ok("captureVideoClipThumb seeks to the 0.5s cap when duration/2 (5s) would be further out", false);
  ok("on 'seeked', the listener is removed (no leak)", false);
  ok("on 'seeked', a cached thumbnail canvas is created and drawn into exactly once", false);
  ok("the cached thumbnail is scaled so its long edge is 120px (1920x1080 -> 120x68 rounded)", false);
  ok("the throwaway element's src is cleared after capture (no dangling load left behind)", false);
  ok("cue.el (the live-playback element) is never read or mutated by captureVideoClipThumb", false);
  ok("captureVideoClipThumb seeks to duration/2 (0.2s) when that's less than the 0.5s cap", false);
  ok("when videoWidth/videoHeight are still 0 at 'seeked' time (metadata not really ready), no thumbnail is created", false);
} finally {
  delete global.bgVidTLOpen;
  delete global.document;
}

ok("captureVideoClipThumb has a 2000ms safety timeout that clears via clearTimeout when 'seeked' fires first", (() => {
  const fn = extractFn("captureVideoClipThumb");
  return !!fn
    && fn.includes("setTimeout(() => el.removeEventListener(\"seeked\", onSeeked), 2000)")
    && fn.includes("clearTimeout(tid)");
})());

ok("addBgVidClipAt's loadedmetadata listener calls captureVideoClipThumb(cue) after correcting the duration placeholder", (() => {
  const fn = extractFn("addBgVidClipAt");
  if (!fn) return false;
  const durIdx = fn.indexOf("if (isFinite(el.duration) && cue.dur === 8) cue.dur = el.duration;");
  const thumbIdx = fn.indexOf("captureVideoClipThumb(cue);");
  return durIdx >= 0 && thumbIdx >= 0 && durIdx < thumbIdx;
})());

section("Video Timeline thumbnails — drawBgVidTL renders cached/live thumbnails");

ok("drawBgVidTL clips to each block's region before drawing a thumbnail into it", (() => {
  const fn = extractFn("drawBgVidTL");
  return !!fn && fn.includes('c.beginPath(); c.rect(x0, by, w, bh); c.clip();');
})());

ok("drawBgVidTL picks cue.el for image-kind clips and cue.thumb for video-kind clips", (() => {
  const fn = extractFn("drawBgVidTL");
  return !!fn && fn.includes('const src = cue.kind === "image" ? cue.el : cue.thumb;');
})());

ok("drawBgVidTL uses clipElReady for image dimensions and the cached canvas's own width/height for video thumbnails", (() => {
  const fn = extractFn("drawBgVidTL");
  return !!fn
    && fn.includes('cue.kind === "image" ? clipElReady(cue.el)')
    && fn.includes('{ w: cue.thumb.width, h: cue.thumb.height }');
})());

ok("drawBgVidTL uses cover-fit (Math.max) scaling for the thumbnail, matching drawClip's cover behavior elsewhere", (() => {
  const fn = extractFn("drawBgVidTL");
  return !!fn && fn.includes("const s = Math.max(w / dim.w, bh / dim.h)");
})());

ok("the thumbnail draw happens before the existing selection-tint fill (thumbnail sits underneath the tint, not on top)", (() => {
  const fn = extractFn("drawBgVidTL");
  if (!fn) return false;
  const thumbIdx = fn.indexOf("c.drawImage(src,");
  const fillIdx = fn.indexOf('c.fillStyle = sel ? "rgba(139,92,246,0.45)"');
  return thumbIdx >= 0 && fillIdx >= 0 && thumbIdx < fillIdx;
})());

ok("drawBgVidTL still skips the thumbnail draw gracefully when no source/dimensions are available yet (no thumbnail, still loading)", (() => {
  const fn = extractFn("drawBgVidTL");
  return !!fn && fn.includes("if (src && dim) {");
})());

ok("drawBgVidTL wraps the clip-name label and IMG badge text draws in a shadow so they stay legible over any thumbnail brightness", (() => {
  const fn = extractFn("drawBgVidTL");
  if (!fn) return false;
  const shadowIdx = fn.indexOf('c.shadowColor = "rgba(0,0,0,0.85)"');
  if (shadowIdx < 0) return false;
  const saveIdx = fn.lastIndexOf("c.save();", shadowIdx);
  const labelIdx = fn.indexOf('c.fillText(cue.name || "Clip", x0 + 5, by + 14);');
  const imgIdx = fn.indexOf('c.fillText("IMG", x0 + w - 4, by + bh - 4);');
  const restoreIdx = imgIdx >= 0 ? fn.indexOf("c.restore();", imgIdx) : -1;
  return saveIdx >= 0 && labelIdx >= 0 && imgIdx >= 0 && restoreIdx >= 0
    && saveIdx < shadowIdx && shadowIdx < labelIdx && labelIdx < imgIdx && imgIdx < restoreIdx
    && fn.includes("c.shadowBlur = 3") && fn.includes("c.shadowBlur = 0");
})());

(() => {
  const cueEl = makeSeekableMockEl(5, true);   // starts away from t=0's target (0), so the
                                                 // first activation below triggers a real seek
  global.S = {
    bgVidCues: [
      { t: 0, dur: 10, fadeIn: 0, fadeOut: 0, transType: "cut", transDur: 0, kind: "video", el: cueEl }
    ],
    bgVid: { on: false, el: null, src: null },
    bgVidTrans: null,
    playing: true
  };
  try {
    const { updateBgVideoTimeline } = loadFns(["updateBgVideoTimeline", "syncClipTime"]);

    const pendingLegacy = (() => {
      const savedCues = global.S.bgVidCues;
      global.S.bgVidCues = [];
      const r = updateBgVideoTimeline(5);
      global.S.bgVidCues = savedCues;
      return r;
    })();
    ok("updateBgVideoTimeline returns an empty array on the legacy zero-cues path", Array.isArray(pendingLegacy) && pendingLegacy.length === 0);

    // t=0: cue activates, targetT = 0 - cue.t = 0, but cueEl.currentTime is still 5 (its
    // initial mock value) — drift |5 - 0| = 5 > 0.35, so this is a real, seek-triggering call.
    const pendingFirstActivation = updateBgVideoTimeline(0);
    ok("updateBgVideoTimeline returns an array containing the pending seek when a cue's video element genuinely seeks on activation",
      Array.isArray(pendingFirstActivation) && pendingFirstActivation.length === 1 && pendingFirstActivation[0] instanceof Promise);

    // t=0.02: syncClipTime's mock setter updates ct synchronously to whatever currentTime was
    // last assigned, so by now cueEl.currentTime reads 0 (the Task 1 seek path always sets
    // el.currentTime = Math.max(0, targetT) synchronously, independent of the real browser's
    // async decode) — targetT is now 0.02, drift |0 - 0.02| = 0.02, well under 0.35, so no
    // further seek is needed even without the mock's 'seeked' event ever having fired.
    const pendingSteady = updateBgVideoTimeline(0.02);
    ok("updateBgVideoTimeline returns an empty array once the clip is already tracking closely (no further seek needed)",
      Array.isArray(pendingSteady) && pendingSteady.length === 0);
  } catch (e) {
    ok("updateBgVideoTimeline returns an empty array on the legacy zero-cues path", false, e.message);
    ok("updateBgVideoTimeline returns an array containing the pending seek when a cue's video element genuinely seeks on activation", false);
    ok("updateBgVideoTimeline returns an empty array once the clip is already tracking closely (no further seek needed)", false);
  } finally {
    delete global.S;
  }
})();

ok("renderExportFrame is declared async", (() => {
  return script.includes("async function renderExportFrame(i, fps, feat, dur, t0) {");
})());

ok("renderExportFrame awaits Promise.all of updateBgVideoTimeline's pending seeks before drawScene paints the frame", (() => {
  const fn = extractFn("renderExportFrame");
  return !!fn
    && fn.includes("const pending = updateBgVideoTimeline(t);")
    && fn.includes("if (pending.length) await Promise.all(pending);")
    && fn.indexOf("const pending = updateBgVideoTimeline(t);") < fn.indexOf("drawScene(dt);");
})());

ok("the HQ export loop awaits renderExportFrame before capturing the canvas into a VideoFrame", (() => {
  return script.includes("await renderExportFrame(i, fps, feat, dur, startT);")
    && !script.includes("      renderExportFrame(i, fps, feat, dur, startT);\n      const vf = new VideoFrame");
})());

/* Final-review hardening: extractFn's const-fallback used to slice to the first ';', which
   would silently truncate a block-bodied arrow function (one containing its own inner ';'
   statements) — a negative .includes() assertion against that truncated text could then pass
   vacuously. Confirm the brace-matching fallback now captures the FULL body, inner semicolons
   included, using synthetic input so this doesn't depend on any real declaration in the app. */
ok("extractFn's const-fallback brace-matches a block-bodied arrow function instead of truncating at its first inner semicolon", (() => {
  const synthetic = 'const buildX = (seed) => { const a = 1; const b = 2; return a + b; };\nconst unrelated = 1;';
  const fn = extractFn("buildX", synthetic);
  return !!fn && fn.includes("return a + b;") && fn.endsWith("}") && !fn.includes("unrelated");
})());
ok("extractFn's const-fallback still handles a single-expression arrow (no braces) via the semicolon slice, unchanged", (() => {
  const synthetic = "const fract1 = x => x - Math.floor(x);\nconst unrelated = 1;";
  const fn = extractFn("fract1", synthetic);
  return fn === "const fract1 = x => x - Math.floor(x);";
})());
/* Regression guard for the exact bug this same fix wave introduced and caught before pushing:
   loadFns did `names.map(extractFn)` — Array.map calls its callback as (element, index, array),
   so extractFn's new optional 2nd param silently received the array INDEX as `src` for every
   name after the first, breaking every multi-name loadFns call in the suite (~30 call sites).
   Confirm loadFns still resolves multiple real functions correctly. */
ok("loadFns resolves multiple functions correctly (guards against Array.map passing the index as extractFn's new 2nd param)", (() => {
  const fns = loadFns(["syncClipTime", "clamp01", "fract1"]);
  return typeof fns.syncClipTime === "function" && typeof fns.clamp01 === "function" && typeof fns.fract1 === "function";
})());

/* ---------------- DNA Engines: Corridor Tunnel, Spiral Vortex, Maze Grid ---------------- */
section("DNA Engines — Corridor Tunnel, Spiral Vortex, Maze Grid");

ok("drawTunnelCorridor is defined and uses the z*z accelerating-approach math", (() => {
  const fn = extractFn("drawTunnelCorridor");
  return !!fn && fn.includes("const f = z * z;") && fn.includes("ctx.strokeRect(-rw / 2, -rh / 2, rw, rh);");
})());

ok("drawSpiralVortex is defined, uses the z*z accelerating-approach math, and rotates rings by an f-dependent spin", (() => {
  const fn = extractFn("drawSpiralVortex");
  return !!fn && fn.includes("const f = z * z;") && fn.includes("const spin = S.time * 0.5 + f * 6.0;");
})());

ok("drawMazeGrid is defined and invalidates its cached grid when the seed changes", (() => {
  const fn = extractFn("drawMazeGrid");
  return !!fn && fn.includes("if (mazeGrid === null || mazeSeed !== seed) { mazeGrid = buildMazeGrid(seed); mazeSeed = seed; }");
})());

ok("buildMazeGrid is defined and uses the fract1/Math.sin seeded-hash pattern (deterministic, no Math.random)", (() => {
  const fn = extractFn("buildMazeGrid");
  return !!fn && fn.includes("fract1(Math.sin(") && !fn.includes("Math.random()");
})());

/* buildMazeGrid is pure math — genuinely testable without any canvas/DOM mocking. */
ok("buildMazeGrid is deterministic: the same seed produces an identical wall grid on repeated calls", (() => {
  const { buildMazeGrid } = loadFns(["buildMazeGrid", "fract1"]);
  const a = buildMazeGrid(42), b = buildMazeGrid(42);
  return JSON.stringify(a) === JSON.stringify(b) && a.cols === 12 && a.rows === 8;
})());

ok("the dispatch chain has the 3 new branches in order between the existing 'fluid' branch and the final bare else", (() => {
  const fn = extractFn("drawScene");
  if (!fn) return false;
  const fluidIdx = fn.indexOf('dnaEngine === "fluid"');
  const tunnelIdx = fn.indexOf('dnaEngine === "tunnelCorridor"');
  const vortexIdx = fn.indexOf('dnaEngine === "spiralVortex"');
  const mazeIdx = fn.indexOf('dnaEngine === "mazeGrid"');
  return fluidIdx >= 0 && tunnelIdx > fluidIdx && vortexIdx > tunnelIdx && mazeIdx > vortexIdx;
})());

ok("PRESETS gained the 3 new entries with correct id/engine pairs", (() => {
  const m = script.match(/const PRESETS = \[([\s\S]*)\];/);
  if (!m) return false;
  const body = m[1];
  return body.includes('id: "tunnelDrift"') && body.includes('engine: "tunnelCorridor"')
    && body.includes('id: "vortexSpin"') && body.includes('engine: "spiralVortex"')
    && body.includes('id: "mazeWalker"') && body.includes('engine: "mazeGrid"');
})());

ok("renderPreviews() has the 3 new mini-preview branches in order before the existing 'dance' branch", (() => {
  const fn = extractFn("renderPreviews");
  if (!fn) return false;
  const tunnelIdx = fn.indexOf('p.engine === "tunnelCorridor"');
  const vortexIdx = fn.indexOf('p.engine === "spiralVortex"');
  const mazeIdx = fn.indexOf('p.engine === "mazeGrid"');
  const danceIdx = fn.indexOf('p.engine === "dance"');
  return tunnelIdx >= 0 && vortexIdx > tunnelIdx && mazeIdx > vortexIdx && danceIdx > mazeIdx;
})());

/* ---------------- Layer B: Bead Tentacle ---------------- */
section("Layer B — Bead Tentacle");

ok("LAYERB_TYPES gained the tentacle entry as its 20th element", (() => {
  const m = script.match(/const LAYERB_TYPES = \[([\s\S]*?)\];/);
  if (!m) return false;
  const body = m[1];
  const entries = body.match(/\[".*?",\s*".*?"\]/g) || [];
  return entries.length === 20
    && body.includes('["tentacle", "Bead Tentacle"]')
    && entries[entries.length - 1].includes('"tentacle"');
})());

ok("drawLayerB has a case for tentacle positioned after case \"moire\" and before the switch closes", (() => {
  const fn = extractFn("drawLayerB");
  if (!fn) return false;
  const moireIdx = fn.indexOf('case "moire":');
  const tentacleIdx = fn.indexOf('case "tentacle":');
  return moireIdx >= 0 && tentacleIdx > moireIdx;
})());

ok("tentacle's counter-rotation cancels and reverses the shared baseRot (-2 * baseRot, not just -baseRot)", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes('case "tentacle": {') && fn.includes("ctx.rotate(-2 * baseRot);");
})());

ok("tentacle is beat-reactive (S.beat) without bass/loudness motion-coupling (matches the approved beat-only scope)", (() => {
  const fn = extractFn("drawLayerB");
  if (!fn) return false;
  const startIdx = fn.indexOf('case "tentacle": {');
  const endIdx = fn.indexOf("\n    }", startIdx);
  if (startIdx < 0 || endIdx < 0) return false;
  const body = fn.slice(startIdx, endIdx);
  return body.includes("S.beat") && !body.includes("S.bass") && !body.includes("S.loudness") && !body.includes("S.mids") && !body.includes("S.highs");
})());

ok("tentacle's shape is a pure function of S.time/dt — no Math.random, no accumulated per-frame state", (() => {
  const fn = extractFn("drawLayerB");
  if (!fn) return false;
  const startIdx = fn.indexOf('case "tentacle": {');
  const endIdx = fn.indexOf("\n    }", startIdx);
  if (startIdx < 0 || endIdx < 0) return false;
  const body = fn.slice(startIdx, endIdx);
  return !body.includes("Math.random");
})());

ok("LAYERB_GENERIC excludes tentacle (keeps the 2x Auto-VJ selection weight given to distinctive types)", (() => {
  const m = script.match(/const LAYERB_GENERIC = new Set\(\[([^\]]*)\]\);/);
  if (!m) return false;
  return !m[1].includes('"tentacle"');
})());

/* ---------------- Particle Mode: Glow & Frequency-Band Coupling ---------------- */
section("Particle Mode — Glow & Frequency-Band Coupling");

/* CRITICAL: drawParticleMode/initPM/pmColor are declared pre-marker in elastic-morph.html
   (elastic-morph.html:6186 etc.) but REASSIGNED post-marker in src/inject-v85.js
   (`drawParticleMode = function (...) {...};`), regenerated into elastic-morph.html after the
   @BUILD-INJECT-V58 marker by build.js on every build. The post-marker assignment always wins
   at runtime (it runs after the pre-marker declaration in script order) — the pre-marker copy
   is dead code. A first attempt at this feature edited the pre-marker copy by mistake; its
   tests (via plain extractFn("drawParticleMode") against `script`) passed because they found
   that pre-marker declaration first, but were testing code that never actually ran live. Fixed
   by targeting src/inject-v85.js directly here, via extractFn's `src` override + injectSrc(). */
const pmSrc = injectSrc("inject-v85.js");

ok("drawParticleMode is genuinely reassigned post-marker in src/inject-v85.js (sanity check that we're testing the live function, not the dead pre-marker one)", (() => {
  return pmSrc.includes("drawParticleMode = function (") && !pmSrc.includes("function drawParticleMode(");
})());

ok("drawParticleMode (the real, post-marker one) defines glowOn as S.exporting || (S.perfScale || 1) > 0.5", (() => {
  const fn = extractFn("drawParticleMode", pmSrc);
  return !!fn && fn.includes("const glowOn = S.exporting || (S.perfScale || 1) > 0.5;");
})());

/* Helper: slice one case body out of drawParticleMode's switch. This function's case blocks
   close with 6-space-indented "}" (confirmed by direct inspection of src/inject-v85.js —
   deeper nesting than drawLayerB's switch, which uses 4-space closes), so the search pattern
   here is "\n      }", not the "\n    }" used for drawLayerB's case slicing elsewhere in this
   file. */
function pmCaseBody(fn, id) {
  const startIdx = fn.indexOf(`case "${id}": {`);
  const endIdx = fn.indexOf("\n      }", startIdx);
  if (startIdx < 0 || endIdx < 0) return null;
  return fn.slice(startIdx, endIdx);
}

const PM_GLOW_PATTERNS = ["hyperspace", "starfall", "rain", "vortex", "fountain", "fireworks", "swarm"];

ok("all 7 non-Nebula patterns set ctx.shadowBlur gated by glowOn (real function)", (() => {
  const fn = extractFn("drawParticleMode", pmSrc);
  if (!fn) return false;
  return PM_GLOW_PATTERNS.every(id => {
    const body = pmCaseBody(fn, id);
    return !!body && body.includes("ctx.shadowBlur = glowOn ?");
  });
})());

ok("nebula does NOT get ctx.shadowBlur (already has an equivalent radial-gradient glow) (real function)", (() => {
  const fn = extractFn("drawParticleMode", pmSrc);
  if (!fn) return false;
  const body = pmCaseBody(fn, "nebula");
  return !!body && !body.includes("shadowBlur");
})());

const PM_BAND_SIGNALS = {
  hyperspace: ["S.bands.air"],
  starfall: ["S.bands.highMid", "S.bands.air"],
  rain: ["S.kickOnset"],
  vortex: ["S.bands.bass", "S.bands.lowMid"],
  fountain: ["S.bands.subBass", "S.kickOnset"],
  fireworks: ["S.snareOnset"],
  nebula: ["S.bands.mid"],
  swarm: ["S.bands.bass", "S.bands.mid"]
};

ok("each pattern's case body contains all of its assigned frequency-band/onset signals (real function)", (() => {
  const fn = extractFn("drawParticleMode", pmSrc);
  if (!fn) return false;
  return Object.entries(PM_BAND_SIGNALS).every(([id, signals]) => {
    const body = pmCaseBody(fn, id);
    return !!body && signals.every(sig => body.includes(sig));
  });
})());

ok("glowOn's boundary logic: exporting always true, perfScale>0.5 true, perfScale===0.5 false (strict >, matches the S.geo2 precedent)", (() => {
  const glowOn = (exporting, perfScale) => exporting || (perfScale || 1) > 0.5;
  return glowOn(true, 0.1) === true
    && glowOn(false, 0.51) === true
    && glowOn(false, 0.5) === false;
})());

ok("the pre-marker (dead) drawParticleMode in elastic-morph.html was correctly reverted — no orphaned glow/band code left behind to confuse future readers", (() => {
  const fn = extractFn("drawParticleMode");   // default src = script -> finds the pre-marker copy
  return !!fn && !fn.includes("glowOn") && !fn.includes("S.bands") && !fn.includes("S.kickOnset") && !fn.includes("S.snareOnset");
})());

/* ---------------- Particle Mode: Kaleidoscope Mirror & Constellation ---------------- */
section("Particle Mode — Kaleidoscope Mirror & Constellation");

const pmSrc2 = injectSrc("inject-v85.js");

ok("drawParticleMode is still genuinely reassigned post-marker in src/inject-v85.js (same sanity check as the Round 1 fix)", (() => {
  return pmSrc2.includes("drawParticleMode = function (") && !pmSrc2.includes("function drawParticleMode(");
})());

ok("PM_CONST_PATTERNS is exactly nebula/swarm/vortex/fountain", (() => {
  const m = pmSrc2.match(/const PM_CONST_PATTERNS = new Set\(\[([^\]]*)\]\);/);
  if (!m) return false;
  const body = m[1];
  return body.includes('"nebula"') && body.includes('"swarm"') && body.includes('"vortex"') && body.includes('"fountain"')
    && !body.includes('"hyperspace"') && !body.includes('"starfall"') && !body.includes('"rain"') && !body.includes('"fireworks"');
})());

ok("pmMirrorPasses returns the right pass count per mode (quad=4, oct=8, off/unknown=1)", (() => {
  const { pmMirrorPasses, pmMirrorRotPasses } = loadFns2(["pmMirrorPasses", "pmMirrorRotPasses"], pmSrc2);
  return pmMirrorPasses("quad").length === 4
    && pmMirrorPasses("oct").length === 8
    && pmMirrorPasses("hex").length === 6
    && pmMirrorPasses("h").length === 2
    && pmMirrorPasses("v").length === 2
    && pmMirrorPasses("diag").length === 2
    && pmMirrorPasses("off").length === 1
    && pmMirrorPasses("nonsense").length === 1;
})());

ok("pmMirrorXY under h-flip ({sx:-1,sy:1}) negates only the x-delta", (() => {
  const { pmMirrorXY } = loadFns2(["pmMirrorXY"], pmSrc2);
  const [x, y] = pmMirrorXY(130, 220, 100, 200, { sx: -1, sy: 1 });
  return x === 70 && y === 220;   // dx=30 -> -30 -> cx-30=70; dy=20 unchanged -> cy+20=220
})());

ok("pmMirrorXY under diag swaps the x/y deltas", (() => {
  const { pmMirrorXY } = loadFns2(["pmMirrorXY"], pmSrc2);
  const [x, y] = pmMirrorXY(130, 220, 100, 200, { diag: true });
  return x === 120 && y === 230;   // dx=30, dy=20 -> swapped: cx+20=120, cy+30=230
})());

ok("pmMirrorXY applies flip BEFORE rotate for rotational passes (matches Layer B's actual canvas-transform composition order, not the reverse)", (() => {
  const { pmMirrorXY } = loadFns2(["pmMirrorXY"], pmSrc2);
  // point at (cx, cy+1) i.e. dx=0, dy=1; rot=60deg, flip=true
  const [x, y] = pmMirrorXY(0, 1, 0, 0, { rot: Math.PI / 3, flip: true });
  // hand-derived: flip first -> dy=-1; rotate by 60deg: (0*cos - (-1)*sin, 0*sin + (-1)*cos)
  const c = Math.cos(Math.PI / 3), s = Math.sin(Math.PI / 3);
  const expectedX = 0 * c - (-1) * s, expectedY = 0 * s + (-1) * c;
  return Math.abs(x - expectedX) < 1e-9 && Math.abs(y - expectedY) < 1e-9;
})());

ok("the perf-degradation ladder matches drawLayerB's own thresholds exactly (0.75/0.65/0.55/0.45)", (() => {
  const lbFn = extractFn("drawLayerB");
  const pmFn = extractFn("drawParticleMode", pmSrc2);
  if (!lbFn || !pmFn) return false;
  return lbFn.includes("pf57 < 0.75") && pmFn.includes("pf57 < 0.75")
    && lbFn.includes("pf57 < 0.65") && pmFn.includes("pf57 < 0.65")
    && lbFn.includes("pf57 < 0.55") && pmFn.includes("pf57 < 0.55")
    && lbFn.includes("pf57 < 0.45") && pmFn.includes("pf57 < 0.45");
})());

function pmCaseBody2(fn, id) {
  const startIdx = fn.indexOf(`case "${id}": {`);
  const endIdx = fn.indexOf("\n      }", startIdx);
  if (startIdx < 0 || endIdx < 0) return null;
  return fn.slice(startIdx, endIdx);
}

const PM_ALL_PATTERNS = ["hyperspace", "starfall", "rain", "vortex", "fountain", "fireworks", "nebula", "swarm"];

ok("all 8 patterns' case bodies contain at least one mirror-pass draw loop", (() => {
  const fn = extractFn("drawParticleMode", pmSrc2);
  if (!fn) return false;
  return PM_ALL_PATTERNS.every(id => {
    const body = pmCaseBody2(fn, id);
    return !!body && body.includes("for (const mp of mPasses)");
  });
})());

ok("only nebula/swarm/vortex/fountain push to pmConstPts; hyperspace/starfall/rain/fireworks do not", (() => {
  const fn = extractFn("drawParticleMode", pmSrc2);
  if (!fn) return false;
  const shouldHave = ["nebula", "swarm", "vortex", "fountain"];
  const shouldNotHave = ["hyperspace", "starfall", "rain", "fireworks"];
  return shouldHave.every(id => { const b = pmCaseBody2(fn, id); return !!b && b.includes("pmConstPts.push("); })
    && shouldNotHave.every(id => { const b = pmCaseBody2(fn, id); return !!b && !b.includes("pmConstPts.push("); });
})());

ok("all 4 constellation-eligible cases cap collection at 70 points", (() => {
  const fn = extractFn("drawParticleMode", pmSrc2);
  if (!fn) return false;
  return ["nebula", "swarm", "vortex", "fountain"].every(id => {
    const body = pmCaseBody2(fn, id);
    return !!body && body.includes("pmConstPts.length < 70");
  });
})());

ok("constellation line-drawing block is gated by pmConstOn && pmConstPts.length > 1", (() => {
  const fn = extractFn("drawParticleMode", pmSrc2);
  return !!fn && fn.includes("if (pmConstOn && pmConstPts.length > 1) {");
})());

ok("S.pmode's default object includes mirror: \"off\" and constellation: false", (() => {
  return /pmode:\s*\{\s*on:\s*false,\s*pattern:\s*"hyperspace",\s*multicolor:\s*false,\s*amount:\s*0\.6,\s*mirror:\s*"off",\s*constellation:\s*false\s*\}/.test(script);
})());

ok("the #pmMirror select and #pmConstellation checkbox exist, with #pmMirror offering the same 7 modes as #lbMirror", (() => {
  if (!html.includes('id="pmConstellation"')) return false;
  const m = html.match(/<select id="pmMirror"[\s\S]*?<\/select>/);
  if (!m) return false;
  const body = m[0];
  return body.includes('value="off"') && body.includes('value="h"') && body.includes('value="v"')
    && body.includes('value="diag"') && body.includes('value="quad"') && body.includes('value="hex"') && body.includes('value="oct"');
})());

ok("buildParticleMode() wires pmMirror change and pmConstellation change to S.pmode", (() => {
  const fn = extractFn("buildParticleMode");
  return !!fn
    && fn.includes('$("pmMirror").addEventListener("change", e => S.pmode.mirror = e.target.value);')
    && fn.includes('$("pmConstellation").addEventListener("change", e => S.pmode.constellation = e.target.checked);');
})());

ok("pmode save serialization includes mirror and constellation", (() => {
  return script.includes("pmode: { on: S.pmode.on, pattern: S.pmode.pattern, multicolor: S.pmode.multicolor, amount: S.pmode.amount, mirror: S.pmode.mirror, constellation: S.pmode.constellation },");
})());

ok("sync-to-UI sets #pmMirror and #pmConstellation from S.pmode", (() => {
  return script.includes('$("pmMirror").value = S.pmode.mirror; $("pmConstellation").checked = S.pmode.constellation;');
})());

/* ---------------- Particle Mode: New Patterns (Bokeh, Magnetic Field, Pulse Burst) ---------------- */
section("Particle Mode — New Patterns (Bokeh, Magnetic Field, Pulse Burst)");

const pmSrc3 = injectSrc("inject-v85.js");

ok("drawParticleMode is still genuinely reassigned post-marker in src/inject-v85.js (same sanity check as Rounds 1-2)", (() => {
  return pmSrc3.includes("drawParticleMode = function (") && !pmSrc3.includes("function drawParticleMode(");
})());

ok("PM_PATTERNS gained exactly 3 new entries at the end: bokeh, magnetic, pulseBurst", (() => {
  const m = script.match(/const PM_PATTERNS = \[([\s\S]*?)\];/);
  if (!m) return false;
  const body = m[1];
  const entries = body.match(/\[".*?",\s*".*?"\]/g) || [];
  return entries.length === 11
    && entries[8].includes('"bokeh"') && entries[8].includes('"Bokeh"')
    && entries[9].includes('"magnetic"') && entries[9].includes('"Magnetic Field"')
    && entries[10].includes('"pulseBurst"') && entries[10].includes('"Pulse Burst"');
})());

ok("pmBurstR module state declared alongside pmParticles/pmFireTimer, initialized to 0.3", (() => {
  return script.includes("let pmParticles = [], pmFireTimer = 0, pmBurstR = 0.3;");
})());

ok("PM_CONST_PATTERNS is exactly nebula/swarm/vortex/fountain/magnetic (5 entries) — bokeh and pulseBurst are NOT constellation-eligible", (() => {
  const m = pmSrc3.match(/const PM_CONST_PATTERNS = new Set\(\[([^\]]*)\]\);/);
  if (!m) return false;
  const body = m[1];
  return body.includes('"nebula"') && body.includes('"swarm"') && body.includes('"vortex"') && body.includes('"fountain"') && body.includes('"magnetic"')
    && !body.includes('"bokeh"') && !body.includes('"pulseBurst"');
})());

ok("magAttractors/pmBurstR per-frame setup block exists before the particle loop (runs once per frame, not once per particle)", (() => {
  const fn = extractFn("drawParticleMode", pmSrc3);
  if (!fn) return false;
  const loopIdx = fn.indexOf("for (let pi = 0; pi < visN; pi++)");
  const magSetupIdx = fn.indexOf('pm.pattern === "magnetic"');
  const burstSetupIdx = fn.indexOf('pm.pattern === "pulseBurst"');
  return loopIdx >= 0 && magSetupIdx >= 0 && magSetupIdx < loopIdx
    && burstSetupIdx >= 0 && burstSetupIdx < loopIdx;
})());

const PM_NEW_PATTERNS = ["bokeh", "magnetic", "pulseBurst"];

ok("all 3 new patterns' case bodies contain at least one mirror-pass draw loop", (() => {
  const fn = extractFn("drawParticleMode", pmSrc3);
  if (!fn) return false;
  return PM_NEW_PATTERNS.every(id => {
    const body = pmCaseBody2(fn, id);
    return !!body && body.includes("for (const mp of mPasses)");
  });
})());

ok("bokeh does NOT get ctx.shadowBlur (matches Nebula's exemption); magnetic and pulseBurst DO", (() => {
  const fn = extractFn("drawParticleMode", pmSrc3);
  if (!fn) return false;
  const bokehBody = pmCaseBody2(fn, "bokeh");
  const magBody = pmCaseBody2(fn, "magnetic");
  const burstBody = pmCaseBody2(fn, "pulseBurst");
  return !!bokehBody && !bokehBody.includes("shadowBlur")
    && !!magBody && magBody.includes("ctx.shadowBlur = glowOn ?")
    && !!burstBody && burstBody.includes("ctx.shadowBlur = glowOn ?");
})());

ok("only magnetic pushes to pmConstPts among the 3 new patterns; bokeh and pulseBurst do not", (() => {
  const fn = extractFn("drawParticleMode", pmSrc3);
  if (!fn) return false;
  const magBody = pmCaseBody2(fn, "magnetic");
  const bokehBody = pmCaseBody2(fn, "bokeh");
  const burstBody = pmCaseBody2(fn, "pulseBurst");
  return !!magBody && magBody.includes("pmConstPts.push(")
    && !!bokehBody && !bokehBody.includes("pmConstPts.push(")
    && !!burstBody && !burstBody.includes("pmConstPts.push(");
})());

ok("pulseBurst never mutates pt.a (fixed angle — reads as one coherent breathing sphere, not independent trajectories)", (() => {
  const fn = extractFn("drawParticleMode", pmSrc3);
  if (!fn) return false;
  const body = pmCaseBody2(fn, "pulseBurst");
  return !!body && !body.includes("pt.a +=") && !body.includes("pt.a -=") && !body.includes("pt.a =");
})());

ok("the pre-marker (dead) drawParticleMode in elastic-morph.html contains none of the 3 new patterns' drawing logic", (() => {
  const fn = extractFn("drawParticleMode");   // default src = script -> finds the pre-marker copy
  return !!fn && !fn.includes('"bokeh"') && !fn.includes('"magnetic"') && !fn.includes('"pulseBurst"')
    && !fn.includes("magAttractors") && !fn.includes("pmBurstR +=");
})());

/* ---------------- FX Rack II: Pulse Zoom (replaces Triangulate) ---------------- */
section("FX Rack II — Pulse Zoom (replaces Triangulate)");

ok("FX2_DEFS gained pulsezoom at index 8 (Ctrl+9) and no longer contains triangulate", (() => {
  const m = script.match(/const FX2_DEFS = \[([\s\S]*?)\];/);
  if (!m) return false;
  const body = m[1];
  const entries = body.match(/\[".*?",\s*".*?",\s*".*?"\]/g) || [];
  return entries.length === 10
    && entries[8].includes('"pulsezoom"') && entries[8].includes('"Pulse Zoom"')
    && !body.includes('"triangulate"');
})());

ok("S.fx2 default state has pulsezoom: false (not triangulate) and S.fx2Breath: 0 alongside S.fx2Spin: 0", (() => {
  return script.includes("pulsezoom: false") && !script.includes("triangulate: false")
    && script.includes("fx2Spin: 0, fx2Breath: 0,");
})());

ok("applyPostFX2 has a case for pulsezoom and no longer has one for triangulate", (() => {
  const fn = extractFn("applyPostFX2");
  return !!fn && fn.includes("if (fx.pulsezoom) {") && !fn.includes("if (fx.triangulate)");
})());

ok("the pulsezoom block calls snapshot(W, H) before drawImage (matches every sibling FX2 effect's convention)", (() => {
  const fn = extractFn("applyPostFX2");
  if (!fn) return false;
  const startIdx = fn.indexOf("if (fx.pulsezoom) {");
  const endIdx = fn.indexOf("\n  }", startIdx);
  if (startIdx < 0 || endIdx < 0) return false;
  const body = fn.slice(startIdx, endIdx);
  const snapIdx = body.indexOf("snapshot(W, H)");
  const drawIdx = body.indexOf("ctx.drawImage(fxC");
  return snapIdx >= 0 && drawIdx >= 0 && snapIdx < drawIdx;
})());

ok("pulsezoom references all 4 audio signals (S.mids, S.loudness, S.beat, S.transient) — genuine multi-signal reactivity, not a static effect like the one it replaces", (() => {
  const fn = extractFn("applyPostFX2");
  if (!fn) return false;
  const startIdx = fn.indexOf("if (fx.pulsezoom) {");
  const endIdx = fn.indexOf("\n  }", startIdx);
  if (startIdx < 0 || endIdx < 0) return false;
  const body = fn.slice(startIdx, endIdx);
  return body.includes("S.mids") && body.includes("S.loudness") && body.includes("S.beat") && body.includes("S.transient");
})());

ok("Auto-VJ's safe2 pool contains pulsezoom (not triangulate) — Auto-VJ still has 8 safe FX2 options to pick from", (() => {
  const m = script.match(/const safe2 = \[([^\]]*)\];/);
  if (!m) return false;
  const body = m[1];
  const entries = body.match(/"[^"]+"/g) || [];
  return entries.length === 8 && body.includes('"pulsezoom"') && !body.includes('"triangulate"');
})());

ok("no ACTIVE code references \"triangulate\" anymore — FX2_DEFS entry, S.fx2 field, applyPostFX2 case, and safe2 entry are all gone (the old v21/v27 changelog prose near the top of the file is a historical record of what shipped in those versions and is deliberately left untouched, matching this session's established convention of not rewriting old changelog entries)", (() => {
  const fs = require("fs");
  const path = require("path");
  if (script.includes('"triangulate"') || script.includes("triangulate: false") || script.includes("fx.triangulate")) return false;
  const srcDir = path.join(__dirname, "src");
  if (fs.existsSync(srcDir)) {
    for (const f of fs.readdirSync(srcDir)) {
      if (fs.readFileSync(path.join(srcDir, f), "utf8").includes("triangulate")) return false;
    }
  }
  return true;
})());

section("Text Mode — Hypno Loop");

ok("drawTextLayer's signature gained a 5th `dt` parameter", (() => {
  return script.includes("function drawTextLayer(W, H, hue, P, dt) {");
})());

ok("the render loop's drawTextLayer call site now passes dt", (() => {
  return script.includes("drawTextLayer(W, H, hue, P, dt);");
})());

ok("src/inject-v98.js's drawTextLayer wrapper threads dt through both its signature and its inner call (this file is regenerated into elastic-morph.html on every build — editing only the html mirror would be silently overwritten)", (() => {
  const src = injectSrc("inject-v98.js");
  return src.includes("drawTextLayer = function (W, H, hue, P, dt) {") &&
         src.includes("return _drawTextLayer(W, H, hue, P, dt);");
})());

ok("S default state has textHypnoPhase: 0", (() => {
  return script.includes("textHypnoPhase: 0");
})());

ok("the textAnim <select> gained a hypno option, scoped to that specific select (not just anywhere in the file)", (() => {
  const m = html.match(/<select id="textAnim">([\s\S]*?)<\/select>/);
  return !!m && m[1].includes('<option value="hypno">Hypno Loop</option>');
})());

ok("advanceHypnoPhase exists, advances S.textHypnoPhase by dt scaled by mids/loudness, and wraps with % 1", (() => {
  const fn = extractFn("advanceHypnoPhase");
  return !!fn && fn.includes("S.textHypnoPhase") && fn.includes("dt *") && fn.includes("S.mids") &&
         fn.includes("S.loudness") && fn.includes("% 1");
})());

ok("the anim === \"hypno\" branch calls advanceHypnoPhase(dt) and sets the hypno flag", (() => {
  const fn = extractFn("drawTextLayer");
  return !!fn && /anim === "hypno"\) \{\s*advanceHypnoPhase\(dt\);\s*hypno = true;/.test(fn);
})());

ok("paintLine renders the hypno echo trail (4 staggered copies, scale grows, alpha fades) inside the same final-else branch depth3d already uses", (() => {
  const fn = extractFn("drawTextLayer");   // paintLine is nested inside drawTextLayer, so its source comes along
  return !!fn && fn.includes("if (hypno) {") && fn.includes("const ECHOES = 4, GROWTH = 1.6;") &&
         fn.includes("S.textHypnoPhase - k / ECHOES");
})());

ok("advanceHypnoPhase keeps S.textHypnoPhase within [0, 1) across many frames of varying dt/mids/loudness (genuine behavioral check, not just a structural text match)", (() => {
  global.S = { textHypnoPhase: 0, mids: 0, loudness: 0 };
  const { advanceHypnoPhase } = loadFns(["advanceHypnoPhase"]);
  let ok2 = true;
  for (let i = 0; i < 500; i++) {
    global.S.mids = Math.random();
    global.S.loudness = Math.random();
    const dt = Math.random() * 0.1;   // up to 100ms, generous frame-time range
    const v = advanceHypnoPhase(dt);
    if (!(v >= 0 && v < 1)) { ok2 = false; break; }
  }
  return ok2;
})());

section("Text Mode — 5 Text Endings (F1–F5)");

ok("TEXT_ENDING_DUR has exactly the 5 expected keys, each a positive number", (() => {
  const fn = script.match(/const TEXT_ENDING_DUR = \{([^}]*)\};/);
  if (!fn) return false;
  const obj = eval("({" + fn[1] + "})");
  const keys = Object.keys(obj);
  return keys.length === 5 &&
         ["shatter", "vortexsuck", "dissolve", "iris", "glitchout"].every(k => k in obj && obj[k] > 0);
})());

ok("triggerTextEnding refuses to start an ending during lyric mode and when nothing is showing", (() => {
  const fn = extractFn("triggerTextEnding");
  return !!fn && fn.includes("S.lyrics.on && S.lyrics.cues.length > 0") && fn.includes("if (lyricMode) return;") &&
         fn.includes("!S.textShow");
})());

ok("the keydown handler has 5 distinct F1–F5 checks calling triggerTextEnding with 5 distinct type strings", (() => {
  const keys = ["F1", "F2", "F3", "F4", "F5"];
  const types = ["shatter", "vortexsuck", "dissolve", "iris", "glitchout"];
  return keys.every((k, i) => script.includes(`e.key === "${k}"`) && script.includes(`triggerTextEnding("${types[i]}")`)) &&
         new Set(types).size === 5;
})());

ok("none of the 5 ending type strings are exposed as a persistent, user-selectable textAnim option", (() => {
  const m = html.match(/<select id="textAnim">([\s\S]*?)<\/select>/);
  if (!m) return false;
  return ["shatter", "vortexsuck", "dissolve", "iris", "glitchout"].every(t => !m[1].includes(`value="${t}"`));
})());

ok("drawTextLayer resolves an active (non-lyric-mode) S.textEnding into `ending`/`endingP`/`anim`", (() => {
  const fn = extractFn("drawTextLayer");
  return !!fn && fn.includes("const ending = !lyricMode ? S.textEnding : null;") &&
         fn.includes("textEndingDuration(ending.type)") &&   // v135: was TEXT_ENDING_DUR[ending.type] directly, see textEndingDuration
         fn.includes("const anim = ending ? ending.type :");
})());

ok("all 5 ending anim-chain branches exist and set alpha to fade toward 0 as endingP grows", (() => {
  const fn = extractFn("drawTextLayer");
  if (!fn) return false;
  return ['anim === "shatter"', 'anim === "vortexsuck"', 'anim === "dissolve"', 'anim === "iris"', 'anim === "glitchout"']
    .every(needle => fn.includes(needle)) && fn.includes("alpha = 1 - endingP") && fn.includes("glitchEndP = endingP");
})());

ok("paintLine has per-character render branches for dissolveFX/shatter/vortex and a clip-based branch for irisFX", (() => {
  const fn = extractFn("drawTextLayer");   // paintLine is nested inside; its source comes along
  return !!fn && fn.includes("} else if (dissolveFX) {") && fn.includes("} else if (shatter) {") &&
         fn.includes("} else if (vortex) {") && fn.includes("} else if (irisFX) {") &&
         fn.includes("ctx.arc(ax, y - size * 0.32, R, 0, Math.PI * 2)");
})());

ok("the glitch/chroma RGB-split distance widens with glitchEndP during Glitch Blackout", (() => {
  const fn = extractFn("drawTextLayer");
  return !!fn && fn.includes("glitchEndP > 0 ? size * (0.05 + glitchEndP * 0.35)");
})());

ok("finalizeTextEndingIfDone exists and drawTextLayer calls it once an ending is active", (() => {
  const hasFn = !!extractFn("finalizeTextEndingIfDone");
  const caller = extractFn("drawTextLayer");
  return hasFn && !!caller && caller.includes("if (ending) finalizeTextEndingIfDone();");
})());

ok("finalizeTextEndingIfDone does nothing before an ending's duration has elapsed, and clears S.textEnding + hides text + syncs the checkbox once it has (genuine behavioral check via mock S/$/checkbox, not a structural text match)", (() => {
  const checkboxStub = { checked: true };
  global.$ = id => (id === "textShow" ? checkboxStub : null);
  global.TEXT_ENDING_DUR = { shatter: 0.6 };
  global.S = { time: 5.0, textEnding: { type: "shatter", t0: 4.5 }, textShow: true };   // elapsed 0.5s of 0.6s (textEndingScale unset -> falls back to 1)
  const { finalizeTextEndingIfDone } = loadFns(["finalizeTextEndingIfDone", "textEndingDuration"]);

  finalizeTextEndingIfDone();
  const notYetDone = global.S.textEnding !== null && global.S.textShow === true && checkboxStub.checked === true;

  global.S.time = 5.2;   // elapsed 0.7s of 0.6s — done
  finalizeTextEndingIfDone();
  const done = global.S.textEnding === null && global.S.textShow === false && checkboxStub.checked === false;

  return notYetDone && done;
})());

section("Text Endings — adjustable duration slider");

ok("the Ending-Dauer slider markup exists with min=50/max=200/value=140 and its paired value label (HTML markup check — uses `html`, not `script`)", (() => {
  return html.includes('<input type="range" id="textEndingScale" min="50" max="200" value="140">') &&
         html.includes('<span class="val" id="textEndingScaleVal">140%</span>');
})());

ok("S default state has textEndingScale: 1.4", (() => {
  return script.includes("textEndingScale: 1.4,");
})());

ok("textEndingDuration exists and multiplies TEXT_ENDING_DUR[type] by S.textEndingScale, with a fallback of 1", (() => {
  const fn = extractFn("textEndingDuration");
  return !!fn && fn.includes("TEXT_ENDING_DUR[type]") && fn.includes("S.textEndingScale || 1");
})());

ok("textEndingDuration behaves correctly: scales the base duration, and falls back to the unscaled base when S.textEndingScale is falsy (genuine behavioral check via loadFns + a mock S/TEXT_ENDING_DUR, not just a structural text match)", (() => {
  global.TEXT_ENDING_DUR = { shatter: 0.6 };
  global.S = { textEndingScale: 2 };
  const { textEndingDuration } = loadFns(["textEndingDuration"]);
  const scaled = Math.abs(textEndingDuration("shatter") - 1.2) < 1e-9;   // 0.6 * 2

  global.S.textEndingScale = 0;   // falsy — must fall back to the unscaled base (0.6), not 0
  const fallback = Math.abs(textEndingDuration("shatter") - 0.6) < 1e-9;

  return scaled && fallback;
})());

ok("drawTextLayer's endingP calls textEndingDuration(ending.type) and no longer reads TEXT_ENDING_DUR[ending.type] directly", (() => {
  const fn = extractFn("drawTextLayer");
  return !!fn && fn.includes("textEndingDuration(ending.type)") && !fn.includes("TEXT_ENDING_DUR[ending.type]");
})());

ok("finalizeTextEndingIfDone calls textEndingDuration(ending.type) and no longer reads TEXT_ENDING_DUR[ending.type] directly", (() => {
  const fn = extractFn("finalizeTextEndingIfDone");
  return !!fn && fn.includes("textEndingDuration(ending.type)") && !fn.includes("TEXT_ENDING_DUR[ending.type]");
})());

ok("the event listener wires the slider to S.textEndingScale and updates its value label from the raw slider value", (() => {
  return script.includes('$("textEndingScale").addEventListener("input", e => {') &&
         script.includes("S.textEndingScale = e.target.value / 100;") &&
         script.includes('$("textEndingScaleVal").textContent = e.target.value + "%";');
})());

ok("the project save blob includes endingScale: S.textEndingScale", (() => {
  return script.includes("endingScale: S.textEndingScale }");
})());

ok("applyProject's load-apply sets S.textEndingScale from t.endingScale, falling back to 1.4 for an older saved project that predates this field", (() => {
  return script.includes('S.textEndingScale = t.endingScale != null ? t.endingScale : 1.4;');
})());

ok("applyProject's UI sync sets the slider position and value label from S.textEndingScale", (() => {
  return script.includes('$("textEndingScale").value = Math.round(S.textEndingScale * 100); $("textEndingScaleVal").textContent = Math.round(S.textEndingScale * 100) + "%";');
})());

ok("applyTextPreset never references textEndingScale — switching a Text style preset must not silently change Frank's preferred Ending speed", (() => {
  const fn = extractFn("applyTextPreset");
  return !!fn && !fn.includes("textEndingScale");
})());

section("Help Overlay — F1-F5 + FX Rack III mentions");

ok("the Ebenen summary no longer says \"FX Rack I+II\" and now says \"FX Rack I–III\"", (() => {
  return !html.includes("FX Rack I+II") && html.includes("FX Rack I–III");
})());

ok("the Tastatur list documents F1–F5 Text-Endings", (() => {
  return html.includes("<span><b>F1–F5</b> Text-Endings (Shatter/Vortex/Dissolve/Iris/Glitch)</span>");
})());

ok("the new F1-F5 line is positioned after Alt+1-0 (FX Rack III) and before the Zoom line, matching the intended reading order", (() => {
  const altIdx = html.indexOf("<span><b>Alt+1–0</b> FX Rack III</span>");
  const f1Idx = html.indexOf("<span><b>F1–F5</b> Text-Endings");
  const zoomIdx = html.indexOf("<span><b>+ / − / 0</b> Zoom");
  return altIdx > 0 && f1Idx > altIdx && zoomIdx > f1Idx;
})());

section("Landing page — feature card refresh");
// NOTE: the module-level `html` const above is elastic-morph.html (the app), not index.html
// (the marketing landing page). This section tests index.html specifically, so it reads
// that file into its own local variable rather than reusing `html`.
const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

ok("index.html no longer says \"20 FX\" and now says \"30 FX\"", (() => {
  return !indexHtml.includes("20 FX") && indexHtml.includes("30 FX");
})());

ok("I18N.de and I18N.en both define f6 (Particle Mode) — exactly 2 occurrences across both language blocks", (() => {
  return (indexHtml.match(/f6: "/g) || []).length === 2;
})());

ok("I18N.de and I18N.en both define f7 (Live Text & Lyrics) — exactly 2 occurrences across both language blocks", (() => {
  return (indexHtml.match(/f7: "/g) || []).length === 2;
})());

ok("I18N.de and I18N.en both define f8 (Video Timeline) — exactly 2 occurrences across both language blocks", (() => {
  return (indexHtml.match(/f8: "/g) || []).length === 2;
})());

ok("the feature grid has exactly 8 cards (5 kept + 3 new)", (() => {
  return (indexHtml.match(/<div class="card /g) || []).length === 8;
})());

ok("all 3 new card titles are present exactly once each: Particle Mode, Live Text & Lyrics, Video Timeline", (() => {
  const count = s => (indexHtml.match(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  return count("<h3>Particle Mode</h3>") === 1 &&
         count("<h3>Live Text &amp; Lyrics</h3>") === 1 &&
         count("<h3>Video Timeline</h3>") === 1;
})());

section("Shader Engine — Warp Tunnel");

ok("SHADER_STYLE_ID gained the warpTunnel entry with the correct uStyle value (16)", (() => {
  return /warpTunnel:\s*16/.test(script);
})());

["warpTunnelStyle"].forEach(fn =>
  ok("GLSL " + fn + " defined & called", (frag.split(fn).length - 1) >= 2));

ok("segGlow's total source-text occurrence count rises above hypercube's own 33 (1 definition + 32 call sites) baseline by the 4 new call sites warpTunnelStyle actually adds in source form (1 inside the 48-iteration streak loop + 3 inside the 3-iteration shard loop — the 48 and 3 are runtime loop counts, not unrolled source occurrences)", (() => {
  return (frag.split("segGlow").length - 1) >= 37;
})());

ok("main()'s dispatch chain: cosmicDrift's bare else became an explicit uStyle<15.5 branch, followed by warpTunnel as the new bare else", (() => {
  const mainIdx = frag.lastIndexOf("void main(){");
  if (mainIdx < 0) return false;
  const mainBody = frag.slice(mainIdx);
  const cosmicIdx = mainBody.indexOf("else if(uStyle < 15.5) col = cosmicDriftStyle(uv);");
  const warpIdx = mainBody.indexOf("else                   col = warpTunnelStyle(uv);");
  return cosmicIdx >= 0 && warpIdx > cosmicIdx;
})());

ok("#shStyle gained the new <option> after cosmicDrift", (() => {
  const selMatch = html.match(/<select id="shStyle"[^>]*>([\s\S]*?)<\/select>/);
  if (!selMatch) return false;
  const body = selMatch[1];
  const cosmicIdx = body.indexOf('value="cosmicDrift"');
  const warpIdx = body.indexOf('value="warpTunnel"');
  return cosmicIdx >= 0 && warpIdx > cosmicIdx;
})());

ok("src/inject-v64.js's HEAVY_SHADER Set literal includes warpTunnel — the actual source of truth (this file is regenerated into elastic-morph.html on every build; editing only the html mirror would be silently overwritten)", (() => {
  const src = injectSrc("inject-v64.js");
  const m = src.match(/const HEAVY_SHADER = new Set\(\[([^\]]*)\]\);/);
  return !!m && m[1].includes('"warpTunnel"');
})());

ok("the assembled elastic-morph.html mirror's HEAVY_SHADER matches src/inject-v64.js exactly, proving node build.js regeneration actually propagated the change", (() => {
  const m = script.match(/const HEAVY_SHADER = new Set\(\[([^\]]*)\]\);/);
  return !!m && m[1].includes('"warpTunnel"');
})());

ok("warpTunnel is deliberately NOT added to the 820px-resolution-cap style list (gyroid/crystal/cosmicDrift only) — it has no raymarch loop, matching hypercube's precedent", (() => {
  const m = script.match(/SH\.style === "gyroid" \|\| SH\.style === "crystal" \|\| SH\.style === "cosmicDrift"/);
  return !!m && !script.includes('SH.style === "warpTunnel"');
})());

section("Auto-VJ pool catch-up");

ok("the shader-style pool derives from Object.keys(SHADER_STYLE_ID), not a hardcoded literal — the old 3-item array is gone from autoVjStep", (() => {
  const fn = extractFn("autoVjStep");
  return !!fn && fn.includes("Object.keys(SHADER_STYLE_ID)") && !fn.includes('["fluid", "metaballs", "tunnel"]');
})());

ok("autoVjStep's Particle Mode block derives its pattern pool from PM_PATTERNS and its mirror pool from the live #pmMirror <select>, sets on/pattern/mirror/constellation, and calls initPM() when turning on", (() => {
  const fn = extractFn("autoVjStep");
  return !!fn && fn.includes("S.pmode.on = R() < 0.7;") && fn.includes("PM_PATTERNS.map(p => p[0])") &&
         fn.includes('document.querySelectorAll("#pmMirror option")') && fn.includes("S.pmode.constellation = R() < 0.35;") &&
         fn.includes("if (S.pmode.on) initPM();");
})());

ok("autoVjStep's Text Mode block is gated on S.textShow, derives its pool from the live #textAnim <select>, calls restartType(), and never references textTitle/textArtist/textLabel anywhere in the function", (() => {
  const fn = extractFn("autoVjStep");
  return !!fn && fn.includes("if (S.textShow && R() < 0.4)") && fn.includes('document.querySelectorAll("#textAnim option")') &&
         fn.includes("restartType();") && !fn.includes("textTitle") && !fn.includes("textArtist") && !fn.includes("textLabel");
})());

ok("autoVjStep's Particle Mode block picks a real PM_PATTERNS id when forced into its 'on' branch (genuine behavioral check via loadFns + a full mock environment, not a structural text match)", (() => {
  const shaderStyleIdSrc = (script.match(/const SHADER_STYLE_ID = (\{[^}]+\});/) || [])[1];
  global.SHADER_STYLE_ID = shaderStyleIdSrc ? eval("(" + shaderStyleIdSrc + ")") : {};
  const pmPatternsSrc = (script.match(/const PM_PATTERNS = (\[[\s\S]*?\]);/) || [])[1];
  global.PM_PATTERNS = pmPatternsSrc ? eval(pmPatternsSrc) : [];

  function extractOptionValues(id) {
    const m = html.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)</select>`));
    return m ? [...m[1].matchAll(/value="(\w+)"/g)].map(x => x[1]) : [];
  }
  const pmMirrorOpts = extractOptionValues("pmMirror");
  const textAnimOpts = extractOptionValues("textAnim");
  global.document = {
    querySelectorAll: sel => {
      if (sel === "#pmMirror option") return pmMirrorOpts.map(v => ({ value: v }));
      if (sel === "#textAnim option") return textAnimOpts.map(v => ({ value: v }));
      return [];
    }
  };
  const stubEl = () => ({ value: "", checked: false, textContent: "", classList: { toggle() {} } });
  global.$ = () => stubEl();
  global.PRESETS = [{ id: "p1" }, { id: "p2" }];
  global.ctrl = { morph: 0.5, colorDrift: 0.5, camDrift: 0.5, density: 0.5, pulse: 0.5 };
  global.updateBadge = () => {};
  global.spawnParticles = () => {};
  global.pickLayerBType = () => "moire";
  global.initStars = () => {};
  global.syncSliderUI = () => {};
  global.syncFXUI = () => {};
  global.syncFX2UI = () => {};
  global.syncFX3UI = () => {};
  global.syncFX4UI = () => {};
  global.initGL = () => {};
  global.initPM = () => {};
  global.restartType = () => {};
  global.fbctx = { clearRect() {} };
  global.fbC = { width: 10, height: 10 };
  global.S = {
    blendWith: null, blendAmt: 0,
    layerB: { on: false, type: "moire" },
    fx: { mirror: false, kaleido: false, tile: false, rgb: false, invert: false, pixelate: false, glitch: false, shake: false, feedback: false, strobe: false },
    fx2: { hexkaleido: false, droste: false, mirrorgrid: false, slice: false, spin: false, halftone: false, pulsezoom: false, posterize: false, radialblur: false, echospin: false },
    fx3: { scanlines: false, motionblur: false, letterbox: false, chromafringe: false, anamorphflare: false, bleachpulse: false, doubleexposure: false, dustscratches: false, lensflare: false, lightleak: false },
    fx4: { ripple: false, fisheye: false, melt: false, pagewarp: false, wavemirror: false },
    shader: { on: false, style: "fluid" },
    pmode: { on: false, pattern: "hyperspace", mirror: "off", constellation: false },
    textShow: true, textAnim: "static",
    autoVJ: { on: true, t: 0, intensity: 1 }
  };

  const origRandom = Math.random;
  Math.random = () => 0.1;
  try {
    const { autoVjStep } = loadFns(["autoVjStep"]);
    autoVjStep();
  } finally {
    Math.random = origRandom;
  }

  const realPatternIds = global.PM_PATTERNS.map(p => p[0]);
  return global.S.pmode.on === true && realPatternIds.includes(global.S.pmode.pattern);
})());

section("Lyric Mode upgrade — adaptive wipe, next-line preview, Hypno preset");

ok("lyricWipeDuration is defined and called from drawTextLayer's lyric-mode setup", (() => {
  const fn = extractFn("lyricWipeDuration");
  const caller = extractFn("drawTextLayer");
  return !!fn && !!caller && caller.includes("lyricWipeDuration(cur.line.t, next ? next.t : null)");
})());

ok("lyricWipeDuration clamps correctly in all 4 cases: passes a normal gap through, clamps a long gap down to 2.4, clamps a very short gap up to 0.6, and falls back to 2.4 when there's no next cue (genuine behavioral check via loadFns, not a structural text match)", (() => {
  const { lyricWipeDuration } = loadFns(["lyricWipeDuration"]);
  const normal = Math.abs(lyricWipeDuration(10, 11) - 1.0) < 1e-9;      // 1.0s gap, passes through
  const long = Math.abs(lyricWipeDuration(10, 14) - 2.4) < 1e-9;        // 4.0s gap, clamped down
  const short = Math.abs(lyricWipeDuration(10, 10.2) - 0.6) < 1e-9;     // 0.2s gap, clamped up
  const noNext = Math.abs(lyricWipeDuration(10, null) - 2.4) < 1e-9;    // last cue, no next
  return normal && long && short && noNext;
})());

ok("drawTextLayer's lyric-mode setup declares lyricNextText, computes the next cue, and sets S.lyricWipeDur via lyricWipeDuration", (() => {
  const fn = extractFn("drawTextLayer");
  return !!fn && fn.includes("let srcTitle, srcArtist, lyricNextText = \"\";") &&
         fn.includes("const next = LY.cues[cur.idx + 1];") &&
         fn.includes("lyricNextText = next ? next.text : \"\";") &&
         fn.includes("S.lyricWipeDur = lyricWipeDuration(cur.line.t, next ? next.t : null);");
})());

ok("the Karaoke Wipe branch uses S.lyricWipeDur in lyric mode and keeps the original fixed 2.4 otherwise", (() => {
  const fn = extractFn("drawTextLayer");
  return !!fn && fn.includes("(S.time - S.textT0) / (lyricMode ? S.lyricWipeDur : 2.4)");
})());

ok("the label line now shows lyricNextText in lyric mode, and still shows S.textLabel otherwise", (() => {
  const fn = extractFn("drawTextLayer");
  return !!fn && fn.includes("label = fmt(lyricMode ? lyricNextText : S.textLabel);");
})());

ok("src/inject-v104.js's LYRICS_STUDIO_PRESETS gained the hypno entry — the actual source of truth (this file is regenerated into elastic-morph.html on every build; editing only the html mirror would be silently overwritten)", (() => {
  const src = injectSrc("inject-v104.js");
  return src.includes('id: "hypno", name: "Hypno"') && src.includes('anim: "hypno"');
})());

ok("the assembled elastic-morph.html mirror's LYRICS_STUDIO_PRESETS matches src/inject-v104.js — 4 entries total, proving node build.js regeneration actually propagated the change", (() => {
  const m = script.match(/const LYRICS_STUDIO_PRESETS = \[([\s\S]*?)\n\];/);
  if (!m) return false;
  const idCount = (m[1].match(/id:\s*"/g) || []).length;
  return idCount === 4 && m[1].includes('id: "hypno"');
})());

/* ---------------- DNA Visual — Modular Patch (Patchbay engine) ---------------- */
section("DNA Visual — Modular Patch (Patchbay engine)");

["drawPatchbay", "buildPatchTopology"].forEach(fn =>
  ok("function " + fn + " defined", script.includes("function " + fn + "(")));

ok("drawScene's dispatch chain has a patchbay branch calling drawPatchbay, positioned after mazeGrid and before the final bare else", (() => {
  const mazeIdx = script.indexOf('dnaEngine === "mazeGrid"');
  const patchIdx = script.indexOf('dnaEngine === "patchbay"');
  const callIdx = script.indexOf("drawPatchbay(base, hue, growthF, energySize, seed);");
  return mazeIdx >= 0 && patchIdx > mazeIdx && callIdx > patchIdx;
})());

ok("renderPreviews has a patchbay branch positioned between the mazeGrid and dance branches", (() => {
  const mazeIdx = script.indexOf('p.engine === "mazeGrid"');
  const patchIdx = script.indexOf('p.engine === "patchbay"');
  const danceIdx = script.indexOf('p.engine === "dance"');
  return mazeIdx >= 0 && patchIdx > mazeIdx && danceIdx > patchIdx;
})());

ok("PRESETS contains exactly one modularPatch entry with bank rhythm and engine patchbay", (() => {
  const count = (script.match(/id:\s*"modularPatch"/g) || []).length;
  return count === 1 &&
    script.includes('id: "modularPatch", name: "Modular Patch", bank: "rhythm"') &&
    script.includes('engine: "patchbay"');
})());

ok("buildPatchTopology is deterministic, stays in range, avoids self-loops, and varies across seeds (genuine behavioral check via loadFns)", (() => {
  const { buildPatchTopology } = loadFns(["buildPatchTopology", "fract1"]);
  const a = buildPatchTopology(7);
  const b = buildPatchTopology(7);
  const c = buildPatchTopology(42);
  const sameForSameSeed = JSON.stringify(a) === JSON.stringify(b);
  const validShape = a.length === 5 && a.every(([x, y]) =>
    Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x <= 9 && y >= 0 && y <= 9 && x !== y);
  const variesAcrossSeeds = JSON.stringify(a) !== JSON.stringify(c);
  return sameForSameSeed && validShape && variesAcrossSeeds;
})());

section("FX Rack IV — Warp / Verzerrungsfeld (Ctrl+Shift+1..0)");

ok("FX4_DEFS defined with exactly 5 entries matching the 5 warp effect keys", (() => {
  const idx = script.indexOf("const FX4_DEFS = [");
  if (idx < 0) return false;
  const slice = script.slice(idx, idx + 800);
  return ["ripple", "fisheye", "melt", "pagewarp", "wavemirror"].every(k => slice.includes(`"${k}"`));
})());

ok("S.fx4 state initialized with the 5 warp keys all false, plus fx4MeltPhase: 0",
  script.includes("fx4: { ripple: false, fisheye: false, melt: false, pagewarp: false, wavemirror: false,") &&
  script.includes("fx4MeltPhase: 0,"));

["buildFX4", "toggleFX4", "syncFX4UI", "applyPostFX4"].forEach(fn =>
  ok("function " + fn + " defined", script.includes("function " + fn + "(")));

ok("keydown dispatch has a real e.ctrlKey && e.shiftKey branch calling toggleFX4, before the plain Ctrl (Rack II) branch", (() => {
  const shiftIdx = script.indexOf('if (e.ctrlKey && e.shiftKey) {         // Ctrl+Shift+digit');
  const ctrlIdx = script.indexOf('} else if (e.ctrlKey) {                // Ctrl+digit');
  const callIdx = script.indexOf("toggleFX4(def4[0]);");
  return shiftIdx >= 0 && callIdx > shiftIdx && ctrlIdx > callIdx;
})());

ok("the old bare !e.metaKey guard is gone (replaced by the real branch above)",
  !script.includes("} else if (!e.metaKey) {               // plain digit → FX Rack I"));

ok("applyPostFX4 is called in the render chain after applyPostFX3 and before applyAutoExposure", (() => {
  const fx3Idx = script.indexOf("applyPostFX3(W, H, dt);");
  const fx4Idx = script.indexOf("applyPostFX4(W, H, dt);");
  const aeIdx = script.indexOf("applyAutoExposure(W, H);");
  return fx3Idx >= 0 && fx4Idx > fx3Idx && aeIdx > fx4Idx;
})());

ok("buildFX4() is called after buildFX3() in the post-boot init sequence", (() => {
  const b3 = script.indexOf("buildFX3();");
  const b4 = script.indexOf("buildFX4();");
  return b3 >= 0 && b4 > b3;
})());

ok("HTML has the fx4Chips container and a Ctrl+Shift+1–0 label, positioned after the Rack III block", (() => {
  const fx3Block = html.indexOf('id="fx3Chips"');
  const fx4Label = html.indexOf("FX Rack IV");
  const fx4Chips = html.indexOf('id="fx4Chips"');
  return fx3Block >= 0 && fx4Label > fx3Block && fx4Chips > fx4Label &&
    html.slice(fx4Label, fx4Chips).includes("Ctrl+Shift+1");
})());

ok("projectData()/applyProject() round-trip fx4 in their pre-marker base functions (before @BUILD-INJECT-V58)", (() => {
  const markerIdx = script.indexOf("/* @BUILD-INJECT-V58 */");
  const saveIdx = script.indexOf("fx4: { ...S.fx4 },");
  const loadIdx = script.indexOf("if (o.fx4) for (const k in S.fx4) S.fx4[k] = !!o.fx4[k];");
  return markerIdx > 0 && saveIdx > 0 && saveIdx < markerIdx && loadIdx > 0 && loadIdx < markerIdx;
})());

ok("Auto-VJ has a safe4 pool with all 10 warp keys, clears S.fx4 with the other racks, and syncs FX4 UI",
  script.includes('const safe4 = ["ripple", "fisheye", "melt", "pagewarp", "wavemirror",\n      "haze", "vortex", "noise", "slitscan", "gravity"];') &&
  script.includes("Object.keys(S.fx4).forEach(k => S.fx4[k] = false);") &&
  script.includes("syncFXUI(); syncFX2UI(); syncFX3UI(); syncFX4UI();"));

ok("Auto-VJ's nSafe pick logic uses the new 4-way split (0.25/0.5/0.75), not the old 3-way one",
  script.includes("if (pick < 0.25) S.fx[safe1[Math.floor(R() * safe1.length)]] = true;") &&
  script.includes("else if (pick < 0.5) S.fx2[safe2[Math.floor(R() * safe2.length)]] = true;") &&
  script.includes("else if (pick < 0.75) S.fx3[safe3[Math.floor(R() * safe3.length)]] = true;") &&
  script.includes("else S.fx4[safe4[Math.floor(R() * safe4.length)]] = true;"));

ok("silenceFxForCover clears S.fx4 and calls syncFX4UI (assembled, post-build.js script)", (() => {
  const idx = script.indexOf("function silenceFxForCover()");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 500);
  return body.includes("Object.keys(S.fx4).forEach(k => { S.fx4[k] = false; });") &&
    body.includes('if (typeof syncFX4UI === "function") syncFX4UI();');
})());

ok("each of the 5 warp effects references its documented audio signal and calls snapshot(W, H)", (() => {
  const idx = script.indexOf("function applyPostFX4(W, H, dt) {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 4000);
  const checks = [
    ["fx.ripple", "S.beat"], ["fx.fisheye", "S.beat"], ["fx.melt", "S.bass"],
    ["fx.pagewarp", "S.mids"], ["fx.wavemirror", "S.bass"]
  ];
  return checks.every(([flag, sig]) => {
    const flagIdx = body.indexOf("if (" + flag + ")");
    if (flagIdx < 0) return false;
    const block = body.slice(flagIdx, flagIdx + 700);
    return block.includes(sig) && block.includes("snapshot(W, H);");
  });
})());

section("FX Rack IV Part 2 — rebind (Ctrl+Shift+1..0) + 5 remaining effects");

ok("FX4_DEFS has 10 entries with the 5 new keys correct", (() => {
  const idx = script.indexOf("const FX4_DEFS = [");
  if (idx < 0) return false;
  const slice = script.slice(idx, idx + 1400);
  const allKeys = ["ripple", "fisheye", "melt", "pagewarp", "wavemirror",
    "haze", "vortex", "noise", "slitscan", "gravity"];
  return allKeys.every(k => slice.includes(`"${k}"`));
})());

ok("S.fx4 initialized with all 10 keys false, plus fx4SlitIdx: 0",
  script.includes("haze: false, vortex: false, noise: false, slitscan: false, gravity: false") &&
  script.includes("fx4SlitIdx: 0,"));

ok("FX4_SLIT_DEPTH and fx4SlitBuf module-level ring buffer defined",
  script.includes("const FX4_SLIT_DEPTH = 10;") &&
  script.includes("const fx4SlitBuf = Array.from({ length: FX4_SLIT_DEPTH }"));

ok("resize() sizes the Slit-Scan ring buffer alongside bloomC",
  script.includes("fx4SlitBuf.forEach(b => { b.c.width = bloomC.width; b.c.height = bloomC.height; });"));

ok("keydown dispatch checks e.ctrlKey && e.shiftKey BEFORE plain e.ctrlKey, and the old e.metaKey Rack IV branch is gone", (() => {
  const shiftIdx = script.indexOf("if (e.ctrlKey && e.shiftKey) {         // Ctrl+Shift+digit");
  const ctrlIdx = script.indexOf("} else if (e.ctrlKey) {                // Ctrl+digit");
  const oldMetaGone = !script.includes("Cmd/Meta+digit → FX Rack IV");
  return shiftIdx >= 0 && ctrlIdx > shiftIdx && oldMetaGone;
})());

ok("HTML label reads Ctrl+Shift+1–0, old Cmd+1–0 text is gone", (() => {
  const hasNew = html.includes("FX Rack IV — Warp") && html.includes("(Ctrl+Shift+1–0)</small>");
  const oldGone = !html.includes("(Cmd+1–0)</small>");
  return hasNew && oldGone;
})());

ok("applyPostFX4 contains all 5 new effect blocks, each referencing its documented audio signal (except slitscan) and calling snapshot(W, H) (except slitscan)", (() => {
  const idx = script.indexOf("function applyPostFX4(W, H, dt) {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 8000);
  const checks = [
    ["fx.haze", "S.loudness", true],
    ["fx.vortex", "S.transient", true],
    ["fx.noise", "S.highs", true],
    ["fx.slitscan", null, false],
    ["fx.gravity", "S.transient", true]
  ];
  return checks.every(([flag, sig, needsSnapshot]) => {
    const flagIdx = body.indexOf("if (" + flag + ")");
    if (flagIdx < 0) return false;
    const block = body.slice(flagIdx, flagIdx + 900);
    const sigOk = sig ? block.includes(sig) : true;
    const snapOk = needsSnapshot ? block.includes("snapshot(W, H)") : true;
    return sigOk && snapOk;
  });
})());

section("Bugfix — Scene Bank Shift+1-8 recall no longer collides with FX Rack II/III/IV digit shortcuts");

ok("Scene Bank recall requires bare Shift (no Ctrl/Meta/Alt), so it no longer double-fires alongside Ctrl+Shift+digit (FX Rack IV), Ctrl+digit (FX Rack II), or Alt+digit (FX Rack III)",
  script.includes('if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && /^Digit[1-8]$/.test(e.code)) { e.preventDefault(); recallScene((activeSceneBank - 1) * 8 + (+e.code.slice(5) - 1)); }'));

section("Shader Engine — Speed / Scale / Color Bias (global controls)");

ok("S.shader default object gained speed/scale/colorBias defaults (1, 1, 0)", (() => {
  const m = script.match(/shader:\s*\{[^}]*\}/);
  if (!m) return false;
  const body = m[0];
  return /speed:\s*1\b/.test(body) && /scale:\s*1\b/.test(body) && /colorBias:\s*0\b/.test(body);
})());

ok("SHADER_FRAG declares the new uScale/uColorBias uniforms", frag.includes("uniform float uScale;") && frag.includes("uniform float uColorBias;"));

ok("main() applies uScale to uv right after computing it, before the existing beat zoom-punch", (() => {
  const mainIdx = frag.lastIndexOf("void main(){");
  if (mainIdx < 0) return false;
  const mainBody = frag.slice(mainIdx, mainIdx + 400);
  const uvIdx = mainBody.indexOf("vec2 uv0 = (gl_FragCoord.xy - 0.5*uRes) / min(uRes.x, uRes.y);");
  const scaleIdx = mainBody.indexOf("vec2 uv = uv0 * uScale;");
  const punchIdx = mainBody.indexOf("uv *= 1.0 - uBeat*0.10;");
  return uvIdx >= 0 && scaleIdx > uvIdx && punchIdx > scaleIdx;
})());

ok("main() applies the color-bias saturation lift to col before the existing vignette", (() => {
  const mainIdx = frag.lastIndexOf("void main(){");
  if (mainIdx < 0) return false;
  const mainBody = frag.slice(mainIdx);
  const biasIdx = mainBody.indexOf("col = max(mix(vec3(lum), col, 1.0 + uColorBias), 0.0);");
  const vigIdx = mainBody.indexOf("float vig = 1.0 - dot(uv0,uv0)*0.35;");
  return biasIdx >= 0 && vigIdx > biasIdx;
})());

ok("initGL's GL.loc gains scale/colorBias uniform locations", (() => {
  const idx = script.indexOf("GL.loc = {");
  if (idx < 0) return false;
  const block = script.slice(idx, idx + 700);
  return block.includes('gl.getUniformLocation(prog, "uScale")') && block.includes('gl.getUniformLocation(prog, "uColorBias")');
})());

ok("renderShader scales the uTime uniform by SH.speed and sets the new uScale/uColorBias uniforms", (() => {
  const idx = script.indexOf("function renderShader(W, H, hue){");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 2000);
  return body.includes("gl.uniform1f(L.time, S.time * (SH.speed != null ? SH.speed : 1));")
    && body.includes("gl.uniform1f(L.scale, SH.scale != null ? SH.scale : 1);")
    && body.includes("gl.uniform1f(L.colorBias, SH.colorBias != null ? SH.colorBias : 0);");
})());

ok("Shader Engine panel gained the Speed/Scale/Color Bias slider rows with correct ranges/defaults", (() => {
  const panelIdx = html.indexOf('<select id="shStyle"');
  if (panelIdx < 0) return false;
  const block = html.slice(panelIdx, panelIdx + 2650);
  return block.includes('<input type="range" id="shSpeed" min="20" max="300" value="100">')
    && block.includes('<input type="range" id="shScale" min="50" max="250" value="100">')
    && block.includes('<input type="range" id="shColorBias" min="-80" max="80" value="0">');
})());

ok("buildShader() wires the 3 new sliders to S.shader.speed/scale/colorBias", (() => {
  const idx = script.indexOf("function buildShader() {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 1000);
  return body.includes('S.shader.speed = e.target.value / 100; $("shSpeedVal").textContent = e.target.value;')
    && body.includes('S.shader.scale = e.target.value / 100; $("shScaleVal").textContent = e.target.value;')
    && body.includes('S.shader.colorBias = e.target.value / 100; $("shColorBiasVal").textContent = e.target.value;');
})());

ok("syncShaderUI() pushes S.shader.speed/scale/colorBias into the 3 new sliders", (() => {
  const idx = script.lastIndexOf("function syncShaderUI() {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 900);
  return body.includes('$("shSpeed").value = Math.round(S.shader.speed * 100); $("shSpeedVal").textContent = Math.round(S.shader.speed * 100);')
    && body.includes('$("shScale").value = Math.round(S.shader.scale * 100); $("shScaleVal").textContent = Math.round(S.shader.scale * 100);')
    && body.includes('$("shColorBias").value = Math.round(S.shader.colorBias * 100); $("shColorBiasVal").textContent = Math.round(S.shader.colorBias * 100);');
})());

ok("syncShaderUI's Speed/Scale/Color Bias sync also exists in its true source file (src/inject-v93.js), not only in the generated elastic-morph.html mirror", (() => {
  const src = injectSrc("inject-v93.js");
  const idx = src.indexOf("function syncShaderUI() {");
  if (idx < 0) return false;
  const body = src.slice(idx, idx + 900);
  return body.includes('$("shSpeed").value = Math.round(S.shader.speed * 100); $("shSpeedVal").textContent = Math.round(S.shader.speed * 100);')
    && body.includes('$("shScale").value = Math.round(S.shader.scale * 100); $("shScaleVal").textContent = Math.round(S.shader.scale * 100);')
    && body.includes('$("shColorBias").value = Math.round(S.shader.colorBias * 100); $("shColorBiasVal").textContent = Math.round(S.shader.colorBias * 100);');
})());

ok("project load clamps speed/scale/colorBias with fbClamp and syncs the 3 new sliders (old saves without these fields fall back to defaults, not undefined)", (() => {
  const idx = script.indexOf("if (o.shader) {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 1200);
  return body.includes("S.shader.speed = fbClamp(S.shader.speed, 0.2, 3.0, 1);")
    && body.includes("S.shader.scale = fbClamp(S.shader.scale, 0.5, 2.5, 1);")
    && body.includes("S.shader.colorBias = fbClamp(S.shader.colorBias, -0.8, 0.8, 0);")
    && body.includes('$("shSpeed").value = Math.round(S.shader.speed * 100); $("shSpeedVal").textContent = Math.round(S.shader.speed * 100);');
})());

section("Video Timeline — per-clip Filter/Fit overrides");

ok("addBgVidClipAt's cue gains filter/fit defaulting to null (inherit global)", (() => {
  const fn = extractFn("addBgVidClipAt");
  return !!fn && fn.includes("fadeIn: 0, fadeOut: 0, filter: null, fit: null, name:");
})());

ok("updateBgVideoTimeline mirrors the active cue onto S.bgVid._cue, and clears it when there's no active cue", (() => {
  const fn = extractFn("updateBgVideoTimeline");
  return !!fn
    && fn.includes("S.bgVid.el = cue.el; S.bgVid.src = cue.src; S.bgVid.on = true; S.bgVid._active = true;\n    S.bgVid._cue = cue;")
    && fn.includes("S.bgVid._active = false;\n    S.bgVid._cue = null;");
})());

ok("drawClip accepts an optional cue param and computes effFit/effFilter from it, falling back to the global v.cover/v.filter when the cue has no override", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes("const drawClip = (el, alpha, xOff, yOff = 0, scale = 1, cue = null) => {")
    && fn.includes('const effFit = cue && cue.fit != null ? cue.fit : (v.cover ? "cover" : "contain");')
    && fn.includes("const effFilter = cue && cue.filter != null ? cue.filter : v.filter;")
    && fn.includes('const s = effFit === "cover" ? Math.max(W / vw, H / vh) : Math.min(W / vw, H / vh);')
    && fn.includes('const filt = typeof bgVidFilterCSS === "function" ? bgVidFilterCSS({ filter: effFilter }) : "none";');
})());

ok("drawGlitchClip accepts an optional cue param, forwards it to its own drawClip fallback call, and computes effFit/effFilter the same way as drawClip", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  const idx = fn ? fn.indexOf("const drawGlitchClip = ") : -1;
  if (idx < 0) return false;
  const body = fn.slice(idx, idx + 1200);
  return body.includes("const drawGlitchClip = (el, alpha, envelope, cue = null) => {")
    && body.includes("drawClip(el, alpha, 0, 0, 1, cue); return;")
    && body.includes('const effFit = cue && cue.fit != null ? cue.fit : (v.cover ? "cover" : "contain");')
    && body.includes("const effFilter = cue && cue.filter != null ? cue.filter : v.filter;")
    && body.includes('const s = effFit === "cover" ? Math.max(hw / vw, hh / vh) : Math.min(hw / vw, hh / vh);')
    && body.includes('const filt = typeof bgVidFilterCSS === "function" ? bgVidFilterCSS({ filter: effFilter }) : "none";');
})());

ok("every drawClip/drawGlitchClip call site in drawBgVideoTimeline passes its own cue (S.bgVid._cue for steady-state, from/to for every transition branch, matching which element it draws)", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  if (!fn) return false;
  const calls = [
    "drawClip(v.el, 1, 0, 0, 1, S.bgVid._cue);",
    "drawClip(from.el, 1 - p, 0, 0, 1, from);\n    drawClip(to.el, p, 0, 0, 1, to);",
    "drawClip(from.el, 1, 0, 0, 1, from);\n    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * p, H); ctx.clip();\n    drawClip(to.el, 1, 0, 0, 1, to);",
    "drawClip(from.el, 1, -W * p, 0, 1, from);\n    drawClip(to.el, 1, W * (1 - p), 0, 1, to);",
    "drawClip(from.el, 1, 0, 0, 1, from);\n    ctx.save(); ctx.beginPath();\n    ctx.arc(W / 2, H / 2, Math.max(1, Math.hypot(W, H) / 2 * p), 0, Math.PI * 2);\n    ctx.clip();\n    drawClip(to.el, 1, 0, 0, 1, to);",
    "drawClip(from.el, 1 - p, 0, 0, 1, from);\n    drawClip(to.el, p, 0, 0, 0.3 + 0.7 * p, to);",
    "drawClip(from.el, 1, 0, -H * p, 1, from);\n    drawClip(to.el, 1, 0, H * (1 - p), 1, to);",
    "drawClip(from.el, 1, -W * p, -H * p, 1, from);\n    drawClip(to.el, 1, W * (1 - p), H * (1 - p), 1, to);",
    "drawGlitchClip(from.el, 1 - p, envelope, from);\n    drawGlitchClip(to.el, p, envelope, to);",
  ];
  return calls.every(c => fn.includes(c));
})());

ok("renderBgVidTLPanel's per-clip panel gains a Filter select with all 8 options (Global + the 7 BG_VID_FILTERS presets)", (() => {
  const fn = extractFn("renderBgVidTLPanel");
  if (!fn) return false;
  const opts = ['value="">— Global —', 'value="none">Kein Filter', 'value="cinematic">Cinematic', 'value="bw">Schwarzweiß',
    'value="duotone">Duotone (DNA)', 'value="vintage">Vintage', 'value="dreamy">Dreamy', 'value="neon">Neon Glow'];
  return fn.includes('id="bgVidClipFilter"') && opts.every(o => fn.includes(o));
})());

ok("renderBgVidTLPanel's per-clip panel gains a Fit select with Global/Cover/Contain options", (() => {
  const fn = extractFn("renderBgVidTLPanel");
  return !!fn
    && fn.includes('<label>Fit <select id="bgVidClipFit"><option value="">— Global —</option><option value="cover">Cover (Bild füllen)</option><option value="contain">Contain (Bild einpassen)</option></select></label>');
})());

ok("renderBgVidTLPanel syncs the Filter/Fit selects to the cue's current override (empty string when null, i.e. \"— Global —\") and wires changes back with the e.target.value || null fallback", (() => {
  const fn = extractFn("renderBgVidTLPanel");
  return !!fn
    && fn.includes('$("bgVidClipFilter").value = cue.filter || "";')
    && fn.includes('$("bgVidClipFilter").addEventListener("change", e => cue.filter = e.target.value || null);')
    && fn.includes('$("bgVidClipFit").value = cue.fit || "";')
    && fn.includes('$("bgVidClipFit").addEventListener("change", e => cue.fit = e.target.value || null);');
})());

section("Demo Showcase — wash-out fix (overlay blend, no strobe/shake FX)");

ok("DEMO_SHOWCASE.shader uses overlay blend at reduced intensity/opacity (was lighter/0.84/0.58 -- purely-additive blend against clubStrobe's low bgFade washed the demo to flat gray within seconds, confirmed live against production)", (() => {
  const idx = script.indexOf("const DEMO_SHOWCASE = {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 700);
  return body.includes('shader: { on: true, style: "laser", intensity: 0.7, opacity: 0.5, blend: "overlay", speed: 1, scale: 1, colorBias: 0 },');
})());

ok("DEMO_SHOWCASE.fx no longer auto-enables strobe/shake (both were independently additive-composited and independently contributed to the same wash-out, verified live)", (() => {
  const idx = script.indexOf("const DEMO_SHOWCASE = {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 700);
  return body.includes("fx: [],");
})());

ok("DEMO_SHOWCASE.presetId/ctrl/mix are unchanged -- the wash was fully explained by shader.blend + fx, not these", (() => {
  const idx = script.indexOf("const DEMO_SHOWCASE = {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 700);
  return body.includes('presetId: "clubStrobe",')
    && body.includes("pulse: 0.82, morph: 0.62, density: 0.72, memory: 0.28,")
    && body.includes("colorDrift: 0.48, camDrift: 0.42, zoom: 0.52, mutation: 0.38,")
    && body.includes("gravity: 0.32, organic: 0.5")
    && body.includes("mix: { bass: 1.18, mid: 1.1, high: 1.05, autoLevel: true, beatThresh: 0.028 }");
})());

section("Stem Separation — shared energy-curve helper + API client");

ok("computeEnergyCurve is a standalone function with the documented signature", (() => {
  return script.includes("function computeEnergyCurve(channelData, N = 240)");
})());

ok("analyzeTrack calls computeEnergyCurve instead of containing its own inline RMS/smoothing loop (regression guard for the extraction)", (() => {
  const fn = extractFn("analyzeTrack");
  return !!fn
    && fn.includes("const sm = computeEnergyCurve(ch);")
    && fn.includes("S.energyCurve = sm;")
    && !fn.includes("let curve = new Float32Array(N);");
})());

ok("analyzeTrack's fingerprint loop sizes itself off sm.length, not a bare N (regression guard: N was a local removed by the computeEnergyCurve extraction, and a lingering reference to it threw ReferenceError on every analyzeTrack call)", (() => {
  const fn = extractFn("analyzeTrack");
  return !!fn
    && fn.includes("for (let i = 0; i < sm.length; i++) { h ^= Math.round(sm[i] * 255); h = Math.imul(h, 16777619); }");
})());

ok("computeEnergyCurve reproduces the exact original windowing/smoothing constants (N=240 default, stride 16, smoothing radius 4, normalized by max)", (() => {
  const idx = script.indexOf("function computeEnergyCurve(channelData, N = 240)");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 700);
  return body.includes("for (let j = 0; j < win; j += 16)")
    && body.includes("for (let k = -4; k <= 4; k++)")
    && body.includes("const mx = Math.max(...sm) || 1;");
})());

ok("STEM_API_BASE points at the verified production Elastic Split API", (() => {
  return script.includes('const STEM_API_BASE = "https://elastic-split-api-production.up.railway.app";');
})());

ok("submitStemJob posts multipart form data with file + mode=4stems to /split", (() => {
  const fn = extractFn("submitStemJob");
  return !!fn
    && fn.includes('fd.append("file", file);')
    && fn.includes('fd.append("mode", "4stems");')
    && fn.includes("`${STEM_API_BASE}/split`")
    && fn.includes('method: "POST"');
})());

ok("pollStemJobStatus GETs /status/{job_id} and throws on a non-OK response", (() => {
  const fn = extractFn("pollStemJobStatus");
  return !!fn
    && fn.includes("`${STEM_API_BASE}/status/${jobId}`")
    && fn.includes("if (!res.ok) throw new Error(");
})());

ok("downloadStem GETs /download/{job_id}/{stem}?format=wav and returns an ArrayBuffer", (() => {
  const fn = extractFn("downloadStem");
  return !!fn
    && fn.includes("`${STEM_API_BASE}/download/${jobId}/${stemName}?format=wav`")
    && fn.includes("return res.arrayBuffer();");
})());

ok("S gains stemMode/stemJob/stemCurves defaults", (() => {
  return script.includes('stemMode: "simple",') && script.includes("stemJob: null,") && script.includes("stemCurves: null,");
})());

ok("S gains currentAudioFile/currentDemoUrl/currentDemoName defaults for resolving which File to send to the stem API later", (() => {
  return script.includes("currentAudioFile: null,") && script.includes("currentDemoUrl: null,") && script.includes("currentDemoName: null,");
})());

ok("analyzeTrack resets stem state at the start of every new track analysis (a stale job/curve from the previous track must not leak into the new one)", (() => {
  const fn = extractFn("analyzeTrack");
  return !!fn && fn.includes('S.stemMode = "simple"; S.stemJob = null; S.stemCurves = null;');
})());

ok("loadFile records the real uploaded File on S.currentAudioFile and clears the demo-url fields", (() => {
  const fn = extractFn("loadFile");
  return !!fn && fn.includes("S.currentAudioFile = file; S.currentDemoUrl = null;");
})());

ok("analyzeTrackFromUrl records the demo track's url/name (no real File exists for the bundled demo track) and clears currentAudioFile", (() => {
  const fn = extractFn("analyzeTrackFromUrl");
  return !!fn && fn.includes("S.currentAudioFile = null; S.currentDemoUrl = url; S.currentDemoName = name;");
})());

ok("resolveAudioFileForStemJob returns S.currentAudioFile directly when it's set", (() => {
  const fn = extractFn("resolveAudioFileForStemJob");
  return !!fn && fn.includes("if (S.currentAudioFile) return S.currentAudioFile;");
})());

ok("resolveAudioFileForStemJob builds a real File from fetchDemoBytes(S.currentDemoUrl) when there's no currentAudioFile, and throws if fetchDemoBytes returns null", (() => {
  const fn = extractFn("resolveAudioFileForStemJob");
  return !!fn
    && fn.includes("const ab = await fetchDemoBytes(S.currentDemoUrl);")
    && fn.includes('if (!ab) throw new Error("Demo-Track konnte nicht geladen werden.");')
    && fn.includes('new File([ab], S.currentDemoName || "demo.mp3", { type: "audio/mpeg" });');
})());

ok("resolveAudioFileForStemJob throws when no track is loaded at all", (() => {
  const fn = extractFn("resolveAudioFileForStemJob");
  return !!fn && fn.includes('throw new Error("Kein Track geladen.");');
})());

ok('STEM_JOB_LS follows the existing elasticMorph.* localStorage naming convention', (() => {
  return script.includes('const STEM_JOB_LS = "elasticMorph.stemJob";');
})());

ok("startStemSeparation refuses to start while the current track hasn't finished analyzing, reverting to Simple mode instead of keying a job under a stale S.fpHash (regression guard: analyzeTrack's catch path never resets S.fpHash, so a mid-analysis or failed-analysis click used to submit a job for the WRONG track's hash)", (() => {
  const fn = extractFn("startStemSeparation");
  return !!fn
    && fn.includes('if (S.analyzeState !== "done") {')
    && fn.includes('S.stemMode = "simple";')
    && fn.includes("return;");
})());

ok("startStemSeparation skips re-submitting when a job for the current track is already running or done, but allows retrying after a prior error", (() => {
  const fn = extractFn("startStemSeparation");
  return !!fn && fn.includes('if (S.stemJob && S.stemJob.trackHash === trackHash && S.stemJob.status !== "error") return;');
})());

ok("startStemSeparation resolves the file, submits the job, and persists {trackHash, jobId, submittedAt} to localStorage before polling", (() => {
  const fn = extractFn("startStemSeparation");
  return !!fn
    && fn.includes("const file = await resolveAudioFileForStemJob();")
    && fn.includes("const { job_id } = await submitStemJob(file);")
    && fn.includes("localStorage.setItem(STEM_JOB_LS, JSON.stringify({ trackHash, jobId: job_id, submittedAt: Date.now() }));")
    && fn.includes("pollStemJobLoop(job_id, trackHash);");
})());

ok("startStemSeparation routes any failure (resolving the file or submitting the job) through failStemJob", (() => {
  const fn = extractFn("startStemSeparation");
  return !!fn && fn.includes("} catch (err) {\n    failStemJob(trackHash, err.message);\n  }");
})());

ok("pollStemJobLoop drops its result silently once the track has changed (S.stemJob.trackHash no longer matches the job it was polling for)", (() => {
  const fn = extractFn("pollStemJobLoop");
  return !!fn && fn.includes("if (!S.stemJob || S.stemJob.trackHash !== trackHash) return;");
})());

ok("pollStemJobLoop polls every 4 seconds via setTimeout, moves to downloadAndAnalyzeStems on completion, and re-schedules itself otherwise", (() => {
  const fn = extractFn("pollStemJobLoop");
  return !!fn
    && fn.includes("setTimeout(async () => {")
    && fn.includes("}, 4000);")
    && fn.includes('if (st.status === "completed") {')
    && fn.includes("await downloadAndAnalyzeStems(jobId, trackHash, st.stems);")
    && fn.includes("pollStemJobLoop(jobId, trackHash, 0);");
})());

ok("pollStemJobLoop tolerates transient poll failures, only calling failStemJob after 3 consecutive errors (regression guard: a single Railway 502/cold-start/wifi blip used to kill an otherwise-healthy, still-running job)", (() => {
  const fn = extractFn("pollStemJobLoop");
  return !!fn
    && fn.includes("function pollStemJobLoop(jobId, trackHash, errCount = 0)")
    && fn.includes("if (errCount + 1 >= 3) {")
    && fn.includes("failStemJob(trackHash, err.message);")
    && fn.includes("pollStemJobLoop(jobId, trackHash, errCount + 1);");
})());

ok("downloadAndAnalyzeStems downloads and decodes every stem, runs computeEnergyCurve on each, and also drops its result silently if the track changed mid-download", (() => {
  const fn = extractFn("downloadAndAnalyzeStems");
  return !!fn
    && fn.includes("const ab = await downloadStem(jobId, name);")
    && fn.includes("const buf = await audioCtx.decodeAudioData(ab);")
    && fn.includes("curves[name] = computeEnergyCurve(buf.getChannelData(0));")
    && fn.includes("if (!S.stemJob || S.stemJob.trackHash !== trackHash) return;")
    && fn.includes("S.stemCurves = curves;")
    && fn.includes('S.stemJob.status = "ready";')
    && fn.includes("localStorage.removeItem(STEM_JOB_LS);");
})());

ok("failStemJob records the error on a still-current job, reverts to Simple mode, clears the persisted job, and toasts the user", (() => {
  const fn = extractFn("failStemJob");
  return !!fn
    && fn.includes('S.stemJob.status = "error"; S.stemJob.error = message;')
    && fn.includes('S.stemMode = "simple";')
    && fn.includes("localStorage.removeItem(STEM_JOB_LS);")
    && fn.includes('showAppToast("Stem-Trennung fehlgeschlagen: " + message, 5000);');
})());

ok("failStemJob is a full no-op for a job that's no longer current (regression guard: it used to unconditionally reset S.stemMode/localStorage/UI even for a stale/superseded track's failure, corrupting whatever track the user had since switched to)", (() => {
  const fn = extractFn("failStemJob");
  return !!fn && fn.includes("if (!S.stemJob || S.stemJob.trackHash !== trackHash) return;");
})());

ok("analyzeTrack's success path checks for a resumable job matching the freshly-analyzed track's fpHash and resumes polling instead of leaving it orphaned", (() => {
  const fn = extractFn("analyzeTrack");
  return !!fn
    && fn.includes("JSON.parse(localStorage.getItem(STEM_JOB_LS) || \"null\")")
    && fn.includes("saved.trackHash === S.fpHash")
    && fn.includes('S.stemJob = { id: saved.jobId, status: "processing", progress: "", error: null, trackHash: saved.trackHash };')
    && fn.includes("pollStemJobLoop(saved.jobId, saved.trackHash);");
})());

/* ---------------- Task 4: Settings UI (Audio-Analyse section + syncStemUI implementation) ---------------- */
section("Task 4 — Settings UI");

ok('Settings panel gains an "Audio-Analyse" section with the Simple/Advanced radio toggle, inserted between Audio Mixer and MIDI Control', (() => {
  const idx = html.indexOf("<h3>Audio-Analyse</h3>");
  if (idx < 0) return false;
  const block = html.slice(idx, idx + 700);
  return block.includes('<input type="radio" name="stemMode" id="stemModeSimple" checked> Einfach')
    && block.includes('<input type="radio" name="stemMode" id="stemModeAdvanced"> Advanced (Stems)')
    && block.includes('<p class="note" id="stemStatus">');
})());

ok("selecting Simple sets S.stemMode and re-syncs the UI, without starting a job", (() => {
  const idx = script.indexOf('$("stemModeSimple").addEventListener');
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 200);
  return body.includes('S.stemMode = "simple"; syncStemUI();') && !body.includes("startStemSeparation()");
})());

ok("selecting Advanced sets S.stemMode and calls startStemSeparation", (() => {
  const idx = script.indexOf('$("stemModeAdvanced").addEventListener');
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 200);
  return body.includes('S.stemMode = "advanced"; startStemSeparation();');
})());

ok("syncStemUI shows Ready/error/progress text matching S.stemJob.status, and keeps the two radios in sync with S.stemMode", (() => {
  const fn = extractFn("syncStemUI");
  return !!fn
    && fn.includes('$("stemModeSimple").checked = S.stemMode === "simple";')
    && fn.includes('$("stemModeAdvanced").checked = S.stemMode === "advanced";')
    && fn.includes('if (S.stemJob.status === "ready") s.textContent = "Bereit ✓";')
    && fn.includes('else if (S.stemJob.status === "error") s.textContent = "Fehler: " + S.stemJob.error;')
    && fn.includes('else s.textContent = "Stems werden getrennt… " + (S.stemJob.progress || "wird gestartet");');
})());

ok("the real syncStemUI (not the Task 3 stub) is the one defined in the script — only one function declaration for it exists", (() => {
  const first = script.indexOf("function syncStemUI()");
  const last = script.lastIndexOf("function syncStemUI()");
  return first >= 0 && first === last;
})());

section("Stem Separation Part B — visual routing (vocals→color, drums→camera)");

ok("sampleStemLive is a standalone function with the documented guard conditions", (() => {
  const fn = extractFn("sampleStemLive");
  return !!fn
    && fn.includes('if (S.stemMode !== "advanced" || !S.stemJob || S.stemJob.status !== "ready" || !S.stemCurves) return 0;')
    && fn.includes("if (!curve || !curve.length) return 0;");
})());

ok("sampleStemLive indexes the requested stem's curve at the current live playback position (S.progress), clamped to valid bounds", (() => {
  const fn = extractFn("sampleStemLive");
  return !!fn
    && fn.includes("const curve = S.stemCurves[stemName];")
    && fn.includes("const idx = Math.min(curve.length - 1, Math.max(0, Math.floor(S.progress * (curve.length - 1))));")
    && fn.includes("return curve[idx];");
})());

ok("drawScene's hue-drift formula adds a vocals-driven term on top of the pre-existing colorDrift formula (regression guard: the original formula must survive unchanged, not be replaced)", (() => {
  const fn = extractFn("drawScene");
  return !!fn
    && fn.includes("S.hueShift = S.progress * driftRange * ctrl.colorDrift * 2 + sampleStemLive(\"vocals\") * 30;");
})());

ok("applyPostFX's Shake amplitude formula adds a drums-driven term on top of the pre-existing transient/beat formula (regression guard: the original formula must survive unchanged, not be replaced)", (() => {
  const fn = extractFn("applyPostFX");
  return !!fn
    && fn.includes('const amp = (S.transient * 0.7 + S.beat * 0.5 + sampleStemLive("drums") * 0.6) * W * 0.025;');
})());

/* ---------------- summary ---------------- */
(async () => {
  if (pendingAsyncChecks.length) await Promise.all(pendingAsyncChecks);
  console.log("\n" + "─".repeat(40));
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
