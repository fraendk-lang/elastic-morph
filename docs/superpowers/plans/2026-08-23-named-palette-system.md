# Named Palette System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-facing "Named Gradient" palette mode (6 curated 2-anchor-color palettes,
selectable from a dropdown) alongside the existing Custom-HSL palette panel, driving real
2-color mixing across all 12 Shader Engine styles and Layer B's `dna` color mode.

**Architecture:** `S.palette` gains `mode` ("hsl" default | "named") and `namedId` fields. A new
top-level `NAMED_PALETTES` constant holds 6 `{id, name, a, b}` entries (RGB 0-1 anchor pairs).
When `mode === "named"` and `on` is true: the Shader Engine receives the chosen anchors as new
`uPalA`/`uPalB`/`uPalOn` uniforms and every style's color math branches to `mix(uPalA, uPalB, t)`
instead of its existing hue math; Layer B's `colr()` helper branches the same way in RGB space.
When the mode is off or set to "hsl", every code path falls through to today's exact behavior —
zero regression risk for the 8 existing hue-only styles' Custom-HSL behavior.

**Tech Stack:** Vanilla JS, WebGL1 GLSL (fragment shader template literal), Canvas2D. Single-file
app (`elastic-morph.html`) with a zero-dependency text-based test harness (`test.js`).

## Global Constraints

- All edits in this plan land in the **static (non-generated) region** of `elastic-morph.html`
  — before the `/* @BUILD-INJECT-V58 */` marker (currently line 8778). None of this plan's code
  goes into `src/inject-*.js`.
- Every new/changed code path must leave existing behavior byte-for-byte identical when
  `S.palette.mode !== "named"` or `S.palette.on` is false — this is a purely additive feature.
- Follow the existing UI convention: mode-like choices in this codebase use `<select>` dropdowns
  (see `#lbColor`, `#lbBlend`), not radio buttons. The design spec's "Radio-/Segment-Switch"
  wording is implemented as a `<select>` to match.
- Test-first: every task adds its assertions to `test.js` before touching `elastic-morph.html`,
  confirms they fail, then implements.
- Before the final commit: `node build.js && git diff --stat elastic-morph.html` must show no
  diff (proves nothing leaked into the generated region), then `npm run ci` must pass.
- Source spec: `docs/superpowers/specs/2026-08-23-named-palette-system-design.md`.

---

### Task 1: Data model — `NAMED_PALETTES` constant + `S.palette` defaults

**Files:**
- Modify: `elastic-morph.html:2411-2413` (insert `NAMED_PALETTES` before `/* ---------------- App state ---------------- */`)
- Modify: `elastic-morph.html:2457` (`S.palette` initial state)
- Modify: `elastic-morph.html:8198` (`applyTemplate` palette-merge defaults)
- Test: `test.js` (new section, appended at end of file)

**Interfaces:**
- Produces: `NAMED_PALETTES` — `Array<{id: string, name: string, a: [number,number,number], b: [number,number,number]}>`, exactly 6 entries with ids `toxic`, `sunset`, `deepsea`, `cherry`, `solar`, `void`. `S.palette.mode` — `"hsl" | "named"`, default `"hsl"`. `S.palette.namedId` — string, default `"toxic"`.
- Consumes: nothing (foundational task).

- [ ] **Step 1: Write the failing tests**

Append to `test.js`:

```js
/* ---------------- Named Palette System ---------------- */
section("Named Palette System — data model");

ok("NAMED_PALETTES defined with exactly 6 entries (toxic/sunset/deepsea/cherry/solar/void)", (() => {
  const m = script.match(/const NAMED_PALETTES = \[([\s\S]*?)\n\];/);
  if (!m) return false;
  const ids = [...m[1].matchAll(/id:\s*"(\w+)"/g)].map(x => x[1]);
  const want = ["toxic", "sunset", "deepsea", "cherry", "solar", "void"];
  return ids.length === 6 && want.every(id => ids.includes(id));
})());

ok("S.palette initial state has mode/namedId defaults", script.includes(
  'palette: { on: false, hue: 280, spread: 50, sat: 85, mode: "hsl", namedId: "toxic" },'
));

ok("applyTemplate palette-merge defaults include mode/namedId", script.includes(
  'Object.assign(S.palette, { on: false, hue: 280, spread: 50, sat: 85, mode: "hsl", namedId: "toxic" }, tpl.palette);'
));
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js`
Expected: the 3 new assertions under "Named Palette System — data model" show `✗`, all prior sections still show only pre-existing pass/fail state.

- [ ] **Step 3: Implement**

In `elastic-morph.html`, insert before line 2413 (`/* ---------------- App state ---------------- */`):

