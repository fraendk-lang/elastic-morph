# Layer B Color Gradients Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat per-element stroke/fill colors with real canvas gradients on 5 selected Layer B types (Spectrum Ring, Spectrum Bars, Tunnel, Pulse Rings, Bead Tentacle) — Round 3 of the Layer B quality-uplift work, closing the "Farbverläufe statt Flachfarbe" item deliberately descoped from Round 2.

**Architecture:** Five independent, type-scoped edits, each entirely inside its own `case` body within `drawLayerB()`'s `switch (LB.type)` ([elastic-morph.html:6930](../../../elastic-morph.html)). No shared-point change this time (unlike Rounds 1-2) — gradients need a per-type geometry axis, so each type gets its own `createLinearGradient`/`createRadialGradient` call. No new `S.layerB` fields, no new UI, no change to `colr()`'s own signature (still called the same way, just as gradient color-stop inputs instead of direct `strokeStyle`/`fillStyle` values).

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- Only the 5 named `case` bodies change (`spectrumRing`, `bars`, `tunnel`, `pulseRings`, `tentacle`). The other 15 Layer B types are untouched.
- No new `S.layerB.*` field, no new HTML control, no new localStorage key.
- Tunnel and Pulse Rings each get exactly **one shared gradient object per frame**, reused across all of that type's rings/circles that frame (not one gradient per ring) — this is what makes those two cheap.
- Spectrum Ring and Spectrum Bars each get **one gradient object per element** (76 and 56 respectively, created fresh each frame) — acceptable cost, no attempt to share across elements since each element's gradient endpoints differ.
- Bead Tentacle's spine gradient uses the same `colr(0, ...)`/`colr(1, ...)` endpoints the beads already use per-point, so the spine and beads read as one continuous gradient.
- `ctx.shadowColor` must never be assigned a `CanvasGradient` object (invalid — silently ignored, leaving a stale value) — anywhere a shadow previously copied `ctx.fillStyle`/`ctx.strokeStyle` after this change, it must instead be assigned a concrete color string from `colr(...)`.
- No change to `colr()` itself, to any of the other 15 `case` bodies, or to the shared `lbPulse`/`baseRot`/edge-glow code from Rounds 1-2.

---

### Task 1: Gradients for Spectrum Ring, Spectrum Bars, Tunnel, Pulse Rings, Bead Tentacle

**Files:**
- Modify: `elastic-morph.html:6931-6944` (`case "spectrumRing"`)
- Modify: `elastic-morph.html:6959-6975` (`case "tunnel"`)
- Modify: `elastic-morph.html:7029-7046` (`case "bars"`)
- Modify: `elastic-morph.html:7132-7147` (`case "pulseRings"`)
- Modify: `elastic-morph.html:7276-7280` (`case "tentacle"`, the spine stroke only — not the per-bead fill loop below it)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Consumes: `colr(t, a)` (pre-existing, unchanged signature — called more times per frame now, as gradient stop inputs instead of direct style values).
- Produces: nothing new — single-task plan, purely internal rendering changes inside 5 existing `case` bodies.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Layer B — color gradients (Ring/Bars/Tunnel/Pulse Rings/Tentacle)");

ok("spectrumRing strokes each spike with a linear gradient (inner dim -> outer bright), not one flat color", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn
    && fn.includes('case "spectrumRing": {')
    && fn.includes("const grad = ctx.createLinearGradient(x1, y1, x2, y2);")
    && fn.includes("grad.addColorStop(0, colr(i / n, 0.12));")
    && fn.includes("grad.addColorStop(1, colr(i / n, 0.3 + v * 0.6));");
})());

ok("bars fills each bar with a vertical gradient (dim base -> bright tip), and its glow shadowColor is a concrete color, not the gradient object", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn
    && fn.includes('case "bars": {')
    && fn.includes("const grad = ctx.createLinearGradient(0, H, 0, H - h);")
    && fn.includes("grad.addColorStop(0, colr(i / n, 0.12));")
    && fn.includes("grad.addColorStop(1, colr(i / n, 0.35 + v * 0.55));")
    && fn.includes("ctx.shadowColor = colr(i / n, 0.35 + v * 0.55);");
})());

