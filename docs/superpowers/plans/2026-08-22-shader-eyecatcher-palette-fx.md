# Shader Eye-Catcher Palette + Post-FX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four weak Shader Engine styles (Aurora, Gyroid, Feedback Fractal, SDF Blob)
in Elastic Morph by giving them a shared bloom/chromatic/grain post-treatment and curated
two-color palettes, adapted from the technique that makes Elastic Lab's shaders look punchy.

**Architecture:** One new GLSL helper function `applyEyeCatcherFX(col, uv)` (self-bloom,
chromatic-channel tilt, grain — no vignette, since `main()` already vignettes every style
globally). Each of the 4 weak style functions swaps its ad-hoc `hsv2rgb(hue+...)` calls for
`mix(anchorA, anchorB, t)` between two fixed, style-specific colors, then calls the new helper
as its last step before `return`. `main()` and the 6 already-strong styles are not touched.

**Tech Stack:** GLSL (embedded in a JS template literal), vanilla JS, zero-dependency Node test
harness (`test.js`).

## Global Constraints

- No new UI, no new uniforms, no new localStorage keys — purely internal color/FX logic for
  the 4 named styles (per spec's decided questions).
- `applyEyeCatcherFX` has no vignette of its own — `main()`'s existing global vignette must
  keep doing that job for all 12 styles unchanged.
- `main()` itself is not modified at all.
- The 6 already-strong styles (`fluidStyle`, `metaStyle`, `tunnelStyle`, `electricStyle`,
  `chromeStyle`, `strobeStyle`, `warehouseStyle`, `laserStyle` — note `fluidStyle` is the
  deliberately-soft one and also must not change) must not call `applyEyeCatcherFX` or have
  any other change.
- The exact numeric constants in this plan (bloom/chromatic/grain amounts, anchor RGB values)
  are starting values for a live-browser tuning pass, not a locked final state — tests must
  check for the *technique* (structural presence of self-bloom / channel-tilt / grain / a
  named two-color mix), never the exact tunable numbers, so a legitimate live-tuning edit
  doesn't break the suite.
- Reference spec: `docs/superpowers/specs/2026-08-22-shader-eyecatcher-palette-fx-design.md`.

---

## File Structure

Two files change:

- **`elastic-morph.html`** — `<script>` block: one new helper function inserted at line 3041
  (between the existing `fbm()` helper and the `// ---- styles ----` comment), and edits inside
  4 existing style functions (`auroraStyle` :3093-3111, `gyroidStyle` :3145-3166,
  `raymarchStyle` :3167-3195, `feedbackStyle` :3196-3206).
- **`test.js`** — one new top-level helper (`extractGlslFn`, brace-matching like the existing
  `extractFn` but anchored on a GLSL function *signature* string instead of the JS-only
  `"function " + name + "("` prefix `extractFn` assumes — GLSL functions in this file look like
  `vec3 auroraStyle(vec2 uv){`, which `extractFn` cannot find), plus one new assertion section
  appended before the `/* ---------------- summary ---------------- */` block.

---

### Task 1: Add the eye-catcher helper and rewire the 4 weak styles

**Files:**
- Modify: `elastic-morph.html:3041` (insert new helper)
- Modify: `elastic-morph.html:3093-3111` (`auroraStyle`)
- Modify: `elastic-morph.html:3145-3166` (`gyroidStyle`)
- Modify: `elastic-morph.html:3167-3195` (`raymarchStyle`)
- Modify: `elastic-morph.html:3196-3206` (`feedbackStyle`)
- Test: `test.js` (new `extractGlslFn` helper + new assertion section, appended before the
  summary block)

**Interfaces:**
- Consumes: `hash(vec2)` (existing helper, elastic-morph.html:3023), `uHue`/`uMids`/`uHighs`/
  `uBass`/`uBeat`/`uLoud`/`uIntensity`/`uTime` (existing uniforms/varyings already used inside
  these 4 functions).
- Produces: `vec3 applyEyeCatcherFX(vec3 col, vec2 uv)` — no other task in this plan consumes
  it (single-task plan); called only from the 4 rewired style functions.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the existing `extractFn` helper (starts around line 19) and add a second
helper directly after `loadFns` (around line 32), reusing the same brace-counting algorithm but
anchored on an exact signature string instead of a JS `function` prefix — this file's shader
code is GLSL text inside a JS template literal, so `extractFn`'s `"function " + name + "("`
search can never match a GLSL function like `vec3 auroraStyle(vec2 uv){`:

```js
/* pull a GLSL function's full source via brace matching, anchored on its exact signature
   (GLSL functions aren't JS `function` declarations, so extractFn can't find them) */
function extractGlslFn(signature) {
  const start = script.indexOf(signature);
  if (start < 0) return null;
  let i = script.indexOf("{", start), depth = 0;
  for (let j = i; j < script.length; j++) {
    if (script[j] === "{") depth++;
    else if (script[j] === "}") { depth--; if (depth === 0) return script.slice(start, j + 1); }
  }
  return null;
}
```

Then find the `/* ---------------- summary ---------------- */` block near the end of the file
(currently starts at line 627) and insert this new section directly above it:

```js
/* ---------------- Shader eye-catcher palette + FX ---------------- */
section("Shader eye-catcher palette + FX (Aurora/Gyroid/Feedback/SDF Blob)");

ok("applyEyeCatcherFX helper defined with self-bloom, chromatic-tilt, and grain", (() => {
  const fn = extractGlslFn("vec3 applyEyeCatcherFX(vec3 col, vec2 uv){");
  return !!fn
    && /col\s*\+=\s*col\s*\*\s*col/.test(fn)                 // self-bloom
    && /col\.r\s*\*=/.test(fn) && /col\.b\s*\*=/.test(fn)    // chromatic channel tilt
    && /hash\(uv\s*\*/.test(fn);                             // grain via hash noise
})());

[
  ["auroraStyle", "vec3 auroraStyle(vec2 uv){", "auroraA", "auroraB"],
  ["gyroidStyle", "vec3 gyroidStyle(vec2 uv){", "gyroidA", "gyroidB"],
  ["feedbackStyle", "vec3 feedbackStyle(vec2 uv){", "feedbackA", "feedbackB"],
].forEach(([name, sig, a, b]) => {
  ok(name + " mixes a named two-color palette and calls applyEyeCatcherFX", (() => {
    const fn = extractGlslFn(sig);
    return !!fn
      && fn.includes("mix(" + a + ", " + b + ", ")
      && fn.includes("applyEyeCatcherFX(col, uv)");
  })());
});

ok("raymarchStyle (SDF Blob) calls applyEyeCatcherFX without changing its existing warm/cool hit coloring", (() => {
  const fn = extractGlslFn("vec3 raymarchStyle(vec2 uv){");
  return !!fn
    && fn.includes("applyEyeCatcherFX(col, uv)")
    && fn.includes("hsv2rgb(vec3(fract(hue), 0.78, 0.85 + uBeat*0.5 + uLoud*0.3))")
    && fn.includes("hsv2rgb(vec3(fract(hue), 0.30, 0.30 + uBass*0.25))");
})());

[
  ["fluidStyle", "vec3 fluidStyle(vec2 uv){"],
  ["metaStyle", "vec3 metaStyle(vec2 uv){"],
  ["tunnelStyle", "vec3 tunnelStyle(vec2 uv){"],
  ["electricStyle", "vec3 electricStyle(vec2 uv){"],
  ["chromeStyle", "vec3 chromeStyle(vec2 uv){"],
  ["strobeStyle", "vec3 strobeStyle(vec2 uv){"],
  ["warehouseStyle", "vec3 warehouseStyle(vec2 uv){"],
  ["laserStyle", "vec3 laserStyle(vec2 uv){"],
].forEach(([name, sig]) => {
  ok(name + " untouched (no applyEyeCatcherFX call)", (() => {
    const fn = extractGlslFn(sig);
    return !!fn && !fn.includes("applyEyeCatcherFX");
  })());
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js`
Expected: the "applyEyeCatcherFX helper defined..." assertion fails (function doesn't exist
yet), the 3 palette-mix assertions fail (no `mix(auroraA, auroraB, ...)` etc. yet), the
raymarch assertion fails (no `applyEyeCatcherFX` call yet — the two `hsv2rgb` substring checks
alone would already pass since that code is unchanged, but the combined `&&` makes the whole
assertion fail), and the 8 "untouched" assertions already pass (nothing calls
`applyEyeCatcherFX` yet, including these 8 — that's expected and fine, a passing assertion pre-
implementation just means this specific check has nothing to catch yet).

- [ ] **Step 3: Write the minimal implementation**

In `elastic-morph.html`, insert the new helper between the `fbm()` closing brace and the
`// ---- styles ----` comment (currently lines 3040-3042):

```js
float fbm(vec2 p){
  float v = 0.0, amp = 0.5;
  mat2 m = mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<5;i++){ v += amp*vnoise(p); p = m*p; amp *= 0.5; }
  return v;
}
vec3 applyEyeCatcherFX(vec3 col, vec2 uv){
  col += col * col * 0.35;                            // self-bloom
  float d = length(uv);
  col.r *= 1.0 + d * 0.12;                             // chromatic-aberration-Anmutung -
  col.b *= 1.0 - d * 0.12;                             // channel tilt, no resample needed
  col += (hash(uv * 500.0 + uTime) - 0.5) * 0.03;      // grain
  return col;
}

// ---- styles ----
```

Replace `auroraStyle` (lines 3093-3111) with:

```js
vec3 auroraStyle(vec2 uv){
  float t = uTime*0.12;
  vec3 col = vec3(0.0);
  vec3 auroraA = vec3(0.05, 0.9, 0.55);
  vec3 auroraB = vec3(0.55, 0.15, 0.95);
  for(int i=0;i<4;i++){
    float fi = float(i);
    float depth = 0.6 + fi*0.35;
    float sway = fbm(vec2(uv.x*1.2 + fi*3.1, t*0.6 + fi))*0.5;
    float xpos = uv.x*1.4 + sway*(0.8 + uMids);
    float flow = fbm(vec2(xpos*2.0 + fi*5.0, uv.y*1.5 - t*(1.0 + uBass*1.5) + fi));
    float band = smoothstep(0.2, 1.0, flow);
    float vfade = smoothstep(-1.0, 0.85, uv.y);
    float inten = band * vfade / depth * (0.7 + uLoud*0.8 + uBeat*0.5);
    float mixT = fract(uHue + 0.08*fi + 0.12*flow + uHighs*0.1);
    col += mix(auroraA, auroraB, mixT) * (inten*(0.5 + uIntensity));
  }
  float stars = pow(hash(floor(uv*60.0)), 40.0);
  col += vec3(stars)*0.4*(1.0 - uBeat);
  col = applyEyeCatcherFX(col, uv);
  return col;
}
```

Replace `gyroidStyle` (lines 3145-3166) with:

```js
vec3 gyroidStyle(vec2 uv){
  vec3 gyroidA = vec3(0.0, 0.7, 0.9);
  vec3 gyroidB = vec3(0.3, 0.1, 0.9);
  vec3 ro = vec3(0.0, 0.0, -3.0);
  vec3 rd = normalize(vec3(uv, 1.6));
  float a = uTime*0.15 + uBass*0.3;
  mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
  float scale = 3.0 + uMids*2.0;
  float glow = 0.0, t = 0.0;
  for(int i=0;i<40;i++){
    vec3 p = ro + rd*t;
    p.xz = R*p.xz;
    float g = abs(gyroid(p*scale))/scale;          // ~distance to the lattice surface
    float shell = exp(-g*22.0);                     // glow only on the thin gyroid shell
    glow += shell * exp(-t*0.16) * (0.9 + uBeat*0.8);
    t += 0.16;                                      // fixed march through the volume
  }
  glow *= 0.08;
  float mixT = fract(uHue + glow*0.15 + uHighs*0.1 + uMids*0.05);
  float v = glow * (0.7 + uIntensity*0.6) * (0.7 + uLoud*0.6);
  vec3 col = mix(gyroidA, gyroidB, mixT) * v;
  col += mix(gyroidB, gyroidA, mixT) * (pow(glow, 3.0)*0.6);   // bright cores, swapped anchors
  col = applyEyeCatcherFX(col, uv);
  return col;
}
```

Replace `raymarchStyle` (lines 3167-3195) with (only the final return changes — the raymarch
loop and both `hsv2rgb` hit-coloring branches are untouched per the spec):

```js
vec3 raymarchStyle(vec2 uv){
  vec3 ro = vec3(0.0, 0.55, -2.6);                      // camera lifted above the floor plane
  vec3 rd = normalize(vec3(uv.x, uv.y - 0.15, 1.4));     // slight downward tilt onto the blob
  float dO = 0.0;
  vec3 col = vec3(0.0);                                  // stays black (background) unless we hit something below
  float floorY = -0.62;                                  // sits just below the blob's resting radius
  float rad = 0.55 + uBass*0.18 + uBeat*0.08;
  for(int i=0;i<64;i++){
    vec3 p = ro + rd*dO;
    float dSphere = length(p) - rad;
    float dFloor = p.y - floorY;
    float d = min(dSphere, dFloor);
    if(d < 0.015){
      // shade the single hit point once - no per-step accumulation, so nothing can blow out to white
      if(dSphere < dFloor){
        float hue = uHue + 0.06*sin(p.x*3.0 + p.y*2.0 + uMids*0.3);
        col = hsv2rgb(vec3(fract(hue), 0.78, 0.85 + uBeat*0.5 + uLoud*0.3));
      } else {
        float hue = uHue + 0.5;
        col = hsv2rgb(vec3(fract(hue), 0.30, 0.30 + uBass*0.25));
      }
      col *= exp(-dO*0.12);                              // gentle depth fog toward the horizon
      break;
    }
    dO += max(d, 0.02);
    if(dO > 8.0) break;
  }
  col *= (0.85 + uLoud*0.35 + uBeat*0.15);
  col = applyEyeCatcherFX(col, uv);
  return col;
}
```

Replace `feedbackStyle` (lines 3196-3206) with:

```js
vec3 feedbackStyle(vec2 uv){
  vec3 feedbackA = vec3(1.0, 0.0, 0.6);
  vec3 feedbackB = vec3(0.0, 1.0, 1.0);
  float t = uTime*0.28;
  float a = atan(uv.y, uv.x);
  float r = length(uv) + 0.001;
  vec2 p = vec2(cos(a*3.0 + t)*r, sin(a*2.0 - t*0.65)*r);
  float f = fbm(p*2.8 + t);
  float zoom = 0.45 + 0.55*sin(t*0.7 + uBeat*3.5);
  f += fbm(p*4.5 - t*1.1) * zoom;
  float mixT = fract(uHue + f*0.18 + a*0.12 + uHighs*0.08);
  vec3 col = mix(feedbackA, feedbackB, mixT) * (pow(clamp(f,0.0,1.0), 1.15)*(0.65 + uLoud*0.65));
  col = applyEyeCatcherFX(col, uv);
  return col;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js`
Expected: every assertion in the new "Shader eye-catcher palette + FX" section prints `✓`, and
the full suite is still `0 failed` (299 prior assertions untouched by this change, plus the new
ones from this task).

- [ ] **Step 5: Manual live-tuning verification in the browser**

Run `npm start` (serves the app locally on port 3456), open it, go to Pro-Modus, load the demo
track (or your own), open the Shader Engine panel, enable the shader.

For each of the 4 styles (Aurora/Polarlicht, Gyroid, Feedback Fractal, SDF Blob), during a loud
section of the track:
- Confirm there's now visibly more color structure/contrast than before (compare side-by-side
  against an untouched style like Metaballs or Tunnel — same intensity/opacity slider values).
