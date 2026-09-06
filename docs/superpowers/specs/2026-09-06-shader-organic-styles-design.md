# Shader Engine — Bioluminescence + Lava Lamp Styles — Design

## Problem

The Shader Engine has 17 styles, but the organic/fluid family (Fluid, Metaballs,
Aurora, Chrome — 4 styles) is thin compared to the geometric/sharp family
(Tunnel, Electric, Gyroid, Raymarch, Feedback, Strobe, Warehouse, Laser,
Portal, Crystal, Hypercube, Cosmic Drift, Warp Tunnel — 13 styles). Frank
specifically likes the Metaballs style and wants more in that vein.

## Goals

- Add two new organic Shader Engine styles built on the same metaball-field
  technique as the existing `metaStyle`, but each with a distinct motion
  signature and rendering character so they don't feel like re-skins of
  each other or of Metaballs itself:
  - **Bioluminescence**: soft, additively-glowing orbs drifting independently
    with a gentle flicker, evoking deep-sea bioluminescent plankton. Fills a
    real gap — every existing organic style is either fast/energetic
    (Fluid, Metaballs) or sky-based (Aurora); none is a calm, ambient,
    blob-based style.
  - **Lava Lamp**: the existing hard metaball field-merge (blobs visibly
    fusing at the edges), but with blobs rising and falling through a
    buoyant vertical cycle instead of orbiting — a distinct motion language
    from anything currently in the Shader Engine.
