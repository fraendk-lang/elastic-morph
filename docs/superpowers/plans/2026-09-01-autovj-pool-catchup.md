# Auto-VJ Pool Catch-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `autoVjStep()`'s hardcoded 3-style shader pool, and add Particle Mode and Text-Mode
(animation only, never content) to Auto-VJ's random rotation — all three pools self-derived from
their live source of truth so they can never go stale again.

**Architecture:** One fixed line plus two new `if (R() < threshold) { ... }` blocks inside the
existing `autoVjStep()` function, following that function's own established shape exactly.

**Tech Stack:** Vanilla JS, no new dependencies.

## Global Constraints

- All edits land inside `autoVjStep()` in `elastic-morph.html`, no `src/inject-vNN.js`
  involvement.
- Every pool this task adds or fixes derives from its live source of truth at call time
  (`Object.keys(SHADER_STYLE_ID)`, `PM_PATTERNS.map(p => p[0])`, the actual `#pmMirror`/
  `#textAnim` `<select>` options) — never a second hardcoded literal list.
- Text content (`S.textTitle`/`S.textArtist`/`S.textLabel`) is never touched by anything this
  task adds — only which animation style renders existing text.
- Test count baseline: 634 passed, 0 failed (confirmed via an actual `node test.js` run just
  before this plan was written). Required after this task: exactly **638 passed, 0 failed** (634
  + 4 new).

---

## Task 1: Auto-VJ shader/particle/text pool catch-up

**Files:**
- Modify: `elastic-morph.html` (3 edits, all inside `autoVjStep()`, currently starting at line
  10246)
- Test: `test.js`

**Interfaces:** None — self-contained, single task.

- [ ] **Step 1: Re-confirm exact current text**

```bash
grep -n "function autoVjStep" elastic-morph.html
sed -n '10246,10305p' elastic-morph.html
```
Confirm the printed body still contains, verbatim: the `const styles = ["fluid", "metaballs",
"tunnel"];` line inside the shader block, the Layer B block ending in `if (S.layerB.type ===
"starfield") initStars();` immediately followed by the `// FX: curate a FRESH small selection`
comment, and the shader block ending in `if (S.shader.on) initGL();` followed by the function's
closing `}`. If anything differs even slightly, re-read the surrounding ~20 lines with `Read`
before editing — don't guess.

- [ ] **Step 2: Make all 3 edits**

**A) Shader style pool** — find:
```js
    const styles = ["fluid", "metaballs", "tunnel"];
```
replace:
```js
    const styles = Object.keys(SHADER_STYLE_ID);   // v136: derives from the live style set — never goes stale again
```

**B) Particle Mode block, inserted right after the Layer B block** — find:
```js
  if (R() < 0.4) {
    S.layerB.on = R() < 0.7;
    S.layerB.type = pickLayerBType(R);
    $("lbOn").checked = S.layerB.on; $("lbType").value = S.layerB.type;
    if (S.layerB.type === "starfield") initStars();
  }
  // FX: curate a FRESH small selection each step. Toggling used to let additive
```
replace:
```js
  if (R() < 0.4) {
    S.layerB.on = R() < 0.7;
    S.layerB.type = pickLayerBType(R);
    $("lbOn").checked = S.layerB.on; $("lbType").value = S.layerB.type;
    if (S.layerB.type === "starfield") initStars();
  }
  // v136: sometimes randomize Particle Mode — on/off + pattern + mirror + constellation
  // together, same "toggle + retype in one step" shape as the Layer B block above. Both the
  // pattern and mirror pools are read from their live source of truth (PM_PATTERNS / the
  // #pmMirror <select>'s own options) so this can't go stale the way the shader pool did.
  if (R() < 0.4) {
    S.pmode.on = R() < 0.7;
    const patterns = PM_PATTERNS.map(p => p[0]);
    S.pmode.pattern = patterns[Math.floor(R() * patterns.length)];
    const mirrorOpts = [...document.querySelectorAll("#pmMirror option")].map(o => o.value);
    S.pmode.mirror = mirrorOpts[Math.floor(R() * mirrorOpts.length)];
    S.pmode.constellation = R() < 0.35;
    $("pmOn").checked = S.pmode.on; $("pmPattern").value = S.pmode.pattern;
    $("pmMirror").value = S.pmode.mirror; $("pmConstellation").checked = S.pmode.constellation;
    if (S.pmode.on) initPM();
  }
  // FX: curate a FRESH small selection each step. Toggling used to let additive
```

