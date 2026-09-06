# Image Layer Filter Performance (Scratch Canvas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `ctx.filter` being recomputed on every individual `drawImage` call inside 8 loop-heavy Image Layer modes (16-70 draws/frame each), which makes Safari's color filters invisible and Chrome slow whenever a filter is active — by routing each mode's many unfiltered sub-draws through a shared scratch canvas and blitting the finished composite through the real, filtered `ctx` exactly once per frame.

**Architecture:** One new helper, `imageLayerScratchCanvas(w, h)` (modeled on the existing `bgVidScratchCanvas`), shared by all 8 modes across all 3 render generations. Each mode's branch gets its internal `ctx.*` calls changed to the scratch canvas's own context (`sctx`), then adds one final `ctx.drawImage(scratch, 0, 0)` to composite the result onto the real, filtered canvas. Split into 3 tasks by file/generation: classic modes live directly in `elastic-morph.html`; V67 and V99 modes are build-injected from `src/inject-v67.js` / `src/inject-v99.js` and require `node build.js` before testing.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), Canvas 2D API, zero-dependency static-assertion test harness (`test.js`), `node build.js` merge step for `src/inject-vNN.js` modules.

## Global Constraints

- Full design/rationale/audit: `docs/superpowers/specs/2026-09-06-image-layer-filter-scratch-canvas-design.md`.
- Exactly 8 modes get this fix: `displace`, `shards` (classic, native to `elastic-morph.html`), `glitch`, `ripple`, `kaleido` (V67, `src/inject-v67.js`), `parallax`, `datamosh`, `tunnel` (V99, `src/inject-v99.js`). No other mode changes.
- No visual/behavioral change to any mode — pixel-identical output, just composited through one intermediate canvas first.
- **Build-injection gotcha:** `drawImageLayerV67` is sourced from `src/inject-v67.js`, `drawImageLayerV99` from `src/inject-v99.js` (confirmed via `grep -n "function drawImageLayerV67\|function drawImageLayerV99" src/*.js`). Edit those `src/` files directly, never the generated copy in `elastic-morph.html`, and run `node build.js` before `node test.js`. `drawImageLayer` (classic) and `coverRect` are confirmed native to `elastic-morph.html` — no rebuild needed for Task 1.
- `imageLayerScratchCanvas` is defined once, natively in `elastic-morph.html` (Task 1) — function declarations hoist to script scope, so the V67/V99 injected code (Tasks 2-3) can call it even though it's physically defined earlier in the file.
- Test style: static source assertions via `extractFn(name)` (defaults to reading the assembled `<script>` block) — same style as the rest of `test.js`. Every existing assertion in `test.js` must keep passing (`npm run ci` = `node build.js && node test.js`).

---

### Task 1: Shared scratch-canvas helper + fix classic modes (`displace`, `shards`)

**Files:**
- Modify: `elastic-morph.html:6372` (insert `imageLayerScratchCanvas` immediately before `function drawImageLayer`)
- Modify: `elastic-morph.html:6421-6434` (`displace` branch)
- Modify: `elastic-morph.html:6452-6471` (`shards` branch)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Produces: `function imageLayerScratchCanvas(w, h)` → `HTMLCanvasElement`, reused via `S._imgLayerScratch`, resized only when `w`/`h` change. Tasks 2 and 3 call this by name — no import needed, it's a global function in the same script.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Image Layer filter performance (scratch canvas)");

ok("imageLayerScratchCanvas creates and resizes a shared scratch canvas", (() => {
  const fn = extractFn("imageLayerScratchCanvas");
  return !!fn
    && fn.includes('if (!S._imgLayerScratch) S._imgLayerScratch = document.createElement("canvas");')
    && fn.includes("if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }")
    && fn.includes("return c;");
})());

ok("displace mode draws its bands onto a scratch canvas instead of ctx directly", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn
    && fn.includes('if (IM.mode === "displace") {')
    && fn.includes("const scratch = imageLayerScratchCanvas(W, H);")
    && fn.includes('sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + wav, oY + bI * bh, dW, bh + 1);')
    && !fn.includes('ctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + wav, oY + bI * bh, dW, bh + 1);');
})());

ok("displace mode blits the finished scratch composite through the real (filtered) ctx exactly once", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn && fn.includes("ctx.drawImage(scratch, 0, 0);\n  ctx.restore();\n  return;");
})());

ok("shards mode draws its quads onto a scratch canvas instead of ctx directly", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn
    && fn.includes('if (IM.mode === "shards") {')
    && fn.includes("sctx.drawImage(IM.img, sx, sy, sw, sh, -qw / 2 - 0.5, -qh / 2 - 0.5, qw + 1, qh + 1);")
    && !fn.includes("ctx.drawImage(IM.img, sx, sy, sw, sh, -qw / 2 - 0.5, -qh / 2 - 0.5, qw + 1, qh + 1);");
})());

