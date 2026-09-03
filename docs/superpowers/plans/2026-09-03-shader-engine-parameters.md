# Shader Engine Parameters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Shader Engine three new global controls — Speed, Scale, Color Bias — that work uniformly across all 17 GLSL styles.

**Architecture:** Two new GLSL uniforms (`uScale`, `uColorBias`) applied once in the shader's `main()` — before the style dispatch and right before the existing vignette/tonemap — so none of the 17 individual style functions are touched. Speed needs no GLSL uniform at all: it's implemented by scaling the value fed into the existing `uTime` uniform on the JS side. All three are plain, static, user-set values (no live audio-reactive modulation).

**Tech Stack:** Single-file vanilla JS/WebGL1 app (`elastic-morph.html`), GLSL ES 1.00 fragment shader, zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- `S.shader` fields: `speed` range 0.2–3.0 (default 1), `scale` range 0.5–2.5 (default 1), `colorBias` range -0.8–0.8 (default 0) — exact values from the approved design spec.
- No live audio-reactive modulation of these three fields (Frank's explicit choice).
- None of the 17 GLSL style functions (`fluidStyle`, `metaStyle`, …, `warpTunnelStyle`) may be modified.
- `syncShaderUI()` lives in `src/inject-v93.js` and is regenerated into `elastic-morph.html` by `build.js` on every build — it MUST be edited in `src/inject-v93.js`, never patched directly in the generated region of `elastic-morph.html` (any such edit is silently wiped on the next `node build.js`/deploy). Every other file in this plan is edited directly in `elastic-morph.html`.
- After any change touching `src/inject-v93.js`, run `node build.js` before `node test.js` (matches `npm run ci`).

---

### Task 1: Shader engine plumbing — GLSL uniforms + JS wiring

**Files:**
- Modify: `elastic-morph.html:2970` (`S.shader` defaults)
- Modify: `elastic-morph.html:3499-3500` (`SHADER_FRAG` uniform declarations)
- Modify: `elastic-morph.html:3908-3909` (`main()` — uv scale)
- Modify: `elastic-morph.html:3929-3931` (`main()` — color bias, before vignette)
- Modify: `elastic-morph.html:3974-3988` (`initGL()` — `GL.loc` uniform locations)
- Modify: `elastic-morph.html:4022,4030` (`renderShader()` — per-frame uniform sets)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Produces: `S.shader.speed` (number, default `1`), `S.shader.scale` (number, default `1`), `S.shader.colorBias` (number, default `0`) — read by `renderShader()` and, in Task 2, by the UI sync/persistence code.
- Produces: GLSL uniforms `uScale`, `uColorBias` on the shader program, wired via `GL.loc.scale` / `GL.loc.colorBias`.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it (i.e. right after whatever `ok(...)` call currently precedes that comment):

```js
section("Shader Engine — Speed / Scale / Color Bias (global controls)");

ok("S.shader default object gained speed/scale/colorBias defaults (1, 1, 0)", (() => {
  const m = script.match(/shader:\s*\{[^}]*\}/);
  if (!m) return false;
  const body = m[0];
  return /speed:\s*1\b/.test(body) && /scale:\s*1\b/.test(body) && /colorBias:\s*0\b/.test(body);
})());

ok("SHADER_FRAG declares the new uScale/uColorBias uniforms", frag.includes("uniform float uScale;") && frag.includes("uniform float uColorBias;"));

ok("main() applies uScale to uv right after computing it, before the existing beat zoom-punch", (() => {
  const mainIdx = frag.lastIndexOf("void main(){");
  if (mainIdx < 0) return false;
  const mainBody = frag.slice(mainIdx, mainIdx + 400);
  const uvIdx = mainBody.indexOf("vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / min(uRes.x, uRes.y);");
  const scaleIdx = mainBody.indexOf("uv *= uScale;");
  const punchIdx = mainBody.indexOf("uv *= 1.0 - uBeat*0.10;");
  return uvIdx >= 0 && scaleIdx > uvIdx && punchIdx > scaleIdx;
})());

ok("main() applies the color-bias saturation lift to col before the existing vignette", (() => {
  const mainIdx = frag.lastIndexOf("void main(){");
  if (mainIdx < 0) return false;
  const mainBody = frag.slice(mainIdx);
  const biasIdx = mainBody.indexOf("col = mix(vec3(lum), col, 1.0 + uColorBias);");
  const vigIdx = mainBody.indexOf("float vig = 1.0 - dot(uv,uv)*0.35;");
  return biasIdx >= 0 && vigIdx > biasIdx;
})());

ok("initGL's GL.loc gains scale/colorBias uniform locations", (() => {
  const idx = script.indexOf("GL.loc = {");
  if (idx < 0) return false;
  const block = script.slice(idx, idx + 500);
  return block.includes('gl.getUniformLocation(prog, "uScale")') && block.includes('gl.getUniformLocation(prog, "uColorBias")');
})());

ok("renderShader scales the uTime uniform by SH.speed and sets the new uScale/uColorBias uniforms", (() => {
  const idx = script.indexOf("function renderShader(W, H, hue){");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 1600);
  return body.includes("gl.uniform1f(L.time, S.time * (SH.speed != null ? SH.speed : 1));")
    && body.includes("gl.uniform1f(L.scale, SH.scale != null ? SH.scale : 1);")
    && body.includes("gl.uniform1f(L.colorBias, SH.colorBias != null ? SH.colorBias : 0);");
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the 5 new assertions under "Shader Engine — Speed / Scale / Color Bias (global controls)" print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement — `S.shader` defaults**

At `elastic-morph.html:2970`, replace:

```js
  shader: { on: false, style: "fluid", intensity: 0.7, opacity: 0.85, blend: "lighter", warp: false },
```

with:

```js
  shader: { on: false, style: "fluid", intensity: 0.7, opacity: 0.85, blend: "lighter", warp: false, speed: 1, scale: 1, colorBias: 0 },
```

- [ ] **Step 4: Implement — new GLSL uniform declarations**

At `elastic-morph.html:3499-3500`, replace:

```glsl
uniform float uIntensity;  // 0..1
uniform float uPalOn;      // 1 when a Named Gradient palette is active
```

with:

```glsl
uniform float uIntensity;  // 0..1
uniform float uScale;      // global zoom multiplier, default 1.0
uniform float uColorBias;  // global saturation/contrast lift, -0.8..0.8, default 0
uniform float uPalOn;      // 1 when a Named Gradient palette is active
```

- [ ] **Step 5: Implement — apply uScale in `main()`**

At `elastic-morph.html:3908-3909`, replace:

```glsl
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / min(uRes.x, uRes.y);
  uv *= 1.0 - uBeat*0.10;                                  // beat zoom-in punch
```

with:

```glsl
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / min(uRes.x, uRes.y);
  uv *= uScale;                                             // global Speed/Scale/Color Bias controls
  uv *= 1.0 - uBeat*0.10;                                  // beat zoom-in punch
```

- [ ] **Step 6: Implement — apply uColorBias before the vignette in `main()`**

At `elastic-morph.html:3929-3931`, replace:

```glsl
  else                   col = warpTunnelStyle(uv);
  // gentle vignette + filmic-ish tone
  float vig = 1.0 - dot(uv,uv)*0.35;
```

with:

```glsl
  else                   col = warpTunnelStyle(uv);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 1.0 + uColorBias);
  // gentle vignette + filmic-ish tone
  float vig = 1.0 - dot(uv,uv)*0.35;
