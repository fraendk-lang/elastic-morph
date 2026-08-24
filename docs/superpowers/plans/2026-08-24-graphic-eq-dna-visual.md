# Graphic EQ DNA Visual (Round 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Graphic EQ" DNA preset/engine — a 6-band equalizer visual driven directly
by the `S.bands` frequency data shipped in the previous round, with peak-hold caps that flash
on kick/snare onsets.

**Architecture:** Follows the codebase's existing DNA-engine pattern exactly: a new
`drawEqualizer()` function (same signature as `drawVinyl`/`drawTape`/`drawSacred`), one new
dispatch line in `drawScene()`, one new entry in the `PRESETS` array, and one new branch in the
preset-picker's mini-preview renderer. No new state, UI, or data model — this is the first
visual *consumer* of `S.bands`/`S.kickOnset`/`S.snareOnset`, which already exist and update
every frame during real playback.

**Tech Stack:** Vanilla JS, Canvas2D. Single-file app (`elastic-morph.html`) with a
zero-dependency text-based test harness (`test.js`).

## Global Constraints

- All edits land in the **static (non-generated) region** of `elastic-morph.html` — before the
  `/* @BUILD-INJECT-V58 */` marker (verify its current line with `grep -n '@BUILD-INJECT-V58'
  elastic-morph.html` before starting — it drifts). All 4 edit locations in this plan (the
  `PRESETS` array, `drawTape`'s neighborhood, `drawScene`'s dispatch chain, and the preset
  preview renderer) are long-established, pre-existing code — not newly-added utility functions
  — so this is lower placement risk than recent rounds, but still verify, don't assume.
- Do not modify `S.bands`, `S.kickOnset`, `S.snareOnset`, or `updateAudioFeatures()` in any way
  — this plan only reads those pre-existing signals, exactly like every other DNA engine already
  reads `S.bass`/`S.mids`/`S.highs`.
- Do not modify any existing engine's draw function, dispatch branch, preset entry, or preview
  branch — this is a purely additive new engine.
- Exact colors/sizing constants in this plan are live-tuning starting points, not final
  numbers — same convention as prior rounds' palette/feedback-loop defaults.
- Test-first: write the failing test before touching `elastic-morph.html`, confirm it fails,
  then implement.
- Before the final commit: `node build.js && git diff --stat elastic-morph.html` must show no
  diff, then `npm run ci` must pass.
- Source spec: `docs/superpowers/specs/2026-08-24-graphic-eq-dna-visual-design.md`.

---

### Task 1: `drawEqualizer()` engine — function, dispatch, preset, preview

**Files:**
- Modify: `elastic-morph.html:2358` (new `PRESETS` entry, inserted after the `"tape"` preset)
- Modify: `elastic-morph.html:4059` (new `drawEqualizer()` function, inserted after `drawTape()`)
- Modify: `elastic-morph.html:4652-4654` (`drawScene()` — new dispatch branch)
- Modify: `elastic-morph.html:6103-6112` (preset-picker mini-preview — new branch)
- Test: `test.js`

**Interfaces:**
- Produces: `drawEqualizer(base, hue, growthF, energySize, seed)` — same signature as every
  other DNA engine function, no return value, draws directly to the module-scope `ctx`. New
  module-scope `let eqPeaks = [0, 0, 0, 0, 0, 0];` (peak-hold state, persists across frames).
  New `PRESETS` entry `{id: "eq", name: "Graphic EQ", engine: "eq", ...}`.
- Consumes: pre-existing `S.bands.{subBass,bass,lowMid,mid,highMid,air}`, `S.kickOnset`,
  `S.snareOnset` (all already shipped, updated every frame during real playback), pre-existing
  `currentDNA()`, `canvas`, `ctx`.

- [ ] **Step 1: Write the failing tests**

Append to `test.js`:

