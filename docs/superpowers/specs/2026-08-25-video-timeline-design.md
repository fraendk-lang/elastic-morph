# Video Timeline — Design Spec

**Status:** Shipped 2026-08-25. Written after implementation (design was worked out
conversationally, then built and verified in the same session) rather than before — see
"How this round went" at the end.

## Problem

Elastic Morph's Background Video feature only supports a single video file for the whole
track. Frank wanted to place multiple video clips at different points along the song, the way
a Set Editor cue places a scene change — inspired by comparing to Elastic Color's clip-drop
timeline (which turned out to use a different, sequential-chain model) and to DaVinci Resolve's
overlapping-clip transitions.

## Locked decisions

- **Absolute song-time positions**, not a sequential chain. Each clip has a fixed start time in
  the song (`cue.t`), draggable, gaps allowed — matches the existing Set Editor's cue model
  exactly, not Elastic Color's insert-at-index/trim-edges model.
- **True DaVinci-style transitions**: during the overlap window both clips are decoded and
  composited simultaneously (dissolve/wipe/slide), not a fade-through-black cut-hiding trick
  (which is what the existing Set Editor's "Fade"/"Blur" scene transitions actually do — a
  different, cheaper technique that doesn't apply well to raw video).
- **HQ (deterministic offline) export frame-accuracy is explicitly out of scope for this round.**
  Frank: "dann fang an und ggf. müssen wir das größere Export Thema später aufgreifen. Wichtig
  ist eine nahtlose Performance." The live-playback path is real-time video-element based and
  was the priority; a frame-accurate seek-based exporter for multiple video sources is a
  separate, larger piece of work, deferred.
- **Additive, zero-regression**: if no clips are added to the timeline, behavior is byte-for-byte
  the original single-video `drawBgVideo()` path. All existing `S.bgVid` settings (opacity,
  blend, filter, cover-fit) stay global and shared across every clip — only the video *source*
  differs per clip, not its rendering settings.
- **Not persisted across reload/project-save**, matching the existing single-video limitation
  (`.el`/`.src` are a live DOM element + blob URL, excluded from `projectData()` already). Each
  clip's `<video>` element and blob URL only exist for the current browser session.

## Data model

```js
S.bgVidCues = [];              // [{ t, name, src, el, transType, transDur }]
S.bgVidTLSel = -1;              // selected clip index in the editor UI
S.bgVidTransDefault = { type: "dissolve", dur: 1 };  // default for newly-added clips
S.bgVidTrans = null;            // transient per-frame: { from, to, p, type } while transitioning
```

`transType`/`transDur` on a cue describe the transition **into** that clip, relative to the
previous one — same convention as the Set Editor's `cue.trans`/`cue.transDur`.

## Live playback: `updateBgVideoTimeline(t)`

Called every frame from both the live rAF loop (`frame()`, right after the existing
`updateCues()`, passing `curTimeSec()`) and the deterministic offline export
(`renderExportFrame`, passing its own computed `t`) — one shared source of truth for "which clip
is active at time t", mirroring exactly how Set cues are already looked up in both places.

1. Find the active cue: the last cue whose `t <= now`.
2. Sync that clip's `<video>.currentTime` to `now - cue.t` (seeking if drifted or paused) — this
   is what makes scrubbing the song correctly scrub into the middle of whichever clip is active,
   not just resume wherever the video happened to be.
3. Write the active clip's element into `S.bgVid.el`/`.src` so the existing single-clip
   `drawBgVideo()` draw path needs no changes for the non-transitioning case.
4. If the *next* cue's transition window has started (`t >= next.t - next.transDur`), also sync
   and play the next clip's element (from its own t=0), and set `S.bgVidTrans` with the
   transition progress `p`.

## Rendering: `drawBgVideoTimeline(W, H)`

- No cues → delegates straight to the original `drawBgVideo(W, H)`. Zero risk to the existing
  feature.
- Cues exist, not transitioning → also delegates to `drawBgVideo(W, H)` (which now reads whatever
  `S.bgVid.el` was set to by step 3 above).
- Transitioning → draws both clips via a shared `drawClip(el, alpha, xOffset)` helper (same
  cover/contain-fit math as the original, reusing `S.bgVid.opacity/blend/cover`):
  - **Dissolve**: `drawClip(from, 1-p, 0)` then `drawClip(to, p, 0)`.
  - **Wipe**: draw `from` full, then clip a `[0, W*p]` rect and draw `to` inside it.
  - **Slide**: `drawClip(from, 1, -W*p)` and `drawClip(to, 1, W*(1-p))` — push-out/push-in.

## UI: Video Timeline editor

A new full-screen overlay (`#bgVidTLOverlay`/`#bgVidTLCard`), CSS and interaction pattern copied
directly from the existing Set Editor (`#setOverlay`/`#setCard`, `.set-panel`, `.set-pill`
classes reused as-is): a canvas timeline (`#bgVidTLTrack`) with the song's energy-curve waveform
as a backdrop, clip blocks (width = `min(own footage duration, gap to next cue)`), a live
playhead, click-to-scrub / click-block-to-select / drag-block-to-reposition, and a detail panel
for the selected clip's transition type + duration. Opened via a new "🎬 Open Video Timeline"
button placed directly under the existing single-video controls in the Background Video panel.

## What's explicitly deferred

- **HQ export frame-accuracy** (see "Locked decisions" above) — the cue-selection logic itself
  runs deterministically during export via `renderExportFrame`, but the underlying `<video>`
  element seek is not guaranteed frame-perfect the way the audio-feature timeline is. Real-time
  capture export will show the correct clip/transition; the offline WebCodecs path may not, yet.
- No preload *window* / LRU cache — every clip's `<video>` element is created (with
  `preload="auto"`) as soon as it's added to the timeline and left to the browser's own
  buffering. Fine for realistic clip counts; would need revisiting for timelines with dozens of
  clips.
