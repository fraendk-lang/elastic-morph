# Layer B — Bead Tentacle: Design Spec

**Status:** Approved by Frank ("passt")
**Date:** 2026-08-29

## Goal

Add a 20th Layer B type, `tentacle` ("Bead Tentacle"): a single glowing bead-chain
that swims across the screen with a snake-like undulation, and visibly
counter-rotates against Layer B's own shared spin/sway motion — the parallax
depth cue Frank picked out from the TAS Visuals reference video
(youtube.com/watch?v=OCSbzk1s-p4). This closes the last item from that video's
brainstorm; the other element (Cosmic Drift, a raymarched nebula) already
shipped 2026-08-27/29 (see `project_morph_shader_cosmic_drift.md`).

## Context

Layer B (`S.layerB`, `drawLayerB(W, H, hue, dt)`, `elastic-morph.html`) currently
has 19 types dispatched through a `switch (LB.type)` (`elastic-morph.html:6446`).
The entire switch runs inside a kaleidoscope mirror-passes loop
(`elastic-morph.html:6437-6772`), which itself runs inside a shared transform
that already rotates/scales/translates the whole layer by a global `baseRot`
(spin + sway + stereo, `elastic-morph.html:6413-6417`) before any per-type
drawing happens. Every existing type inherits that shared rotation uniformly.
This spec adds one new `case` block to that same switch — no shared-code
changes, no new global mechanisms.

Nearest precedents read for style: `constellation` (wandering seeded points,
`elastic-morph.html:6632`), `pulseRings` (expanding ring pool,
`elastic-morph.html:6648`), `helix` (two parametric strands with beaded
cross-rungs, `elastic-morph.html:6664`).

## Design

**Shape & motion.** A single open curve spanning past both screen edges
(`span = mn * 1.5 * sc`, where `mn = Math.min(W, H)`), so it reads as an
endless chain passing through frame rather than a bounded object. Its `y`
offset at each point is the sum of two sines at different frequency/phase —
a fast component for the swimming wiggle, a slow component for a broader
sway — both driven by `S.time`, so the shape is a pure function of time (no
accumulated/random state, matching every other Layer B type's export-safety
requirement). 30 segments (`N = 30`), giving 31 bead nodes.

**The counter-rotation (depth cue).** Every Layer B type already sits inside
the shared `baseRot` rotation applied once, globally, before the mirror loop.
Inside the `tentacle` case specifically, wrap the draw in one extra
`ctx.rotate(-2 * baseRot)` around the same center. This cancels the shared
`+baseRot` the layer already applied and replaces it with `-baseRot` — so
while everything else in Layer B turns one way, the tentacle turns the
other, at the same rate. That is the full mechanism for "entgegengesetzte
Bewegung" — no new rotation state, no new tunable, just a sign flip
composed on top of the existing shared value.

