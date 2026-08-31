# Shader Engine — Warp Tunnel: Design Spec

**Status:** Approved by Frank ("okay")
**Date:** 2026-09-01

## Goal

Frank shared two reference videos (both @VidaVFX YouTube Shorts) as visual targets, settling on
the second: a tunnel of many thin light streaks rushing outward from a vanishing point toward the
camera — a "warp speed" / hyperspace-jump look, purple/blue/orange toned, with occasional
crystalline geometric glints among the streaks. New Shader Engine style, approach C (agreed):
cheap 2D streak technique as the main element, plus a few borrowed-cheap crystal-style glints for
texture — not a full 3D raymarch (that was the explicitly declined, more expensive Approach B).

## Context

*Line numbers are as of this spec's writing (2026-09-01) — re-confirm with a fresh `grep -n`
immediately before editing, this file drifts constantly.*

The Shader Engine has 16 GLSL styles today (`SHADER_STYLE_ID`, `elastic-morph.html:3935`),
dispatched in `main()`'s `if/else if` chain (`elastic-morph.html:3869`, currently ending with
`else col = cosmicDriftStyle(uv);` as the bare-else fallback for the highest style id). Adding a
17th style means: converting that bare `else` into an explicit `else if(uStyle < 15.5)`, and
adding a new bare `else` for the new style — the exact pattern the Portal/Crystal/Hypercube round
and the Cosmic Drift round both already established.

**Reusable primitive found**: `segGlow(uv, a, b)` (`elastic-morph.html:3771-3775`) is a cheap 2D
line-segment glow function, already used by `hypercubeStyle` for its wireframe cube edges. It is
exactly the primitive this style's streak lines need — no new GLSL helper required.

**`applyEyeCatcherFX(col, uv)`** (`elastic-morph.html:3500`) adds self-bloom, a subtle per-channel
chromatic-aberration tint, and grain — already used by `portalStyle`/`crystalStyle`/
`hypercubeStyle`/`cosmicDriftStyle`. Including it here is a bonus: it organically reintroduces a
touch of the *first* (declined) reference video's RGB-split/glitch quality for free, without any
extra design work.