ok("tunnel uses one shared radial gradient for all 18 rings in a frame, not a flat color per ring", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn
    && fn.includes('case "tunnel": {')
    && fn.includes("const tgrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, tunnelR);")
    && fn.includes("tgrad.addColorStop(0, colr(0, 0.55));")
    && fn.includes("tgrad.addColorStop(1, colr(1, 0));")
    && fn.includes("ctx.strokeStyle = tgrad;");
})());

ok("pulseRings uses one shared radial gradient for every visible ring, not a flat color per ring", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn
    && fn.includes('case "pulseRings": {')
    && fn.includes("const pgrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseMaxR);")
    && fn.includes("pgrad.addColorStop(0, colr(0, 0.6));")
    && fn.includes("pgrad.addColorStop(1, colr(1, 0));")
    && fn.includes("ctx.strokeStyle = pgrad;");
})());

ok("tentacle's spine uses a head-to-tail linear gradient matching the beads' own per-point gradation, not one flat color for the whole line", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn
    && fn.includes('case "tentacle": {')
    && fn.includes("const tgrad = ctx.createLinearGradient(headP.x, headP.y, tailP.x, tailP.y);")
    && fn.includes("tgrad.addColorStop(0, colr(0, 0.35));")
    && fn.includes("tgrad.addColorStop(1, colr(1, 0.35));");
})());

