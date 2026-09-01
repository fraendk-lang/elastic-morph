# FX Rack IV "Warp / Verzerrungsfeld": Design Spec

**Status:** Approved by Frank ("passt" on scope + effects, "leg los" to proceed)
**Date:** 2026-09-01

## Goal

A 4th FX rack for Elastic Morph, on **Cmd/Meta+1–0**, themed "Warp / Verzerrungsfeld" — real
pixel-displacement effects, a genuinely new visual mechanism vs. Racks I–III (which are all
whole-frame affine transforms or static overlays, never per-region displacement). This round
ships **5 of the 10 originally-brainstormed candidates** — the ones that map directly onto this
codebase's already-proven "slice into strips/rings, redraw each with an offset" technique (the
same one Slice Shear and Radial Blur already use in production). The other 5 candidates (Heat
Haze, Vortex Twist, Displacement Noise, Gravity Well, Slit-Scan Drift) need finer resolution or a
different technique with unproven performance — explicitly deferred to a later round once this
round's real cost is measured, mirroring the separate "Performance Check" round that followed
Shader Warp Tunnel.

## Context

*Line numbers are as of this spec's writing (2026-09-01) — re-confirm with a fresh `grep -n`
immediately before editing, this file's numbers drift between sessions.*

**Existing 3-rack pattern**, confirmed by reading the real code:
- Rack I (`FX_DEFS`, plain digits 1–0) and Rack II (`FX2_DEFS`, Ctrl+1–0) — `elastic-morph.html:8164-8262`.
- Rack III (`FX3_DEFS`, Alt+1–0, "Cinematic") — `elastic-morph.html:11358-11498`.
- Each rack: a `[key, label, desc]` definitions array, an `S.fxN` boolean-flag state object, a
  `toggleFXN(key)`/`syncFXN UI()` pair, a `buildFXN()` that renders `.fxchip` DOM elements into a
  container div, and an `applyPostFXN(W, H, dt)` that early-returns if no flag is set, otherwise
  runs one `if (fx.key) { snapshot(W, H); ...draw... }` block per effect. `snapshot(W, H)` copies
  the live canvas into the shared `fxC` snapshot canvas so each effect (and, when several are
  active, each subsequent effect in the same rack) redraws from a fresh copy of "what's on screen
  right now" — established chaining behavior, unchanged by this round.
- Slice Shear (`elastic-morph.html:7207-7216`, Rack II) is the direct technical ancestor for 3 of
  the 5 new effects: 26 horizontal bands, each redrawn via 2 `drawImage` calls (a sine-offset copy
  plus a same-width wraparound copy so the seam never shows a gap) — `off - Math.sign(off) * W`.
  Radial Blur (`elastic-morph.html:7190-7204`, Rack II) is the ancestor for the 2 ring-based
  effects: N scaled copies drawn from center, already proven cheap at n=8; this round uses clipped
  annuli instead of full-frame overlays so each ring only affects its own radius band.

**Critical build-pipeline finding (changes where this round's code can safely live) — the
existing [[project_morph_build_pipeline_gotcha]] memory applies directly here, confirmed fresh
just now, not assumed from memory:**
`build.js` finds `/* @BUILD-INJECT-V58 */` (currently line **10913**) and replaces everything up
to `/* ---- boot ---- */` (currently line **18324**) with the concatenated contents of ~50
`src/inject-vNN.js` files, every time `npm run ci` runs (Vercel's real build step). Checked where
Rack III's own machinery actually lives: **`FX3_DEFS`, `buildFX3()`, `syncFX3UI()`, and
`applyPostFX3()` are themselves inside that regenerated span** (11358–11498, between the marker
and boot). Placing Rack IV's new code textually next to Rack III (the most thematically similar
existing code) would put it inside the same regenerated span — it would work perfectly under
local `npm start` (which never runs `build.js`) and then get **silently wiped on the next real
deploy**, exactly the failure class the existing gotcha memory documents.

Per that memory's established mitigation (used successfully by every DNA-engine round this
session): **genuinely new code always goes in the untouched pre-marker region**, regardless of
which existing code it's thematically closest to. Confirmed a safe, pre-marker insertion point
right after `toggleFX3()` (`elastic-morph.html:8263-8266`, itself pre-marker even though
`buildFX3`/`syncFX3UI`/`applyPostFX3` are not — this file's rack machinery is inconsistently split
across the marker boundary depending on when each rack was originally added).

