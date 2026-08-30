# Particle Mode New Patterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Round 3 of 3 Particle Mode upgrades — add 3 new patterns (Bokeh, Magnetic Field, Pulse Burst) to `PM_PATTERNS`, closing the full 3-round Particle Mode upgrade plan, per the approved design spec.

**Architecture:** `PM_PATTERNS`'s 3 new entries and a new `pmBurstR` module-scope variable land pre-marker in `elastic-morph.html` (safe — plain `let` declarations aren't subject to the build-pipeline reassignment trap). All drawing logic (an updated `PM_CONST_PATTERNS`, a new per-frame setup block, and 3 new switch cases) lands in `src/inject-v85.js`, the file that actually executes at runtime. No UI wiring needed — the existing pattern dropdown is populated purely from `PM_PATTERNS` by array iteration.

**Tech Stack:** Vanilla JS, Canvas 2D (`ctx`). Zero-dependency test harness (`test.js`, `node test.js`).

## Global Constraints

- **CRITICAL — read before touching any code:** `drawParticleMode`/`initPM`/`pmColor` are declared `function NAME(...) {...}` pre-marker in `elastic-morph.html`, but `src/inject-v85.js` **reassigns** all three post-marker (`NAME = function (...) {...};`), regenerated into `elastic-morph.html` by `build.js` on every build. The post-marker assignment always wins at runtime. Every drawing-logic edit in this plan goes into `src/inject-v85.js` only — never `elastic-morph.html`'s pre-marker `drawParticleMode`.
- **Exception, established during this round's spec-writing:** plain `let`/`const` top-level variable declarations (e.g. `let pmParticles = [], pmFireTimer = 0;`) are NOT subject to that trap — they execute once and are shared by reference across both pre- and post-marker code (which run in the same global scope). Only function-*identity* reassignment (`name = function(){}`) creates the dead-code shadowing. This is why `pmBurstR`'s declaration is safe to add pre-marker in `elastic-morph.html`, even though every place that *uses* `pmBurstR` (the setup block and the `pulseBurst` case) must go in `src/inject-v85.js`.
- All test assertions against `drawParticleMode`'s real logic must use `extractFn("drawParticleMode", injectSrc("inject-v85.js"))` — never `extractFn("drawParticleMode")` alone, which finds the dead pre-marker copy first.
- Naming: the new patterns are `bokeh`/"Bokeh", `magnetic`/"Magnetic Field" (NOT "attractor" — collides with the existing DNA preset `id: "attractor"`, "DNA Attractor"), `pulseBurst`/"Pulse Burst" (NOT "pulse" — collides in spirit with Layer B's existing "Pulse Rings").
- `PM_CONST_PATTERNS` becomes exactly `nebula`/`swarm`/`vortex`/`fountain`/`magnetic` — Bokeh and Pulse Burst are explicitly NOT constellation-eligible.
- Bokeh does NOT get `ctx.shadowBlur` (matches Nebula's existing exemption — it already achieves its glow via a radial gradient). Magnetic Field and Pulse Burst both DO get the standard `ctx.shadowBlur = glowOn ? ... : 0;` treatment.
- All 3 new patterns must wrap every draw call in `for (const mp of mPasses) { ... }` (mirror-ready, matching every existing pattern since Round 2).
- Pulse Burst's `pt.a` is never mutated — each particle sits at a fixed angle; only its radial distance (driven by the shared `pmBurstR`) changes. This is what makes it read as one coherent breathing object rather than independent explosions.
- No new per-particle fields, no `initPM()` changes, no new `S.pmode` state, no new UI controls — all 3 patterns reuse the existing shared particle-pool shape and become reachable automatically via the existing `#pmPattern` dropdown (populated purely from `PM_PATTERNS` by `.forEach()`, confirmed during spec-writing to have no hardcoded count/index anywhere else in the codebase).
- Never call `drawScene()` or `drawParticleMode()` manually during live verification — a malformed manual call can throw and silently freeze the render loop forever via the sticky `S._frameErrLogged` guard. Only ever set state and let the existing `frame()` rAF loop redraw.
- After deploying, the FIRST live-verification step must be reading back `drawParticleMode.toString()` in the browser and confirming it contains `magAttractors`/`pmBurstR`/`"bokeh"`/`"magnetic"`/`"pulseBurst"` — on both the local dev server AND the live deployed site — before any pixel-sampling.

---

### Task 1: New patterns in `src/inject-v85.js` + `PM_PATTERNS`/`pmBurstR` in `elastic-morph.html`

**Files:**
- Modify: `elastic-morph.html` (`PM_PATTERNS` array + `pmBurstR` declaration, both pre-marker, one location)
- Modify: `src/inject-v85.js` (`PM_CONST_PATTERNS`, per-frame setup block, 3 new switch cases)
- Test: `test.js` (append a new section before the final `/* ---------------- summary ---------------- */` block)

**Interfaces:**
- Consumes: `drawParticleMode`'s existing in-scope locals (`pm`, `cx`/`cy`/`maxR`/`sc`, `beat`/`hi`, `glowOn`, `mPasses`, `pmConstOn`, `pmConstPts`, `pmColor`, `pmMirrorXY`), plus the existing `pmBurstR` module variable (declared in this task's `elastic-morph.html` edit, used in this task's `src/inject-v85.js` edit — both parts of this one task, so there's no cross-task ordering concern the way Round 2 had between its Task 1 and Task 2).
- Produces: 3 new reachable `S.pmode.pattern` values (`"bokeh"`, `"magnetic"`, `"pulseBurst"`) and a `magAttractors` local (scoped to one `drawParticleMode` call, not exported).

- [ ] **Step 1: Re-confirm all target locations are unchanged**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
grep -n "@BUILD-INJECT-V58\|const PM_PATTERNS\|let pmParticles" elastic-morph.html
grep -n "PM_CONST_PATTERNS\|drawParticleMode = function\|case \"swarm\"" src/inject-v85.js
```

Expected: marker well after 6163; `PM_PATTERNS`/`pmParticles` at (approximately) lines 6153/6163; `PM_CONST_PATTERNS`/`drawParticleMode = function`/`case "swarm"` at (approximately) lines 59/91/279 in `src/inject-v85.js`. If different, re-read the surrounding ~15 lines at each new location before editing.

- [ ] **Step 2: Add the 3 new `PM_PATTERNS` entries and `pmBurstR` in `elastic-morph.html`**

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

- [ ] **Step 3: Update `PM_CONST_PATTERNS` in `src/inject-v85.js`**

Find:

```js
const PM_CONST_PATTERNS = new Set(["nebula", "swarm", "vortex", "fountain"]);
```

Replace with:

```js
const PM_CONST_PATTERNS = new Set(["nebula", "swarm", "vortex", "fountain", "magnetic"]);
```

- [ ] **Step 4: Add the per-frame setup block in `src/inject-v85.js`**

Find:

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

- [ ] **Step 5: Add the 3 new switch cases in `src/inject-v85.js`**

Find:

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

- [ ] **Step 6: Write the tests**

Open `test.js`. Find the final block (`/* ---------------- summary ---------------- */`). Insert a new section immediately before it. This reuses the `pmCaseBody2` helper already defined earlier in the file (Round 2's section) rather than redefining a third identical copy — `pmCaseBody2` is a plain top-level function declaration, visible anywhere later in the same file:

```js
/* ---------------- Particle Mode: New Patterns (Bokeh, Magnetic Field, Pulse Burst) ---------------- */
section("Particle Mode — New Patterns (Bokeh, Magnetic Field, Pulse Burst)");

const pmSrc3 = injectSrc("inject-v85.js");

ok("drawParticleMode is still genuinely reassigned post-marker in src/inject-v85.js (same sanity check as Rounds 1-2)", (() => {
  return pmSrc3.includes("drawParticleMode = function (") && !pmSrc3.includes("function drawParticleMode(");
})());

ok("PM_PATTERNS gained exactly 3 new entries at the end: bokeh, magnetic, pulseBurst", (() => {
  const m = script.match(/const PM_PATTERNS = \[([\s\S]*?)\];/);
  if (!m) return false;
  const body = m[1];
  const entries = body.match(/\[".*?",\s*".*?"\]/g) || [];
  return entries.length === 11
    && entries[8].includes('"bokeh"') && entries[8].includes('"Bokeh"')
    && entries[9].includes('"magnetic"') && entries[9].includes('"Magnetic Field"')
    && entries[10].includes('"pulseBurst"') && entries[10].includes('"Pulse Burst"');
})());

ok("pmBurstR module state declared alongside pmParticles/pmFireTimer, initialized to 0.3", (() => {
  return script.includes("let pmParticles = [], pmFireTimer = 0, pmBurstR = 0.3;");
})());

ok("PM_CONST_PATTERNS is exactly nebula/swarm/vortex/fountain/magnetic (5 entries) — bokeh and pulseBurst are NOT constellation-eligible", (() => {
  const m = pmSrc3.match(/const PM_CONST_PATTERNS = new Set\(\[([^\]]*)\]\);/);
  if (!m) return false;
  const body = m[1];
  return body.includes('"nebula"') && body.includes('"swarm"') && body.includes('"vortex"') && body.includes('"fountain"') && body.includes('"magnetic"')
    && !body.includes('"bokeh"') && !body.includes('"pulseBurst"');
})());

