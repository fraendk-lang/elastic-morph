# FX Rack IV Part 2: Rebind + Remaining 5 Effects — Design Spec

**Status:** Approved by Frank ("passt" on rebind approach, "passt" on the 5-effect technique plan)
**Date:** 2026-09-01

## Goal

Two pieces of follow-up work on the just-shipped FX Rack IV ("Warp/Verzerrungsfeld", see
[[project_morph_fx_rack_iv_warp_shipped]]):

1. **Rebind fix**: Frank tested Cmd+1 in a normal browser tab (not the installed PWA) and
   confirmed it's blocked by the browser's own tab-switching shortcut — exactly the risk flagged
   during the original investigation. Rebind Rack IV from Cmd/Meta+1–0 to **Ctrl+Shift+1–0**,
   which works identically in a browser tab and the installed PWA, never OS/browser-reserved.
2. **The 5 remaining candidate effects**, originally deferred pending real performance work: Heat
   Haze, Vortex Twist, Displacement Noise, Slit-Scan Drift, Gravity Well — filling Rack IV's
   remaining slots 6–10.

## Context

*Line numbers are as of this spec's writing (2026-09-01) — re-confirm with a fresh `grep -n`
immediately before editing, this file's numbers drift between sessions.*

`@BUILD-INJECT-V58` now sits at **line 11051** (shifted from 10913 by Part 1's additions). Every
edit in this spec is pre-marker, following the same placement discipline established in Part 1 and
[[project_morph_build_pipeline_gotcha]].

**Rebind mechanics**: the current keydown dispatch is
```js
if (e.ctrlKey) {                       // Ctrl+digit → FX Rack II (geometry)
  ...
} else if (e.metaKey) {                // Cmd/Meta+digit → FX Rack IV (warp)
  ...
} else {                               // plain digit → FX Rack I
  ...
}
```
A naive swap to `e.ctrlKey && e.shiftKey` for Rack IV would never fire, because the first
`if (e.ctrlKey)` branch already matches Ctrl+Shift+digit (it doesn't check `shiftKey` at all) and
routes it to Rack II. **The branches must be reordered**, checking the more specific
`e.ctrlKey && e.shiftKey` combination first, then plain `e.ctrlKey`, then the final else — see
Exact Code section A.

**New-technique grounding, confirmed by reading the actual code:**
- `curlFlow(x, y)` and `noise2(x, y)` (`elastic-morph.html:3407-3418`) — already-existing,
  already-proven-cheap noise/curl-noise helpers, currently used by the particle flow field and
  several organic-motion effects (e.g. `elastic-morph.html:14462`'s vinyl-groove shimmer already
  uses `noise2` at a similarly small coefficient/amplitude scale for exactly the kind of gentle,
  continuous variation Heat Haze needs). No new noise machinery required for Heat Haze or
  Displacement Noise.
- `bloomC` (`elastic-morph.html:2977`-ish, sized in `resize()` at `elastic-morph.html:9899-9900`
  via `Math.max(2, Math.round(canvas.width / 4))`) — an already-proven, already-shipping
  quarter-resolution offscreen buffer. Slit-Scan Drift's history ring buffer reuses this exact
  sizing idiom, so its per-frame cost (one downscale copy) is the same class of operation as the
  bloom pass and Halftone's own downscale copy (`elastic-morph.html:7228`-ish,
  `chctx.drawImage(canvas, 0, 0, cols, rows)`), both already proven fine in production.
- The ring-clip technique Ripple/Fisheye already use (`elastic-morph.html:8300`-ish) generalizes
  directly to Vortex Twist (rotate per ring instead of scale) and Gravity Well (off-center clip
  origin, inward scale instead of outward) — no new geometry technique, just different per-ring
  transforms on the same 24-ring loop shape.
- `resize()` (`elastic-morph.html:9870`-ish) is pre-marker — safe to extend directly for the new
  ring-buffer canvases' sizing.

**Honest performance conclusion**: all 5 new effects map onto cost classes already proven fine in
this exact codebase — 24-40-iteration strip/ring loops (matching the already-shipped 5), plus, for
Slit-Scan only, one additional quarter-resolution downscale copy per frame (matching the existing
bloom/halftone downscale cost). This directly addresses the reason these 5 were deferred in the
first place (unproven cost) with concrete technique choices grounded in already-shipping code,
not optimistic claims.

## Design

### 1. Rebind (Ctrl+Shift+1–0)

Reorder the keydown dispatch so `e.ctrlKey && e.shiftKey` is checked before plain `e.ctrlKey`.
Update the HTML label from "Cmd+1–0" to "Ctrl+Shift+1–0".

### 2. Five new effects

| Effect | Key | Slot | Technique | Audio mapping |
|---|---|---|---|---|
| Heat Haze | `haze` | 6 | Horizontal-band technique (Slice-Shear/Wave-Mirror family), 40 bands, `noise2()`-driven offset instead of `sin()` — organic, non-repeating shimmer instead of a clean wave | `S.loudness` → amplitude |
| Vortex Twist | `vortex` | 7 | Ring-clip technique (Ripple/Fisheye family), **rotate** per ring instead of scale, radial falloff (center twists most) | `S.transient` → twist strength |
| Displacement Noise | `noise` | 8 | Horizontal-band technique, 32 bands, offset via `curlFlow()` (existing helper) instead of `sin()`/`noise2()` — organic drift | `S.highs` → amplitude |
| Slit-Scan Drift | `slitscan` | 9 | New: 10-slot quarter-resolution ring buffer of past frames (reuses `bloomC`'s sizing idiom), 26 output columns each sampled from a different buffer age (oldest left, newest right) | Always-on temporal drift (no single audio knob — the *sweep itself* is the effect) |
| Gravity Well | `gravity` | 10 | Ring-clip technique, off-center clip origin that slowly orbits (pure function of `S.time`, no extra state), inward pull instead of outward bulge | `S.transient` → pull strength |

Heat Haze and Displacement Noise deliberately use **horizontal bands** (not vertical columns) —
shifting vertical columns sideways would create visible gaps/overlaps between neighboring columns;
horizontal bands shifted horizontally reuse the exact same proven wraparound trick
(`off - Math.sign(off) * W`) every existing Rack II/IV band effect already relies on.

### 3. New state / module-level additions

- `S.fx4` gains 5 more boolean flags (10 total).
- `S.fx4SlitIdx: 0` — Slit-Scan's ring-buffer write pointer (a plain number, safe to live in `S`
  alongside `fx4MeltPhase`, unlike the buffer canvases themselves).
- Module-level `FX4_SLIT_DEPTH = 10` and `fx4SlitBuf` (array of `{c, x}` canvas/context pairs,
  sized in `resize()`) — canvases can never live inside `S` (not JSON-serializable; `projectData()`
  spreads `S.fx2`/`S.fx3`/`S.fx4` into saved projects, and a canvas element would break that).

### 4. Auto-VJ

`safe4` grows from 5 to all 10 keys — all 10 Rack IV effects are pure distortion (no additive
blending), matching the same reasoning that put the first 5 in `safe4` without joining `bright`.

## Non-Goals

- No change to the already-shipped 5 effects' own logic (ripple/fisheye/melt/pagewarp/wavemirror)
  beyond the rebind.
- No `S.perfScale`-based dynamic quality reduction for the 5 new effects either — same YAGNI
  reasoning as Part 1; revisit only if a future performance check finds a real problem.
- Slit-Scan Drift gets no dedicated on/off audio-reactivity knob beyond "always sweeping while
  active" — the temporal sweep itself, not a modulated amplitude, is the visual content. (Simpler
  than inventing an artificial audio mapping for a fundamentally temporal, not amplitude-driven,
  effect.)
