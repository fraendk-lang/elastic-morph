# Auto-VJ Pool Catch-Up: Design Spec

**Status:** Approved by Frank (scoped via 3 questions, all "empfohlen"/recommended options chosen)
**Date:** 2026-09-01

## Goal

`autoVjStep()` — the single function driving Auto-VJ's periodic randomization — has fallen behind
the app's actual feature surface over many rounds of new features shipping. Found during an
app-wide review Frank requested. Three gaps, all fixed in this round:

1. Its shader-style pool is hardcoded to 3 of the now-17 shipped styles (`fluid`, `metaballs`,
   `tunnel`) — 14 styles, including everything from Aurora through today's Warp Tunnel, are never
   selected.
2. It never touches Particle Mode at all (11 patterns, entirely outside Auto-VJ's scope).
3. It never touches Text Mode at all (including yesterday's Hypno Loop).

## Context

*Line numbers are as of this spec's writing (2026-09-01) — re-confirm with a fresh `grep -n`
immediately before editing.*

`autoVjStep()` (`elastic-morph.html:10246`+) already has an established shape worth following
exactly: each concern gets its own `if (R() < threshold) { ... }` block, mutating `S` fields
directly then syncing the corresponding UI control(s) by hand (no generic "sync everything"
helper exists). The closest existing precedent for "toggle on/off + pick a sub-option together" is
the Layer B block:

```js
if (R() < 0.4) {
  S.layerB.on = R() < 0.7;
  S.layerB.type = pickLayerBType(R);
  $("lbOn").checked = S.layerB.on; $("lbType").value = S.layerB.type;
  if (S.layerB.type === "starfield") initStars();
}
```

**Root cause of the shader-pool staleness, and the design principle that prevents a repeat**: the
pool was a hand-maintained literal array (`["fluid", "metaballs", "tunnel"]`) that nobody updated
across 5+ rounds of new Shader Engine styles. `SHADER_STYLE_ID` (`elastic-morph.html:3935`+) is
the actual live source of truth for which styles exist — and `cycleShaderStyle()` already derives
its own style list from `Object.keys(SHADER_STYLE_ID)` rather than a separate hardcoded list. This
spec applies the same fix here: **every pool this round adds derives from the live source of
truth at call time** (`Object.keys(SHADER_STYLE_ID)` for shader styles, `PM_PATTERNS.map(p =>
p[0])` for particle patterns, the actual `<select>` options for `#pmMirror` and `#textAnim`) —
never a second hardcoded literal list that can go stale again the next time a style/pattern/anim
is added.

**Scoping decisions from brainstorming, with reasoning**:
- **All 17 shader styles**, including the 7 `HEAVY_SHADER`-classified ones. `HEAVY_SHADER` itself
  is only consulted by the HQ-export confirmation dialog (`isHeavyExportPreset()`,
  `src/inject-v64.js`) — it has no live-performance role. Live playback already has its own
  independent, style-agnostic adaptive quality system (`S.perfScale`, auto-adjusts every frame
  based on measured fps, `elastic-morph.html:10019-10020`) that applies identically regardless of
  which style is active. A heavy style Auto-VJ picks gets exactly the same automatic protection a
  heavy style the user deliberately picks already gets today — no new risk.
- **Particle Mode joins the pool**, on/off + pattern + mirror + constellation randomized together
  in one step, mirroring the Layer B block's shape exactly.
- **Text Mode's *animation style* joins the pool** (including `hypno`), gated on `S.textShow` (a
  no-op when text display is off) — but the text *content* (`S.textTitle`/`S.textArtist`) is never
  touched. This is a content-vs-decoration distinction: every existing Auto-VJ block already only
  changes how things look, never what information is shown; cycling which animation style renders
  the title is the same kind of decoration-only change as cycling which shader renders the
  background, not a content change. The 5 Text Ending trigger-only strings
  (`shatter`/`vortexsuck`/`dissolve`/`iris`/`glitchout`) are excluded automatically — they're
  already deliberately absent from the `#textAnim` `<select>` (confirmed by test coverage from
  the round that shipped them), which is exactly the list this pool derives from.

## Exact Code

### A) Shader style pool — self-maintaining derivation (`elastic-morph.html`, inside the existing
shader block)

Find:
```js
    const styles = ["fluid", "metaballs", "tunnel"];
```
Replace:
```js
    const styles = Object.keys(SHADER_STYLE_ID);   // v136: derives from the live style set — never goes stale again
```

### B) Particle Mode block — new, inserted right after the Layer B block