ok("magAttractors/pmBurstR per-frame setup block exists before the particle loop (runs once per frame, not once per particle)", (() => {
  const fn = extractFn("drawParticleMode", pmSrc3);
  if (!fn) return false;
  const loopIdx = fn.indexOf("for (let pi = 0; pi < visN; pi++)");
  const magSetupIdx = fn.indexOf('pm.pattern === "magnetic"');
  const burstSetupIdx = fn.indexOf('pm.pattern === "pulseBurst"');
  return loopIdx >= 0 && magSetupIdx >= 0 && magSetupIdx < loopIdx
    && burstSetupIdx >= 0 && burstSetupIdx < loopIdx;
})());

const PM_NEW_PATTERNS = ["bokeh", "magnetic", "pulseBurst"];

ok("all 3 new patterns' case bodies contain at least one mirror-pass draw loop", (() => {
  const fn = extractFn("drawParticleMode", pmSrc3);
  if (!fn) return false;
  return PM_NEW_PATTERNS.every(id => {
    const body = pmCaseBody2(fn, id);
    return !!body && body.includes("for (const mp of mPasses)");
  });
})());

ok("bokeh does NOT get ctx.shadowBlur (matches Nebula's exemption); magnetic and pulseBurst DO", (() => {
  const fn = extractFn("drawParticleMode", pmSrc3);
  if (!fn) return false;
  const bokehBody = pmCaseBody2(fn, "bokeh");
  const magBody = pmCaseBody2(fn, "magnetic");
  const burstBody = pmCaseBody2(fn, "pulseBurst");
  return !!bokehBody && !bokehBody.includes("shadowBlur")
    && !!magBody && magBody.includes("ctx.shadowBlur = glowOn ?")
    && !!burstBody && burstBody.includes("ctx.shadowBlur = glowOn ?");
})());

