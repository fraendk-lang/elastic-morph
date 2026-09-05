# Tab-/System-Audio Input Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third live-audio source — capturing a browser tab's or the system's audio via `getDisplayMedia` — alongside the existing file-upload and microphone inputs, and close a related gap where Advanced (stem-separation) mode is reachable during live-input modes.

**Architecture:** `toggleTabAudio()` closely mirrors the existing `toggleMic()` (`elastic-morph.html:10292`): same live-analysis pipeline, same start/stop button pattern, same state-reset shape, but sourcing from `getDisplayMedia({video:true, audio:true})` instead of `getUserMedia`. A second, independent change adds a `S.micMode || S.tabAudioMode` guard to `startStemSeparation()`, since neither live mode has a downloadable file for the stem API.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), browser `MediaDevices.getDisplayMedia` API, zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- Advertised as Chrome/Edge only — no maintained fallback for Safari/Firefox. On an unsupported browser (no `getDisplayMedia`) or a share with no audio track, show a clear, specific error message rather than a silent failure or a generic exception.
- The capture must be stoppable two ways: the app's own toggle button, and the browser's native "Stop sharing" control — both must lead to the exact same cleanup (disconnect/stop/null the stream, reconnect `analyser` to `audioCtx.destination`, reset UI).
- No new persistent state beyond `S.tabAudioMode` (`false` default) and the two new top-level `let tabAudioStream, tabAudioSrc` variables — this mirrors `micStream`/`micSrc` exactly, no new abstraction layer.
- `startStemSeparation()`'s new live-input guard sits immediately after the existing `analyzeState !== "done"` guard, before `trackHash` is read, and follows the exact same revert pattern (`S.stemMode = "simple"; syncStemUI();` plus a toast).
- No build-injection gotcha applies: `toggleMic` and `startStemSeparation` (the two functions this plan touches) are both confirmed native to `elastic-morph.html`, not sourced from any `src/inject-vNN.js` file (verified via `grep -n "function toggleMic\|function startStemSeparation" src/*.js` — no match). Every edit in this plan goes directly into `elastic-morph.html`, no `node build.js` rebuild step needed.

---

### Task 1: `toggleTabAudio()` + new button

**Files:**
- Modify: `elastic-morph.html:2945` (add `S.tabAudioMode` default, alongside `micMode: false,`)
- Modify: `elastic-morph.html:10291` (add `tabAudioStream`/`tabAudioSrc` variable declarations, alongside `micStream`/`micSrc`)
- Modify: `elastic-morph.html` (insert `toggleTabAudio()` + its listener — see Step 4 for placement)
- Modify: `elastic-morph.html:1033` (insert the new button immediately after `micBtn`)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Produces: `S.tabAudioMode` (`false` default); `async function toggleTabAudio()`; top-level `let tabAudioStream = null, tabAudioSrc = null;`; button `#tabAudioBtn`. Task 2 consumes `S.tabAudioMode` (reading it, never writing it) to extend `startStemSeparation()`'s guard.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Tab-/System-Audio input source");

ok("S.tabAudioMode defaults to false", (() => {
  return script.includes("tabAudioMode: false,");
})());

ok("toggleTabAudio checks for getDisplayMedia support before attempting capture, with a Chrome/Edge-specific error message", (() => {
  const fn = extractFn("toggleTabAudio");
  return !!fn
    && fn.includes("if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {")
    && fn.includes("bitte Chrome oder Edge verwenden");
})());

ok("toggleTabAudio requests both video and audio (getDisplayMedia often requires video to unlock audio sharing), then immediately stops the video track since only audio is needed", (() => {
  const fn = extractFn("toggleTabAudio");
  return !!fn
    && fn.includes("await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });")
    && fn.includes("tabAudioStream.getVideoTracks().forEach(t => t.stop());");
})());

ok("toggleTabAudio rejects a share with no audio track, stopping all its tracks and showing a specific message instead of silently visualizing nothing", (() => {
  const fn = extractFn("toggleTabAudio");
  return !!fn
    && fn.includes("const audioTracks = tabAudioStream.getAudioTracks();")
    && fn.includes("if (!audioTracks.length) {")
    && fn.includes("tabAudioStream.getTracks().forEach(t => t.stop());")
    && fn.includes('bitte "Audio teilen" aktivieren');
})());

ok("toggleTabAudio's teardown branch (own button OR browser's native Stop-sharing control) disconnects/stops/nulls the stream and reconnects the analyser to the destination", (() => {
  const fn = extractFn("toggleTabAudio");
  return !!fn
    && fn.includes("if (S.tabAudioMode) {")
    && fn.includes("if (tabAudioSrc) tabAudioSrc.disconnect();")
    && fn.includes("if (tabAudioStream) tabAudioStream.getTracks().forEach(t => t.stop());")
    && fn.includes("tabAudioStream = null; tabAudioSrc = null;")
    && fn.includes("analyser.connect(audioCtx.destination);")
    && fn.includes("S.tabAudioMode = false;");
})());

