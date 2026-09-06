# Shader Engine — Bioluminescence + Lava Lamp Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new organic Shader Engine styles — Bioluminescence (soft, ambient, independently-drifting glowing orbs) and Lava Lamp (hard metaball field-merge with buoyant vertical motion) — filling the gap where the organic style family is thin next to the geometric one.

**Architecture:** Both styles reuse the existing metaball-field GLSL technique (`metaStyle`'s pattern: sum an inverse-square/smoothstep field over several moving points) with different motion paths and tonemapping, wired into the Shader Engine's existing dropdown/ID-map/dispatch-chain structure exactly like every prior style addition.

**Tech Stack:** Single-file vanilla JS + inline GLSL fragment shader (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- Both styles are `uHue`-based like every existing style — only small offsets (`uHue + smallValue`), never a hard-coded warm/cool color-family override. The user's Color Bias/DNA hue/palette controls must work identically to every other style.
- Neither style is added to `HEAVY_SHADER` — both use a 6-8 iteration loop with simple inverse-square/smoothstep math, no raymarching, no unrolled per-segment glow evaluation (the two cost drivers behind the app's existing `HEAVY_SHADER` entries). This must be confirmed with a manual perf check after implementation (see the plan's Manual live-check); if either style turns out heavier than expected, `HEAVY_SHADER` must be updated with a comment explaining why, matching the existing set's documented reasoning per entry.
- Exact GLSL from the design spec, copied verbatim — this is a case where subtle constant changes (loop counts, falloff exponents, tonemap curve) change the visual character the design was approved for.
- No build-injection gotcha: all touched code (dropdown HTML, GLSL functions, `SHADER_STYLE_ID`, dispatch chain in `main()`) is confirmed native to `elastic-morph.html`.

---

### Task 1: Add `bioluminescenceStyle` and `lavaLampStyle`, wire into dropdown/ID-map/dispatch

**Files:**
- Modify: `elastic-morph.html:1669` (dropdown — insert 2 new `<option>`s before `</select>`)
- Modify: `elastic-morph.html:4081` (insert both GLSL functions right after `warpTunnelStyle`'s closing `}`)
- Modify: `elastic-morph.html:4176` (`SHADER_STYLE_ID` — append 2 new entries)
- Modify: `elastic-morph.html:4106` (dispatch chain in `main()` — replace the final `else` branch with 2 new `else if` branches + a new final `else`)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Produces: `vec3 bioluminescenceStyle(vec2 uv)` and `vec3 lavaLampStyle(vec2 uv)` GLSL functions; `SHADER_STYLE_ID.bioluminescence === 17` and `SHADER_STYLE_ID.lavaLamp === 18`; dropdown values `"bioluminescence"` and `"lavaLamp"`. No other task or file depends on these beyond what's wired in this same task — this is a single-task plan.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Shader Engine — Bioluminescence + Lava Lamp organic styles");

ok("bioluminescenceStyle exists with the documented 8-orb loop, per-orb hash-based drift/flash, and soft-exposure tonemap", (() => {
  const idx = script.indexOf("vec3 bioluminescenceStyle(vec2 uv){");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 900);
  return body.includes("for(int i=0;i<8;i++){")
    && body.includes("hash(vec2(fi, 2.0))")
    && body.includes("float flash = 0.5 + 0.5*sin(uTime*(0.6+hash(vec2(fi,7.0))*0.8) + fi*3.0);")
    && body.includes("col = 1.0 - exp(-col*1.3);");
})());

ok("lavaLampStyle exists with the documented 6-blob loop, buoyant vertical rise cycle, and hard field-merge smoothstep", (() => {
  const idx = script.indexOf("vec3 lavaLampStyle(vec2 uv){");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 900);
  return body.includes("for(int i=0;i<6;i++){")
    && body.includes("float rise = fract(t*(0.15+hash(vec2(fi,4.0))*0.10) + fi/6.0);")
    && body.includes("vec2 c = vec2(sin(t*xw + ph)*0.55, mix(-1.3, 1.3, rise));")
    && body.includes("float edge = smoothstep(0.75, 1.9, m);");
})());

ok("SHADER_STYLE_ID includes bioluminescence:17 and lavaLamp:18", (() => {
  return script.includes("bioluminescence:17, lavaLamp:18");
})());

ok("the dispatch chain in main() routes uStyle 17 to bioluminescenceStyle and 18 to lavaLampStyle, after warpTunnelStyle", (() => {
  const idx = script.indexOf("void main(){");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 3000);
  return body.includes("else if(uStyle < 17.5) col = warpTunnelStyle(uv);")
    && body.includes("else if(uStyle < 18.5) col = bioluminescenceStyle(uv);")
    && body.includes("else                   col = lavaLampStyle(uv);");
})());

