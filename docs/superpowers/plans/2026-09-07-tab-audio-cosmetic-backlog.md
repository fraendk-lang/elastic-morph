# Tab-/System-Audio Cosmetic Backlog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 5 remaining UI/dramaturgy sites treat `S.tabAudioMode` identically to `S.micMode` — closing the cosmetic backlog documented after the 2026-09-05 Tab-/System-Audio transport parity work.

**Architecture:** Five one-line changes, all the same shape (add `|| S.tabAudioMode` alongside every `S.micMode` check that means "is live/unbounded audio active," or `&& !S.tabAudioMode` for the one negated case). 3 sites are native to `elastic-morph.html`; 2 are in the build-injected `src/inject-v65.js`.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`), `node build.js` merge step for `src/inject-vNN.js` modules.

## Global Constraints

- Full design/rationale: `docs/superpowers/specs/2026-09-07-tab-audio-cosmetic-backlog-design.md`.
- Exactly 5 lines change, across 2 files. No other behavior changes.
- `updateUI`, `introAlpha`, and the drop-dramaturgy block inside `drawScene` are confirmed native to `elastic-morph.html` — no rebuild needed for those 3.
- `getCreatorLookPicks`, `updateLookSwipeHint`, and `updateDemoBanner` are confirmed build-injected from `src/inject-v65.js` (confirmed via `grep -n "micMode" src/inject-v65.js`) — edit `src/inject-v65.js` directly, never the generated copy, then run `node build.js` before `node test.js`.
- `S.tabAudioMode` is an existing boolean, already set/cleared by `toggleTabAudio()` (shipped 2026-09-05) — no new state needed.

---

### Task 1: Give Tab-/System-Audio parity on the 5 remaining cosmetic sites

**Files:**
- Modify: `elastic-morph.html:10285` (`updateUI`'s time label)
- Modify: `elastic-morph.html:5826` (`introAlpha`)
- Modify: `elastic-morph.html:5970` (drop-dramaturgy cycle duration, inside `drawScene`)
- Modify: `src/inject-v65.js:28` (`getCreatorLookPicks`)
- Modify: `src/inject-v65.js:49` (`updateLookSwipeHint`)
- Modify: `src/inject-v65.js:67` (`updateDemoBanner`)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Consumes: `S.tabAudioMode` (existing boolean, unchanged).
- Produces: nothing new — single-task plan.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Tab-/System-Audio cosmetic backlog (5 sites)");

ok("updateUI's time label shows LIVE format during tab-audio, not just mic", (() => {
  const fn = extractFn("updateUI");
  return !!fn && fn.includes('$("timeLabel").textContent = (S.micMode || S.tabAudioMode)');
})());

ok("introAlpha shows the intro cover during tab-audio, not just mic", (() => {
  const fn = extractFn("introAlpha");
  return !!fn && fn.includes("if (!S.intro.on || !(audioEl.src || S.micMode || S.tabAudioMode)) return 0;");
})());

ok("drawScene's drop-dramaturgy cycle uses the 240s live duration during tab-audio, not just mic", (() => {
  const fn = extractFn("drawScene");
  return !!fn && fn.includes("if (S.micMode || S.tabAudioMode) dur = 240; else if (!audioEl.src) dur = 180;");
})());

ok("getCreatorLookPicks treats tab-audio as having a track, not just mic", (() => {
  const fn = extractFn("getCreatorLookPicks");
  return !!fn && fn.includes("const hasTrack = !!(S.audioBuffer || audioEl.src || S.micMode || S.tabAudioMode);");
})());

ok("updateLookSwipeHint shows during tab-audio, not just mic", (() => {
  const fn = extractFn("updateLookSwipeHint");
  return !!fn && fn.includes("&& !!(S.audioBuffer || audioEl.src || S.micMode || S.tabAudioMode);");
})());

ok("updateDemoBanner hides during tab-audio (not just mic) so it doesn't distract from live capture", (() => {
  const fn = extractFn("updateDemoBanner");
  return !!fn && fn.includes("const show = S.demoMode && !audioEl.src && !S.micMode && !S.tabAudioMode;");
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node build.js && node test.js`
Expected: all 6 new assertions under "Tab-/System-Audio cosmetic backlog (5 sites)" print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement — `updateUI`'s time label (`elastic-morph.html:10285`)**

Find:

```js
  $("timeLabel").textContent = S.micMode
    ? `LIVE · ${fmtTime(S.virtualT)}`
    : `${fmtTime(audioEl.currentTime)} / ${fmtTime(audioEl.duration)}`;
```

Replace it with:

```js
  $("timeLabel").textContent = (S.micMode || S.tabAudioMode)
    ? `LIVE · ${fmtTime(S.virtualT)}`
    : `${fmtTime(audioEl.currentTime)} / ${fmtTime(audioEl.duration)}`;
```

- [ ] **Step 4: Implement — `introAlpha` (`elastic-morph.html:5826`)**

Find:

```js
function introAlpha() {
  if (!S.intro.on || !(audioEl.src || S.micMode)) return 0;
```

Replace it with:

```js
function introAlpha() {
  if (!S.intro.on || !(audioEl.src || S.micMode || S.tabAudioMode)) return 0;
```

- [ ] **Step 5: Implement — drop-dramaturgy cycle duration (`elastic-morph.html:5970`)**

Find:

```js
    let dur = audioEl.duration || 0;
    if (S.micMode) dur = 240; else if (!audioEl.src) dur = 180;
```

Replace it with:

```js
    let dur = audioEl.duration || 0;
    if (S.micMode || S.tabAudioMode) dur = 240; else if (!audioEl.src) dur = 180;
```

- [ ] **Step 6: Implement — `getCreatorLookPicks` and `updateLookSwipeHint` (`src/inject-v65.js`)**

Find:

```js
function getCreatorLookPicks() {
  const hasTrack = !!(S.audioBuffer || audioEl.src || S.micMode);
  if (!hasTrack) return [];
```

Replace it with:

```js
function getCreatorLookPicks() {
  const hasTrack = !!(S.audioBuffer || audioEl.src || S.micMode || S.tabAudioMode);
  if (!hasTrack) return [];
```

Find:

```js
function updateLookSwipeHint() {
  const hint = $("lookSwipeHint");
  if (!hint) return;
  const show = S.uiMode === "creator"
    && document.body.classList.contains("is-touch")
    && !!(S.audioBuffer || audioEl.src || S.micMode);
```

Replace it with:

```js
function updateLookSwipeHint() {
  const hint = $("lookSwipeHint");
  if (!hint) return;
  const show = S.uiMode === "creator"
    && document.body.classList.contains("is-touch")
    && !!(S.audioBuffer || audioEl.src || S.micMode || S.tabAudioMode);
```

- [ ] **Step 7: Implement — `updateDemoBanner` (`src/inject-v65.js`)**

Find:

```js
function updateDemoBanner() {
  const el = $("demoBanner");
  if (!el) return;
  const show = S.demoMode && !audioEl.src && !S.micMode;
  el.classList.toggle("show", show);
}
```

Replace it with:

```js
function updateDemoBanner() {
  const el = $("demoBanner");
  if (!el) return;
  const show = S.demoMode && !audioEl.src && !S.micMode && !S.tabAudioMode;
  el.classList.toggle("show", show);
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `node build.js && node test.js`
Expected: all assertions print `✓`, including the 6 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 9: Commit**

```bash
git add elastic-morph.html src/inject-v65.js test.js
git commit -m "fix: give Tab-/System-Audio parity on 5 remaining cosmetic sites

Closes the cosmetic backlog documented after the 2026-09-05 Tab-/
System-Audio transport parity work: 5 sites still checked S.micMode
alone, missing the equally-live S.tabAudioMode --

- updateUI's HUD time label showed 0:00/0:00 instead of LIVE mm:ss
- introAlpha() never showed the intro cover during tab-audio
- drawScene's drop-dramaturgy cycle used the 180s idle fallback
  instead of the 240s live-cycle duration mic mode gets
- getCreatorLookPicks/updateLookSwipeHint never showed Creator-mode
  look-swipe suggestions/hints during tab-audio
- updateDemoBanner could show the 'try the demo' banner while
  tab-audio was actively capturing (the one negated-direction case)

All 5 are the same one-line fix: S.micMode -> S.micMode ||
S.tabAudioMode (or the negated form for the demo banner). 3 sites
native to elastic-morph.html, 2 build-injected from src/inject-v65.js.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

1. Start Tab-/System-Audio capture (no file loaded, not mic) — confirm the
   HUD time label reads `LIVE · mm:ss` (counting up), not `0:00 / 0:00`.
2. With an intro cover image configured and Tab-/System-Audio active —
   confirm the cover shows and fades out on schedule, same as it already
   does for mic.
3. In Creator mode on a touch device (or with `is-touch` class forced) with
   Tab-/System-Audio active — confirm the look-swipe hint and suggestions
   appear.
4. With Demo Mode on and Tab-/System-Audio active — confirm the demo
   banner does NOT appear (it should only prompt when truly idle).
