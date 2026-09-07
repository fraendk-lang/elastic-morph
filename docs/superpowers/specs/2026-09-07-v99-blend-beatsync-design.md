# V99 Image Layer Modes Ignore Blend + Beat-Sync — Design

## Problem

The 5 "V99" Image Layer modes — Parallax Depth, Zoom Pulse, Datamosh
Blocks, Beat Flicker, Tunnel Warp — silently ignore two Image Layer
controls that all other 13 modes respect: the **Blend** dropdown and the
**Beat-Sync (nur auf Drop/Transient)** checkbox.

Found while closing out a backlog item from the 2026-09-06 Image Layer
filter-performance work
(`docs/superpowers/specs/2026-09-06-image-layer-filter-scratch-canvas-design.md`'s
Post-implementation amendment noted only the Blend gap; investigating it
surfaced the Beat-Sync gap too, same root cause).

### Root cause

Three generations of Image Layer modes each wrap the global
`drawImageLayer` function, applied in this init order:
`initImageLayerV67()` → `initImageLayerV68()` → `initDnaAndImageV99()`
(`elastic-morph.html:19081-19083`). Each wrapper captures "the current
`drawImageLayer`" and reassigns the global to a new function that either
handles its own modes or falls through to the captured original:

- **V67's wrapper** (`elastic-morph.html:13344-13362`) dispatches its own
  5 modes to `drawImageLayerV67`, else falls through to the native
  `drawImageLayer`.
- **V68's wrapper** (`elastic-morph.html:13462-13478`) doesn't check mode
  at all — it applies `ctx.globalCompositeOperation = IM.blend` and the
  beat-sync gate (falling back to `drawImageLayerStatic` between beats, or
  scaling `IM.amount` by the gate) around *whatever* `drawImageLayer`
  currently is (at this point: the V67-wrapped version) — so blend/beat-sync
  correctly apply to both classic and V67 modes.
- **V99's wrapper** (`src/inject-v99.js:295-306`, `initImageLayerV99`)
  dispatches its own 5 modes to `drawImageLayerV99` and **returns
  immediately** — bypassing the V68-wrapped chain entirely for those 5
  modes. Blend and beat-sync are simply never applied to V99 modes.

This is the same category of bug as Displace's blend fix from 2026-09-06
(a mode's own rendering path bypassing the shared blend/compositing
machinery) — but at the wrapper level instead of inside a single mode's
draw code.

## Goals

- Parallax, Zoom Pulse, Datamosh, Beat Flicker, and Tunnel Warp start
  honoring the Blend dropdown, matching all other 13 modes.
- Same 5 modes start honoring "Beat-Sync (nur auf Drop/Transient)" —
  holding on `drawImageLayerStatic`'s plain filtered cover-fit between
  beats, and scaling `IM.amount` by the beat gate otherwise — matching all
  other 13 modes' existing behavior.

## Non-Goals

- Not touching `initImageLayerV67`/`initImageLayerV68`/their wrapper code
  — both already work correctly for the modes they're responsible for.
- Not restructuring the 3-generation wrapper-chaining architecture itself
  (e.g. unifying it into one dispatch table) — out of scope; the existing
  pattern of each generation owning a small, self-contained wrapper is how
  this codebase already does things (V67 and V99 already each have their
  own filter-application copy, for example), and a bigger refactor isn't
  warranted just to fix this one gap.
- Not changing anything about how `drawImageLayerV99` itself renders — the
  5 modes' own drawing code is unaffected; only what happens *around* the
  call to it changes.

## Design

`initImageLayerV99`'s wrapper (`src/inject-v99.js:299-306`) gains the same
blend + beat-sync logic V68's wrapper already has, applied specifically
around its own dispatch to `drawImageLayerV99`:

```js
const _drawImageLayer = drawImageLayer;
drawImageLayer = function (IM, W, H, baseHue, dt, opMul) {
  if (IMG_V99_MODES.has(IM.mode)) {
    const blend = IM.blend || "source-over";
    const gate = imageBeatGate(IM, dt);
    ctx.save();
    ctx.globalCompositeOperation = blend;
    if (IM.beatSync && gate < 0.12) {
      drawImageLayerStatic(IM, W, H, baseHue, opMul);
    } else {
      const saved = IM.amount;
      if (IM.beatSync) IM.amount = saved * Math.max(0.18, gate);
      drawImageLayerV99(IM, W, H, baseHue, dt, opMul);
      IM.amount = saved;
    }
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    return;
  }
  _drawImageLayer(IM, W, H, baseHue, dt, opMul);
};
```

`imageBeatGate` (`elastic-morph.html:13397`) and `drawImageLayerStatic`
(`elastic-morph.html:13406`) are both plain native `function` declarations
— already called this same way from V68's own wrapper — and accessible
from `src/inject-v99.js`'s injected code the same way `imageLayerScratchCanvas`
already is (function declarations hoist to script scope regardless of
physical file order; this is the exact same access pattern the 2026-09-06
fix already relies on).

### Why this doesn't conflict with the already-shipped scratch-canvas fix

Parallax/Datamosh/Tunnel Warp's own code already sets/resets
`sctx.globalCompositeOperation` — but always on the *scratch* context, never
on the real `ctx`, so nothing there interferes with the new outer
`ctx.globalCompositeOperation = blend`. Beat Flicker's own code (untouched
by the 2026-09-06 fix, since it's only 1-2 draws/frame) does briefly set
`ctx.globalCompositeOperation = "lighter"` for its beat-flash overlay
before resetting to `"source-over"` — this remains correct: the flash
stays intentionally additive regardless of the user's Blend choice, while
Flicker's *base* draw (before the flash) now correctly honors Blend for
the first time. The outer wrapper's `ctx.restore()` fully resets
compositing state regardless of any of this, exactly as V68's wrapper
already relies on for classic/V67 modes today.

### Testing

Same static-source-assertion style as `test.js`: extract
`initImageLayerV99` and confirm the V99-mode branch now computes `blend`/
`gate`, calls `ctx.save()`, sets `ctx.globalCompositeOperation = blend`,
branches on `IM.beatSync && gate < 0.12` to `drawImageLayerStatic`, else
scales `IM.amount` by the gate before calling `drawImageLayerV99`, restores
`IM.amount`, and ends with `ctx.restore(); ctx.globalCompositeOperation =
"source-over";` before the `return`.

### Manual live-check (after implementation)

1. Select Tunnel Warp (or any of the 5), pick a non-default Blend (e.g.
   "Screen") — confirm it's now visibly applied (previously always
   "Normal" regardless of selection).
2. Enable "Beat-Sync (nur auf Drop/Transient)" on one of the 5 modes —
   confirm the image holds a static, filtered cover-fit view between
   beats and only animates on drops/transients (previously: beat-sync
   checkbox had no effect on these 5 modes).
3. Spot-check one classic mode and one V67 mode with Blend + Beat-Sync
   both active — confirm no regression (this fix touches nothing in their
   code paths, but worth a quick confirmation).
