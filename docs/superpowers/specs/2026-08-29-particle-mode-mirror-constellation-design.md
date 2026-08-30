# Particle Mode — Kaleidoscope Mirror & Constellation Lines: Design Spec

**Status:** Approved by Frank ("passt")
**Date:** 2026-08-29

## Goal

Round 2 of 3 planned Particle Mode upgrades: a Kaleidoscope Mirror system (all 7 modes, all
8 patterns) and Constellation connecting-lines (Nebula/Swarm/Vortex/Fountain only), both exposed
as new UI toggles. Round 1 (glow + frequency-band coupling) shipped 2026-08-29. Round 3 (new
patterns) follows later.

## Context — CRITICAL: where the real code lives

`drawParticleMode`/`initPM`/`pmColor` are declared `function NAME(...) {...}` **pre-marker** in
`elastic-morph.html` (`elastic-morph.html:6154-6306`ish), but `src/inject-v85.js` **reassigns**
all three post-marker (`NAME = function (...) {...};`), and `build.js` regenerates that
post-marker region from `src/inject-v85.js` on every build. The post-marker assignment always
wins at runtime (it executes after the pre-marker declaration in script order) — **the
pre-marker copy is dead code.**

Round 1 originally edited the pre-marker copy by mistake, shipped it, and both its tests and its
"live verification" passed anyway (see `project_morph_particle_mode_upgrade.md` memory) — the
bug was only caught and fixed (commit 390a6dc) while preparing this very spec. **Every code
change in this round goes into `src/inject-v85.js` only.** Never edit
`elastic-morph.html`'s pre-marker `drawParticleMode`/`initPM`/`pmColor` directly — `build.js`
regenerates the post-marker region from the src file on every `npm run ci`, so a direct
`elastic-morph.html` edit there would be silently discarded on the next build, or (worse, as
happened in Round 1) sit there as misleading dead code forever if nobody runs the build.

UI wiring (HTML markup, event listeners, save/load, sync-to-UI, and `S.pmode`'s own default
object) all live safely pre-marker and are fine to edit directly in `elastic-morph.html` — only
the drawing logic itself (`drawParticleMode`) is affected by the reassignment trap.

## Design

**1) Mirror mechanism.** Layer B's mirror repeats a stateless geometric draw once per reflection
pass via a `ctx.save()/translate/rotate/scale` canvas transform around the whole pass. Particle
Mode can't reuse that directly: each particle carries physics state (`pt.x`, `pt.vx`, `pt.a`,
`pt.r`, `pt.life`, …) that must update exactly once per particle per frame — repeating a whole
case block per mirror pass would re-run that physics multiple times and corrupt it (particles
moving/decaying faster under a higher mirror count).

