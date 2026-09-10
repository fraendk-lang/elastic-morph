# Device-Engine Gradients (EQ, Tape VU, VU Wall) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project 2 of 4 in the "improve what's there" batch. Give the 3 device engines that draw genuinely flat-colored bars/needles a real gradient: `drawEqualizer`'s 6 band bars and `drawTape`'s 3 VU bars get a vertical dim-base→bright-tip gradient; `drawVuWall`'s 6 needle strokes get a pivot-dim→tip-bright gradient along their length. The other 6 device engines already have gradients or draw elements too small/dense to benefit (verified during design) and are out of scope.

**Architecture:** Three self-contained edits, each inside one engine's per-element draw loop in the static region of `elastic-morph.html`. Each replaces a flat `ctx.fillStyle`/`ctx.strokeStyle = \`hsl(a)…\`` + draw with a per-element `createLinearGradient` (two stops from `colr`-equivalent `hsl(a)` values) + the same draw. No new state, no UI, no `node build.js`.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- Only `drawEqualizer`, `drawTape`, `drawVuWall` change — each in exactly one place (the per-bar / per-needle fill).
- `drawEqualizer`'s peak-hold cap (the `rgba(255,255,255,0.85)` white line) stays flat white — not gradiented.
- The other 6 device engines (Sequencer, Radio Tuner, Patchbay, Vinyl, Cassette, Waveform Monitor) are NOT touched.
- No change to the Round-1 `S.dnaBlend` adoption line or any other line in these functions.
- Gradient endpoints for the bars are `(0, base)` → `(0, tip)` where base/tip are the exact Y coords the existing `fillRect` uses; for the needle, `(cx, cy)` → the exact tip coords the existing `lineTo` uses.

---

### Task 1: Vertical/needle gradients on EQ bars, Tape VU bars, VU Wall needles

**Files:**
- Modify: `elastic-morph.html` — `drawEqualizer` (~4795-4796), `drawTape` (~4772), `drawVuWall` (~5038-5040)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Consumes: nothing new (`hue`, `P.sat`, existing per-element geometry).
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Device-engine gradients (EQ bars / Tape VU bars / VU Wall needles)");

ok("drawEqualizer fills each band bar with a vertical dim-base -> bright-tip gradient", (() => {
  const fn = extractFn("drawEqualizer");
  return !!fn
    && fn.includes("const bg = ctx.createLinearGradient(0, h / 2, 0, h / 2 - bh);")
    && fn.includes("bg.addColorStop(0, `hsl(${bhue},${P.sat}%,26%)`);")
    && fn.includes("bg.addColorStop(1, `hsl(${bhue},${P.sat}%,62%)`);");
})());

ok("drawEqualizer's peak-hold cap stays flat white (not gradiented)", (() => {
  const fn = extractFn("drawEqualizer");
  return !!fn && fn.includes('ctx.fillStyle = "rgba(255,255,255,0.85)";');
})());

ok("drawTape fills each VU bar with a vertical dim-base -> bright-tip gradient", (() => {
  const fn = extractFn("drawTape");
  return !!fn
    && fn.includes("const bg = ctx.createLinearGradient(0, mn * 0.36, 0, mn * 0.36 - bh);")
    && fn.includes("bg.addColorStop(0, `hsl(${bhue},${P.sat}%,26%)`);")
    && fn.includes("bg.addColorStop(1, `hsl(${bhue},${P.sat}%,62%)`);");
})());

ok("drawVuWall strokes each needle with a pivot-dim -> tip-bright gradient along its length", (() => {
  const fn = extractFn("drawVuWall");
  return !!fn
    && fn.includes("const ng = ctx.createLinearGradient(cx, cy, ntx, nty);")
    && fn.includes("ng.addColorStop(0, `hsla(${mhue}, ${P.sat}%, 45%, 0.55)`);")
    && fn.includes("ng.addColorStop(1, `hsla(${mhue}, ${P.sat}%, 88%, 0.95)`);")
    && fn.includes("ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ntx, nty); ctx.stroke();");
})());

