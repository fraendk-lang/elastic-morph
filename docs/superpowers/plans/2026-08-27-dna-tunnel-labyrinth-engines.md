# DNA Engines — Corridor Tunnel, Spiral Vortex, Maze Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 new DNA engines — Corridor Tunnel, Spiral Vortex, Maze Grid — to the existing ~19-engine roster.

**Architecture:** Each engine is a new `drawXxx(base, hue, growthF, energySize, seed)` Canvas 2D function, wired into `drawScene()`'s existing `dnaEngine` dispatch chain, `PRESETS`, and `renderPreviews()` via the exact 4-piece template every prior DNA engine round already used.

**Tech Stack:** Vanilla JS, Canvas 2D API. No new dependencies.

## Global Constraints

- Every edit lands in `elastic-morph.html` before the `@BUILD-INJECT-V58` marker (currently line 10328 — verify fresh with `grep -n "@BUILD-INJECT-V58" elastic-morph.html`).
- **Do not place the 3 new draw functions near `drawFluidLite`** (currently line 10744) even though it's the most recently-added, closest-looking engine — it sits AFTER the marker (a `build.js`-injected function from a `src/inject-vNN.js` module, not hand-edited HTML). Place the new functions after `drawSacred` instead (currently ends line 4723, well before the marker) — verify this placement's exact current line fresh via `grep -n "^function drawSacred" elastic-morph.html` before editing, since line numbers drift.
- After every code change, run `npm run ci` (runs `build.js` then `test.js`) and confirm `git diff --stat elastic-morph.html` is empty afterward.
- `buildMazeGrid`'s wall layout must be deterministic (seeded hash, no `Math.random()`) so HQ export renders identically to live playback — matches the `buildSeqPattern`/`fract1` pattern already established in this file.
- `git fetch`/`git push` require the Bash tool's `dangerouslyDisableSandbox: true` flag in this environment, or they hang indefinitely.

---

### Task 1: Three new DNA engines + wiring

