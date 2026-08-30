# FX Rack II Pulse Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Triangulate (Ctrl+9, FX Rack II — Geometry) with Pulse Zoom, a genuinely audio-reactive breathing-scale effect, per the approved design spec.

**Architecture:** 4 small edits, all in `elastic-morph.html`, all in the ordinary always-live pre-marker code path (no `src/inject-vNN.js` involvement at all — confirmed during spec-writing, unlike every Particle Mode round earlier today). A new `S.fx2Breath` accumulator drives a sine-based scale oscillation (tempo on `S.mids`, amplitude on `S.loudness`) plus a beat/transient kick, reusing the exact accumulator shape the neighboring "Spin" effect already uses for rotation.

**Tech Stack:** Vanilla JS, Canvas 2D (`ctx`). Zero-dependency test harness (`test.js`, `node test.js`).

## Global Constraints

- All 4 edits are pre-marker in `elastic-morph.html` — no `@BUILD-INJECT-V58` build-pipeline concern applies to this round at all (confirmed via `grep -rln "triangulate" src/` returning empty). Tests use plain `extractFn(name)` against the assembled `script` — no `injectSrc()`/src-override machinery needed here, unlike every Particle Mode round today.
- Ctrl+9 must keep working as the Pulse Zoom toggle — the `FX2_DEFS` array entry is swapped **in place** (same array index 8), not appended, since the keyboard handler maps `Ctrl+<digit>` to `FX2_DEFS[idx]` purely by array position.
- Exact formula (from the approved spec, do not deviate): `S.fx2Breath += dt * (0.6 + S.mids * 0.8); const breathe = Math.sin(S.fx2Breath) * 0.06 * (0.5 + S.loudness * 0.7); const kick = S.beat * 0.09 + S.transient * 0.05; const s = 1 + breathe + kick;` — then `ctx.translate(cx, cy); ctx.scale(s, s); ctx.drawImage(fxC, -cx, -cy, W, H);` (wrapped in `ctx.save()`/`ctx.restore()`), with `snapshot(W, H)` called first (matches every sibling FX2 effect's convention).
- `S.fx2Breath: 0` must be added to state alongside the existing `S.fx2Spin: 0` — a plain accumulator, no `|| 0` fallback needed anywhere it's used (it's always initialized).
- Scope is Ctrl+9/Triangulate only — Mirror Grid (Ctrl+3) and Halftone (Ctrl+8) are explicitly untouched this round.
- The old v21 changelog comment at `elastic-morph.html:9985-9986` (documenting FX Rack II's original addition) is a historical record and must NOT be edited.
- After this change, the string `"triangulate"` must not appear anywhere in the codebase (`elastic-morph.html`, `test.js`, or any `src/inject-vNN.js` file) — confirms the swap is complete, not a partial rename leaving dead references.

---

### Task 1: Swap Triangulate for Pulse Zoom

**Files:**
- Modify: `elastic-morph.html` (4 locations: `S.fx2` default state + `S.fx2Breath`, `FX2_DEFS` array, `applyPostFX2`'s implementation block, Auto-VJ's `safe2` array)
- Test: `test.js` (append a new section before the final `/* ---------------- summary ---------------- */` block)

**Interfaces:**
- Consumes: `applyPostFX2`'s existing in-scope locals (`fx`, `cx`/`cy`/`W`/`H`, `snapshot`, `fxC`), plus globals `S.mids`/`S.loudness`/`S.beat`/`S.transient`. All confirmed already in scope by reading the neighboring "Spin" block (`elastic-morph.html:7105-7116`), which uses the identical set of identifiers.
- Produces: the string id `"pulsezoom"` becomes a valid key in `S.fx2`, toggleable via `Ctrl+9` (through the existing generic `FX2_DEFS[idx]` keyboard-handler mechanism — no new wiring needed) and via the existing `#fx2Chips` UI (populated purely from `FX2_DEFS` by array iteration, same as every other FX2 entry).

- [ ] **Step 1: Re-confirm all 4 target locations are unchanged**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
grep -n "fx2: { hexkaleido\|fx2Spin: 0\|^const FX2_DEFS\|// Triangulate\|const safe2" elastic-morph.html
grep -rln "triangulate" src/
```

Expected: 5 matches at (approximately) lines 2905, 2907, 7900, 7139, 10088; the `src/` grep returns nothing. If line numbers differ, re-read the surrounding ~15 lines at each new location before editing.

- [ ] **Step 2: Add `S.fx2Breath` and swap the `S.fx2` default state field**

Find:

```js
  fx2: { hexkaleido: false, droste: false, mirrorgrid: false, echospin: false, radialblur: false,
         slice: false, spin: false, halftone: false, triangulate: false, posterize: false },
  fx2Spin: 0,
```

Replace with:

```js
  fx2: { hexkaleido: false, droste: false, mirrorgrid: false, echospin: false, radialblur: false,
         slice: false, spin: false, halftone: false, pulsezoom: false, posterize: false },
  fx2Spin: 0, fx2Breath: 0,
```

- [ ] **Step 3: Swap the `FX2_DEFS` array entry**

Find:

```js
const FX2_DEFS = [
  ["hexkaleido",  "Hex Kaleido",  "6-fold crystal mandala"],
  ["droste",      "Droste Zoom",  "infinite frame-in-frame"],
  ["mirrorgrid",  "Mirror Grid",  "seamless mirrored tiles"],
  ["echospin",    "Echo Spin",    "rotated ghost fan"],
  ["radialblur",  "Radial Blur",  "zoom streaks from center"],
  ["slice",       "Slice Shear",  "sine-shifted bands"],
  ["spin",        "Spin",         "whole frame rotates"],
  ["halftone",    "Halftone",     "dot raster screen"],
  ["triangulate", "Triangulate",  "low-poly facets"],
  ["posterize",   "Posterize",    "banded color crush"]
];
```

Replace with:

```js
const FX2_DEFS = [
  ["hexkaleido",  "Hex Kaleido",  "6-fold crystal mandala"],
  ["droste",      "Droste Zoom",  "infinite frame-in-frame"],
  ["mirrorgrid",  "Mirror Grid",  "seamless mirrored tiles"],
  ["echospin",    "Echo Spin",    "rotated ghost fan"],
  ["radialblur",  "Radial Blur",  "zoom streaks from center"],
  ["slice",       "Slice Shear",  "sine-shifted bands"],
  ["spin",        "Spin",         "whole frame rotates"],
  ["halftone",    "Halftone",     "dot raster screen"],
  ["pulsezoom",   "Pulse Zoom",   "rhythmic breathing scale"],
  ["posterize",   "Posterize",    "banded color crush"]
];
```

- [ ] **Step 4: Replace the Triangulate implementation with Pulse Zoom**

Find:

```js
  // Triangulate — low-poly facets from a coarse grid
  if (fx.triangulate) {
    const gx = Math.max(10, Math.round(26 * q)), gy = Math.max(2, Math.round(gx * H / W));
    chctx.globalCompositeOperation = "copy"; chctx.globalAlpha = 1; chctx.imageSmoothingEnabled = true;
    chctx.drawImage(canvas, 0, 0, gx, gy);
    const data = chctx.getImageData(0, 0, gx, gy).data;
    const cw = W / (gx - 1), ch = H / (gy - 1);
    const col = (ix, iy) => {
      ix = Math.max(0, Math.min(gx - 1, ix)); iy = Math.max(0, Math.min(gy - 1, iy));
      const o = (iy * gx + ix) * 4; return `rgb(${data[o]},${data[o + 1]},${data[o + 2]})`;
    };
    ctx.save();
    for (let y = 0; y < gy - 1; y++) for (let x = 0; x < gx - 1; x++) {
      const x0 = x * cw, y0 = y * ch, x1 = x0 + cw, y1 = y0 + ch;
      ctx.fillStyle = col(x, y);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x0, y1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col(x + 1, y + 1);
      ctx.beginPath(); ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
```

Replace with:

```js
  // Pulse Zoom — v133: rhythmic breathing scale, replaces the removed Triangulate (Ctrl+9)
  // per Frank's request (Triangulate was the one FX2 effect with zero audio-reactivity).
  // Same accumulator shape as "Spin" above, driving scale instead of rotation.
  if (fx.pulsezoom) {
    snapshot(W, H);
    S.fx2Breath += dt * (0.6 + S.mids * 0.8);
    const breathe = Math.sin(S.fx2Breath) * 0.06 * (0.5 + S.loudness * 0.7);
    const kick = S.beat * 0.09 + S.transient * 0.05;
    const s = 1 + breathe + kick;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.drawImage(fxC, -cx, -cy, W, H);
    ctx.restore();
  }
```

- [ ] **Step 5: Swap the Auto-VJ `safe2` pool**

Find:

```js
    const safe2 = ["hexkaleido", "droste", "mirrorgrid", "slice", "spin", "halftone", "triangulate", "posterize"];
```

Replace with:

```js
    const safe2 = ["hexkaleido", "droste", "mirrorgrid", "slice", "spin", "halftone", "pulsezoom", "posterize"];
```

- [ ] **Step 6: Write the tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert a new section immediately before it:

```js
/* ---------------- FX Rack II: Pulse Zoom (replaces Triangulate) ---------------- */
section("FX Rack II — Pulse Zoom (replaces Triangulate)");

ok("FX2_DEFS gained pulsezoom at index 8 (Ctrl+9) and no longer contains triangulate", (() => {
  const m = script.match(/const FX2_DEFS = \[([\s\S]*?)\];/);
  if (!m) return false;
  const body = m[1];
  const entries = body.match(/\[".*?",\s*".*?",\s*".*?"\]/g) || [];
  return entries.length === 10
    && entries[8].includes('"pulsezoom"') && entries[8].includes('"Pulse Zoom"')
    && !body.includes('"triangulate"');
})());

ok("S.fx2 default state has pulsezoom: false (not triangulate) and S.fx2Breath: 0 alongside S.fx2Spin: 0", (() => {
  return script.includes("pulsezoom: false") && !script.includes("triangulate: false")
    && script.includes("fx2Spin: 0, fx2Breath: 0,");
})());

ok("applyPostFX2 has a case for pulsezoom and no longer has one for triangulate", (() => {
  const fn = extractFn("applyPostFX2");
  return !!fn && fn.includes("if (fx.pulsezoom) {") && !fn.includes("if (fx.triangulate)");
})());

ok("the pulsezoom block calls snapshot(W, H) before drawImage (matches every sibling FX2 effect's convention)", (() => {
  const fn = extractFn("applyPostFX2");
  if (!fn) return false;
  const startIdx = fn.indexOf("if (fx.pulsezoom) {");
  const endIdx = fn.indexOf("\n  }", startIdx);
  if (startIdx < 0 || endIdx < 0) return false;
  const body = fn.slice(startIdx, endIdx);
  const snapIdx = body.indexOf("snapshot(W, H)");
  const drawIdx = body.indexOf("ctx.drawImage(fxC");
  return snapIdx >= 0 && drawIdx >= 0 && snapIdx < drawIdx;
})());

ok("pulsezoom references all 4 audio signals (S.mids, S.loudness, S.beat, S.transient) — genuine multi-signal reactivity, not a static effect like the one it replaces", (() => {
  const fn = extractFn("applyPostFX2");
  if (!fn) return false;
  const startIdx = fn.indexOf("if (fx.pulsezoom) {");
  const endIdx = fn.indexOf("\n  }", startIdx);
  if (startIdx < 0 || endIdx < 0) return false;
  const body = fn.slice(startIdx, endIdx);
  return body.includes("S.mids") && body.includes("S.loudness") && body.includes("S.beat") && body.includes("S.transient");
})());

ok("Auto-VJ's safe2 pool contains pulsezoom (not triangulate) — Auto-VJ still has 8 safe FX2 options to pick from", (() => {
  const m = script.match(/const safe2 = \[([^\]]*)\];/);
  if (!m) return false;
  const body = m[1];
  const entries = body.match(/"[^"]+"/g) || [];
  return entries.length === 8 && body.includes('"pulsezoom"') && !body.includes('"triangulate"');
})());

ok("\"triangulate\" no longer appears anywhere in the codebase (elastic-morph.html or any src/inject-vNN.js file) — confirms a complete swap, not a partial rename", (() => {
  const fs = require("fs");
  const path = require("path");
  if (script.includes("triangulate") || html.includes("triangulate")) return false;
  const srcDir = path.join(__dirname, "src");
  if (fs.existsSync(srcDir)) {
    for (const f of fs.readdirSync(srcDir)) {
      if (fs.readFileSync(path.join(srcDir, f), "utf8").includes("triangulate")) return false;
    }
  }
  return true;
})());
```

- [ ] **Step 7: Run the tests**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
node test.js 2>&1 | tail -15
```

Expected: all 7 new assertions under "FX Rack II — Pulse Zoom (replaces Triangulate)" print `✓`, final line reads `N passed, 0 failed` (N = 580 + 7 = 587 — verified via `grep -c '^ok("'` against Step 6's own text rather than eyeballed, since this class of count has been miscounted by hand more than once this session; re-count yourself before trusting this number too).

- [ ] **Step 8: Run the full build+test pipeline and confirm no drift**

```bash
npm run ci 2>&1 | tail -10
git diff --stat elastic-morph.html test.js
```

Expected: `node build.js` completes without error, `node test.js` reports the same pass count as Step 7. Since this round touches no `src/inject-vNN.js` file, `git diff --stat elastic-morph.html` should reflect ONLY this task's own hand-edits (the 4 locations from Steps 2-5) — no post-marker regeneration drift, unlike every Particle Mode round today.

- [ ] **Step 9: Commit**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
git add elastic-morph.html test.js
git commit -m "feat(fx-rack-ii): replace Triangulate with Pulse Zoom on Ctrl+9

Triangulate was the one FX Rack II effect with zero audio-reactivity
among its 10 siblings (Frank's observation). Pulse Zoom is a sine-based
breathing scale — tempo on S.mids, amplitude on S.loudness — plus a
beat/transient zoom kick, reusing the exact accumulator shape the
neighboring Spin effect already uses for rotation (a new S.fx2Breath
counter alongside the existing S.fx2Spin). Ctrl+9 keeps working via the
existing generic FX2_DEFS[idx] keyboard mapping (same array index).
Auto-VJ's safe2 pool updated to keep 8 safe FX2 options.

Scope limited to Ctrl+9/Triangulate only, per Frank's explicit choice —
Mirror Grid (Ctrl+3) and Halftone (Ctrl+8), the rack's other two
non-reactive members, are untouched.

Per docs/superpowers/specs/2026-08-29-fx-rack-ii-pulse-zoom-design.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Live verification and ship

**Files:** None modified — this task verifies Task 1's work in a real browser and ships it.

**Interfaces:**
- Consumes: `S.fx2.pulsezoom`, `S.fx2Breath`, `S.mids`, `S.loudness`, `S.beat`, `S.transient` (existing + new state fields), the `frame()` rAF loop and `applyPostFX2` (already running unconditionally as part of the normal render pipeline — this is ordinary always-live code, not subject to the pre/post-marker reassignment trap that applies to `drawParticleMode`/`initPM`/`pmColor` in the Particle Mode rounds, so there is no equivalent manual-call-freezes-the-loop gotcha to worry about here).

- [ ] **Step 1: Start a dev server serving the current working tree**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
npx --yes serve -l 8940 "$(pwd)" > /tmp/serve-fx2-pulsezoom.log 2>&1 &
sleep 3
curl -sL -o /tmp/fx2-pulsezoom-check.html http://localhost:8940/elastic-morph.html
wc -c /tmp/fx2-pulsezoom-check.html elastic-morph.html
```

Expected: both byte counts match exactly. If they don't, the server is stale — kill it (`pkill -f "serve -l 8940"`) and retry.

- [ ] **Step 2: Open the Browser pane and navigate to the served app**

Navigate to `http://localhost:8940/elastic-morph.html`.

- [ ] **Step 3: Confirm Pulse Zoom is live and reachable via Ctrl+9**

Confirm the deployed function itself contains the new code (reading back source, the same general good practice used elsewhere this session, even though there's no dead-copy trap here specifically):

```js
const src = applyPostFX2.toString();
({ hasPulsezoom: src.includes("pulsezoom"), hasFx2Breath: src.includes("fx2Breath"), hasTriangulate: src.includes("triangulate") })
```

Expected: `hasPulsezoom: true`, `hasFx2Breath: true`, `hasTriangulate: false`.

- [ ] **Step 4: Confirm the effect visibly breathes**

```js
S.fx2.pulsezoom = true;
function sampleCanvas() {
  const c = document.getElementById('canvas');
  const ctx2 = c.getContext('2d');
  const img = ctx2.getImageData(0, 0, c.width, c.height).data;
  let sum = 0, n = 0;
  for (let i = 0; i < img.length; i += 4) { sum += 0.299*img[i] + 0.587*img[i+1] + 0.114*img[i+2]; n++; }
  return sum / n;
}
const s1 = sampleCanvas();
await new Promise(r => setTimeout(r, 800));
const s2 = sampleCanvas();
({ s1, s2, differs: s1 !== s2, breath: S.fx2Breath })
```

Expected: `differs: true` (confirms real animation, not a frozen/no-op toggle); `breath` is a non-zero, growing number (confirms the accumulator is actually advancing).

- [ ] **Step 5: Confirm the beat kick adds extra zoom**

```js
S.beat = 0; S.transient = 0;
await new Promise(r => setTimeout(r, 200));
function sampleCanvas() {
  const c = document.getElementById('canvas');
  const ctx2 = c.getContext('2d');
  const img = ctx2.getImageData(0, 0, c.width, c.height).data;
  let sum = 0, n = 0;
  for (let i = 0; i < img.length; i += 4) { sum += 0.299*img[i] + 0.587*img[i+1] + 0.114*img[i+2]; n++; }
  return sum / n;
}
const beatOff = sampleCanvas();
S.beat = 1; S.transient = 1;
await new Promise(r => setTimeout(r, 200));
const beatOn = sampleCanvas();
S.beat = 0; S.transient = 0;
({ beatOff, beatOn, differs: beatOff !== beatOn })
```

Expected: `differs: true`.

- [ ] **Step 6: Confirm breathing tempo tracks S.mids**

```js
S.mids = 0;
await new Promise(r => setTimeout(r, 300));
const b1 = S.fx2Breath;
await new Promise(r => setTimeout(r, 300));
const b2 = S.fx2Breath;
const slowRate = b2 - b1;
S.mids = 1;
await new Promise(r => setTimeout(r, 300));
const b3 = S.fx2Breath;
await new Promise(r => setTimeout(r, 300));
const b4 = S.fx2Breath;
const fastRate = b4 - b3;
S.mids = 0;
({ slowRate, fastRate, fasterWithMids: fastRate > slowRate })
```

Expected: `fasterWithMids: true`.

- [ ] **Step 7: Confirm Ctrl+9 keyboard shortcut still toggles it (through the actual keydown handler, not just direct state manipulation)**

```js
S.fx2.pulsezoom = false;
document.dispatchEvent(new KeyboardEvent("keydown", { key: "9", ctrlKey: true, bubbles: true }));
await new Promise(r => setTimeout(r, 100));
const afterOne = S.fx2.pulsezoom;
document.dispatchEvent(new KeyboardEvent("keydown", { key: "9", ctrlKey: true, bubbles: true }));
await new Promise(r => setTimeout(r, 100));
const afterTwo = S.fx2.pulsezoom;
({ afterOne, afterTwo })
```

Expected: `{ afterOne: true, afterTwo: false }` (first press toggles on, second toggles off).

- [ ] **Step 8: Confirm toggling off cleanly stops the animation**

```js
S.fx2.pulsezoom = true;
await new Promise(r => setTimeout(r, 300));
S.fx2.pulsezoom = false;
await new Promise(r => setTimeout(r, 300));
function sampleCanvas() {
  const c = document.getElementById('canvas');
  const ctx2 = c.getContext('2d');
  const img = ctx2.getImageData(0, 0, c.width, c.height).data;
  let sum = 0, n = 0;
  for (let i = 0; i < img.length; i += 4) { sum += 0.299*img[i] + 0.587*img[i+1] + 0.114*img[i+2]; n++; }
  return sum / n;
}
const off1 = sampleCanvas();
await new Promise(r => setTimeout(r, 300));
const off2 = sampleCanvas();
({ off1, off2, stableWithinNoise: Math.abs(off1 - off2) < 3 })
```

Expected: `stableWithinNoise: true` (small residual differences from the app's own ambient animation are fine; the pulsezoom-specific scale oscillation itself should be gone). Take a screenshot too, for a direct visual confirmation of the breathing effect while it's still on (re-enable briefly if needed).

- [ ] **Step 9: Check console for new errors**

Use the Browser pane's console-reading tool. Expected: no new errors attributable to this change.

- [ ] **Step 10: Stop the dev server**

```bash
pkill -f "serve -l 8940" 2>/dev/null; true
```

- [ ] **Step 11: Push and hash-confirm live**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
git push origin main
```

Use `dangerouslyDisableSandbox: true` on this command.

```bash
LOCAL=$(shasum -a 256 elastic-morph.html | cut -d' ' -f1)
for i in 1 2 3 4 5 6; do
  sleep 20
  LIVE=$(curl -s https://elasticmorph.app/elastic-morph.html | shasum -a 256 | cut -d' ' -f1)
  echo "attempt $i: live=$LIVE local=$LOCAL"
  if [ "$LIVE" = "$LOCAL" ]; then echo "MATCH"; break; fi
done
```

Expected: `MATCH` within the retry window.

- [ ] **Step 12: Update the shared progress ledger**

Append to `.superpowers/sdd/progress.md`:

```
=== Plan: 2026-08-29-fx-rack-ii-pulse-zoom.md ===
Task 1: complete (commit <hash>, tests <N>/0 failed)
Task 2: complete — live-verified. Pulse Zoom confirmed live via applyPostFX2.toString() (contains pulsezoom/fx2Breath, no triangulate). Breathing animation confirmed (canvas pixel-mean differs over time, S.fx2Breath advancing), beat/transient kick confirmed, breathing tempo confirmed tracking S.mids, Ctrl+9 keyboard shortcut confirmed working through the real keydown handler, clean stop-on-toggle-off confirmed. 0 new console errors. Pushed <hash>, hash-confirmed live.
fx-rack-ii-pulse-zoom: FULLY SHIPPED.
```

Fill in the actual commit hash and test count.

---

## Post-plan note for whoever runs this

This is a small, single-round, single-file, no-build-pipeline-concern feature — no final whole-branch review is mandated by this plan. If Task 2's live verification surfaces anything unexpected, treat it as a normal bug: fix directly, re-verify, re-push, following this session's established practice of fixing Critical/Important issues without re-asking Frank unless it's a genuine design tradeoff.
