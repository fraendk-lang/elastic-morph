# FX Rack II — Pulse Zoom (replaces Triangulate on Ctrl+9): Design Spec

**Status:** Approved by Frank ("passt")
**Date:** 2026-08-29

## Goal

Replace **Triangulate** (Ctrl+9, FX Rack II — Geometry) with **Pulse Zoom**, a genuinely
audio-reactive breathing-scale effect. Frank identified Triangulate as the one effect in this
10-effect rack with zero music-modulation — every one of its 9 siblings reacts to some audio
signal (rotation speed, streak amount, band offset, dot density...), but Triangulate is a purely
static low-poly decimation filter.

## Context

FX Rack II ("Geometry", Ctrl+1–0) is a fixed 10-entry array, `FX2_DEFS`
(`elastic-morph.html:7900-7911`), mapped 1:1 to Ctrl+1..Ctrl+0 by array index (confirmed in the
keydown handler, `elastic-morph.html:9553-9560`: `idx = e.key === "0" ? 9 : +e.key - 1;
FX2_DEFS[idx]`). Ctrl+9 is index 8 — currently `["triangulate", "Triangulate", "low-poly
facets"]`. The UI chips (`#fx2Chips`) are populated purely from this array
(`elastic-morph.html:7913-7926`-equivalent for rack II), so no HTML markup changes are needed —
only the array entry and the effect's own implementation block.

Every FX2 effect lives as an `if (fx.<key>) { ... }` block inside `applyPostFX2(W, H, dt)`
(`elastic-morph.html:7007`+). The established shape: call `snapshot(W, H)` (captures the current
frame into an offscreen `fxC` canvas), then redraw transformed copies back via
`ctx.drawImage(fxC, ...)`, coupling some transform parameter to an audio signal. "Spin"
(`elastic-morph.html:7105-7116`) is the closest sibling to what Pulse Zoom needs — a single
persistent accumulator (`S.fx2Spin`) driving a continuous transform, `S.mids`/`S.beat`-coupled —
Pulse Zoom reuses that exact shape with a new accumulator (`S.fx2Breath`) driving scale instead
of rotation.

Three other places reference `"triangulate"` by name and must be updated in the same edit: the
`S.fx2` default state object (`elastic-morph.html:2905-2906`, where the new `S.fx2Breath`
accumulator also gets added, alongside the existing `S.fx2Spin`), and Auto-VJ's `safe2` array
(`elastic-morph.html:10088`) — the pool of FX2 effects Auto-VJ randomly enables; it must swap in
`pulsezoom` so Auto-VJ continues to have 8 safe options instead of losing one. The old v21
changelog comment (`elastic-morph.html:9985-9986`) documenting FX Rack II's original 2026-08-xx
addition is a historical record and is NOT edited — matching this session's established
convention of adding a fresh inline comment at the new code site rather than rewriting old
changelog entries.

## Design

**Mechanism.** A smooth sine "breath" cycle (`S.fx2Breath`, a persistent phase accumulator like
`S.fx2Spin`) advances at a rate driven by `S.mids` — faster during busier passages, slower during
sparse ones. Its sine value scales the whole frame in and out around 1.0, with amplitude driven
by overall loudness (a quiet section breathes gently, a loud section breathes more). On top of
that continuous breath, a beat/transient "kick" adds a brief extra zoom-in — the same additive
"continuous base motion + percussive kick" shape already used by other FX2 effects (e.g. Slice
Shear's bass-driven amplitude, Radial Blur's beat+transient-driven streak amount).

**Scope discipline.** Only Triangulate/Ctrl+9 is touched, per Frank's explicit choice — Mirror
Grid (Ctrl+3) and Halftone (Ctrl+8), the rack's other two non-audio-reactive members, are
deliberately left alone this round.

## Exact Code

*Line numbers below are as of this spec's writing (2026-08-29) — re-confirm with a fresh
`grep -n` immediately before editing.*

### A) `S.fx2` default state + new `S.fx2Breath` accumulator (`elastic-morph.html:2905-2907`)

Find:

```js
  fx2: { hexkaleido: false, droste: false, mirrorgrid: false, echospin: false, radialblur: false,
         slice: false, spin: false, halftone: false, triangulate: false, posterize: false },
  fx2Spin: 0,
```

