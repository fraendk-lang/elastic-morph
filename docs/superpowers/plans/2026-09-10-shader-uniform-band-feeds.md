# Shader Engine Finer Reactivity (Uniform Feeds) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 17 GLSL shader styles only receive the coarse `uBass/uMids/uHighs/uBeat/uLoud` signals — none of the finer 6-band split or kick/snare onset detection shipped 2026-08-24. Blend the finer signals into the three existing uniform feeds so every style reacts more sharply and with more top-end/sub detail, with zero GLSL changes. This is Approach A (the cheap, shared-input fix); a later Approach B round could wire distinct kick/snare/air uniforms into individual style bodies.

**Architecture:** Three of the five `gl.uniform1f(L.*, …)` feed lines in the shader render function (`elastic-morph.html` ~4253-4257) get one extra additive term. `uMids` and `uLoud` are unchanged. No new uniform, no `getUniformLocation`, no GLSL edit — the 17 styles already consume `uBass/uHighs/uBeat` heavily, so they inherit the improvement for free.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`). This code is in the static region (before the `@BUILD-INJECT-V58` marker) — no `node build.js` needed.

## Global Constraints

- Only the `L.bass`, `L.highs`, and `L.beat` feed lines change. `L.mids` and `L.loud` stay byte-for-byte.
- No new uniform, no new `L.*` location, no GLSL/shader-source change.
- The finer terms (`S.bands.subBass`, `S.bands.air`, `S.kickOnset`) are already gain-scaled and clamped to 0..1 by `updateAudioFeatures` — so `S.gain` is applied only to the coarse term, the finer term is added raw, and the existing `Math.min(1.8, …)` / `Math.min(1.5, …)` outer clamp stays.
- Exact replacement expressions:
  - `gl.uniform1f(L.bass, Math.min(1.8, (S.bass * S.gain + S.bands.subBass * 0.35) * (0.85 + liveMul("pulse") * 0.35)));`
  - `gl.uniform1f(L.highs, Math.min(1.8, (S.highs * S.gain + S.bands.air * 0.4) * (0.85 + liveMul("pulse") * 0.2)));`
  - `gl.uniform1f(L.beat, Math.min(1.5, (S.beat + S.dropFlash + S.kickOnset * 0.6) * (0.7 + liveMul("pulse") * 0.5)));`

---

### Task 1: Blend the finer band/onset signals into the shader uniform feeds

**Files:**
- Modify: `elastic-morph.html` (~4253, ~4255, ~4256 — the `L.bass`, `L.highs`, `L.beat` feed lines)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Consumes: `S.bands.subBass`, `S.bands.air`, `S.kickOnset` (existing, 0..1, gain-scaled + clamped in `updateAudioFeatures`).
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Shader uniform feeds blend in the finer band/onset signals");

ok("uBass feed adds the sub-bass band on top of the coarse S.bass", () => {
  return script.includes('gl.uniform1f(L.bass, Math.min(1.8, (S.bass * S.gain + S.bands.subBass * 0.35) * (0.85 + liveMul("pulse") * 0.35)));');
});

ok("uHighs feed adds the air band (6-16 kHz) on top of the coarse S.highs", () => {
  return script.includes('gl.uniform1f(L.highs, Math.min(1.8, (S.highs * S.gain + S.bands.air * 0.4) * (0.85 + liveMul("pulse") * 0.2)));');
});

ok("uBeat feed adds S.kickOnset for a sharper percussive attack", () => {
  return script.includes('gl.uniform1f(L.beat, Math.min(1.5, (S.beat + S.dropFlash + S.kickOnset * 0.6) * (0.7 + liveMul("pulse") * 0.5)));');
});

ok("uMids and uLoud shader feeds are left unchanged", () => {
  return script.includes('gl.uniform1f(L.mids, Math.min(1.8, S.mids * S.gain * (0.85 + liveMul("pulse") * 0.25)));')
    && script.includes('gl.uniform1f(L.loud, Math.min(1.8, S.loudness * S.gain * (0.85 + liveMul("pulse") * 0.3)));');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the first 3 new assertions print `✗` (old feed lines still in place); the 4th (`uMids`/`uLoud` unchanged) already prints `✓`. Everything else still `✓`.

- [ ] **Step 3: Implement — the three feed lines (`elastic-morph.html` ~4253-4256)**

Find:

```js
  gl.uniform1f(L.bass, Math.min(1.8, S.bass * S.gain * (0.85 + liveMul("pulse") * 0.35)));
  gl.uniform1f(L.mids, Math.min(1.8, S.mids * S.gain * (0.85 + liveMul("pulse") * 0.25)));
  gl.uniform1f(L.highs, Math.min(1.8, S.highs * S.gain * (0.85 + liveMul("pulse") * 0.2)));
  gl.uniform1f(L.beat, Math.min(1.5, (S.beat + S.dropFlash) * (0.7 + liveMul("pulse") * 0.5)));
  gl.uniform1f(L.loud, Math.min(1.8, S.loudness * S.gain * (0.85 + liveMul("pulse") * 0.3)));
