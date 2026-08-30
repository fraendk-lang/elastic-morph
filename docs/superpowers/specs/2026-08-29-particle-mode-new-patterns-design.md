# Particle Mode — New Patterns (Bokeh / Magnetic Field / Pulse Burst): Design Spec

**Status:** Approved by Frank ("passt" on concept, "ja" on the three named patterns)
**Date:** 2026-08-29

## Goal

Round 3 of 3 planned Particle Mode upgrades: 3 new patterns — **Bokeh**, **Magnetic Field**, and
**Pulse Burst** — bringing `PM_PATTERNS` from 8 to 11 entries. Round 1 (glow + frequency-band
coupling) and Round 2 (Kaleidoscope Mirror + Constellation) both shipped 2026-08-29. This closes
the full 3-round Particle Mode upgrade plan.

## Context — same critical rule as Rounds 1 and 2

`drawParticleMode`/`initPM`/`pmColor` are declared pre-marker in `elastic-morph.html` but
**reassigned** post-marker by `src/inject-v85.js` (`NAME = function (...) {...};`, regenerated
into `elastic-morph.html` by `build.js` on every build) — the post-marker assignment always wins
at runtime. **Every drawing-logic edit in this round goes into `src/inject-v85.js` only.**

One exception, established during Round 3 spec-writing by reading the code: `let pmParticles =
[], pmFireTimer = 0;` (`elastic-morph.html:6163`) is a plain top-level variable declaration, not
a function reassignment — `let`/`const` declarations execute once and are shared by reference
across the whole script (both pre- and post-marker code run in the same global scope), so this
declaration IS safe to extend directly in `elastic-morph.html`. Only function-identity
reassignment (`name = function(){}`) creates the dead-code trap; plain state variable
declarations do not. This round needs one new persistent module-scope variable
(`pmBurstR`, for Pulse Burst's smoothed radius) — it goes on this same line.

`PM_PATTERNS` (the array populating the pattern dropdown) and `PM_CONST_PATTERNS` (the
constellation-eligible pattern set) both live pre-marker in their respective files
(`PM_PATTERNS` in `elastic-morph.html`, `PM_CONST_PATTERNS` in `src/inject-v85.js` — it was added
there in Round 2, alongside the other Round 2 mirror helpers) and are safe to extend directly.

## Design

**Naming — two deliberate departures from Frank's working names, to avoid collisions with
existing dropdown options elsewhere in the app** (the same lesson the Cosmic Drift round learned
the hard way with "Nebula"/"Vortex"):
- "Attraktoren-Netz" → **`magnetic` / "Magnetic Field"** — the DNA preset system already has an
  entry literally named "DNA Attractor" (`id: "attractor"`, a Strange Attractor DNA engine,
  `elastic-morph.html:2327`). Using "Attractor" again in the Particle Mode dropdown would put two
  differently-behaving "Attractor" options in two different menus.
- "Puls-Explosion" → **`pulseBurst` / "Pulse Burst"** — Layer B already has "Pulse Rings"
  (`elastic-morph.html:6343`ish). "Pulse Burst" is close enough in spirit to keep the German
  intent but distinct enough not to read as the same feature in a different menu.
- **Bokeh** keeps its working name — no collision found (`grep -in "bokeh"` across both files:
  zero hits before this round).

**All three reuse the existing shared particle-pool shape** (`{x, y, a, r, pr, spd, sz, hue, vx,
vy, life}`, the same fields every existing pattern already reuses creatively) — no new per-particle
fields, no `initPM()` changes needed, matching the established convention that all patterns share
one pool.

**Bokeh** — slow, lazy Lissajous-style personal drift (each particle's own `pt.a`/`pt.spd`
become its phase/speed, not a shared field), NOT curl-noise (deliberately different technique
from Nebula, which already owns that look). Drawn as a soft radial-gradient body (Nebula's
technique, not ShadowBlur — a big blurred circle needs the gradient's true falloff, ShadowBlur's
box-ish spread wouldn't read as "photographic bokeh"). Size/brightness breathes gently with
`S.bands.subBass`. **Not constellation-eligible** — independently-drifting scattered points, not
a coherent group (matches the existing exclusion logic for Hyperspace/Starfall/Rain/Fireworks).

**Magnetic Field** — 4 attractor points, computed once per frame (not per particle, following the
same "shared setup before the loop" pattern the mirror/constellation code and Fireworks' trigger
logic already use), positions driven by `S.time`. Each particle is deterministically assigned to
one attractor via `particleIndex % 4` (stable clustering — particles don't jump between
attractors frame to frame) and is pulled toward it with jittered damped-spring physics, generalizing
Swarm's existing single-attractor technique to 4. Attraction strength coupled to `S.bands.lowMid`
(a "field getting stronger" feel), jitter to `S.beat` + `S.bands.mid`. **Constellation-eligible**
— this is exactly the "networked cluster" look Constellation was built for.

**Pulse Burst** — the whole particle field breathes together: each particle sits at a *fixed*
angle (`pt.a`, never updated — this is what makes it read as one coherent breathing sphere rather
than an explosion of independent trajectories, unlike Fireworks) and its radial distance from
center is `pmBurstR * (per-particle variance)`. `pmBurstR` is a single shared, persistent,
critically-damped value (smoothed via `+= (target - current) * min(1, dt*4)`) that jumps toward a
`S.beat`/`S.kickOnset`-driven target and eases back — the same "spring toward a target" shape
Layer B's own accumulators use, but computed once per frame for the whole pattern rather than per
particle. **Not constellation-eligible** — the synchronized radial motion already reads as one
coherent object; connecting lines would visually compete with, not reinforce, that.

All three get the standard treatment established by Rounds 1-2: perf-gated `ShadowBlur` (Bokeh
exempted, matching Nebula's own exemption, since it already has an equivalent gradient glow) and
full Mirror support (`for (const mp of mPasses) { ... }` wrapping every draw call).

## Exact Code

*Line numbers below are as of this spec's writing (2026-08-29) — re-confirm with a fresh
`grep -n` immediately before editing.*

### A) `elastic-morph.html` — `PM_PATTERNS` array (`elastic-morph.html:6153-6162`)

Find:

```js
const PM_PATTERNS = [
  ["hyperspace", "Hyperspace"],
  ["starfall",   "Sternenregen"],
  ["rain",       "Neon Rain"],
  ["vortex",     "Vortex"],
  ["fountain",   "Fountain"],
  ["fireworks",  "Fireworks"],
  ["nebula",     "Nebula"],
  ["swarm",      "Swarm"]
];
let pmParticles = [], pmFireTimer = 0;
```

Replace with:

```js
const PM_PATTERNS = [
  ["hyperspace", "Hyperspace"],
  ["starfall",   "Sternenregen"],
  ["rain",       "Neon Rain"],
  ["vortex",     "Vortex"],
  ["fountain",   "Fountain"],
  ["fireworks",  "Fireworks"],
  ["nebula",     "Nebula"],
  ["swarm",      "Swarm"],
  ["bokeh",      "Bokeh"],
  ["magnetic",   "Magnetic Field"],
  ["pulseBurst", "Pulse Burst"]
];
let pmParticles = [], pmFireTimer = 0, pmBurstR = 0.3;
```

### B) `src/inject-v85.js` — `PM_CONST_PATTERNS` (`src/inject-v85.js:59`)

Find:

```js
const PM_CONST_PATTERNS = new Set(["nebula", "swarm", "vortex", "fountain"]);
```

Replace with:

```js
const PM_CONST_PATTERNS = new Set(["nebula", "swarm", "vortex", "fountain", "magnetic"]);
```

### C) `src/inject-v85.js` — per-frame setup for Magnetic Field and Pulse Burst

Find (right after the existing Fireworks trigger block, before the particle loop):

```js
  if (pm.pattern === "fireworks") {
    pmFireTimer -= dt;
    if ((S.transient > 0.35 || beat > 0.55) && pmFireTimer <= 0) {
      pmFireTimer = 0.18 + (1 - beat) * 0.12;
      launchFirework(W, H);
    }
  }

  for (let pi = 0; pi < visN; pi++) {
```

Replace with:

```js
  if (pm.pattern === "fireworks") {
    pmFireTimer -= dt;
    if ((S.transient > 0.35 || beat > 0.55) && pmFireTimer <= 0) {
      pmFireTimer = 0.18 + (1 - beat) * 0.12;
      launchFirework(W, H);
    }
  }

  /* v132: 3 new patterns (Bokeh/Magnetic Field/Pulse Burst) — see docs/superpowers/specs/
     2026-08-29-particle-mode-new-patterns-design.md. Magnetic Field's 4 attractors and Pulse
     Burst's shared breathing radius are computed once per frame here, not per particle. */
  let magAttractors = null;
  if (pm.pattern === "magnetic") {
    magAttractors = Array.from({ length: 4 }, (_, i) => {
      const ang = S.time * 0.25 + i * (Math.PI * 2 / 4);
      return { x: cx + Math.cos(ang) * W * 0.22, y: cy + Math.sin(ang * 1.3) * H * 0.22 };
    });
  }
  if (pm.pattern === "pulseBurst") {
    const target = 0.3 + beat * 0.7 + S.kickOnset * 0.5;
    pmBurstR += (target - pmBurstR) * Math.min(1, dt * 4);
  }

  for (let pi = 0; pi < visN; pi++) {
```

### D) `src/inject-v85.js` — 3 new switch cases

Find the switch's closing `}` right after the `"swarm"` case (i.e. the exact text below, which is
the current end of the switch after Round 2):

```js
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

Replace with:

```js
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
      case "bokeh": {
        pt.x += Math.sin(S.time * 0.18 * pt.spd + pt.a) * dt * 9 * sc;
        pt.y += Math.cos(S.time * 0.14 * pt.spd + pt.a * 1.4) * dt * 9 * sc + dt * 2 * sc;
        if (pt.x < -40) pt.x = W + 40; else if (pt.x > W + 40) pt.x = -40;
        if (pt.y < -40) pt.y = H + 40; else if (pt.y > H + 40) pt.y = -40;
        const breathe = 0.85 + 0.3 * Math.sin(S.time * 1.1 + pt.a) + S.bands.subBass * 0.4;
        const rad = pt.sz * (9 + pt.r * 9) * sc * breathe;
        const col0 = pmColor(pt, baseHue, 72, 0.1 + hi * 0.12);
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
      case "magnetic": {
        const at = magAttractors[pi % magAttractors.length];
        pt.vx += (at.x - pt.x) * dt * (1.2 + S.bands.lowMid * 1.5);
        pt.vy += (at.y - pt.y) * dt * (1.2 + S.bands.lowMid * 1.5);
        pt.vx += (Math.random() - 0.5) * 140 * dt * (0.3 + beat + S.bands.mid * 0.5);
        pt.vy += (Math.random() - 0.5) * 140 * dt * (0.3 + beat + S.bands.mid * 0.5);
        pt.vx *= 0.92; pt.vy *= 0.92;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        if (pmConstOn && pmConstPts.length < 70) pmConstPts.push({ x: pt.x, y: pt.y, hue: pt.hue });
        ctx.fillStyle = pmColor(pt, baseHue, 62, 0.26 + hi * 0.3);
        ctx.shadowBlur = glowOn ? pt.sz * 2 * sc : 0; ctx.shadowColor = ctx.fillStyle;
        for (const mp of mPasses) {
          const [mx, my] = pmMirrorXY(pt.x, pt.y, cx, cy, mp);
          ctx.beginPath(); ctx.arc(mx, my, pt.sz * sc, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "pulseBurst": {
        const rad = pmBurstR * (0.55 + pt.r * 0.6) * maxR;
        const x = cx + Math.cos(pt.a) * rad, y = cy + Math.sin(pt.a) * rad * 0.85;
        ctx.fillStyle = pmColor(pt, baseHue, 60 + pt.r * 20, 0.22 + hi * 0.3 + S.bands.bass * 0.2);
        ctx.shadowBlur = glowOn ? pt.sz * 2.4 * sc : 0; ctx.shadowColor = ctx.fillStyle;
        for (const mp of mPasses) {
          const [mx, my] = pmMirrorXY(x, y, cx, cy, mp);
          ctx.beginPath(); ctx.arc(mx, my, pt.sz * sc, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
    }
```

All identifiers used (`cx`/`cy`/`maxR`/`sc`/`W`/`H`/`dt`/`beat`/`hi`/`baseHue`, `S.bands.*`,
`S.kickOnset`, `pmColor`, `pmMirrorXY`, `mPasses`, `glowOn`, `pmConstOn`, `pmConstPts`,
`pi`, `pt`) are already in scope at this point in `drawParticleMode` — confirmed by reading the
full current function body. No new identifiers needed beyond `magAttractors` and `pmBurstR`,
both introduced in sections A/C above.

## Non-Goals

- No new UI controls — the 3 patterns appear automatically in the existing `#pmPattern` dropdown
  (populated purely from `PM_PATTERNS`, same mechanism as every prior pattern) and are reachable
  via the existing `P` toggle/pattern-cycle UI with zero additional wiring.
- No new `S.pmode` state fields.
- No changes to Round 1 (glow/bands) or Round 2 (mirror/constellation) infrastructure — only
  consumed, not modified.
- No 4th/5th pattern — Frank selected exactly these 3 from the offered shortlist.

## Testing

Following the established pattern for this feature area — structural `extractFn`/`injectSrc`
checks against `src/inject-v85.js`'s real content (never the assembled `script`, which finds the
dead pre-marker `function drawParticleMode(` declaration first, per the Round 1 bug and its
fix in commit 390a6dc):

- `PM_PATTERNS` gained exactly 3 new entries at the end: `["bokeh","Bokeh"]`,
  `["magnetic","Magnetic Field"]`, `["pulseBurst","Pulse Burst"]` (array length 11, last 3
  entries match).
- `pmParticles`/`pmFireTimer`/`pmBurstR` declaration line includes `pmBurstR = 0.3`.
- `PM_CONST_PATTERNS` is exactly `nebula/swarm/vortex/fountain/magnetic` (5 entries) — confirms
  Bokeh and Pulse Burst are correctly excluded.
- Each of the 3 new case bodies contains `for (const mp of mPasses)` (mirror-ready).
- `bokeh`'s case body does **not** contain `shadowBlur` (matches Nebula's exemption); `magnetic`
  and `pulseBurst` both **do** contain `ctx.shadowBlur = glowOn ?`.
- `magnetic`'s case body contains `pmConstPts.push(`; `bokeh`'s and `pulseBurst`'s do **not**.
- `magAttractors`/`pmBurstR` setup block exists, gated by `pm.pattern === "magnetic"` /
  `pm.pattern === "pulseBurst"` respectively, positioned before the particle loop (not inside a
  case, confirming it runs once per frame not once per particle).
- Sanity check (same technique as Rounds 1-2's fix/build): confirm `drawParticleMode = function
  (` still exists in `src/inject-v85.js`, and that the pre-marker copy in `elastic-morph.html`
  contains none of `bokeh`/`magnetic`/`pulseBurst`/`magAttractors`/`pmBurstR` usage inside its own
  dead `drawParticleMode` body (only the `let ... pmBurstR = 0.3` *declaration* is expected there,
  per section A — the declaration itself is fine pre-marker, only its *use inside the dead
  function's case logic* would be a problem, and there is none since that logic all lives in
  `src/inject-v85.js`).

## Live Verification Plan

Same established method: never call `drawScene`/`drawParticleMode` manually — only set state and
let `frame()` redraw. **First**, read back `drawParticleMode.toString()` in the browser and
confirm it contains `magAttractors`/`pmBurstR`/`"bokeh"`/`"magnetic"`/`"pulseBurst"` — on both the
local dev server and, after pushing, the live deployed site — before any pixel-sampling, per the
now-established practice from the Round 1 fix and Round 2. Then: cycle through all 3 new patterns
via `S.pmode.pattern` and confirm each renders and animates (pixel-sample two frames apart,
non-zero and changing). For Bokeh: confirm large soft blurred circles (visually via screenshot,
plus confirm `S.bands.subBass` forced 0→1 changes the pixel mean). For Magnetic Field: confirm 4
visually distinct clusters (screenshot), confirm Constellation lines appear when enabled, confirm
`S.bands.lowMid` forced 0→1 changes rendering. For Pulse Burst: confirm the whole particle field
visibly expands/contracts together over ~1-2 seconds (screenshot at two different points in a
beat cycle, or force `S.beat`/`S.kickOnset` to 1 then 0 and confirm `pmBurstR` itself changes
value when read back from the browser). Confirm Mirror modes work on all 3 new patterns (at least
one non-off mode per pattern, screenshot). Confirm the dropdown/pattern-cycle UI reaches all 3 new
options with zero extra wiring (since none was added, per Non-Goals). 0 new console errors.