Find:
```js
  if (R() < 0.4) {
    S.layerB.on = R() < 0.7;
    S.layerB.type = pickLayerBType(R);
    $("lbOn").checked = S.layerB.on; $("lbType").value = S.layerB.type;
    if (S.layerB.type === "starfield") initStars();
  }
  // FX: curate a FRESH small selection each step.
```
Replace:
```js
  if (R() < 0.4) {
    S.layerB.on = R() < 0.7;
    S.layerB.type = pickLayerBType(R);
    $("lbOn").checked = S.layerB.on; $("lbType").value = S.layerB.type;
    if (S.layerB.type === "starfield") initStars();
  }
  // v136: sometimes randomize Particle Mode — on/off + pattern + mirror + constellation
  // together, same "toggle + retype in one step" shape as the Layer B block above. Both the
  // pattern and mirror pools are read from their live source of truth (PM_PATTERNS / the
  // #pmMirror <select>'s own options) so this can't go stale the way the shader pool did.
  if (R() < 0.4) {
    S.pmode.on = R() < 0.7;
    const patterns = PM_PATTERNS.map(p => p[0]);
    S.pmode.pattern = patterns[Math.floor(R() * patterns.length)];
    const mirrorOpts = [...document.querySelectorAll("#pmMirror option")].map(o => o.value);
    S.pmode.mirror = mirrorOpts[Math.floor(R() * mirrorOpts.length)];
    S.pmode.constellation = R() < 0.35;
    $("pmOn").checked = S.pmode.on; $("pmPattern").value = S.pmode.pattern;
    $("pmMirror").value = S.pmode.mirror; $("pmConstellation").checked = S.pmode.constellation;
    if (S.pmode.on) initPM();
  }
  // FX: curate a FRESH small selection each step.
```

### C) Text Mode animation block — new, appended at the end of the function

Find:
```js
    $("shOn").checked = S.shader.on; $("shStyle").value = S.shader.style;
    if (S.shader.on) initGL();
  }
}
```
Replace:
```js
    $("shOn").checked = S.shader.on; $("shStyle").value = S.shader.style;
    if (S.shader.on) initGL();
  }
  // v136: sometimes reroll the text ANIMATION style only — never touches textTitle/textArtist.
  // Gated on S.textShow (no-op when text display is off). Derived from the live #textAnim
  // <select> options, so it automatically includes hypno and any future addition, and can never
  // include the 5 F1-F5 Text Ending trigger-only strings — those are deliberately never options
  // in that select to begin with.
  if (S.textShow && R() < 0.4) {
    const anims = [...document.querySelectorAll("#textAnim option")].map(o => o.value);
    S.textAnim = anims[Math.floor(R() * anims.length)];
    $("textAnim").value = S.textAnim;
    restartType();
  }
}
```

## Non-Goals

- **Text content is never touched** — `S.textTitle`/`S.textArtist`/`S.textLabel`/`S.textShow`
  itself stay entirely under manual control; only which animation style renders existing text is
  randomized.
- **No new FX-rack-style "safe" curation for shader/particle/text pools** — unlike the FX racks
  (which exclude specific effects known to combine badly), no shader style, particle pattern, or
  text animation is excluded here; Frank explicitly chose "all 17" for shaders, and the same
  everything-included reasoning applies to particle patterns and text anims (none of them carry
  the FX racks' known "additive pile-up" risk).
- **No change to `autoVjStep`'s call frequency, `S.autoVJ.intensity` handling, or any existing
  block** (DNA blend, slider nudges, Layer B, FX racks) — purely additive.

## Testing

Following this session's established `test.js` pattern (structural `extractFn`/`.includes()`
checks against the assembled `script`):

- The shader-style pool line reads `Object.keys(SHADER_STYLE_ID)`, not a hardcoded array — and
  the old 3-item literal (`["fluid", "metaballs", "tunnel"]`) is gone from `autoVjStep`'s body.
- `autoVjStep` contains a Particle Mode block that sets `S.pmode.on`, derives `patterns` from
  `PM_PATTERNS.map(p => p[0])` (not a separate hardcoded pattern list), derives `mirrorOpts` from
  `#pmMirror option` (not a separate hardcoded mirror list), sets `S.pmode.constellation`, and
  calls `initPM()` when turning on.
- `autoVjStep` contains a Text Mode block gated on `S.textShow`, deriving its pool from
  `#textAnim option` (not a hardcoded anim list), and calling `restartType()` — and does **not**
  reference `S.textTitle`, `S.textArtist`, or `S.textLabel` anywhere in that block.
- A genuine behavioral check (via `loadFns` + a mock `S`/DOM, following this session's precedent
  for logic worth actually exercising, not just structurally matching): stub `Math.random` to
  return values that force the Particle Mode block's "on" branch, and assert the resulting
  `S.pmode.pattern` is a member of the real `PM_PATTERNS` id list — proving the derivation
  produces a valid, existing pattern id, not just structurally-present-looking code.

## Live Verification

Run `autoVjStep()` directly many times (bypassing the wait timer) and tally which shader styles,
particle patterns, and text anims actually get selected — confirm all 17/11/(however many
`#textAnim` options exist) appear at least once over enough iterations, confirm `S.textTitle`
never changes, confirm no console errors from any newly-reachable combination (e.g. Particle Mode
on with the `warpTunnel` shader simultaneously).
