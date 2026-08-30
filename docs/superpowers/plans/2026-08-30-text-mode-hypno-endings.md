# Text Mode — Hypno Loop + 5 Text Endings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an endless audio-reactive "Hypno Loop" text animation and 5 F-key-triggered
one-shot "Text Ending" out-fades to Elastic Morph's Text Mode.

**Architecture:** Both features live entirely inside `drawTextLayer` (the once-per-frame text
render function) and its nested `paintLine` helper, reusing that function's existing
"resolve one `anim` string into a set of flags, then render" shape — no new rendering pipeline,
no new files. Text Endings pull double duty: their 5 type strings live in the exact same enum
space as the persistent `textAnim` values, they just never appear in the `<select>`, so they run
through the identical `if (anim === ...)` chain and `paintLine` machinery already used for every
other animation, with zero duplicated layout/font/color code.

**Tech Stack:** Vanilla JS, Canvas 2D. No new dependencies.

## Global Constraints

- All edits land directly in `elastic-morph.html`, pre-`@BUILD-INJECT-V58` marker (currently
  line 10591) — **except** one touch point: `drawTextLayer` is wrapped post-marker by
  `patchCanvasTextLiveToggle()`, which is generated from `src/inject-v98.js` on every
  `node build.js` run. That one wrapper must be edited in `src/inject-v98.js`, never by hand in
  the `elastic-morph.html` mirror (the mirror gets silently overwritten back on the next build —
  see `project_morph_build_pipeline_gotcha.md`).
- Line numbers below are fresh as of this plan's writing (2026-08-30, immediately before
  starting) — re-confirm with `grep -n` if more than a few minutes have passed since the last
  edit, this file drifts constantly.
- Test count baseline: running `node test.js` right now prints **587 passed, 0 failed**. Verify
  this by actually running the command, not by grepping for `ok(` occurrences in `test.js` — a
  static grep undercounts because some existing tests generate assertions in a loop. Every task
  below tells you the exact expected printed count after its own tests are added; treat that
  printed number as ground truth.
- Task granularity note: unlike pure-logic features, these edits are one interconnected unit per
  task (a signature change, a flag, a chain branch, and a render block all have to exist together
  before anything is observable) — so each task bundles its source edits into one step rather than
  one-assertion-at-a-time TDD, tests are written and verified immediately after, matching this
  session's established pattern for canvas-rendering features (e.g. the 2026-08-29 FX Rack II
  Pulse Zoom round).
- Two small extractions not literally spelled out in the design spec, added here so both new
  pieces of per-frame math are unit-testable without mocking the Canvas 2D API: the Hypno phase
  accumulator becomes its own top-level function `advanceHypnoPhase(dt)`, and the ending
  completion check becomes its own top-level function `finalizeTextEndingIfDone()`. Both are pure
  reads/writes of `S` (plus one `$("textShow")` DOM read for the checkbox sync) — no `ctx` calls —
  so `loadFns` can execute them directly.

---

## Task 1: Hypno Loop

**Files:**
- Modify: `elastic-morph.html:1278` (textAnim `<select>`), `elastic-morph.html:2889` (`S` default
  state), `elastic-morph.html:5944` (drawTextLayer call site), `elastic-morph.html:7478-7479`
  (new helper + signature), `elastic-morph.html:7500` (flags), `elastic-morph.html:7541-7549`
  (anim chain), `elastic-morph.html:7807-7815`ish (paintLine final `else`, exact text confirmed
  in Step 1 below)
- Modify: `src/inject-v98.js:16-22` (the `drawTextLayer` wrapper)
- Test: `test.js`

**Interfaces:**
- Produces: `S.textHypnoPhase` (number, default `0`); `advanceHypnoPhase(dt)` — top-level
  function, advances and returns `S.textHypnoPhase`, wrapped into `[0, 1)`; `drawTextLayer(W, H,
  hue, P, dt)` — new 5-parameter signature (was 4); a `hypno` boolean flag local to
  `drawTextLayer`/`paintLine`, set when `S.textAnim === "hypno"`.
- Consumes: nothing from later tasks.

- [ ] **Step 1: Re-confirm exact current text at every touch point**

Run, in order, and read the output before editing anything (the file may have drifted even
slightly since this plan was written):