ok("shards mode blits the finished scratch composite through the real (filtered) ctx exactly once", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn && fn.includes("ctx.drawImage(scratch, 0, 0);\n  ctx.restore(); return;");
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all 5 new assertions under "Image Layer filter performance (scratch canvas)" print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement — `imageLayerScratchCanvas` helper**

At `elastic-morph.html:6372` (immediately before `function drawImageLayer(IM, W, H, baseHue, dt, opMul) {`), insert:

```js
// One shared scratch canvas for every Image Layer mode that draws IM.img many
// times per frame. Draw all of a mode's sub-images onto this (unfiltered —
// it's a separate context, so ctx.filter never touches it), then blit it
// through the real, already-filtered ctx exactly once. Fixes ctx.filter being
// recomputed per drawImage call in loop-heavy modes (Chrome: slow; Safari:
// filter invisible) — same fix as bgVidScratchCanvas (elastic-morph.html
// v112, background video).
function imageLayerScratchCanvas(w, h) {
  if (!S._imgLayerScratch) S._imgLayerScratch = document.createElement("canvas");
  const c = S._imgLayerScratch;
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c;
}
```

- [ ] **Step 4: Implement — `displace` mode**

At `elastic-morph.html:6421-6434`, find:

```js
  if (IM.mode === "displace") {
    const { dW, dH, oX, oY } = coverRect(W, H, IM);
    const bands = 70, bh = dH / bands;
    const amp = dW * 0.05 * IM.amount;
    ctx.globalCompositeOperation = "source-over";
    for (let bI = 0; bI < bands; bI++) {
      const sy = (bI / bands) * IM.img.height;
      const sh = IM.img.height / bands;
      const wav = Math.sin(S.time * 2.2 + bI * 0.38) * amp * (S.bass * 1.3 + S.mids * 0.6 + 0.05);
      ctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + wav, oY + bI * bh, dW, bh + 1);
    }
    ctx.restore();
    return;
  }
```

Replace it with:

```js
  if (IM.mode === "displace") {
    const { dW, dH, oX, oY } = coverRect(W, H, IM);
    const bands = 70, bh = dH / bands;
    const amp = dW * 0.05 * IM.amount;
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, W, H);
    sctx.globalCompositeOperation = "source-over";
    for (let bI = 0; bI < bands; bI++) {
      const sy = (bI / bands) * IM.img.height;
      const sh = IM.img.height / bands;
      const wav = Math.sin(S.time * 2.2 + bI * 0.38) * amp * (S.bass * 1.3 + S.mids * 0.6 + 0.05);
      sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + wav, oY + bI * bh, dW, bh + 1);
    }
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
    return;
  }
```

- [ ] **Step 5: Implement — `shards` mode**

At `elastic-morph.html:6452-6471`, find:

```js
  if (IM.mode === "shards") {
    const { dW, dH, oX, oY } = coverRect(W, H, IM);
    const cols2 = 10, rows2 = Math.max(1, Math.round(cols2 * dH / dW));
    const qw = dW / cols2, qh = dH / rows2;
    const ex = (beat * 0.6 + S.transient * 0.6) * IM.amount;
    const cx0 = W / 2, cy0 = H / 2, push = ex * 180 * (H / 720);
    for (let j = 0; j < rows2; j++) for (let i = 0; i < cols2; i++) {
      const sx = i / cols2 * IM.img.width, sy = j / rows2 * IM.img.height;
      const sw = IM.img.width / cols2, sh = IM.img.height / rows2;
      const qx = oX + (i + 0.5) * qw, qy = oY + (j + 0.5) * qh;
      const dx = qx - cx0, dy = qy - cy0, d = Math.hypot(dx, dy) || 1;
      const rot = Math.sin(i * 12.9 + j * 7.3) * ex * 0.6;
      ctx.save();
      ctx.translate(qx + dx / d * push, qy + dy / d * push);
      ctx.rotate(rot);
      ctx.drawImage(IM.img, sx, sy, sw, sh, -qw / 2 - 0.5, -qh / 2 - 0.5, qw + 1, qh + 1);
      ctx.restore();
    }
    ctx.restore(); return;
  }
```

Replace it with:

```js
  if (IM.mode === "shards") {
    const { dW, dH, oX, oY } = coverRect(W, H, IM);
    const cols2 = 10, rows2 = Math.max(1, Math.round(cols2 * dH / dW));
    const qw = dW / cols2, qh = dH / rows2;
    const ex = (beat * 0.6 + S.transient * 0.6) * IM.amount;
    const cx0 = W / 2, cy0 = H / 2, push = ex * 180 * (H / 720);
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, W, H);
    for (let j = 0; j < rows2; j++) for (let i = 0; i < cols2; i++) {
      const sx = i / cols2 * IM.img.width, sy = j / rows2 * IM.img.height;
      const sw = IM.img.width / cols2, sh = IM.img.height / rows2;
      const qx = oX + (i + 0.5) * qw, qy = oY + (j + 0.5) * qh;
      const dx = qx - cx0, dy = qy - cy0, d = Math.hypot(dx, dy) || 1;
      const rot = Math.sin(i * 12.9 + j * 7.3) * ex * 0.6;
      sctx.save();
      sctx.translate(qx + dx / d * push, qy + dy / d * push);
      sctx.rotate(rot);
      sctx.drawImage(IM.img, sx, sy, sw, sh, -qw / 2 - 0.5, -qh / 2 - 0.5, qw + 1, qh + 1);
      sctx.restore();
    }
    ctx.drawImage(scratch, 0, 0);
    ctx.restore(); return;
  }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 5 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "fix: composite Image Layer displace/shards through a scratch canvas before filtering

Root cause from a live debugging session (see
docs/superpowers/specs/2026-09-06-image-layer-filter-scratch-canvas-design.md):
ctx.filter is reapplied on every individual drawImage call, not once per
frame -- displace draws 70 bands/frame and shards ~50-60 quads/frame, all
under one active filter. Explains Safari's invisible color filters and
Chrome's filter-triggered slowdown for these two modes.

New shared imageLayerScratchCanvas(w, h) helper (modeled on the existing
bgVidScratchCanvas fix for background video): both modes now draw their
many sub-images onto this unfiltered scratch canvas, then blit the
finished composite through the real, filtered ctx exactly once. Same
pixels, 1 filter application per frame instead of 50-70.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Fix V67 modes (`glitch`, `ripple`, `kaleido`)

**Files:**
- Modify: `src/inject-v67.js` (NOT `elastic-morph.html` — build-injected, see Global Constraints)
- Test: `test.js` (new section, appended after Task 1's section)

**Interfaces:**
- Consumes: `imageLayerScratchCanvas(w, h)` from Task 1 (already merged into `elastic-morph.html` and thus available at runtime once `node build.js` re-merges `src/inject-v67.js` alongside it).
- Produces: nothing new consumed by later tasks — Task 3 is independent.

- [ ] **Step 1: Write the failing tests**

In `test.js`, find the section added in Task 1 and add these assertions immediately after its last `ok(...)` call (still before `/* ---------------- summary ---------------- */`):

```js
ok("V67 glitch mode draws its bands onto a scratch canvas instead of ctx directly", (() => {
  const fn = extractFn("drawImageLayerV67");
  return !!fn
    && fn.includes('if (IM.mode === "glitch") {')
    && fn.includes("const scratch = imageLayerScratchCanvas(W, H);")
    && fn.includes("sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + jx, oY + b * bh, dW, bh + 1);")
    && !fn.includes("ctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + jx, oY + b * bh, dW, bh + 1);")
    && fn.includes("sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + jx + 8, oY + b * bh, dW, bh + 1);");
})());

ok("V67 ripple mode draws its bands onto a scratch canvas instead of ctx directly", (() => {
  const fn = extractFn("drawImageLayerV67");
  return !!fn
    && fn.includes('} else if (IM.mode === "ripple") {')
    && fn.includes("sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + wav + wav2, oY + b * bh, dW, bh + 1);")
    && !fn.includes("ctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + wav + wav2, oY + b * bh, dW, bh + 1);");
})());

ok("V67 kaleido mode draws its segments onto a scratch canvas instead of ctx directly", (() => {
  const fn = extractFn("drawImageLayerV67");
  return !!fn
    && fn.includes('} else if (IM.mode === "kaleido") {')
    && fn.includes("sctx.drawImage(IM.img, -dW / 2, -dH / 2, dW, dH);")
    && fn.includes("sctx.translate(cx, cy);")
    && fn.includes("sctx.rotate(S.time * 0.05 * amt + beat * 0.08);");
})());

ok("V67 glitch/ripple/kaleido each blit their scratch composite through the real (filtered) ctx exactly once", (() => {
  const fn = extractFn("drawImageLayerV67");
  const count = (fn.match(/ctx\.drawImage\(scratch, 0, 0\);/g) || []).length;
  return count === 3;
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node build.js && node test.js`
Expected: the 4 new V67 assertions print `✗` (glitch/ripple/kaleido still draw straight to `ctx`), everything else (including Task 1's 5 assertions) prints `✓`.

- [ ] **Step 3: Implement — `glitch`, `ripple`, `kaleido`**

Open `src/inject-v67.js`. Find:

```js
  if (IM.mode === "glitch") {
    const bands = 24 + Math.round(amt * 20);
    const bh = dH / bands;
    const glitch = (beat * 0.85 + S.transient * 0.9) * amt;
    for (let b = 0; b < bands; b++) {
      const sy = (b / bands) * IM.img.height;
      const sh = IM.img.height / bands + 1;
      const jx = (Math.random() - 0.5) * dW * 0.12 * glitch;
      const dup = glitch > 0.35 && b % 7 === 0;
      ctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + jx, oY + b * bh, dW, bh + 1);
      if (dup) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha *= 0.45;
        ctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + jx + 8, oY + b * bh, dW, bh + 1);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = IM.opacity * (opMul == null ? 1 : opMul);
      }
    }
  } else if (IM.mode === "ripple") {
    const bands = 56;
    const bh = dH / bands;
    const amp = dW * 0.04 * amt * (0.4 + energy + beat * 0.5);
    for (let b = 0; b < bands; b++) {
      const sy = (b / bands) * IM.img.height;
      const sh = IM.img.height / bands + 1;
      const cx = (b / bands - 0.5) * 2;
      const wav = Math.sin(S.time * 3 + b * 0.22 + cx * 4) * amp;
      const wav2 = Math.cos(S.time * 2.1 + b * 0.15) * amp * 0.35 * S.bass;
      ctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + wav + wav2, oY + b * bh, dW, bh + 1);
    }
  } else if (IM.mode === "kaleido") {
    const cx = W / 2, cy = H / 2;
    const segs = 4 + Math.round(amt * 4);
    const diag = Math.hypot(W, H);
    const fill = diag / Math.min(dW, dH);
    ctx.translate(cx, cy);
    ctx.rotate(S.time * 0.05 * amt + beat * 0.08);
    for (let s = 0; s < segs; s++) {
      ctx.save();
      ctx.rotate((Math.PI * 2 / segs) * s);
      ctx.scale(s % 2 ? 1 : -1, 1);
      ctx.scale(fill * (1 + beat * 0.04 * amt), fill * (1 + beat * 0.04 * amt));
      ctx.drawImage(IM.img, -dW / 2, -dH / 2, dW, dH);
      ctx.restore();
    }
  } else if (IM.mode === "scan") {
```

Replace it with:

```js
  if (IM.mode === "glitch") {
    const bands = 24 + Math.round(amt * 20);
    const bh = dH / bands;
    const glitch = (beat * 0.85 + S.transient * 0.9) * amt;
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, W, H);
    for (let b = 0; b < bands; b++) {
      const sy = (b / bands) * IM.img.height;
      const sh = IM.img.height / bands + 1;
      const jx = (Math.random() - 0.5) * dW * 0.12 * glitch;
      const dup = glitch > 0.35 && b % 7 === 0;
      sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + jx, oY + b * bh, dW, bh + 1);
      if (dup) {
        sctx.globalCompositeOperation = "lighter";
        sctx.globalAlpha = 0.45;
        sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + jx + 8, oY + b * bh, dW, bh + 1);
        sctx.globalCompositeOperation = "source-over";
        sctx.globalAlpha = 1;
      }
    }
    ctx.drawImage(scratch, 0, 0);
  } else if (IM.mode === "ripple") {
    const bands = 56;
    const bh = dH / bands;
    const amp = dW * 0.04 * amt * (0.4 + energy + beat * 0.5);
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, W, H);
    for (let b = 0; b < bands; b++) {
      const sy = (b / bands) * IM.img.height;
      const sh = IM.img.height / bands + 1;
      const cx = (b / bands - 0.5) * 2;
      const wav = Math.sin(S.time * 3 + b * 0.22 + cx * 4) * amp;
      const wav2 = Math.cos(S.time * 2.1 + b * 0.15) * amp * 0.35 * S.bass;
      sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + wav + wav2, oY + b * bh, dW, bh + 1);
    }
    ctx.drawImage(scratch, 0, 0);
  } else if (IM.mode === "kaleido") {
    const cx = W / 2, cy = H / 2;
    const segs = 4 + Math.round(amt * 4);
    const diag = Math.hypot(W, H);
    const fill = diag / Math.min(dW, dH);
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, W, H);
    sctx.translate(cx, cy);
    sctx.rotate(S.time * 0.05 * amt + beat * 0.08);
    for (let s = 0; s < segs; s++) {
      sctx.save();
      sctx.rotate((Math.PI * 2 / segs) * s);
      sctx.scale(s % 2 ? 1 : -1, 1);
      sctx.scale(fill * (1 + beat * 0.04 * amt), fill * (1 + beat * 0.04 * amt));
      sctx.drawImage(IM.img, -dW / 2, -dH / 2, dW, dH);
      sctx.restore();
    }
    ctx.drawImage(scratch, 0, 0);
  } else if (IM.mode === "scan") {
```

(`glitch`'s dup-draw dimming used to multiply real `ctx.globalAlpha`, which already carried `IM.opacity`; on `sctx` there is no outer opacity to multiply against, so it's set directly to `0.45` and restored to `1` — the same relative blend between the two bands, with `IM.opacity` applied once, correctly, at the final `ctx.drawImage(scratch, 0, 0)`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node build.js && node test.js`
Expected: all assertions print `✓`, including the 4 new V67 ones. Final line: `<N> passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add src/inject-v67.js elastic-morph.html test.js
git commit -m "fix: composite Image Layer V67 glitch/ripple/kaleido through a scratch canvas before filtering

Same root cause and fix as the classic displace/shards commit (see
docs/superpowers/specs/2026-09-06-image-layer-filter-scratch-canvas-design.md):
glitch draws 24-44 bands/frame, ripple 56, kaleido 4-8 segments, all
under one active ctx.filter that got recomputed on every single draw.

Uses the shared imageLayerScratchCanvas(w, h) helper added for the
classic modes: draw unfiltered onto scratch, blit once through the
real, filtered ctx. Edited in src/inject-v67.js (build-injected into
elastic-morph.html by node build.js) -- not the generated copy.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Fix V99 modes (`parallax`, `datamosh`, `tunnel`)

**Files:**
- Modify: `src/inject-v99.js` (NOT `elastic-morph.html` — build-injected, see Global Constraints)
- Test: `test.js` (new assertions, appended after Task 2's section)

**Interfaces:**
- Consumes: `imageLayerScratchCanvas(w, h)` from Task 1.
- Produces: nothing consumed by later tasks — this is the final task in this plan.

- [ ] **Step 1: Write the failing tests**

In `test.js`, add these assertions immediately after Task 2's last `ok(...)` call (still before `/* ---------------- summary ---------------- */`):

```js
ok("V99 parallax mode draws its bands onto a scratch canvas instead of ctx directly", (() => {
  const fn = extractFn("drawImageLayerV99");
  return !!fn
    && fn.includes('if (IM.mode === "parallax") {')
    && fn.includes("const scratch = imageLayerScratchCanvas(W, H);")
    && fn.includes("sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + shift + drift, oY + b * bh, dW, bh + 1);")
    && !fn.includes("ctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + shift + drift, oY + b * bh, dW, bh + 1);");
})());

ok("V99 datamosh mode draws its blocks onto a scratch canvas instead of ctx directly", (() => {
  const fn = extractFn("drawImageLayerV99");
  return !!fn
    && fn.includes('} else if (IM.mode === "datamosh") {')
    && fn.includes("sctx.drawImage(IM.img, sx, 0, sw, IM.img.height, oX + i * bw + jx, oY + jy, bw + 1, dH);")
    && !fn.includes("ctx.drawImage(IM.img, sx, 0, sw, IM.img.height, oX + i * bw + jx, oY + jy, bw + 1, dH);");
})());

ok("V99 tunnel mode draws its segments onto a scratch canvas instead of ctx directly", (() => {
  const fn = extractFn("drawImageLayerV99");
  return !!fn
    && fn.includes('} else if (IM.mode === "tunnel") {')
    && fn.includes("sctx.drawImage(IM.img, -dW / 2, -dH / 2, dW, dH);")
    && fn.includes("sctx.translate(cx, cy);")
    && fn.includes("sctx.rotate(rot);")
    && fn.includes("sctx.globalAlpha = 0.55 + t * 0.45;");
})());

ok("V99 parallax/datamosh/tunnel each blit their scratch composite through the real (filtered) ctx exactly once", (() => {
  const fn = extractFn("drawImageLayerV99");
  const count = (fn.match(/ctx\.drawImage\(scratch, 0, 0\);/g) || []).length;
  return count === 3;
})());

ok("V99 zoompulse and flicker (not loop-heavy) are unchanged", (() => {
  const fn = extractFn("drawImageLayerV99");
  return !!fn
    && fn.includes('} else if (IM.mode === "zoompulse") {')
    && fn.includes("ctx.drawImage(IM.img, oX, oY, dW, dH);")
    && fn.includes('} else if (IM.mode === "flicker") {');
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node build.js && node test.js`
Expected: the 4 new content assertions for parallax/datamosh/tunnel print `✗`; the "zoompulse and flicker unchanged" assertion already prints `✓` (nothing to change there); everything from Tasks 1-2 still prints `✓`.

- [ ] **Step 3: Implement — `parallax`, `datamosh`, `tunnel`**

Open `src/inject-v99.js`. Find:

```js
  if (IM.mode === "parallax") {
    const bands = 48;
    const bh = dH / bands;
    for (let b = 0; b < bands; b++) {
      const sy = (b / bands) * IM.img.height;
      const sh = IM.img.height / bands + 1;
      const depth = (b / bands - 0.5) * 2;
      const shift = depth * dW * 0.06 * amt * (0.35 + energy + beat * 0.45);
      const drift = Math.sin(S.time * 0.8 + b * 0.11) * dW * 0.015 * amt;
      ctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + shift + drift, oY + b * bh, dW, bh + 1);
    }
  } else if (IM.mode === "zoompulse") {
    const cx = W / 2, cy = H / 2;
    const pulse = 1 + (beat * 0.14 + S.transient * 0.1 + energy * 0.06) * amt;
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.translate(-cx, -cy);
    ctx.drawImage(IM.img, oX, oY, dW, dH);
  } else if (IM.mode === "datamosh") {
    const blocks = 10 + Math.round(amt * 10);
    const bw = dW / blocks;
    const slip = (beat * 0.85 + S.transient * 0.75) * amt;
    for (let i = 0; i < blocks; i++) {
      const sx = (i / blocks) * IM.img.width;
      const sw = IM.img.width / blocks + 1;
      const jx = (Math.random() - 0.5) * dW * 0.18 * slip;
      const jy = (i % 3 === 0 ? (Math.random() - 0.5) * dH * 0.04 * slip : 0);
      ctx.drawImage(IM.img, sx, 0, sw, IM.img.height, oX + i * bw + jx, oY + jy, bw + 1, dH);
    }
  } else if (IM.mode === "flicker") {
    const gate = 0.55 + beat * 0.45 * amt + S.transient * 0.35 * amt;
    ctx.globalAlpha *= Math.max(0.12, Math.min(1, gate));
    ctx.drawImage(IM.img, oX, oY, dW, dH);
    if (beat > 0.5 * amt) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = IM.opacity * (opMul == null ? 1 : opMul) * beat * 0.22 * amt;
      ctx.drawImage(IM.img, oX, oY, dW, dH);
      ctx.globalCompositeOperation = "source-over";
    }
  } else if (IM.mode === "tunnel") {
    const cx = W / 2, cy = H / 2;
    const segs = 16 + Math.round(amt * 8);
    const rot = S.time * 0.08 * amt + beat * 0.12;
    const pull = 1 + (beat * 0.08 + energy * 0.05) * amt;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    for (let s = 0; s < segs; s++) {
      const t = s / segs;
      const sc = (0.35 + t * 0.95) * pull;
      ctx.save();
      ctx.scale(sc, sc);
      ctx.globalAlpha *= 0.55 + t * 0.45;
      ctx.drawImage(IM.img, -dW / 2, -dH / 2, dW, dH);
      ctx.restore();
    }
  }
```

Replace it with:

```js
  if (IM.mode === "parallax") {
    const bands = 48;
    const bh = dH / bands;
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, W, H);
    for (let b = 0; b < bands; b++) {
      const sy = (b / bands) * IM.img.height;
      const sh = IM.img.height / bands + 1;
      const depth = (b / bands - 0.5) * 2;
      const shift = depth * dW * 0.06 * amt * (0.35 + energy + beat * 0.45);
      const drift = Math.sin(S.time * 0.8 + b * 0.11) * dW * 0.015 * amt;
      sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + shift + drift, oY + b * bh, dW, bh + 1);
    }
    ctx.drawImage(scratch, 0, 0);
  } else if (IM.mode === "zoompulse") {
    const cx = W / 2, cy = H / 2;
    const pulse = 1 + (beat * 0.14 + S.transient * 0.1 + energy * 0.06) * amt;
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.translate(-cx, -cy);
    ctx.drawImage(IM.img, oX, oY, dW, dH);
  } else if (IM.mode === "datamosh") {
    const blocks = 10 + Math.round(amt * 10);
    const bw = dW / blocks;
    const slip = (beat * 0.85 + S.transient * 0.75) * amt;
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, W, H);
    for (let i = 0; i < blocks; i++) {
      const sx = (i / blocks) * IM.img.width;
      const sw = IM.img.width / blocks + 1;
      const jx = (Math.random() - 0.5) * dW * 0.18 * slip;
      const jy = (i % 3 === 0 ? (Math.random() - 0.5) * dH * 0.04 * slip : 0);
      sctx.drawImage(IM.img, sx, 0, sw, IM.img.height, oX + i * bw + jx, oY + jy, bw + 1, dH);
    }
    ctx.drawImage(scratch, 0, 0);
  } else if (IM.mode === "flicker") {
    const gate = 0.55 + beat * 0.45 * amt + S.transient * 0.35 * amt;
    ctx.globalAlpha *= Math.max(0.12, Math.min(1, gate));
    ctx.drawImage(IM.img, oX, oY, dW, dH);
    if (beat > 0.5 * amt) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = IM.opacity * (opMul == null ? 1 : opMul) * beat * 0.22 * amt;
      ctx.drawImage(IM.img, oX, oY, dW, dH);
      ctx.globalCompositeOperation = "source-over";
    }
  } else if (IM.mode === "tunnel") {
    const cx = W / 2, cy = H / 2;
    const segs = 16 + Math.round(amt * 8);
    const rot = S.time * 0.08 * amt + beat * 0.12;
    const pull = 1 + (beat * 0.08 + energy * 0.05) * amt;
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, W, H);
    sctx.translate(cx, cy);
    sctx.rotate(rot);
    for (let s = 0; s < segs; s++) {
      const t = s / segs;
      const sc = (0.35 + t * 0.95) * pull;
      sctx.save();
      sctx.scale(sc, sc);
      sctx.globalAlpha = 0.55 + t * 0.45;
      sctx.drawImage(IM.img, -dW / 2, -dH / 2, dW, dH);
      sctx.restore();
    }
    ctx.drawImage(scratch, 0, 0);
  }