**C) Text Mode animation block, appended at the end of the function** — find:
```js
    $("shOn").checked = S.shader.on; $("shStyle").value = S.shader.style;
    if (S.shader.on) initGL();
  }
}
```
replace:
```js
    $("shOn").checked = S.shader.on; $("shStyle").value = S.shader.style;
    if (S.shader.on) initGL();
  }
  // v136: sometimes reroll the text ANIMATION style only — never touches textTitle/textArtist.
  // Gated on S.textShow (no-op when text display is off). Derived from the live #textAnim
  // <select> options, so it automatically includes hypno and any future addition, and can never
  // include the 5 F1-F5 Text Ending trigger-only strings — those are deliberately never options
  // in that select to begin with.
  if (S.textShow && R() < 0.4) {
    const anims = [...document.querySelectorAll("#textAnim option")].map(o => o.value);
    S.textAnim = anims[Math.floor(R() * anims.length)];
    $("textAnim").value = S.textAnim;
    restartType();
  }
}
```

- [ ] **Step 3: Write the tests**

Append to `test.js`, right before the `/* ---------------- summary ---------------- */` block.
Note on the 4th test: a genuine behavioral run of `autoVjStep()` needs a fairly complete mock
environment, since the function dereferences many globals beyond `S` (`PRESETS`, `ctrl`,
`SHADER_STYLE_ID`, `PM_PATTERNS`, several `sync*`/`init*` functions, `$`, `document`, `fbctx`,
`fbC`). The code below builds that mock in full — don't shortcut it, every field it sets is
something `autoVjStep`'s body actually reads or calls given `Math.random` stubbed to always
return `0.1` (a low value, chosen so every `R() < threshold` branch in the function evaluates
true, including `S.pmode.on = R() < 0.7`):

