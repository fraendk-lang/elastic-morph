# Obsidian Bloom Stage B — Audio/Time Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the upcoming `sculpture` renderer one audio/time source that is identical in live file playback, realtime capture, HQ export, range export, seek and 30/60 fps: a per-track feature timeline on a fixed 60 Hz grid (6 bands, kick/snare onsets, baked envelope followers), sampled by absolute song time. Add a live adapter for mic/tab audio and the export-side hook that tells the renderer the exact frame time.

**Architecture:** New build module `src/inject-v113.js` (pure, testable functions: `sculptureTaus`, `sculptureTimelineInit/Step/Finish`, `buildSculptureTimeline`, `sculptureTimelineBuildAsync`, `sampleSculptureTimeline`, `sculptureLiveStep`, `sculptureSongTime`, `sculptureNeeded`, plus `ensureSculptureTimeline` which caches on `S._sculptTL`). `build.js` lists the module. `renderExportFrame` sets `S._hqT = t` around `drawScene`; `exportHQ` awaits the timeline when the active preset's engine is `sculpture`. Old renderers and the old feed are untouched (their stale-live-value export gap is a documented follow-up, not part of this stage).

**Tech Stack:** Vanilla JS, `fftRadix2` (existing), `test.js` harness with `loadFns`.

## Global Constraints

- Band edges (Hz): subBass 20–60, bass 60–160, lowMid 160–500, mid 500–2000, highMid 2000–6000, air 6000–16000 (identical to live `updateAudioFeatures`).
- Band value = mean over bins of `clamp((20·log10(|X|/FFT + 1e-12) + 100) / 70, 0, 1)` — the Web-Audio analyser's −100…−30 dB byte mapping, without its temporal smoothing. FFT size 2048, Hann window centred on `floor(f/60·sampleRate)`, grid 60 fps.
- Onset rule identical to live: kick from `(subBass+bass)/2`, snare from `(mid+highMid)/2`; `jump = max(0, E − prev)`; `onset = max(onset·0.88, jump > 0.04 ? min(1, jump·8) : 0)`; `prev = prev·0.7 + E·0.3`; stepped once per grid frame (frame-rate independent).
- Follower time constants (attack, release in seconds) live in one place, `sculptureTaus()`: form 0.25/0.6, surf 0.10/0.25, gloss 0.06/0.30, loud 0.08/0.4. `form` follows `(subBass+bass)/2`, `surf` `(lowMid+mid)/2`, `gloss` `(highMid+air)/2`, `loud` follows `min(1, kE·0.5 + mE·0.35 + hE·0.15)`.
- No dependence on `Math.random`, wall-clock time or frame counters anywhere in the timeline or the sampler.
- Timeline build must be chunked (240 frames per slice, then yield) so the UI does not freeze.
- `APP_VERSION` / `package.json` version are NOT bumped in this stage (a guard test ties them together; the bump happens once at the end of the branch).
- Verification command: `npm run ci` (never `node test.js` alone). Because this task adds a module in the build-injected region, `build.js` MUST list it.

---

### Task 1: Timeline builder, sampler, live adapter, export hook

**Files:**
- Create: `src/inject-v113.js`
- Modify: `build.js` (append the module to `MODULES`)
- Modify: `elastic-morph.html` — `renderExportFrame` (~5379-5385) and `exportHQ` (~5448)
- Test: `test.js` (new section before `/* ---------------- summary ---------------- */`)

