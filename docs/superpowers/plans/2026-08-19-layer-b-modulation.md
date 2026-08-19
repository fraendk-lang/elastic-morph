# Layer B Modulation (Opacity + Scale LFO) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Layer B's Opacity and Scale params each an independent LFO (rate/depth/shape), the two params that currently have zero modulation, following the same dt-driven deterministic-accumulator pattern already used for `spin`/`hueDrift`.

**Architecture:** All target code (`S.layerB` defaults, `drawLayerB`, the Layer B panel HTML, its sync/wiring JS, and the project-load fallback block) lives in the static (pre-`@BUILD-INJECT-V58`-marker) region of `elastic-morph.html` — confirmed via `grep` (marker at line 8592, all target lines below 6900). Direct HTML edits, no `node build.js` involved.

**Tech Stack:** Vanilla JS, Canvas 2D, the existing zero-dependency test harness (`test.js`, via `node test.js`).

## Global Constraints

- Every code change must keep `node test.js` at 100% pass.
- `depth: 0` is the default for both new LFOs — existing presets/projects that don't specify `opLfo`/`scaleLfo` must render pixel-identical to before this change (no behavior change until a user turns the depth up).
- Rate range: 0.05–4 Hz, slider 0–100 maps linearly: `hz = 0.05 + (slider/100) * 3.95`.
- Shapes: `"sine" | "triangle" | "square"` only (no other values are valid).
- **Do not use `clamp01`** for the opacity formula — it exists only as a `const` local to a different function (`elastic-morph.html:6498`, scoped inside a project-load function) and is not accessible from `drawLayerB`. Inline the clamp instead: `Math.max(0, Math.min(1, ...))`.
- Don't touch `pulse`/`spin`/`sway`/`hueDrift` — those already have their own modulation and are out of scope for this plan.

---

### Task 1: LFO helper, state, draw logic, UI, and persistence

**Files:**
- Modify: `elastic-morph.html:2480-2481` (`S.layerB` defaults)
- Modify: `elastic-morph.html:5008` (add `lfoWave` helper near `LAYERB_TYPES`)
- Modify: `elastic-morph.html:5056-5075` (`drawLayerB` — accumulators, opacity, scale)
- Modify: `elastic-morph.html:1832-1838` (Layer B panel HTML — two new sections)
- Modify: `elastic-morph.html:6691-6705` (project-load fallback + UI sync)
- Modify: `elastic-morph.html:6820-6824` (event listener wiring)
- Test: `test.js`

**Interfaces:**
- Produces: `function lfoWave(shape, phase)` — takes a shape string and a phase in cycles (any real number, wraps internally), returns a value in `[-1, 1]`.
- Produces: `S.layerB.opLfo` / `S.layerB.scaleLfo` — `{ rate: number (Hz), depth: number (0-1), shape: "sine"|"triangle"|"square" }`.
- Produces: `S.layerB._opPhase` / `S.layerB._scPhase` — internal phase accumulators, same convention as the existing `_spin`/`_hue`.

- [ ] **Step 1: Add the failing test assertions**

Open `test.js`, find the end of the file (search for `#lbBlend and #shBlend have the same option count`):

```js
ok("#lbBlend and #shBlend have the same option count", (lbBlendBlock.match(/<option/g) || []).length === 9 &&
  (shBlendBlock.match(/<option/g) || []).length === 9);

/* ---------------- summary ---------------- */
```

Insert a new section immediately after that assertion and before `/* ---------------- summary ---------------- */`:

```js

/* ---------------- Layer B modulation ---------------- */
section("Layer B modulation");
ok("function lfoWave defined", script.includes("function lfoWave("));
try {
  const { lfoWave } = loadFns(["lfoWave"]);
  ok("lfoWave sine at phase 0 is 0", Math.abs(lfoWave("sine", 0)) < 1e-9);
  ok("lfoWave sine at phase 0.25 is 1", Math.abs(lfoWave("sine", 0.25) - 1) < 1e-9);
  ok("lfoWave square at phase 0 is 1", lfoWave("square", 0) === 1);
  ok("lfoWave square at phase 0.6 is -1", lfoWave("square", 0.6) === -1);
  ok("lfoWave triangle at phase 0 is -1", Math.abs(lfoWave("triangle", 0) - (-1)) < 1e-9);
  ok("lfoWave triangle at phase 0.5 is 1", Math.abs(lfoWave("triangle", 0.5) - 1) < 1e-9);
  ok("lfoWave wraps phase >1 the same as phase %1", lfoWave("sine", 1.25) === lfoWave("sine", 0.25));
} catch (e) {
  ok("lfoWave sine at phase 0 is 0", false, e.message);
  ok("lfoWave sine at phase 0.25 is 1", false);
  ok("lfoWave square at phase 0 is 1", false);
  ok("lfoWave square at phase 0.6 is -1", false);
  ok("lfoWave triangle at phase 0 is -1", false);
  ok("lfoWave triangle at phase 0.5 is 1", false);
  ok("lfoWave wraps phase >1 the same as phase %1", false);
}
ok("S.layerB has opLfo default with depth 0", /opLfo:\s*\{\s*rate:\s*0\.3,\s*depth:\s*0,\s*shape:\s*"sine"\s*\}/.test(script));
ok("S.layerB has scaleLfo default with depth 0", /scaleLfo:\s*\{\s*rate:\s*0\.3,\s*depth:\s*0,\s*shape:\s*"sine"\s*\}/.test(script));
ok("drawLayerB does not use clamp01 (out of scope)", (() => {
  const fn = extractFn("drawLayerB");
  return fn && !fn.includes("clamp01(");
})());
["lbOpLfoRate", "lbOpLfoDepth", "lbOpLfoShape", "lbScLfoRate", "lbScLfoDepth", "lbScLfoShape"].forEach(id =>
  ok("control exists: " + id, html.includes('id="' + id + '"')));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all new checks in the "Layer B modulation" section print `✗` (the `try` branch's checks fail via the `catch`, since `lfoWave` doesn't exist yet).

- [ ] **Step 3: Add the `lfoWave` helper**

In `elastic-morph.html`, find (around line 5008, right before `const LAYERB_TYPES = [`):

```js
const LAYERB_TYPES = [
```

Replace with:

```js
function lfoWave(shape, phase) {
  const p = phase - Math.floor(phase);   // 0..1
  if (shape === "square") return p < 0.5 ? 1 : -1;
  if (shape === "triangle") return p < 0.5 ? (4 * p - 1) : (3 - 4 * p);
  return Math.sin(p * Math.PI * 2);      // sine (default)
}
const LAYERB_TYPES = [
```

- [ ] **Step 4: Add `opLfo`/`scaleLfo` to `S.layerB` defaults**

Find (line 2480):

```js
  layerB: { on: false, type: "spectrumRing", opacity: 0.8, blend: "lighter", color: "dna", scale: 1,
            pulse: 1, spin: 0, sway: 1, hueDrift: 0, mirror: "off", _spin: 0, _hue: 0 },   // v43: modulation
```

Replace with:

```js
  layerB: { on: false, type: "spectrumRing", opacity: 0.8, blend: "lighter", color: "dna", scale: 1,
            pulse: 1, spin: 0, sway: 1, hueDrift: 0, mirror: "off", _spin: 0, _hue: 0,   // v43: modulation
            opLfo: { rate: 0.3, depth: 0, shape: "sine" }, scaleLfo: { rate: 0.3, depth: 0, shape: "sine" },
            _opPhase: 0, _scPhase: 0 },
```

- [ ] **Step 5: Wire the accumulators and apply the LFOs in `drawLayerB`**

Find (around line 5056):

```js
function drawLayerB(W, H, hue, dt) {
  const LB = S.layerB;
  if (!LB.on) return;
  const cx = W / 2, cy = H / 2, mn = Math.min(W, H), sc = LB.scale;
  // v43: continuous modulation accumulators (dt-driven → deterministic in export)
  if (!S.frozen) { LB._spin = (LB._spin || 0) + dt * LB.spin * 1.4; LB._hue = (LB._hue || 0) + dt * LB.hueDrift * 60; }
  const colr = (t, a) => {
    if (LB.color === "white") return `rgba(255,255,255,${a})`;
    const h = (LB.color === "rainbow" ? (t * 300 + S.time * 30) : (hue + t * 50)) + (LB._hue || 0);
    return `hsla(${((h % 360) + 360) % 360}, 82%, 63%, ${a})`;
  };
  ctx.save();
  ctx.globalAlpha = LB.opacity;
  ctx.globalCompositeOperation = LB.blend;
```

Replace with:

```js
function drawLayerB(W, H, hue, dt) {
  const LB = S.layerB;
  if (!LB.on) return;
  const cx = W / 2, cy = H / 2, mn = Math.min(W, H);
  // v43: continuous modulation accumulators (dt-driven → deterministic in export)
  if (!S.frozen) {
    LB._spin = (LB._spin || 0) + dt * LB.spin * 1.4;
    LB._hue = (LB._hue || 0) + dt * LB.hueDrift * 60;
    LB._opPhase = (LB._opPhase || 0) + dt * LB.opLfo.rate;
    LB._scPhase = (LB._scPhase || 0) + dt * LB.scaleLfo.rate;
  }
  const sc = LB.scale * (1 + LB.scaleLfo.depth * lfoWave(LB.scaleLfo.shape, LB._scPhase || 0));
  const colr = (t, a) => {
    if (LB.color === "white") return `rgba(255,255,255,${a})`;
    const h = (LB.color === "rainbow" ? (t * 300 + S.time * 30) : (hue + t * 50)) + (LB._hue || 0);
    return `hsla(${((h % 360) + 360) % 360}, 82%, 63%, ${a})`;
  };
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, LB.opacity * (1 + LB.opLfo.depth * lfoWave(LB.opLfo.shape, LB._opPhase || 0))));
  ctx.globalCompositeOperation = LB.blend;
```

- [ ] **Step 6: Add the two new UI sections**

Find (around line 1832):

```html
    <div class="slider-row">
      <label>Hue Drift <span class="val" id="lbHueVal">0</span></label>
      <input type="range" id="lbHue" min="0" max="100" value="0">
    </div>
    <select id="lbMirror" class="pm-select" style="margin-top:8px">
```

Replace with:

```html
    <div class="slider-row">
      <label>Hue Drift <span class="val" id="lbHueVal">0</span></label>
      <input type="range" id="lbHue" min="0" max="100" value="0">
    </div>
    <div class="divider"></div>
    <div class="slider-row">
      <label>Opacity LFO Rate <span class="val" id="lbOpLfoRateVal">0.30 Hz</span></label>
      <input type="range" id="lbOpLfoRate" min="0" max="100" value="6">
    </div>
    <div class="slider-row">
      <label>Opacity LFO Depth <span class="val" id="lbOpLfoDepthVal">0</span></label>
      <input type="range" id="lbOpLfoDepth" min="0" max="100" value="0">
    </div>
    <select id="lbOpLfoShape" class="pm-select" style="margin-top:8px">
      <option value="sine" selected>Opacity LFO: Sine</option>
      <option value="triangle">Opacity LFO: Triangle</option>
      <option value="square">Opacity LFO: Square</option>
    </select>
    <div class="slider-row" style="margin-top:10px">
      <label>Scale LFO Rate <span class="val" id="lbScLfoRateVal">0.30 Hz</span></label>
      <input type="range" id="lbScLfoRate" min="0" max="100" value="6">
    </div>
    <div class="slider-row">
      <label>Scale LFO Depth <span class="val" id="lbScLfoDepthVal">0</span></label>
      <input type="range" id="lbScLfoDepth" min="0" max="100" value="0">
    </div>
    <select id="lbScLfoShape" class="pm-select" style="margin-top:8px">
      <option value="sine" selected>Scale LFO: Sine</option>
      <option value="triangle">Scale LFO: Triangle</option>
      <option value="square">Scale LFO: Square</option>
    </select>
    <select id="lbMirror" class="pm-select" style="margin-top:8px">
```

(Note: `value="6"` on the two rate sliders corresponds to `0.05 + 6/100*3.95 ≈ 0.30 Hz`, matching the `rate: 0.3` default.)

- [ ] **Step 7: Project-load fallback + UI sync**

Find (around line 6691):

```js
  S.layerB.hueDrift = lb.hueDrift != null ? +lb.hueDrift : 0;
  S.layerB.mirror = ["off", "h", "quad"].includes(lb.mirror) ? lb.mirror : "off";
  S.layerB._spin = 0; S.layerB._hue = 0;
  $("lbOn").checked = !!S.layerB.on;
  $("lbType").value = S.layerB.type; $("lbBlend").value = S.layerB.blend; $("lbColor").value = S.layerB.color;
  $("lbOp").value = Math.round(S.layerB.opacity * 100); $("lbOpVal").textContent = Math.round(S.layerB.opacity * 100);
  $("lbScale").value = Math.round(S.layerB.scale * 100); $("lbScaleVal").textContent = Math.round(S.layerB.scale * 100);
  $("lbPulse").value = Math.round(S.layerB.pulse * 100); $("lbPulseVal").textContent = Math.round(S.layerB.pulse * 100);
  $("lbSpin").value = Math.round(S.layerB.spin * 100); $("lbSpinVal").textContent = Math.round(S.layerB.spin * 100);
  $("lbSway").value = Math.round(S.layerB.sway * 100); $("lbSwayVal").textContent = Math.round(S.layerB.sway * 100);
  $("lbHue").value = Math.round(S.layerB.hueDrift * 100); $("lbHueVal").textContent = Math.round(S.layerB.hueDrift * 100);
  $("lbMirror").value = S.layerB.mirror;
```

Replace with:

```js
  S.layerB.hueDrift = lb.hueDrift != null ? +lb.hueDrift : 0;
  S.layerB.mirror = ["off", "h", "quad"].includes(lb.mirror) ? lb.mirror : "off";
  S.layerB.opLfo = {
    rate: lb.opLfo && lb.opLfo.rate != null ? +lb.opLfo.rate : 0.3,
    depth: lb.opLfo && lb.opLfo.depth != null ? +lb.opLfo.depth : 0,
    shape: lb.opLfo && ["sine", "triangle", "square"].includes(lb.opLfo.shape) ? lb.opLfo.shape : "sine"
  };
  S.layerB.scaleLfo = {
    rate: lb.scaleLfo && lb.scaleLfo.rate != null ? +lb.scaleLfo.rate : 0.3,
    depth: lb.scaleLfo && lb.scaleLfo.depth != null ? +lb.scaleLfo.depth : 0,
    shape: lb.scaleLfo && ["sine", "triangle", "square"].includes(lb.scaleLfo.shape) ? lb.scaleLfo.shape : "sine"
  };
  S.layerB._spin = 0; S.layerB._hue = 0; S.layerB._opPhase = 0; S.layerB._scPhase = 0;
  $("lbOn").checked = !!S.layerB.on;
  $("lbType").value = S.layerB.type; $("lbBlend").value = S.layerB.blend; $("lbColor").value = S.layerB.color;
  $("lbOp").value = Math.round(S.layerB.opacity * 100); $("lbOpVal").textContent = Math.round(S.layerB.opacity * 100);
  $("lbScale").value = Math.round(S.layerB.scale * 100); $("lbScaleVal").textContent = Math.round(S.layerB.scale * 100);
  $("lbPulse").value = Math.round(S.layerB.pulse * 100); $("lbPulseVal").textContent = Math.round(S.layerB.pulse * 100);
  $("lbSpin").value = Math.round(S.layerB.spin * 100); $("lbSpinVal").textContent = Math.round(S.layerB.spin * 100);
  $("lbSway").value = Math.round(S.layerB.sway * 100); $("lbSwayVal").textContent = Math.round(S.layerB.sway * 100);
  $("lbHue").value = Math.round(S.layerB.hueDrift * 100); $("lbHueVal").textContent = Math.round(S.layerB.hueDrift * 100);
  $("lbOpLfoRate").value = Math.round((S.layerB.opLfo.rate - 0.05) / 3.95 * 100);
  $("lbOpLfoRateVal").textContent = S.layerB.opLfo.rate.toFixed(2) + " Hz";
  $("lbOpLfoDepth").value = Math.round(S.layerB.opLfo.depth * 100);
  $("lbOpLfoDepthVal").textContent = Math.round(S.layerB.opLfo.depth * 100);
  $("lbOpLfoShape").value = S.layerB.opLfo.shape;
  $("lbScLfoRate").value = Math.round((S.layerB.scaleLfo.rate - 0.05) / 3.95 * 100);
  $("lbScLfoRateVal").textContent = S.layerB.scaleLfo.rate.toFixed(2) + " Hz";
  $("lbScLfoDepth").value = Math.round(S.layerB.scaleLfo.depth * 100);
  $("lbScLfoDepthVal").textContent = Math.round(S.layerB.scaleLfo.depth * 100);
  $("lbScLfoShape").value = S.layerB.scaleLfo.shape;
  $("lbMirror").value = S.layerB.mirror;
```

- [ ] **Step 8: Event listener wiring**

Find (around line 6820):

```js
  $("lbSway").addEventListener("input", e => { S.layerB.sway = e.target.value / 100; $("lbSwayVal").textContent = e.target.value; });
  $("lbHue").addEventListener("input", e => { S.layerB.hueDrift = e.target.value / 100; $("lbHueVal").textContent = e.target.value; });
  $("lbMirror").addEventListener("change", e => S.layerB.mirror = e.target.value);
```

Replace with:

```js
  $("lbSway").addEventListener("input", e => { S.layerB.sway = e.target.value / 100; $("lbSwayVal").textContent = e.target.value; });
  $("lbHue").addEventListener("input", e => { S.layerB.hueDrift = e.target.value / 100; $("lbHueVal").textContent = e.target.value; });
  $("lbOpLfoRate").addEventListener("input", e => {
    const hz = 0.05 + (e.target.value / 100) * 3.95;
    S.layerB.opLfo.rate = hz;
    $("lbOpLfoRateVal").textContent = hz.toFixed(2) + " Hz";
  });
  $("lbOpLfoDepth").addEventListener("input", e => { S.layerB.opLfo.depth = e.target.value / 100; $("lbOpLfoDepthVal").textContent = e.target.value; });
  $("lbOpLfoShape").addEventListener("change", e => S.layerB.opLfo.shape = e.target.value);
  $("lbScLfoRate").addEventListener("input", e => {
    const hz = 0.05 + (e.target.value / 100) * 3.95;
    S.layerB.scaleLfo.rate = hz;
    $("lbScLfoRateVal").textContent = hz.toFixed(2) + " Hz";
  });
  $("lbScLfoDepth").addEventListener("input", e => { S.layerB.scaleLfo.depth = e.target.value / 100; $("lbScLfoDepthVal").textContent = e.target.value; });
  $("lbScLfoShape").addEventListener("change", e => S.layerB.scaleLfo.shape = e.target.value);
  $("lbMirror").addEventListener("change", e => S.layerB.mirror = e.target.value);
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `node test.js`
Expected: `0 failed`, all "Layer B modulation" checks show `✓`.

- [ ] **Step 10: Manual visual check**

Run: `npm start`, open `elastic-morph.html`, start the demo track, enable Layer B. With both LFO depths at 0 (default), confirm the overlay looks exactly as it did before this change (no flicker/pulsing). Then:
1. Raise Opacity LFO Depth to ~80% with Sine shape — confirm the overlay visibly fades in and out smoothly.
2. Switch shape to Square — confirm it now hard-cuts between two opacity levels instead of fading.
3. Switch shape to Triangle — confirm a linear ramp up/down instead of a curve.
4. Raise Rate — confirm the pulsing speeds up.
5. Repeat for Scale LFO Depth — confirm the overlay visibly grows/shrinks.
6. Confirm both LFOs can run simultaneously with different rates/shapes without interfering with each other.

- [ ] **Step 11: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "Add independent LFO modulation to Layer B opacity and scale

Rate/depth/shape (sine/triangle/square) per param, same dt-driven
deterministic-accumulator pattern already used for spin/hueDrift.
Depth defaults to 0 so existing presets/projects render unchanged."
```

---

## Final Verification

- [ ] `node test.js` — expect `0 failed`.
- [ ] `git status` clean after the commit.
- [ ] `git diff HEAD~1 -- elastic-morph.html` — confirm the diff only touches the 6 locations listed in Task 1's Files section, nothing else.