```bash
grep -n '@BUILD-INJECT-V58' elastic-morph.html
grep -n 'textCustom2: "#d946ef"' elastic-morph.html
grep -n '<option value="phases">' elastic-morph.html
grep -n '  drawTextLayer(W, H, hue, P);' elastic-morph.html
grep -n 'function drawTextLayer(W, H, hue, P) {' elastic-morph.html
grep -n 'let scramble = false, scrambleK = 1, depth3d = false;' elastic-morph.html
sed -n '/} else if (anim === "phases") {/,/^  }$/p' elastic-morph.html | head -12
sed -n '/if (depth3d) {   \/\/ fake extruded depth/,/glyph(fill, ax, y);$/p' elastic-morph.html | tail -20
```

Confirm the last command's output ends with this exact shape (it's the tail of `paintLine`'s
final `else` branch — if it differs even slightly, stop and re-read the surrounding 20 lines with
`Read` before proceeding, don't guess):

```js
      if (depth3d) {   // fake extruded depth: dark offset copies behind
        ctx.save(); ctx.shadowBlur = 0;
        for (let k = 6; k >= 1; k--) {
          ctx.globalAlpha = (dim ? alpha * 0.7 : alpha) * 0.13;
          ctx.fillStyle = "rgba(0,0,0,0.65)";
          ctx.fillText(text, ax + k * size * 0.022, y + k * size * 0.022);
        }
        ctx.restore();
      }
      glyph(fill, ax, y);
    }
```

- [ ] **Step 2: Make all 6 source edits**

**A) `S` default state** — find:
```js
  textCustom2: "#d946ef", textGradDir: "h", textPattern: "straight",
```
replace:
```js
  textCustom2: "#d946ef", textGradDir: "h", textPattern: "straight",
  // v134: Hypno loop phase accumulator (persistent, audio-driven — see advanceHypnoPhase)
  textHypnoPhase: 0,
```

**B) `textAnim` dropdown** — find:
```html
            <option value="phases">Intro &amp; Outro only</option>
          </select>
```
replace:
```html
            <option value="phases">Intro &amp; Outro only</option>
            <option value="hypno">Hypno Loop</option>
          </select>
```

**C) New helper + signature** — find:
```js
    document.fonts.load(`${F.tw} 16px "${fam}"`).catch(() => {});
    document.fonts.load(`${F.aw} 16px "${fam}"`).catch(() => {});
  } catch (e) {}
}
function drawTextLayer(W, H, hue, P) {
```
replace:
```js
    document.fonts.load(`${F.tw} 16px "${fam}"`).catch(() => {});
    document.fonts.load(`${F.aw} 16px "${fam}"`).catch(() => {});
  } catch (e) {}
}
// v134: Hypno loop's phase accumulator — driven by dt (not raw S.time), so speed changes from
// S.mids/S.loudness don't cause a visible phase jump. Wraps into [0, 1). Pure S read/write, no
// canvas calls, so it's independently testable.
function advanceHypnoPhase(dt) {
  S.textHypnoPhase = ((S.textHypnoPhase || 0) + dt * (0.18 + S.mids * 0.30 + S.loudness * 0.14)) % 1;
  return S.textHypnoPhase;
}
function drawTextLayer(W, H, hue, P, dt) {
```

**D) Call site** — find:
```js
  drawTextLayer(W, H, hue, P);
```
replace:
```js
  drawTextLayer(W, H, hue, P, dt);
```

**E) Flags declaration** — find:
```js
  let scramble = false, scrambleK = 1, depth3d = false;
```
replace:
```js
  let scramble = false, scrambleK = 1, depth3d = false;
  let hypno = false;
```

**F) Anim chain — new branch after "phases"** — find:
```js
  } else if (anim === "phases") {
    // visible only in the first and last song segment, with soft fades
    const map = songMap(), a = map[0], z = map[map.length - 1];
    let v = 0;
    if (S.progress <= a.b) v = Math.min(1, (a.b - S.progress) / Math.max(0.001, (a.b - a.a) * 0.3));
    else if (S.progress >= z.a) v = Math.min(1, (S.progress - z.a) / Math.max(0.001, (z.b - z.a) * 0.3));
    if (v <= 0.01) return;
    alpha = v;
  }
```
replace:
```js
  } else if (anim === "phases") {
    // visible only in the first and last song segment, with soft fades
    const map = songMap(), a = map[0], z = map[map.length - 1];
    let v = 0;
    if (S.progress <= a.b) v = Math.min(1, (a.b - S.progress) / Math.max(0.001, (a.b - a.a) * 0.3));
    else if (S.progress >= z.a) v = Math.min(1, (S.progress - z.a) / Math.max(0.001, (z.b - z.a) * 0.3));
    if (v <= 0.01) return;
    alpha = v;
  } else if (anim === "hypno") {
    advanceHypnoPhase(dt);
    hypno = true;
  }
```

