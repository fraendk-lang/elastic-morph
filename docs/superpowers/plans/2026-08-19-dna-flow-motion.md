# DNA Flow-Motion (Curl Noise) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flow-motion particle mode's noise-to-angle direction mapping with true curl noise (a divergence-free flow field), so `motion:"flow"` presets move more smoothly/organically instead of wellig-geometrisch.

**Architecture:** Two new functions (`flowNoise`, `curlFlow`) added next to `noise2`, used only inside `drawParticleMode`'s flow branch. `noise2` itself and its 27 other call sites are untouched.

**Tech Stack:** Vanilla JS, Canvas 2D. Zero-dependency test harness (`test.js`, via `node test.js`). All target code is in the static (pre-`@BUILD-INJECT-V58`-marker) region of `elastic-morph.html`.

## Global Constraints

- `node test.js` must stay at 100% pass.
- Do not modify `noise2` (`elastic-morph.html:2913`) — it has 27 other call sites outside the flow-motion branch (camera drift, boids, hexgrid, spectrum bars, etc.) and must render identically to before.
- `motion:"orbit"` presets (the `else` branch of `drawParticleMode`'s particle loop) must be byte-identical to before — this plan touches only the `if (flowMode)` branch.
- Preserve the existing speed/audio-reactivity envelope (`v = dt * speed * 0.55 * (0.4 + S.loudness + S.beat * 0.4) * (0.5 + pt.sp)`) and the `flowBias`/edge-wrap logic exactly — only the direction computation changes.

---

### Task 1: `flowNoise`/`curlFlow` helpers + flow-branch integration

**Files:**
- Modify: `elastic-morph.html:2909-2917` (add `flowNoise`/`curlFlow` next to `noise2`)
- Modify: `elastic-morph.html:4505-4508` (flow branch inside `drawParticleMode`)
- Test: `test.js`

**Interfaces:**
- Produces: `function flowNoise(x, y)` — returns a scalar (5-term sine-sum pseudo-noise).
- Produces: `function curlFlow(x, y)` — returns `{ x: number, y: number }`, a divergence-free unit-ish direction vector derived from `flowNoise`'s finite-difference gradient, rotated 90°.
- Consumes: nothing new — `curlFlow`'s output replaces the `Math.cos(ang)`/`Math.sin(ang)` pair already used at the call site, same shape (two numbers to scale by `v`).

- [ ] **Step 1: Add the failing test assertions**

Open `test.js`, find the end of the file (search for `control exists: `):

```js
  ok("control exists: " + id, html.includes('id="' + id + '"')));

/* ---------------- summary ---------------- */
```

Insert a new section immediately after that line and before `/* ---------------- summary ---------------- */`:

```js

/* ---------------- DNA flow motion (curl noise) ---------------- */
section("DNA flow motion (curl noise)");
ok("function flowNoise defined", script.includes("function flowNoise("));
ok("function curlFlow defined", script.includes("function curlFlow("));
try {
  const { flowNoise, curlFlow } = loadFns(["flowNoise", "curlFlow"]);
  const testPoints = [[0, 0], [1.3, -0.7], [5, 5], [-2.2, 3.1]];
  const allFinite = testPoints.every(([x, y]) => {
    const v = curlFlow(x, y);
    return v && Number.isFinite(v.x) && Number.isFinite(v.y);
  });
  ok("curlFlow returns finite {x,y} for sample points", allFinite);
  const v1 = curlFlow(0, 0), v2 = curlFlow(0.06, 0);
  ok("curlFlow varies across nearby points (not a constant field)",
    Math.abs(v1.x - v2.x) > 1e-6 || Math.abs(v1.y - v2.y) > 1e-6);
  ok("flowNoise is a plain number", typeof flowNoise(1, 1) === "number");
} catch (e) {
  ok("curlFlow returns finite {x,y} for sample points", false, e.message);
  ok("curlFlow varies across nearby points (not a constant field)", false);
  ok("flowNoise is a plain number", false);
}
ok("flow branch uses curlFlow instead of noise2-as-angle", (() => {
  const fn = extractFn("drawParticleMode");
  return fn && fn.includes("curlFlow(pt.fx") && !fn.includes("noise2(pt.fx * 1.8 + seed * 0.07, pt.fy * 1.8 + S.time * 0.15) * Math.PI * 2");
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all 5 new checks in the "DNA flow motion (curl noise)" section print `✗`.

- [ ] **Step 3: Add `flowNoise` and `curlFlow`**

In `elastic-morph.html`, find (around line 2909):

```js
/* ============================================================
   VISUAL ENGINE
   ============================================================ */
function noise2(x, y) {
  return (
    Math.sin(x * 1.7 + y * 0.8) * 0.5 +
    Math.sin(x * 0.6 - y * 1.9 + 1.3) * 0.3 +
    Math.sin(x * 2.9 + y * 2.3 + 4.1) * 0.2
```

Replace the header comment block (leave `function noise2` and its body untouched below it) with:

```js
/* ============================================================
   VISUAL ENGINE
   ============================================================ */
// v-dna-flow: richer noise + true curl (divergence-free flow field), used only by
// drawParticleMode's flow-motion branch — kept separate from noise2 (27 other call sites).
function flowNoise(x, y) {
  return (
    Math.sin(x * 1.7 + y * 0.8) * 0.5 +
    Math.sin(x * 0.6 - y * 1.9 + 1.3) * 0.3 +
    Math.sin(x * 2.9 + y * 2.3 + 4.1) * 0.2 +
    Math.sin(x * 5.1 - y * 3.7 + 2.6) * 0.12 +
    Math.sin(x * 1.1 + y * 4.4 - 1.8) * 0.15
  );
}
function curlFlow(x, y) {
  const e = 0.06;
  const dy = (flowNoise(x, y + e) - flowNoise(x, y - e)) / (2 * e);
  const dx = (flowNoise(x + e, y) - flowNoise(x - e, y)) / (2 * e);
  return { x: dy, y: -dx };   // gradient rotated 90° → divergence-free curl field
}
function noise2(x, y) {
  return (
    Math.sin(x * 1.7 + y * 0.8) * 0.5 +
    Math.sin(x * 0.6 - y * 1.9 + 1.3) * 0.3 +
    Math.sin(x * 2.9 + y * 2.3 + 4.1) * 0.2
```

- [ ] **Step 4: Use `curlFlow` in the flow-motion branch**

Find (around line 4505):

```js
      // particles drift along a noise field that breathes with the music
      if (!S.frozen) {
        const ang = noise2(pt.fx * 1.8 + seed * 0.07, pt.fy * 1.8 + S.time * 0.15) * Math.PI * 2;
        const v = dt * speed * 0.55 * (0.4 + S.loudness + S.beat * 0.4) * (0.5 + pt.sp);
        pt.fx += Math.cos(ang) * v;
        pt.fy += Math.sin(ang) * v + (P.flowBias || 0) * dt * (0.4 + S.bass * 0.8);
```

Replace with:

```js
      // particles drift along a curl-noise flow field that breathes with the music
      if (!S.frozen) {
        const cf = curlFlow(pt.fx * 1.8 + seed * 0.07, pt.fy * 1.8 + S.time * 0.15);
        const v = dt * speed * 0.55 * (0.4 + S.loudness + S.beat * 0.4) * (0.5 + pt.sp);
        pt.fx += cf.x * v;
        pt.fy += cf.y * v + (P.flowBias || 0) * dt * (0.4 + S.bass * 0.8);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node test.js`
Expected: `0 failed`, all 5 new checks show `✓`.

- [ ] **Step 6: Manual visual check**

Run: `npm start`, open `elastic-morph.html`. Find any preset with `motion: "flow"` (e.g. search `PRESETS` in the file for `motion: "flow"` to name one, or use the DNA randomizer until one lands — several early presets in the file use it), start the demo track, confirm the particle drift now looks smooth/swirly rather than wavy-directional. Then switch to any `motion: "orbit"` preset and confirm it looks unchanged from before this change (no regression).

- [ ] **Step 7: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "Replace flow-motion noise-to-angle mapping with true curl noise

flowNoise (5-term sine sum) + curlFlow (divergence-free field via
finite-difference gradient, rotated 90°) give motion:\"flow\" presets
smoother, more organic drift than mapping noise directly to an
angle. Kept separate from noise2 (27 other call sites, untouched).
motion:\"orbit\" presets are unaffected."
```

---

## Final Verification

- [ ] `node test.js` — expect `0 failed`.
- [ ] `git status` clean after the commit.
- [ ] `git diff HEAD~1 -- elastic-morph.html` — confirm the diff touches only the two locations in Task 1's Files section (the new functions, and the flow branch's 4 lines), nothing else — in particular, confirm `noise2`'s own body is untouched.
