# Tab-/System-Audio Cosmetic Backlog — Design

## Problem

The 2026-09-05 Tab-/System-Audio feature
(`docs/superpowers/plans/2026-09-05-tab-audio-transport-parity.md`) fixed
the core audio-reactivity pipeline and 6 transport/seek functions, but left
a documented cosmetic backlog: several UI/dramaturgy checks still gate only
on `S.micMode`, missing the equally-live `S.tabAudioMode`. Picking that
backlog up now, per Frank's request. Found 5 sites sharing this exact
pattern:

1. **HUD time label** (`elastic-morph.html:10285-10287`) shows `0:00 /
   0:00` instead of `LIVE · mm:ss` during tab-audio (falls into the
   file-playback branch, reading `audioEl.currentTime`/`duration`, both
   empty since no file is loaded).
2. **Intro-cover gate** (`introAlpha()`, `elastic-morph.html:5826`) never
   shows the cover image during tab-audio — its "is something playing"
   check is `audioEl.src || S.micMode`.
3. **Drop-dramaturgy virtual-cycle duration** (`elastic-morph.html:5970`)
   uses the generic 180s "nothing loaded" fallback during tab-audio instead
   of the 240s virtual cycle mic mode gets — drop timing is tuned for a
   live, unbounded stream, same as mic.
4. **Look-swipe hint + suggestions** (`src/inject-v65.js:28,49`,
   `getCreatorLookPicks`/`updateLookSwipeHint`) never show during tab-audio
   — same `audioEl.src || S.micMode` "has a track" check.
5. **Demo banner** (`src/inject-v65.js:67`, `updateDemoBanner`) — the
   opposite direction: its "nothing is playing, suggest the demo" check
   (`!audioEl.src && !S.micMode`) doesn't exclude tab-audio, so the banner
   could incorrectly appear while tab-audio is actively capturing.

All 5 are consequences of the same root cause already documented in the
2026-09-05 work: `S.tabAudioMode` was added as a second "live audio active"
signal alongside `S.micMode`, and every site that checks the *concept* of
"is live audio playing" needs both flags, not just the original one.

## Goals

- All 5 sites treat `S.tabAudioMode` identically to `S.micMode` for the
  purpose of "is live/unbounded audio currently active."
- No change to file-playback or idle-state behavior — only the tab-audio
  path gains parity with mic.

## Non-Goals

- Not auditing the whole codebase for every remaining `S.micMode`-only
  site — the 2026-09-05 work already closed the ones that mattered for
  core functionality (reactivity, transport, seek); these 5 are the
  specific ones already identified and documented as backlog.
- Not touching export support for Tab-/System-Audio — still explicitly out
  of scope per the 2026-09-05 spec.

## Design

Five one-line changes, all the same shape (`S.micMode` → `S.micMode ||
S.tabAudioMode`, or the negated form for the demo banner):

**1. Time label** (`elastic-morph.html:10285`):
```js
// before
$("timeLabel").textContent = S.micMode
// after
$("timeLabel").textContent = (S.micMode || S.tabAudioMode)
```

**2. `introAlpha()`** (`elastic-morph.html:5826`):
```js
// before
if (!S.intro.on || !(audioEl.src || S.micMode)) return 0;
// after
if (!S.intro.on || !(audioEl.src || S.micMode || S.tabAudioMode)) return 0;
```

**3. Drop-dramaturgy cycle duration** (`elastic-morph.html:5970`):
```js
// before
if (S.micMode) dur = 240; else if (!audioEl.src) dur = 180;
// after
if (S.micMode || S.tabAudioMode) dur = 240; else if (!audioEl.src) dur = 180;
```

**4a. `getCreatorLookPicks`** (`src/inject-v65.js:28`):
```js
// before
const hasTrack = !!(S.audioBuffer || audioEl.src || S.micMode);
// after
const hasTrack = !!(S.audioBuffer || audioEl.src || S.micMode || S.tabAudioMode);
```

**4b. `updateLookSwipeHint`** (`src/inject-v65.js:49`):
```js
// before
    && !!(S.audioBuffer || audioEl.src || S.micMode);
// after
    && !!(S.audioBuffer || audioEl.src || S.micMode || S.tabAudioMode);
```

**5. `updateDemoBanner`** (`src/inject-v65.js:67`, negated direction —
excluding tab-audio rather than including it):
```js
// before
const show = S.demoMode && !audioEl.src && !S.micMode;
// after
const show = S.demoMode && !audioEl.src && !S.micMode && !S.tabAudioMode;
```

### Error handling

None needed — `S.tabAudioMode` is a plain boolean already set/cleared by
the existing `toggleTabAudio()` (2026-09-05), always defined by the time
any of these 5 sites run.

### Testing

Same static-source-assertion style as `test.js`: for the 3 native
`elastic-morph.html` sites, extract the enclosing function
(`updateUI`/`introAlpha`/`drawScene`) and confirm each line matches the "after"
form exactly. For the 2 `src/inject-v65.js` sites, extract
`getCreatorLookPicks`/`updateLookSwipeHint`/`updateDemoBanner` (build-injected
— test against the assembled `script`, after `node build.js`).

### Manual live-check (after implementation)

1. Start Tab-/System-Audio capture (no file loaded, not mic) — confirm the
   HUD time label reads `LIVE · mm:ss` (counting up), not `0:00 / 0:00`.
2. With an intro cover image configured and Tab-/System-Audio active —
   confirm the cover shows and fades out on schedule, same as it already
   does for mic.
3. In Creator mode on a touch device (or with `is-touch` class forced) with
   Tab-/System-Audio active — confirm the look-swipe hint and suggestions
   appear.
4. With Demo Mode on and Tab-/System-Audio active — confirm the demo
   banner does NOT appear (it should only prompt when truly idle).