ok("only magnetic pushes to pmConstPts among the 3 new patterns; bokeh and pulseBurst do not", (() => {
  const fn = extractFn("drawParticleMode", pmSrc3);
  if (!fn) return false;
  const magBody = pmCaseBody2(fn, "magnetic");
  const bokehBody = pmCaseBody2(fn, "bokeh");
  const burstBody = pmCaseBody2(fn, "pulseBurst");
  return !!magBody && magBody.includes("pmConstPts.push(")
    && !!bokehBody && !bokehBody.includes("pmConstPts.push(")
    && !!burstBody && !burstBody.includes("pmConstPts.push(");
})());

ok("pulseBurst never mutates pt.a (fixed angle — reads as one coherent breathing sphere, not independent trajectories)", (() => {
  const fn = extractFn("drawParticleMode", pmSrc3);
  if (!fn) return false;
  const body = pmCaseBody2(fn, "pulseBurst");
  return !!body && !body.includes("pt.a +=") && !body.includes("pt.a -=") && !body.includes("pt.a =");
})());

ok("the pre-marker (dead) drawParticleMode in elastic-morph.html contains none of the 3 new patterns' drawing logic", (() => {
  const fn = extractFn("drawParticleMode");   // default src = script -> finds the pre-marker copy
  return !!fn && !fn.includes('"bokeh"') && !fn.includes('"magnetic"') && !fn.includes('"pulseBurst"')
    && !fn.includes("magAttractors") && !fn.includes("pmBurstR +=");
})());
```

- [ ] **Step 7: Run the tests**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
node test.js 2>&1 | tail -25
```