**G) `paintLine` final `else` — render the echoes** — find the exact block confirmed in Step 1:
```js
      if (depth3d) {   // fake extruded depth: dark offset copies behind
        ctx.save(); ctx.shadowBlur = 0;
        for (let k = 6; k >= 1; k--) {
          ctx.globalAlpha = (dim ? alpha * 0.7 : alpha) * 0.13;
          ctx.fillStyle = "rgba(0,0,0,0.65)";
          ctx.fillText(text, ax + k * size * 0.022, y + k * size * 0.022);
        }
        ctx.restore();
      }
      glyph(fill, ax, y);
    }
```
replace:
```js
      if (depth3d) {   // fake extruded depth: dark offset copies behind
        ctx.save(); ctx.shadowBlur = 0;
        for (let k = 6; k >= 1; k--) {
          ctx.globalAlpha = (dim ? alpha * 0.7 : alpha) * 0.13;
          ctx.fillStyle = "rgba(0,0,0,0.65)";
          ctx.fillText(text, ax + k * size * 0.022, y + k * size * 0.022);
        }
        ctx.restore();
      }
      if (hypno) {   // v134: 4 staggered echoes growing "toward camera" then dissolving, endless loop
        const ECHOES = 4, GROWTH = 1.6;
        ctx.save();
        for (let k = ECHOES - 1; k >= 0; k--) {
          const ep = (((S.textHypnoPhase - k / ECHOES) % 1) + 1) % 1;
          const es = 1 + ep * GROWTH;
          const ea = (dim ? alpha * 0.7 : alpha) * (1 - ep) * (k === 0 ? 1 : 0.6);
          if (ea <= 0.01) continue;
          ctx.save();
          ctx.globalAlpha = ea;
          ctx.translate(ax, y); ctx.scale(es, es); ctx.translate(-ax, -y);
          glyph(fill, ax, y);
          ctx.restore();
        }
        ctx.restore();
      } else {
        glyph(fill, ax, y);
      }
    }
```

**H) `src/inject-v98.js` wrapper** — in that file (NOT the html mirror), find:
```js
    drawTextLayer = function (W, H, hue, P) {
      if (S.textLiveHidden) return;
      return _drawTextLayer(W, H, hue, P);
    };
```
replace:
```js
    drawTextLayer = function (W, H, hue, P, dt) {
      if (S.textLiveHidden) return;
      return _drawTextLayer(W, H, hue, P, dt);
    };
```

- [ ] **Step 3: Regenerate the HTML mirror and confirm it picked up the src/ edit**

```bash
node build.js
grep -n 'drawTextLayer = function (W, H, hue, P, dt)' elastic-morph.html
```
Expected: `✓ Merged ...` and one match (the regenerated post-marker mirror now matches
`src/inject-v98.js`).

- [ ] **Step 4: Write the tests**

Append to `test.js`, right before the `/* ---------------- summary ---------------- */` block, a
new section:

