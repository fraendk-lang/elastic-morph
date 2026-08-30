# Text Ending Duration Slider: Design Spec

**Status:** Approved by Frank ("passt")
**Date:** 2026-08-30

## Goal

Frank, right after using the just-shipped F1–F5 Text Endings: "die texteffekte gehen zu schnell
vorbei" (the text effects pass by too quickly). Make all 5 endings' durations adjustable via one
slider in the Text panel, rather than the fixed 0.5–1.0s baked into `TEXT_ENDING_DUR`.

## Context

*Line numbers are as of this spec's writing (2026-08-30) — re-confirm with a fresh `grep -n`
immediately before editing, this file drifts constantly.*

The 5 Text Endings (F1–F5: Shatter/Vortex Suck/Dissolve/Iris Close/Glitch Blackout, shipped
earlier today) each read a fixed duration from `TEXT_ENDING_DUR` (`elastic-morph.html:7494`) in
exactly two places: `drawTextLayer`'s `endingP` calculation (`elastic-morph.html:7530`) and
`finalizeTextEndingIfDone` (`elastic-morph.html:7503-7511`). Both compute
`(S.time - t0) / <duration>` to get 0→1 progress.

The Text panel (Pro mode) already has an established convention for exactly this kind of control —
a `min`/`max`/`value` `<input type="range">` representing a percentage, backed by an `S` field
stored as a fraction (e.g. `S.textSize`, 50–400% → `S.textSize` 0.5–4.0), wired through: (1) the
`<div class="opt">` markup with a paired `<span class="val">`, (2) an `input` event listener that
writes `S` and updates the value label, (3) a sync line inside `applyProject`'s UI-refresh block
(`elastic-morph.html:8408`, project-load) that sets the slider from `S`, and (4) an entry in the
project save/load blob (`elastic-morph.html:8243`/`8304`, the `text: {...}` object).

**Deliberately narrower than `textSize`'s footprint**: `textSize` (and every other field in that
save blob) is also part of the smaller "Text style preset" system (`TEXT_PRESETS`/
`applyTextPreset`/`syncTextPresetUI`, `elastic-morph.html:13738-13790`ish) — switching a look
preset changes how the title *looks*. The Ending duration is a different kind of setting — how
Frank's *live-trigger effects feel*, not part of a title's visual identity — so it should not
silently change just because he switches to a different style preset mid-show. This spec
therefore adds the new field to the main project save/load (so it persists with a saved project,
matching Frank's "genau wie alle anderen Text-Einstellungen" approval) but deliberately **excludes**
it from `TEXT_PRESETS`/`applyTextPreset`/`syncTextPresetUI`.

## Design

**One multiplier, not five sliders.** Frank confirmed all 5 endings feel too short (not just
some), and this is a live-performance feature where fewer knobs matters — so one slider scales all
5 `TEXT_ENDING_DUR` values uniformly, preserving each ending's relative "character" (Glitch
Blackout stays short/hard relative to the slower Vortex Suck, just everything stretched by the
same factor).

**Mechanism**: `S.textEndingScale` (float, default `1.4`), a new small helper —

```js
function textEndingDuration(type) {
  return TEXT_ENDING_DUR[type] * (S.textEndingScale || 1);
}
```

— replaces the two direct `TEXT_ENDING_DUR[ending.type]` reads. `TEXT_ENDING_DUR` itself stays
untouched (the base "character" table); the scale is applied at read time.

**Slider**: "Ending-Dauer", range 50–200%, default 140% (`S.textEndingScale = 1.4`) — placed
directly after the existing "Size" slider in the Text panel, matching its exact markup/wiring
shape. Default raised above 100% per Frank's explicit choice during brainstorming (not just
matching today's speed — addressing the "too fast" feedback out of the box).

**Live effect, including mid-ending**: because `textEndingDuration` is read fresh every frame (not
snapshotted at trigger time), moving the slider while an ending is already playing immediately
changes its remaining time — confirmed as the desired behavior (a deliberate live-performance
perk: dragging the slider mid-fade can stretch or compress an ending in real time), not an
accidental side effect to guard against.

## Exact Code

### A) New slider markup, right after the existing "Size" control (`elastic-morph.html:1306-1309`)