```js
section("Auto-VJ pool catch-up");

ok("the shader-style pool derives from Object.keys(SHADER_STYLE_ID), not a hardcoded literal — the old 3-item array is gone from autoVjStep", (() => {
  const fn = extractFn("autoVjStep");
  return !!fn && fn.includes("Object.keys(SHADER_STYLE_ID)") && !fn.includes('["fluid", "metaballs", "tunnel"]');
})());

ok("autoVjStep's Particle Mode block derives its pattern pool from PM_PATTERNS and its mirror pool from the live #pmMirror <select>, sets on/pattern/mirror/constellation, and calls initPM() when turning on", (() => {
  const fn = extractFn("autoVjStep");
  return !!fn && fn.includes("S.pmode.on = R() < 0.7;") && fn.includes("PM_PATTERNS.map(p => p[0])") &&
         fn.includes('document.querySelectorAll("#pmMirror option")') && fn.includes("S.pmode.constellation = R() < 0.35;") &&
         fn.includes("if (S.pmode.on) initPM();");
})());

ok("autoVjStep's Text Mode block is gated on S.textShow, derives its pool from the live #textAnim <select>, calls restartType(), and never references textTitle/textArtist/textLabel anywhere in the function", (() => {
  const fn = extractFn("autoVjStep");
  return !!fn && fn.includes("if (S.textShow && R() < 0.4)") && fn.includes('document.querySelectorAll("#textAnim option")') &&
         fn.includes("restartType();") && !fn.includes("textTitle") && !fn.includes("textArtist") && !fn.includes("textLabel");
})());

ok("autoVjStep's Particle Mode block picks a real PM_PATTERNS id when forced into its 'on' branch (genuine behavioral check via loadFns + a full mock environment, not a structural text match)", (() => {
  const shaderStyleIdSrc = (script.match(/const SHADER_STYLE_ID = (\{[^}]+\});/) || [])[1];
  global.SHADER_STYLE_ID = shaderStyleIdSrc ? eval("(" + shaderStyleIdSrc + ")") : {};
  const pmPatternsSrc = (script.match(/const PM_PATTERNS = (\[[\s\S]*?\]);/) || [])[1];
  global.PM_PATTERNS = pmPatternsSrc ? eval(pmPatternsSrc) : [];

  function extractOptionValues(id) {
    const m = html.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)</select>`));
    return m ? [...m[1].matchAll(/value="(\w+)"/g)].map(x => x[1]) : [];
  }
  const pmMirrorOpts = extractOptionValues("pmMirror");
  const textAnimOpts = extractOptionValues("textAnim");
  global.document = {
    querySelectorAll: sel => {
      if (sel === "#pmMirror option") return pmMirrorOpts.map(v => ({ value: v }));
      if (sel === "#textAnim option") return textAnimOpts.map(v => ({ value: v }));
      return [];
    }
  };
  const stubEl = () => ({ value: "", checked: false, textContent: "", classList: { toggle() {} } });
  global.$ = () => stubEl();
  global.PRESETS = [{ id: "p1" }, { id: "p2" }];
  global.ctrl = { morph: 0.5, colorDrift: 0.5, camDrift: 0.5, density: 0.5, pulse: 0.5 };
  global.updateBadge = () => {};
  global.spawnParticles = () => {};
  global.pickLayerBType = () => "moire";
  global.initStars = () => {};
  global.syncSliderUI = () => {};
  global.syncFXUI = () => {};
  global.syncFX2UI = () => {};
  global.syncFX3UI = () => {};
  global.initGL = () => {};
  global.initPM = () => {};
  global.restartType = () => {};
  global.fbctx = { clearRect() {} };
  global.fbC = { width: 10, height: 10 };
  global.S = {
    blendWith: null, blendAmt: 0,
    layerB: { on: false, type: "moire" },
    fx: { mirror: false, kaleido: false, tile: false, rgb: false, invert: false, pixelate: false, glitch: false, shake: false, feedback: false, strobe: false },
    fx2: { hexkaleido: false, droste: false, mirrorgrid: false, slice: false, spin: false, halftone: false, pulsezoom: false, posterize: false, radialblur: false, echospin: false },
    fx3: { scanlines: false, motionblur: false, letterbox: false, chromafringe: false, anamorphflare: false, bleachpulse: false, doubleexposure: false, dustscratches: false, lensflare: false, lightleak: false },
    shader: { on: false, style: "fluid" },
    pmode: { on: false, pattern: "hyperspace", mirror: "off", constellation: false },
    textShow: true, textAnim: "static",
    autoVJ: { on: true, t: 0, intensity: 1 }
  };

  const origRandom = Math.random;
  Math.random = () => 0.1;
  try {
    const { autoVjStep } = loadFns(["autoVjStep"]);
    autoVjStep();
  } finally {
    Math.random = origRandom;
  }

  const realPatternIds = global.PM_PATTERNS.map(p => p[0]);
  return global.S.pmode.on === true && realPatternIds.includes(global.S.pmode.pattern);
})());
```

- [ ] **Step 4: Run the tests and confirm the count**

```bash
node test.js
```
Expected: the new "Auto-VJ pool catch-up" section prints 4 lines with `✓`, and the final summary
line reads **`638 passed, 0 failed`** (634 baseline + 4 new). If it doesn't say exactly that, stop
and fix — do not adjust the expected number to match a wrong result.

- [ ] **Step 5: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat(auto-vj): catch up shader/particle/text pools to the app's current feature set"
```

---

## After the Task: Live Verification + Push

Not a subagent task — the controller does this directly:

1. Local dev server (verify served content freshness before trusting it — see
   `project_morph_second_local_checkout.md` memory; go straight to a manually-started `npx serve`
   from a `lsof`-confirmed correct `cwd`).
2. Call `autoVjStep()` directly many times (bypassing the wait timer) and tally which shader
   styles, particle patterns, and text anims actually get selected — confirm all 17 shader
   styles, all 11 particle patterns, and every `#textAnim` option appear at least once over enough
   iterations. Confirm `S.textTitle`/`S.textArtist` never change across any of those calls.
   Confirm no console errors from any newly-reachable combination (e.g. Particle Mode on
   simultaneously with the `warpTunnel` shader style).
3. `git push` (`dangerouslyDisableSandbox: true`).
4. Poll `https://elasticmorph.app/elastic-morph.html`, SHA-256 hash against the local file, until
   they match.
5. Update project memory once hash-confirmed.
