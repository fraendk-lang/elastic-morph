# Frequency-Band Reactivity Refinement (Round 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 6-band audio analysis layer (up from the existing 3 bands) plus band-limited
kick/snare onset detection, surfaced as live meters in the existing "Audio Mixer" panel —
purely additive instrumentation with zero effect on any existing visual.

**Architecture:** New parallel state (`S.bands`, `S.kickOnset`, `S.snareOnset`) computed inside
`updateAudioFeatures`'s existing live-analysis branch, reusing the pre-existing `bandEnergy()`
helper and the same jump-detection technique already used for `S.transient`. A new `#bandMeter`
canvas in the Audio Mixer panel visualizes it every frame. Nothing this plan touches feeds any
of the 12 Shader Engine styles, Layer B, particles, or the deterministic export path — that
wiring is explicitly deferred to a later "band-to-parameter routing matrix" round.

**Tech Stack:** Vanilla JS, Web Audio API (`AnalyserNode`), Canvas2D. Single-file app
(`elastic-morph.html`) with a zero-dependency text-based test harness (`test.js`).

## Global Constraints

- All edits land in the **static (non-generated) region** of `elastic-morph.html` — before the
  `/* @BUILD-INJECT-V58 */` marker (verify its current line with `grep -n '@BUILD-INJECT-V58'
  elastic-morph.html` before starting — it drifts). Every edit location in this plan (lines
  ~1564, ~2499, ~2673, ~2693, ~2735, ~2740) is well before that.
- `S.bass`, `S.mids`, `S.highs`, `S.beat`, `S.transient`, and `S.loudness` must stay
  **byte-for-byte unchanged** — this plan adds new, parallel state, it does not modify or
  replace any existing audio-reactive signal any of the 12 Shader Engine styles, Layer B, or
  particle code already depends on.
- The new signals (`S.bands.*`, `S.kickOnset`, `S.snareOnset`) are computed from real audio
  **only** inside `updateAudioFeatures`'s live-analysis branch (`if (analyser && live) { ... }`)
  — the idle-demo branch (no track loaded) must NOT give them simulated/fake values, unlike
  `S.bass`/`S.mids`/`S.highs` there. The separate "paused" branch (track loaded, not playing)
  DOES decay them toward zero, matching the existing `S.bass`/`S.transient` decay pattern
  already in that branch (Task 1, Step 6) — so the meter settles instead of freezing on stale
  values, it does not fabricate new activity. Never touched in the offline/export
  feature-timeline path (`buildFeatureTimeline`, a completely separate code path this plan does
  not touch).
- No persistence: `S.bands`/`S.kickOnset`/`S.snareOnset` are live telemetry recomputed every
  frame, exactly like the pre-existing `S.bass`/`S.beat`/`S.stereo` — none of those are in
  `projectData()`/`applyProject()`, and neither are these. Do not add them there.
- No new user-adjustable gain slider per band in this round — the meter is display-only.
- Test-first: every task adds its assertions to `test.js` before touching `elastic-morph.html`,
  confirms they fail, then implements.
- Before the final commit: `node build.js && git diff --stat elastic-morph.html` must show no
  diff, then `npm run ci` must pass.
- Source spec: `docs/superpowers/specs/2026-08-24-frequency-band-reactivity-design.md`.

---

### Task 1: Data model + 6-band/onset calculation

