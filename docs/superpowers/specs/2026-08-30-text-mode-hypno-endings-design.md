# Text Mode — Hypno Loop + 5 Text Endings: Design Spec

**Status:** Approved by Frank ("prima")
**Date:** 2026-08-30

## Goal

Two additions to the Text Mode ("song title / artist / label" overlay), per Frank's request:

1. **Hypno Loop** — a new, endlessly-looping `textAnim` option: a zoom-tunnel echo effect,
   audio-reactive in speed, that never resets (unlike every existing anim, which is a one-shot
   transition measured from `S.textT0`).
2. **5 Text Endings** — F1–F5, live VJ-style manual triggers. Pressing one plays a distinct
   ~0.5–1.0s out-fade on whatever text is currently showing, then hides it (same end-state as
   unchecking "Show text layer", just with a flourish instead of a hard cut).

## Context

*Line numbers throughout this spec are as of its writing (2026-08-30) — re-confirm with a fresh
`grep -n` immediately before editing; this session's convention (line numbers drift constantly
as the file grows).*

Text Mode already has 15 `textAnim` options (`elastic-morph.html:1260-1279`,
handled in `drawTextLayer`, `elastic-morph.html:7479`) and 5 `textPattern` layouts
(straight/circle/arc/wave/zigzag, `elastic-morph.html:1251-1257`, drawn by the nested
`drawPatternText` for the title line only). Rendering is one function, `drawTextLayer(W, H, hue,
P)`, called once per frame (`elastic-morph.html:5944`). It resolves one `anim` value into a set
of flags (`alpha`, `scale`, `glitch`, `chroma`, `wave`, `bounce`, `scramble`, `depth3d`, ...),
then two nested functions read those closed-over flags to actually paint: `paintLine` (straight
text, all lines) and `drawPatternText` (title only, when `textPattern !== "straight"` —
it only reads `alpha`/`glow`/`textStyle`, so anim flags like `wave`/`scramble`/`depth3d` already
silently no-op there today; this spec's new flags inherit the same graceful degradation without
extra code).

**Key availability, corrected mid-brainstorm:** Frank asked whether Shift+number was already
taken. It partially is — `Shift+1–8` recalls Scene Bank slots
(`elastic-morph.html:10588`, via `e.code` matching `Digit1`–`Digit8`, which is why an
`e.key`-based grep missed it earlier in this same conversation). Not used for this spec: we
settled on **F1–F5**, confirmed completely free (no binding anywhere touches function keys).

## Design

### Part A — Hypno Loop (new `textAnim: "hypno"`)

Added as a 16th option in `<select id="textAnim">` (`elastic-morph.html:1261-1279`, right after
"Intro & Outro only", the last existing entry). Mechanism: a persistent phase accumulator, `S.textHypnoPhase` (new state
field, 0), advances every frame by `dt * (0.18 + S.mids*0.30 + S.loudness*0.14)` and wraps at 1 —
same "accumulator driven by audio, not raw `S.time`" shape used by FX Rack II's Spin/Pulse Zoom,
needed so speed changes don't cause phase jumps. One loop cycle runs roughly 1.6s (loud, dense
mix) to 5.5s (quiet).

Rendering (inside `paintLine`, since pattern-text already ignores this flag and falls back to a
plain single copy — acceptable, matches how `depth3d`/`scramble` already behave there): draw 4
staggered copies of the line. Each copy's own phase is the shared phase offset by its slot
(`k/4`, wrapped), driving both scale (1× → 2.6×, "growing toward camera") and alpha (fades to 0 as
it grows, so it dissolves right as the next copy spawns behind it) — a continuous tunnel-of-echoes
read, via `ctx.translate`/`ctx.scale` around the text anchor rather than changing font size (so
the 4 copies can coexist in one frame). `drawTextLayer` needs `dt` to drive the accumulator, which
it doesn't currently receive — its signature and call site both gain a `dt` parameter (the caller
already has a local `dt` in scope, used by `drawLayerB`/`applyPostFX2` two lines above).

Hypno works identically in lyric mode (unlike "Intro & Outro only", which is disabled there) —
its phase is independent of `S.textT0`/per-line restarts, so no special-casing is needed.