ok("toggleTabAudio wires the audio track's onended handler to call itself again, so the browser's native Stop-sharing control runs the exact same teardown path as the app's own button", (() => {
  const fn = extractFn("toggleTabAudio");
  return !!fn && fn.includes("audioTracks[0].onended = () => { if (S.tabAudioMode) toggleTabAudio(); };");
})());

ok('the new #tabAudioBtn button exists with a Chrome/Edge-mentioning tooltip and is wired to toggleTabAudio', (() => {
  const idx = html.indexOf('id="tabAudioBtn"');
  if (idx < 0) return false;
  const tag = html.slice(Math.max(0, idx - 60), idx + 150);
  return tag.includes("Chrome/Edge") && script.includes('$("tabAudioBtn").addEventListener("click", toggleTabAudio);');
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all 7 new assertions under "Tab-/System-Audio input source" print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement — state default and stream variables**

At `elastic-morph.html:2945`, replace:

```js
  micMode: false,
```

with:

```js
  micMode: false,
  tabAudioMode: false,   // true while capturing tab/system audio via getDisplayMedia
```

At `elastic-morph.html:10291`, replace:

```js
let micStream = null, micSrc = null;
```

with:

```js
let micStream = null, micSrc = null;
let tabAudioStream = null, tabAudioSrc = null;
```

- [ ] **Step 4: Implement — `toggleTabAudio()`**

Immediately after `$("micBtn").addEventListener("click", toggleMic);` (the line right after `toggleMic`'s closing `}`, per the surrounding context shown in `toggleMic`'s current body), insert:

```js

async function toggleTabAudio() {
  if (S.tabAudioMode) {
    if (tabAudioSrc) tabAudioSrc.disconnect();
    if (tabAudioStream) tabAudioStream.getTracks().forEach(t => t.stop());
    tabAudioStream = null; tabAudioSrc = null;
    analyser.connect(audioCtx.destination);
    S.tabAudioMode = false;
    $("tabAudioBtn").classList.remove("miclive");
    $("tabAudioBtn").textContent = "🖥️ Tab-/System-Audio";
    $("trackName").textContent = audioEl.src ? $("trackName").textContent : "No track loaded";
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    alert("Tab-/System-Audio wird von diesem Browser nicht unterstützt — bitte Chrome oder Edge verwenden.");
    return;
  }
  try {
    initAudio();
    if (audioCtx.state === "suspended") audioCtx.resume();
    tabAudioStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const audioTracks = tabAudioStream.getAudioTracks();
    if (!audioTracks.length) {
      tabAudioStream.getTracks().forEach(t => t.stop());
      tabAudioStream = null;
      alert("Keine Audiospur geteilt — beim Freigeben bitte \"Audio teilen\" aktivieren.");
      return;
    }
    tabAudioStream.getVideoTracks().forEach(t => t.stop());   // video not needed, drop it immediately
    pause();
    analyser.disconnect();
    tabAudioSrc = audioCtx.createMediaStreamSource(tabAudioStream);
    tabAudioSrc.connect(analyser);
    if (splitter) tabAudioSrc.connect(splitter);
    audioTracks[0].onended = () => { if (S.tabAudioMode) toggleTabAudio(); };
    S.tabAudioMode = true;
    S.virtualT = 0;
    S.snapshots = []; S.lastSnapTime = -10; S.memoryBlend = null; S.manualMemory = null;
    S.songMap = null; S.bpm = 0;
    renderSongMap();
    $("bpmLabel").innerHTML = "BPM: <b>live</b>";
    $("tabAudioBtn").classList.add("miclive");
    $("tabAudioBtn").textContent = "■ Stop Tab-/System-Audio";
    $("trackName").textContent = "Tab-/System-Audio";
    $("dropHint").style.display = "none";
    $("phaseBadge").style.display = "block";
    $("presetBadge").style.display = "block";
    updateBadge();
  } catch (err) {
    alert("Tab-/System-Audio-Freigabe fehlgeschlagen: " + err.message);
  }
}
$("tabAudioBtn").addEventListener("click", toggleTabAudio);
```

- [ ] **Step 5: Implement — new button**

At `elastic-morph.html:1033`, replace:

```html
    <button class="btn" id="micBtn" title="Visualize microphone / line-in — no file needed">🎤 Live Input</button>
```

with:

```html
    <button class="btn" id="micBtn" title="Visualize microphone / line-in — no file needed">🎤 Live Input</button>
    <button class="btn" id="tabAudioBtn" title="Tab-/System-Audio visualisieren (Chrome/Edge empfohlen)">🖥️ Tab-/System-Audio</button>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 7 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Tab-/System-Audio as a live input source

toggleTabAudio() mirrors the existing toggleMic() pattern closely --
same live-analysis pipeline (initAudio, analyser routing, state
resets), same start/stop button shape -- sourcing from
getDisplayMedia({video:true, audio:true}) instead of getUserMedia.
Advertised as Chrome/Edge only per explicit product direction: a
missing-API check and a no-audio-track guard both fail with a clear,
specific message rather than a silent no-op or generic exception.

Handles both ways the capture can end: the app's own toggle button,
and the browser's native \"Stop sharing\" control (via the audio
track's onended handler calling back into the same toggle function,
so both paths run identical cleanup).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Block Advanced mode during live-input (mic or tab-audio)

**Files:**
- Modify: `elastic-morph.html:3254` (`startStemSeparation` — add the live-input guard)
- Test: `test.js` (extends the section from Task 1)

**Interfaces:**
- Consumes: `S.micMode` (existing), `S.tabAudioMode` (Task 1).
- Produces: no new interface — `startStemSeparation()`'s signature and existing behavior for non-live-input tracks are unchanged; this task only adds an earlier bail-out branch.

- [ ] **Step 1: Write the failing tests**

Add to the same `test.js` section from Task 1:

```js
ok("startStemSeparation refuses to start during either live-input mode (mic or tab-audio), reverting to Simple mode instead of submitting a stale previously-loaded file (regression guard: this was a known, previously-deferred gap for mic mode, and applies identically to the new tab-audio mode)", (() => {
  const fn = extractFn("startStemSeparation");
  return !!fn
    && fn.includes("if (S.micMode || S.tabAudioMode) {")
    && fn.includes('showAppToast("Advanced ist bei Live-Eingabe nicht verfügbar.", 3000);')
    && fn.includes('S.stemMode = "simple";\n    syncStemUI();\n    return;');
})());

ok("startStemSeparation's live-input guard runs after the analyzeState guard and before trackHash is read (so a live-input track never reaches the code that would key a job under S.fpHash)", (() => {
  const fn = extractFn("startStemSeparation");
  if (!fn) return false;
  const analyzeGuardIdx = fn.indexOf('if (S.analyzeState !== "done")');
  const liveGuardIdx = fn.indexOf("if (S.micMode || S.tabAudioMode)");
  const trackHashIdx = fn.indexOf("const trackHash = S.fpHash;");
  return analyzeGuardIdx >= 0 && liveGuardIdx > analyzeGuardIdx && trackHashIdx > liveGuardIdx;
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the 2 new assertions print `✗`.

- [ ] **Step 3: Implement**

At `elastic-morph.html:3254-3261`, replace:

```js
async function startStemSeparation() {
  if (S.analyzeState !== "done") {
    if (typeof showAppToast === "function") showAppToast("Track wird noch analysiert…", 3000);
    S.stemMode = "simple";
    syncStemUI();
    return;
  }
  const trackHash = S.fpHash;
```

with:

```js
async function startStemSeparation() {
  if (S.analyzeState !== "done") {
    if (typeof showAppToast === "function") showAppToast("Track wird noch analysiert…", 3000);
    S.stemMode = "simple";
    syncStemUI();
    return;
  }
  if (S.micMode || S.tabAudioMode) {
    if (typeof showAppToast === "function") showAppToast("Advanced ist bei Live-Eingabe nicht verfügbar.", 3000);
    S.stemMode = "simple";
    syncStemUI();
    return;
  }
  const trackHash = S.fpHash;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 2 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "fix: block Advanced (stem-separation) mode during live audio input

startStemSeparation() now bails out (reverting to Simple mode, with a
toast) whenever S.micMode or S.tabAudioMode is active, in addition to
the existing analyzeState guard. Neither live-input mode has a
downloadable file for the stem API -- without this guard, clicking
Advanced during mic or tab-audio input would silently submit whatever
file was loaded before switching to live input, keyed under that
stale file's fingerprint. This was a known, previously-deferred gap
for mic mode alone; closing it now since the new tab-audio mode
(this branch, prior commit) has the exact same failure mode.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after both tasks)

Not covered by `test.js` (no real `getDisplayMedia` picker in a static
harness) — verify in an actual Chrome or Edge window:

1. Click "🖥️ Tab-/System-Audio", pick a tab that's playing audio (e.g. a
   YouTube video), confirm "Audio teilen" is checked in the picker.
2. Confirm the visual reacts to that tab's audio, `BPM: live` is shown, and
   clicking the app's own stop button cleanly reverts (button text/label
   back to normal, no lingering stream — check `chrome://webrtc-internals`
   or the browser's tab-audio indicator if unsure).
3. Repeat, but this time end the capture via the browser's native "Stop
   sharing" bar instead of the app's button — confirm the app reverts just
   as cleanly (this is the `onended` path).
4. Try sharing a source with audio unchecked (or "Entire Screen" without
   audio support) — confirm the clear "please enable audio sharing"
   message appears instead of a silent no-op.
5. Switch to either live mode (mic or tab-audio) with a previously
   analyzed file still loaded, open Settings, click Advanced — confirm it
   is blocked with the new toast, not silently submitting the old file.
6. Try the button in Safari or Firefox — confirm the clear "use Chrome or
   Edge" message appears rather than a confusing native error.
