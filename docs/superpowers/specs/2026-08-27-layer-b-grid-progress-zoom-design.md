# Layer B — New Grid Types + Progress Zoom — Design Spec

**Status:** Approved by Frank in sections.

## Problem

Frank's "Alpha Milestone" backlog (see project memory `project_morph_alpha_milestone.md`) named
three creative directions for expanding Morph's visual variety: more DNA engines, more Shader
Engine styles, and more Layer B effects — the last one explicitly flagged as "wichtig"
(important), specifically wanting movement and zoom, alternating far/near, and visuals that
"expand over the course of" a song. This is the first of those three sub-projects, chosen to go
first because it's architecturally the most novel (the progression-driven zoom idea has no
existing analog in this codebase) and the one Frank called most important.

**Confirmed scope:** Layer B (`S.layerB`, `drawLayerB()`, `elastic-morph.html:6092`) is a
self-contained second visual layer — 16 existing geometric/spectral generator types (Spectrum
Ring, Grid Pulse, Tunnel, Waveform, Starfield, Lissajous, Spectrum Bars, Light Rays, Grid Wave,
Spiral, Radial Waveform, Constellation, Pulse Rings, DNA Helix, Hex Grid, Orbits), each a `case`
in one `switch (LB.type)` block, composited over everything with its own blend mode and opacity.
This spec adds 3 new types to that same switch, and one new global modulation that multiplies into
the scale factor (`sc`) every type already reads — nothing outside `drawLayerB` and its
surrounding UI/serialization plumbing needs to change. Does not touch DNA engines, Shader Engine,
or any other part of the app.

## Locked decisions

- **Three new Layer B types, all in this one round:** Iso-Grid (drifting isometric diamond
  lattice), Voronoi (14 fixed audio-reactive cells with irregular boundaries), Moiré (two
  overlapping fine line-grids at a slowly oscillating angle offset, producing a genuine optical
  interference pattern). Each follows the exact same pattern every existing type already uses — a
  `case` in the switch, an entry in `LAYERB_TYPES` — no new architecture per-type.
- **Progress Zoom is a global modulation**, computed once (a scale multiplier) and folded into the
  existing `sc` variable — so it automatically reaches every case that already reads `sc` for
  sizing, with no per-type wiring. In practice that's 18 of the 19 types (consistent with how
  `scale`/`scaleLfo`/`pulse` already work today). **Correction, added post-implementation:** the
  new Voronoi type does not read `sc` at all — its 40×~23 coarse grid is a fixed screen-space
  resolution, deliberately independent of zoom so its cell layout never reflows (see the
  determinism decision below). Progress Zoom (and the pre-existing Scale/Scale LFO controls) have
  no visible effect on Voronoi. Confirmed acceptable with Frank rather than retrofitting a
  zoom-camera transform onto Voronoi, which would risk fighting the "stable, non-jittering layout"
  decision below.
- **Driven by `S.phase`** (the song-structure label: "Birth"/"Grow"/"Tension"/"Break"/"Return"/
  "Fade", already computed every frame — live and during HQ export — via `segmentAt(S.progress)`),
  not by raw `S.progress` linearly. Confirmed with Frank: phase-coupling produces a "close → far →
  close" arc that satisfies both his "mal fern dann nah" (alternates) and "erweitert sich im
  Verlauf" (builds toward a climax) descriptions in one mechanism, and feels more musically
  intentional than a flat linear zoom-out.
- **Phase → target-scale mapping** (confirmed with Frank):
  ```
  Birth: 0.75   Grow: 0.9   Tension: 1.15   Break: 1.35   Return: 0.95   Fade: 0.7
  ```
  (values below 1 = zoomed in/close, above 1 = zoomed out/far — matches the existing `scale`
  field's own convention, where 1 is neutral.)
- **Smoothed, not a hard jump.** When the song crosses a phase boundary, the effective target
  scale eases toward the new phase's value over roughly 2-3 seconds (an exponential approach, `dt`-
  driven so it stays deterministic during HQ export — same pattern as `LB._spin`/`LB._hue`/
  `LB._opPhase`/`LB._scPhase`, the existing continuous accumulators in `drawLayerB`).
  A hard cut would look like a glitch, not an intentional "breathing" motion.
  Frank confirmed the ~2-3s range is fine without more precision.