### Part B — 5 Text Endings (F1–F5, manual trigger)

New state: `S.textEnding` (default `null`) holds `{ type, t0 }` when one is playing. A small
helper:

```js
function triggerTextEnding(type) {
  const lyricMode = S.lyrics.on && S.lyrics.cues.length > 0;
  if (lyricMode) return;                                                   // scoped out, see Non-Goals
  if (!S.textShow || (!S.textTitle && !S.textArtist && !S.textLabel)) return;  // nothing to end
  S.textEnding = { type, t0: S.time };
}
```

bound in the keydown handler:

```js
if (e.key === "F1") { e.preventDefault(); triggerTextEnding("shatter"); }
if (e.key === "F2") { e.preventDefault(); triggerTextEnding("vortexsuck"); }
if (e.key === "F3") { e.preventDefault(); triggerTextEnding("dissolve"); }
if (e.key === "F4") { e.preventDefault(); triggerTextEnding("iris"); }
if (e.key === "F5") { e.preventDefault(); triggerTextEnding("glitchout"); }
```

Pressing a different F-key (or the same one again) while an ending is already playing simply
restarts `t0` with the new type — instant live control, no queueing, no "please wait" state.

**The elegant part:** an ending's `type` string (`"shatter"`, `"vortexsuck"`, `"dissolve"`,
`"iris"`, `"glitchout"`) is deliberately never added to the `textAnim` `<select>` — it lives in
the same string space as the persistent anims but is only reachable via `S.textEnding`, not
user-selectable. `drawTextLayer` resolves which `anim` to actually run like this:

```js
const ending = !lyricMode ? S.textEnding : null;
const anim = ending ? ending.type
           : (lyricMode && S.textAnim === "phases") ? "static" : S.textAnim;
const endingP = ending ? Math.min(1, (S.time - ending.t0) / TEXT_ENDING_DUR[ending.type]) : 0;
```

with

```js
const TEXT_ENDING_DUR = { shatter: 0.6, vortexsuck: 1.0, dissolve: 0.9, iris: 0.8, glitchout: 0.5 };
```

So the 5 endings become 5 more branches in the *same* `if (anim === ...) { ... } else if (...)`
chain that already handles all 15 existing anims — no parallel rendering path, no duplicated
layout/font/color/multi-line logic. After the normal render for this frame completes, one check
finalizes a finished ending:

```js
if (ending && endingP >= 1) {
  S.textEnding = null; S.textShow = false;
  const cb = $("textShow"); if (cb) cb.checked = false;   // same show/hide idiom used elsewhere (e.g. elastic-morph.html:17629-17630)
}
```

**Per-ending mechanism** (each reuses an existing rendering primitive already present in
`paintLine`, rather than inventing pixel-level shard extraction):

- **Shatter** (F1) — per-character fly-apart: each character gets a deterministic pseudo-random
  angle/distance (`((i*9301 + charCode*49297) % 233280) / 233280`-style formula, stable across
  frames without stored state — no `Math.random()`), flying outward and rotating as `endingP`
  grows, `alpha = 1 - endingP`. Same per-character loop shape as the existing `scramble`/`wave`
  branches.
- **Vortex Suck** (F2) — per-character spiral: each character's position lerps from its natural
  spot toward the line's own anchor point as `endingP → 1`, with an added rotation (`endingP * 3π`)
  around that anchor and scale shrinking to 0 — the mirror image of the Hypno loop's outward
  growth. `alpha = 1 - endingP`.