**Interfaces (produced, consumed by Stage C):**
- `buildSculptureTimeline(buf) -> tl` where `tl = { fps, frames, srcBuffer, subBass, bass, lowMid, mid, highMid, air, form, surf, gloss, kick, snare, loud }` (each channel a `Float32Array(frames)`).
- `sampleSculptureTimeline(tl, tSeconds, out?) -> out` (same 12 keys, linear interpolation, clamped, NaN/negative t → 0).
- `sculptureLiveStep(st, bands, kickOnset, snareOnset, dt, out?) -> out`, state `st = { form:0, surf:0, gloss:0, loud:0 }`.
- `sculptureSongTime(hqT, mediaT) -> seconds`; `sculptureNeeded(preset) -> boolean`.
- `ensureSculptureTimeline(yieldFn?) -> Promise<tl|null>`; sets `S._sculptTL`.
- `S._hqT`: exact frame time during an HQ export frame, otherwise `null`/`undefined`.

- [ ] **Step 1: Write the failing tests**

Precondition: `test.js` already defines the `okf(name, fn)` helper (added in Stage A, next to `ok`/`section`). If it is missing, stop and report NEEDS_CONTEXT — do not redefine it.

Insert immediately before `/* ---------------- summary ---------------- */` in `test.js`:

```js
section("Sculpture audio/time contract (Obsidian Bloom stage B)");

let SC = null;
try {
  SC = loadFns(["fftRadix2", "sculptureTaus", "sculptureTimelineInit", "sculptureTimelineStep", "sculptureTimelineFinish",
    "buildSculptureTimeline", "sculptureTimelineBuildAsync", "sampleSculptureTimeline", "sculptureLiveStep",
    "sculptureSongTime", "sculptureNeeded"]);
  ok("extract sculpture contract functions", true);
} catch (e) { ok("extract sculpture contract functions", false, e.message); }

if (SC) {
  const mkBuf = (sr, secs, fn) => {
    const n = Math.round(sr * secs), d = new Float32Array(n);
    for (let i = 0; i < n; i++) d[i] = fn(i / sr);
    return { sampleRate: sr, duration: secs, numberOfChannels: 1, getChannelData: () => d };
  };
  const at = (a, t) => a[Math.round(t * 60)];

  const sine = SC.buildSculptureTimeline(mkBuf(44100, 1, t => 0.5 * Math.sin(2 * Math.PI * 100 * t)));
  ok("timeline is on a 60 Hz grid with one frame per 1/60 s", sine.fps === 60 && sine.frames === 60);
  okf("a 100 Hz sine lands in the bass band, not in mid/highMid/air", () => true && at(sine.bass, 0.5) > 0.5
    && at(sine.mid, 0.5) < 0.05 && at(sine.highMid, 0.5) < 0.05 && at(sine.air, 0.5) < 0.05);

  const silent = SC.buildSculptureTimeline(mkBuf(44100, 1, () => 0));
  okf("silence produces an all-zero timeline (calm, no NaN)", () => {
    const keys = ["subBass", "bass", "lowMid", "mid", "highMid", "air", "form", "surf", "gloss", "kick", "snare", "loud"];
    return keys.every(k => silent[k].every(v => v === 0));
  });

  const burst = SC.buildSculptureTimeline(mkBuf(44100, 2, t => (t >= 0.5 && t < 0.6) ? 0.8 * Math.sin(2 * Math.PI * 60 * t) : 0));
  okf("a low burst triggers a kick onset that is 0 before, high during, and decayed long after", () =>
    at(burst.kick, 0.2) === 0 && at(burst.kick, 0.55) > 0.5 && at(burst.kick, 1.2) < 0.05);
  okf("the slow 'form' follower rises after the burst but stays below the instantaneous kick peak", () =>
    at(burst.form, 0.7) > 0.1 && at(burst.form, 0.7) < at(burst.kick, 0.55));

  const again = SC.buildSculptureTimeline(mkBuf(44100, 2, t => (t >= 0.5 && t < 0.6) ? 0.8 * Math.sin(2 * Math.PI * 60 * t) : 0));
  okf("two builds of the same audio are bit-identical (deterministic)", () =>
    burst.form.every((v, i) => v === again.form[i]) && burst.kick.every((v, i) => v === again.kick[i]));

  const fake = { fps: 60, frames: 3, subBass: [0, 1, 2], bass: [0, 1, 2], lowMid: [0, 1, 2], mid: [0, 1, 2], highMid: [0, 1, 2],
    air: [0, 1, 2], form: [0, 1, 2], surf: [0, 1, 2], gloss: [0, 1, 2], kick: [0, 1, 2], snare: [0, 1, 2], loud: [0, 1, 2] };
  okf("sampler clamps before the start and after the end", () =>
    SC.sampleSculptureTimeline(fake, -5).form === 0 && SC.sampleSculptureTimeline(fake, 99).form === 2);
  okf("sampler interpolates linearly between grid frames", () =>
    Math.abs(SC.sampleSculptureTimeline(fake, 1 / 120).form - 0.5) < 1e-9);
  okf("sampler treats NaN time as 0 and reuses a passed-in out object", () => {
    const out = {};
    return SC.sampleSculptureTimeline(fake, NaN, out) === out && out.form === 0;
  });
  okf("sampling depends only on absolute time, not on which grid the caller steps by (30 fps vs 60 fps)", () => {
    for (let k = 0; k < 20; k++) {
      const a = SC.sampleSculptureTimeline(burst, k / 30).form, b = SC.sampleSculptureTimeline(burst, (2 * k) / 60).form;
      if (a !== b) return false;
    }
    return true;
  });

  okf("sculptureSongTime prefers the exact HQ frame time, else the media clock, else 0", () =>
    SC.sculptureSongTime(2.5, 9) === 2.5 && SC.sculptureSongTime(null, 9) === 9 && SC.sculptureSongTime(undefined, NaN) === 0);
  okf("sculptureNeeded is true only for the sculpture engine", () =>
    SC.sculptureNeeded({ engine: "sculpture" }) === true && SC.sculptureNeeded({ engine: "blob" }) === false && SC.sculptureNeeded(null) === false);

  okf("live adapter: a sustained bass rises toward 1 and releases back down slowly", () => {
    const st = { form: 0, surf: 0, gloss: 0, loud: 0 }, out = {};
    const on = { subBass: 1, bass: 1, lowMid: 0, mid: 0, highMid: 0, air: 0 }, off = { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, air: 0 };
    for (let i = 0; i < 60; i++) SC.sculptureLiveStep(st, on, 0, 0, 1 / 60, out);
    const high = out.form;
    for (let i = 0; i < 90; i++) SC.sculptureLiveStep(st, off, 0, 0, 1 / 60, out);
    return high > 0.9 && out.form < 0.2 && out.form > 0;
  });
  okf("live adapter passes the given onsets through and ignores a bad dt", () => {
    const st = { form: 0, surf: 0, gloss: 0, loud: 0 };
    const out = SC.sculptureLiveStep(st, { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, air: 0 }, 0.7, 0.3, NaN);
    return out.kick === 0.7 && out.snare === 0.3 && out.form === 0;
  });

  pendingAsyncChecks.push(
    SC.sculptureTimelineBuildAsync(mkBuf(44100, 6, t => 0.4 * Math.sin(2 * Math.PI * 80 * t)), () => Promise.resolve()).then(asyncTl => {
      const syncTl = SC.buildSculptureTimeline(mkBuf(44100, 6, t => 0.4 * Math.sin(2 * Math.PI * 80 * t)));
      ok("the chunked async build yields exactly the same timeline as the synchronous build",
        asyncTl.frames === syncTl.frames && asyncTl.form.every((v, i) => v === syncTl.form[i]) && asyncTl.bass.every((v, i) => v === syncTl.bass[i]));
    }));
}

okf("renderExportFrame hands drawScene the exact frame time via S._hqT and always clears it", () => {
  const fn = extractFn("renderExportFrame");
  return !!fn && fn.includes("S._hqT = t;") && fn.includes("try { drawScene(dt); } finally { S._hqT = null; }");
});
okf("exportHQ awaits the sculpture timeline when the preset needs it", () => {
  const fn = extractFn("exportHQ");
  return !!fn && fn.includes("if (sculptureNeeded(S.preset)) await ensureSculptureTimeline();");
});
okf("build.js lists the sculpture contract module and it exists", () => {
  const b = fs.readFileSync(path.join(__dirname, "build.js"), "utf8");
  return b.includes('"src/inject-v113.js"') && fs.existsSync(path.join(__dirname, "src", "inject-v113.js"));
});
okf("no Math.random or wall-clock in the sculpture contract module", () => {
  const s = injectSrc("inject-v113.js");
  return !s.includes("Math.random") && !s.includes("performance.now") && !s.includes("Date.now");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run ci`