**Files:**
- Modify: `elastic-morph.html:2499` (add `bands`/`kickOnset`/`snareOnset` to the `S = {...}` state object)
- Modify: `elastic-morph.html:2673` (add `prevKick`/`prevSnare` module variables next to `prevLoud`)
- Modify: `elastic-morph.html:2693` (add the 6 `bandEnergy()` calls + kick/snare onset detection, inside `updateAudioFeatures`'s live branch)
- Modify: `elastic-morph.html:2735` (add decay for the new fields in the "paused" branch, matching the existing decay pattern for `S.bass`/`S.transient` in that same branch)
- Test: `test.js`

**Interfaces:**
- Produces: `S.bands` — `{ subBass: number, bass: number, lowMid: number, mid: number, highMid: number, air: number }`, each 0-1. `S.kickOnset`, `S.snareOnset` — `number`, 0-1, decaying envelope. Consumed by Task 2's meter (nothing else).
- Consumes: pre-existing `bandEnergy(lo, hi)` helper (`elastic-morph.html:2662-2671`, unchanged), pre-existing `S.gain`, `S.mix.beatThresh`.

- [ ] **Step 1: Write the failing tests**

Append to `test.js`:

```js
section("Frequency-Band Reactivity — data model + calculation");

ok("S.bands/kickOnset/snareOnset initial state present with all 6 band fields at 0", script.includes(
  "bands: { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, air: 0 }, kickOnset: 0, snareOnset: 0,"
));

ok("prevKick/prevSnare module variables declared next to prevLoud", script.includes(
  "let prevLoud = 0, prevKick = 0, prevSnare = 0;"
));

ok("updateAudioFeatures computes all 6 new bands with the documented frequency ranges", (() => {
  const fn = extractFn("updateAudioFeatures");
  return !!fn
    && fn.includes("S.bands.subBass = bandEnergy(20, 60) * g;")
    && fn.includes("S.bands.bass = bandEnergy(60, 160) * g;")
    && fn.includes("S.bands.lowMid = bandEnergy(160, 500) * g;")
    && fn.includes("S.bands.mid = bandEnergy(500, 2000) * g;")
    && fn.includes("S.bands.highMid = bandEnergy(2000, 6000) * g;")
    && fn.includes("S.bands.air = bandEnergy(6000, 16000) * g;");
})());

ok("updateAudioFeatures computes kick/snare onset via the same jump-detection technique as S.transient", (() => {
  const fn = extractFn("updateAudioFeatures");
  return !!fn
    && fn.includes("const kickE = (S.bands.subBass + S.bands.bass) * 0.5;")
    && fn.includes("S.kickOnset = Math.max(S.kickOnset * 0.88, kickJump > (M.beatThresh || 0.04) ? Math.min(1, kickJump * 8) : 0);")
    && fn.includes("const snareE = (S.bands.mid + S.bands.highMid) * 0.5;")
    && fn.includes("S.snareOnset = Math.max(S.snareOnset * 0.88, snareJump > (M.beatThresh || 0.04) ? Math.min(1, snareJump * 8) : 0);");
})());

ok("the paused branch decays the new fields, matching the existing S.bass/S.transient decay pattern there", (() => {
  const fn = extractFn("updateAudioFeatures");
  return !!fn && fn.includes("S.bands.subBass *= 0.95; S.bands.bass *= 0.95; S.bands.lowMid *= 0.95; S.bands.mid *= 0.95; S.bands.highMid *= 0.95; S.bands.air *= 0.95;")
    && fn.includes("S.kickOnset *= 0.9; S.snareOnset *= 0.9;");
})());

ok("existing S.bass/S.mids/S.highs/S.loudness/S.transient calculation lines are untouched", (() => {
  const fn = extractFn("updateAudioFeatures");
  return !!fn
    && fn.includes("S.bass += (tb - S.bass) * a; S.mids += (tm - S.mids) * a; S.highs += (th - S.highs) * a;")
    && fn.includes("S.loudness = Math.min(1, (S.bass * 0.5 + S.mids * 0.35 + S.highs * 0.15));")
    && fn.includes("S.transient = Math.max(S.transient * 0.88, jump > (M.beatThresh || 0.04) ? Math.min(1, jump * 8) : 0);");
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js`
Expected: the first 5 new assertions show `✗`. The last one ("existing ... untouched") already
shows `✓` — it's a baseline check confirming you haven't broken anything yet, not something this
task's own code is expected to make pass.

- [ ] **Step 3: Implement — data model**

Change `elastic-morph.html:2499` from:
```js
  energyAvg: 0, transient: 0,
```
to:
```js
  energyAvg: 0, transient: 0,
  bands: { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, air: 0 }, kickOnset: 0, snareOnset: 0,
```

- [ ] **Step 4: Implement — module variables**

Change `elastic-morph.html:2673` from:
```js
let prevLoud = 0;
```
to:
```js
let prevLoud = 0, prevKick = 0, prevSnare = 0;
```

- [ ] **Step 5: Implement — 6-band + onset calculation**

Change `elastic-morph.html:2693` from:
```js
    prevLoud = prevLoud * 0.7 + S.loudness * 0.3;
    S.energyAvg += (S.loudness - S.energyAvg) * 0.01;
```
to:
```js
    prevLoud = prevLoud * 0.7 + S.loudness * 0.3;
    S.bands.subBass = bandEnergy(20, 60) * g;
    S.bands.bass = bandEnergy(60, 160) * g;
    S.bands.lowMid = bandEnergy(160, 500) * g;
    S.bands.mid = bandEnergy(500, 2000) * g;
    S.bands.highMid = bandEnergy(2000, 6000) * g;
    S.bands.air = bandEnergy(6000, 16000) * g;
    const kickE = (S.bands.subBass + S.bands.bass) * 0.5;
    const kickJump = Math.max(0, kickE - prevKick);
    S.kickOnset = Math.max(S.kickOnset * 0.88, kickJump > (M.beatThresh || 0.04) ? Math.min(1, kickJump * 8) : 0);
    prevKick = prevKick * 0.7 + kickE * 0.3;
    const snareE = (S.bands.mid + S.bands.highMid) * 0.5;
    const snareJump = Math.max(0, snareE - prevSnare);
    S.snareOnset = Math.max(S.snareOnset * 0.88, snareJump > (M.beatThresh || 0.04) ? Math.min(1, snareJump * 8) : 0);
    prevSnare = prevSnare * 0.7 + snareE * 0.3;
    S.energyAvg += (S.loudness - S.energyAvg) * 0.01;
```

Note: `prevKick`/`prevSnare` are updated **after** being read for the jump calculation (same
order as the pre-existing `prevLoud` line above), so each frame's jump is measured against the
*previous* frame's smoothed energy, not the value just written this frame.

- [ ] **Step 6: Implement — paused-branch decay**

Change `elastic-morph.html:2735` from:
```js
    S.bass *= 0.95; S.mids *= 0.95; S.highs *= 0.95; S.loudness *= 0.95;
    S.transient *= 0.9; S.beat *= 0.9; S.stereo *= 0.95;
```
to:
```js
    S.bass *= 0.95; S.mids *= 0.95; S.highs *= 0.95; S.loudness *= 0.95;
    S.transient *= 0.9; S.beat *= 0.9; S.stereo *= 0.95;
    S.bands.subBass *= 0.95; S.bands.bass *= 0.95; S.bands.lowMid *= 0.95; S.bands.mid *= 0.95; S.bands.highMid *= 0.95; S.bands.air *= 0.95;
    S.kickOnset *= 0.9; S.snareOnset *= 0.9;
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `node test.js`
Expected: all 6 assertions from Step 1 show `✓`.

- [ ] **Step 8: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add 6-band audio analysis + kick/snare onset detection"
```

---

### Task 2: Live meter UI in the Audio Mixer panel

**Files:**
- Modify: `elastic-morph.html:1564` (Audio Mixer panel HTML — add the meter canvas)
- Modify: `elastic-morph.html:2740` (`updateAudioFeatures` — call the meter draw function every frame)
- Modify: `elastic-morph.html` (new: `drawBandMeters()` function, placed near `updateAudioFeatures`)
- Test: `test.js`

**Interfaces:**
- Consumes: `S.bands`, `S.kickOnset`, `S.snareOnset` (Task 1).
- Produces: DOM element `#bandMeter` (canvas), function `drawBandMeters()` — no params, no
  return value, reads current `S.bands`/`S.kickOnset`/`S.snareOnset` and redraws the canvas.
  Nothing later depends on this beyond it existing and being called every frame.

- [ ] **Step 1: Write the failing tests**

Append to `test.js`:

```js
section("Frequency-Band Reactivity — live meter UI");

ok("#bandMeter canvas exists in the Audio Mixer panel", html.includes('id="bandMeter"'));

ok("drawBandMeters draws 6 bars from S.bands plus kick/snare onset indicators", (() => {
  const fn = extractFn("drawBandMeters");
  return !!fn
    && fn.includes('$("bandMeter")')
    && fn.includes("S.bands.subBass")
    && fn.includes("S.bands.bass")
    && fn.includes("S.bands.lowMid")
    && fn.includes("S.bands.mid")
    && fn.includes("S.bands.highMid")
    && fn.includes("S.bands.air")
    && fn.includes("S.kickOnset")
    && fn.includes("S.snareOnset");
})());

ok("updateAudioFeatures calls drawBandMeters every frame, regardless of live/idle/paused branch", (() => {
  const fn = extractFn("updateAudioFeatures");
  return !!fn && fn.includes('if (typeof drawBandMeters === "function") drawBandMeters();');
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js`
Expected: all 3 new assertions show `✗`.

- [ ] **Step 3: Implement — HTML meter canvas**

Change `elastic-morph.html:1564` from:
```html
        <div class="opt"><span>Auto-Pegel</span><label class="check" style="flex:1"><input type="checkbox" id="mixAuto"> leise Tracks anheben</label></div>
      </div>
```
to:
```html
        <div class="opt"><span>Auto-Pegel</span><label class="check" style="flex:1"><input type="checkbox" id="mixAuto"> leise Tracks anheben</label></div>
        <div class="opt"><span>Bänder</span>
          <canvas id="bandMeter" width="200" height="30" style="flex:1;border-radius:6px;border:1px solid var(--line)"></canvas>
        </div>
      </div>
```

- [ ] **Step 4: Implement — `drawBandMeters()`**

Add this new function directly after the closing `}` of `bandEnergy()` (`elastic-morph.html:2671`), before `let prevLoud = 0, prevKick = 0, prevSnare = 0;`:

```js
function drawBandMeters() {
  const cv = $("bandMeter"); if (!cv) return;
  const c = cv.getContext("2d"), w = cv.width, h = cv.height;
  c.clearRect(0, 0, w, h);
  const bands = [S.bands.subBass, S.bands.bass, S.bands.lowMid, S.bands.mid, S.bands.highMid, S.bands.air];
  const bw = w / bands.length;
  c.fillStyle = "#b14bff";
  bands.forEach((v, i) => {
    const bh = Math.max(1, v * h);
    c.fillRect(i * bw + 1, h - bh, bw - 2, bh);
  });
  c.fillStyle = S.kickOnset > 0.15 ? "#f87171" : "rgba(248,113,113,0.25)";
  c.beginPath(); c.arc(w - 14, 6, 4, 0, Math.PI * 2); c.fill();
  c.fillStyle = S.snareOnset > 0.15 ? "#fbbf24" : "rgba(251,191,36,0.25)";
  c.beginPath(); c.arc(w - 4, 6, 4, 0, Math.PI * 2); c.fill();
}
```

`#b14bff` matches this file's existing `--accent` CSS custom property value (`elastic-morph.html`
CSS block, `--accent: #b14bff;`) — canvas 2D contexts can't reference CSS custom properties
directly, so the literal is used, kept in sync by eye with the theme color it represents. Red/
amber for the two onset dots are deliberately outside the app's purple/magenta accent range so
they stay visually distinct from the band bars at a glance.