Expected: all 10 new assertions under "Particle Mode — New Patterns (Bokeh, Magnetic Field, Pulse Burst)" print `✓`, final line reads `N passed, 0 failed` (N = 570 + 10 = 580 — count the `ok(...)` calls in Step 6 yourself rather than trusting this number blindly, since it's easy to miscount by hand).

- [ ] **Step 8: Run the full build+test pipeline and check for drift**

```bash
npm run ci 2>&1 | tail -15
git diff --stat elastic-morph.html src/inject-v85.js test.js
```

Expected: `node build.js` completes without error, `node test.js` reports the same pass count as Step 7. `git diff --stat` should show changes to all three files — `elastic-morph.html`'s diff includes both your own hand-edit (Step 2) AND the post-marker region regenerated from your `src/inject-v85.js` edit (expected this time, same as Round 2's Task 1). Confirm with `grep -n '"magnetic"\|"pulseBurst"\|magAttractors' elastic-morph.html` that the post-marker region now contains the new code.

- [ ] **Step 9: Commit**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
git add elastic-morph.html src/inject-v85.js test.js
git commit -m "feat(particle-mode): add Bokeh, Magnetic Field, Pulse Burst patterns

Round 3 of 3 planned Particle Mode upgrades, closing the full 3-round
upgrade plan. 3 new patterns reusing the existing shared particle-pool
shape (no new fields, no new S.pmode state, no new UI wiring — reachable
automatically via the existing pattern dropdown):

- Bokeh: slow personal Lissajous-style drift (deliberately not curl-noise,
  to stay distinct from Nebula), soft radial-gradient body instead of
  ShadowBlur (matches Nebula's own exemption), breathes with
  S.bands.subBass. Not constellation-eligible (independently-drifting,
  not a coherent group).
- Magnetic Field: 4 attractors computed once per frame, particles
  deterministically clustered via index % 4, generalizing Swarm's
  single-attractor technique. Constellation-eligible. Named to avoid a
  collision with the existing DNA Attractor preset.
- Pulse Burst: the whole field breathes together via a new persistent
  pmBurstR (smoothed toward a beat/kickOnset-driven target), each
  particle at a FIXED angle so only radial distance changes — reads as
  one coherent object, not independent explosions like Fireworks. Named
  to avoid a collision with Layer B's Pulse Rings.

pmBurstR's declaration is a plain pre-marker let (safe — not subject to
the drawParticleMode reassignment trap); the drawing logic that uses it
went into src/inject-v85.js, the file that actually executes.

Per docs/superpowers/specs/2026-08-29-particle-mode-new-patterns-design.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Live verification and ship

**Files:** None modified — this task verifies Task 1's work in a real browser and ships it.

**Interfaces:**
- Consumes: `S.pmode.on`, `S.pmode.pattern`, `S.pmode.mirror`, `S.pmode.constellation`, `S.bands.*`, `S.beat`, `S.kickOnset` (existing state fields), the `frame()` rAF loop (already running unconditionally — do not call `drawScene`/`drawParticleMode` directly).

- [ ] **Step 1: Start a dev server serving the current working tree**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
npx --yes serve -l 8939 "$(pwd)" > /tmp/serve-pm-newpatterns.log 2>&1 &
sleep 3
curl -sL -o /tmp/pm-newpatterns-check.html http://localhost:8939/elastic-morph.html
wc -c /tmp/pm-newpatterns-check.html elastic-morph.html
```

Expected: both byte counts match exactly. If they don't, the server is stale — kill it (`pkill -f "serve -l 8939"`) and retry.

- [ ] **Step 2: Open the Browser pane and navigate to the served app**

Navigate to `http://localhost:8939/elastic-morph.html`.