Replace with:

```js
  fx2: { hexkaleido: false, droste: false, mirrorgrid: false, echospin: false, radialblur: false,
         slice: false, spin: false, halftone: false, pulsezoom: false, posterize: false },
  fx2Spin: 0, fx2Breath: 0,
```

### B) `FX2_DEFS` array entry (`elastic-morph.html:7900-7911`)

Find:

```js
const FX2_DEFS = [
  ["hexkaleido",  "Hex Kaleido",  "6-fold crystal mandala"],
  ["droste",      "Droste Zoom",  "infinite frame-in-frame"],
  ["mirrorgrid",  "Mirror Grid",  "seamless mirrored tiles"],
  ["echospin",    "Echo Spin",    "rotated ghost fan"],
  ["radialblur",  "Radial Blur",  "zoom streaks from center"],
  ["slice",       "Slice Shear",  "sine-shifted bands"],
  ["spin",        "Spin",         "whole frame rotates"],
  ["halftone",    "Halftone",     "dot raster screen"],
  ["triangulate", "Triangulate",  "low-poly facets"],
  ["posterize",   "Posterize",    "banded color crush"]
];
```

Replace with:

```js
const FX2_DEFS = [
  ["hexkaleido",  "Hex Kaleido",  "6-fold crystal mandala"],
  ["droste",      "Droste Zoom",  "infinite frame-in-frame"],
  ["mirrorgrid",  "Mirror Grid",  "seamless mirrored tiles"],
  ["echospin",    "Echo Spin",    "rotated ghost fan"],
  ["radialblur",  "Radial Blur",  "zoom streaks from center"],
  ["slice",       "Slice Shear",  "sine-shifted bands"],
  ["spin",        "Spin",         "whole frame rotates"],
  ["halftone",    "Halftone",     "dot raster screen"],
  ["pulsezoom",   "Pulse Zoom",   "rhythmic breathing scale"],
  ["posterize",   "Posterize",    "banded color crush"]
];
```

(Ctrl+9 keeps index 8 — swapping the array entry in place, not appending, so the key mapping
stays exactly where Frank expects it: Ctrl+9.)

### C) Replace the Triangulate implementation with Pulse Zoom (`elastic-morph.html:7139-7159`)

Find:

```js
  // Triangulate — low-poly facets from a coarse grid
  if (fx.triangulate) {
    const gx = Math.max(10, Math.round(26 * q)), gy = Math.max(2, Math.round(gx * H / W));
    chctx.globalCompositeOperation = "copy"; chctx.globalAlpha = 1; chctx.imageSmoothingEnabled = true;
    chctx.drawImage(canvas, 0, 0, gx, gy);
    const data = chctx.getImageData(0, 0, gx, gy).data;
    const cw = W / (gx - 1), ch = H / (gy - 1);
    const col = (ix, iy) => {
      ix = Math.max(0, Math.min(gx - 1, ix)); iy = Math.max(0, Math.min(gy - 1, iy));
      const o = (iy * gx + ix) * 4; return `rgb(${data[o]},${data[o + 1]},${data[o + 2]})`;
    };
    ctx.save();
    for (let y = 0; y < gy - 1; y++) for (let x = 0; x < gx - 1; x++) {
      const x0 = x * cw, y0 = y * ch, x1 = x0 + cw, y1 = y0 + ch;
      ctx.fillStyle = col(x, y);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x0, y1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col(x + 1, y + 1);
      ctx.beginPath(); ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
```

Replace with:

```js
  // Pulse Zoom — v133: rhythmic breathing scale, replaces the removed Triangulate (Ctrl+9)
  // per Frank's request (Triangulate was the one FX2 effect with zero audio-reactivity).
  // Same accumulator shape as "Spin" above, driving scale instead of rotation.
  if (fx.pulsezoom) {
    snapshot(W, H);
    S.fx2Breath += dt * (0.6 + S.mids * 0.8);
    const breathe = Math.sin(S.fx2Breath) * 0.06 * (0.5 + S.loudness * 0.7);
    const kick = S.beat * 0.09 + S.transient * 0.05;
    const s = 1 + breathe + kick;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.drawImage(fxC, -cx, -cy, W, H);
    ctx.restore();
  }
```