```

(`tunnel`'s per-segment `ctx.globalAlpha *= 0.55 + t * 0.45` used to compound onto real `ctx`'s existing `IM.opacity`; on `sctx`, starting fresh from the default `globalAlpha` of `1`, it's set directly to the same per-segment falloff, with `IM.opacity` applied once, correctly, at the final `ctx.drawImage(scratch, 0, 0)`. `zoompulse` and `flicker` are untouched — confirmed not loop-heavy, 1-2 draws/frame each.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node build.js && node test.js`
Expected: all assertions print `✓`, including every new one from Tasks 1-3. Final line: `<N> passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add src/inject-v99.js elastic-morph.html test.js
git commit -m "fix: composite Image Layer V99 parallax/datamosh/tunnel through a scratch canvas before filtering

Same root cause and fix as the earlier two commits in this series (see
docs/superpowers/specs/2026-09-06-image-layer-filter-scratch-canvas-design.md):
parallax draws 48 bands/frame, datamosh 10-20 blocks, tunnel ('Tunnel
Warp' -- the mode in the originally reported screenshots) 16-24
segments, all under one active ctx.filter recomputed on every draw.

Closes the full 8-mode audit from the design spec: displace, shards
(classic), glitch, ripple, kaleido (V67), and now parallax, datamosh,
tunnel (V99) all composite through imageLayerScratchCanvas before a
single filtered blit. zoompulse and flicker confirmed not loop-heavy,
left unchanged. Edited in src/inject-v99.js (build-injected) -- not
the generated copy.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

---

### Task 4: Ken Burns overscan padding (post-review fix) — ⚠️ SUPERSEDED BY TASK 5

**This task's approach was implemented (commit `7532e2b`) and then rejected
on task review: it is a geometric no-op.** Kept below only as an accurate
record of what was tried and why it doesn't work — do not implement this
version. Skip straight to Task 5 for the corrected fix.

Padding the scratch canvas and shifting the coordinate origin via
`sctx.translate(padX, padY)` / blitting at `(-padX, -padY)` does nothing,
because `coverRect` (and, for `kaleido`/`tunnel`, the mode's own center
point) is still computed from the *unpadded* `W`/`H` — the mode's actual
drawn footprint never grows into the new padding. The translate and its
exact inverse at blit time cancel out; the extra padding is permanently
empty transparent border, and the original Ken Burns clipping bug is
completely unaffected. See the design doc's "Post-implementation amendment"
§1 "Round 1 (rejected)" for the full proof.

Added after the final whole-branch review found the scratch canvas is not
pixel-identical when `IM.kenburns` is active: Ken Burns' pan/zoom is applied
on the real `ctx` *after* a heavy mode's scratch composite is blitted, and
at min-zoom (`1.06`) / max-drift (`±0.05·W`, `±0.045·H`) it can reveal a
thin strip beyond the scratch's `W`×`H` bounds, plus slightly soften the
composite once magnified into that gap. See the design doc's "Post-
implementation amendment" section for the full rationale and the two other
findings resolved by documentation only (no code change).

**Files:**
- Modify: `elastic-morph.html` (new `imageLayerKenBurnsPad` helper + `displace`/`shards`)
- Modify: `src/inject-v67.js` (`glitch`/`ripple`/`kaleido`)
- Modify: `src/inject-v99.js` (`parallax`/`datamosh`/`tunnel`)
- Test: `test.js`

**Interfaces:**
- Consumes: `imageLayerScratchCanvas(w, h)` from Task 1 (unchanged signature — just called with padded dimensions now).
- Produces: `function imageLayerKenBurnsPad(IM, W, H)` → `{ padX, padY }` (both `0` when `IM.kenburns` is falsy). Every one of the 8 fixed modes calls this and applies the same recipe: pad the scratch, `sctx.translate(padX, padY)` once before the mode's existing drawing code (otherwise unchanged), blit with `ctx.drawImage(scratch, -padX, -padY)` instead of `(scratch, 0, 0)`. Also folds in two Minor findings from the final review while every site is being touched anyway: an explicit `sctx.globalAlpha = 1; sctx.globalCompositeOperation = "source-over";` reset after each `clearRect` (previously only `displace` reset compositing, implicitly, and only for itself), and a `getContext("2d")` null-guard matching `bgVidScratchCanvas`'s own pattern.

- [ ] **Step 1: Write the failing tests**

In `test.js`, add these assertions immediately after Task 3's last `ok(...)` call (still before `/* ---------------- summary ---------------- */`):

```js
ok("imageLayerKenBurnsPad returns zero padding when Ken Burns is off, else the derived overscan", (() => {
  const fn = extractFn("imageLayerKenBurnsPad");
  return !!fn
    && fn.includes("if (!IM.kenburns) return { padX: 0, padY: 0 };")
    && fn.includes("return { padX: Math.ceil(W * KB_PAD_FRAC_X), padY: Math.ceil(H * KB_PAD_FRAC_Y) };");
})());