- [ ] **Step 3: CRITICAL FIRST CHECK — confirm the live function actually contains the new code**

Before any pixel-sampling, run via the browser's JS execution tool:

```js
const src = drawParticleMode.toString();
({
  hasMagAttractors: src.includes("magAttractors"),
  hasPmBurstR: src.includes("pmBurstR"),
  hasBokeh: src.includes('"bokeh"'),
  hasMagnetic: src.includes('"magnetic"'),
  hasPulseBurst: src.includes('"pulseBurst"'),
  firstLine: src.split("\n")[0]
})
```

Expected: all five `has*` fields `true`. If any is `false`, STOP — do not proceed to live-verify a stale/wrong function; re-check the dev server is serving the current file (Step 1), and that Task 1 actually committed correctly.

- [ ] **Step 4: Confirm each of the 3 new patterns renders and animates**

For each of `"bokeh"`, `"magnetic"`, `"pulseBurst"`:

```js
S.pmode.on = true;
S.pmode.pattern = "bokeh";   // repeat for magnetic, pulseBurst
S.pmode.mirror = "off";
await new Promise(r => setTimeout(r, 700));
function sampleCanvas() {
  const c = document.getElementById('canvas');
  const ctx2 = c.getContext('2d');
  const img = ctx2.getImageData(0, 0, c.width, c.height).data;
  let sum = 0, n = 0;
  for (let i = 0; i < img.length; i += 4) { sum += 0.299*img[i] + 0.587*img[i+1] + 0.114*img[i+2]; n++; }
  return sum / n;
}
const s1 = sampleCanvas();
await new Promise(r => setTimeout(r, 700));
const s2 = sampleCanvas();
({ pattern: S.pmode.pattern, s1, s2, animating: s1 !== s2, frameErrLogged: S._frameErrLogged })
```

Expected for each: `animating: true`, `frameErrLogged` falsy. If `frameErrLogged` is ever truthy, reload the page fresh before continuing.

- [ ] **Step 5: Confirm Bokeh's visual character (large soft circles, subBass-reactive)**

```js
S.pmode.pattern = "bokeh";
S.bands.subBass = 0;
await new Promise(r => setTimeout(r, 400));
function sampleCanvas() {
  const c = document.getElementById('canvas');
  const ctx2 = c.getContext('2d');
  const img = ctx2.getImageData(0, 0, c.width, c.height).data;
  let sum = 0, n = 0;
  for (let i = 0; i < img.length; i += 4) { sum += 0.299*img[i] + 0.587*img[i+1] + 0.114*img[i+2]; n++; }
  return sum / n;
}
const off = sampleCanvas();
S.bands.subBass = 1;
await new Promise(r => setTimeout(r, 400));
const on = sampleCanvas();
S.bands.subBass = 0;
({ off, on, differs: off !== on })
```

Take a screenshot too and visually confirm large, soft, blurred circles (not sharp dots). Expected: `differs: true`.

- [ ] **Step 6: Confirm Magnetic Field's 4 clusters and Constellation**

```js
S.pmode.pattern = "magnetic";
S.pmode.constellation = false;
await new Promise(r => setTimeout(r, 800));
```

Take a screenshot, visually confirm 4 visually distinct particle clusters. Then:

```js
function sampleCanvas() {
  const c = document.getElementById('canvas');
  const ctx2 = c.getContext('2d');
  const img = ctx2.getImageData(0, 0, c.width, c.height).data;
  let sum = 0, n = 0;
  for (let i = 0; i < img.length; i += 4) { sum += 0.299*img[i] + 0.587*img[i+1] + 0.114*img[i+2]; n++; }
  return sum / n;
}
const constOff = sampleCanvas();
S.pmode.constellation = true;
await new Promise(r => setTimeout(r, 500));
const constOn = sampleCanvas();
({ constOff, constOn, differs: constOff !== constOn })
```