```

- [ ] **Step 7: Implement — uniform locations in `initGL()`**

At `elastic-morph.html:3974-3988`, replace:

```js
    GL.loc = {
      res: gl.getUniformLocation(prog, "uRes"),
      time: gl.getUniformLocation(prog, "uTime"),
      bass: gl.getUniformLocation(prog, "uBass"),
      mids: gl.getUniformLocation(prog, "uMids"),
      highs: gl.getUniformLocation(prog, "uHighs"),
      beat: gl.getUniformLocation(prog, "uBeat"),
      loud: gl.getUniformLocation(prog, "uLoud"),
      hue: gl.getUniformLocation(prog, "uHue"),
      style: gl.getUniformLocation(prog, "uStyle"),
      intensity: gl.getUniformLocation(prog, "uIntensity"),
      palOn: gl.getUniformLocation(prog, "uPalOn"),
      palA: gl.getUniformLocation(prog, "uPalA"),
      palB: gl.getUniformLocation(prog, "uPalB")
    };
```

with:

```js
    GL.loc = {
      res: gl.getUniformLocation(prog, "uRes"),
      time: gl.getUniformLocation(prog, "uTime"),
      bass: gl.getUniformLocation(prog, "uBass"),
      mids: gl.getUniformLocation(prog, "uMids"),
      highs: gl.getUniformLocation(prog, "uHighs"),
      beat: gl.getUniformLocation(prog, "uBeat"),
      loud: gl.getUniformLocation(prog, "uLoud"),
      hue: gl.getUniformLocation(prog, "uHue"),
      style: gl.getUniformLocation(prog, "uStyle"),
      intensity: gl.getUniformLocation(prog, "uIntensity"),
      scale: gl.getUniformLocation(prog, "uScale"),
      colorBias: gl.getUniformLocation(prog, "uColorBias"),
      palOn: gl.getUniformLocation(prog, "uPalOn"),
      palA: gl.getUniformLocation(prog, "uPalA"),
      palB: gl.getUniformLocation(prog, "uPalB")
    };