```js
section("Graphic EQ DNA Visual");

ok("PRESETS contains the Graphic EQ preset with engine: \"eq\"", (() => {
  const m = script.match(/id: "eq", name: "Graphic EQ",[\s\S]*?engine: "eq",/);
  return !!m;
})());

ok("drawEqualizer reads S.bands (all 6 fields), S.kickOnset, and S.snareOnset", (() => {
  const fn = extractFn("drawEqualizer");
  return !!fn
    && fn.includes("S.bands.subBass")
    && fn.includes("S.bands.bass")
    && fn.includes("S.bands.lowMid")
    && fn.includes("S.bands.mid")
    && fn.includes("S.bands.highMid")
    && fn.includes("S.bands.air")
    && fn.includes("S.kickOnset")
    && fn.includes("S.snareOnset");
})());

ok("drawScene dispatches dnaEngine === \"eq\" to drawEqualizer with the standard engine-function signature", (() => {
  const fn = extractFn("drawScene");
  return !!fn && fn.includes('} else if (dnaEngine === "eq") {\n    drawEqualizer(base, hue, growthF, energySize, seed);\n  }');
})());

ok("buildPresets' mini-preview renderer has a branch for p.engine === \"eq\"", (() => {
  const fn = extractFn("buildPresets");
  return !!fn && fn.includes('p.engine === "eq"');
})());

ok("existing tape/sacred engine dispatch and preview branches are untouched", (() => {
  const sceneFn = extractFn("drawScene");
  const previewFn = extractFn("buildPresets");
  return !!sceneFn && !!previewFn
    && sceneFn.includes('drawTape(base, hue, growthF, energySize, seed);')
    && sceneFn.includes('drawSacred(base, hue, growthF, energySize, seed);')
    && previewFn.includes('p.engine === "tape"')
    && previewFn.includes('p.engine === "dance"');
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js`
Expected: the first 4 new assertions show `✗`. The last one ("existing tape/sacred... untouched")
already shows `✓` — it's a baseline check confirming the pre-existing code you're about to work
next to, not something your new code needs to make pass.

- [ ] **Step 3: Implement — `PRESETS` entry**

Change `elastic-morph.html:2358` from:
```js
    engine: "tape",
    gradient: ["#140e04", "#5a3e12", "#f5b04b"]
  },
  /* v54: Sacred Geometry — precise symmetric patterns that breathe & rotate */
```
to:
```js
    engine: "tape",
    gradient: ["#140e04", "#5a3e12", "#f5b04b"]
  },
  {
    id: "eq", name: "Graphic EQ",
    desc: "6-Band-Equalizer — reagiert direkt auf die Frequenzbänder. Technisch, clean, DJ-Set.",
    hue: 190, hueEnd: 220, sat: 75, bgFade: 0.5,
    layers: 1, points: 0, noiseAmp: 0, speed: 0.4,
    particles: 0, particleStyle: "spark", symmetry: 1,
    verticalStretch: 1.0, grain: 0.05, lineMode: false, petals: 0, glass: false,
    motion: "orbit", flowBias: 0, constellation: false, bloom: 0.4, waveRing: false,
    engine: "eq",
    gradient: ["#04141c", "#0d3a52", "#4bd6f5"]
  },
  /* v54: Sacred Geometry — precise symmetric patterns that breathe & rotate */
```

- [ ] **Step 4: Implement — `drawEqualizer()`**

Change `elastic-morph.html:4058-4060` from:
```js
  ctx.restore();
}

/* --- v54: SACRED GEOMETRY — precise, symmetric patterns that breathe & rotate with the music.
```
to:
```js
  ctx.restore();
}

/* --- v114: GRAPHIC EQ — 6-band equalizer driven directly by S.bands, peak-hold caps flash on kick/snare --- */
let eqPeaks = [0, 0, 0, 0, 0, 0];
function drawEqualizer(base, hue, growthF, energySize, seed) {
  const P = currentDNA(), mn = Math.min(canvas.width, canvas.height);
  const w = mn * 0.5 * (0.9 + growthF * 0.15), h = mn * 0.32;
  const bands = [S.bands.subBass, S.bands.bass, S.bands.lowMid, S.bands.mid, S.bands.highMid, S.bands.air];
  const n = bands.length, bw = w / n;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#0c0c10";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = "rgba(205,212,222,0.4)"; ctx.lineWidth = Math.max(1, mn * 0.003);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.globalCompositeOperation = "lighter";
  const onset = Math.max(S.kickOnset || 0, S.snareOnset || 0);
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(1, bands[i]));
    const bh = v * h * 0.92;
    const bx = -w / 2 + i * bw + bw * 0.12;
    ctx.fillStyle = `hsl(${(hue + i * 22) % 360},${P.sat}%,56%)`;
    ctx.fillRect(bx, h / 2 - bh, bw * 0.76, bh);
    eqPeaks[i] = Math.max(v + onset * 0.15, eqPeaks[i] - 0.012);
    const py = h / 2 - eqPeaks[i] * h * 0.92;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(bx, py - 1, bw * 0.76, Math.max(1.5, mn * 0.004));
  }
  ctx.restore();
}

/* --- v54: SACRED GEOMETRY — precise, symmetric patterns that breathe & rotate with the music.
```

