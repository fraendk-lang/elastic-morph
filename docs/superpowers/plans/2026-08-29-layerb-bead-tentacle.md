# Layer B Bead Tentacle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 20th Layer B type, `tentacle` ("Bead Tentacle") — a single glowing bead-chain that swims across the screen and counter-rotates against Layer B's own shared spin for a parallax depth cue, per the approved design spec.

**Architecture:** One new entry in the existing `LAYERB_TYPES` array and one new `case "tentacle":` block inside `drawLayerB`'s existing switch (`elastic-morph.html`). No new files, no new subsystems, no shared-code changes — purely additive, following the exact pattern of the 3 most recent Layer B types (`isoGrid`/`voronoi`/`moire`).

**Tech Stack:** Vanilla JS, Canvas 2D (`ctx`). Zero-dependency test harness (`test.js`, `node test.js`).

## Global Constraints

- All touched code lives before the `@BUILD-INJECT-V58` marker in `elastic-morph.html` (currently line 10540 — re-confirm with `grep -n "@BUILD-INJECT-V58" elastic-morph.html` before editing, since it drifts as the file grows) — edit `elastic-morph.html` directly, never a `src/inject-vNN.js` file, for this feature.
- The counter-rotation mechanism is exactly `ctx.rotate(-2 * baseRot)` around the shared center — this cancels the layer's own `+baseRot` and replaces it with `-baseRot`. Do not use `-baseRot` alone (that would only zero the rotation, not reverse it).
- Audio reactivity is beat-pulse only (`S.beat`). Do not couple motion speed or size to `S.bass`/`S.loudness`/`S.mids` — that was explicitly descoped by Frank during brainstorming.
- One tentacle only (not multiple simultaneous chains) — explicitly descoped.
- No `Math.random()` or any per-frame accumulated/history state (e.g. no follow-the-leader chain simulation) — the shape must be a pure function of `S.time`/`dt`, matching every other Layer B type's export-determinism requirement.
- `tentacle` must NOT be added to `LAYERB_GENERIC` (`elastic-morph.html:6343`) — it's a "distinctive" type and should keep the Auto-VJ 2x selection weight, matching `constellation`/`helix`/`isoGrid`/`voronoi`/`moire`.
- Never call `drawScene()` or `drawLayerB()` manually during live verification — a malformed manual call can throw and silently freeze the render loop forever via the sticky `S._frameErrLogged` guard (hit during the Cosmic Drift final-review round). Only ever set state (`S.layerB.on`, `S.layerB.type`, etc.) and let the existing `frame()` rAF loop redraw on its own.

---

### Task 1: Add the `tentacle` Layer B type (data + case + tests)