- No further Set/Cue-list, `brightFxActive()`, or CSS changes — same reasoning as Part 1 (Rack III
  precedent, no additive blending, shared global `.fxchip` class).

## Exact Code

### A) Keydown dispatch — reorder + rebind to Ctrl+Shift

Find (`elastic-morph.html`, the digit-dispatch block from Part 1):
```js
    } else if (e.key >= "0" && e.key <= "9") {
      const idx = e.key === "0" ? 9 : +e.key - 1;
      if (e.ctrlKey) {                       // Ctrl+digit → FX Rack II (geometry)
        const def2 = FX2_DEFS[idx];
        if (def2) { e.preventDefault(); toggleFX2(def2[0]); }
      } else if (e.metaKey) {                // Cmd/Meta+digit → FX Rack IV (warp)
        const def4 = FX4_DEFS[idx];
        if (def4) { e.preventDefault(); toggleFX4(def4[0]); }
      } else {                               // plain digit → FX Rack I
        const def = FX_DEFS[idx];
        if (def) toggleFX(def[0]);
      }
    }
```
Replace:
```js
    } else if (e.key >= "0" && e.key <= "9") {
      const idx = e.key === "0" ? 9 : +e.key - 1;
      if (e.ctrlKey && e.shiftKey) {         // Ctrl+Shift+digit → FX Rack IV (warp)
        const def4 = FX4_DEFS[idx];
        if (def4) { e.preventDefault(); toggleFX4(def4[0]); }
      } else if (e.ctrlKey) {                // Ctrl+digit → FX Rack II (geometry)
        const def2 = FX2_DEFS[idx];
        if (def2) { e.preventDefault(); toggleFX2(def2[0]); }
      } else {                               // plain digit → FX Rack I
        const def = FX_DEFS[idx];
        if (def) toggleFX(def[0]);
      }
    }
```

