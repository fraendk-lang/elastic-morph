# Pixelate Modulation Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Pixelate FX-rack effect (key 9) two time-driven modulation axes — block-size drift and a hard-mosaic↔soft-blur crossfade — so it no longer looks frozen during steady-loudness passages, without adding any new UI or state.

**Architecture:** Both axes are pure `Math.sin(S.time * rate)` terms added to the existing `if (fx.pixelate)` block in `applyPostFX` — the same time-drift idiom already used throughout this file (e.g. Layer B's `sway`). No new persistent state, no new UI, no new serialized fields.

**Tech Stack:** Vanilla JS, Canvas 2D. Zero-dependency test harness (`test.js`, via `node test.js`). Target code is in the static (pre-build-marker) region of `elastic-morph.html`.

## Global Constraints

- `node test.js` must stay at 100% pass.
- No new UI controls, no new `S.fx` fields, no new persistent/serialized state — this is a pure rendering-formula change inside the existing `if (fx.pixelate)` block.
- Block-size drift: `bsDrift = 1 + 0.3 * Math.sin(S.time * 0.25)` (±30%, ~25s cycle), multiplied into the existing block-size formula.
- Sharpness crossfade: `soft = 0.5 + 0.5 * Math.sin(S.time * 0.1)` (0..1, ~63s cycle) — a hard-block base draw is always rendered, then a smoothed draw of the same downsized source is layered on top at `globalAlpha = soft` (skipped when `soft <= 0.02`, to avoid a wasted draw call at the low end of the cycle).
- Both draws must sample the same already-downscaled `fxC` buffer — no second downscale pass.

---

### Task 1: Add block-size drift and sharpness crossfade to Pixelate

**Files:**
- Modify: `elastic-morph.html:5498-5508` (`applyPostFX`'s `if (fx.pixelate)` block)
- Test: `test.js`

**Interfaces:** None — no new functions, no new state. Purely an internal formula change inside one existing conditional block.

- [ ] **Step 1: Add the failing test assertions**

Open `test.js`, find the end of the file (search for `demo MP3 exists on disk`):

```js
ok("demo MP3 exists on disk", fs.existsSync(path.join(__dirname, "assets/demo/Elastic Field - Dust Reel.mp3")));

/* ---------------- summary ---------------- */
```

Insert a new section immediately after that assertion and before `/* ---------------- summary ---------------- */`:

```js

/* ---------------- Pixelate modulation pilot ---------------- */
section("Pixelate modulation pilot");
const pixelateBlock = (script.match(/if \(fx\.pixelate\) \{[\s\S]*?\n  \}/) || [])[0] || "";
ok("Pixelate block-size drift present", pixelateBlock.includes("Math.sin(S.time * 0.25)"));
ok("Pixelate sharpness crossfade present", pixelateBlock.includes("Math.sin(S.time * 0.1)"));
ok("Sharpness crossfade skips the extra draw near soft=0 (perf)", pixelateBlock.includes("soft > 0.02"));
ok("Both draws sample the same downsized buffer (no second downscale)", (() => {
  const drawImageCalls = pixelateBlock.match(/ctx\.drawImage\(fxC, 0, 0, sw, sh, 0, 0, W, H\)/g) || [];
  return drawImageCalls.length === 2;
})());

/* ---------------- summary ---------------- */
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all 4 new checks in the "Pixelate modulation pilot" section print `✗` (the current block has neither term yet).

- [ ] **Step 3: Edit the Pixelate block**

In `elastic-morph.html`, find (around line 5498):

```js
  /* --- Pixelate: downscale then upscale with no smoothing; block size pulses --- */
  if (fx.pixelate) {
    const bs = Math.max(3, Math.round((10 + S.loudness * 26 + S.beat * 14) * (H / 720)));
    const sw = Math.max(1, Math.floor(W / bs)), sh = Math.max(1, Math.floor(H / bs));
    fxctx.imageSmoothingEnabled = true;
    fxctx.globalCompositeOperation = "copy"; fxctx.globalAlpha = 1;
    fxctx.drawImage(canvas, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fxC, 0, 0, sw, sh, 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
  }
```

Replace with:

```js
  /* --- Pixelate: downscale then upscale with no smoothing; block size pulses --- */
  if (fx.pixelate) {
    // v-pixelate-drift: slow time-driven drift on top of the audio coupling, so the
    // effect doesn't look frozen during steady-loudness passages (Auto-VJ complaint).
    const bsDrift = 1 + 0.3 * Math.sin(S.time * 0.25);   // ±30%, ~25s cycle
    const bs = Math.max(3, Math.round((10 + S.loudness * 26 + S.beat * 14) * bsDrift * (H / 720)));
    const sw = Math.max(1, Math.floor(W / bs)), sh = Math.max(1, Math.floor(H / bs));
    fxctx.imageSmoothingEnabled = true;
    fxctx.globalCompositeOperation = "copy"; fxctx.globalAlpha = 1;
    fxctx.drawImage(canvas, 0, 0, sw, sh);
    // v-pixelate-drift: hard-mosaic base, crossfaded with a soft-blur draw of the same
    // downsized source — a slow focus/defocus cycle instead of a hard on/off flicker.
    const soft = 0.5 + 0.5 * Math.sin(S.time * 0.1);   // 0..1, ~63s cycle
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.drawImage(fxC, 0, 0, sw, sh, 0, 0, W, H);
    if (soft > 0.02) {
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = soft;
      ctx.drawImage(fxC, 0, 0, sw, sh, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    ctx.imageSmoothingEnabled = true;
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node test.js`
Expected: `0 failed`, all 4 new checks show `✓`.

- [ ] **Step 5: Manual visual check**

Run: `npm start`, open `elastic-morph.html`, enable Pixelate (key `9`) on any preset with the demo track playing at a roughly steady volume. Watch for at least 30-60 seconds:
1. Block size should visibly grow and shrink slowly, independent of any loudness change.
2. The mosaic should visibly soften into a blur and sharpen back to hard blocks over roughly a one-minute cycle.
3. Confirm `motion:"orbit"` DNA presets and every other FX-rack effect look unaffected (this change only touches the `fx.pixelate` block).

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "Add time-driven block-size drift and sharpness crossfade to Pixelate

Block size now breathes ±30% on a ~25s sine cycle on top of the
existing loudness/beat coupling, and a new soft-blur draw crossfades
in and out on a ~63s cycle for a focus/defocus feel -- addresses the
effect looking frozen during steady-loudness passages in Auto-VJ.
Pilot: no new UI, no new state, reuses S.time like other time-drifts
in this file. Scoped to Pixelate only; rollout to other FX-rack
effects is a separate decision pending this pilot's result."
```

---

## Final Verification

- [ ] `node test.js` — expect `0 failed`.
- [ ] `git status` clean after the commit.
- [ ] `git diff HEAD~1 -- elastic-morph.html` — confirm the diff touches only the `if (fx.pixelate)` block, nothing else.