**Files:**
- Modify: `elastic-morph.html:6319-6340` (`LAYERB_TYPES` array)
- Modify: `elastic-morph.html:6751-6770` (`drawLayerB`'s switch — insert new case after `"moire"`)
- Test: `test.js` (append a new section before the final `/* ---------------- summary ---------------- */` block)

**Interfaces:**
- Consumes: `drawLayerB(W, H, hue, dt)`'s existing in-scope locals at the point of the switch — `mn` (`Math.min(W,H)`), `sc` (scale factor), `cx`/`cy` (center), `baseRot` (shared rotation), `colr(t, a)` (color helper), plus globals `S.time`, `S.beat`, `S.highs`. All confirmed already in scope by reading `elastic-morph.html:6371-6446` — no new parameters or globals needed.
- Produces: the string id `"tentacle"` becomes a valid value for `S.layerB.type`, selectable via the existing `<select id="lbType">` dropdown (populated purely from `LAYERB_TYPES` by `buildLayerB()` — no separate UI markup needed) and via Auto-VJ's `pickLayerBType()` (weighted 2x since `tentacle` is absent from `LAYERB_GENERIC`, exactly like its neighbors).

- [ ] **Step 1: Re-confirm insertion points are unchanged**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
grep -n "@BUILD-INJECT-V58" elastic-morph.html
grep -n "const LAYERB_TYPES = \[" elastic-morph.html
grep -n "case \"moire\"" elastic-morph.html
grep -n "LAYERB_GENERIC = new Set" elastic-morph.html
```

Expected: marker well after 6340/6770 range; `LAYERB_TYPES` and `case "moire"` at (or near) the lines below. If line numbers differ from this plan, re-read the surrounding ~30 lines at the new location before editing — do not assume the plan's exact line numbers still apply.

- [ ] **Step 2: Add `tentacle` as the 20th entry in `LAYERB_TYPES`**

In `elastic-morph.html`, find:

```js
const LAYERB_TYPES = [
  ["spectrumRing", "Spectrum Ring"],
  ["grid",         "Grid Pulse"],
  ["tunnel",       "Tunnel"],
  ["waveform",     "Waveform"],
  ["starfield",    "Starfield"],
  ["lissajous",    "Lissajous"],
  ["bars",         "Spectrum Bars"],
  ["rays",         "Light Rays"],
  ["gridwave",     "Grid Wave"],
  ["spiral",       "Spiral"],
  /* v40: richer overlays */
  ["radialWave",   "Radial Waveform"],
  ["constellation","Constellation"],
  ["pulseRings",   "Pulse Rings"],
  ["helix",        "DNA Helix"],
  ["hexgrid",      "Hex Grid"],
  ["orbits",   "Orbits"],
  ["isoGrid",  "Iso-Grid"],
  ["voronoi",  "Voronoi"],
  ["moire",    "Moiré"]
];
```

Replace the closing `];` line so the array reads:

```js
const LAYERB_TYPES = [
  ["spectrumRing", "Spectrum Ring"],
  ["grid",         "Grid Pulse"],
  ["tunnel",       "Tunnel"],
  ["waveform",     "Waveform"],
  ["starfield",    "Starfield"],
  ["lissajous",    "Lissajous"],
  ["bars",         "Spectrum Bars"],
  ["rays",         "Light Rays"],
  ["gridwave",     "Grid Wave"],
  ["spiral",       "Spiral"],
  /* v40: richer overlays */
  ["radialWave",   "Radial Waveform"],
  ["constellation","Constellation"],
  ["pulseRings",   "Pulse Rings"],
  ["helix",        "DNA Helix"],
  ["hexgrid",      "Hex Grid"],
  ["orbits",   "Orbits"],
  ["isoGrid",  "Iso-Grid"],
  ["voronoi",  "Voronoi"],
  ["moire",    "Moiré"],
  ["tentacle", "Bead Tentacle"]
];
```

(Only the added last line and the trailing comma after `"Moiré"]` change — everything else stays byte-identical.)

- [ ] **Step 3: Add the `case "tentacle":` block to `drawLayerB`'s switch**

In `elastic-morph.html`, find the end of the `"moire"` case and the switch's closing brace:

```js
    case "moire": {
      const spacing = mn * 0.012 * sc, phase = S.time * 0.15;
      const drawLines = (angle, offset, alpha) => {
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(angle); ctx.translate(-cx, -cy);
        ctx.strokeStyle = colr(angle, alpha);
        ctx.lineWidth = Math.max(1, mn * 0.0012);
        const n = Math.ceil((W + H) / spacing) + 2;
        for (let i = -n; i < n; i++) {
          const x = i * spacing + offset;
          ctx.beginPath(); ctx.moveTo(x, -H); ctx.lineTo(x, H * 2); ctx.stroke();
        }
        ctx.restore();
      };
      const wobble = Math.sin(phase) * 0.06 + S.bass * 0.03;
      drawLines(0.02 + wobble, 0, 0.22 + S.beat * 0.15);
      drawLines(-0.02 - wobble, spacing * 0.5, 0.18 + S.mids * 0.15);
      break;
    }
  }
