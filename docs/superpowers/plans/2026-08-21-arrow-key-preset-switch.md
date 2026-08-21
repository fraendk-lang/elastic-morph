# ArrowUp/ArrowDown Preset Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `ArrowDown`/`ArrowUp` cycle live through Elastic Morph's Visual DNA presets from
the keyboard, in both Pro and Creator mode, without requiring a loaded track.

**Architecture:** One new function (`cyclePresetLook`) mirrors the existing Creator-mode swipe
gesture's cycling logic (`cycleCreatorLook`) but always walks the full `PRESETS` array instead
of the swipe's track-gated/smart-filtered picks. The existing toast helper (`flashLookSwipe`)
gets one new optional parameter so it can show `↑`/`↓` instead of `→`/`←`. Two new lines in the
existing global `keydown` listener wire the keys — no new listener, no new guards (the
listener's existing input-focus and open-modal checks already cover the new bindings).

**Tech Stack:** Vanilla JS, zero-dependency Node test harness (`test.js`).

## Global Constraints

- Reuse `applyPreset`, `hapticLookPulse`, and `flashLookSwipe` as-is wherever possible — do not
  duplicate their logic.
- `flashLookSwipe`'s existing 4-argument call site (inside `cycleCreatorLook`) must keep
  producing byte-identical output (`→`/`←`, no glyph override) — the new 5th parameter is
  additive only.
- `cyclePresetLook` must NOT call `getCreatorLookPicks()` — it always cycles the full `PRESETS`
  array, regardless of `S.swipeLookMode` or whether a track is loaded (per spec's decided
  questions).
- No new localStorage key, no new UI element, no new settings toggle.
- Reference spec: `docs/superpowers/specs/2026-08-21-arrow-key-preset-switch-design.md`.

---

## File Structure

Only one source file changes, plus its test file:

- **`elastic-morph.html`**
  - `<script>` block, `flashLookSwipe` at lines 9658-9666 — add optional 5th parameter.
  - `<script>` block, directly after `cycleCreatorLook` (lines 9668-9677) — add new
    `cyclePresetLook` function.
  - `<script>` block, global `keydown` listener, directly after the `ArrowRight` line (7915) —
    add two new `if` lines.
- **`test.js`** — one new assertion section, appended before the
  `/* ---------------- summary ---------------- */` block at the end of the file (same pattern
  as every other section in this file).

---

### Task 1: Add preset cycling on ArrowUp/ArrowDown

**Files:**
- Modify: `elastic-morph.html:9658-9666` (`flashLookSwipe`)
- Modify: `elastic-morph.html:9677` (insert `cyclePresetLook` after `cycleCreatorLook`)
- Modify: `elastic-morph.html:7914-7915` (insert two lines after the `ArrowRight` binding)
- Test: `test.js` (new section, appended before the summary block)

**Interfaces:**
- Consumes: `PRESETS` (array, module-level), `S.preset` (currently active preset object),
  `applyPreset(p)`, `hapticLookPulse()` — all pre-existing, unchanged.
- Produces: `cyclePresetLook(delta)` — no other task in this plan consumes it (single-task
  plan); it's called only from the two new keydown lines.

- [ ] **Step 1: Write the failing test**

Open `test.js`, find the `/* ---------------- summary ---------------- */` block near the end
(currently starts at line 627), and insert this new section directly above it:

```js
/* ---------------- ArrowUp/Down preset switch ---------------- */
section("ArrowUp/Down preset switch");
ok("flashLookSwipe accepts an optional glyph override, defaults preserved", (() => {
  const fn = extractFn("flashLookSwipe");
  return !!fn && fn.includes("function flashLookSwipe(name, dir, index, total, glyph)")
    && fn.includes('(glyph || (dir > 0 ? "→ " : "← "))');
})());
ok("cyclePresetLook defined, cycles full PRESETS list with wrap-around", (() => {
  const fn = extractFn("cyclePresetLook");
  return !!fn && fn.includes("PRESETS.indexOf(S.preset)")
    && fn.includes("(idx + delta + PRESETS.length) % PRESETS.length")
    && fn.includes("applyPreset(PRESETS[idx])")
    && fn.includes("hapticLookPulse()")
    && !fn.includes("getCreatorLookPicks");
})());
ok("ArrowDown/ArrowUp bound to cyclePresetLook (next/previous) with preventDefault", (() => {
  const idx = script.indexOf('e.key === "ArrowRight"');
  if (idx < 0) return false;
  const block = script.slice(idx, idx + 300);
  return block.includes('if (e.key === "ArrowDown") { e.preventDefault(); cyclePresetLook(1); }')
    && block.includes('if (e.key === "ArrowUp") { e.preventDefault(); cyclePresetLook(-1); }');
})());
```

This uses `extractFn`, the brace-matching helper already defined near the top of `test.js`
(line 19) and used by other function-scoped assertions in this file — it pulls a named
top-level function's full source so the checks can't false-match unrelated code elsewhere in
this 11,000+ line file.

- [ ] **Step 2: Run test to verify it fails**

Run: `node test.js`
Expected: all three new assertions under "ArrowUp/Down preset switch" print `✗` (fail) —
`flashLookSwipe` doesn't have a 5th parameter yet, `cyclePresetLook` doesn't exist yet, and the
keydown listener has no `ArrowDown`/`ArrowUp` handling yet.

- [ ] **Step 3: Write minimal implementation**

In `elastic-morph.html`, replace the `flashLookSwipe` function (lines 9658-9666):

```js
function flashLookSwipe(name, dir, index, total) {
  const el = $("lookSwipeToast");
  if (!el) return;
  const pos = total > 1 ? ` (${index}/${total})` : "";
  el.textContent = (dir > 0 ? "→ " : "← ") + name + pos;
  el.classList.add("show");
  clearTimeout(flashLookSwipe._t);
  flashLookSwipe._t = setTimeout(() => el.classList.remove("show"), 950);
}
```

with:

```js
function flashLookSwipe(name, dir, index, total, glyph) {
  const el = $("lookSwipeToast");
  if (!el) return;
  const pos = total > 1 ? ` (${index}/${total})` : "";
  el.textContent = (glyph || (dir > 0 ? "→ " : "← ")) + name + pos;
  el.classList.add("show");
  clearTimeout(flashLookSwipe._t);
  flashLookSwipe._t = setTimeout(() => el.classList.remove("show"), 950);
}
```

Directly after `cycleCreatorLook` (ends at line 9677 with its closing `}`), add the new
function:

```js
function cyclePresetLook(delta) {
  let idx = PRESETS.indexOf(S.preset);
  if (idx < 0) idx = 0;
  idx = (idx + delta + PRESETS.length) % PRESETS.length;
  applyPreset(PRESETS[idx]);
  hapticLookPulse();
  flashLookSwipe(PRESETS[idx].name, delta, idx + 1, PRESETS.length, delta > 0 ? "↓ " : "↑ ");
}
```

In the global `keydown` listener, find these two existing lines (7914-7915):

```js
  if (e.key === "ArrowLeft") { e.preventDefault(); skip(-5); }
  if (e.key === "ArrowRight") { e.preventDefault(); skip(5); }
```

and add two new lines directly after them:

```js
  if (e.key === "ArrowLeft") { e.preventDefault(); skip(-5); }
  if (e.key === "ArrowRight") { e.preventDefault(); skip(5); }
  if (e.key === "ArrowDown") { e.preventDefault(); cyclePresetLook(1); }
  if (e.key === "ArrowUp") { e.preventDefault(); cyclePresetLook(-1); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test.js`
Expected: all three new assertions print `✓`, and the full suite is still `0 failed` (the
existing 296 assertions from prior sessions are untouched by this change).

- [ ] **Step 5: Manual browser verification (per spec's Testing section)**

Run `npm start` (serves the app locally on port 3456), open it:

- In Pro-Modus, with no track loaded: press `ArrowDown` — the canvas preset changes, a toast
  appears center-screen reading `↓ <preset name> (n/total)`. Press `ArrowUp` — preset changes
  back, toast reads `↑ <preset name> (n/total)`.
- Press `ArrowDown` repeatedly past the last preset in `PRESETS` — confirm it wraps to the
  first preset (position resets to `1/total`). Press `ArrowUp` from the first preset — confirm
  it wraps to the last.
- Switch to Creator-Modus and repeat — same behavior, and confirm the existing touch swipe
  gesture (if testable via browser touch emulation) still works unchanged (regression check on
  `cycleCreatorLook`, which now calls the modified `flashLookSwipe` with its old 4-argument
  call site).
- Click into a text field (e.g. the track title / any input) and press `ArrowUp`/`ArrowDown` —
  confirm nothing fires (cursor moves in the field normally, no preset change, no toast).
- Open a modal (e.g. the Help overlay) and press `ArrowUp`/`ArrowDown` — confirm nothing fires.

- [ ] **Step 6: Commit**

```bash
cd "/Users/frankkrumsdorf/Desktop/Elastic Morph Cursor"
git add elastic-morph.html test.js
git commit -m "feat: ArrowUp/ArrowDown cycle Visual DNA presets live"
```
