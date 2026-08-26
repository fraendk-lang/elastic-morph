# Video Timeline — Clip Editing (Images, Resize/Trim) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add image-clip support and drag-edge resize/trim to the Elastic Morph Video Timeline editor, per the approved design spec.

**Architecture:** `cue.el` becomes either an `HTMLVideoElement` (as today) or an `HTMLImageElement`, distinguished by a new `cue.kind` field (`"video"` | `"image"`). A new `cue.dur` field becomes the stored source of truth for how long a clip occupies the timeline, replacing the fully-derived width calculation that used to read `cue.el.duration` every frame. Every function that assumed "it's a video" gets either a `kind` branch or routes through a new shared `clipElReady(el)` helper that abstracts the readiness/natural-dimensions check for both element types. A new drag-edge interaction (`bgVidTLResize`) extends the existing timeline pointer handlers to let the block's start/end move independently, writing directly to `cue.t`/`cue.dur`.

**Tech Stack:** Vanilla JS, HTML5 Canvas 2D, `<video>`/`<img>` elements. Same zero-dependency `test.js` harness as the rest of the codebase — `extractFn` + structural (`fn.includes(...)`) assertions for DOM/canvas-heavy code, `loadFns` + mock objects with getter/setter tracking for the small number of functions clean enough to test behaviorally (this plan uses that technique for `clipElReady` and `bgVidClipVisualDur`, following the precedent set by `syncClipTime`'s tests in the "Video Timeline — clip-start hitch fix" section of `test.js`).

## Global Constraints

- Every edit in this plan lands in `elastic-morph.html` before line 9981 (`@BUILD-INJECT-V58`, re-verify with `grep -n "@BUILD-INJECT-V58" elastic-morph.html` before starting — it has drifted several times today) — never touch `src/inject-vNN.js` for this work.
- After every task's code change, run `npm run ci` (`node build.js && node test.js`) and confirm `git diff --stat elastic-morph.html` is empty post-build.
- Absolute cue positions (`cue.t`) are kept — this plan never introduces a sequential/chained model. No task reorders `S.bgVidCues` except via the existing `sortBgVidCues()`.
- Source in/out trimming (which part of a video's footage plays) is explicitly out of scope — "trim" in this plan means only the stored timeline duration `cue.dur`, adjustable by dragging a block's edges.
- No numeric duration input field, no per-project default image duration setting, no timeline-block thumbnails — all explicitly deferred per the spec.
- Default `cue.dur` on creation: video = own footage length once known (provisional `8` before `loadedmetadata` fires, matching today's existing fallback), image = `5`.
- Edge-grab tolerance is `6` pixels (`EDGE_GRAB_PX`). Minimum clip duration after any resize is `0.3` seconds.

---

### Task 1: Data model — `addBgVidClipAt` branches on file type, `bgVidClipVisualDur` uses stored `cue.dur`

**Files:**
- Modify: `elastic-morph.html:9833-9838` (`bgVidClipVisualDur`)
- Modify: `elastic-morph.html:9885-9896` (`addBgVidClipAt`)
- Test: `test.js`

**Interfaces:**
- Produces: every `S.bgVidCues` entry now has `dur` (number, seconds) and `kind` (`"video"` | `"image"`) fields, in addition to the existing `t`, `name`, `src`, `el`, `transType`, `transDur`. Later tasks read `cue.kind`/`cue.dur` by these exact names.

- [ ] **Step 1: Write the failing tests**

Add to `test.js`, in a new section (place it right after the existing "Video Timeline — clip-start hitch fix" section, before "Video Timeline UI — transition type selects"):

```js
/* ---------------- Video Timeline: clip editing (images, resize/trim) ---------------- */
section("Video Timeline clip editing — data model (addBgVidClipAt, bgVidClipVisualDur)");

ok("addBgVidClipAt branches on file.type to detect images", (() => {
  const fn = extractFn("addBgVidClipAt");
  return !!fn && fn.includes('const isImage = file.type.startsWith("image");');
})());

ok("addBgVidClipAt creates an <img> for images and a <video> for everything else", (() => {
  const fn = extractFn("addBgVidClipAt");
  return !!fn
    && fn.includes('el = document.createElement("img");')
    && fn.includes('el = document.createElement("video");');
})());

ok("addBgVidClipAt defaults image duration to 5s and video's provisional duration to 8s", (() => {
  const fn = extractFn("addBgVidClipAt");
  return !!fn && fn.includes("dur = 5;") && fn.includes("dur = 8;");
})());

ok("addBgVidClipAt's video loadedmetadata listener corrects cue.dur once real footage length is known", (() => {
  const fn = extractFn("addBgVidClipAt");
  return !!fn && fn.includes("if (isFinite(el.duration)) cue.dur = el.duration;");
})());

ok("addBgVidClipAt stores kind on the cue", (() => {
  const fn = extractFn("addBgVidClipAt");
  return !!fn && fn.includes('kind: isImage ? "image" : "video"') && fn.includes("dur,") ;
})());

(() => {
  global.S = { bgVidCues: [{ t: 2, dur: 10 }, { t: 5, dur: 3 }] };
  global.bgVidTLDuration = () => 20;
  try {
    const { bgVidClipVisualDur } = loadFns(["bgVidClipVisualDur"]);
    ok("bgVidClipVisualDur caps a clip's stored dur by the gap to the next clip",
      bgVidClipVisualDur(0) === 3);   // dur=10, but next clip starts at t=5, gap=3
    ok("bgVidClipVisualDur uses the clip's own dur when it's smaller than the remaining gap",
      bgVidClipVisualDur(1) === 3);   // dur=3, gap to timeline end=20-5=15, dur wins
  } catch (e) {
    ok("bgVidClipVisualDur caps a clip's stored dur by the gap to the next clip", false, e.message);
    ok("bgVidClipVisualDur uses the clip's own dur when it's smaller than the remaining gap", false);
  } finally {
    delete global.S; delete global.bgVidTLDuration;
  }
})();

ok("bgVidClipVisualDur no longer reads cue.el.duration (fully replaced by stored cue.dur)", (() => {
  const fn = extractFn("bgVidClipVisualDur");
  return !!fn && !fn.includes("cue.el.duration") && !fn.includes("cue.el &&");
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "clip editing — data model"`
Expected: all new assertions print `✗` (none of this code exists yet).

- [ ] **Step 3: Write minimal implementation**

Replace `bgVidClipVisualDur` (currently `elastic-morph.html:9833-9838`):

```js
function bgVidClipVisualDur(i) {
  const cue = S.bgVidCues[i];
  const nextT = i + 1 < S.bgVidCues.length ? S.bgVidCues[i + 1].t : bgVidTLDuration();
  return Math.max(0.3, Math.min(cue.dur, nextT - cue.t));
}
```

Replace `addBgVidClipAt` (currently `elastic-morph.html:9885-9896`):

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
      if (isFinite(el.duration)) cue.dur = el.duration;
      if (bgVidTLOpen) drawBgVidTL();
    });
    dur = 8;
  }
  t = Math.max(0, Math.min(bgVidTLDuration(), t));
  const cue = { t, dur, name: file.name.replace(/\.[^.]+$/, ""), src: url, el, kind: isImage ? "image" : "video", transType: S.bgVidTransDefault.type, transDur: S.bgVidTransDefault.dur };
  S.bgVidCues.push(cue); sortBgVidCues();
  S.bgVidTLSel = S.bgVidCues.indexOf(cue);
  S.bgVid.on = true; $("bgVidOn").checked = true;
  renderBgVidTLPanel();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "clip editing — data model"`
Expected: all assertions print `✓`.

- [ ] **Step 5: Run full suite and check for build drift**

Run: `npm run ci` — expect all tests passing, 0 failed.
Run: `git diff --stat elastic-morph.html` — expect empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: Video Timeline cues gain kind/dur fields, addBgVidClipAt supports images"
```