- [ ] **Step 5: Implement — `drawScene()` dispatch**

Change `elastic-morph.html:4652-4654` from:
```js
  } else if (dnaEngine === "tape") {
    drawTape(base, hue, growthF, energySize, seed);
  } else if (dnaEngine === "sacred") {
```
to:
```js
  } else if (dnaEngine === "tape") {
    drawTape(base, hue, growthF, energySize, seed);
  } else if (dnaEngine === "eq") {
    drawEqualizer(base, hue, growthF, energySize, seed);
  } else if (dnaEngine === "sacred") {
```

- [ ] **Step 6: Implement — preset-picker mini-preview**

Change `elastic-morph.html:6111-6112` from:
```js
      });
    } else if (p.engine === "dance") {
```
to:
```js
      });
    } else if (p.engine === "eq") {
      const nb = 6, bw = W / nb;
      for (let i = 0; i < nb; i++) {
        const v = 0.3 + 0.6 * Math.abs(Math.sin(i * 0.9 + t * 2.2 + pv.seed));
        const bh = v * H * 0.42;
        c.fillStyle = `hsl(${(hue + i * 22) % 360},${p.sat}%,56%)`;
        c.fillRect(-W / 2 + i * bw + 1, H * 0.5 - bh, bw - 2, bh);
      }
    } else if (p.engine === "dance") {
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `node test.js`
Expected: all 5 assertions from Step 1 show `✓`.

- [ ] **Step 8: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Graphic EQ DNA visual — 6-band equalizer with kick/snare peak-hold"
```

---

### Task 2: Full regression + manual live-check

**Files:** none modified — verification only.

**Interfaces:** none (terminal task).

- [ ] **Step 1: Full automated regression**

Run: `npm run ci`
Expected: `node build.js` reports the merge succeeded, then `node test.js` reports `fail: 0` and
every section — old and new — shows all `✓`.

- [ ] **Step 2: Confirm no generated-region drift**

Run: `git diff --stat elastic-morph.html`
Expected: no output.

Run: `git status --short`
Expected: empty.

- [ ] **Step 3: Manual live-check (Pro mode, a demo track with a clear kick/snare pattern)**

In the running app:
1. Open the DNA preset picker — confirm "Graphic EQ" appears as a new card (after "Tape
   Machine"), with a mini-preview showing 6 simulated bars (not blank, not broken).
2. Select the "Graphic EQ" preset and play the track — confirm all 6 bars are visible inside a
   framed box, and react visibly differently to each other (sub-bass/bass bars pulse with the
   bassline/kick, mid/high-mid/air bars light up on hi-hats/vocals/cymbals) — this is the
   feature's core payoff, since these are real, distinct `S.bands` values, not simulated.
3. Confirm the white peak-hold cap on each bar flashes upward on kick/snare hits and then
   visibly decays back down over roughly a second, rather than snapping instantly or never
   moving.
4. Pause the track — confirm all bars (and peak caps) settle down to flat/near-zero within a
   couple seconds, matching [[project_morph_frequency_bands]]'s existing paused-branch decay
   behavior for `S.bands`/`S.kickOnset`/`S.snareOnset` (this plan doesn't touch that decay logic
   — it's verifying the pre-existing behavior reads correctly through the new visual).
5. Confirm no visible change to any other DNA preset, engine, or Shader Engine style — cycle
   through a few unrelated presets (e.g. "Tape Machine", "Vinyl", one of the Blob presets) and
   compare against the pre-feature look, since this is a purely additive new engine.
6. Note whether the bar-height scaling, peak-hold decay speed, or Cyan/Blue color scheme feels
   right — per the design spec, these are live-tuning starting points, not final numbers.

No code changes are expected from this step unless Step 3.6 surfaces a concrete live-tuning
request — if so, that's a follow-up, not part of this plan's scope.