ok('the Shader Engine dropdown has "Style: Bioluminescence" and "Style: Lava Lamp" options', (() => {
  return html.includes('<option value="bioluminescence">Style: Bioluminescence</option>')
    && html.includes('<option value="lavaLamp">Style: Lava Lamp</option>');
})());

ok("neither bioluminescence nor lavaLamp is registered in HEAVY_SHADER (pending the manual perf check — this guards against silently forgetting the decision either way)", (() => {
  const idx = script.indexOf("const HEAVY_SHADER = new Set([");
  if (idx < 0) return false;
  const line = script.slice(idx, script.indexOf(";", idx) + 1);
  return !line.includes('"bioluminescence"') && !line.includes('"lavaLamp"');
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the first 5 new assertions print `✗` (the 6th, checking `HEAVY_SHADER` non-membership, already passes since neither name exists anywhere yet — that's fine, it's a regression guard, not expected to go red).

- [ ] **Step 3: Implement — dropdown**

At `elastic-morph.html:1669`, replace:

```html
      <option value="warpTunnel">Style: Warp Tunnel</option>
    </select>
```

with:

```html
      <option value="warpTunnel">Style: Warp Tunnel</option>
      <option value="bioluminescence">Style: Bioluminescence</option>
      <option value="lavaLamp">Style: Lava Lamp</option>
    </select>
```

- [ ] **Step 4: Implement — GLSL functions**

At `elastic-morph.html:4081` (immediately after `warpTunnelStyle`'s closing `}` — locate by content: the line `col = applyEyeCatcherFX(col, uv);\n  return col;\n}` that ends `warpTunnelStyle`), insert:

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

- [ ] **Step 5: Implement — `SHADER_STYLE_ID`**

At `elastic-morph.html:4176`, replace:

```js
const SHADER_STYLE_ID = { fluid:0, metaballs:1, tunnel:2, aurora:3, electric:4, chrome:5, gyroid:6, raymarch:7, feedback:8, strobe:9, warehouse:10, laser:11, portal:12, crystal:13, hypercube:14, cosmicDrift:15, warpTunnel:16 };
```

with:

```js
const SHADER_STYLE_ID = { fluid:0, metaballs:1, tunnel:2, aurora:3, electric:4, chrome:5, gyroid:6, raymarch:7, feedback:8, strobe:9, warehouse:10, laser:11, portal:12, crystal:13, hypercube:14, cosmicDrift:15, warpTunnel:16, bioluminescence:17, lavaLamp:18 };
```

- [ ] **Step 6: Implement — dispatch chain**

At `elastic-morph.html:4106` (locate by content — the line `else                   col = warpTunnelStyle(uv);` that currently ends the `if/else if` chain in `void main(){`), replace:

```glsl
  else                   col = warpTunnelStyle(uv);
```

with:

```glsl
  else if(uStyle < 17.5) col = warpTunnelStyle(uv);
  else if(uStyle < 18.5) col = bioluminescenceStyle(uv);
  else                   col = lavaLampStyle(uv);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 6 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 8: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Bioluminescence and Lava Lamp organic Shader Engine styles

Two new styles on the existing metaball-field technique (metaStyle's
pattern), filling the gap Frank flagged: the organic style family
(Fluid, Metaballs, Aurora, Chrome) was thin next to the 13 geometric
styles. Bioluminescence is a calm, ambient, soft-glow blob style with
independently-drifting orbs and a bioluminescent flicker -- none of
the existing organic styles are ambient rather than energetic.
Lava Lamp reuses metaStyle's hard field-merge but with a buoyant
vertical rise-fall cycle instead of orbiting.

Both stay uHue-based like every other style -- small per-style offsets
only, no forced color-family override -- and use a 6-8 iteration loop
comparable in cost to metaStyle's own 7-iteration loop, so neither is
added to HEAVY_SHADER (pending the manual perf check).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

Not covered by `test.js` (static source assertions only) — verify in a
real browser with the Shader Engine enabled:

1. Select Bioluminescence — confirm soft glowing orbs drift independently
   with a flicker, no hard blob-merge edges, and color follows the current
   DNA hue/palette like other styles.
2. Select Lava Lamp — confirm blobs visibly fuse/separate as they pass near
   each other, moving in a vertical rise-fall cycle rather than orbiting.
3. Compare frame rate against Metaballs at the same resolution (rough
   visual/DevTools FPS check) — confirm neither new style is noticeably
   heavier. If either is, add it to `HEAVY_SHADER`
   (`elastic-morph.html:12598`) with a comment explaining why, matching the
   existing set's documented reasoning per entry, and update the "neither
   ... is registered in HEAVY_SHADER" test from Step 1 accordingly.
4. Confirm both respond to bass/beat/loudness (radius/glow pulsing) and to
   Color Bias/Speed/Scale (the existing global Shader Engine controls) like
   every other style.