ok("KB_PAD_FRAC_X/Y are derived from the Ken Burns transform's own literals (zoom 1.06, drift 0.05/0.045)", (() => {
  return script.includes("const KB_PAD_FRAC_X = 0.05 - 0.5 * (1 - 1 / 1.06);")
    && script.includes("const KB_PAD_FRAC_Y = 0.045 - 0.5 * (1 - 1 / 1.06);");
})());

ok("displace pads the scratch for Ken Burns and blits at the negative offset", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn
    && fn.includes('if (IM.mode === "displace") {')
    && fn.includes("const { padX, padY } = imageLayerKenBurnsPad(IM, W, H);")
    && fn.includes("const scratch = imageLayerScratchCanvas(W + padX * 2, H + padY * 2);")
    && fn.includes("sctx.translate(padX, padY);")
    && fn.includes("ctx.drawImage(scratch, -padX, -padY);");
})());

ok("shards pads the scratch for Ken Burns and blits at the negative offset", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn
    && fn.includes('if (IM.mode === "shards") {')
    && (fn.match(/const \{ padX, padY \} = imageLayerKenBurnsPad\(IM, W, H\);/g) || []).length === 2;
})());

ok("V67 glitch/ripple/kaleido each pad the scratch for Ken Burns and blit at the negative offset", (() => {
  const fn = extractFn("drawImageLayerV67");
  return !!fn
    && (fn.match(/const \{ padX, padY \} = imageLayerKenBurnsPad\(IM, W, H\);/g) || []).length === 3
    && (fn.match(/ctx\.drawImage\(scratch, -padX, -padY\);/g) || []).length === 3;
})());

ok("V99 parallax/datamosh/tunnel each pad the scratch for Ken Burns and blit at the negative offset", (() => {
  const fn = extractFn("drawImageLayerV99");
  return !!fn
    && (fn.match(/const \{ padX, padY \} = imageLayerKenBurnsPad\(IM, W, H\);/g) || []).length === 3
    && (fn.match(/ctx\.drawImage\(scratch, -padX, -padY\);/g) || []).length === 3;
})());