Also checked, since a pre-marker *existing* function is only safe to edit if nothing later
reassigns it (the memory's documented 3rd/"inverted" failure mode): `autoVjStep()` (the Auto-VJ
function whose `safe1`/`safe2`/`safe3` pools this round extends) has zero `autoVjStep = function`
reassignments anywhere in the file — safe to edit directly. `projectData()`/`applyProject()`
(the pre-marker base functions at `elastic-morph.html:8366`/`8415`) **are** reassigned 5 times
each, post-marker, in `src/inject-v76.js`/`v77.js`/`v78.js`/`v99.js`/`v100.js` — but every single
one follows the same additive delegate-and-extend shape (`const _projectData = projectData;
projectData = function () { const d = _projectData(); d.newField = ...; return d; };`), confirmed
by reading all 5. The pre-marker base function is always the innermost call in that chain and
genuinely executes — editing it directly to add an `fx4` field is safe and takes effect.

One existing function genuinely needs editing and genuinely lives in the regenerated span:
**`silenceFxForCover()`** (clears all FX before a Cover Image export) is declared in
`src/inject-v102.js:11-17` — this one edit must go in that file, followed by `node build.js` to
regenerate the mirror, never edited directly in `elastic-morph.html`.

**Cmd+digit feasibility**, confirmed by reading the actual keydown handler
(`elastic-morph.html:9793-9852`): the digit dispatch already special-cases Ctrl (Rack II) and Alt
(Rack III, via `e.code` since macOS remaps `e.key` under Option) — and has a **pre-existing
defensive `!e.metaKey` guard** on the plain-digit (Rack I) branch, meaning Cmd+digit currently does
*nothing* (silently falls through). A separate, unrelated keydown listener
(`elastic-morph.html:10080-10084`, Cmd/Ctrl+Z/Y undo-redo) only calls `preventDefault()` for `z`/`y`
specifically — confirmed no interference with digit keys. Cmd does not remap `e.key` on macOS the
way Option does, so the same `e.key` string-comparison Ctrl+digit already uses works unmodified for
Cmd+digit.

## Design