```

Replace it with (new case inserted between `case "moire"`'s closing `break; }` and the switch's closing `}`):

```js
    case "moire": {
      const spacing = mn * 0.012 * sc, phase = S.time * 0.15;
      const drawLines = (angle, offset, alpha) => {
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(angle); ctx.translate(-cx, -cy);
        ctx.strokeStyle = colr(angle, alpha);
        ctx.lineWidth = Math.max(1, mn * 0.0012);
        const n = Math.ceil((W + H) / spacing) + 2;
        for (let i = -n; i < n; i++) {
          const x = i * spacing + offset;
          ctx.beginPath(); ctx.moveTo(x, -H); ctx.lineTo(x, H * 2); ctx.stroke();
        }
        ctx.restore();
      };
      const wobble = Math.sin(phase) * 0.06 + S.bass * 0.03;
      drawLines(0.02 + wobble, 0, 0.22 + S.beat * 0.15);
      drawLines(-0.02 - wobble, spacing * 0.5, 0.18 + S.mids * 0.15);
      break;
    }
    case "tentacle": {
      // v129: Bead Tentacle — a single glowing bead-chain that swims across the
      // screen. Counter-rotates against the shared baseRot (-2*baseRot cancels
      // the layer's own +baseRot and replaces it with -baseRot) for the
      // parallax depth cue from the TAS Visuals reference video.
      const N = 30;
      const span = mn * 1.5 * sc;                 // overshoots both edges -> reads as endless
      const amp = mn * 0.14 * sc;
      const t0 = S.time * 0.35;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-2 * baseRot);
      ctx.translate(-cx, -cy);
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const x = cx + (t - 0.5) * span;
        const y = cy
          + Math.sin(t * 5.5 - t0 * 2.2) * amp
          + Math.sin(t * 2.3 + t0 * 1.1) * amp * 0.5;
        pts.push({ x, y, t });
      }
      ctx.lineWidth = Math.max(1.6, mn * 0.005);
      ctx.strokeStyle = colr(0.5, 0.35 + S.highs * 0.15);
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
      for (const p of pts) {
        const pulse = 1 + S.beat * 0.5;
        ctx.fillStyle = colr(p.t, 0.55 + S.beat * 0.35);
        ctx.shadowBlur = 8 + S.beat * 10;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(p.x, p.y, mn * 0.008 * sc * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
      break;
    }
  }
```

- [ ] **Step 4: Write the tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert a new section immediately before it (i.e. directly above the `/* ---------------- summary ---------------- */` comment):

```js
/* ---------------- Layer B: Bead Tentacle ---------------- */
section("Layer B — Bead Tentacle");

ok("LAYERB_TYPES gained the tentacle entry as its 20th element", (() => {
  const m = script.match(/const LAYERB_TYPES = \[([\s\S]*?)\];/);
  if (!m) return false;
  const body = m[1];
  const entries = body.match(/\[".*?",\s*".*?"\]/g) || [];
  return entries.length === 20
    && body.includes('["tentacle", "Bead Tentacle"]')
    && entries[entries.length - 1].includes('"tentacle"');
})());

ok("drawLayerB has a case for tentacle positioned after case \"moire\" and before the switch closes", (() => {
  const fn = extractFn("drawLayerB");
  if (!fn) return false;
  const moireIdx = fn.indexOf('case "moire":');
  const tentacleIdx = fn.indexOf('case "tentacle":');
  return moireIdx >= 0 && tentacleIdx > moireIdx;
})());

ok("tentacle's counter-rotation cancels and reverses the shared baseRot (-2 * baseRot, not just -baseRot)", (() => {
  const fn = extractFn("drawLayerB");
  return !!fn && fn.includes('case "tentacle": {') && fn.includes("ctx.rotate(-2 * baseRot);");
})());

ok("tentacle is beat-reactive (S.beat) without bass/loudness motion-coupling (matches the approved beat-only scope)", (() => {
  const fn = extractFn("drawLayerB");
  if (!fn) return false;
  const startIdx = fn.indexOf('case "tentacle": {');
  const endIdx = fn.indexOf("\n    }", startIdx);
  if (startIdx < 0 || endIdx < 0) return false;
  const body = fn.slice(startIdx, endIdx);
  return body.includes("S.beat") && !body.includes("S.bass") && !body.includes("S.loudness");
})());

ok("tentacle's shape is a pure function of S.time/dt — no Math.random, no accumulated per-frame state", (() => {
  const fn = extractFn("drawLayerB");
  if (!fn) return false;
  const startIdx = fn.indexOf('case "tentacle": {');
  const endIdx = fn.indexOf("\n    }", startIdx);
  if (startIdx < 0 || endIdx < 0) return false;
  const body = fn.slice(startIdx, endIdx);
  return !body.includes("Math.random");
})());

ok("LAYERB_GENERIC excludes tentacle (keeps the 2x Auto-VJ selection weight given to distinctive types)", (() => {
  const m = script.match(/const LAYERB_GENERIC = new Set\(\[([^\]]*)\]\);/);
  if (!m) return false;
  return !m[1].includes('"tentacle"');
})());
```

- [ ] **Step 5: Run the tests**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
node test.js 2>&1 | tail -20
```

