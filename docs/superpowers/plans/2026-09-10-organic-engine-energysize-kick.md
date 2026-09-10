# Organic DNA Engines — Sharper Kick Response via energySize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project 3 of 4 in the "improve what's there" batch. The 8 organic DNA engines (Filament, Attractor, Flame, Hyperspace, Reaction, Corridor Tunnel, Spiral Vortex, Maze Grid) all scale their organism by the shared `energySize` multiplier and none consume the kick-onset signal. Split `energySize`'s smoothed-`S.beat` term into `S.beat` + `S.kickOnset` so the organism pops sharper on the actual kick and sits calmer between kicks — one line, every organic engine benefits, no per-engine work.

**Architecture:** One expression change to the `energySize` definition in the DNA render function (`elastic-morph.html:6060`). `energySize` is passed as the 4th arg to every DNA engine draw function and used by the organic ones as `scale = base * K * growthF * energySize`. The device-panel engines receive it too but mostly ignore it (they size off `growthF`), so this is effectively organic-engine-scoped. No new state, no UI, no `node build.js`.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- Exactly one line changes: the `const energySize = dnaBoost * (…)` definition.
- The `S.beat` coefficient drops `0.45 → 0.32`; a new `S.kickOnset * lp * 0.28` term is added. `S.loudness`, `S.transient`, `S.dropFlash` terms and the `dnaBoost *` / `1 +` structure are unchanged.
- Rationale for the split (not just an add): the coefficient sum for the percussive part goes `0.45 → 0.60`, but `S.kickOnset` is a fast-decaying impulse that's near-zero except right on a kick — so kicks pop ~15% harder while non-kick moments (kick≈0) drop to `S.beat * lp * 0.32`, *below* the old `0.45`. Net = more dynamic range, not "bigger overall".
- `S.kickOnset` is an existing 0..1 decaying impulse (shipped 2026-08-24, gain-scaled + clamped in `updateAudioFeatures`). `lp` is the local `liveMul("pulse")` already in scope at that line.
- No new uniform / no shader change / no per-engine change.
- Exact replacement line:
  `  const energySize = dnaBoost * (1 + S.loudness * lp * 0.68 + S.transient * lp * 0.38 + S.beat * lp * 0.32 + S.kickOnset * lp * 0.28 + S.dropFlash * 0.35);`

---

### Task 1: Split energySize's beat term into beat + kickOnset

**Files:**
- Modify: `elastic-morph.html:6060` (the `energySize` definition)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Consumes: `S.kickOnset` (existing, 0..1, gain-scaled + clamped upstream), `lp` (in scope).
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Organic DNA engines — energySize gains a sharp kick-onset term");

ok("energySize splits the beat term into a smaller S.beat term plus an S.kickOnset term", () => {
  return script.includes("const energySize = dnaBoost * (1 + S.loudness * lp * 0.68 + S.transient * lp * 0.38 + S.beat * lp * 0.32 + S.kickOnset * lp * 0.28 + S.dropFlash * 0.35);");
});

ok("the old flat 'S.beat * lp * 0.45' energySize term is gone", () => {
  return !script.includes("S.transient * lp * 0.38 + S.beat * lp * 0.45 + S.dropFlash * 0.35");
});

ok("energySize still keeps its loudness / transient / dropFlash terms and dnaBoost structure", () => {
  return script.includes("const energySize = dnaBoost * (1 + S.loudness * lp * 0.68 + S.transient * lp * 0.38 +")
    && script.includes("+ S.dropFlash * 0.35);");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the 1st and 2nd new assertions print `✗`; the 3rd (loudness/transient/dropFlash structure — those substrings still exist in the old line) prints `✓`. Everything else still `✓`.

- [ ] **Step 3: Implement — the energySize line (`elastic-morph.html:6060`)**

Find:

```js
  const energySize = dnaBoost * (1 + S.loudness * lp * 0.68 + S.transient * lp * 0.38 + S.beat * lp * 0.45 + S.dropFlash * 0.35);
```

Replace it with:

```js
  // v153: split the smoothed-beat energy term into S.beat + S.kickOnset so the organism
  // pops sharper on the actual kick and sits calmer between kicks (S.kickOnset is a
  // fast-decaying impulse, near-zero off the kick). All 8 organic engines multiply their
  // scale by energySize, so they all inherit the sharper attack — no per-engine change.
  const energySize = dnaBoost * (1 + S.loudness * lp * 0.68 + S.transient * lp * 0.38 + S.beat * lp * 0.32 + S.kickOnset * lp * 0.28 + S.dropFlash * 0.35);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 3 new ones. Final line: `<N> passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: sharper kick response for the organic DNA engines via energySize

Project 3 of the 'improve what's there' batch. The 8 organic DNA
engines (Filament, Attractor, Flame, Hyperspace, Reaction, Corridor
Tunnel, Spiral Vortex, Maze Grid) all scale their organism by the
shared energySize multiplier and none read the kick-onset signal.

energySize's smoothed-beat term is split:
  S.beat * lp * 0.45  ->  S.beat * lp * 0.32 + S.kickOnset * lp * 0.28

S.kickOnset is a fast-decaying impulse (near-zero off the kick), so
kicks pop ~15% harder while non-kick moments drop below the old level
— more dynamic range, not a bigger organism overall. loudness /
transient / dropFlash terms and the dnaBoost structure are unchanged.
Every organic engine inherits the sharper attack with no per-engine
edit; the device-panel engines receive energySize too but size off
growthF so they're unaffected.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

1. Play a four-on-the-floor track and cycle through the organic engines (Filament,
   Attractor, Flame, Hyperspace, Reaction, Corridor Tunnel, Spiral Vortex, Maze Grid).
   Each should now visibly "breathe" harder on the kick and settle more between kicks,
   versus the old more-uniform pulsing.
2. Confirm ambient/kick-light tracks look calmer, not weaker — the sustained size on a
   quiet passage is now driven by `S.beat * 0.32` (down from `0.45`), so the baseline
   organism is a touch smaller; that's intended.
3. Confirm nothing pumps or jitters unpleasantly at high Reactivity gain — `S.kickOnset`
   is already gain-scaled and clamped, and `lp` (pulse multiplier) still gates it.
4. Confirm the device-panel engines (EQ, Sequencer, VU Wall, etc.) are visually
   unchanged (they don't scale off energySize).
5. Quick HQ Export with one organic engine — the offline render uses the same energySize
   path, so it should match live.
