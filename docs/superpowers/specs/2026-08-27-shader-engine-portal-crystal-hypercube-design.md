# Shader Engine — Portal Depth, Crystal Prism, Hypercube Drift — Design Spec

**Status:** Approved by Frank in sections.

## Problem

Second of three "Alpha Milestone" sub-projects (see project memory `project_morph_alpha_milestone.md`).
The first, Layer B (project memory `project_morph_layer_b_grid_progress_zoom.md`), shipped
2026-08-27. This one expands the Shader Engine (`S.shader`, `initGL()`, a single GLSL fragment
shader embedded in `elastic-morph.html`) — Frank's creative brief: "geometrische Kunstformen, wie
aus einer anderen Dimension — klar und bunt" (geometric, otherworldly, crisp and colorful),
refined during brainstorming to explicitly bring **depth and parallax** into the new styles. Two
existing styles (`gyroid`, `raymarch`) already partially cover this territory — confirmed with
Frank he knows them and still wants more, so this adds three styles that each hit a different
facet of "depth": literal parallax motion, raymarched 3D refraction, and pure geometric
otherworldliness.

**Confirmed scope:** three new GLSL fragment-shader styles — **Portal Depth**, **Crystal Prism**,
**Hypercube Drift** — following the exact `xxxStyle(vec2 uv) -> vec3` pattern all 12 existing
styles already use, dispatched via the same `uStyle` uniform / `SHADER_STYLE_ID` map / `<select
id="shStyle">` mechanism. Does not touch Layer B, DNA engines, Video Timeline, or HQ export.

## Locked decisions

- **Technically higher-risk than the Layer B round** — this is real GLSL (WebGL1 / GLSL ES 1.00),
  not Canvas 2D. A malformed new style doesn't just render wrong — a single GLSL syntax error can
  fail the ENTIRE shader program's compile/link step, breaking all 15 styles at once (`glCompile`,
  `elastic-morph.html:3688-3696`, already warns to console and returns `null` on a compile
  failure — `initGL()`'s caller handling of a `null` compiled shader needs to be traced during
  implementation, not assumed). Because of this, live verification in this round MUST include
  cycling through every one of the 12 EXISTING styles too, not just the 3 new ones — confirming
  the whole program still compiles and every prior style still renders correctly is the single
  most important check in this round.