- [ ] **Step 5: Implement — call site**

Change `elastic-morph.html:2740` from:
```js
  S.segIndex = segmentAt(S.progress);
  S.phase = songMap()[S.segIndex].label;
}
```
to:
```js
  S.segIndex = segmentAt(S.progress);
  S.phase = songMap()[S.segIndex].label;
  if (typeof drawBandMeters === "function") drawBandMeters();
}
```

This sits after all three branches (live / idle-demo / paused) join back together, so the meter
updates every frame regardless of playback state — showing real energy while playing, decaying
toward zero when paused (Task 1's paused-branch decay), and staying at its `0` default in
idle-demo mode (where the new fields are never touched at all) — either way the meter reads
"nothing is happening" when nothing is, which is the correct behavior for a live meter.

- [ ] **Step 6: Run tests to verify they pass**

Run: `node test.js`
Expected: all 3 assertions from Step 1 show `✓`. Also re-check the pre-existing "every
$(\"id\") resolves to an element" assertion (Static checks section) still shows `✓`.

- [ ] **Step 7: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add live band-meter UI to the Audio Mixer panel"
```

---

### Task 3: Full regression + manual live-check

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

- [ ] **Step 3: Manual live-check (Pro mode, a demo track with a clear kick/snare pattern — e.g. techno or house)**

In the running app:
1. Open the "Audio Mixer" panel — confirm the new band-meter canvas appears below the existing
   Auto-Pegel checkbox, showing 6 bars.
2. Play the track — confirm the 6 bars react visibly differently to bassline vs. hi-hats/cymbals
   (the sub-bass/bass bars should pulse with the kick and bassline, the mid/high-mid/air bars
   should light up on hi-hats, vocals, and cymbals).
3. Confirm the red kick-indicator dot flashes on kick drum hits, and the amber snare-indicator
   dot flashes on snare/clap hits, without the two constantly firing together (some cross-talk
   on very dense mixes is expected and fine — full separation isn't the goal of this round, per
   the spec's explicit "kick/snare separation, not full spectral-flux onset tracking" scope).
4. Pause the track — confirm the meters settle toward zero within roughly a second (Task 1's
   paused-branch decay) rather than freezing at their last live values.
5. Confirm **no visible change** to any of the 12 Shader Engine styles, Layer B, particles, or
   any other visual — cycle through a few styles while the track plays and compare against the
   pre-feature look. This is the most important check in this task, since the whole point of
   this round is that it's purely additive instrumentation.
6. Note whether the kick/snare threshold (reusing `S.mix`'s existing Beat-Empfindlichkeit
   slider) feels right for the demo track, or whether a dedicated threshold would be worth
   adding in a future round — not something to fix now, per the design spec's explicit
   "no new gain/threshold controls in this round" scope.

No code changes are expected from this step unless Step 3.6 or an unexpected visual regression
in Step 5 surfaces something concrete — if so, that's a follow-up, not part of this plan's scope.