```js
section("Text Mode — Hypno Loop");

ok("drawTextLayer's signature gained a 5th `dt` parameter", (() => {
  return script.includes("function drawTextLayer(W, H, hue, P, dt) {");
})());

ok("the render loop's drawTextLayer call site now passes dt", (() => {
  return script.includes("drawTextLayer(W, H, hue, P, dt);");
})());

ok("src/inject-v98.js's drawTextLayer wrapper threads dt through both its signature and its inner call (this file is regenerated into elastic-morph.html on every build — editing only the html mirror would be silently overwritten)", (() => {
  const src = injectSrc("inject-v98.js");
  return src.includes("drawTextLayer = function (W, H, hue, P, dt) {") &&
         src.includes("return _drawTextLayer(W, H, hue, P, dt);");
})());

ok("S default state has textHypnoPhase: 0", (() => {
  return script.includes("textHypnoPhase: 0");
})());

ok("the textAnim <select> gained a hypno option, scoped to that specific select (not just anywhere in the file)", (() => {
  const m = script.match(/<select id="textAnim">([\s\S]*?)<\/select>/);
  return !!m && m[1].includes('<option value="hypno">Hypno Loop</option>');
})());

ok("advanceHypnoPhase exists, advances S.textHypnoPhase by dt scaled by mids/loudness, and wraps with % 1", (() => {
  const fn = extractFn("advanceHypnoPhase");
  return !!fn && fn.includes("S.textHypnoPhase") && fn.includes("dt *") && fn.includes("S.mids") &&
         fn.includes("S.loudness") && fn.includes("% 1");
})());

ok("the anim === \"hypno\" branch calls advanceHypnoPhase(dt) and sets the hypno flag", (() => {
  const fn = extractFn("drawTextLayer");
  return !!fn && /anim === "hypno"\) \{\s*advanceHypnoPhase\(dt\);\s*hypno = true;/.test(fn);
})());

ok("paintLine renders the hypno echo trail (4 staggered copies, scale grows, alpha fades) inside the same final-else branch depth3d already uses", (() => {
  const fn = extractFn("drawTextLayer");   // paintLine is nested inside drawTextLayer, so its source comes along
  return !!fn && fn.includes("if (hypno) {") && fn.includes("const ECHOES = 4, GROWTH = 1.6;") &&
         fn.includes("S.textHypnoPhase - k / ECHOES");
})());

ok("advanceHypnoPhase keeps S.textHypnoPhase within [0, 1) across many frames of varying dt/mids/loudness (genuine behavioral check, not just a structural text match)", (() => {
  global.S = { textHypnoPhase: 0, mids: 0, loudness: 0 };
  const { advanceHypnoPhase } = loadFns(["advanceHypnoPhase"]);
  let ok2 = true;
  for (let i = 0; i < 500; i++) {
    global.S.mids = Math.random();
    global.S.loudness = Math.random();
    const dt = Math.random() * 0.1;   // up to 100ms, generous frame-time range
    const v = advanceHypnoPhase(dt);
    if (!(v >= 0 && v < 1)) { ok2 = false; break; }
  }
  return ok2;
})());
```

- [ ] **Step 5: Run the tests and confirm the count**

```bash
node test.js
```
Expected: the new "Text Mode — Hypno Loop" section prints 9 lines with `✓`, and the final summary
line reads **`596 passed, 0 failed`** (587 baseline + 9 new). If it doesn't say exactly that,
stop and fix — do not adjust the expected number to match a wrong result.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html src/inject-v98.js test.js
git commit -m "feat(text-mode): add Hypno Loop — endless zoom-tunnel echo animation"
```

---

## Task 2: 5 Text Endings (F1–F5)

**Files:**
- Modify: `elastic-morph.html` — `S` default state (right after Task 1's `textHypnoPhase` line),
  the new helper block (right after Task 1's `advanceHypnoPhase`), `drawTextLayer`'s top
  (ending/anim resolution) and tail (completion call), the flags declaration (right after Task
  1's `hypno` line), the anim chain (right after Task 1's `hypno` branch), the keydown handler,
  the `glitch || chroma` block, and `paintLine`'s per-character chain + final `else`.
- Test: `test.js`

**Interfaces:**
- Consumes: `dt` already threaded through `drawTextLayer`'s signature and call site (Task 1); the
  anim chain's insertion point immediately after Task 1's `hypno` branch; the flags line
  immediately after Task 1's `let hypno = false;`.
- Produces: `S.textEnding` (`{type, t0}` or `null`, default `null`); `TEXT_ENDING_DUR` (top-level
  const, 5 keys); `triggerTextEnding(type)`; `finalizeTextEndingIfDone()`.

- [ ] **Step 1: Re-confirm exact current text at every touch point**

```bash
grep -n 'textHypnoPhase: 0' elastic-morph.html
grep -n 'function advanceHypnoPhase' elastic-morph.html
grep -n 'let hypno = false;' elastic-morph.html
grep -n '} else if (anim === "hypno") {' elastic-morph.html
grep -n 'if (e.key === "Home")' elastic-morph.html
grep -n 'if (glitch || chroma) {' elastic-morph.html
sed -n '/if (scramble) {/,/} else if (wave || bounce) {/p' elastic-morph.html
sed -n '/if (hypno) {   \/\/ v134/,/^    }$/p' elastic-morph.html
```
Read every result before editing — Task 1 must already be committed and its exact wording
confirmed present, since every edit below anchors on text Task 1 introduced.

- [ ] **Step 2: Make all 8 source edits**

**A) `S` default state** — find:
```js
  textHypnoPhase: 0,
```
replace:
```js
  textHypnoPhase: 0,
  // v134: in-flight Text Ending (F1–F5) — {type, t0} while playing, null otherwise
  textEnding: null,