```

- [ ] **Step 8: Implement — per-frame uniform sets in `renderShader()`**

At `elastic-morph.html:4022`, replace:

```js
  gl.uniform1f(L.time, S.time);
```

with:

```js
  gl.uniform1f(L.time, S.time * (SH.speed != null ? SH.speed : 1));
```

At `elastic-morph.html:4030` (a few lines below), replace:

```js
  gl.uniform1f(L.intensity, SH.intensity);
```

with:

```js
  gl.uniform1f(L.intensity, SH.intensity);
  gl.uniform1f(L.scale, SH.scale != null ? SH.scale : 1);
  gl.uniform1f(L.colorBias, SH.colorBias != null ? SH.colorBias : 0);
```

- [ ] **Step 9: Run the build and tests to verify they pass**

Run: `npm run ci`
Expected: all assertions print `✓`, including the 5 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 10: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Speed/Scale/Color Bias uniforms to the Shader Engine

Applied once in main() so all 17 GLSL styles benefit without any of
their individual functions being touched. Speed needs no new uniform:
it scales the value fed into the existing uTime uniform on the JS side.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: UI sliders + persistence

**Files:**
- Modify: `elastic-morph.html:1677-1680` (Shader Engine panel — new slider rows)
- Modify: `elastic-morph.html:9044-9050` (`buildShader()` — new event listeners)
- Modify: `src/inject-v93.js:22-32` (`syncShaderUI()` — new slider sync)
- Modify: `elastic-morph.html:8907-8916` (project load — clamp + slider sync for old saves)
- Test: `test.js` (extends the section added in Task 1)

**Interfaces:**
- Consumes: `S.shader.speed` / `S.shader.scale` / `S.shader.colorBias` (from Task 1, defaults `1`/`1`/`0`).
- Consumes: `fbClamp(v, lo, hi, d)` — existing local helper in scope at `elastic-morph.html:8874`, signature `(value, min, max, default) => number`.
- Produces: DOM elements `#shSpeed`/`#shSpeedVal`, `#shScale`/`#shScaleVal`, `#shColorBias`/`#shColorBiasVal`, kept in sync with `S.shader.*` by `buildShader()` (on input), `syncShaderUI()` (on demand), and the project-load path (on load).

