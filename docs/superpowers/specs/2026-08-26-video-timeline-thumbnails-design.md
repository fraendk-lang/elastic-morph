# Video Timeline — Clip Thumbnails — Design Spec

**Status:** Approved by Frank in sections.

## Problem

The Video Timeline editor (`drawBgVidTL`, `elastic-morph.html`) renders each clip as a plain
colored block with a text label. Frank raised this as one of four backlog items earlier today
("Thumbnails von Images oder Videos") — Waveform-Sichtbarkeit and Clip Fades from the same list
already shipped ([[project_morph_video_timeline_clip_fades]]), Crossfade was explicitly declined.
This is the last item: he wants a visual preview image on each block so he can identify which
video/image sits where without scrubbing through the timeline.

**Scope boundary (confirmed explicitly):** this only touches the Video Timeline *editor* UI
(`drawBgVidTL`, `addBgVidClipAt`). It does not touch live playback rendering
(`drawBgVideoTimeline`), HQ export (`renderExportFrame`), or `updateBgVideoTimeline` — none of
those draw or reference timeline-editor thumbnails. This is the first Video Timeline round today
that does NOT touch that shared function trio.

## Locked decisions

- **Video capture time:** seek to `min(0.5s, duration/2)` rather than `t=0` — the very first frame
  is often not yet decoded (renders black) or mid-fade-in; a frame slightly into the clip is more
  reliably representative.
- **Static, generated once:** thumbnails do NOT regenerate when a clip is trimmed via the existing
  drag-resize feature — trimming only changes the clip's position/duration on the timeline, never
  which source file it plays, so the thumbnail stays accurate.
- **Images need no generation step.** An `<img>` element is cheap to redraw directly every frame
  (the browser caches the decoded bitmap) and never changes — no seek, no cache canvas needed.
  Only video clips need a **cached** thumbnail, because drawing the live `<video>` element directly
  would show whatever frame playback last left it on (changes constantly during playback/scrubbing)
  instead of a stable identifying image.