```

**B) New helper block, right after `advanceHypnoPhase`** — find:
```js
function advanceHypnoPhase(dt) {
  S.textHypnoPhase = ((S.textHypnoPhase || 0) + dt * (0.18 + S.mids * 0.30 + S.loudness * 0.14)) % 1;
  return S.textHypnoPhase;
}
```
replace:
```js
function advanceHypnoPhase(dt) {
  S.textHypnoPhase = ((S.textHypnoPhase || 0) + dt * (0.18 + S.mids * 0.30 + S.loudness * 0.14)) % 1;
  return S.textHypnoPhase;
}
// v134: 5 manual Text Endings (F1–F5) — a fixed duration per style, keyed by the same `anim`
// string space drawTextLayer already switches on, but never exposed in the textAnim <select>
// (trigger-only, never a persistent user-selectable style).
const TEXT_ENDING_DUR = { shatter: 0.6, vortexsuck: 1.0, dissolve: 0.9, iris: 0.8, glitchout: 0.5 };

function triggerTextEnding(type) {
  const lyricMode = S.lyrics.on && S.lyrics.cues.length > 0;
  if (lyricMode) return;                                                       // scoped out — see design spec Non-Goals
  if (!S.textShow || (!S.textTitle && !S.textArtist && !S.textLabel)) return;   // nothing visible to end
  S.textEnding = { type, t0: S.time };
}

function finalizeTextEndingIfDone() {
  const ending = S.textEnding;
  if (!ending) return;
  const p = Math.min(1, (S.time - ending.t0) / TEXT_ENDING_DUR[ending.type]);
  if (p < 1) return;
  S.textEnding = null;
  S.textShow = false;
  const cb = $("textShow");
  if (cb) cb.checked = false;
}
```

**C) `drawTextLayer` top — ending/anim resolution** — find:
```js
  // "phases" framing makes no sense for line-by-line lyrics → treat as static
  const anim = (lyricMode && S.textAnim === "phases") ? "static" : S.textAnim;
```
replace:
```js
  // v134: a Text Ending (F1–F5) overrides whatever anim is selected, but never during lyric mode
  // (triggerTextEnding already refuses to start one there — this is defence in depth)
  const ending = !lyricMode ? S.textEnding : null;
  const endingP = ending ? Math.min(1, (S.time - ending.t0) / TEXT_ENDING_DUR[ending.type]) : 0;
  // "phases" framing makes no sense for line-by-line lyrics → treat as static
  const anim = ending ? ending.type : (lyricMode && S.textAnim === "phases") ? "static" : S.textAnim;
```

**D) `drawTextLayer` tail — completion call** — find:
```js
  stackLines.forEach(l => paintLine(l, l.role === "label"));
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
```
replace:
```js
  stackLines.forEach(l => paintLine(l, l.role === "label"));
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  if (ending) finalizeTextEndingIfDone();   // v134: clears S.textEnding + hides text once its fade completes
```

**E) Flags declaration** — find:
```js
  let hypno = false;
```
replace:
```js
  let hypno = false;
  let shatter = false, shatterP = 0, vortex = false, vortexP = 0;
  let dissolveFX = false, dissolveP = 0, irisFX = false, irisP = 0, glitchEndP = 0;
```

**F) Anim chain — 5 new branches after "hypno"** — find:
```js
  } else if (anim === "hypno") {
    advanceHypnoPhase(dt);
    hypno = true;
  }
```
replace:
```js
  } else if (anim === "hypno") {
    advanceHypnoPhase(dt);
    hypno = true;
  } else if (anim === "shatter") {
    shatter = true; shatterP = endingP; alpha = 1 - endingP;
  } else if (anim === "vortexsuck") {
    vortex = true; vortexP = endingP; alpha = 1 - endingP;
  } else if (anim === "dissolve") {
    dissolveFX = true; dissolveP = endingP; alpha = 1 - endingP;
  } else if (anim === "iris") {
    irisFX = true; irisP = endingP; alpha = 1 - endingP;
  } else if (anim === "glitchout") {
    glitch = true; glitchEndP = endingP;
    alpha = (1 - endingP) * (Math.random() < 0.25 + endingP * 0.5 ? 1 : 0.3);
  }
```

**G) Keydown handler — F1–F5** — find:
```js
  if (e.key === "Home") { e.preventDefault(); restart(); }
