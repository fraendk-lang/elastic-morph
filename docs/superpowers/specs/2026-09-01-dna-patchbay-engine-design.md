# DNA Visual — Modular Patch (Patchbay Engine): Design Spec

**Status:** Approved by Frank (scoped via 2 questions, both "empfohlen"/recommended options)
**Date:** 2026-09-01

## Goal

A new DNA visual engine for Bank 2 ("Rhythm") — a modular-synth patch bay: jack sockets connected
by pulsing cables. Frank asked for visuals "die wir noch nicht im Ansatz haben" — the existing
mechanical/device roster (Vinyl, Tape, Cassette, Equalizer, Sequencer, RadioTuner, VuWall,
TacticalHud, WaveformMonitor) is entirely meters/dials/reels/scopes; a patch bay is a genuinely
different visual metaphor (jacks + cables, not needles/LEDs).

## Context

*Line numbers are as of this spec's writing (2026-09-01) — re-confirm with a fresh `grep -n`
immediately before editing.*

Every DNA engine follows the same 4-piece template, confirmed by reading `drawEqualizer`
(`elastic-morph.html:4519`) and `drawSequencer` (`elastic-morph.html:4569`+) plus their dispatch/
preview/preset wiring:

1. A draw function `function drawX(base, hue, growthF, energySize, seed)` — called with the
   canvas already translated to center; reads `currentDNA()` for palette (`P.sat` etc.), `S.bands.*`
   for frequency-band signals, `S.kickOnset`/`S.snareOnset` for percussive hits, uses
   `ctx.globalCompositeOperation = "lighter"` for additive glow after an opaque panel background.
2. One dispatch line in `drawScene()`'s `dnaEngine === "..."` if/else chain
   (`elastic-morph.html:5722`+), inserted right before the final bare `else` (the generic organic
   blob fallback).
3. A lightweight re-implementation in `renderPreviews()`'s parallel `p.engine === "..."` chain
   (`elastic-morph.html:7257`+, the `mazeGrid`/`dance` branches around line 7414-7431 are the
   most recent precedent) — a separate, simpler draw using the mini-preview context `c`/`R`/`hue`/
   `p.sat`/`t` (a local animation-loop time, not live audio) and `pv.seed`.
4. One `PRESETS` entry with `bank: "rhythm"` and `engine: "..."`.

**Established stable-but-varied pattern**: engines with a non-trivial internal topology (like
Sequencer's per-track drum pattern) derive it once per track from a deterministic hash of `seed`
(`fract1(Math.sin((seed+1)*12.9898 + ...) * 43758.5453)`, the same formula reused throughout this
codebase), cached in a module-level variable keyed by `seed` so it's stable for the whole track but
varies between tracks/presets. This spec's cable wiring uses the identical technique.

## Design

**Layout**: 10 jacks in two rows of 5 (like a real Eurorack module row), 5 cables. Each cable's
two endpoints are chosen once per track via the seeded-hash formula above (cached until `seed`
changes) — a different, but stable, "wiring" per song.

**Rendering**: each cable is a `quadraticCurveTo` bézier arcing away from its row (a gentle sag,
like a real patch cable), colored by a hue offset per cable index, brightness/glow driven by one
frequency band per cable (`S.bands.subBass`/`bass`/`lowMid`/`mid`/`highMid`, cycling by cable
index) plus `S.kickOnset`/`S.snareOnset` added to the first two cables specifically for a kick/
snare "throb". Each jack is a small ring that brightens to the loudest signal of any cable
touching it — a jack lighting up reads as "this socket is carrying current," reinforcing the
patch-cable metaphor.

**New preset**: "Modular Patch", green/teal palette (`hue: 140`). Checked all 9 existing Bank 2
hues before picking this — amber/orange/red (0–45°) is already heavily used (tripHopScope,
boomBapSeq, lofiTuner, boomBapVinyl, vuClub — 5 of 9 presets), magenta/pink (300–350°) twice
(kaleidoHouse, eqHouse), cyan/purple twice (tacticalHud, deepHouseBlob) — green/teal is the one
hue family Bank 2 doesn't have at all yet, genuinely adding variety rather than a 6th warm preset.

## Exact Code

### A) New draw function, inserted after `drawMazeGrid` (`elastic-morph.html:4915`+, right before
the next top-level function)

