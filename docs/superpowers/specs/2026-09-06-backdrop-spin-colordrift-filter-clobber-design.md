# Backdrop/Spin Color Drift Clobbers Image Layer Filter — Design

## Problem

Live debugging (`superpowers:systematic-debugging`) on the deployed production
app found a real, independent bug behind Frank's report "in Safari lassen
sich die Farben immer noch nicht auswählen" (Safari: the colors still can't
be selected), tested via the "Portrait Glow" Image Layer preset
(`mode: "backdrop"`, `filter: "dreamy"`).

Confirmed by intercepting `ctx.drawImage` calls live in production: the
actual `ctx.filter` value active when `IM.img` is drawn in `backdrop` mode is
always `hue-rotate(...) saturate(...)`, **never** the user's selected filter
("dreamy" or any other) — regardless of which Image Layer filter is picked
from the dropdown.

Root cause: `elastic-morph.html`'s `drawImageLayer` function sets `ctx.filter`
in two places for these two modes:

1. The filter-applying wrapper (`initImageLayerV67`) sets `ctx.filter` to the
   user's selected `IM.filter` (e.g. "dreamy" → `blur(0.6px) brightness(1.06)
   saturate(1.12)`) *before* calling the original `drawImageLayer`.
2. Inside `drawImageLayer`'s own `backdrop` (`elastic-morph.html:6416`) and
   `spin` (`elastic-morph.html:6434`) branches, an older, independent line —
   `if (ctrl.colorDrift > 0.02) ctx.filter = \`hue-rotate(${...}deg)
   saturate(${...})\`;` — unconditionally **overwrites** whatever the wrapper
   just set, whenever the DNA "Color Drift" control exceeds `0.02`.

`colorDrift`'s default value is `0.5` (`elastic-morph.html:2796`), and it
appears in every checked default DNA preset at `0.4-0.6` — so in practice
this condition is true almost always, meaning `backdrop` and `spin` silently
ignore the Image Layer filter dropdown entirely. This is a pure JS logic
bug: `ctx.filter` is one property, and colorDrift's automatic tint always
wins because it's set second. It reproduces identically in Chrome and
Safari — not a Safari-specific rendering quirk, which explains why the
earlier per-mode scratch-canvas fix (which targeted a different, real bug in
8 *other* modes) didn't touch this at all.

This bug is unrelated to, and predates, the scratch-canvas filter
performance work shipped earlier the same day
(`docs/superpowers/specs/2026-09-06-image-layer-filter-scratch-canvas-design.md`).
`backdrop`/`spin` were correctly identified in that work's audit as *not*
loop-heavy (single `drawImage` call each) — that classification is still
correct; this is a completely separate defect in the same two modes.

## Goals

- When the user has explicitly selected an Image Layer filter (`IM.filter
  !== "none"`), that filter must actually apply to `backdrop` and `spin`,
  matching the behavior of all other 16 Image Layer modes.
- Preserve the existing Color Drift automatic tint behavior for users who
  have *not* selected a filter (`IM.filter === "none"`) — this appears to be
  the feature's original intent (an automatic, always-on visual accent for
  `backdrop`/`spin` specifically), and removing it entirely would be an
  unrequested behavior change beyond fixing the bug.

## Non-Goals

- Not touching any of the other 16 Image Layer modes — this bug is confirmed
  specific to `backdrop`'s (`elastic-morph.html:6416`) and `spin`'s
  (`elastic-morph.html:6434`) own inline `ctx.filter` lines.
- Not changing `colorDrift`'s default value, range, or its other uses
  elsewhere in the file (e.g. DNA layer hue drift, particle hue drift) —
  those are unaffected by this bug and out of scope.
- Not investigating the still-open, separate "Chrome becomes unusable with
  color filters" performance report — live profiling on production so far
  points away from Image Layer entirely (its own render code measured under
  1ms/frame) toward a different, not-yet-isolated cause; that remains a
  separate, ongoing investigation, not blocked by or related to this fix.

## Design

Two one-line changes, both adding an `IM.filter === "none" &&` guard so the
automatic tint only applies when the user hasn't picked their own filter:

**`backdrop`** (`elastic-morph.html:6416`):
```js
// before
if (ctrl.colorDrift > 0.02) ctx.filter = `hue-rotate(${(S.hueShift * 2) | 0}deg) saturate(${1 + beat * 0.5})`;
// after
if (IM.filter === "none" && ctrl.colorDrift > 0.02) ctx.filter = `hue-rotate(${(S.hueShift * 2) | 0}deg) saturate(${1 + beat * 0.5})`;
```

**`spin`** (`elastic-morph.html:6434`):
```js
// before
if (ctrl.colorDrift > 0.02) ctx.filter = `hue-rotate(${(S.hueShift * 2) | 0}deg) saturate(${1 + beat * 0.4})`;
// after
if (IM.filter === "none" && ctrl.colorDrift > 0.02) ctx.filter = `hue-rotate(${(S.hueShift * 2) | 0}deg) saturate(${1 + beat * 0.4})`;
```

`IM` (the Image Layer state object — `S.image` or `S.image2`) is already the
first parameter of `drawImageLayer(IM, W, H, baseHue, dt, opMul)` and in
scope at both call sites — no new parameter or state needed.

### Why this doesn't need the filter-applying wrapper touched

The wrapper (`initImageLayerV67`) already sets `ctx.filter` to the user's
selection *before* calling into `backdrop`/`spin`. With the guard added,
when `IM.filter !== "none"`, these branches now simply skip their own
`ctx.filter` reassignment — the wrapper's already-correct value survives
untouched all the way to `ctx.drawImage(IM.img, ...)`. When `IM.filter ===
"none"`, the wrapper never touched `ctx.filter` in the first place (its own
`if (IM.filter && IM.filter !== "none")` guard skips it), so the branch's
own colorDrift tint is free to set it, exactly as before this fix.

### Error handling

None needed — this is a pure boolean-guard addition to existing,
unconditionally-reached code with no new failure modes.

### Testing

Same static-source-assertion style as the rest of `test.js`: extract
`drawImageLayer`'s source and confirm both lines now read `if (IM.filter ===
"none" && ctrl.colorDrift > 0.02) ctx.filter = ...` verbatim (both the
`beat * 0.5` backdrop variant and the `beat * 0.4` spin variant).

### Manual live-check (after implementation)

Not covered by the static test harness (no real filter-vs-colorDrift visual
comparison possible in `test.js`):

1. Select `backdrop` mode, pick a strong filter (e.g. "Schwarzweiß"), with
   Color Drift at its default (~50) — confirm the filter is now visibly
   applied (previously: invisible, always showing the hue-rotate tint
   instead).
2. Same for `spin`.
3. Select `backdrop` or `spin` with filter left at "Kein" (none) — confirm
   the automatic Color Drift hue tint still animates as before (no
   regression for users who don't pick a filter).
4. Confirm this is now true in **both** Chrome and Safari (the bug was
   browser-independent, so the fix should be too).
