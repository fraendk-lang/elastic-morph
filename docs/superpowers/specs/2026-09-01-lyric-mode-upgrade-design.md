# Lyric Mode Upgrade: Design Spec

**Status:** Approved by Frank ("okay")
**Date:** 2026-09-01

## Goal

Three improvements to synced Lyrics, found during a review Frank requested ("Was schlägst du für
den Lyric Mode vor?"): a real timing bug in the Karaoke Wipe animation, a missing next-line
preview (standard in karaoke UX), and a new style preset using the just-shipped Hypno Loop.

## Context

*Line numbers are as of this spec's writing (2026-09-01) — re-confirm with a fresh `grep -n`
immediately before editing.*

`drawTextLayer` (`elastic-morph.html:7559`) resolves lyric mode via `currentLyric()`
(`elastic-morph.html:8597`), which scans `S.lyrics.cues` (sorted by time) and returns only the
*current* line — no next-line lookahead exists today. The Karaoke Wipe animation
(`anim === "karaoke"`, `elastic-morph.html:7608`) always runs a fixed 2.4s wipe
(`S.time - S.textT0) / 2.4`) regardless of how long the line is actually displayed before the next
cue replaces it — a short line (next cue under 2.4s away) gets replaced mid-wipe, a real visual
bug, not a style choice.

**Reusable slot found for the next-line preview**: `drawTextLayer`'s line-building code already
constructs up to 3 stacked lines (title/artist/label), and in lyric mode `label` is *always*
forced empty (`label = fmt(lyricMode ? "" : S.textLabel)`) — the label slot is completely unused
during lyrics. It already renders smaller than title/artist AND already gets the "dim" treatment
(`paintLine(l, l.role === "label")` passes `dim=true` specifically for that role) — exactly the
visual treatment a de-emphasized upcoming-line preview needs, with zero new rendering code.
Redirecting what populates that slot in lyric mode (next-cue text instead of always-empty) reuses
100% of existing machinery.

**Lyrics Studio presets** (`LYRICS_STUDIO_PRESETS`, `elastic-morph.html:16890`) are a plain array
rendered into buttons by `injectLyricsPresetRow()`'s `.forEach` — adding a 4th entry needs no
markup change, the button appears automatically.

## Design

**1. Karaoke Wipe duration adapts to the real gap.** When a lyric line's cue changes, compute the
time until the *next* cue (`next.t - cur.line.t`; falls back to 2.4s if there's no next cue — the
last line of the song) and clamp it to `[0.6, 2.4]` seconds — the floor keeps very short lines
from wiping instantly/invisibly, the ceiling keeps the existing feel for long lines. Store it as
`S.lyricWipeDur`; the Karaoke Wipe branch uses it instead of the hardcoded `2.4` whenever
`lyricMode` is active, and keeps the original fixed `2.4` for the *non-lyric* Karaoke Wipe (used
on manually-typed Title/Artist text, which has no "next cue" concept at all).

**2. Next-line preview, always on when lyrics are active.** No new toggle — this is standard
karaoke behavior, not a stylistic option, matching this session's "don't add a knob for something
that should just work" bias. The upcoming cue's text populates the existing label slot (auto-empty
when there's no next line, e.g. the last cue), inheriting its established smaller/dimmed styling.

**3. "Hypno" 4th Lyrics Studio preset.** Centered, uses `anim: "hypno"`, `fill` style (an outline
style would read messily through Hypno's echo trail), shadow on for legibility over busy
backgrounds — same field shape as the existing `poster`/`untertitel` entries.

## Exact Code

### A) New helper + `drawTextLayer`'s lyric-mode setup — next-line lookahead + adaptive wipe
duration (`elastic-morph.html:7556-7569`)

Find:
```js
function finalizeTextEndingIfDone() {
  const ending = S.textEnding;
  if (!ending) return;
  const p = Math.min(1, (S.time - ending.t0) / textEndingDuration(ending.type));
  if (p < 1) return;
  S.textEnding = null;
  S.textShow = false;
  const cb = $("textShow");
  if (cb) cb.checked = false;
}
function drawTextLayer(W, H, hue, P, dt) {
  /* source of text: synced lyrics take over when enabled, else the designer fields */
  let srcTitle, srcArtist;
  const LY = S.lyrics;
  const lyricMode = LY.on && LY.cues.length > 0;
  if (lyricMode) {
    const cur = currentLyric();
    if (cur.idx !== LY.index) { LY.index = cur.idx; S.textT0 = S.time; }  // restart per-line animation
    if (!cur.line || !cur.line.text) return;       // instrumental gap → nothing shown
    srcTitle = cur.line.text; srcArtist = "";
  } else {
```
Replace:
```js
function finalizeTextEndingIfDone() {
  const ending = S.textEnding;
  if (!ending) return;
  const p = Math.min(1, (S.time - ending.t0) / textEndingDuration(ending.type));
  if (p < 1) return;
  S.textEnding = null;
  S.textShow = false;
  const cb = $("textShow");
  if (cb) cb.checked = false;
}
// v137: Karaoke Wipe's duration for a synced lyric line — adapts to the real gap until the next
// cue instead of a fixed 2.4s that could outlast a short line. nextT is null for the last cue.
function lyricWipeDuration(curT, nextT) {
  return Math.max(0.6, Math.min(2.4, nextT != null ? nextT - curT : 2.4));
}
function drawTextLayer(W, H, hue, P, dt) {
  /* source of text: synced lyrics take over when enabled, else the designer fields */
  let srcTitle, srcArtist, lyricNextText = "";
  const LY = S.lyrics;
  const lyricMode = LY.on && LY.cues.length > 0;
  if (lyricMode) {
    const cur = currentLyric();
    if (cur.idx !== LY.index) { LY.index = cur.idx; S.textT0 = S.time; }  // restart per-line animation
    if (!cur.line || !cur.line.text) return;       // instrumental gap → nothing shown
    srcTitle = cur.line.text; srcArtist = "";
    // v137: next-line preview + Karaoke Wipe duration both need the upcoming cue
    const next = LY.cues[cur.idx + 1];
    lyricNextText = next ? next.text : "";
    S.lyricWipeDur = lyricWipeDuration(cur.line.t, next ? next.t : null);
  } else {
```

### B) Karaoke Wipe branch — adaptive in lyric mode (`elastic-morph.html:7608-7609`)

Find:
```js
  } else if (anim === "karaoke") {
    karaoke = Math.max(0, Math.min(1, (S.time - S.textT0) / 2.4));
```
Replace:
```js
  } else if (anim === "karaoke") {
    karaoke = Math.max(0, Math.min(1, (S.time - S.textT0) / (lyricMode ? S.lyricWipeDur : 2.4)));
```

### C) `label` now carries the next-line preview in lyric mode (`elastic-morph.html:7667`)

Find:
```js
  let title = fmt(srcTitle), artist = fmt(srcArtist), label = fmt(lyricMode ? "" : S.textLabel);
```
Replace:
```js
  let title = fmt(srcTitle), artist = fmt(srcArtist), label = fmt(lyricMode ? lyricNextText : S.textLabel);
```

### D) New "Hypno" preset, appended to `LYRICS_STUDIO_PRESETS` (`elastic-morph.html:16890`+)

Find:
```js
  {
    id: "poster", name: "Poster",
    show: true, pos: "c", font: "poster", color: "white", anim: "breathe", size: 1.48,
    style: "outline", plate: false, shadow: true, lower: false, circle: false,
    upper: false, weight: "900", track: 2, blend: "source-over",
    hint: "Eine Zeile, viel Luft in der Mitte"
  }
];
```
Replace:
```js
  {
    id: "poster", name: "Poster",
    show: true, pos: "c", font: "poster", color: "white", anim: "breathe", size: 1.48,
    style: "outline", plate: false, shadow: true, lower: false, circle: false,
    upper: false, weight: "900", track: 2, blend: "source-over",
    hint: "Eine Zeile, viel Luft in der Mitte"
  },
  {
    id: "hypno", name: "Hypno",
    show: true, pos: "c", font: "sans", color: "white", anim: "hypno", size: 1.2,
    style: "fill", plate: false, shadow: true, lower: false, circle: false,
    upper: false, weight: "700", track: 1, blend: "source-over",
    hint: "Endloser Zoom-Sog, mitten im Bild"
  }
];
```

## Non-Goals

- **No word-level karaoke timing** — cues stay line-granular (tap-sync taps one time per line);
  the wipe duration fix adapts to real *line* timing, it doesn't add sub-line word timestamps.
- **No toggle for the next-line preview** — always on when lyrics are active, per the design
  reasoning above.
- **No changes to tap-sync UX, .lrc import, or the cue list** — untouched this round.
- **No new preset fields or preset system changes** — the Hypno preset uses the exact same field
  shape every existing preset already uses.

## Testing

Following this session's established `test.js` pattern (structural `extractFn`/`.includes()`
checks against the assembled `script`):

- `lyricWipeDuration` is defined and called from `drawTextLayer`'s lyric-mode setup; `drawTextLayer`
  declares `lyricNextText` and computes `next`/`S.lyricWipeDur` inside the `lyricMode` branch.
- The Karaoke Wipe branch reads `lyricMode ? S.lyricWipeDur : 2.4` — confirms both the lyric-mode
  adaptive path AND that non-lyric-mode Karaoke Wipe (Title/Artist) keeps the original fixed
  `2.4`, unchanged.
- The `label` line now reads `fmt(lyricMode ? lyricNextText : S.textLabel)` — confirms
  `S.textLabel` still governs the non-lyric case unchanged.
- `LYRICS_STUDIO_PRESETS` contains exactly 4 entries (up from 3), the new one has `id: "hypno"`
  and `anim: "hypno"`.
- A genuine behavioral check on `lyricWipeDuration` itself (via `loadFns`, no mocking needed — it's
  a pure function of its two arguments, following the same small-testable-helper pattern already
  used for `advanceHypnoPhase`): `lyricWipeDuration(10, 11)` (a 1.0s gap) returns `1.0` (within
  `[0.6, 2.4]`, passes through unchanged); `lyricWipeDuration(10, 14)` (a 4.0s gap) returns `2.4`
  (clamped down from `4.0`); `lyricWipeDuration(10, 10.2)` (a 0.2s gap) returns `0.6` (clamped up
  from `0.2`); `lyricWipeDuration(10, null)` (last cue, no next) returns `2.4`.

## Live Verification

Import or type a few short lyric lines with tap-sync timings close together (under 2.4s apart),
select the Karaoke preset, confirm the wipe now completes before the line changes (no visible
mid-wipe cutoff). Confirm the next line appears as a smaller/dimmed line beneath the current one,
and disappears cleanly on the last line (no leftover/stale preview text). Select the new "Hypno"
preset and confirm the echo-trail loop renders correctly with lyric text, including through line
changes (no visual glitch on cue transitions).