- [ ] **Step 1: Write the failing tests**

In `test.js`, extend the section added in Task 1 (add these three `ok(...)` calls right after the ones from Task 1, still before the summary block):

```js
ok("Shader Engine panel gained the Speed/Scale/Color Bias slider rows with correct ranges/defaults", (() => {
  const panelIdx = html.indexOf('<select id="shStyle"');
  if (panelIdx < 0) return false;
  const block = html.slice(panelIdx, panelIdx + 2200);
  return block.includes('<input type="range" id="shSpeed" min="20" max="300" value="100">')
    && block.includes('<input type="range" id="shScale" min="50" max="250" value="100">')
    && block.includes('<input type="range" id="shColorBias" min="-80" max="80" value="0">');
})());

ok("buildShader() wires the 3 new sliders to S.shader.speed/scale/colorBias", (() => {
  const idx = script.indexOf("function buildShader() {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 800);
  return body.includes('S.shader.speed = e.target.value / 100; $("shSpeedVal").textContent = e.target.value;')
    && body.includes('S.shader.scale = e.target.value / 100; $("shScaleVal").textContent = e.target.value;')
    && body.includes('S.shader.colorBias = e.target.value / 100; $("shColorBiasVal").textContent = e.target.value;');
})());

ok("syncShaderUI() pushes S.shader.speed/scale/colorBias into the 3 new sliders", (() => {
  const idx = script.lastIndexOf("function syncShaderUI() {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 700);
  return body.includes('$("shSpeed").value = Math.round(S.shader.speed * 100); $("shSpeedVal").textContent = Math.round(S.shader.speed * 100);')
    && body.includes('$("shScale").value = Math.round(S.shader.scale * 100); $("shScaleVal").textContent = Math.round(S.shader.scale * 100);')
    && body.includes('$("shColorBias").value = Math.round(S.shader.colorBias * 100); $("shColorBiasVal").textContent = Math.round(S.shader.colorBias * 100);');
})());

ok("project load clamps speed/scale/colorBias with fbClamp and syncs the 3 new sliders (old saves without these fields fall back to defaults, not undefined)", (() => {
  const idx = script.indexOf("if (o.shader) {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 1200);
  return body.includes("S.shader.speed = fbClamp(S.shader.speed, 0.2, 3.0, 1);")
    && body.includes("S.shader.scale = fbClamp(S.shader.scale, 0.5, 2.5, 1);")
    && body.includes("S.shader.colorBias = fbClamp(S.shader.colorBias, -0.8, 0.8, 0);")
    && body.includes('$("shSpeed").value = Math.round(S.shader.speed * 100); $("shSpeedVal").textContent = Math.round(S.shader.speed * 100);');
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run ci`
Expected: the 4 new assertions print `✗` (everything from Task 1 still `✓`).

- [ ] **Step 3: Implement — Shader Engine panel slider rows**

At `elastic-morph.html:1677-1680`, replace:

```html
    <div class="slider-row">
      <label>Opacity <span class="val" id="shOpVal">85</span></label>
      <input type="range" id="shOp" min="0" max="100" value="85">
    </div>
```

with:

```html
    <div class="slider-row">
      <label>Opacity <span class="val" id="shOpVal">85</span></label>
      <input type="range" id="shOp" min="0" max="100" value="85">
    </div>
    <div class="slider-row">
      <label>Speed <span class="val" id="shSpeedVal">100</span></label>
      <input type="range" id="shSpeed" min="20" max="300" value="100">
    </div>
    <div class="slider-row">
      <label>Scale <span class="val" id="shScaleVal">100</span></label>
      <input type="range" id="shScale" min="50" max="250" value="100">
    </div>
    <div class="slider-row">
      <label>Color Bias <span class="val" id="shColorBiasVal">0</span></label>
      <input type="range" id="shColorBias" min="-80" max="80" value="0">
    </div>
```

- [ ] **Step 4: Implement — `buildShader()` event listeners**

At `elastic-morph.html:9044-9050`, replace:

```js
function buildShader() {
  $("shOn").addEventListener("change", e => { S.shader.on = e.target.checked; if (e.target.checked) initGL(); });
  $("shStyle").addEventListener("change", e => S.shader.style = e.target.value);
  $("shBlend").addEventListener("change", e => S.shader.blend = e.target.value);
  $("shInt").addEventListener("input", e => { S.shader.intensity = e.target.value / 100; $("shIntVal").textContent = e.target.value; });
  $("shOp").addEventListener("input", e => { S.shader.opacity = e.target.value / 100; $("shOpVal").textContent = e.target.value; });
}
```

with:

```js
function buildShader() {
  $("shOn").addEventListener("change", e => { S.shader.on = e.target.checked; if (e.target.checked) initGL(); });
  $("shStyle").addEventListener("change", e => S.shader.style = e.target.value);
  $("shBlend").addEventListener("change", e => S.shader.blend = e.target.value);
  $("shInt").addEventListener("input", e => { S.shader.intensity = e.target.value / 100; $("shIntVal").textContent = e.target.value; });
  $("shOp").addEventListener("input", e => { S.shader.opacity = e.target.value / 100; $("shOpVal").textContent = e.target.value; });
  $("shSpeed").addEventListener("input", e => { S.shader.speed = e.target.value / 100; $("shSpeedVal").textContent = e.target.value; });
  $("shScale").addEventListener("input", e => { S.shader.scale = e.target.value / 100; $("shScaleVal").textContent = e.target.value; });
  $("shColorBias").addEventListener("input", e => { S.shader.colorBias = e.target.value / 100; $("shColorBiasVal").textContent = e.target.value; });
}
```

- [ ] **Step 5: Implement — `syncShaderUI()` in its true source file**

Edit `src/inject-v93.js:22-32`. Replace:

```js
function syncShaderUI() {
  if (!$("shOn")) return;
  $("shOn").checked = !!S.shader.on;
  $("shStyle").value = S.shader.style;
  $("shBlend").value = S.shader.blend;
  const i = Math.round(S.shader.intensity * 100);
  const o = Math.round(S.shader.opacity * 100);
  $("shInt").value = i; $("shIntVal").textContent = i;
  $("shOp").value = o; $("shOpVal").textContent = o;
  if (S.shader.on && typeof initGL === "function") initGL();
}
```

with:

```js
function syncShaderUI() {
  if (!$("shOn")) return;
  $("shOn").checked = !!S.shader.on;
  $("shStyle").value = S.shader.style;
  $("shBlend").value = S.shader.blend;
  const i = Math.round(S.shader.intensity * 100);
  const o = Math.round(S.shader.opacity * 100);
  $("shInt").value = i; $("shIntVal").textContent = i;
  $("shOp").value = o; $("shOpVal").textContent = o;
  $("shSpeed").value = Math.round(S.shader.speed * 100); $("shSpeedVal").textContent = Math.round(S.shader.speed * 100);
  $("shScale").value = Math.round(S.shader.scale * 100); $("shScaleVal").textContent = Math.round(S.shader.scale * 100);
  $("shColorBias").value = Math.round(S.shader.colorBias * 100); $("shColorBiasVal").textContent = Math.round(S.shader.colorBias * 100);
  if (S.shader.on && typeof initGL === "function") initGL();
}
```

**IMPORTANT:** do not hand-edit the corresponding generated block inside `elastic-morph.html` (between the `/* @BUILD-INJECT-V58 */` marker and `/* ---- boot ---- */`) — it is fully regenerated from `src/inject-v93.js` by the next step and any direct edit there is silently discarded.

- [ ] **Step 6: Rebuild so the edited `src/inject-v93.js` is merged into `elastic-morph.html`**

Run: `node build.js`
Expected output: `✓ Merged src/inject-v58.js + … (v113)`

- [ ] **Step 7: Implement — project load clamp + slider sync (old saves without these fields)**