- **Dissolve** (F3) — reverse of the existing `scramble` anim: characters increasingly turn into
  random glyphs (reusing `scramble`'s existing character set) left-to-right as `endingP` grows,
  simultaneously fading (`alpha = 1 - endingP`) — a one-shot temporal mirror of an existing
  effect, no new character-set needed.
- **Iris Close** (F4) — a shrinking circular clip (`ctx.arc` + `ctx.clip()`) centered on the
  line, radius `(1 - endingP) * size * 3.2`, wrapping the normal glyph draw — reuses the same
  `ctx.clip()` technique the existing Karaoke Wipe anim already uses (there: a growing rectangle;
  here: a shrinking circle). Also sets `alpha = 1 - endingP` redundantly alongside the clip, so
  pattern-text titles (which don't see the clip, only `alpha`) still fully fade instead of
  staying static until the clip abruptly finishes.
- **Glitch Blackout** (F5) — reuses the existing `chroma`/`glitch` RGB-split rendering
  (`elastic-morph.html:7760`) with its split distance driven by `endingP` instead of
  `S.transient`, plus a flicker (`Math.random() < 0.25 + endingP*0.5` gates full-vs-dim alpha
  per frame) that thickens toward a hard cut to nothing.

## Non-Goals

- **Lyric mode**: Endings are a no-op while synced lyrics are active (`triggerTextEnding` returns
  early). Per-line lyric text already restarts itself on every cue change; an ending fighting that
  restart has no coherent "finished" state, matching why "Intro & Outro only" is already disabled
  in lyric mode today.
- **No automatic song-end trigger** — purely manual, per Frank's choice.
- **No new UI markup for Endings** — F1–F5 only, no buttons/chips. (Hypno Loop *does* get one new
  `<option>` in the existing dropdown — that's data, not new UI structure.)
- **No help-overlay update in this round** — `#helpOverlay`'s keyboard section
  (`elastic-morph.html:2049-2059`) is not touched; if Frank wants F1–F5 documented there, that's a
  one-line follow-up, not blocking this feature.
- **Pattern-text titles don't get the per-character flourish** for Shatter/Vortex/Dissolve (only
  the shared `alpha` fade) — same pre-existing limitation as `wave`/`scramble`/`depth3d` today,
  not a new gap introduced by this feature.

## Testing

Following this session's established `test.js` pattern (structural `extractFn`/`.includes()`
checks against `elastic-morph.html`'s assembled `script` — this code lives entirely pre-marker,
ordinary default-`script` `extractFn` calls apply):

- `drawTextLayer`'s signature includes a `dt` parameter, and its call site passes one.
- `TEXT_ENDING_DUR` exists with exactly the 5 keys `shatter`/`vortexsuck`/`dissolve`/`iris`/
  `glitchout`, each a positive number.
- `triggerTextEnding` exists, early-returns when `S.lyrics.on && S.lyrics.cues.length`, and
  early-returns when `!S.textShow`.
- The keydown handler contains 5 distinct `e.key === "F1"`..`"F5"` checks, each calling
  `triggerTextEnding` with one of the 5 type strings, all 5 types distinct.
- `<select id="textAnim">` contains a `value="hypno"` option; `S` default state contains
  `textHypnoPhase: 0` and `textEnding: null`.
- None of the 5 ending type strings (`shatter`, `vortexsuck`, `dissolve`, `iris`, `glitchout`)
  appear as an `<option value="...">` in the `textAnim` select — they must stay
  trigger-only, never user-selectable as a persistent style.
- The `anim === "hypno"` branch advances `S.textHypnoPhase` and never lets it grow unbounded
  (stays within `[0, 1)` after many simulated frames — a genuine behavioral test via `loadFns` +
  a mock `S`, following this session's precedent for accumulator/state-machine logic).
- The post-render completion check clears `S.textEnding` and sets `S.textShow = false` once
  `(S.time - t0) / TEXT_ENDING_DUR[type] >= 1`, and does neither before that — another behavioral
  test via `loadFns` with a mock `S` and a fake `$` returning a stub checkbox element, asserting
  `checked` ends up `false`.

## Live Verification

Same protocol as every prior round this session: local dev server first (select each of the 5
new-to-this-round things — Hypno Loop from the Animation dropdown, then each of F1–F5 with text
showing — screenshot each), then confirm the same on the deployed site via SHA-256 hash match
against `https://elasticmorph.app/elastic-morph.html` after push. Specifically confirm: Hypno
Loop's echoes are visible and looping without ever hard-resetting; each F-key produces a visually
distinct fade and the checkbox for "Show text layer" ends up unchecked afterward; F1–F5 are
no-ops while synced lyrics are on; re-pressing a different F-key mid-ending immediately switches
to the new ending instead of queuing.