- Confirm it does **not** wash out to flat white/gray at high `uLoud`/`uBeat` moments (the
  failure mode that motivated this whole task) and does **not** look noticeably darker overall
  than the untouched styles (the self-bloom in `applyEyeCatcherFX` stacking with `main()`'s
  existing global vignette is the specific risk to watch for).
- Confirm the 8 untouched styles (especially Fluid/Liquid, which must stay soft) still look
  exactly as they did before this task.

If any of the 4 styles needs adjustment, tune the numeric constants directly: the three amounts
inside `applyEyeCatcherFX` (`0.35` bloom, `0.12` chromatic tilt, `0.03` grain), or the two
`vec3` anchor colors inside the specific style function. Reload after each edit
(`npm start` serves static files, no rebuild step). No test changes are needed for this — Step
1's assertions check the technique (that a bloom/tilt/grain/mix exists), not these exact
numbers, precisely so this tuning pass can happen freely. Re-run `node test.js` once after all
tuning is done to confirm the suite is still green.

- [ ] **Step 6: Commit**

```bash
cd "/Users/frankkrumsdorf/Desktop/Elastic Morph Cursor"
git add elastic-morph.html test.js
git commit -m "feat: add eye-catcher palette + post-FX to Aurora/Gyroid/Feedback/SDF Blob shader styles"
```

If Step 5 changed any constants from this plan's starting values, mention the final tuned
values in the commit message body.
