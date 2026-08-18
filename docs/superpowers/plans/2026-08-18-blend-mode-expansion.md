# Blend-Mode Expansion (Layer B + Shader Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Layer B and the Shader Engine the same 6 additional creative blend modes (9 total each, up from 3), with zero behavioral code changes since both already pass their blend value straight through to `ctx.globalCompositeOperation`.

**Architecture:** Both `#lbBlend` and `#shBlend` are plain `<select>` elements in the static (pre-build-marker) region of `elastic-morph.html`. `S.layerB.blend`/`S.shader.blend` are set from the select's `value` via existing `change` listeners and consumed unmodified by `ctx.globalCompositeOperation` inside `drawLayerB`/the shader composite pass. Adding options is the entire change — no new state, no new listeners, no new draw logic.

**Tech Stack:** Vanilla JS, Canvas 2D `globalCompositeOperation`, the existing zero-dependency test harness (`test.js`, run via `node test.js`).

## Global Constraints

- Every code change must keep `node test.js` at 100% pass.
- Both selects get the identical 9-value list, in the identical order: the existing 3 unchanged (`lighter`/Add, `screen`/Screen, `source-over`/Normal), then the 6 new ones in this exact order: `multiply`, `overlay`, `difference`, `color-dodge`, `hard-light`, `hue`.
- Don't touch the injected region of `elastic-morph.html` (after the `/* @BUILD-INJECT-V58 */` marker, currently around line 8548 per the last build — confirm the current line with `grep -n "@BUILD-INJECT-V58" elastic-morph.html` before editing, since prior tasks have shifted it) or `build.js` — both edit sites here are in the static region above that marker (~line 1587 and ~1792), consistent with every prior task in this repo's v113 work.
- No new runtime dependencies.

---

### Task 1: Add 6 blend-mode options to both selects

**Files:**
- Modify: `elastic-morph.html:1587-1591` (`#shBlend`, Shader Engine)
- Modify: `elastic-morph.html:1792-1796` (`#lbBlend`, Layer B)
- Modify: `test.js` (new assertions)

**Interfaces:** None — no new functions, no new state keys. `S.layerB.blend` and `S.shader.blend` already accept any string and pass it straight to `ctx.globalCompositeOperation` (confirmed: `elastic-morph.html:6799` `$("lbBlend").addEventListener("change", e => S.layerB.blend = e.target.value)`, `:6814` same pattern for `shBlend`).

- [ ] **Step 1: Add the failing test assertions**

Open `test.js`, find this block near the end (search for `build.js APP_VERSION matches sw.js CACHE string`):

```js
const buildSrc = fs.readFileSync(path.join(__dirname, "build.js"), "utf8");
const appVersionMatch = buildSrc.match(/const APP_VERSION = (\d+)/);
ok("build.js APP_VERSION matches sw.js CACHE string", !!appVersionMatch &&
  swSrc.includes(`elastic-morph-v${appVersionMatch[1]}`));

/* ---------------- summary ---------------- */
```

Insert a new section immediately after that assertion and before `/* ---------------- summary ---------------- */`:

```js

/* ---------------- blend-mode expansion ---------------- */
section("Blend-mode expansion");
const BLEND_VALUES = ["lighter", "screen", "source-over", "multiply", "overlay", "difference", "color-dodge", "hard-light", "hue"];
const lbBlendBlock = (html.match(/<select id="lbBlend"[^>]*>([\s\S]*?)<\/select>/) || [])[1] || "";
const shBlendBlock = (html.match(/<select id="shBlend"[^>]*>([\s\S]*?)<\/select>/) || [])[1] || "";
ok("#lbBlend has all 9 blend values", BLEND_VALUES.every(v => lbBlendBlock.includes(`value="${v}"`)));
ok("#shBlend has all 9 blend values", BLEND_VALUES.every(v => shBlendBlock.includes(`value="${v}"`)));
ok("#lbBlend and #shBlend have the same option count", (lbBlendBlock.match(/<option/g) || []).length === 9 &&
  (shBlendBlock.match(/<option/g) || []).length === 9);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the 3 new checks in the "Blend-mode expansion" section print `✗` (only 3 options exist per select right now), everything else still `✓`.

- [ ] **Step 3: Edit `#shBlend` (Shader Engine)**