**1. Key binding: Cmd/Meta+1–0.** Converts the existing `!e.metaKey` guard into a real
`e.metaKey` branch (Frank's explicit choice — see Context above for the feasibility basis).

**2. Five effects, all built on the two proven techniques above:**

| Effect | Key | Technique | Audio mapping |
|---|---|---|---|
| Liquid Ripple | `ripple` | 24 clipped concentric rings, oscillating scale (ring-ancestor: Radial Blur) | `S.beat` → amplitude |
| Fisheye Pulse | `fisheye` | Same ring technique, monotone bulge (center out) instead of oscillation | `S.beat` → bulge strength |
| Horizontal Melt | `melt` | Slice Shear rotated 90°: vertical columns drip downward (not side-to-side), same full-height wraparound trick | `S.bass` → drip speed |
| Page Warp | `pagewarp` | Slice Shear's band loop, but ONE continuous sine phase across all bands (not per-band phase) — reads as a single coherent bend, not a banded wobble | `S.mids` → amplitude |
| Wave Mirror | `wavemirror` | Slice Shear unchanged, except amplitude scales by distance-from-center (`\|i/bands − 0.5\|·2`) so the middle stays still and edges wobble most | `S.bass` → amplitude |

**3. Auto-VJ integration.** New hand-curated `safe4` pool (all 5 effects — none of them are
additive/screen-blended, so none join the existing `bright` brightener list, and
`brightFxActive()` needs no change). The existing 3-way `nSafe` pick (`< 0.34` / `< 0.67` / else)
becomes a 4-way even split (`< 0.25` / `< 0.5` / `< 0.75` / else).

**4. UI.** New `<h3>FX Rack IV — Warp (Cmd+1–0)</h3>` + `<div id="fx4Chips">` block in the control
panel, inserted after Rack III's block, before Particle Mode — identical shape to Racks II/III,
reusing the existing global `.fxchip`/`.fxchip.on` CSS (no new styles needed).

**5. Project save/load + Cover Export silence.** `fx4` gets the exact same treatment `fx2`/`fx3`
already get in `projectData()`/`applyProject()` (round-trips through saved projects and share
links) and in `silenceFxForCover()` (cleared before any Cover Image export, matching Racks I–III).

## Non-Goals

- **The other 5 candidate effects** (Heat Haze, Vortex Twist, Displacement Noise, Gravity Well,
  Slit-Scan Drift) — deferred to a later round pending real performance numbers, per Frank's choice.
- **No dynamic `S.perfScale`-based quality reduction** (e.g. fewer rings/bands under load, the way
  Halftone reduces its grid size) — YAGNI for this round; revisit only if a future performance
  check finds a real problem, matching this session's established "measure, then fix" pattern.
- **No Set/Cue-list integration** — the existing cue-capture mechanism
  (`elastic-morph.html:8427`/`10624`/`11005`, `cue.fx = {a, b}`) only ever captured Racks I and II;
  Rack III was never added to it either. Rack IV following that same precedent (not captured) is
  consistent with existing scope, not a new gap.
- **No `brightFxActive()` change** — none of the 5 effects are additive/screen-composited.
- **No new CSS** — `.fxchip`/`.fxchip.on` are already global/shared across all racks.

## Exact Code

### A) State init — new `S.fx4` + phase accumulator (`elastic-morph.html:2932`, right after `fx2Spin: 0, fx2Breath: 0,`)

Find:
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

### B) New rack machinery — `FX4_DEFS` + `buildFX4`/`toggleFX4`/`syncFX4UI`/`applyPostFX4` (`elastic-morph.html:8263-8267`, right after `toggleFX3`, before the particle-mode comment)

Find:
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

### C) Keydown dispatch — convert the `!e.metaKey` guard into a real Cmd+digit branch (`elastic-morph.html:9843-9851`)

Find:
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

### D) `projectData()` save — round-trip `fx4` (`elastic-morph.html:8381`, right after `fx3: { ...S.fx3 },`)

Find:
```js
    fx: { ...S.fx },
    fx2: { ...S.fx2 },
    fx3: { ...S.fx3 },
    master: { ...S.master },
```
Replace:
```js
    fx: { ...S.fx },
    fx2: { ...S.fx2 },
    fx3: { ...S.fx3 },
    fx4: { ...S.fx4 },
    master: { ...S.master },
```

### E) `applyProject()` load — round-trip `fx4` (`elastic-morph.html:8440-8441`, right after the `o.fx3` line)

Find:
```js
  Object.assign(S.fx, o.fx || {});
  if (o.fx2) for (const k in S.fx2) S.fx2[k] = !!o.fx2[k];
  if (o.fx3) for (const k in S.fx3) S.fx3[k] = !!o.fx3[k];
  if (o.master) Object.assign(S.master, o.master);
```
Replace:
```js
  Object.assign(S.fx, o.fx || {});
  if (o.fx2) for (const k in S.fx2) S.fx2[k] = !!o.fx2[k];
  if (o.fx3) for (const k in S.fx3) S.fx3[k] = !!o.fx3[k];
  if (o.fx4) for (const k in S.fx4) S.fx4[k] = !!o.fx4[k];
  if (o.master) Object.assign(S.master, o.master);
```

### F) Auto-VJ — `safe4` pool + 4-way `nSafe` pick (`elastic-morph.html:10392-10406`)

Find:
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

Also, a few lines above this same block (`elastic-morph.html:10389-10391`), the "clear all racks"
step and the final UI-sync call need `fx4` added too:

Find:
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
Find:
```js
    syncFXUI(); syncFX2UI(); syncFX3UI();
```
Replace:
```js
    syncFXUI(); syncFX2UI(); syncFX3UI(); syncFX4UI();
```

### G) HTML markup — new chip container (`elastic-morph.html:1760-1763`)

Find:
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

### H) Render call chain — invoke `applyPostFX4` (`elastic-morph.html:6033-6037`)

Find:
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

### I) Post-boot init — call `buildFX4()` (`elastic-morph.html:18326-18328`)

Find:
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

### J) `src/inject-v102.js` — the one required edit inside the regenerated span (`src/inject-v102.js:11-17`)

Find:
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
After this edit, run `node build.js` to regenerate `elastic-morph.html`'s marker-to-boot span from
the updated module — never hand-edit that span directly. Then run `node build.js` a second time
and confirm `git diff --stat elastic-morph.html` is empty (byte-reproducible regeneration), per
the established verification practice for any `src/` touch this session.

## Testing

Following this session's established split for canvas-drawing FX rounds: `test.js` covers
structure (definitions, wiring, round-tripping), real pixel-behavior gets verified live in the
Browser pane afterward — canvas 2D drawing isn't exercisable from Node.

- `FX4_DEFS` defined with exactly 5 entries, correct keys (`ripple`/`fisheye`/`melt`/`pagewarp`/`wavemirror`).
- `S.fx4` state object initialized with those same 5 keys, all `false`; `fx4MeltPhase: 0` present.
- `buildFX4`/`toggleFX4`/`syncFX4UI`/`applyPostFX4` all defined.
- Keydown dispatch: the digit branch contains a genuine `e.metaKey` check calling `toggleFX4`
  (not the old bare `!e.metaKey` guard), positioned between the `e.ctrlKey` (Rack II) branch and
  the final plain-digit (Rack I) `else`.
- `applyPostFX4(W, H, dt)` is called in the render chain, positioned after `applyPostFX3(W, H, dt)`
  and before `applyAutoExposure(W, H)`.
- `buildFX4()` is called after `buildFX3()` in the post-boot init sequence.
- HTML contains `id="fx4Chips"` and a `Cmd+1–0` label, positioned after the Rack III block.
- `projectData()`'s source contains `fx4: { ...S.fx4 }`; `applyProject()`'s source contains the
  `o.fx4` round-trip line — both checked against the *pre-marker* base functions specifically
  (not just anywhere in the assembled script), since those are the ones that actually execute.
- Auto-VJ: `safe4` array present with all 5 keys; the "clear all racks" step includes
  `S.fx4`; the final sync call includes `syncFX4UI()`; the `nSafe` pick logic's thresholds are the
  new 4-way split (`0.25`/`0.5`/`0.75`), not the old 3-way one.
- `silenceFxForCover`'s source (in the fully-assembled, post-`node build.js` script) clears
  `S.fx4` and calls `syncFX4UI()`.
- Each of the 5 effect blocks inside `applyPostFX4` references its documented audio signal
  (`S.beat` for ripple/fisheye, `S.bass` for melt/wavemirror, `S.mids` for pagewarp) and calls
  `snapshot(W, H)` before drawing.

## Live Verification

For each of the 5 effects: toggle on via the keyboard (`Cmd+1` through `Cmd+5`) and via clicking
its chip, confirm both produce the same visible distortion and toggle the chip's `.on` state.
Force the effect's mapped audio signal high/low and confirm the distortion strength visibly (or via
pixel-mean sampling) tracks it. Confirm `Cmd+0` (slot 10, currently unused — only 5 of 10 slots are
filled this round) does nothing and does not trigger any browser chrome behavior in the installed
PWA. Save a project with 2–3 Rack IV effects active, reload, confirm they're restored. Trigger a
Cover Image export with Rack IV effects active, confirm they're silenced in the exported image
(matching Racks I–III). Run Auto-VJ for a stretch and confirm Rack IV effects appear in rotation
(distinctly, not just Racks I–III as before). Confirm `node build.js` run twice in a row produces
zero further `git diff` on `elastic-morph.html` (regeneration is byte-reproducible).
