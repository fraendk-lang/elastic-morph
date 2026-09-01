# DNA Patchbay Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Modular Patch" DNA visual engine to Elastic Morph — a modular-synth patch bay with 10 jacks in 2 rows and 5 pulsing cable connections, wired up as a new preset in DNA Bank 2 ("Rhythm").

**Architecture:** Single self-contained addition to `elastic-morph.html`, no `src/inject-vNN.js` involvement (verified below). Four touch points in one file: (A) two new functions `buildPatchTopology`/`drawPatchbay` inserted right after `drawMazeGrid`, (B) one new dispatch branch in `drawScene()`'s DNA-engine if/else chain, (C) one new mini-preview branch in `renderPreviews()`, (D) one new entry in the `PRESETS` array. All four edits sit before the `@BUILD-INJECT-V58` marker (line 10821), so none of them are touched or overwritten by `node build.js`.

**Tech Stack:** Vanilla JS, Canvas 2D (`ctx`/`c` contexts), this codebase's existing DNA-engine conventions (`currentDNA()` palette, `S.bands.*` frequency signals, `S.kickOnset`/`S.snareOnset`, seeded-hash deterministic topology via `fract1`).

## Global Constraints

- Exactly 10 jacks (2 rows of 5), exactly 5 cables — not configurable, per spec Non-Goals.
- No new UI controls of any kind.
- No changes to any existing engine, preset, or dispatch branch besides the one insertion point each.
- New preset: `id: "modularPatch"`, `name: "Modular Patch"`, `bank: "rhythm"`, `engine: "patchbay"`, `hue: 140` (not the initially-considered `24` — corrected during spec self-review because 5 of 9 existing Bank 2 presets already sit in the amber/warm range; 140 (green/teal) is the family genuinely missing from Bank 2). Full field values are given verbatim in Task 1 Step 7 below — copy them exactly, do not invent or omit fields.
- Cable wiring must be seed-stable (same seed → same topology every frame) using this codebase's standard hash formula: `fract1(Math.sin((seed+1)*A + i*B) * 43758.5453)`, cached in a module-level variable keyed by `seed` so it's computed once per track, not every frame — this is the same pattern `buildSeqPattern`/MazeGrid's wall generation already use.
- All new code goes in `elastic-morph.html` at the exact locations verified in this plan — never in `src/`.

---

## Context (verified fresh immediately before writing this plan)

- `@BUILD-INJECT-V58` marker: **line 10821**. Everything below is well before it.
- `grep -rln "drawPatchbay\|buildPatchTopology\|modularPatch" src/` → **zero matches**. No `src/inject-vNN.js` file defines or reassigns any of the three new symbol names.
- Broader check on `PRESETS` itself and `drawScene`'s dispatch chain: a substring grep for `PRESETS` initially returns matches in several `src/inject-vNN.js` files, but every one of them is a false positive on an unrelated variable name (`TEXT_PRESETS`, `LYRICS_STUDIO_PRESETS`, `COVER_EXPORT_PRESETS`, `IMAGE_PRESETS`, `CREATOR_TEXT_PRESETS`, `MUSIC_OBJECT_PRESETS`) — not the DNA-engine `PRESETS` array this plan touches. The two files that do touch the real DNA `PRESETS` array (`src/inject-v91.js`, `src/inject-v105.js`) only ever `.push()`/`.splice()` additional entries into it — safe, additive-only, no reassignment or wrapping. `drawScene`'s dispatch chain itself is not touched by any `src/` file. **Conclusion: this round has zero post-marker-wrapper gotcha, unlike several recent rounds (`HEAVY_SHADER`, `LYRICS_STUDIO_PRESETS`, etc).**
- Baseline test count, confirmed by actually running `node test.js` (not a static grep): **645 passed, 0 failed.**
- `drawMazeGrid` (elastic-morph.html:4915) ends with `ctx.restore();\n}` at **lines 4948-4949**, immediately followed by a comment block starting `/* ============================================================\n   v26: OFFLINE PER-FRAME AUDIO ANALYSIS (export foundation, Stage 1)` at **line 4950**. This is the correct, precise insertion anchor for Task 1's new functions — NOT immediately before `drawCoverImage` (line 5541, the spec's looser description), which is much further away with an unrelated FFT/offline-audio-analysis code section in between.
- `drawScene()`'s dispatch chain: the `mazeGrid` branch is at **line 5765**, reading:
  ```js
    } else if (dnaEngine === "mazeGrid") {
      drawMazeGrid(base, hue, growthF, energySize, seed);
    } else {
  ```
  (the final bare `else` is the organic-blob fallback — confirm this exact three-line shape fresh in Task 1 Step 1, since line numbers drift between sessions).