Expected: `extract sculpture contract functions` prints `✗` ("could not extract …"), the four trailing static checks print `✗`; everything else `✓`. (The `if (SC)` block is skipped.)

- [ ] **Step 3: Create `src/inject-v113.js`**

```js
/* ============================================================
   v113 — Sculpture audio/time contract (Obsidian Bloom foundation)
   One feature source for live file playback, realtime capture and HQ/range export:
   a per-track timeline on a fixed 60 Hz grid, sampled by ABSOLUTE song time.
   No random or clock sources in here — same audio + same time => same numbers.
   ============================================================ */

function sculptureTaus() {
  return { form: [0.25, 0.6], surf: [0.10, 0.25], gloss: [0.06, 0.30], loud: [0.08, 0.4] };
}

function sculptureTimelineInit(buf) {
  const fps = 60, FFT = 2048, half = FFT >> 1, frames = Math.max(1, Math.round(buf.duration * fps));
  const hann = new Float32Array(FFT);
  for (let i = 0; i < FFT; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FFT - 1));
  const mk = () => new Float32Array(frames);
  return {
    buf, fps, FFT, half, frames, hann, re: new Float32Array(FFT), im: new Float32Array(FFT), next: 0,
    tl: { fps, frames, srcBuffer: buf, subBass: mk(), bass: mk(), lowMid: mk(), mid: mk(), highMid: mk(), air: mk(),
          form: mk(), surf: mk(), gloss: mk(), kick: mk(), snare: mk(), loud: mk() }
  };
}

/* processes up to `count` grid frames; returns true once every frame is done */
function sculptureTimelineStep(st, count) {
  const edges = [[20, 60, "subBass"], [60, 160, "bass"], [160, 500, "lowMid"], [500, 2000, "mid"], [2000, 6000, "highMid"], [6000, 16000, "air"]];
  const ch = st.buf.getChannelData(0), sr = st.buf.sampleRate, binHz = sr / st.FFT, half = st.half, tl = st.tl;
  const end = Math.min(st.frames, st.next + count);
  for (let f = st.next; f < end; f++) {
    const start = Math.floor((f / st.fps) * sr) - half;
    for (let i = 0; i < st.FFT; i++) { const s = start + i; st.re[i] = (s >= 0 && s < ch.length ? ch[s] : 0) * st.hann[i]; st.im[i] = 0; }
    fftRadix2(st.re, st.im);
    for (let b = 0; b < edges.length; b++) {
      const lo = Math.max(1, Math.floor(edges[b][0] / binHz)), hi = Math.max(lo, Math.min(half - 1, Math.ceil(edges[b][1] / binHz)));
      let sum = 0;
      for (let i = lo; i <= hi; i++) {
        const mag = Math.sqrt(st.re[i] * st.re[i] + st.im[i] * st.im[i]) / st.FFT;
        const db = 20 * Math.log10(mag + 1e-12);
        sum += Math.max(0, Math.min(1, (db + 100) / 70));
      }
      tl[edges[b][2]][f] = sum / (hi - lo + 1);
    }
  }
  st.next = end;
  return st.next >= st.frames;
}

/* bakes onsets + envelope followers (stepped once per grid frame => frame-rate independent) */
function sculptureTimelineFinish(st) {
  const tl = st.tl, dt = 1 / st.fps, T = sculptureTaus();
  const rise = tau => 1 - Math.exp(-dt / tau);
  const aF = rise(T.form[0]), rF = rise(T.form[1]), aS = rise(T.surf[0]), rS = rise(T.surf[1]);
  const aG = rise(T.gloss[0]), rG = rise(T.gloss[1]), aL = rise(T.loud[0]), rL = rise(T.loud[1]);
  let form = 0, surf = 0, gloss = 0, loud = 0, kick = 0, snare = 0, prevKick = 0, prevSnare = 0;
  const follow = (v, x, a, r) => v + (x - v) * (x > v ? a : r);
  for (let f = 0; f < st.frames; f++) {
    const kE = (tl.subBass[f] + tl.bass[f]) * 0.5, mE = (tl.lowMid[f] + tl.mid[f]) * 0.5, hE = (tl.highMid[f] + tl.air[f]) * 0.5;
    form = follow(form, kE, aF, rF); surf = follow(surf, mE, aS, rS); gloss = follow(gloss, hE, aG, rG);
    loud = follow(loud, Math.min(1, kE * 0.5 + mE * 0.35 + hE * 0.15), aL, rL);
    const kJ = Math.max(0, kE - prevKick);
    kick = Math.max(kick * 0.88, kJ > 0.04 ? Math.min(1, kJ * 8) : 0);
    prevKick = prevKick * 0.7 + kE * 0.3;
    const sE = (tl.mid[f] + tl.highMid[f]) * 0.5, sJ = Math.max(0, sE - prevSnare);
    snare = Math.max(snare * 0.88, sJ > 0.04 ? Math.min(1, sJ * 8) : 0);
    prevSnare = prevSnare * 0.7 + sE * 0.3;
    tl.form[f] = form; tl.surf[f] = surf; tl.gloss[f] = gloss; tl.loud[f] = loud; tl.kick[f] = kick; tl.snare[f] = snare;
  }
  return tl;
}

function buildSculptureTimeline(buf) {
  const st = sculptureTimelineInit(buf);
  sculptureTimelineStep(st, st.frames);
  return sculptureTimelineFinish(st);
}

/* chunked (240 frames per slice, then yield) so a 4-minute track never freezes the UI */
function sculptureTimelineBuildAsync(buf, yieldFn) {
  const st = sculptureTimelineInit(buf);
  const y = yieldFn || (() => new Promise(r => setTimeout(r, 0)));
  const loop = () => sculptureTimelineStep(st, 240) ? Promise.resolve(sculptureTimelineFinish(st)) : y().then(loop);
  return loop();
}

function sampleSculptureTimeline(tl, t, out) {
  out = out || {};
  const last = tl.frames - 1, x = Math.max(0, Math.min(last, (t > 0 ? t : 0) * tl.fps));
  const i0 = Math.floor(x), i1 = Math.min(last, i0 + 1), k = x - i0;
  const keys = ["subBass", "bass", "lowMid", "mid", "highMid", "air", "form", "surf", "gloss", "kick", "snare", "loud"];
  for (let n = 0; n < keys.length; n++) { const a = tl[keys[n]]; out[keys[n]] = a[i0] + (a[i1] - a[i0]) * k; }
  return out;
}

/* mic / tab audio: causal followers with the same time constants; NOT reproducible by design */
function sculptureLiveStep(st, bands, kickOnset, snareOnset, dt, out) {
  out = out || {};
  dt = dt > 0 ? dt : 0;
  const T = sculptureTaus();
  const follow = (v, x, tau) => v + (x - v) * (1 - Math.exp(-dt / (x > v ? tau[0] : tau[1])));
  const kE = (bands.subBass + bands.bass) * 0.5, mE = (bands.lowMid + bands.mid) * 0.5, hE = (bands.highMid + bands.air) * 0.5;
  st.form = follow(st.form, kE, T.form); st.surf = follow(st.surf, mE, T.surf); st.gloss = follow(st.gloss, hE, T.gloss);
  st.loud = follow(st.loud, Math.min(1, kE * 0.5 + mE * 0.35 + hE * 0.15), T.loud);
  out.subBass = bands.subBass; out.bass = bands.bass; out.lowMid = bands.lowMid; out.mid = bands.mid; out.highMid = bands.highMid; out.air = bands.air;
  out.form = st.form; out.surf = st.surf; out.gloss = st.gloss; out.loud = st.loud;
  out.kick = kickOnset; out.snare = snareOnset;
  return out;
}

function sculptureSongTime(hqT, mediaT) {
  return hqT != null ? hqT : (mediaT > 0 ? mediaT : 0);
}

function sculptureNeeded(preset) {
  return !!(preset && preset.engine === "sculpture");
}

/* cached per decoded buffer; concurrent callers share one build */
function ensureSculptureTimeline(yieldFn) {
  const buf = S.audioBuffer;
  if (!buf) return Promise.resolve(null);
  if (S._sculptTL && S._sculptTL.srcBuffer === buf) return Promise.resolve(S._sculptTL);
  if (S._sculptTLP && S._sculptTLB === buf) return S._sculptTLP;
  S._sculptTLB = buf;
  S._sculptTLP = sculptureTimelineBuildAsync(buf, yieldFn).then(tl => { if (S._sculptTLB === buf) S._sculptTL = tl; return tl; });
  return S._sculptTLP;
}
```