ok("all 8 fixed modes reset sctx's alpha/compositing after clearRect (defense against shared-context state leaking between modes)", (() => {
  const classic = extractFn("drawImageLayer");
  const v67 = extractFn("drawImageLayerV67");
  const v99 = extractFn("drawImageLayerV99");
  const resetCount = (src) => (src.match(/sctx\.globalAlpha = 1;\s*\n\s*sctx\.globalCompositeOperation = "source-over";/g) || []).length;
  return resetCount(classic) === 2 && resetCount(v67) === 3 && resetCount(v99) === 3;
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node build.js && node test.js`
Expected: all 7 new assertions print `✗`. Everything from Tasks 1-3 still prints `✓`.

- [ ] **Step 3: Implement — `imageLayerKenBurnsPad` helper**

In `elastic-morph.html`, immediately after the `imageLayerScratchCanvas` function (added in Task 1) and before `function drawImageLayer(...)`, insert:

```js
// Ken Burns pan/zoom (below) is applied on the real ctx AFTER a heavy mode's scratch
// composite is blitted through imageLayerScratchCanvas -- so when Ken Burns is active, the
// scratch must be padded to cover the extra area its min-zoom/max-drift can reveal at the
// frame edges, or a thin strip of whatever is behind the image layer shows through, and the
// composite lands very slightly softer once magnified into that gap. Derived from the exact
// literals in the Ken Burns transform itself (zoom = 1.06 + 0.16*p, drift = ±0.05*W /
// ±0.045*H): the worst case is at p=0, where zoom is at its smallest (1.06).
const KB_PAD_FRAC_X = 0.05 - 0.5 * (1 - 1 / 1.06);   // ≈ 0.0217
const KB_PAD_FRAC_Y = 0.045 - 0.5 * (1 - 1 / 1.06);  // ≈ 0.0167
function imageLayerKenBurnsPad(IM, W, H) {
  if (!IM.kenburns) return { padX: 0, padY: 0 };
  return { padX: Math.ceil(W * KB_PAD_FRAC_X), padY: Math.ceil(H * KB_PAD_FRAC_Y) };
}
```

- [ ] **Step 4: Implement — `displace` and `shards` (`elastic-morph.html`)**

Replace the current `displace` block with:

```js
  if (IM.mode === "displace") {
    const { dW, dH, oX, oY } = coverRect(W, H, IM);
    const bands = 70, bh = dH / bands;
    const amp = dW * 0.05 * IM.amount;
    const { padX, padY } = imageLayerKenBurnsPad(IM, W, H);
    const scratch = imageLayerScratchCanvas(W + padX * 2, H + padY * 2);
    const sctx = scratch.getContext("2d");
    if (!sctx) { ctx.restore(); return; }
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, scratch.width, scratch.height);
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = "source-over";
    sctx.translate(padX, padY);
    for (let bI = 0; bI < bands; bI++) {
      const sy = (bI / bands) * IM.img.height;
      const sh = IM.img.height / bands;
      const wav = Math.sin(S.time * 2.2 + bI * 0.38) * amp * (S.bass * 1.3 + S.mids * 0.6 + 0.05);
      sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + wav, oY + bI * bh, dW, bh + 1);
    }
    ctx.drawImage(scratch, -padX, -padY);
    ctx.restore();
    return;
  }
```

Replace the current `shards` block with:

```js
  if (IM.mode === "shards") {
    const { dW, dH, oX, oY } = coverRect(W, H, IM);
    const cols2 = 10, rows2 = Math.max(1, Math.round(cols2 * dH / dW));
    const qw = dW / cols2, qh = dH / rows2;
    const ex = (beat * 0.6 + S.transient * 0.6) * IM.amount;
    const cx0 = W / 2, cy0 = H / 2, push = ex * 180 * (H / 720);
    const { padX, padY } = imageLayerKenBurnsPad(IM, W, H);
    const scratch = imageLayerScratchCanvas(W + padX * 2, H + padY * 2);
    const sctx = scratch.getContext("2d");
    if (!sctx) { ctx.restore(); return; }
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, scratch.width, scratch.height);
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = "source-over";
    sctx.translate(padX, padY);
    for (let j = 0; j < rows2; j++) for (let i = 0; i < cols2; i++) {
      const sx = i / cols2 * IM.img.width, sy = j / rows2 * IM.img.height;
      const sw = IM.img.width / cols2, sh = IM.img.height / rows2;
      const qx = oX + (i + 0.5) * qw, qy = oY + (j + 0.5) * qh;
      const dx = qx - cx0, dy = qy - cy0, d = Math.hypot(dx, dy) || 1;
      const rot = Math.sin(i * 12.9 + j * 7.3) * ex * 0.6;
      sctx.save();
      sctx.translate(qx + dx / d * push, qy + dy / d * push);
      sctx.rotate(rot);
      sctx.drawImage(IM.img, sx, sy, sw, sh, -qw / 2 - 0.5, -qh / 2 - 0.5, qw + 1, qh + 1);
      sctx.restore();
    }
    ctx.drawImage(scratch, -padX, -padY);
    ctx.restore(); return;
  }
```

- [ ] **Step 5: Implement — `glitch`, `ripple`, `kaleido` (`src/inject-v67.js`)**

Replace the current three-mode block with:

```js
  if (IM.mode === "glitch") {
    const bands = 24 + Math.round(amt * 20);
    const bh = dH / bands;
    const glitch = (beat * 0.85 + S.transient * 0.9) * amt;
    const { padX, padY } = imageLayerKenBurnsPad(IM, W, H);
    const scratch = imageLayerScratchCanvas(W + padX * 2, H + padY * 2);
    const sctx = scratch.getContext("2d");
    if (sctx) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, scratch.width, scratch.height);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "source-over";
      sctx.translate(padX, padY);
      for (let b = 0; b < bands; b++) {
        const sy = (b / bands) * IM.img.height;
        const sh = IM.img.height / bands + 1;
        const jx = (Math.random() - 0.5) * dW * 0.12 * glitch;
        const dup = glitch > 0.35 && b % 7 === 0;
        sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + jx, oY + b * bh, dW, bh + 1);
        if (dup) {
          sctx.globalCompositeOperation = "lighter";
          sctx.globalAlpha = 0.45;
          sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + jx + 8, oY + b * bh, dW, bh + 1);
          sctx.globalCompositeOperation = "source-over";
          sctx.globalAlpha = 1;
        }
      }
      ctx.drawImage(scratch, -padX, -padY);
    }
  } else if (IM.mode === "ripple") {
    const bands = 56;
    const bh = dH / bands;
    const amp = dW * 0.04 * amt * (0.4 + energy + beat * 0.5);
    const { padX, padY } = imageLayerKenBurnsPad(IM, W, H);
    const scratch = imageLayerScratchCanvas(W + padX * 2, H + padY * 2);
    const sctx = scratch.getContext("2d");
    if (sctx) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, scratch.width, scratch.height);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "source-over";
      sctx.translate(padX, padY);
      for (let b = 0; b < bands; b++) {
        const sy = (b / bands) * IM.img.height;
        const sh = IM.img.height / bands + 1;
        const cx = (b / bands - 0.5) * 2;
        const wav = Math.sin(S.time * 3 + b * 0.22 + cx * 4) * amp;
        const wav2 = Math.cos(S.time * 2.1 + b * 0.15) * amp * 0.35 * S.bass;
        sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + wav + wav2, oY + b * bh, dW, bh + 1);
      }
      ctx.drawImage(scratch, -padX, -padY);
    }
  } else if (IM.mode === "kaleido") {
    const cx = W / 2, cy = H / 2;
    const segs = 4 + Math.round(amt * 4);
    const diag = Math.hypot(W, H);
    const fill = diag / Math.min(dW, dH);
    const { padX, padY } = imageLayerKenBurnsPad(IM, W, H);
    const scratch = imageLayerScratchCanvas(W + padX * 2, H + padY * 2);
    const sctx = scratch.getContext("2d");
    if (sctx) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, scratch.width, scratch.height);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "source-over";
      sctx.translate(padX, padY);
      sctx.translate(cx, cy);
      sctx.rotate(S.time * 0.05 * amt + beat * 0.08);
      for (let s = 0; s < segs; s++) {
        sctx.save();
        sctx.rotate((Math.PI * 2 / segs) * s);
        sctx.scale(s % 2 ? 1 : -1, 1);
        sctx.scale(fill * (1 + beat * 0.04 * amt), fill * (1 + beat * 0.04 * amt));
        sctx.drawImage(IM.img, -dW / 2, -dH / 2, dW, dH);
        sctx.restore();
      }
      ctx.drawImage(scratch, -padX, -padY);
    }
  } else if (IM.mode === "scan") {
```

(Only the `if`/`else if` bodies for these 3 modes change — `scan`'s block that follows is untouched context, shown only to anchor the replacement.)

- [ ] **Step 6: Implement — `parallax`, `datamosh`, `tunnel` (`src/inject-v99.js`)**

Replace the current three-mode block with:

```js
  if (IM.mode === "parallax") {
    const bands = 48;
    const bh = dH / bands;
    const { padX, padY } = imageLayerKenBurnsPad(IM, W, H);
    const scratch = imageLayerScratchCanvas(W + padX * 2, H + padY * 2);
    const sctx = scratch.getContext("2d");
    if (sctx) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, scratch.width, scratch.height);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "source-over";
      sctx.translate(padX, padY);
      for (let b = 0; b < bands; b++) {
        const sy = (b / bands) * IM.img.height;
        const sh = IM.img.height / bands + 1;
        const depth = (b / bands - 0.5) * 2;
        const shift = depth * dW * 0.06 * amt * (0.35 + energy + beat * 0.45);
        const drift = Math.sin(S.time * 0.8 + b * 0.11) * dW * 0.015 * amt;
        sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + shift + drift, oY + b * bh, dW, bh + 1);
      }
      ctx.drawImage(scratch, -padX, -padY);
    }
  } else if (IM.mode === "zoompulse") {
    const cx = W / 2, cy = H / 2;
    const pulse = 1 + (beat * 0.14 + S.transient * 0.1 + energy * 0.06) * amt;
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.translate(-cx, -cy);
    ctx.drawImage(IM.img, oX, oY, dW, dH);
  } else if (IM.mode === "datamosh") {
    const blocks = 10 + Math.round(amt * 10);
    const bw = dW / blocks;
    const slip = (beat * 0.85 + S.transient * 0.75) * amt;
    const { padX, padY } = imageLayerKenBurnsPad(IM, W, H);
    const scratch = imageLayerScratchCanvas(W + padX * 2, H + padY * 2);
    const sctx = scratch.getContext("2d");
    if (sctx) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, scratch.width, scratch.height);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "source-over";
      sctx.translate(padX, padY);
      for (let i = 0; i < blocks; i++) {
        const sx = (i / blocks) * IM.img.width;
        const sw = IM.img.width / blocks + 1;
        const jx = (Math.random() - 0.5) * dW * 0.18 * slip;
        const jy = (i % 3 === 0 ? (Math.random() - 0.5) * dH * 0.04 * slip : 0);
        sctx.drawImage(IM.img, sx, 0, sw, IM.img.height, oX + i * bw + jx, oY + jy, bw + 1, dH);
      }
      ctx.drawImage(scratch, -padX, -padY);
    }
  } else if (IM.mode === "flicker") {
    const gate = 0.55 + beat * 0.45 * amt + S.transient * 0.35 * amt;
    ctx.globalAlpha *= Math.max(0.12, Math.min(1, gate));
    ctx.drawImage(IM.img, oX, oY, dW, dH);
    if (beat > 0.5 * amt) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = IM.opacity * (opMul == null ? 1 : opMul) * beat * 0.22 * amt;
      ctx.drawImage(IM.img, oX, oY, dW, dH);
      ctx.globalCompositeOperation = "source-over";
    }
  } else if (IM.mode === "tunnel") {
    const cx = W / 2, cy = H / 2;
    const segs = 16 + Math.round(amt * 8);
    const rot = S.time * 0.08 * amt + beat * 0.12;
    const pull = 1 + (beat * 0.08 + energy * 0.05) * amt;
    const { padX, padY } = imageLayerKenBurnsPad(IM, W, H);
    const scratch = imageLayerScratchCanvas(W + padX * 2, H + padY * 2);
    const sctx = scratch.getContext("2d");
    if (sctx) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, scratch.width, scratch.height);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "source-over";
      sctx.translate(padX, padY);
      sctx.translate(cx, cy);
      sctx.rotate(rot);
      for (let s = 0; s < segs; s++) {
        const t = s / segs;
        const sc = (0.35 + t * 0.95) * pull;
        sctx.save();
        sctx.scale(sc, sc);
        sctx.globalAlpha = 0.55 + t * 0.45;
        sctx.drawImage(IM.img, -dW / 2, -dH / 2, dW, dH);
        sctx.restore();
      }
      ctx.drawImage(scratch, -padX, -padY);
    }
  }