- `renderPreviews()`: the `mazeGrid` branch is at **line 7415**, the `dance` branch at **line 7431** — the new `patchbay` branch goes between them.
- The `vuClub` preset (full text needed as the Task 1 Step 7 find-anchor) is at **line 2594**, confirmed byte-identical to what's quoted below.

---

## Task 1: Modular Patch DNA engine (functions, dispatch, preview, preset)

**Files:**
- Modify: `elastic-morph.html` (four separate edits, all pre-marker — see line numbers above; re-verify each with a fresh `grep -n` immediately before editing, since this file's line numbers drift between sessions)
- Test: `test.js` (append a new section)

**Interfaces:**
- Produces: `buildPatchTopology(seed)` — pure function, returns an array of 5 `[a, b]` index pairs (each in `[0, 9]`, `a !== b`), deterministic for a given `seed`. `drawPatchbay(base, hue, growthF, energySize, seed)` — matches the exact signature every other DNA-engine draw function uses (e.g. `drawMazeGrid`, `drawEqualizer`). Module-level cache vars `patchTopology`/`patchSeed`.
- Consumes: `currentDNA()` (palette), `S.bands.subBass/bass/lowMid/mid/highMid` (frequency signals), `S.kickOnset`/`S.snareOnset` (percussive hits), `fract1` (hash helper), `ctx`/`canvas` (drawing context), `PRESETS` array shape (existing preset object fields).

- [ ] **Step 1: Re-verify exact anchors fresh**

Run:
```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
grep -n "@BUILD-INJECT-V58" elastic-morph.html
grep -n "^function drawMazeGrid" elastic-morph.html
sed -n '4945,4952p' elastic-morph.html
grep -n 'dnaEngine === "mazeGrid"' elastic-morph.html
sed -n '5763,5768p' elastic-morph.html
grep -n 'p.engine === "mazeGrid"\|p.engine === "dance"' elastic-morph.html
grep -n 'id: "vuClub"' elastic-morph.html
```
Expected: marker still pre-10900ish; `drawMazeGrid`'s closing `ctx.restore();\n}` immediately followed by the `v26: OFFLINE PER-FRAME AUDIO ANALYSIS` comment block; the `mazeGrid`/final-`else` three-line dispatch shape as quoted in Context above; `mazeGrid` preview branch immediately before `dance` preview branch; `vuClub` preset present. If any anchor text differs from what's quoted in this plan, stop and re-derive the diff target from the actual file content before proceeding — do not force the plan's literal text onto a changed file.

- [ ] **Step 2: Insert the two new functions after `drawMazeGrid`**

Find (the last 4 lines of `drawMazeGrid`, immediately followed by the v26 comment block):
```js
    ctx.restore();
  }
  ctx.restore();
}
/* ============================================================
   v26: OFFLINE PER-FRAME AUDIO ANALYSIS (export foundation, Stage 1)
```

Replace:
```js
    ctx.restore();
  }
  ctx.restore();
}
let patchTopology = null, patchSeed = null;
function buildPatchTopology(seed) {
  const jacks = 10, cables = 5;
  const conns = [];
  for (let c = 0; c < cables; c++) {
    const a = Math.floor(fract1(Math.sin((seed + 1) * 12.9898 + c * 47.31) * 43758.5453) * jacks);
    let b = Math.floor(fract1(Math.sin((seed + 1) * 33.13 + c * 91.71) * 43758.5453) * jacks);
    if (b === a) b = (b + 1) % jacks;
    conns.push([a, b]);
  }
  return conns;
}
function drawPatchbay(base, hue, growthF, energySize, seed) {
  const P = currentDNA(), mn = Math.min(canvas.width, canvas.height);
  if (patchSeed !== seed) { patchTopology = buildPatchTopology(seed); patchSeed = seed; }
  const jacks = 10, perRow = 5;
  const w = mn * 0.62 * (0.9 + growthF * 0.15), h = mn * 0.34;
  const jackPos = [];
  for (let i = 0; i < jacks; i++) {
    const row = i < perRow ? 0 : 1, col = i % perRow;
    const x = -w / 2 + (col + 0.5) * (w / perRow);
    const y = row === 0 ? -h / 2 : h / 2;
    jackPos.push([x, y]);
  }
  const sig = [S.bands.subBass, S.bands.bass, S.bands.lowMid, S.bands.mid, S.bands.highMid];
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#0c0c10";
  ctx.fillRect(-w / 2 - mn * 0.03, -h / 2 - mn * 0.04, w + mn * 0.06, h + mn * 0.08);
  ctx.globalCompositeOperation = "lighter";
  const jackHeat = new Array(jacks).fill(0);
  patchTopology.forEach(([a, b], i) => {
    const kick = i === 0 ? S.kickOnset * 0.5 : 0;
    const snare = i === 1 ? S.snareOnset * 0.5 : 0;
    const v = Math.max(0, Math.min(1, sig[i % sig.length] + kick + snare));
    jackHeat[a] = Math.max(jackHeat[a], v);
    jackHeat[b] = Math.max(jackHeat[b], v);
    const [x1, y1] = jackPos[a], [x2, y2] = jackPos[b];
    const midY = (y1 + y2) / 2 + Math.sign(y1) * mn * 0.05 * (0.4 + v * 0.6);
    ctx.strokeStyle = `hsla(${(hue + i * 30) % 360},${P.sat}%,${58 + v * 20}%,${0.35 + v * 0.55})`;
    ctx.lineWidth = Math.max(1.2, mn * 0.004) * (1 + v * 0.8);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2, midY, x2, y2);
    ctx.stroke();
  });
  for (let i = 0; i < jacks; i++) {
    const [x, y] = jackPos[i], v = jackHeat[i];
    ctx.fillStyle = "rgba(20,20,26,1)";
    ctx.beginPath(); ctx.arc(x, y, mn * 0.014, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `hsla(${hue % 360},${P.sat}%,${60 + v * 25}%,${0.5 + v * 0.5})`;
    ctx.lineWidth = Math.max(1, mn * 0.003);
    ctx.beginPath(); ctx.arc(x, y, mn * (0.014 + v * 0.01), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
/* ============================================================
   v26: OFFLINE PER-FRAME AUDIO ANALYSIS (export foundation, Stage 1)
```

- [ ] **Step 3: Wire the new dispatch branch into `drawScene()`**

Find:
```js
  } else if (dnaEngine === "mazeGrid") {
    drawMazeGrid(base, hue, growthF, energySize, seed);
  } else {
```

Replace:
```js
  } else if (dnaEngine === "mazeGrid") {
    drawMazeGrid(base, hue, growthF, energySize, seed);
  } else if (dnaEngine === "patchbay") {
    drawPatchbay(base, hue, growthF, energySize, seed);
  } else {
```

- [ ] **Step 4: Add the mini-preview branch to `renderPreviews()`**

Find (verbatim, confirmed at elastic-morph.html:7429-7431 — the tail of the `mazeGrid` preview branch immediately followed by the `dance` branch's start):
```js
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, y0 + ch); c.stroke();
      }
    } else if (p.engine === "dance") {
      const st = p.danceStyle;
```

Replace:
```js
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, y0 + ch); c.stroke();
      }
    } else if (p.engine === "patchbay") {
      const jacks = 10, perRow = 5, w = R * 1.7, h = R * 0.9;
      const jackPos = [];
      for (let i = 0; i < jacks; i++) {
        const row = i < perRow ? 0 : 1, col = i % perRow;
        jackPos.push([-w / 2 + (col + 0.5) * (w / perRow), row === 0 ? -h / 2 : h / 2]);
      }
      for (let i = 0; i < 5; i++) {
        const a = Math.floor(fract1(Math.sin((pv.seed + 1) * 12.9898 + i * 47.31) * 43758.5453) * jacks);
        let b = Math.floor(fract1(Math.sin((pv.seed + 1) * 33.13 + i * 91.71) * 43758.5453) * jacks);
        if (b === a) b = (b + 1) % jacks;
        const v = 0.4 + 0.4 * Math.sin(t * 2 + i * 1.3);
        const [x1, y1] = jackPos[a], [x2, y2] = jackPos[b];
        const midY = (y1 + y2) / 2 + Math.sign(y1) * R * 0.12;
        c.strokeStyle = `hsla(${(hue + i * 30) % 360},${p.sat}%,65%,${0.35 + v * 0.4})`;
        c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2, midY, x2, y2); c.stroke();
      }
      for (let i = 0; i < jacks; i++) {
        const [x, y] = jackPos[i];
        c.fillStyle = "rgba(20,20,26,1)"; c.beginPath(); c.arc(x, y, R * 0.05, 0, 6.2832); c.fill();
        c.strokeStyle = `hsla(${hue % 360},${p.sat}%,65%,0.6)`; c.lineWidth = 1; c.beginPath(); c.arc(x, y, R * 0.05, 0, 6.2832); c.stroke();
      }
    } else if (p.engine === "dance") {
      const st = p.danceStyle;
```

- [ ] **Step 5: Run tests, confirm no regressions from Steps 2-4 alone**

Run: `node test.js`
Expected: still 645 passed, 0 failed (no new tests reference the new code yet — this just confirms the 3 edits didn't break anything structurally, e.g. a stray brace).

- [ ] **Step 6: Add the new PRESETS entry**

Find (verbatim, confirmed at elastic-morph.html:2593-2603 — `vuClub` is currently the last `bank: "rhythm"` entry in the `PRESETS` array; the entry immediately after it, `sgFlower`, belongs to a different bank/section, so this is the correct and unambiguous insertion point):
```js
  {
    id: "vuClub", name: "Club VU Wall", bank: "rhythm",
    desc: "Sechs VU-Nadelmeter in heißem Rot/Orange, grobkörnig — Club-Mixer-Ästhetik. House, Techno, Club.",
    hue: 350, hueEnd: 20, sat: 85, bgFade: 0.5,
    layers: 1, points: 0, noiseAmp: 0, speed: 0.4,
    particles: 0, particleStyle: "spark", symmetry: 1,
    verticalStretch: 1.0, grain: 0.35, lineMode: false, petals: 0, glass: false,
    motion: "orbit", flowBias: 0, constellation: false, bloom: 0.4, waveRing: false,
    engine: "vu",
    gradient: ["#1c0604", "#5a1810", "#ff8a4b"]
  },
```

Replace:
```js
  {
    id: "vuClub", name: "Club VU Wall", bank: "rhythm",
    desc: "Sechs VU-Nadelmeter in heißem Rot/Orange, grobkörnig — Club-Mixer-Ästhetik. House, Techno, Club.",
    hue: 350, hueEnd: 20, sat: 85, bgFade: 0.5,
    layers: 1, points: 0, noiseAmp: 0, speed: 0.4,
    particles: 0, particleStyle: "spark", symmetry: 1,
    verticalStretch: 1.0, grain: 0.35, lineMode: false, petals: 0, glass: false,
    motion: "orbit", flowBias: 0, constellation: false, bloom: 0.4, waveRing: false,
    engine: "vu",
    gradient: ["#1c0604", "#5a1810", "#ff8a4b"]
  },
  {
    id: "modularPatch", name: "Modular Patch", bank: "rhythm",
    desc: "Steckfeld mit pulsierenden Kabelverbindungen — analoge Studio-Optik. Deep House, Modular Techno.",
    hue: 140, hueEnd: 165, sat: 70, bgFade: 0.4,
    layers: 1, points: 0, noiseAmp: 0, speed: 0.4,
    particles: 0, particleStyle: "spark", symmetry: 1,
    verticalStretch: 1.0, grain: 0.3, lineMode: false, petals: 0, glass: false,
    motion: "orbit", flowBias: 0, constellation: false, bloom: 0.4, waveRing: false,
    engine: "patchbay",
    gradient: ["#04140c", "#0d3a2c", "#5affc0"]
  },
```

- [ ] **Step 7: Run tests again, confirm still clean before writing new tests**

Run: `node test.js`
Expected: still 645 passed, 0 failed.

- [ ] **Step 8: Write the new test section**

Open `test.js`, find its final `section(...)` block (or the end of the file before any summary/report code) and append:

```js
section("DNA Visual — Modular Patch (Patchbay engine)");

["drawPatchbay", "buildPatchTopology"].forEach(fn =>
  ok("function " + fn + " defined", script.includes("function " + fn + "(")));

ok("drawScene's dispatch chain has a patchbay branch calling drawPatchbay, positioned after mazeGrid and before the final bare else", (() => {
  const mazeIdx = script.indexOf('dnaEngine === "mazeGrid"');
  const patchIdx = script.indexOf('dnaEngine === "patchbay"');
  const callIdx = script.indexOf("drawPatchbay(base, hue, growthF, energySize, seed);");
  return mazeIdx >= 0 && patchIdx > mazeIdx && callIdx > patchIdx;
})());

ok("renderPreviews has a patchbay branch positioned between the mazeGrid and dance branches", (() => {
  const mazeIdx = script.indexOf('p.engine === "mazeGrid"');
  const patchIdx = script.indexOf('p.engine === "patchbay"');
  const danceIdx = script.indexOf('p.engine === "dance"');
  return mazeIdx >= 0 && patchIdx > mazeIdx && danceIdx > patchIdx;
})());

ok("PRESETS contains exactly one modularPatch entry with bank rhythm and engine patchbay", (() => {
  const count = (script.match(/id:\s*"modularPatch"/g) || []).length;
  return count === 1 &&
    script.includes('id: "modularPatch", name: "Modular Patch", bank: "rhythm"') &&
    script.includes('engine: "patchbay"');
})());

ok("buildPatchTopology is deterministic, stays in range, avoids self-loops, and varies across seeds (genuine behavioral check via loadFns)", (() => {
  const { buildPatchTopology } = loadFns(["buildPatchTopology", "fract1"]);
  const a = buildPatchTopology(7);
  const b = buildPatchTopology(7);
  const c = buildPatchTopology(42);
  const sameForSameSeed = JSON.stringify(a) === JSON.stringify(b);
  const validShape = a.length === 5 && a.every(([x, y]) =>
    Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x <= 9 && y >= 0 && y <= 9 && x !== y);
  const variesAcrossSeeds = JSON.stringify(a) !== JSON.stringify(c);
  return sameForSameSeed && validShape && variesAcrossSeeds;
})());
```

Notes for whoever writes this: check `test.js`'s existing `section`/`ok`/`loadFns`/`extractFn` helpers first (e.g. how the MazeGrid or Sequencer topology tests are structured) and match the established call signatures exactly — the snippet above follows the pattern used throughout this session's DNA-engine rounds, but confirm `ok(label, boolean)` and `loadFns([...names])` argument order against the real helper definitions in `test.js` before pasting. `loadFns` must be given `"fract1"` alongside `"buildPatchTopology"` since the latter's body calls the former — `loadFns` stitches all requested function sources into one shared eval scope, so both together resolve correctly (confirmed `fract1` is declared as `const fract1 = x => x - Math.floor(x);`, a form `extractFn` already handles for other arrow-const helpers like `advanceHypnoPhase`).

- [ ] **Step 9: Run the full suite, confirm 650/650**

Run: `node test.js`
Expected: **650 passed, 0 failed** (645 baseline + 5 new assertions written in Step 8 — the two `.forEach` iterations count as 2, plus 3 more `ok(...)` calls = 5 total). If the actual new-assertion count differs from 5 once written (e.g. `test.js`'s `ok` helper counts differently, or a helper needs an extra structural check), correct this expected total to match reality — don't force 650 if the honest count is different.

- [ ] **Step 10: Commit**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
git add elastic-morph.html test.js
git commit -m "feat: add Modular Patch DNA engine (patch bay, jacks + cables) to Bank 2 Rhythm"
```

(No `src/` files change in this task — confirmed zero `src/` involvement in Context above.)

---

## Testing Summary

- Structural: both new functions defined; dispatch chain wired correctly and positioned right; preview chain wired correctly and positioned right; exactly one correctly-shaped new preset.
- Behavioral: `buildPatchTopology(seed)` is deterministic per seed, produces 5 valid non-self-looping index pairs in `[0,9]`, and varies across different seeds — a genuine test of the actual topology-generation logic, not just its presence.
- No mocking needed anywhere in this task; `buildPatchTopology` is a pure function reachable via `loadFns`.

## Live Verification (after task ships, do this manually in the Browser pane — not part of Task 1's automated tests)

1. Select the "Modular Patch" preset (DNA Bank 2, Rhythm tab).
2. Confirm 10 jacks in 2 rows of 5, and 5 curved cables connecting them, render on screen.
3. Force `S.bands.subBass` (and the other 4 band signals) to high values one at a time in the console; confirm the corresponding cable(s) visibly brighten/thicken.
4. Force `S.kickOnset`/`S.snareOnset` to 1; confirm cable index 0/1 responds.
5. Confirm jacks brighten to the max signal of any cable touching them (a jack touched by two active cables should look at least as bright as either alone).
6. Confirm the preview thumbnail for "Modular Patch" renders correctly in the preset picker.
7. Switch to a different track (different seed) and confirm the cable wiring visibly changes (different jack pairs connected) while staying stable for that track across multiple frames.
