# Help Overlay Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two stale lines in the `?` Help Overlay — document F1–F5 Text Endings, correct "FX
Rack I+II" to "FX Rack I–III".

**Architecture:** Two one-line HTML text edits in `#helpOverlay`, no logic/state changes.

**Tech Stack:** Plain HTML, no new dependencies.

## Global Constraints

- Both edits are pre-`@BUILD-INJECT-V58` marker, no `src/inject-vNN.js` involvement.
- Test count baseline: 617 passed, 0 failed (confirmed via an actual `node test.js` run just
  before this plan was written). Required after this task: exactly **620 passed, 0 failed** (617
  + 3 new).
- Ending-Dauer slider is deliberately NOT mentioned anywhere in this overlay (see spec's Design
  section) — it's a visible, self-labeled UI control, not a hidden shortcut needing documentation.

---

## Task 1: Fix the two stale Help Overlay lines

**Files:**
- Modify: `elastic-morph.html:2051`, `elastic-morph.html:2059-2060`
- Test: `test.js`

**Interfaces:** None — this task is self-contained, no other task depends on it.

- [ ] **Step 1: Re-confirm exact current text**

```bash
grep -n 'FX Rack I+II' elastic-morph.html
grep -n '<span><b>Ctrl+1–0</b> FX Rack II</span>' elastic-morph.html
```
Both should print (line numbers may differ slightly from this plan if anything changed since
writing — read the surrounding lines with `Read` if so, don't guess).

- [ ] **Step 2: Make both edits**

**A) Ebenen summary** — find:
```html
        <p><b>Shader</b> (GPU) · <b>Visual DNA</b> (Kern-Organismus) · <b>Particles</b> · <b>Layer B</b> · <b>Bild A/B</b> · <b>FX Rack I+II</b></p>
```
replace:
```html
        <p><b>Shader</b> (GPU) · <b>Visual DNA</b> (Kern-Organismus) · <b>Particles</b> · <b>Layer B</b> · <b>Bild A/B</b> · <b>FX Rack I–III</b></p>
```

**B) Tastatur list** — find:
```html
          <span><b>Ctrl+1–0</b> FX Rack II</span>
          <span><b>Alt+1–0</b> FX Rack III</span>
```
replace:
```html
          <span><b>Ctrl+1–0</b> FX Rack II</span>
          <span><b>Alt+1–0</b> FX Rack III</span>
          <span><b>F1–F5</b> Text-Endings (Shatter/Vortex/Dissolve/Iris/Glitch)</span>
```

- [ ] **Step 3: Write the tests**

Append to `test.js`, right before the `/* ---------------- summary ---------------- */` block:

```js
section("Help Overlay — F1-F5 + FX Rack III mentions");

ok("the Ebenen summary no longer says \"FX Rack I+II\" and now says \"FX Rack I–III\"", (() => {
  return !html.includes("FX Rack I+II") && html.includes("FX Rack I–III");
})());

ok("the Tastatur list documents F1–F5 Text-Endings", (() => {
  return html.includes("<span><b>F1–F5</b> Text-Endings (Shatter/Vortex/Dissolve/Iris/Glitch)</span>");
})());

ok("the new F1-F5 line is positioned after Alt+1-0 (FX Rack III) and before the Zoom line, matching the intended reading order", (() => {
  const altIdx = html.indexOf("<span><b>Alt+1–0</b> FX Rack III</span>");
  const f1Idx = html.indexOf("<span><b>F1–F5</b> Text-Endings");
  const zoomIdx = html.indexOf("<span><b>+ / − / 0</b> Zoom");
  return altIdx > 0 && f1Idx > altIdx && zoomIdx > f1Idx;
})());
```

- [ ] **Step 4: Run the tests and confirm the count**

```bash
node test.js
```
Expected: the new "Help Overlay — F1-F5 + FX Rack III mentions" section prints 3 lines with `✓`,
and the final summary line reads **`620 passed, 0 failed`** (617 baseline + 3 new).

- [ ] **Step 5: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "docs(help): document F1-F5 Text Endings, fix stale FX Rack I+II mention"
```

---

## After the Task: Live Verification + Push

Not a subagent task — the controller does this directly:

1. Local dev server (verify served content freshness before trusting it — see
   `project_morph_second_local_checkout.md` memory, this project's `preview_start` has twice
   resolved to the wrong local checkout).
2. Open the app, press `?`, confirm both corrected lines read right and the new F1–F5 line
   doesn't overflow the two-column help card layout.
3. `git push` (`dangerouslyDisableSandbox: true`).
4. Poll `https://elasticmorph.app/elastic-morph.html`, SHA-256 hash against the local file, until
   they match.
5. Update project memory once hash-confirmed (this is a tiny follow-up — a short addition to an
   existing relevant memory file is enough, no new file needed).
