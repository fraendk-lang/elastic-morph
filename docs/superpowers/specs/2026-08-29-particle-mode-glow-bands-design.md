# Particle Mode — Glow & Frequency-Band Coupling: Design Spec

**Status:** Approved by Frank ("passt")
**Date:** 2026-08-29

## Goal

First of three planned upgrade rounds for the "Particle Mode" overlay (`S.pmode`,
key `P`) — a standalone visual layer independent of the DNA organism, with 8
patterns (Hyperspace, Sternenregen/starfall, Neon Rain, Vortex, Fountain,
Fireworks, Nebula, Swarm). This round: (1) add a soft glow to every particle,
(2) replace each pattern's pauschal `S.loudness`/`S.beat`/`S.highs` audio
coupling with a per-pattern frequency-band mapping that fits its character.

Frank picked all four possible upgrade axes during brainstorming (new
patterns, visual upgrade, new capabilities like mirror/constellation, better
audio coupling) — given they're largely independent, this was scoped into
three sequential rounds. This spec covers round 1 (visual upgrade + audio
coupling, since both touch the same 8 case blocks). Round 2 (Mirror +
Constellation capabilities) and round 3 (new patterns) follow later, each
with its own spec/plan/implementation cycle.

## Context

`drawParticleMode(W, H, baseHue, dt)` (`elastic-morph.html:6186`) draws a
shared pool of up to 610 particles (`pmParticles`, sized by
`S.pmode.amount`), dispatched per-pattern through `switch (pm.pattern)`
(`elastic-morph.html:6208`). Each pattern is its own `case` block with its
own physics; today, all use flat fills/strokes with no glow except Nebula,
which already uses a per-particle radial gradient
(`ctx.createRadialGradient`, `elastic-morph.html:6283`) — its own equivalent
of a soft glow.

The app already has real frequency-band data beyond the coarse
bass/mids/highs split: `S.bands.{subBass, bass, lowMid, mid, highMid, air}`
(6-band split, `elastic-morph.html:3036-3041`, refreshed every audio frame,
decays gently to ~0 when paused/idle — safe to read unconditionally, no
guards needed) plus two percussive one-shot pulse signals,
`S.kickOnset`/`S.snareOnset` (spike-then-decay shape, same family as the
existing `S.beat`/`S.transient`, `elastic-morph.html:3043-3048`). These were
built for the Graphic EQ feature but are plain `S.*` globals, freely usable
here.

Cost-scaling precedent already exists in the codebase: `S.perfScale`
(`elastic-morph.html:2922`), an adaptive 0.35–1 FPS guardrail, gates other
expensive-under-load features with a binary threshold, e.g.
`S.geo2.on && (S.exporting || (S.perfScale || 1) > 0.5)`
(`elastic-morph.html:4793`). This spec reuses that exact `> 0.5` threshold
convention for the new glow, so its cost behavior is consistent with the
rest of the app rather than inventing a new curve.

## Design

**1) ShadowBlur glow, perf-gated.** Add one local at the top of
`drawParticleMode`, alongside the existing `energy`/`beat`/`hi` locals:

```js
const glowOn = S.exporting || (S.perfScale || 1) > 0.5;
```

