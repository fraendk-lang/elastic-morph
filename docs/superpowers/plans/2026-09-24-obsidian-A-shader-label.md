# Obsidian Bloom Stage A — honest Shader label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Shader Engine option labelled "SDF Blob (Raymarch)" renders a 2D triangular light grid, not an SDF. Rename the visible label to "Triangular Light Grid" without touching the stored key (`raymarch`, `SHADER_STYLE_ID.raymarch = 7`) so existing scenes and projects look identical.

**Architecture:** One text change in the `#shStyle` `<option>` plus test-name/section wording in `test.js`. No logic, no GLSL, no build-region file.

**Tech Stack:** `elastic-morph.html` (option at ~line 1662, before the build marker), `test.js`.

## Global Constraints

- The `value="raymarch"` attribute, `SHADER_STYLE_ID`, `HEAVY_SHADER`, GLSL code and all saved-scene keys stay unchanged.
- Verification command: `npm run ci` (never `node test.js` alone).

---

### Task 1: Rename the label and correct the test wording

**Files:**
- Modify: `elastic-morph.html:1662`
- Modify: `test.js` (lines ~928-929, ~941 wording; new assertions before the `/* ---------------- summary ---------------- */` block)

- [ ] **Step 1: Write the failing tests**

First add a permanent helper to `test.js`, directly after the line `const section = s => console.log("\n" + s);`:

```js
const okf = (name, fn) => { let v = false, err; try { v = !!fn(); } catch (e) { err = e.message; } ok(name, v, err); };   // test.js ok() takes a VALUE, not a function
```

Then insert immediately before `/* ---------------- summary ---------------- */` in `test.js`:

```js
section("Shader label honesty: raymarch style is a triangular light grid");

okf("the raymarch option is labelled 'Triangular Light Grid' and keeps its stored value", () => {
  return html.includes('<option value="raymarch">Style: Triangular Light Grid</option>')
    && !html.includes("SDF Blob");
});

okf("SHADER_STYLE_ID still maps raymarch to 7 (saved scenes unchanged)", () => {
  return script.includes("raymarch:7,");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run ci`
Expected: first new assertion `✗` (label still "SDF Blob (Raymarch)"), second `✓`.

- [ ] **Step 3: Implement**

In `elastic-morph.html` find:

```html
      <option value="raymarch">Style: SDF Blob (Raymarch)</option>
```

Replace with:

```html
      <option value="raymarch">Style: Triangular Light Grid</option>
```

In `test.js` replace the wording (comments/section titles only):
- `/* ---------------- SDF Blob (raymarchStyle): triangular lattice network-glow ---------------- */` → `/* ---------------- Triangular Light Grid (raymarchStyle): triangular lattice network-glow ---------------- */`
- `section("SDF Blob shader: glowing triangular-lattice network with pulsing nodes");` → `section("Triangular Light Grid shader: glowing triangular-lattice network with pulsing nodes");`
- `section("Shader eye-catcher palette + FX (Aurora/Gyroid/Feedback/SDF Blob)");` → `section("Shader eye-catcher palette + FX (Aurora/Gyroid/Feedback/Triangular Light Grid)");`

- [ ] **Step 4: Run to verify pass**

Run: `npm run ci`
Expected: `<N> passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "fix: label the raymarch shader style honestly (Triangular Light Grid)

The option said 'SDF Blob (Raymarch)' but raymarchStyle() renders a 2D
triangular line lattice with node glow. Only the visible label and test
wording change; the stored key raymarch (style id 7) is untouched so
saved scenes look identical.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual check

Open the Shader Engine style dropdown: the entry reads "Triangular Light Grid"; selecting it looks exactly as before.

## Reference captures (for Stage D, done with Frank's machine)

Before the renderer work lands, record reference clips of Glass Animal, Hyperspace, Flame, Reaction: same track, fixed times (e.g. 30 s / 60 s), same output size, no Auto-VJ, no random extra layers, palette and FX documented. Stage D stores the settings; this plan does not automate capture.
