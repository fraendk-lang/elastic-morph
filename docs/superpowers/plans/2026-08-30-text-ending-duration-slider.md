# Text Ending Duration Slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one slider ("Ending-Dauer", 50–200%, default 140%) to the Text panel that scales all
5 Text Endings' (F1–F5) durations uniformly, live, including mid-ending.

**Architecture:** A single new `S.textEndingScale` field (float, default `1.4`) and one small
helper, `textEndingDuration(type)`, that both existing readers of the fixed `TEXT_ENDING_DUR`
table switch to. Everything else is the codebase's established slider-control wiring (markup +
listener + 2 project save/load touch points), copied from the existing `textSize` slider's exact
shape.

**Tech Stack:** Vanilla JS, no new dependencies.

## Global Constraints

- All edits land pre-`@BUILD-INJECT-V58` marker (currently line 10733) in `elastic-morph.html` —
  confirmed via fresh grep this round that zero `src/inject-vNN.js` files reference
  `TEXT_ENDING_DUR`/`textEndingScale`/`textEndingDuration`, so there is no post-marker-wrapper
  concern this round (unlike the immediately preceding Hypno Loop round).
- Line numbers below are fresh as of this plan's writing (2026-08-30, moments before starting) —
  re-confirm with `grep -n` if time has passed, this file drifts constantly.
- Test count baseline: running `node test.js` right now prints **606 passed, 0 failed** —
  confirmed via an actual run, not a static grep (a prior round found `grep -c '^ok("'` undercounts
  this file's true assertion count). After this task's 11 new assertions: **617 passed, 0 failed**.
- **`html` vs `script` in test.js**: `script` (test.js:12) is the JS-only content of the one
  `<script>` tag with all HTML stripped out — it can never contain `<input>`/`<span>` markup. Any
  test asserting on raw HTML markup (the new slider's `<input>`/`<span>` tags) MUST use `html`
  (test.js:11), never `script`. Any test asserting on JS logic (function bodies, object literals
  inside the script) uses `script`/`extractFn` as normal. This exact mixup happened in both tasks
  of the immediately preceding round (self-caught both times) — get it right the first time here.
- Task granularity note: this is one small, tightly-coupled unit (one new setting threaded through
  9 touch points in 2 files) — bundled into one task with all source edits in one step, tests
  written and verified immediately after, matching this session's established pattern for this
  class of feature.

---

## Task 1: Ending Duration Slider

**Files:**
- Modify: `elastic-morph.html` at 9 locations (see steps below)
- Test: `test.js`

**Interfaces:**
- Produces: `S.textEndingScale` (float, default `1.4`); `textEndingDuration(type)` — top-level
  function, returns `TEXT_ENDING_DUR[type] * (S.textEndingScale || 1)`.
- Consumes: nothing from other tasks (this is the only task in this plan).

- [ ] **Step 1: Re-confirm exact current text at every touch point**

```bash
grep -n '@BUILD-INJECT-V58' elastic-morph.html
grep -rln 'TEXT_ENDING_DUR\|textEndingScale\|textEndingDuration' src/
sed -n '1305,1311p' elastic-morph.html
grep -n 'textEnding: null,' elastic-morph.html
grep -n 'const TEXT_ENDING_DUR' elastic-morph.html
grep -n 'const endingP = ending' elastic-morph.html
sed -n '/function finalizeTextEndingIfDone/,/^}/p' elastic-morph.html
sed -n '/\$("textSize")\.addEventListener/,/^});/p' elastic-morph.html
grep -n 'custom2: S.textCustom2, gradDir: S.textGradDir' elastic-morph.html
grep -n 'S.textBlend = t.blend || "source-over"' elastic-morph.html
sed -n '/\$("textStyle")\.value = S.textStyle;/,/\$("textLabel")\.value = S.textLabel;/p' elastic-morph.html
```

The second command (`grep -rln` over `src/`) must print nothing — if it prints a filename, stop
and re-read that file before proceeding, something changed since this plan was written. Read every
other result and confirm it matches the code shown in Step 2 below before editing — don't guess.

- [ ] **Step 2: Make all 9 source edits**

**A) New slider markup, right after "Size"** — find:
```html
        <div class="opt"><span>Size</span>
          <input type="range" id="textSize" min="50" max="400" value="100">
          <span class="val" id="textSizeVal">100%</span>
        </div>
        <div class="opt"><span>Shadow</span>
```
replace:
```html
        <div class="opt"><span>Size</span>
          <input type="range" id="textSize" min="50" max="400" value="100">
          <span class="val" id="textSizeVal">100%</span>
        </div>
        <div class="opt"><span>Ending-Dauer</span>
          <input type="range" id="textEndingScale" min="50" max="200" value="140">
          <span class="val" id="textEndingScaleVal">140%</span>
        </div>
        <div class="opt"><span>Shadow</span>
```

**B) `S` default state** — find:
```js
  textEnding: null,
```
replace:
```js
  textEnding: null,
  // v135: live-adjustable multiplier on all 5 Text Endings' base durations (F1-F5) —
  // 1.0 = TEXT_ENDING_DUR's original values, default raised to 1.4 per Frank's "too fast" feedback
  textEndingScale: 1.4,
```