### B) HTML label

Find:
```html
    <h3>FX Rack IV — Warp <small style="color:var(--text-dim);font-weight:400">(Cmd+1–0)</small></h3>
```
Replace:
```html
    <h3>FX Rack IV — Warp <small style="color:var(--text-dim);font-weight:400">(Ctrl+Shift+1–0)</small></h3>
```

### C) `FX4_DEFS` — 5 new entries

Find:
```js
const FX4_DEFS = [
  ["ripple",     "Liquid Ripple",   "concentric rings, beat-driven"],
  ["fisheye",    "Fisheye Pulse",   "barrel bulge, beat-driven"],
  ["melt",       "Horizontal Melt", "vertical drip distortion, bass-driven"],
  ["pagewarp",   "Page Warp",       "single flag-wave bend, mids-driven"],
  ["wavemirror", "Wave Mirror",     "banded sine offset, stronger at the edges"]
];
```
Replace:
```js
const FX4_DEFS = [
  ["ripple",     "Liquid Ripple",       "concentric rings, beat-driven"],
  ["fisheye",    "Fisheye Pulse",       "barrel bulge, beat-driven"],
  ["melt",       "Horizontal Melt",     "vertical drip distortion, bass-driven"],
  ["pagewarp",   "Page Warp",           "single flag-wave bend, mids-driven"],
  ["wavemirror", "Wave Mirror",         "banded sine offset, stronger at the edges"],
  ["haze",       "Heat Haze",           "fine shimmer, loudness-driven"],
  ["vortex",     "Vortex Twist",        "localized swirl, transient-driven"],
  ["noise",      "Displacement Noise",  "organic curl-noise drift, highs-driven"],
  ["slitscan",   "Slit-Scan Drift",     "temporal column smear, always-on"],
  ["gravity",    "Gravity Well",        "off-center pull, transient-driven"]
];
```

### D) State — 5 new flags + Slit-Scan's write pointer

Find:
```js
  fx4: { ripple: false, fisheye: false, melt: false, pagewarp: false, wavemirror: false },
  fx4MeltPhase: 0,
```
Replace:
```js
  fx4: { ripple: false, fisheye: false, melt: false, pagewarp: false, wavemirror: false,
         haze: false, vortex: false, noise: false, slitscan: false, gravity: false },
  fx4MeltPhase: 0,
  fx4SlitIdx: 0,
```

### E) Module-level Slit-Scan ring buffer

Find (right after the existing `fbC`/`fbctx` declaration):
```js
const fbC = document.createElement("canvas"), fbctx = fbC.getContext("2d");   // feedback accumulation
```
Replace:
```js
const fbC = document.createElement("canvas"), fbctx = fbC.getContext("2d");   // feedback accumulation
// v140: FX Rack IV Slit-Scan Drift — small ring buffer of past frames at quarter
// resolution (same sizing idiom as bloomC), so each output column can sample a
// different moment in time.
const FX4_SLIT_DEPTH = 10;
const fx4SlitBuf = Array.from({ length: FX4_SLIT_DEPTH }, () => {
  const c = document.createElement("canvas");
  return { c, x: c.getContext("2d") };
});
```

### F) `resize()` — size the Slit-Scan ring buffer alongside `bloomC`

Find:
```js
  // bloom buffer at 1/4 resolution
  bloomC.width = Math.max(2, Math.round(canvas.width / 4));
  bloomC.height = Math.max(2, Math.round(canvas.height / 4));
```
Replace:
```js
  // bloom buffer at 1/4 resolution
  bloomC.width = Math.max(2, Math.round(canvas.width / 4));
  bloomC.height = Math.max(2, Math.round(canvas.height / 4));
  // v140: Slit-Scan ring buffer shares bloomC's quarter-resolution sizing
  fx4SlitBuf.forEach(b => { b.c.width = bloomC.width; b.c.height = bloomC.height; });
```

