# FX Rack IV Part 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebind FX Rack IV from Cmd/Meta+1–0 to Ctrl+Shift+1–0 (Cmd+1 is blocked by browser tab
switching in a normal tab), and fill Rack IV's remaining 5 slots with Heat Haze, Vortex Twist,
Displacement Noise, Slit-Scan Drift, and Gravity Well.

**Architecture:** One cohesive addition to `elastic-morph.html`, entirely in the pre-marker region
(same placement discipline as Part 1 — `@BUILD-INJECT-V58` confirmed fresh at line 11051, nothing
in this plan touches the marker-to-boot span). Four of the five new effects reuse this codebase's
already-proven ring-clip (Ripple/Fisheye) or horizontal-band (Slice Shear/Wave Mirror) techniques
with different per-iteration transforms; the fifth (Slit-Scan Drift) adds one small new piece of
state — a 10-slot quarter-resolution ring buffer of past frames, sized using the exact same idiom
the existing `bloomC` buffer already uses.

**Tech Stack:** Vanilla JS, Canvas 2D — no new techniques beyond what Part 1 and the existing
codebase (`curlFlow`/`noise2`, `bloomC`'s quarter-res sizing) already prove out.

## Global Constraints

- Rebind: Ctrl+Shift+1–0. The keydown dispatch must check `e.ctrlKey && e.shiftKey` **before**
  plain `e.ctrlKey` (Rack II) — checking them in the wrong order means the more specific
  Ctrl+Shift combination is silently swallowed by the plain-Ctrl branch, since that branch doesn't
  check `shiftKey` at all.
- HTML label updates from "Cmd+1–0" to "Ctrl+Shift+1–0" — the old text must be gone, not just the
  new text present (a leftover would signal an incomplete/wrong edit).
- Exactly 5 new effects, keys `haze`/`vortex`/`noise`/`slitscan`/`gravity`, filling slots 6–10 in
  that order.
- Heat Haze and Displacement Noise use **horizontal bands** (not vertical columns) — shifting
  vertical columns sideways creates visible gaps between neighboring columns; horizontal bands
  reuse the proven `off - Math.sign(off) * W` wraparound trick every existing band effect uses.
- Slit-Scan's ring-buffer canvases must be **module-level**, never inside `S` — `S` gets spread
  into `projectData()`'s saved/serialized output, and a canvas element isn't JSON-serializable.
  Only the numeric write pointer (`S.fx4SlitIdx`) goes in `S`.
- No `S.perfScale`-based dynamic quality reduction for any of the 5 new effects (YAGNI, per spec).
- Slit-Scan Drift gets no audio-reactivity mapping — the temporal sweep itself is the effect (per
  spec Non-Goals) — so it's the one exception to "every effect references its documented audio
  signal" when this plan's tests check for that.

---

## Context (verified fresh immediately before writing this plan)

Every anchor below was re-confirmed via `grep -n` moments before writing this plan — all match the
spec's citations exactly, zero drift since the spec was written:

| # | What | Line (confirmed) |
|---|---|---|
| — | `@BUILD-INJECT-V58` marker | 11051 |
| A | `} else if (e.key >= "0" && e.key <= "9") {` (keydown dispatch anchor) | 9973 |
| B | `<h3>FX Rack IV — Warp ... (Cmd+1–0)</small></h3>` (HTML label anchor) | 1764 |
| C | `const FX4_DEFS = [` | 8280 |
| D | `fx4: { ripple: false, ... wavemirror: false },` (state anchor) | 2937 |
| E | `const fbC = document.createElement(...)` (module-level insertion anchor) | 2980 |
| F | `// bloom buffer at 1/4 resolution` (resize() anchor — confirmed still unique, 1 match; a second, unrelated `bloomC.width = ...` line exists post-marker inside a `src`-sourced `resize` wrapper, but that line lacks this comment, so the anchor stays unambiguous) | 9898 |
| G | `// Wave Mirror — banded sine offset...` closing block (applyPostFX4 anchor) | 8381 |
| H | `const safe4 = ["ripple", "fisheye", "melt", "pagewarp", "wavemirror"];` | 10529 |

Baseline: `node test.js` run fresh — **667 passed, 0 failed.**

---

## Task 1: Rebind to Ctrl+Shift+1–0 + 5 remaining Warp effects

**Files:**
- Modify: `elastic-morph.html` (8 separate pre-marker edits — see table above; re-verify each with
  a fresh `grep -n` immediately before editing, since line numbers drift between sessions)
- Test: `test.js` (append a new section)

**Interfaces:**
- Produces: `FX4_DEFS` grown to 10 entries; `S.fx4` grown to 10 boolean flags; `S.fx4SlitIdx`
  (number, starts `0`); module-level `FX4_SLIT_DEPTH` (= `10`) and `fx4SlitBuf` (array of 10
  `{c, x}` canvas/context pairs); `applyPostFX4` grown to handle all 10 `fx.*` flags; `safe4` grown
  to 10 keys.
- Consumes: everything Part 1 already produced (`toggleFX4`/`syncFX4UI`/`buildFX4` unchanged —
  they iterate `FX4_DEFS`/`S.fx4` generically and need no edits), plus `curlFlow`/`noise2`
  (existing helpers, `elastic-morph.html:3407-3418`), `bloomC` (existing quarter-res buffer, whose
  sizing idiom the Slit-Scan buffer copies), `resize()` (existing function, pre-marker).

- [ ] **Step 1: Re-verify every anchor fresh**

Run:
```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
grep -n "@BUILD-INJECT-V58" elastic-morph.html
grep -n 'e.key >= "0" && e.key <= "9"' elastic-morph.html
grep -n "FX Rack IV — Warp" elastic-morph.html
grep -n "const FX4_DEFS = \[" elastic-morph.html
grep -n "fx4: { ripple: false" elastic-morph.html
grep -n "const fbC = document.createElement" elastic-morph.html
grep -n "bloom buffer at 1/4 resolution" elastic-morph.html
grep -n "Wave Mirror — banded sine offset" elastic-morph.html
grep -n "const safe4 = " elastic-morph.html
```
Expected: marker still well above every other anchor's line number; every other anchor's
surrounding text matches what this plan's Find blocks quote below. If any anchor's exact text
differs (the file drifted), stop and re-derive the correct insertion point from the actual current
content — don't force a non-matching find/replace.

- [ ] **Step 2: Keydown dispatch — reorder + rebind to Ctrl+Shift**

Find (`elastic-morph.html:9973-9986`):
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
Replace:
```js
    } else if (e.key >= "0" && e.key <= "9") {
      const idx = e.key === "0" ? 9 : +e.key - 1;
      if (e.ctrlKey && e.shiftKey) {         // Ctrl+Shift+digit → FX Rack IV (warp)
        const def4 = FX4_DEFS[idx];
        if (def4) { e.preventDefault(); toggleFX4(def4[0]); }
      } else if (e.ctrlKey) {                // Ctrl+digit → FX Rack II (geometry)
        const def2 = FX2_DEFS[idx];
        if (def2) { e.preventDefault(); toggleFX2(def2[0]); }
      } else {                               // plain digit → FX Rack I
        const def = FX_DEFS[idx];
        if (def) toggleFX(def[0]);
      }
    }
```

- [ ] **Step 3: HTML label update**

Find (`elastic-morph.html:1764`):
```html
    <h3>FX Rack IV — Warp <small style="color:var(--text-dim);font-weight:400">(Cmd+1–0)</small></h3>
```
Replace:
```html
    <h3>FX Rack IV — Warp <small style="color:var(--text-dim);font-weight:400">(Ctrl+Shift+1–0)</small></h3>
```

- [ ] **Step 4: `FX4_DEFS` — 5 new entries**

Find (`elastic-morph.html:8280-8286`):
```js
const FX4_DEFS = [
  ["ripple",     "Liquid Ripple",   "concentric rings, beat-driven"],
  ["fisheye",    "Fisheye Pulse",   "barrel bulge, beat-driven"],
  ["melt",       "Horizontal Melt", "vertical drip distortion, bass-driven"],
  ["pagewarp",   "Page Warp",       "single flag-wave bend, mids-driven"],
  ["wavemirror", "Wave Mirror",     "banded sine offset, stronger at the edges"]
];
```
Replace:
```js
const FX4_DEFS = [
  ["ripple",     "Liquid Ripple",       "concentric rings, beat-driven"],
  ["fisheye",    "Fisheye Pulse",       "barrel bulge, beat-driven"],
  ["melt",       "Horizontal Melt",     "vertical drip distortion, bass-driven"],
  ["pagewarp",   "Page Warp",           "single flag-wave bend, mids-driven"],
  ["wavemirror", "Wave Mirror",         "banded sine offset, stronger at the edges"],
  ["haze",       "Heat Haze",           "fine shimmer, loudness-driven"],
  ["vortex",     "Vortex Twist",        "localized swirl, transient-driven"],
  ["noise",      "Displacement Noise",  "organic curl-noise drift, highs-driven"],
  ["slitscan",   "Slit-Scan Drift",     "temporal column smear, always-on"],
  ["gravity",    "Gravity Well",        "off-center pull, transient-driven"]
];
```

- [ ] **Step 5: State — 5 new flags + Slit-Scan's write pointer**

Find (`elastic-morph.html:2937`):
```js
  fx4: { ripple: false, fisheye: false, melt: false, pagewarp: false, wavemirror: false },
  fx4MeltPhase: 0,
```
Replace:
```js
  fx4: { ripple: false, fisheye: false, melt: false, pagewarp: false, wavemirror: false,
         haze: false, vortex: false, noise: false, slitscan: false, gravity: false },
  fx4MeltPhase: 0,
  fx4SlitIdx: 0,
```

- [ ] **Step 6: Module-level Slit-Scan ring buffer**

Find (`elastic-morph.html:2980`):
```js
const fbC = document.createElement("canvas"), fbctx = fbC.getContext("2d");   // feedback accumulation
```
Replace:
```js
const fbC = document.createElement("canvas"), fbctx = fbC.getContext("2d");   // feedback accumulation
// v140: FX Rack IV Slit-Scan Drift — small ring buffer of past frames at quarter
// resolution (same sizing idiom as bloomC), so each output column can sample a
// different moment in time.
const FX4_SLIT_DEPTH = 10;
const fx4SlitBuf = Array.from({ length: FX4_SLIT_DEPTH }, () => {
  const c = document.createElement("canvas");
  return { c, x: c.getContext("2d") };
});
```

- [ ] **Step 7: `resize()` — size the Slit-Scan ring buffer alongside `bloomC`**

Find (`elastic-morph.html:9898-9900`):
```js
  // bloom buffer at 1/4 resolution
  bloomC.width = Math.max(2, Math.round(canvas.width / 4));
  bloomC.height = Math.max(2, Math.round(canvas.height / 4));
```
Replace:
```js
  // bloom buffer at 1/4 resolution
  bloomC.width = Math.max(2, Math.round(canvas.width / 4));
  bloomC.height = Math.max(2, Math.round(canvas.height / 4));
  // v140: Slit-Scan ring buffer shares bloomC's quarter-resolution sizing
  fx4SlitBuf.forEach(b => { b.c.width = bloomC.width; b.c.height = bloomC.height; });
```

- [ ] **Step 8: `applyPostFX4` — 5 new effect blocks**

Find (`elastic-morph.html:8381-8393`, the closing `wavemirror` block and the function's closing brace):
```js
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
```
Replace:
```js
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

  // Heat Haze — fine organic shimmer across many horizontal bands, loudness-driven
  if (fx.haze) {
    snapshot(W, H);
    const bands = 40, bh = H / bands, amp = W * 0.004 + S.loudness * W * 0.012;
    ctx.save();
    for (let i = 0; i < bands; i++) {
      const y0 = i * bh;
      const off = noise2(i * 0.4, S.time * 1.1) * amp;
      ctx.drawImage(fxC, 0, y0, W, bh + 1, off, y0, W, bh + 1);
      ctx.drawImage(fxC, 0, y0, W, bh + 1, off - Math.sign(off) * W, y0, W, bh + 1);
    }
    ctx.restore();
  }

  // Vortex Twist — localized rotational swirl, radial falloff (center twists most)
  if (fx.vortex) {
    snapshot(W, H);
    const rings = 24, twist = 0.5 + S.transient * 1.8;
    ctx.save();
    for (let i = 0; i < rings; i++) {
      const t0 = i / rings, t1 = (i + 1) / rings;
      const ang = (1 - t0) * (1 - t0) * twist;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * t1, 0, Math.PI * 2);
      ctx.arc(cx, cy, maxR * t0, 0, Math.PI * 2, true);
      ctx.clip();
      ctx.translate(cx, cy); ctx.rotate(ang); ctx.translate(-cx, -cy);
      ctx.drawImage(fxC, 0, 0, W, H);
      ctx.restore();
    }
    ctx.restore();
  }

  // Displacement Noise — organic curl-noise drift across horizontal bands, highs-driven
  if (fx.noise) {
    snapshot(W, H);
    const bands = 32, bh = H / bands, amp = W * 0.015 + S.highs * W * 0.05;
    ctx.save();
    for (let i = 0; i < bands; i++) {
      const y0 = i * bh;
      const off = curlFlow(i * 0.25, S.time * 0.35).x * amp;
      ctx.drawImage(fxC, 0, y0, W, bh + 1, off, y0, W, bh + 1);
      ctx.drawImage(fxC, 0, y0, W, bh + 1, off - Math.sign(off) * W, y0, W, bh + 1);
    }
    ctx.restore();
  }

  // Slit-Scan Drift — 26 columns, each sampled from a different age in the ring buffer
  // (oldest on the left, newest on the right); always sweeping while active.
  if (fx.slitscan) {
    const slot = fx4SlitBuf[S.fx4SlitIdx];
    slot.x.drawImage(canvas, 0, 0, slot.c.width, slot.c.height);
    S.fx4SlitIdx = (S.fx4SlitIdx + 1) % FX4_SLIT_DEPTH;
    const cols = 26, cw = W / cols;
    ctx.save();
    for (let i = 0; i < cols; i++) {
      const age = Math.floor((i / cols) * FX4_SLIT_DEPTH);
      const slotIdx = (S.fx4SlitIdx + age) % FX4_SLIT_DEPTH;
      const buf = fx4SlitBuf[slotIdx];
      const sx = i * cw;
      ctx.drawImage(buf.c, sx / W * buf.c.width, 0, buf.c.width / cols, buf.c.height, sx, 0, cw + 1, H);
    }
    ctx.restore();
  }

  // Gravity Well — off-center point (slow orbit, pure function of S.time) pulls inward
  if (fx.gravity) {
    snapshot(W, H);
    const gx = cx + Math.cos(S.time * 0.15) * W * 0.22;
    const gy = cy + Math.sin(S.time * 0.11) * H * 0.22;
    const gMaxR = Math.hypot(Math.max(gx, W - gx), Math.max(gy, H - gy));
    const rings = 24, pull = 0.05 + S.transient * 0.12;
    ctx.save();
    for (let i = 0; i < rings; i++) {
      const t0 = i / rings, t1 = (i + 1) / rings;
      const s = 1 - pull * (1 - t0) * (1 - t0);
      ctx.save();
      ctx.beginPath();
      ctx.arc(gx, gy, gMaxR * t1, 0, Math.PI * 2);
      ctx.arc(gx, gy, gMaxR * t0, 0, Math.PI * 2, true);
      ctx.clip();
      ctx.translate(gx, gy); ctx.scale(s, s); ctx.translate(-gx, -gy);
      ctx.drawImage(fxC, 0, 0, W, H);
      ctx.restore();
    }
    ctx.restore();
  }
}
```

- [ ] **Step 9: Auto-VJ `safe4` — extend to all 10 keys**

Find (`elastic-morph.html:10529`):
```js
    const safe4 = ["ripple", "fisheye", "melt", "pagewarp", "wavemirror"];
```
Replace:
```js
    const safe4 = ["ripple", "fisheye", "melt", "pagewarp", "wavemirror",
      "haze", "vortex", "noise", "slitscan", "gravity"];
```

- [ ] **Step 10: Fix 4 pre-existing Part-1 tests that the rebind genuinely breaks**

The rebind (Step 2) and label change (Step 3) change exact text that 4 pre-existing tests in
`test.js` (from Part 1) check for verbatim — these will now genuinely FAIL, not just become
stale. Confirmed by inspecting `test.js`'s current "FX Rack IV" section: the tests titled
"keydown dispatch has a real e.metaKey branch...", "S.fx4 state initialized with the 5 warp
keys...", "HTML has the fx4Chips container and a Cmd+1–0 label...", and "Auto-VJ has a safe4 pool
with all 5 warp keys..." each check an exact substring that Steps 2/3/5/9 change.

Find (verbatim, `test.js` — locate via `grep -n 'section("FX Rack IV — Warp / Verzerrungsfeld (Cmd+1..0)");' test.js`):
```js
section("FX Rack IV — Warp / Verzerrungsfeld (Cmd+1..0)");
```
Replace:
```js
section("FX Rack IV — Warp / Verzerrungsfeld (Ctrl+Shift+1..0)");
```

Find (verbatim):
```js
ok("S.fx4 state initialized with the 5 warp keys all false, plus fx4MeltPhase: 0",
  script.includes("fx4: { ripple: false, fisheye: false, melt: false, pagewarp: false, wavemirror: false },") &&
  script.includes("fx4MeltPhase: 0,"));
```
Replace:
```js
ok("S.fx4 state initialized with the 5 warp keys all false, plus fx4MeltPhase: 0",
  script.includes("fx4: { ripple: false, fisheye: false, melt: false, pagewarp: false, wavemirror: false,") &&
  script.includes("fx4MeltPhase: 0,"));
```

Find (verbatim):
```js
ok("keydown dispatch has a real e.metaKey branch calling toggleFX4, between the Ctrl (Rack II) branch and the final plain-digit else", (() => {
  const ctrlIdx = script.indexOf('if (e.ctrlKey) {                       // Ctrl+digit');
  const metaIdx = script.indexOf('} else if (e.metaKey) {                // Cmd/Meta+digit');
  const callIdx = script.indexOf("toggleFX4(def4[0]);");
  const elseIdx = script.indexOf("} else {                               // plain digit → FX Rack I");
  return ctrlIdx >= 0 && metaIdx > ctrlIdx && callIdx > metaIdx && elseIdx > callIdx;
})());
```
Replace:
```js
ok("keydown dispatch has a real e.ctrlKey && e.shiftKey branch calling toggleFX4, before the plain Ctrl (Rack II) branch", (() => {
  const shiftIdx = script.indexOf('if (e.ctrlKey && e.shiftKey) {         // Ctrl+Shift+digit');
  const ctrlIdx = script.indexOf('} else if (e.ctrlKey) {                // Ctrl+digit');
  const callIdx = script.indexOf("toggleFX4(def4[0]);");
  return shiftIdx >= 0 && callIdx > shiftIdx && ctrlIdx > callIdx;
})());
```

Find (verbatim):
```js
ok("HTML has the fx4Chips container and a Cmd+1–0 label, positioned after the Rack III block", (() => {
  const fx3Block = html.indexOf('id="fx3Chips"');
  const fx4Label = html.indexOf("FX Rack IV");
  const fx4Chips = html.indexOf('id="fx4Chips"');
  return fx3Block >= 0 && fx4Label > fx3Block && fx4Chips > fx4Label &&
    html.slice(fx4Label, fx4Chips).includes("Cmd+1");
})());
```
Replace:
```js
ok("HTML has the fx4Chips container and a Ctrl+Shift+1–0 label, positioned after the Rack III block", (() => {
  const fx3Block = html.indexOf('id="fx3Chips"');
  const fx4Label = html.indexOf("FX Rack IV");
  const fx4Chips = html.indexOf('id="fx4Chips"');
  return fx3Block >= 0 && fx4Label > fx3Block && fx4Chips > fx4Label &&
    html.slice(fx4Label, fx4Chips).includes("Ctrl+Shift+1");
})());
```

Find (verbatim):
```js
ok("Auto-VJ has a safe4 pool with all 5 warp keys, clears S.fx4 with the other racks, and syncs FX4 UI",
  script.includes('const safe4 = ["ripple", "fisheye", "melt", "pagewarp", "wavemirror"];') &&
  script.includes("Object.keys(S.fx4).forEach(k => S.fx4[k] = false);") &&
  script.includes("syncFXUI(); syncFX2UI(); syncFX3UI(); syncFX4UI();"));
```
Replace:
```js
ok("Auto-VJ has a safe4 pool with all 10 warp keys, clears S.fx4 with the other racks, and syncs FX4 UI",
  script.includes('const safe4 = ["ripple", "fisheye", "melt", "pagewarp", "wavemirror",\n      "haze", "vortex", "noise", "slitscan", "gravity"];') &&
  script.includes("Object.keys(S.fx4).forEach(k => S.fx4[k] = false);") &&
  script.includes("syncFXUI(); syncFX2UI(); syncFX3UI(); syncFX4UI();"));
```

(The "FX4_DEFS defined with exactly 5 entries..." test and the "each of the 5 warp effects
references..." test are NOT touched here — both only check that the original 5 keys/effects are
still findable within a fixed-size window from a fixed start point, which remains true since Part
2 only appends after them. They keep passing, just with a slightly imprecise "5" in their titles —
not worth churning further, since Step 12's new section covers the complete 10-key picture.)

- [ ] **Step 11: Run tests, confirm no regressions from Steps 2–10**

Run: `node test.js`
Expected: still 667 passed, 0 failed — confirms the 8 code edits plus the 4 pre-existing test
fixes are all correct and consistent with each other.

- [ ] **Step 12: Write the new test section**

Open `test.js`, find its final `section(...)` block (or the end of the file before any
summary/report code) and append:

```js
section("FX Rack IV Part 2 — rebind (Ctrl+Shift+1..0) + 5 remaining effects");

ok("FX4_DEFS has 10 entries with the 5 new keys correct", (() => {
  const idx = script.indexOf("const FX4_DEFS = [");
  if (idx < 0) return false;
  const slice = script.slice(idx, idx + 1400);
  const allKeys = ["ripple", "fisheye", "melt", "pagewarp", "wavemirror",
    "haze", "vortex", "noise", "slitscan", "gravity"];
  return allKeys.every(k => slice.includes(`"${k}"`));
})());

ok("S.fx4 initialized with all 10 keys false, plus fx4SlitIdx: 0",
  script.includes("haze: false, vortex: false, noise: false, slitscan: false, gravity: false") &&
  script.includes("fx4SlitIdx: 0,"));

ok("FX4_SLIT_DEPTH and fx4SlitBuf module-level ring buffer defined",
  script.includes("const FX4_SLIT_DEPTH = 10;") &&
  script.includes("const fx4SlitBuf = Array.from({ length: FX4_SLIT_DEPTH }"));

ok("resize() sizes the Slit-Scan ring buffer alongside bloomC",
  script.includes("fx4SlitBuf.forEach(b => { b.c.width = bloomC.width; b.c.height = bloomC.height; });"));

ok("keydown dispatch checks e.ctrlKey && e.shiftKey BEFORE plain e.ctrlKey, and the old e.metaKey Rack IV branch is gone", (() => {
  const shiftIdx = script.indexOf("if (e.ctrlKey && e.shiftKey) {         // Ctrl+Shift+digit");
  const ctrlIdx = script.indexOf("} else if (e.ctrlKey) {                // Ctrl+digit");
  const oldMetaGone = !script.includes("Cmd/Meta+digit → FX Rack IV");
  return shiftIdx >= 0 && ctrlIdx > shiftIdx && oldMetaGone;
})());

ok("HTML label reads Ctrl+Shift+1–0, old Cmd+1–0 text is gone", (() => {
  const hasNew = script.includes("FX Rack IV — Warp") && script.includes("(Ctrl+Shift+1–0)</small>");
  const oldGone = !script.includes("(Cmd+1–0)</small>");
  return hasNew && oldGone;
})());

ok("applyPostFX4 contains all 5 new effect blocks, each referencing its documented audio signal (except slitscan) and calling snapshot(W, H) (except slitscan)", (() => {
  const idx = script.indexOf("function applyPostFX4(W, H, dt) {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 8000);
  const checks = [
    ["fx.haze", "S.loudness", true],
    ["fx.vortex", "S.transient", true],
    ["fx.noise", "S.highs", true],
    ["fx.slitscan", null, false],
    ["fx.gravity", "S.transient", true]
  ];
  return checks.every(([flag, sig, needsSnapshot]) => {
    const flagIdx = body.indexOf("if (" + flag + ")");
    if (flagIdx < 0) return false;
    const block = body.slice(flagIdx, flagIdx + 900);
    const sigOk = sig ? block.includes(sig) : true;
    const snapOk = needsSnapshot ? block.includes("snapshot(W, H)") : true;
    return sigOk && snapOk;
  });
})());
```

Notes for whoever writes this: check `test.js`'s existing `section`/`ok`/`script` conventions
first (e.g. how Part 1's own FX Rack IV test section was structured — search for "FX Rack IV" in
`test.js`) and match the established call signatures exactly. This section deliberately does NOT
re-check `safe4`'s full 10-key list — Step 10 already rewrote the pre-existing "Auto-VJ has a
safe4 pool..." test to check exactly that (plus the clear-all/sync-call behavior this new section
doesn't cover), so a second identical key-list check here would be pure duplication.

- [ ] **Step 13: Run the full suite, confirm the new total**

Run: `node test.js`
Expected: **674 passed, 0 failed** (667 baseline + 7 new assertions written in Step 12). If the
actual new-assertion count or baseline differs once written, correct this expected total to match
reality — don't force 674 if the honest count is different.

- [ ] **Step 14: Commit**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
git add elastic-morph.html test.js
git commit -m "feat: rebind FX Rack IV to Ctrl+Shift+1-0, add 5 remaining Warp effects"
```

(No `src/` files change in this task — every edit is pre-marker.)

---

## Testing Summary

- Structural: `FX4_DEFS` grown to 10 correct entries; `S.fx4`/`fx4SlitIdx` correctly initialized;
  the Slit-Scan ring buffer's module-level declaration and `resize()` wiring both present;
  keydown dispatch reordered correctly AND the old Cmd/Meta branch is verifiably gone (not just
  the new branch present); HTML label updated AND the old text gone; all 5 new effect blocks
  present with correct audio-signal references; `safe4` grown to all 10 keys.
- No canvas-based pixel-behavior tests in `test.js` — Canvas 2D isn't exercisable from Node. That
  verification is the controller's job, done live in the Browser pane after this task ships, per
  the design spec's Live Verification section (not part of this implementer's task).

## Live Verification (controller's job after this task ships — not part of Task 1)

Per the design spec's Live Verification section: toggle each of the 5 new effects via
Ctrl+Shift+6–Ctrl+Shift+0 and via chip click, confirm agreement. Force each effect's mapped audio
signal and confirm the distortion tracks it (except Slit-Scan — confirm it visibly sweeps
continuously instead). Confirm Ctrl+Shift+1 now toggles `ripple` (the already-shipped 5 still work
under the new binding). Confirm Cmd+1 in a plain browser tab no longer does anything odd — it just
falls through to the browser's own tab-switch, since Elastic Morph no longer claims that
combination. Let Slit-Scan run for several seconds and confirm a genuine temporal smear (not a
static offset), and that toggling it off/on after a window resize doesn't show stale/garbage
content. Run Auto-VJ for a stretch and confirm all 10 Rack IV effects appear in rotation.
