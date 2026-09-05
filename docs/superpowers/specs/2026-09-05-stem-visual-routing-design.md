# Stem Separation Integration (Part B: Visual Routing) — Design

## Problem

Part A (shipped, commit `9203e71`) added an "Advanced" mode that fetches and
analyzes stem-separated audio (vocals/drums/bass/other) via the Elastic
Split API, exposing the result as `S.stemCurves` — a per-stem, offline,
240-window energy envelope, same shape as the app's existing
`S.energyCurve`. Nothing yet reads `S.stemCurves` for rendering: Advanced
mode currently changes no visible output at all.

This spec covers **Part B**: making Advanced mode visibly worth switching
to, by routing stem data into a small, deliberately limited set of existing
visual parameters.

## Goals

- When Advanced mode is active and stems are ready, enrich two existing,
  already-audio-reactive visual mechanisms with stem-specific data instead
  of (or in addition to) the current whole-mix signal:
  - **Vocals → color drift**: vocal presence nudges the DNA visual's hue.
  - **Drums → camera shake**: drum-hit presence intensifies the existing
    "Shake" FX effect's punch.
- **Zero behavior change for Simple mode, or for Advanced mode before stems
  are ready.** Every user who never touches the new feature — which is
  everyone today, since Part A shipped with no visual effect — must see
  pixel-identical output to before this spec.
- No new UI. This is a "the feature you already opted into just got
  better" enhancement, not a new user-facing control.

## Non-Goals

- **Bass and Other stems.** Confirmed with Frank: this round covers exactly
  the two mappings above (Vocals→color, Drums→camera), matching the
  "keep it small" instruction — mirroring how Frequency Band Reactivity
  shipped its own first round narrowly and left a broader routing matrix
  for later. Wiring Bass/Other into anything is a separate future round if
  wanted.
- **A generic "stem routing matrix" or new intensity slider.** Approach B
  (a "Stem-Reaktivität" slider) and Approach C (routing into the Shader
  Engine's Speed/Scale/Color Bias uniforms instead) were both considered
  and explicitly declined in favor of the smaller, zero-new-UI approach.
- **Any change to Part A's job lifecycle, state, or Settings UI.** This
  spec only adds a new pure-function helper and two one-line formula
  changes in already-existing render functions.

## Design

### 1. `sampleStemLive(stemName)` — the shared live-sampling helper

`S.stemCurves.<stem>` is an offline, whole-track curve indexed 0..239 by
normalized track position — the same shape `S.energyCurve` already has, and
the timeline waveform (`drawWave()`, `elastic-morph.html:9629`) already
demonstrates how to read a value out of such a curve at the current
playback position. This helper generalizes that read pattern for stems,
and is the single gate that makes every downstream integration point
automatically inert until Advanced mode has real data:

```js
function sampleStemLive(stemName) {
  if (S.stemMode !== "advanced" || !S.stemJob || S.stemJob.status !== "ready" || !S.stemCurves) return 0;
  const curve = S.stemCurves[stemName];
  if (!curve || !curve.length) return 0;
  const idx = Math.min(curve.length - 1, Math.max(0, Math.floor(S.progress * (curve.length - 1))));
  return curve[idx];
}
```

`S.progress` (`elastic-morph.html:5283` et al.) is the app's existing
live, per-frame, 0..1 normalized playback position — already used for
exactly this kind of curve-lookup elsewhere in the codebase.

Neither this function nor either integration point below touches any
`src/inject-vNN.js`-sourced code: `drawScene` and `applyPostFX` (the two
functions modified) are both confirmed native to `elastic-morph.html`
(verified via `grep -n "function drawScene\|function applyPostFX" src/*.js`
— no match), so no build-injection gotcha applies here and no `node
build.js` rebuild step is needed for this feature.

### 2. Vocals → color drift

`drawScene()` (`elastic-morph.html:5925`) currently computes the DNA
visual's live hue-drift value once per frame:

```js
S.hueShift = S.progress * driftRange * ctrl.colorDrift * 2;
```

`S.hueShift` already feeds the main DNA render (`elastic-morph.html:5927`:
`hue = P.hue + S.fpHue + S.hueShift`) and two existing CSS
`hue-rotate(...)` filters used for memory-snapshot/mirror-layer blending
(`elastic-morph.html:6328`, `6346`) — so enriching this one value
automatically and consistently enriches all three consumers, with no
separate change needed at any of them.

New formula:

```js
S.hueShift = S.progress * driftRange * ctrl.colorDrift * 2 + sampleStemLive("vocals") * 30;
```

`30` (degrees) is a starting value, proportionate to the drift range's own
existing swing (`driftRange * ctrl.colorDrift * 2` can already span
multiple hundreds of degrees over a full track) — to be confirmed or
retuned during the manual live-check below, the same way the Shader Engine
Parameters' magnitudes were tuned after their first live test.

### 3. Drums → camera shake

`applyPostFX()`'s existing "Shake" FX effect (`elastic-morph.html:7279-7287`,
labelled "camera shake on hits" in the FX Rack UI) currently computes shake
amplitude from the whole-mix transient/beat signals:

```js
if (fx.shake) {
  const amp = (S.transient * 0.7 + S.beat * 0.5) * W * 0.025;
  ...
}
```

New formula:

```js
const amp = (S.transient * 0.7 + S.beat * 0.5 + sampleStemLive("drums") * 0.6) * W * 0.025;
```

`0.6` is proportionate to the existing `0.7`/`0.5` coefficients — a
starting value, tunable at the live-check. This only has any effect when
the user has already turned the Shake FX effect on (`fx.shake` truthy) —
consistent with the existing opt-in-via-FX-Rack pattern; Advanced mode
does not turn Shake on by itself.

### 4. Error handling

Both formulas are pure numeric arithmetic once `sampleStemLive` returns a
safe `0`-or-real-number value — there is no new failure mode to handle.
`sampleStemLive` itself guards every precondition (`stemMode`, `stemJob`
existence/status, `stemCurves` existence, per-stem curve existence/length)
before ever indexing into an array, so it cannot throw.

### 5. Testing

Same static-source-assertion style as the rest of `test.js`:

- `sampleStemLive` exists as a standalone function with the documented
  signature and guard conditions.
- `drawScene`'s `S.hueShift` assignment includes the new
  `+ sampleStemLive("vocals") * 30` term, alongside the pre-existing drift
  formula (regression guard: the original formula must still be present
  unchanged, not replaced).
- `applyPostFX`'s shake-amplitude line includes the new
  `+ sampleStemLive("drums") * 0.6` term, alongside the pre-existing
  `S.transient * 0.7 + S.beat * 0.5` formula (same regression-guard
  reasoning).

### 6. Manual live-check (after implementation)

Not covered by static tests — verify with a real track that has clear
vocal sections and drum hits:

1. Load a track, switch to Advanced, wait for "Bereit ✓".
2. Compare a vocal-heavy section against an instrumental section — confirm
   a visible, subtle hue shift correlates with vocal presence (not jarring,
   not imperceptible).
3. Turn on the Shake FX effect, compare a drum-heavy section against a
   quiet one — confirm shake intensity visibly correlates with drum hits,
   beyond what the whole-mix-only shake already did.
4. Switch back to Simple mode (or use a track with no stems fetched yet) —
   confirm both effects revert exactly to their pre-this-spec behavior.
5. If either `30` or `0.6` feels too strong/weak, adjust and re-verify.

## Open questions

None — Frank confirmed: keep this round small (Vocals→color, Drums→camera
only, matching Approach A: automatic, no new UI, reusing the existing
Shake FX effect and the existing `S.hueShift` mechanism).
