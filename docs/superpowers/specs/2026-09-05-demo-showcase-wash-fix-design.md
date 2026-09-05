# Demo Showcase Wash-Out Fix — Design

## Problem

`DEMO_SHOWCASE` (`src/inject-v93.js`) is the look auto-applied whenever a
visitor clicks "Demo starten" — the single most likely first action for
anyone trying the app without their own audio file. Live testing against the
production app (`elasticmorph.app`, not a synthetic capture) confirmed a real
first-impression defect: within seconds of playback, the visual degrades from
a colorful, detailed organism into a flat, low-contrast gray-green-pink haze
with no visible structure. This persists regardless of which Visual DNA
preset the visitor picks afterward, because the wash comes from state that
lives outside the preset system entirely.

Frank never noticed this because it's specific to the bundled demo track path
(`isBundledDemoShowcase()` only fires for `demoTrackMeta.source === "bundled"`
— a track he uploads himself never triggers it) — exactly the kind of gap a
developer testing with their own material doesn't encounter.

## Root Cause

Confirmed via live experimentation in the running app (toggling state via the
console and the Shader Engine panel, observing over 10+ second windows at
multiple points in the track):

The `clubStrobe` preset (`DEMO_SHOWCASE.presetId`) has `bgFade: 0.055` — one
of the lowest trail-clear rates of any preset in the app, meaning its
canvas trail buffer clears very slowly. `DEMO_SHOWCASE` layers two
independently-additive effects on top of that slow-clearing preset:

1. **`shader: { style: "laser", blend: "lighter", intensity: 0.84, opacity: 0.58 }`**
   — `"lighter"` (canvas `Add`) compositing is purely additive; against a
   slow-clearing background it accumulates toward white/gray over time no
   matter how low intensity/opacity are set. This was verified directly:
   dropping intensity to 0.4/opacity to 0.35 (with the FX below still active)
   did not fix it — only delayed it. The wash is structural (the blend mode),
   not a matter of degree.
2. **`fx: ["strobe", "shake"]`** — the beat-synced strobe flash is *also*
   additive-composited (`"lighter"`) independent of the shader, hitting the
   same slow-clearing preset. Verified independently: disabling just
   `strobe`/`shake` while leaving the original shader settings unchanged
   still measurably reduced (but did not eliminate) the wash.

Both contribute; neither alone is the full cause.

## Fix

Verified live, stable over 10+ second windows at multiple points in the demo
track (including a beat-drop moment, which now reads as a bright, punchy
flash rather than a wash-to-gray):

```js
shader: { on: true, style: "laser", intensity: 0.7, opacity: 0.5, blend: "overlay" },
fx: [],
```

- **Blend `"lighter"` → `"overlay"`**: this is the structural fix. `overlay`
  does not monotonically brighten toward white the way pure-additive
  `lighter` does, so the wash-out stops happening at all rather than merely
  being delayed. Confirmed stable over multiple 10-second observation windows
  where the `lighter`-blend version had already visibly degraded.
- **`intensity` 0.84 → 0.7, `opacity` 0.58 → 0.5**: a moderate reduction on
  top of the blend-mode fix; kept close to the original values since `overlay`
  no longer needs to be suppressed as hard to stay readable.
- **`fx: []`** (was `["strobe", "shake"]`): both removed. `strobe`'s
  additive flash was an independent wash contributor on this specific preset
  (see Root Cause #2) regardless of the shader fix. `shake` (camera jitter)
  wasn't independently implicated in the wash but has no established purpose
  here once `strobe` is gone, and removing it wasn't observed to cost
  anything visually in testing. The preset's own name and identity
  ("Club Strobe") are unaffected — this only changes which FX auto-enable
  when the demo showcase applies it, not the preset itself, which remains
  available and unchanged everywhere else in the app.

`DEMO_SHOWCASE.ctrl` and `DEMO_SHOWCASE.mix` are untouched — the wash was
fully explained by the shader/FX combination above, and both were confirmed
to no longer reproduce it once shader blend + FX were changed.

## Non-Goals

- **The Smart Look mismatch** (the app's own recommendation panel suggests
  a different top preset than the hardcoded showcase applies). Noted during
  the same investigation, but this is a separate, lower-priority cosmetic
  inconsistency, not a rendering defect — deliberately out of scope here.
- **Changing the `clubStrobe` preset's own `bgFade`**. That would affect
  every use of the preset throughout the app, not just this demo-showcase
  context. The fix stays scoped to what `DEMO_SHOWCASE` itself layers on top.
- **A general audit of other presets/showcases for the same class of bug.**
  This spec fixes the one confirmed, live-verified instance (the default
  first-run demo path). If Frank wants a broader sweep for other
  low-`bgFade` + additive-FX combinations elsewhere in the app, that's a
  separate follow-up.

## Testing

New `test.js` assertions:

- `DEMO_SHOWCASE.shader` has `blend: "overlay"`, `intensity: 0.7`,
  `opacity: 0.5` (and still `style: "laser"`, `on: true`, unchanged).
- `DEMO_SHOWCASE.fx` is an empty array.
- `DEMO_SHOWCASE.ctrl`, `DEMO_SHOWCASE.mix`, and `DEMO_SHOWCASE.presetId` are
  unchanged from their current values (guards against accidental scope creep
  into the parts of the showcase that were confirmed fine).

No new manual live-check beyond what's already been done for this round —
the fix was validated live before being written up, not the other way
around. The plan's implementer should re-verify once more after landing the
change (demo track, Shader Engine panel showing `Blend: Overlay`, watch for
10+ seconds, confirm no wash — same protocol used during this investigation).

## Open questions

None — Frank approved proceeding with the full pipeline after reviewing the
live-tested findings and proposed values above.
