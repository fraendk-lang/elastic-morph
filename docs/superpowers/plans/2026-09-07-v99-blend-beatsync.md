# V99 Blend + Beat-Sync Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 5 V99 Image Layer modes (Parallax Depth, Zoom Pulse, Datamosh Blocks, Beat Flicker, Tunnel Warp) honor the Blend dropdown and Beat-Sync checkbox, matching all other 13 Image Layer modes.

**Architecture:** `initImageLayerV99`'s wrapper currently dispatches its 5 modes straight to `drawImageLayerV99` and returns, bypassing the V68 wrapper that applies Blend + Beat-Sync for every other mode. Replicate that same blend/beat-sync logic locally around the V99 dispatch — no changes to V67/V68's own code.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`), `node build.js` merge step for `src/inject-vNN.js` modules.

## Global Constraints

- Full design/rationale: `docs/superpowers/specs/2026-09-07-v99-blend-beatsync-design.md`.
- Exactly 1 function changes: `initImageLayerV99` (`src/inject-v99.js:295-306`) — build-injected, edit `src/inject-v99.js` directly, never the generated copy in `elastic-morph.html`, then run `node build.js` before `node test.js`.
- No change to `initImageLayerV67`, `initImageLayerV68`, `drawImageLayerV99`, or any mode's own rendering code — this fix only changes what happens *around* the existing dispatch to `drawImageLayerV99`.
- `imageBeatGate` (`elastic-morph.html:13397`) and `drawImageLayerStatic` (`elastic-morph.html:13406`) are both native, plain `function` declarations already called this same way from V68's own wrapper — accessible from injected code via hoisting, same pattern already relied on for `imageLayerScratchCanvas` in the 2026-09-06 fix.

---

### Task 1: Apply Blend + Beat-Sync around the V99 mode dispatch

**Files:**
- Modify: `src/inject-v99.js:295-306` (`initImageLayerV99`)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Consumes: `imageBeatGate(IM, dt)` → `number` (existing, unchanged), `drawImageLayerStatic(IM, W, H, baseHue, opMul)` (existing, unchanged), `IMG_V99_MODES` (existing `Set`, unchanged), `drawImageLayerV99(IM, W, H, baseHue, dt, opMul)` (existing, unchanged).
- Produces: nothing new — single-task plan.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("V99 Blend + Beat-Sync fix");

ok("initImageLayerV99 applies Blend around the V99 mode dispatch", (() => {
  const fn = extractFn("initImageLayerV99");
  return !!fn
    && fn.includes('if (IMG_V99_MODES.has(IM.mode)) {')
    && fn.includes('const blend = IM.blend || "source-over";')
    && fn.includes('ctx.globalCompositeOperation = blend;');
})());

ok("initImageLayerV99 applies the Beat-Sync gate (static hold between beats, amount scaling otherwise) around the V99 mode dispatch", (() => {
  const fn = extractFn("initImageLayerV99");
  return !!fn
    && fn.includes('const gate = imageBeatGate(IM, dt);')
    && fn.includes('if (IM.beatSync && gate < 0.12) {')
    && fn.includes('drawImageLayerStatic(IM, W, H, baseHue, opMul);')
    && fn.includes('if (IM.beatSync) IM.amount = saved * Math.max(0.18, gate);');
})());

ok("initImageLayerV99 still dispatches to drawImageLayerV99 and restores IM.amount/ctx state before returning", (() => {
  const fn = extractFn("initImageLayerV99");
  return !!fn
    && fn.includes('const saved = IM.amount;')
    && fn.includes('drawImageLayerV99(IM, W, H, baseHue, dt, opMul);')
    && fn.includes('IM.amount = saved;')
    && fn.includes('ctx.restore();\n    ctx.globalCompositeOperation = "source-over";\n    return;');
})());

ok("initImageLayerV99 still falls through to the previous drawImageLayer for non-V99 modes", (() => {
  const fn = extractFn("initImageLayerV99");
  return !!fn && fn.includes('_drawImageLayer(IM, W, H, baseHue, dt, opMul);\n};');
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node build.js && node test.js`
Expected: all 4 new assertions under "V99 Blend + Beat-Sync fix" print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement**