```

(`zoompulse` and `flicker` are shown only as unchanged context to anchor the replacement — do not modify them.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node build.js && node test.js`
Expected: all assertions print `✓`, including the 7 new ones. Final line: `<N> passed, 0 failed`.

- [ ] **Step 8: Commit**

```bash
git add elastic-morph.html src/inject-v67.js src/inject-v99.js test.js
git commit -m "fix: pad Image Layer scratch canvas for Ken Burns overscan, harden shared-context resets

Found in the final whole-branch review of the scratch-canvas filter fix
(see the design doc's 'Post-implementation amendment' section): Ken
Burns' pan/zoom is applied on the real ctx AFTER a heavy mode's scratch
composite is blitted, so at min-zoom (1.06x) / max-drift (+-0.05*W,
+-0.045*H) it could reveal a thin strip beyond the scratch's W x H
bounds, plus slightly soften the composite once magnified into that
gap -- a real, if narrow, deviation from 'pixel-identical'.

New imageLayerKenBurnsPad(IM, W, H) derives the worst-case overscan
directly from the Ken Burns transform's own literals and returns
{padX: 0, padY: 0} when Ken Burns is off (zero cost). All 8 fixed modes
now pad their scratch canvas accordingly, sctx.translate(padX, padY)
once before their existing unchanged drawing code, and blit at
(-padX, -padY) instead of (0, 0).

Also folds in two Minor findings from the same review while every site
was being touched anyway: explicit sctx.globalAlpha = 1 /
globalCompositeOperation = \"source-over\" resets after each clearRect
(previously only displace reset compositing, and only for itself, so a
future 9th site reusing this shared scratch context could inherit
dirty state from whichever mode ran before it), and a getContext(\"2d\")
null-guard matching the existing bgVidScratchCanvas pattern this whole
fix is modeled on.

Two other review findings were resolved by documentation only, no code
change needed (see design doc): displace now correctly honors the
Blend dropdown as an accepted side-fix of moving its compositing reset
onto the scratch context, and kaleido/shards/datamosh's overlap
stacking behavior at reduced opacity is the same accepted composite-
then-fade change already documented for glitch/tunnel.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Ken Burns fix, corrected — replicate the transform on the scratch context

Corrects Task 4 (commit `7532e2b`, superseded — see above): instead of
padding the scratch canvas around an unpadded footprint (a no-op), replicate
the Ken Burns transform itself onto the scratch's own context (`sctx`)
inside each of the 8 heavy modes, and stop applying it to the real `ctx` for
those same 8 modes. The scratch canvas reverts to exactly `W`×`H` (Task 1-3
sizing, no padding) and the blit reverts to `(scratch, 0, 0)` (no offset) —
`imageLayerKenBurnsPad`, `KB_PAD_FRAC_X`, and `KB_PAD_FRAC_Y` are deleted
entirely, dead code. See the design doc's "Post-implementation amendment"
§1 "Round 2 (correct)" for the full proof this is pixel-identical to the
original, pre-Task-1 rasterization.

The two hardening fixes from Task 4 (explicit `sctx.globalAlpha = 1;
sctx.globalCompositeOperation = "source-over";` reset after `clearRect`, and
the `getContext("2d")` null-guard) are correct and unaffected — kept as-is.

**Files:**
- Modify: `elastic-morph.html` (delete `imageLayerKenBurnsPad`/`KB_PAD_FRAC_X`/`KB_PAD_FRAC_Y`; `drawImageLayer`'s shared Ken Burns block; `displace`/`shards`)
- Modify: `src/inject-v67.js` (`drawImageLayerV67`'s shared Ken Burns block; `glitch`/`ripple`/`kaleido`)
- Modify: `src/inject-v99.js` (`drawImageLayerV99`'s shared Ken Burns block; `parallax`/`datamosh`/`tunnel`)
- Test: `test.js`

**Interfaces:**
- Consumes: `imageLayerScratchCanvas(w, h)` from Task 1 (called with plain `W`, `H` again — no padding).
- Produces: nothing new — this task removes an interface (`imageLayerKenBurnsPad`) rather than adding one.

- [ ] **Step 1: Write the failing tests**

In `test.js`, **replace** the 7 assertions added in Task 4's Step 1 (the "imageLayerKenBurnsPad returns zero padding...", "KB_PAD_FRAC_X/Y are derived...", "displace pads the scratch...", "shards pads the scratch...", "V67 glitch/ripple/kaleido each pad...", "V99 parallax/datamosh/tunnel each pad...", and "all 8 fixed modes reset sctx's alpha/compositing..." blocks) with:

```js
ok("imageLayerKenBurnsPad and its constants are gone (Task 4's padding approach was a no-op, corrected in Task 5)", (() => {
  return !script.includes("function imageLayerKenBurnsPad(")
    && !script.includes("KB_PAD_FRAC_X")
    && !script.includes("KB_PAD_FRAC_Y");
})());

ok("drawImageLayer's shared Ken Burns block excludes displace/shards (they replicate it on sctx instead)", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn && fn.includes('if (IM.kenburns && IM.mode !== "displace" && IM.mode !== "shards") {');
})());

ok("drawImageLayerV67's shared Ken Burns block excludes glitch/ripple/kaleido", (() => {
  const fn = extractFn("drawImageLayerV67");
  return !!fn && fn.includes('if (IM.kenburns && IM.mode !== "glitch" && IM.mode !== "ripple" && IM.mode !== "kaleido") {');
})());

ok("drawImageLayerV99's shared Ken Burns block excludes parallax/datamosh/tunnel", (() => {
  const fn = extractFn("drawImageLayerV99");
  return !!fn && fn.includes('if (IM.kenburns && IM.mode !== "parallax" && IM.mode !== "datamosh" && IM.mode !== "tunnel") {');
})());