**C) New helper, right after `TEXT_ENDING_DUR`** — find:
```js
const TEXT_ENDING_DUR = { shatter: 0.6, vortexsuck: 1.0, dissolve: 0.9, iris: 0.8, glitchout: 0.5 };
```
replace:
```js
const TEXT_ENDING_DUR = { shatter: 0.6, vortexsuck: 1.0, dissolve: 0.9, iris: 0.8, glitchout: 0.5 };
// v135: the base table above stays fixed (each ending's relative "character" — Glitch Blackout
// short and hard vs. Vortex Suck slow — is preserved); S.textEndingScale scales all 5 uniformly.
function textEndingDuration(type) {
  return TEXT_ENDING_DUR[type] * (S.textEndingScale || 1);
}
```

**D) `drawTextLayer`'s `endingP`** — find:
```js
  const endingP = ending ? Math.min(1, (S.time - ending.t0) / TEXT_ENDING_DUR[ending.type]) : 0;
```
replace:
```js
  const endingP = ending ? Math.min(1, (S.time - ending.t0) / textEndingDuration(ending.type)) : 0;
```

**E) `finalizeTextEndingIfDone`** — find:
```js
function finalizeTextEndingIfDone() {
  const ending = S.textEnding;
  if (!ending) return;
  const p = Math.min(1, (S.time - ending.t0) / TEXT_ENDING_DUR[ending.type]);
  if (p < 1) return;
```
replace:
```js
function finalizeTextEndingIfDone() {
  const ending = S.textEnding;
  if (!ending) return;
  const p = Math.min(1, (S.time - ending.t0) / textEndingDuration(ending.type));
  if (p < 1) return;
```

**F) Event listener, right after `textSize`'s** — find:
```js
$("textSize").addEventListener("input", e => {
  S.textSize = e.target.value / 100;
  $("textSizeVal").textContent = e.target.value + "%";
});
```
replace:
```js
$("textSize").addEventListener("input", e => {
  S.textSize = e.target.value / 100;
  $("textSizeVal").textContent = e.target.value + "%";
});
$("textEndingScale").addEventListener("input", e => {
  S.textEndingScale = e.target.value / 100;
  $("textEndingScaleVal").textContent = e.target.value + "%";
});
```

**G) Project save blob** — find:
```js
            custom2: S.textCustom2, gradDir: S.textGradDir, pattern: S.textPattern, blend: S.textBlend },
```
replace:
```js
            custom2: S.textCustom2, gradDir: S.textGradDir, pattern: S.textPattern, blend: S.textBlend,
            endingScale: S.textEndingScale },
```

**H) Project load-apply, inside `applyProject`** — find:
```js
  S.textBlend = t.blend || "source-over"; if ($("textBlend")) $("textBlend").value = S.textBlend;
```
replace:
```js
  S.textBlend = t.blend || "source-over"; if ($("textBlend")) $("textBlend").value = S.textBlend;
  S.textEndingScale = t.endingScale != null ? t.endingScale : 1.4;   // v135
```

**I) `applyProject`'s UI sync** — find (this exact `textSize` sync line-pair also appears in the
unrelated `syncTextPresetUI`, but with different surrounding lines — the `textStyle`/`textPlate`
line immediately before and the `textLabel`/`textLower` line immediately after make this block
unique to `applyProject`):
```js
  $("textStyle").value = S.textStyle; $("textPlate").checked = S.textPlate;
  $("textSize").value = Math.round(S.textSize * 100); $("textSizeVal").textContent = Math.round(S.textSize * 100) + "%";
  $("textLabel").value = S.textLabel; $("textLower").checked = S.textLower;
```
replace:
```js
  $("textStyle").value = S.textStyle; $("textPlate").checked = S.textPlate;
  $("textSize").value = Math.round(S.textSize * 100); $("textSizeVal").textContent = Math.round(S.textSize * 100) + "%";
  $("textEndingScale").value = Math.round(S.textEndingScale * 100); $("textEndingScaleVal").textContent = Math.round(S.textEndingScale * 100) + "%";
  $("textLabel").value = S.textLabel; $("textLower").checked = S.textLower;
```

- [ ] **Step 3: Write the tests**

Append to `test.js`, right before the `/* ---------------- summary ---------------- */` block:

```js
section("Text Endings — adjustable duration slider");

ok("the Ending-Dauer slider markup exists with min=50/max=200/value=140 and its paired value label (HTML markup check — uses `html`, not `script`)", (() => {
  return html.includes('<input type="range" id="textEndingScale" min="50" max="200" value="140">') &&
         html.includes('<span class="val" id="textEndingScaleVal">140%</span>');
})());

ok("S default state has textEndingScale: 1.4", (() => {
  return script.includes("textEndingScale: 1.4,");
})());

ok("textEndingDuration exists and multiplies TEXT_ENDING_DUR[type] by S.textEndingScale, with a fallback of 1", (() => {
  const fn = extractFn("textEndingDuration");
  return !!fn && fn.includes("TEXT_ENDING_DUR[type]") && fn.includes("S.textEndingScale || 1");
})());

ok("textEndingDuration behaves correctly: scales the base duration, and falls back to the unscaled base when S.textEndingScale is falsy (genuine behavioral check via loadFns + a mock S/TEXT_ENDING_DUR, not just a structural text match)", (() => {
  global.TEXT_ENDING_DUR = { shatter: 0.6 };
  global.S = { textEndingScale: 2 };
  const { textEndingDuration } = loadFns(["textEndingDuration"]);
  const scaled = Math.abs(textEndingDuration("shatter") - 1.2) < 1e-9;   // 0.6 * 2

  global.S.textEndingScale = 0;   // falsy — must fall back to the unscaled base (0.6), not 0
  const fallback = Math.abs(textEndingDuration("shatter") - 0.6) < 1e-9;

  return scaled && fallback;
})());

ok("drawTextLayer's endingP calls textEndingDuration(ending.type) and no longer reads TEXT_ENDING_DUR[ending.type] directly", (() => {
  const fn = extractFn("drawTextLayer");
  return !!fn && fn.includes("textEndingDuration(ending.type)") && !fn.includes("TEXT_ENDING_DUR[ending.type]");
})());

ok("finalizeTextEndingIfDone calls textEndingDuration(ending.type) and no longer reads TEXT_ENDING_DUR[ending.type] directly", (() => {
  const fn = extractFn("finalizeTextEndingIfDone");
  return !!fn && fn.includes("textEndingDuration(ending.type)") && !fn.includes("TEXT_ENDING_DUR[ending.type]");
})());

ok("the event listener wires the slider to S.textEndingScale and updates its value label from the raw slider value", (() => {
  return script.includes('$("textEndingScale").addEventListener("input", e => {') &&
         script.includes("S.textEndingScale = e.target.value / 100;") &&
         script.includes('$("textEndingScaleVal").textContent = e.target.value + "%";');
})());

ok("the project save blob includes endingScale: S.textEndingScale", (() => {
  return script.includes("endingScale: S.textEndingScale }");
})());

ok("applyProject's load-apply sets S.textEndingScale from t.endingScale, falling back to 1.4 for an older saved project that predates this field", (() => {
  return script.includes('S.textEndingScale = t.endingScale != null ? t.endingScale : 1.4;');
})());

ok("applyProject's UI sync sets the slider position and value label from S.textEndingScale", (() => {
  return script.includes('$("textEndingScale").value = Math.round(S.textEndingScale * 100); $("textEndingScaleVal").textContent = Math.round(S.textEndingScale * 100) + "%";');
})());

ok("applyTextPreset never references textEndingScale — switching a Text style preset must not silently change Frank's preferred Ending speed", (() => {
  const fn = extractFn("applyTextPreset");
  return !!fn && !fn.includes("textEndingScale");
})());
```

- [ ] **Step 4: Run the tests and confirm the count**

```bash
node test.js
```
Expected: the new "Text Endings — adjustable duration slider" section prints 11 lines with `✓`,
and the final summary line reads **`617 passed, 0 failed`** (606 baseline + 11 new). If it doesn't
say exactly that, stop and fix — do not adjust the expected number to match a wrong result.

- [ ] **Step 5: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat(text-mode): add Ending-Dauer slider — adjustable F1-F5 Text Ending duration"
```

---

## After the Task: Live Verification + Push

Not a subagent task — the controller does this directly, per this session's established protocol:

1. Local dev server (see `project_morph_second_local_checkout.md` memory before trusting
   `preview_start`/`.claude/launch.json` — the immediately preceding round found it can resolve to
   the wrong local checkout; verify served content's byte count / a known-recent string against
   the local file before trusting it, or start `npx --yes serve -l <port> .` directly via Bash from
   the confirmed repo directory instead).
2. Set the slider to a few positions (e.g. 50%, 100%, 140%, 200%), trigger each of F1–F5 at each,
   confirm the visual duration scales accordingly. Confirm dragging the slider while an ending is
   actively playing visibly changes its remaining time. Save a project, reload it, confirm the
   slider position and `S.textEndingScale` survive. Switch a Text style preset and confirm
   `S.textEndingScale` is untouched by that action.
3. `git push` (`dangerouslyDisableSandbox: true` — required in this environment, see
   `feedback_git_sandbox_network.md`).
4. Poll `https://elasticmorph.app/elastic-morph.html`, SHA-256 hash against the local file, until
   they match.
5. Update project memory (`project_morph_text_mode_hypno_endings.md` — extend it, this is a direct
   follow-up to that round, not a separate memory file) once hash-confirmed.
