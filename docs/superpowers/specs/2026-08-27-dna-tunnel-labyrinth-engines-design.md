# DNA Engines — Corridor Tunnel, Spiral Vortex, Maze Grid — Design Spec

**Status:** Approved by Frank in sections.

## Problem

Third and final "Alpha Milestone" sub-project (see project memory `project_morph_alpha_milestone.md`).
Sub-projects 1 (Layer B) and 2 (Shader Engine) shipped 2026-08-27 (project memory
`project_morph_layer_b_grid_progress_zoom.md`, `project_morph_shader_engine_portal_crystal_hypercube.md`).
Frank's brief for this one: "verschiedene Tunnel- und Labyrinth-Systeme" (different tunnel and
labyrinth systems, plural) for the DNA organism ("Visual DNA," `S.preset`, `drawScene()`) — the
app's central morphing-shape system. No existing DNA engine covers this territory: the current
roster (confirmed by reading the dispatch chain) is `blob` (default), `filament`, `attractor`,
`flame`, `hyperspace`, `reaction`, `dance`, `vinyl`, `tape`, `eq`, `sequencer`, `tuner`, `hud`,
`vu`, `sacred`, `oscilloscope`, `spectrogram`, `flocking`, `typography`, `fluid` — organic and
mechanical/device styles, nothing depth/perspective-based.

**Confirmed scope:** three new DNA engines — **Corridor Tunnel**, **Spiral Vortex**, **Maze
Grid** — added via this codebase's proven 4-piece template (new `drawXxx()` function, one
dispatch line, one `PRESETS` entry, one mini-preview branch). Canvas 2D work, like Layer B, not
GLSL — lower technical risk than the Shader Engine round.

**Naming note (confirmed with Frank isn't needed, just documented):** the word "tunnel" already
exists in two other subsystems shipped this session (a Shader Engine GLSL style, a Layer B
overlay type) — neither is a DNA engine, no literal collision, but the new engine is deliberately
named `tunnelCorridor` (not bare `tunnel`) to avoid three unrelated UI entries all reading
"Tunnel."

## Locked decisions

- **Three separate engines, not one engine with modes.** Confirmed with Frank: Tunnel
  (perspective/depth) and Labyrinth (overhead maze) are different enough visually that combining
  them would make one feel like an afterthought. Matches the "3 per round" size the other two
  Alpha-Milestone sub-projects already established.
- **Corridor Tunnel is angular** (nested rectangles), **Spiral Vortex is round + rotating**
  (twisting octagon rings), **Maze Grid is the literal overhead-maze idea** — three visually
  distinct takes on the same "depth/navigable-space" theme, confirmed with Frank.
- **All three reuse existing infrastructure only** — no new shared helpers beyond what
  `buildSeqPattern`'s established seeded-hash pattern already proves out (`fract1`, already a
  top-level `const` at `elastic-morph.html:3913`; `specAt`, already used by Layer B's
  `drawLayerB`). Confirmed with Frank as a "no new infrastructure" round, consistent with Layer B
  and Shader Engine both reusing their subsystems' existing conventions rather than introducing
  new ones.
- **Maze Grid's wall layout is a per-seed pseudo-random pattern, not a solved/connected maze.**
  Like `buildSeqPattern`'s drum pattern, `buildMazeGrid` generates a deterministic wall grid via
  seeded hashing (no `Math.random()`, so HQ export stays reproducible) with a wall-probability
  tuned to *look* maze-like — no spanning-tree/connectivity-guarantee algorithm. This is a
  reactive visual, not a solvable puzzle; matching the codebase's existing "atmosphere over
  simulated correctness" convention (e.g. `drawSequencer`'s pattern is a plausible-looking beat
  grid, not music-theory-validated).
- **Build-pipeline placement, confirmed by reading the actual file (not assumed):** the 3 new
  draw functions land right after the existing `drawSacred` function (`elastic-morph.html:4723`,
  well before the `@BUILD-INJECT-V58` marker at line 10328) — **not** near `drawFluidLite`
  (`elastic-morph.html:10744`), which turns out to sit *after* the marker (it's a
  `build.js`-injected function from a `src/inject-vNN.js` module, not hand-edited HTML). This
  matters: the dispatch chain, `PRESETS` array, and `renderPreviews()` are all confirmed to be
  entirely pre-marker, so only the draw-function placement needed this extra check.

## Corridor Tunnel (`tunnelCorridor`)