Expected: all 6 new assertions under "Layer B — Bead Tentacle" print `✓`, and the final line reads `N passed, 0 failed` (N = previous total + 6, no failures).

- [ ] **Step 6: Run the full build+test pipeline**

```bash
npm run ci 2>&1 | tail -15
```

Expected: `node build.js` completes without error, then `node test.js` reports the same `N passed, 0 failed` as Step 5 (the build step regenerates the post-marker portion of `elastic-morph.html`; since this task's edits are entirely before `@BUILD-INJECT-V58`, `git diff --stat elastic-morph.html` afterward should show only Task 1's own hand-edits, no unexpected drift).

```bash
git diff --stat elastic-morph.html
```

Expected: the diff stat reflects only the `LAYERB_TYPES` line addition and the new `case "tentacle"` block (no changes past the marker).

- [ ] **Step 7: Commit**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
git add elastic-morph.html test.js
git commit -m "feat(layer-b): add Bead Tentacle type with counter-rotation depth cue

New Layer B type 'tentacle' (Bead Tentacle) — a single glowing bead-chain
that swims across the screen, counter-rotating against the shared baseRot
(-2*baseRot) for a parallax depth cue. Second and final element from the
TAS Visuals reference video (Cosmic Drift shipped the first).

Per docs/superpowers/specs/2026-08-29-layerb-bead-tentacle-design.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Live verification and ship

**Files:** None modified — this task verifies Task 1's work in a real browser and ships it.

**Interfaces:**
- Consumes: `S.layerB.on`, `S.layerB.type`, `S.layerB.spin` (existing state fields), the `frame()` rAF loop (`elastic-morph.html:5140`, already running unconditionally — do not call `drawScene`/`drawLayerB` directly, see Global Constraints).

- [ ] **Step 1: Start a dev server serving the current working tree**

```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
npx --yes serve -l 8935 "$(pwd)" > /tmp/serve-bead-tentacle.log 2>&1 &
sleep 3
curl -sL -o /tmp/bead-tentacle-check.html http://localhost:8935/elastic-morph.html
wc -c /tmp/bead-tentacle-check.html elastic-morph.html
```

Expected: both byte counts match exactly. If they don't, the server is stale — kill it (`pkill -f "serve -l 8935"`) and retry; do not proceed against stale content.

- [ ] **Step 2: Open the Browser pane and navigate to the served app**

Navigate to `http://localhost:8935/elastic-morph.html`.

- [ ] **Step 3: Enable tentacle and let the existing render loop redraw**

Run via the browser's JS execution tool — set state only, never call `drawScene`/`drawLayerB` manually:

```js
S.layerB.on = true;
S.layerB.type = "tentacle";
await new Promise(r => setTimeout(r, 500));
({ frameErrLogged: S._frameErrLogged, type: S.layerB.type })
```

Expected: `frameErrLogged` is `undefined`/falsy and `type` is `"tentacle"`. If `frameErrLogged` is ever `true` at any point in this task, reload the page fresh before continuing — a stuck render loop makes every subsequent sample meaningless (this exact failure mode hit the Cosmic Drift final-review verification).

- [ ] **Step 4: Confirm the shape renders and animates (not blank, not frozen)**

```js
function sampleCanvas() {
  const c = document.getElementById('canvas');
  const ctx = c.getContext('2d');
  const img = ctx.getImageData(0,0,c.width,c.height).data;
  let sum=0, n=0;
  for (let i=0;i<img.length;i+=4) { sum += 0.299*img[i]+0.587*img[i+1]+0.114*img[i+2]; n++; }
  return sum/n;
}
const s1 = sampleCanvas();
await new Promise(r => setTimeout(r, 800));
const s2 = sampleCanvas();
({ s1, s2, animating: s1 !== s2, frameErrLogged: S._frameErrLogged })
```

Expected: `s1` and `s2` are both non-zero (not a blank black frame) and different from each other (confirms real animation, not a frozen canvas); `frameErrLogged` still falsy.

- [ ] **Step 5: Confirm the counter-rotation is real — compare against `helix` under the same forced spin**

