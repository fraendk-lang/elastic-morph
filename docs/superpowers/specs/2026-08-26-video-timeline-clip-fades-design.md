# Video Timeline — Clip Fades — Design Spec

**Status:** Approved by Frank in sections, not yet built.

## Problem

The Video Timeline has cross-clip transitions (Dissolve/Wipe/Slide/Iris/Zoom/Glitch) but no way
for a single clip to fade in/out at its own edges independent of a neighbor. A lone clip, the
very first clip's start, the very last clip's end, either side of a gap, or any `cut`-type
boundary always pops in/out as a hard cut — there's no softer alternative that doesn't require a
second clip to cross-dissolve against.

## Locked decisions

- **Fades only apply where no cross-clip transition already exists at that edge.** A clip's own
  `fadeIn` never fires if it has a real incoming transition (`cue.transType !== "cut" &&
  cue.transDur > 0` AND a previous clip actually exists to transition from — see "First-clip
  edge case" below); `fadeOut` never fires if the next clip's incoming transition is real. Fades
  and transitions never stack or interact — confirmed as the simplest, least-surprising choice
  over "always apply, potentially layered with a transition."
- **Fade to black, video-layer only.** The background-video layer's own pixels fade toward
  solid black; the DNA-visual layer (drawn afterward, on top, every frame regardless) is
  completely unaffected and keeps running normally through the fade. This is *not* the same as
  simply lowering the clip's draw alpha — see "Rendering" below for why a real black overlay is
  needed, not just an alpha reduction.
- **Two new per-cue fields, `fadeIn`/`fadeOut` (seconds), default `0` (opt-in).** New and
  existing clips behave exactly as before (hard cut) until the user explicitly sets a fade
  duration — matches how `transDur` already defaults away from surprising behavior.
- **UI: two numeric inputs in the existing detail panel** (`renderBgVidTLPanel()`), styled and
  wired identically to the existing `transDur` input (`<input type="number" min="0" max="8"
  step="0.1">` + a `change` listener writing straight to the cue).

## First-clip edge case

`cue.transType` defaults to `S.bgVidTransDefault.type` ("dissolve") for every new clip,
*including the very first one ever added* — but a transition can only actually trigger when a
previous cue exists to transition *from* (`updateBgVideoTimeline`'s transition dispatch requires
a valid `cue` already active before checking `next`'s transition fields). So a first clip's own
`transType`/`transDur` are inert data, never causing a real transition, even though they're
non-`"cut"` by default. Checking `cue.transType`/`cue.transDur` alone to decide "does fade-in
apply" would therefore wrongly conclude "yes, there's a transition, skip the fade" for the first
clip. Fix: the fade-in check must also confirm the cue isn't first in the sorted array
(`idx > 0`), not just look at its `transType` fields.

## Data model changes

```js
S.bgVidCues = [];  // [{ t, dur, name, src, el, kind, fadeIn, fadeOut, transType, transDur }]
```

- **`fadeIn`** (new, default `0`): seconds to fade in from black at this clip's own start,
  applied only when no real incoming transition exists.
- **`fadeOut`** (new, default `0`): seconds to fade out to black before this clip's own end,
  applied only when no real outgoing transition exists.

## Playback: fade-alpha computed in `updateBgVideoTimeline`

`updateBgVideoTimeline(t)` already has `cue`, `idx`, `next`, and `t` in scope every frame — the
fade progress is computed there (once, per frame) into a new transient field, `S.bgVid._fadeAlpha`,
mirroring the existing `S.bgVid._active` transient-flag pattern (not persisted, not serialized —
same reasoning as that earlier fix: this is a render-time decision, not a saved setting).

Insert this block *after* the existing `if (cue && cue.el) { ... } else { ... }` block that sets
`S.bgVid.el`/`_active` (both `cue` and `next` are already defined by that point) and *before* the
transition-dispatch `if (cue && next && ...)` block that follows it — order relative to the
transition dispatch doesn't affect correctness (fade suppression only reads `next.transType`/
`next.transDur`, which the dispatch block doesn't mutate), this placement just keeps the
function's data-computation steps grouped ahead of its dispatch/side-effect steps.

```js
let fadeAlpha = 1;
if (cue) {
  const elapsed = t - cue.t;
  const remaining = (cue.t + cue.dur) - t;
  const hasIncomingTransition = idx > 0 && cue.transType !== "cut" && cue.transDur > 0;
  const hasOutgoingTransition = next && next.transType !== "cut" && next.transDur > 0;
  if (!hasIncomingTransition && cue.fadeIn > 0 && elapsed < cue.fadeIn) {
    fadeAlpha = Math.min(fadeAlpha, Math.max(0, elapsed / cue.fadeIn));
  }
  if (!hasOutgoingTransition && cue.fadeOut > 0 && remaining < cue.fadeOut) {
    fadeAlpha = Math.min(fadeAlpha, Math.max(0, remaining / cue.fadeOut));
  }
}
S.bgVid._fadeAlpha = fadeAlpha;
```

Taking the `Math.min` of both fade windows (rather than e.g. only checking one) means a clip
short enough that its fade-in and fade-out windows overlap degrades gracefully — it never
flashes to full opacity between two overlapping ramps, it just uses whichever ramp has faded it
further at that instant.

## Rendering: why alpha alone isn't enough, and what actually happens

`drawScene()` does **not** clear the canvas to solid black each frame — right before
`drawBgVideoTimeline(W, H)` is called, a low-alpha near-black wash is painted for the DNA
organism's motion-trail effect (`ctx.fillStyle = "rgba(2,2,6,<small alpha>)"; ctx.fillRect(...)`),
which *fades* the previous frame's content rather than replacing it. That means whatever the DNA
layer drew last frame is still faintly present underneath where the background video paints this
frame. Simply lowering the clip's `drawClip` alpha would fade the video toward that trail
residue — visible ghostly DNA remnants, not clean black.

Fix: in `drawBgVideoTimeline`'s existing no-active-transition branch (`if (!S.bgVidTrans) {
drawClip(v.el, 1, 0); return; }`, added in an earlier round this session), draw the clip at full
alpha as already happens, then composite an explicit black rectangle on top scaled by how faded
the clip currently is:

```js
if (!S.bgVidTrans) {
  drawClip(v.el, 1, 0);
  const fa = v._fadeAlpha;
  if (fa !== undefined && fa < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - fa;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  return;
}
```

This genuinely occludes any trail residue (the black rect is opaque at `fa = 0`, fully see-through
at `fa = 1`) and only affects this one draw call — the DNA layer, drawn by a separate call
immediately after `drawBgVideoTimeline` returns, is untouched and keeps rendering normally
through the fade, exactly as decided above.

**Not touched:** the transition branch (`dissolve`/`wipe`/etc.) is a completely separate code
path below this `if`, so fades never interact with an active cross-clip transition — this falls
out naturally from the branch structure, no extra guard needed there.

## UI: `renderBgVidTLPanel()`

Add two fields to the existing template-string build, after the `transDur` input and before the
Delete button:

```js
`<label>Fade In <input type="number" id="bgVidClipFadeIn" min="0" max="8" step="0.1" value="${cue.fadeIn || 0}" style="width:48px;background:#0a0a12;color:var(--text);border:1px solid var(--line);border-radius:4px;padding:2px 4px;font-size:11px"></label>` +
`<label>Fade Out <input type="number" id="bgVidClipFadeOut" min="0" max="8" step="0.1" value="${cue.fadeOut || 0}" style="width:48px;background:#0a0a12;color:var(--text);border:1px solid var(--line);border-radius:4px;padding:2px 4px;font-size:11px"></label>` +
```

Plus two `change` listeners writing straight to the cue, matching the existing `transDur`
listener's style:

```js
$("bgVidClipFadeIn").addEventListener("change", e => cue.fadeIn = +e.target.value);
$("bgVidClipFadeOut").addEventListener("change", e => cue.fadeOut = +e.target.value);
```

## `addBgVidClipAt`: new cues default to no fade

Add `fadeIn: 0, fadeOut: 0` to the cue object literal built in `addBgVidClipAt`, alongside the
existing `kind`/`transType`/`transDur` fields — opt-in, matches every existing clip's implicit
default (undefined `fadeIn`/`fadeOut` on any cue created before this field existed would also
read as falsy/`0` via `cue.fadeIn || 0` wherever it's consumed, so this isn't strictly required
for correctness, but setting it explicitly at creation keeps the cue shape self-documenting and
consistent with how `dur`/`kind` were introduced in the prior round).

## What's explicitly deferred

- No numeric cap tying `fadeIn + fadeOut` to `cue.dur` — an overlapping/too-long fade pair
  degrades gracefully via the `Math.min` computation above, not a crash or a visual snap; no
  extra validation needed.
- No fade curve options (linear only) — matches the existing transition system's own linear `p`
  progress, no round-trip asked for anything else.
- No global default fade duration — every new clip opts in individually, per the locked
  decision above.

## Verification plan (to run once implemented)

- `npm run ci` green, with new tests for: the fade-alpha computation in `updateBgVideoTimeline`
  (behavioral, via `loadFns` + a mock multi-cue scenario, following the precedent set by this
  session's `updateBgVideoTimeline` dur-cutoff tests — cover: no fade set, fade-in only,
  fade-out only, overlapping fade-in+fade-out on a short clip, first-clip-with-default-transType
  edge case, fade suppressed by a real incoming/outgoing transition); the black-overlay
  compositing logic in `drawBgVideoTimeline` (structural, `extractFn`+`.includes()`, matching
  this codebase's convention for canvas-drawing code); the new UI fields' presence and wiring.
- Live in-browser: add a lone clip with no neighbors, set `fadeIn`/`fadeOut`, confirm it fades
  from/to black smoothly with the DNA visual continuing to animate normally underneath/around it
  throughout. Confirm a clip with a real Dissolve transition into it ignores `fadeIn` even if
  set (transition wins). Confirm the very first clip on an otherwise-empty timeline fades in
  correctly despite its default `transType: "dissolve"`. Confirm `npm run ci` and `git diff
  --stat elastic-morph.html` stay clean per the standard build-pipeline-gotcha check.
