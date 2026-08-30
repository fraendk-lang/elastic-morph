# Particle Mode Glow & Frequency-Band Coupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Round 1 of 3 Particle Mode upgrades — add a perf-gated ShadowBlur glow to 7 of the 8 Particle Mode patterns, and replace each pattern's pauschal loudness/beat/highs audio coupling with a targeted per-pattern frequency-band/onset signal, per the approved design spec.

**Architecture:** One new local (`glowOn`) and one full replacement of the 8-case `switch` body inside the existing `drawParticleMode(W, H, baseHue, dt)` function (`elastic-morph.html`). No new files, no new state fields, no new UI — purely additive/internal to a function that already exists.

**Tech Stack:** Vanilla JS, Canvas 2D (`ctx`). Zero-dependency test harness (`test.js`, `node test.js`).

## Global Constraints

- All touched code lives before the `@BUILD-INJECT-V58` marker in `elastic-morph.html` (currently line 10581 — re-confirm with `grep -n "@BUILD-INJECT-V58" elastic-morph.html` before editing, since it drifts as the file grows) — edit `elastic-morph.html` directly.
- `glowOn` must be exactly `S.exporting || (S.perfScale || 1) > 0.5` — reuses the exact threshold (`> 0.5`, strict, not `>=`) and short-circuit structure already established for `S.geo2` (`elastic-morph.html:4793`). Full export quality is unconditional; live playback is gated.
- **Nebula does not get `ctx.shadowBlur`.** It already has an equivalent glow via its own `ctx.createRadialGradient` — adding ShadowBlur on top would double the glow cost for no visible gain. All 7 other patterns (hyperspace, starfall, rain, vortex, fountain, fireworks, swarm) get `ctx.shadowBlur = glowOn ? <radius> : 0; ctx.shadowColor = <matching color>;` right before their draw call(s).
- Each pattern keeps its existing pauschal `energy`/`beat`/`hi` terms unchanged — the new band/onset term is *added*, not a replacement, so each pattern's existing base liveliness is preserved.
- Per-pattern signal assignment (exact, from the approved design spec — do not substitute a different band):
  - `hyperspace`: `S.bands.air` (streak speed)
  - `starfall`: `S.bands.highMid` (fall speed), `S.bands.air` (tail length)
  - `rain`: `S.kickOnset` (fall-speed burst)
  - `vortex`: `S.bands.bass` (rotation speed), `S.bands.lowMid` (inward pull)
  - `fountain`: `S.bands.subBass` + `S.kickOnset` (launch power)
  - `fireworks`: `S.snareOnset` (explosion radius)
  - `nebula`: `S.bands.mid` (drift speed) — glow brightness stays on `S.loudness`, unchanged
  - `swarm`: `S.bands.bass` (attractor path amplitude), `S.bands.mid` (jitter)
- No new `S.pmode` state fields, no new UI toggles — this round is an unconditional improvement to existing patterns, not a new user-facing option.
- Never call `drawScene()` or `drawParticleMode()` manually during live verification — a malformed manual call can throw and silently freeze the render loop forever via the sticky `S._frameErrLogged` guard (hit during the Cosmic Drift final-review round). Only ever set state (`S.pmode.on`, `S.pmode.pattern`, etc.) and let the existing `frame()` rAF loop redraw.
- When polling for animation via pixel-sampling during live verification, wait for `S.time` to actually advance before sampling rather than trusting a fixed `setTimeout` delay — background-tab `requestAnimationFrame` throttling produced false "not animating" reads on a fixed-delay approach during the Bead Tentacle round's live verification.

---

### Task 1: Add glow + frequency-band coupling to `drawParticleMode` (code + tests)

**Files:**
- Modify: `elastic-morph.html:6191` (add `glowOn` local)
- Modify: `elastic-morph.html:6208-6302` (replace the full switch body)
- Test: `test.js` (append a new section before the final `/* ---------------- summary ---------------- */` block)

**Interfaces:**
- Consumes: `drawParticleMode`'s existing in-scope locals at the point of the switch — `pm` (`S.pmode`), `cx`/`cy`/`maxR`/`sc`, `energy`/`beat`/`hi`, `pmColor(pt, baseHue, l, alpha)`, plus globals `S.bands.{subBass,bass,lowMid,mid,highMid,air}`, `S.kickOnset`, `S.snareOnset`, `S.perfScale`, `S.exporting`, `S.loudness`, `S.stereo`, `S.time`. All confirmed already in scope or already globals by reading `elastic-morph.html:3030-3048` (band/onset computation) and `elastic-morph.html:6186-6306` (the function itself).
- Produces: the local `glowOn` (boolean) becomes available for the rest of `drawParticleMode`'s switch body — no other code outside this function consumes it.