Open `src/inject-v99.js`. Find:

```js
function initImageLayerV99() {
  IMG_MODES.push(...IMG_MODES_V99);
  if (S.imagePresetId == null) S.imagePresetId = "";

  const _drawImageLayer = drawImageLayer;
  drawImageLayer = function (IM, W, H, baseHue, dt, opMul) {
    if (IMG_V99_MODES.has(IM.mode)) {
      drawImageLayerV99(IM, W, H, baseHue, dt, opMul);
      return;
    }
    _drawImageLayer(IM, W, H, baseHue, dt, opMul);
  };
```

Replace it with:

```js
function initImageLayerV99() {
  IMG_MODES.push(...IMG_MODES_V99);
  if (S.imagePresetId == null) S.imagePresetId = "";

  const _drawImageLayer = drawImageLayer;
  drawImageLayer = function (IM, W, H, baseHue, dt, opMul) {
    if (IMG_V99_MODES.has(IM.mode)) {
      // v99 modes were dispatched here directly, bypassing the v68 wrapper's Blend +
      // Beat-Sync handling entirely -- replicate that same logic here so these 5 modes
      // behave like all other Image Layer modes instead of always rendering as Blend:
      // Normal with Beat-Sync silently doing nothing.
      const blend = IM.blend || "source-over";
      const gate = imageBeatGate(IM, dt);
      ctx.save();
      ctx.globalCompositeOperation = blend;
      if (IM.beatSync && gate < 0.12) {
        drawImageLayerStatic(IM, W, H, baseHue, opMul);
      } else {
        const saved = IM.amount;
        if (IM.beatSync) IM.amount = saved * Math.max(0.18, gate);
        drawImageLayerV99(IM, W, H, baseHue, dt, opMul);
        IM.amount = saved;
      }
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";
      return;
    }
    _drawImageLayer(IM, W, H, baseHue, dt, opMul);
  };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node build.js && node test.js`
Expected: all assertions print `✓`, including the 4 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add src/inject-v99.js elastic-morph.html test.js
git commit -m "fix: V99 Image Layer modes now honor Blend and Beat-Sync

Root cause: initImageLayerV99's wrapper dispatched its 5 modes
(Parallax Depth, Zoom Pulse, Datamosh Blocks, Beat Flicker, Tunnel
Warp) straight to drawImageLayerV99 and returned, bypassing the v68
wrapper that applies Blend + Beat-Sync for every other Image Layer
mode -- these 5 modes always rendered as Blend: Normal, and the
'Beat-Sync (nur auf Drop/Transient)' checkbox silently did nothing.
Same category as Displace's blend fix from 2026-09-06, at the wrapper
level instead of inside one mode's own draw code.

Fix: replicate the v68 wrapper's blend + beat-sync gate logic locally
around the v99 dispatch -- ctx.globalCompositeOperation = blend before
calling drawImageLayerV99, and the same beat-gated
drawImageLayerStatic/IM.amount-scaling behavior every other mode
already has. No change to v67/v68's own code or to drawImageLayerV99's
rendering.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

1. Select Tunnel Warp (or any of the 5), pick a non-default Blend (e.g.
   "Screen") — confirm it's now visibly applied (previously always
   "Normal" regardless of selection).
2. Enable "Beat-Sync (nur auf Drop/Transient)" on one of the 5 modes —
   confirm the image holds a static, filtered cover-fit view between
   beats and only animates on drops/transients (previously: beat-sync
   checkbox had no effect on these 5 modes).
3. Spot-check one classic mode and one V67 mode with Blend + Beat-Sync
   both active — confirm no regression (this fix touches nothing in their
   code paths, but worth a quick confirmation).
