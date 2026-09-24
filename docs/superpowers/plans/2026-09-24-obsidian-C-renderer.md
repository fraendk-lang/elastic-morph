# Obsidian Bloom Stage C — Renderer, Preset, Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first spatial DNA "Obsidian Bloom" (engine id `sculpture`): a polished graphite sculpture rendered by its own bounded SDF raymarcher in a separate WebGL context, driven by the Stage-B audio/time contract, selectable as a normal Visual DNA preset, with quality tiers, GPU-loss/no-WebGL fallback and a card preview.

**Architecture:** The complete renderer module is pre-written and shader-tuned in a lab page (real-GPU verified) and committed as `docs/superpowers/plans/2026-09-24-obsidian-C-assets/inject-v114.js`; the implementer copies it byte-for-byte to `src/inject-v114.js` (no retyping of GLSL). Integration edits are small and exact: build registration, one PRESETS entry, badge CSS/markup, quality `<select>`, a dispatch branch + idle tick in `drawScene`, a card-preview branch, and `exportHQ` switched from `S.preset` to `currentDNA()` (blends keep their engine). The renderer composites the GL canvas with an identity transform at the DNA layer (the scene's 2D camera is not applied twice) using `source-over` (an opaque body; the DNA Blend dropdown deliberately does not apply to this look).

**Tech Stack:** Vanilla JS + GLSL ES 1.00 (WebGL1), `test.js`.

## Global Constraints

- Stable engine/preset id: `sculpture`; visible name: `Obsidian Bloom`. Preset fields: `bgFade: 0.9`, `bloom: 0`, `particles: 0`, `layers: 1`, `petals: 0`, `glass: false`, no `bank` (goes to the Ambient bank).
- The module file must be a byte-for-byte copy of the asset (`cp`), not retyped.
- Shader finish: filmic tonemap and gamma exactly ONCE, inside the fragment shader (`pow(clamp(col,0.0,1.0),vec3(1.0/2.2))` appears exactly once). No bloom feed, no feedback, no screen-add in this look's own path.
- Quality only changes steps/shadow/AO/resolution; form, seed and motion phase never depend on quality or resolution. Export forces quality 2 and full resolution (longest side capped at 4096).
- `Weniger Flackern` (`S.reduceFlash`) damps kick/snare to 35%.
- No `Math.random` / `Date.now` anywhere in the module; `sculptureCollectFeatures` (the feature path) contains no clock call either. (`performance.now` is allowed only in lifecycle code: `drawSculpture` dt and `sculptureIdleTick`.)
- Old presets, saved scenes and other engines are untouched; `raymarch` shader key untouched.
- Verification command: `npm run ci` (never `node test.js` alone). Build-region file → `build.js` MUST list the module.

---

### Task 1: Module, preset, integration, tests

**Files:**
- Create: `src/inject-v114.js` (copy of the asset)
- Modify: `build.js`, `elastic-morph.html` (PRESETS end ~2790, badge CSS ~654, badge markup ~1086, `#dnaBlend` block ~1708-1719, `renderPreviews` ~7970, `drawScene` dispatch ~6065-6112, `exportHQ` ~5450), `test.js`

**Interfaces (from Stage B, already present):** `ensureSculptureTimeline`, `sampleSculptureTimeline`, `sculptureLiveStep`, `sculptureSongTime`, `sculptureNeeded`, `S._hqT`, `S._sculptTL`. Existing app symbols used: `glCompile`, `canvas`, `ctx`, `S`, `audioEl`, `$`, `fract1`, `currentDNA`.

- [ ] **Step 1: Write the failing tests**

Insert immediately before `/* ---------------- summary ---------------- */` in `test.js` (helper `okf` already exists):

```js
section("Obsidian Bloom renderer + preset (stage C)");

let OB = null;
try {
  OB = loadFns(["sculptureSeedFromHash", "sculptureQuality", "sculptureRenderSize", "sculptureTint"]);
  ok("extract Obsidian Bloom pure functions", true);
} catch (e) { ok("extract Obsidian Bloom pure functions", false, e.message); }

if (OB) {
  okf("seed: deterministic, four values in [0,1), differs per hash and per version, hash 0 works", () => {
    const a = OB.sculptureSeedFromHash(123456789, 1), b = OB.sculptureSeedFromHash(123456789, 1);
    const c = OB.sculptureSeedFromHash(987654321, 1), d = OB.sculptureSeedFromHash(123456789, 2), z = OB.sculptureSeedFromHash(0, 1);
    const inRange = s => s.length === 4 && s.every(v => v >= 0 && v < 1);
    return a.every((v, i) => v === b[i]) && inRange(a) && inRange(z)
      && a.some((v, i) => v !== c[i]) && a.some((v, i) => v !== d[i]);
  });
  okf("quality: export always high; explicit modes win; auto follows perfScale; bad perfScale falls back to high", () =>
    OB.sculptureQuality("low", 1, true) === 2 && OB.sculptureQuality("high", 0.3, false) === 2
    && OB.sculptureQuality("med", 1, false) === 1 && OB.sculptureQuality("low", 1, false) === 0
    && OB.sculptureQuality("auto", 1, false) === 2 && OB.sculptureQuality("auto", 0.6, false) === 1
    && OB.sculptureQuality("auto", 0.4, false) === 0 && OB.sculptureQuality("auto", NaN, false) === 2);
  okf("render size: preview is capped per quality and keeps aspect; export is full size up to 4096; never below 2px", () => {
    const p = OB.sculptureRenderSize(1920, 1080, 2, false), l = OB.sculptureRenderSize(1920, 1080, 0, false);
    const e = OB.sculptureRenderSize(3840, 2160, 2, true), big = OB.sculptureRenderSize(8000, 4500, 2, true), tiny = OB.sculptureRenderSize(1, 1, 0, false);
    return p.w === 1280 && p.h === 720 && l.w === 640 && l.h === 360 && e.w === 3840 && e.h === 2160
      && big.w === 4096 && tiny.w >= 2 && tiny.h >= 2;
  });
  okf("tint: subtle (0.9..1.1), red hue warmer than blue hue, wraps negative/large hues", () => {
    const red = OB.sculptureTint(0), blue = OB.sculptureTint(240), neg = OB.sculptureTint(-120), wrap = OB.sculptureTint(600);
    const sub = t => t.length === 3 && t.every(v => v >= 0.9 && v <= 1.1);
    return sub(red) && sub(blue) && red[0] > red[2] && blue[2] > blue[0]
      && neg.every((v, i) => Math.abs(v - blue[i]) < 1e-9) && wrap.every((v, i) => Math.abs(v - blue[i]) < 1e-9);
  });
}

okf("PRESETS gains exactly one Obsidian Bloom entry with the sculpture engine and a calm, clean-background setup", () => {
  const m = html.match(/id: "sculpture", name: "Obsidian Bloom",[\s\S]*?gradient: \[[^\]]*\]\s*\}/);
  if (!m) return false;
  const p = m[0];
  return (html.match(/id: "sculpture"/g) || []).length === 1
    && p.includes('engine: "sculpture"') && p.includes("bgFade: 0.9") && p.includes("bloom: 0") && p.includes("particles: 0")
    && p.includes("layers: 1") && p.includes("petals: 0") && p.includes("glass: false") && !p.includes("bank:");
});
okf("drawScene dispatches to drawSculpture and ticks the GPU idle release", () => {
  const fn = extractFn("drawScene");
  return !!fn && fn.includes('sculptureIdleTick(dnaEngine === "sculpture");')
    && fn.includes('} else if (dnaEngine === "sculpture") {') && fn.includes("drawSculpture(base, hue, growthF, energySize, seed);");
});
okf("drawSculpture composites with an identity transform and source-over (no double camera, opaque body)", () => {
  const fn = extractFn("drawSculpture");
  return !!fn && fn.includes("ctx.setTransform(1, 0, 0, 1, 0, 0);") && fn.includes('ctx.globalCompositeOperation = "source-over";')
    && fn.includes("ctx.drawImage(SCULPT.canvas, 0, 0, W, H);");
});
okf("the fragment shader tonemaps and gamma-corrects exactly once and outputs alpha 0 outside the body", () => {
  const s = injectSrc("inject-v114.js");
  return (s.split("pow(clamp(col,0.0,1.0),vec3(1.0/2.2))").length - 1) === 1
    && s.includes("vec4 outc=vec4(0.0);") && s.includes("gl_FragColor=outc;") && s.includes("uniform vec4 uSeed;");
});
okf("the renderer module has no Math.random/Date.now and its feature path has no clock call", () => {
  const s = injectSrc("inject-v114.js"), f = extractFn("sculptureCollectFeatures", s);
  return !s.includes("Math.random") && !s.includes("Date.now") && !!f && !f.includes("performance.now");
});
okf("GPU failure path: 2D fallback orb + badge, and the context is released after idle", () => {
  const s = injectSrc("inject-v114.js");
  return s.includes("if (!sculptureInitGL()) { sculptureFallback(base, growthF); sculptureBadge(true); return; }")
    && s.includes("function sculptureRelease()") && s.includes('getExtension("WEBGL_lose_context")');
});
okf("Weniger Flackern damps kick/snare for Obsidian Bloom", () => {
  const s = injectSrc("inject-v114.js");
  return s.includes("const calm = S.reduceFlash ? 0.35 : 1;");
});
okf("badge element + CSS and the quality select (4 options) exist", () =>
  html.includes('<div id="sculptBadge" role="status" aria-live="polite"></div>') && html.includes("#sculptBadge.show { display: block; }")
  && html.includes('<select id="sculptQuality"') && ["auto", "high", "med", "low"].every(v => html.includes('<option value="' + v + '"')));
okf("the DNA preset card gets an Obsidian Bloom preview branch", () => {
  const fn = extractFn("renderPreviews");
  return !!fn && fn.includes('} else if (p.engine === "sculpture") {');
});
okf("exportHQ waits for the timeline based on the ACTIVE DNA (blends keep their engine), not just S.preset", () => {
  const fn = extractFn("exportHQ");
  return !!fn && fn.includes("if (sculptureNeeded(currentDNA())) await ensureSculptureTimeline();");
});
okf("build.js lists the renderer module and it exists", () => {
  const b = fs.readFileSync(path.join(__dirname, "build.js"), "utf8");
  return b.includes('"src/inject-v114.js"') && fs.existsSync(path.join(__dirname, "src", "inject-v114.js"));
});
```

Also, in `test.js`, update the Stage-B assertion string so it matches the new hook. Find:

```js
  return !!fn && fn.includes("if (sculptureNeeded(S.preset)) await ensureSculptureTimeline();");
```

Replace with:

```js
  return !!fn && fn.includes("if (sculptureNeeded(currentDNA())) await ensureSculptureTimeline();");
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run ci`
Expected: `extract Obsidian Bloom pure functions` `✗` (module missing) plus the static assertions `✗`; the updated Stage-B `exportHQ` assertion also `✗` (code not yet changed). Everything else `✓`.

- [ ] **Step 3: Create the module (byte-for-byte copy)**

Run:

```bash
cp docs/superpowers/plans/2026-09-24-obsidian-C-assets/inject-v114.js src/inject-v114.js
cmp docs/superpowers/plans/2026-09-24-obsidian-C-assets/inject-v114.js src/inject-v114.js && echo identical
```

Expected: `identical`.

- [ ] **Step 4: Register in `build.js`**

Find `"src/inject-v112.js", "src/inject-v113.js"];` and replace with `"src/inject-v112.js", "src/inject-v113.js", "src/inject-v114.js"];`

- [ ] **Step 5: Add the preset (`elastic-morph.html`, end of `PRESETS`)**

Find:

```js
    engine: "mazeGrid",
    gradient: ["#081c18", "#123c30", "#4bffb0"]
  }
];
```

Replace with:

```js
    engine: "mazeGrid",
    gradient: ["#081c18", "#123c30", "#4bffb0"]
  },
  {
    id: "sculpture", name: "Obsidian Bloom",
    desc: "Eine dunkle, geschliffene Skulptur mit eigener Silhouette aus deinem Track. Räumlich, ruhig, filmisch.",
    hue: 215, hueEnd: 250, sat: 20, bgFade: 0.9,
    layers: 1, points: 0, noiseAmp: 0, speed: 0.3,
    particles: 0, particleStyle: "dust", symmetry: 1,
    verticalStretch: 1.0, grain: 0, lineMode: false, petals: 0, glass: false,
    motion: "orbit", flowBias: 0, constellation: false, bloom: 0, waveRing: false,
    engine: "sculpture",
    gradient: ["#050508", "#12141c", "#8aa0c8"]
  }
];
```

- [ ] **Step 6: Badge CSS and markup**

Find:

```css
  #webglBadge.show { display: block; }
```

Replace with:

```css
  #webglBadge.show { display: block; }
  #sculptBadge {
    display: none; position: absolute; top: 66px; left: 50%; transform: translateX(-50%); z-index: 12;
    font-size: 10px; color: var(--amber); background: rgba(10,10,18,.88);
    border: 1px solid var(--amber); border-radius: 8px; padding: 4px 10px; pointer-events: none;
  }
  #sculptBadge.show { display: block; }
```

Find:

```html
    <div id="webglBadge" role="status" aria-live="polite"></div>
```

Replace with:

```html
    <div id="webglBadge" role="status" aria-live="polite"></div>
    <div id="sculptBadge" role="status" aria-live="polite"></div>
```

- [ ] **Step 7: Quality select (after the `#dnaBlend` select)**

Find:

```html
      <option value="hue">Blend: Hue</option>
    </select>
    <div id="sliders"></div>
```

Replace with:

```html
      <option value="hue">Blend: Hue</option>
    </select>
    <select id="sculptQuality" class="pm-select" style="margin-bottom:10px" title="Nur für Obsidian Bloom: Detailstufe (ändert nicht die Form)">
      <option value="auto" selected>Obsidian-Qualität: Auto</option>
      <option value="high">Obsidian-Qualität: Hoch</option>
      <option value="med">Obsidian-Qualität: Mittel</option>
      <option value="low">Obsidian-Qualität: Niedrig</option>
    </select>
    <div id="sliders"></div>
```

- [ ] **Step 8: `drawScene` dispatch**

Find:

```js
  const dnaEngine = P.engine || "blob";

  if (dnaEngine === "filament") {
```

Replace with:

```js
  const dnaEngine = P.engine || "blob";
  sculptureIdleTick(dnaEngine === "sculpture");

  if (dnaEngine === "filament") {
```

Find:

```js
  } else if (dnaEngine === "patchbay") {
    drawPatchbay(base, hue, growthF, energySize, seed);
  } else {
```

Replace with:

```js
  } else if (dnaEngine === "patchbay") {
    drawPatchbay(base, hue, growthF, energySize, seed);
  } else if (dnaEngine === "sculpture") {
    drawSculpture(base, hue, growthF, energySize, seed);
  } else {
```

- [ ] **Step 9: Card preview branch (`renderPreviews`)**

Find (the line that starts the hyperspace preview branch inside `renderPreviews`):

```js
    } else if (p.engine === "hyperspace") {
      const ty = Math.floor(fract1(Math.sin(pv.seed * 2.17 + 0.3) * 4391.7) * 4) & 3;
```

Replace with:

```js
    } else if (p.engine === "sculpture") {
      // Obsidian Bloom card: two graphite lobes + a softbox highlight (seeded 2D stand-in for the GPU look)
      c.globalCompositeOperation = "source-over";
      const s1 = fract1(Math.sin(pv.seed * 12.9898) * 43758.5), wob = Math.sin(t * 0.4 + pv.seed) * 0.06;
      for (let k = 0; k < 2; k++) {
        const ox = (k ? 1 : -1) * R * (0.55 + 0.25 * s1), oy = (k ? -1 : 1) * R * 0.12, rr = R * (k ? 0.85 : 1.05) * (1 + wob);
        const g = c.createRadialGradient(ox - rr * 0.3, oy - rr * 0.35, rr * 0.05, ox, oy, rr);
        g.addColorStop(0, "#6b7384"); g.addColorStop(0.3, "#20232d"); g.addColorStop(1, "#06070b");
        c.fillStyle = g; c.beginPath(); c.arc(ox, oy, rr, 0, 6.2832); c.fill();
      }
      c.fillStyle = "rgba(255,190,130,0.55)"; c.fillRect(-R * 1.15, -R * 0.55, R * 0.32, R * 0.2);
    } else if (p.engine === "hyperspace") {
      const ty = Math.floor(fract1(Math.sin(pv.seed * 2.17 + 0.3) * 4391.7) * 4) & 3;
```

- [ ] **Step 10: `exportHQ` uses the active DNA**

Find: `    if (sculptureNeeded(S.preset)) await ensureSculptureTimeline();`
Replace with: `    if (sculptureNeeded(currentDNA())) await ensureSculptureTimeline();`

- [ ] **Step 11: Run to verify pass**

Run: `npm run ci`
Expected: all assertions `✓`, final `<N> passed, 0 failed`.

- [ ] **Step 12: Commit**

```bash
git add src/inject-v114.js build.js elastic-morph.html test.js
git commit -m "feat: Obsidian Bloom — first spatial DNA (own WebGL SDF raymarcher, engine sculpture)

Polished graphite sculpture: 4 smooth-unioned lobes + bloom ridges,
warm key softbox + cool rim strip, AO/soft shadow, filmic tonemap once
in the shader. Isolated WebGL context with lifecycle (init, resize,
context loss, release after idle), 3 quality tiers (detail only, never
form), no-GPU fallback + badge, seed from the track fingerprint, features
from the stage-B timeline/live adapter. Preset (ambient bank), card
preview, quality select, drawScene dispatch. exportHQ now decides on the
ACTIVE DNA so blends keep working.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual / browser verification (controller, after the task)

Select "Obsidian Bloom" in Visual DNA with a track loaded: dark polished sculpture on a clean dark ground, silhouette differs per track, kick gives a local bump, quality select changes only detail. Check 16:9, 9:16, 1:1, "DNA aus", another preset switch (GPU context released after ~5 s), and `?` no console errors.