ok("tentacle's counter-rotation contract (-2 * baseRot) still survives the spine gradient change", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes('case "tentacle": {') && fn.includes("ctx.rotate(-2 * baseRot);");
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all 6 new assertions under "Layer B — color gradients (Ring/Bars/Tunnel/Pulse Rings/Tentacle)" print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement — Spectrum Ring (`elastic-morph.html:6931-6944`)**

Find:

```js
    case "spectrumRing": {
      const n = 76, R = mn * 0.26 * sc;
      for (let i = 0; i < n; i++) {
        const v = specAt(i, n);
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const len = v * mn * 0.22 * (0.6 + ctrl.pulse);
        ctx.strokeStyle = colr(i / n, 0.3 + v * 0.6);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.lineTo(cx + Math.cos(a) * (R + len), cy + Math.sin(a) * (R + len));
        ctx.stroke();
      }
      break;
    }
```

Replace it with:

```js
    case "spectrumRing": {
      const n = 76, R = mn * 0.26 * sc;
      for (let i = 0; i < n; i++) {
        const v = specAt(i, n);
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const len = v * mn * 0.22 * (0.6 + ctrl.pulse);
        const x1 = cx + Math.cos(a) * R, y1 = cy + Math.sin(a) * R;
        const x2 = cx + Math.cos(a) * (R + len), y2 = cy + Math.sin(a) * (R + len);
        // v150: linear gradient along each spike (dim inner -> bright outer tip)
        // instead of one flat color per spike.
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, colr(i / n, 0.12));
        grad.addColorStop(1, colr(i / n, 0.3 + v * 0.6));
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      break;
    }
```

- [ ] **Step 4: Implement — Tunnel (`elastic-morph.html:6959-6975`)**

Find:

```js
    case "tunnel": {
      const rings = 18, sides = 6;
      for (let i = 0; i < rings; i++) {
        let f = ((i / rings) + (S.time * 0.14 + S.beat * 0.12)) % 1;
        const r = mn * 0.6 * sc * f * f;
        ctx.strokeStyle = colr(f, 0.55 * (1 - f));
        ctx.lineWidth = Math.max(1, mn * 0.012 * (1 - f));
        ctx.beginPath();
        for (let s = 0; s <= sides; s++) {
          const a = (s / sides) * Math.PI * 2 + S.time * 0.2 + f * 1.6;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
```

Replace it with:

```js
    case "tunnel": {
      const rings = 18, sides = 6;
      // v150: one shared radial gradient (center -> edge) for every ring this frame,
      // replacing the per-ring flat color + separate manual alpha falloff — same
      // colr() hue/dna behavior, now a continuous depth gradient instead of 18
      // discrete color/alpha steps.
      const tunnelR = mn * 0.6 * sc;
      const tgrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, tunnelR);
      tgrad.addColorStop(0, colr(0, 0.55));
      tgrad.addColorStop(1, colr(1, 0));
      ctx.strokeStyle = tgrad;
      for (let i = 0; i < rings; i++) {
        let f = ((i / rings) + (S.time * 0.14 + S.beat * 0.12)) % 1;
        const r = tunnelR * f * f;
        ctx.lineWidth = Math.max(1, mn * 0.012 * (1 - f));
        ctx.beginPath();
        for (let s = 0; s <= sides; s++) {
          const a = (s / sides) * Math.PI * 2 + S.time * 0.2 + f * 1.6;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
```

- [ ] **Step 5: Implement — Spectrum Bars (`elastic-morph.html:7029-7046`)**

Find:

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

Replace it with:

```js
    case "bars": {
      // classic spectrum bars rising from the bottom edge, mirrored as a soft reflection
      const n = 56, bw = W / n;
      for (let i = 0; i < n; i++) {
        const v = specAt(i, n);
        const h = v * H * 0.5 * (0.6 + ctrl.pulse) + 2;
        // v150: vertical gradient (dim base -> bright tip) instead of one flat fill.
        // shadowColor can't be a CanvasGradient (invalid, silently ignored) so it's
        // set to the concrete tip color instead of copying fillStyle like before.
        const grad = ctx.createLinearGradient(0, H, 0, H - h);
        grad.addColorStop(0, colr(i / n, 0.12));
        grad.addColorStop(1, colr(i / n, 0.35 + v * 0.55));
        ctx.fillStyle = grad;
        // v113: glow-coupled peaks so bars read as DNA-bloom, not a flat equalizer
        ctx.shadowBlur = v > 0.5 ? 6 + S.beat * 12 : 0;
        ctx.shadowColor = colr(i / n, 0.35 + v * 0.55);
        ctx.fillRect(i * bw + bw * 0.16, H - h, bw * 0.68, h);
        ctx.shadowBlur = 0;   // reflection stays flat, no glow
        ctx.globalAlpha = LB.opacity * 0.18;
        ctx.fillRect(i * bw + bw * 0.16, H, bw * 0.68, h * 0.5);   // reflection
        ctx.globalAlpha = LB.opacity;
      }
      break;
    }
```

- [ ] **Step 6: Implement — Pulse Rings (`elastic-morph.html:7132-7147`)**

Find:

```js
    case "pulseRings": {
      lbRingT += dt;
      if (lbRingT > 0.5 || (S.beat > 0.6 && lbRingLast < 0.3)) { lbRings.push({ r: 0 }); lbRingT = 0; }
      lbRingLast = S.beat;
      ctx.lineWidth = Math.max(1.5, mn * 0.006);
      for (let i = lbRings.length - 1; i >= 0; i--) {
        const ring = lbRings[i];
        if (!S.frozen) ring.r += dt * (0.25 + S.loudness * 0.5);
        if (ring.r > 1.2) { lbRings.splice(i, 1); continue; }
        const rad = ring.r * mn * 0.55 * sc;
        ctx.strokeStyle = colr(ring.r, (1 - ring.r / 1.2) * 0.6);
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
      }
      if (lbRings.length > 40) lbRings.splice(0, lbRings.length - 40);
      break;
    }
```

Replace it with:

```js
    case "pulseRings": {
      lbRingT += dt;
      if (lbRingT > 0.5 || (S.beat > 0.6 && lbRingLast < 0.3)) { lbRings.push({ r: 0 }); lbRingT = 0; }
      lbRingLast = S.beat;
      ctx.lineWidth = Math.max(1.5, mn * 0.006);
      // v150: one shared radial gradient (center -> outer fade) for every visible
      // ring this frame, instead of a flat color per ring — same cohesive-depth
      // trick as Tunnel above.
      const pulseMaxR = mn * 0.55 * sc * 1.2;
      const pgrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseMaxR);
      pgrad.addColorStop(0, colr(0, 0.6));
      pgrad.addColorStop(1, colr(1, 0));
      ctx.strokeStyle = pgrad;
      for (let i = lbRings.length - 1; i >= 0; i--) {
        const ring = lbRings[i];
        if (!S.frozen) ring.r += dt * (0.25 + S.loudness * 0.5);
        if (ring.r > 1.2) { lbRings.splice(i, 1); continue; }
        const rad = ring.r * mn * 0.55 * sc;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
      }
      if (lbRings.length > 40) lbRings.splice(0, lbRings.length - 40);
      break;
    }
```

- [ ] **Step 7: Implement — Bead Tentacle spine (`elastic-morph.html:7276-7280`)**

Find:

```js
      ctx.lineWidth = Math.max(1.6, mn * 0.005);
      ctx.strokeStyle = colr(0.5, 0.35);
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
```

Replace it with:

```js
      ctx.lineWidth = Math.max(1.6, mn * 0.005);
      // v150: head-to-tail linear gradient on the spine, matching the beads' own
      // per-point colr(p.t, ...) gradation below instead of one flat color for
      // the whole line.
      const headP = pts[0], tailP = pts[pts.length - 1];
      const tgrad = ctx.createLinearGradient(headP.x, headP.y, tailP.x, tailP.y);
      tgrad.addColorStop(0, colr(0, 0.35));
      tgrad.addColorStop(1, colr(1, 0.35));
      ctx.strokeStyle = tgrad;
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 6 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 9: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: real color gradients on 5 Layer B types

Round 3 of the Layer B quality-uplift work (closes the 'Farbverläufe
statt Flachfarbe' item deliberately descoped from Round 2). Replaces
flat per-element stroke/fill colors with real canvas gradients on 5
selected types:

- Spectrum Ring: each of 76 spikes gets a linear gradient along its
  own length (dim inner -> bright outer tip).
- Spectrum Bars: each of 56 bars gets a vertical linear gradient
  (dim base -> bright tip); the glow shadowColor, which used to copy
  fillStyle directly, is now set to a concrete color since
  CanvasGradient objects are invalid there.
- Tunnel: one shared radial gradient (center -> edge) drives all 18
  rings in a frame, replacing 18 discrete flat-color rings.
- Pulse Rings: same shared-radial-gradient trick as Tunnel, for
  every currently-visible expanding ring.
- Bead Tentacle: the connecting spine now gets a head-to-tail linear
  gradient matching the beads' own existing per-point gradation
  (previously the spine was the one flat-colored element on this
  type).

The other 15 Layer B types, colr() itself, and the Round 1-2 shared
reactivity points (lbPulse/baseRot/edge glow) are untouched.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

1. Cycle to each of the 5 types (Spectrum Ring, Spectrum Bars, Tunnel, Pulse
   Rings, Bead Tentacle) with a track playing — confirm each now shows a
   visible, smooth gradient (not a visual regression like banding, wrong
   direction, or a gradient that's invisible against the current Layer B
   color mode).
2. Toggle Layer B's Color setting between DNA (with and without a Named
   Palette), Rainbow, and White — confirm gradients look sensible in all 3
   modes (the gradient stops call `colr(...)`, so they should follow
   whatever color mode is active, same as before).
3. Confirm Spectrum Bars' beat-glow (bars pulsing brighter on loud peaks)
   still works — this is the step most likely to have a subtle regression
   since its glow color assignment changed.
4. Confirm the other 15 Layer B types are visually unchanged (spot-check a
   couple, e.g. Grid Pulse, Hex Grid, Voronoi).
5. Try HQ Export briefly with one of the 5 types active — canvas gradients
   are deterministic (no randomness), so this should export identically to
   the live preview, but worth a quick confirmation since export is a
   separate render path.
