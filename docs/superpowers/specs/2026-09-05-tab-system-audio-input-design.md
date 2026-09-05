# Tab-/System-Audio as an Input Source — Design

## Problem

Elastic Morph currently accepts two audio sources: an uploaded file, and
live microphone/line-in (`toggleMic()`, `elastic-morph.html:10292`). Both
require either a downloadable file or a physical audio input — there is no
way to visualize audio already playing elsewhere on the user's machine
(a YouTube tab, Spotify desktop app, another browser tab). This was flagged
in the earlier competitive analysis as a gap versus tools like
Kaleidosync/VVavy, which support exactly this.

## Goals

- Add a third live-audio source: capture a browser tab's or the system's
  audio via the browser's native screen/tab-sharing picker
  (`getDisplayMedia`), and route it into the same live analysis pipeline
  microphone input already uses.
- Advertise this explicitly as a Chrome/Edge feature (confirmed with
  Frank) — those are the two browsers with reliable tab-audio-sharing
  support. Other browsers get a clear error message rather than a silent
  failure, not a maintained fallback path.
- Handle the browser's own "Stop sharing" control (not just our app's
  toggle button) cleanly — the capture can end at any time from outside
  our UI, and the app must revert to its normal idle state when it does.
- **Close a related, previously-deferred gap while touching this code:**
  Advanced (stem-separation) mode is currently reachable during microphone
  input, where it would submit a stale previously-loaded file instead of
  the live stream. Since this spec adds a *second* live-audio source with
  the exact same characteristic (no downloadable file exists for a live
  stream), both live modes get the same guard in this pass.

## Non-Goals

- **No maintained fallback for Safari/Firefox.** The button and its
  tooltip say "Chrome/Edge"; on an unsupported browser the capture attempt
  fails with a clear error message (same pattern as the existing
  `alert("Microphone access failed: ...")` in `toggleMic`), not a
  degraded-but-working alternative.
- **No audio routing/monitoring changes.** Captured tab/system audio is
  analyzed for visualization only; whether the shared tab's own audio
  keeps playing through the system speakers is entirely up to the browser
  and outside this app's control (same as how `getUserMedia` for the mic
  doesn't affect other apps using the microphone).
- **No visual/UI redesign of the capture picker.** The tab/window/screen
  picker shown by `getDisplayMedia` is the browser's own native UI; this
  app cannot customize it.

## Design

### 1. New state field

```js
tabAudioMode: false,   // true while capturing tab/system audio via getDisplayMedia
```

Added next to `micMode: false,` (`elastic-morph.html:2945`).

### 2. `toggleTabAudio()` — mirrors `toggleMic()`

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
    audioTracks[0].onended = () => { if (S.tabAudioMode) toggleTabAudio(); };  // browser's own "Stop sharing" control
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

`tabAudioStream`/`tabAudioSrc` are new top-level `let` variables declared
alongside the existing `micStream`/`micSrc` variables.

Two exits are handled: our own button (the `if (S.tabAudioMode)` branch at
the top, identical shape to `toggleMic`'s), and the browser's native "Stop
sharing" bar, via `audioTracks[0].onended` — which calls `toggleTabAudio()`
again to run the exact same cleanup path, rather than duplicating the
teardown logic in two places.

### 3. New button

```html
<button class="btn" id="tabAudioBtn" title="Tab-/System-Audio visualisieren (Chrome/Edge empfohlen)">🖥️ Tab-/System-Audio</button>
```

Inserted immediately after the existing `micBtn` (`elastic-morph.html:1033`).

### 4. Closing the Advanced-during-live-input gap

`startStemSeparation()` (`elastic-morph.html:3254`) currently guards only
on `S.analyzeState !== "done"`. Add a second guard immediately after it,
covering both live-input modes:

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
  ...
```

This reuses the exact revert pattern (`S.stemMode = "simple"; syncStemUI();`
plus a toast) already established for the `analyzeState` guard, so the two
checks read as one consistent family of preconditions rather than two
different styles.

### 5. Error handling

- Missing API (`getDisplayMedia` undefined): caught before ever calling it,
  clear German message naming Chrome/Edge.
- User cancels the picker, or the picker throws (`NotAllowedError` and
  similar): caught by the existing `try/catch`, surfaced via the same
  `alert(...)` pattern `toggleMic` already uses for its own failures.
- User shares a source with **no audio track** (e.g., picks "Entire
  Screen" in a browser/OS combination that doesn't support system audio,
  or unchecks "Share audio" in the picker): detected via
  `tabAudioStream.getAudioTracks().length === 0`, all tracks are stopped
  immediately, and a specific message tells the user to enable audio
  sharing — rather than silently visualizing nothing.
- Mid-session end via the browser's own "Stop sharing" UI: handled via
  `track.onended`, calling back into `toggleTabAudio()` for symmetric
  cleanup (see §2).

### 6. Testing

Same static-source-assertion style as the rest of `test.js`:

- `S.tabAudioMode` default (`false`) present in the `S` object literal.
- `toggleTabAudio` exists, checks for `getDisplayMedia` support before
  attempting capture, requests `{ video: true, audio: true }`, stops video
  tracks immediately, and rejects (with all tracks stopped) when no audio
  track is present.
- `toggleTabAudio`'s teardown branch (mirrors `toggleMic`'s) correctly
  disconnects/stops/nulls the stream and reconnects `analyser` to
  `audioCtx.destination`.
- The `audioTracks[0].onended` handler is wired to call `toggleTabAudio`
  again.
- `startStemSeparation`'s new `S.micMode || S.tabAudioMode` guard exists,
  positioned after the `analyzeState` guard and before `trackHash` is read.
- New button markup (`#tabAudioBtn`) exists with the Chrome/Edge-mentioning
  tooltip, and its click listener is wired to `toggleTabAudio`.

### 7. Manual live-check (after implementation)

Not covered by `test.js` (no real `getDisplayMedia` picker in a static
harness) — verify in an actual Chrome or Edge window:

1. Click "🖥️ Tab-/System-Audio", pick a tab that's playing audio (e.g. a
   YouTube video), confirm "Audio teilen" is checked in the picker.
2. Confirm the visual reacts to that tab's audio, `BPM: live` is shown, and
   clicking the app's own stop button cleanly reverts (button text/label
   back to normal, no lingering stream).
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

## Open questions

None — Frank confirmed: explicitly advertise Chrome/Edge only (no
maintained fallback), and a separate dedicated button next to "Live Input"
rather than a combined menu.
