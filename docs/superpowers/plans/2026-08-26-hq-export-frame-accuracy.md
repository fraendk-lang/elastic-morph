# HQ Export — Video Timeline Frame Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Elastic Morph's HQ (WebCodecs) export frame-accurate for Video Timeline video clips by waiting for a real video seek to actually land before capturing that frame into the exported file.

**Architecture:** `syncClipTime` starts returning a `Promise` that resolves when a real seek it triggered lands (or `null` when no seek was needed — the common case during steady forward playback). `updateBgVideoTimeline` collects these into an array and returns it (previously returned nothing). `renderExportFrame` becomes `async` and awaits that array with `Promise.all` right before `drawScene` paints the frame that gets captured. The export loop's one call site gets an `await`. The live 60fps render loop (`frame()`, not touched by this plan) keeps calling `updateBgVideoTimeline` exactly as before and simply ignores the now-returned array — an ignored return value is behaviorally identical to today's ignored `undefined`, so live playback is provably unaffected.

**Tech Stack:** Vanilla JS, HTML5 `<video>` seeking, WebCodecs `VideoEncoder`/`AudioEncoder` + `mp4-muxer`. Same zero-dependency `test.js` harness as the rest of the codebase. This plan introduces the harness's first genuinely asynchronous test case (verifying a real `Promise` actually resolves after a mock `'seeked'` event fires) — Task 1 includes a small, additive change to `test.js`'s own summary/exit block to support this without touching any of the ~460 existing synchronous tests' behavior.

## Global Constraints

- Every edit lands in `elastic-morph.html` before line 10079 (`@BUILD-INJECT-V58`, re-verify with `grep -n "@BUILD-INJECT-V58" elastic-morph.html` before starting — it has drifted several times today) — never touch `src/inject-vNN.js` for this work.
- After every task's code change, run `npm run ci` (`node build.js && node test.js`) and confirm `git diff --stat elastic-morph.html` is empty post-build.
- The live 60fps render loop (`frame()` and everything it calls, other than `updateBgVideoTimeline` itself) must not be touched by this plan at all — no task modifies `frame()`.
- Only Video Timeline **video** clips are in scope — image-kind clips never seek (`clipElReady`-gated), and the legacy single-background-video path (`drawBgVideo`) never writes `.currentTime` anywhere in the codebase, so neither needs any change.
- Seek-wait timeout is exactly `2000` (milliseconds) — a safety net expected to essentially never trigger in practice, not a tuned performance budget.
- `syncClipTime`'s existing `>0.35` drift threshold, the loop-wrap modulo logic, and the `el.play()` call are unchanged by this plan — only its return value changes, from implicit `undefined` to an explicit `null` or a `Promise`.

---

### Task 1: `syncClipTime` returns a pending-seek promise

**Files:**
- Modify: `elastic-morph.html:4935-4953` (`syncClipTime` — verify current line with `grep -n "function syncClipTime" elastic-morph.html`, may have shifted)
- Modify: `test.js` (harness change: async-aware summary block, plus the new test)

**Interfaces:**
- Produces: `syncClipTime(el, targetT, kind)` now returns `null` when no seek was needed, or a `Promise<void>` that resolves once the triggered seek's `'seeked'` event fires (or after a 2000ms safety timeout, whichever comes first). Task 2 consumes this return value by exact name/shape (`null` or a thenable).

- [ ] **Step 1: Add async-test support to `test.js`'s summary block**

This harness has been entirely synchronous until now — every existing test calls `ok(...)` immediately, and the file ends by printing a pass/fail count and calling `process.exit()`. This task's own test needs to verify a `Promise` genuinely resolves after a mock event fires, which requires awaiting a microtask — so the summary block needs to wait for any registered async checks first. This change is purely additive: it does not alter the behavior of any of the ~460 existing synchronous tests, since the new array defaults to empty and `Promise.all([])` resolves immediately.

Find the near-top of `test.js` (search for `let pass = 0, fail = 0;`) and add one line right after it:

```js
let pass = 0, fail = 0;
const pendingAsyncChecks = [];
```

Find the very end of `test.js` (search for `/* ---------------- summary ---------------- */`) — it currently reads:

```js
/* ---------------- summary ---------------- */
console.log("\n" + "─".repeat(40));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

Replace it with:

```js
/* ---------------- summary ---------------- */
(async () => {
  if (pendingAsyncChecks.length) await Promise.all(pendingAsyncChecks);
  console.log("\n" + "─".repeat(40));
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
```

- [ ] **Step 2: Write the failing tests**

Add to `test.js`, in a new section (place it right after the existing "Video Timeline Clip Fades — fade-to-black overlay rendering" section, before "Video Timeline clip editing — UI: image file acceptance + IMG glyph" — search for those exact section headers to confirm placement):

```js
/* ---------------- HQ Export: frame-accurate Video Timeline seeks ---------------- */
section("HQ Export frame accuracy — syncClipTime returns a pending-seek promise");

function makeSeekableMockEl(initialCurrentTime, paused) {
  let ct = initialCurrentTime;
  const listeners = { seeked: [] };
  const el = {
    get currentTime() { return ct; },
    set currentTime(v) { ct = v; },
    paused,
    duration: NaN,
    loop: false,
    addEventListener(evt, fn) { if (listeners[evt]) listeners[evt].push(fn); },
    removeEventListener(evt, fn) { if (listeners[evt]) listeners[evt] = listeners[evt].filter(f => f !== fn); },
    play() { paused = false; return Promise.resolve(); }
  };
  el._fireSeeked = () => { listeners.seeked.slice().forEach(fn => fn()); };
  el._seekedListenerCount = () => listeners.seeked.length;
  return el;
}

global.S = { playing: true };
try {
  const { syncClipTime } = loadFns(["syncClipTime"]);

  const elNoSeek = makeSeekableMockEl(0, true);
  const rNoSeek = syncClipTime(elNoSeek, 0.1, "video");
  ok("syncClipTime returns null when drift is <=0.35s (no real seek triggered) — the common steady-playback case", rNoSeek === null);

  const elSeek = makeSeekableMockEl(0, true);
  const rSeek = syncClipTime(elSeek, 5, "video");
  ok("syncClipTime returns a genuine Promise when a real seek is triggered", rSeek instanceof Promise);
  ok("syncClipTime registered exactly one 'seeked' listener for the triggered seek", elSeek._seekedListenerCount() === 1);

  pendingAsyncChecks.push((async () => {
    let resolved = false;
    rSeek.then(() => { resolved = true; });
    elSeek._fireSeeked();
    await rSeek;
    ok("the returned promise actually resolves once the mock 'seeked' event fires", resolved);
    ok("the 'seeked' listener is removed after firing (no leak)", elSeek._seekedListenerCount() === 0);
  })());
} catch (e) {
  ok("syncClipTime returns null when drift is <=0.35s (no real seek triggered) — the common steady-playback case", false, e.message);
  ok("syncClipTime returns a genuine Promise when a real seek is triggered", false);
  ok("syncClipTime registered exactly one 'seeked' listener for the triggered seek", false);
  ok("the returned promise actually resolves once the mock 'seeked' event fires", false);
  ok("the 'seeked' listener is removed after firing (no leak)", false);
} finally {
  delete global.S;
}
```

(The two `ok(...)` calls inside the `pendingAsyncChecks.push((async () => { ... })())` block run after the synchronous part of the script has already finished — that's the whole point of Step 1's harness change. Note the `catch` block above still eagerly reports all 5 assertions as failed if `loadFns` itself throws, so a total setup failure is still visible even though two of the five checks are normally async.)

- [ ] **Step 3: Run tests to verify the new ones fail**

Run: `node test.js 2>&1 | grep -A1 "syncClipTime returns null\|syncClipTime returns a genuine\|registered exactly one\|actually resolves once\|listener is removed"`
Expected: all 5 print `✗` (the function doesn't return anything yet, so `rNoSeek === null` is false — `undefined === null` is false — and `rSeek instanceof Promise` is false for the same reason).

- [ ] **Step 4: Write minimal implementation**

Read `syncClipTime`'s current exact text first (`grep -n "function syncClipTime" elastic-morph.html` then read ~20 lines from there) to confirm it still matches what's shown below — replace:

```js
function syncClipTime(el, targetT, kind) {
  if (!el || kind === "image") return;
  // A clip dragged longer than its own footage relies on native looping (el.loop = true) to
  // fill the extra time — but targetT keeps growing with the timeline while el.currentTime
  // wraps back to 0 every loop. Without wrapping targetT the same way, drift stays huge
  // forever and this seeks to a new (clamped, wrong) position on literally every frame.
  const d = el.duration;
  if (el.loop && isFinite(d) && d > 0.1) targetT = targetT % d;
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

with:

```js
function syncClipTime(el, targetT, kind) {
  if (!el || kind === "image") return null;
  // A clip dragged longer than its own footage relies on native looping (el.loop = true) to
  // fill the extra time — but targetT keeps growing with the timeline while el.currentTime
  // wraps back to 0 every loop. Without wrapping targetT the same way, drift stays huge
  // forever and this seeks to a new (clamped, wrong) position on literally every frame.
  const d = el.duration;
  if (el.loop && isFinite(d) && d > 0.1) targetT = targetT % d;
  // Only seek when actually out of sync (>0.35s drift) — NOT just because the clip is
  // paused. A currentTime write is a real browser-level seek even when the target equals
  // the video's current position: readyState drops (HAVE_NOTHING/HAVE_METADATA) for a
  // couple frames while it "re-settles", which paints as a brief pop/hitch right as every
  // clip starts. Clips normally start already sitting at (or very near) their correct
  // position, so this redundant self-seek was firing on essentially every clip activation.
  let seekPromise = null;
  if (Math.abs(el.currentTime - targetT) > 0.35) {
    // Returned so HQ export (renderExportFrame) can await the seek actually landing before
    // capturing the frame — the live 60fps loop ignores this return value entirely and keeps
    // behaving exactly as before, since an ignored Promise/null is as inert as an ignored
    // undefined was.
    seekPromise = new Promise(resolve => {
      const onSeeked = () => { el.removeEventListener("seeked", onSeeked); resolve(); };
      el.addEventListener("seeked", onSeeked);
      setTimeout(() => { el.removeEventListener("seeked", onSeeked); resolve(); }, 2000);
    });
    try { el.currentTime = Math.max(0, targetT); } catch (e) { }
  }
  if (el.paused && S.playing) el.play().catch(() => { });
  return seekPromise;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "syncClipTime returns null\|syncClipTime returns a genuine\|registered exactly one\|actually resolves once\|listener is removed"`
Expected: all 5 print `✓`. (The last two — the async ones — appear in the output only after the synchronous test run finishes, since `pendingAsyncChecks` is awaited in the summary block; confirm they're present and green, not just absent from a truncated grep.)

- [ ] **Step 6: Run full suite and check for build drift**

Run: `npm run ci` — expect all tests passing (469+, since you added 5 new assertions to the prior 464), 0 failed.
Run: `git diff --stat elastic-morph.html` — expect empty.

- [ ] **Step 7: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: syncClipTime returns a pending-seek promise for HQ export to await"
```

---

### Task 2: `updateBgVideoTimeline` collects and returns pending seeks

**Files:**
- Modify: `elastic-morph.html:4955-5006` (`updateBgVideoTimeline` — verify current line with `grep -n "function updateBgVideoTimeline" elastic-morph.html`)
- Test: `test.js`

**Interfaces:**
- Consumes: `syncClipTime`'s `null`/`Promise` return from Task 1.
- Produces: `updateBgVideoTimeline(t)` now returns an array (`[]` when nothing needed to seek, or containing one or two pending `Promise`s otherwise — up to one for the active `cue`, one for `next` during a transition window). Task 3 consumes this exact return shape.

- [ ] **Step 1: Write the failing tests**

Add to the "HQ Export frame accuracy" section in `test.js`, after Task 1's tests:

```js
(() => {
  const cueEl = makeSeekableMockEl(5, true);   // starts away from t=0's target (0), so the
                                                 // first activation below triggers a real seek
  global.S = {
    bgVidCues: [
      { t: 0, dur: 10, fadeIn: 0, fadeOut: 0, transType: "cut", transDur: 0, kind: "video", el: cueEl }
    ],
    bgVid: { on: false, el: null, src: null },
    bgVidTrans: null,
    playing: true
  };
  try {
    const { updateBgVideoTimeline } = loadFns(["updateBgVideoTimeline", "syncClipTime"]);

    const pendingLegacy = (() => {
      const savedCues = global.S.bgVidCues;
      global.S.bgVidCues = [];
      const r = updateBgVideoTimeline(5);
      global.S.bgVidCues = savedCues;
      return r;
    })();
    ok("updateBgVideoTimeline returns an empty array on the legacy zero-cues path", Array.isArray(pendingLegacy) && pendingLegacy.length === 0);

    // t=0: cue activates, targetT = 0 - cue.t = 0, but cueEl.currentTime is still 5 (its
    // initial mock value) — drift |5 - 0| = 5 > 0.35, so this is a real, seek-triggering call.
    const pendingFirstActivation = updateBgVideoTimeline(0);
    ok("updateBgVideoTimeline returns an array containing the pending seek when a cue's video element genuinely seeks on activation",
      Array.isArray(pendingFirstActivation) && pendingFirstActivation.length === 1 && pendingFirstActivation[0] instanceof Promise);

    // t=0.02: syncClipTime's mock setter updates ct synchronously to whatever currentTime was
    // last assigned, so by now cueEl.currentTime reads 0 (the Task 1 seek path always sets
    // el.currentTime = Math.max(0, targetT) synchronously, independent of the real browser's
    // async decode) — targetT is now 0.02, drift |0 - 0.02| = 0.02, well under 0.35, so no
    // further seek is needed even without the mock's 'seeked' event ever having fired.
    const pendingSteady = updateBgVideoTimeline(0.02);
    ok("updateBgVideoTimeline returns an empty array once the clip is already tracking closely (no further seek needed)",
      Array.isArray(pendingSteady) && pendingSteady.length === 0);
  } catch (e) {
    ok("updateBgVideoTimeline returns an empty array on the legacy zero-cues path", false, e.message);
    ok("updateBgVideoTimeline returns an array containing the pending seek when a cue's video element genuinely seeks on activation", false);
    ok("updateBgVideoTimeline returns an empty array once the clip is already tracking closely (no further seek needed)", false);
  } finally {
    delete global.S;
  }
})();
```

This test calls the REAL `syncClipTime` — loaded alongside `updateBgVideoTimeline` via `loadFns(["updateBgVideoTimeline", "syncClipTime"])`, since `updateBgVideoTimeline` calls it by bare identifier — against a real `makeSeekableMockEl` mock, exercising the actual integration between the two functions rather than stubbing `syncClipTime` out.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "empty array on the legacy\|pending seek when a cue\|already tracking closely"`
Expected: all 3 print `✗` (the function doesn't return anything yet, so `Array.isArray(undefined)` is `false`).

- [ ] **Step 3: Write minimal implementation**

Read `updateBgVideoTimeline`'s current exact text first (`grep -n "function updateBgVideoTimeline" elastic-morph.html` then read ~55 lines from there) to confirm it still matches — replace the whole function body with:

```js
function updateBgVideoTimeline(t) {
  S.bgVidTrans = null;
  if (!S.bgVidCues.length) return [];   // legacy single-video mode: drawBgVideo() drives S.bgVid.el untouched
  let idx = -1;
  for (let i = 0; i < S.bgVidCues.length; i++) { if (S.bgVidCues[i].t <= t + 0.03) idx = i; else break; }
  let cue = idx >= 0 ? S.bgVidCues[idx] : null;
  // A resized-shorter clip's own window can end before the next clip's t arrives — once
  // t passes cue.t + cue.dur, this cue is no longer active (a gap, not a hand-off).
  if (cue && t >= cue.t + cue.dur + 0.03) cue = null;
  const next = idx + 1 < S.bgVidCues.length ? S.bgVidCues[idx + 1] : null;

  const pending = [];
  if (cue && cue.el) {
    const p = syncClipTime(cue.el, t - cue.t, cue.kind);
    if (p) pending.push(p);
    S.bgVid.el = cue.el; S.bgVid.src = cue.src; S.bgVid.on = true; S.bgVid._active = true;
  } else {
    // Only the transient render flag goes false here — S.bgVid.on is the persisted #bgVidOn
    // checkbox setting (serialized into presets/share links); writing false to it directly
    // during a mid-playback gap would silently bake "video off" into whatever gets saved next.
    S.bgVid._active = false;
  }

  let fadeAlpha = 1;
  if (cue) {
    const elapsed = t - cue.t;
    const remaining = (cue.t + cue.dur) - t;
    const prev = idx > 0 ? S.bgVidCues[idx - 1] : null;
    // A neighbor's non-cut transType only actually produces a transition if that neighbor
    // is still alive (hasn't hit its own dur cutoff) by the time the transition window would
    // open — otherwise the dispatch below never fires and this edge is a plain, fade-eligible
    // gap, not a real cross-fade.
    const hasIncomingTransition = !!prev && cue.transType !== "cut" && cue.transDur > 0
      && prev.t + prev.dur + 0.03 > cue.t - cue.transDur;
    const hasOutgoingTransition = !!next && next.transType !== "cut" && next.transDur > 0
      && cue.t + cue.dur + 0.03 > next.t - next.transDur;
    if (!hasIncomingTransition && cue.fadeIn > 0 && elapsed < cue.fadeIn) {
      fadeAlpha = Math.min(fadeAlpha, Math.max(0, elapsed / cue.fadeIn));
    }
    if (!hasOutgoingTransition && cue.fadeOut > 0 && remaining < cue.fadeOut) {
      fadeAlpha = Math.min(fadeAlpha, Math.max(0, remaining / cue.fadeOut));
    }
  }
  S.bgVid._fadeAlpha = fadeAlpha;

  if (cue && next && next.el && next.transType && next.transType !== "cut" && next.transDur > 0) {
    const winStart = next.t - next.transDur;
    if (t >= winStart && t < next.t) {
      const p2 = syncClipTime(next.el, t - winStart, next.kind);
      if (p2) pending.push(p2);
      const p = Math.min(1, Math.max(0, (t - winStart) / next.transDur));
      S.bgVidTrans = { from: cue, to: next, p, type: next.transType };
    }
  }
  return pending;
}
```

(Every existing line is unchanged in substance — only the two `return;`/`return;`-shaped statements became `return [];`/`return pending;`, the `pending` array was introduced, and the two `syncClipTime(...)` call sites each gained a `const p = ...; if (p) pending.push(p);` wrapper.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "empty array on the legacy\|pending seek when a cue\|already tracking closely"`
Expected: all 3 print `✓`.

- [ ] **Step 5: Run full suite and check for build drift**

Run: `npm run ci` — expect all tests passing, 0 failed.
Run: `git diff --stat elastic-morph.html` — expect empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: updateBgVideoTimeline collects and returns pending video seeks"
```

---

### Task 3: `renderExportFrame` becomes async and awaits pending seeks; export loop awaits the call

**Files:**
- Modify: `elastic-morph.html:4697-4725` (`renderExportFrame` — verify current line with `grep -n "function renderExportFrame" elastic-morph.html`)
- Modify: `elastic-morph.html:4809` (the export loop's call site — search for `renderExportFrame(i, fps, feat, dur, startT);` inside the `async function exportHQ()` function, in the `for (let i = 0; i < total; i++) { ... }` loop)
- Test: `test.js`

**Interfaces:**
- Consumes: the array `updateBgVideoTimeline` returns, from Task 2.
- Produces: nothing new for later tasks — this is the last code task before verification.

**Why this task bundles both edits together:** an `async` `renderExportFrame` that the export loop doesn't `await` would be silently wrong — the seek-wait would be scheduled but the loop would move on to capturing the canvas before it resolves, defeating the entire point of this plan while looking correct at a glance. These two edits are only meaningfully reviewable together.

- [ ] **Step 1: Write the failing tests**

Add to the "HQ Export frame accuracy" section in `test.js`, after Task 2's tests:

```js
ok("renderExportFrame is declared async", (() => {
  return script.includes("async function renderExportFrame(i, fps, feat, dur, t0) {");
})());

ok("renderExportFrame awaits Promise.all of updateBgVideoTimeline's pending seeks before drawScene paints the frame", (() => {
  const fn = extractFn("renderExportFrame");
  return !!fn
    && fn.includes("const pending = updateBgVideoTimeline(t);")
    && fn.includes("if (pending.length) await Promise.all(pending);")
    && fn.indexOf("const pending = updateBgVideoTimeline(t);") < fn.indexOf("drawScene(dt);");
})());

ok("the HQ export loop awaits renderExportFrame before capturing the canvas into a VideoFrame", (() => {
  return script.includes("await renderExportFrame(i, fps, feat, dur, startT);")
    && !script.includes("      renderExportFrame(i, fps, feat, dur, startT);\n      const vf = new VideoFrame");
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "declared async\|awaits Promise.all\|export loop awaits"`
Expected: all 3 print `✗`.

- [ ] **Step 3: Write minimal implementation**

Read `renderExportFrame`'s current exact text first (`grep -n "function renderExportFrame" elastic-morph.html` then read ~30 lines from there) to confirm it still matches — the function signature and its final three statements change; everything in between (the feature/audio/beat/segment computation) is untouched:

```js
async function renderExportFrame(i, fps, feat, dur, t0) {
```

(replacing `function renderExportFrame(i, fps, feat, dur, t0) {`)

and, at the end of the same function, replace:

```js
  updateBgVideoTimeline(t);
  tickCueTransition(dt);
  drawScene(dt);
}
```

with:

```js
  const pending = updateBgVideoTimeline(t);
  if (pending.length) await Promise.all(pending);
  tickCueTransition(dt);
  drawScene(dt);
}
```

Then, in the export loop (search for `renderExportFrame(i, fps, feat, dur, startT);` inside `async function exportHQ()`), replace that one line with:

```js
      await renderExportFrame(i, fps, feat, dur, startT);
```

(Only that one line changes — the surrounding loop body, including the `if (encErr) throw encErr;`/`if (S.exportCancel) throw new Error("__cancel__");` guards above it and the `VideoFrame`/`vEnc.encode`/backpressure/progress-yield logic below it, is completely untouched.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "declared async\|awaits Promise.all\|export loop awaits"`
Expected: all 3 print `✓`.

- [ ] **Step 5: Run full suite and check for build drift**

Run: `npm run ci` — expect all tests passing, 0 failed.
Run: `git diff --stat elastic-morph.html` — expect empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: HQ export awaits Video Timeline seeks before capturing each frame"
```

---

### Task 4: Live verification and push

**Files:** none (verification only)

**Interfaces:** none — terminal task.

- [ ] **Step 1: Start a dev server**

Check `lsof -i :3456 -sTCP:LISTEN` first — this port is frequently occupied by an unrelated `npm start` from a separate checkout at `~/Desktop/Elastic Morph Cursor`. If occupied, use `npx --yes serve -l <free-port>` instead (pick a port higher than every one used earlier today, e.g. 3467+). Confirm fresh code: `renderExportFrame.toString()` should start with `async function` (or read as an async function's stringified form) and contain `Promise.all(pending)`.

- [ ] **Step 2: Set up a multi-clip Video Timeline project with real seek-worthy jumps**

This needs a real HQ export, which needs Chrome/Edge (WebCodecs) and a loaded audio track — use the Browser pane against the dev server, load the repo's demo asset audio, add at least 3 video clips to the Video Timeline with at least one hard `cut` boundary (a scenario that previously had zero seek-wait — the highest-risk case for a stale-frame capture) and at least one Dissolve transition. Use short, distinctly-different source videos or seek offsets so a wrong/stale frame is visually obvious (e.g. different colored test clips, or timestamp-burned-in videos if available — otherwise distinct scenes in the existing demo asset at different playback offsets per clip).

- [ ] **Step 3: Run a real HQ export and inspect frames at every clip boundary**

Trigger `exportHQ()` (via the UI's HQ Export button) for a short range covering all the clip boundaries from Step 2 (use the export range feature to keep the clip small and the export fast). Once it completes, extract or step through frames at each clip-boundary timestamp (e.g. load the exported MP4 into the Browser pane's `<video>` element and scrub frame-by-frame using `requestVideoFrameCallback` or small `currentTime` increments, or use `ffmpeg`/similar if available in this environment) and confirm: no stale/wrong-clip frame appears at any cut or transition boundary, matching what the same instants look like in the live-playback preview.

- [ ] **Step 4: Confirm the live 60fps loop is unaffected**

With the same multi-clip project, play it back live (not exporting) and confirm playback still looks and behaves exactly as every prior Video Timeline round today verified — no new stutter, no console errors, `frame()`'s calls to `updateBgVideoTimeline` working exactly as before (its returned array is simply unused there).

- [ ] **Step 5: Rough timing sanity check**

Note the wall-clock duration of the Step 3 export. This is not a strict budget (the locked design decision was "accuracy over speed"), but confirm it's not pathologically slow (e.g. minutes for a few seconds of multi-clip content) — per the design, only frames with an actual seek should incur any wait, so a short clip-boundary-heavy export should still complete in a reasonable time, not balloon into every single frame waiting 2 seconds each (which would indicate the timeout is being hit constantly, itself worth investigating rather than shipping).

- [ ] **Step 6: Final full-suite run and build-drift check**

Run: `npm run ci` — expect all tests passing, 0 failed.
Run: `git diff --stat elastic-morph.html` — expect empty.
Run: `git status` — expect clean (everything already committed across Tasks 1-3).

- [ ] **Step 7: Push**

```bash
git push origin main
```

(Requires the Bash tool's `dangerouslyDisableSandbox: true` flag in this environment, or `git push` hangs indefinitely — see the `git-sandbox-network-blocker` memory.)

- [ ] **Step 8: Confirm live**

Compare local vs. `https://elasticmorph.app/elastic-morph.html` via SHA-256 (`shasum -a 256 elastic-morph.html` vs. `curl -s https://elasticmorph.app/elastic-morph.html | shasum -a 256`) — they must match exactly, following the same standard every Video Timeline round today has used. Wait and recheck if Vercel hasn't finished deploying yet rather than reporting success prematurely.