In `elastic-morph.html`, find (around line 1587):

```html
    <select id="shBlend" class="pm-select" style="margin-top:8px">
      <option value="lighter" selected>Blend: Add</option>
      <option value="screen">Blend: Screen</option>
      <option value="source-over">Blend: Normal</option>
    </select>
```

Replace with:

```html
    <select id="shBlend" class="pm-select" style="margin-top:8px">
      <option value="lighter" selected>Blend: Add</option>
      <option value="screen">Blend: Screen</option>
      <option value="source-over">Blend: Normal</option>
      <option value="multiply">Blend: Multiply</option>
      <option value="overlay">Blend: Overlay</option>
      <option value="difference">Blend: Difference</option>
      <option value="color-dodge">Blend: Color Dodge</option>
      <option value="hard-light">Blend: Hard Light</option>
      <option value="hue">Blend: Hue</option>
    </select>
```

- [ ] **Step 4: Edit `#lbBlend` (Layer B)**

In `elastic-morph.html`, find (around line 1792):

```html
    <select id="lbBlend" class="pm-select" style="margin-top:8px">
      <option value="lighter" selected>Blend: Add</option>
      <option value="screen">Blend: Screen</option>
      <option value="source-over">Blend: Normal</option>
    </select>
```

Replace with:

```html
    <select id="lbBlend" class="pm-select" style="margin-top:8px">
      <option value="lighter" selected>Blend: Add</option>
      <option value="screen">Blend: Screen</option>
      <option value="source-over">Blend: Normal</option>
      <option value="multiply">Blend: Multiply</option>
      <option value="overlay">Blend: Overlay</option>
      <option value="difference">Blend: Difference</option>
      <option value="color-dodge">Blend: Color Dodge</option>
      <option value="hard-light">Blend: Hard Light</option>
      <option value="hue">Blend: Hue</option>
    </select>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node test.js`
Expected: `0 failed`, all 3 new "Blend-mode expansion" checks show `✓`.

- [ ] **Step 6: Manual visual check**

Run: `npm start` (serves on `http://localhost:3456`), open `elastic-morph.html`, start the demo track.
1. Enable Layer B (`lbOn` checkbox), pick any overlay type, cycle `#lbBlend` through the 6 new values one at a time. Confirm each renders something visibly different from the others (not all collapsing to the same look) and that none goes fully black or fully white for more than a moment on a beat — `difference` and `color-dodge` are supposed to be extreme but should still show the underlying DNA shape.
2. Enable the Shader Engine (`shOn` checkbox or key `G`), pick any style (e.g. "Fluid / Liquid"), cycle `#shBlend` through the same 6 values. Same check.
3. Confirm the existing 3 values (Add/Screen/Normal) still work unchanged in both selects (regression check — they're first in the list and marked `selected`/default, so this should be automatic, but verify no preset that saves `blend: "lighter"` breaks).

- [ ] **Step 7: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "Add 6 creative blend modes to Layer B and Shader Engine

Multiply, Overlay, Difference, Color Dodge, Hard Light, and Hue join
the existing Add/Screen/Normal in both #lbBlend and #shBlend — no
behavioral code change needed since both already pass their value
straight through to ctx.globalCompositeOperation."
```

---

## Final Verification

- [ ] `node test.js` — expect `0 failed`.
- [ ] `git status` clean after the commit.
- [ ] `git diff HEAD~1 -- elastic-morph.html` shows exactly the two 6-line `<option>` insertions and nothing else (no accidental edits to the injected region or elsewhere).