```
replace:
```js
  if (e.key === "Home") { e.preventDefault(); restart(); }
  // v134: F1–F5 — manual Text Endings (live VJ cue), see triggerTextEnding()
  if (e.key === "F1") { e.preventDefault(); triggerTextEnding("shatter"); }
  if (e.key === "F2") { e.preventDefault(); triggerTextEnding("vortexsuck"); }
  if (e.key === "F3") { e.preventDefault(); triggerTextEnding("dissolve"); }
  if (e.key === "F4") { e.preventDefault(); triggerTextEnding("iris"); }
  if (e.key === "F5") { e.preventDefault(); triggerTextEnding("glitchout"); }
```

**H) `glitch || chroma` split distance** — find:
```js
    if (glitch || chroma) {
      const d = chroma ? (size * 0.03 + (S.highs + S.beat) * size * 0.06) : (size * 0.05 + S.transient * size * 0.1);
```
replace:
```js
    if (glitch || chroma) {
      const d = glitchEndP > 0 ? size * (0.05 + glitchEndP * 0.35)
              : chroma ? (size * 0.03 + (S.highs + S.beat) * size * 0.06)
              : (size * 0.05 + S.transient * size * 0.1);
```

**I) `paintLine` — 3 new per-character branches, inserted between `scramble` and `wave || bounce`**
— find:
```js
        cxp += ctx.measureText(real).width;
      }
      ctx.textAlign = prev;
    } else if (wave || bounce) {
```
(this exact 5-line sequence is unique — it's the closing lines of the `scramble` branch, verified
in Step 1) replace:
```js
        cxp += ctx.measureText(real).width;
      }
      ctx.textAlign = prev;
    } else if (dissolveFX) {
      // v134: reverse of "scramble" — chars increasingly turn to noise and fade, left-to-right
      const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@*+=";
      const prev2 = ctx.textAlign; ctx.textAlign = "left";
      let cxp2 = left;
      for (let i = 0; i < text.length; i++) {
        const real = text[i];
        const thresh = i / Math.max(1, text.length);
        const ch = real === " " || dissolveP < thresh ? real : CH[(Math.random() * CH.length) | 0];
        ctx.fillStyle = solid;
        ctx.fillText(ch, cxp2, y);
        cxp2 += ctx.measureText(real).width;
      }
      ctx.textAlign = prev2;
    } else if (shatter) {
      // v134: each char flies outward on its own deterministic pseudo-random vector
      const prev2 = ctx.textAlign; ctx.textAlign = "left";
      let cxp2 = left;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const seedA = ((i * 9301 + ch.charCodeAt(0) * 49297) % 233280) / 233280;
        const seedB = ((i * 49297 + ch.charCodeAt(0) * 9301 + 1) % 233280) / 233280;
        const ang = seedA * Math.PI * 2;
        const dist = shatterP * shatterP * size * (2.2 + seedB * 1.6);
        const rot = (seedB - 0.5) * shatterP * 2.4;
        const cw = ctx.measureText(ch).width;
        ctx.save();
        ctx.translate(cxp2 + cw / 2 + Math.cos(ang) * dist, y + Math.sin(ang) * dist);
        ctx.rotate(rot);
        ctx.fillStyle = solid; ctx.fillText(ch, -cw / 2, 0);
        ctx.restore();
        cxp2 += cw;
      }
      ctx.textAlign = prev2;
    } else if (vortex) {
      // v134: each char spirals into the line's own anchor point and shrinks to nothing
      const prev2 = ctx.textAlign; ctx.textAlign = "left";
      let cxp2 = left;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const cw = ctx.measureText(ch).width;
        const dxp = (cxp2 + cw / 2 - ax) * (1 - vortexP);
        const spin = vortexP * Math.PI * 3;
        const rx = dxp * Math.cos(spin);
        const ry = dxp * Math.sin(spin);
        const s = Math.max(0.001, 1 - vortexP);
        ctx.save();
        ctx.translate(ax + rx, y + ry);
        ctx.scale(s, s);
        ctx.fillStyle = solid; ctx.fillText(ch, -cw / 2, 0);
        ctx.restore();
        cxp2 += cw;
      }
      ctx.textAlign = prev2;
    } else if (wave || bounce) {
```

(New local variable names `prev2`/`cxp2` deliberately avoid shadowing/reusing `prev`/`cxp` from
the sibling `scramble` branch above — they're `const`/`let` scoped to their own `else if` block so
either naming works, but distinct names make the diff easier to review.)

**J) `paintLine` final `else` — add the Iris clip** — find (this is Task 1's `hypno` addition
from the previous task, confirmed present in Step 1):
```js
      if (hypno) {   // v134: 4 staggered echoes growing "toward camera" then dissolving, endless loop
        const ECHOES = 4, GROWTH = 1.6;
        ctx.save();
        for (let k = ECHOES - 1; k >= 0; k--) {
          const ep = (((S.textHypnoPhase - k / ECHOES) % 1) + 1) % 1;
          const es = 1 + ep * GROWTH;
          const ea = (dim ? alpha * 0.7 : alpha) * (1 - ep) * (k === 0 ? 1 : 0.6);
          if (ea <= 0.01) continue;
          ctx.save();
          ctx.globalAlpha = ea;
          ctx.translate(ax, y); ctx.scale(es, es); ctx.translate(-ax, -y);
          glyph(fill, ax, y);
          ctx.restore();
        }
        ctx.restore();
      } else {
        glyph(fill, ax, y);
      }
    }
