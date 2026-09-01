# FX Rack IV "Warp / Verzerrungsfeld" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th FX rack to Elastic Morph — 5 pixel-displacement "Warp" effects (Liquid Ripple,
Fisheye Pulse, Horizontal Melt, Page Warp, Wave Mirror) on Cmd/Meta+1–0.

**Architecture:** One cohesive addition to `elastic-morph.html`, entirely in the untouched
pre-marker region (never touching the marker-to-boot span `build.js` regenerates from `src/`),
plus one required edit to an existing function that genuinely lives inside that regenerated span
(`silenceFxForCover()` in `src/inject-v102.js`), followed by `node build.js` to propagate it.

**Tech Stack:** Vanilla JS, Canvas 2D (`ctx`, shared `fxC` snapshot canvas), this codebase's
existing FX-rack conventions (`FX_DEFS`-style definition arrays, `S.fxN` boolean-flag state,
`toggleFXN`/`syncFXN UI`/`buildFXN`/`applyPostFXN` per-rack quartet).

## Global Constraints

- Key binding: **Cmd/Meta+1–0**. Converts the existing `!e.metaKey` guard on Rack I's dispatch
  into a real `e.metaKey` branch.
- Exactly 5 effects this round (`ripple`, `fisheye`, `melt`, `pagewarp`, `wavemirror`) — slots 6–10
  stay unused. The other 5 originally-brainstormed candidates are explicitly deferred, not part of
  this plan.
- **All genuinely new code (state, definitions, functions) goes in the pre-marker region of
  `elastic-morph.html`** — confirmed fresh: `@BUILD-INJECT-V58` at line 10913, `/* ---- boot ---- */`
  at line 18324. Nothing new in this plan goes between those two lines. The one exception is a
  edit to an *existing* function, `silenceFxForCover()`, which genuinely lives in
  `src/inject-v102.js` (declared there, mirrored into the regenerated span) — that edit goes in
  the `src/` file directly, never as a hand-edit of the mirror in `elastic-morph.html`.
- No new CSS — reuse the existing global `.fxchip`/`.fxchip.on` classes.
- No dynamic `S.perfScale`-based quality reduction for these effects this round (YAGNI, per spec
  Non-Goals).
- No Set/Cue-list integration for Rack IV (matches existing precedent: Rack III was never added to
  the cue-capture mechanism either).
- No `brightFxActive()` change — none of the 5 effects are additive/screen-composited.

---

## Context (verified fresh immediately before writing this plan)

Every insertion point below was re-confirmed via `grep -n` moments before writing this plan — all
match the design spec's citations exactly, zero drift since the spec was written:

| # | What | Line (confirmed) |
|---|---|---|
| A | `fx2Spin: 0, fx2Breath: 0,` (state init anchor) | 2932 |
| B | `function toggleFX3(key) {` (new-code insertion anchor) | 8263 |
| C | `} else if (e.key >= "0" && e.key <= "9") {` (keydown anchor) | 9843 |
| D | `fx3: { ...S.fx3 },` (projectData save anchor) | 8381 |
| E | `if (o.fx3) for (const k in S.fx3) S.fx3[k] = !!o.fx3[k];` (applyProject load anchor) | 8441 |
| F | `const safe3 = [...]` / `const nSafe = Math.floor(R() * 3);` (Auto-VJ anchors) | 10394 / 10400 |
| G | `<div id="fx3Chips"></div>` (HTML markup anchor) | 1762 |
| H | `applyPostFX3(W, H, dt);` (render chain anchor) | 6036 |
| I | `buildFX3();` (post-boot init anchor) | 18328 |
| J | `function silenceFxForCover() {` in `src/inject-v102.js` | 11 |

`@BUILD-INJECT-V58` at 10913, `/* ---- boot ---- */` at 18324 — every anchor A–I is well below
10913 (pre-marker, safe to edit directly). J is the one function that lives inside the regenerated
span (11358–11498-ish territory in the assembled file) but is *declared* in `src/inject-v102.js`.

Baseline: `node test.js` run fresh — **651 passed, 0 failed.**

---

## Task 1: FX Rack IV — state, rack machinery, dispatch, integration, tests

