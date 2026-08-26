# Video Timeline — Clip Thumbnails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a preview image on each Video Timeline editor block so Frank can visually identify which video/image sits where without scrubbing.

**Architecture:** Image clips draw their already-loaded `<img>` element directly every frame (cheap, never changes). Video clips get a one-time-generated, cached thumbnail canvas (`cue.thumb`) captured via an async seek-and-draw, mirroring today's `syncClipTime` pattern — because drawing the live `<video>` element directly would show whatever frame playback last left it on, not a stable identifying image. `drawBgVidTL` draws whichever source applies, clipped and cover-fit into each timeline block, underneath the existing selection-tint fill.

**Tech Stack:** Vanilla JS, Canvas 2D API. No new dependencies.

## Global Constraints

- Every edit lands in `elastic-morph.html` before the `@BUILD-INJECT-V58` marker (currently line 10110 — verify fresh with `grep -n "@BUILD-INJECT-V58" elastic-morph.html`, it drifts).
- After every code change, run `npm run ci` (runs `build.js` then `test.js`) and confirm `git diff --stat elastic-morph.html` is empty afterward — `build.js` must never touch anything in the pre-marker region.
- This feature does NOT touch `updateBgVideoTimeline`, `drawBgVideoTimeline`, `syncClipTime`, or `renderExportFrame`/HQ export — it is purely Video Timeline *editor*-UI (`drawBgVidTL`, `addBgVidClipAt`). No live-playback or export-time behavior changes.
- Video capture time is `Math.min(0.5, (el.duration || 1) / 2)` — never `t=0`.
- Thumbnails are generated once and never regenerate on trim/resize.
- `git fetch`/`git push` require the Bash tool's `dangerouslyDisableSandbox: true` flag in this environment, or they hang indefinitely.

---

### Task 1: `captureVideoClipThumb` — one-time cached video thumbnail