### G) `applyPostFX4` — 5 new effect blocks

Find (the closing of the `wavemirror` block, i.e. the end of the function):
```js
  // Wave Mirror — banded sine offset, amplitude grows from center toward the edges
  if (fx.wavemirror) {
    snapshot(W, H);
    const bands = 26, bh = H / bands, baseAmp = W * 0.05 + S.bass * W * 0.06;
    ctx.save();
    for (let i = 0; i < bands; i++) {
      const y0 = i * bh, t = Math.abs(i / bands - 0.5) * 2;
      const off = Math.sin(S.time * 2 + i * 0.5) * baseAmp * t;
      ctx.drawImage(fxC, 0, y0, W, bh + 1, off, y0, W, bh + 1);
      ctx.drawImage(fxC, 0, y0, W, bh + 1, off - Math.sign(off) * W, y0, W, bh + 1);
    }
    ctx.restore();
  }
}
```
Replace:
```js
  // Wave Mirror — banded sine offset, amplitude grows from center toward the edges
  if (fx.wavemirror) {
    snapshot(W, H);
    const bands = 26, bh = H / bands, baseAmp = W * 0.05 + S.bass * W * 0.06;
    ctx.save();
    for (let i = 0; i < bands; i++) {
      const y0 = i * bh, t = Math.abs(i / bands - 0.5) * 2;
      const off = Math.sin(S.time * 2 + i * 0.5) * baseAmp * t;
      ctx.drawImage(fxC, 0, y0, W, bh + 1, off, y0, W, bh + 1);
      ctx.drawImage(fxC, 0, y0, W, bh + 1, off - Math.sign(off) * W, y0, W, bh + 1);
    }
    ctx.restore();
  }

  // Heat Haze — fine organic shimmer across many horizontal bands, loudness-driven
  if (fx.haze) {
    snapshot(W, H);
    const bands = 40, bh = H / bands, amp = W * 0.004 + S.loudness * W * 0.012;
    ctx.save();
    for (let i = 0; i < bands; i++) {
      const y0 = i * bh;
      const off = noise2(i * 0.4, S.time * 1.1) * amp;
      ctx.drawImage(fxC, 0, y0, W, bh + 1, off, y0, W, bh + 1);
      ctx.drawImage(fxC, 0, y0, W, bh + 1, off - Math.sign(off) * W, y0, W, bh + 1);
    }
    ctx.restore();
  }

  // Vortex Twist — localized rotational swirl, radial falloff (center twists most)
  if (fx.vortex) {
    snapshot(W, H);
    const rings = 24, twist = 0.5 + S.transient * 1.8;
    ctx.save();
    for (let i = 0; i < rings; i++) {
      const t0 = i / rings, t1 = (i + 1) / rings;
      const ang = (1 - t0) * (1 - t0) * twist;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * t1, 0, Math.PI * 2);
      ctx.arc(cx, cy, maxR * t0, 0, Math.PI * 2, true);
      ctx.clip();
      ctx.translate(cx, cy); ctx.rotate(ang); ctx.translate(-cx, -cy);
      ctx.drawImage(fxC, 0, 0, W, H);
      ctx.restore();
    }
    ctx.restore();
  }

  // Displacement Noise — organic curl-noise drift across horizontal bands, highs-driven
  if (fx.noise) {
    snapshot(W, H);
    const bands = 32, bh = H / bands, amp = W * 0.015 + S.highs * W * 0.05;
    ctx.save();
    for (let i = 0; i < bands; i++) {
      const y0 = i * bh;
      const off = curlFlow(i * 0.25, S.time * 0.35).x * amp;
      ctx.drawImage(fxC, 0, y0, W, bh + 1, off, y0, W, bh + 1);
      ctx.drawImage(fxC, 0, y0, W, bh + 1, off - Math.sign(off) * W, y0, W, bh + 1);
    }
    ctx.restore();
  }

  // Slit-Scan Drift — 26 columns, each sampled from a different age in the ring buffer
  // (oldest on the left, newest on the right); always sweeping while active.
  if (fx.slitscan) {
    const slot = fx4SlitBuf[S.fx4SlitIdx];
    slot.x.drawImage(canvas, 0, 0, slot.c.width, slot.c.height);
    S.fx4SlitIdx = (S.fx4SlitIdx + 1) % FX4_SLIT_DEPTH;
    const cols = 26, cw = W / cols;
    ctx.save();
    for (let i = 0; i < cols; i++) {
      const age = Math.floor((i / cols) * FX4_SLIT_DEPTH);
      const slotIdx = (S.fx4SlitIdx + age) % FX4_SLIT_DEPTH;
      const buf = fx4SlitBuf[slotIdx];
      const sx = i * cw;
      ctx.drawImage(buf.c, sx / W * buf.c.width, 0, buf.c.width / cols, buf.c.height, sx, 0, cw + 1, H);
    }
    ctx.restore();
  }

  // Gravity Well — off-center point (slow orbit, pure function of S.time) pulls inward
  if (fx.gravity) {
    snapshot(W, H);
    const gx = cx + Math.cos(S.time * 0.15) * W * 0.22;
    const gy = cy + Math.sin(S.time * 0.11) * H * 0.22;
    const gMaxR = Math.hypot(Math.max(gx, W - gx), Math.max(gy, H - gy));
    const rings = 24, pull = 0.05 + S.transient * 0.12;
    ctx.save();
    for (let i = 0; i < rings; i++) {
      const t0 = i / rings, t1 = (i + 1) / rings;
      const s = 1 - pull * (1 - t0) * (1 - t0);
      ctx.save();
      ctx.beginPath();
      ctx.arc(gx, gy, gMaxR * t1, 0, Math.PI * 2);
      ctx.arc(gx, gy, gMaxR * t0, 0, Math.PI * 2, true);
      ctx.clip();
      ctx.translate(gx, gy); ctx.scale(s, s); ctx.translate(-gx, -gy);
      ctx.drawImage(fxC, 0, 0, W, H);
      ctx.restore();
    }
    ctx.restore();
  }
}
```