- **One "Progress Zoom" intensity slider, default OFF (0).** Matches the `opLfo.depth`/
  `scaleLfo.depth` pattern already in the UI (a single 0-100 slider, no separate on/off checkbox —
  depth/amount 0 is already "off"). Default 0 so no existing saved preset or share-link changes
  its look — the exact same reasoning already used for `S.dnaBlend` and every other additive
  modulation shipped this session. At amount 0, the smoothed phase-target is computed every frame
  as always (cheap) but has zero effect on `sc`; at amount 1, `sc` fully reflects the phase-target
  table above.
- **Voronoi's 14 seed points are fixed and deterministic** — computed once per `S.layerB` object
  lifetime via a golden-ratio low-discrepancy sequence (no `Math.random()`), cached on
  `S.layerB._vSeeds`. Deterministic so HQ export renders identically to live playback (the
  established constraint for anything reactive in this codebase), and stable so the cell layout
  doesn't jitter/reshuffle every frame.

## New Layer B types

Current end of the `switch (LB.type)` block in `drawLayerB` (`elastic-morph.html`, search
`case "orbits"` — it's the last case) stays exactly as-is; the three new cases are added
immediately after it, before the switch's closing `}`. All three use the same locals already in
scope at that point in `drawLayerB`: `cx`, `cy`, `mn` (= `Math.min(W,H)`), `sc` (scale factor,
already computed earlier in the function), `colr(t, alpha)` (the existing color-mapping helper),
plus the standard reactive signals `S.time`, `S.beat`, `S.bass`, `S.mids`, and `specAt(i, n)`
(spectrum-bin sampler, already used by every existing type).

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

`LAYERB_TYPES` (`elastic-morph.html:6044-6060`) gets three new entries appended after `["orbits",
"Orbits"]`:
```js
  ["isoGrid",  "Iso-Grid"],
  ["voronoi",  "Voronoi"],
  ["moire",    "Moiré"]
```
This single array drives three consumers automatically — the `<select id="lbType">` options list
(`elastic-morph.html:8052`), the Auto-VJ random pool (`elastic-morph.html:6068`, and since the new
types are NOT added to `LAYERB_GENERIC`, they automatically get picked twice as often as the
"classic clichés," matching the existing v113 behavior for other distinctive types), and the
arrow-key type-cycle feature (`elastic-morph.html:11099`). No changes needed to any of those three
call sites.

## Progress Zoom

New accumulator field on `S.layerB`'s default object (`elastic-morph.html:2869-2872`), added
alongside the existing `_spin`/`_hue`/`_opPhase`/`_scPhase` transient fields:
```js
  layerB: { on: false, type: "spectrumRing", opacity: 0.8, blend: "lighter", color: "dna", scale: 1,
            pulse: 1, spin: 0, sway: 1, hueDrift: 0, mirror: "off", _spin: 0, _hue: 0,   // v43: modulation
            opLfo: { rate: 0.3, depth: 0, shape: "sine" }, scaleLfo: { rate: 0.3, depth: 0, shape: "sine" },
            _opPhase: 0, _scPhase: 0, progressZoomAmt: 0, _progZoom: 1 },
```
(`progressZoomAmt` is the persisted 0..1 intensity slider value; `_progZoom` is the transient
smoothed-target accumulator, excluded from serialization exactly like the other underscore-
prefixed fields.)

New lookup table, placed directly above `drawLayerB` (`elastic-morph.html:6092`):
```js
const LAYERB_PHASE_ZOOM = { Birth: 0.75, Grow: 0.9, Tension: 1.15, Break: 1.35, Return: 0.95, Fade: 0.7 };
```

Inside `drawLayerB`, the existing continuous-accumulator block (currently, `elastic-morph.html`,
search `LB._spin = (LB._spin || 0) + dt * LB.spin * 1.4;` — four lines inside `if (!S.frozen) {
... }`) gains one more line:
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
(`dt / 2.5` gives a ~2.5s exponential time constant — within the confirmed 2-3s range — and stays
`dt`-driven so it's identically deterministic live and during HQ export, matching every other
accumulator in this function.)

The existing scale computation (currently `const sc = LB.scale * (1 + LB.scaleLfo.depth *
lfoWave(LB.scaleLfo.shape, LB._scPhase || 0));`) gains one more multiplicative term:
```js
  const sc = LB.scale * (1 + LB.scaleLfo.depth * lfoWave(LB.scaleLfo.shape, LB._scPhase || 0))
             * (1 + ((LB._progZoom || 1) - 1) * LB.progressZoomAmt);
```
At `progressZoomAmt = 0` this multiplies by exactly `1` every frame — zero behavior change,
matching the "off by default" decision above.

## UI

New slider in the "Layer B Modulation" panel (`elastic-morph.html`, right before the existing
`<select id="lbMirror">` at line ~1989), matching the exact markup style of the adjacent Scale LFO
Depth slider:
```html
    <div class="slider-row">
      <label>Progress Zoom <span class="val" id="lbProgZoomVal">0</span></label>
      <input type="range" id="lbProgZoom" min="0" max="100" value="0">
    </div>
```
Wiring (`elastic-morph.html`, alongside the existing `$("lbScLfoDepth").addEventListener(...)`
line):
```js
  $("lbProgZoom").addEventListener("input", e => { S.layerB.progressZoomAmt = e.target.value / 100; $("lbProgZoomVal").textContent = e.target.value; });
```
And the corresponding UI-sync-on-load line (alongside the existing `$("lbScLfoDepth").value = ...`
lines):
```js
  $("lbProgZoom").value = Math.round(S.layerB.progressZoomAmt * 100);
  $("lbProgZoomVal").textContent = Math.round(S.layerB.progressZoomAmt * 100);
```

## Serialization

`projectData()`'s Layer B export (`elastic-morph.html:7682`, currently `layerB: (() => { const {
_spin, _hue, _opPhase, _scPhase, ...rest } = S.layerB; return rest; })()`) gets `_progZoom` and
`_vSeeds` added to the destructured exclusion list, so neither transient field is ever written
into a saved preset or share link:
```js
    layerB: (() => { const { _spin, _hue, _opPhase, _scPhase, _progZoom, _vSeeds, ...rest } = S.layerB; return rest; })(),