- **No arrays anywhere in the new GLSL.** None of the 12 existing styles use a GLSL array (fixed
  small loops with scalar accumulation are the established pattern — e.g. `gyroidStyle`'s 40-step
  raymarch, `laserStyle`'s 5-beam loop). WebGL1/GLSL ES 1.00 array-constructor and
  dynamic-array-indexing support is inconsistent across older GPU drivers; since this codebase has
  zero existing precedent to lean on, Hypercube Drift's 8+8 cube vertices are computed via 16
  individually-named `vec2` locals instead of an array, and its 32 edges/struts are 32 explicit
  calls to a small helper — more source lines, but every line is a plain scalar/vector op with no
  exotic GLSL features, matching this shader's existing minimal-feature style exactly.
- **Every new style calls the shared `applyEyeCatcherFX(col, uv)` post-process** (self-bloom,
  chromatic-aberration-ish channel tilt, film grain) at the end — matching `gyroid`/`raymarch`/
  `feedback`/`tunnel` (4 of the 12 existing styles already do; the newer/more "dimensional" ones
  are the ones that use it, so this is the right precedent for these three).
- **Every new style respects the palette system** the same way all 12 existing styles do: `mix(uPalOn
  > 0.5 ? uPalA : <hardcoded-color>, uPalOn > 0.5 ? uPalB : <hardcoded-color>, mixT)` (or the
  `hsv2rgb(vec3(mixT, sat, val))` fallback form some styles use when there's no natural two-color
  mix) — so each looks good with no palette set AND correctly reflects the user's chosen palette.
- **Auto-VJ's shader-style randomizer is unaffected, on purpose.** It's currently hardcoded to
  `["fluid", "metaballs", "tunnel"]` (`elastic-morph.html:9744`), not generic over
  `SHADER_STYLE_ID` — none of the 9 already-shipped non-listed styles (including `gyroid`/
  `raymarch`) are in that pool either, so the 3 new styles not appearing there is consistent
  existing behavior, not a gap introduced by this round. `cycleShaderStyle` (the arrow-key
  cycler, `elastic-morph.html:11187-11198`) IS generic over `Object.keys(SHADER_STYLE_ID)`, so the
  3 new styles reach that consumer automatically with zero code changes there.

## The three new styles

### Portal Depth (`portal`) — layered parallax rings flying toward the viewer

Seven independently-phased glowing ring layers, each looping through a 0→1 "depth" cycle at a
slightly different speed — radius grows non-linearly (accelerating) as depth increases, giving a
genuine parallax "flying through a tunnel of rings" feel; each ring fades in near the center (just
born) and fades out again once it passes a threshold radius (flown past the viewer), so no ring
pops in/out abruptly. Angular "spokes" modulate each ring's brightness around its circumference for
a portal-like segmented look rather than a plain circle.

```glsl
vec3 portalStyle(vec2 uv){
  vec3 col = vec3(0.0);
  float rad = length(uv), ang = atan(uv.y, uv.x);
  for(int i=0;i<7;i++){
    float fi = float(i);
    float speed = 0.15 + fi*0.03 + uBass*0.1;
    float z = fract(uTime*speed + fi*0.143);
    float ringR = z*z*1.6 + 0.02;
    float ringW = 0.01 + z*0.03;
    float ring = smoothstep(ringW, 0.0, abs(rad - ringR));
    float fade = smoothstep(0.0, 0.15, z) * smoothstep(1.0, 0.7, z);   // reversed-edge smoothstep for the falloff half, matching the same technique already shipped in raymarchStyle (elastic-morph.html:3596-3598) and elsewhere in this shader
    float spokes = 0.6 + 0.4*sin(ang*6.0 + fi*2.1 + uTime*0.4 + uBeat*2.0);
    float glow = ring * fade * spokes * (0.6 + uBeat*0.8 + uLoud*0.5);
    float hue = uHue + fi*0.12 + z*0.25 + uHighs*0.08;
    vec3 layerCol = uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) : hsv2rgb(vec3(fract(hue), 0.75, 1.0));
    col += layerCol * glow;
  }
  col = applyEyeCatcherFX(col, uv);
  return col;
}
```

### Crystal Prism (`crystal`) — a rotating raymarched faceted crystal, refracting into color bands

Deliberately mirrors `gyroidStyle`'s exact proven raymarch structure (same 40-step fixed march,
same `exp(-t*k)` depth falloff, same two-tone `mix` + bright-core-`pow` color pattern) — only the
per-point distance function changes, from the gyroid lattice to a faceted convex shape (built from
`max()`-combined axis-aligned and diagonal plane distances, the cheapest way to get a genuinely
faceted "cut gem" look without a full branching SDF). Reusing gyroid's already-shipped, already-
working loop shape minimizes new-technique risk in this specifically higher-risk round.

```glsl
float crystalDist(vec3 p){
  float d = max(abs(p.x), max(abs(p.y), abs(p.z)));
  d = max(d, dot(abs(p), normalize(vec3(1.0,1.0,1.0))));
  d = max(d, dot(abs(p), normalize(vec3(1.0,-1.0,1.0))));
  return d;
}
vec3 crystalStyle(vec2 uv){
  vec3 crystA = vec3(0.9, 0.15, 0.95);
  vec3 crystB = vec3(0.1, 0.85, 0.9);
  vec3 ro = vec3(0.0, 0.0, -3.0);
  vec3 rd = normalize(vec3(uv, 1.6));
  float a = uTime*0.18 + uBass*0.25;
  mat2 R = mat2(cos(a),-sin(a),sin(a),cos(a));
  float scale = 1.1 + uMids*0.5;
  float glow = 0.0, t = 0.0, band = 0.0;
  for(int i=0;i<40;i++){
    vec3 p = ro + rd*t;
    p.xz = R*p.xz;
    float d = crystalDist(p*scale)/scale - 0.85;
    float shell = exp(-abs(d)*20.0);
    glow += shell * exp(-t*0.18) * (0.85 + uBeat*0.8);
    band += shell * (p.x*0.4 + p.y*0.3 + p.z*0.3);
    t += 0.15;
  }
  glow *= 0.09;
  float mixT = fract(uHue + band*0.05 + uHighs*0.1);
  float v = glow * (0.7 + uIntensity*0.6) * (0.7 + uLoud*0.6);
  vec3 col = mix(uPalOn > 0.5 ? uPalA : crystA, uPalOn > 0.5 ? uPalB : crystB, mixT) * v;
  col += mix(uPalOn > 0.5 ? uPalB : crystB, uPalOn > 0.5 ? uPalA : crystA, mixT) * (pow(glow, 3.0)*0.6);
  col = applyEyeCatcherFX(col, uv);
  return col;
}
```

