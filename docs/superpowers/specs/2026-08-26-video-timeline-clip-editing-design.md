# Video Timeline — Clip Editing (Images, Resize/Trim) — Design Spec

**Status:** Approved by Frank in sections, not yet built.

## Problem

Frank asked for three things on the Video Timeline editor, confirmed as one bundled ask:
1. Images should work in the timeline too, like Elastic Color ("Images sollten auch gehen im
   Video Editor wie bei Color").
2. Trimming — in/out points.
3. Reorder/length adjustment directly on the timeline.

Clarified through brainstorming:
- **Reorder** is already covered by the existing drag-block-to-reposition interaction
  (`bgVidTLPointerDown`/`bgVidTLPointerMove` in `elastic-morph.html`, ~line 9907) — no new work.
- **Trim** means adjusting how long a clip occupies on the *timeline* (drag the block's edges),
  not selecting an in/out range within the source footage. Source footage always plays from its
  own beginning for as long as the block is wide.
- **Images**: a static image clip, shown for a configurable duration, added the same way a video
  clip is today (file input / drag-and-drop onto the timeline).

## Locked decisions

- **Absolute cue positions stay** — no move to Elastic Color's gapless sequential-chain model.
  Confirmed explicitly: this was the single biggest architectural fork and Frank chose to keep
  matching the existing Set Editor / current Video Timeline paradigm.
- **`cue.dur` becomes a real, stored field**, not a derived value. Today
  `bgVidClipVisualDur(i)` (`elastic-morph.html` ~line 9832) computes the block's width live from
  `cue.el.duration` (video footage length) capped by the gap to the next cue — there is no
  stored duration at all. Going forward every cue carries its own `dur`, editable by dragging
  the block's edges. `bgVidClipVisualDur` becomes a thin wrapper: `Math.max(0.3, Math.min(cue.dur,
  gapToNext))` — same cap behavior as before (a clip can never *visually* run into the next
  clip's start), but the source-of-truth is now `cue.dur`, not something re-derived from the
  video element every frame.
- **Default `dur` on creation:** for a video clip, its own footage length (`el.duration`) once
  known — same effective behavior as today, just captured into a real field instead of
  recomputed each frame. For an image, a fixed **5 seconds** (no natural "length" to default to;
  5s is a reasonable slideshow default, adjustable immediately by dragging the right edge).
- **Video-longer-than-`dur` behavior is unchanged and needs no new code**: video elements already
  have `loop = true` (`addBgVidClipAt`), so dragging a clip's block *longer* than its own footage
  just loops the footage, exactly as it would today if the gap to the next clip happened to be
  wider than the footage. Dragging *shorter* simply ends that cue's active window earlier — also
  already how cue selection works (`updateBgVideoTimeline`'s scan for the active cue by `t`).
- **Images are a second element type on the same `cue.el`**, not a parallel data structure.
  `cue.el` is either an `HTMLVideoElement` (as today) or an `HTMLImageElement`. Every place that
  currently assumes "it's a video" needs a type branch or a shared readiness/dimensions helper —
  enumerated below. No new top-level state, no new `S.bgVidImageCues` array.

## Data model changes

```js
S.bgVidCues = [];  // [{ t, dur, name, src, el, kind, transType, transDur }]
```

- **`dur`** (new): timeline duration in seconds. Replaces the old fully-derived width calc as
  the source of truth; `bgVidClipVisualDur` still caps display width by the gap to the next cue.
- **`kind`** (new): `"video"` | `"image"`, set once at creation from the dropped file's MIME
  type. Used everywhere `cue.el`'s type would otherwise need a runtime `instanceof` check — an
  explicit field is cheaper to read than repeatedly testing `instanceof HTMLVideoElement`, and
  makes the branch points grep-able.
- Everything else (`t`, `name`, `src`, `el`, `transType`, `transDur`) is unchanged.

## Creating a clip: `addBgVidClipAt(t, file)`

Current version (`elastic-morph.html` ~line 9879) always builds a `<video>`. New version branches
on `file.type`:

```js
function addBgVidClipAt(t, file) {
  const isImage = file.type.startsWith("image");
  const url = URL.createObjectURL(file);
  let el, dur;
  if (isImage) {
    el = document.createElement("img");
    el.src = url;
    dur = 5;
  } else {
    el = document.createElement("video");
    el.src = url; el.loop = true; el.muted = true; el.playsInline = true; el.crossOrigin = "anonymous"; el.preload = "auto";
    el.addEventListener("loadedmetadata", () => {
      if (isFinite(el.duration)) cue.dur = el.duration;   // capture real footage length once known
      if (bgVidTLOpen) drawBgVidTL();
    });
    dur = 8;   // provisional, corrected by the loadedmetadata listener above once real duration is known
  }
  t = Math.max(0, Math.min(bgVidTLDuration(), t));
  const cue = { t, dur, name: file.name.replace(/\.[^.]+$/, ""), src: url, el, kind: isImage ? "image" : "video", transType: S.bgVidTransDefault.type, transDur: S.bgVidTransDefault.dur };
  S.bgVidCues.push(cue); sortBgVidCues();
  S.bgVidTLSel = S.bgVidCues.indexOf(cue);
  S.bgVid.on = true; $("bgVidOn").checked = true;
  renderBgVidTLPanel();
}
```

(The provisional `dur = 8` for videos before metadata loads matches today's existing fallback
value in `bgVidClipVisualDur` — same number, just moved to the point of creation instead of
being read every frame.)

## Rendering: `drawBgVideoTimeline` / `drawClip` / `drawGlitchClip`

All three transition-render helpers (`drawClip`, `drawGlitchClip` — both nested inside
`drawBgVideoTimeline`, ~line 4966) currently assume `el` is a `<video>`: they read
`el.readyState`, `el.videoWidth`/`el.videoHeight`, and pass `el` straight into `ctx.drawImage`.
`ctx.drawImage` itself already accepts an `<img>` element identically to a `<video>` element — the
only real work is the **readiness and natural-dimensions check**, which differs by element type.

Add one small shared helper near the top of `drawBgVideoTimeline`:

```js
function clipElReady(el) {
  if (!el) return null;
  if (el.tagName === "IMG") {
    return (el.complete && el.naturalWidth) ? { w: el.naturalWidth, h: el.naturalHeight } : null;
  }
  return (el.readyState >= 2 && el.videoWidth) ? { w: el.videoWidth, h: el.videoHeight } : null;
}
```

- In `drawClip`: replace `if (!el || el.readyState < 2) return; const vw = el.videoWidth, vh = el.videoHeight; if (!vw || !vh) return;` with `const dim = clipElReady(el); if (!dim) return; const vw = dim.w, vh = dim.h;`.
- In `drawGlitchClip`: same substitution at its own readiness check.
- `bgVidFilterCSS`'s scratch-canvas filter workaround (reused by both from the earlier
  filter-fix round) draws `el` into a scratch canvas via `drawImage` — this already works
  identically for `<img>` and `<video>` sources, no change needed there.

## Playback driving: `syncClipTime` / `updateBgVideoTimeline`

`syncClipTime(el, targetT)` (~line 4935) calls `el.currentTime = ...` and `el.play()` — neither
exists on `<img>`. Guard on `cue.kind`:

```js
function syncClipTime(el, targetT, kind) {
  if (!el || kind === "image") return;   // static images have no timeline position to sync
  if (Math.abs(el.currentTime - targetT) > 0.35) {
    try { el.currentTime = Math.max(0, targetT); } catch (e) { }
  }
  if (el.paused && S.playing) el.play().catch(() => { });
}
```

Both call sites in `updateBgVideoTimeline` pass `cue.kind` / `next.kind` through. An image cue
still gets assigned to `S.bgVid.el`/`S.bgVid.on` exactly like a video cue (rendering doesn't care
once `clipElReady` reports it ready) — it just never enters the seek/play branch.

## `bgVidClipVisualDur`: switch from derived to stored duration

Current (~line 9832):
```js
function bgVidClipVisualDur(i) {
  const cue = S.bgVidCues[i];
  const footage = (cue.el && cue.el.duration && isFinite(cue.el.duration)) ? cue.el.duration : 8;
  const nextT = i + 1 < S.bgVidCues.length ? S.bgVidCues[i + 1].t : bgVidTLDuration();
  return Math.max(0.3, Math.min(footage, nextT - cue.t));
}
```
New:
```js
function bgVidClipVisualDur(i) {
  const cue = S.bgVidCues[i];
  const nextT = i + 1 < S.bgVidCues.length ? S.bgVidCues[i + 1].t : bgVidTLDuration();
  return Math.max(0.3, Math.min(cue.dur, nextT - cue.t));
}
```
`cue.dur` is now the source of truth (set at creation, corrected once a video's real metadata
loads, editable by dragging edges) — this function goes back to being a pure display-clamp, not
a place that reads `cue.el.duration` at all.

## Cleanup: `deleteBgVidClip` / "Clear all" / the shared bgVid on/off checkbox

`deleteBgVidClip` and "Clear all" (~line 9899, ~line 9937) both call `cue.el.pause()`
unconditionally — guard with `if (cue.kind === "video") cue.el.pause();`.
`URL.revokeObjectURL(cue.src)` is unaffected (blob URLs work the same for both element types).

One more spot, found by grepping every `.el.play(` / `.el.pause(` in the file rather than trusting
the two call sites already covered above: the shared `#bgVidOn` checkbox's change handler
(`elastic-morph.html` ~line 8618, pre-existing — shared between the legacy single-video panel and
the Timeline feature, since `addBgVidClipAt` also flips this same checkbox on) calls
`S.bgVid.el.play()` / `S.bgVid.el.pause()` on whatever `S.bgVid.el` currently is — which, once a
Timeline image cue is active, is an `<img>` with neither method. Unlike the other two call sites,
this one has **no try/catch around `.play()`**, so toggling the checkbox while an image clip is
showing would throw. Fix:
```js
$("bgVidOn").addEventListener("change", e => {
  S.bgVid.on = e.target.checked;
  if (S.bgVid.el && S.bgVid.el.tagName !== "IMG") { if (S.bgVid.on) S.bgVid.el.play().catch(() => { }); else S.bgVid.el.pause(); }
});
```

## UI: drop / file-picker acceptance

- `$("bgVidTLInput")`'s `accept="video/*"` (~line 2118) becomes `accept="video/*,image/*"`.
- The timeline drop handler's `if (!f || !f.type.startsWith("video")) return;` (~line 9960)
  becomes `if (!f || !(f.type.startsWith("video") || f.type.startsWith("image"))) return;`.
- The **single-video legacy** background input (`$("bgVidInput")`, line 1801, a completely
  separate feature from the Video Timeline) is explicitly **not** touched — out of scope.

## UI: timeline block visual — kind indicator

`drawBgVidTL` (~line 9838) already draws a small cyan corner-triangle for clips with a real
transition. For images only (videos stay unmarked, matching today's look), draw the plain text
`"IMG"` at low opacity in the block's bottom-right corner, right after the existing `cue.name`
label draw call — plain canvas text to match the rest of this drawing code's style (no emoji
elsewhere in the timeline canvas), positioned bottom-right so it can't collide with the
transition indicator's existing top-left corner-triangle.

## UI: resize by dragging block edges

Extend `bgVidTLPointerDown`/`bgVidTLPointerMove` (~line 9907) with edge hit-testing. New module
state alongside the existing `bgVidTLDrag`/`bgVidTLScrub`:

```js
let bgVidTLResize = null;   // { cue, edge: "start" | "end" }
const EDGE_GRAB_PX = 6;
```

In `bgVidTLPointerDown`, when computing `hit` for a clicked block, also check proximity to its
left/right pixel edges *before* falling through to the existing "move" behavior:

```js
for (let i = 0; i < S.bgVidCues.length; i++) {
  const cue = S.bgVidCues[i];
  const x0 = cue.t / dur * W, w = Math.max(4, bgVidClipVisualDur(i) / dur * W);
  if (x >= x0 - EDGE_GRAB_PX && x <= x0 + EDGE_GRAB_PX) { bgVidTLResize = { cue, edge: "start" }; S.bgVidTLSel = i; renderBgVidTLPanel(); return; }
  if (x >= x0 + w - EDGE_GRAB_PX && x <= x0 + w + EDGE_GRAB_PX) { bgVidTLResize = { cue, edge: "end" }; S.bgVidTLSel = i; renderBgVidTLPanel(); return; }
  if (x >= x0 && x <= x0 + w) { hit = i; break; }
}
```

In `bgVidTLPointerMove`, handle the resize branch before the existing drag/scrub branches:

```js
if (bgVidTLResize) {
  const { cue, edge } = bgVidTLResize;
  const i = S.bgVidCues.indexOf(cue);
  const gapEnd = i + 1 < S.bgVidCues.length ? S.bgVidCues[i + 1].t : dur;
  const gapStart = i > 0 ? S.bgVidCues[i - 1].t : 0;
  const mouseT = Math.max(0, Math.min(dur, x / W * dur));
  if (edge === "end") {
    cue.dur = Math.max(0.3, Math.min(gapEnd - cue.t, mouseT - cue.t));
  } else {
    const end = cue.t + cue.dur;
    const newStart = Math.max(gapStart, Math.min(end - 0.3, mouseT));
    cue.t = newStart; cue.dur = end - newStart;
  }
  renderBgVidTLPanel();
  if (e.cancelable) e.preventDefault();
  return;
}
```

Both edges are clamped symmetrically: `end`-drag can't push past the *next* cue's start
(`gapEnd`), `start`-drag can't push past the *previous* cue's own start (`gapStart` — using the
previous cue's `t` rather than its own end, so you can still butt directly up against it, same
tolerance the existing gap-to-next cap already allows on the other side). Neither branch changes
`S.bgVidCues`' order, so no re-sort is needed — a resize only ever moves one edge within the slot
already bounded by its immediate neighbors.

`bgVidTLPointerUp` additionally clears `bgVidTLResize = null`.

**Cursor affordance:** set `bgVidTLTrack.style.cursor` in a `mousemove`-driven hover check (not
just during active drag) to `"ew-resize"` near an edge, `"grab"` over a block body,
`"crosshair"` elsewhere — matches the existing `cursor: crosshair` default already set in CSS
(~line 751), extended rather than replaced.

## What's explicitly deferred

- Numeric duration input in the detail panel (mirroring the existing transition-duration field)
  — drag-only for this round, per the approved design section. Easy follow-up if Frank wants
  keyboard-precise control later.
- Per-project default image duration setting — hardcoded 5s for this round.
- Thumbnails on timeline blocks (image or video preview frame) — out of scope, text label +
  kind glyph only, matching the existing video-clip block style.
- Source in/out trimming (which portion of a video's footage plays) — explicitly rejected by
  Frank during brainstorming in favor of timeline-duration-only trimming.
- HQ/offline export frame-accuracy for the Video Timeline — separate, already-deferred backlog
  item (Frank's own words from the original round: "das größere Export Thema später
  aufgreifen"), untouched by this spec.

## Verification plan (to run once implemented)

- `npm run ci` green, with new structural/behavioral tests for: `addBgVidClipAt` branching on
  image vs video MIME type and setting `kind`/`dur` correctly; `clipElReady` returning correct
  dimensions for both element types (and `null` for an unready one); `syncClipTime` no-op'ing for
  `kind === "image"`; the edge-hit-test math in `bgVidTLPointerDown`.
- Live in-browser: drop a `.jpg`/`.png` onto the timeline, confirm it appears as a clip, renders
  on the main canvas for its 5s window, participates correctly in a transition into/out of a
  neighboring video clip (dissolve at minimum — a transition between a video and a static image
  is new territory the existing transition math has never been exercised against). Drag both
  edges of a video clip and an image clip, confirm `dur` updates and the block width follows.
  Confirm a video dragged longer than its footage loops instead of freezing/blanking. Confirm
  `npm run ci` and `git diff --stat elastic-morph.html` stay clean per the standard
  build-pipeline-gotcha check.
