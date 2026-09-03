# Timeline Per-Clip Filter & Fit — Design

## Problem

The background Video Timeline (`S.bgVidCues`) supports multiple images/video
clips, each already with its own `fadeIn`/`fadeOut`/`transType`/`transDur`. But
the visual grade of a clip — its color filter (one of 7 presets: none,
cinematic, bw, duotone, vintage, dreamy, neon) and its fit mode (cover vs.
contain) — is controlled by a single global `S.bgVid.filter` / `S.bgVid.cover`
applied identically to every clip on the timeline. Frank flagged this directly:
"Images in der Timeline... haben keine Möglichkeit in Farbe und Format geändert
zu werden" — no way to grade or fit an individual clip differently from the
rest.

This is the deferred half of the observation that also produced the Shader
Engine Parameters feature (`2026-09-03-shader-engine-parameters-design.md`);
that spec covers the Shader Engine only, this one covers the timeline.

## Goals

- Let each clip on the Video Timeline override **Filter** (one of the existing
  7 presets) and **Fit** (cover/contain) independently.
- Default to the current global setting when a clip has no override — live,
  not a one-time snapshot: changing the global Filter/Fit control still
  affects every clip that hasn't been explicitly overridden.
- Old saved projects (cues without these fields) keep working unchanged.

## Non-Goals

- **Opacity and Blend Mode per clip.** Frank scoped this explicitly to Filter
  + Fit ("Farbe und Format") — Opacity/Blend affect the composition with the
  DNA visual as a whole, not the individual clip's own look, and stay global.
- **A visual override indicator on the timeline's mini clip blocks** (e.g. an
  icon showing "this clip has a custom filter"). The per-clip panel already
  shows the current effective value when a clip is selected; a timeline-block
  indicator is a nice-to-have, not requested, and out of scope for v1.
- **Per-clip aspect ratio / crop position.** The app's canvas aspect ratio is
  chosen once at the export level (16:9/9:16/1:1), not per clip; "Format" here
  means the existing Fit toggle, which the app's own UI already labels that
  way ("Fit: cover (fill frame)").

## Design

### 1. Data model

Every cue (`addBgVidClipAt`, `elastic-morph.html:11057-11079`, currently
`{ t, dur, fadeIn, fadeOut, name, src, el, kind, transType, transDur }`) gains:

```js
filter: null,   // null = follows the global filter; else one of the 7 preset
                 // ids used by BG_VID_FILTERS: "none" | "cinematic" | "bw" |
                 // "duotone" | "vintage" | "dreamy" | "neon"
fit: null,       // null = follows the global fit; else "cover" | "contain"
```

`null` and `undefined` both mean "inherit" (checked via `!= null`), so a cue
loaded from an old saved project — which simply lacks these keys — inherits
the global setting automatically, no migration needed.