**Files:**
- Modify: `elastic-morph.html` (3 new draw functions + `buildMazeGrid` helper — placed after `drawSacred`, verify current line with `grep -n "^function drawSacred" elastic-morph.html`)
- Modify: `elastic-morph.html` (`drawScene()`'s dispatch chain — verify current line with `grep -n 'dnaEngine === "fluid"' elastic-morph.html`)
- Modify: `elastic-morph.html` (`PRESETS` array — verify current line with `grep -n "^const PRESETS" elastic-morph.html`)
- Modify: `elastic-morph.html` (`renderPreviews()`'s mini-preview chain — verify current line with `grep -n 'p.engine === "vu"' elastic-morph.html`)
- Test: `test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: 3 working DNA engines (`tunnelCorridor`, `spiralVortex`, `mazeGrid`) selectable via their `PRESETS` entries (`tunnelDrift`, `vortexSpin`, `mazeWalker`), each with a live draw function and a mini-preview. Task 2's live verification depends on all 4 touch points being wired correctly.

- [ ] **Step 1: Write the failing tests**

Read the Layer B round's equivalent test section first (`grep -n "Video Timeline thumbnails — captureVideoClipThumb" test.js` — not directly relevant content, but a similarly-shaped "several new named branches added to an existing dispatch mechanism" test section; also read `grep -n "Voronoi seed generation" test.js` for this file's established pure-math-determinism test style) to match conventions — you don't need to change either section, just follow its style.

Add this new section to `test.js` (anywhere after the existing DNA-related tests — e.g. right after the last `section(...)` call in the file is fine, or grep for `section("Layer B` and add after that whole block if you want it near the other Alpha-Milestone-round tests):

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "DNA Engines — Corridor Tunnel\|drawTunnelCorridor is defined\|drawSpiralVortex is defined\|drawMazeGrid is defined\|buildMazeGrid is defined\|buildMazeGrid is deterministic\|dispatch chain has the 3 new\|PRESETS gained the 3 new\|renderPreviews\(\) has the 3 new"`
Expected: every new assertion prints `✗` (either `false` for the structural checks, or a thrown/caught error for the `loadFns` behavioral test since neither function exists yet).

- [ ] **Step 3: Write the implementation**

First confirm current locations (line numbers may have drifted): `grep -n "^function drawSacred" elastic-morph.html`, then read ~10 lines from its end to confirm the exact closing text. It currently ends with:
```js
  pass(1, 1, 0, style);
  // v57: drop the counter-rotating layer only if the GPU is struggling (full quality in export)
  if (S.geo2.on && (S.exporting || (S.perfScale || 1) > 0.5)) pass(-1, S.geo2.scale, S.geo2.hueShift, S.geo2.style === "same" ? style : S.geo2.style);
}
```

**3a.** Add these 3 functions (plus `buildMazeGrid` and its module-level cache) directly after that closing `}`, before the next section's comment block (`/* ... v26: OFFLINE PER-FRAME AUDIO ANALYSIS ... */`):

```js
function drawTunnelCorridor(base, hue, growthF, energySize, seed) {
  const P = currentDNA(), mn = Math.min(canvas.width, canvas.height);
  const rings = 14;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < rings; i++) {
    const z = ((i / rings) + S.time * 0.12 + S.bass * 0.06) % 1;
    const f = z * z;
    const rw = mn * 0.68 * f * (0.85 + growthF * 0.15) * energySize;
    const rh = rw * 0.62;
    const a = Math.min(1, 0.55 * (1 - f) * (0.6 + S.loudness * 0.5 + S.beat * 0.4));
    const ihue = (hue + i * 8 + f * 40) % 360;
    ctx.strokeStyle = `hsla(${ihue}, ${P.sat}%, 68%, ${a})`;
    ctx.lineWidth = Math.max(1, mn * 0.0025 * (1 - f * 0.5));
    ctx.strokeRect(-rw / 2, -rh / 2, rw, rh);
  }
  ctx.restore();
}
function drawSpiralVortex(base, hue, growthF, energySize, seed) {
  const P = currentDNA(), mn = Math.min(canvas.width, canvas.height);
  const rings = 16, sides = 8;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < rings; i++) {
    const z = ((i / rings) + S.time * 0.14 + S.bass * 0.08) % 1;
    const f = z * z;
    const r = mn * 0.5 * f * (0.85 + growthF * 0.15) * energySize;
    const spin = S.time * 0.5 + f * 6.0;
    const a = Math.min(1, 0.5 * (1 - f) * (0.6 + S.loudness * 0.5 + S.beat * 0.5));
    const ihue = (hue + i * 10 + f * 60) % 360;
    ctx.strokeStyle = `hsla(${ihue}, ${P.sat}%, 68%, ${a})`;
    ctx.lineWidth = Math.max(1, mn * 0.002 * (1 - f * 0.5));
    ctx.beginPath();
    for (let s = 0; s <= sides; s++) {
      const ang = (s / sides) * Math.PI * 2 + spin;
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r * 0.94;
      if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
let mazeGrid = null, mazeSeed = null;
function buildMazeGrid(seed) {
  const cols = 12, rows = 8;
  const hWalls = [], vWalls = [];
  for (let r = 0; r <= rows; r++) {
    const hRow = [];
    for (let c = 0; c < cols; c++) {
      const h = fract1(Math.sin((seed + 1) * 12.9898 + r * 47.31 + c * 7.13 + 91.7) * 43758.5453);
      hRow.push(h < 0.42);
    }
    hWalls.push(hRow);
  }
  for (let r = 0; r < rows; r++) {
    const vRow = [];
    for (let c = 0; c <= cols; c++) {
      const v = fract1(Math.sin((seed + 1) * 38.21 + r * 17.63 + c * 91.13 + 3.7) * 24634.634);
      vRow.push(v < 0.42);
    }
    vWalls.push(vRow);
  }
  return { cols, rows, hWalls, vWalls };
}
function drawMazeGrid(base, hue, growthF, energySize, seed) {
  const P = currentDNA(), mn = Math.min(canvas.width, canvas.height);
  if (mazeGrid === null || mazeSeed !== seed) { mazeGrid = buildMazeGrid(seed); mazeSeed = seed; }
  const { cols, rows, hWalls, vWalls } = mazeGrid;
  const w = mn * 0.7 * (0.9 + growthF * 0.15) * energySize, h = w * (rows / cols);
  const cw = w / cols, ch = h / rows;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!hWalls[r][c]) continue;
      const x0 = -w / 2 + c * cw, y0 = -h / 2 + r * ch;
      const v = specAt((r * cols + c) % 48, 48);
      const bhue = (hue + (r * cols + c) * 4) % 360;
      ctx.strokeStyle = `hsla(${bhue}, ${P.sat}%, 65%, ${0.25 + v * 0.55 + S.beat * 0.2})`;
      ctx.lineWidth = Math.max(1, mn * 0.0025);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + cw, y0); ctx.stroke();
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols; c++) {
      if (!vWalls[r][c]) continue;
      const x0 = -w / 2 + c * cw, y0 = -h / 2 + r * ch;
      const v = specAt((r * cols + c + 7) % 48, 48);
      const bhue = (hue + (r * cols + c + 7) * 4) % 360;
      ctx.strokeStyle = `hsla(${bhue}, ${P.sat}%, 65%, ${0.25 + v * 0.55 + S.beat * 0.2})`;
      ctx.lineWidth = Math.max(1, mn * 0.0025);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + ch); ctx.stroke();
    }
  }
  ctx.restore();
}
```

**3b.** In `drawScene()`'s dispatch chain, current text (confirm with `grep -n 'dnaEngine === "fluid"' elastic-morph.html`):
```js
  } else if (dnaEngine === "fluid") {
    drawFluidLite(base, hue, growthF, energySize, seed);
  } else {
```
Change to:
```js
  } else if (dnaEngine === "fluid") {
    drawFluidLite(base, hue, growthF, energySize, seed);
  } else if (dnaEngine === "tunnelCorridor") {
    drawTunnelCorridor(base, hue, growthF, energySize, seed);
  } else if (dnaEngine === "spiralVortex") {
    drawSpiralVortex(base, hue, growthF, energySize, seed);
  } else if (dnaEngine === "mazeGrid") {
    drawMazeGrid(base, hue, growthF, energySize, seed);
  } else {
```

**3c.** `PRESETS` — current end (confirm with `grep -n "^const PRESETS" elastic-morph.html` then read to the array's closing `];`):
```js
  {
    id: "fluidlite", name: "Fluid Lite",
    desc: "Leichte 2D-Fluid-Simulation — flüssige Farbfelder. Liquid DnB, Chill.",
    hue: 200, hueEnd: 260, sat: 65, bgFade: 0.07,
    layers: 1, points: 0, noiseAmp: 0, speed: 0.35,
    particles: 0, particleStyle: "soft", symmetry: 1,
    verticalStretch: 1.0, grain: 0, lineMode: false, petals: 0, glass: false,
    motion: "flow", flowBias: 0, constellation: false, bloom: 0.5, waveRing: false,
    engine: "fluid",
    gradient: ["#081828", "#143858", "#6ec8ff"]
  }
];
```
Change to:
```js
  {
    id: "fluidlite", name: "Fluid Lite",
    desc: "Leichte 2D-Fluid-Simulation — flüssige Farbfelder. Liquid DnB, Chill.",
    hue: 200, hueEnd: 260, sat: 65, bgFade: 0.07,
    layers: 1, points: 0, noiseAmp: 0, speed: 0.35,
    particles: 0, particleStyle: "soft", symmetry: 1,
    verticalStretch: 1.0, grain: 0, lineMode: false, petals: 0, glass: false,
    motion: "flow", flowBias: 0, constellation: false, bloom: 0.5, waveRing: false,
    engine: "fluid",
    gradient: ["#081828", "#143858", "#6ec8ff"]
  },
  {
    id: "tunnelDrift", name: "Tunnel Drift",
    desc: "Eckige Rahmen fliegen auf dich zu — ein endloser Korridor. Ambient, Downtempo, Cinematic.",
    hue: 190, hueEnd: 250, sat: 70, bgFade: 0.08,
    layers: 1, points: 0, noiseAmp: 0, speed: 0.4,
    particles: 0, particleStyle: "soft", symmetry: 1,
    verticalStretch: 1.0, grain: 0, lineMode: false, petals: 0, glass: false,
    motion: "orbit", flowBias: 0, constellation: false, bloom: 0.4, waveRing: false,
    engine: "tunnelCorridor",
    gradient: ["#0a1828", "#183858", "#5ec8ff"]
  },
  {
    id: "vortexSpin", name: "Vortex Spin",
    desc: "Ein sich verdrehender Strudel-Tunnel — rund, rotierend, hypnotisch. Trance, Techno, Psybient.",
    hue: 280, hueEnd: 330, sat: 80, bgFade: 0.09,
    layers: 1, points: 0, noiseAmp: 0, speed: 0.4,
    particles: 0, particleStyle: "soft", symmetry: 1,
    verticalStretch: 1.0, grain: 0, lineMode: false, petals: 0, glass: false,
    motion: "orbit", flowBias: 0, constellation: false, bloom: 0.45, waveRing: false,
    engine: "spiralVortex",
    gradient: ["#1a0828", "#3a1858", "#c86eff"]
  },
  {
    id: "mazeWalker", name: "Maze Walker",
    desc: "Ein Labyrinth-Wandraster von oben, Gänge leuchten mit den Frequenzbändern. IDM, Glitch, Experimental.",
    hue: 150, hueEnd: 200, sat: 65, bgFade: 0.1,
    layers: 1, points: 0, noiseAmp: 0, speed: 0.4,
    particles: 0, particleStyle: "soft", symmetry: 1,
    verticalStretch: 1.0, grain: 0.15, lineMode: false, petals: 0, glass: false,
    motion: "orbit", flowBias: 0, constellation: false, bloom: 0.35, waveRing: false,
    engine: "mazeGrid",
    gradient: ["#081c18", "#123c30", "#4bffb0"]
  }
];
```

**3d.** `renderPreviews()`'s mini-preview chain — current text around the `vu`/`dance` boundary (confirm with `grep -n 'p.engine === "vu"' elastic-morph.html` then read to the `dance` branch):
```js
    } else if (p.engine === "dance") {
```
(immediately preceded by the closing `}` of the `vu` branch). Insert the 3 new branches directly before this line:
```js
    } else if (p.engine === "tunnelCorridor") {
      for (let i = 0; i < 6; i++) {
        const f = (i / 6 + t * 0.15) % 1, f2 = f * f;
        const rw = R * 1.6 * f2, rh = rw * 0.62;
        c.strokeStyle = `hsla(${(hue + i * 8) % 360},${p.sat}%,68%,${0.5 * (1 - f2)})`;
        c.lineWidth = 1.5;
        c.strokeRect(-rw / 2, -rh / 2, rw, rh);
      }
    } else if (p.engine === "spiralVortex") {
      for (let i = 0; i < 7; i++) {
        const f = (i / 7 + t * 0.18) % 1, f2 = f * f;
        const r = R * 1.2 * f2, spin = t * 0.5 + f2 * 6.0;
        c.strokeStyle = `hsla(${(hue + i * 10) % 360},${p.sat}%,68%,${0.45 * (1 - f2)})`;
        c.lineWidth = 1.5;
        c.beginPath();
        for (let s = 0; s <= 8; s++) {
          const a = (s / 8) * 6.2832 + spin;
          const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.94;
          if (s === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
      }
    } else if (p.engine === "mazeGrid") {
      const cols = 8, rows = 6, w = R * 1.6, h = w * (rows / cols), cw = w / cols, ch = h / rows;
      for (let r = 0; r <= rows; r++) for (let cIdx = 0; cIdx < cols; cIdx++) {
        const hh = fract1(Math.sin((pv.seed + 1) * 12.9898 + r * 47.31 + cIdx * 7.13 + 91.7) * 43758.5453);
        if (hh >= 0.42) continue;
        const x0 = -w / 2 + cIdx * cw, y0 = -h / 2 + r * ch;
        c.strokeStyle = `hsla(${(hue + (r * cols + cIdx) * 4) % 360},${p.sat}%,65%,0.5)`; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + cw, y0); c.stroke();
      }
      for (let r = 0; r < rows; r++) for (let cIdx = 0; cIdx <= cols; cIdx++) {
        const vv = fract1(Math.sin((pv.seed + 1) * 38.21 + r * 17.63 + cIdx * 91.13 + 3.7) * 24634.634);
        if (vv >= 0.42) continue;
        const x0 = -w / 2 + cIdx * cw, y0 = -h / 2 + r * ch;
        c.strokeStyle = `hsla(${(hue + (r * cols + cIdx + 7) * 4) % 360},${p.sat}%,65%,0.5)`; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, y0 + ch); c.stroke();
      }
    } else if (p.engine === "dance") {
```
(Only the 3 new branches are inserted directly before the existing `dance` branch — the `vu` branch above it and everything else in the chain is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "DNA Engines — Corridor Tunnel\|drawTunnelCorridor is defined\|drawSpiralVortex is defined\|drawMazeGrid is defined\|buildMazeGrid is defined\|buildMazeGrid is deterministic\|dispatch chain has the 3 new\|PRESETS gained the 3 new\|renderPreviews\(\) has the 3 new"`
Expected: every assertion prints `✓`.

- [ ] **Step 5: Run the full suite and check for build drift**

Run: `npm run ci` — expect all tests passing, 0 failed, `git diff --stat elastic-morph.html` empty (confirms the 3 new draw functions really did land before the `@BUILD-INJECT-V58` marker — if `build.js` silently dropped or altered them, this check would catch it).

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Corridor Tunnel, Spiral Vortex, and Maze Grid DNA engines"
```

---

### Task 2: Live verification and push

**Files:** none (no code changes — verification only).

**Interfaces:**
- Consumes: the fully-wired feature from Task 1.
- Produces: nothing — terminal task.

This task has no automated-test steps — canvas rendering changes in this codebase are not
meaningfully covered by the structural `extractFn`+`.includes()` test style (the established
lesson from every rendering round this session). Perform these steps directly (not via a written
test file):

- [ ] **Step 1: Start the dev server and open it in a browser**

The project's own `.claude/launch.json`-driven preview tool has intermittently served stale
content from a wrong working directory in this environment (see project memory
`project_morph_hq_export_frame_accuracy.md`). Prefer running the server directly:

```bash
npx --yes serve -l 3465 "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
```

Then open `http://localhost:3465/elastic-morph` in the browser tool and confirm via
`curl -s http://localhost:3465/elastic-morph | grep -c "drawMazeGrid"` returns `1`+ before
trusting anything rendered in the tab.

- [ ] **Step 2: Load a track and select each new preset**

In the browser console (`javascript_tool`):
```js
await loadDemoTrack({});
```
Then for each of `"tunnelDrift"`, `"vortexSpin"`, `"mazeWalker"`, apply the preset the same way
the app's own preset-picker click handler does — `applyPreset(p)` (`elastic-morph.html:11005`)
takes the preset object directly and sets `S.preset = p`:
```js
applyPreset(PRESETS.find(p => p.id === "tunnelDrift"));
```
Confirm `S.preset.engine` reflects the expected engine id (`"tunnelCorridor"`) after each apply.

- [ ] **Step 3: Confirm each new engine renders distinct, non-blank, audio-reactive content**

With playback running (`S.playing = true; if (typeof play === 'function') play();`), for each of
the 3 presets: wait ~1s, screenshot, and confirm:
- **Tunnel Drift**: angular (rectangular) frames visibly flying toward the viewer.
- **Vortex Spin**: round, twisting rings — confirm real rotation by comparing two screenshots ~2s
  apart (the twist angle should visibly differ, not just the ring positions).
- **Maze Walker**: an overhead wall-grid pattern, walls varying in brightness (not a uniform flat
  grid).

Check the browser console for errors after each. If a screenshot renders unexpectedly dark/blank
in this Browser pane (a known intermittent tooling quirk from earlier rounds today — see project
memory `project_morph_shader_engine_portal_crystal_hypercube.md`), fall back to sampling the
canvas directly instead of trusting the screenshot:
```js
(() => {
  const c = document.getElementById('canvas');
  const tmp = document.createElement('canvas');
  tmp.width = 200; tmp.height = 113;
  tmp.getContext('2d').drawImage(c, 0, 0, 200, 113);
  const data = tmp.getContext('2d').getImageData(0, 0, 200, 113).data;
  let sum = 0; for (let i = 0; i < data.length; i += 4) sum += (data[i]+data[i+1]+data[i+2])/3;
  return { avgBrightness: sum / (data.length/4) };
})()
```
A non-trivial `avgBrightness` (not near 0) confirms real content is rendering even if the
screenshot capture itself looked wrong.

- [ ] **Step 4: Confirm Maze Grid regenerates its cached layout per seed**

`S.seed` (`elastic-morph.html:3112`, set once from the loaded track's audio fingerprint hash — a
single global value, not a per-preset "reroll" feature) is what `drawMazeGrid`'s `seed` parameter
receives. Apply `mazeWalker`, wait ~1s, note `mazeSeed`'s value in the console, screenshot (or
pixel-sample per Step 3's fallback). Then directly change the seed:
```js
S.seed = S.seed + 37;
```
Wait ~1s and confirm `mazeSeed` changed to match the new `S.seed`, and that the rendered wall
pattern visibly differs from the first screenshot/sample (confirms the cache-invalidation
condition in `drawMazeGrid` actually regenerates the layout rather than reusing a stale one).

- [ ] **Step 5: Confirm the mini-preview thumbnails match**

The preset picker panel is `#presetGrid` (`elastic-morph.html:1421`), populated by
`renderPreviews()`. Screenshot this panel (scroll to the "Look" section of the Creator UI if it's
not already visible) and confirm the 3 new presets' thumbnails (`tunnelDrift`/`vortexSpin`/
`mazeWalker`) show a simplified but recognizable version of each live engine (angular frames /
twisting rings / maze grid) rather than a blank or wrong preview.

- [ ] **Step 6: Confirm existing engines are unaffected**

Spot-check at least 2 pre-existing presets whose engines sit near the new insertion points in the
dispatch/preview chains — one using `engine: "fluid"` (immediately before the new dispatch
branches) and one using `engine: "vu"` or `engine: "dance"` (immediately before/after the new
mini-preview branches) — confirm both still render correctly, matching their appearance before
this round.

- [ ] **Step 7: Check console for errors, then clean up and push**

```bash
pkill -f "serve -l 3465"
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