ok("displace and shards each replicate the Ken Burns transform on sctx and use the plain (unpadded) scratch/blit", (() => {
  const fn = extractFn("drawImageLayer");
  const kbOnSctx = (fn.match(/if \(IM\.kenburns\) \{\s*\n\s*const p = S\.progress;\s*\n\s*const zoom = 1\.06 \+ 0\.16 \* p;\s*\n\s*sctx\.translate\(W \/ 2, H \/ 2\);/g) || []).length;
  const plainScratch = (fn.match(/const scratch = imageLayerScratchCanvas\(W, H\);/g) || []).length;
  const plainBlit = (fn.match(/ctx\.drawImage\(scratch, 0, 0\);/g) || []).length;
  return !!fn && kbOnSctx === 2 && plainScratch === 2 && plainBlit === 2;
})());

ok("V67 glitch/ripple/kaleido each replicate the Ken Burns transform on sctx and use the plain (unpadded) scratch/blit", (() => {
  const fn = extractFn("drawImageLayerV67");
  const kbOnSctx = (fn.match(/if \(IM\.kenburns\) \{\s*\n\s*const p = S\.progress;\s*\n\s*sctx\.translate\(W \/ 2, H \/ 2\);\s*\n\s*sctx\.scale\(1\.06 \+ 0\.16 \* p, 1\.06 \+ 0\.16 \* p\);/g) || []).length;
  const plainScratch = (fn.match(/const scratch = imageLayerScratchCanvas\(W, H\);/g) || []).length;
  const plainBlit = (fn.match(/ctx\.drawImage\(scratch, 0, 0\);/g) || []).length;
  return !!fn && kbOnSctx === 3 && plainScratch === 3 && plainBlit === 3;
})());

ok("V99 parallax/datamosh/tunnel each replicate the Ken Burns transform on sctx and use the plain (unpadded) scratch/blit", (() => {
  const fn = extractFn("drawImageLayerV99");
  const kbOnSctx = (fn.match(/if \(IM\.kenburns\) \{\s*\n\s*const p = S\.progress;\s*\n\s*sctx\.translate\(W \/ 2, H \/ 2\);\s*\n\s*sctx\.scale\(1\.06 \+ 0\.16 \* p, 1\.06 \+ 0\.16 \* p\);/g) || []).length;
  const plainScratch = (fn.match(/const scratch = imageLayerScratchCanvas\(W, H\);/g) || []).length;
  const plainBlit = (fn.match(/ctx\.drawImage\(scratch, 0, 0\);/g) || []).length;
  return !!fn && kbOnSctx === 3 && plainScratch === 3 && plainBlit === 3;
})());

ok("all 8 fixed modes still reset sctx's alpha/compositing after clearRect (Task 4 hardening, unaffected by this correction)", (() => {
  const classic = extractFn("drawImageLayer");
  const v67 = extractFn("drawImageLayerV67");
  const v99 = extractFn("drawImageLayerV99");
  const resetCount = (src) => (src.match(/sctx\.globalAlpha = 1;\s*\n\s*sctx\.globalCompositeOperation = "source-over";/g) || []).length;
  return resetCount(classic) === 2 && resetCount(v67) === 3 && resetCount(v99) === 3;
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node build.js && node test.js`
Expected: the 7 replacement assertions print `✗` (the code still has Task 4's padding approach). The "alpha/compositing reset" assertion prints `✓` (unaffected by this task, still true from Task 4).

- [ ] **Step 3: Implement — delete `imageLayerKenBurnsPad` and its constants (`elastic-morph.html`)**

Find and delete this entire block (added in Task 4, immediately before `function drawImageLayer(...)`):

```js
// Ken Burns pan/zoom (below) is applied on the real ctx AFTER a heavy mode's scratch
// composite is blitted through imageLayerScratchCanvas -- so when Ken Burns is active, the
// scratch must be padded to cover the extra area its min-zoom/max-drift can reveal at the
// frame edges, or a thin strip of whatever is behind the image layer shows through, and the
// composite lands very slightly softer once magnified into that gap. Derived from the exact
// literals in the Ken Burns transform itself (zoom = 1.06 + 0.16*p, drift = ±0.05*W /
// ±0.045*H): the worst case is at p=0, where zoom is at its smallest (1.06).
const KB_PAD_FRAC_X = 0.05 - 0.5 * (1 - 1 / 1.06);   // ≈ 0.0217
const KB_PAD_FRAC_Y = 0.045 - 0.5 * (1 - 1 / 1.06);  // ≈ 0.0167
function imageLayerKenBurnsPad(IM, W, H) {
  if (!IM.kenburns) return { padX: 0, padY: 0 };
  return { padX: Math.ceil(W * KB_PAD_FRAC_X), padY: Math.ceil(H * KB_PAD_FRAC_Y) };
}
```

- [ ] **Step 4: Implement — `drawImageLayer`'s shared Ken Burns block + `displace`/`shards` (`elastic-morph.html`)**

Find the shared Ken Burns block near the top of `drawImageLayer` (unchanged since before Task 1):

```js
  // Ken Burns: slow zoom + drift over the whole song (applied within this save,
  // so every mode's single ctx.restore() balances it)
  if (IM.kenburns) {
    const p = S.progress;
    const zoom = 1.06 + 0.16 * p;
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
                  -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
  }
```

Replace it with:

```js
  // Ken Burns: slow zoom + drift over the whole song (applied within this save, so every
  // mode's single ctx.restore() balances it) -- EXCEPT displace/shards, which composite
  // through an intermediate scratch canvas (see imageLayerScratchCanvas) so ctx.filter isn't
  // reapplied per drawImage call. For those two, this same transform is instead replicated on
  // the scratch's own context, at the top of that mode's block below -- keeping the scratch
  // exactly W x H (matching ctx's own raster bounds, exactly as before that fix) so its
  // clipping/overhang behavior stays pixel-identical to the original, un-refactored code.
  if (IM.kenburns && IM.mode !== "displace" && IM.mode !== "shards") {
    const p = S.progress;
    const zoom = 1.06 + 0.16 * p;
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
                  -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
  }
```

Then replace the current (Task 4) `displace` block with:

```js
  if (IM.mode === "displace") {
    const { dW, dH, oX, oY } = coverRect(W, H, IM);
    const bands = 70, bh = dH / bands;
    const amp = dW * 0.05 * IM.amount;
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    if (!sctx) { ctx.restore(); return; }
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, W, H);
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = "source-over";
    if (IM.kenburns) {
      const p = S.progress;
      const zoom = 1.06 + 0.16 * p;
      sctx.translate(W / 2, H / 2);
      sctx.scale(zoom, zoom);
      sctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
                     -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
    }
    for (let bI = 0; bI < bands; bI++) {
      const sy = (bI / bands) * IM.img.height;
      const sh = IM.img.height / bands;
      const wav = Math.sin(S.time * 2.2 + bI * 0.38) * amp * (S.bass * 1.3 + S.mids * 0.6 + 0.05);
      sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + wav, oY + bI * bh, dW, bh + 1);
    }
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
    return;
  }
```

Then replace the current (Task 4) `shards` block with:

```js
  if (IM.mode === "shards") {
    const { dW, dH, oX, oY } = coverRect(W, H, IM);
    const cols2 = 10, rows2 = Math.max(1, Math.round(cols2 * dH / dW));
    const qw = dW / cols2, qh = dH / rows2;
    const ex = (beat * 0.6 + S.transient * 0.6) * IM.amount;
    const cx0 = W / 2, cy0 = H / 2, push = ex * 180 * (H / 720);
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    if (!sctx) { ctx.restore(); return; }
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, W, H);
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = "source-over";
    if (IM.kenburns) {
      const p = S.progress;
      const zoom = 1.06 + 0.16 * p;
      sctx.translate(W / 2, H / 2);
      sctx.scale(zoom, zoom);
      sctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
                     -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
    }
    for (let j = 0; j < rows2; j++) for (let i = 0; i < cols2; i++) {
      const sx = i / cols2 * IM.img.width, sy = j / rows2 * IM.img.height;
      const sw = IM.img.width / cols2, sh = IM.img.height / rows2;
      const qx = oX + (i + 0.5) * qw, qy = oY + (j + 0.5) * qh;
      const dx = qx - cx0, dy = qy - cy0, d = Math.hypot(dx, dy) || 1;
      const rot = Math.sin(i * 12.9 + j * 7.3) * ex * 0.6;
      sctx.save();
      sctx.translate(qx + dx / d * push, qy + dy / d * push);
      sctx.rotate(rot);
      sctx.drawImage(IM.img, sx, sy, sw, sh, -qw / 2 - 0.5, -qh / 2 - 0.5, qw + 1, qh + 1);
      sctx.restore();
    }
    ctx.drawImage(scratch, 0, 0);
    ctx.restore(); return;
  }
```

- [ ] **Step 5: Implement — `drawImageLayerV67`'s shared Ken Burns block + `glitch`/`ripple`/`kaleido` (`src/inject-v67.js`)**

Find the shared Ken Burns block near the top of `drawImageLayerV67`:

```js
  if (IM.kenburns) {
    const p = S.progress;
    ctx.translate(W / 2, H / 2);
    ctx.scale(1.06 + 0.16 * p, 1.06 + 0.16 * p);
    ctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
      -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
  }
```

Replace it with:

```js
  // See drawImageLayer's shared Ken Burns block (elastic-morph.html) for the full rationale:
  // glitch/ripple/kaleido composite through a scratch canvas, so this transform is instead
  // replicated on that scratch's own context, inside each of those 3 modes below.
  if (IM.kenburns && IM.mode !== "glitch" && IM.mode !== "ripple" && IM.mode !== "kaleido") {
    const p = S.progress;
    ctx.translate(W / 2, H / 2);
    ctx.scale(1.06 + 0.16 * p, 1.06 + 0.16 * p);
    ctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
      -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
  }
```

Then replace the current (Task 4) three-mode block with:

```js
  if (IM.mode === "glitch") {
    const bands = 24 + Math.round(amt * 20);
    const bh = dH / bands;
    const glitch = (beat * 0.85 + S.transient * 0.9) * amt;
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    if (sctx) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, W, H);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "source-over";
      if (IM.kenburns) {
        const p = S.progress;
        sctx.translate(W / 2, H / 2);
        sctx.scale(1.06 + 0.16 * p, 1.06 + 0.16 * p);
        sctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
          -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
      }
      for (let b = 0; b < bands; b++) {
        const sy = (b / bands) * IM.img.height;
        const sh = IM.img.height / bands + 1;
        const jx = (Math.random() - 0.5) * dW * 0.12 * glitch;
        const dup = glitch > 0.35 && b % 7 === 0;
        sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + jx, oY + b * bh, dW, bh + 1);
        if (dup) {
          sctx.globalCompositeOperation = "lighter";
          sctx.globalAlpha = 0.45;
          sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + jx + 8, oY + b * bh, dW, bh + 1);
          sctx.globalCompositeOperation = "source-over";
          sctx.globalAlpha = 1;
        }
      }
      ctx.drawImage(scratch, 0, 0);
    }
  } else if (IM.mode === "ripple") {
    const bands = 56;
    const bh = dH / bands;
    const amp = dW * 0.04 * amt * (0.4 + energy + beat * 0.5);
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    if (sctx) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, W, H);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "source-over";
      if (IM.kenburns) {
        const p = S.progress;
        sctx.translate(W / 2, H / 2);
        sctx.scale(1.06 + 0.16 * p, 1.06 + 0.16 * p);
        sctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
          -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
      }
      for (let b = 0; b < bands; b++) {
        const sy = (b / bands) * IM.img.height;
        const sh = IM.img.height / bands + 1;
        const cx = (b / bands - 0.5) * 2;
        const wav = Math.sin(S.time * 3 + b * 0.22 + cx * 4) * amp;
        const wav2 = Math.cos(S.time * 2.1 + b * 0.15) * amp * 0.35 * S.bass;
        sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + wav + wav2, oY + b * bh, dW, bh + 1);
      }
      ctx.drawImage(scratch, 0, 0);
    }
  } else if (IM.mode === "kaleido") {
    const cx = W / 2, cy = H / 2;
    const segs = 4 + Math.round(amt * 4);
    const diag = Math.hypot(W, H);
    const fill = diag / Math.min(dW, dH);
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    if (sctx) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, W, H);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "source-over";
      if (IM.kenburns) {
        const p = S.progress;
        sctx.translate(W / 2, H / 2);
        sctx.scale(1.06 + 0.16 * p, 1.06 + 0.16 * p);
        sctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
          -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
      }
      sctx.translate(cx, cy);
      sctx.rotate(S.time * 0.05 * amt + beat * 0.08);
      for (let s = 0; s < segs; s++) {
        sctx.save();
        sctx.rotate((Math.PI * 2 / segs) * s);
        sctx.scale(s % 2 ? 1 : -1, 1);
        sctx.scale(fill * (1 + beat * 0.04 * amt), fill * (1 + beat * 0.04 * amt));
        sctx.drawImage(IM.img, -dW / 2, -dH / 2, dW, dH);
        sctx.restore();
      }
      ctx.drawImage(scratch, 0, 0);
    }
  } else if (IM.mode === "scan") {
```

(Only the `if`/`else if` bodies for these 3 modes change — `scan`'s block that follows is untouched context, shown only to anchor the replacement.)

- [ ] **Step 6: Implement — `drawImageLayerV99`'s shared Ken Burns block + `parallax`/`datamosh`/`tunnel` (`src/inject-v99.js`)**

Find the shared Ken Burns block near the top of `drawImageLayerV99`:

```js
  if (IM.kenburns) {
    const p = S.progress;
    ctx.translate(W / 2, H / 2);
    ctx.scale(1.06 + 0.16 * p, 1.06 + 0.16 * p);
    ctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
      -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
  }
```

Replace it with:

```js
  // See drawImageLayer's shared Ken Burns block (elastic-morph.html) for the full rationale:
  // parallax/datamosh/tunnel composite through a scratch canvas, so this transform is instead
  // replicated on that scratch's own context, inside each of those 3 modes below.
  if (IM.kenburns && IM.mode !== "parallax" && IM.mode !== "datamosh" && IM.mode !== "tunnel") {
    const p = S.progress;
    ctx.translate(W / 2, H / 2);
    ctx.scale(1.06 + 0.16 * p, 1.06 + 0.16 * p);
    ctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
      -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
  }
```

Then replace the current (Task 4) block with:

```js
  if (IM.mode === "parallax") {
    const bands = 48;
    const bh = dH / bands;
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    if (sctx) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, W, H);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "source-over";
      if (IM.kenburns) {
        const p = S.progress;
        sctx.translate(W / 2, H / 2);
        sctx.scale(1.06 + 0.16 * p, 1.06 + 0.16 * p);
        sctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
          -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
      }
      for (let b = 0; b < bands; b++) {
        const sy = (b / bands) * IM.img.height;
        const sh = IM.img.height / bands + 1;
        const depth = (b / bands - 0.5) * 2;
        const shift = depth * dW * 0.06 * amt * (0.35 + energy + beat * 0.45);
        const drift = Math.sin(S.time * 0.8 + b * 0.11) * dW * 0.015 * amt;
        sctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + shift + drift, oY + b * bh, dW, bh + 1);
      }
      ctx.drawImage(scratch, 0, 0);
    }
  } else if (IM.mode === "zoompulse") {
    const cx = W / 2, cy = H / 2;
    const pulse = 1 + (beat * 0.14 + S.transient * 0.1 + energy * 0.06) * amt;
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.translate(-cx, -cy);
    ctx.drawImage(IM.img, oX, oY, dW, dH);
  } else if (IM.mode === "datamosh") {
    const blocks = 10 + Math.round(amt * 10);
    const bw = dW / blocks;
    const slip = (beat * 0.85 + S.transient * 0.75) * amt;
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    if (sctx) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, W, H);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "source-over";
      if (IM.kenburns) {
        const p = S.progress;
        sctx.translate(W / 2, H / 2);
        sctx.scale(1.06 + 0.16 * p, 1.06 + 0.16 * p);
        sctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
          -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
      }
      for (let i = 0; i < blocks; i++) {
        const sx = (i / blocks) * IM.img.width;
        const sw = IM.img.width / blocks + 1;
        const jx = (Math.random() - 0.5) * dW * 0.18 * slip;
        const jy = (i % 3 === 0 ? (Math.random() - 0.5) * dH * 0.04 * slip : 0);
        sctx.drawImage(IM.img, sx, 0, sw, IM.img.height, oX + i * bw + jx, oY + jy, bw + 1, dH);
      }
      ctx.drawImage(scratch, 0, 0);
    }
  } else if (IM.mode === "flicker") {
    const gate = 0.55 + beat * 0.45 * amt + S.transient * 0.35 * amt;
    ctx.globalAlpha *= Math.max(0.12, Math.min(1, gate));
    ctx.drawImage(IM.img, oX, oY, dW, dH);
    if (beat > 0.5 * amt) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = IM.opacity * (opMul == null ? 1 : opMul) * beat * 0.22 * amt;
      ctx.drawImage(IM.img, oX, oY, dW, dH);
      ctx.globalCompositeOperation = "source-over";
    }
  } else if (IM.mode === "tunnel") {
    const cx = W / 2, cy = H / 2;
    const segs = 16 + Math.round(amt * 8);
    const rot = S.time * 0.08 * amt + beat * 0.12;
    const pull = 1 + (beat * 0.08 + energy * 0.05) * amt;
    const scratch = imageLayerScratchCanvas(W, H);
    const sctx = scratch.getContext("2d");
    if (sctx) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, W, H);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "source-over";
      if (IM.kenburns) {
        const p = S.progress;
        sctx.translate(W / 2, H / 2);
        sctx.scale(1.06 + 0.16 * p, 1.06 + 0.16 * p);
        sctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
          -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
      }
      sctx.translate(cx, cy);
      sctx.rotate(rot);
      for (let s = 0; s < segs; s++) {
        const t = s / segs;
        const sc = (0.35 + t * 0.95) * pull;
        sctx.save();
        sctx.scale(sc, sc);
        sctx.globalAlpha = 0.55 + t * 0.45;
        sctx.drawImage(IM.img, -dW / 2, -dH / 2, dW, dH);
        sctx.restore();
      }
      ctx.drawImage(scratch, 0, 0);
    }
  }