```
replace:
```js
      if (hypno) {   // v134: 4 staggered echoes growing "toward camera" then dissolving, endless loop
        const ECHOES = 4, GROWTH = 1.6;
        ctx.save();
        for (let k = ECHOES - 1; k >= 0; k--) {
          const ep = (((S.textHypnoPhase - k / ECHOES) % 1) + 1) % 1;
          const es = 1 + ep * GROWTH;
          const ea = (dim ? alpha * 0.7 : alpha) * (1 - ep) * (k === 0 ? 1 : 0.6);
          if (ea <= 0.01) continue;
          ctx.save();
          ctx.globalAlpha = ea;
          ctx.translate(ax, y); ctx.scale(es, es); ctx.translate(-ax, -y);
          glyph(fill, ax, y);
          ctx.restore();
        }
        ctx.restore();
      } else if (irisFX) {
        // v134: shrinking circular clip — a mechanical shutter closing over the line
        const R = Math.max(0, 1 - irisP) * size * 3.2;
        ctx.save();
        ctx.beginPath(); ctx.arc(ax, y - size * 0.32, R, 0, Math.PI * 2); ctx.clip();
        glyph(fill, ax, y);
        ctx.restore();
      } else {
        glyph(fill, ax, y);
      }
    }
```

- [ ] **Step 3: Write the tests**

Append to `test.js`, right before the `/* ---------------- summary ---------------- */` block:

```js
section("Text Mode — 5 Text Endings (F1–F5)");

ok("TEXT_ENDING_DUR has exactly the 5 expected keys, each a positive number", (() => {
  const fn = script.match(/const TEXT_ENDING_DUR = \{([^}]*)\};/);
  if (!fn) return false;
  const obj = eval("({" + fn[1] + "})");
  const keys = Object.keys(obj);
  return keys.length === 5 &&
         ["shatter", "vortexsuck", "dissolve", "iris", "glitchout"].every(k => k in obj && obj[k] > 0);
})());

ok("triggerTextEnding refuses to start an ending during lyric mode and when nothing is showing", (() => {
  const fn = extractFn("triggerTextEnding");
  return !!fn && fn.includes("S.lyrics.on && S.lyrics.cues.length > 0") && fn.includes("if (lyricMode) return;") &&
         fn.includes("!S.textShow");
})());

ok("the keydown handler has 5 distinct F1–F5 checks calling triggerTextEnding with 5 distinct type strings", (() => {
  const keys = ["F1", "F2", "F3", "F4", "F5"];
  const types = ["shatter", "vortexsuck", "dissolve", "iris", "glitchout"];
  return keys.every((k, i) => script.includes(`e.key === "${k}"`) && script.includes(`triggerTextEnding("${types[i]}")`)) &&
         new Set(types).size === 5;
})());

ok("none of the 5 ending type strings are exposed as a persistent, user-selectable textAnim option", (() => {
  const m = script.match(/<select id="textAnim">([\s\S]*?)<\/select>/);
  if (!m) return false;
  return ["shatter", "vortexsuck", "dissolve", "iris", "glitchout"].every(t => !m[1].includes(`value="${t}"`));
})());

ok("drawTextLayer resolves an active (non-lyric-mode) S.textEnding into `ending`/`endingP`/`anim`", (() => {
  const fn = extractFn("drawTextLayer");
  return !!fn && fn.includes("const ending = !lyricMode ? S.textEnding : null;") &&
         fn.includes("TEXT_ENDING_DUR[ending.type]") &&
         fn.includes("const anim = ending ? ending.type :");
})());