---

### Task 2: `clipElReady` helper wired into `drawClip` and `drawGlitchClip`

**Files:**
- Modify: `elastic-morph.html:4972-5050` (inside `drawBgVideoTimeline` — `drawClip` at 4976-4979, `drawGlitchClip` at 5004-5007; exact line numbers may have shifted by Task 1's edits, search for `const drawClip = (el, alpha, xOff` and `const drawGlitchClip = (el, alpha, envelope)`)
- Test: `test.js`

**Interfaces:**
- Consumes: `cue.kind`/element shape from Task 1 (an `<img>` has `tagName === "IMG"`, `.complete`, `.naturalWidth`/`.naturalHeight`; a `<video>` has `.readyState`, `.videoWidth`/`.videoHeight`).
- Produces: `clipElReady(el)` — a new function defined once near the top of `drawBgVideoTimeline`, returning `{ w, h }` or `null`. No other task calls this function directly, but it establishes the readiness-check pattern that must not regress for existing video-only behavior.

- [ ] **Step 1: Write the failing tests**

```js
section("Video Timeline clip editing — clipElReady + drawClip/drawGlitchClip readiness");

(() => {
  try {
    const { clipElReady } = loadFns(["clipElReady"]);
    const readyVideo = { tagName: "VIDEO", readyState: 4, videoWidth: 1920, videoHeight: 1080 };
    const unreadyVideo = { tagName: "VIDEO", readyState: 1, videoWidth: 0, videoHeight: 0 };
    const readyImage = { tagName: "IMG", complete: true, naturalWidth: 800, naturalHeight: 600 };
    const unreadyImage = { tagName: "IMG", complete: false, naturalWidth: 0, naturalHeight: 0 };
    ok("clipElReady returns dimensions for a ready video", JSON.stringify(clipElReady(readyVideo)) === JSON.stringify({ w: 1920, h: 1080 }));
    ok("clipElReady returns null for an unready video (readyState < 2)", clipElReady(unreadyVideo) === null);
    ok("clipElReady returns dimensions for a ready image", JSON.stringify(clipElReady(readyImage)) === JSON.stringify({ w: 800, h: 600 }));
    ok("clipElReady returns null for an unready image (not complete)", clipElReady(unreadyImage) === null);
    ok("clipElReady returns null for a null/undefined element", clipElReady(null) === null);
  } catch (e) {
    ok("clipElReady returns dimensions for a ready video", false, e.message);
    ok("clipElReady returns null for an unready video (readyState < 2)", false);
    ok("clipElReady returns dimensions for a ready image", false);
    ok("clipElReady returns null for an unready image (not complete)", false);
    ok("clipElReady returns null for a null/undefined element", false);
  }
})();

ok("drawClip uses clipElReady instead of a raw readyState/videoWidth check", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes("const dim = clipElReady(el); if (!dim) return; const vw = dim.w, vh = dim.h;")
    && !fn.includes("if (!el || el.readyState < 2) return;\n    const vw = el.videoWidth, vh = el.videoHeight;\n    if (!vw || !vh) return;\n    const s = v.cover");
})());

ok("drawGlitchClip uses clipElReady instead of a raw readyState/videoWidth check", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn && fn.includes("const dim = clipElReady(el); if (!dim) return; const vw = dim.w, vh = dim.h;\n    const hw = Math.max(1, Math.round(W / 2))");
})());
```

**Note on the last two assertions:** since `drawClip` and `drawGlitchClip` will use an *identical* substitution line (`const dim = clipElReady(el); if (!dim) return; const vw = dim.w, vh = dim.h;`), the second assertion's extra context (`\n    const hw = Math.max(1, Math.round(W / 2))`) is what disambiguates "this is inside `drawGlitchClip` specifically" from the same line appearing in `drawClip` — copy that anchoring pattern exactly, it is required for the test to mean anything (a bare `fn.includes(...)` on the shared substitution line alone would pass even if only `drawClip` were fixed and `drawGlitchClip` were untouched).

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "clipElReady\|drawClip uses\|drawGlitchClip uses"`
Expected: all `✗`.

- [ ] **Step 3: Write minimal implementation**

Add `clipElReady` as a new top-level function (not nested — place it directly above `function drawBgVideoTimeline(W, H) {`, so it's reusable and independently `extractFn`-able):

```js
function clipElReady(el) {
  if (!el) return null;
  if (el.tagName === "IMG") {
    return (el.complete && el.naturalWidth) ? { w: el.naturalWidth, h: el.naturalHeight } : null;
  }
  return (el.readyState >= 2 && el.videoWidth) ? { w: el.videoWidth, h: el.videoHeight } : null;
}
```

In `drawClip`, replace:
```js
    if (!el || el.readyState < 2) return;
    const vw = el.videoWidth, vh = el.videoHeight;
    if (!vw || !vh) return;
```
with:
```js
    const dim = clipElReady(el); if (!dim) return; const vw = dim.w, vh = dim.h;
```

In `drawGlitchClip`, replace:
```js
    if (!el || el.readyState < 2 || envelope <= 0.02) { drawClip(el, alpha, 0); return; }
    const vw = el.videoWidth, vh = el.videoHeight;
    if (!vw || !vh) return;
```
with:
```js
    if (!el || envelope <= 0.02) { drawClip(el, alpha, 0); return; }
    const dim = clipElReady(el); if (!dim) return; const vw = dim.w, vh = dim.h;
```

(The `envelope <= 0.02` early-out is kept as its own check ahead of `clipElReady` — it's a transition-progress gate, not a readiness gate, and must still short-circuit to the plain `drawClip` fallback exactly as before.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "clipElReady\|drawClip uses\|drawGlitchClip uses"`
Expected: all `✓`.

- [ ] **Step 5: Run full suite and check for build drift**

Run: `npm run ci` — 0 failed. Run: `git diff --stat elastic-morph.html` — empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add clipElReady helper, wire into drawClip/drawGlitchClip for image support"
```

---

### Task 3: `syncClipTime` and `updateBgVideoTimeline` become kind-aware

**Files:**
- Modify: `elastic-morph.html:4935-4947` (`syncClipTime`)
- Modify: `elastic-morph.html:4949-4970` (`updateBgVideoTimeline`)
- Test: `test.js`

**Interfaces:**
- Consumes: `cue.kind` from Task 1.
- Produces: `syncClipTime(el, targetT, kind)` — third parameter added, optional (existing 2-arg call sites elsewhere would still behave as before, treating a missing `kind` as non-image). `updateBgVideoTimeline` passes `cue.kind`/`next.kind` at both existing call sites.

- [ ] **Step 1: Write the failing tests**

The existing "Video Timeline — clip-start hitch fix (syncClipTime)" section in `test.js` wraps
its tests in a `(() => { ... })()` IIFE that defines a local `makeMockEl` helper — that helper is
**not** visible outside that IIFE, so the new kind-aware tests must be inserted *inside* it, not
appended after it as separate top-level code. Find the IIFE (search `test.js` for
`function makeMockEl`) and locate its existing structure:

```js
(() => {
  function makeMockEl(initialCurrentTime, paused) { /* ... unchanged ... */ }

  global.S = { playing: true };
  try {
    const { syncClipTime } = loadFns(["syncClipTime"]);
    /* ... 4 existing ok(...) blocks ... */
    ok("syncClipTime does not call play() when the song itself isn't playing (S.playing = false)",
      !elSongPaused._playCalled());
  } catch (e) {
    /* ... 4 existing ok(..., false, ...) blocks ... */
    ok("syncClipTime does not call play() when the song itself isn't playing (S.playing = false)", false);
  } finally {
    delete global.S;
  }
})();
```

Insert three new `ok(...)` calls into the `try` block, immediately after the last existing one
(`ok("syncClipTime does not call play() when the song itself isn't playing...", ...)`), and their
three matching `false`-branch counterparts into the `catch` block in the same relative position
(matching this file's established pattern of one line per assertion in both branches):

```js
    // --- new for Task 3 of the clip-editing plan, inserted before the closing `} catch (e) {` ---
    const imgEl = makeMockEl(0, true);
    syncClipTime(imgEl, 3, "image");
    ok("syncClipTime is a no-op for kind='image' (no seek, no play)",
      imgEl._seekCount() === 0 && !imgEl._playCalled());

    const vidEl = makeMockEl(0, true);
    syncClipTime(vidEl, 0.1, "video");
    ok("syncClipTime still behaves normally for kind='video'", vidEl._playCalled() && vidEl._seekCount() === 0);

    const vidElNoKind = makeMockEl(0, true);
    syncClipTime(vidElNoKind, 0.1);
    ok("syncClipTime treats a missing kind argument as video (backward compatible)", vidElNoKind._playCalled());
```

and, in the `catch (e) {` block, immediately after the existing last `false` assertion there:

```js
    ok("syncClipTime is a no-op for kind='image' (no seek, no play)", false, e.message);
    ok("syncClipTime still behaves normally for kind='video'", false);
    ok("syncClipTime treats a missing kind argument as video (backward compatible)", false);
```

Then, as separate new top-level code (outside that IIFE, in the new "clip editing" section this
plan's Task 1 already started — place these two `ok(...)` calls after it):

```js
ok("updateBgVideoTimeline passes cue.kind to syncClipTime for the active cue", (() => {
  const fn = extractFn("updateBgVideoTimeline");
  return !!fn && fn.includes("syncClipTime(cue.el, t - cue.t, cue.kind);");
})());

ok("updateBgVideoTimeline passes next.kind to syncClipTime for the incoming transition clip", (() => {
  const fn = extractFn("updateBgVideoTimeline");
  return !!fn && fn.includes("syncClipTime(next.el, t - winStart, next.kind);");
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "kind='image'\|kind='video'\|missing kind\|passes cue.kind\|passes next.kind"`
Expected: all `✗`.

- [ ] **Step 3: Write minimal implementation**

Replace `syncClipTime` (currently `elastic-morph.html:4935-4947`) — add the `kind` parameter and the image early-out, keep the existing comment and drift-check logic untouched:

```js
function syncClipTime(el, targetT, kind) {
  if (!el || kind === "image") return;
  // Only seek when actually out of sync (>0.35s drift) — NOT just because the clip is
  // paused. A currentTime write is a real browser-level seek even when the target equals
  // the video's current position: readyState drops (HAVE_NOTHING/HAVE_METADATA) for a
  // couple frames while it "re-settles", which paints as a brief pop/hitch right as every
  // clip starts. Clips normally start already sitting at (or very near) their correct
  // position, so this redundant self-seek was firing on essentially every clip activation.
  if (Math.abs(el.currentTime - targetT) > 0.35) {
    try { el.currentTime = Math.max(0, targetT); } catch (e) { }
  }
  if (el.paused && S.playing) el.play().catch(() => { });
}
```

In `updateBgVideoTimeline`, change the two `syncClipTime` call sites:
```js
  if (cue && cue.el) {
    syncClipTime(cue.el, t - cue.t, cue.kind);
    S.bgVid.el = cue.el; S.bgVid.src = cue.src; S.bgVid.on = true;
  }

  if (cue && next && next.el && next.transType && next.transType !== "cut" && next.transDur > 0) {
    const winStart = next.t - next.transDur;
    if (t >= winStart && t < next.t) {
      syncClipTime(next.el, t - winStart, next.kind);
```
(Only the `syncClipTime(...)` lines themselves change — everything else in the function body is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "kind='image'\|kind='video'\|missing kind\|passes cue.kind\|passes next.kind"`
Expected: all `✓`.

- [ ] **Step 5: Run full suite and check for build drift**

Run: `npm run ci` — 0 failed. Run: `git diff --stat elastic-morph.html` — empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: syncClipTime and updateBgVideoTimeline become kind-aware (skip seek/play for images)"
```

---

### Task 4: Cleanup guards — delete, Clear-all, and the `#bgVidOn` checkbox handler

**Files:**
- Modify: `elastic-morph.html:9897-9905` (`deleteBgVidClip`)
- Modify: `~elastic-morph.html:9935-9940` (the "Clear all" `$("bgVidTLClearBtn")` click handler — search for `bgVidTLClearBtn` to confirm the exact current line, it sits a few lines after `bgVidTLPointerUp`)
- Modify: `elastic-morph.html:8618-8621` (`$("bgVidOn")` change handler)
- Test: `test.js`

**Interfaces:**
- Consumes: `cue.kind` from Task 1.
- Produces: nothing new for later tasks — this task only hardens existing cleanup/toggle code against the new element type.

- [ ] **Step 1: Write the failing tests**

```js
section("Video Timeline clip editing — cleanup guards for image cues");

ok("deleteBgVidClip only calls .pause() on video-kind cues", (() => {
  const fn = extractFn("deleteBgVidClip");
  return !!fn && fn.includes('if (cue.kind === "video") cue.el.pause();') && !fn.includes("cue.el.pause();\n  try { URL.revokeObjectURL");
})());

ok("the Clear-all handler only calls .pause() on video-kind cues", (() => {
  return script.includes('S.bgVidCues.forEach(cue => { if (cue.kind === "video") cue.el.pause(); try { URL.revokeObjectURL(cue.src); } catch (e) { } });');
})());

ok("#bgVidOn's change handler does not call .play()/.pause() on an <img> element", (() => {
  return script.includes('if (S.bgVid.el && S.bgVid.el.tagName !== "IMG") { if (S.bgVid.on) S.bgVid.el.play().catch(() => { }); else S.bgVid.el.pause(); }');
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "only calls .pause\|does not call .play"`
Expected: all `✗`.

- [ ] **Step 3: Write minimal implementation**

Replace `deleteBgVidClip` (currently `elastic-morph.html:9897-9905`):

```js
function deleteBgVidClip(i) {
  if (i < 0 || i >= S.bgVidCues.length) return;
  const cue = S.bgVidCues[i];
  if (cue.kind === "video") cue.el.pause();
  try { URL.revokeObjectURL(cue.src); } catch (e) { }
  S.bgVidCues.splice(i, 1);
  S.bgVidTLSel = -1;
  renderBgVidTLPanel();
}
```

(Dropped the `try { cue.el.pause(); } catch (e) { }` wrapper's try/catch since the call is now
conditional on `kind === "video"` — a video's own `.pause()` doesn't throw under normal
conditions, and this matches the equally bare `deleteBgVidClip`/`Clear-all` style already used for
the `URL.revokeObjectURL` line below it.)

Find and replace the "Clear all" button handler (search for `bgVidTLClearBtn`):

```js
$("bgVidTLClearBtn").addEventListener("click", () => {
  if (S.bgVidCues.length && confirm("Alle Video-Clips entfernen?")) {
    S.bgVidCues.forEach(cue => { if (cue.kind === "video") cue.el.pause(); try { URL.revokeObjectURL(cue.src); } catch (e) { } });
    S.bgVidCues = []; S.bgVidTLSel = -1; renderBgVidTLPanel();
  }
});
```

Replace the `$("bgVidOn")` change handler (currently `elastic-morph.html:8618-8621`):

```js
$("bgVidOn").addEventListener("change", e => {
  S.bgVid.on = e.target.checked;
  if (S.bgVid.el && S.bgVid.el.tagName !== "IMG") { if (S.bgVid.on) S.bgVid.el.play().catch(() => { }); else S.bgVid.el.pause(); }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "only calls .pause\|does not call .play"`
Expected: all `✓`.

- [ ] **Step 5: Run full suite and check for build drift**

Run: `npm run ci` — 0 failed. Run: `git diff --stat elastic-morph.html` — empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "fix: guard video-only cleanup/toggle calls against image-kind Video Timeline cues"
```

---

### Task 5: UI — accept images in the file picker and drop zone, show an IMG glyph on the timeline

**Files:**
- Modify: `elastic-morph.html:2118` (`#bgVidTLInput`'s `accept` attribute)
- Modify: `~elastic-morph.html:9956-9964` (the timeline's `"drop"` event handler — search for `bgVidTLTrack.addEventListener("drop"`)
- Modify: `elastic-morph.html:9839-9868` (`drawBgVidTL`)
- Test: `test.js`

**Interfaces:**
- Consumes: `cue.kind` from Task 1.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing tests**

```js
section("Video Timeline clip editing — UI: image file acceptance + IMG glyph");

ok("#bgVidTLInput accepts both video and image files", html.includes('<input type="file" id="bgVidTLInput" accept="video/*,image/*" hidden>'));

ok("the legacy single-video #bgVidInput is untouched (still video-only, out of scope)", html.includes('<input type="file" id="bgVidInput" accept="video/*" hidden>'));

ok("the timeline drop handler accepts both video and image files", (() => {
  return script.includes('if (!f || !(f.type.startsWith("video") || f.type.startsWith("image"))) return;');
})());

ok("drawBgVidTL draws an IMG label for image-kind cues only", (() => {
  const fn = extractFn("drawBgVidTL");
  return !!fn
    && fn.includes('if (cue.kind === "image") {')
    && fn.includes('c.fillText("IMG",');
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "accepts both video\|untouched\|IMG label"`
Expected: the three new-behavior assertions print `✗`; the "legacy single-video #bgVidInput is untouched" assertion prints `✓` already (it's a negative-space check confirming you haven't touched it — leave it green throughout, it's here to catch an accidental edit in the wrong input).

- [ ] **Step 3: Write minimal implementation**

In `elastic-morph.html:2118`, change:
```html
    <input type="file" id="bgVidTLInput" accept="video/*" hidden>
```
to:
```html
    <input type="file" id="bgVidTLInput" accept="video/*,image/*" hidden>
```

In the timeline drop handler, change:
```js
  const f = e.dataTransfer.files[0];
  if (!f || !f.type.startsWith("video")) return;
```
to:
```js
  const f = e.dataTransfer.files[0];
  if (!f || !(f.type.startsWith("video") || f.type.startsWith("image"))) return;
```

In `drawBgVidTL`, inside the `S.bgVidCues.forEach((cue, i) => { ... })` block, immediately after the existing transition-indicator triangle block (`if (cue.transType && cue.transType !== "cut" && cue.transDur > 0) { ... }`), add:

```js
    if (cue.kind === "image") {
      c.fillStyle = "rgba(216,204,250,0.55)";
      c.font = "9px -apple-system, sans-serif"; c.textAlign = "right";
      c.fillText("IMG", x0 + w - 4, H * 0.12 + H * 0.76 - 4);
      c.textAlign = "left";
    }
```

(Bottom-right placement, small/low-opacity text — the transition triangle stays top-left, so
the two indicators never collide. `c.textAlign` is reset to `"left"` afterward since the next
loop iteration's `cue.name` label draw call — earlier in this same `forEach` — relies on that
default.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "accepts both video\|untouched\|IMG label"`
Expected: all `✓`.

- [ ] **Step 5: Run full suite and check for build drift**

Run: `npm run ci` — 0 failed. Run: `git diff --stat elastic-morph.html` — empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: accept image files in the Video Timeline editor, show an IMG glyph on image clips"
```

---

### Task 6: Drag-edge resize/trim

**Files:**
- Modify: `elastic-morph.html:9815` (module-scope state declaration)
- Modify: `elastic-morph.html:9907-9926` (`bgVidTLPointerDown`, `bgVidTLPointerMove`, `bgVidTLPointerUp`)
- Test: `test.js`

**Interfaces:**
- Consumes: `bgVidClipVisualDur(i)` from Task 1 (unchanged signature), `S.bgVidCues[i].t`/`.dur`.
- Produces: `bgVidTLResize` module-scope variable (`{ cue, edge: "start" | "end" } | null`) — no other task reads this, it's internal to the three pointer-handler functions.

- [ ] **Step 1: Write the failing tests**

```js
section("Video Timeline clip editing — drag-edge resize/trim");

ok("bgVidTLResize state variable is declared alongside bgVidTLDrag/bgVidTLScrub", (() => {
  return script.includes("let bgVidTLOpen = false, bgVidTLDrag = null, bgVidTLScrub = false, bgVidTLResize = null;");
})());

ok("EDGE_GRAB_PX constant is 6", script.includes("const EDGE_GRAB_PX = 6;"));

ok("bgVidTLPointerDown checks for an edge hit before falling through to body-drag/scrub", (() => {
  const fn = extractFn("bgVidTLPointerDown");
  return !!fn
    && fn.includes('bgVidTLResize = { cue, edge: "start" };')
    && fn.includes('bgVidTLResize = { cue, edge: "end" };');
})());

ok("bgVidTLPointerMove handles the resize branch, clamping end-drag to the next cue's start and start-drag to the previous cue's start", (() => {
  const fn = extractFn("bgVidTLPointerMove");
  return !!fn
    && fn.includes("if (bgVidTLResize) {")
    && fn.includes("cue.dur = Math.max(0.3, Math.min(gapEnd - cue.t, mouseT - cue.t));")
    && fn.includes("const newStart = Math.max(gapStart, Math.min(end - 0.3, mouseT));")
    && fn.includes("cue.t = newStart; cue.dur = end - newStart;");
})());

ok("bgVidTLPointerUp clears bgVidTLResize", (() => {
  const fn = extractFn("bgVidTLPointerUp");
  return !!fn && fn.includes("bgVidTLResize = null;");
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "bgVidTLResize\|EDGE_GRAB_PX\|edge hit\|resize branch\|clears bgVidTLResize"`
Expected: all `✗`.

- [ ] **Step 3: Write minimal implementation**

Change the module-scope declaration at `elastic-morph.html:9815`:
```js
let bgVidTLOpen = false, bgVidTLDrag = null, bgVidTLScrub = false;
```
to:
```js
let bgVidTLOpen = false, bgVidTLDrag = null, bgVidTLScrub = false, bgVidTLResize = null;
const EDGE_GRAB_PX = 6;
```

Replace `bgVidTLPointerDown` (currently `elastic-morph.html:9907-9917`):

```js
function bgVidTLPointerDown(e) {
  const r = bgVidTLTrack.getBoundingClientRect(), W = bgVidTLTrack.width, dur = bgVidTLDuration();
  const x = (bgVidClientXOf(e) - r.left) / r.width * W;
  let hit = -1;
  for (let i = 0; i < S.bgVidCues.length; i++) {
    const cue = S.bgVidCues[i];
    const x0 = cue.t / dur * W, w = Math.max(4, bgVidClipVisualDur(i) / dur * W);
    if (x >= x0 - EDGE_GRAB_PX && x <= x0 + EDGE_GRAB_PX) { bgVidTLResize = { cue, edge: "start" }; S.bgVidTLSel = i; renderBgVidTLPanel(); return; }
    if (x >= x0 + w - EDGE_GRAB_PX && x <= x0 + w + EDGE_GRAB_PX) { bgVidTLResize = { cue, edge: "end" }; S.bgVidTLSel = i; renderBgVidTLPanel(); return; }
    if (x >= x0 && x <= x0 + w) { hit = i; break; }
  }
  if (hit >= 0) { S.bgVidTLSel = hit; bgVidTLDrag = S.bgVidCues[hit]; renderBgVidTLPanel(); }
  else { bgVidTLScrub = true; seekFraction(Math.max(0, Math.min(1, x / W))); }
}
```

Replace `bgVidTLPointerMove` (currently `elastic-morph.html:9918-9925`):

```js
function bgVidTLPointerMove(e) {
  if (!bgVidTLOpen || (!bgVidTLDrag && !bgVidTLScrub && !bgVidTLResize)) return;
  const r = bgVidTLTrack.getBoundingClientRect(), W = bgVidTLTrack.width, dur = bgVidTLDuration();
  const x = (bgVidClientXOf(e) - r.left) / r.width * W;
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
  } else if (bgVidTLDrag) {
    bgVidTLDrag.t = Math.max(0, Math.min(dur, x / W * dur)); sortBgVidCues(); S.bgVidTLSel = S.bgVidCues.indexOf(bgVidTLDrag); renderBgVidTLPanel();
  } else if (bgVidTLScrub) {
    seekFraction(Math.max(0, Math.min(1, x / W)));
  }
  if (e.cancelable) e.preventDefault();
}
```

Replace `bgVidTLPointerUp` (currently `elastic-morph.html:9926`):

```js
function bgVidTLPointerUp() { bgVidTLDrag = null; bgVidTLScrub = false; bgVidTLResize = null; }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "bgVidTLResize\|EDGE_GRAB_PX\|edge hit\|resize branch\|clears bgVidTLResize"`
Expected: all `✓`.

- [ ] **Step 5: Run full suite and check for build drift**

Run: `npm run ci` — 0 failed. Run: `git diff --stat elastic-morph.html` — empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: drag-edge resize/trim for Video Timeline clip blocks"
```

---

### Task 7: Live verification and push

**Files:** none (verification only)

**Interfaces:** none — terminal task.

- [ ] **Step 1: Start a dev server and open the Video Timeline editor**

Check the port situation first — `.claude/launch.json` points at 3456, which has repeatedly been
occupied this session by an unrelated `npm start` process from a separate checkout at
`~/Desktop/Elastic Morph Cursor`. Check with `lsof -i :3456 -sTCP:LISTEN`; if occupied, start a
dedicated server on a free port instead: `npx --yes serve -l 3459` (or any free port), then point
the browser at `http://localhost:<port>/elastic-morph.html`. Confirm you're looking at fresh
code (not the other checkout) by checking `clipElReady.toString()` in the console — it should
exist and return the implementation from Task 2.

- [ ] **Step 2: Add an image clip and confirm it renders**

Open the Video Timeline editor, drag a `.jpg`/`.png` file onto the timeline track (or use
"+ Clip @ Playhead" after selecting an image via the file picker). Confirm: it appears on the
timeline as a block with an "IMG" label, its default width corresponds to 5 seconds, and it
shows on the main canvas while its cue is active (drag the playhead / let the song play through
its window).

- [ ] **Step 3: Add a video clip next to it and confirm a transition works between an image and a video**

Add a video clip immediately after the image clip with a `dissolve` transition. Force
`S.bgVidTrans` via console at `p = 0.5` (same technique used in earlier Video Timeline
verification rounds this session — see the "Video Timeline — more transition types" plan's Task
7 for the exact console pattern) and confirm both halves render correctly — this exercises
`drawClip`'s `clipElReady` branch for an image on one side and a video on the other
simultaneously, which no automated test in this plan actually renders pixels for.

- [ ] **Step 4: Drag both edges of a video clip's block**

Select a video clip, drag its right edge to shrink it well below its own footage length, confirm
it now cuts off earlier during playback. Drag it longer than its footage length, confirm the
video loops (native `loop = true` behavior) rather than freezing or going blank. Drag the left
edge and confirm the clip's start time moves while its end stays fixed, and that you cannot drag
either edge past the neighboring clip.

- [ ] **Step 5: Confirm the `#bgVidOn` checkbox doesn't throw while an image is active**

With an image clip's window active (`S.bgVid.el` pointing at the `<img>`), toggle the
`#bgVidOn` checkbox off and back on via the UI. Check the browser console for errors — there
should be none (this is the exact crash Task 4 fixed).

- [ ] **Step 6: Confirm the legacy zero-cues path and existing video-only workflows are unchanged**

Clear all clips (`S.bgVidCues = []`), confirm a plain single background video (via the legacy
`#bgVidInput`, not the Timeline) still works exactly as before. Re-add only video clips (no
images) and confirm resize/drag/transitions all behave identically to how they did before this
plan — this plan must not change video-only behavior at all when no image clips are involved.

- [ ] **Step 7: Final full-suite run and build-drift check**

Run: `npm run ci` — expect all tests passing, 0 failed.
Run: `git diff --stat elastic-morph.html` — expect empty.
Run: `git status` — expect clean (everything already committed across Tasks 1-6).

- [ ] **Step 8: Push**

```bash
git push origin main
```

(Requires the Bash tool's `dangerouslyDisableSandbox: true` flag in this environment, or `git push` hangs indefinitely — see the `git-sandbox-network-blocker` memory.)

- [ ] **Step 9: Confirm live**

Compare local vs. live `elastic-morph.html` via SHA-256 (`shasum -a 256 elastic-morph.html` vs.
`curl -s https://elasticmorph.app/elastic-morph.html | shasum -a 256`) — they must match exactly,
following the same standard this session has used for every prior Video Timeline round. Wait and
recheck if Vercel hasn't finished deploying yet rather than reporting success prematurely.
