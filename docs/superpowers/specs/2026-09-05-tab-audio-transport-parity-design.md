# Tab-/System-Audio Transport Parity — Design

## Problem

The Tab-/System-Audio feature (shipped `896de8a`) made the core analysis
pipeline correctly react to `S.tabAudioMode`, but six transport/seek
functions still branch on `S.micMode` alone. In the sequence "load a file,
play it, then switch to Tab-/System-Audio" (`audioEl.src` stays set from the
earlier file), these functions return a frozen `audioEl.currentTime` instead
of the live `S.virtualT` clock — freezing synced lyrics (`currentLyric()`
consumes `playPos()`) and the Cue/Set automation system (`updateCues()`
consumes `curTimeSec()`), and making seek/skip act on the paused file.
Starting tab-audio fresh (no prior file load) is unaffected, since these
functions already fall through to `S.virtualT` when `audioEl.src` is empty.

## Goals

- Extend all six affected functions — `playPos()`, `seekSeconds()`,
  `seekFraction()`, `skip()`, `curTimeSec()`, `setDuration()` — to treat
  `S.tabAudioMode` exactly like `S.micMode` for the purpose of choosing
  between `S.virtualT` and `audioEl.currentTime`/`audioEl.duration`.
- `setDuration()` returns `240` (mic's virtual-cycle length) for tab-audio
  too, not the `180` fallback used when no track is loaded at all.

## Non-Goals

- **Cosmetic sibling gaps** (HUD time label showing `0:00` instead of
  `LIVE · mm:ss`, the intro-cover gate, the demo hint) — confirmed with
  Frank: out of scope for this round, deferred as backlog. One of them
  (the demo hint) lives in a build-injected `src/inject-v65.js`, adding
  risk disproportionate to a cosmetic fix.
- **Export support for Tab-/System-Audio** — already declined in the
  prior round, unaffected by this change.

## Design

All six functions are native to `elastic-morph.html` (confirmed via
`grep -n "function playPos\|function seekSeconds\|function seekFraction\|function skip\b\|function curTimeSec\|function setDuration" src/*.js` —
no match), so every edit goes directly into `elastic-morph.html`, no
`node build.js` rebuild needed.

```js
function playPos() { return (S.micMode || S.tabAudioMode) ? S.virtualT : (audioEl.src ? audioEl.currentTime : S.virtualT); }

function seekSeconds(t) {
  if (S.micMode || S.tabAudioMode || !audioEl.src) S.virtualT = Math.max(0, t);
  else if (audioEl.duration) audioEl.currentTime = Math.max(0, Math.min(audioEl.duration - 0.05, t));
}

function seekFraction(f) {
  f = Math.max(0, Math.min(1, f));
  S.lastDropHit = null;
  if (S.micMode || S.tabAudioMode) { S.virtualT = f * 240; return; }
  if (!audioEl.src) { S.virtualT = f * 180; return; }
  if (audioEl.duration) audioEl.currentTime = f * audioEl.duration;
}

function skip(sec) {
  if (S.micMode || S.tabAudioMode || !audioEl.src) { S.virtualT = Math.max(0, S.virtualT + sec); return; }
  if (audioEl.duration) audioEl.currentTime = Math.max(0, Math.min(audioEl.duration - 0.05, audioEl.currentTime + sec));
}

function curTimeSec() {
  return (S.micMode || S.tabAudioMode) ? S.virtualT : (audioEl.src ? (audioEl.currentTime || 0) : S.virtualT);
}

function setDuration() {
  if (S.micMode || S.tabAudioMode) return 240;
  if (audioEl.src && isFinite(audioEl.duration) && audioEl.duration > 0) return audioEl.duration;
  return 180;
}
```

Each change is a single `||` addition to an existing condition — no new
state, no new functions, no behavior change for anyone not using
Tab-/System-Audio with a previously-loaded file.

### Error handling

None needed — pure boolean-condition arithmetic, same risk profile as the
functions' existing code.

### Testing

Same static-source-assertion style as the rest of `test.js`: one assertion
per function, checking the exact new condition text is present.

### Manual live-check (after implementation)

1. Load a file, play it, pause, switch to Tab-/System-Audio (share any tab
   with audio).
2. Confirm the timeline/scrubber no longer sits frozen at the file's last
   position, and that synced lyrics (if a lyrics-mode track with cues is
   active) advance rather than staying stuck.
3. Confirm seek/skip controls (if reachable during live input) act on the
   live virtual clock, not the paused file's `currentTime`.

## Open questions

None — Frank confirmed scope: the 6 functional sites only, cosmetic
siblings deferred.
