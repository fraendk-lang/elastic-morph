# Layer B Phase-Mirror Automation & Edge Glow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two visual-polish upgrades to Layer B, both applied at its shared code points so all 20 types benefit automatically: (1) kaleidoscope-mirror complexity now follows the song's structural phase instead of staying fixed, making geometry visibly evolve over a track; (2) a subtle shared edge glow softens every type's raw stroke lines.

**Architecture:** Both changes live inside the single `drawLayerB(W, H, hue, dt)` function ([elastic-morph.html:6835](../../../elastic-morph.html)) plus one new top-level constant (`LAYERB_PHASE_MIRROR`, sibling to the existing `LAYERB_PHASE_ZOOM`). No new `S.layerB` fields, no new UI, no per-type (`switch (LB.type)`) changes.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- Mirror automation is **opt-in via the existing default**: it only drives `mir` when `LB.mirror === "off"` (Layer B's default value). An explicit manual Mirror choice (`h`/`v`/`diag`/`quad`/`hex`/`oct`) is never overridden.
- The phase→mirror mapping is exactly: `{ Birth: "off", Grow: "h", Tension: "quad", Break: "oct", Return: "quad", Fade: "off" }` — mirrors the shape of the existing `LAYERB_PHASE_ZOOM` dramaturgy curve (simple at the bookends, densest at the climax).
- Phase transitions are a hard switch (no crossfade) — consistent with how `S.phase`-driven behavior already works elsewhere in this file (e.g. the drop-dramaturgy cycle duration).
- The existing perf-scale mirror-complexity safety net (the four `pf57 <` checks) must keep working unchanged, now applied on top of whichever `mir` value (manual or phase-driven) was chosen.
- The edge glow (`ctx.shadowBlur`) must be skipped (`0`) when `pf57 < 0.6` — `shadowBlur` is a real Canvas 2D cost, and this reuses the same perf-scale variable as the mirror safety net rather than adding a second one.
- No change to `colr()`, to any of the 20 `case` bodies, or to `S.kickOnset`/`S.snareOnset`/`S.bands.air` usage added in the previous round.

---

### Task 1: Phase-driven mirror complexity + shared edge glow

**Files:**
- Modify: `elastic-morph.html:6834` (new `LAYERB_PHASE_MIRROR` constant, next to `LAYERB_PHASE_ZOOM`)
- Modify: `elastic-morph.html:6873-6877` (move the `pf57` snapshot earlier; add `shadowBlur`/`shadowColor` to the shared setup block)
- Modify: `elastic-morph.html:6893-6894` (mirror selection now phase-aware when `LB.mirror === "off"`)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Consumes: `S.phase` (existing string: `"Birth"|"Grow"|"Tension"|"Break"|"Return"|"Fade"`), `S.perfScale`, `S.exporting`, `hue` (drawLayerB's own parameter) — all pre-existing.
- Produces: `LAYERB_PHASE_MIRROR` (new top-level object, same shape/usage pattern as `LAYERB_PHASE_ZOOM`) — no other new interfaces.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Layer B — phase-driven mirror automation + edge glow");

ok("LAYERB_PHASE_MIRROR has the 6 confirmed phase targets, mirroring LAYERB_PHASE_ZOOM's dramaturgy shape", (() => {
  const m = script.match(/const LAYERB_PHASE_MIRROR = \{([^}]*)\};/);
  if (!m) return false;
  const body = m[1];
  return /Birth:\s*"off"/.test(body) && /Grow:\s*"h"/.test(body) && /Tension:\s*"quad"/.test(body)
    && /Break:\s*"oct"/.test(body) && /Return:\s*"quad"/.test(body) && /Fade:\s*"off"/.test(body);
})());

ok("drawLayerB's mirror only follows the song phase when LB.mirror is left at its 'off' default — an explicit manual choice always wins", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes('let mir = LB.mirror === "off" ? (LAYERB_PHASE_MIRROR[S.phase] || "off") : LB.mirror;');
})());

ok("drawLayerB's perf-scale snapshot (pf57) is computed once, before ctx.save(), and reused by both the edge glow and the mirror safety net", (() => {
  const fn = extractFn("drawLayerB");
  if (!fn) return false;
  const pf57Count = (fn.match(/const pf57 = S\.exporting \? 1 : \(S\.perfScale \|\| 1\);/g) || []).length;
  return pf57Count === 1 && fn.indexOf("const pf57") < fn.indexOf("ctx.save()");
})());

ok("drawLayerB applies a shared edge glow tied to the current hue, skipped under load (pf57 < 0.6)", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn
    && fn.includes("ctx.shadowBlur = pf57 < 0.6 ? 0 : mn * 0.01;")
    && fn.includes("ctx.shadowColor = `hsla(${hue}, 80%, 65%, 0.6)`;");
})());

