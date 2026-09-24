# Obsidian Bloom Stage C2 — Stateless growth (range export == full export) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stage C feeds the shader's composition parameter `uGrow` from `growthF`, which is a *stateful* quantity (`S.growth` is smoothed frame by frame, and `growthF` also folds in the decaying `dropFlash`). In an HQ range export (e.g. 60–70 s) that state starts from scratch, so the first seconds differ from the same seconds of a full export. Replace it with a stateless function of absolute song progress so the sculpture is identical in both.

**Architecture:** New pure function `sculptureGrowth(prog, durSec, map)` in `src/inject-v114.js`: the song-phase growth target (same piecewise curve as `evolutionTargets()`, keyed by the song-map segment label) averaged over 4 points spread across the last 2.25 s (a stateless low-pass, ≈ the live 0.7/s smoothing). `drawSculpture` uses it (`* 0.6`, clamped to 0..1, same scaling as before). `dropFlash`/charge no longer scale the sculpture (also honours "no blanket scaling on every beat"). The 2D fallback orb keeps using `growthF`.

**Tech Stack:** Vanilla JS. The module's source of truth is the asset `docs/superpowers/plans/2026-09-24-obsidian-C-assets/inject-v114.js`; `src/inject-v114.js` is a byte-for-byte `cp` of it.

## Global Constraints

- Edit the ASSET first, then `cp` it over `src/inject-v114.js` and confirm with `cmp` (the two must stay identical).
- `sculptureGrowth` is pure: no `S`, no clock, no random; it takes everything as arguments.
- Growth curve (identical to `evolutionTargets`): Birth `0.15 + t·0.25`, Grow `0.40 + t·0.30`, Tension `0.70 + t·0.25`, Break `0.45`, Return `0.85`, Fade (default) `0.85 − t·0.6`, with `t = clamp((p − seg.a) / max(0.001, seg.b − seg.a), 0, 1)` and the segment chosen like `segmentAt` (first `a ≤ p < b`, else the last segment).
- Verification command: `npm run ci`.

---

### Task 1: Stateless growth

**Files:**
- Modify: `docs/superpowers/plans/2026-09-24-obsidian-C-assets/inject-v114.js`, then copy to `src/inject-v114.js`
- Test: `test.js` (new section before `/* ---------------- summary ---------------- */`)

- [ ] **Step 1: Write the failing tests**

```js
section("Obsidian Bloom stage C2 — stateless growth");

let GR = null;
try { GR = loadFns(["sculptureGrowth"]); ok("extract sculptureGrowth", true); }
catch (e) { ok("extract sculptureGrowth", false, e.message); }

if (GR) {
  const MAP = [
    { a: 0.00, b: 0.15, label: "Birth" }, { a: 0.15, b: 0.35, label: "Grow" }, { a: 0.35, b: 0.55, label: "Tension" },
    { a: 0.55, b: 0.70, label: "Break" }, { a: 0.70, b: 0.90, label: "Return" }, { a: 0.90, b: 1.01, label: "Fade" }
  ];
  okf("start of the song sits at the Birth floor (window clamps at progress 0)", () => Math.abs(GR.sculptureGrowth(0, 100, MAP) - 0.15) < 1e-9);
  okf("deep inside Return the value is exactly 0.85 when the window stays in the segment", () => Math.abs(GR.sculptureGrowth(0.8, 1000, MAP) - 0.85) < 1e-9);
  okf("deep inside Break the value is exactly 0.45", () => Math.abs(GR.sculptureGrowth(0.62, 1000, MAP) - 0.45) < 1e-9);
  okf("crossing Break -> Return the low-pass lands strictly between 0.45 and 0.85", () => {
    const g = GR.sculptureGrowth(0.7, 100, MAP);   // step = 0.0075 progress, window reaches back into Break
    return g > 0.45 && g < 0.85;
  });
  okf("a zero/invalid duration disables smoothing and equals the raw target", () =>
    Math.abs(GR.sculptureGrowth(0.8, 0, MAP) - 0.85) < 1e-9 && Math.abs(GR.sculptureGrowth(0.8, NaN, MAP) - 0.85) < 1e-9);
  okf("it is a pure function of its arguments (same inputs, same output, any call order)", () => {
    const a = GR.sculptureGrowth(0.42, 180, MAP); GR.sculptureGrowth(0.9, 180, MAP);
    return a === GR.sculptureGrowth(0.42, 180, MAP);
  });
  okf("progress outside 0..1 is clamped, never NaN", () => {
    const lo = GR.sculptureGrowth(-3, 100, MAP), hi = GR.sculptureGrowth(9, 100, MAP);
    return Number.isFinite(lo) && Number.isFinite(hi);
  });
}

okf("drawSculpture derives uGrow from sculptureGrowth (absolute progress), not from the stateful growthF", () => {
  const fn = extractFn("drawSculpture", injectSrc("inject-v114.js"));
  return !!fn && fn.includes("sculptureGrowth(S.progress, dur, songMap())") && !fn.includes("growthF * 0.6");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run ci`