Find:
```html
        <div class="opt"><span>Size</span>
          <input type="range" id="textSize" min="50" max="400" value="100">
          <span class="val" id="textSizeVal">100%</span>
        </div>
        <div class="opt"><span>Shadow</span>
```
Replace:
```html
        <div class="opt"><span>Size</span>
          <input type="range" id="textSize" min="50" max="400" value="100">
          <span class="val" id="textSizeVal">100%</span>
        </div>
        <div class="opt"><span>Ending-Dauer</span>
          <input type="range" id="textEndingScale" min="50" max="200" value="140">
          <span class="val" id="textEndingScaleVal">140%</span>
        </div>
        <div class="opt"><span>Shadow</span>
```

### B) `S` default state, right after `textEnding: null,` (`elastic-morph.html:2894`)

Find:
```js
  textEnding: null,
```
Replace:
```js
  textEnding: null,
  // v135: live-adjustable multiplier on all 5 Text Endings' base durations (F1-F5) —
  // 1.0 = TEXT_ENDING_DUR's original values, default raised to 1.4 per Frank's "too fast" feedback
  textEndingScale: 1.4,
```

### C) New helper, right after `TEXT_ENDING_DUR` (`elastic-morph.html:7494`)

Find:
```js
const TEXT_ENDING_DUR = { shatter: 0.6, vortexsuck: 1.0, dissolve: 0.9, iris: 0.8, glitchout: 0.5 };
```
Replace:
```js
const TEXT_ENDING_DUR = { shatter: 0.6, vortexsuck: 1.0, dissolve: 0.9, iris: 0.8, glitchout: 0.5 };
// v135: the base table above stays fixed (each ending's relative "character" — Glitch Blackout
// short and hard vs. Vortex Suck slow — is preserved); S.textEndingScale scales all 5 uniformly.
function textEndingDuration(type) {
  return TEXT_ENDING_DUR[type] * (S.textEndingScale || 1);
}
```

### D) `drawTextLayer`'s `endingP` (`elastic-morph.html:7530`)

Find:
```js
  const endingP = ending ? Math.min(1, (S.time - ending.t0) / TEXT_ENDING_DUR[ending.type]) : 0;
```
Replace:
```js
  const endingP = ending ? Math.min(1, (S.time - ending.t0) / textEndingDuration(ending.type)) : 0;
```

### E) `finalizeTextEndingIfDone` (`elastic-morph.html:7503-7507`)

Find:
```js
function finalizeTextEndingIfDone() {
  const ending = S.textEnding;
  if (!ending) return;
  const p = Math.min(1, (S.time - ending.t0) / TEXT_ENDING_DUR[ending.type]);
  if (p < 1) return;
```
Replace:
```js
function finalizeTextEndingIfDone() {
  const ending = S.textEnding;
  if (!ending) return;
  const p = Math.min(1, (S.time - ending.t0) / textEndingDuration(ending.type));
  if (p < 1) return;
```

### F) Event listener, right after `textSize`'s (`elastic-morph.html:9222-9225`)

Find:
```js
$("textSize").addEventListener("input", e => {
  S.textSize = e.target.value / 100;
  $("textSizeVal").textContent = e.target.value + "%";
});
```
Replace:
```js
$("textSize").addEventListener("input", e => {
  S.textSize = e.target.value / 100;
  $("textSizeVal").textContent = e.target.value + "%";
});
$("textEndingScale").addEventListener("input", e => {
  S.textEndingScale = e.target.value / 100;
  $("textEndingScaleVal").textContent = e.target.value + "%";
});
```

### G) Project save blob (`elastic-morph.html:8249`, the `text: {...}` object's last line)

Find:
```js
            custom2: S.textCustom2, gradDir: S.textGradDir, pattern: S.textPattern, blend: S.textBlend },
```
Replace:
```js
            custom2: S.textCustom2, gradDir: S.textGradDir, pattern: S.textPattern, blend: S.textBlend,
            endingScale: S.textEndingScale },
```

### H) Project load-apply, inside `applyProject` (`elastic-morph.html:8310-8312`)

Find:
```js
  S.textPattern = t.pattern || (t.circle ? "circle" : "straight");   // v119: back-compat with old "circle" boolean
  S.textLabel = t.label || ""; S.textLower = !!t.lower;
  S.textBlend = t.blend || "source-over"; if ($("textBlend")) $("textBlend").value = S.textBlend;
```
Replace:
```js
  S.textPattern = t.pattern || (t.circle ? "circle" : "straight");   // v119: back-compat with old "circle" boolean
  S.textLabel = t.label || ""; S.textLower = !!t.lower;
  S.textBlend = t.blend || "source-over"; if ($("textBlend")) $("textBlend").value = S.textBlend;
  S.textEndingScale = t.endingScale != null ? t.endingScale : 1.4;   // v135
```