```js
let patchTopology = null, patchSeed = null;
function buildPatchTopology(seed) {
  const jacks = 10, cables = 5;
  const conns = [];
  for (let c = 0; c < cables; c++) {
    const a = Math.floor(fract1(Math.sin((seed + 1) * 12.9898 + c * 47.31) * 43758.5453) * jacks);
    let b = Math.floor(fract1(Math.sin((seed + 1) * 33.13 + c * 91.71) * 43758.5453) * jacks);
    if (b === a) b = (b + 1) % jacks;
    conns.push([a, b]);
  }
  return conns;
}
function drawPatchbay(base, hue, growthF, energySize, seed) {
  const P = currentDNA(), mn = Math.min(canvas.width, canvas.height);
  if (patchSeed !== seed) { patchTopology = buildPatchTopology(seed); patchSeed = seed; }
  const jacks = 10, perRow = 5;
  const w = mn * 0.62 * (0.9 + growthF * 0.15), h = mn * 0.34;
  const jackPos = [];
  for (let i = 0; i < jacks; i++) {
    const row = i < perRow ? 0 : 1, col = i % perRow;
    const x = -w / 2 + (col + 0.5) * (w / perRow);
    const y = row === 0 ? -h / 2 : h / 2;
    jackPos.push([x, y]);
  }
  const sig = [S.bands.subBass, S.bands.bass, S.bands.lowMid, S.bands.mid, S.bands.highMid];
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#0c0c10";
  ctx.fillRect(-w / 2 - mn * 0.03, -h / 2 - mn * 0.04, w + mn * 0.06, h + mn * 0.08);
  ctx.globalCompositeOperation = "lighter";
  const jackHeat = new Array(jacks).fill(0);
  patchTopology.forEach(([a, b], i) => {
    const kick = i === 0 ? S.kickOnset * 0.5 : 0;
    const snare = i === 1 ? S.snareOnset * 0.5 : 0;
    const v = Math.max(0, Math.min(1, sig[i % sig.length] + kick + snare));
    jackHeat[a] = Math.max(jackHeat[a], v);
    jackHeat[b] = Math.max(jackHeat[b], v);
    const [x1, y1] = jackPos[a], [x2, y2] = jackPos[b];
    const midY = (y1 + y2) / 2 + Math.sign(y1) * mn * 0.05 * (0.4 + v * 0.6);
    ctx.strokeStyle = `hsla(${(hue + i * 30) % 360},${P.sat}%,${58 + v * 20}%,${0.35 + v * 0.55})`;
    ctx.lineWidth = Math.max(1.2, mn * 0.004) * (1 + v * 0.8);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2, midY, x2, y2);
    ctx.stroke();
  });
  for (let i = 0; i < jacks; i++) {
    const [x, y] = jackPos[i], v = jackHeat[i];
    ctx.fillStyle = "rgba(20,20,26,1)";
    ctx.beginPath(); ctx.arc(x, y, mn * 0.014, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `hsla(${hue % 360},${P.sat}%,${60 + v * 25}%,${0.5 + v * 0.5})`;
    ctx.lineWidth = Math.max(1, mn * 0.003);
    ctx.beginPath(); ctx.arc(x, y, mn * (0.014 + v * 0.01), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
```

### B) Dispatch line in `drawScene()` (`elastic-morph.html:5765-5767`)

Find:
```js
  } else if (dnaEngine === "mazeGrid") {
    drawMazeGrid(base, hue, growthF, energySize, seed);
  } else {
```
Replace:
```js
  } else if (dnaEngine === "mazeGrid") {
    drawMazeGrid(base, hue, growthF, energySize, seed);
  } else if (dnaEngine === "patchbay") {
    drawPatchbay(base, hue, growthF, energySize, seed);
  } else {
```

### C) Mini-preview branch in `renderPreviews()`, inserted after the `mazeGrid` branch and before
the `dance` branch (`elastic-morph.html:~7430`)

Find:
```js
    } else if (p.engine === "dance") {
```
Replace:
```js
    } else if (p.engine === "patchbay") {
      const jacks = 10, perRow = 5, w = R * 1.7, h = R * 0.9;
      const jackPos = [];
      for (let i = 0; i < jacks; i++) {
        const row = i < perRow ? 0 : 1, col = i % perRow;
        jackPos.push([-w / 2 + (col + 0.5) * (w / perRow), row === 0 ? -h / 2 : h / 2]);
      }
      for (let i = 0; i < 5; i++) {
        const a = Math.floor(fract1(Math.sin((pv.seed + 1) * 12.9898 + i * 47.31) * 43758.5453) * jacks);
        let b = Math.floor(fract1(Math.sin((pv.seed + 1) * 33.13 + i * 91.71) * 43758.5453) * jacks);
        if (b === a) b = (b + 1) % jacks;
        const v = 0.4 + 0.4 * Math.sin(t * 2 + i * 1.3);
        const [x1, y1] = jackPos[a], [x2, y2] = jackPos[b];
        const midY = (y1 + y2) / 2 + Math.sign(y1) * R * 0.12;
        c.strokeStyle = `hsla(${(hue + i * 30) % 360},${p.sat}%,65%,${0.35 + v * 0.4})`;
        c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2, midY, x2, y2); c.stroke();
      }
      for (let i = 0; i < jacks; i++) {
        const [x, y] = jackPos[i];
        c.fillStyle = "rgba(20,20,26,1)"; c.beginPath(); c.arc(x, y, R * 0.05, 0, 6.2832); c.fill();
        c.strokeStyle = `hsla(${hue % 360},${p.sat}%,65%,0.6)`; c.lineWidth = 1; c.beginPath(); c.arc(x, y, R * 0.05, 0, 6.2832); c.stroke();
      }
    } else if (p.engine === "dance") {
```

