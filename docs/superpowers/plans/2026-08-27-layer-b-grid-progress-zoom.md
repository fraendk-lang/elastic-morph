# Layer B — New Grid Types + Progress Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 new Layer B generator types (Iso-Grid, Voronoi, Moiré) and a global "Progress Zoom" modulation that smoothly zooms Layer B in/out based on the song's structural phase (Birth→Grow→Tension→Break→Return→Fade), giving a "close→far→close" breathing motion over the course of a song.

**Architecture:** Both pieces extend `S.layerB`/`drawLayerB` (`elastic-morph.html`) — Layer B's self-contained second visual layer, already built around a `switch (LB.type)` dispatch and a shared `sc` scale factor every type reads. The 3 new types are 3 more `case` blocks in that same switch. Progress Zoom is one more multiplicative term folded into `sc`, driven by a new `dt`-based smoothed accumulator (matching the 4 existing continuous accumulators already in `drawLayerB`) that eases toward a per-phase target scale looked up from `S.phase`.

**Tech Stack:** Vanilla JS, Canvas 2D API. No new dependencies.

## Global Constraints

- Every edit lands in `elastic-morph.html` before the `@BUILD-INJECT-V58` marker (currently line 10153 — verify fresh with `grep -n "@BUILD-INJECT-V58" elastic-morph.html`).
- After every code change, run `npm run ci` (runs `build.js` then `test.js`) and confirm `git diff --stat elastic-morph.html` is empty afterward.
- This round touches ONLY Layer B (`S.layerB`, `drawLayerB`, `LAYERB_TYPES`, the Layer B UI panel, and Layer B's two serialization touch points in `projectData()`/`applyProject()`) — no DNA engine, Shader Engine, Video Timeline, or HQ export code changes.
- Progress Zoom defaults OFF (`progressZoomAmt: 0`) — at that default, `sc`'s new multiplicative term must evaluate to exactly `1` every frame, so no existing preset/share-link/exported video changes its look.
- The phase→scale mapping is fixed: `Birth: 0.75, Grow: 0.9, Tension: 1.15, Break: 1.35, Return: 0.95, Fade: 0.7`.
- Voronoi's 14 seed points are deterministic (golden-ratio sequence, no `Math.random()`) so HQ export renders identically to live playback.
- `git fetch`/`git push` require the Bash tool's `dangerouslyDisableSandbox: true` flag in this environment, or they hang indefinitely.

---

### Task 1: Three new Layer B types (Iso-Grid, Voronoi, Moiré)

**Files:**
- Modify: `elastic-morph.html` (`LAYERB_TYPES` array — verify current line with `grep -n "const LAYERB_TYPES" elastic-morph.html`)
- Modify: `elastic-morph.html` (`drawLayerB`'s `switch (LB.type)` block, specifically after the `case "orbits"` block — verify current line with `grep -n 'case "orbits"' elastic-morph.html`)
- Test: `test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: 3 new working `case` blocks (`"isoGrid"`, `"voronoi"`, `"moire"`) inside `drawLayerB`'s switch, and 3 new entries in `LAYERB_TYPES`. Task 2 doesn't depend on these directly (Progress Zoom is type-agnostic — it just multiplies `sc`, which every type including these three already reads), but Task 3's live verification exercises all of them together.

- [ ] **Step 1: Write the failing tests**

Read the existing "Layer B modulation" test section first (`grep -n 'section("Layer B modulation")' test.js`) to see this file's established conventions for Layer B — you don't need to change that section, just match its style.

Add this new section to `test.js`, right after the existing `section("Layer B modulation");` block ends (after the line `["lbOpLfoRate", "lbOpLfoDepth", "lbOpLfoShape", "lbScLfoRate", "lbScLfoDepth", "lbScLfoShape"].forEach(id => ok("control exists: " + id, html.includes('id="' + id + '"')));`):

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "Iso-Grid, Voronoi, Moiré\|LAYERB_TYPES gained\|case for isoGrid\|case for voronoi\|case for moire\|sit after case\|Voronoi seed generation"`
Expected: every new assertion prints `✗` (the string-match/structural ones fail because the code doesn't exist yet; the pure-math Voronoi determinism test will actually pass immediately since it doesn't depend on the real file at all — that's expected and fine, it's establishing the reference behavior your real implementation must match).

- [ ] **Step 3: Write the implementation**

First confirm current code still matches (line numbers may have drifted): `grep -n "const LAYERB_TYPES" elastic-morph.html` and `grep -n 'case "orbits"' elastic-morph.html`, then read both regions.

In `LAYERB_TYPES` (currently ending with `["orbits", "Orbits"]` followed by `];`), add the 3 new entries right after `["orbits", "Orbits"]`:

```js
  ["orbits",   "Orbits"],
  ["isoGrid",  "Iso-Grid"],
  ["voronoi",  "Voronoi"],
  ["moire",    "Moiré"]
];
```

(Only the trailing `]` changes — from `["orbits", "Orbits"]\n];` to the 4-line block above. Every earlier entry in the array is untouched.)

In `drawLayerB`'s switch, immediately after the existing `case "orbits": { ... break; }` block (before the switch's own closing `}`), add:

```js
    case "isoGrid": {
      const cell = mn * 0.055 * sc, drift = (S.time * 0.3) % cell;
      const cols = Math.ceil(W / cell) + 3, rows = Math.ceil(H / cell) + 3;
      ctx.lineWidth = Math.max(1, mn * 0.0018);
      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const x = col * cell + (row % 2) * cell * 0.5 - drift, y = row * cell * 0.5 - drift * 0.5;
          const v = specAt((col + row * 5) % 40, 40);
          ctx.strokeStyle = colr((col + row) / (cols + rows), 0.1 + v * 0.35 + S.beat * 0.15);
          ctx.beginPath();
          ctx.moveTo(x, y); ctx.lineTo(x + cell * 0.5, y + cell * 0.25);
          ctx.lineTo(x, y + cell * 0.5); ctx.lineTo(x - cell * 0.5, y + cell * 0.25);
          ctx.closePath(); ctx.stroke();
        }
      }
      break;
    }
    case "voronoi": {
      if (!LB._vSeeds || LB._vSeeds.length !== 14) {
        LB._vSeeds = Array.from({ length: 14 }, (_, i) => ({
          x: 0.1 + 0.8 * ((i * 0.61803398875) % 1), y: 0.1 + 0.8 * ((i * 0.38196601125) % 1)
        }));
      }
      const cols = 40, rows = Math.max(1, Math.round(cols * H / W));
      const cw = W / cols, ch = H / rows;
      for (let ry = 0; ry < rows; ry++) for (let rx = 0; rx < cols; rx++) {
        const px = (rx + 0.5) / cols, py = (ry + 0.5) / rows;
        let best = 0, bestD = Infinity;
        for (let i = 0; i < LB._vSeeds.length; i++) {
          const s = LB._vSeeds[i], dx = px - s.x, dy = (py - s.y) * (W / H);
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = i; }
        }
        const e = specAt(best, LB._vSeeds.length) * (0.6 + 0.4 * Math.sin(S.time * 1.3 + best));
        if (e < 0.15) continue;
        ctx.fillStyle = colr(best / LB._vSeeds.length, 0.08 + e * 0.55);
        ctx.fillRect(rx * cw, ry * ch, cw + 1, ch + 1);
      }
      break;
    }
    case "moire": {
      const spacing = mn * 0.012 * sc, phase = S.time * 0.15;
      const drawLines = (angle, offset, alpha) => {
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(angle); ctx.translate(-cx, -cy);
        ctx.strokeStyle = colr(angle, alpha);
        ctx.lineWidth = Math.max(1, mn * 0.0012);
        const n = Math.ceil((W + H) / spacing) + 2;
        for (let i = -n; i < n; i++) {
          const x = i * spacing + offset;
          ctx.beginPath(); ctx.moveTo(x, -H); ctx.lineTo(x, H * 2); ctx.stroke();
        }
        ctx.restore();
      };
      const wobble = Math.sin(phase) * 0.06 + S.bass * 0.03;
      drawLines(0.02 + wobble, 0, 0.22 + S.beat * 0.15);
      drawLines(-0.02 - wobble, spacing * 0.5, 0.18 + S.mids * 0.15);
      break;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "Iso-Grid, Voronoi, Moiré\|LAYERB_TYPES gained\|case for isoGrid\|case for voronoi\|case for moire\|sit after case\|Voronoi seed generation"`
Expected: every assertion prints `✓`.

- [ ] **Step 5: Run the full suite and check for build drift**

Run: `npm run ci` — expect all tests passing, 0 failed, `git diff --stat elastic-morph.html` empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Iso-Grid, Voronoi, and Moiré Layer B types"
```

---

### Task 2: Progress Zoom (phase-driven global scale modulation)

**Files:**
- Modify: `elastic-morph.html` (`S.layerB` default object — verify with `grep -n 'layerB: { on: false' elastic-morph.html`)
- Modify: `elastic-morph.html` (new `LAYERB_PHASE_ZOOM` table, placed directly above `function drawLayerB`)
- Modify: `elastic-morph.html` (`drawLayerB`'s accumulator block and `sc` computation)
- Modify: `elastic-morph.html` (Layer B Modulation UI panel — new slider)
- Modify: `elastic-morph.html` (UI wiring + load-sync for the new slider)
- Modify: `elastic-morph.html` (`projectData()`'s Layer B export — exclusion list)
- Modify: `elastic-morph.html` (`applyProject()`'s Layer B load path — clamped default)
- Test: `test.js` (including one REQUIRED update to a pre-existing test — see Step 1 below, this is not optional)

**Interfaces:**
- Consumes: nothing from Task 1 (this task's `sc` change applies uniformly to Task 1's 3 new types and all 16 pre-existing types, since every type already reads the shared `sc` variable — no per-type code needed).
- Produces: nothing new for later tasks — this is the last code task before verification.

- [ ] **Step 1: Write the failing tests, INCLUDING one required update to an existing test**

**Read this carefully before writing anything — one pre-existing test at `test.js` will break under the new code unless you update it, and this step is not optional.** Find it: `grep -n "projectData excludes all 4 layerB phase accumulators" test.js`. Its current exact code is:

```js
ok("projectData excludes all 4 layerB phase accumulators", /const\s*\{\s*_spin,\s*_hue,\s*_opPhase,\s*_scPhase,\s*\.\.\.rest\s*\}\s*=\s*S\.layerB/.test(script));
```

This test's regex anchors `_scPhase,` directly against `...rest` — but Step 3 below adds two more excluded fields (`_progZoom, _vSeeds`) between them, which this regex does NOT match. Left as-is, this existing test would go from passing to failing the moment you implement Step 3, and that failure would look unrelated to anything you touched. **Replace this exact line** with:

```js
ok("projectData excludes all 6 layerB transient accumulators (incl. progress-zoom + voronoi seeds)", /const\s*\{\s*_spin,\s*_hue,\s*_opPhase,\s*_scPhase,\s*_progZoom,\s*_vSeeds,\s*\.\.\.rest\s*\}\s*=\s*S\.layerB/.test(script));
```

Now add this new section to `test.js`, right after Task 1's "Layer B — Iso-Grid, Voronoi, Moiré" section:

```js
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

ok("#lbProgZoom slider exists in the Layer B Modulation panel", html.includes('id="lbProgZoom"'));

ok("#lbProgZoom is wired to S.layerB.progressZoomAmt on input", script.includes('$("lbProgZoom").addEventListener("input", e => { S.layerB.progressZoomAmt = e.target.value / 100;'));

ok("#lbProgZoom syncs from S.layerB.progressZoomAmt on load", script.includes('$("lbProgZoom").value = Math.round(S.layerB.progressZoomAmt * 100);'));

ok("applyProject() clamps progressZoomAmt to [0,1] with a 0 default when absent", script.includes('S.layerB.progressZoomAmt = lb.progressZoomAmt != null ? clamp01(+lb.progressZoomAmt) : 0;'));
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "Layer B — Progress Zoom\|LAYERB_PHASE_ZOOM has\|progressZoomAmt: 0 and\|accumulator block updates\|no-op at progressZoomAmt\|lbProgZoom"`
Expected: every new assertion prints `✗`. Also run `node test.js 2>&1 | grep -A1 "excludes all"` and confirm the RENAMED test (from Step 1) also prints `✗` at this point — it should, since the destructuring line hasn't been updated in the source yet.

- [ ] **Step 3: Write the implementation**

Confirm current line numbers first (they may have shifted from Task 1's commit): `grep -n 'layerB: { on: false\|const LAYERB_TYPES\|function drawLayerB\|layerB: (() =>\|Object.assign(S.layerB, lb)' elastic-morph.html`.

**3a. `S.layerB` default object** — currently:
```js
  layerB: { on: false, type: "spectrumRing", opacity: 0.8, blend: "lighter", color: "dna", scale: 1,
            pulse: 1, spin: 0, sway: 1, hueDrift: 0, mirror: "off", _spin: 0, _hue: 0,   // v43: modulation
            opLfo: { rate: 0.3, depth: 0, shape: "sine" }, scaleLfo: { rate: 0.3, depth: 0, shape: "sine" },
            _opPhase: 0, _scPhase: 0 },
```
Change the last line to:
```js
            _opPhase: 0, _scPhase: 0, progressZoomAmt: 0, _progZoom: 1 },