At `elastic-morph.html:8907-8916`, replace:

```js
  if (o.shader) {
    Object.assign(S.shader, o.shader);
    S.shader.opacity = clamp01(S.shader.opacity);
    S.shader.intensity = clamp01(S.shader.intensity);
    if (!SHADER_STYLE_ID.hasOwnProperty(S.shader.style)) S.shader.style = "fluid";
    $("shOn").checked = !!S.shader.on;
    $("shStyle").value = S.shader.style; $("shBlend").value = S.shader.blend;
    $("shInt").value = Math.round(S.shader.intensity * 100); $("shIntVal").textContent = Math.round(S.shader.intensity * 100);
    $("shOp").value = Math.round(S.shader.opacity * 100); $("shOpVal").textContent = Math.round(S.shader.opacity * 100);
    if (S.shader.on) initGL();
  }
```

with:

```js
  if (o.shader) {
    Object.assign(S.shader, o.shader);
    S.shader.opacity = clamp01(S.shader.opacity);
    S.shader.intensity = clamp01(S.shader.intensity);
    S.shader.speed = fbClamp(S.shader.speed, 0.2, 3.0, 1);
    S.shader.scale = fbClamp(S.shader.scale, 0.5, 2.5, 1);
    S.shader.colorBias = fbClamp(S.shader.colorBias, -0.8, 0.8, 0);
    if (!SHADER_STYLE_ID.hasOwnProperty(S.shader.style)) S.shader.style = "fluid";
    $("shOn").checked = !!S.shader.on;
    $("shStyle").value = S.shader.style; $("shBlend").value = S.shader.blend;
    $("shInt").value = Math.round(S.shader.intensity * 100); $("shIntVal").textContent = Math.round(S.shader.intensity * 100);
    $("shOp").value = Math.round(S.shader.opacity * 100); $("shOpVal").textContent = Math.round(S.shader.opacity * 100);
    $("shSpeed").value = Math.round(S.shader.speed * 100); $("shSpeedVal").textContent = Math.round(S.shader.speed * 100);
    $("shScale").value = Math.round(S.shader.scale * 100); $("shScaleVal").textContent = Math.round(S.shader.scale * 100);
    $("shColorBias").value = Math.round(S.shader.colorBias * 100); $("shColorBiasVal").textContent = Math.round(S.shader.colorBias * 100);
    if (S.shader.on) initGL();
  }
```

- [ ] **Step 8: Run the build and tests to verify everything passes**

Run: `npm run ci`
Expected: all assertions print `✓`, including all 9 new ones from Task 1 + Task 2. Final line: `<N> passed, 0 failed`.

- [ ] **Step 9: Commit**

```bash
git add elastic-morph.html src/inject-v93.js test.js
git commit -m "feat: wire Speed/Scale/Color Bias sliders into the Shader Engine panel

Adds the 3 slider rows, buildShader() listeners, syncShaderUI() sync
(edited in its true source, src/inject-v93.js, then rebuilt), and a
load-time clamp so old saved projects without these fields fall back
to sane defaults instead of undefined.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after both tasks)

Not covered by `test.js` (it only does static source assertions, no real WebGL
execution) — verify visually once both tasks are done:

1. Open `elastic-morph.html` locally (or the deployed app), load the demo track, enable the Shader Engine, pick any style.
2. Drag **Speed** to 300% — the pattern should visibly animate faster (and to 20% — visibly slower) than at 100%.
3. Drag **Scale** to 250% — the pattern should visibly zoom in (and to 50% — zoom out) relative to 100%.
4. Drag **Color Bias** to +80 — colors should look more saturated/punchy; to -80 — colors should pull toward grayscale; at 0 — identical to before this feature existed.
5. Switch styles while all three sliders are off-default — confirm the effect holds across at least 3 different styles (e.g. `fluid`, `tunnel`, `hypercube`), since the change is meant to be global.
6. Save a project, reload the page, load that project back — confirm the 3 sliders show the values you set (not reset to default).