- [ ] **Step 4: Register the module in `build.js`**

In `build.js` find the end of the `MODULES` array:

```js
"src/inject-v111.js", "src/inject-v112.js"];
```

Replace with:

```js
"src/inject-v111.js", "src/inject-v112.js", "src/inject-v113.js"];
```

- [ ] **Step 5: Export hook in `renderExportFrame`**

In `elastic-morph.html` find:

```js
  tickCueTransition(dt);
  drawScene(dt);
}
```

(the one at the end of `renderExportFrame`, right after `if (pending.length) await Promise.all(pending);`). Replace with:

```js
  tickCueTransition(dt);
  S._hqT = t;   // exact frame time for the sculpture renderer (absolute song time, not S.time)
  try { drawScene(dt); } finally { S._hqT = null; }
}
```

- [ ] **Step 6: Await the timeline in `exportHQ`**

Find:

```js
    const feat = buildFeatureTimeline(buf, fps);
    const muxer = new Muxer({
```

Replace with:

```js
    const feat = buildFeatureTimeline(buf, fps);
    if (sculptureNeeded(S.preset)) await ensureSculptureTimeline();
    const muxer = new Muxer({
```

- [ ] **Step 7: Run to verify pass**

Run: `npm run ci`
Expected: all assertions `✓`, final `<N> passed, 0 failed`. `git status` afterwards shows `elastic-morph.html` modified (the build re-injects the new module) and `sw.js` unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/inject-v113.js build.js elastic-morph.html test.js
git commit -m "feat: sculpture audio/time contract (60 Hz feature timeline, absolute-time sampler, live adapter)

Foundation for the Obsidian Bloom DNA. One deterministic per-track
timeline (6 analyser-mapped bands, kick/snare onsets with the live
rules, baked envelope followers) sampled by absolute song time, so
live file playback, realtime capture, HQ export, range export, seek
and 30/60 fps agree. renderExportFrame now passes the exact frame
time via S._hqT; exportHQ awaits the timeline for sculpture presets.
Old renderers and their feed are untouched.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual check

No visible change yet (nothing consumes the contract until Stage C). In the browser console after loading a track: `ensureSculptureTimeline().then(tl => console.log(tl.frames, sampleSculptureTimeline(tl, 10)))` prints the track's frame count and a plausible feature object.
