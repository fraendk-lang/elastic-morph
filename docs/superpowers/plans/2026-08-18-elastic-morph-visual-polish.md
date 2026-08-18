# Elastic Morph Visual Polish (v113) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the DNA bloom visible at rest instead of matte, bias Layer-B overlays away from generic visualizer clichés (and give the worst three a glow-coupled refresh), and add 6 self-hosted display fonts to the text designer.

**Architecture:** All target code (`drawScene`'s bloom pass, `drawLayerB`'s case blocks, `TEXT_FONTS`, the `#textFont` `<select>`, `resize()`'s bloom-buffer sizing) lives in the **static region of `elastic-morph.html`** (lines 1–8482, *before* the `/* @BUILD-INJECT-V58 */` marker at line 8483). That region is hand-authored and untouched by `build.js` — `build.js` only regenerates the block between the marker and `/* ---- boot ---- */` (line 15507) from `src/inject-v*.js` modules. **Consequence: this plan edits `elastic-morph.html` directly. No new `src/inject-v113.js` module and no `build.js`/`APP_VERSION` change are needed** — the spec's "Umsetzung" section assumed the module path before this was verified; that assumption was wrong and is corrected here.

**Tech Stack:** Vanilla JS, Canvas 2D, zero-dependency test harness (`test.js`, run via `node test.js`), Google Fonts CSS2 API for self-hosted woff2 downloads, `sw.js` (network-first service worker with offline precache).

## Global Constraints

- Every code change must keep `node test.js` at 100% pass (checked at the end of every task).
- No new runtime dependencies, no CDN font loading — fonts are downloaded once at build/dev time and served from `assets/fonts/`, matching the existing `assets/demo/` self-hosting pattern.
- Font files: Latin subset, woff2, target < 40 KB each (spec requirement).
- `sw.js`'s `CACHE` string must be bumped when new precached assets are added, so offline users pick up the new asset list (existing `activate` handler already deletes stale cache keys).
- Don't touch the injected region (lines 8483–15507) or `build.js` — this work doesn't need it.

---

### Task 1: Bloom pipeline — raise the idle/preview floor

**Files:**
- Modify: `elastic-morph.html:4556-4565` (bloom pass inside `drawScene`)
- Modify: `elastic-morph.html:7658-7660` (bloom buffer resize)
- Modify: `test.js` (new assertions, inserted before the `summary` section)

**Interfaces:** None consumed. Produces no new symbols — pure constant changes to the existing bloom pass.

- [ ] **Step 1: Add the failing test assertions**

Open `test.js`, find this block near the end (search for `reaction-diffusion finite`):

```js
  const rr = reaction();
  ok("reaction-diffusion finite, bounded [0,1] & pattern persists", rr.bad === 0 && rr.alive > 5);
}

/* ---------------- summary ---------------- */
```

Insert a new section immediately after the closing `}` and before `/* ---------------- summary ---------------- */`:

```js

/* ---------------- v113: bloom / layer B / fonts ---------------- */
section("v113 — visual polish");
ok("bloom alpha ceiling raised to 0.55", script.includes("Math.min(0.55, P.bloom"));
ok("bloom baseline term raised to 0.22", script.includes("0.22 + S.loudness * 0.19 + S.beat * 0.05"));
ok("bloom idle/hero multiplier raised", script.includes("dnaLive ? 1 : (heroOpen ? 0.7 : 0.6)"));
ok("bloom buffer at 1/4 resolution", script.includes("Math.round(canvas.width / 4))") && script.includes("bloom buffer at 1/4 resolution"));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the four new `v113` checks print `✗`, everything else still `✓`. Example expected line:
```
  ✗ bloom alpha ceiling raised to 0.55
```

- [ ] **Step 3: Edit the bloom pass**

In `elastic-morph.html`, find (around line 4556):

```js
  /* --- bloom: cheap downscale-upscale glow pass --- */
  if (P.bloom > 0.05 && bloomC.width > 2) {
    bctx.globalCompositeOperation = "copy";
    bctx.drawImage(canvas, 0, 0, bloomC.width, bloomC.height);
    ctx.globalCompositeOperation = "screen";
    const bloomLive = dnaLive ? 1 : (heroOpen ? 0.48 : 0.36);
    ctx.globalAlpha = Math.min(0.36, P.bloom * (0.13 + S.loudness * 0.19 + S.beat * 0.05) * bloomLive);
    ctx.drawImage(bloomC, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
```

Replace with:

```js
  /* --- bloom: cheap downscale-upscale glow pass --- */
  if (P.bloom > 0.05 && bloomC.width > 2) {
    bctx.globalCompositeOperation = "copy";
    bctx.drawImage(canvas, 0, 0, bloomC.width, bloomC.height);
    ctx.globalCompositeOperation = "screen";
    // v113: idle/preview state used to crush bloom to ~1/10 of its ceiling — raised the
    // floor so presets don't read as matte before anything is playing.
    const bloomLive = dnaLive ? 1 : (heroOpen ? 0.7 : 0.6);
    ctx.globalAlpha = Math.min(0.55, P.bloom * (0.22 + S.loudness * 0.19 + S.beat * 0.05) * bloomLive);
    ctx.drawImage(bloomC, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
```

- [ ] **Step 4: Edit the bloom buffer resolution**

In `elastic-morph.html`, find (around line 7658):

```js
  // bloom buffer at 1/6 resolution
  bloomC.width = Math.max(2, Math.round(canvas.width / 6));
  bloomC.height = Math.max(2, Math.round(canvas.height / 6));
```

Replace with:

```js
  // bloom buffer at 1/4 resolution
  bloomC.width = Math.max(2, Math.round(canvas.width / 4));
  bloomC.height = Math.max(2, Math.round(canvas.height / 4));
```

(Leave the realtime-recording override near line 12507 — `canvas.width / 4` — untouched; it now matches the new base resolution, which is harmless.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node test.js`
Expected: `0 failed`, all `v113` checks show `✓`.

- [ ] **Step 6: Manual visual check**

Run: `npm start` (serves on `http://localhost:3456`), open `elastic-morph.html` in a browser, open the preset grid without pressing play. Confirm DNA presets with `bloom >= 0.5` show a visible glow at rest (not just once audio starts), and that no preset clips to solid white (auto-exposure should still catch this — check the brightest presets, e.g. "Black Bloom", "Photon Storm" or similar high-bloom entries).

- [ ] **Step 7: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "v113: raise bloom floor so DNA glow reads at idle, not just live"
```

---

### Task 2: Layer B — weight the randomizer away from generic overlay types

**Files:**
- Modify: `elastic-morph.html:4972-4994` (add `LAYERB_GENERIC` + `pickLayerBType` right after `LAYERB_TYPES`)
- Modify: `elastic-morph.html:8215` (`autoVjStep`'s random type pick)
- Modify: `test.js`

**Interfaces:**
- Produces: `function pickLayerBType(rnd)` — takes a `() => number` RNG returning `[0,1)` (matching the existing local `R` convention in `autoVjStep`), returns one of the string ids from `LAYERB_TYPES`.
- Produces: `const LAYERB_GENERIC` — a `Set` of the 5 cliché-visualizer type ids.

- [ ] **Step 1: Add the failing test assertions**

In `test.js`, extend the `v113` section added in Task 1 with:

```js
ok("layer B weighted picker exists", script.includes("function pickLayerBType"));
ok("layer B generic set covers the 5 cliché types", (() => {
  const m = script.match(/LAYERB_GENERIC = new Set\(\[([^\]]+)\]\)/);
  if (!m) return false;
  const ids = (m[1].match(/"(\w+)"/g) || []).map(s => s.replace(/"/g, ""));
  return ["bars", "grid", "waveform", "starfield", "spectrumRing"].every(id => ids.includes(id));
})());
ok("autoVjStep uses the weighted picker", script.includes("S.layerB.type = pickLayerBType(R)"));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the 3 new checks print `✗`.

- [ ] **Step 3: Add the weighted picker next to `LAYERB_TYPES`**

In `elastic-morph.html`, find (around line 4972):

```js
const LAYERB_TYPES = [
  ["spectrumRing", "Spectrum Ring"],
  ["grid",         "Grid Pulse"],
  ["tunnel",       "Tunnel"],
  ["waveform",     "Waveform"],
  ["starfield",    "Starfield"],
  ["lissajous",    "Lissajous"],
  ["bars",         "Spectrum Bars"],
  ["rays",         "Light Rays"],
  ["gridwave",     "Grid Wave"],
  ["spiral",       "Spiral"],
  /* v40: richer overlays */
  ["radialWave",   "Radial Waveform"],
  ["constellation","Constellation"],
  ["pulseRings",   "Pulse Rings"],
  ["helix",        "DNA Helix"],
  ["hexgrid",      "Hex Grid"],
  ["orbits",       "Orbits"]
];
```

Insert immediately after it:

```js
// v113: the classic visualizer clichés (bars/grid/waveform/starfield/spectrumRing) stay in
// rotation but the Auto-VJ randomizer now picks the more distinctive types twice as often.
const LAYERB_GENERIC = new Set(["bars", "grid", "waveform", "starfield", "spectrumRing"]);
function pickLayerBType(rnd) {
  const pool = [];
  LAYERB_TYPES.forEach(([id]) => { pool.push(id); if (!LAYERB_GENERIC.has(id)) pool.push(id); });
  return pool[Math.floor(rnd() * pool.length)];
}
```

- [ ] **Step 4: Use the picker in `autoVjStep`**

In `elastic-morph.html`, find (around line 8213):

```js
  if (R() < 0.4) {
    S.layerB.on = R() < 0.7;
    S.layerB.type = LAYERB_TYPES[Math.floor(R() * LAYERB_TYPES.length)][0];
    $("lbOn").checked = S.layerB.on; $("lbType").value = S.layerB.type;
    if (S.layerB.type === "starfield") initStars();
  }
```

Replace with:

```js
  if (R() < 0.4) {
    S.layerB.on = R() < 0.7;
    S.layerB.type = pickLayerBType(R);
    $("lbOn").checked = S.layerB.on; $("lbType").value = S.layerB.type;
    if (S.layerB.type === "starfield") initStars();
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node test.js`
Expected: `0 failed`.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "v113: weight Layer B randomizer toward distinctive overlay types"
```

---

### Task 3: Layer B — glow-coupled refresh for bars / grid / waveform

**Files:**
- Modify: `elastic-morph.html:5063-5072` (`case "grid"`)
- Modify: `elastic-morph.html:5091-5108` (`case "waveform"`)
- Modify: `elastic-morph.html:5141-5153` (`case "bars"`)
- Modify: `test.js`

**Interfaces:** None. Purely visual changes inside existing `switch (LB.type)` cases in `drawLayerB`; each case is wrapped in the function's existing `ctx.save()`/`ctx.restore()` per mirror-pass, so no manual state cleanup is required beyond what's noted below.

- [ ] **Step 1: Add the failing test assertions**

In `test.js`, extend the `v113` section with:

```js
ok("grid overlay has beat-coupled glow on loud cells", script.includes('ctx.shadowBlur = v > 0.55 ? 6 + S.beat * 10 : 0;'));
ok("waveform overlay has beat-coupled glow", script.includes('ctx.shadowBlur = 6 + S.beat * 14;'));
ok("bars overlay has beat-coupled glow on loud bars", script.includes('ctx.shadowBlur = v > 0.5 ? 6 + S.beat * 12 : 0;'));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the 3 new checks print `✗`.

- [ ] **Step 3: Edit `case "grid"`**

Find (around line 5063):

```js
    case "grid": {
      const cols = 26, rows = Math.max(1, Math.round(cols * H / W));
      const cw = W / cols, ch = H / rows, pad = cw * 0.14;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const v = specAt((x + y) % 60, 60) * (0.55 + 0.55 * Math.sin(x * 0.5 + y * 0.5 + S.time * 2.2));
        if (v < 0.16) continue;
        ctx.fillStyle = colr(x / cols, 0.05 + v * 0.5);
        ctx.fillRect(x * cw + pad, y * ch + pad, cw - 2 * pad, ch - 2 * pad);
      }
      break;
    }
```

Replace with:

```js
    case "grid": {
      const cols = 26, rows = Math.max(1, Math.round(cols * H / W));
      const cw = W / cols, ch = H / rows, pad = cw * 0.14;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const v = specAt((x + y) % 60, 60) * (0.55 + 0.55 * Math.sin(x * 0.5 + y * 0.5 + S.time * 2.2));
        if (v < 0.16) continue;
        ctx.fillStyle = colr(x / cols, 0.05 + v * 0.5);
        // v113: glow-coupled peaks so loud cells read as DNA-bloom, not a flat equalizer
        ctx.shadowBlur = v > 0.55 ? 6 + S.beat * 10 : 0;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillRect(x * cw + pad, y * ch + pad, cw - 2 * pad, ch - 2 * pad);
      }
      break;
    }
```

- [ ] **Step 4: Edit `case "waveform"`**

Find (around line 5091):

```js
    case "waveform": {
      ctx.strokeStyle = colr(0.5, 0.55 + S.highs * 0.4);
      ctx.beginPath();
      if (timeData && (S.playing || S.micMode) && !S.exporting) {
        const N = timeData.length;
        for (let i = 0; i < N; i += 2) {
          const x = i / N * W, s = (timeData[i] - 128) / 128;
          const y = cy + s * H * 0.3 * (0.5 + ctrl.pulse);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      } else {
        for (let x = 0; x <= W; x += 6) {
          const s = Math.sin(x * 0.018 + S.time * 3) * (0.18 + S.loudness * 0.6);
          const y = cy + s * H * 0.28;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      break;
    }
```

Replace with:

```js
    case "waveform": {
      ctx.strokeStyle = colr(0.5, 0.55 + S.highs * 0.4);
      ctx.beginPath();
      if (timeData && (S.playing || S.micMode) && !S.exporting) {
        const N = timeData.length;
        for (let i = 0; i < N; i += 2) {
          const x = i / N * W, s = (timeData[i] - 128) / 128;
          const y = cy + s * H * 0.3 * (0.5 + ctrl.pulse);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      } else {
        for (let x = 0; x <= W; x += 6) {
          const s = Math.sin(x * 0.018 + S.time * 3) * (0.18 + S.loudness * 0.6);
          const y = cy + s * H * 0.28;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      }
      // v113: glow-coupled stroke so the line reads as DNA-bloom, not a flat scope trace
      ctx.shadowBlur = 6 + S.beat * 14;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.stroke();
      break;
    }
```

- [ ] **Step 5: Edit `case "bars"`**

Find (around line 5141):

```js
    case "bars": {
      // classic spectrum bars rising from the bottom edge, mirrored as a soft reflection
      const n = 56, bw = W / n;
      for (let i = 0; i < n; i++) {
        const v = specAt(i, n);
        const h = v * H * 0.5 * (0.6 + ctrl.pulse) + 2;
        ctx.fillStyle = colr(i / n, 0.35 + v * 0.55);
        ctx.fillRect(i * bw + bw * 0.16, H - h, bw * 0.68, h);
        ctx.globalAlpha = LB.opacity * 0.18;
        ctx.fillRect(i * bw + bw * 0.16, H, bw * 0.68, h * 0.5);   // reflection
        ctx.globalAlpha = LB.opacity;
      }
      break;
    }
```

Replace with (note the explicit `shadowBlur = 0` before the reflection — the glow must not leak onto it):

```js
    case "bars": {
      // classic spectrum bars rising from the bottom edge, mirrored as a soft reflection
      const n = 56, bw = W / n;
      for (let i = 0; i < n; i++) {
        const v = specAt(i, n);
        const h = v * H * 0.5 * (0.6 + ctrl.pulse) + 2;
        ctx.fillStyle = colr(i / n, 0.35 + v * 0.55);
        // v113: glow-coupled peaks so bars read as DNA-bloom, not a flat equalizer
        ctx.shadowBlur = v > 0.5 ? 6 + S.beat * 12 : 0;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillRect(i * bw + bw * 0.16, H - h, bw * 0.68, h);
        ctx.shadowBlur = 0;   // reflection stays flat, no glow
        ctx.globalAlpha = LB.opacity * 0.18;
        ctx.fillRect(i * bw + bw * 0.16, H, bw * 0.68, h * 0.5);   // reflection
        ctx.globalAlpha = LB.opacity;
      }
      break;
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node test.js`
Expected: `0 failed`.

- [ ] **Step 7: Manual visual check**

Run: `npm start`, enable Layer B (`lbOn`), cycle `lbType` through `grid`, `waveform`, `bars` with the demo track playing. Confirm loud peaks visibly glow instead of showing flat, hard-edged shapes, and that overall FPS doesn't visibly drop (shadowBlur is gated behind a peak threshold in `grid`/`bars` specifically to keep this cheap).

- [ ] **Step 8: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "v113: glow-coupled peaks for bars/grid/waveform Layer B overlays"
```

---

### Task 4: Font bundle — 6 self-hosted fonts

**Files:**
- Create: `assets/fonts/space-grotesk-500.woff2`, `space-grotesk-700.woff2`
- Create: `assets/fonts/fraunces-400.woff2`, `fraunces-700.woff2`
- Create: `assets/fonts/jetbrains-mono-500.woff2`, `jetbrains-mono-700.woff2`
- Create: `assets/fonts/anton-400.woff2`
- Create: `assets/fonts/caveat-500.woff2`, `caveat-700.woff2`
- Create: `assets/fonts/bricolage-grotesque-500.woff2`, `bricolage-grotesque-800.woff2`
- Modify: `elastic-morph.html:30` (`<style>` — add `@font-face` rules)
- Modify: `elastic-morph.html:5825-5830` (`TEXT_FONTS`)
- Modify: `elastic-morph.html:1171-1177` (`<select id="textFont">`)
- Modify: `sw.js` (`ASSETS` array + `CACHE` version)
- Modify: `test.js`

**Interfaces:**
- Consumes: none.
- Produces: 6 new `TEXT_FONTS` keys (`sansAlt`, `serifAlt`, `monoAlt`, `condensed`, `handwritten`, `variable`), each `{ tw, aw, fam, upper, spacing }` matching the existing entry shape (see `sans`/`serif`/`mono`/`poster` at line 5826-5829). Consumed by `drawTextLayer` via `TEXT_FONTS[S.textFont]` — no changes needed there, it already looks up by key.

- [ ] **Step 1: Add the failing test assertions**

In `test.js`, extend the `v113` section with:

```js
["sansAlt", "serifAlt", "monoAlt", "condensed", "handwritten", "variable"].forEach(k =>
  ok("TEXT_FONTS has " + k, new RegExp("\\b" + k + ":\\s*\\{[^}]*fam:").test(script)));
["sansAlt", "serifAlt", "monoAlt", "condensed", "handwritten", "variable"].forEach(k =>
  ok("<option> for " + k + " exists", html.includes('value="' + k + '"')));
const FONT_FILES = ["space-grotesk-500", "space-grotesk-700", "fraunces-400", "fraunces-700",
  "jetbrains-mono-500", "jetbrains-mono-700", "anton-400", "caveat-500", "caveat-700",
  "bricolage-grotesque-500", "bricolage-grotesque-800"];
FONT_FILES.forEach(f => ok("font file exists: " + f, fs.existsSync(path.join(__dirname, "assets/fonts", f + ".woff2"))));
FONT_FILES.forEach(f => ok("font file under 40KB: " + f, (() => {
  const p = path.join(__dirname, "assets/fonts", f + ".woff2");
  return fs.existsSync(p) && fs.statSync(p).size < 40 * 1024;
})()));
ok("@font-face rules present for all 6 families", ["Space Grotesk", "Fraunces", "JetBrains Mono", "Anton", "Caveat", "Bricolage Grotesque"]
  .every(fam => html.includes('font-family: "' + fam + '"') || html.includes("font-family: " + fam + ";")));
const swSrc = fs.readFileSync(path.join(__dirname, "sw.js"), "utf8");
FONT_FILES.forEach(f => ok("sw.js precaches " + f, swSrc.includes(f + ".woff2")));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all new checks in this task print `✗` (font files don't exist yet, no `@font-face`, no `TEXT_FONTS` keys, no `<option>`s).

- [ ] **Step 3: Download the font files**

```bash
cd "/Users/frankkrumsdorf/Desktop/Elastic Morph Cursor"
mkdir -p assets/fonts
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

fetch_weights() {
  # $1 = Google Fonts family query (e.g. "Space+Grotesk:wght@500;700")
  # $2 = output basename (e.g. "space-grotesk")
  # $3.. = weight labels in the same order as the query (e.g. 500 700)
  local query="$1" base="$2"; shift 2
  local css urls i=0
  css=$(curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=${query}&display=swap")
  urls=$(echo "$css" | grep -oE "https://fonts\.gstatic\.com/[^)]+\.woff2")
  for w in "$@"; do
    i=$((i+1))
    u=$(echo "$urls" | sed -n "${i}p")
    if [ -z "$u" ]; then echo "MISSING weight $w for $base" >&2; continue; fi
    curl -s -o "assets/fonts/${base}-${w}.woff2" "$u"
  done
}

fetch_weights "Space+Grotesk:wght@500;700" "space-grotesk" 500 700
fetch_weights "Fraunces:wght@400;700" "fraunces" 400 700
fetch_weights "JetBrains+Mono:wght@500;700" "jetbrains-mono" 500 700
fetch_weights "Anton" "anton" 400
fetch_weights "Caveat:wght@500;700" "caveat" 500 700
fetch_weights "Bricolage+Grotesque:wght@500;800" "bricolage-grotesque" 500 800

ls -la assets/fonts/
```

Expected: 11 `.woff2` files listed, each roughly 10–35 KB. If any file is 0 bytes or missing, re-run `fetch_weights` for that family alone — Google occasionally rate-limits rapid sequential requests; add `sleep 1` between calls if that happens.

- [ ] **Step 4: Verify file sizes**

```bash
find assets/fonts -name "*.woff2" -size +40k
```

Expected: no output (empty = all files under 40 KB). If a file is over, drop the `display=swap` CSS's `unicode-range` isn't the issue — instead request a narrower weight or accept the slightly larger file for that one family (variable-heavy families like Bricolage Grotesque may run larger; note it in the commit message if so, don't block on it).

- [ ] **Step 5: Add `@font-face` rules**

In `elastic-morph.html`, find (line 30, the unique `<style>` opening tag):

```html
<style>
```

Replace with:

```html
<style>
  /* v113: self-hosted font bundle for the text designer — offline-safe, no CDN request */
  @font-face { font-family: "Space Grotesk"; src: url("assets/fonts/space-grotesk-500.woff2") format("woff2"); font-weight: 500; font-display: swap; }
  @font-face { font-family: "Space Grotesk"; src: url("assets/fonts/space-grotesk-700.woff2") format("woff2"); font-weight: 700; font-display: swap; }
  @font-face { font-family: "Fraunces"; src: url("assets/fonts/fraunces-400.woff2") format("woff2"); font-weight: 400; font-display: swap; }
  @font-face { font-family: "Fraunces"; src: url("assets/fonts/fraunces-700.woff2") format("woff2"); font-weight: 700; font-display: swap; }
  @font-face { font-family: "JetBrains Mono"; src: url("assets/fonts/jetbrains-mono-500.woff2") format("woff2"); font-weight: 500; font-display: swap; }
  @font-face { font-family: "JetBrains Mono"; src: url("assets/fonts/jetbrains-mono-700.woff2") format("woff2"); font-weight: 700; font-display: swap; }
  @font-face { font-family: "Anton"; src: url("assets/fonts/anton-400.woff2") format("woff2"); font-weight: 400; font-display: swap; }
  @font-face { font-family: "Caveat"; src: url("assets/fonts/caveat-500.woff2") format("woff2"); font-weight: 500; font-display: swap; }
  @font-face { font-family: "Caveat"; src: url("assets/fonts/caveat-700.woff2") format("woff2"); font-weight: 700; font-display: swap; }
  @font-face { font-family: "Bricolage Grotesque"; src: url("assets/fonts/bricolage-grotesque-500.woff2") format("woff2"); font-weight: 500; font-display: swap; }
  @font-face { font-family: "Bricolage Grotesque"; src: url("assets/fonts/bricolage-grotesque-800.woff2") format("woff2"); font-weight: 800; font-display: swap; }
```

- [ ] **Step 6: Add `TEXT_FONTS` entries**

In `elastic-morph.html`, find (around line 5825):

```js
const TEXT_FONTS = {
  sans:   { tw: 600, aw: 400, fam: `-apple-system, "Segoe UI", Inter, sans-serif`, upper: false, spacing: 0 },
  serif:  { tw: 400, aw: 400, fam: `Georgia, "Times New Roman", serif`, upper: false, spacing: 0.5 },
  mono:   { tw: 500, aw: 400, fam: `"SF Mono", Menlo, Consolas, monospace`, upper: false, spacing: 1 },
  poster: { tw: 900, aw: 600, fam: `-apple-system, "Segoe UI", "Arial Black", sans-serif`, upper: true, spacing: 2 },
  custom: { tw: 600, aw: 400, fam: `"ElasticUserFont", -apple-system, sans-serif`, upper: false, spacing: 0 }   // v53: user-uploaded font
};
```

Replace with:

```js
const TEXT_FONTS = {
  sans:   { tw: 600, aw: 400, fam: `-apple-system, "Segoe UI", Inter, sans-serif`, upper: false, spacing: 0 },
  serif:  { tw: 400, aw: 400, fam: `Georgia, "Times New Roman", serif`, upper: false, spacing: 0.5 },
  mono:   { tw: 500, aw: 400, fam: `"SF Mono", Menlo, Consolas, monospace`, upper: false, spacing: 1 },
  poster: { tw: 900, aw: 600, fam: `-apple-system, "Segoe UI", "Arial Black", sans-serif`, upper: true, spacing: 2 },
  /* v113: self-hosted font bundle */
  sansAlt:     { tw: 700, aw: 500, fam: `"Space Grotesk", -apple-system, sans-serif`, upper: false, spacing: 0 },
  serifAlt:    { tw: 700, aw: 400, fam: `Fraunces, Georgia, serif`, upper: false, spacing: 0.3 },
  monoAlt:     { tw: 700, aw: 500, fam: `"JetBrains Mono", "SF Mono", monospace`, upper: false, spacing: 0.5 },
  condensed:   { tw: 400, aw: 400, fam: `Anton, "Arial Black", sans-serif`, upper: true, spacing: 1 },
  handwritten: { tw: 700, aw: 500, fam: `Caveat, cursive`, upper: false, spacing: 0 },
  variable:    { tw: 800, aw: 500, fam: `"Bricolage Grotesque", -apple-system, sans-serif`, upper: false, spacing: 0 },
  custom: { tw: 600, aw: 400, fam: `"ElasticUserFont", -apple-system, sans-serif`, upper: false, spacing: 0 }   // v53: user-uploaded font
};
```

- [ ] **Step 7: Add `<option>`s to the font select**

In `elastic-morph.html`, find (around line 1171):

```html
          <select id="textFont">
            <option value="sans" selected>Modern Sans</option>
            <option value="serif">Light Serif</option>
            <option value="mono">Mono / Tech</option>
            <option value="poster">Black Poster</option>
            <option value="custom" id="fontCustomOpt" disabled>Eigene Schrift…</option>
          </select>
```

Replace with:

```html
          <select id="textFont">
            <option value="sans" selected>Modern Sans</option>
            <option value="serif">Light Serif</option>
            <option value="mono">Mono / Tech</option>
            <option value="poster">Black Poster</option>
            <option value="sansAlt">Grotesk</option>
            <option value="serifAlt">Fraunces</option>
            <option value="monoAlt">JetBrains Mono</option>
            <option value="condensed">Condensed Black</option>
            <option value="handwritten">Handwritten</option>
            <option value="variable">Bricolage</option>
            <option value="custom" id="fontCustomOpt" disabled>Eigene Schrift…</option>
          </select>
```

- [ ] **Step 8: Update `sw.js`**

Open `sw.js`, find:

```js
const CACHE = "elastic-morph-v112";
const ASSETS = [
  "elastic-morph.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "assets/demo/demo.json"
];
```

Replace with:

```js
const CACHE = "elastic-morph-v113";
const ASSETS = [
  "elastic-morph.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "assets/demo/demo.json",
  "assets/fonts/space-grotesk-500.woff2",
  "assets/fonts/space-grotesk-700.woff2",
  "assets/fonts/fraunces-400.woff2",
  "assets/fonts/fraunces-700.woff2",
  "assets/fonts/jetbrains-mono-500.woff2",
  "assets/fonts/jetbrains-mono-700.woff2",
  "assets/fonts/anton-400.woff2",
  "assets/fonts/caveat-500.woff2",
  "assets/fonts/caveat-700.woff2",
  "assets/fonts/bricolage-grotesque-500.woff2",
  "assets/fonts/bricolage-grotesque-800.woff2"
];
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `node test.js`
Expected: `0 failed`.

- [ ] **Step 10: Manual visual check**

Run: `npm start`, open the text designer, select each of the 6 new fonts in `#textFont`, confirm each renders visibly distinct (not falling back to system sans — check DevTools Network tab shows the `.woff2` requests succeeding, not 404). Reload with DevTools offline mode on (after one online load, so the SW has precached) and confirm fonts still render.

- [ ] **Step 11: Commit**

```bash
git add assets/fonts elastic-morph.html sw.js test.js
git commit -m "v113: add 6 self-hosted fonts to the text designer"
```

---

### Task 5: Correct the spec's build-process description

**Files:**
- Modify: `SPEC-visual-polish-v113.md` (the "Umsetzung" section)

**Interfaces:** None — documentation-only fix so the committed spec matches what was actually built.

- [ ] **Step 1: Fix the "Umsetzung" section**

Find in `SPEC-visual-polish-v113.md`:

```markdown
## Umsetzung

- Neues Modul `src/inject-v113.js`, in `build.js` `MODULES`-Array + `APP_VERSION` (112 → 113)
  eintragen, dann `node build.js` ausführen.
- `sw.js` Cache-Version wird durch `build.js` automatisch mitgezogen.
- Bestehende Tests (`test.js`, Playwright E2E) laufen lassen — keine der drei Änderungen
  greift in DOM-Struktur/IDs ein, die von Tests referenziert werden (nur neue `<option>`s).
```

Replace with:

```markdown
## Umsetzung

- Alle Zielstellen (Bloom-Pass, `drawLayerB`-Cases, `TEXT_FONTS`, `#textFont`-Select) liegen im
  statischen Bereich von `elastic-morph.html` (vor dem `/* @BUILD-INJECT-V58 */`-Marker in
  Zeile 8483) — dieser Bereich wird von `build.js` nicht angefasst (das Skript regeneriert nur
  den Marker-bis-Boot-Block aus `src/inject-v*.js`). Direkte Edits an `elastic-morph.html`,
  **kein** neues `src/inject-v113.js`-Modul, **kein** `build.js`/`APP_VERSION`-Change nötig.
- `sw.js`-Cache-Version wird manuell auf `elastic-morph-v113` gesetzt (Fonts kommen neu in die
  `ASSETS`-Liste).
- Bestehende Tests (`test.js`) laufen lassen — keine der drei Änderungen greift in DOM-Struktur/
  IDs ein, die von Tests referenziert werden (nur neue `<option>`s + neue `@font-face`-Regeln).
```

- [ ] **Step 2: Commit**

```bash
git add SPEC-visual-polish-v113.md
git commit -m "docs: correct v113 spec build-process description"
```

---

## Final Verification (after all 5 tasks)

- [ ] Run `node test.js` — expect `0 failed`.
- [ ] Run `npm run test:e2e` (Playwright) if a browser is available in this environment — expect no new failures versus the pre-change baseline. Skip if Playwright browsers aren't installed here; note that explicitly rather than silently skipping.
- [ ] `git log --oneline -6` shows 5 commits (bloom, layer-B weighting, layer-B glow, fonts, spec fix), each with a clean `git status` afterward.