**Cost classification, and a documented repeated mistake to explicitly not repeat a third time**:
`HEAVY_SHADER` (a `Set` of style names gating the HQ-export "this may take a while" warning) lives
**post-`@BUILD-INJECT-V58`-marker**, generated from `src/inject-v64.js:6` — editing the
`elastic-morph.html` mirror (currently line 11930) by hand would be silently overwritten on the
next `node build.js`. Both the Portal/Crystal/Hypercube round and the Cosmic Drift round
originally **missed adding their new style to this set** and had to be fixed in final review
(Cosmic Drift's fix commit note: "same defect class as the crystal/hypercube round earlier the
same day") — a real, twice-repeated gap. This spec explicitly calls out including it from the
start, not deferring it to review.

Separately, a *different*, narrower cost gate — a lower resolution cap (820 vs. 1000px) applied to
`gyroid`/`crystal`/`cosmicDrift` specifically (`elastic-morph.html:3951`) — is **not** a strict
subset of `HEAVY_SHADER`: `hypercube`, `raymarch`, and `feedback` are all `HEAVY_SHADER` but do
*not* get the lower cap. The dividing line in practice is whether the style does an actual 3D
raymarch loop (`gyroid`/`crystal`/`cosmicDrift` all share the identical "40-step `ro + rd*t`
march" shape) versus a cheaper 2D technique (`hypercube` is pure `segGlow` wireframe, no march).
Warp Tunnel does not raymarch (see Design below) — it follows `hypercube`'s precedent: goes in
`HEAVY_SHADER`, does **not** get the 820 cap.

## Design

**New style function, `warpTunnelStyle(vec2 uv)`, inserted right after `cosmicDriftStyle`'s
closing brace** (`elastic-morph.html:3845`, immediately before `void main(){`):

1. **~48 streak lines**, each a `segGlow` call between two points on a fixed per-line radial
   direction (stable per-index pseudo-random angle via a `sin`/`fract` hash, no GLSL array
   needed — matching the existing "no GLSL array syntax" convention this codebase's tests already
   enforce for WebGL1/GLSL ES 1.00 safety). Each line has its own looping "phase" 0→1 (`fract` of
   time, staggered per line so they don't all pulse in lockstep): near-zero phase places a short
   segment close to the center; as phase grows the segment's near/far points both move outward
   and the segment lengthens slightly (the "comet trail" read), fading in near phase 0 and fading
   out again near phase 1 before the cycle repeats. Speed on `uBass`/`uBeat`, per-line hue offset
   plus `uHighs`, overall brightness on `uLoud`/`uBeat` — matching this codebase's established
   "continuous base motion + percussive kick" shape used throughout the Shader Engine and FX
   racks.
2. **3 rotating triangle-wireframe glints**, reusing the same `segGlow` primitive for their 3
   edges each (9 calls total) instead of a raymarch — a cheap nod to the reference's crystalline
   accents without the cost of a second 40-step march stacked on top of the streak loop. Slow
   shared rotation, size lightly modulated by `uMids`, brightness kicks on `uBeat`.
3. `applyEyeCatcherFX(col, uv)` before returning, matching every other recent style.

**Total per-pixel cost**: ~48 + 9 = 57 `segGlow` evaluations, each O(1) — same cost *class* as
`hypercubeStyle`'s ~32 (`HEAVY_SHADER`-worthy, confirmed classification decision above), but no
raymarch loop, so meaningfully cheaper than Approach B would have been and than
`gyroid`/`crystal`/`cosmicDrift` actually are today.

## Exact Code

### A) New GLSL style function (`elastic-morph.html:3845`, right after `cosmicDriftStyle`'s `}`)

Find:
```glsl
  col = applyEyeCatcherFX(col, uv);
  return col;
}

void main(){
```
*(this exact 4-line sequence is unique — it's `cosmicDriftStyle`'s ending immediately followed by
`main()`'s opening; verify uniqueness with a fresh grep before editing, since `applyEyeCatcherFX`+
`return col;`+`}` also ends several other styles, but only `cosmicDriftStyle` is immediately
followed by `void main(){`)*

Replace:
```glsl
  col = applyEyeCatcherFX(col, uv);
  return col;
}
vec3 warpTunnelStyle(vec2 uv){
  vec3 col = vec3(0.0);
  float speed = 0.35 + uBass*0.5 + uBeat*0.3;
  for(int i=0;i<48;i++){
    float fi = float(i);
    float rnd = fract(sin(fi*12.9898)*43758.5453);
    float ang = (fi/48.0)*6.2831853 + rnd*0.15 + uTime*0.03;
    vec2 dir = vec2(cos(ang), sin(ang));
    float phase = fract(uTime*speed*(0.6+rnd*0.8) + rnd);
    float rNear = phase*phase*1.3;
    float rFar  = rNear + 0.05 + phase*0.25;
    float glow = segGlow(uv, dir*rNear, dir*rFar);
    float fade = smoothstep(0.0,0.08,phase) * smoothstep(1.0,0.75,phase);
    float hue = uHue + rnd*0.15 + uHighs*0.1;
    vec3 lineCol = uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) : hsv2rgb(vec3(fract(hue), 0.8, 1.0));
    col += lineCol * glow * fade * (0.6 + uLoud*0.7 + uBeat*0.5);
  }
  float shardA = uTime*0.25;
  mat2 Rs = mat2(cos(shardA),-sin(shardA),sin(shardA),cos(shardA));
  for(int s=0;s<3;s++){
    float fs = float(s);
    float sc = 0.35 + fs*0.18 + uMids*0.1;
    vec2 p0 = Rs*vec2(0.0, sc);
    vec2 p1 = Rs*vec2(sc*0.87, -sc*0.5);
    vec2 p2 = Rs*vec2(-sc*0.87, -sc*0.5);
    float sglow = segGlow(uv,p0,p1)+segGlow(uv,p1,p2)+segGlow(uv,p2,p0);
    col += vec3(0.7,0.85,1.0) * sglow * 0.12 * (0.5+uBeat*0.8);
  }
  col = applyEyeCatcherFX(col, uv);
  return col;
}

void main(){
```

### B) Dispatch chain — bare `else` becomes explicit, new bare `else` added (`elastic-morph.html:3869`)

Find:
```glsl
  else                   col = cosmicDriftStyle(uv);
```
Replace:
```glsl
  else if(uStyle < 15.5) col = cosmicDriftStyle(uv);
  else                   col = warpTunnelStyle(uv);
```

### C) `SHADER_STYLE_ID` (`elastic-morph.html:3935`)

Find:
```js
const SHADER_STYLE_ID = { fluid:0, metaballs:1, tunnel:2, aurora:3, electric:4, chrome:5, gyroid:6, raymarch:7, feedback:8, strobe:9, warehouse:10, laser:11, portal:12, crystal:13, hypercube:14, cosmicDrift:15 };
```
Replace:
```js
const SHADER_STYLE_ID = { fluid:0, metaballs:1, tunnel:2, aurora:3, electric:4, chrome:5, gyroid:6, raymarch:7, feedback:8, strobe:9, warehouse:10, laser:11, portal:12, crystal:13, hypercube:14, cosmicDrift:15, warpTunnel:16 };
```

### D) `<select id="shStyle">` — new option after Cosmic Drift (`elastic-morph.html:1659`)

Find:
```html
      <option value="cosmicDrift">Style: Cosmic Drift</option>
    </select>
```
Replace:
```html
      <option value="cosmicDrift">Style: Cosmic Drift</option>
      <option value="warpTunnel">Style: Warp Tunnel</option>
    </select>
```

### E) `HEAVY_SHADER` — **`src/inject-v64.js:6` only, never the `elastic-morph.html` mirror by hand**

Find (in `src/inject-v64.js`):
```js
const HEAVY_SHADER = new Set(["gyroid", "raymarch", "feedback", "crystal", "hypercube", "cosmicDrift"]);   // crystal: gyroid's structural twin (40-step march); hypercube: 32 unrolled segGlow + 16 projCube per pixel, comparable to feedback; cosmicDrift: measured ~2x gyroid's per-frame cost, the heaviest style in the app
```
Replace:
```js
const HEAVY_SHADER = new Set(["gyroid", "raymarch", "feedback", "crystal", "hypercube", "cosmicDrift", "warpTunnel"]);   // crystal: gyroid's structural twin (40-step march); hypercube: 32 unrolled segGlow + 16 projCube per pixel, comparable to feedback; cosmicDrift: measured ~2x gyroid's per-frame cost, the heaviest style in the app; warpTunnel: ~57 segGlow evaluations (48 streaks + 9 shard edges), same cost class as hypercube, no raymarch
```
Then run `node build.js` to regenerate `elastic-morph.html`'s post-marker mirror — **do not**
hand-edit `elastic-morph.html:11930` directly, it will be silently overwritten on the next build.

## Non-Goals

- **Not a raymarched 3D tunnel** (Approach B) — explicitly declined by Frank in favor of the
  cheaper hybrid.
- **Not added to the 820px resolution-cap set** at `elastic-morph.html:3951` — that set is
  reserved for the three actual-raymarch styles (`gyroid`/`crystal`/`cosmicDrift`); Warp Tunnel
  follows `hypercube`'s precedent instead (see Context).
- **No GLSL array syntax** — matching the existing WebGL1/GLSL-ES-1.00-safety convention this
  codebase's own tests already enforce for the Portal/Crystal/Hypercube trio.

## Testing

Following this session's established `test.js` pattern (structural `frag`/`script`/`html`
extraction + `.includes()`/regex checks — see the existing "Shader Engine — Portal Depth, Crystal
Prism, Hypercube Drift" and "Shader Engine — Cosmic Drift" sections in `test.js` for the exact
precedent this reuses):

- `SHADER_STYLE_ID` gained `warpTunnel:16`.
- `warpTunnelStyle` is defined and called within the GLSL `SHADER_FRAG` string (the generic
  `(frag.split("warpTunnelStyle").length - 1) >= 2` pattern is sufficient and discriminating here,
  since the name is new).
- `segGlow`'s total occurrence count in `frag` rises meaningfully above hypercube's pre-existing
  baseline: `hypercubeStyle` alone accounts for 33 occurrences of the literal text `segGlow`
  (1 definition + 32 call sites — 4 quads of 4-edge loops plus one 8-edge cross-connect line,
  counted directly from its source). This style's design adds 57 more (48 streak calls + 9 shard
  edge calls: 3 shards × 3 edges), so the true post-change total should be 90. The generic
  `>= 2` "defined & called" check the rest of this file uses would already pass on hypercube's
  code alone and wouldn't actually verify this style's calls were added — assert
  `(frag.split("segGlow").length - 1) >= 80` specifically instead, a threshold comfortably above
  the 33 pre-existing baseline and safely at-or-below the expected 90, so it only passes once this
  style's calls genuinely exist.
- `main()`'s dispatch chain: `cosmicDrift`'s bare `else` became an explicit `uStyle < 15.5`
  branch, immediately followed by a new bare `else` calling `warpTunnelStyle(uv)`.
- `#shStyle` gained the new `<option>` positioned after `cosmicDrift`'s.
- No GLSL array syntax was introduced by the new style specifically (extend the existing "no GLSL
  array syntax" test's scanned range to cover through the new style, the same way that test
  already scans through the Portal/Crystal/Hypercube trio).
- **`HEAVY_SHADER` gained `"warpTunnel"`** — verified two ways, matching this being the exact gap
  that bit the two prior rounds: (1) `src/inject-v64.js` itself contains
  `warpTunnel` inside its `HEAVY_SHADER` `Set(...)` literal (a direct `injectSrc("inject-v64.js")`
  check, not just the assembled `script`); (2) the assembled `elastic-morph.html` mirror (post
  `node build.js`) contains the identical updated line, proving the regeneration actually
  propagated and nobody hand-edited the mirror out of sync with the source.
- `warpTunnel` is **not** added to the 820px-resolution-cap style list at `elastic-morph.html:3951`
  (an explicit negative assertion, given this spec's Non-Goals calls it out specifically as a
  deliberate choice, not an oversight to later "fix").

## Live Verification

Select "Warp Tunnel" from the Shader style dropdown, confirm streaks radiate outward continuously
without ever fully resetting/popping, confirm the 3 shard glints are visible and rotate slowly,
confirm speed responds to bass/beat and brightness responds to loudness (e.g. by forcing
`S.bass`/`S.beat`/`S.loudness` and comparing frames), confirm `GL.ok === true` (shader still
compiles/links) both on local dev server and the live deployed site before declaring done, per
this session's established "read back `.toString()`/compile state in the browser before
pixel-sampling" verification discipline for anything touching the Shader Engine.