### Hypercube Drift (`hypercube`) — a tesseract-like cube-in-a-cube wireframe

The classic "tesseract" shader-demo visual: an outer cube and a smaller inner cube (independently
rotating, at slightly different speeds — the inner one on a different axis mix — to suggest a 4th
rotational dimension without needing literal 4D math), connected by 8 struts between corresponding
vertices. Two small helpers (`projCube`: rotate + perspective-project one cube vertex to 2D;
`segGlow`: distance-based glow along a 2D line segment) keep the 32 edge/strut draws (12 outer + 12
inner + 8 struts) as simple one-line calls each — fully unrolled, no arrays, no loops, the most
GLSL-conservative option for this many line segments.

```glsl
float segGlow(vec2 uv, vec2 a, vec2 b){
  vec2 pa = uv - a, ba = b - a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return 0.008 / (length(pa - ba*h) + 0.006);
}
vec2 projCube(vec3 v, mat2 R, float persp){
  vec3 p = v; p.xz = R*p.xz;
  return p.xy * (persp/(persp + p.z));
}
vec3 hypercubeStyle(vec2 uv){
  float aOuter = uTime*0.22 + uBass*0.3;
  float aInner = uTime*-0.31 + uMids*0.4;
  mat2 Ro = mat2(cos(aOuter),-sin(aOuter),sin(aOuter),cos(aOuter));
  mat2 Ri = mat2(cos(aInner),-sin(aInner),sin(aInner),cos(aInner));
  float innerScale = 0.4 + 0.15*sin(uTime*0.5 + uBeat*2.0);
  float persp = 2.6;
  vec2 o0 = projCube(vec3(-1.0,-1.0,-1.0), Ro, persp), o1 = projCube(vec3(1.0,-1.0,-1.0), Ro, persp);
  vec2 o2 = projCube(vec3(1.0,1.0,-1.0), Ro, persp),  o3 = projCube(vec3(-1.0,1.0,-1.0), Ro, persp);
  vec2 o4 = projCube(vec3(-1.0,-1.0,1.0), Ro, persp), o5 = projCube(vec3(1.0,-1.0,1.0), Ro, persp);
  vec2 o6 = projCube(vec3(1.0,1.0,1.0), Ro, persp),   o7 = projCube(vec3(-1.0,1.0,1.0), Ro, persp);
  vec2 i0 = projCube(vec3(-1.0,-1.0,-1.0)*innerScale, Ri, persp), i1 = projCube(vec3(1.0,-1.0,-1.0)*innerScale, Ri, persp);
  vec2 i2 = projCube(vec3(1.0,1.0,-1.0)*innerScale, Ri, persp),  i3 = projCube(vec3(-1.0,1.0,-1.0)*innerScale, Ri, persp);
  vec2 i4 = projCube(vec3(-1.0,-1.0,1.0)*innerScale, Ri, persp), i5 = projCube(vec3(1.0,-1.0,1.0)*innerScale, Ri, persp);
  vec2 i6 = projCube(vec3(1.0,1.0,1.0)*innerScale, Ri, persp),   i7 = projCube(vec3(-1.0,1.0,1.0)*innerScale, Ri, persp);
  float glow = 0.0;
  glow += segGlow(uv,o0,o1)+segGlow(uv,o1,o2)+segGlow(uv,o2,o3)+segGlow(uv,o3,o0);
  glow += segGlow(uv,o4,o5)+segGlow(uv,o5,o6)+segGlow(uv,o6,o7)+segGlow(uv,o7,o4);
  glow += segGlow(uv,o0,o4)+segGlow(uv,o1,o5)+segGlow(uv,o2,o6)+segGlow(uv,o3,o7);
  glow += segGlow(uv,i0,i1)+segGlow(uv,i1,i2)+segGlow(uv,i2,i3)+segGlow(uv,i3,i0);
  glow += segGlow(uv,i4,i5)+segGlow(uv,i5,i6)+segGlow(uv,i6,i7)+segGlow(uv,i7,i4);
  glow += segGlow(uv,i0,i4)+segGlow(uv,i1,i5)+segGlow(uv,i2,i6)+segGlow(uv,i3,i7);
  glow += (segGlow(uv,o0,i0)+segGlow(uv,o1,i1)+segGlow(uv,o2,i2)+segGlow(uv,o3,i3)
         + segGlow(uv,o4,i4)+segGlow(uv,o5,i5)+segGlow(uv,o6,i6)+segGlow(uv,o7,i7)) * 0.7;
  glow *= (0.5 + uLoud*0.5 + uBeat*0.6);
  float mixT = fract(uHue + glow*0.03 + uHighs*0.1);
  vec3 col = (uPalOn > 0.5 ? mix(uPalA, uPalB, mixT) : hsv2rgb(vec3(mixT, 0.75, 1.0))) * glow;
  col = applyEyeCatcherFX(col, uv);
  return col;
}
```

