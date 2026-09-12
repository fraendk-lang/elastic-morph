# Layer B Grid-Density Cap (isoGrid/hexgrid/moire) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a reproduced performance bug: switching Layer B (Ebene 2, Shift+Arrow) into the `isoGrid`, `hexgrid`, or `moire` types causes a severe one-frame (or few-frame) stutter whenever the shared `sc` scale factor is small (Layer B Scale slider turned down, Scale LFO depth, or Progress Zoom pushing it toward its 0.05 floor). Live-measured on production (elasticmorph.app) at `S.layerB.scale = 0.08`: `isoGrid` avg **449.7ms/frame** and `moire` avg **137.2ms/frame**, versus ~17-20ms/frame for every other type at the same setting.

**Architecture:** `isoGrid`/`hexgrid` derive their grid's `cols`/`rows` from `W or H / (mn * k * sc)`, and `moire` derives its per-grid line count `n` from `(W+H) / (mn * k * sc)` — all three are inversely proportional to `sc`. A prior fix (v122, already shipped) floors `sc` itself at `0.05` to stop a literal `Infinity`/tab-freeze, but at that floor `isoGrid` can still draw ~238,550 stroked diamonds in a single frame (measured: 650×367 cols×rows in a small test viewport) and `moire` ~9,268 line strokes — both far beyond a single frame's budget. `hexgrid` has a brightness-threshold skip (`if (v < 0.18) continue`) that already limits its *actual* draw calls in practice, but its iteration count is unbounded the same way, so it gets capped too for consistency/defense-in-depth (the case's own comment says so explicitly).

The fix caps the derived `cols`/`rows`/`n` values directly with `Math.min`, right where they're computed — independent of `sc`, so no matter how small Scale/Scale LFO/Progress Zoom push it, the draw-call count for these 3 types has a hard ceiling. Chosen caps (`cols`/`rows` ≤ 90 for isoGrid/hexgrid, `n` ≤ 300 for moire) sit well above each type's default (`sc = 1`) density — the "denser grid as you zoom in" effect stays intact — while bounding the worst case to a small, cheap fraction of the pathological count (a synthetic timing test on production measured a 26×-92× draw-count reduction depending on cap tightness; 90 was chosen to keep visual headroom while a follow-up manual check confirms it feels smooth).

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`). All 3 edits are in `drawLayerB` (`elastic-morph.html` ~6863-7310), which sits **before** the `/* @BUILD-INJECT-V58 */` marker (~line 11680) — this is genuinely-original, never-regenerated code, so edit `elastic-morph.html` directly (not a `src/inject-vNN.js` file). See [[project_morph_build_pipeline_gotcha]] before touching anything past that marker in a future session.

## Global Constraints

- Exactly 3 lines change, one per type (`isoGrid`, `hexgrid`, `moire`'s `drawLines` inner `n`). No other logic in `drawLayerB` changes.
- Caps: `Math.min(90, ...)` for `isoGrid`'s `cols` and `rows`; `Math.min(90, ...)` for `hexgrid`'s `cols` and `rows`; `Math.min(300, ...)` for `moire`'s `n` (inside `drawLines`, so it applies to both of the 2 calls).
- The existing `sc` floor (`Math.max(0.05, scRaw)`, v122) and hexgrid's brightness skip are untouched — this is an additional, independent safety net, not a replacement.
- No change to visual behavior at normal settings (`sc` near 1) — the caps only engage when the uncapped count would already exceed them, which only happens at low `sc`.
- Since this task edits pre-marker code in `elastic-morph.html`, `node build.js` is a no-op for it, but per [[project_morph_build_pipeline_gotcha]]'s reinforced rule, run **`npm run ci`** (not `node test.js` alone) for verification anyway — zero exceptions, regardless of which region a change touches.

---

### Task 1: Cap isoGrid's cols/rows

**Files:**
- Modify: `elastic-morph.html:7249` (inside `drawLayerB`'s `case "isoGrid":`)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Consumes: `cell` (existing, in scope), `W`, `H` (existing, in scope).
- Produces: nothing new — `cols`/`rows` keep their existing names and are consumed the same way by the loop right below.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Layer B — isoGrid/hexgrid/moire grid-density cap (perf fix)");

ok("isoGrid's cols/rows are capped at 90 regardless of how small cell (1/sc) gets", () => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes('case "isoGrid": {')
    && fn.includes("const cols = Math.min(90, Math.ceil(W / cell) + 3), rows = Math.min(90, Math.ceil(H / cell) + 3);");
});

ok("hexgrid's cols/rows are capped at 90 regardless of how small hw/vh2 (1/sc) get", () => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes('case "hexgrid": {')
    && fn.includes("const cols = Math.min(90, Math.ceil(W / hw) + 1), rows = Math.min(90, Math.ceil(H / vh2) + 1);");
});

ok("moire's per-grid line count n is capped at 300 regardless of how small spacing (1/sc) gets", () => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes('case "moire": {')
    && fn.includes("const n = Math.min(300, Math.ceil((W + H) / spacing) + 2);");
});

ok("the existing sc floor (Math.max(0.05, scRaw)) is untouched — the cap is additive, not a replacement", () => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes("const sc = Math.max(0.05, scRaw);");
});

ok("hexgrid's brightness-threshold skip is untouched", () => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes("if (v < 0.18) continue;");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run ci`
Expected: the first 3 new assertions print `✗` (the cap isn't in the code yet); the last 2 print `✓` (they check code that already exists and isn't being changed). Everything else still `✓`.

- [ ] **Step 3: Implement — isoGrid's cols/rows cap (`elastic-morph.html:7249`)**

Find:

```js
    case "isoGrid": {
      const cell = mn * 0.055 * sc, drift = (S.time * 0.3) % cell;
      const cols = Math.ceil(W / cell) + 3, rows = Math.ceil(H / cell) + 3;
```

Replace it with:

```js
    case "isoGrid": {
      const cell = mn * 0.055 * sc, drift = (S.time * 0.3) % cell;
      // v154: cap cols/rows directly — the sc floor (0.05, v122) stops a literal Infinity, but a
      // small cell can still blow this up to hundreds of thousands of stroked diamonds in one
      // frame, stalling the tab for a visible beat whenever Layer B switches into isoGrid while
      // Scale (or Scale LFO / Progress Zoom) has pushed sc down near its floor. 90 sits well
      // above the sc=1 default density, so the "denser as you zoom in" effect is unaffected.
      const cols = Math.min(90, Math.ceil(W / cell) + 3), rows = Math.min(90, Math.ceil(H / cell) + 3);
```

- [ ] **Step 4: Implement — hexgrid's cols/rows cap**

Find:

```js
    case "hexgrid": {
      const R = mn * 0.05 * sc, hw = R * Math.sqrt(3), vh2 = R * 1.5;
      const cols = Math.ceil(W / hw) + 1, rows = Math.ceil(H / vh2) + 1;
```

Replace it with:

```js
    case "hexgrid": {
      const R = mn * 0.05 * sc, hw = R * Math.sqrt(3), vh2 = R * 1.5;
      // v154: same cols/rows cap as isoGrid (see that case's comment) — the brightness-threshold
      // skip below already limits hexgrid's actual fill count in practice, but the iteration
      // count itself is unbounded the same 1/sc way, so it's capped too for consistency.
      const cols = Math.min(90, Math.ceil(W / hw) + 1), rows = Math.min(90, Math.ceil(H / vh2) + 1);
```

- [ ] **Step 5: Implement — moire's line-count cap**

Find:

```js
        ctx.lineWidth = Math.max(1, mn * 0.0012);
        const n = Math.ceil((W + H) / spacing) + 2;
```

Replace it with:

```js
        ctx.lineWidth = Math.max(1, mn * 0.0012);
        // v154: cap the line count — same 1/sc blowup as isoGrid/hexgrid (see that case's
        // comment), here driving how many parallel lines each of the 2 rotated grids strokes.
        const n = Math.min(300, Math.ceil((W + H) / spacing) + 2);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run ci`
Expected: all assertions print `✓`, including the 5 new ones. Final line: `<N> passed, 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "fix: cap isoGrid/hexgrid/moire grid density so low Scale can't stall a frame

Frank reported a performance hitch in Chrome and Safari when quickly
cycling Layer B (Shift+Arrow) — reproduced and root-caused live on
production: with S.layerB.scale turned down, switching into isoGrid
averaged 449.7ms/frame and moire 137.2ms/frame (vs ~17-20ms for every
other type at the same setting).

isoGrid/hexgrid derive cols/rows, and moire its per-grid line count n,
from W or (W+H) / (mn * k * sc) — all three inversely proportional to
sc. The existing v122 fix floors sc at 0.05 to stop a literal Infinity
freeze, but at that floor isoGrid can still draw ~238,550 stroked
diamonds in a single frame (measured on production) and moire ~9,268
line strokes — both far past a frame's budget. hexgrid's brightness
skip already limits its real draw count but not its iteration count,
so it's capped too for consistency.

Caps cols/rows at 90 (isoGrid/hexgrid) and n at 300 (moire) — well
above each type's sc=1 default density, so the zoom-in effect is
unaffected, but the pathological low-sc case is now a small, cheap
fraction of what it was. The sc floor and hexgrid's brightness skip
are untouched; this is an additional, independent safety net.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

1. In the DNA panel, open Layer B and turn the **Scale** slider down toward its minimum (or enable Scale LFO with a high depth). Switch through types with Shift+Arrow — `isoGrid`, `hexgrid`, and `moire` should no longer produce a visible stutter, in both Chrome and Safari.
2. With Scale back at its default (1.0), confirm `isoGrid`, `hexgrid`, and `moire` still look the same as before (same density) — the cap should not be visible at normal settings.
3. Try Scale at a few intermediate low values (not just the extreme minimum) to confirm the stutter is gone across the range, not just at the exact floor.
4. If any of the 3 types still feels heavier than the rest even after this fix, that's useful data for a follow-up round (e.g. tightening the cap further, or adding hexgrid's brightness-skip style short-circuit to isoGrid/moire too) — not expected, but worth flagging if seen.
