# Help Overlay Update: Design Spec

**Status:** Approved by Frank ("passt")
**Date:** 2026-08-31

## Goal

The `?` Help Overlay's keyboard-shortcuts section is stale: it doesn't mention yesterday's F1–F5
Text Endings at all, and separately still says "FX Rack I+II" in the "Ebenen" summary even though
FX Rack III ("Cinematic", Alt+1–0) has existed for a while. Pure documentation fix — no rendering
or state changes, no risk to anything else.

## Context

*Line numbers are as of this spec's writing (2026-08-31) — re-confirm with a fresh `grep -n`
immediately before editing.*

Both touch points are in `#helpOverlay`/`#helpCard` (`elastic-morph.html:2041`+):
- `elastic-morph.html:2051` — the "Ebenen (stapelbar)" prose line, currently ending
  `<b>FX Rack I+II</b>`.
- `elastic-morph.html:2059-2060` — the "Tastatur (Desktop)" `<span>` list, where the 3 existing
  FX Rack lines live.

## Design

Two one-line edits:

1. Add a new `<span>` right after the FX Rack III line, documenting F1–F5.
2. Fix "FX Rack I+II" → "FX Rack I–III" in the Ebenen summary.

**Deliberately not included**: no mention of the Ending-Dauer slider — it's a visible, self-labeled
(% value) UI control in the Text panel, not a hidden shortcut. This overlay's job is surfacing
things a user wouldn't otherwise discover, which keyboard shortcuts are and a visible slider isn't.

## Exact Code

### A) Ebenen summary (`elastic-morph.html:2051`)

Find:
```html
        <p><b>Shader</b> (GPU) · <b>Visual DNA</b> (Kern-Organismus) · <b>Particles</b> · <b>Layer B</b> · <b>Bild A/B</b> · <b>FX Rack I+II</b></p>
```
Replace:
```html
        <p><b>Shader</b> (GPU) · <b>Visual DNA</b> (Kern-Organismus) · <b>Particles</b> · <b>Layer B</b> · <b>Bild A/B</b> · <b>FX Rack I–III</b></p>
```

### B) Tastatur list (`elastic-morph.html:2059-2060`)

Find:
```html
          <span><b>Ctrl+1–0</b> FX Rack II</span>
          <span><b>Alt+1–0</b> FX Rack III</span>
```
Replace:
```html
          <span><b>Ctrl+1–0</b> FX Rack II</span>
          <span><b>Alt+1–0</b> FX Rack III</span>
          <span><b>F1–F5</b> Text-Endings (Shatter/Vortex/Dissolve/Iris/Glitch)</span>
```

## Non-Goals

- No mention of the Ending-Dauer slider (see Design).
- No mention of Hypno Loop (a dropdown-selected `textAnim` value, not a shortcut — nothing to
  document here).
- No other staleness sweep of the rest of the overlay — scope stays to what this conversation
  actually surfaced.

## Testing

Structural check via `test.js` (`html.includes(...)`, not `script` — this is raw markup):
- `html` no longer contains `"FX Rack I+II"`.
- `html` contains `"FX Rack I–III"`.
- `html` contains the new F1–F5 `<span>` line, positioned after the Alt+1–0 line and before the
  Zoom line (a `.indexOf` ordering check, not just presence).

## Live Verification

Open the app, press `?`, confirm both lines read correctly and the new F1–F5 line renders where
expected, no layout overflow in the two-column help card.