```

Replace it with:

```js
  // v152: blend the finer 6-band / kick-onset signals (shipped 2026-08-24, gain-scaled +
  // clamped in updateAudioFeatures) into the three most-consumed shader feeds — sub-bass
  // depth on uBass, 6-16 kHz air on uHighs, kick attack on uBeat. No GLSL change; all 17
  // styles inherit the sharper reaction. uMids / uLoud unchanged.
  gl.uniform1f(L.bass, Math.min(1.8, (S.bass * S.gain + S.bands.subBass * 0.35) * (0.85 + liveMul("pulse") * 0.35)));
  gl.uniform1f(L.mids, Math.min(1.8, S.mids * S.gain * (0.85 + liveMul("pulse") * 0.25)));
  gl.uniform1f(L.highs, Math.min(1.8, (S.highs * S.gain + S.bands.air * 0.4) * (0.85 + liveMul("pulse") * 0.2)));
  gl.uniform1f(L.beat, Math.min(1.5, (S.beat + S.dropFlash + S.kickOnset * 0.6) * (0.7 + liveMul("pulse") * 0.5)));
  gl.uniform1f(L.loud, Math.min(1.8, S.loudness * S.gain * (0.85 + liveMul("pulse") * 0.3)));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 4 new ones. Final line: `<N> passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: blend finer band/onset signals into the shader uniform feeds

The 17 GLSL shader styles only received the coarse uBass/uMids/uHighs/
uBeat/uLoud signals — none of the 6-band split or kick/snare onset
detection shipped 2026-08-24. This is the shader analog of Layer B
Round 1: rather than touch 17 bespoke style bodies, improve the shared
inputs.

Three of the five uniform feeds (elastic-morph.html shader render) gain
one additive term:
- uBass  += S.bands.subBass * 0.35  (deeper sub response)
- uHighs += S.bands.air * 0.4       (true 6-16 kHz cymbal/hi-hat band)
- uBeat  += S.kickOnset * 0.6       (sharper percussive attack than the
                                     smoother S.beat)

uMids / uLoud unchanged. No new uniform, no getUniformLocation, no GLSL
edit — every style inherits the sharper reaction for free. The finer
terms are already gain-scaled + 0..1-clamped in updateAudioFeatures, so
S.gain is applied only to the coarse term and the outer Math.min clamp
is unchanged.

A later Approach B round could wire distinct kick/snare/air uniforms
into individual style bodies for per-style expression.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

1. Enable the Shader Engine, play a track with a clear kick and hi-hats, and cycle through
   several styles (e.g. Metaballs, Tunnel, Aurora, Electric, Cosmic Drift, Warp Tunnel).
   Confirm each now reacts more sharply on the kick and shows more top-end sparkle on the
   hats than before — without anything blowing out to pure white or strobing harder than
   the "Flackern reduzieren" setting should allow.
2. Confirm quiet/ambient tracks (little sub, few transients) look essentially unchanged —
   the added terms are near-zero there.
3. Confirm the Reactivity gain slider still behaves sensibly across its range (the coarse
   term scales with gain, the finer term is already gained, so very high gain shouldn't
   clip the shaders to a flat maximum any faster than before — the Math.min(1.8) / (1.5)
   clamps are unchanged).
4. Quick HQ Export with one shader style active — WebCodecs render path uses the same
   uniform feeds, so the export should match the live look.