**Files:**
- Modify: `elastic-morph.html` (9 separate pre-marker edits — see table above; re-verify each with
  a fresh `grep -n` immediately before editing, since line numbers drift between sessions)
- Modify: `src/inject-v102.js` (1 edit to an existing function)
- Test: `test.js` (append a new section)

**Interfaces:**
- Produces: `FX4_DEFS` (array of `[key, label, desc]`, 5 entries), `S.fx4` (boolean-flag object,
  keys `ripple`/`fisheye`/`melt`/`pagewarp`/`wavemirror`), `S.fx4MeltPhase` (number, starts `0`),
  `buildFX4()`, `toggleFX4(key)`, `syncFX4UI()`, `applyPostFX4(W, H, dt)` — matching the exact
  signatures/shapes of the existing `FX2_DEFS`/`S.fx2`/`buildFX2`/`toggleFX2`/`syncFX2UI`/
  `applyPostFX2` quartet.
- Consumes: `$(id)` (DOM lookup helper), `snapshot(W, H)` / `fxC` (shared snapshot canvas, already
  used by every existing rack), `fract1` (seeded-hash helper, `const fract1 = x => x -
  Math.floor(x);`), `S.time`/`S.beat`/`S.bass`/`S.mids` (existing audio-reactive state), `ctx`
  (2D drawing context), `R()` (Auto-VJ's seeded RNG, already used by `safe1`/`safe2`/`safe3`).

- [ ] **Step 1: Re-verify every anchor fresh**

Run:
```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
grep -n "@BUILD-INJECT-V58\|---- boot ----" elastic-morph.html
grep -n "fx2Spin: 0, fx2Breath: 0," elastic-morph.html
grep -n "^function toggleFX3" elastic-morph.html
grep -n 'e.key >= "0" && e.key <= "9"' elastic-morph.html
grep -n "fx3: { \.\.\.S.fx3 }," elastic-morph.html
grep -n "if (o.fx3) for" elastic-morph.html
grep -n 'const safe3 = \|const nSafe = ' elastic-morph.html
grep -n 'id="fx3Chips"' elastic-morph.html
grep -n "applyPostFX3(W, H, dt);" elastic-morph.html
grep -n "^buildFX3();" elastic-morph.html
grep -n "function silenceFxForCover" src/inject-v102.js
```
Expected: marker/boot at 10913/18324 (or nearby — if they've moved, confirm every other anchor is
still below the marker line before proceeding); every other anchor matches the Context table above
(or close to it — a small drift is fine, an anchor landing on the wrong side of the marker is not:
stop and re-derive the correct pre-marker insertion point if that happens).

- [ ] **Step 2: State init — `S.fx4` + phase accumulator**

Find (`elastic-morph.html:2932`):
```js
  fx2Spin: 0, fx2Breath: 0,
```
Replace:
```js
  fx2Spin: 0, fx2Breath: 0,
  // v139: fourth FX rack — Warp / Verzerrungsfeld (Cmd+1..0)
  fx4: { ripple: false, fisheye: false, melt: false, pagewarp: false, wavemirror: false },
  fx4MeltPhase: 0,
```

- [ ] **Step 3: New rack machinery — `FX4_DEFS` + `buildFX4`/`toggleFX4`/`syncFX4UI`/`applyPostFX4`**

Find (`elastic-morph.html:8263-8267`):
```js
function toggleFX3(key) {
  S.fx3[key] = !S.fx3[key];
  syncFX3UI();
}

/* ---- particle mode controls ---- */
```
Replace:
```js
function toggleFX3(key) {
  S.fx3[key] = !S.fx3[key];
  syncFX3UI();
}

// v139: fourth FX rack — Warp / Verzerrungsfeld (Cmd+1..0). Deliberately placed here,
// before the @BUILD-INJECT-V58 marker, not next to Rack III above — buildFX3/syncFX3UI/
// applyPostFX3 all live INSIDE the marker-to-boot span build.js regenerates from
// src/inject-vNN.js on every deploy; genuinely new code always goes in the untouched
// pre-marker region in this codebase, regardless of which existing code it resembles.
const FX4_DEFS = [
  ["ripple",     "Liquid Ripple",   "concentric rings, beat-driven"],
  ["fisheye",    "Fisheye Pulse",   "barrel bulge, beat-driven"],
  ["melt",       "Horizontal Melt", "vertical drip distortion, bass-driven"],
  ["pagewarp",   "Page Warp",       "single flag-wave bend, mids-driven"],
  ["wavemirror", "Wave Mirror",     "banded sine offset, stronger at the edges"]
];
function buildFX4() {
  const chips = $("fx4Chips"); if (!chips) return;
  FX4_DEFS.forEach(([key, label, desc]) => {
    const chip = document.createElement("div");
    chip.className = "fxchip"; chip.textContent = label; chip.dataset.fx4 = key;
    chip.title = desc;
    chip.addEventListener("click", () => toggleFX4(key));
    chips.appendChild(chip);
  });
}
function toggleFX4(key) {
  S.fx4[key] = !S.fx4[key];
  syncFX4UI();
}
function syncFX4UI() {
  document.querySelectorAll("[data-fx4]").forEach(el =>
    el.classList.toggle("on", !!S.fx4[el.dataset.fx4]));
}
function applyPostFX4(W, H, dt) {
  const fx = S.fx4;
  let any = false;
  for (const k in fx) if (fx[k]) { any = true; break; }
  if (!any) return;
  const cx = W / 2, cy = H / 2, maxR = Math.hypot(cx, cy);

  // Liquid Ripple — concentric rings oscillate outward from center, beat-driven
  if (fx.ripple) {
    snapshot(W, H);
    const rings = 24, amp = 0.01 + S.beat * 0.025;
    ctx.save();
    for (let i = 0; i < rings; i++) {
      const t0 = i / rings, t1 = (i + 1) / rings;
      const s = 1 + Math.sin(S.time * 3 - t0 * Math.PI * 4) * amp * (1 - t0 * 0.3);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * t1, 0, Math.PI * 2);
      ctx.arc(cx, cy, maxR * t0, 0, Math.PI * 2, true);
      ctx.clip();
      ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
      ctx.drawImage(fxC, 0, 0, W, H);
      ctx.restore();
    }
    ctx.restore();
  }

  // Fisheye Pulse — monotone center bulge (barrel distortion), pulses on beat
  if (fx.fisheye) {
    snapshot(W, H);
    const rings = 24, bulge = 0.05 + S.beat * 0.08;
    ctx.save();
    for (let i = 0; i < rings; i++) {
      const t0 = i / rings, t1 = (i + 1) / rings;
      const s = 1 + bulge * (1 - t0) * (1 - t0);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * t1, 0, Math.PI * 2);
      ctx.arc(cx, cy, maxR * t0, 0, Math.PI * 2, true);
      ctx.clip();
      ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
      ctx.drawImage(fxC, 0, 0, W, H);
      ctx.restore();
    }
    ctx.restore();
  }

  // Horizontal Melt — vertical columns drip downward, speed driven by bass
  if (fx.melt) {
    snapshot(W, H);
    S.fx4MeltPhase += dt * (15 + S.bass * 60);
    const cols = 40, cw = W / cols;
    ctx.save();
    for (let i = 0; i < cols; i++) {
      const phase = fract1(Math.sin(i * 12.9898) * 43758.5453);
      const off = (S.fx4MeltPhase * (0.4 + phase * 0.6) + phase * H) % H;
      const sx = i * cw;
      ctx.drawImage(fxC, sx, 0, cw + 1, H, sx, off, cw + 1, H);
      ctx.drawImage(fxC, sx, 0, cw + 1, H, sx, off - H, cw + 1, H);
    }
    ctx.restore();
  }

  // Page Warp — one continuous wave bends the whole frame, mids-driven
  if (fx.pagewarp) {
    snapshot(W, H);
    const bands = 30, bh = H / bands, amp = W * 0.02 + S.mids * W * 0.05;
    ctx.save();
    for (let i = 0; i < bands; i++) {
      const y0 = i * bh;
      const off = Math.sin(y0 / H * Math.PI + S.time * 1.2) * amp;
      ctx.drawImage(fxC, 0, y0, W, bh + 1, off, y0, W, bh + 1);
    }
    ctx.restore();
  }

  // Wave Mirror — banded sine offset, amplitude grows from center toward the edges
  if (fx.wavemirror) {
    snapshot(W, H);
    const bands = 26, bh = H / bands, baseAmp = W * 0.05 + S.bass * W * 0.06;
    ctx.save();
    for (let i = 0; i < bands; i++) {
      const y0 = i * bh, t = Math.abs(i / bands - 0.5) * 2;
      const off = Math.sin(S.time * 2 + i * 0.5) * baseAmp * t;
      ctx.drawImage(fxC, 0, y0, W, bh + 1, off, y0, W, bh + 1);
      ctx.drawImage(fxC, 0, y0, W, bh + 1, off - Math.sign(off) * W, y0, W, bh + 1);
    }
    ctx.restore();
  }
}

/* ---- particle mode controls ---- */
```

- [ ] **Step 4: Keydown dispatch — convert the `!e.metaKey` guard into a real Cmd+digit branch**

Find (`elastic-morph.html:9843-9851`):
```js
    } else if (e.key >= "0" && e.key <= "9") {
      const idx = e.key === "0" ? 9 : +e.key - 1;
      if (e.ctrlKey) {                       // Ctrl+digit → FX Rack II (geometry)
        const def2 = FX2_DEFS[idx];
        if (def2) { e.preventDefault(); toggleFX2(def2[0]); }
      } else if (!e.metaKey) {               // plain digit → FX Rack I
        const def = FX_DEFS[idx];
        if (def) toggleFX(def[0]);
      }
    }
```
Replace:
```js
    } else if (e.key >= "0" && e.key <= "9") {
      const idx = e.key === "0" ? 9 : +e.key - 1;
      if (e.ctrlKey) {                       // Ctrl+digit → FX Rack II (geometry)
        const def2 = FX2_DEFS[idx];
        if (def2) { e.preventDefault(); toggleFX2(def2[0]); }
      } else if (e.metaKey) {                // Cmd/Meta+digit → FX Rack IV (warp)
        const def4 = FX4_DEFS[idx];
        if (def4) { e.preventDefault(); toggleFX4(def4[0]); }
      } else {                               // plain digit → FX Rack I
        const def = FX_DEFS[idx];
        if (def) toggleFX(def[0]);
      }
    }
```

- [ ] **Step 5: `projectData()` save + `applyProject()` load — round-trip `fx4`**

Find (`elastic-morph.html:8378-8381`):
```js
    ctrl: { ...ctrl },
    fx: { ...S.fx },
    fx2: { ...S.fx2 },
    fx3: { ...S.fx3 },
```
Replace:
```js
    ctrl: { ...ctrl },
    fx: { ...S.fx },
    fx2: { ...S.fx2 },
    fx3: { ...S.fx3 },
    fx4: { ...S.fx4 },
```

Find (`elastic-morph.html:8439-8441`):
```js
  Object.assign(S.fx, o.fx || {});
  if (o.fx2) for (const k in S.fx2) S.fx2[k] = !!o.fx2[k];
  if (o.fx3) for (const k in S.fx3) S.fx3[k] = !!o.fx3[k];
```
Replace:
```js
  Object.assign(S.fx, o.fx || {});
  if (o.fx2) for (const k in S.fx2) S.fx2[k] = !!o.fx2[k];
  if (o.fx3) for (const k in S.fx3) S.fx3[k] = !!o.fx3[k];
  if (o.fx4) for (const k in S.fx4) S.fx4[k] = !!o.fx4[k];
```

- [ ] **Step 6: Auto-VJ — `safe4` pool, clear-all, 4-way `nSafe` pick, final sync**

Find (`elastic-morph.html:10389-10391`):
```js
    Object.keys(S.fx).forEach(k => S.fx[k] = false);
    Object.keys(S.fx2).forEach(k => S.fx2[k] = false);
    Object.keys(S.fx3).forEach(k => S.fx3[k] = false);
```
Replace:
```js
    Object.keys(S.fx).forEach(k => S.fx[k] = false);
    Object.keys(S.fx2).forEach(k => S.fx2[k] = false);
    Object.keys(S.fx3).forEach(k => S.fx3[k] = false);
    Object.keys(S.fx4).forEach(k => S.fx4[k] = false);
```

Find (`elastic-morph.html:10392-10405`):
```js
    const safe1 = ["mirror", "kaleido", "tile", "rgb", "invert", "pixelate", "glitch", "shake"];
    const safe2 = ["hexkaleido", "droste", "mirrorgrid", "slice", "spin", "halftone", "pulsezoom", "posterize"];
    const safe3 = ["scanlines", "motionblur", "letterbox", "chromafringe"];
    // v-fx3-autovj: brightener pool now spans all three racks so "at most one" stays a
    // real invariant — fx3 has 6 additive/screen-composited effects (see brightFxActive).
    const bright = [["fx", "feedback"], ["fx", "strobe"], ["fx2", "radialblur"], ["fx2", "echospin"],
      ["fx3", "anamorphflare"], ["fx3", "bleachpulse"], ["fx3", "doubleexposure"], ["fx3", "dustscratches"],
      ["fx3", "lensflare"], ["fx3", "lightleak"]];
    const nSafe = Math.floor(R() * 3);   // 0–2 safe effects
    for (let i = 0; i < nSafe; i++) {
      const pick = R();
      if (pick < 0.34) S.fx[safe1[Math.floor(R() * safe1.length)]] = true;
      else if (pick < 0.67) S.fx2[safe2[Math.floor(R() * safe2.length)]] = true;
      else S.fx3[safe3[Math.floor(R() * safe3.length)]] = true;
    }
```
Replace:
```js
    const safe1 = ["mirror", "kaleido", "tile", "rgb", "invert", "pixelate", "glitch", "shake"];
    const safe2 = ["hexkaleido", "droste", "mirrorgrid", "slice", "spin", "halftone", "pulsezoom", "posterize"];
    const safe3 = ["scanlines", "motionblur", "letterbox", "chromafringe"];
    const safe4 = ["ripple", "fisheye", "melt", "pagewarp", "wavemirror"];
    // v-fx3-autovj: brightener pool now spans all three racks so "at most one" stays a
    // real invariant — fx3 has 6 additive/screen-composited effects (see brightFxActive).
    // Rack IV is pure distortion (no additive/screen blending), so it joins the safe pick
    // pool below but never the brightener list.
    const bright = [["fx", "feedback"], ["fx", "strobe"], ["fx2", "radialblur"], ["fx2", "echospin"],
      ["fx3", "anamorphflare"], ["fx3", "bleachpulse"], ["fx3", "doubleexposure"], ["fx3", "dustscratches"],
      ["fx3", "lensflare"], ["fx3", "lightleak"]];
    const nSafe = Math.floor(R() * 3);   // 0–2 safe effects
    for (let i = 0; i < nSafe; i++) {
      const pick = R();
      if (pick < 0.25) S.fx[safe1[Math.floor(R() * safe1.length)]] = true;
      else if (pick < 0.5) S.fx2[safe2[Math.floor(R() * safe2.length)]] = true;
      else if (pick < 0.75) S.fx3[safe3[Math.floor(R() * safe3.length)]] = true;
      else S.fx4[safe4[Math.floor(R() * safe4.length)]] = true;
    }
```

Find (`elastic-morph.html:10409`, a few lines further down in the same function):
```js
    syncFXUI(); syncFX2UI(); syncFX3UI();
```
Replace:
```js
    syncFXUI(); syncFX2UI(); syncFX3UI(); syncFX4UI();
```

- [ ] **Step 7: HTML markup — new chip container**

Find (`elastic-morph.html:1760-1763`):
```html
    <h3>FX Rack III — Cinematic <small style="color:var(--text-dim);font-weight:400">(Alt+1–0)</small></h3>
    <div id="fx3Chips"></div>
    <div class="divider"></div>
    <h3>Particle Mode <small style="color:var(--text-dim);font-weight:400">(P)</small></h3>
```
Replace:
```html
    <h3>FX Rack III — Cinematic <small style="color:var(--text-dim);font-weight:400">(Alt+1–0)</small></h3>
    <div id="fx3Chips"></div>
    <div class="divider"></div>
    <h3>FX Rack IV — Warp <small style="color:var(--text-dim);font-weight:400">(Cmd+1–0)</small></h3>
    <div id="fx4Chips"></div>
    <div class="divider"></div>
    <h3>Particle Mode <small style="color:var(--text-dim);font-weight:400">(P)</small></h3>
```

- [ ] **Step 8: Render call chain + post-boot init call**

Find (`elastic-morph.html:6033-6037`):
```js
  applyPostFX(W, H);
  /* --- FX Rack II: geometry / space (Ctrl+1..0) --- */
  applyPostFX2(W, H, dt);
  applyPostFX3(W, H, dt);
  /* --- global auto-exposure: tame whiteouts from stacked additive effects --- */
  applyAutoExposure(W, H);
```
Replace:
```js
  applyPostFX(W, H);
  /* --- FX Rack II: geometry / space (Ctrl+1..0) --- */
  applyPostFX2(W, H, dt);
  applyPostFX3(W, H, dt);
  applyPostFX4(W, H, dt);
  /* --- global auto-exposure: tame whiteouts from stacked additive effects --- */
  applyAutoExposure(W, H);
```

Find (`elastic-morph.html:18326-18328`):
```js
buildFX();
buildFX2();
buildFX3();
```
Replace:
```js
buildFX();
buildFX2();
buildFX3();
buildFX4();
```

- [ ] **Step 9: Run tests, confirm no regressions from Steps 2–8 alone**

Run: `node test.js`
Expected: still 651 passed, 0 failed (no new tests reference the new code yet — this just confirms
the 8 edits above didn't break anything structurally, e.g. a stray brace or a duplicate `id`).

- [ ] **Step 10: `src/inject-v102.js` — the one required edit inside the regenerated span**

Find (`src/inject-v102.js:11-17`):
```js
function silenceFxForCover() {
  Object.keys(S.fx).forEach(k => { S.fx[k] = false; });
  Object.keys(S.fx2).forEach(k => { S.fx2[k] = false; });
  Object.keys(S.fx3).forEach(k => { S.fx3[k] = false; });
  if (typeof syncFXUI === "function") syncFXUI();
  if (typeof syncFX2UI === "function") syncFX2UI();
  if (typeof syncFX3UI === "function") syncFX3UI();
}
```
Replace:
```js
function silenceFxForCover() {
  Object.keys(S.fx).forEach(k => { S.fx[k] = false; });
  Object.keys(S.fx2).forEach(k => { S.fx2[k] = false; });
  Object.keys(S.fx3).forEach(k => { S.fx3[k] = false; });
  Object.keys(S.fx4).forEach(k => { S.fx4[k] = false; });
  if (typeof syncFXUI === "function") syncFXUI();
  if (typeof syncFX2UI === "function") syncFX2UI();
  if (typeof syncFX3UI === "function") syncFX3UI();
  if (typeof syncFX4UI === "function") syncFX4UI();
}
```

- [ ] **Step 11: Regenerate `elastic-morph.html` from `src/`, confirm byte-reproducibility**

Run:
```bash
node build.js
git diff --stat elastic-morph.html
```
Expected: `build.js` prints `✓ Merged ... into elastic-morph.html (v113)`; `git diff --stat` shows
`elastic-morph.html` changed (the `silenceFxForCover` edit propagated into the marker-to-boot
span — this is expected and correct, NOT a sign of drift).

Run a second time to confirm the regeneration itself is now stable:
```bash
node build.js
git diff --stat elastic-morph.html
```
Expected: `git diff --stat` reports **no output** (zero further changes) — proves the regeneration
is byte-reproducible from the now-correct `src/` state, matching this session's established
verification practice for any `src/` touch.

- [ ] **Step 12: Run tests again, confirm still clean before writing new tests**

Run: `node test.js`
Expected: still 651 passed, 0 failed.

- [ ] **Step 13: Write the new test section**

Open `test.js`, find its final `section(...)` block (or the end of the file before any
summary/report code) and append:

```js
section("FX Rack IV — Warp / Verzerrungsfeld (Cmd+1..0)");

ok("FX4_DEFS defined with exactly 5 entries matching the 5 warp effect keys", (() => {
  const idx = script.indexOf("const FX4_DEFS = [");
  if (idx < 0) return false;
  const slice = script.slice(idx, idx + 800);
  return ["ripple", "fisheye", "melt", "pagewarp", "wavemirror"].every(k => slice.includes(`"${k}"`));
})());

ok("S.fx4 state initialized with the 5 warp keys all false, plus fx4MeltPhase: 0",
  script.includes("fx4: { ripple: false, fisheye: false, melt: false, pagewarp: false, wavemirror: false },") &&
  script.includes("fx4MeltPhase: 0,"));

["buildFX4", "toggleFX4", "syncFX4UI", "applyPostFX4"].forEach(fn =>
  ok("function " + fn + " defined", script.includes("function " + fn + "(")));

ok("keydown dispatch has a real e.metaKey branch calling toggleFX4, between the Ctrl (Rack II) branch and the final plain-digit else", (() => {
  const ctrlIdx = script.indexOf('if (e.ctrlKey) {                       // Ctrl+digit');
  const metaIdx = script.indexOf('} else if (e.metaKey) {                // Cmd/Meta+digit');
  const callIdx = script.indexOf("toggleFX4(def4[0]);");
  const elseIdx = script.indexOf("} else {                               // plain digit → FX Rack I");
  return ctrlIdx >= 0 && metaIdx > ctrlIdx && callIdx > metaIdx && elseIdx > callIdx;
})());

ok("the old bare !e.metaKey guard is gone (replaced by the real branch above)",
  !script.includes("} else if (!e.metaKey) {               // plain digit → FX Rack I"));

ok("applyPostFX4 is called in the render chain after applyPostFX3 and before applyAutoExposure", (() => {
  const fx3Idx = script.indexOf("applyPostFX3(W, H, dt);");
  const fx4Idx = script.indexOf("applyPostFX4(W, H, dt);");
  const aeIdx = script.indexOf("applyAutoExposure(W, H);");
  return fx3Idx >= 0 && fx4Idx > fx3Idx && aeIdx > fx4Idx;
})());

ok("buildFX4() is called after buildFX3() in the post-boot init sequence", (() => {
  const b3 = script.indexOf("buildFX3();");
  const b4 = script.indexOf("buildFX4();");
  return b3 >= 0 && b4 > b3;
})());

ok("HTML has the fx4Chips container and a Cmd+1–0 label, positioned after the Rack III block", (() => {
  const fx3Block = script.indexOf('id="fx3Chips"');
  const fx4Label = script.indexOf("FX Rack IV");
  const fx4Chips = script.indexOf('id="fx4Chips"');
  return fx3Block >= 0 && fx4Label > fx3Block && fx4Chips > fx4Label &&
    script.slice(fx4Label, fx4Chips).includes("Cmd+1");
})());

ok("projectData()/applyProject() round-trip fx4 in their pre-marker base functions (before @BUILD-INJECT-V58)", (() => {
  const markerIdx = script.indexOf("/* @BUILD-INJECT-V58 */");
  const saveIdx = script.indexOf("fx4: { ...S.fx4 },");
  const loadIdx = script.indexOf("if (o.fx4) for (const k in S.fx4) S.fx4[k] = !!o.fx4[k];");
  return markerIdx > 0 && saveIdx > 0 && saveIdx < markerIdx && loadIdx > 0 && loadIdx < markerIdx;
})());

ok("Auto-VJ has a safe4 pool with all 5 warp keys, clears S.fx4 with the other racks, and syncs FX4 UI",
  script.includes('const safe4 = ["ripple", "fisheye", "melt", "pagewarp", "wavemirror"];') &&
  script.includes("Object.keys(S.fx4).forEach(k => S.fx4[k] = false);") &&
  script.includes("syncFXUI(); syncFX2UI(); syncFX3UI(); syncFX4UI();"));

ok("Auto-VJ's nSafe pick logic uses the new 4-way split (0.25/0.5/0.75), not the old 3-way one",
  script.includes("if (pick < 0.25) S.fx[safe1[Math.floor(R() * safe1.length)]] = true;") &&
  script.includes("else if (pick < 0.5) S.fx2[safe2[Math.floor(R() * safe2.length)]] = true;") &&
  script.includes("else if (pick < 0.75) S.fx3[safe3[Math.floor(R() * safe3.length)]] = true;") &&
  script.includes("else S.fx4[safe4[Math.floor(R() * safe4.length)]] = true;"));

ok("silenceFxForCover clears S.fx4 and calls syncFX4UI (assembled, post-build.js script)", (() => {
  const idx = script.indexOf("function silenceFxForCover()");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 500);
  return body.includes("Object.keys(S.fx4).forEach(k => { S.fx4[k] = false; });") &&
    body.includes('if (typeof syncFX4UI === "function") syncFX4UI();');
})());

ok("each of the 5 warp effects references its documented audio signal and calls snapshot(W, H)", (() => {
  const idx = script.indexOf("function applyPostFX4(W, H, dt) {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 4000);
  const checks = [
    ["fx.ripple", "S.beat"], ["fx.fisheye", "S.beat"], ["fx.melt", "S.bass"],
    ["fx.pagewarp", "S.mids"], ["fx.wavemirror", "S.bass"]
  ];
  return checks.every(([flag, sig]) => {
    const flagIdx = body.indexOf("if (" + flag + ")");
    if (flagIdx < 0) return false;
    const block = body.slice(flagIdx, flagIdx + 700);
    return block.includes(sig) && block.includes("snapshot(W, H);");
  });
})());
```

Notes for whoever writes this: check `test.js`'s existing `section`/`ok`/`script` variable
conventions first (e.g. how the Rack III or Auto-VJ pool tests were structured, if any exist) and
match the established call signatures exactly — this snippet follows the pattern used throughout
this session's rounds (`script` is the fully-assembled file content, i.e. it already reflects
`node build.js`'s regeneration since that ran in Step 11, before this test file is written).

- [ ] **Step 14: Run the full suite, confirm 668/668**

Run: `node test.js`
Expected: **668 passed, 0 failed** (651 baseline + 17 new assertions: 1 FX4_DEFS + 1 state + 4
function-defined `forEach` iterations + 1 keydown branch + 1 old-guard-gone + 1 render-chain + 1
init-call + 1 HTML + 1 project-roundtrip + 1 auto-vj-safe4 + 1 nSafe-split + 1 silenceFxForCover +
1 effect-signals = 17). If the actual count differs once written (e.g. a helper counts differently,
or an extra structural check turns out necessary), correct this expected total to match reality —
don't force 668 if the honest count is different.

- [ ] **Step 15: Commit**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
git add elastic-morph.html src/inject-v102.js test.js
git commit -m "feat: add FX Rack IV — Warp/Verzerrungsfeld (Cmd+1-0), 5 pixel-displacement effects"
```

---

## Testing Summary

- Structural: all new definitions/state/functions present and correctly named; dispatch, render
  chain, and init wiring all positioned correctly; HTML markup present; project save/load
  round-trips `fx4` specifically in the pre-marker base functions (verified by position relative
  to the `@BUILD-INJECT-V58` marker, not just presence anywhere in the script); Auto-VJ's `safe4`
  pool, clear-all, 4-way pick split, and final UI sync all present; `silenceFxForCover` (assembled,
  post-`build.js` script) clears `fx4` and syncs its UI; each of the 5 effect bodies references its
  documented audio signal and calls `snapshot(W, H)`.
- No canvas-based pixel-behavior tests in `test.js` — Canvas 2D isn't exercisable from Node. That
  verification is the controller's job, done live in the Browser pane after this task ships, per
  the design spec's Live Verification section (not part of this implementer's task).
- `node build.js` run twice in a row after the `src/inject-v102.js` edit must show a diff on the
  first run (the fix propagating) and zero diff on the second (byte-reproducible regeneration).

## Live Verification (controller's job after this task ships — not part of Task 1)

Per the design spec's Live Verification section: toggle each of the 5 effects via keyboard
(Cmd+1–Cmd+5) and via clicking its chip, confirm both agree and the chip's `.on` state updates.
Force each effect's mapped audio signal high/low, confirm the distortion strength tracks it (visual
or pixel-mean sampling). Confirm Cmd+0 (unused slot 10) does nothing and doesn't trigger browser
chrome behavior in the installed PWA. Save a project with 2–3 Rack IV effects active, reload,
confirm they're restored. Trigger a Cover Image export with Rack IV effects active, confirm they're
silenced in the exported image. Run Auto-VJ for a stretch and confirm Rack IV effects appear in
rotation distinctly.
