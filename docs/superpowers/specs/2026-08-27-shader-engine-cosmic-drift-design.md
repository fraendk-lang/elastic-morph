# Shader Engine — Cosmic Drift — Design Spec

**Status:** Approved by Frank in sections.

## Problem

Frank shared a reference video (TAS Visuals, "Immersive Visuals (Full Dome Preview)," a fulldome
VJ reel) and asked whether Elastic Morph could produce something similar. Watching it together,
the visual language breaks into pieces largely already present in the app (kaleidoscope mirroring
on Layer B, particle networks via Layer B's `constellation` type, raymarched glow via Shader
Engine's `gyroid`/`crystal` styles) — this is a new, separate initiative, not a 4th Alpha-Milestone
sub-project. Frank confirmed one focused element to build first: the reel's **glowing volumetric
nebula/spiral shapes drifting in a starfield** — the piece with no existing analog in the app.
The other elements from the video (a beaded/tendril "creature" shape, further kaleidoscope tuning)
are explicitly deferred to a possible future round.

**Confirmed scope:** one new Shader Engine GLSL style, **Cosmic Drift** (`cosmicDrift`), following the
exact `xxxStyle(vec2 uv) -> vec3` pattern every existing style uses, wired via the same `uStyle`
uniform / `SHADER_STYLE_ID` map / `<select id="shStyle">` mechanism as every prior style addition
this session. Canvas/DOM/wiring touch points only — no Layer B or DNA changes.

## Locked decisions

- **Reuses `gyroidStyle`'s proven 40-step fixed-march raymarch loop structure** (same iteration
  count, same `exp(-t*k)` depth falloff pattern) — the same low-risk strategy `crystalStyle`
  already used successfully today: only the per-point field function changes.
- **Volumetric density accumulation, not a hard-surface distance field.** Unlike `gyroid`/`crystal`
  (thin-shell glow around a surface), a nebula is a soft, fluffy cloud — so each raymarch step
  accumulates a density value directly (weighted by depth falloff) rather than converting distance
  to a thin-shell glow via `exp(-d*k)`. This is a deliberate technique difference from the prior
  two raymarch styles, not an oversight.
- **Density comes from a cheap 4-octave sine-turbulence field**, not a hash-based noise function.
  This codebase's only existing noise primitives are `hash(vec2)` and `fbm(vec2)` — both 2D. Rather
  than build a new 3D hash-noise helper (more surface area, more risk in an already
  higher-technical-risk subsystem), `cosmicDriftDensity(vec3 p)` sums `abs(sin(...))` at 4 octaves with
  a fixed 2D rotation between octaves (to decorrelate axes and avoid a grid-aligned look) — a
  well-established cheap volumetric-noise technique, and it mirrors `gyroidStyle`'s own spirit of
  a compact closed-form field function (`gyroid(p) = dot(sin(p), cos(p.yzx))`) rather than a
  lookup-based one.
- **The spiral itself is a domain-warp**, not a separate visual layer: each raymarch sample point
  is rotated by an angle that grows with its distance from the view axis and its depth
  (`ang = length(p.xy)*0.9 + p.z*0.15 + uTime*spiralSpeed`) before the density field is sampled.
  Rotating the *sample point*, not the whole shape, is what makes the noise itself swirl into
  spiral arms — the standard technique for shader-based spiral nebulae.
- **A cheap 2D starfield, independent of the raymarch.** Small, sparse bright points sampled
  directly from screen-space UV via the existing `hash(vec2)` — no 3D star placement, no extra
  raymarch cost. Composited additively on top of the nebula glow.
- **The beaded/tendril "creature" shape and any further kaleidoscope tuning are explicitly
  deferred** — confirmed with Frank as future-round material, not this one.

## `cosmicDriftStyle` (`cosmicDrift`)

```glsl
float cosmicDriftDensity(vec3 p){
  float d = 0.0, amp = 0.5, freq = 1.0;
  mat2 R = mat2(0.8,-0.6,0.6,0.8);
  for(int i=0;i<4;i++){
    d += amp * abs(sin(p.x*freq) + sin(p.y*freq*1.3) + sin(p.z*freq*0.7));
    p.xy = R*p.xy; p.z += 1.7;
    freq *= 1.9; amp *= 0.55;
  }
  return d;
}
vec3 cosmicDriftStyle(vec2 uv){
  vec3 nebA = vec3(0.15, 0.05, 0.6);
  vec3 nebB = vec3(0.9, 0.3, 0.85);
  float starN = hash(floor(uv*380.0));
  float star = smoothstep(0.988, 1.0, starN) * (0.5 + 0.5*sin(uTime*3.0 + starN*40.0));
  vec3 ro = vec3(0.0, 0.0, -3.2);
  vec3 rd = normalize(vec3(uv, 1.5));
  float spiralSpeed = 0.12 + uBass*0.15;
  float glow = 0.0, t = 0.0;
  for(int i=0;i<40;i++){
    vec3 p = ro + rd*t;
    float ang = length(p.xy)*0.9 + p.z*0.15 + uTime*spiralSpeed;
    mat2 Rs = mat2(cos(ang),-sin(ang),sin(ang),cos(ang));
    p.xy = Rs*p.xy;
    float dens = cosmicDriftDensity(p*(1.0 + uMids*0.3));
    glow += dens * exp(-t*0.15) * (0.7 + uBeat*0.7);
    t += 0.14;
  }
  glow *= 0.02;
  float mixT = fract(uHue + glow*0.08 + uHighs*0.12 + uTime*0.02);
  float v = glow * (0.7 + uIntensity*0.6) * (0.7 + uLoud*0.6);
  vec3 col = mix(uPalOn > 0.5 ? uPalA : nebA, uPalOn > 0.5 ? uPalB : nebB, mixT) * v;
  col += vec3(1.0) * star * (0.6 + uLoud*0.4);
  col = applyEyeCatcherFX(col, uv);
  return col;
}
```