Expected: `differs: true` (Constellation lines add visible content). Also confirm `S.bands.lowMid` forced 0→1 changes rendering (same pixel-sample pattern as Step 5).

- [ ] **Step 7: Confirm Pulse Burst's synchronized breathing**

```js
S.pmode.pattern = "pulseBurst";
S.pmode.constellation = false;
S.beat = 0; S.kickOnset = 0;
await new Promise(r => setTimeout(r, 600));
const r1 = pmBurstR;
S.beat = 1; S.kickOnset = 1;
await new Promise(r => setTimeout(r, 600));
const r2 = pmBurstR;
S.beat = 0; S.kickOnset = 0;
({ r1, r2, differs: r1 !== r2 })
```

Expected: `differs: true`, and `r2 > r1` (the burst radius should grow toward the higher beat/kick target). Take two screenshots (low-beat vs high-beat state) and visually confirm the whole particle field is visibly larger/more expanded in the second.

- [ ] **Step 8: Confirm Mirror works on all 3 new patterns**

For each of the 3 patterns, set `S.pmode.mirror = "quad"`, wait, and screenshot — confirm a visibly 4-way-symmetric result for each (not just the two already-tested Round 2 patterns).

- [ ] **Step 9: Confirm the dropdown reaches all 3 new options with no extra wiring**

```js
const opts = Array.from(document.getElementById("pmPattern").options).map(o => o.value);
({ hasBokeh: opts.includes("bokeh"), hasMagnetic: opts.includes("magnetic"), hasPulseBurst: opts.includes("pulseBurst"), total: opts.length })
```

Expected: all three `true`, `total: 11`.

- [ ] **Step 10: Check console for new errors**

Use the Browser pane's console-reading tool. Expected: no new errors attributable to this change.

- [ ] **Step 11: Stop the dev server**

```bash
pkill -f "serve -l 8939" 2>/dev/null; true
```

- [ ] **Step 12: Push and hash-confirm live**

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

- [ ] **Step 13: Re-confirm on the LIVE site too**

Navigate the Browser pane to `https://elasticmorph.app/elastic-morph.html` and repeat Step 3's `drawParticleMode.toString()` check there — the definitive proof of what Vercel's build actually shipped, not just your working tree.

- [ ] **Step 14: Update the shared progress ledger**

Append to `.superpowers/sdd/progress.md`:

```
=== Plan: 2026-08-29-particle-mode-new-patterns.md ===
Task 1: complete (commit <hash>, tests <N>/0 failed)
Task 2: complete — live-verified. drawParticleMode.toString() confirmed containing magAttractors/pmBurstR/all 3 new pattern ids on BOTH local dev server AND live deployed site before any pixel-sampling. All 3 new patterns confirmed rendering/animating. Bokeh's subBass reactivity, Magnetic Field's 4-cluster look + constellation + lowMid reactivity, and Pulse Burst's beat/kickOnset-synced breathing (pmBurstR itself read back and confirmed changing) all confirmed. Mirror confirmed working on all 3 new patterns. Dropdown confirmed reaching all 11 patterns with zero extra wiring. 0 new console errors. Pushed <hash>, hash-confirmed live.
particle-mode-new-patterns: FULLY SHIPPED. Round 3 of 3 — closes the full Particle Mode upgrade plan (glow+bands, mirror+constellation, new patterns all shipped).
```

Fill in the actual commit hash and test count.

---

## Post-plan note for whoever runs this

The Global Constraints section's warning about `src/inject-v85.js` vs. the dead pre-marker copy is not decorative — it is the exact mistake that broke Round 1 of this same feature earlier the same day (commit 390a6dc fixed it). If Task 2's live verification surfaces anything unexpected, treat it as a normal bug: fix directly, re-verify, re-push, following this session's established practice of fixing Critical/Important issues without re-asking Frank unless it's a genuine design tradeoff.

This closes the full 3-round Particle Mode upgrade plan Frank approved at the very start (see `project_morph_particle_mode_upgrade.md`). No further Particle Mode work is queued after this — don't start anything new here without Frank raising it.
