# Layer B 6-Band Reactivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Layer B's shared reactivity (beat pulse, spin, and color) draw on the finer 6-band audio analysis and kick/snare onset detection shipped 2026-08-24 as pure instrumentation — giving all 20 Layer B types a snappier, more musically differentiated feel with zero new controls or state.

**Architecture:** Three one-formula edits inside the single `drawLayerB(W, H, hue, dt)` function ([elastic-morph.html:6835](../../../elastic-morph.html)) — the two accumulator lines that every Layer B type shares (`lbPulse`, `baseRot`), plus the shared `colr()` color helper closure that every type calls for its stroke/fill color. No new `S.layerB` fields, no new UI, no per-type (`switch (LB.type)`) changes.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- Only these three expressions change; the 20 `case` bodies inside `drawLayerB`'s switch are untouched.
- No new `S.layerB.*` field, no new HTML control, no new localStorage key.
- `S.kickOnset`, `S.snareOnset`, `S.bands.air` are pre-existing (shipped 2026-08-24, `elastic-morph.html:2876`/`3126-3135`) — all already 0..1-clamped, decaying impulse/level signals. Consume them as-is; do not modify their computation.
- Full design rationale discussed inline with Frank (no separate spec doc for this round, per his call).

---

### Task 1: Route kick/snare/air into Layer B's shared pulse, spin, and color

**Files:**
- Modify: `elastic-morph.html:6854` (`colr()` closure inside `drawLayerB`)
- Modify: `elastic-morph.html:6876-6877` (`lbPulse`/`baseRot` accumulators inside `drawLayerB`)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Consumes: `S.kickOnset`, `S.snareOnset`, `S.bands.air` (all pre-existing globals, no signature).
- Produces: nothing new — single-task plan, purely internal formula changes inside `drawLayerB`.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Layer B — 6-band reactivity (kick/snare/air)");

ok("drawLayerB's shared pulse leans on kickOnset for a percussive attack, alongside the existing beat/bass/transient blend", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes("const lbPulse = 1 + (S.beat * 0.1 + S.kickOnset * 0.12 + S.bass * 0.08 + S.transient * 0.06) * liveMul(\"pulse\") * LB.pulse;");
})());

ok("drawLayerB's shared rotation gets a snare-driven twist on top of the existing sway/stereo/spin terms", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes("const baseRot = Math.sin(S.time * 0.15) * 0.06 * LB.sway + S.stereo * 0.05 + S.snareOnset * 0.05 + (LB._spin || 0);");
})());

ok("drawLayerB's colr() brightens every type a touch with S.bands.air (hi-hat/cymbal shimmer), clamped to [0,1]", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes("a = Math.max(0, Math.min(1, a + S.bands.air * 0.12));");
})());

ok("tentacle's counter-rotation still cancels+reverses baseRot regardless of the new snareOnset term (formula changed, contract unchanged)", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes('case "tentacle": {') && fn.includes("ctx.rotate(-2 * baseRot);");
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the first 3 new assertions under "Layer B — 6-band reactivity (kick/snare/air)" print `✗` (old formulas still in place), the 4th (`tentacle` contract) already prints `✓` since it doesn't depend on this task's edits — everything else still prints `✓`.

- [ ] **Step 3: Implement — shared color shimmer (`elastic-morph.html:6854`)**

Find:

```js
  const colr = (t, a) => {
    if (LB.color === "white") return `rgba(255,255,255,${a})`;
```

Replace it with:

```js
  const colr = (t, a) => {
    // v148: shimmer — hi-hat/cymbal-band energy brightens every Layer B type a touch,
    // on top of whatever alpha the caller passed in. Applies before the color-mode
    // branches below so it's uniform across white/palette/rainbow/dna.
    a = Math.max(0, Math.min(1, a + S.bands.air * 0.12));
    if (LB.color === "white") return `rgba(255,255,255,${a})`;
```

- [ ] **Step 4: Implement — shared pulse + rotation (`elastic-morph.html:6876-6877`)**

Find:

```js
  // v20/v43: global liveliness — beat scale-pulse (depth = lbPulse), drift sway + continuous spin
  const lbPulse = 1 + (S.beat * 0.14 + S.bass * 0.1 + S.transient * 0.08) * liveMul("pulse") * LB.pulse;
  const baseRot = Math.sin(S.time * 0.15) * 0.06 * LB.sway + S.stereo * 0.05 + (LB._spin || 0);
```

Replace it with:

```js
  // v20/v43/v148: global liveliness — beat scale-pulse (depth = lbPulse), drift sway + continuous
  // spin. v148 adds kickOnset (percussive attack from the sub/kick band, sharper than the
  // smoother S.beat alone) to the pulse, and snareOnset (mid/high-mid band attack) as a brief
  // rotational twist distinct from the kick's pulse — kick=pulse, snare=twist.
  const lbPulse = 1 + (S.beat * 0.1 + S.kickOnset * 0.12 + S.bass * 0.08 + S.transient * 0.06) * liveMul("pulse") * LB.pulse;
  const baseRot = Math.sin(S.time * 0.15) * 0.06 * LB.sway + S.stereo * 0.05 + S.snareOnset * 0.05 + (LB._spin || 0);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 4 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: route kick/snare/air-band signals into Layer B's shared reactivity

Layer B's 20 types all share three reactivity points inside
drawLayerB(): the beat-pulse scale, the sway/spin rotation, and the
colr() color helper. Until now these only read the coarse S.beat/
S.bass/S.mids/S.highs/S.transient signals — the finer 6-band analysis
and kick/snare onset detection shipped 2026-08-24 went unused by any
visual (deliberately, as pure instrumentation for a later round).

This wires that instrumentation into Layer B's shared points only
(no per-type changes, no new controls):
- lbPulse gains a S.kickOnset term — a sharper, more percussive
  attack than the smoother S.beat alone.
- baseRot gains a S.snareOnset term — a brief rotational twist
  distinct from the kick's pulse (kick=pulse, snare=twist).
- colr() gains a S.bands.air shimmer — hi-hat/cymbal energy
  brightens every type's color a touch, clamped to [0,1].

All 20 types benefit automatically since they all route through
these three shared points. No new S.layerB field, no new UI.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

1. Load a track with a clear kick/snare pattern (e.g. a four-on-the-floor
   house track), enable Layer B with any type, and confirm the pulse now
   feels punchier/more percussive on the kick specifically (not just
   "on the beat" generically).
2. Confirm a visible/felt rotational accent on snare hits, distinct from
   the kick pulse — most noticeable on types with strong linework (grid,
   hexgrid, spiral, moire).
3. Confirm a subtle brightness lift during hi-hat-heavy or cymbal-heavy
   sections (verse-to-chorus buildups are a good test), without the
   overall look "flickering" or feeling too busy — this is meant to be
   the *subtle* one of the three changes. If it reads as too strong,
   flag it — `S.bands.air * 0.12` is easy to retune.
4. A/B against the previous build (or drop `LB.pulse`/mute intensity to
   0 briefly) to confirm nothing looks broken or over-boosted at extreme
   settings (Beat Pulse slider at 300%, Scale LFO at full depth).
