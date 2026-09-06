# Dispersion/Halftone/Edges Filter Hang Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `ctx.filter` being recomputed on up to 18,150 individual `ctx.fill()` calls per frame in Dispersion/Halftone/Edges mode — confirmed live to hang the browser tab outright with a color filter active — by compositing through the existing scratch canvas, same pattern as the 8 modes fixed earlier the same day.

**Architecture:** Dispersion/Halftone/Edges share one code block (the fallthrough tail of `drawImageLayer`). Move that block's `ctx.globalCompositeOperation` set and its per-cell `ctx.fill()` loop onto `imageLayerScratchCanvas(W, H)`'s own context (`sctx`), replicate the Ken Burns transform there (same as the other 8 modes), then a single `ctx.drawImage(scratch, 0, 0)` composites through the real, filtered `ctx`.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), Canvas 2D API, zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- Full design/rationale: `docs/superpowers/specs/2026-09-06-dispersion-halftone-edges-scratch-canvas-design.md`.
- Exactly 3 modes get this fix: `dispersion`, `halftone`, `edges` — all in the same shared code block at `elastic-morph.html:6524-6570` (the fallthrough tail of `drawImageLayer`, no `if`/`return` of its own). No other mode changes.
- Reuses `imageLayerScratchCanvas(w, h)` (already defined, `elastic-morph.html:6381`) — do not redefine it.
- `drawImageLayer` is confirmed native to `elastic-morph.html` — no `node build.js` rebuild needed.
- Accepted side-effect (documented in the design doc, not a defect to avoid): moving `ctx.globalCompositeOperation` onto `sctx` means these 3 modes' Blend dropdown starts working — previously silently forced to `"lighter"` (Edges) or `"source-over"` (Dispersion/Halftone) regardless of the user's selection, same category of fix as Displace earlier the same day.

---

### Task 1: Composite Dispersion/Halftone/Edges through the scratch canvas

**Files:**
- Modify: `elastic-morph.html:6402` (the shared Ken Burns exclusion guard, add 3 more modes)
- Modify: `elastic-morph.html:6524-6570` (the shared dispersion/halftone/edges block)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Consumes: `imageLayerScratchCanvas(w, h)` — already defined, unchanged signature.
- Produces: nothing new — single-task plan.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Dispersion/Halftone/Edges filter hang fix");

ok("drawImageLayer's shared Ken Burns block also excludes dispersion/halftone/edges", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn && fn.includes('if (IM.kenburns && IM.mode !== "displace" && IM.mode !== "shards" && IM.mode !== "dispersion" && IM.mode !== "halftone" && IM.mode !== "edges") {');
})());

ok("dispersion/halftone/edges create and clear the scratch canvas, with a null-guard", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn
    && (fn.match(/const scratch = imageLayerScratchCanvas\(W, H\);/g) || []).length === 3
    && fn.includes('if (!sctx) { ctx.restore(); return; }');
})());

ok("dispersion/halftone/edges set globalCompositeOperation on sctx (lighter for edges, source-over otherwise) instead of ctx", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn && fn.includes('sctx.globalCompositeOperation = IM.mode === "edges" ? "lighter" : "source-over";');
})());

ok("dispersion/halftone/edges replicate the Ken Burns transform on sctx", (() => {
  const fn = extractFn("drawImageLayer");
  const matches = fn.match(/if \(IM\.kenburns\) \{\s*\n\s*const p = S\.progress;\s*\n\s*const zoom = 1\.06 \+ 0\.16 \* p;\s*\n\s*sctx\.translate\(W \/ 2, H \/ 2\);/g) || [];
  return !!fn && matches.length === 3;
})());

ok("edges mode draws its per-cell arcs onto sctx instead of ctx", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn
    && fn.includes('sctx.fillStyle = cellColor(c, 0.4 + Math.min(0.55, g));')
    && fn.includes('sctx.beginPath(); sctx.arc(x, y, s, 0, Math.PI * 2); sctx.fill();\n      continue;');
})());

ok("dispersion mode draws its scattered arcs onto sctx instead of ctx", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn && fn.includes('sctx.fillStyle = cellColor(c, 0.6 + S.highs * 0.4);');
})());

ok("halftone mode draws its arcs onto sctx instead of ctx", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn && fn.includes('sctx.fillStyle = cellColor(c, 0.85);');
})());