Nested rectangular frames flying toward the viewer, fading out as they approach their maximum
size — the same accelerating-approach technique already shipped in Layer B's Portal Depth (`z*z`
easing), but angular instead of circular so it reads as a distinct effect from every other
tunnel-flavored thing already in the app. **Correction, added post-implementation:** frames fade
to zero alpha as `f` approaches 1 (their max size, `0.68 * mn`), so they dissolve well inside the
viewport rather than literally flying past its edges — a wording inaccuracy the final review
caught; live verification already confirmed the effect reads correctly as a corridor regardless.

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
```

## Spiral Vortex (`spiralVortex`)

Same receding-approach technique, but circular (octagon-approximated) rings whose rotation
increases the closer they get — a twisting vortex, not just motion toward the viewer.

```js
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
```

## Maze Grid (`mazeGrid`)

A wall-grid generated once per preset seed and cached (exact pattern `buildSeqPattern`/
`seqPattern`/`seqSeed` already establishes), rendered as an overhead maze whose walls light up per
frequency band — same per-cell-to-spectrum-band mapping technique Layer B's `grid`/`hexgrid` types
already use.

```js
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

## Wiring (all mechanical, mirrors the existing engine-roster pattern exactly)

**Dispatch chain** (`elastic-morph.html`, inside `drawScene()`'s `if (dnaEngine === ...)` chain —
current last named branch is `fluid`, right before the bare `else` blob fallback):
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
(Only the 3 new branches are inserted between the existing `fluid` branch and the existing bare
`else` — everything else in the chain is unchanged.)

**`PRESETS`** (`elastic-morph.html:2191-2698`) gains 3 new entries, appended after the existing
`fluidlite` entry, following that entry's exact field template (Ambient bank — no `bank:` field,
consistent with most of the existing 19-engine roster):
```js
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
```
(Appended after `fluidlite`'s closing `}` — that entry's own closing `}` gains a trailing comma,
everything before it is untouched.)

**Mini-preview** (`renderPreviews()`, `elastic-morph.html:6989`+, the `if/else-if` chain on
`p.engine` — inserted after the existing `vu` branch, before `dance`, keeping the mechanical/
geometric engines grouped in the chain):
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
(`fract1` is a top-level `const`, already in scope everywhere in this file, including inside
`renderPreviews()` — no import/threading needed. Maze Grid's preview reuses the exact same hash
formula as `buildMazeGrid`, so its 8×6 thumbnail is a genuine maze-like sub-region, consistent
with every other engine's mini-preview technique. **Correction, added post-implementation:** it
does NOT use the live track's actual seed — like every other preview branch, it's keyed on `pv.seed`
(`buildPresets()` assigns each preview card `seed: Math.random() * 10`, re-rolled on page load),
so the thumbnail is a plausible maze, not a preview of *this* track's specific layout. This matches
existing convention exactly and needed no code change — only this spec's original claim was wrong.)

## What's explicitly deferred

- No new shared "tunnel/vortex" helper library — each engine's receding-ring math is duplicated
  (not extracted into a shared function) because the two are similar but not identical (angular
  vs. round, no rotation vs. rotation), and both are short enough that a shared abstraction would
  cost more clarity than it saves. Matches this codebase's general preference for self-contained
  engine functions over cross-engine abstraction (confirmed by reading several existing engines —
  none share helpers beyond the universal `currentDNA()`/`specAt()`/audio-signal utilities).
- Maze Grid's wall density (0.42 threshold) and grid size (12×8) are fixed constants, not exposed
  as preset-tunable fields — matches how `buildSeqPattern`'s density array and step count aren't
  preset-tunable either.
- No connectivity/solvability guarantee for the maze layout (see locked decisions above) — this
  is a reactive visual, not a puzzle generator.

## Verification plan (to run once implemented)

- `npm run ci` green, with tests for: all 3 new draw functions defined; the dispatch chain's 3 new
  branches present in order between `fluid` and the bare `else`; all 3 new `PRESETS` entries with
  correct `id`/`engine` pairs; the 3 new mini-preview branches present; `buildMazeGrid`'s
  determinism (call twice with the same seed, confirm identical wall layouts — pure math, testable
  without canvas mocking, matching the Voronoi-seed-determinism test style from the Layer B round).
- Live in-browser: select each of the 3 new presets from the preset picker with real audio
  playing, confirm each renders visibly distinct, audio-reactive, non-blank content matching its
  intended character (angular flying frames / twisting round rings / glowing overhead maze walls);
  confirm each preset's mini-preview thumbnail in the picker grid looks like a recognizable
  (if simplified) version of the live engine; confirm switching between presets with different
  seeds regenerates Maze Grid's layout (not stuck on the first-generated pattern); confirm no
  console errors.
- Confirm `npm run ci` and `git diff --stat elastic-morph.html` stay clean per the standard
  build-pipeline-gotcha check.