```js
const NAMED_PALETTES = [
  { id: "toxic",   name: "Toxic",    a: [0.05, 0.95, 0.15], b: [0.85, 0.05, 0.75] },
  { id: "sunset",  name: "Sunset",   a: [0.95, 0.45, 0.05], b: [0.45, 0.10, 0.75] },
  { id: "deepsea", name: "Deep Sea", a: [0.00, 0.70, 0.90], b: [0.05, 0.10, 0.55] },
  { id: "cherry",  name: "Cherry",   a: [0.95, 0.10, 0.45], b: [0.45, 0.02, 0.10] },
  { id: "solar",   name: "Solar",    a: [0.95, 0.80, 0.10], b: [0.90, 0.30, 0.05] },
  { id: "void",    name: "Void",     a: [0.35, 0.10, 0.75], b: [0.04, 0.03, 0.10] },
];
```

Change line 2457 from:
```js
  palette: { on: false, hue: 280, spread: 50, sat: 85 },
```
to:
```js
  palette: { on: false, hue: 280, spread: 50, sat: 85, mode: "hsl", namedId: "toxic" },
```

Change line 8198 from:
```js
  if (tpl.palette) Object.assign(S.palette, { on: false, hue: 280, spread: 50, sat: 85 }, tpl.palette);
```
to:
```js
  if (tpl.palette) Object.assign(S.palette, { on: false, hue: 280, spread: 50, sat: 85, mode: "hsl", namedId: "toxic" }, tpl.palette);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js`
Expected: all 3 new assertions show `✓`, `fail` count unchanged from before this task except these 3.

- [ ] **Step 5: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add NAMED_PALETTES data + S.palette mode/namedId fields"
```

---

### Task 2: Palette panel UI — mode select + named-palette dropdown

**Files:**
- Modify: `elastic-morph.html:1393-1416` (HTML panel)
- Modify: `elastic-morph.html:7536-7557` (`drawPalettePreview`, `syncPaletteUI`, event listeners)
- Test: `test.js`

**Interfaces:**
- Consumes: `NAMED_PALETTES`, `S.palette.mode`, `S.palette.namedId` (Task 1).
- Produces: DOM elements `#palMode` (select, values `hsl`/`named`), `#palNamed` (select, static `<option>`s matching `NAMED_PALETTES`' 6 ids), `#palHslRow`/`#palNamedRow` (wrapper divs toggled by mode). `syncPaletteUI()` and `drawPalettePreview()` remain the entry points other code calls (unchanged names/signatures).

- [ ] **Step 1: Write the failing tests**

Append to `test.js`:

```js
section("Named Palette System — UI panel");

ok("palette mode select and named-palette select exist, with a static <option> per NAMED_PALETTES entry", (() => {
  const m = script.match(/const NAMED_PALETTES = \[([\s\S]*?)\n\];/);
  const ids = m ? [...m[1].matchAll(/id:\s*"(\w+)"/g)].map(x => x[1]) : [];
  const selectBlock = (html.match(/<select id="palNamed"[^>]*>([\s\S]*?)<\/select>/) || [])[1] || "";
  const hasOptions = ids.length > 0 && ids.every(id => selectBlock.includes('<option value="' + id + '">'));
  return html.includes('id="palMode"') && html.includes('id="palNamed"') && hasOptions;
})());

ok("palMode/palNamed listeners registered", (() => {
  return script.includes('$("palMode").addEventListener("change"')
    && script.includes('$("palNamed").addEventListener("change"');
})());

ok("drawPalettePreview renders the named-gradient branch", (() => {
  const fn = extractFn("drawPalettePreview");
  return !!fn && fn.includes('S.palette.mode === "named"');
})());

ok("syncPaletteUI toggles palHslRow/palNamedRow and syncs #palNamed's selected value", (() => {
  const fn = extractFn("syncPaletteUI");
  return !!fn
    && fn.includes('$("palHslRow")')
    && fn.includes('$("palNamedRow")')
    && fn.includes('$("palNamed")');
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js`
Expected: all 4 new assertions under "Named Palette System — UI panel" show `✗`.

- [ ] **Step 3: Implement — HTML panel**

Replace `elastic-morph.html:1393-1416`:

```html
      <h3>Palette</h3>
      <div class="text-opts" style="max-width:440px">
        <div class="opt"><span>Custom</span>
          <label class="check" style="flex:1"><input type="checkbox" id="palOn"> eigene Farben statt Preset-Gradient</label>
        </div>
        <div class="opt"><span>Modus</span>
          <select id="palMode" class="pm-select" style="flex:1">
            <option value="hsl" selected>Eigene Mischung</option>
            <option value="named">Vordefiniert</option>
          </select>
        </div>
        <div id="palHslRow">
        <div class="opt"><span>Farbton</span>
          <input type="range" id="palHue" min="0" max="360" value="280">
          <span class="val" id="palHueVal">280°</span>
        </div>
        <div class="opt"><span>Spreizung</span>
          <input type="range" id="palSpread" min="0" max="180" value="50">
          <span class="val" id="palSpreadVal">50°</span>
        </div>
        <div class="opt"><span>Sättigung</span>
          <input type="range" id="palSat" min="0" max="100" value="85">
          <span class="val" id="palSatVal">85%</span>
        </div>
        </div>
        <div id="palNamedRow" style="display:none">
        <div class="opt"><span>Palette</span>
          <select id="palNamed" class="pm-select" style="flex:1">
            <option value="toxic">Toxic</option>
            <option value="sunset">Sunset</option>
            <option value="deepsea">Deep Sea</option>
            <option value="cherry">Cherry</option>
            <option value="solar">Solar</option>
            <option value="void">Void</option>
          </select>
        </div>
        </div>
        <div class="opt"><span>Vorschau</span>
          <canvas id="palPreview" width="200" height="20" style="flex:1;border-radius:6px;border:1px solid var(--line);height:20px"></canvas>
        </div>
        <div class="opt"><span></span>
          <button class="btn" id="palFromCover" style="flex:1">Palette aus Cover-Bild</button>
        </div>
      </div>
```

- [ ] **Step 4: Implement — preview, sync, listeners**

Replace `elastic-morph.html:7536-7557`:

```js
/* v34: custom palette */
function drawPalettePreview() {
  const cv = $("palPreview"); if (!cv) return;
  const c = cv.getContext("2d"), w = cv.width, h = cv.height;
  if (S.palette.mode === "named") {
    const pal = NAMED_PALETTES.find(p => p.id === S.palette.namedId) || NAMED_PALETTES[0];
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, `rgb(${Math.round(pal.a[0]*255)},${Math.round(pal.a[1]*255)},${Math.round(pal.a[2]*255)})`);
    g.addColorStop(1, `rgb(${Math.round(pal.b[0]*255)},${Math.round(pal.b[1]*255)},${Math.round(pal.b[2]*255)})`);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  } else {
    const g = c.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 6; i++) {
      const f = i / 6, hh = (S.palette.hue + f * S.palette.spread) % 360;
      g.addColorStop(f, `hsl(${hh}, ${S.palette.sat}%, 55%)`);
    }
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
  if (!S.palette.on) { c.fillStyle = "rgba(5,5,9,0.6)"; c.fillRect(0, 0, w, h); }
}
function syncPaletteUI() {
  $("palOn").checked = S.palette.on;
  $("palMode").value = S.palette.mode;
  $("palHue").value = Math.round(S.palette.hue); $("palHueVal").textContent = Math.round(S.palette.hue) + "°";
  $("palSpread").value = Math.round(S.palette.spread); $("palSpreadVal").textContent = Math.round(S.palette.spread) + "°";
  $("palSat").value = Math.round(S.palette.sat); $("palSatVal").textContent = Math.round(S.palette.sat) + "%";
  $("palNamed").value = S.palette.namedId;
  $("palHslRow").style.display = S.palette.mode === "named" ? "none" : "";
  $("palNamedRow").style.display = S.palette.mode === "named" ? "" : "none";
  $("palFromCover").disabled = S.palette.mode === "named";
  drawPalettePreview();
}
$("palOn").addEventListener("change", e => { S.palette.on = e.target.checked; drawPalettePreview(); });
$("palMode").addEventListener("change", e => { S.palette.mode = e.target.value; syncPaletteUI(); });
$("palNamed").addEventListener("change", e => { S.palette.namedId = e.target.value; drawPalettePreview(); });
$("palHue").addEventListener("input", e => { S.palette.hue = +e.target.value; $("palHueVal").textContent = e.target.value + "°"; drawPalettePreview(); });
$("palSpread").addEventListener("input", e => { S.palette.spread = +e.target.value; $("palSpreadVal").textContent = e.target.value + "°"; drawPalettePreview(); });
$("palSat").addEventListener("input", e => { S.palette.sat = +e.target.value; $("palSatVal").textContent = e.target.value + "%"; drawPalettePreview(); });
```

`#palNamed`'s options are static HTML (Step 3), matching this codebase's existing convention for
other mode-select dropdowns (`#lbColor`, `#lbBlend`) — no dynamic option generation needed.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node test.js`
Expected: all 4 assertions from Step 1 show `✓`. Also re-check the pre-existing "every $(\"id\") resolves to an element" assertion (Static checks section) still shows `✓` — it will, since `#palMode`/`#palNamed`/`#palHslRow`/`#palNamedRow` are now both referenced and defined.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Named Gradient mode switch to Palette panel UI"
```

---

### Task 3: Persistence — `applyProject` load path

**Files:**
- Modify: `elastic-morph.html:6675-6679` (inside `applyProject(o, fromScene)`, line 6608)
- Test: `test.js`

**Interfaces:**
- Consumes: `S.palette.mode`/`namedId` (Task 1). `projectData()` (`elastic-morph.html:6568`) already spreads `S.palette` wholesale — no change needed there, verify only.
- Produces: nothing new consumed elsewhere; this task closes the save→load roundtrip.

- [ ] **Step 1: Write the failing test**

Append to `test.js`:

```js
section("Named Palette System — persistence");