Every pattern except Nebula gets `ctx.shadowBlur = glowOn ? <radius> : 0;
ctx.shadowColor = <same color as the fill/strokeStyle just set>;` right
before its draw call(s) — the same technique already used throughout the
codebase (Layer B's `helix`/`pulseRings`/`tentacle`, the VU Meter Wall).
Radius is sized relative to `pt.sz` (each pattern's existing per-particle
size field), roughly 2–3x the particle's own visible radius, tuned
per-pattern in the exact code below. Under FPS pressure (`perfScale` at or
below the 0.5 threshold), `shadowBlur` is forced to exactly 0 — a binary
cut, not a graceful taper, matching the `S.geo2` precedent rather than
inventing a new degradation curve. Full export (`S.exporting`) always keeps
the glow at full quality, matching every other perf-gated feature in the
codebase.

**Nebula is deliberately excluded from the ShadowBlur change.** It already
has an equivalent glow via its own radial gradient — adding `shadowBlur` on
top would double the glow cost for no visible gain (the gradient already
produces the soft look ShadowBlur exists to create elsewhere). Nebula's
case block only gets the frequency-band change below, not the glow change.

**2) Per-pattern frequency-band coupling.** Each pattern keeps its existing
pauschal `energy`/`beat`/`hi` terms (removing them would flatten the
pattern's base liveliness) and *adds* one targeted band term on top, chosen
per Frank's approved per-pattern mapping:

| Pattern | New coupling | Signal used | Why |
|---|---|---|---|
| Hyperspace | streak speed | `S.bands.air` | Höhen = Energie-Rauschen/Tempo |
| Sternenregen (`starfall`) | fall speed + tail length | `S.bands.highMid` / `S.bands.air` | helle, kaskadierende Bewegung |
| Neon Rain (`rain`) | fall-speed burst | `S.kickOnset` | Regen "schlägt ein" zum Kick |
| Vortex | rotation speed / inward pull | `S.bands.bass` / `S.bands.lowMid` | Bass = Sog/Gravitation |
| Fountain | launch power | `S.bands.subBass` + `S.kickOnset` | Kick = Fontänen-Wumms |
| Fireworks | explosion radius | `S.snareOnset` | Snare = Knall-Charakter |
| Nebula | drift speed | `S.bands.mid` | (glow brightness stays on `S.loudness`, already established) |
| Swarm | attractor jitter / path amplitude | `S.bands.mid` / `S.bands.bass` | percussive jitter vs. slow sway |

Continuous bands (`S.bands.*`) drive continuous motion (speed, rotation,
drift) since they're smoothly-decaying levels; the two onset pulses
(`S.kickOnset`/`S.snareOnset`) drive one-shot "impact" moments (bursts,
launches, explosions) since they're spike-then-decay signals — matching how
`S.beat`/`S.transient` are already used elsewhere in the file.

## Exact Code

*Line numbers below are as of this spec's writing (2026-08-29) — re-confirm
with a fresh `grep -n` immediately before editing, per the project's
build-pipeline-gotcha memory (though this entire function is well before the
`@BUILD-INJECT-V58` marker regardless of drift).*

**Add `glowOn` local, `elastic-morph.html:6191`** (right after the existing
`const energy = ...` line):

```js
  const energy = 0.25 + S.loudness * 1.25, beat = S.beat, hi = S.highs;
  const glowOn = S.exporting || (S.perfScale || 1) > 0.5;
```

**Replace the full switch body, `elastic-morph.html:6208-6302`** (every
case gets its band term; 7 of 8 also get shadowBlur/shadowColor, Nebula
does not):

```js
    switch (pm.pattern) {
      case "hyperspace": {
        pt.pr = pt.r;
        pt.r += dt * (0.12 + energy * 0.85 + beat * 0.6 + S.bands.air * 0.9) * pt.spd;
        if (pt.r >= 1) { pt.r = Math.random() * 0.04; pt.pr = pt.r; pt.a = Math.random() * Math.PI * 2; pt.hue = Math.random() * 360; }
        const x1 = cx + Math.cos(pt.a) * pt.pr * maxR, y1 = cy + Math.sin(pt.a) * pt.pr * maxR;
        const x2 = cx + Math.cos(pt.a) * pt.r * maxR, y2 = cy + Math.sin(pt.a) * pt.r * maxR;
        ctx.strokeStyle = pmColor(pt, baseHue, 55 + pt.r * 35, 0.15 + pt.r * 0.65);
        ctx.lineWidth = pt.sz * (0.4 + pt.r * 2) * sc;
        ctx.shadowBlur = glowOn ? pt.sz * 3 * sc : 0; ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        break;
      }
      case "starfall": {
        pt.y += dt * (50 + energy * 230 + S.bands.highMid * 180) * pt.spd * sc;
        pt.x += dt * (S.stereo * 40 + 12) * sc;
        if (pt.y > H + 12) { pt.y = -12; pt.x = Math.random() * W; }
        if (pt.x > W + 12) pt.x = -12;
        const tail = (6 + energy * 34 + S.bands.air * 26) * sc;
        ctx.strokeStyle = pmColor(pt, baseHue, 70, 0.2 + hi * 0.5);
        ctx.lineWidth = pt.sz * 0.9 * sc;
        ctx.shadowBlur = glowOn ? pt.sz * 2.5 * sc : 0; ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x - tail * 0.25, pt.y - tail); ctx.stroke();
        break;
      }
      case "rain": {
        pt.y += dt * (260 + energy * 420 + S.kickOnset * 260) * pt.spd * sc;
        if (pt.y > H + 14) { pt.y = -14; pt.x = Math.random() * W; pt.hue = Math.random() * 360; }
        const tail = (14 + energy * 26) * sc;
        ctx.strokeStyle = pmColor(pt, baseHue, 60, 0.18 + hi * 0.4);
        ctx.lineWidth = pt.sz * 0.5 * sc;
        ctx.shadowBlur = glowOn ? pt.sz * 2 * sc : 0; ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x, pt.y - tail); ctx.stroke();
        ctx.fillStyle = pmColor(pt, baseHue, 85, 0.5 + hi * 0.4);
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillRect(pt.x - 0.6 * sc, pt.y, 1.4 * sc, 2.2 * sc);
        break;
      }
      case "vortex": {
        pt.a += dt * (0.5 + energy * 1.6 + S.bands.bass * 1.3) * pt.spd * (1.2 - pt.r * 0.4);
        pt.r -= dt * (0.04 + energy * 0.22 + S.bands.lowMid * 0.18);
        if (pt.r < 0.02) { pt.r = 0.55 + Math.random() * 0.45; pt.hue = Math.random() * 360; }
        const x = cx + Math.cos(pt.a) * pt.r * maxR, y = cy + Math.sin(pt.a) * pt.r * maxR * 0.82;
        const s = pt.sz * (0.6 + (1 - pt.r) * 1.6) * sc;
        ctx.fillStyle = pmColor(pt, baseHue, 60 + (1 - pt.r) * 25, 0.3 + hi * 0.4);
        ctx.shadowBlur = glowOn ? s * 1.4 : 0; ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "fountain": {
        if (pt.life <= 0) {
          pt.x = cx + (Math.random() - 0.5) * W * 0.06; pt.y = H - 8 * sc;
          pt.vx = (Math.random() - 0.5) * 160 * sc;
          pt.vy = -(220 + Math.random() * 220 + energy * 260 + (S.bands.subBass + S.kickOnset) * 180) * sc;
          pt.life = 1; pt.hue = Math.random() * 360;
        }
        pt.vy += dt * 320 * sc;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        if (pt.y > H + 10) pt.life = 0;
        ctx.fillStyle = pmColor(pt, baseHue, 65, 0.35 + hi * 0.35);
        ctx.shadowBlur = glowOn ? pt.sz * 2.6 * sc : 0; ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.sz * 1.3 * sc, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "fireworks": {
        if (pt.life > 0) {
          pt.vy += dt * 130 * sc; pt.vx *= 0.985; pt.vy *= 0.985;
          pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt * 0.7;
          const a = Math.max(0, pt.life);
          ctx.fillStyle = pmColor(pt, baseHue, 62, a * 0.95);
          ctx.shadowBlur = glowOn ? pt.sz * (0.6 + a) * sc * 2 : 0; ctx.shadowColor = ctx.fillStyle;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.sz * (0.6 + a + S.snareOnset * 0.5) * sc, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "nebula": {
        const ang = noise2(pt.x * 0.0022 + S.time * 0.05, pt.y * 0.0022 - S.time * 0.03) * Math.PI * 2;
        const v = dt * (24 + energy * 70 + S.bands.mid * 55) * sc;
        pt.x += Math.cos(ang) * v; pt.y += Math.sin(ang) * v;
        if (pt.x < -20) pt.x = W + 20; else if (pt.x > W + 20) pt.x = -20;
        if (pt.y < -20) pt.y = H + 20; else if (pt.y > H + 20) pt.y = -20;
        const rad = pt.sz * 9 * sc;
        const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rad);
        g.addColorStop(0, pmColor(pt, baseHue, 60, 0.16 + S.loudness * 0.2));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "swarm": {
        const ax = cx + Math.sin(S.time * 0.7) * W * (0.32 + S.bands.bass * 0.1) + S.stereo * W * 0.1;
        const ay = cy + Math.cos(S.time * 0.9) * H * (0.3 + S.bands.bass * 0.08);
        pt.vx += (ax - pt.x) * dt * 1.8; pt.vy += (ay - pt.y) * dt * 1.8;
        pt.vx += (Math.random() - 0.5) * 220 * dt * (0.4 + beat + S.bands.mid * 0.6);
        pt.vy += (Math.random() - 0.5) * 220 * dt * (0.4 + beat + S.bands.mid * 0.6);
        pt.vx *= 0.94; pt.vy *= 0.94;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        ctx.fillStyle = pmColor(pt, baseHue, 64, 0.3 + hi * 0.4);
        ctx.shadowBlur = glowOn ? pt.sz * 2.2 * sc : 0; ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.sz * 1.1 * sc, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
```

The surrounding `ctx.save()`/`ctx.restore()` pair already wrapping the whole
particle loop (`elastic-morph.html:6193`/`6304`) resets `shadowBlur` back to
0 for whatever draws next — no manual reset needed inside this function,
consistent with how the loop already worked before this change.

All identifiers used (`S.bands.*`, `S.kickOnset`, `S.snareOnset`,
`S.perfScale`, `S.exporting`, `pmColor`, `cx`/`cy`/`maxR`/`sc`, `energy`/
`beat`/`hi`) are already in scope or already globals — confirmed by reading
`elastic-morph.html:3030-3048` (band/onset computation) and
`elastic-morph.html:6186-6304` (the function itself).

## Non-Goals (explicitly deferred to rounds 2/3)

- **Kaleidoskop-Mirror** and **Constellation-Verbindungslinien** for
  Particle Mode — round 2.
- **New patterns** beyond the existing 8 — round 3.
- Changing `S.pmode`'s state shape (`on`/`pattern`/`multicolor`/`amount`) —
  no new toggles needed for this round; the glow and band coupling are
  unconditional improvements to the existing patterns, not new user-facing
  options.

## Testing

Following this session's established pattern for switch-case additions to
`elastic-morph.html` (structural `extractFn` + `.includes()` checks against
the extracted function source, since the logic lives inside a large
function's case blocks):

- `drawParticleMode`'s extracted source contains the `glowOn` definition
  (`const glowOn = S.exporting || (S.perfScale || 1) > 0.5;`).
- Each of the 7 non-Nebula cases contains `ctx.shadowBlur = glowOn ?` — a
  loop over the 7 pattern ids checking this, rather than 7 separate
  hand-written assertions.
- The `nebula` case slice specifically does **not** contain `shadowBlur` —
  locks in the deliberate exclusion so a future edit doesn't silently
  double up its glow cost.
- Each pattern's case slice contains its assigned band/onset signal from
  the table above (e.g. `hyperspace` slice contains `S.bands.air`, `rain`
  slice contains `S.kickOnset`, etc.) — one assertion per pattern, table-driven
  where practical.
- `glowOn` correctly evaluates both branches as a pure boolean expression
  (unit-testable in isolation without canvas/DOM): `S.exporting: true` →
  `true` regardless of `perfScale`; `S.exporting: false, perfScale: 0.51` →
  `true`; `S.exporting: false, perfScale: 0.5` → `false` (boundary, matches
  the `> 0.5` in the `S.geo2` precedent, not `>=`).

## Live Verification Plan

Same methodology as every prior round this session: set `S.pmode.on = true;
S.pmode.pattern = "<id>";` directly via `javascript_tool`, let the existing
`frame()` render loop redraw (never call `drawScene`/`drawParticleMode`
manually — see the project's established render-loop-freeze gotcha).
Poll on `S.time` actually advancing before each pixel sample rather than a
fixed `setTimeout`, per the tooling gotcha found during the Bead Tentacle
round's live verification (background-tab `requestAnimationFrame`
throttling can otherwise produce false "not animating" reads). For each of
the 8 patterns: confirm it still renders and animates (pixel-sample
non-zero and changing). For the 7 glow-bearing patterns: confirm visibly
brighter/softer edges vs. a `git stash`d pre-change baseline, or at minimum
confirm `ctx.shadowBlur` reads back as the expected non-zero value when
sampled via `javascript_tool` mid-frame. Confirm the perf gate actually
guards cost: force `S.perfScale = 0.4` and confirm no new console
errors/hangs and the app stays responsive at `amount = 1` (610 particles).
Confirm each pattern's new band coupling has a visible effect by forcing
its assigned `S.bands.*`/`S.kickOnset`/`S.snareOnset` signal to 0 vs 1 and
comparing two pixel samples. 0 new console errors throughout.
