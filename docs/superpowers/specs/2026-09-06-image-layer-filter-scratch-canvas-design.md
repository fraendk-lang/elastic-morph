# Image Layer Filter Performance — Scratch Canvas Fix — Design

## Post-implementation amendment (final whole-branch review)

The final whole-branch review (after all 3 tasks shipped) found the
scratch-canvas design was not quite pixel-identical in three specific ways.
Resolved with Frank as follows:

1. **Ken Burns edge clipping/softening — real regression, fixed (corrected
   in a second round after the first fix was found to be a no-op).** Ken
   Burns' pan/zoom (`elastic-morph.html`'s `IM.kenburns` block, applied on
   the real `ctx` before a heavy mode's scratch composite is blitted) can
   reveal a thin strip beyond the scratch's `W`×`H` bounds at min-zoom/
   max-drift, and softens the composite slightly once magnified into that
   gap.
   - **Round 1 (rejected on task review):** pad the scratch canvas by the
     worst-case Ken Burns overscan and shift the coordinate origin via
     `sctx.translate(padX, padY)` / blit at `(-padX, -padY)`. The task
     reviewer proved this is a geometric no-op: `coverRect` (and, for
     `kaleido`/`tunnel`, the mode's own center point) was still computed
     from the *unpadded* `W`/`H`, so the mode's actual drawn footprint
     never grew into the new padding — the translate and its inverse blit
     offset exactly cancel, leaving the pad permanently empty and the
     original clipping bug fully intact.
   - **Round 2 (correct, shipped):** instead of trying to carve out extra
     margin around an unpadded footprint, replicate the Ken Burns
     transform itself onto the scratch's own context (`sctx`), inside each
     of the 8 heavy modes, in place of applying it to the real `ctx` before
     the mode dispatch (which the shared top-of-function block now
     excludes these 8 modes from). The scratch stays exactly `W`×`H` —
     matching `ctx`'s own raster bounds, exactly like the un-refactored
     code before Tasks 1-3 — so the rasterization (buffer size, transform,
     clipping) is byte-for-byte identical to the original, pre-scratch-
     canvas behavior; only the physical buffer holding the pixels during
     the per-mode loop changed (irrelevant to the final image), and the
     filter-performance fix is untouched (the transform has no bearing on
     where `ctx.filter` is set). See
     `docs/superpowers/plans/2026-09-06-image-layer-filter-scratch-canvas.md`
     Task 5 for the exact, corrected code.
2. **`displace` now honors the Blend dropdown — kept, intentional.**
   Before this branch, `displace` set `ctx.globalCompositeOperation =
   "source-over"` on the *real* `ctx`, silently overriding whatever blend
   mode the v68 wrapper (`elastic-morph.html:13385`) had already set —
   `displace` was the one mode that ignored the Blend dropdown entirely.
   Moving that same line to the *scratch* context as part of this fix means
   the final blit now runs under the real `ctx`'s actual blend mode, so
   `displace` behaves like the other 13 modes. This is a bugfix, not a
   regression — kept intentionally. A saved project using `mode: "displace"`
   with a non-default `blend` will render differently (correctly) after
   this branch.
3. **Kaleidoscope/Shards/Datamosh composite-then-fade vs. fade-then-stack —
   documented, no code change.** Same category of change already accepted
   for `glitch`'s dup-band dimming and `tunnel`'s per-segment falloff:
   overlapping sub-draws now composite at full strength onto the scratch,
   and `IM.opacity`/blend apply once at the final blit, instead of each
   sub-draw individually inheriting the layer's opacity as it was drawn.
   Most visible in `kaleido` (heaviest overlap, 4-8 full-image copies) at
   reduced Deckkraft — the stack no longer builds toward opacity the way
   repeated `source-over` draws at partial alpha used to. Accepted as the
   correct combined-opacity behavior for this class of mode.

**Not part of this fix — flagged as a follow-up candidate, not fixed here:**
`dispersion`/`halftone`/`edges` (`elastic-morph.html`, ~7,000-12,000 filtered
`ctx.arc()`/`ctx.fill()` calls/frame from `IM.cells`) and `scan`
(`drawImageLayerV67`, 360-720 filtered `ctx.fillRect()` calls/frame) were
excluded from the original 8-mode audit on a "loops calling
`drawImage(IM.img,...)`" criterion — but `ctx.filter` applies to any draw
operation, not just `drawImage`, and both of these draw far more filtered
primitives per frame than any of the 8 modes just fixed. They likely exhibit
the same root-cause bug, possibly worse. Left for a future round with
"filtered draw operations per frame" (not just `drawImage` calls) as the
audit criterion.

## Problem

Live debugging (`superpowers:systematic-debugging`, following up on the
already-shipped [2026-09-06 image-layer-downscale fix](2026-09-06-image-layer-downscale-design.md))
found a second, distinct root cause behind two still-open reports:

- **Safari:** color filters (e.g. "Neon Glow", "Schwarzweiß") have no visible
  effect at all, even though modulation/motion effects (the mode itself)
  work correctly. Confirmed on a current Safari (26.4), ruling out the
  earlier "old Safari lacks Canvas 2D `ctx.filter`" hypothesis.
- **Chrome:** the app runs slow specifically when a color filter is active
  ("Hat auch mit den Farben zu tun. Erst dann wird Chrome langsam") — no
  longer a hard freeze (the 2048px downscale fix already helped), but still
  clearly filter-triggered.

### Root cause

Across all three Image Layer render generations, the code that applies a
color filter sets `ctx.filter` **once**, then calls a mode function that may
internally loop and call `ctx.drawImage(IM.img, ...)` many times per frame
while that filter stays active:

- Classic modes: the filter is applied by a wrapper around the whole
  `drawImageLayer()` call (`elastic-morph.html:13212-13229`,
  `initImageLayerV67()`'s monkey-patch) — `ctx.filter = filt` before calling
  the original `drawImageLayer`, reset after.
- V67 modes (`drawImageLayerV67`, `elastic-morph.html:13091-13191`) and V99
  modes (`drawImageLayerV99`, `elastic-morph.html:16737-16815`) each set
  `ctx.filter` themselves, once, right before dispatching to the active
  mode's branch.

In all three cases, `ctx.filter` is a *state* on the canvas context, not a
one-shot argument — every individual `drawImage` call made while it's set
pays the full filter cost again, over that call's own drawn region. A mode
that loops 16-70 times per frame therefore recomputes the filter 16-70
times per frame instead of once. This is architecturally identical to a
problem already found and fixed in this codebase for Background Video
(`elastic-morph.html:18840-18843`, `bgVidScratchCanvas()`): "ctx.filter is
ignored/reapplied per drawImage call in Chrome/Safari; blit through an
unfiltered scratch canvas first, then filtered-draw *that*."

### Full audit — which modes actually loop with `drawImage(IM.img, …)`

| Generation | Mode | Function | Draws/frame | Heavy? |
|---|---|---|---|---|
| Classic | `backdrop` | `drawImageLayer` | 1 | no |
| Classic | `spin` | `drawImageLayer` | 1 | no |
| Classic | **`displace`** | `drawImageLayer:6421` | 70 | **yes** |
| Classic | `mosaic` | `drawImageLayer:6437` | 2 (tiny intermediate + 1 real) | no |
| Classic | **`shards`** | `drawImageLayer:6452` | ~50-60 (10 × rows2) | **yes** |
| Classic | `dispersion`/`halftone`/`edges` | `drawImageLayer:6474+` | 0 (draws pre-sampled `IM.cells` colors as primitives, never redraws `IM.img`) | no |
| V67 | **`glitch`** | `drawImageLayerV67:13110` | 24-44 | **yes** |
| V67 | **`ripple`** | `drawImageLayerV67:13128` | 56 | **yes** |
| V67 | **`kaleido`** | `drawImageLayerV67:13140` | 4-8 | **yes** |
| V67 | `scan` | `drawImageLayerV67:13155` | 1 (rest is solid-color `fillRect`) | no |
| V67 | `mirror` | `drawImageLayerV67:13170` | 2 | no |
| V99 | **`parallax`** | `drawImageLayerV99:16756` | 48 | **yes** |
| V99 | `zoompulse` | `drawImageLayerV99:16767` | 1 | no |
| V99 | **`datamosh`** | `drawImageLayerV99:16774` | 10-20 | **yes** |
| V99 | `flicker` | `drawImageLayerV99:16785` | 1-2 | no |
| V99 | **`tunnel`** ("Tunnel Warp") | `drawImageLayerV99:16795` | 16-24 | **yes** |

8 of 18 modes are heavy: **Displace/Wave, Shatter/Shards, Glitch, Ripple,
Kaleidoscope, Parallax, Datamosh, Tunnel Warp.** These are exactly the modes
where a color filter can look broken (Safari) or slow (Chrome). The other
10 modes draw the image 0-2 times per frame — filter cost there is already
paid once or twice, same as any normal canvas draw, and are out of scope.

## Goals

- Make every heavy mode's per-frame filter cost O(1) instead of O(draws),
  without changing what any mode visually looks like.
- Reuse the exact pattern already proven in this codebase
  (`bgVidScratchCanvas`) rather than inventing a new one.
- No change to the filter-applying wrappers themselves (`ctx.filter = filt`
  / reset stays exactly where it is in all three generations) — the global
  `ctx` is `const` (`elastic-morph.html:3007`) and cannot be swapped out at
  the wrapper level, and doing so would touch far more code than this bug
  needs. Fix stays scoped to the 8 mode branches.

## Non-Goals

- Not touching the 10 non-heavy modes, or `scan`'s/`mirror`'s single-digit
  draw counts.
- Not touching Background Video's filter path — already fixed, unrelated
  code path.
- Not changing any mode's visual motion/behavior — pixel-for-pixel same
  output, just composited through one intermediate canvas first.

## Design

### 1. Shared helper (models `bgVidScratchCanvas`, one canvas for all 8 modes)

```js
// One shared scratch canvas for every Image Layer mode that draws IM.img
// many times per frame. Draw all of a mode's sub-images onto this
// (unfiltered — it's a separate context, so ctx.filter never touches it),
// then blit it through the real, already-filtered ctx exactly once. Fixes
// ctx.filter being recomputed per drawImage call in loop-heavy modes
// (Chrome: slow; Safari: filter invisible) — same fix as bgVidScratchCanvas.
function imageLayerScratchCanvas(w, h) {
  if (!S._imgLayerScratch) S._imgLayerScratch = document.createElement("canvas");
  const c = S._imgLayerScratch;
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c;
}
```

Sized to the full frame (`W`×`H`, the same dimensions the mode function
already receives), not to the image's own resolution or the cover rect —
every heavy mode's coordinate math (`coverRect`'s `oX`/`oY`, or
`W/2`/`H/2`-centered transforms for `tunnel`/`kaleido`) is already expressed
in full-frame space, so drawing at those same coordinates onto a same-size
scratch reproduces the identical result. One shared canvas is safe to reuse
across all 8 modes and both Image Layers (A/B): each mode's branch fully
draws and blits it before returning, so there's no cross-call overlap.

Reused, not recreated, across frames — only resized when `W`/`H` actually
change (window resize, or switching preview ↔ HQ export resolution),
exactly like `bgVidScratchCanvas`.

### 2. Per-mode change (same recipe for all 8)

For each heavy mode's branch:

1. Get the scratch canvas and its 2D context; reset its transform and clear
   it to transparent (a reused canvas may hold last frame's pixels):
   ```js
   const scratch = imageLayerScratchCanvas(W, H);
   const sctx = scratch.getContext("2d");
   sctx.setTransform(1, 0, 0, 1, 0, 0);
   sctx.clearRect(0, 0, W, H);
   ```
2. Replace every `ctx.*` call inside that mode's loop/body (`drawImage`,
   `translate`, `rotate`, `scale`, `save`, `restore`,
   `globalCompositeOperation`, and any *internal* `globalAlpha` modulation
   used to blend sub-draws together, e.g. tunnel's per-segment falloff or
   glitch's duplicate-band dimming) with the equivalent call on `sctx`
   instead of `ctx`. These draws are now unfiltered and cheap — `sctx` never
   has `ctx.filter` set on it.
3. After the loop, add exactly one line that blits the finished composite
   through the real `ctx` (which still has the mode's filter active, and
   still carries the overall `IM.opacity`/Ken Burns transform already set up
   earlier in the function):
   ```js
   ctx.drawImage(scratch, 0, 0);
   ```
   This single call is what pays the filter cost — once per frame instead
   of 16-70 times.

`IM.opacity`/`opMul` (set on real `ctx.globalAlpha` before the mode
dispatch) and Ken Burns (real `ctx.translate`/`scale` before the mode
dispatch) are untouched by this change and still apply correctly, because
the final blit still goes through the real `ctx` under its existing
transform/alpha state — only the *per-iteration* compositing inside the
loop moves to `sctx`.

### 3. Concrete diffs

**`displace`** (`elastic-morph.html:6421-6434`, classic):
```js
if (IM.mode === "displace") {
  const { dW, dH, oX, oY } = coverRect(W, H, IM);
  const bands = 70, bh = dH / bands;
  const amp = dW * 0.05 * IM.amount;
  const scratch = imageLayerScratchCanvas(W, H);
  const sctx = scratch.getContext("2d");
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, W, H);
  sctx.globalCompositeOperation = "source-over";
  for (let bI = 0; bI < bands; bI++) {
    const sy = (bI / bands) * IM.img.height;
    const sh = IM.img.height / bands;
    const wav = Math.sin(S.time * 2.2 + bI * 0.38) * amp * (S.bass * 1.3 + S.mids * 0.6 + 0.05);
    sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + wav, oY + bI * bh, dW, bh + 1);
  }
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
  return;
}
```

**`shards`** (`elastic-morph.html:6452-6471`, classic):
```js
if (IM.mode === "shards") {
  const { dW, dH, oX, oY } = coverRect(W, H, IM);
  const cols2 = 10, rows2 = Math.max(1, Math.round(cols2 * dH / dW));
  const qw = dW / cols2, qh = dH / rows2;
  const ex = (beat * 0.6 + S.transient * 0.6) * IM.amount;
  const cx0 = W / 2, cy0 = H / 2, push = ex * 180 * (H / 720);
  const scratch = imageLayerScratchCanvas(W, H);
  const sctx = scratch.getContext("2d");
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, W, H);
  for (let j = 0; j < rows2; j++) for (let i = 0; i < cols2; i++) {
    const sx = i / cols2 * IM.img.width, sy = j / rows2 * IM.img.height;
    const sw = IM.img.width / cols2, sh = IM.img.height / rows2;
    const qx = oX + (i + 0.5) * qw, qy = oY + (j + 0.5) * qh;
    const dx = qx - cx0, dy = qy - cy0, d = Math.hypot(dx, dy) || 1;
    const rot = Math.sin(i * 12.9 + j * 7.3) * ex * 0.6;
    sctx.save();
    sctx.translate(qx + dx / d * push, qy + dy / d * push);
    sctx.rotate(rot);
    sctx.drawImage(IM.img, sx, sy, sw, sh, -qw / 2 - 0.5, -qh / 2 - 0.5, qw + 1, qh + 1);
    sctx.restore();
  }
  ctx.drawImage(scratch, 0, 0);
  ctx.restore(); return;
}
```

**`glitch`** (`elastic-morph.html:13110-13127`, V67):
```js
if (IM.mode === "glitch") {
  const bands = 24 + Math.round(amt * 20);
  const bh = dH / bands;
  const glitch = (beat * 0.85 + S.transient * 0.9) * amt;
  const scratch = imageLayerScratchCanvas(W, H);
  const sctx = scratch.getContext("2d");
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, W, H);
  for (let b = 0; b < bands; b++) {
    const sy = (b / bands) * IM.img.height;
    const sh = IM.img.height / bands + 1;
    const jx = (Math.random() - 0.5) * dW * 0.12 * glitch;
    const dup = glitch > 0.35 && b % 7 === 0;
    sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + jx, oY + b * bh, dW, bh + 1);
    if (dup) {
      sctx.globalCompositeOperation = "lighter";
      sctx.globalAlpha = 0.45;
      sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + jx + 8, oY + b * bh, dW, bh + 1);
      sctx.globalCompositeOperation = "source-over";
      sctx.globalAlpha = 1;
    }
  }
  ctx.drawImage(scratch, 0, 0);
} else if (IM.mode === "ripple") {
```
(`glitch`'s dup-draw dimming used to multiply real `ctx.globalAlpha`, which
carried `IM.opacity`; on `sctx` there is no outer opacity to multiply
against, so it's set directly to the same `0.45` and restored to `1`,
producing an identical relative blend once the whole composite is later
drawn at `IM.opacity` via the final `ctx.drawImage(scratch, 0, 0)`.)

**`ripple`** (`elastic-morph.html:13128-13139`, V67):
```js
} else if (IM.mode === "ripple") {
  const bands = 56;
  const bh = dH / bands;
  const amp = dW * 0.04 * amt * (0.4 + energy + beat * 0.5);
  const scratch = imageLayerScratchCanvas(W, H);
  const sctx = scratch.getContext("2d");
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, W, H);
  for (let b = 0; b < bands; b++) {
    const sy = (b / bands) * IM.img.height;
    const sh = IM.img.height / bands + 1;
    const cx = (b / bands - 0.5) * 2;
    const wav = Math.sin(S.time * 3 + b * 0.22 + cx * 4) * amp;
    const wav2 = Math.cos(S.time * 2.1 + b * 0.15) * amp * 0.35 * S.bass;
    sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + wav + wav2, oY + b * bh, dW, bh + 1);
  }
  ctx.drawImage(scratch, 0, 0);
} else if (IM.mode === "kaleido") {
```

**`kaleido`** (`elastic-morph.html:13140-13154`, V67):
```js
} else if (IM.mode === "kaleido") {
  const cx = W / 2, cy = H / 2;
  const segs = 4 + Math.round(amt * 4);
  const diag = Math.hypot(W, H);
  const fill = diag / Math.min(dW, dH);
  const scratch = imageLayerScratchCanvas(W, H);
  const sctx = scratch.getContext("2d");
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, W, H);
  sctx.translate(cx, cy);
  sctx.rotate(S.time * 0.05 * amt + beat * 0.08);
  for (let s = 0; s < segs; s++) {
    sctx.save();
    sctx.rotate((Math.PI * 2 / segs) * s);
    sctx.scale(s % 2 ? 1 : -1, 1);
    sctx.scale(fill * (1 + beat * 0.04 * amt), fill * (1 + beat * 0.04 * amt));
    sctx.drawImage(IM.img, -dW / 2, -dH / 2, dW, dH);
    sctx.restore();
  }
  ctx.drawImage(scratch, 0, 0);
} else if (IM.mode === "scan") {
```

**`parallax`** (`elastic-morph.html:16756-16766`, V99):
```js
if (IM.mode === "parallax") {
  const bands = 48;
  const bh = dH / bands;
  const scratch = imageLayerScratchCanvas(W, H);
  const sctx = scratch.getContext("2d");
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, W, H);
  for (let b = 0; b < bands; b++) {
    const sy = (b / bands) * IM.img.height;
    const sh = IM.img.height / bands + 1;
    const depth = (b / bands - 0.5) * 2;
    const shift = depth * dW * 0.06 * amt * (0.35 + energy + beat * 0.45);
    const drift = Math.sin(S.time * 0.8 + b * 0.11) * dW * 0.015 * amt;
    sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + shift + drift, oY + b * bh, dW, bh + 1);
  }
  ctx.drawImage(scratch, 0, 0);
} else if (IM.mode === "zoompulse") {
```

**`datamosh`** (`elastic-morph.html:16774-16784`, V99):
```js
} else if (IM.mode === "datamosh") {
  const blocks = 10 + Math.round(amt * 10);
  const bw = dW / blocks;
  const slip = (beat * 0.85 + S.transient * 0.75) * amt;
  const scratch = imageLayerScratchCanvas(W, H);
  const sctx = scratch.getContext("2d");
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, W, H);
  for (let i = 0; i < blocks; i++) {
    const sx = (i / blocks) * IM.img.width;
    const sw = IM.img.width / blocks + 1;
    const jx = (Math.random() - 0.5) * dW * 0.18 * slip;
    const jy = (i % 3 === 0 ? (Math.random() - 0.5) * dH * 0.04 * slip : 0);
    sctx.drawImage(IM.img, sx, 0, sw, IM.img.height, oX + i * bw + jx, oY + jy, bw + 1, dH);
  }
  ctx.drawImage(scratch, 0, 0);
} else if (IM.mode === "flicker") {
```

**`tunnel`** (`elastic-morph.html:16795-16811`, V99):
```js
} else if (IM.mode === "tunnel") {
  const cx = W / 2, cy = H / 2;
  const segs = 16 + Math.round(amt * 8);
  const rot = S.time * 0.08 * amt + beat * 0.12;
  const pull = 1 + (beat * 0.08 + energy * 0.05) * amt;
  const scratch = imageLayerScratchCanvas(W, H);
  const sctx = scratch.getContext("2d");
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, W, H);
  sctx.translate(cx, cy);
  sctx.rotate(rot);
  for (let s = 0; s < segs; s++) {
    const t = s / segs;
    const sc = (0.35 + t * 0.95) * pull;
    sctx.save();
    sctx.scale(sc, sc);
    sctx.globalAlpha = 0.55 + t * 0.45;
    sctx.drawImage(IM.img, -dW / 2, -dH / 2, dW, dH);
    sctx.restore();
  }
  ctx.drawImage(scratch, 0, 0);
}
```
(`tunnel`'s per-segment `ctx.globalAlpha *= 0.55 + t * 0.45` used to compound
onto real `ctx`'s existing `IM.opacity`; on `sctx`, starting from a fresh
context whose default `globalAlpha` is `1`, it's set directly — same
relative segment falloff, with `IM.opacity` applied once, correctly, at the
final blit instead.)

### 4. Error handling

None needed beyond what already exists. `scratch.getContext("2d")` on a
canvas this code itself just created cannot return `null` (no reason to
guard, unlike `bgVidScratchCanvas`'s usage which guards against an
externally-influenced state) — but the plan will still write the guard for
defensive consistency with the existing codebase pattern, at zero behavior
cost since `sctx` is always truthy in practice.

### 5. Testing

Same static-source-assertion style as the rest of `test.js`: for each of
the 8 modes, confirm the extracted function source contains
`imageLayerScratchCanvas(W, H)` and exactly one `ctx.drawImage(scratch, 0, 0)`
inside that mode's branch, and that the loop body's `drawImage` calls now
target `sctx` rather than `ctx`. Plus one assertion that
`imageLayerScratchCanvas` exists with the documented reuse/resize logic.

### 6. Manual live-check (after implementation)

Not fully covered by `test.js` (no real filtered-canvas render comparison
in the static harness):

1. In Safari, upload an image, select each of the 8 heavy modes in turn
   with a strong filter active (e.g. "Schwarzweiß" or "Neon Glow") —
   confirm the filter is now visibly applied on every one (previously:
   invisible).
2. In Chrome, same 8 modes with a filter active — confirm smooth playback,
   no slowdown (previously: reported "everything is slow" specifically when
   a filter is active).
3. Spot-check 2-3 of the 8 modes *without* a filter active, and 2-3 of the
   *non-heavy* modes (e.g. `backdrop`, `scan`) with a filter active —
   confirm no visual regression (identical look/motion to before this fix).
4. Resize the browser window (or switch to HQ export resolution) while a
   heavy mode with a filter is active — confirm the scratch canvas resizes
   correctly (no stretched/stale frame).
