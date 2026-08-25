# Video Timeline — More Transition Types — Design Spec

**Status:** Approved by Frank, not yet built. Follow-up round to
[`2026-08-25-video-timeline-design.md`](2026-08-25-video-timeline-design.md), same day.

## Problem

The Video Timeline shipped 2026-08-25 with three transition types between clips (Dissolve, Wipe,
Slide) plus Cut. Frank wants more variety: Iris, Zoom-Cross, Push (vertical/diagonal), and
Glitch/RGB-Split.

## Locked decisions

- **Extend the existing `drawClip` helper, don't replace it.** `drawClip(el, alpha, xOff)` in
  `drawBgVideoTimeline()` (`elastic-morph.html`, before the `@BUILD-INJECT-V58` marker — this
  whole feature lives in the never-regenerated region, so edits go directly in
  `elastic-morph.html`, no `src/inject-vNN.js` involved) gains two new optional params: `yOff`
  (default 0) and `scale` (default 1), applied as `dx += xOff`, `dy += yOff`,
  `dw *= scale; dh *= scale` (re-centering after scale) — additive, the three existing types keep
  calling it exactly as before.
- **Push is two new named types, not a direction sub-field on Slide.** `slide-v` (vertical push)
  and `slide-d` (diagonal push) join `slide` (renamed in the UI label to "Slide Horizontal", value
  unchanged) as flat entries in the existing transition `<select>` — matches the current flat-list
  UI pattern, no new control needed.
- **Glitch reuses the existing FX Rack RGB-split/channel-isolation technique**
  (`chC`/`chctx` scratch canvas, multiply + `destination-in` per channel — see
  `elastic-morph.html` ~line 6341) rather than inventing a new distortion method, but scoped to
  just the two transitioning clips instead of the whole composited frame. Intensity (channel
  offset distance + horizontal slice-jitter amount) ramps up to a peak at `p ≈ 0.5` and back down
  to 0 at the transition edges, so it reads as a glitch burst *at* the cut rather than a
  glitch that's visible for the whole transition window.
- **No new per-clip config beyond the type dropdown.** Iris origin is always screen-center, Zoom
  always scales the incoming clip 0.3→1.0 (outgoing stays at scale 1), Glitch intensity is a fixed
  curve — consistent with how Wipe today has no configurable direction/edge either. If Frank wants
  knobs on any of these later, that's a follow-up, not part of this round.

## Rendering additions: `drawBgVideoTimeline(W, H)`

Same `if (type === ...)` chain as today, four new branches:

- **`iris`**: `drawClip(from.el, 1, 0)`; then clip a circle (`ctx.arc(W/2, H/2, p * Math.hypot(W,H)/2, 0, 2π)`), `drawClip(to.el, 1, 0)` inside it.
- **`zoom`**: `drawClip(from.el, 1-p, 0)` at scale 1; `drawClip(to.el, p, 0, 0, 0.3 + 0.7*p)` (new scale param).
- **`slide-v`**: same as `slide` but offsets are on `yOff` instead of `xOff`: `drawClip(from.el, 1, 0, -H*p)` / `drawClip(to.el, 1, 0, H*(1-p))`.
- **`slide-d`**: both `xOff` and `yOff` driven together (diagonal): `drawClip(from.el, 1, -W*p, -H*p)` / `drawClip(to.el, 1, W*(1-p), H*(1-p))`.
- **`glitch`**: draw each clip to a small offscreen scratch canvas at full opacity, run the
  existing channel-isolation loop (R/G/B offset by a `p`-weighted jitter amount) onto `chC`,
  composite `chC` onto the main canvas — `from` fading 1→0 and `to` fading 0→1 across the same `p`
  window as Dissolve, with the glitch jitter magnitude itself following a peak-at-0.5 envelope
  (e.g. `Math.sin(p * π)`).

## UI changes

- Both transition `<select>` elements (`#bgVidTLTransType` default-picker and the per-clip
  `#bgVidClipTrans` in the detail panel) get five new `<option>`s: Iris, Zoom-Cross,
  Slide Vertikal, Slide Diagonal, Glitch — plus relabeling the existing `slide` option's visible
  text to "Slide Horizontal" (value stays `slide`, so no migration needed for any transient
  session state).
- No other UI changes — duration slider, add/select/delete flow all unchanged.

## What's explicitly deferred

- Configurable Iris origin, Zoom scale range, Glitch intensity — fixed curves for this round, per
  "Locked decisions" above.
- HQ (offline/WebCodecs) export frame-accuracy for the Video Timeline remains out of scope,
  unchanged from the original design spec — these new transition types render live/real-time only,
  same as the existing three.

## Verification plan (to run once implemented)

- `npm run ci` green (378+ tests — new test coverage for each new transition branch, matching the
  existing Dissolve/Wipe/Slide test pattern in `test.js`).
- Live in-browser: force each new transition type via `S.bgVidTrans` at several `p` values (0, 0.5,
  1) and visually confirm the expected shape (circle growing for Iris, incoming clip visibly
  scaling for Zoom, vertical/diagonal motion for the two Push variants, visible channel-split +
  slice jitter peaking mid-transition for Glitch). Confirm the zero-cues legacy path and the three
  original transition types are pixel-behavior-unchanged.
- Confirm `git diff --stat elastic-morph.html` is empty after `npm run ci`, per
  `project_morph_build_pipeline_gotcha` (this feature lives entirely before the build-inject
  marker, so this should be a formality, but the check is cheap and non-negotiable).
