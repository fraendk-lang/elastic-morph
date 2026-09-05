# Demo Showcase Wash-Out Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the auto-applied demo showcase look from washing out to flat gray within seconds of playback.

**Architecture:** `DEMO_SHOWCASE` (a single object literal) gets three field changes: its shader's `blend` switches from the purely-additive `"lighter"` to `"overlay"` (the structural fix — `overlay` doesn't monotonically brighten toward white the way additive blending does against a slow-clearing preset), its `intensity`/`opacity` drop slightly, and its `fx` array (which auto-enabled `strobe`/`shake`, both independently additive-composited) becomes empty. No new code paths — this is a values-only change to one existing object.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`, generated in part from `src/inject-v93.js` by `build.js`), zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- `DEMO_SHOWCASE` is declared in `src/inject-v93.js` and merged into the build-injected region of `elastic-morph.html` by `build.js` — it must be edited in `src/inject-v93.js`, never patched directly in the generated region of `elastic-morph.html` (any such edit is silently wiped on the next `node build.js`/deploy).
- Exact new values (from the design spec, verified live against production): `shader.blend: "overlay"`, `shader.intensity: 0.7`, `shader.opacity: 0.5`, `fx: []`.
- `DEMO_SHOWCASE.presetId`, `DEMO_SHOWCASE.ctrl`, `DEMO_SHOWCASE.mix`, and `shader.style`/`shader.on`/`shader.speed`/`shader.scale`/`shader.colorBias` are all unchanged — the wash was fully explained by `shader.blend` + `fx`, confirmed live; don't touch anything else in this object.
- After the `src/inject-v93.js` edit, run `node build.js` before `node test.js` (matches `npm run ci`).

---

### Task 1: Retune `DEMO_SHOWCASE`

**Files:**
- Modify: `src/inject-v93.js:13-14` (`DEMO_SHOWCASE.shader` and `DEMO_SHOWCASE.fx`)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Produces: `DEMO_SHOWCASE.shader = { on: true, style: "laser", intensity: 0.7, opacity: 0.5, blend: "overlay", speed: 1, scale: 1, colorBias: 0 }` and `DEMO_SHOWCASE.fx = []`, read by `applyDemoShowcaseLook()` (unchanged, already in `src/inject-v93.js`) whenever a visitor plays the bundled demo track for the first time.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it (right after whatever `ok(...)` call currently precedes that comment):

```js
section("Demo Showcase — wash-out fix (overlay blend, no strobe/shake FX)");

ok("DEMO_SHOWCASE.shader uses overlay blend at reduced intensity/opacity (was lighter/0.84/0.58 -- purely-additive blend against clubStrobe's low bgFade washed the demo to flat gray within seconds, confirmed live against production)", (() => {
  const idx = script.indexOf("const DEMO_SHOWCASE = {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 700);
  return body.includes('shader: { on: true, style: "laser", intensity: 0.7, opacity: 0.5, blend: "overlay", speed: 1, scale: 1, colorBias: 0 },');
})());

ok("DEMO_SHOWCASE.fx no longer auto-enables strobe/shake (both were independently additive-composited and independently contributed to the same wash-out, verified live)", (() => {
  const idx = script.indexOf("const DEMO_SHOWCASE = {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 700);
  return body.includes("fx: [],");
})());

ok("DEMO_SHOWCASE.presetId/ctrl/mix are unchanged -- the wash was fully explained by shader.blend + fx, not these", (() => {
  const idx = script.indexOf("const DEMO_SHOWCASE = {");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 700);
  return body.includes('presetId: "clubStrobe",')
    && body.includes("pulse: 0.82, morph: 0.62, density: 0.72, memory: 0.28,")
    && body.includes("colorDrift: 0.48, camDrift: 0.42, zoom: 0.52, mutation: 0.38,")
    && body.includes("gravity: 0.32, organic: 0.5")
    && body.includes("mix: { bass: 1.18, mid: 1.1, high: 1.05, autoLevel: true, beatThresh: 0.028 }");
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the 3 new assertions under "Demo Showcase — wash-out fix (overlay blend, no strobe/shake FX)" print `✗` (the first two fail on the still-`"lighter"`/`["strobe", "shake"]` values; the third already passes since those fields aren't touched — that's fine, it's a regression guard, not expected to go red).

- [ ] **Step 3: Implement**

Edit `src/inject-v93.js:13-14`. Replace:

```js
  shader: { on: true, style: "laser", intensity: 0.84, opacity: 0.58, blend: "lighter", speed: 1, scale: 1, colorBias: 0 },
  fx: ["strobe", "shake"],
```

with:

```js
  shader: { on: true, style: "laser", intensity: 0.7, opacity: 0.5, blend: "overlay", speed: 1, scale: 1, colorBias: 0 },
  fx: [],
```

**IMPORTANT:** do not hand-edit the corresponding generated block inside `elastic-morph.html` (between the `/* @BUILD-INJECT-V58 */` marker and `/* ---- boot ---- */`) — it is fully regenerated from `src/inject-v93.js` by the next step and any direct edit there is silently discarded.

- [ ] **Step 4: Rebuild so the edited `src/inject-v93.js` is merged into `elastic-morph.html`**

Run: `node build.js`
Expected output: `✓ Merged src/inject-v58.js + … (v113)`

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run ci`
Expected: all assertions print `✓`, including the 3 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add src/inject-v93.js elastic-morph.html test.js
git commit -m "fix: stop the demo showcase look from washing out to gray

DEMO_SHOWCASE (src/inject-v93.js) layered a purely-additive shader
blend (lighter) plus additive strobe/shake FX on top of clubStrobe's
low bgFade (0.055) -- verified live against production that both
independently wash the first-run demo experience toward flat gray
within seconds, regardless of which Visual DNA preset a visitor picks
afterward (the wash lives outside the preset system entirely).

Switched shader.blend to overlay (doesn't monotonically brighten
toward white the way additive does), trimmed intensity/opacity
slightly, and dropped the strobe/shake auto-enable. Verified live and
stable over 10+ second windows at multiple points in the demo track,
including a beat-drop moment (now a punchy flash, not a wash).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

Not covered by `test.js` (static source assertions only) — this fix was
validated live before being written up (see the design spec), but re-verify
once more after landing the change, same protocol:

1. Open the app fresh, click "Demo starten".
2. Open the Shader Engine panel (Pro-Modus) — confirm it shows `Style: Laser
   Fans`, `Blend: Overlay`, `Intensity: 70`, `Opacity: 50`.
3. Let it play for 10+ seconds at a few different points in the track
   (including near a beat drop) — confirm the visual stays richly colored
   with a visible organism, and a beat drop reads as a bright flash rather
   than washing the whole frame to gray.
4. Confirm `fx.shake`/`fx.strobe` are NOT checked/active anywhere in the FX
   Rack panel right after the demo track starts playing.