ok("the 6 out-of-scope device engines keep their flat/existing fills (spot-check: no new createLinearGradient in drawSequencer or drawPatchbay)", (() => {
  const seq = extractFn("drawSequencer"), pb = extractFn("drawPatchbay");
  return !!seq && !!pb && !seq.includes("createLinearGradient") && !pb.includes("createLinearGradient");
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the first 3 new gradient assertions print `✗`; the peak-hold-cap, VU-Wall (wait — VU Wall is assertion 4, also `✗`), and the out-of-scope spot-check already print `✓`. Precisely: assertions 1, 3, 4 fail; assertions 2 and 5 pass. Everything else still `✓`.

- [ ] **Step 3: Implement — `drawEqualizer` bars (`elastic-morph.html` ~4795)**

Find:

```js
    ctx.fillStyle = `hsl(${(hue + i * 22) % 360},${P.sat}%,56%)`;
    ctx.fillRect(bx, h / 2 - bh, bw * 0.76, bh);
```

Replace it with:

```js
    const bhue = (hue + i * 22) % 360;
    const bg = ctx.createLinearGradient(0, h / 2, 0, h / 2 - bh);
    bg.addColorStop(0, `hsl(${bhue},${P.sat}%,26%)`);
    bg.addColorStop(1, `hsl(${bhue},${P.sat}%,62%)`);
    ctx.fillStyle = bg;
    ctx.fillRect(bx, h / 2 - bh, bw * 0.76, bh);
```

- [ ] **Step 4: Implement — `drawTape` VU bars (`elastic-morph.html` ~4772)**

Find:

```js
  for (let i = 0; i < 3; i++) { const v = bands[i], bx = (i - 1) * mn * 0.13, bw = mn * 0.09, bh = mn * 0.16 * v; ctx.fillStyle = `hsl(${(hue + i * 40) % 360},${P.sat}%,56%)`; ctx.fillRect(bx - bw / 2, mn * 0.36 - bh, bw, bh); }
```

Replace it with:

```js
  for (let i = 0; i < 3; i++) {
    const v = bands[i], bx = (i - 1) * mn * 0.13, bw = mn * 0.09, bh = mn * 0.16 * v, bhue = (hue + i * 40) % 360;
    const bg = ctx.createLinearGradient(0, mn * 0.36, 0, mn * 0.36 - bh);
    bg.addColorStop(0, `hsl(${bhue},${P.sat}%,26%)`);
    bg.addColorStop(1, `hsl(${bhue},${P.sat}%,62%)`);
    ctx.fillStyle = bg;
    ctx.fillRect(bx - bw / 2, mn * 0.36 - bh, bw, bh);
  }
```

- [ ] **Step 5: Implement — `drawVuWall` needle (`elastic-morph.html` ~5038)**

Find:

```js
    const na = startA + vuNeedle[i] * sweepA;
    ctx.strokeStyle = `hsla(${mhue}, ${P.sat}%, 82%, 0.9)`;
    ctx.lineWidth = Math.max(1.5, mn * 0.0035);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(na) * r * 0.92, cy + Math.sin(na) * r * 0.92); ctx.stroke();
```

Replace it with:

```js
    const na = startA + vuNeedle[i] * sweepA;
    const ntx = cx + Math.cos(na) * r * 0.92, nty = cy + Math.sin(na) * r * 0.92;
    const ng = ctx.createLinearGradient(cx, cy, ntx, nty);
    ng.addColorStop(0, `hsla(${mhue}, ${P.sat}%, 45%, 0.55)`);
    ng.addColorStop(1, `hsla(${mhue}, ${P.sat}%, 88%, 0.95)`);
    ctx.strokeStyle = ng;
    ctx.lineWidth = Math.max(1.5, mn * 0.0035);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ntx, nty); ctx.stroke();
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 5 new ones. Final line: `<N> passed, 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: gradients on EQ bars, Tape VU bars, and VU Wall needles

Project 2 of the 'improve what's there' batch, mirroring the Layer B
Round 3 gradient pass. The 3 device engines that draw genuinely flat-
colored bars/needles now get a real gradient:

- drawEqualizer: each of the 6 band bars gets a vertical linear
  gradient (hsl L26% base -> L62% tip) instead of one flat L56% fill.
  The peak-hold cap stays flat white.
- drawTape: same treatment on the 3 VU bars.
- drawVuWall: each of the 6 needle strokes gets a linear gradient
  along its length (hsla L45%/a0.55 at the pivot -> L88%/a0.95 at the
  tip) instead of one flat hsla stroke.

The other 6 device engines (Sequencer, Radio Tuner, Patchbay, Vinyl,
Cassette, Waveform Monitor) already have gradients or draw elements
too small/dense to benefit, and are untouched. Gradient endpoints use
the exact geometry the existing fillRect/lineTo already computed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

1. Select the Graphic EQ preset with a track playing — the 6 band bars should now glow
   from a dim base up to a bright tip rather than being flat blocks; the white peak-hold
   caps should still read clearly on top.
2. Select the Tape Machine preset — the 3 VU bars get the same base→tip glow.
3. Select the VU Meter Wall preset — each needle should fade from dim at the pivot to
   bright at the tip (subtle but adds depth); confirm the needle still reads clearly
   against the dial and the peak LED / red zone are unaffected.
4. Toggle DNA Blend between Screen and Normal on each of the 3 — gradients should look
   sensible in both (they're just `hsl`/`hsla` stops, same as the old flat colors).
5. Confirm the other device engines (Sequencer, Radio Tuner, Patchbay, Vinyl, Cassette,
   Waveform Monitor) look identical to before.
