# HQ Export — Video Timeline Frame Accuracy — Design Spec

**Status:** Approved by Frank in sections, not yet built.

## Problem

The Video Timeline's original design spec explicitly deferred this: "HQ export frame-accuracy —
the cue-selection logic itself runs deterministically during export via `renderExportFrame`, but
the underlying `<video>` element seek is not guaranteed frame-perfect the way the audio-feature
timeline is." Frank picked this up as the last item on his backlog list from earlier today
("Export-Qualität"), confirmed to specifically mean this deferred problem.

**Root cause, confirmed by reading the actual code:** the HQ export loop (`elastic-morph.html`,
inside the async WebCodecs export function, ~line 4806-4812) calls `renderExportFrame(i, fps,
feat, dur, startT)` synchronously once per output frame, then *immediately* captures the canvas
into a `VideoFrame` and hands it to the encoder — no `await` between rendering and capturing.
`renderExportFrame` calls `updateBgVideoTimeline(t)`, which for an active Video Timeline video
clip calls `syncClipTime(el, targetT, kind)`, which does `el.currentTime = targetT` — a real,
*asynchronous* browser-level video seek. If the canvas is captured before that seek lands, the
exported file permanently bakes in a stale or blank video frame at that instant, with no
self-correction (unlike live playback, which recovers on the next animation frame).

**Confirmed scope:** this only affects Video Timeline *video* clips that actually seek a
meaningful distance (a clip becoming active, or scrubbing/jumping mid-export) — image-kind
clips never seek, and the legacy single-background-video path (`drawBgVideo`, outside the
Timeline) never writes `.currentTime` at all anywhere in the codebase, so it isn't exposed to
this class of bug and doesn't need touching.

## Locked decisions

- **Accuracy over speed.** Confirmed explicitly: HQ export may take measurably longer (seconds
  to potentially minutes across many clip changes) in exchange for every frame being correct.
  This rules out the "wait a fixed short budget then capture anyway" alternative.
- **Scoped to Video Timeline video clips only.** The legacy single-video path is unaffected (see
  Problem above) and isn't touched by this spec.
- **The live 60fps render loop must not become async or start awaiting anything.** This is a
  hard constraint, not just a preference — `frame()`'s call to `updateBgVideoTimeline(t)` must
  keep behaving exactly as it does today. The fix is additive: `syncClipTime` and
  `updateBgVideoTimeline` gain the *capability* to report a pending seek, but nothing about the
  live path's control flow changes, because the live caller simply doesn't use that capability.
- **Only export actually waits when a real seek is triggered.** `syncClipTime`'s existing
  `>0.35s drift` threshold already means most frames of normal forward playback need no seek at
  all (the video is already tracking close to the right position). The fix only costs time
  exactly where accuracy is actually at risk — clip starts, transitions, and any large jump —
  not uniformly across the whole export.
- **A generous safety timeout (2000ms) per pending seek**, so a pathological stuck seek (a
  browser bug, a corrupted file) can't hang an export forever. In the timeout case, the frame
  gets captured with whatever's currently decoded — `drawClip`'s existing `clipElReady` guard
  already handles an unready video gracefully (skips drawing rather than showing garbage), so
  the degrade path is "one skipped/blank frame in a pathological case," never a crash or a hang.

## `syncClipTime`: return a pending-seek promise instead of nothing

Current (`elastic-morph.html:4935-4953`):
```js
function syncClipTime(el, targetT, kind) {
  if (!el || kind === "image") return;
  const d = el.duration;
  if (el.loop && isFinite(d) && d > 0.1) targetT = targetT % d;
  if (Math.abs(el.currentTime - targetT) > 0.35) {
    try { el.currentTime = Math.max(0, targetT); } catch (e) { }
  }
  if (el.paused && S.playing) el.play().catch(() => { });
}
```
(Comments about the loop-wrap and the redundant-self-seek fix, both from earlier rounds today,
are omitted above for brevity — they stay exactly as-is, unrelated to this change.)