**Files:**
- Modify: `elastic-morph.html` (new function, placed directly above `addBgVidClipAt` — verify current line with `grep -n "function addBgVidClipAt" elastic-morph.html`)
- Modify: `elastic-morph.html` (`addBgVidClipAt`'s existing `loadedmetadata` listener — verify current line with `grep -n "function addBgVidClipAt" elastic-morph.html` then read ~25 lines from there)
- Test: `test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `captureVideoClipThumb(cue)` — takes a cue object with a `.el` (`<video>` element). On success, sets `cue.thumb` to a small `<canvas>` (long edge 120px, cover-fit-scaled from `el.videoWidth`/`el.videoHeight`) once the captured frame is ready. Never returns anything meaningful (fire-and-forget, matching the existing `loadedmetadata` listener's style). Task 2 reads `cue.thumb` (video clips) or `cue.el` (image clips) directly — no other interface between the tasks.

- [ ] **Step 1: Write the failing tests**

Read the existing "HQ Export frame accuracy" test section first (`grep -n "makeSeekableMockEl" test.js`) to see the established async-mock-element style this mirrors — you don't need to change that section, just match its conventions.

Add this new section to `test.js`, immediately after the last `finally { ... }` block of the "HQ Export frame accuracy" section (search for `delete global.S;\n}\n\n(() => {` — insert *before* that trailing IIFE block, i.e. right after the third `finally { delete global.S; }` closes):

```js
/* ---------------- Video Timeline: clip thumbnails ---------------- */
section("Video Timeline thumbnails — captureVideoClipThumb");

function makeThumbMockVideoEl(duration, videoWidth, videoHeight) {
  let ct = 0;
  const listeners = { seeked: [] };
  const el = {
    get currentTime() { return ct; },
    set currentTime(v) { ct = v; },
    duration, videoWidth, videoHeight,
    addEventListener(evt, fn) { if (listeners[evt]) listeners[evt].push(fn); },
    removeEventListener(evt, fn) { if (listeners[evt]) listeners[evt] = listeners[evt].filter(f => f !== fn); }
  };
  el._fireSeeked = () => { listeners.seeked.slice().forEach(fn => fn()); };
  el._seekedListenerCount = () => listeners.seeked.length;
  return el;
}

global.bgVidTLOpen = false;
try {
  const { captureVideoClipThumb } = loadFns(["captureVideoClipThumb"]);

  const canvases = [];
  global.document = {
    createElement(tag) {
      const c = { _tag: tag, width: 0, height: 0, _drawImageCalls: 0 };
      c.getContext = () => ({ drawImage: () => { c._drawImageCalls++; } });
      canvases.push(c);
      return c;
    }
  };

  const el1 = makeThumbMockVideoEl(10, 1920, 1080);
  const cue1 = { el: el1 };
  captureVideoClipThumb(cue1);
  ok("captureVideoClipThumb attaches the 'seeked' listener before the seek lands (synchronously registered)",
    el1._seekedListenerCount() === 1);
  ok("captureVideoClipThumb seeks to the 0.5s cap when duration/2 (5s) would be further out",
    el1.currentTime === 0.5);

  el1._fireSeeked();
  ok("on 'seeked', the listener is removed (no leak)", el1._seekedListenerCount() === 0);
  ok("on 'seeked', a cached thumbnail canvas is created and drawn into exactly once",
    !!cue1.thumb && cue1.thumb._drawImageCalls === 1);
  ok("the cached thumbnail is scaled so its long edge is 120px (1920x1080 -> 120x68 rounded)",
    cue1.thumb.width === 120 && cue1.thumb.height === 68);

  const el2 = makeThumbMockVideoEl(0.4, 640, 480);
  const cue2 = { el: el2 };
  captureVideoClipThumb(cue2);
  ok("captureVideoClipThumb seeks to duration/2 (0.2s) when that's less than the 0.5s cap",
    el2.currentTime === 0.2);

  const el3 = makeThumbMockVideoEl(10, 0, 0);
  const cue3 = { el: el3 };
  captureVideoClipThumb(cue3);
  el3._fireSeeked();
  ok("when videoWidth/videoHeight are still 0 at 'seeked' time (metadata not really ready), no thumbnail is created",
    cue3.thumb === undefined);
} catch (e) {
  ok("captureVideoClipThumb attaches the 'seeked' listener before the seek lands (synchronously registered)", false, e.message);
  ok("captureVideoClipThumb seeks to the 0.5s cap when duration/2 (5s) would be further out", false);
  ok("on 'seeked', the listener is removed (no leak)", false);
  ok("on 'seeked', a cached thumbnail canvas is created and drawn into exactly once", false);
  ok("the cached thumbnail is scaled so its long edge is 120px (1920x1080 -> 120x68 rounded)", false);
  ok("captureVideoClipThumb seeks to duration/2 (0.2s) when that's less than the 0.5s cap", false);
  ok("when videoWidth/videoHeight are still 0 at 'seeked' time (metadata not really ready), no thumbnail is created", false);
} finally {
  delete global.bgVidTLOpen;
  delete global.document;
}

ok("captureVideoClipThumb has a 2000ms safety timeout that clears via clearTimeout when 'seeked' fires first", (() => {
  const fn = extractFn("captureVideoClipThumb");
  return !!fn
    && fn.includes("setTimeout(() => el.removeEventListener(\"seeked\", onSeeked), 2000)")
    && fn.includes("clearTimeout(tid)");
})());

ok("addBgVidClipAt's loadedmetadata listener calls captureVideoClipThumb(cue) after correcting the duration placeholder", (() => {
  const fn = extractFn("addBgVidClipAt");
  if (!fn) return false;
  const durIdx = fn.indexOf("if (isFinite(el.duration) && cue.dur === 8) cue.dur = el.duration;");
  const thumbIdx = fn.indexOf("captureVideoClipThumb(cue);");
  return durIdx >= 0 && thumbIdx >= 0 && durIdx < thumbIdx;
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "captureVideoClipThumb\|addBgVidClipAt's loadedmetadata"`
Expected: every assertion in the new section prints `✗` (either a caught exception from `loadFns` not finding `captureVideoClipThumb`, or `false` for the two structural checks).

- [ ] **Step 3: Write the implementation**

First confirm the current code still matches (line numbers drift): `grep -n "function addBgVidClipAt" elastic-morph.html`, then read ~25 lines from there to see the exact current `loadedmetadata` listener text.

Add this new function directly above `function addBgVidClipAt(t, file) {`:

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

Then, inside `addBgVidClipAt`'s existing `loadedmetadata` listener, add one line — the listener currently reads:

```js
    el.addEventListener("loadedmetadata", () => {
      // Only correct the provisional 8s placeholder — if the user already trimmed cue.dur
      // (dragging the block's edge) before metadata finished loading, don't clobber their edit.
      if (isFinite(el.duration) && cue.dur === 8) cue.dur = el.duration;
      if (bgVidTLOpen) drawBgVidTL();
    });
```

Change it to:

```js
    el.addEventListener("loadedmetadata", () => {
      // Only correct the provisional 8s placeholder — if the user already trimmed cue.dur
      // (dragging the block's edge) before metadata finished loading, don't clobber their edit.
      if (isFinite(el.duration) && cue.dur === 8) cue.dur = el.duration;
      captureVideoClipThumb(cue);
      if (bgVidTLOpen) drawBgVidTL();
    });
```

(Only the one new line, `captureVideoClipThumb(cue);`, is added — nothing else in that listener changes.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "captureVideoClipThumb\|addBgVidClipAt's loadedmetadata"`
Expected: every assertion in the new section prints `✓`.

- [ ] **Step 5: Run the full suite and check for build drift**

Run: `npm run ci` — expect all tests passing, 0 failed.
Run: `git diff --stat elastic-morph.html` — expect empty (compares the built file against what you just committed; run this *after* committing, or compare `git status --short` shows nothing beyond your own edit before running `npm run ci`, then confirm it's still clean after).

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: capture a cached thumbnail for Video Timeline video clips"
```

---

### Task 2: `drawBgVidTL` — render thumbnails into each timeline block

**Files:**
- Modify: `elastic-morph.html` (`drawBgVidTL`'s cue-drawing loop — verify current line with `grep -n "function drawBgVidTL" elastic-morph.html`)
- Test: `test.js`

**Interfaces:**
- Consumes: `cue.thumb` (a `<canvas>`, set by Task 1's `captureVideoClipThumb` for video clips) and `cue.el` (already existed, used directly for image clips — no change to how it's populated). Also consumes the existing `clipElReady(el)` helper (already shipped, `elastic-morph.html:5039` — returns `{w, h}` or `null`).
- Produces: nothing new for later tasks — this is the last code task before verification.

- [ ] **Step 1: Write the failing tests**

Add this section to `test.js`, right after Task 1's new tests (after the `addBgVidClipAt's loadedmetadata listener calls captureVideoClipThumb...` assertion):

```js
section("Video Timeline thumbnails — drawBgVidTL renders cached/live thumbnails");

ok("drawBgVidTL clips to each block's region before drawing a thumbnail into it", (() => {
  const fn = extractFn("drawBgVidTL");
  return !!fn && fn.includes('c.beginPath(); c.rect(x0, by, w, bh); c.clip();');
})());

ok("drawBgVidTL picks cue.el for image-kind clips and cue.thumb for video-kind clips", (() => {
  const fn = extractFn("drawBgVidTL");
  return !!fn && fn.includes('const src = cue.kind === "image" ? cue.el : cue.thumb;');
})());

ok("drawBgVidTL uses clipElReady for image dimensions and the cached canvas's own width/height for video thumbnails", (() => {
  const fn = extractFn("drawBgVidTL");
  return !!fn
    && fn.includes('cue.kind === "image" ? clipElReady(cue.el)')
    && fn.includes('{ w: cue.thumb.width, h: cue.thumb.height }');
})());

ok("drawBgVidTL uses cover-fit (Math.max) scaling for the thumbnail, matching drawClip's cover behavior elsewhere", (() => {
  const fn = extractFn("drawBgVidTL");
  return !!fn && fn.includes("const s = Math.max(w / dim.w, bh / dim.h)");
})());

ok("the thumbnail draw happens before the existing selection-tint fill (thumbnail sits underneath the tint, not on top)", (() => {
  const fn = extractFn("drawBgVidTL");
  if (!fn) return false;
  const thumbIdx = fn.indexOf("c.drawImage(src,");
  const fillIdx = fn.indexOf('c.fillStyle = sel ? "rgba(139,92,246,0.45)"');
  return thumbIdx >= 0 && fillIdx >= 0 && thumbIdx < fillIdx;
})());

ok("drawBgVidTL still skips the thumbnail draw gracefully when no source/dimensions are available yet (no thumbnail, still loading)", (() => {
  const fn = extractFn("drawBgVidTL");
  return !!fn && fn.includes("if (src && dim) {");
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "drawBgVidTL"`
Expected: every new assertion prints `✗`.

- [ ] **Step 3: Write the implementation**

First confirm the current code still matches: `grep -n "function drawBgVidTL" elastic-morph.html`, then read to the end of its cue-drawing `forEach` (about 20 lines). It currently reads:

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

Replace it with:

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "drawBgVidTL"`
Expected: every new assertion prints `✓`.

- [ ] **Step 5: Run the full suite and check for build drift**

Run: `npm run ci` — expect all tests passing, 0 failed, `git diff --stat elastic-morph.html` empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: render Video Timeline clip thumbnails into editor blocks"
```

---

### Task 3: Live verification and push

**Files:** none (no code changes — verification only).

**Interfaces:**
- Consumes: the fully-wired feature from Tasks 1–2.
- Produces: nothing — terminal task.

This task has no automated-test steps — it exists because canvas rendering changes in this codebase are not meaningfully covered by the structural `extractFn`+`.includes()` test style (confirmed lesson from the Clip Editing round: two real bugs there were only caught by live browser verification, not `npm run ci`, because no test exercises actual pixel output). Perform these steps directly (not via a written test file):

- [ ] **Step 1: Start the dev server and open it in a browser**

The project's own `.claude/launch.json`-driven preview tool has intermittently served stale content from a wrong working directory in this environment (see project memory `project_morph_hq_export_frame_accuracy.md`). Prefer running the server directly:

```bash
npx --yes serve -l 3459 "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
```

Then open `http://localhost:3459/elastic-morph` in the browser tool and confirm via `curl -s http://localhost:3459/elastic-morph | grep -c "captureVideoClipThumb"` returns `1`+ before trusting anything rendered in the tab.

- [ ] **Step 2: Load a track and open the Video Timeline editor**

In the browser console (`javascript_tool`), load the demo track and add both a video clip and an image clip:

```js
await loadDemoTrack({});
```

Then add a real video clip (the repo's own demo asset) and confirm it produces a cue:

```js
const resp = await fetch('/assets/elasticmorph_elasticfield_dustreel.mp4');
const file = new File([await resp.blob()], 'dustreel.mp4', { type: 'video/mp4' });
addBgVidClipAt(0, file);
```

Open the Video Timeline panel in the UI (or, if it's not already open, set `bgVidTLOpen = true` and call `drawBgVidTL()` directly from the console — check `grep -n "bgVidTLOpen = " elastic-morph.html` for how the UI normally toggles this, to make sure the console-driven approach matches real behavior).

- [ ] **Step 3: Confirm the video clip's thumbnail appears and is stable**

Wait ~1-2 seconds for `loadedmetadata` and the capture seek to complete, then screenshot the timeline area and visually confirm the block shows a real video frame (not black, not the plain purple placeholder). Screenshot again a few seconds later (with playback advancing through that clip) and confirm the thumbnail image in the block did NOT change — it must stay the one captured frame, not flicker to whatever the live video element is currently showing.

- [ ] **Step 4: Confirm an image clip also shows correctly**

Add an image clip (any small local image works, or reuse a frame exported from the video via canvas `toDataURL` converted to a `File` if no separate image asset is convenient) and confirm its block shows the image content directly, with no delay (images need no capture step).

- [ ] **Step 5: Confirm the waveform backdrop still shows in the gaps between clips**

With at least one gap on the timeline where no cue covers that time range, confirm the cyan waveform backdrop (shipped earlier today) is still visible there — only clip blocks with a thumbnail should visually cover it.

- [ ] **Step 6: Check console for errors, then clean up and push**

```bash
pkill -f "serve -l 3459"
```

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
npm run ci
git status --short
git push origin main
```
(Use the Bash tool's `dangerouslyDisableSandbox: true` for the push, per the Global Constraints above.)

- [ ] **Step 7: Confirm live via hash match**

```bash
shasum -a 256 elastic-morph.html
curl -s https://elasticmorph.app/elastic-morph.html | shasum -a 256
```
Wait for the Vercel deploy to complete (30-60s is typical) before the second command if the hashes don't match on the first try.
