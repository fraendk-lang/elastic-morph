# Backdrop/Spin Color Drift Filter-Clobber Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `backdrop`/`spin`'s automatic Color Drift hue-rotate tint from unconditionally overwriting the user's selected Image Layer filter, by only applying it when no filter is selected (`IM.filter === "none"`).

**Architecture:** Two one-line guard additions to existing, unconditionally-reached code in `elastic-morph.html`'s `drawImageLayer` function — no new functions, no new state, no build-injection concern.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- Full design/rationale: `docs/superpowers/specs/2026-09-06-backdrop-spin-colordrift-filter-clobber-design.md`.
- Exactly 2 lines change, both inside `drawImageLayer`: the `backdrop` branch (`elastic-morph.html:6416`) and the `spin` branch (`elastic-morph.html:6434`). No other mode, function, or file changes.
- `drawImageLayer` is confirmed native to `elastic-morph.html` (not build-injected) — no `node build.js` rebuild needed.
- No behavior change when `IM.filter === "none"` — the Color Drift tint must still apply exactly as before in that case.

---

### Task 1: Guard both colorDrift tint lines on `IM.filter === "none"`

**Files:**
- Modify: `elastic-morph.html:6416` (`backdrop` branch)
- Modify: `elastic-morph.html:6434` (`spin` branch)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Consumes: `IM` (the Image Layer state object, `S.image` or `S.image2`), already the first parameter of `drawImageLayer(IM, W, H, baseHue, dt, opMul)` and already in scope at both call sites.
- Produces: nothing new — single-task plan, no other task depends on this.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Backdrop/Spin colorDrift filter-clobber fix");

ok("backdrop mode only applies its automatic colorDrift tint when no Image Layer filter is selected", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn && fn.includes('if (IM.filter === "none" && ctrl.colorDrift > 0.02) ctx.filter = `hue-rotate(${(S.hueShift * 2) | 0}deg) saturate(${1 + beat * 0.5})`;');
})());

ok("spin mode only applies its automatic colorDrift tint when no Image Layer filter is selected", (() => {
  const fn = extractFn("drawImageLayer");
  return !!fn && fn.includes('if (IM.filter === "none" && ctrl.colorDrift > 0.02) ctx.filter = `hue-rotate(${(S.hueShift * 2) | 0}deg) saturate(${1 + beat * 0.4})`;');
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: both new assertions under "Backdrop/Spin colorDrift filter-clobber fix" print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement — `backdrop`**

At `elastic-morph.html:6416`, find:

```js
    if (ctrl.colorDrift > 0.02) ctx.filter = `hue-rotate(${(S.hueShift * 2) | 0}deg) saturate(${1 + beat * 0.5})`;
```

Replace it with:

```js
    if (IM.filter === "none" && ctrl.colorDrift > 0.02) ctx.filter = `hue-rotate(${(S.hueShift * 2) | 0}deg) saturate(${1 + beat * 0.5})`;
```

- [ ] **Step 4: Implement — `spin`**

At `elastic-morph.html:6434`, find:

```js
    if (ctrl.colorDrift > 0.02) ctx.filter = `hue-rotate(${(S.hueShift * 2) | 0}deg) saturate(${1 + beat * 0.4})`;
```

Replace it with:

```js
    if (IM.filter === "none" && ctrl.colorDrift > 0.02) ctx.filter = `hue-rotate(${(S.hueShift * 2) | 0}deg) saturate(${1 + beat * 0.4})`;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 2 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "fix: backdrop/spin no longer let colorDrift's auto-tint override the chosen Image Layer filter

Root cause from live production debugging (drawImage ctx.filter
interception on the deployed app): backdrop/spin's own colorDrift-
driven hue-rotate tint unconditionally overwrote whatever ctx.filter
the wrapper had just set from the user's selected Image Layer filter
(e.g. 'dreamy'). colorDrift defaults to 0.5, well above the 0.02
threshold, so this fired almost always -- the filter dropdown silently
did nothing on these two modes specifically, in both Chrome and
Safari (a pure JS logic bug, not a Safari rendering quirk).

Guard both colorDrift tint lines on IM.filter === \"none\": the
automatic tint still applies exactly as before when no filter is
selected, but a user's explicit filter choice now wins, matching all
other 16 Image Layer modes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

Not covered by `test.js` (no real filter-vs-colorDrift visual comparison in
the static harness):

1. Select `backdrop` mode, pick a strong filter (e.g. "Schwarzweiß"), with
   Color Drift at its default (~50) — confirm the filter is now visibly
   applied (previously: invisible, always showing the hue-rotate tint
   instead).
2. Same for `spin`.
3. Select `backdrop` or `spin` with filter left at "Kein" (none) — confirm
   the automatic Color Drift hue tint still animates as before (no
   regression for users who don't pick a filter).
4. Confirm this holds in **both** Chrome and Safari (the bug was
   browser-independent, so the fix should be too).