New:
```js
function syncClipTime(el, targetT, kind) {
  if (!el || kind === "image") return null;
  const d = el.duration;
  if (el.loop && isFinite(d) && d > 0.1) targetT = targetT % d;
  let seekPromise = null;
  if (Math.abs(el.currentTime - targetT) > 0.35) {
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

`seekPromise` is `null` on the (common) no-seek path — identical to today's implicit `undefined`
return for every caller that ignores it, so this is purely additive. The two existing early
returns for `!el`/`kind === "image"` now explicitly `return null` instead of an implicit
`undefined`, for symmetry with the rest of the function's returns (callers already treat
`falsy` the same way either way, so this is a style consistency choice, not a behavior change).

## `updateBgVideoTimeline`: collect and return pending seeks

Both call sites of `syncClipTime` inside `updateBgVideoTimeline` (`elastic-morph.html:4967` for
the active `cue`, `elastic-morph.html:5001` for `next` during a transition window) start
collecting their return values into an array, which the function now returns instead of nothing:

```js
function updateBgVideoTimeline(t) {
  S.bgVidTrans = null;
  if (!S.bgVidCues.length) return [];
  let idx = -1;
  for (let i = 0; i < S.bgVidCues.length; i++) { if (S.bgVidCues[i].t <= t + 0.03) idx = i; else break; }
  let cue = idx >= 0 ? S.bgVidCues[idx] : null;
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

Every existing statement is unchanged — this only adds the `pending` array, two `if (p) pending.push(p)` lines at the two existing `syncClipTime` call sites, and the `return pending;`/`return [];` in place of the two existing bare `return;` statements. `frame()` (the live loop's caller, unchanged, not part of this spec) already calls `updateBgVideoTimeline(t)` without using its return value — an ignored array is exactly as inert as an ignored `undefined` was, so the live path's behavior is byte-for-byte unchanged.

## `renderExportFrame`: become `async`, await pending seeks before capturing

Current (`elastic-morph.html:4697-4725`): a synchronous function, ending with
```js
  updateBgVideoTimeline(t);
  tickCueTransition(dt);
  drawScene(dt);
}
```

New: only the function signature and that closing block change — everything else in the
function (the feature/audio/beat computation, lines 4698-4719) is untouched:

```js
async function renderExportFrame(i, fps, feat, dur, t0) {
  /* ...unchanged lines 4698-4719... */
  const pending = updateBgVideoTimeline(t);
  if (pending.length) await Promise.all(pending);
  tickCueTransition(dt);
  drawScene(dt);
}
```

## Export loop: await the now-async call

The loop's call site (`elastic-morph.html:4809`, inside the already-`async` HQ export function)
gains one `await`:

```js
      await renderExportFrame(i, fps, feat, dur, startT);
```

This is the only change to the surrounding export loop — the existing backpressure/yield logic
immediately below it (`while (vEnc.encodeQueueSize > 4) await ...`, the periodic progress-UI
yield) is unaffected, since the loop body was already inside an `async` function using `await`
for other steps.

## What's explicitly deferred

- No UI indicator distinguishing "waiting on a video seek" from ordinary encoder backpressure in
  the export progress toast — the existing `${done}/${total}` percentage/ETA display already
  accounts for actual elapsed time per frame (it's computed from `performance.now()` deltas), so
  a slower frame due to a seek simply shows up as a temporarily larger per-frame time in the ETA
  math already in place; no separate messaging needed for this round.
- No change to the realtime/MediaRecorder export path — that path already captures frames from
  live, continuously-playing video elements via `canvas.captureStream()`, not discrete seeks, so
  it was never exposed to this specific race.
- No change to the unrelated Firefox MediaRecorder duration-capping issue raised earlier today —
  explicitly out of scope, different export path entirely, Frank already declined a fix for it.

## Verification plan (to run once implemented)

- `npm run ci` green, with tests for: `syncClipTime` returning a genuine pending-seek `Promise`
  when a real seek occurs and `null` when it doesn't (behavioral, via `loadFns` + a mock video
  element whose `addEventListener("seeked", ...)` can be triggered manually in the test, matching
  the mock-object technique already established this session for `syncClipTime`'s other tests);
  `updateBgVideoTimeline` returning an array containing those promises at the two call sites, and
  an empty array on the legacy zero-cues path; structural confirmation that `renderExportFrame`
  is `async` and awaits `Promise.all(pending)` before `drawScene`; structural confirmation the
  export loop's call site has the new `await`.
- Live in-browser: force a Video Timeline export scenario with at least one clip transition and
  one hard clip-to-clip cut, run an actual HQ export, and inspect the resulting file frame-by-frame
  around each cut/transition boundary (e.g. step through in a video player, or extract frames) to
  confirm no stale/blank frame appears — this is the one thing no automated test in this codebase
  can verify (rendering pixels into a real exported file), matching how every Video Timeline round
  today has needed a dedicated live-verification pass for exactly this class of concern. Confirm
  total export time for a representative multi-clip project didn't become unreasonably slower
  (a rough before/after timing comparison, not a strict budget — "accuracy over speed" was the
  locked decision, but a live sanity check catches anything pathological). Confirm `npm run ci`
  and `git diff --stat elastic-morph.html` stay clean per the standard build-pipeline-gotcha check.
