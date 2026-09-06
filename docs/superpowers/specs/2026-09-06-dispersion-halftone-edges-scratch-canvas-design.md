# Dispersion/Halftone/Edges Filter Hang — Scratch Canvas Fix — Design

## Problem

Live debugging (`superpowers:systematic-debugging`) on production found a
severe, reproducible bug: with a color filter active, **Dispersion**,
**Halftone**, or **Edges** mode can hang the entire browser tab —
confirmed live by intercepting the render loop on `elasticmorph.app`: after
switching Dispersion to the "Schwarzweiß" filter, the page stopped
responding to even trivial JavaScript (`1+1`) until reloaded.

This is the same root cause as the 8-mode scratch-canvas fix shipped
earlier the same day
(`docs/superpowers/specs/2026-09-06-image-layer-filter-scratch-canvas-design.md`):
`ctx.filter` gets recomputed on every individual draw call made while it's
set. That fix's audit excluded these 3 modes because they don't call
`ctx.drawImage(IM.img, ...)` in a loop — but `ctx.filter` applies to
**any** draw operation, and these 3 modes draw the image as a grid of up to
**18,150** individually filled circles per frame (`sampleImage()`,
`elastic-morph.html:6348-6350`: `cols = 110`, `rows = round(110 *
img.height/img.width)` — e.g. 110×62 ≈ 6,820 cells for a 16:9 image, up to
110×165 ≈ 18,150 for a tall portrait). With a filter active, each of those
thousands of `ctx.fill()` calls pays the filter cost — severe enough to
hang the tab outright, not just slow it down, which is worse than any of
the original 8 modes (max 70 draws/frame).

This explains both of Frank's reports in one root cause: no visible color
change (the render loop stalls before a new frame completes) and Chrome
becoming unusable (the actual hang).

## Goals

- Fix exactly the same underlying defect for these 3 modes, using the
  already-proven, already-shipped fix pattern: `imageLayerScratchCanvas`
  (from the earlier fix, unchanged) plus Ken Burns transform replication
  (from that fix's corrected Round 2).
- No visual/behavioral change beyond what the earlier fix already
  established as an accepted, documented side-effect category (a mode's
  Blend dropdown starting to work where it was silently ignored before).

## Non-Goals

- Not touching any other mode — the other 15 (8 already fixed, 7 confirmed
  not loop-heavy) are unaffected.
- Not changing `sampleImage`'s cell count/grid resolution — that's a
  separate visual-quality lever, out of scope for a bug fix.

## Design

### The fix

Dispersion/Halftone/Edges share one code block at the end of
`drawImageLayer` (`elastic-morph.html:6524-6570`) — not a separate
`if`/`return` branch like the other classic modes, but the function's
final fallthrough. The block:

1. Computes `cellColor(c, a)` per cell (image RGB, or DNA-hue tint) and
   sets `ctx.globalCompositeOperation` once (`"lighter"` for Edges,
   `"source-over"` for the other two) — currently on the **real** `ctx`,
   which is why these 3 modes currently ignore the Blend dropdown, exactly
   like Displace did before its fix.
2. Loops `IM.cells`, computing per-cell position/size/color and drawing
   `ctx.beginPath(); ctx.arc(...); ctx.fill();` directly on `ctx`.

Applying the established pattern: move steps 1-2 onto `imageLayerScratchCanvas(W,
H)`'s own context (`sctx`) — clear it, reset `sctx.globalAlpha`, set
`sctx.globalCompositeOperation` there instead of on `ctx`, replicate the
Ken Burns transform on `sctx` when `IM.kenburns` is on (same code as the
other 8 modes), run the identical cell loop with every `ctx.*` call
changed to `sctx.*`, then a single `ctx.drawImage(scratch, 0, 0)` to
composite the finished result through the real, filtered `ctx`.

The top-of-function Ken Burns exclusion guard (`elastic-morph.html:6402`,
`if (IM.kenburns && IM.mode !== "displace" && IM.mode !== "shards")`)
gains 3 more exclusions: `&& IM.mode !== "dispersion" && IM.mode !==
"halftone" && IM.mode !== "edges"`.

### Accepted side-effect: Blend dropdown starts working (same category as Displace)

Because `ctx.globalCompositeOperation` moves from the real `ctx` onto the
throwaway `sctx`, the internal per-cell blending (`"lighter"` for Edges,
`"source-over"` for the others) now only governs how cells blend with
*each other* on the scratch — the final blit runs under whatever Blend the
user actually selected for that Image Layer, instead of always being
silently forced. Same accepted, documented pattern as Displace's fix
earlier the same day. Most noticeable on Edges (previously always
additive/glowing against the background regardless of the Blend picker).

### Testing

Same static-source-assertion style as the rest of `test.js`: extract
`drawImageLayer`, confirm the shared block now creates/clears/resets a
scratch context, replicates the Ken Burns block with `sctx.*` calls, runs
the per-mode cell-drawing calls (`edges`'s early `continue`, `dispersion`'s
scatter displacement, `halftone`'s size cutoff) against `sctx` instead of
`ctx`, and ends with exactly one `ctx.drawImage(scratch, 0, 0)` before the
function's existing `ctx.restore(); ctx.globalCompositeOperation =
"source-over";` tail.

### Manual live-check (after implementation)

1. Dispersion, Halftone, and Edges each with a strong filter (e.g.
   "Schwarzweiß") and a **portrait** image (worst-case ~18,150 cells) —
   confirm smooth playback, no hang, filter visibly applied.
2. Same 3 modes with a non-default Blend (e.g. "Screen") — confirm the
   blend is now visibly applied (previously silently ignored).
3. Toggle Ken Burns on one of the 3 modes — confirm no edge-clipping
   (same check as the other 8 modes' live-check).