ok("drawLayerB's mirror perf-scale safety net (the 4 pf57 checks) still runs after the phase-aware mir assignment", (() => {
  const fn = extractFn("drawLayerB");
  if (!fn) return false;
  const mirIdx = fn.indexOf('let mir = LB.mirror === "off"');
  const checksIdx = fn.indexOf('if (pf57 < 0.75 && mir === "oct") mir = "hex";');
  return mirIdx >= 0 && checksIdx > mirIdx;
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all 5 new assertions under "Layer B — phase-driven mirror automation + edge glow" print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement — `LAYERB_PHASE_MIRROR` constant (`elastic-morph.html:6834`)**

Find:

```js
const LAYERB_PHASE_ZOOM = { Birth: 0.75, Grow: 0.9, Tension: 1.15, Break: 1.35, Return: 0.95, Fade: 0.7 };
function drawLayerB(W, H, hue, dt) {
```

Replace it with:

```js
const LAYERB_PHASE_ZOOM = { Birth: 0.75, Grow: 0.9, Tension: 1.15, Break: 1.35, Return: 0.95, Fade: 0.7 };
// v149: same dramaturgy shape as LAYERB_PHASE_ZOOM — simplest at the bookends, densest at the
// climax — but for kaleidoscope-mirror complexity instead of zoom. Only applied when Mirror is
// left at "off" (see drawLayerB below); an explicit manual Mirror choice is never overridden.
const LAYERB_PHASE_MIRROR = { Birth: "off", Grow: "h", Tension: "quad", Break: "oct", Return: "quad", Fade: "off" };
function drawLayerB(W, H, hue, dt) {
```

- [ ] **Step 4: Implement — move `pf57` earlier, add the shared edge glow (`elastic-morph.html:6873-6877`)**

Find:

```js
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, LB.opacity * (1 + LB.opLfo.depth * lfoWave(LB.opLfo.shape, LB._opPhase || 0))));
  ctx.globalCompositeOperation = LB.blend;
  ctx.lineWidth = Math.max(1, mn * 0.005);
  ctx.lineJoin = "round"; ctx.lineCap = "round";   // v40: smoother strokes across all types
```

Replace it with:

```js
  // v57/v149: perf-scale snapshot — drives both the mirror-complexity safety net below and
  // whether the v149 edge glow (a real Canvas 2D cost) runs at all.
  const pf57 = S.exporting ? 1 : (S.perfScale || 1);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, LB.opacity * (1 + LB.opLfo.depth * lfoWave(LB.opLfo.shape, LB._opPhase || 0))));
  ctx.globalCompositeOperation = LB.blend;
  ctx.lineWidth = Math.max(1, mn * 0.005);
  ctx.lineJoin = "round"; ctx.lineCap = "round";   // v40: smoother strokes across all types
  // v149: subtle glow softens raw stroke edges across all 20 types; skipped under load since
  // shadowBlur is a real cost in Canvas 2D — matches the mirror-complexity safety net below.
  ctx.shadowBlur = pf57 < 0.6 ? 0 : mn * 0.01;
  ctx.shadowColor = `hsla(${hue}, 80%, 65%, 0.6)`;
```

- [ ] **Step 5: Implement — phase-aware mirror selection (`elastic-morph.html:6893-6894`)**

Find:

```js
  const pf57 = S.exporting ? 1 : (S.perfScale || 1);
  let mir = LB.mirror;
  if (pf57 < 0.75 && mir === "oct") mir = "hex";
```

Replace it with:

```js
  // v149: when Mirror is left at "Off" (the default), let the song phase drive kaleidoscope
  // complexity automatically — Birth/Fade stay simple, Tension/Break get denser reflections.
  // An explicit manual Mirror choice always wins (never overridden).
  let mir = LB.mirror === "off" ? (LAYERB_PHASE_MIRROR[S.phase] || "off") : LB.mirror;
  if (pf57 < 0.75 && mir === "oct") mir = "hex";
```

(Note: this removes the *second* `const pf57 = ...` declaration — it's now declared once, earlier, per Step 4.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 5 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: phase-driven Layer B mirror complexity + shared edge glow

Two visual-polish upgrades to Layer B, both at its shared code points
so all 20 types benefit automatically:

1. Kaleidoscope-mirror complexity now follows the song's structural
   phase (Birth/Grow/Tension/Break/Return/Fade) instead of staying
   fixed at whatever the Mirror dropdown was last set to — geometry
   visibly evolves over a track (simple at the bookends, densest at
   the Break/climax), mirroring the existing Progress Zoom's
   dramaturgy curve. Only takes over when Mirror is left at its 'off'
   default; an explicit manual choice is never overridden.
2. A subtle shared edge glow (ctx.shadowBlur, hue-tinted) softens
   every type's raw stroke lines. Skipped under load (perfScale < 0.6)
   since shadowBlur has a real Canvas 2D cost — reuses the same pf57
   snapshot as the existing mirror-complexity safety net (moved
   earlier in the function so both consumers share one declaration).

No new S.layerB field, no new UI, no per-type changes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

1. Play a track with clear structural sections (quiet intro → building →
   drop → outro), Layer B on, Mirror left at "Off" — confirm the visual
   gets visibly more complex/denser (more kaleidoscope reflections) during
   the louder/climactic sections and simplifies again toward the end.
2. Manually set Mirror to e.g. "Quad" — confirm it now stays Quad
   throughout the whole track regardless of song phase (automation must
   not override an explicit choice).
3. Confirm a subtle overall softening/glow on line-based types (grid,
   hexgrid, spiral) — should read as "less raw," not as a heavy blur or
   a distracting halo. If it's too strong or too weak, flag it — `mn *
   0.01` is the constant to retune.
4. On a lower-end device/tab (or by temporarily forcing `S.perfScale`
   low), confirm the glow disappears and mirror complexity still
   degrades gracefully, same as before this change.
5. Confirm nothing looks different during HQ/realtime export at extreme
   zoom/perf settings — `S.exporting` still forces `pf57 = 1` same as
   before.
