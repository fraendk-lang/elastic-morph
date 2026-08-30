# Particle Mode Mirror & Constellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Round 2 of 3 Particle Mode upgrades — a Kaleidoscope Mirror system (all 7 modes, all 8 patterns) and Constellation connecting-lines (Nebula/Swarm/Vortex/Fountain only), both exposed as new UI toggles, per the approved design spec.

**Architecture:** New helper functions plus a restructured `drawParticleMode` switch (physics unchanged, draw calls repeated per mirror pass) land in `src/inject-v85.js`. New UI markup, `S.pmode` defaults, event wiring, save serialization, and sync-to-UI land in `elastic-morph.html` (pre-marker, safe to edit directly). Split across two implementation tasks since they touch genuinely different files/concerns that could independently pass or fail review, plus a third live-verification task.

**Tech Stack:** Vanilla JS, Canvas 2D (`ctx`). Zero-dependency test harness (`test.js`, `node test.js`).

## Global Constraints

- **CRITICAL — read before touching any code:** `drawParticleMode`/`initPM`/`pmColor` are declared `function NAME(...) {...}` pre-marker in `elastic-morph.html`, but `src/inject-v85.js` **reassigns** all three post-marker (`NAME = function (...) {...};`), regenerated into `elastic-morph.html` by `build.js` on every build. The post-marker assignment always wins at runtime. **Round 1 of this same feature area shipped a bug (fixed in commit 390a6dc, same day) by editing the dead pre-marker copy by mistake.** Every drawing-logic edit in this plan goes into `src/inject-v85.js` only — never `elastic-morph.html`'s pre-marker `drawParticleMode`/`initPM`/`pmColor`. UI wiring (HTML markup, event listeners, `S.pmode` defaults, save/load, sync-to-UI) is pre-marker and safe to edit directly in `elastic-morph.html`.
- All test assertions against `drawParticleMode`'s real logic must use `extractFn("drawParticleMode", injectSrc("inject-v85.js"))` (the pattern established in commit 390a6dc's fix) — never `extractFn("drawParticleMode")` alone, which finds the dead pre-marker copy first.
- The mirror pass math (`pmMirrorPasses`/`pmMirrorRotPasses`/`pmMirrorXY`) must exactly match Layer B's own pass descriptors and perf-degradation thresholds (`elastic-morph.html`'s `drawLayerB`, thresholds `0.75`/`0.65`/`0.55`/`0.45` for `oct→hex→quad→h→off`) — copy the same 4 numbers, don't invent new ones.
- `pmMirrorXY`'s rotation+flip case must apply **flip before rotate** (`if (mp.flip) dy = -dy;` then rotate), not rotate-then-flip — this exact order was verified by hand-deriving Layer B's actual canvas-transform composition during the spec's own self-review; getting it backwards produces a different, wrong-looking mirror pattern despite still "looking symmetric."
- Constellation applies only to `nebula`, `swarm`, `vortex`, `fountain` (`PM_CONST_PATTERNS`) — not the other 4 patterns. Collection is capped at 70 points. Constellation lines connect only unmirrored base positions, never per mirrored copy.
- No change to Round 1's glow/band-coupling formulas — only the switch's draw calls move into mirror loops; the physics and color/shadowBlur formulas themselves stay byte-identical.
- Never call `drawScene()` or `drawParticleMode()` manually during live verification — a malformed manual call can throw and silently freeze the render loop forever via the sticky `S._frameErrLogged` guard. Only ever set state and let the existing `frame()` rAF loop redraw.
- After deploying, the FIRST live-verification step must be reading back `drawParticleMode.toString()` in the browser and confirming it contains `mPasses`/`pmConstPts`/`pmMirrorXY` — this positively confirms which function is executing, before any pixel-sampling (pixel-sampling alone already proved unreliable for this exact class of bug earlier the same day).

---

### Task 1: Mirror + Constellation logic in `src/inject-v85.js`

**Files:**
- Modify: `src/inject-v85.js` (add helper functions after `pmColor`; restructure `drawParticleMode`'s switch body and add constellation line-drawing)
- Test: `test.js` (append a new section before the final `/* ---------------- summary ---------------- */` block)

**Interfaces:**
- Consumes: `drawParticleMode`'s existing in-scope locals (`pm`, `cx`/`cy`/`maxR`/`sc`, `energy`/`beat`/`hi`/`mid`, `inten`, `glowOn`, `pmColor`), plus `S.pmode.mirror`/`S.pmode.constellation` (new state fields, produced by Task 2 — this task's logic reads them but Task 2 is what makes them settable/persistable; both tasks can be tested independently since this task's tests only check the drawing logic's structure, not end-to-end UI behavior).
- Produces: `pmMirrorPasses(mode)`, `pmMirrorRotPasses(n)`, `pmMirrorXY(x, y, cx, cy, mp)` (module-scope pure functions), `PM_CONST_PATTERNS` (a `Set`) — all in `src/inject-v85.js`, usable by Task 2's UI code only indirectly (Task 2 doesn't call these directly, it just sets the state fields this task's `drawParticleMode` reads).