- Both follow the codebase's existing color convention: base color always
  comes from `uHue`/the active palette, with only small per-style offsets
  (matching every other style's `uHue + smallOffset` pattern) — never a
  hard-coded "warm" or "cool" palette override. The user's Color Bias/DNA
  hue/palette controls must work identically to how they work for every
  other style.

## Non-Goals

- **Cell Membrane/Amoeba style** (a third concept discussed and set aside)
  — a good candidate for a future round, not built now.
- **HQ export cost tier changes** — both styles use a 6-8 iteration loop
  with simple inverse-square/smoothstep math, no raymarching and no
  unrolled per-segment glow evaluation (the two cost drivers behind the
  app's `HEAVY_SHADER` set) — comparable to `metaStyle`'s existing
  7-iteration loop, which itself isn't in `HEAVY_SHADER`. Neither new style
  is added to `HEAVY_SHADER`.

## Design

### 1. `bioluminescenceStyle(vec2 uv)`

```glsl
vec3 bioluminescenceStyle(vec2 uv){
  float t = uTime*0.16;
  vec3 col = vec3(0.0);
  for(int i=0;i<8;i++){
    float fi = float(i);
    float ph = hash(vec2(fi, 2.0))*6.2831853;
    float sp = 0.20 + hash(vec2(fi, 5.0))*0.18;
    vec2 c = vec2(sin(t*sp + ph)*0.9, cos(t*sp*0.75 + ph)*0.65 + sin(t*0.09 + fi)*0.25);
    float d = length(uv - c);
    float flash = 0.5 + 0.5*sin(uTime*(0.6+hash(vec2(fi,7.0))*0.8) + fi*3.0);
    float glow = (0.010 + uBass*0.010) * (0.5 + flash*0.8 + uBeat*0.6);
    float hue = uHue + fi*0.02 + uHighs*0.08;
    vec3 orbCol = uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) : hsv2rgb(vec3(fract(hue), 0.55, 1.0));
    col += (0.35 + uLoud*0.5) * glow / (d*d + 0.0008) * orbCol;
  }
  col = 1.0 - exp(-col*1.3);
  return col;
}
```

Each of 8 orbs gets a per-orb random phase/speed (`hash(vec2(fi, seed))`, the
same named `hash()` function `fluidStyle`/`metaStyle`'s neighborhood already
defines) driving an independent Lissajous-like drift path — no two orbs move
identically. Brightness comes from an inverse-square falloff (soft, no hard
edge) summed additively across orbs, modulated by a per-orb sine "flash"
(bioluminescent flicker) plus `uBass`/`uBeat`. The final
`1.0 - exp(-col*1.3)` soft-exposure tonemap is what gives this style its
glowing, non-clipping look — the key visual difference from `metaStyle`'s
hard `smoothstep`-edged merge.

### 2. `lavaLampStyle(vec2 uv)`

```glsl
vec3 lavaLampStyle(vec2 uv){
  float t = uTime*0.12;
  float m = 0.0;
  for(int i=0;i<6;i++){
    float fi = float(i);
    float ph = hash(vec2(fi, 3.0))*6.2831853;
    float xw = 0.5 + hash(vec2(fi, 9.0))*0.5;
    float rise = fract(t*(0.15+hash(vec2(fi,4.0))*0.10) + fi/6.0);
    vec2 c = vec2(sin(t*xw + ph)*0.55, mix(-1.3, 1.3, rise));
    float rad = 0.16 + 0.05*sin(t*2.0+fi) + uBass*0.08 + uBeat*0.05;
    float d = length(uv - c);
    m += rad*rad/(d*d + 0.0012);
  }
  float edge = smoothstep(0.75, 1.9, m);
  float hue = uHue + 0.02 + m*0.015 + uHighs*0.05;
  vec3 col = uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * (edge*(0.85+uLoud*0.6+uBeat*0.4)) : hsv2rgb(vec3(fract(hue), 0.9, edge*(0.85+uLoud*0.6+uBeat*0.4)));
  col += uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue+0.08)) * smoothstep(1.6,2.8,m) : hsv2rgb(vec3(fract(hue+0.08), 0.6, smoothstep(1.6,2.8,m)));
  return col;
}
```

Reuses `metaStyle`'s exact field-summation-then-`smoothstep` technique (so
blobs visibly fuse/separate at close range, the signature "lava lamp" look),
but each of 6 blobs follows a `rise` cycle (`fract(t*speed + offset)`)
mapped via `mix(-1.3, 1.3, rise)` to a vertical position — a buoyant
rise-fall motion — plus a slow per-blob horizontal sine sway
(`sin(t*xw + ph)`), instead of `metaStyle`'s circular orbit paths. `uBass`
and `uBeat` grow blob radius (a "heating up" pulse), matching the pattern
`metaStyle` already uses for its own radius modulation.

### 3. Integration points (4 files/locations, all in `elastic-morph.html`, none build-injected)

- **Dropdown** (`elastic-morph.html:1669`, right after the `warpTunnel`
  `<option>`, before `</select>`):
  ```html
  <option value="bioluminescence">Style: Bioluminescence</option>
  <option value="lavaLamp">Style: Lava Lamp</option>
  ```
- **Function definitions** (`elastic-morph.html:4081`, right after
  `warpTunnelStyle`'s closing `}`): both functions above, in that order.
- **`SHADER_STYLE_ID`** (`elastic-morph.html:4176`): append
  `, bioluminescence:17, lavaLamp:18` before the closing `}`.
- **Dispatch chain in `main()`** (`elastic-morph.html:4106`, the final
  `else col = warpTunnelStyle(uv);` line): becomes
  `else if(uStyle < 17.5) col = warpTunnelStyle(uv); else if(uStyle < 18.5) col = bioluminescenceStyle(uv); else col = lavaLampStyle(uv);`

### 4. Testing

Same static-source-assertion style as the rest of `test.js`:
- Both GLSL functions exist with their documented structure (loop count,
  `hash(...)` calls, the tonemap line for Bioluminescence, the
  `smoothstep`-based field merge for Lava Lamp).
- `SHADER_STYLE_ID` includes both new entries with the correct IDs (17, 18).
- The dispatch chain in `main()` routes `uStyle` 17→Bioluminescence,
  18→Lava Lamp, and the dropdown has both new `<option>`s.
- `HEAVY_SHADER` does NOT include either new style name (regression guard:
  this project has twice previously shipped a new heavy style without
  registering it, so a test asserting a name's *absence* from the set is
  only meaningful paired with a manual perf check — see below — not a
  substitute for one).

### 5. Manual live-check (after implementation)

1. Enable the Shader Engine, select Bioluminescence — confirm soft glowing
   orbs drift independently with a flicker, no hard blob-merge edges, and
   color follows the current DNA hue/palette like other styles.
2. Select Lava Lamp — confirm blobs visibly fuse/separate as they pass near
   each other, moving in a vertical rise-fall cycle rather than orbiting.
3. Compare frame rate against `metaStyle`/Metaballs at the same resolution
   (rough visual/DevTools FPS check) — confirm neither new style is
   noticeably heavier; if either is, add it to `HEAVY_SHADER` with a
   comment explaining why (matching the existing set's documented
   reasoning per entry).
4. Confirm both respond to bass/beat/loudness (radius/glow pulsing) and to
   Color Bias/Speed/Scale (the existing global Shader Engine controls)
   like every other style.

## Open questions

None — Frank confirmed both concepts and the technical approach (metaball
technique, `uHue`-based color, no `HEAVY_SHADER` registration pending the
live perf check).