ok("projectData() spreads S.palette wholesale (mode/namedId ride along for free)", script.includes(
  "palette: { ...S.palette },"
));

ok("applyProject restores palette.mode/namedId with safe defaults", (() => {
  const fn = extractFn("applyProject");
  return !!fn
    && fn.includes('S.palette.mode = pl.mode === "named" ? "named" : "hsl";')
    && fn.includes('S.palette.namedId = pl.namedId || "toxic";');
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js`
Expected: "projectData() spreads..." already shows `✓` (pre-existing code, confirms Global Constraint about `projectData` needing no change). "applyProject restores..." shows `✗`.

- [ ] **Step 3: Implement**

Change `elastic-morph.html:6676-6679` from:
```js
  S.palette.on = !!pl.on;
  S.palette.hue = pl.hue != null ? +pl.hue : 280;
  S.palette.spread = pl.spread != null ? +pl.spread : 50;
  S.palette.sat = pl.sat != null ? +pl.sat : 85;
```
to:
```js
  S.palette.on = !!pl.on;
  S.palette.hue = pl.hue != null ? +pl.hue : 280;
  S.palette.spread = pl.spread != null ? +pl.spread : 50;
  S.palette.sat = pl.sat != null ? +pl.sat : 85;
  S.palette.mode = pl.mode === "named" ? "named" : "hsl";
  S.palette.namedId = pl.namedId || "toxic";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js`
Expected: both assertions from Step 1 show `✓`.

- [ ] **Step 5: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: persist palette mode/namedId through save/load and scene banks"
```

---

### Task 4: Shader Engine — `uPalOn`/`uPalA`/`uPalB` uniforms + the 4 already-mixed styles

**Files:**
- Modify: `elastic-morph.html:3008-3015` (uniform declarations)
- Modify: `elastic-morph.html:3101-3223` (Aurora/Gyroid/SDF Blob/Feedback Fractal `mix()` calls)
- Modify: `elastic-morph.html:3324-3335` (`GL.loc` lookup)
- Modify: `elastic-morph.html:3368-3378` (per-frame uniform assignment, inside `renderShader`)
- Test: `test.js` (also rewrites the existing eye-catcher-palette array from the prior feature)

**Interfaces:**
- Consumes: `NAMED_PALETTES`, `S.palette.on`/`mode`/`namedId` (Task 1).
- Produces: GLSL uniforms `uPalOn` (float, 0/1), `uPalA`/`uPalB` (vec3) — consumed by Task 5's 8 styles too. `GL.loc.palOn`/`palA`/`palB` — WebGL uniform locations, same lookup pattern as `GL.loc.intensity`.

- [ ] **Step 1: Write the failing tests**

In `test.js`, locate the existing block (added by the prior eye-catcher-palette feature):

```js
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
```

Replace it with (adds the missing `raymarchStyle`/SDF Blob entry and updates the expected
substring for the new `uPalOn`-gated pattern):

```js
[
  ["auroraStyle", "vec3 auroraStyle(vec2 uv){", "auroraA", "auroraB"],
  ["gyroidStyle", "vec3 gyroidStyle(vec2 uv){", "gyroidA", "gyroidB"],
  ["raymarchStyle", "vec3 raymarchStyle(vec2 uv){", "hotA", "hotB"],
  ["feedbackStyle", "vec3 feedbackStyle(vec2 uv){", "feedbackA", "feedbackB"],
].forEach(([name, sig, a, b]) => {
  ok(name + " mixes uPalA/uPalB when uPalOn is active, falls back to its own anchors otherwise, still calls applyEyeCatcherFX", (() => {
    const fn = extractGlslFn(sig);
    return !!fn
      && fn.includes("mix(uPalOn > 0.5 ? uPalA : " + a + ", uPalOn > 0.5 ? uPalB : " + b)
      && fn.includes("applyEyeCatcherFX(col, uv)");
  })());
});
```

Then append a new section for the uniform plumbing:

```js
section("Named Palette System — shader uniforms");

ok("uPalOn/uPalA/uPalB uniforms declared in SHADER_FRAG", script.includes("uniform float uPalOn;")
  && script.includes("uniform vec3 uPalA;") && script.includes("uniform vec3 uPalB;"));

ok("GL.loc looks up palOn/palA/palB uniform locations", (() => {
  const m = script.match(/GL\.loc = \{([\s\S]*?)\};/);
  return !!m && /palOn:\s*gl\.getUniformLocation\(prog, "uPalOn"\)/.test(m[1])
    && /palA:\s*gl\.getUniformLocation\(prog, "uPalA"\)/.test(m[1])
    && /palB:\s*gl\.getUniformLocation\(prog, "uPalB"\)/.test(m[1]);
})());

ok("renderShader sets uPalOn/uPalA/uPalB from S.palette each frame", (() => {
  const fn = extractFn("renderShader");
  return !!fn
    && fn.includes('S.palette.mode === "named"')
    && fn.includes("gl.uniform1f(L.palOn,")
    && fn.includes("gl.uniform3f(L.palA,")
    && fn.includes("gl.uniform3f(L.palB,");
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js`
Expected: the rewritten 4-style array assertions show `✗` (old pattern no longer matches, new
one isn't implemented yet), the 3 new "shader uniforms" assertions show `✗`.

- [ ] **Step 3: Implement — uniform declaration**

Change `elastic-morph.html:3015` from:
```glsl
uniform float uIntensity;  // 0..1
```
to:
```glsl
uniform float uIntensity;  // 0..1
uniform float uPalOn;      // 1 when a Named Gradient palette is active
uniform vec3  uPalA;       // Named Gradient anchor colour A
uniform vec3  uPalB;       // Named Gradient anchor colour B
```

- [ ] **Step 4: Implement — the 4 already-mixed styles**

`auroraStyle`, change line 3119 from:
```glsl
  vec3 col = mix(auroraA, auroraB, mixT) * (curtain * (0.6 + uIntensity) * (1.0 + uLoud*1.5 + uBeat*0.5));
```
to:
```glsl
  vec3 col = mix(uPalOn > 0.5 ? uPalA : auroraA, uPalOn > 0.5 ? uPalB : auroraB, mixT) * (curtain * (0.6 + uIntensity) * (1.0 + uLoud*1.5 + uBeat*0.5));
```

`gyroidStyle`, change lines 3179-3180 from:
```glsl
  vec3 col = mix(gyroidA, gyroidB, mixT) * v;
  col += mix(gyroidB, gyroidA, mixT) * (pow(glow, 3.0)*0.6);   // bright cores, swapped anchors
```
to:
```glsl
  vec3 col = mix(uPalOn > 0.5 ? uPalA : gyroidA, uPalOn > 0.5 ? uPalB : gyroidB, mixT) * v;
  col += mix(uPalOn > 0.5 ? uPalB : gyroidB, uPalOn > 0.5 ? uPalA : gyroidA, mixT) * (pow(glow, 3.0)*0.6);   // bright cores, swapped anchors
```

`raymarchStyle`, change line 3205 from:
```glsl
  vec3 col = mix(hotA, hotB, mixT) * glowVal;
```
to:
```glsl
  vec3 col = mix(uPalOn > 0.5 ? uPalA : hotA, uPalOn > 0.5 ? uPalB : hotB, mixT) * glowVal;
```

`feedbackStyle`, change line 3220 from:
```glsl
  vec3 col = mix(feedbackA, feedbackB, mixT) * (pow(clamp(f,0.0,1.0), 1.15)*(0.65 + uLoud*0.65));
```
to:
```glsl
  vec3 col = mix(uPalOn > 0.5 ? uPalA : feedbackA, uPalOn > 0.5 ? uPalB : feedbackB, mixT) * (pow(clamp(f,0.0,1.0), 1.15)*(0.65 + uLoud*0.65));
```

- [ ] **Step 5: Implement — `GL.loc` lookup**

Change `elastic-morph.html:3334` from:
```js
      intensity: gl.getUniformLocation(prog, "uIntensity")
```
to:
```js
      intensity: gl.getUniformLocation(prog, "uIntensity"),
      palOn: gl.getUniformLocation(prog, "uPalOn"),
      palA: gl.getUniformLocation(prog, "uPalA"),
      palB: gl.getUniformLocation(prog, "uPalB")
```

- [ ] **Step 6: Implement — per-frame uniform assignment**

Change `elastic-morph.html:3377` from:
```js
  gl.uniform1f(L.intensity, SH.intensity);
```
to:
```js
  gl.uniform1f(L.intensity, SH.intensity);
  const namedActive = S.palette.on && S.palette.mode === "named";
  const pal = namedActive ? NAMED_PALETTES.find(p => p.id === S.palette.namedId) : null;
  gl.uniform1f(L.palOn, pal ? 1 : 0);
  if (pal) { gl.uniform3f(L.palA, pal.a[0], pal.a[1], pal.a[2]); gl.uniform3f(L.palB, pal.b[0], pal.b[1], pal.b[2]); }
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `node test.js`
Expected: all assertions touched in Steps 1 show `✓`.

- [ ] **Step 8: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: wire uPalA/uPalB Named Gradient uniforms into the 4 pre-mixed shader styles"
```

---

### Task 5: Shader Engine — the 8 hue-only styles

**Files:**
- Modify: `elastic-morph.html:3051-3258` (Fluid, Metaballs, Tunnel, Electric, Chrome, Strobe, Warehouse, Laser)
- Test: `test.js`

**Interfaces:**
- Consumes: `uPalOn`/`uPalA`/`uPalB` uniforms (Task 4), each style's own pre-existing `hue`
  variable (unchanged formulas, just reused as the mix parameter instead of a hue angle).
- Produces: nothing new consumed elsewhere — this is the last piece needed for "all 12 styles"
  parity.

- [ ] **Step 1: Write the failing tests**

Append to `test.js`:

```js
section("Named Palette System — 8 hue-only shader styles");

[
  ["fluidStyle", "vec3 fluidStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * val : hsv2rgb(vec3(fract(hue), sat, val))"],
  ["metaStyle", "vec3 metaStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * (edge*(0.9+uLoud*0.7+uBeat*0.5)) : hsv2rgb(vec3(fract(hue), 0.85, edge*(0.9+uLoud*0.7+uBeat*0.5)))"],
  ["tunnelStyle", "vec3 tunnelStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * v : hsv2rgb(vec3(fract(hue), 0.8, v))"],
  ["electricStyle", "vec3 electricStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * bolt : hsv2rgb(vec3(fract(hue), 0.55, bolt))"],
  ["chromeStyle", "vec3 chromeStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * (0.35 + 0.4*h) : hsv2rgb(vec3(fract(hue), 0.5 + 0.3*uMids, 0.35 + 0.4*h))"],
  ["strobeStyle", "vec3 strobeStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * v : hsv2rgb(vec3(fract(hue), 0.88, v))"],
  ["warehouseStyle", "vec3 warehouseStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * (v*(0.65 + uLoud*0.65)) : hsv2rgb(vec3(fract(hue), 0.72, v*(0.65 + uLoud*0.65)))"],
  ["laserStyle", "vec3 laserStyle(vec2 uv){", "uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * (beam*(0.45 + uBeat*1.35 + uLoud*0.55)) : hsv2rgb(vec3(fract(hue), 0.92, beam*(0.45 + uBeat*1.35 + uLoud*0.55)))"],
].forEach(([name, sig, needle]) => {
  ok(name + " branches to Named Gradient mix when uPalOn is active", (() => {
    const fn = extractGlslFn(sig);
    return !!fn && fn.includes(needle);
  })());
});

ok("chromeStyle's second hsv2rgb call (mid-expression) is parenthesized to survive GLSL ?: precedence", (() => {
  const fn = extractGlslFn("vec3 chromeStyle(vec2 uv){");
  return !!fn && fn.includes("+ (uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue+0.3)) * (fres*0.6) : hsv2rgb(vec3(fract(hue+0.3), 0.6, fres*0.6)))");
})());

ok("the 8 hue-only styles still don't call applyEyeCatcherFX (unaffected pre-existing regression check)", (() => {
  return ["fluidStyle", "metaStyle", "tunnelStyle", "electricStyle", "chromeStyle", "strobeStyle", "warehouseStyle", "laserStyle"]
    .every(name => {
      const fn = extractGlslFn("vec3 " + name + "(vec2 uv){");
      return !!fn && !fn.includes("applyEyeCatcherFX");
    });
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js`
Expected: the 8 new per-style assertions and the chromeStyle-parens assertion show `✗`. The
"still don't call applyEyeCatcherFX" assertion already shows `✓` (pre-existing code, confirms
the regression baseline before this task's edits).

- [ ] **Step 3: Implement — `fluidStyle` (lines 3061-3062)**

Change from:
```glsl
  vec3 col = hsv2rgb(vec3(fract(hue), sat, val));
  col += hsv2rgb(vec3(fract(hue+0.5), 0.5, pow(f,4.0)*uHighs*1.5));   // accent highlights
```
to:
```glsl
  vec3 col = uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * val : hsv2rgb(vec3(fract(hue), sat, val));
  col += uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue+0.5)) * (pow(f,4.0)*uHighs*1.5) : hsv2rgb(vec3(fract(hue+0.5), 0.5, pow(f,4.0)*uHighs*1.5));   // accent highlights
```

- [ ] **Step 4: Implement — `metaStyle` (lines 3080-3081)**

Change from:
```glsl
  vec3 core = hsv2rgb(vec3(fract(hue), 0.85, edge*(0.9+uLoud*0.7+uBeat*0.5)));
  core += hsv2rgb(vec3(fract(hue+0.12), 0.6, smoothstep(1.4,2.4,field)));   // hot core
```
to:
```glsl
  vec3 core = uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * (edge*(0.9+uLoud*0.7+uBeat*0.5)) : hsv2rgb(vec3(fract(hue), 0.85, edge*(0.9+uLoud*0.7+uBeat*0.5)));
  core += uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue+0.12)) * smoothstep(1.4,2.4,field) : hsv2rgb(vec3(fract(hue+0.12), 0.6, smoothstep(1.4,2.4,field)));   // hot core
```

- [ ] **Step 5: Implement — `tunnelStyle` (line 3096)**

Change from:
```glsl
  vec3 col = hsv2rgb(vec3(fract(hue), 0.8, v));
```
to:
```glsl
  vec3 col = uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * v : hsv2rgb(vec3(fract(hue), 0.8, v));
```

- [ ] **Step 6: Implement — `electricStyle` (lines 3135, 3137)**

Change line 3135 from:
```glsl
  vec3 col = hsv2rgb(vec3(fract(hue), 0.55, bolt));
```
to:
```glsl
  vec3 col = uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * bolt : hsv2rgb(vec3(fract(hue), 0.55, bolt));
```

Change line 3137 from:
```glsl
  col += hsv2rgb(vec3(fract(uHue+0.55), 0.4, uBeat*0.25));          // beat flash
```
to:
```glsl
  col += uPalOn > 0.5 ? mix(uPalA, uPalB, fract(uHue+0.55)) * (uBeat*0.25) : hsv2rgb(vec3(fract(uHue+0.55), 0.4, uBeat*0.25));          // beat flash
```

- [ ] **Step 7: Implement — `chromeStyle` (lines 3153, 3155)**

Change line 3153 from:
```glsl
  vec3 base = hsv2rgb(vec3(fract(hue), 0.5 + 0.3*uMids, 0.35 + 0.4*h));
```
to:
```glsl
  vec3 base = uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * (0.35 + 0.4*h) : hsv2rgb(vec3(fract(hue), 0.5 + 0.3*uMids, 0.35 + 0.4*h));
```

Change line 3155 from:
```glsl
           + hsv2rgb(vec3(fract(hue+0.3), 0.6, fres*0.6));
```
to:
```glsl
           + (uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue+0.3)) * (fres*0.6) : hsv2rgb(vec3(fract(hue+0.3), 0.6, fres*0.6)));
```

This one **must** stay parenthesized: it's the second operand of a `+` chain (line 3154 ends in
`+`), and GLSL's `?:` binds looser than `+` — without the parens this would parse as
`(...+...+uPalOn) > 0.5 ? mix(...) : hsv2rgb(...)`, a type error (comparing a `vec3` sum to
`0.5`). The 4 other multi-call styles don't need this because each `hsv2rgb(...)` call there is
already the entire right-hand side of its own `=`/`+=`/`return` statement.

- [ ] **Step 8: Implement — `strobeStyle` (line 3232)**

Change from:
```glsl
  vec3 col = hsv2rgb(vec3(fract(hue), 0.88, v));
```
to:
```glsl
  vec3 col = uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * v : hsv2rgb(vec3(fract(hue), 0.88, v));
```

- [ ] **Step 9: Implement — `warehouseStyle` (line 3244)**

Change from:
```glsl
  return hsv2rgb(vec3(fract(hue), 0.72, v*(0.65 + uLoud*0.65)));
```
to:
```glsl
  return uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * (v*(0.65 + uLoud*0.65)) : hsv2rgb(vec3(fract(hue), 0.72, v*(0.65 + uLoud*0.65)));
```

- [ ] **Step 10: Implement — `laserStyle` (lines 3256, 3258)**

Change line 3256 from:
```glsl
    col += hsv2rgb(vec3(fract(hue), 0.92, beam*(0.45 + uBeat*1.35 + uLoud*0.55)));
```
to:
```glsl
    col += uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) * (beam*(0.45 + uBeat*1.35 + uLoud*0.55)) : hsv2rgb(vec3(fract(hue), 0.92, beam*(0.45 + uBeat*1.35 + uLoud*0.55)));
```

Change line 3258 from:
```glsl
  col += hsv2rgb(vec3(fract(uHue+0.48), 0.55, uBeat*0.28));
```
to:
```glsl
  col += uPalOn > 0.5 ? mix(uPalA, uPalB, fract(uHue+0.48)) * (uBeat*0.28) : hsv2rgb(vec3(fract(uHue+0.48), 0.55, uBeat*0.28));
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `node test.js`
Expected: all assertions from Step 1 show `✓`, including the pre-existing
`applyEyeCatcherFX`-absence check (unchanged, still green).

- [ ] **Step 12: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: extend Named Gradient mixing to the 8 hue-only shader styles"
```

---

### Task 6: Layer B — `colr()` helper Named Gradient branch

**Files:**
- Modify: `elastic-morph.html:5159-5163` (inside `drawLayerB`, line 5147)
- Test: `test.js`

**Interfaces:**
- Consumes: `NAMED_PALETTES`, `S.palette.on`/`mode`/`namedId` (Task 1). `LB.color` (existing
  `"dna"`/`"rainbow"`/`"white"` values, unchanged).
- Produces: nothing new consumed elsewhere — completes the spec's Layer B integration.

- [ ] **Step 1: Write the failing test**

Append to `test.js`:

```js
section("Named Palette System — Layer B");

ok("drawLayerB's colr() branches to a Named Gradient RGB mix inside the dna color mode", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn
    && fn.includes('LB.color === "dna" && S.palette.on && S.palette.mode === "named"')
    && fn.includes("NAMED_PALETTES.find(p => p.id === S.palette.namedId)");
})());
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test.js`
Expected: the new assertion shows `✗`.

- [ ] **Step 3: Implement**

Change `elastic-morph.html:5159-5163` from:
```js
  const colr = (t, a) => {
    if (LB.color === "white") return `rgba(255,255,255,${a})`;
    const h = (LB.color === "rainbow" ? (t * 300 + S.time * 30) : (hue + t * 50)) + (LB._hue || 0);
    return `hsla(${((h % 360) + 360) % 360}, 82%, 63%, ${a})`;
  };
```
to:
```js
  const colr = (t, a) => {
    if (LB.color === "white") return `rgba(255,255,255,${a})`;
    if (LB.color === "dna" && S.palette.on && S.palette.mode === "named") {
      const pal = NAMED_PALETTES.find(p => p.id === S.palette.namedId);
      if (pal) {
        const mixT = ((t % 1) + 1) % 1;
        const r = Math.round(255 * (pal.a[0] + (pal.b[0] - pal.a[0]) * mixT));
        const g = Math.round(255 * (pal.a[1] + (pal.b[1] - pal.a[1]) * mixT));
        const bch = Math.round(255 * (pal.a[2] + (pal.b[2] - pal.a[2]) * mixT));
        return `rgba(${r},${g},${bch},${a})`;
      }
    }
    const h = (LB.color === "rainbow" ? (t * 300 + S.time * 30) : (hue + t * 50)) + (LB._hue || 0);
    return `hsla(${((h % 360) + 360) % 360}, 82%, 63%, ${a})`;
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test.js`
Expected: the assertion from Step 1 shows `✓`.

- [ ] **Step 5: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: Named Gradient support for Layer B's dna color mode"
```

---

### Task 7: Full regression + manual live-check

**Files:** none modified — verification only.

**Interfaces:** none (terminal task).

- [ ] **Step 1: Full automated regression**

Run: `npm run ci`
Expected: `node build.js` reports the merge succeeded (`✓ Merged ...`), then `node test.js`
reports `fail: 0` and every section — old and new — shows all `✓`.

- [ ] **Step 2: Confirm no generated-region drift**

Run: `git diff --stat elastic-morph.html`
Expected: **no output** immediately after `node build.js` runs as part of Step 1 beyond what
Tasks 1-6 already committed — i.e. `git status` shows a clean tree (everything from Step 1 was
already committed task-by-task; `build.js` regenerating the post-marker region from unchanged
`src/inject-*.js` files must reproduce byte-identical content).

Run: `git status --short`
Expected: empty (no uncommitted changes).

- [ ] **Step 3: Manual live-check (Pro mode, real demo track)**

In the running app:
1. Open the Palette panel, switch `Modus` to "Vordefiniert" with `#palOn` checked — confirm the
   Hue/Spread/Sat rows hide, the named dropdown and preview swatch (real 2-color gradient, not
   an HSL sweep) appear, and "Palette aus Cover-Bild" is disabled.
2. Cycle through all 12 Shader Engine styles with a Named Gradient selected — confirm each one
   visibly mixes between the two chosen anchor colors (not the old hue-rotation look) and that
   the four previously-tuned styles (Aurora/Gyroid/SDF Blob/Feedback Fractal) still show their
   `applyEyeCatcherFX` bloom/grain treatment on top.
3. Switch `Modus` back to "Eigene Mischung" — confirm all 12 styles return to their exact prior
   look (this is the regression check that matters most, since it's the default/existing path).
4. Uncheck `#palOn` entirely — confirm Preset-Gradient behavior (DNA-driven color) is unchanged
   from before this feature existed.
5. Enable Layer B with Color mode "DNA" and a Named Gradient active — confirm the overlay renders
   in the two anchor colors, not hue-rotated HSL.
6. Save the current state into a Scene Bank slot with a Named Gradient active, switch to a
   different slot/preset, then reload the saved slot — confirm the Named Gradient mode and
   selection come back exactly as saved.
7. Note any anchor-color pairs that read as muddy/low-contrast at this stage — per the design
   spec, the 6 starter palettes' exact RGB values are tuning starting points, not final numbers.

No code changes are expected from this step unless Step 3.7 surfaces a concrete live-tuning
request — if so, that's a follow-up, not part of this plan's scope.