- [ ] **Step 1: Re-confirm `src/inject-v85.js`'s current content is unchanged**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
grep -n "^};" src/inject-v85.js | head -3
grep -n "drawParticleMode = function" src/inject-v85.js
```

Expected: `pmColor`'s closing `};` at line 55, `drawParticleMode = function (` at line 57. If different, re-read the file fresh before editing — do not assume this plan's line numbers still apply.

- [ ] **Step 2: Add the mirror helper functions and `PM_CONST_PATTERNS`**

In `src/inject-v85.js`, find:

```js
pmColor = function (pt, baseHue, l, alpha) {
  const P = currentDNA();
  const span = (P.hueEnd != null ? P.hueEnd - P.hue : 50);
  const h = S.pmode.multicolor
    ? (pt.hue + S.time * 18 + S.beat * 40) % 360
    : (baseHue + (pt.hue * 0.08 + span * 0.12)) % 360;
  const sat = S.pmode.multicolor ? 88 : Math.min(92, P.sat || 72);
  const cap = 0.72 * pmIntensity();
  return `hsla(${((h % 360) + 360) % 360}, ${sat}%, ${l}%, ${Math.min(alpha, cap)})`;
};

drawParticleMode = function (W, H, baseHue, dt) {
```

Replace with:

```js
pmColor = function (pt, baseHue, l, alpha) {
  const P = currentDNA();
  const span = (P.hueEnd != null ? P.hueEnd - P.hue : 50);
  const h = S.pmode.multicolor
    ? (pt.hue + S.time * 18 + S.beat * 40) % 360
    : (baseHue + (pt.hue * 0.08 + span * 0.12)) % 360;
  const sat = S.pmode.multicolor ? 88 : Math.min(92, P.sat || 72);
  const cap = 0.72 * pmIntensity();
  return `hsla(${((h % 360) + 360) % 360}, ${sat}%, ${l}%, ${Math.min(alpha, cap)})`;
};

/* v131: Kaleidoscope Mirror + Constellation lines — see docs/superpowers/specs/
   2026-08-29-particle-mode-mirror-constellation-design.md */
const PM_CONST_PATTERNS = new Set(["nebula", "swarm", "vortex", "fountain"]);

function pmMirrorRotPasses(n) {
  return Array.from({ length: n }, (_, i) => ({ rot: i * Math.PI * 2 / n, flip: i % 2 === 1 }));
}

function pmMirrorPasses(mode) {
  return mode === "quad" ? [{ sx: 1, sy: 1 }, { sx: -1, sy: 1 }, { sx: 1, sy: -1 }, { sx: -1, sy: -1 }]
    : mode === "h" ? [{ sx: 1, sy: 1 }, { sx: -1, sy: 1 }]
    : mode === "v" ? [{ sx: 1, sy: 1 }, { sx: 1, sy: -1 }]
    : mode === "diag" ? [{ sx: 1, sy: 1 }, { diag: true }]
    : mode === "hex" ? pmMirrorRotPasses(6)
    : mode === "oct" ? pmMirrorRotPasses(8)
    : [{ sx: 1, sy: 1 }];
}

function pmMirrorXY(x, y, cx, cy, mp) {
  let dx = x - cx, dy = y - cy;
  if (mp.rot != null) {
    /* Must match Layer B's actual canvas-transform order: translate(cx,cy); rotate(rot);
       scale(1,-1) [if flip]; translate(-cx,-cy) — composed, that applies flip FIRST, then
       rotate (the last-called transform acts on the point first). Flip-then-rotate is NOT
       the same as rotate-then-flip. */
    if (mp.flip) dy = -dy;
    const c = Math.cos(mp.rot), s = Math.sin(mp.rot);
    const rx = dx * c - dy * s, ry = dx * s + dy * c;
    return [cx + rx, cy + ry];
  }
  if (mp.diag) return [cx + dy, cy + dx];
  return [cx + dx * mp.sx, cy + dy * mp.sy];
}

drawParticleMode = function (W, H, baseHue, dt) {
```

- [ ] **Step 3: Add mirror-mode + constellation setup inside `drawParticleMode`**

In `src/inject-v85.js`, find:

```js
  const glowOn = S.exporting || (S.perfScale || 1) > 0.5;

  ctx.save();
```

Replace with:

```js
  const glowOn = S.exporting || (S.perfScale || 1) > 0.5;

  const pf57 = S.exporting ? 1 : (S.perfScale || 1);
  let mmode = pm.mirror || "off";
  if (pf57 < 0.75 && mmode === "oct") mmode = "hex";
  if (pf57 < 0.65 && mmode === "hex") mmode = "quad";
  if (pf57 < 0.55 && mmode === "quad") mmode = "h";
  if (pf57 < 0.45 && mmode !== "off") mmode = "off";
  const mPasses = pmMirrorPasses(mmode);
  const pmConstOn = pm.constellation && PM_CONST_PATTERNS.has(pm.pattern);
  const pmConstPts = [];

  ctx.save();
```

- [ ] **Step 4: Replace the full switch body**

In `src/inject-v85.js`, find the switch from `switch (pm.pattern) {` through its closing `}` (the current 8-case block — read the file to confirm you have the exact current text, since Step 1 already verified line numbers but the block's content should match this plan's "old" text below exactly):

```js
    switch (pm.pattern) {
      case "hyperspace": {
        pt.pr = pt.r;
        pt.r += dt * (0.1 + energy * 0.75 + beat * 0.55 + S.bands.air * 0.9) * pt.spd;
        if (pt.r >= 1) {
          pt.r = Math.random() * 0.05;
          pt.pr = pt.r;
          pt.a = Math.random() * Math.PI * 2;
          if (S.pmode.multicolor) pt.hue = Math.random() * 360;
        }
        const x1 = cx + Math.cos(pt.a) * pt.pr * maxR, y1 = cy + Math.sin(pt.a) * pt.pr * maxR;
        const x2 = cx + Math.cos(pt.a) * pt.r * maxR, y2 = cy + Math.sin(pt.a) * pt.r * maxR;
        const al = 0.12 + pt.r * 0.55 * inten;
        ctx.strokeStyle = pmColor(pt, baseHue, 52 + pt.r * 32, al);
        ctx.lineWidth = pt.sz * (0.35 + pt.r * 1.8 + S.bass * 0.4) * sc;
        ctx.shadowBlur = glowOn ? pt.sz * 3 * sc : 0; ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        if (pt.r > 0.55 && beat > 0.4) {
          ctx.strokeStyle = pmColor(pt, baseHue, 78, al * 0.35);
          ctx.shadowColor = ctx.strokeStyle;
          ctx.lineWidth *= 0.45;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
        break;
      }
      case "starfall": {
        pt.y += dt * (45 + energy * 210 + mid * 80 + S.bands.highMid * 180) * pt.spd * sc;
        pt.x += dt * (S.stereo * 36 + Math.sin(S.time * 0.4 + pt.hue) * 18) * sc;
        if (pt.y > H + 12) { pt.y = -12; pt.x = Math.random() * W; }
        if (pt.x > W + 12) pt.x = -12;
        if (pt.x < -12) pt.x = W + 12;
        const tail = (8 + energy * 38 + beat * 22 + S.bands.air * 26) * sc;
        ctx.strokeStyle = pmColor(pt, baseHue, 68, 0.18 + hi * 0.42);
        ctx.lineWidth = pt.sz * (0.75 + beat * 0.35) * sc;
        ctx.shadowBlur = glowOn ? pt.sz * 2.5 * sc : 0; ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x - tail * 0.2, pt.y - tail); ctx.stroke();
        break;
      }
      case "rain": {
        pt.y += dt * (240 + energy * 380 + hi * 120 + S.kickOnset * 260) * pt.spd * sc;
        if (pt.y > H + 14) { pt.y = -14; pt.x = Math.random() * W; if (S.pmode.multicolor) pt.hue = Math.random() * 360; }
        const tail = (12 + energy * 24 + hi * 10) * sc;
        ctx.strokeStyle = pmColor(pt, baseHue, 58, 0.14 + hi * 0.38);
        ctx.lineWidth = pt.sz * 0.45 * sc;
        ctx.shadowBlur = glowOn ? pt.sz * 2 * sc : 0; ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x, pt.y - tail); ctx.stroke();
        break;
      }
      case "vortex": {
        pt.a += dt * (0.45 + energy * 1.45 + beat * 0.35 + S.bands.bass * 1.3) * pt.spd * (1.15 - pt.r * 0.35);
        pt.r -= dt * (0.035 + energy * 0.18 + S.bass * 0.06 + S.bands.lowMid * 0.18);
        if (pt.r < 0.02) { pt.r = 0.5 + Math.random() * 0.45; if (S.pmode.multicolor) pt.hue = Math.random() * 360; }
        const x = cx + Math.cos(pt.a) * pt.r * maxR, y = cy + Math.sin(pt.a) * pt.r * maxR * 0.82;
        const s = pt.sz * (0.55 + (1 - pt.r) * 1.4 + beat * 0.25) * sc;
        ctx.fillStyle = pmColor(pt, baseHue, 58 + (1 - pt.r) * 22, 0.22 + hi * 0.35);
        ctx.shadowBlur = glowOn ? s * 1.4 : 0; ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "fountain": {
        if (pt.life <= 0) {
          pt.x = cx + (Math.random() - 0.5) * W * 0.08 + S.stereo * W * 0.06;
          pt.y = H - 6 * sc;
          pt.vx = (Math.random() - 0.5) * 140 * sc;
          pt.vy = -(200 + Math.random() * 200 + energy * 240 + beat * 120 + (S.bands.subBass + S.kickOnset) * 180) * sc;
          pt.life = 1;
          if (S.pmode.multicolor) pt.hue = Math.random() * 360;
        }
        pt.vy += dt * 300 * sc;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        if (pt.y > H + 10) pt.life = 0;
        const trail = 4 + beat * 6;
        ctx.strokeStyle = pmColor(pt, baseHue, 62, 0.2 + hi * 0.28);
        ctx.lineWidth = pt.sz * 0.9 * sc;
        ctx.shadowBlur = glowOn ? pt.sz * 2.6 * sc : 0; ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x - pt.vx * dt * trail, pt.y - pt.vy * dt * trail); ctx.stroke();
        ctx.fillStyle = pmColor(pt, baseHue, 64, 0.28 + hi * 0.32);
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.sz * (1.1 + beat * 0.3) * sc, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "fireworks": {
        if (pt.life > 0) {
          pt.vy += dt * 120 * sc; pt.vx *= 0.982; pt.vy *= 0.982;
          pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt * (0.65 + hi * 0.15);
          const a = Math.max(0, pt.life);
          ctx.fillStyle = pmColor(pt, baseHue, 60, a * 0.85);
          ctx.shadowBlur = glowOn ? pt.sz * (0.55 + a * 0.9) * sc * 2 : 0; ctx.shadowColor = ctx.fillStyle;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.sz * (0.55 + a * 0.9 + S.snareOnset * 0.5) * sc, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "nebula": {
        const ang = noise2(pt.x * 0.002 + S.time * 0.045, pt.y * 0.002 - S.time * 0.028) * Math.PI * 2;
        const v = dt * (20 + energy * 62 + mid * 20 + S.bands.mid * 45) * sc;
        pt.x += Math.cos(ang) * v; pt.y += Math.sin(ang) * v;
        if (pt.x < -24) pt.x = W + 24; else if (pt.x > W + 24) pt.x = -24;
        if (pt.y < -24) pt.y = H + 24; else if (pt.y > H + 24) pt.y = -24;
        const rad = pt.sz * (7 + beat * 2.5) * sc;
        const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rad);
        g.addColorStop(0, pmColor(pt, baseHue, 58, 0.1 + S.loudness * 0.16));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "swarm": {
        const ax = cx + Math.sin(S.time * 0.65 + pt.hue * 0.01) * W * (0.28 + S.bands.bass * 0.1) + S.stereo * W * 0.12;
        const ay = cy + Math.cos(S.time * 0.85) * H * (0.26 + S.bands.bass * 0.08) + S.bass * H * 0.04;
        pt.vx += (ax - pt.x) * dt * (1.6 + beat * 0.8);
        pt.vy += (ay - pt.y) * dt * (1.6 + beat * 0.8);
        pt.vx += (Math.random() - 0.5) * 180 * dt * (0.35 + beat + S.bands.mid * 0.6);
        pt.vy += (Math.random() - 0.5) * 180 * dt * (0.35 + beat + S.bands.mid * 0.6);
        pt.vx *= 0.93; pt.vy *= 0.93;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        ctx.fillStyle = pmColor(pt, baseHue, 62, 0.24 + hi * 0.36);
        ctx.shadowBlur = glowOn ? pt.sz * 2.2 * sc : 0; ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.sz * (0.95 + beat * 0.35) * sc, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
```

Replace with:

```js
    switch (pm.pattern) {
      case "hyperspace": {
        pt.pr = pt.r;
        pt.r += dt * (0.1 + energy * 0.75 + beat * 0.55 + S.bands.air * 0.9) * pt.spd;
        if (pt.r >= 1) {
          pt.r = Math.random() * 0.05;
          pt.pr = pt.r;
          pt.a = Math.random() * Math.PI * 2;
          if (S.pmode.multicolor) pt.hue = Math.random() * 360;
        }
        const x1 = cx + Math.cos(pt.a) * pt.pr * maxR, y1 = cy + Math.sin(pt.a) * pt.pr * maxR;
        const x2 = cx + Math.cos(pt.a) * pt.r * maxR, y2 = cy + Math.sin(pt.a) * pt.r * maxR;
        const al = 0.12 + pt.r * 0.55 * inten;
        ctx.strokeStyle = pmColor(pt, baseHue, 52 + pt.r * 32, al);
        ctx.lineWidth = pt.sz * (0.35 + pt.r * 1.8 + S.bass * 0.4) * sc;
        ctx.shadowBlur = glowOn ? pt.sz * 3 * sc : 0; ctx.shadowColor = ctx.strokeStyle;
        for (const mp of mPasses) {
          const [mx1, my1] = pmMirrorXY(x1, y1, cx, cy, mp);
          const [mx2, my2] = pmMirrorXY(x2, y2, cx, cy, mp);
          ctx.beginPath(); ctx.moveTo(mx1, my1); ctx.lineTo(mx2, my2); ctx.stroke();
        }
        if (pt.r > 0.55 && beat > 0.4) {
          ctx.strokeStyle = pmColor(pt, baseHue, 78, al * 0.35);
          ctx.shadowColor = ctx.strokeStyle;
          ctx.lineWidth *= 0.45;
          for (const mp of mPasses) {
            const [mx1, my1] = pmMirrorXY(x1, y1, cx, cy, mp);
            const [mx2, my2] = pmMirrorXY(x2, y2, cx, cy, mp);
            ctx.beginPath(); ctx.moveTo(mx1, my1); ctx.lineTo(mx2, my2); ctx.stroke();
          }
        }
        break;
      }
      case "starfall": {
        pt.y += dt * (45 + energy * 210 + mid * 80 + S.bands.highMid * 180) * pt.spd * sc;
        pt.x += dt * (S.stereo * 36 + Math.sin(S.time * 0.4 + pt.hue) * 18) * sc;
        if (pt.y > H + 12) { pt.y = -12; pt.x = Math.random() * W; }
        if (pt.x > W + 12) pt.x = -12;
        if (pt.x < -12) pt.x = W + 12;
        const tail = (8 + energy * 38 + beat * 22 + S.bands.air * 26) * sc;
        ctx.strokeStyle = pmColor(pt, baseHue, 68, 0.18 + hi * 0.42);
        ctx.lineWidth = pt.sz * (0.75 + beat * 0.35) * sc;
        ctx.shadowBlur = glowOn ? pt.sz * 2.5 * sc : 0; ctx.shadowColor = ctx.strokeStyle;
        for (const mp of mPasses) {
          const [mx1, my1] = pmMirrorXY(pt.x, pt.y, cx, cy, mp);
          const [mx2, my2] = pmMirrorXY(pt.x - tail * 0.2, pt.y - tail, cx, cy, mp);
          ctx.beginPath(); ctx.moveTo(mx1, my1); ctx.lineTo(mx2, my2); ctx.stroke();
        }
        break;
      }
      case "rain": {
        pt.y += dt * (240 + energy * 380 + hi * 120 + S.kickOnset * 260) * pt.spd * sc;
        if (pt.y > H + 14) { pt.y = -14; pt.x = Math.random() * W; if (S.pmode.multicolor) pt.hue = Math.random() * 360; }
        const tail = (12 + energy * 24 + hi * 10) * sc;
        ctx.strokeStyle = pmColor(pt, baseHue, 58, 0.14 + hi * 0.38);
        ctx.lineWidth = pt.sz * 0.45 * sc;
        ctx.shadowBlur = glowOn ? pt.sz * 2 * sc : 0; ctx.shadowColor = ctx.strokeStyle;
        for (const mp of mPasses) {
          const [mx1, my1] = pmMirrorXY(pt.x, pt.y, cx, cy, mp);
          const [mx2, my2] = pmMirrorXY(pt.x, pt.y - tail, cx, cy, mp);
          ctx.beginPath(); ctx.moveTo(mx1, my1); ctx.lineTo(mx2, my2); ctx.stroke();
        }
        break;
      }
      case "vortex": {
        pt.a += dt * (0.45 + energy * 1.45 + beat * 0.35 + S.bands.bass * 1.3) * pt.spd * (1.15 - pt.r * 0.35);
        pt.r -= dt * (0.035 + energy * 0.18 + S.bass * 0.06 + S.bands.lowMid * 0.18);
        if (pt.r < 0.02) { pt.r = 0.5 + Math.random() * 0.45; if (S.pmode.multicolor) pt.hue = Math.random() * 360; }
        const x = cx + Math.cos(pt.a) * pt.r * maxR, y = cy + Math.sin(pt.a) * pt.r * maxR * 0.82;
        const s = pt.sz * (0.55 + (1 - pt.r) * 1.4 + beat * 0.25) * sc;
        if (pmConstOn && pmConstPts.length < 70) pmConstPts.push({ x, y, hue: pt.hue });
        ctx.fillStyle = pmColor(pt, baseHue, 58 + (1 - pt.r) * 22, 0.22 + hi * 0.35);
        ctx.shadowBlur = glowOn ? s * 1.4 : 0; ctx.shadowColor = ctx.fillStyle;
        for (const mp of mPasses) {
          const [mx, my] = pmMirrorXY(x, y, cx, cy, mp);
          ctx.beginPath(); ctx.arc(mx, my, s, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "fountain": {
        if (pt.life <= 0) {
          pt.x = cx + (Math.random() - 0.5) * W * 0.08 + S.stereo * W * 0.06;
          pt.y = H - 6 * sc;
          pt.vx = (Math.random() - 0.5) * 140 * sc;
          pt.vy = -(200 + Math.random() * 200 + energy * 240 + beat * 120 + (S.bands.subBass + S.kickOnset) * 180) * sc;
          pt.life = 1;
          if (S.pmode.multicolor) pt.hue = Math.random() * 360;
        }
        pt.vy += dt * 300 * sc;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        if (pt.y > H + 10) pt.life = 0;
        if (pmConstOn && pmConstPts.length < 70) pmConstPts.push({ x: pt.x, y: pt.y, hue: pt.hue });
        const trail = 4 + beat * 6;
        const tx = pt.x - pt.vx * dt * trail, ty = pt.y - pt.vy * dt * trail;
        ctx.strokeStyle = pmColor(pt, baseHue, 62, 0.2 + hi * 0.28);
        ctx.lineWidth = pt.sz * 0.9 * sc;
        ctx.shadowBlur = glowOn ? pt.sz * 2.6 * sc : 0; ctx.shadowColor = ctx.strokeStyle;
        for (const mp of mPasses) {
          const [mx1, my1] = pmMirrorXY(pt.x, pt.y, cx, cy, mp);
          const [mx2, my2] = pmMirrorXY(tx, ty, cx, cy, mp);
          ctx.beginPath(); ctx.moveTo(mx1, my1); ctx.lineTo(mx2, my2); ctx.stroke();
        }
        ctx.fillStyle = pmColor(pt, baseHue, 64, 0.28 + hi * 0.32);
        ctx.shadowColor = ctx.fillStyle;
        for (const mp of mPasses) {
          const [mx, my] = pmMirrorXY(pt.x, pt.y, cx, cy, mp);
          ctx.beginPath(); ctx.arc(mx, my, pt.sz * (1.1 + beat * 0.3) * sc, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "fireworks": {
        if (pt.life > 0) {
          pt.vy += dt * 120 * sc; pt.vx *= 0.982; pt.vy *= 0.982;
          pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt * (0.65 + hi * 0.15);
          const a = Math.max(0, pt.life);
          const rad = pt.sz * (0.55 + a * 0.9 + S.snareOnset * 0.5) * sc;
          ctx.fillStyle = pmColor(pt, baseHue, 60, a * 0.85);
          ctx.shadowBlur = glowOn ? pt.sz * (0.55 + a * 0.9) * sc * 2 : 0; ctx.shadowColor = ctx.fillStyle;
          for (const mp of mPasses) {
            const [mx, my] = pmMirrorXY(pt.x, pt.y, cx, cy, mp);
            ctx.beginPath(); ctx.arc(mx, my, rad, 0, Math.PI * 2); ctx.fill();
          }
        }
        break;
      }
      case "nebula": {
        const ang = noise2(pt.x * 0.002 + S.time * 0.045, pt.y * 0.002 - S.time * 0.028) * Math.PI * 2;
        const v = dt * (20 + energy * 62 + mid * 20 + S.bands.mid * 45) * sc;
        pt.x += Math.cos(ang) * v; pt.y += Math.sin(ang) * v;
        if (pt.x < -24) pt.x = W + 24; else if (pt.x > W + 24) pt.x = -24;
        if (pt.y < -24) pt.y = H + 24; else if (pt.y > H + 24) pt.y = -24;
        if (pmConstOn && pmConstPts.length < 70) pmConstPts.push({ x: pt.x, y: pt.y, hue: pt.hue });
        const rad = pt.sz * (7 + beat * 2.5) * sc;
        const col0 = pmColor(pt, baseHue, 58, 0.1 + S.loudness * 0.16);
        for (const mp of mPasses) {
          const [mx, my] = pmMirrorXY(pt.x, pt.y, cx, cy, mp);
          const g = ctx.createRadialGradient(mx, my, 0, mx, my, rad);
          g.addColorStop(0, col0);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(mx, my, rad, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "swarm": {
        const ax = cx + Math.sin(S.time * 0.65 + pt.hue * 0.01) * W * (0.28 + S.bands.bass * 0.1) + S.stereo * W * 0.12;
        const ay = cy + Math.cos(S.time * 0.85) * H * (0.26 + S.bands.bass * 0.08) + S.bass * H * 0.04;
        pt.vx += (ax - pt.x) * dt * (1.6 + beat * 0.8);
        pt.vy += (ay - pt.y) * dt * (1.6 + beat * 0.8);
        pt.vx += (Math.random() - 0.5) * 180 * dt * (0.35 + beat + S.bands.mid * 0.6);
        pt.vy += (Math.random() - 0.5) * 180 * dt * (0.35 + beat + S.bands.mid * 0.6);
        pt.vx *= 0.93; pt.vy *= 0.93;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        if (pmConstOn && pmConstPts.length < 70) pmConstPts.push({ x: pt.x, y: pt.y, hue: pt.hue });
        ctx.fillStyle = pmColor(pt, baseHue, 62, 0.24 + hi * 0.36);
        ctx.shadowBlur = glowOn ? pt.sz * 2.2 * sc : 0; ctx.shadowColor = ctx.fillStyle;
        for (const mp of mPasses) {
          const [mx, my] = pmMirrorXY(pt.x, pt.y, cx, cy, mp);
          ctx.beginPath(); ctx.arc(mx, my, pt.sz * (0.95 + beat * 0.35) * sc, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
    }
```

- [ ] **Step 5: Add constellation line-drawing after the particle loop**

In `src/inject-v85.js`, find (right after the switch's closing `}`, before `ctx.restore();`):

```js
    }
  }
  ctx.restore();
```

Replace with:

```js
    }
  }
  if (pmConstOn && pmConstPts.length > 1) {
    const thr = Math.min(W, H) * 0.12, thr2 = thr * thr;
    ctx.shadowBlur = 0;
    ctx.lineWidth = 0.7;
    for (let i = 0; i < pmConstPts.length; i++) {
      for (let j = i + 1; j < pmConstPts.length; j++) {
        const dx = pmConstPts[i].x - pmConstPts[j].x, dy = pmConstPts[i].y - pmConstPts[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < thr2) {
          const al = (1 - Math.sqrt(d2) / thr) * 0.16 * (0.5 + hi + beat * 0.4);
          ctx.strokeStyle = pmColor(pmConstPts[i], baseHue, 68, al);
          ctx.beginPath();
          ctx.moveTo(pmConstPts[i].x, pmConstPts[i].y);
          ctx.lineTo(pmConstPts[j].x, pmConstPts[j].y);
          ctx.stroke();
        }
      }
    }
  }
  ctx.restore();
```

- [ ] **Step 6: Write the tests**

Open `test.js`. Find the final block (`/* ---------------- summary ---------------- */`). Insert a new section immediately before it:

```js
/* ---------------- Particle Mode: Kaleidoscope Mirror & Constellation ---------------- */
section("Particle Mode — Kaleidoscope Mirror & Constellation");

const pmSrc2 = injectSrc("inject-v85.js");

ok("drawParticleMode is still genuinely reassigned post-marker in src/inject-v85.js (same sanity check as the Round 1 fix)", (() => {
  return pmSrc2.includes("drawParticleMode = function (") && !pmSrc2.includes("function drawParticleMode(");
})());

ok("PM_CONST_PATTERNS is exactly nebula/swarm/vortex/fountain", (() => {
  const m = pmSrc2.match(/const PM_CONST_PATTERNS = new Set\(\[([^\]]*)\]\);/);
  if (!m) return false;
  const body = m[1];
  return body.includes('"nebula"') && body.includes('"swarm"') && body.includes('"vortex"') && body.includes('"fountain"')
    && !body.includes('"hyperspace"') && !body.includes('"starfall"') && !body.includes('"rain"') && !body.includes('"fireworks"');
})());

ok("pmMirrorPasses returns the right pass count per mode (quad=4, oct=8, off/unknown=1)", (() => {
  const { pmMirrorPasses, pmMirrorRotPasses } = loadFns2(["pmMirrorPasses", "pmMirrorRotPasses"], pmSrc2);
  return pmMirrorPasses("quad").length === 4
    && pmMirrorPasses("oct").length === 8
    && pmMirrorPasses("hex").length === 6
    && pmMirrorPasses("h").length === 2
    && pmMirrorPasses("v").length === 2
    && pmMirrorPasses("diag").length === 2
    && pmMirrorPasses("off").length === 1
    && pmMirrorPasses("nonsense").length === 1;
})());

ok("pmMirrorXY under h-flip ({sx:-1,sy:1}) negates only the x-delta", (() => {
  const { pmMirrorXY } = loadFns2(["pmMirrorXY"], pmSrc2);
  const [x, y] = pmMirrorXY(130, 220, 100, 200, { sx: -1, sy: 1 });
  return x === 70 && y === 220;   // dx=30 -> -30 -> cx-30=70; dy=20 unchanged -> cy+20=220
})());

ok("pmMirrorXY under diag swaps the x/y deltas", (() => {
  const { pmMirrorXY } = loadFns2(["pmMirrorXY"], pmSrc2);
  const [x, y] = pmMirrorXY(130, 220, 100, 200, { diag: true });
  return x === 120 && y === 230;   // dx=30, dy=20 -> swapped: cx+20=120, cy+30=230
})());

ok("pmMirrorXY applies flip BEFORE rotate for rotational passes (matches Layer B's actual canvas-transform composition order, not the reverse)", (() => {
  const { pmMirrorXY } = loadFns2(["pmMirrorXY"], pmSrc2);
  // point at (cx, cy+1) i.e. dx=0, dy=1; rot=60deg, flip=true
  const [x, y] = pmMirrorXY(0, 1, 0, 0, { rot: Math.PI / 3, flip: true });
  // hand-derived: flip first -> dy=-1; rotate by 60deg: (0*cos - (-1)*sin, 0*sin + (-1)*cos)
  const c = Math.cos(Math.PI / 3), s = Math.sin(Math.PI / 3);
  const expectedX = 0 * c - (-1) * s, expectedY = 0 * s + (-1) * c;
  return Math.abs(x - expectedX) < 1e-9 && Math.abs(y - expectedY) < 1e-9;
})());

ok("the perf-degradation ladder matches drawLayerB's own thresholds exactly (0.75/0.65/0.55/0.45)", (() => {
  const lbFn = extractFn("drawLayerB");
  const pmFn = extractFn("drawParticleMode", pmSrc2);
  if (!lbFn || !pmFn) return false;
  return lbFn.includes("pf57 < 0.75") && pmFn.includes("pf57 < 0.75")
    && lbFn.includes("pf57 < 0.65") && pmFn.includes("pf57 < 0.65")
    && lbFn.includes("pf57 < 0.55") && pmFn.includes("pf57 < 0.55")
    && lbFn.includes("pf57 < 0.45") && pmFn.includes("pf57 < 0.45");
})());

function pmCaseBody2(fn, id) {
  const startIdx = fn.indexOf(`case "${id}": {`);
  const endIdx = fn.indexOf("\n      }", startIdx);
  if (startIdx < 0 || endIdx < 0) return null;
  return fn.slice(startIdx, endIdx);
}

const PM_ALL_PATTERNS = ["hyperspace", "starfall", "rain", "vortex", "fountain", "fireworks", "nebula", "swarm"];

ok("all 8 patterns' case bodies contain at least one mirror-pass draw loop", (() => {
  const fn = extractFn("drawParticleMode", pmSrc2);
  if (!fn) return false;
  return PM_ALL_PATTERNS.every(id => {
    const body = pmCaseBody2(fn, id);
    return !!body && body.includes("for (const mp of mPasses)");
  });
})());

ok("only nebula/swarm/vortex/fountain push to pmConstPts; hyperspace/starfall/rain/fireworks do not", (() => {
  const fn = extractFn("drawParticleMode", pmSrc2);
  if (!fn) return false;
  const shouldHave = ["nebula", "swarm", "vortex", "fountain"];
  const shouldNotHave = ["hyperspace", "starfall", "rain", "fireworks"];
  return shouldHave.every(id => { const b = pmCaseBody2(fn, id); return !!b && b.includes("pmConstPts.push("); })
    && shouldNotHave.every(id => { const b = pmCaseBody2(fn, id); return !!b && !b.includes("pmConstPts.push("); });
})());

ok("all 4 constellation-eligible cases cap collection at 70 points", (() => {
  const fn = extractFn("drawParticleMode", pmSrc2);
  if (!fn) return false;
  return ["nebula", "swarm", "vortex", "fountain"].every(id => {
    const body = pmCaseBody2(fn, id);
    return !!body && body.includes("pmConstPts.length < 70");
  });
})());

ok("constellation line-drawing block is gated by pmConstOn && pmConstPts.length > 1", (() => {
  const fn = extractFn("drawParticleMode", pmSrc2);
  return !!fn && fn.includes("if (pmConstOn && pmConstPts.length > 1) {");
})());
```

Add the `loadFns2` helper right after the existing `loadFns` function in `test.js` (it's identical to `loadFns` except it takes an explicit `src` so it can load functions from an inject file's raw content instead of the assembled `script`):

Find:

```js
function loadFns(names) {
  const src = names.map(n => extractFn(n));   // NOT names.map(extractFn) — Array.map passes (el, index, array), and extractFn's new optional 2nd param would receive the index as src
  const missing = names.filter((n, k) => !src[k]);
  if (missing.length) throw new Error("could not extract: " + missing.join(", "));
  return eval("(function(){ " + src.join("\n") + "\n return {" + names.join(",") + "}; })()");
}
```

Replace with:

```js
function loadFns(names) {
  const src = names.map(n => extractFn(n));   // NOT names.map(extractFn) — Array.map passes (el, index, array), and extractFn's new optional 2nd param would receive the index as src
  const missing = names.filter((n, k) => !src[k]);
  if (missing.length) throw new Error("could not extract: " + missing.join(", "));
  return eval("(function(){ " + src.join("\n") + "\n return {" + names.join(",") + "}; })()");
}

/* Same as loadFns, but against an explicit src string (e.g. an inject-vNN.js file's own content
   via injectSrc()) instead of the assembled script — needed for functions that only exist in a
   src/inject-vNN.js file's own scope, like this round's pmMirrorXY/pmMirrorPasses. */
function loadFns2(names, src) {
  const fns = names.map(n => extractFn(n, src));
  const missing = names.filter((n, k) => !fns[k]);
  if (missing.length) throw new Error("could not extract: " + missing.join(", "));
  return eval("(function(){ " + fns.join("\n") + "\n return {" + names.join(",") + "}; })()");
}
```

- [ ] **Step 7: Run the tests**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
node test.js 2>&1 | tail -25
```

Expected: all new assertions under "Particle Mode — Kaleidoscope Mirror & Constellation" print `✓`, final line reads `N passed, 0 failed` (N = 554 + 11 new assertions = 565, no failures — count the `ok(...)` calls in Step 6 yourself rather than trusting this number blindly, since it's easy to miscount by hand; `loadFns2` itself adds no assertion, it's a helper).

- [ ] **Step 8: Run the full build+test pipeline and check for drift**

```bash
npm run ci 2>&1 | tail -15
git diff --stat elastic-morph.html src/inject-v85.js test.js
```

Expected: `node build.js` completes without error, `node test.js` reports the same pass count as Step 7. `git diff --stat` should show changes to `src/inject-v85.js` and `test.js` (your own edits) AND to `elastic-morph.html` (the post-marker region regenerated from your `src/inject-v85.js` edit) — that `elastic-morph.html` diff is expected this time (unlike a pure pre-marker-only change), confirm with `grep -n "pmMirrorXY\|pmConstPts" elastic-morph.html` that the post-marker region now contains your new code.

- [ ] **Step 9: Commit**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
git add elastic-morph.html src/inject-v85.js test.js
git commit -m "feat(particle-mode): add Kaleidoscope Mirror + Constellation lines

Round 2 of 3 planned Particle Mode upgrades. All 8 patterns split into a
physics section (runs once per particle per frame, unchanged) and a draw
section (repeated once per mirror pass via pmMirrorXY, a pure coordinate
transform reusing Layer B's exact pass descriptors and perf-degradation
ladder — cheaper than per-particle ctx.save()/restore()). Nebula/Swarm/
Vortex/Fountain also collect base (unmirrored) positions into a
70-point-capped array for Constellation connecting-lines, drawn once
after the main loop.

All drawing-logic changes went into src/inject-v85.js (never the dead
pre-marker drawParticleMode in elastic-morph.html) per the Round 1 bug
fixed earlier today (commit 390a6dc) — tests use the same injectSrc()
technique established there.

Per docs/superpowers/specs/2026-08-29-particle-mode-mirror-constellation-design.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: UI controls in `elastic-morph.html`

**Files:**
- Modify: `elastic-morph.html` (UI markup, `S.pmode` defaults, event wiring, save serialization, sync-to-UI — 5 locations, all pre-marker)
- Test: `test.js` (append to the same section started in Task 1, before the summary block)

**Interfaces:**
- Consumes: none from Task 1 directly (this task never touches drawing logic) — but its purpose is to make `S.pmode.mirror`/`S.pmode.constellation` settable via UI, which is what Task 1's `drawParticleMode` reads.
- Produces: `S.pmode.mirror` (string, one of `"off"/"h"/"v"/"diag"/"quad"/"hex"/"oct"`) and `S.pmode.constellation` (boolean) — settable via UI, persisted in saves, synced back on load.

- [ ] **Step 1: Re-confirm the 5 target locations are unchanged**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
grep -n "id=\"pmMulti\"\|pmode: { on: false\|function buildParticleMode\|pmode: { on: S.pmode.on\|pmOn\").checked = S.pmode.on" elastic-morph.html
```

Expected: 5 matches at (approximately) lines 1761, 2899, 7979, 8094, 8254. If different, re-read the surrounding ~15 lines at each new location before editing.

- [ ] **Step 2: Add the UI markup**

In `elastic-morph.html`, find:

```html
    <label class="check" style="margin:10px 0"><input type="checkbox" id="pmMulti"> Multicolor</label>
    <div class="slider-row">
      <label>Amount <span class="val" id="pmAmtVal">60</span></label>
      <input type="range" id="pmAmt" min="0" max="100" value="60">
    </div>
```

Replace with:

```html
    <label class="check" style="margin:10px 0"><input type="checkbox" id="pmMulti"> Multicolor</label>
    <div class="slider-row">
      <label>Amount <span class="val" id="pmAmtVal">60</span></label>
      <input type="range" id="pmAmt" min="0" max="100" value="60">
    </div>
    <select id="pmMirror" class="pm-select" style="margin-top:8px">
      <option value="off" selected>Mirror: Off</option>
      <option value="h">Mirror: Horizontal</option>
      <option value="v">Mirror: Vertical</option>
      <option value="diag">Mirror: Diagonal</option>
      <option value="quad">Mirror: 4-way (Kaleido)</option>
      <option value="hex">Mirror: 6-way (Kaleido)</option>
      <option value="oct">Mirror: 8-way (Kaleido)</option>
    </select>
    <label class="check" style="margin-top:10px"><input type="checkbox" id="pmConstellation"> Constellation lines (Nebula/Swarm/Vortex/Fountain)</label>
```

- [ ] **Step 3: Add `S.pmode` defaults**

In `elastic-morph.html`, find:

```js
  pmode: { on: false, pattern: "hyperspace", multicolor: false, amount: 0.6 },
```

Replace with:

```js
  pmode: { on: false, pattern: "hyperspace", multicolor: false, amount: 0.6, mirror: "off", constellation: false },
```

- [ ] **Step 4: Add event wiring**

In `elastic-morph.html`, find:

```js
function buildParticleMode() {
  const sel = $("pmPattern");
  PM_PATTERNS.forEach(([id, label]) => {
    const o = document.createElement("option");
    o.value = id; o.textContent = label;
    if (id === S.pmode.pattern) o.selected = true;
    sel.appendChild(o);
  });
  $("pmOn").addEventListener("change", e => { S.pmode.on = e.target.checked; if (e.target.checked) initPM(); });
  $("pmPattern").addEventListener("change", e => { S.pmode.pattern = e.target.value; initPM(); });
  $("pmMulti").addEventListener("change", e => S.pmode.multicolor = e.target.checked);
  $("pmAmt").addEventListener("input", e => {
    S.pmode.amount = e.target.value / 100;
    $("pmAmtVal").textContent = e.target.value;
    if (S.pmode.on) initPM();
  });
}
```

Replace with:

```js
function buildParticleMode() {
  const sel = $("pmPattern");
  PM_PATTERNS.forEach(([id, label]) => {
    const o = document.createElement("option");
    o.value = id; o.textContent = label;
    if (id === S.pmode.pattern) o.selected = true;
    sel.appendChild(o);
  });
  $("pmOn").addEventListener("change", e => { S.pmode.on = e.target.checked; if (e.target.checked) initPM(); });
  $("pmPattern").addEventListener("change", e => { S.pmode.pattern = e.target.value; initPM(); });
  $("pmMulti").addEventListener("change", e => S.pmode.multicolor = e.target.checked);
  $("pmAmt").addEventListener("input", e => {
    S.pmode.amount = e.target.value / 100;
    $("pmAmtVal").textContent = e.target.value;
    if (S.pmode.on) initPM();
  });
  $("pmMirror").addEventListener("change", e => S.pmode.mirror = e.target.value);
  $("pmConstellation").addEventListener("change", e => S.pmode.constellation = e.target.checked);
}
```

- [ ] **Step 5: Add to save serialization**

In `elastic-morph.html`, find:

```js
    pmode: { on: S.pmode.on, pattern: S.pmode.pattern, multicolor: S.pmode.multicolor, amount: S.pmode.amount },
```

Replace with:

```js
    pmode: { on: S.pmode.on, pattern: S.pmode.pattern, multicolor: S.pmode.multicolor, amount: S.pmode.amount, mirror: S.pmode.mirror, constellation: S.pmode.constellation },
```

(No load-side change needed — `Object.assign(S.pmode, o.pmode || {})` already spreads whatever
keys a save file has; an old save missing `mirror`/`constellation` keeps the Step 3 defaults.)

- [ ] **Step 6: Add to sync-to-UI**

In `elastic-morph.html`, find:

```js
  $("pmOn").checked = S.pmode.on; $("pmPattern").value = S.pmode.pattern;
  $("pmMulti").checked = S.pmode.multicolor;
  $("pmAmt").value = Math.round(S.pmode.amount * 100); $("pmAmtVal").textContent = Math.round(S.pmode.amount * 100);
```

Replace with:

```js
  $("pmOn").checked = S.pmode.on; $("pmPattern").value = S.pmode.pattern;
  $("pmMulti").checked = S.pmode.multicolor;
  $("pmAmt").value = Math.round(S.pmode.amount * 100); $("pmAmtVal").textContent = Math.round(S.pmode.amount * 100);
  $("pmMirror").value = S.pmode.mirror; $("pmConstellation").checked = S.pmode.constellation;
```

- [ ] **Step 7: Write the tests**

Open `test.js`. Find the "Particle Mode — Kaleidoscope Mirror & Constellation" section added in Task 1's Step 6, and add these assertions at the end of that section, still before the `/* ---------------- summary ---------------- */` block:

```js
ok("S.pmode's default object includes mirror: \"off\" and constellation: false", (() => {
  return /pmode:\s*\{\s*on:\s*false,\s*pattern:\s*"hyperspace",\s*multicolor:\s*false,\s*amount:\s*0\.6,\s*mirror:\s*"off",\s*constellation:\s*false\s*\}/.test(script);
})());

ok("the #pmMirror select and #pmConstellation checkbox exist, with #pmMirror offering the same 7 modes as #lbMirror", (() => {
  if (!script.includes('id="pmConstellation"')) return false;
  const m = script.match(/<select id="pmMirror"[\s\S]*?<\/select>/);
  if (!m) return false;
  const body = m[0];
  return body.includes('value="off"') && body.includes('value="h"') && body.includes('value="v"')
    && body.includes('value="diag"') && body.includes('value="quad"') && body.includes('value="hex"') && body.includes('value="oct"');
})());

ok("buildParticleMode() wires pmMirror change and pmConstellation change to S.pmode", (() => {
  const fn = extractFn("buildParticleMode");
  return !!fn
    && fn.includes('$("pmMirror").addEventListener("change", e => S.pmode.mirror = e.target.value);')
    && fn.includes('$("pmConstellation").addEventListener("change", e => S.pmode.constellation = e.target.checked);');
})());

ok("pmode save serialization includes mirror and constellation", (() => {
  return script.includes("pmode: { on: S.pmode.on, pattern: S.pmode.pattern, multicolor: S.pmode.multicolor, amount: S.pmode.amount, mirror: S.pmode.mirror, constellation: S.pmode.constellation },");
})());

ok("sync-to-UI sets #pmMirror and #pmConstellation from S.pmode", (() => {
  return script.includes('$("pmMirror").value = S.pmode.mirror; $("pmConstellation").checked = S.pmode.constellation;');
})());
```

- [ ] **Step 8: Run the tests**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
node test.js 2>&1 | tail -20
```

Expected: all 5 new assertions print `✓`, final line reads `N passed, 0 failed` (N = Task 1's total + 5).

- [ ] **Step 9: Run the full build+test pipeline**

```bash
npm run ci 2>&1 | tail -15
```

Expected: same pass count as Step 8, no new errors.

- [ ] **Step 10: Commit**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
git add elastic-morph.html test.js
git commit -m "feat(particle-mode): wire Mirror + Constellation UI controls

New #pmMirror select (same 7 options as Layer B's #lbMirror) and
#pmConstellation checkbox in the Particle Mode panel, wired to
S.pmode.mirror/S.pmode.constellation (the state Task 1's drawParticleMode
already reads). Save serialization + sync-to-UI updated; load needs no
change since Object.assign(S.pmode, o.pmode || {}) already spreads
whatever keys a save file has.

Per docs/superpowers/specs/2026-08-29-particle-mode-mirror-constellation-design.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Live verification and ship

**Files:** None modified — this task verifies Tasks 1-2's work in a real browser and ships it.

**Interfaces:**
- Consumes: `S.pmode.on`, `S.pmode.pattern`, `S.pmode.mirror`, `S.pmode.constellation`, `S.perfScale` (existing + new state fields), the `frame()` rAF loop (already running unconditionally — do not call `drawScene`/`drawParticleMode` directly).

- [ ] **Step 1: Start a dev server serving the current working tree**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
npx --yes serve -l 8938 "$(pwd)" > /tmp/serve-pm-mirror.log 2>&1 &
sleep 3
curl -sL -o /tmp/pm-mirror-check.html http://localhost:8938/elastic-morph.html
wc -c /tmp/pm-mirror-check.html elastic-morph.html
```

Expected: both byte counts match exactly. If they don't, the server is stale — kill it (`pkill -f "serve -l 8938"`) and retry.

- [ ] **Step 2: Open the Browser pane and navigate to the served app**

Navigate to `http://localhost:8938/elastic-morph.html`.

- [ ] **Step 3: CRITICAL FIRST CHECK — confirm the live function actually contains the new code**

Before any pixel-sampling, run via the browser's JS execution tool:

```js
const src = drawParticleMode.toString();
({
  hasMPasses: src.includes("mPasses"),
  hasConstPts: src.includes("pmConstPts"),
  hasMirrorXY: src.includes("pmMirrorXY"),
  firstLine: src.split("\n")[0]
})
```

Expected: all three `has*` fields `true`. If any is `false`, STOP — do not proceed to live-verify a stale/wrong function (this is exactly the mistake Round 1 made; re-check that the dev server is serving the current file, per Step 1, and that Tasks 1-2 actually committed correctly).

- [ ] **Step 4: Confirm mirror modes render distinct multiplied/reflected copies**

```js
S.pmode.on = true;
S.pmode.pattern = "vortex";
S.pmode.mirror = "quad";
await new Promise(r => setTimeout(r, 700));
```

Take a screenshot and visually confirm 4-way symmetric reflected copies of the vortex pattern. Then:

```js
S.pmode.mirror = "oct";
await new Promise(r => setTimeout(r, 700));
```

Screenshot again, confirm 8-way symmetric copies, visually distinct from the quad screenshot. Repeat briefly for at least one more mode (e.g. `"diag"`) to confirm it's not just quad/oct that work. Check `S._frameErrLogged` stays falsy throughout.

- [ ] **Step 5: Confirm the perf ladder engages under load**

```js
S.pmode.mirror = "oct";
S.perfScale = 0.8;
await new Promise(r => setTimeout(r, 300));
const s1 = (() => { const c=document.getElementById('canvas'); const cx=c.getContext('2d'); const d=cx.getImageData(0,0,c.width,c.height).data; let s=0,n=0; for(let i=0;i<d.length;i+=4){s+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];n++;} return s/n; })();
S.perfScale = 0.4;
await new Promise(r => setTimeout(r, 300));
const s2 = (() => { const c=document.getElementById('canvas'); const cx=c.getContext('2d'); const d=cx.getImageData(0,0,c.width,c.height).data; let s=0,n=0; for(let i=0;i<d.length;i+=4){s+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];n++;} return s/n; })();
S.perfScale = 1;
({ s1, s2, differs: s1 !== s2, frameErrLogged: S._frameErrLogged })
```

Expected: `differs: true` (fewer mirrored copies at low perfScale changes the rendered result), `frameErrLogged` falsy, no hang/crash.

- [ ] **Step 6: Confirm Constellation lines appear on eligible patterns and not on ineligible ones**

For each of `"nebula"`, `"swarm"`, `"vortex"`, `"fountain"`:

```js
S.pmode.mirror = "off";
S.pmode.pattern = "nebula";   // repeat for swarm, vortex, fountain
S.pmode.constellation = false;
await new Promise(r => setTimeout(r, 500));
const off = (() => { const c=document.getElementById('canvas'); const cx=c.getContext('2d'); const d=cx.getImageData(0,0,c.width,c.height).data; let s=0,n=0; for(let i=0;i<d.length;i+=4){s+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];n++;} return s/n; })();
S.pmode.constellation = true;
await new Promise(r => setTimeout(r, 500));
const on = (() => { const c=document.getElementById('canvas'); const cx=c.getContext('2d'); const d=cx.getImageData(0,0,c.width,c.height).data; let s=0,n=0; for(let i=0;i<d.length;i+=4){s+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];n++;} return s/n; })();
({ pattern: S.pmode.pattern, off, on, differs: off !== on })
```

Expected: `differs: true` for all 4 eligible patterns. Then for `"hyperspace"` (an ineligible pattern) with `S.pmode.constellation = true`, take a screenshot and visually confirm no connecting lines appear (pixel-mean alone can't prove absence of lines definitively, since it's already animating for other reasons — visual confirmation via screenshot is the real check here).

- [ ] **Step 7: Confirm save/load round-trips the two new fields**

```js
S.pmode.mirror = "hex";
S.pmode.constellation = true;
const saved = JSON.parse(JSON.stringify({ pmode: { on: S.pmode.on, pattern: S.pmode.pattern, multicolor: S.pmode.multicolor, amount: S.pmode.amount, mirror: S.pmode.mirror, constellation: S.pmode.constellation } }));
S.pmode.mirror = "off";
S.pmode.constellation = false;
Object.assign(S.pmode, saved.pmode || {});
({ mirror: S.pmode.mirror, constellation: S.pmode.constellation })
```

Expected: `{ mirror: "hex", constellation: true }` (round-tripped correctly).

- [ ] **Step 8: Check console for new errors**

Use the Browser pane's console-reading tool. Expected: no new errors attributable to this change.

- [ ] **Step 9: Stop the dev server**

```bash
pkill -f "serve -l 8938" 2>/dev/null; true
```

- [ ] **Step 10: Push and hash-confirm live**

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

- [ ] **Step 11: Re-confirm on the LIVE site too (not just local dev server)**

Navigate the Browser pane to `https://elasticmorph.app/elastic-morph.html` and repeat Step 3's `drawParticleMode.toString()` check there. This is the definitive proof the deployed function is correct — the local dev server check in Step 3 confirms your working tree, but this confirms what Vercel's build actually shipped.

- [ ] **Step 12: Update the shared progress ledger**

Append to `.superpowers/sdd/progress.md`:

```
=== Plan: 2026-08-29-particle-mode-mirror-constellation.md ===
Task 1: complete (commit <hash>, tests <N>/0 failed) — mirror + constellation logic in src/inject-v85.js
Task 2: complete (commit <hash>, tests <N>/0 failed) — UI wiring in elastic-morph.html
Task 3: complete — live-verified. drawParticleMode.toString() confirmed containing mPasses/pmConstPts/pmMirrorXY on BOTH local dev server and the live deployed site (not just tests) before any pixel-sampling. All mirror modes confirmed visually distinct. Perf ladder confirmed engaging under forced low perfScale. Constellation confirmed appearing on all 4 eligible patterns, absent on ineligible ones. Save/load round-trip confirmed. 0 new console errors. Pushed <hash>, hash-confirmed live.
particle-mode-mirror-constellation: FULLY SHIPPED. Round 2 of 3 Particle Mode upgrades. Round 3 (new patterns) next.
```

Fill in the actual commit hashes and test counts.

---

## Post-plan note for whoever runs this

The Global Constraints section's warning about `src/inject-v85.js` vs. the dead pre-marker copy is not decorative — it is the exact mistake that broke Round 1 of this same feature earlier the same day (commit 390a6dc fixed it). If anything about Task 1 or Task 3 feels like it should be simpler by editing `elastic-morph.html`'s pre-marker `drawParticleMode` directly, that feeling is the trap — stop and re-read the Global Constraints section.

If Task 3's live verification surfaces anything unexpected (a mirror mode rendering incorrectly, constellation lines in the wrong places, a console error), treat it as a normal bug: fix directly in `src/inject-v85.js` or `elastic-morph.html` as appropriate, re-verify, re-push, following this session's established practice of fixing Critical/Important issues without re-asking Frank unless it's a genuine design tradeoff.