ok("dispersion/halftone/edges blit the finished scratch composite through the real (filtered) ctx exactly once", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn && fn.includes('ctx.drawImage(scratch, 0, 0);\n  ctx.restore();\n  ctx.globalCompositeOperation = "source-over";\n}');
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all 8 new assertions under "Dispersion/Halftone/Edges filter hang fix" print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement — Ken Burns exclusion guard**

At `elastic-morph.html:6402`, find:

```js
  if (IM.kenburns && IM.mode !== "displace" && IM.mode !== "shards") {
```

Replace it with:

```js
  if (IM.kenburns && IM.mode !== "displace" && IM.mode !== "shards" && IM.mode !== "dispersion" && IM.mode !== "halftone" && IM.mode !== "edges") {
```

(Leave the rest of that `if` block — its body — completely unchanged; only the condition changes.)

- [ ] **Step 4: Implement — the shared dispersion/halftone/edges block**

At `elastic-morph.html:6524-6570`, find:

```js
  // dispersion / halftone / edges share the cell grid
  const { dW, dH, oX, oY } = coverRect(W, H, IM);   // use THIS layer's aspect (B differs from A)
  const cw = dW / IM.cols, ch = dH / IM.rows;
  const dotR = Math.max(cw, ch) * 0.62;
  const cols = IM.cols, rows = IM.rows;
  const brAt = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows) ? 0 : IM.cells[y * cols + x].br;
  // tint maps brightness into the DNA palette instead of the image's own colors
  const cellColor = (c, a) => IM.tint
    ? `hsla(${(((baseHue + c.br * 50) % 360) + 360) % 360}, 78%, ${18 + c.br * 60}%, ${a})`
    : `rgba(${c.r},${c.g},${c.b},${a})`;
  ctx.globalCompositeOperation = IM.mode === "edges" ? "lighter" : "source-over";
  const scatter = (beat * 0.6 + energy * 0.6 + S.transient * 0.4) * IM.amount;

  for (const c of IM.cells) {
    let x = oX + (c.ix + 0.5) * cw;
    let y = oY + (c.iy + 0.5) * ch;

    if (IM.mode === "edges") {
      // Sobel-ish gradient magnitude → glowing contours that thicken on the beat
      const g = Math.hypot(brAt(c.ix + 1, c.iy) - brAt(c.ix - 1, c.iy),
                           brAt(c.ix, c.iy + 1) - brAt(c.ix, c.iy - 1));
      if (g <= 0.2 - energy * 0.12) continue;
      const s = dotR * (0.4 + Math.min(1, g * 2)) * (0.6 + beat * 0.7);
      ctx.fillStyle = cellColor(c, 0.4 + Math.min(0.55, g));
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
      continue;
    }

    if (c.br < 0.10) continue;                       // skip near-black pixels
    if (IM.mode === "dispersion") {
      const dir = noise2(c.ix * 0.12 + 3.1, c.iy * 0.12 - S.time * 0.25) * Math.PI * 2;
      const pushp = scatter * maxR * 0.16 * (0.4 + c.br);
      x += Math.cos(dir) * pushp;
      y += Math.sin(dir) * pushp + ctrl.gravity * pushp * 0.3;
      const s = dotR * (0.5 + c.br * 0.7) * (1 + beat * 0.4);
      ctx.fillStyle = cellColor(c, 0.6 + S.highs * 0.4);
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
    } else { // halftone
      const s = dotR * c.br * (0.5 + energy * 0.9 + beat * 0.5);
      if (s < 0.3) continue;
      ctx.fillStyle = cellColor(c, 0.85);
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
}
```

Replace it with:

```js
  // dispersion / halftone / edges share the cell grid -- up to 18,150 individually filled
  // arcs per frame (110 x round(110*aspectRatio) cells from sampleImage). Composite through
  // the shared scratch canvas (see imageLayerScratchCanvas) so a filter applies once to the
  // finished result instead of being recomputed on every single arc -- without this, an
  // active color filter can hang the tab outright (confirmed live).
  const { dW, dH, oX, oY } = coverRect(W, H, IM);   // use THIS layer's aspect (B differs from A)
  const cw = dW / IM.cols, ch = dH / IM.rows;
  const dotR = Math.max(cw, ch) * 0.62;
  const cols = IM.cols, rows = IM.rows;
  const brAt = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows) ? 0 : IM.cells[y * cols + x].br;
  // tint maps brightness into the DNA palette instead of the image's own colors
  const cellColor = (c, a) => IM.tint
    ? `hsla(${(((baseHue + c.br * 50) % 360) + 360) % 360}, 78%, ${18 + c.br * 60}%, ${a})`
    : `rgba(${c.r},${c.g},${c.b},${a})`;
  const scatter = (beat * 0.6 + energy * 0.6 + S.transient * 0.4) * IM.amount;

  const scratch = imageLayerScratchCanvas(W, H);
  const sctx = scratch.getContext("2d");
  if (!sctx) { ctx.restore(); return; }
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, W, H);
  sctx.globalAlpha = 1;
  sctx.globalCompositeOperation = IM.mode === "edges" ? "lighter" : "source-over";
  if (IM.kenburns) {
    const p = S.progress;
    const zoom = 1.06 + 0.16 * p;
    sctx.translate(W / 2, H / 2);
    sctx.scale(zoom, zoom);
    sctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
                   -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
  }

  for (const c of IM.cells) {
    let x = oX + (c.ix + 0.5) * cw;
    let y = oY + (c.iy + 0.5) * ch;

    if (IM.mode === "edges") {
      // Sobel-ish gradient magnitude → glowing contours that thicken on the beat
      const g = Math.hypot(brAt(c.ix + 1, c.iy) - brAt(c.ix - 1, c.iy),
                           brAt(c.ix, c.iy + 1) - brAt(c.ix, c.iy - 1));
      if (g <= 0.2 - energy * 0.12) continue;
      const s = dotR * (0.4 + Math.min(1, g * 2)) * (0.6 + beat * 0.7);
      sctx.fillStyle = cellColor(c, 0.4 + Math.min(0.55, g));
      sctx.beginPath(); sctx.arc(x, y, s, 0, Math.PI * 2); sctx.fill();
      continue;
    }

    if (c.br < 0.10) continue;                       // skip near-black pixels
    if (IM.mode === "dispersion") {
      const dir = noise2(c.ix * 0.12 + 3.1, c.iy * 0.12 - S.time * 0.25) * Math.PI * 2;
      const pushp = scatter * maxR * 0.16 * (0.4 + c.br);
      x += Math.cos(dir) * pushp;
      y += Math.sin(dir) * pushp + ctrl.gravity * pushp * 0.3;
      const s = dotR * (0.5 + c.br * 0.7) * (1 + beat * 0.4);
      sctx.fillStyle = cellColor(c, 0.6 + S.highs * 0.4);
      sctx.beginPath(); sctx.arc(x, y, s, 0, Math.PI * 2); sctx.fill();
    } else { // halftone
      const s = dotR * c.br * (0.5 + energy * 0.9 + beat * 0.5);
      if (s < 0.3) continue;
      sctx.fillStyle = cellColor(c, 0.85);
      sctx.beginPath(); sctx.arc(x, y, s, 0, Math.PI * 2); sctx.fill();
    }
  }
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 8 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "fix: composite Dispersion/Halftone/Edges through a scratch canvas before filtering

Root cause from live production debugging: reproduced a full page
hang on elasticmorph.app by switching Dispersion mode to a color
filter -- the page stopped responding to trivial JS entirely. These 3
cell-based modes draw up to 18,150 individually filtered ctx.fill()
calls per frame (110 x round(110*aspectRatio) cells from
sampleImage()), far more than any of the 8 modes fixed earlier the
same day (max 70 draws/frame) -- same root cause (ctx.filter
recomputed per draw call), just via fill()/arc() instead of
drawImage(). They were excluded from that earlier fix's audit on a
'loops calling drawImage' criterion that turned out to be wrong --
ctx.filter applies to any draw operation.

Same fix: composite through the existing imageLayerScratchCanvas,
replicate Ken Burns on the scratch context (same pattern as the
earlier fix's corrected round), single filtered blit. Accepted side
effect, same category as Displace's fix: these 3 modes now honor the
Blend dropdown, previously silently forced to \"lighter\" (Edges) or
\"source-over\" (Dispersion/Halftone).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

1. Dispersion, Halftone, and Edges each with a strong filter (e.g.
   "Schwarzweiß") and a **portrait** image (worst-case ~18,150 cells) —
   confirm smooth playback, no hang, filter visibly applied.
2. Same 3 modes with a non-default Blend (e.g. "Screen") — confirm the
   blend is now visibly applied (previously silently ignored).
3. Toggle Ken Burns on one of the 3 modes — confirm no edge-clipping (same
   check as the other 8 modes' live-check).