All identifiers used (`snapshot`, `fxC`, `cx`/`cy`/`W`/`H`, `S.mids`/`S.loudness`/`S.beat`/
`S.transient`) are already in scope inside `applyPostFX2` — confirmed by reading the "Spin" block
immediately above, which uses the identical set (`elastic-morph.html:7105-7116`).

### D) Auto-VJ's `safe2` pool (`elastic-morph.html:10088`)

Find:

```js
    const safe2 = ["hexkaleido", "droste", "mirrorgrid", "slice", "spin", "halftone", "triangulate", "posterize"];
```

Replace with:

```js
    const safe2 = ["hexkaleido", "droste", "mirrorgrid", "slice", "spin", "halftone", "pulsezoom", "posterize"];
```

## Non-Goals

- Mirror Grid (Ctrl+3) and Halftone (Ctrl+8) — Frank explicitly scoped this to Triangulate only.
- No new UI markup — `#fx2Chips` is populated purely from `FX2_DEFS`, unchanged mechanism.
- No changes to any other FX Rack (I or III).
- The old v21 changelog comment listing FX Rack II's original effects
  (`elastic-morph.html:9985-9986`) is left as an accurate historical record, not rewritten.

## Testing

Following this session's established `test.js` pattern — structural `extractFn`/`.includes()`
checks against `elastic-morph.html`'s assembled `script` (this code lives entirely pre-marker,
no `src/inject-vNN.js` involvement, so the ordinary default-`script` `extractFn` calls are
correct here, unlike the Particle Mode rounds):

- `FX2_DEFS` no longer contains `"triangulate"` anywhere; contains
  `["pulsezoom", "Pulse Zoom", "rhythmic breathing scale"]` at index 8 (the 9th entry, i.e. still
  mapped to Ctrl+9 — confirm by checking it's the 9th matched array-literal entry, not just
  present anywhere in the array).
- `S.fx2`'s default object contains `pulsezoom: false` and does NOT contain `triangulate: false`.
- `S.fx2Breath: 0` is present alongside the existing `S.fx2Spin: 0`.
- `applyPostFX2`'s extracted source contains `if (fx.pulsezoom) {` and does NOT contain
  `if (fx.triangulate)`.
- The `pulsezoom` block calls `snapshot(W, H)` before its `drawImage` (matches the sibling
  convention — `snapshot` must run first so `fxC` holds the current frame).
- The `pulsezoom` block references `S.mids`, `S.loudness`, `S.beat`, and `S.transient` (confirms
  genuine multi-signal audio-reactivity, addressing the exact complaint that motivated this
  change).
- `safe2` contains `"pulsezoom"` and does not contain `"triangulate"`.
- No other file (`test.js` itself, or any `src/inject-vNN.js`) references `"triangulate"`
  anywhere — confirms the swap is complete, not a partial rename leaving dead references.

## Live Verification Plan

Same established method: set state directly via `javascript_tool` and let the existing `frame()`
render loop redraw — this effect lives entirely in the ordinary always-live pre-marker code path
(no build-pipeline reassignment concern here, unlike the Particle Mode rounds). Enable via
`S.fx2.pulsezoom = true` (or simulate the Ctrl+9 keypress), confirm the frame visibly scales
in/out over a few seconds (pixel-sample or screenshot two frames roughly half a breath-cycle
apart and confirm they differ). Force `S.beat = 1` vs `0` and confirm the kick visibly adds extra
zoom (compare frame scale/size at each). Force `S.mids` high vs low and confirm the breathing
tempo visibly changes (compare the time between two same-phase points in the sine, e.g. via
directly reading `S.fx2Breath`'s rate of change). Confirm Ctrl+9 still toggles the (now correct)
effect via the keyboard shortcut itself, not just direct state manipulation. Confirm Auto-VJ can
still pick 8 safe FX2 effects (spot-check `safe2` no longer errors/shrinks unexpectedly). Confirm
no console errors, and that toggling `pulsezoom` off cleanly stops the scale animation (frame
returns to `s = 1`, no lingering zoom).