- No chained/overlapping-with-more-than-one-neighbor transitions — a clip's transition window is
  only checked against its immediate predecessor.

## Verification performed

Live in-browser (Browser pane, `npm start` dev server): fetched the repo's own demo MP4 as a
test file, added two clips via `addBgVidClipAt()`, confirmed both render on the timeline canvas
correctly (block position/width, transition indicator, detail panel). Forced the transition
window via `updateBgVideoTimeline(t)` at several `t` values and confirmed `S.bgVidTrans` computes
the right type/progress for dissolve, wipe, and slide. Visually confirmed on the main canvas that
during a Slide transition the two halves show genuinely different video frames — proof the two
clips' `<video>` elements track independent playback offsets correctly, not just a visual
overlay of the same frame. Tested drag-to-reposition and Delete in the editor UI. Confirmed the
zero-cues legacy path (a fresh single-video upload, exactly as before this feature existed)
still renders identically. Zero console errors throughout. `npm run ci`: 378/378 passing, and
`git diff --stat` after the rebuild matched exactly the intended edit (no silent reversion from
the `build.js` region-regeneration gotcha — this edit lives entirely before the
`@BUILD-INJECT-V58` marker).

## How this round went

Unlike the smaller single-question-then-build rounds earlier in the session, this one went
through a real back-and-forth: Frank's initial idea → a proposal with a technical tradeoff
(video swap hitch, HQ export complexity) → confirmation to proceed → a safety git tag
(`baseline-before-multivideo-timeline`) at his request → investigating Elastic Color's actual
clip-timeline mechanism as a reference (which turned out to be a *different* model than assumed,
worth checking rather than guessing) → a locked decision on the positioning model → a transitions
follow-up referencing DaVinci, which required distinguishing "true crossfade" from the existing
Set Editor's fade-through-black trick → a final confirm-and-build. Worth remembering as the
shape a bigger feature request takes in this project, versus the lighter single-round DNA-engine
additions.