```

(`zoompulse` and `flicker` are shown only as unchanged context to anchor the replacement — do not modify them.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node build.js && node test.js`
Expected: all assertions print `✓`. Final line: `<N> passed, 0 failed`.

- [ ] **Step 8: Commit**

```bash
git add elastic-morph.html src/inject-v67.js src/inject-v99.js test.js
git commit -m "fix: correct Ken Burns fix — replicate transform on scratch context, not padding

Task 4 (commit 7532e2b) padded the scratch canvas and shifted the
coordinate origin via translate/blit-offset, but that task's own
review proved it's a geometric no-op: coverRect (and kaleido/tunnel's
own center point) was still computed from the unpadded W/H, so the
mode's drawn footprint never grew into the new padding -- the
translate and its exact inverse at blit time cancel out, leaving the
original Ken Burns edge-clipping bug fully intact.

Corrected approach: replicate the Ken Burns transform itself onto the
scratch's own context (sctx), inside each of the 8 heavy modes, instead
of applying it to the real ctx before the mode dispatch (which the
shared per-generation Ken Burns block now excludes these 8 modes from).
The scratch stays exactly W x H, matching ctx's own raster bounds --
identical to the un-refactored, pre-Task-1 rasterization (same
transform, same buffer size, same clipping), so this is provably
pixel-identical to the original Ken Burns behavior. The filter-
performance fix from Tasks 1-3 is untouched: ctx.filter is still set on
the real ctx around the single final blit, unaffected by where the
spatial transform happens.

imageLayerKenBurnsPad, KB_PAD_FRAC_X, and KB_PAD_FRAC_Y are deleted --
dead code now that the padding approach is gone. Task 4's other two
changes (explicit sctx.globalAlpha/globalCompositeOperation reset,
getContext(\"2d\") null-guard) are correct and untouched by this fix.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after all 5 tasks)

Not covered by `test.js` (no real filtered-canvas render comparison in the
static harness) — from the design spec:

1. In Safari, upload an image, select each of the 8 fixed modes in turn
   (Displace/Wave, Shatter/Shards, Glitch, Ripple, Kaleidoscope, Parallax,
   Datamosh, Tunnel Warp) with a strong filter active (e.g. "Schwarzweiß" or
   "Neon Glow") — confirm the filter is now visibly applied on every one
   (previously: invisible).
2. In Chrome, same 8 modes with a filter active — confirm smooth playback,
   no slowdown (previously: reported "everything is slow" specifically when
   a filter is active).
3. Spot-check 2-3 of the 8 modes *without* a filter active, and 2-3 of the
   *non-heavy* modes (e.g. `backdrop`, `scan`, `zoompulse`) with a filter
   active — confirm no visual regression (identical look/motion to before
   this fix).
4. Resize the browser window (or switch to HQ export resolution) while a
   heavy mode with a filter is active — confirm the scratch canvas resizes
   correctly (no stretched/stale frame).
5. Enable Ken Burns with a square or portrait cover image and one of the 8
   fixed modes active — watch the top/bottom edges through a full zoom
   cycle, confirm no transparent strip appears (this is what Task 5 fixes).
6. Set Deckkraft (opacity) to ~50% with Kaleidoscope active — confirm the
   overlapping copies look right at that opacity (documented behavior
   change, not expected to look "wrong", just different from before this
   branch — use judgment on whether it reads well).
7. Load a saved project using `displace` with a non-default Blend mode —
   confirm the blend is now visibly applied (documented bugfix).
