# DNA Panel Undo/Redo Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visible Undo/Redo buttons directly to the DNA Control panel, so the already-working (but easy-to-miss) Undo/Redo feature is discoverable where users actually adjust DNA sliders, without duplicating any logic.

**Architecture:** Two new buttons (`undoBtnDna`/`redoBtnDna`) inserted in the HTML right after the `#sliders` container, wired to the exact same `histUndo`/`histRedo` functions the existing Settings-page buttons (`undoBtn`/`redoBtn`) already use. `updateHistButtons()` is extended to keep both button pairs' enabled/disabled state in sync.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- No separate design spec for this task — the design was agreed upon inline in conversation (Frank explicitly said a spec wasn't needed for a change this small): add a second set of Undo/Redo buttons near the DNA sliders, in addition to (not replacing) the existing Settings-page ones.
- No changes to `histUndo`, `histRedo`, `histCapture`, `histSnap`, or the `HIST` object itself — this task only adds a second UI entry point to already-correct, already-tested logic (confirmed working live on production: slider change → undo → redo, and Mutate → undo, both verified to correctly restore `ctrl` state).
- `histUndo`/`histRedo`/`updateHistButtons`/`HIST` are all confirmed native to `elastic-morph.html` (not build-injected) — no `node build.js` rebuild needed.
- New button IDs must not collide with the existing `undoBtn`/`redoBtn` (already used by the Settings-page buttons) — use `undoBtnDna`/`redoBtnDna`.

---

### Task 1: Add DNA panel Undo/Redo buttons

**Files:**
- Modify: `elastic-morph.html:1717` (insert button row right after `<div id="sliders"></div>`)
- Modify: `elastic-morph.html:10647-10651` (`updateHistButtons` — sync the 2 new buttons too)
- Modify: `elastic-morph.html:10670-10671` (wire the 2 new buttons to `histUndo`/`histRedo`)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Consumes: `histUndo()`, `histRedo()`, `HIST.undo`/`HIST.redo` (all existing, unchanged signatures).
- Produces: nothing new — single-task plan.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("DNA panel Undo/Redo buttons");

ok("DNA Control panel has its own Undo/Redo buttons right after the sliders", (() => {
  return html.includes('<div id="sliders"></div>')
    && html.includes('id="undoBtnDna"')
    && html.includes('id="redoBtnDna"');
})());

ok("the new DNA panel buttons show the same keyboard-shortcut tooltips as the Settings-page ones", (() => {
  return html.includes('id="undoBtnDna" title="Cmd/Ctrl+Z"')
    && html.includes('id="redoBtnDna" title="Cmd/Ctrl+Shift+Z"');
})());

ok("updateHistButtons syncs both the Settings-page and DNA-panel Undo/Redo buttons", (() => {
  const fn = extractFn("updateHistButtons");
  return !!fn
    && fn.includes('const u = $("undoBtn"), r = $("redoBtn");')
    && fn.includes('const u2 = $("undoBtnDna"), r2 = $("redoBtnDna");')
    && fn.includes("if (u2) u2.disabled = HIST.undo.length === 0;")
    && fn.includes("if (r2) r2.disabled = HIST.redo.length === 0;");
})());

ok("the DNA panel Undo/Redo buttons are wired to the existing histUndo/histRedo functions", (() => {
  return script.includes('$("undoBtnDna").addEventListener("click", histUndo);')
    && script.includes('$("redoBtnDna").addEventListener("click", histRedo);');
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all 4 new assertions under "DNA panel Undo/Redo buttons" print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement — add the buttons to the DNA Control panel HTML**

At `elastic-morph.html:1717`, find:

```html
    <div id="sliders"></div>
    <div class="divider"></div>
```

Replace it with:

```html
    <div id="sliders"></div>
    <div style="display:flex;gap:6px;margin-top:8px">
      <button class="btn" id="undoBtnDna" title="Cmd/Ctrl+Z">↶ Undo</button>
      <button class="btn" id="redoBtnDna" title="Cmd/Ctrl+Shift+Z">↷ Redo</button>
    </div>
    <div class="divider"></div>
```

- [ ] **Step 4: Implement — sync both button pairs in `updateHistButtons`**

At `elastic-morph.html:10647-10651`, find:

```js
function updateHistButtons() {
  const u = $("undoBtn"), r = $("redoBtn");
  if (u) u.disabled = HIST.undo.length === 0;
  if (r) r.disabled = HIST.redo.length === 0;
}
```

Replace it with:

```js
function updateHistButtons() {
  const u = $("undoBtn"), r = $("redoBtn");
  if (u) u.disabled = HIST.undo.length === 0;
  if (r) r.disabled = HIST.redo.length === 0;
  const u2 = $("undoBtnDna"), r2 = $("redoBtnDna");
  if (u2) u2.disabled = HIST.undo.length === 0;
  if (r2) r2.disabled = HIST.redo.length === 0;
}
```

- [ ] **Step 5: Implement — wire the new buttons to the existing undo/redo functions**

At `elastic-morph.html:10670-10671`, find:

```js
$("undoBtn").addEventListener("click", histUndo);
$("redoBtn").addEventListener("click", histRedo);
```

Replace it with:

```js
$("undoBtn").addEventListener("click", histUndo);
$("redoBtn").addEventListener("click", histRedo);
$("undoBtnDna").addEventListener("click", histUndo);
$("redoBtnDna").addEventListener("click", histRedo);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 4 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Undo/Redo buttons to the DNA Control panel

Undo/Redo already existed and works correctly (verified live on
production: slider change -> undo -> redo, and Mutate -> undo, both
correctly restore ctrl state) -- but its only UI entry point was two
buttons tucked into Settings -> Project, far from the DNA sliders
where users actually want to undo a change. Frank never found them.

Adds a second, identical pair of buttons directly under the DNA
Control panel's sliders, wired to the exact same histUndo/histRedo
functions -- no changes to the undo/redo logic itself, purely a
discoverability fix. updateHistButtons() now keeps both button pairs'
enabled/disabled state in sync.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

1. Open the DNA Control panel, adjust a slider — confirm the new "↶ Undo"
   button (under the sliders) becomes enabled, and clicking it reverts the
   slider.
2. Confirm the Settings-page Undo/Redo buttons stay in sync (both pairs
   enabled/disabled together, since they share one `HIST` state).
3. Click "Mutate", confirm the new Undo button reverts it correctly.