```
`progressZoomAmt` is a plain persisted field (not destructured out), so it round-trips through
save/load automatically via the existing `Object.assign(S.layerB, lb)` — the load path
(`elastic-morph.html:7898-7905`) gets one more explicit clamped-default line, matching the
existing pattern for `pulse`/`spin`/`sway`/`hueDrift`:
```js
  S.layerB.progressZoomAmt = lb.progressZoomAmt != null ? clamp01(+lb.progressZoomAmt) : 0;
```

## What's explicitly deferred

- No per-type override of the phase-zoom target table — it's one global mapping for all 19 types,
  not configurable per-type. If a specific type ever looks wrong with a particular phase's target
  scale, that's a future refinement, not part of this round.
- No UI control for the phase→scale mapping values themselves (the six numbers in
  `LAYERB_PHASE_ZOOM`) — they're a fixed constant, not exposed as sliders. Confirmed acceptable
  with Frank; revisit only if he wants to tune them after trying it live.
- Shader Engine and DNA-engine expansion (the other two Alpha-Milestone sub-projects) are
  explicitly out of scope for this spec — separate specs, separate rounds.
- No changes to the Auto-VJ pool weighting logic itself, or to the arrow-key-cycle mechanism —
  both already generically consume `LAYERB_TYPES`, so the three new entries flow through with zero
  code changes to either consumer, as noted above.

## Verification plan (to run once implemented)

- `npm run ci` green, with tests for: `LAYERB_TYPES` containing the three new entries;
  structural confirmation that `drawLayerB`'s switch includes all three new `case` blocks; the
  `_progZoom` accumulator update and the `sc` computation's new multiplicative term (structural,
  matching this codebase's established style for canvas-heavy code); `projectData()`'s Layer B
  export excluding both `_progZoom` and `_vSeeds`; the load path's `progressZoomAmt` clamped-
  default line.
- Live in-browser: enable Layer B, cycle through all three new types via the dropdown and confirm
  each renders visibly distinct, audio-reactive content (not blank/black) with a real track
  playing; set Progress Zoom to a non-zero amount and scrub/seek across a full song to visually
  confirm the smooth breathing motion (close at Birth/Fade, far at Break) on at least one existing
  type and one new type; confirm Progress Zoom at 0 produces no visible change versus before this
  round (a quick before/after screenshot comparison on an existing type/preset); confirm a
  round-trip through save-project → reload restores `progressZoomAmt` correctly and that neither
  `_progZoom` nor `_vSeeds` appears in the exported JSON.
- Confirm `npm run ci` and `git diff --stat elastic-morph.html` stay clean per the standard
  build-pipeline-gotcha check.