- [ ] **Step 1: Re-confirm the function boundaries are unchanged**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
grep -n "@BUILD-INJECT-V58" elastic-morph.html
grep -n "function drawParticleMode" elastic-morph.html
```

Expected: marker well after 6306; `drawParticleMode` at (or near) line 6186. If line numbers differ from this plan, re-read the surrounding ~130 lines at the new location before editing — do not assume the plan's exact line numbers still apply.

- [ ] **Step 2: Add the `glowOn` local**

In `elastic-morph.html`, find:

```js
  const energy = 0.25 + S.loudness * 1.25, beat = S.beat, hi = S.highs;
```

Replace with:

```js
  const energy = 0.25 + S.loudness * 1.25, beat = S.beat, hi = S.highs;
  const glowOn = S.exporting || (S.perfScale || 1) > 0.5;
```

- [ ] **Step 3: Replace the full switch body**

In `elastic-morph.html`, find the entire switch (from `switch (pm.pattern) {` through its closing `}`, i.e. lines 6208-6302):

```js
    switch (pm.pattern) {
      case "hyperspace": {
        pt.pr = pt.r;
        pt.r += dt * (0.12 + energy * 0.85 + beat * 0.6) * pt.spd;
        if (pt.r >= 1) { pt.r = Math.random() * 0.04; pt.pr = pt.r; pt.a = Math.random() * Math.PI * 2; pt.hue = Math.random() * 360; }
        const x1 = cx + Math.cos(pt.a) * pt.pr * maxR, y1 = cy + Math.sin(pt.a) * pt.pr * maxR;
        const x2 = cx + Math.cos(pt.a) * pt.r * maxR, y2 = cy + Math.sin(pt.a) * pt.r * maxR;
        ctx.strokeStyle = pmColor(pt, baseHue, 55 + pt.r * 35, 0.15 + pt.r * 0.65);
        ctx.lineWidth = pt.sz * (0.4 + pt.r * 2) * sc;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        break;
      }
      case "starfall": {
        pt.y += dt * (50 + energy * 230) * pt.spd * sc;
        pt.x += dt * (S.stereo * 40 + 12) * sc;
        if (pt.y > H + 12) { pt.y = -12; pt.x = Math.random() * W; }
        if (pt.x > W + 12) pt.x = -12;
        const tail = (6 + energy * 34) * sc;
        ctx.strokeStyle = pmColor(pt, baseHue, 70, 0.2 + hi * 0.5);
        ctx.lineWidth = pt.sz * 0.9 * sc;
        ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x - tail * 0.25, pt.y - tail); ctx.stroke();
        break;
      }
      case "rain": {
        pt.y += dt * (260 + energy * 420) * pt.spd * sc;
        if (pt.y > H + 14) { pt.y = -14; pt.x = Math.random() * W; pt.hue = Math.random() * 360; }
        const tail = (14 + energy * 26) * sc;
        ctx.strokeStyle = pmColor(pt, baseHue, 60, 0.18 + hi * 0.4);
        ctx.lineWidth = pt.sz * 0.5 * sc;
        ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x, pt.y - tail); ctx.stroke();
        ctx.fillStyle = pmColor(pt, baseHue, 85, 0.5 + hi * 0.4);
        ctx.fillRect(pt.x - 0.6 * sc, pt.y, 1.4 * sc, 2.2 * sc);
        break;
      }
      case "vortex": {
        pt.a += dt * (0.5 + energy * 1.6) * pt.spd * (1.2 - pt.r * 0.4);
        pt.r -= dt * (0.04 + energy * 0.22);
        if (pt.r < 0.02) { pt.r = 0.55 + Math.random() * 0.45; pt.hue = Math.random() * 360; }
        const x = cx + Math.cos(pt.a) * pt.r * maxR, y = cy + Math.sin(pt.a) * pt.r * maxR * 0.82;
        const s = pt.sz * (0.6 + (1 - pt.r) * 1.6) * sc;
        ctx.fillStyle = pmColor(pt, baseHue, 60 + (1 - pt.r) * 25, 0.3 + hi * 0.4);
        ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "fountain": {
        if (pt.life <= 0) {
          pt.x = cx + (Math.random() - 0.5) * W * 0.06; pt.y = H - 8 * sc;
          pt.vx = (Math.random() - 0.5) * 160 * sc;
          pt.vy = -(220 + Math.random() * 220 + energy * 260) * sc;
          pt.life = 1; pt.hue = Math.random() * 360;
        }
        pt.vy += dt * 320 * sc;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        if (pt.y > H + 10) pt.life = 0;
        ctx.fillStyle = pmColor(pt, baseHue, 65, 0.35 + hi * 0.35);
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.sz * 1.3 * sc, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "fireworks": {
        if (pt.life > 0) {
          pt.vy += dt * 130 * sc; pt.vx *= 0.985; pt.vy *= 0.985;
          pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt * 0.7;
          const a = Math.max(0, pt.life);
          ctx.fillStyle = pmColor(pt, baseHue, 62, a * 0.95);
          ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.sz * (0.6 + a) * sc, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "nebula": {
        const ang = noise2(pt.x * 0.0022 + S.time * 0.05, pt.y * 0.0022 - S.time * 0.03) * Math.PI * 2;
        const v = dt * (24 + energy * 70) * sc;
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
        const ax = cx + Math.sin(S.time * 0.7) * W * 0.32 + S.stereo * W * 0.1;
        const ay = cy + Math.cos(S.time * 0.9) * H * 0.3;
        pt.vx += (ax - pt.x) * dt * 1.8; pt.vy += (ay - pt.y) * dt * 1.8;
        pt.vx += (Math.random() - 0.5) * 220 * dt * (0.4 + beat);
        pt.vy += (Math.random() - 0.5) * 220 * dt * (0.4 + beat);
        pt.vx *= 0.94; pt.vy *= 0.94;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        ctx.fillStyle = pmColor(pt, baseHue, 64, 0.3 + hi * 0.4);
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.sz * 1.1 * sc, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
```

Replace it with:

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

(The surrounding `ctx.save()`/`ctx.restore()` pair at `elastic-morph.html:6193`/`6304` already resets `shadowBlur` back to 0 afterward — no manual reset needed.)

- [ ] **Step 4: Write the tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert a new section immediately before it:

```js
/* ---------------- Particle Mode: Glow & Frequency-Band Coupling ---------------- */
section("Particle Mode — Glow & Frequency-Band Coupling");

ok("drawParticleMode defines glowOn as S.exporting || (S.perfScale || 1) > 0.5", (() => {
  const fn = extractFn("drawParticleMode");
  return !!fn && fn.includes("const glowOn = S.exporting || (S.perfScale || 1) > 0.5;");
})());

/* Helper: slice one case body out of drawParticleMode's switch. This function's case blocks
   close with 6-space-indented "}" (confirmed by direct inspection of elastic-morph.html —
   deeper nesting than drawLayerB's switch, which uses 4-space closes), so the search pattern
   here is "\n      }", not the "\n    }" used for drawLayerB's case slicing elsewhere in this
   file. */
function pmCaseBody(fn, id) {
  const startIdx = fn.indexOf(`case "${id}": {`);
  const endIdx = fn.indexOf("\n      }", startIdx);
  if (startIdx < 0 || endIdx < 0) return null;
  return fn.slice(startIdx, endIdx);
}

const PM_GLOW_PATTERNS = ["hyperspace", "starfall", "rain", "vortex", "fountain", "fireworks", "swarm"];

ok("all 7 non-Nebula patterns set ctx.shadowBlur gated by glowOn", (() => {
  const fn = extractFn("drawParticleMode");
  if (!fn) return false;
  return PM_GLOW_PATTERNS.every(id => {
    const body = pmCaseBody(fn, id);
    return !!body && body.includes("ctx.shadowBlur = glowOn ?");
  });
})());

ok("nebula does NOT get ctx.shadowBlur (already has an equivalent radial-gradient glow)", (() => {
  const fn = extractFn("drawParticleMode");
  if (!fn) return false;
  const body = pmCaseBody(fn, "nebula");
  return !!body && !body.includes("shadowBlur");
})());

const PM_BAND_SIGNALS = {
  hyperspace: ["S.bands.air"],
  starfall: ["S.bands.highMid", "S.bands.air"],
  rain: ["S.kickOnset"],
  vortex: ["S.bands.bass", "S.bands.lowMid"],
  fountain: ["S.bands.subBass", "S.kickOnset"],
  fireworks: ["S.snareOnset"],
  nebula: ["S.bands.mid"],
  swarm: ["S.bands.bass", "S.bands.mid"]
};

ok("each pattern's case body contains all of its assigned frequency-band/onset signals", (() => {
  const fn = extractFn("drawParticleMode");
  if (!fn) return false;
  return Object.entries(PM_BAND_SIGNALS).every(([id, signals]) => {
    const body = pmCaseBody(fn, id);
    return !!body && signals.every(sig => body.includes(sig));
  });
})());

ok("glowOn's boundary logic: exporting always true, perfScale>0.5 true, perfScale===0.5 false (strict >, matches the S.geo2 precedent)", (() => {
  const glowOn = (exporting, perfScale) => exporting || (perfScale || 1) > 0.5;
  return glowOn(true, 0.1) === true
    && glowOn(false, 0.51) === true
    && glowOn(false, 0.5) === false;
})());
```

- [ ] **Step 5: Run the tests**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
node test.js 2>&1 | tail -20
```

Expected: all 6 new assertions under "Particle Mode — Glow & Frequency-Band Coupling" print `✓`, and the final line reads `N passed, 0 failed` (N = previous total + 6, no failures).

- [ ] **Step 6: Run the full build+test pipeline**

```bash
npm run ci 2>&1 | tail -15
git diff --stat elastic-morph.html
```

Expected: `node build.js` completes without error, `node test.js` reports the same `N passed, 0 failed` as Step 5, and the diff stat reflects only this task's own hand-edits (the `glowOn` line and the switch-body replacement) — no changes past the `@BUILD-INJECT-V58` marker.

- [ ] **Step 7: Commit**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
git add elastic-morph.html test.js
git commit -m "feat(particle-mode): add glow + frequency-band coupling to 8 patterns

Round 1 of 3 planned Particle Mode upgrades. ShadowBlur glow on 7 of 8
patterns (Nebula excluded — already has an equivalent radial-gradient
glow), perf-gated via S.perfScale > 0.5 (matches the existing S.geo2
threshold convention). Each pattern also gets a per-pattern S.bands/
kickOnset/snareOnset coupling term on top of its existing pauschal
energy/beat/hi terms, replacing generic loudness reactivity with a
targeted frequency-band mapping that fits each pattern's character.

Per docs/superpowers/specs/2026-08-29-particle-mode-glow-bands-design.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Live verification and ship

**Files:** None modified — this task verifies Task 1's work in a real browser and ships it.

**Interfaces:**
- Consumes: `S.pmode.on`, `S.pmode.pattern`, `S.pmode.amount`, `S.perfScale`, `S.bands.*`, `S.kickOnset`, `S.snareOnset` (existing state fields), the `frame()` rAF loop (`elastic-morph.html:5140`, already running unconditionally — do not call `drawScene`/`drawParticleMode` directly, see Global Constraints).

- [ ] **Step 1: Start a dev server serving the current working tree**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
npx --yes serve -l 8936 "$(pwd)" > /tmp/serve-pm-glow.log 2>&1 &
sleep 3
curl -sL -o /tmp/pm-glow-check.html http://localhost:8936/elastic-morph.html
wc -c /tmp/pm-glow-check.html elastic-morph.html
```

Expected: both byte counts match exactly. If they don't, the server is stale — kill it (`pkill -f "serve -l 8936"`) and retry; do not proceed against stale content.

- [ ] **Step 2: Open the Browser pane and navigate to the served app**

Navigate to `http://localhost:8936/elastic-morph.html`.

- [ ] **Step 3: Helper — wait for S.time to actually advance before sampling**

Use this pattern for every subsequent wait in this task (avoids the false "not animating" reads a fixed `setTimeout` produced during the Bead Tentacle round's live verification, caused by background-tab rAF throttling):

```js
async function waitForTimeAdvance(minDelta = 0.05, timeoutMs = 3000) {
  const t0 = S.time;
  const start = Date.now();
  while (S.time - t0 < minDelta) {
    if (Date.now() - start > timeoutMs) return false;
    await new Promise(r => setTimeout(r, 50));
  }
  return true;
}
function sampleCanvas() {
  const c = document.getElementById('canvas');
  const ctx2 = c.getContext('2d');
  const img = ctx2.getImageData(0, 0, c.width, c.height).data;
  let sum = 0, n = 0;
  for (let i = 0; i < img.length; i += 4) { sum += 0.299*img[i] + 0.587*img[i+1] + 0.114*img[i+2]; n++; }
  return sum / n;
}
```

- [ ] **Step 4: Enable Particle Mode and confirm each of the 8 patterns renders/animates**

Run via the browser's JS execution tool, once per pattern id (`hyperspace`, `starfall`, `rain`, `vortex`, `fountain`, `fireworks`, `nebula`, `swarm`):

```js
S.pmode.on = true;
S.pmode.pattern = "hyperspace";   // repeat for each of the 8 ids
await waitForTimeAdvance();
const s1 = sampleCanvas();
await waitForTimeAdvance();
const s2 = sampleCanvas();
({ pattern: S.pmode.pattern, s1, s2, animating: s1 !== s2, frameErrLogged: S._frameErrLogged })
```

Expected for each pattern: `animating: true`, `frameErrLogged` falsy. If `frameErrLogged` is ever truthy, reload the page fresh before continuing — a stuck render loop makes every subsequent sample meaningless.

- [ ] **Step 5: Confirm the perf gate doesn't crash or hang at max particle count**

```js
S.pmode.amount = 1;   // 610 particles
S.pmode.pattern = "swarm";
S.perfScale = 0.4;    // below the 0.5 glow threshold
await waitForTimeAdvance();
const lowPerf = sampleCanvas();
await waitForTimeAdvance();
const lowPerf2 = sampleCanvas();
S.perfScale = 1;
({ lowPerf, lowPerf2, animating: lowPerf !== lowPerf2, frameErrLogged: S._frameErrLogged })
```

Expected: `animating: true`, `frameErrLogged` falsy — confirms the app stays responsive and correctly renders at `amount = 1` even with the glow forced off.

- [ ] **Step 6: Confirm each pattern's new band coupling has a visible effect**

For each pattern, force its assigned signal to 0 then 1 and compare samples. Example for `hyperspace` (`S.bands.air`):

```js
S.pmode.pattern = "hyperspace";
S.bands.air = 0;
await waitForTimeAdvance(0.3);   // let the effect of the changed speed accumulate visibly
const bandOff = sampleCanvas();
S.bands.air = 1;
await waitForTimeAdvance(0.3);
const bandOn = sampleCanvas();
S.bands.air = 0;   // restore
({ bandOff, bandOn, differs: bandOff !== bandOn })
```

Expected: `differs: true`. Repeat for the other 7 patterns using their assigned signal(s) from the Global Constraints table (for patterns with two signals, e.g. `vortex`, test at least one of the two — both are wired the same way, testing one is sufficient evidence the wiring works). For `rain` and `fountain`/`fireworks`, use `S.kickOnset`/`S.snareOnset` in place of `S.bands.*`.

- [ ] **Step 7: Check console for new errors**

Use the Browser pane's console-reading tool. Expected: no new errors attributable to this change (pre-existing unrelated warnings, e.g. the `willReadFrequently` Canvas2D hint, are fine).

- [ ] **Step 8: Stop the dev server**

```bash
pkill -f "serve -l 8936" 2>/dev/null; true
```

- [ ] **Step 9: Push and hash-confirm live**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
git push origin main
```

Use `dangerouslyDisableSandbox: true` on this command — `git push` hangs indefinitely under the default sandbox on this machine (known issue, see memory `feedback_git_sandbox_network.md`).

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

- [ ] **Step 10: Update the shared progress ledger**

Append to `.superpowers/sdd/progress.md`:

```
=== Plan: 2026-08-29-particle-mode-glow-bands.md ===
Task 1: complete (commit <hash>, tests <N passed>/0 failed)
Task 2: complete — live-verified (all 8 patterns render + animate, perf gate confirmed stable at amount=1/perfScale=0.4, each pattern's band coupling confirmed via 0-vs-1 pixel delta, 0 new console errors). Pushed <hash>, hash-confirmed live.
particle-mode-glow-bands: FULLY SHIPPED. Round 1 of 3 Particle Mode upgrades (glow + band coupling). Round 2 (Mirror + Constellation) next.
```

Fill in the actual commit hashes and test counts from Steps 7 (Task 1) and this task's push.

---

## Post-plan note for whoever runs this

This is a small, single-round, single-file-touching feature — no final whole-branch review is mandated by this plan. If Task 2's live verification surfaces anything unexpected (visual glitch, console error, a band coupling with no visible effect), treat it as a normal bug: fix directly, re-verify, re-push, following this session's established practice of fixing Critical/Important issues without re-asking Frank unless it's a genuine design tradeoff.

Round 2 (Kaleidoskop-Mirror + Constellation-Verbindungslinien for Particle Mode) and Round 3 (new patterns) are separate, not-yet-brainstormed follow-ups — do not start on them without Frank raising it.
