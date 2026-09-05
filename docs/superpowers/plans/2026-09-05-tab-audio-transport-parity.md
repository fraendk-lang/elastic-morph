# Tab-/System-Audio Transport Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six transport/seek functions that still key on `S.micMode` alone, so lyrics-sync, cue-automation, and seek/skip no longer freeze on a stale file position when Tab-/System-Audio is started after a file was loaded and played.

**Architecture:** Each of the six functions gets its existing `S.micMode` check extended to `S.micMode || S.tabAudioMode` — the identical, already-proven pattern used to fix the core analysis pipeline in the prior Tab-/System-Audio round.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- All six functions are native to `elastic-morph.html` — confirmed via `grep -n "function playPos\|function seekSeconds\|function seekFraction\|function skip\b\|function curTimeSec\|function setDuration" src/*.js` returning no match. Every edit goes directly into `elastic-morph.html`, no `node build.js` rebuild needed.
- `setDuration()` must return `240` (matching mic's virtual-cycle length) for tab-audio, not the `180` no-track fallback.
- Scope is exactly these 6 functions — no cosmetic siblings (HUD time label, intro-cover gate, demo hint), no export changes. Confirmed with Frank.

---

### Task 1: Extend all six transport functions to treat `S.tabAudioMode` like `S.micMode`

**Files:**
- Modify: `elastic-morph.html:9120` (`playPos`)
- Modify: `elastic-morph.html:9121-9123` (`seekSeconds`)
- Modify: `elastic-morph.html:9509-9515` (`seekFraction`)
- Modify: `elastic-morph.html:9516-9518` (`skip`)
- Modify: `elastic-morph.html:11003-11005` (`curTimeSec`)
- Modify: `elastic-morph.html:11006-11010` (`setDuration`)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Produces: no new interface — all six functions' names, signatures, and behavior for non-live-input tracks (file playing, or no track at all) are completely unchanged. Only their live-input branch condition gains `|| S.tabAudioMode`.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Tab-/System-Audio transport parity");

ok("playPos treats tab-audio like mic mode when choosing between virtualT and audioEl.currentTime", (() => {
  const fn = extractFn("playPos");
  return !!fn && fn.includes("function playPos() { return (S.micMode || S.tabAudioMode) ? S.virtualT : (audioEl.src ? audioEl.currentTime : S.virtualT); }");
})());

ok("seekSeconds treats tab-audio like mic mode", (() => {
  const fn = extractFn("seekSeconds");
  return !!fn && fn.includes("if (S.micMode || S.tabAudioMode || !audioEl.src) S.virtualT = Math.max(0, t);");
})());

ok("seekFraction treats tab-audio like mic mode (240s virtual cycle)", (() => {
  const fn = extractFn("seekFraction");
  return !!fn && fn.includes("if (S.micMode || S.tabAudioMode) { S.virtualT = f * 240; return; }");
})());

ok("skip treats tab-audio like mic mode", (() => {
  const fn = extractFn("skip");
  return !!fn && fn.includes("if (S.micMode || S.tabAudioMode || !audioEl.src) { S.virtualT = Math.max(0, S.virtualT + sec); return; }");
})());

ok("curTimeSec treats tab-audio like mic mode", (() => {
  const fn = extractFn("curTimeSec");
  return !!fn && fn.includes("return (S.micMode || S.tabAudioMode) ? S.virtualT : (audioEl.src ? (audioEl.currentTime || 0) : S.virtualT);");
})());

ok("setDuration treats tab-audio like mic mode, returning the same 240s virtual-cycle length", (() => {
  const fn = extractFn("setDuration");
  return !!fn && fn.includes("if (S.micMode || S.tabAudioMode) return 240;");
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all 6 new assertions under "Tab-/System-Audio transport parity" print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement**

At `elastic-morph.html:9120`, replace:

```js
function playPos() { return S.micMode ? S.virtualT : (audioEl.src ? audioEl.currentTime : S.virtualT); }
```

with:

```js
function playPos() { return (S.micMode || S.tabAudioMode) ? S.virtualT : (audioEl.src ? audioEl.currentTime : S.virtualT); }
```

At `elastic-morph.html:9121-9123`, replace:

```js
function seekSeconds(t) {
  if (S.micMode || !audioEl.src) S.virtualT = Math.max(0, t);
  else if (audioEl.duration) audioEl.currentTime = Math.max(0, Math.min(audioEl.duration - 0.05, t));
```

with:

```js
function seekSeconds(t) {
  if (S.micMode || S.tabAudioMode || !audioEl.src) S.virtualT = Math.max(0, t);
  else if (audioEl.duration) audioEl.currentTime = Math.max(0, Math.min(audioEl.duration - 0.05, t));
```

At `elastic-morph.html:9509-9515`, replace:

```js
function seekFraction(f) {
  f = Math.max(0, Math.min(1, f));
  S.lastDropHit = null;   // allow drops to re-fire after a seek
  if (S.micMode) { S.virtualT = f * 240; return; }
  if (!audioEl.src) { S.virtualT = f * 180; return; }
  if (audioEl.duration) audioEl.currentTime = f * audioEl.duration;
}
```

with:

```js
function seekFraction(f) {
  f = Math.max(0, Math.min(1, f));
  S.lastDropHit = null;   // allow drops to re-fire after a seek
  if (S.micMode || S.tabAudioMode) { S.virtualT = f * 240; return; }
  if (!audioEl.src) { S.virtualT = f * 180; return; }
  if (audioEl.duration) audioEl.currentTime = f * audioEl.duration;
}
```

At `elastic-morph.html:9516-9518`, replace:

```js
function skip(sec) {
  if (S.micMode || !audioEl.src) { S.virtualT = Math.max(0, S.virtualT + sec); return; }
  if (audioEl.duration) audioEl.currentTime = Math.max(0, Math.min(audioEl.duration - 0.05, audioEl.currentTime + sec));
```

with:

```js
function skip(sec) {
  if (S.micMode || S.tabAudioMode || !audioEl.src) { S.virtualT = Math.max(0, S.virtualT + sec); return; }
  if (audioEl.duration) audioEl.currentTime = Math.max(0, Math.min(audioEl.duration - 0.05, audioEl.currentTime + sec));
```

At `elastic-morph.html:11003-11010`, replace:

```js
function curTimeSec() {
  return S.micMode ? S.virtualT : (audioEl.src ? (audioEl.currentTime || 0) : S.virtualT);
}
function setDuration() {
  if (S.micMode) return 240;
  if (audioEl.src && isFinite(audioEl.duration) && audioEl.duration > 0) return audioEl.duration;
  return 180;
}
```

with:

```js
function curTimeSec() {
  return (S.micMode || S.tabAudioMode) ? S.virtualT : (audioEl.src ? (audioEl.currentTime || 0) : S.virtualT);
}
function setDuration() {
  if (S.micMode || S.tabAudioMode) return 240;
  if (audioEl.src && isFinite(audioEl.duration) && audioEl.duration > 0) return audioEl.duration;
  return 180;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 6 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "fix: Tab-/System-Audio transport parity with mic mode

playPos, seekSeconds, seekFraction, skip, curTimeSec, and setDuration
all keyed on S.micMode alone to decide between the live virtual clock
(S.virtualT) and the paused file's audioEl.currentTime/duration.
Sequence 'load a file, play it, switch to Tab-/System-Audio' left
audioEl.src set, so these six functions kept returning the frozen file
position instead of the live clock -- freezing synced lyrics (via
playPos) and Cue/Set automation (via curTimeSec), and making seek/skip
act on the paused file. Extended all six to S.micMode || S.tabAudioMode,
the same pattern already proven for the core analysis pipeline.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

Not covered by `test.js` (static source assertions only) — verify with a
real Chrome/Edge session:

1. Load a file, play it, pause, switch to Tab-/System-Audio (share any tab
   with audio).
2. Confirm the timeline/scrubber no longer sits frozen at the file's last
   position, and that synced lyrics (if a lyrics-mode track with cues is
   active) advance rather than staying stuck.
3. Confirm seek/skip controls (if reachable during live input) act on the
   live virtual clock, not the paused file's `currentTime`.