### I) `applyProject`'s UI sync (`elastic-morph.html:8407-8409`)

Find (this exact 2-line `textSize` sync pattern also appears in the unrelated `syncTextPresetUI`,
but with different surrounding lines — the block below, including the `textStyle`/`textPlate`
line before and the `textLabel`/`textLower` line after, is unique to `applyProject`):
```js
  $("textStyle").value = S.textStyle; $("textPlate").checked = S.textPlate;
  $("textSize").value = Math.round(S.textSize * 100); $("textSizeVal").textContent = Math.round(S.textSize * 100) + "%";
  $("textLabel").value = S.textLabel; $("textLower").checked = S.textLower;
```
Replace:
```js
  $("textStyle").value = S.textStyle; $("textPlate").checked = S.textPlate;
  $("textSize").value = Math.round(S.textSize * 100); $("textSizeVal").textContent = Math.round(S.textSize * 100) + "%";
  $("textEndingScale").value = Math.round(S.textEndingScale * 100); $("textEndingScaleVal").textContent = Math.round(S.textEndingScale * 100) + "%";
  $("textLabel").value = S.textLabel; $("textLower").checked = S.textLower;
```

## Non-Goals

- **Not 5 independent sliders** — Frank explicitly chose one shared multiplier over per-ending
  control, trading fine-grained control for a simpler live-performance surface.
- **Not part of `TEXT_PRESETS`/`applyTextPreset`/`syncTextPresetUI`** — deliberately excluded, see
  Context above. Switching a Text style preset must not change Frank's preferred Ending speed.
- **No change to `TEXT_ENDING_DUR`'s base values** — they stay exactly as shipped earlier today;
  only the multiplier is new.
- **No snapshotting at trigger time** — the scale is read live every frame, including mid-ending,
  per Frank's explicit choice.

## Testing

Following this session's established `test.js` pattern (structural `extractFn`/`.includes()`
checks; per the last two rounds' corrected lesson, any check against raw `<input>`/`<select>`
markup uses `html`, never `script`, since `script` is JS-only/HTML-stripped in this harness):

- The `textEndingScale` `<input type="range">` exists in the Text panel with `min="50"`,
  `max="200"`, `value="140"`, plus its paired `<span id="textEndingScaleVal">140%</span>`.
- `S` default state has `textEndingScale: 1.4`.
- `textEndingDuration` exists, multiplies `TEXT_ENDING_DUR[type]` by `S.textEndingScale`, and
  falls back to `1` if `S.textEndingScale` is falsy (genuine behavioral test via `loadFns` + a
  mock `global.S`/`global.TEXT_ENDING_DUR`: assert e.g. `textEndingDuration("shatter")` with
  `S.textEndingScale = 2` returns exactly `1.2` for a base of `0.6`, and that omitting
  `textEndingScale` from the mock `S` falls back to the unscaled base value).
- Both `drawTextLayer`'s `endingP` line and `finalizeTextEndingIfDone` call `textEndingDuration(...)`
  and no longer reference `TEXT_ENDING_DUR[ending.type]` directly.
- The event listener updates `S.textEndingScale` and the value label from the slider's raw value
  (structural check for `e.target.value / 100`).
- The project save blob includes `endingScale: S.textEndingScale`; `applyProject`'s load-apply
  sets `S.textEndingScale` from `t.endingScale`, falling back to `1.4` when absent (an older saved
  project without this field must not end up with `undefined`/`NaN`).
- `applyTextPreset`'s source does **not** reference `textEndingScale` anywhere (confirms the
  Non-Goals scoping — a look preset must not touch it).

## Live Verification

Set the slider to a few different positions (e.g. 50%, 100%, 140%, 200%), trigger each of F1–F5,
and confirm the visual duration scales accordingly (roughly — exact frame-timing isn't the bar,
"noticeably longer/shorter and proportionate to the slider" is). Confirm dragging the slider while
an ending is actively playing visibly changes its remaining time. Save a project, reload it,
confirm the slider position and `S.textEndingScale` survive. Switch a Text style preset and
confirm `S.textEndingScale` is untouched by that action.