### H) Auto-VJ `safe4` — extend to all 10 keys

Find:
```js
    const safe4 = ["ripple", "fisheye", "melt", "pagewarp", "wavemirror"];
```
Replace:
```js
    const safe4 = ["ripple", "fisheye", "melt", "pagewarp", "wavemirror",
      "haze", "vortex", "noise", "slitscan", "gravity"];
```

## Testing

Same structural-only split established in Part 1 (canvas 2D isn't exercisable from Node):
- `FX4_DEFS` has 10 entries total, the 5 new keys present with correct labels.
- `S.fx4` initialized with 10 keys, all false; `S.fx4SlitIdx: 0` present.
- `FX4_SLIT_DEPTH`/`fx4SlitBuf` defined; `resize()`'s source contains the `fx4SlitBuf.forEach`
  sizing line.
- Keydown dispatch: `e.ctrlKey && e.shiftKey` branch appears BEFORE the plain `e.ctrlKey` branch
  (order matters — a reviewer/test should specifically check this, not just presence).
- HTML label reads "Ctrl+Shift+1–0", the old "Cmd+1–0" text is gone.
- `applyPostFX4`'s source contains all 5 new effect blocks, each referencing its documented audio
  signal (except `slitscan`, which has no audio-signal requirement per this spec's Non-Goals) and
  each calling `snapshot(W, H)` except `slitscan` (which reads from `canvas` directly instead,
  since it needs the fully-composited current frame for its history buffer, not `fxC`).
- `safe4` contains all 10 keys.

## Live Verification

Toggle each of the 5 new effects via Ctrl+Shift+6 through Ctrl+Shift+0 (mapping to slots 6–10) and
via chip click; confirm both agree. Force each effect's mapped audio signal and confirm the
distortion visibly/measurably tracks it (except Slit-Scan, which should visibly sweep
continuously whenever active, no audio-forcing needed). Confirm Ctrl+Shift+1 now toggles `ripple`
(the rebind didn't break the already-shipped 5). Confirm Cmd+1 in a plain browser tab no longer
does anything odd (falls through to the browser's own tab-switch, as expected — Elastic Morph no
longer claims that combination at all). Let Slit-Scan run for several seconds and confirm the
sweep looks like a genuine temporal smear (not a single static offset) and that toggling it
off/on doesn't leave stale/garbage content in the ring buffer's first few frames after a resize.
Run Auto-VJ for a stretch and confirm all 10 Rack IV effects (not just the original 5) appear in
rotation.