**Beads & glow.** A stroked path connects all points (thin glowing line, like
`helix`'s strands), then a filled+`shadowBlur`-glowing circle is drawn at
each of the 31 points on top (like `helix`'s cross-rung beads / `pulseRings`'
ring glow). `shadowBlur` is reset to 0 after the case (existing convention,
see `grid`/`helix`).

**Audio reactivity.** Beat only, per Frank's selection: each bead's radius
and alpha get a `S.beat`-scaled boost at draw time (same shape as `helix`'s
`0.5 + S.beat*0.3` / `pulseRings`' ring-glow pattern) — no bass/highs coupling
beyond the existing `colr()` hue helper's own `S.highs`-agnostic behavior
(matches the approved scope: beat-pulse only).

**Mirror interaction.** No special-casing. Runs inside the existing
mirror-passes loop identically to every other type: at `mirror: off` it reads
as one coherent chain; under `h`/`v`/`quad`/`hex`/`oct` it becomes multiple
counter-rotating copies, which — per the approved design — only reinforces
the depth read rather than conflicting with it.

**Auto-VJ weighting.** `tentacle` is a new "distinctive" type, so it is
*not* added to `LAYERB_GENERIC` — matching `constellation`/`helix`/`isoGrid`,
this means `pickLayerBType()` already picks it twice as often as the
generic legacy types, with zero additional code (that weighting reads
`LAYERB_GENERIC` at call time, not a fixed list).

## Exact Code

*Line numbers below are as of this spec's writing (2026-08-29). Every prior
round this session has shifted line numbers by dozens to hundreds of lines —
re-confirm both insertion points with a fresh `grep -n` immediately before
editing, per the project's build-pipeline-gotcha memory. Also re-confirm
`@BUILD-INJECT-V58`'s current line first: both touch points below are well
before it, but confirm before editing, not after.*

**1. `LAYERB_TYPES` (`elastic-morph.html:6319`), add as the 20th entry:**

```js
const LAYERB_TYPES = [
  ["spectrumRing", "Spectrum Ring"],
  ["grid",         "Grid Pulse"],
  ["tunnel",       "Tunnel"],
  ["waveform",     "Waveform"],
  ["starfield",    "Starfield"],
  ["lissajous",    "Lissajous"],
  ["bars",         "Spectrum Bars"],
  ["rays",         "Light Rays"],
  ["gridwave",     "Grid Wave"],
  ["spiral",       "Spiral"],
  /* v40: richer overlays */
  ["radialWave",   "Radial Waveform"],
  ["constellation","Constellation"],
  ["pulseRings",   "Pulse Rings"],
  ["helix",        "DNA Helix"],
  ["hexgrid",      "Hex Grid"],
  ["orbits",   "Orbits"],
  ["isoGrid",  "Iso-Grid"],
  ["voronoi",  "Voronoi"],
  ["moire",    "Moiré"],
  ["tentacle", "Bead Tentacle"]
];
```

No other change needed for the UI dropdown — `buildLayerB()`
(`elastic-morph.html:8436`) populates `<select id="lbType">` purely from this
array, and `pickLayerBType()`'s Auto-VJ weighting purely from
`LAYERB_GENERIC` membership (unchanged, `tentacle` correctly excluded by
omission).

**2. New `case` in `drawLayerB`'s switch, inserted after `case "moire"`'s
closing `break; }` and before the switch's closing `}`
(`elastic-morph.html:6769-6770`):**

```js
    case "tentacle": {
      // v129: Bead Tentacle — a single glowing bead-chain that swims across the
      // screen. Counter-rotates against the shared baseRot (-2*baseRot cancels
      // the layer's own +baseRot and replaces it with -baseRot) for the
      // parallax depth cue from the TAS Visuals reference video.
      const N = 30;
      const span = mn * 1.5 * sc;                 // overshoots both edges -> reads as endless
      const amp = mn * 0.14 * sc;
      const t0 = S.time * 0.35;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-2 * baseRot);
      ctx.translate(-cx, -cy);
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const x = cx + (t - 0.5) * span;
        const y = cy
          + Math.sin(t * 5.5 - t0 * 2.2) * amp
          + Math.sin(t * 2.3 + t0 * 1.1) * amp * 0.5;
        pts.push({ x, y, t });
      }
      ctx.lineWidth = Math.max(1.6, mn * 0.005);
      ctx.strokeStyle = colr(0.5, 0.35 + S.highs * 0.15);
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
      for (const p of pts) {
        const pulse = 1 + S.beat * 0.5;
        ctx.fillStyle = colr(p.t, 0.55 + S.beat * 0.35);
        ctx.shadowBlur = 8 + S.beat * 10;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(p.x, p.y, mn * 0.008 * sc * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
      break;
    }
```

All identifiers used (`mn`, `sc`, `cx`, `cy`, `baseRot`, `colr`, `S.time`,
`S.beat`, `S.highs`) are already in scope at this point in `drawLayerB` —
confirmed by reading `elastic-morph.html:6371-6446`.

## Non-Goals (explicitly out of scope for this round)

- **Multiple simultaneous tentacles** — Frank chose one large chain.
- **Physics/follow-the-leader chain simulation** — would need per-frame
  accumulated state (each segment easing toward the previous frame's
  position of its neighbor), breaking the pure-function-of-`S.time`
  determinism every other Layer B type relies on for frame-accurate HQ
  export. The parametric sine-sum approach gets the "swimming" look
  without that risk.
- **Camera-zoom-linked motion** — Frank chose counter-rotation against the
  layer's own spin, not a zoom-coupled effect.
- **Bass/loudness-coupled undulation speed, palette-linked color beyond the
  existing `colr()` helper** — Frank's audio-reactivity selection was beat-
  pulse only.

## Testing

Following this session's established pattern for switch-case Layer B/DNA
additions (see `Layer B — Iso-Grid/Voronoi/Moiré` and
`DNA Engines — Corridor Tunnel/Spiral Vortex/Maze Grid` sections in
`test.js`): structural `extractFn` + `.includes()` checks against
`drawLayerB`'s extracted source, since the logic lives in a `case` block
inside a large function rather than as a standalone unit:

- `LAYERB_TYPES` contains `["tentacle", "Bead Tentacle"]` as its 20th entry.
- The switch has a `case "tentacle":` branch positioned after `case "moire"`
  and before the switch's closing brace.
- The case body contains the counter-rotation line
  (`ctx.rotate(-2 * baseRot)`), confirming the depth-cue mechanism is wired
  and not accidentally using `+baseRot` or omitted.
- The case body contains `S.beat` (confirms beat-reactivity is present) and
  does **not** reference `S.bass` or `S.loudness` in a motion-speed context
  (confirms scope stayed beat-only, not silently expanded).
- The case body contains no `Math.random` (confirms determinism — pure
  function of `S.time`/`dt`, export-safe like every sibling type).
- `LAYERB_GENERIC` does **not** contain `"tentacle"` (confirms it keeps the
  2x Auto-VJ selection weight given to other distinctive types).

## Live Verification Plan

Same methodology as every prior Layer B/Shader round this session: set
`S.layerB.on = true; S.layerB.type = "tentacle"` directly via
`javascript_tool`, let the existing `frame()` render loop redraw (never call
`drawScene`/`drawLayerB` manually — doing so bypasses its real call
signature and can throw, silently freezing the render loop via the sticky
`S._frameErrLogged` guard, as happened once during the Cosmic Drift
final-review verification). Confirm: the chain renders as a distinct,
non-blank, animated shape (pixel-sample or screenshot two frames ~1s apart
and confirm they differ); confirm it visibly counter-rotates relative to a
neighboring type with `LB.spin` forced high (e.g. compare against
`helix` under the same spin value); confirm beat-pulse changes bead
size/alpha (`S.beat = 1` vs `S.beat = 0` pixel-sample comparison); confirm
`mirror` settings other than `off` still render without error; 0 new
console errors.