```js
S.layerB.spin = 1;
S.layerB.type = "helix";
await new Promise(r => setTimeout(r, 1200));
function sampleCanvas() {
  const c = document.getElementById('canvas');
  const ctx = c.getContext('2d');
  const img = ctx.getImageData(0,0,c.width,c.height).data;
  let sum=0, n=0;
  for (let i=0;i<img.length;i+=4) { sum += 0.299*img[i]+0.587*img[i+1]+0.114*img[i+2]; n++; }
  return sum/n;
}
const helixA = sampleCanvas();
await new Promise(r => setTimeout(r, 600));
const helixB = sampleCanvas();
S.layerB.type = "tentacle";
await new Promise(r => setTimeout(r, 1200));
const tentA = sampleCanvas();
await new Promise(r => setTimeout(r, 600));
const tentB = sampleCanvas();
({ helixChanged: helixA !== helixB, tentChanged: tentA !== tentB, frameErrLogged: S._frameErrLogged })
```

Expected: both `helixChanged` and `tentChanged` are `true` (both types are visibly animating under the forced spin — direct visual confirmation that the two rotate differently requires eyeballing a screenshot, since pixel-mean alone can't prove *direction*; take a screenshot in this step too and visually confirm the tentacle's overall sweep direction looks opposite to helix's under the same spin value). `frameErrLogged` still falsy.

- [ ] **Step 6: Confirm beat-pulse changes bead size/alpha**

```js
S.layerB.spin = 0.3;   // restore a normal spin value
S.beat = 0;
await new Promise(r => setTimeout(r, 300));
function sampleCanvas() {
  const c = document.getElementById('canvas');
  const ctx = c.getContext('2d');
  const img = ctx.getImageData(0,0,c.width,c.height).data;
  let sum=0, n=0;
  for (let i=0;i<img.length;i+=4) { sum += 0.299*img[i]+0.587*img[i+1]+0.114*img[i+2]; n++; }
  return sum/n;
}
const beatOff = sampleCanvas();
S.beat = 1;
await new Promise(r => setTimeout(r, 300));
const beatOn = sampleCanvas();
({ beatOff, beatOn, differs: beatOff !== beatOn })
```

Expected: `differs: true` (brighter/larger beads at `S.beat = 1` measurably change the mean pixel value).

- [ ] **Step 7: Confirm non-`off` mirror settings still render without error**

```js
S.layerB.mirror = "quad";
await new Promise(r => setTimeout(r, 500));
const quadOk = !S._frameErrLogged;
S.layerB.mirror = "oct";
await new Promise(r => setTimeout(r, 500));
const octOk = !S._frameErrLogged;
S.layerB.mirror = "off";
({ quadOk, octOk })
```

Expected: both `true`.

- [ ] **Step 8: Check console for new errors**

Use the Browser pane's console-reading tool. Expected: no new errors attributable to this change (pre-existing unrelated warnings, e.g. the `willReadFrequently` Canvas2D hint, are fine).

- [ ] **Step 9: Stop the dev server**

```bash
pkill -f "serve -l 8935" 2>/dev/null; true
```

- [ ] **Step 10: Push and hash-confirm live**

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

Expected: `MATCH` within the retry window (deploy propagation typically lands within 1-2 minutes on this project).

- [ ] **Step 11: Update the shared progress ledger**

Append to `.superpowers/sdd/progress.md`:

```
=== Plan: 2026-08-29-layerb-bead-tentacle.md ===
Task 1: complete (commit <hash>, tests <N passed>/0 failed)
Task 2: complete — live-verified (tentacle renders + animates, counter-rotation visually confirmed vs helix under forced spin, beat-pulse confirmed via pixel delta, mirror quad/oct render without error, 0 new console errors). Pushed <hash>, hash-confirmed live.
layerb-bead-tentacle: FULLY SHIPPED. Closes the TAS Visuals reference-video brainstorm (both elements — Cosmic Drift + Bead Tentacle — now shipped).
```

Fill in the actual commit hashes and test counts from Steps 7 (Task 1) and this task's push.

---

## Post-plan note for whoever runs this

This is a small, single-round, single-file-touching feature — no final whole-branch review is mandated by this plan (the pattern used for larger multi-task rounds this session). If Task 2's live verification surfaces anything unexpected (visual glitch, console error, counter-rotation not reading as intended), treat it as a normal bug: fix directly, re-verify, re-push, following this session's established practice of fixing Critical/Important issues without re-asking Frank unless it's a genuine design tradeoff.