Fix: split each of the 8 cases into an unchanged **physics section** (runs once) and a **draw
section** (runs once per mirror pass). Instead of a canvas transform, a small pure function
`pmMirrorXY(x, y, cx, cy, mp)` computes the mirrored *coordinates* directly for a given pass
descriptor `mp` — cheaper than `ctx.save()/restore()` per particle per pass at up to 610×8 draws.
The pass descriptors (`sx`/`sy` flip, `diag` swap, `rot`+`flip` for hex/oct) are the exact same
shape Layer B already uses, so the math mirrors (pun intended) established precedent. For a line
segment (e.g. Hyperspace's streak, Fountain's trail), both endpoints get mirrored and a line is
drawn between the mirrored points — correct because reflection/rotation is affine, so straight
lines stay straight. Nebula's radial gradient can't just be translated, so its case recreates the
gradient once per mirror pass at the mirrored anchor point (accepted cost, same category as the
mirror's cost in general).

Same performance-degradation ladder as Layer B, reused verbatim (`elastic-morph.html`'s existing
`pf57` thresholds): under FPS pressure, `oct→hex→quad→h→off` cascades automatically via
`S.perfScale`.

**2) Constellation lines — Nebula/Swarm/Vortex/Fountain only.** These four read as a
group/cloud of particles; the other four (Hyperspace/Starfall/Rain/Fireworks) are
falling/radiating/exploding fields where connecting lines between far-flung particles would look
chaotic rather than elegant (Frank's call). Each of the four collects its particle's base
(unmirrored) position into a shared `pmConstPts` array as it computes it, capped at 70 points
(same O(n²) cost-control precedent as the organism particle system's own constellation feature).
After the main particle loop, if enabled, connect near points with a distance-fading line —
same shape as the organism's own `P.constellation` code (`elastic-morph.html:5831-5845`):
`alpha = (1 - d/threshold) * factor`, lightly audio-modulated. **Lines connect only the
unmirrored base positions — never per mirrored copy** — this keeps the O(n²) cost independent of
mirror mode and avoids visual clutter from potentially 8x as many overlapping line networks.

**3) New UI controls, matching Layer B's exact convention.** A `<select id="pmMirror">` with the
same 7 options as `<select id="lbMirror">` (off/h/v/diag/quad/hex/oct), and a
`<label class="check">` checkbox `pmConstellation`, both added to the existing Particle Mode
panel after the Amount slider. `S.pmode` gains `mirror: "off"` and `constellation: false`
defaults — since `Object.assign(S.pmode, o.pmode || {})` already spreads the whole saved object
generically, an old save missing these two keys keeps the new defaults automatically, no extra
migration code needed.

## Exact Code

*Line numbers below are as of this spec's writing (2026-08-29) — re-confirm with a fresh
`grep -n` immediately before editing. The `src/inject-v85.js` edits below don't need line-number
re-confirmation the same way (it's a small, self-contained 235-line file) but re-read it fresh
before editing regardless, since Round 1's fix (commit 390a6dc) already changed it once today.*

### A) `src/inject-v85.js` — new helper functions

Add these three functions and one constant right after `pmColor`'s closing `};`
(`src/inject-v85.js:55`), before `drawParticleMode`:

```js
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
    /* Must match Layer B's actual canvas-transform order exactly: translate(cx,cy);
       rotate(rot); scale(1,-1) [if flip]; translate(-cx,-cy) — composed, that applies to a
       point as: flip first, THEN rotate (each later ctx call transforms in the coordinate
       system already established by the earlier ones, so the LAST-called transform,
       translate(-cx,-cy), acts on the point first). Flip-then-rotate is NOT the same
       transform as rotate-then-flip (reflection and rotation don't commute) — getting this
       order backwards silently produces a different (still symmetric-looking, but wrong)
       mirror pattern than Layer B's hex/oct modes actually look like. */
    if (mp.flip) dy = -dy;
    const c = Math.cos(mp.rot), s = Math.sin(mp.rot);
    const rx = dx * c - dy * s, ry = dx * s + dy * c;
    return [cx + rx, cy + ry];
  }
  if (mp.diag) return [cx + dy, cy + dx];
  return [cx + dx * mp.sx, cy + dy * mp.sy];
}
```

### B) `src/inject-v85.js` — mirror-mode + constellation setup in `drawParticleMode`

Find (right after the `glowOn` line added in Round 1, `src/inject-v85.js:70`):

```js
  const glowOn = S.exporting || (S.perfScale || 1) > 0.5;

  ctx.save();
```

Replace with:

```js
  const glowOn = S.exporting || (S.perfScale || 1) > 0.5;

  /* v131: Kaleidoscope Mirror + Constellation lines — see docs/superpowers/specs/
     2026-08-29-particle-mode-mirror-constellation-design.md. Same perf-degradation ladder as
     Layer B's mirror (elastic-morph.html's drawLayerB pf57 logic). */
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

### C) `src/inject-v85.js` — replace the full switch body

Find the switch from `switch (pm.pattern) {` through its closing `}`
(`src/inject-v85.js:91-211` — current, unmodified-by-this-round content, i.e. the version already
live after Round 1's fix at commit 390a6dc):

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

### D) `src/inject-v85.js` — constellation line-drawing after the particle loop

Find (right after the switch's closing `}`, before `ctx.restore();`,
`src/inject-v85.js:212-213`):

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

### E) `elastic-morph.html` — UI markup (pre-marker, safe to edit directly)

Find (`elastic-morph.html:1761-1765`):

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

### F) `elastic-morph.html` — `S.pmode` default (`elastic-morph.html:2899`)

Find:

```js
  pmode: { on: false, pattern: "hyperspace", multicolor: false, amount: 0.6 },
```

Replace with:

```js
  pmode: { on: false, pattern: "hyperspace", multicolor: false, amount: 0.6, mirror: "off", constellation: false },
```

### G) `elastic-morph.html` — event wiring in `buildParticleMode()`

Find (`elastic-morph.html:7979-7994`):

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

### H) `elastic-morph.html` — save serialization (`elastic-morph.html:8094`)

Find:

```js
    pmode: { on: S.pmode.on, pattern: S.pmode.pattern, multicolor: S.pmode.multicolor, amount: S.pmode.amount },
```

Replace with:

```js
    pmode: { on: S.pmode.on, pattern: S.pmode.pattern, multicolor: S.pmode.multicolor, amount: S.pmode.amount, mirror: S.pmode.mirror, constellation: S.pmode.constellation },
```

(Load needs no change — `Object.assign(S.pmode, o.pmode || {})` at `elastic-morph.html:8153`
already spreads whatever keys a save file has; an old save missing `mirror`/`constellation`
simply keeps the `S.pmode` defaults from section F above.)

### I) `elastic-morph.html` — sync-to-UI (`elastic-morph.html:8254-8256`)

Find:

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

## Non-Goals

- Mirroring the constellation lines themselves — explicitly decided against (cost + clutter).
- Constellation for Hyperspace/Starfall/Rain/Fireworks — explicitly out of scope per Frank.
- Any change to Round 1's glow/band-coupling logic — untouched by this round except that the
  switch body it lives in gets restructured (physics unchanged, only the draw calls move into
  mirror loops).
- Round 3 (new patterns) — separate, later spec.

## Testing

Following this session's established pattern, now corrected per the Round 1 bug: test against
`src/inject-v85.js`'s actual content via `injectSrc("inject-v85.js")`, never against the
assembled `script` (which would find the dead pre-marker `function drawParticleMode(` first).

- `pmMirrorPasses`/`pmMirrorXY`/`pmMirrorRotPasses` extracted and unit-tested with real numeric
  inputs (pure functions, genuinely testable): `pmMirrorXY` under `{sx:-1,sy:1}` (h-flip) negates
  only the x-delta; under `{diag:true}` swaps the x/y deltas; under a `hex` pass's `rot`/`flip`
  combination, matches a hand-computed rotation for a known point.
- `pmMirrorPasses("quad")` returns exactly 4 entries, `"oct"` returns 8, `"off"` (or an unknown
  string) returns exactly 1 identity-ish pass (`{sx:1,sy:1}`).
- The perf-degradation ladder (`pf57` thresholds 0.75/0.65/0.55/0.45) matches Layer B's own
  `drawLayerB` thresholds exactly (copy-paste the same 4 numbers, compare via string presence in
  both `elastic-morph.html`'s `drawLayerB` and `src/inject-v85.js`'s `drawParticleMode`).
- Every one of the 8 case bodies contains `for (const mp of mPasses)` at least once (some contain
  it twice, e.g. Hyperspace and Fountain — assert `>= 1` occurrence per case, not an exact count,
  to avoid an overly brittle test).
- The 4 constellation-eligible case bodies (`vortex`, `fountain`, `nebula`, `swarm`) each contain
  `pmConstPts.push(`; the other 4 (`hyperspace`, `starfall`, `rain`, `fireworks`) do **not**.
- `PM_CONST_PATTERNS` is exactly `new Set(["nebula", "swarm", "vortex", "fountain"])`.
- The constellation line-drawing block exists after the switch, gated by
  `pmConstOn && pmConstPts.length > 1`, and caps collection at `70` (string-search for
  `pmConstPts.length < 70` appearing in all 4 eligible cases).
- `S.pmode`'s default object includes `mirror: "off", constellation: false`.
- `pmMode` save serialization includes both new fields; sync-to-UI sets both new controls.
- Sanity check (same technique as the Round 1 fix): confirm `drawParticleMode = function (` still
  exists in `src/inject-v85.js` (guards against ever again testing/shipping against the dead
  pre-marker copy by accident).

## Live Verification Plan

Same established method: never call `drawScene`/`drawParticleMode` manually — only set state
(`S.pmode.on`, `S.pmode.pattern`, `S.pmode.mirror`, `S.pmode.constellation`) and let the existing
`frame()` loop redraw. **Critically, after deploying, read back
`drawParticleMode.toString()` in the browser and confirm it contains `mPasses`/`pmConstPts`/
`pmMirrorXY`** — the definitive check that the live function is the one just edited, not a repeat
of Round 1's mistake. Then: cycle through all 7 mirror modes on at least 2 patterns and confirm
visibly distinct multiplied/reflected copies (pixel-sample plus a screenshot, since mirror
symmetry is a genuinely visual property pixel-mean alone can't fully confirm); confirm the perf
ladder engages by forcing `S.perfScale` to values in each band (e.g. `0.8`, `0.6`, `0.5`, `0.4`)
while `mirror = "oct"` and confirming no hang/crash and progressively simpler mirroring; enable
Constellation on each of the 4 eligible patterns and confirm connecting lines appear (pixel-sample
delta vs. constellation off); confirm the 4 non-eligible patterns show **no** lines even with the
Constellation checkbox on; confirm save/load round-trips `mirror`/`constellation` correctly; 0 new
console errors.