Notes for implementation: `hash(vec2)` is an existing top-level GLSL function (`elastic-morph.html`,
search `float hash(vec2 p)`), already in scope everywhere in this shader — no new helper needed for
the starfield. `smoothstep(0.988, 1.0, starN)` uses `edge0 < edge1` (the safe ordering — see the
Portal/Crystal/Hypercube spec's own note on this same GLSL ES 1.00 caveat). The exposure constant
`glow *= 0.02` is a best estimate, not empirically tuned (this codebase's test suite cannot compile
or render GLSL — no WebGL in Node — so brightness/exposure can only be confirmed by the live
verification step below); if live verification shows the result badly over- or under-exposed,
adjusting that one multiplier is the expected, in-scope fix.

## Wiring (mirrors the Portal/Crystal/Hypercube pattern exactly)

**`SHADER_STYLE_ID`** gains one entry at the end:
```js
const SHADER_STYLE_ID = { fluid:0, metaballs:1, tunnel:2, aurora:3, electric:4, chrome:5, gyroid:6, raymarch:7, feedback:8, strobe:9, warehouse:10, laser:11, portal:12, crystal:13, hypercube:14, cosmicDrift:15 };
```

**`main()`'s dispatch chain** — the current final branch is a bare `else` for `hypercube` (id 14);
it becomes an explicit `else if(uStyle < 14.5)` so one more branch can follow, ending in a new bare
`else` for `cosmicDrift`:
```glsl
  else if(uStyle < 13.5) col = crystalStyle(uv);
  else if(uStyle < 14.5) col = hypercubeStyle(uv);
  else                   col = cosmicDriftStyle(uv);
```
(Only the `hypercube` line's trailing `else` becomes `else if(uStyle < 14.5)`; every line above it
is unchanged.)

**`cosmicDriftDensity`/`cosmicDriftStyle`** are added directly above `void main(){`, after the existing
`hypercubeStyle` function — same placement convention every prior style addition has used.

**`<select id="shStyle">`** gains one new `<option>` after the existing `hypercube` one:
```html
      <option value="cosmicDrift">Style: Cosmic Drift</option>
```

## What's explicitly deferred

- The beaded/tendril "creature" shape from the reference video — a plausible future round, not
  scoped here.
- Further kaleidoscope/mirror-system tuning — the existing Layer B mirror system already applies
  to every Layer B type; no changes proposed here.
- No new uniforms — every tunable constant (spiral rate, octave count/falloff, exposure) is a
  literal in the GLSL, matching every existing style's convention. If Frank wants live-tunable
  controls for this style specifically later, that's a separate, future ask.

## Verification plan (to run once implemented)

- `npm run ci` green, with tests for: `SHADER_STYLE_ID` gaining the `cosmicDrift:15` entry; the shader
  source containing `cosmicDriftDensity`/`cosmicDriftStyle`; the dispatch chain's structural change
  (`hypercube`'s bare `else` becoming an explicit `uStyle < 14.5` branch, followed by the new
  `cosmicDrift` branch); the new `<option>` in `#shStyle`; the pre-existing `"GLSL braces & parens
  balanced"` test still passing (a first lexical sanity check, not a substitute for the live
  compile check below).
- **Live in-browser, same headline check as every prior Shader Engine round:** confirm `GL.ok ===
  true` after enabling the style (the whole 16-style program must still compile — a bad character
  anywhere breaks all of them, not just the new one), spot-check a few pre-existing styles still
  render correctly, then confirm Cosmic Drift itself renders visible, non-black, audio-reactive
  content matching its intent (swirling cloud-like glow with a starfield backdrop, brightness/
  swirl responding to bass/beat). Adjust the `glow *= 0.02` exposure constant if the live result is
  clearly too dim or blown out.
- Confirm `npm run ci` and `git diff --stat elastic-morph.html` stay clean per the standard
  build-pipeline-gotcha check.