```

**3b. New lookup table** — add directly above `function drawLayerB(W, H, hue, dt) {`:
```js
const LAYERB_PHASE_ZOOM = { Birth: 0.75, Grow: 0.9, Tension: 1.15, Break: 1.35, Return: 0.95, Fade: 0.7 };
```

**3c. Accumulator block** — currently (inside `drawLayerB`, the `if (!S.frozen) { ... }` block):
```js
  if (!S.frozen) {
    LB._spin = (LB._spin || 0) + dt * LB.spin * 1.4;
    LB._hue = (LB._hue || 0) + dt * LB.hueDrift * 60;
    LB._opPhase = (LB._opPhase || 0) + dt * LB.opLfo.rate;
    LB._scPhase = (LB._scPhase || 0) + dt * LB.scaleLfo.rate;
  }
```
Change to:
```js
  if (!S.frozen) {
    LB._spin = (LB._spin || 0) + dt * LB.spin * 1.4;
    LB._hue = (LB._hue || 0) + dt * LB.hueDrift * 60;
    LB._opPhase = (LB._opPhase || 0) + dt * LB.opLfo.rate;
    LB._scPhase = (LB._scPhase || 0) + dt * LB.scaleLfo.rate;
    const zTarget = LAYERB_PHASE_ZOOM[S.phase] || 1;
    LB._progZoom = (LB._progZoom || 1) + (zTarget - (LB._progZoom || 1)) * Math.min(1, dt / 2.5);
  }
```

**3d. `sc` computation** — currently:
```js
  const sc = LB.scale * (1 + LB.scaleLfo.depth * lfoWave(LB.scaleLfo.shape, LB._scPhase || 0));
```
Change to:
```js
  const sc = LB.scale * (1 + LB.scaleLfo.depth * lfoWave(LB.scaleLfo.shape, LB._scPhase || 0))
             * (1 + ((LB._progZoom || 1) - 1) * LB.progressZoomAmt);
```

**3e. UI slider** — in the Layer B Modulation panel HTML, find `<select id="lbMirror" class="pm-select" style="margin-top:8px">` (`grep -n '<select id="lbMirror"' elastic-morph.html`) and insert this new slider-row directly before it:
```html
    <div class="slider-row">
      <label>Progress Zoom <span class="val" id="lbProgZoomVal">0</span></label>
      <input type="range" id="lbProgZoom" min="0" max="100" value="0">
    </div>
```

**3f. UI wiring** — find `$("lbMirror").addEventListener("change", e => S.layerB.mirror = e.target.value);` (`grep -n '\$("lbMirror").addEventListener' elastic-morph.html`) and add this line directly before it:
```js
  $("lbProgZoom").addEventListener("input", e => { S.layerB.progressZoomAmt = e.target.value / 100; $("lbProgZoomVal").textContent = e.target.value; });
```

**3g. UI load-sync** — find `$("lbMirror").value = S.layerB.mirror;` (`grep -n '\$("lbMirror").value' elastic-morph.html`) and add these two lines directly before it:
```js
  $("lbProgZoom").value = Math.round(S.layerB.progressZoomAmt * 100);
  $("lbProgZoomVal").textContent = Math.round(S.layerB.progressZoomAmt * 100);
```

**3h. `projectData()` export exclusion** — currently:
```js
    layerB: (() => { const { _spin, _hue, _opPhase, _scPhase, ...rest } = S.layerB; return rest; })(),
```
Change to:
```js
    layerB: (() => { const { _spin, _hue, _opPhase, _scPhase, _progZoom, _vSeeds, ...rest } = S.layerB; return rest; })(),
```

**3i. `applyProject()` load path** — currently, right after `Object.assign(S.layerB, lb);` and its immediately following clamp lines:
```js
  Object.assign(S.layerB, lb);
  S.layerB.opacity = clamp01(S.layerB.opacity);
  S.layerB.scale = Math.max(0.4, Math.min(1.8, +S.layerB.scale || 1));
  // v43: modulation params (default to neutral when absent)
  S.layerB.pulse = lb.pulse != null ? +lb.pulse : 1;
```
Add the new clamped-default line right after the `S.layerB.scale = ...` line, before the `// v43` comment:
```js
  Object.assign(S.layerB, lb);
  S.layerB.opacity = clamp01(S.layerB.opacity);
  S.layerB.scale = Math.max(0.4, Math.min(1.8, +S.layerB.scale || 1));
  S.layerB.progressZoomAmt = lb.progressZoomAmt != null ? clamp01(+lb.progressZoomAmt) : 0;
  // v43: modulation params (default to neutral when absent)
  S.layerB.pulse = lb.pulse != null ? +lb.pulse : 1;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "Layer B — Progress Zoom\|LAYERB_PHASE_ZOOM has\|progressZoomAmt: 0 and\|accumulator block updates\|no-op at progressZoomAmt\|lbProgZoom\|excludes all"`
Expected: every assertion (including the Step-1-renamed one) prints `✓`.

- [ ] **Step 5: Run the full suite and check for build drift**

Run: `npm run ci` — expect all tests passing, 0 failed, `git diff --stat elastic-morph.html` empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: Layer B Progress Zoom — phase-driven breathing motion across all types"
```

---

### Task 3: Live verification and push

**Files:** none (no code changes — verification only).

**Interfaces:**
- Consumes: the fully-wired feature from Tasks 1–2.
- Produces: nothing — terminal task.

This task has no automated-test steps — canvas rendering changes in this codebase are not
meaningfully covered by the structural `extractFn`+`.includes()` test style (the established
lesson from every Video Timeline rendering round yesterday: real bugs were only caught by live
browser verification). Perform these steps directly (not via a written test file):

- [ ] **Step 1: Start the dev server and open it in a browser**

The project's own `.claude/launch.json`-driven preview tool has intermittently served stale
content from a wrong working directory in this environment (see project memory
`project_morph_hq_export_frame_accuracy.md`). Prefer running the server directly:

```bash
npx --yes serve -l 3461 "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
```

Then open `http://localhost:3461/elastic-morph` in the browser tool and confirm via
`curl -s http://localhost:3461/elastic-morph | grep -c "LAYERB_PHASE_ZOOM"` returns `1`+ before
trusting anything rendered in the tab.

- [ ] **Step 2: Load a track and enable Layer B**

In the browser console (`javascript_tool`):
```js
await loadDemoTrack({});
```
Then enable Layer B and confirm state:
```js
S.layerB.on = true; $("lbOn").checked = true;
({ types: LAYERB_TYPES.length, hasNewTypes: LAYERB_TYPES.some(([id]) => id === "isoGrid") && LAYERB_TYPES.some(([id]) => id === "voronoi") && LAYERB_TYPES.some(([id]) => id === "moire") });
```

- [ ] **Step 3: Confirm all 3 new types render distinct, non-blank content**

For each of `"isoGrid"`, `"voronoi"`, `"moire"`: set `S.layerB.type = "<id>"; $("lbType").value = "<id>";`, start playback (`S.playing = true; if (typeof play === 'function') play();`), wait ~1s, screenshot the canvas, and visually confirm real drawn content (not a blank/black frame) that's visibly different in character from the other two and from the pre-existing types. Check the browser console for errors after each.

- [ ] **Step 4: Confirm Progress Zoom's breathing motion**

Set `S.layerB.progressZoomAmt = 1; $("lbProgZoom").value = 100; $("lbProgZoomVal").textContent = "100";` with any Layer B type active and audio playing. Programmatically step through each song phase by setting `S.progress` to a representative value inside each of the 6 `SONGMAP_DEFAULT` ranges (e.g. `0.05` for Birth, `0.25` for Grow, `0.45` for Tension, `0.6` for Break, `0.8` for Return, `0.95` for Fade — matching `SONGMAP_DEFAULT`'s `a`/`b` boundaries), letting a few seconds of real time pass at each step so `LB._progZoom` can smooth toward its new target, and confirm via `S.layerB._progZoom` in the console that it moves toward each phase's target value (`0.75/0.9/1.15/1.35/0.95/0.7` respectively) and that the rendered Layer B content visibly grows/shrinks in scale between the Birth/Fade (small) and Break (large) checks.

- [ ] **Step 5: Confirm Progress Zoom at 0 is a true no-op**

Set `S.layerB.progressZoomAmt = 0`, screenshot a Layer B type at a few different `S.progress` values, and confirm the rendered scale does NOT change across them (unlike Step 4) — this is the "no visual change from before this round" check the design requires.

- [ ] **Step 6: Confirm save/reload round-trip**

```js
const data = projectData();
JSON.stringify(data).includes("_progZoom") || JSON.stringify(data).includes("_vSeeds")
```
Expect `false` (neither transient field appears in the exported JSON). Then:
```js
S.layerB.progressZoomAmt = 0.42;
const saved = projectData();
S.layerB.progressZoomAmt = 0;
applyProject(saved);
S.layerB.progressZoomAmt
```
Expect `0.42` (round-trips correctly).

- [ ] **Step 7: Check console for errors, then clean up and push**

```bash
pkill -f "serve -l 3461"
```
```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
npm run ci
git status --short
git push origin main
```
(Use the Bash tool's `dangerouslyDisableSandbox: true` for the push, per the Global Constraints above.)

- [ ] **Step 8: Confirm live via hash match**

```bash
shasum -a 256 elastic-morph.html
curl -s https://elasticmorph.app/elastic-morph.html | shasum -a 256
```
Wait for the Vercel deploy to complete (30-60s is typical) before the second command if the hashes don't match on the first try.