Expected: `extract sculptureGrowth` `✗` and the last static assertion `✗`; everything else `✓`.

- [ ] **Step 3: Implement (edit the asset)**

In `docs/superpowers/plans/2026-09-24-obsidian-C-assets/inject-v114.js` find:

```js
function sculptureCollectFeatures(out, dt) {
```

Replace with:

```js
/* stateless composition growth: the song-phase target (same curve as evolutionTargets) averaged over the
   last ~2.25 s at 4 points — depends only on absolute progress, so a range export equals a full export */
function sculptureGrowth(prog, durSec, map) {
  const target = p => {
    p = Math.max(0, Math.min(1, p));
    let i = map.length - 1;
    for (let k = 0; k < map.length; k++) { if (p >= map[k].a && p < map[k].b) { i = k; break; } }
    const seg = map[i], t = Math.max(0, Math.min(1, (p - seg.a) / Math.max(0.001, seg.b - seg.a)));
    switch (seg.label) {
      case "Birth": return 0.15 + t * 0.25;
      case "Grow": return 0.40 + t * 0.30;
      case "Tension": return 0.70 + t * 0.25;
      case "Break": return 0.45;
      case "Return": return 0.85;
      default: return 0.85 - t * 0.6;
    }
  };
  const step = durSec > 0 ? 0.75 / durSec : 0;
  return (target(prog) + target(prog - step) + target(prog - 2 * step) + target(prog - 3 * step)) / 4;
}

function sculptureCollectFeatures(out, dt) {
```

Then find:

```js
  sculptureRenderGL(f, q, W, H, seedArr, Math.max(0, Math.min(1, growthF * 0.6)), sculptureTint(hue), calm);
```

Replace with:

```js
  const dur = S.audioBuffer ? S.audioBuffer.duration : ((S.micMode || S.tabAudioMode) ? 240 : 180);
  const grow = Math.max(0, Math.min(1, sculptureGrowth(S.progress, dur, songMap()) * 0.6));
  sculptureRenderGL(f, q, W, H, seedArr, grow, sculptureTint(hue), calm);
```

- [ ] **Step 4: Sync the module and verify**

```bash
cp docs/superpowers/plans/2026-09-24-obsidian-C-assets/inject-v114.js src/inject-v114.js
cmp docs/superpowers/plans/2026-09-24-obsidian-C-assets/inject-v114.js src/inject-v114.js && echo identical
npm run ci
```

Expected: `identical`; all assertions `✓`; `<N> passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-09-24-obsidian-C-assets/inject-v114.js src/inject-v114.js elastic-morph.html test.js
git commit -m "fix: Obsidian Bloom growth is now a stateless function of absolute progress

uGrow used the stateful growthF (smoothed S.growth + decaying dropFlash),
so the first seconds of an HQ range export differed from the same seconds
of a full export. sculptureGrowth() reproduces the evolutionTargets phase
curve from progress alone (4-point low-pass over ~2.25 s), making range and
full exports identical and dropping the per-drop pumping.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