ok("all 5 ending anim-chain branches exist and set alpha to fade toward 0 as endingP grows", (() => {
  const fn = extractFn("drawTextLayer");
  if (!fn) return false;
  return ['anim === "shatter"', 'anim === "vortexsuck"', 'anim === "dissolve"', 'anim === "iris"', 'anim === "glitchout"']
    .every(needle => fn.includes(needle)) && fn.includes("alpha = 1 - endingP") && fn.includes("glitchEndP = endingP");
})());

ok("paintLine has per-character render branches for dissolveFX/shatter/vortex and a clip-based branch for irisFX", (() => {
  const fn = extractFn("drawTextLayer");   // paintLine is nested inside; its source comes along
  return !!fn && fn.includes("} else if (dissolveFX) {") && fn.includes("} else if (shatter) {") &&
         fn.includes("} else if (vortex) {") && fn.includes("} else if (irisFX) {") &&
         fn.includes("ctx.arc(ax, y - size * 0.32, R, 0, Math.PI * 2)");
})());

ok("the glitch/chroma RGB-split distance widens with glitchEndP during Glitch Blackout", (() => {
  const fn = extractFn("drawTextLayer");
  return !!fn && fn.includes("glitchEndP > 0 ? size * (0.05 + glitchEndP * 0.35)");
})());

ok("finalizeTextEndingIfDone exists and drawTextLayer calls it once an ending is active", (() => {
  const hasFn = !!extractFn("finalizeTextEndingIfDone");
  const caller = extractFn("drawTextLayer");
  return hasFn && !!caller && caller.includes("if (ending) finalizeTextEndingIfDone();");
})());

ok("finalizeTextEndingIfDone does nothing before an ending's duration has elapsed, and clears S.textEnding + hides text + syncs the checkbox once it has (genuine behavioral check via mock S/$/checkbox, not a structural text match)", (() => {
  const checkboxStub = { checked: true };
  global.$ = id => (id === "textShow" ? checkboxStub : null);
  global.TEXT_ENDING_DUR = { shatter: 0.6 };
  global.S = { time: 5.0, textEnding: { type: "shatter", t0: 4.5 }, textShow: true };   // elapsed 0.5s of 0.6s
  const { finalizeTextEndingIfDone } = loadFns(["finalizeTextEndingIfDone"]);

  finalizeTextEndingIfDone();
  const notYetDone = global.S.textEnding !== null && global.S.textShow === true && checkboxStub.checked === true;

  global.S.time = 5.2;   // elapsed 0.7s of 0.6s — done
  finalizeTextEndingIfDone();
  const done = global.S.textEnding === null && global.S.textShow === false && checkboxStub.checked === false;

  return notYetDone && done;
})());
```

- [ ] **Step 4: Run the tests and confirm the count**

```bash
node test.js
```
Expected: the new "Text Mode — 5 Text Endings (F1–F5)" section prints 10 lines with `✓`, and the
final summary line reads **`606 passed, 0 failed`** (596 after Task 1 + 10 new). If it doesn't say
exactly that, stop and fix — do not adjust the expected number to match a wrong result.

- [ ] **Step 5: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat(text-mode): add 5 F1–F5 Text Endings (Shatter/Vortex Suck/Dissolve/Iris Close/Glitch Blackout)"
```

---

## After Both Tasks: Live Verification + Push

Not a subagent task — the controller does this directly, per this session's established
protocol:

1. Local dev server: select "Hypno Loop" from the Animation dropdown with text showing, confirm
   the echo trail is visible and loops without ever hard-resetting (watch for at least 2 full
   cycles). Then, with text showing and NOT in lyric mode, press F1 through F5 one at a time
   (waiting for each to finish before the next), confirming: 5 visually distinct fades, the "Show
   text layer" checkbox ends up unchecked after each, and text stays gone until manually
   re-enabled. Then enable lyric sync and confirm F1–F5 are no-ops. Then re-show text and press F1
   followed immediately by F3 (before F1 finishes) — confirm it switches cleanly to Dissolve
   instead of finishing Shatter first or glitching.
2. `git push` (`dangerouslyDisableSandbox: true` — required in this environment, see
   `feedback_git_sandbox_network.md`).
3. Poll `https://elasticmorph.app/elastic-morph.html`, SHA-256 hash against the local file, until
   they match.
4. Update project memory (new file for this round, `MEMORY.md` index line) once hash-confirmed.