### D) New `PRESETS` entry, appended right after `vuClub` — the last `bank: "rhythm"` preset
(`elastic-morph.html:2594-2603`)

Find:
```js
    id: "vuClub", name: "Club VU Wall", bank: "rhythm",
    desc: "Sechs VU-Nadelmeter in heißem Rot/Orange, grobkörnig — Club-Mixer-Ästhetik. House, Techno, Club.",
    hue: 350, hueEnd: 20, sat: 85, bgFade: 0.5,
    layers: 1, points: 0, noiseAmp: 0, speed: 0.4,
    particles: 0, particleStyle: "spark", symmetry: 1,
    verticalStretch: 1.0, grain: 0.35, lineMode: false, petals: 0, glass: false,
    motion: "orbit", flowBias: 0, constellation: false, bloom: 0.4, waveRing: false,
    engine: "vu",
    gradient: ["#1c0604", "#5a1810", "#ff8a4b"]
  },
```
Replace:
```js
    id: "vuClub", name: "Club VU Wall", bank: "rhythm",
    desc: "Sechs VU-Nadelmeter in heißem Rot/Orange, grobkörnig — Club-Mixer-Ästhetik. House, Techno, Club.",
    hue: 350, hueEnd: 20, sat: 85, bgFade: 0.5,
    layers: 1, points: 0, noiseAmp: 0, speed: 0.4,
    particles: 0, particleStyle: "spark", symmetry: 1,
    verticalStretch: 1.0, grain: 0.35, lineMode: false, petals: 0, glass: false,
    motion: "orbit", flowBias: 0, constellation: false, bloom: 0.4, waveRing: false,
    engine: "vu",
    gradient: ["#1c0604", "#5a1810", "#ff8a4b"]
  },
  {
    id: "modularPatch", name: "Modular Patch", bank: "rhythm",
    desc: "Steckfeld mit pulsierenden Kabelverbindungen — analoge Studio-Optik. Deep House, Modular Techno.",
    hue: 140, hueEnd: 165, sat: 70, bgFade: 0.4,
    layers: 1, points: 0, noiseAmp: 0, speed: 0.4,
    particles: 0, particleStyle: "spark", symmetry: 1,
    verticalStretch: 1.0, grain: 0.3, lineMode: false, petals: 0, glass: false,
    motion: "orbit", flowBias: 0, constellation: false, bloom: 0.4, waveRing: false,
    engine: "patchbay",
    gradient: ["#04140c", "#0d3a2c", "#5affc0"]
  },
```

## Non-Goals

- **No new UI controls** — the engine is fully preset-driven like every other mechanical engine
  (no dedicated slider/toggle panel).
- **No changes to any existing engine or preset** — purely additive.
- **Jack/cable count is fixed** (10 jacks, 5 cables) — not user-configurable this round, matching
  Sequencer's fixed 16-step/4-row grid precedent.

## Testing

Following this session's established `test.js` pattern for new DNA engines (structural
`extractFn`/`.includes()` checks against the assembled `script`):

- `drawPatchbay` and `buildPatchTopology` are both defined.
- `drawScene`'s dispatch chain contains `dnaEngine === "patchbay"` calling `drawPatchbay(...)`,
  positioned after the `mazeGrid` branch and before the final bare `else`.
- `renderPreviews`'s chain contains `p.engine === "patchbay"`, positioned between the `mazeGrid`
  and `dance` branches.
- `PRESETS` contains exactly one entry with `id: "modularPatch"`, `bank: "rhythm"`, and
  `engine: "patchbay"`.
- A genuine behavioral check on `buildPatchTopology(seed)` (via `loadFns`, no mocking needed — it
  only reads its own `seed` argument and calls the pure `fract1`/`Math.sin` primitives already in
  scope): for a fixed seed, returns exactly 5 `[a, b]` pairs, every `a`/`b` is an integer in
  `[0, 9]`, and no pair has `a === b` (the self-loop guard). Also confirm calling it twice with the
  *same* seed produces identical output (deterministic), and with two *different* seeds produces
  at least one different pair (varies per track).

## Live Verification

Select the "Modular Patch" preset (Bank 2 → Rhythm tab), confirm the patch bay renders with 10
jacks and 5 curved cables, confirm cable brightness responds to forced `S.bands.*`/`S.kickOnset`/
`S.snareOnset` values, confirm jacks visibly brighten in sync with their connected cables. Confirm
the preset grid's mini-preview thumbnail also renders the patchbay look (not a blank/fallback
shape). Confirm switching tracks (different `seed`) visibly rewires the cables.
