# DNA Grid Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enlarge the Visual DNA preset preview cards in Elastic Morph so the live animated
mini-previews (currently 48px tall) become the visual focal point of the library.

**Architecture:** Single CSS-only edit to `elastic-morph.html`'s inline `<style>` block — no
HTML markup change, no JS change. The preview canvases (`.pcanvas`) are already drawn by
runtime JS that reads its own canvas size, so a pure CSS resize is sufficient.

**Tech Stack:** Vanilla CSS, zero-dependency Node test harness (`test.js`).

## Global Constraints

- Pure CSS change only — no HTML or JS edits (per spec's "Warum keine JS-Änderung nötig").
- `#presetGrid` and `#customGrid` share the same `.preset-card` styling and must both pick up
  the change automatically (they already share one CSS rule — do not split it).
- `.preset-card h4`/`.preset-card p` font sizes stay unchanged — do not scale text.
- No test.js assertions currently reference this CSS (confirmed via grep) — add new coverage,
  scoped tightly enough to avoid false-positive matches (this file already contains
  coincidentally identical fragments like `padding: 16px;`, `minmax(220px, 1fr)`, and
  `height: 120px;` elsewhere for unrelated components — see Task 1 for the exact scoping
  technique required).
- Reference spec: `docs/superpowers/specs/2026-08-21-dna-grid-visual-polish-design.md`.

---

## File Structure

Only one file changes:

- **`elastic-morph.html`** — `<style>` block, lines 382–397 (the `#presetGrid, #customGrid`
  rule and the five `.preset-card...` rules directly below it). No other file is touched.
- **`test.js`** — one new assertion section, appended before the
  `/* ---------------- summary ---------------- */` block at the end of the file (same
  pattern as every other section in this file).

---

### Task 1: Enlarge the preset grid cards and previews

**Files:**
- Modify: `elastic-morph.html:382-397`
- Test: `test.js` (new section, appended before the summary block)

**Interfaces:**
- Consumes: nothing new — pure CSS value edit.
- Produces: nothing consumed by later tasks (this is the only task in the plan).

- [ ] **Step 1: Write the failing test**

Open `test.js`, find the `/* ---------------- summary ---------------- */` block near the end,
and insert this new section directly above it. **This test must scope its checks to the
`#presetGrid, #customGrid {` selector's block** — several of the exact substrings below
(`padding: 16px;`, `minmax(220px, 1fr)`, `height: 120px;`) already appear elsewhere in this
11,000+ line file for unrelated components (a welcome-screen grid, the `.dna-story` fingerprint
panel, an unrelated button), so a bare `script.includes(...)` / `html.includes(...)` check
would falsely pass before the change is made. Slicing a window right after the selector avoids
that:

```js
/* ---------------- DNA grid visual polish ---------------- */
section("Visual DNA grid: larger preset previews");
ok("#presetGrid/#customGrid + .preset-card sizing enlarged (48px -> 120px previews)", (() => {
  const idx = html.indexOf('#presetGrid, #customGrid {');
  if (idx < 0) return false;
  const block = html.slice(idx, idx + 900);
  return block.includes('minmax(220px, 1fr); gap: 14px;')
    && block.includes('padding: 16px;')
    && block.includes('.preset-card .swatch { height: 120px; border-radius: 8px; margin-bottom: 12px; }')
    && block.includes('.preset-card .pcanvas { display: block; width: 100%; height: 120px; border-radius: 8px; margin-bottom: 12px; }');
})());
```

Note: this test reads `html` (the full file, declared near the top of `test.js` as
`const html = fs.readFileSync(FILE, "utf8");`), not `script` (the extracted `<script>` content
only) — CSS lives in the `<style>` block, which is part of `html` but not `script`. Every other
CSS-focused assertion in this file (e.g. `.scene-bank-toggle CSS defined`) already follows this
same `html.includes(...)` convention.

- [ ] **Step 2: Run test to verify it fails**

Run: `node test.js`
Expected: the new assertion under "Visual DNA grid: larger preset previews" prints `✗`
(fail) — the current file still has `minmax(190px, 1fr)`, `padding: 14px`, and 44px/48px
preview heights, so none of the four substrings in the check are present yet.

- [ ] **Step 3: Write minimal implementation**

In `elastic-morph.html`, replace lines 382-397:

```css
  #presetGrid, #customGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
  .preset-card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 14px;
    cursor: pointer;
    transition: all .15s;
    position: relative;
  }
  .preset-card:hover { border-color: var(--violet); transform: translateY(-2px); }
  .preset-card.active { border-color: var(--cyan); box-shadow: 0 0 20px rgba(75,225,232,0.12); }
  .preset-card .swatch { height: 44px; border-radius: 8px; margin-bottom: 10px; }
  .preset-card .pcanvas { display: block; width: 100%; height: 48px; border-radius: 8px; margin-bottom: 10px; }
  .preset-card h4 { font-size: 13px; margin-bottom: 4px; }
  .preset-card p { font-size: 11px; color: var(--text-dim); line-height: 1.45; }
```

with:

```css
  #presetGrid, #customGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
  .preset-card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    transition: all .15s;
    position: relative;
  }
  .preset-card:hover { border-color: var(--violet); transform: translateY(-2px); }
  .preset-card.active { border-color: var(--cyan); box-shadow: 0 0 20px rgba(75,225,232,0.12); }
  .preset-card .swatch { height: 120px; border-radius: 8px; margin-bottom: 12px; }
  .preset-card .pcanvas { display: block; width: 100%; height: 120px; border-radius: 8px; margin-bottom: 12px; }
  .preset-card h4 { font-size: 13px; margin-bottom: 4px; }
  .preset-card p { font-size: 11px; color: var(--text-dim); line-height: 1.45; }
```

(Only the five numeric values called out in the spec change: grid `minmax` width, grid `gap`,
card `padding`, and the two preview-height rules. `.preset-card:hover`, `.preset-card.active`,
`h4`, and `p` are byte-identical to before — shown in full only so the replacement is
unambiguous.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node test.js`
Expected: the new assertion prints `✓`, and the full suite is still `0 failed` (the existing
295 assertions from prior sessions are untouched by this change).

- [ ] **Step 5: Manual browser verification (per spec's Testing section)**

Run `npm start` (serves the app locally on port 3456), open it, switch to Pro-Modus, click
"Visual DNA" in the left nav, and confirm:
- All preset cards (both the live-animated `.pcanvas` ones and any static `.swatch` ones, e.g.
  in `#customGrid` if any custom-saved presets exist) render visibly larger, previews are
  clearly the dominant element of each card.
- Cards remain clickable — clicking one still applies that preset (check the canvas visual
  changes and the card gets the `.active` highlight).
- Resize the browser narrower (tablet/mobile width) and confirm the grid still wraps cleanly
  with no overlapping or cut-off cards.

- [ ] **Step 6: Commit**

```bash
cd "/Users/frankkrumsdorf/Desktop/Elastic Morph Cursor"
git add elastic-morph.html test.js
git commit -m "style: enlarge Visual DNA preset preview cards (48px -> 120px previews)"
```
