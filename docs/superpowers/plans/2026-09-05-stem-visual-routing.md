# Stem Separation Integration Part B (Visual Routing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Advanced mode (stem separation, shipped in Part A) visibly worth switching to by routing vocal energy into the DNA visual's color drift and drum energy into the existing camera-shake FX effect — with zero behavior change for anyone not using Advanced mode.

**Architecture:** A single new helper, `sampleStemLive(stemName)`, reads `S.stemCurves.<stem>` (an offline, 240-window energy envelope, same shape as the app's existing `S.energyCurve`) at the current live playback position (`S.progress`), returning `0` whenever Advanced mode isn't active and ready. Two one-line formula changes in already-existing render functions add a `sampleStemLive(...)` term on top of their current whole-mix-audio-driven values.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- Zero behavior change for Simple mode or for Advanced mode before stems are ready — `sampleStemLive` must return exactly `0` in every case except `S.stemMode === "advanced" && S.stemJob && S.stemJob.status === "ready" && S.stemCurves` all holding, with the requested stem's curve present and non-empty.
- No new UI, no new Settings controls, no new `S.*` state fields beyond what Part A already added.
- No build-injection gotcha applies to this feature: both functions modified (`drawScene`, `applyPostFX`) are confirmed native to `elastic-morph.html`, not sourced from any `src/inject-vNN.js` file (verified via `grep -n "function drawScene\|function applyPostFX" src/*.js` returning no match) — every edit in this plan goes directly into `elastic-morph.html`, no `node build.js` rebuild step needed.
- Exact starting magnitudes (from the design spec, to be confirmed/retuned at the manual live-check): vocals contribute `sampleStemLive("vocals") * 30` (degrees) to hue drift; drums contribute `sampleStemLive("drums") * 0.6` to shake amplitude.

---

### Task 1: `sampleStemLive` helper + Vocals→color drift + Drums→camera shake

**Files:**
- Modify: `elastic-morph.html:3321` (insert `sampleStemLive` immediately after `failStemJob`)
- Modify: `elastic-morph.html:5925` (`drawScene` — add the vocals term to `S.hueShift`)
- Modify: `elastic-morph.html:7280` (`applyPostFX`'s Shake effect — add the drums term to `amp`)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Produces: `function sampleStemLive(stemName)` → `number` (0..1-ish, or exactly `0` when inactive/unavailable). No other task or file needs to know about this function beyond the two call sites added in this same task — this is a single-task plan.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all 4 new assertions under "Stem Separation Part B — visual routing (vocals→color, drums→camera)" print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement — add `sampleStemLive`**

At `elastic-morph.html:3321` (the blank line immediately after `failStemJob`'s closing `}`), insert:

```js

function sampleStemLive(stemName) {
  if (S.stemMode !== "advanced" || !S.stemJob || S.stemJob.status !== "ready" || !S.stemCurves) return 0;
  const curve = S.stemCurves[stemName];
  if (!curve || !curve.length) return 0;
  const idx = Math.min(curve.length - 1, Math.max(0, Math.floor(S.progress * (curve.length - 1))));
  return curve[idx];
}
```

The surrounding context should now read:

```js
function failStemJob(trackHash, message) {
  if (!S.stemJob || S.stemJob.trackHash !== trackHash) return;
  S.stemJob.status = "error"; S.stemJob.error = message;
  S.stemMode = "simple";
  try { localStorage.removeItem(STEM_JOB_LS); } catch (e) { }
  syncStemUI();
  if (typeof showAppToast === "function") showAppToast("Stem-Trennung fehlgeschlagen: " + message, 5000);
}

function sampleStemLive(stemName) {
  if (S.stemMode !== "advanced" || !S.stemJob || S.stemJob.status !== "ready" || !S.stemCurves) return 0;
  const curve = S.stemCurves[stemName];
  if (!curve || !curve.length) return 0;
  const idx = Math.min(curve.length - 1, Math.max(0, Math.floor(S.progress * (curve.length - 1))));
  return curve[idx];
}

async function analyzeTrack(file) {
```

- [ ] **Step 4: Implement — Vocals→color drift**

At `elastic-morph.html:5925` (inside `drawScene`, locate by content if line numbers have shifted from Step 3's insertion — search for the line starting with `S.hueShift = S.progress`), replace:

```js
  S.hueShift = S.progress * driftRange * ctrl.colorDrift * 2;
```

with:

```js
  S.hueShift = S.progress * driftRange * ctrl.colorDrift * 2 + sampleStemLive("vocals") * 30;
```

- [ ] **Step 5: Implement — Drums→camera shake**

At `elastic-morph.html:7280` (inside `applyPostFX`'s Shake effect, locate by content — search for `const amp = (S.transient * 0.7 + S.beat * 0.5)`), replace:

```js
    const amp = (S.transient * 0.7 + S.beat * 0.5) * W * 0.025;
```

with:

```js
    const amp = (S.transient * 0.7 + S.beat * 0.5 + sampleStemLive("drums") * 0.6) * W * 0.025;
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 4 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: route stem data into color drift and camera shake (Part B)

sampleStemLive(stemName) reads S.stemCurves.<stem> at the current live
playback position (S.progress), returning 0 whenever Advanced mode
isn't active with a ready stem job -- so Simple mode and pre-ready
Advanced mode see byte-identical behavior to before this change.

Vocals feed drawScene's existing S.hueShift color-drift value (which
already drives the main DNA render plus two existing hue-rotate CSS
filters, so all three benefit from one change); drums feed the
existing Shake FX effect's amplitude, only visible when the user has
already turned Shake on. Both additive terms use starting magnitudes
from the design spec (30 degrees, 0.6), to be confirmed via manual
live-check with a track that has clear vocal/drum content.

Closes Part B of the stem-separation feature (Part A: 9203e71).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

Not covered by `test.js` (static source assertions only) — verify with a
real track that has clear vocal sections and drum hits:

1. Load a track, switch to Advanced in Settings, wait for "Bereit ✓".
2. Compare a vocal-heavy section against an instrumental section — confirm
   a visible, subtle hue shift correlates with vocal presence (not jarring,
   not imperceptible).
3. Turn on the Shake FX effect (FX Rack panel), compare a drum-heavy
   section against a quiet one — confirm shake intensity visibly
   correlates with drum hits, beyond what whole-mix-only shake already did.
4. Switch back to Simple mode (or use a track where stems aren't fetched
   yet) — confirm both effects revert exactly to their pre-this-feature
   behavior (no residual hue/shake difference).
5. If either `30` (degrees) or `0.6` (shake coefficient) feels too
   strong/weak, adjust the two constants in `elastic-morph.html` and
   re-verify steps 2-3.