- **Full-opacity thumbnail, covering the waveform backdrop within that clip's span.** The
  Waveform-Sichtbarkeit feature (`drawBgVidTL`'s cyan energy-curve backdrop, commit 63317a7) stays
  visible in the *gaps between* clips (where it's actually useful for placement) but gets fully
  covered inside a clip's own block once that clip has a thumbnail — confirmed explicitly with
  Frank as an acceptable trade-off, since the thumbnail is more useful there than the waveform.
- **Graceful fallback, no special-casing:** a clip with no thumbnail yet (still loading, or failed)
  renders exactly as it does today — plain colored block, no thumbnail draw attempted.

## `captureVideoClipThumb`: one-time cached video thumbnail

New function, called once from `addBgVidClipAt`'s existing `loadedmetadata` listener (the same
listener that already corrects the provisional 8s duration placeholder):

```js
function captureVideoClipThumb(cue) {
  const el = cue.el;
  const onSeeked = () => {
    clearTimeout(tid);
    el.removeEventListener("seeked", onSeeked);
    const vw = el.videoWidth, vh = el.videoHeight;
    if (!vw || !vh) return;
    const tc = document.createElement("canvas"), s = 120 / Math.max(vw, vh);
    tc.width = Math.max(1, Math.round(vw * s)); tc.height = Math.max(1, Math.round(vh * s));
    tc.getContext("2d").drawImage(el, 0, 0, tc.width, tc.height);
    cue.thumb = tc;
    if (bgVidTLOpen) drawBgVidTL();
  };
  el.addEventListener("seeked", onSeeked);
  const tid = setTimeout(() => el.removeEventListener("seeked", onSeeked), 2000);
  try { el.currentTime = Math.min(0.5, (el.duration || 1) / 2); }
  catch (e) { clearTimeout(tid); el.removeEventListener("seeked", onSeeked); }
}
```

This mirrors the exact async-seek pattern shipped today in `syncClipTime`
([[project_morph_hq_export_frame_accuracy]]'s final-review fix): attach the `seeked` listener
before writing `currentTime`, a 2000ms timeout fallback so a stuck seek can't leak a listener
forever, `clearTimeout` on the real event to avoid a dangling timer. `120` (px, long-edge cap) is
a fixed small cache size — cheap to store, cheap to redraw scaled into a timeline block of any
width; doesn't need to track the block's actual on-screen size since that varies with the
timeline's zoom/duration and blocks are redrawn from this cache every frame regardless.

**Call site** — inside `addBgVidClipAt`'s existing `loadedmetadata` listener
(`elastic-morph.html:9991-9996`):

```js
    el.addEventListener("loadedmetadata", () => {
      // Only correct the provisional 8s placeholder — if the user already trimmed cue.dur
      // (dragging the block's edge) before metadata finished loading, don't clobber their edit.
      if (isFinite(el.duration) && cue.dur === 8) cue.dur = el.duration;
      captureVideoClipThumb(cue);
      if (bgVidTLOpen) drawBgVidTL();
    });
```

(Only the one new line, `captureVideoClipThumb(cue);`, is added — everything else in that listener
is unchanged.)

## `drawBgVidTL`: draw the thumbnail into each block, clipped and cover-fit

Current cue-drawing loop (`elastic-morph.html:9936-9954`):
```js
  S.bgVidCues.forEach((cue, i) => {
    const x0 = cue.t / dur * W, w = Math.max(4, bgVidClipVisualDur(i) / dur * W), sel = i === S.bgVidTLSel;
    c.fillStyle = sel ? "rgba(139,92,246,0.45)" : "rgba(139,92,246,0.22)";
    c.strokeStyle = sel ? "#ffffff" : "#8b5cf6"; c.lineWidth = sel ? 2 : 1;
    c.fillRect(x0, H * 0.12, w, H * 0.76);
    c.strokeRect(x0, H * 0.12, w, H * 0.76);
    c.fillStyle = sel ? "#ffffff" : "#d8ccfa";
    c.font = "11px -apple-system, sans-serif"; c.textAlign = "left";
    c.fillText(cue.name || "Clip", x0 + 5, H * 0.12 + 14);
    if (cue.transType && cue.transType !== "cut" && cue.transDur > 0) {
      c.fillStyle = "#4be1e8";
      c.beginPath(); c.moveTo(x0, H * 0.12); c.lineTo(x0 + 10, H * 0.12); c.lineTo(x0, H * 0.12 + 10); c.closePath(); c.fill();
    }
    if (cue.kind === "image") {
      c.fillStyle = "rgba(216,204,250,0.55)";
      c.font = "9px -apple-system, sans-serif"; c.textAlign = "right";
      c.fillText("IMG", x0 + w - 4, H * 0.12 + H * 0.76 - 4);
      c.textAlign = "left";
    }
  });
```

New — one thumbnail-drawing block inserted right after `x0`/`w`/`sel` are computed, before the
existing purple fill (which stays, now acting as a selection-state tint layered *on top of* the
thumbnail — unchanged in its own right):

```js
  S.bgVidCues.forEach((cue, i) => {
    const x0 = cue.t / dur * W, w = Math.max(4, bgVidClipVisualDur(i) / dur * W), sel = i === S.bgVidTLSel;
    const by = H * 0.12, bh = H * 0.76;
    const src = cue.kind === "image" ? cue.el : cue.thumb;
    const dim = cue.kind === "image" ? clipElReady(cue.el) : (cue.thumb ? { w: cue.thumb.width, h: cue.thumb.height } : null);
    if (src && dim) {
      c.save();
      c.beginPath(); c.rect(x0, by, w, bh); c.clip();
      const s = Math.max(w / dim.w, bh / dim.h), dw = dim.w * s, dh = dim.h * s;
      c.drawImage(src, x0 + (w - dw) / 2, by + (bh - dh) / 2, dw, dh);
      c.restore();
    }
    c.fillStyle = sel ? "rgba(139,92,246,0.45)" : "rgba(139,92,246,0.22)";
    c.strokeStyle = sel ? "#ffffff" : "#8b5cf6"; c.lineWidth = sel ? 2 : 1;
    c.fillRect(x0, by, w, bh);
    c.strokeRect(x0, by, w, bh);
    c.fillStyle = sel ? "#ffffff" : "#d8ccfa";
    c.font = "11px -apple-system, sans-serif"; c.textAlign = "left";
    c.fillText(cue.name || "Clip", x0 + 5, by + 14);
    if (cue.transType && cue.transType !== "cut" && cue.transDur > 0) {
      c.fillStyle = "#4be1e8";
      c.beginPath(); c.moveTo(x0, by); c.lineTo(x0 + 10, by); c.lineTo(x0, by + 10); c.closePath(); c.fill();
    }
    if (cue.kind === "image") {
      c.fillStyle = "rgba(216,204,250,0.55)";
      c.font = "9px -apple-system, sans-serif"; c.textAlign = "right";
      c.fillText("IMG", x0 + w - 4, by + bh - 4);
      c.textAlign = "left";
    }
  });
```

`H * 0.12` and `H * 0.76` are pulled into local `by`/`bh` purely to avoid repeating the same
arithmetic five times in the expanded block — every other line, and every literal value, is
unchanged. Uses `clipElReady` (already shipped, `elastic-morph.html:5039`) for image dimensions —
the exact same readiness/dimension helper `drawBgVideoTimeline`'s `drawClip` already uses, so an
image that hasn't finished loading yet (`clipElReady` returns `null`) simply skips the thumbnail
draw for that frame and retries next frame, no new fallback logic needed. Scaling always uses
`Math.max(...)` (cover-fit, crop-to-fill) — unlike `drawClip`'s live-playback path, which respects
the user's `cover`/`contain` toggle, timeline thumbnails are small identifying previews, not the
actual composited visual, so there's no equivalent toggle to respect here.

## Data model

One new cue field, `thumb` — a video-only, lazily-set property. It's never added to
`addBgVidClipAt`'s cue object literal; it simply doesn't exist on a cue until
`captureVideoClipThumb` sets it once the first captured frame is ready. Every read site
(`cue.thumb`) already treats it as a truthy check, so `undefined` (not yet set) and a populated
canvas are the only two states that matter — no separate `null` initialization needed. Image clips
never set this field at all; they read `cue.el` directly every frame instead. **Not serialized** —
this is a purely local,
regeneratable render cache tied to the loaded video element, exactly like the already-existing
transient fields (`S.bgVid._active`, `S.bgVid._fadeAlpha`); it must never appear in the explicit
field list used to serialize presets/share-links (confirmed: that list already only covers
`S.bgVid`'s own persisted fields, not `cue` objects, and cues themselves are never persisted across
sessions today — this spec doesn't change that boundary either way, just noting it for clarity).

## What's explicitly deferred

- No thumbnail regeneration on trim/resize (locked decision above).
- No thumbnail for the legacy single-background-video path (`drawBgVideo`, outside the Timeline) —
  it has no editor block to put a thumbnail on; out of scope by construction.
- No user-configurable capture time (e.g. "use the frame at the clip's actual visible portion
  after trimming") — the fixed `min(0.5s, duration/2)` approach was explicitly chosen for
  simplicity; not worth the added complexity for a preview thumbnail.

## Verification plan (to run once implemented)

- `npm run ci` green, with tests for: `captureVideoClipThumb` (structural — confirms the listener
  is attached before the seek is triggered, the timeout fallback exists, and `clearTimeout` is
  wired on the real `seeked` event, matching the established `syncClipTime` test style) and
  `drawBgVidTL`'s new thumbnail-drawing block (structural — confirms the clip/cover-fit math and
  that it runs before the existing fill/stroke, for both `kind: "image"` and `kind: "video"` with
  a populated `cue.thumb`).
- Live in-browser: add a real video clip and a real image clip to the timeline, confirm both show
  a recognizable preview inside their blocks (not black/blank), confirm the video thumbnail stays
  stable while the timeline plays through that clip (doesn't flicker to the live playback frame),
  confirm a clip still shows its plain-block fallback in the brief window before its thumbnail is
  ready, confirm the waveform backdrop is still visible in the gaps between clips.
- Confirm `npm run ci` and `git diff --stat elastic-morph.html` stay clean per the standard
  build-pipeline-gotcha check.