## Wiring (all mechanical, mirrors the existing 12-style pattern exactly)

**`SHADER_STYLE_ID`** (`elastic-morph.html:3744`) gains 3 entries at the end:
```js
const SHADER_STYLE_ID = { fluid:0, metaballs:1, tunnel:2, aurora:3, electric:4, chrome:5, gyroid:6, raymarch:7, feedback:8, strobe:9, warehouse:10, laser:11, portal:12, crystal:13, hypercube:14 };
```

**`main()`'s dispatch chain** (`elastic-morph.html:3661-3685`) — the current final branch is a bare
`else` for `laser` (id 11); it becomes an explicit `else if(uStyle < 11.5)` so 3 more branches can
follow, ending in a new bare `else` for `hypercube`:
```glsl
  else if(uStyle < 10.5) col = warehouseStyle(uv*1.2);
  else if(uStyle < 11.5) col = laserStyle(uv*1.2);
  else if(uStyle < 12.5) col = portalStyle(uv);
  else if(uStyle < 13.5) col = crystalStyle(uv);
  else                   col = hypercubeStyle(uv);
```
(Only the `laser` line's trailing `else` becomes `else if(uStyle < 11.5)`; every line above it is
unchanged.)

**The 3 new style functions plus `crystalDist`/`segGlow`/`projCube`** are added directly above
`void main(){` (`elastic-morph.html:3661`), after the existing `laserStyle` function — same
placement convention every prior style addition (including the v33 round) has used.

**`<select id="shStyle">`** (`elastic-morph.html:1638-1651`) gains 3 new `<option>`s after the
existing `laser` one:
```html
      <option value="portal">Style: Portal Depth</option>
      <option value="crystal">Style: Crystal Prism</option>
      <option value="hypercube">Style: Hypercube Drift</option>
```

## What's explicitly deferred

- No changes to the Auto-VJ shader-style randomizer's hardcoded 3-style pool — confirmed this is
  pre-existing behavior affecting 9 other already-shipped styles equally, not a gap this round
  introduces (see locked decisions above).
- No new GLSL helper library (general-purpose SDF primitives, array support, etc.) — each new
  style's helpers (`crystalDist`, `segGlow`, `projCube`) stay local/minimal, matching this shader's
  existing "each style is mostly self-contained" convention.
- Shader-style preset assignment (which of the 3 new styles ships as any Visual DNA preset's
  default shader) is not addressed — out of scope, a separate concern from adding the styles
  themselves.

## Verification plan (to run once implemented)

- `npm run ci` green, with tests for: `SHADER_STYLE_ID` gaining the 3 new entries; the shader
  source string containing all 3 new function definitions and the 3 helper functions; the
  dispatch-chain change (structural — confirms `laser`'s bare `else` became an explicit
  `uStyle < 11.5` check and the 3 new branches follow in order); the 3 new `<option>` elements in
  `#shStyle`.
- **Live in-browser, and this is the critical check for this round:** enable the Shader Engine and
  cycle through ALL 15 styles (not just the 3 new ones) with real audio playing, confirming (a)
  the shader program still compiles at all — check `console.warn` output for a `"shader compile:"`
  message, which would mean the WHOLE program failed and every style is now broken; (b) each of
  the 12 pre-existing styles still renders exactly as before (a quick screenshot spot-check, not
  pixel-perfect diffing); (c) each of the 3 new styles renders visible, distinct, audio-reactive,
  non-black content matching its intended character (rings flying outward for Portal Depth, a
  faceted glowing rotating shape for Crystal Prism, a cube-in-cube wireframe for Hypercube Drift).
  Also confirm the arrow-key style-cycle (`cycleShaderStyle`) reaches all 3 new styles and confirm
  palette-on/off both look reasonable on each new style.
- Confirm `npm run ci` and `git diff --stat elastic-morph.html` stay clean per the standard
  build-pipeline-gotcha check.