Note the tri-state distinction: `filter: null` ("inherit whatever the global
filter is") is different from `filter: "none"` ("explicitly no filter on this
clip, regardless of the global setting"). Both must remain selectable.

### 2. Render path

`updateBgVideoTimeline(t)` (`elastic-morph.html:5411-5466`) already computes
the currently-active `cue` each frame and mirrors `cue.el`/`cue.src` onto the
global `S.bgVid` object (line 5426). It gains one more mirrored field so the
steady-state draw path (which doesn't otherwise have a `cue` variable in
scope) can reach it:

```js
S.bgVid.el = cue.el; S.bgVid.src = cue.src; S.bgVid.on = true; S.bgVid._active = true;
S.bgVid._cue = cue;                                                          // NEW
```

In the `else` branch (no active cue — a gap), also clear it: `S.bgVid._cue = null;`

`drawBgVideoTimeline(W, H)` (`elastic-morph.html:5476`) has two local helpers,
`drawClip` and `drawGlitchClip`, and ~9 call sites (the steady-state call, one
call per transition type — dissolve/wipe/slide/iris/zoom/slide-v/slide-d each
call it once or twice for `from`/`to` — and the glitch transition's two
calls). Both helpers gain a `cue` parameter, and every call site passes its
own cue explicitly:

- Steady state (line 5565): `drawClip(v.el, 1, 0, 0, 1, S.bgVid._cue)`
- Each transition branch (lines 5578-5607): the existing `from.el`/`to.el`
  calls become `drawClip(from.el, ..., from)` / `drawClip(to.el, ..., to)` —
  `from`/`to` are already the real cue objects (`S.bgVidTrans = { from: cue,
  to: next, ... }`, line 5462), so no lookup is needed, just pass them through.
- Glitch (lines 5606-5607): same treatment — `drawGlitchClip(from.el, 1 - p,
  envelope, from)` / `drawGlitchClip(to.el, p, envelope, to)`.

Inside both helpers, the effective values replace the current unconditional
reads of the global `v`:

```js
const effFilter = cue && cue.filter != null ? cue.filter : v.filter;
const effFit = cue && cue.fit != null ? cue.fit : (v.cover ? "cover" : "contain");
```

`effFit` replaces the existing `v.cover ? Math.max(...) : Math.min(...)` fit
calculation (`effFit === "cover" ? Math.max(...) : Math.min(...)`) in both
helpers. `effFilter` is passed to the unchanged `bgVidFilterCSS()` as
`bgVidFilterCSS({ filter: effFilter })` instead of the current
`bgVidFilterCSS(v)` — `bgVidFilterCSS()` itself needs no changes, it already
only reads `.filter` off whatever object it's given.

### 3. UI

`renderBgVidTLPanel()` (`elastic-morph.html:11010-11029`) builds the selected
clip's detail panel as one `innerHTML` template, same pattern as the existing
Übergang (transition) `<select>`. It gains two more rows, inserted after the
existing Übergang/Dauer row and before the Fade In/Out row:

```html
<label>Filter <select id="bgVidClipFilter">
  <option value="">— Global —</option>
  <option value="none">Kein Filter</option>
  <option value="cinematic">Cinematic</option>
  <option value="bw">Schwarzweiß</option>
  <option value="duotone">Duotone (DNA)</option>
  <option value="vintage">Vintage</option>
  <option value="dreamy">Dreamy</option>
  <option value="neon">Neon Glow</option>
</select></label>
<label>Fit <select id="bgVidClipFit">
  <option value="">— Global —</option>
  <option value="cover">Cover (Bild füllen)</option>
  <option value="contain">Contain (Bild einpassen)</option>
</select></label>
```

After setting the innerHTML, `renderBgVidTLPanel()` sets each select's current
value from the cue (`$("bgVidClipFilter").value = cue.filter || "";` —
`null`/`undefined` both fall through to `""`, matching the "— Global —"
option) and wires the change listeners the same way the existing
`bgVidClipTrans` select does:

```js
$("bgVidClipFilter").value = cue.filter || "";
$("bgVidClipFilter").addEventListener("change", e => cue.filter = e.target.value || null);
$("bgVidClipFit").value = cue.fit || "";
$("bgVidClipFit").addEventListener("change", e => cue.fit = e.target.value || null);
```

### 4. Testing

New `test.js` assertions:

- `addBgVidClipAt`'s cue object literal includes `filter: null` and `fit: null`.
- `renderBgVidTLPanel()`'s template includes both new `<select>` elements with
  the correct 8/3 options and correct `value=""` "— Global —" entries, and
  wires their `change` listeners to `cue.filter`/`cue.fit` with the
  `e.target.value || null` fallback.
- `updateBgVideoTimeline()` sets `S.bgVid._cue` in the active-cue branch and
  clears it in the no-cue branch.
- `drawClip`/`drawGlitchClip` compute `effFilter`/`effFit` from the passed
  `cue` with the documented fallback to `v.filter`/`v.cover`, and every one of
  the ~9 call sites in `drawBgVideoTimeline` passes a `cue` argument (steady
  state passes `S.bgVid._cue`; each transition branch passes `from`/`to`
  matching which clip element it draws).
- A cue with `filter: "none"` produces `"none"` (an explicit override) even
  when the global filter is something else — distinct from a cue with
  `filter: null`, which follows the global value.

## Open questions

None — Frank approved Approach A (override fields directly on the cue object,
explicit `cue` argument at every draw call site) and this design in full.
