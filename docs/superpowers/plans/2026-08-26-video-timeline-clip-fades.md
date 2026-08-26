# Video Timeline — Clip Fades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-clip fade-in/fade-out to the Elastic Morph Video Timeline, so a clip can fade to/from black at its own edges when there's no cross-clip transition there.

**Architecture:** Two new per-cue fields (`fadeIn`, `fadeOut`, both defaulting to `0`). `updateBgVideoTimeline` computes a single `S.bgVid._fadeAlpha` transient value each frame (mirroring the existing `_active` transient-flag pattern), suppressing the fade whenever a real cross-clip transition already covers that edge. `drawBgVideoTimeline`'s existing no-active-transition branch composites an explicit black rectangle on top of the drawn clip, scaled by how faded it currently is — not a simple alpha reduction, because the canvas isn't cleared to black each frame (a DNA-visual trail-fade residue sits underneath).

**Tech Stack:** Vanilla JS, HTML5 Canvas 2D. Same zero-dependency `test.js` harness as the rest of the codebase. This plan gives the fade-alpha state-machine logic genuine behavioral tests (`loadFns` + a mock `S`/cue array), following this session's established precedent that structural `extractFn`+`.includes()` string checks cannot catch multi-clip elapsed-time state bugs — exactly the class of bug a live-verification pass found twice already in this feature's earlier rounds. DOM/canvas-heavy pieces (the black-overlay draw code, the UI panel wiring) use the codebase's normal structural test style.

## Global Constraints

- Every edit lands in `elastic-morph.html` before line 10042 (`@BUILD-INJECT-V58`, re-verify with `grep -n "@BUILD-INJECT-V58" elastic-morph.html` before starting — it has drifted several times today) — never touch `src/inject-vNN.js` for this work.
- After every task's code change, run `npm run ci` (`node build.js && node test.js`) and confirm `git diff --stat elastic-morph.html` is empty post-build.
- `fadeIn`/`fadeOut` default to `0` (opt-in) — no existing or newly-created clip changes behavior unless the user explicitly sets a fade.
- Fades apply **only** where no real cross-clip transition already exists at that edge. A cue's own `transType`/`transDur` describe its *incoming* transition; the *next* cue's `transType`/`transDur` describe the current cue's *outgoing* transition.
- **First-clip edge case:** a cue's `transType` defaults to `"dissolve"` even for the very first clip on an empty timeline, but no transition can actually trigger without a previous cue to transition from. The fade-in suppression check must also require `idx > 0` (a previous cue exists in the sorted array), not just look at `transType`/`transDur` alone.
- Fade is to black, video-layer only — the DNA-visual layer (drawn by a separate call immediately after `drawBgVideoTimeline` returns) is completely unaffected.
- Fades never apply during an active cross-clip transition — this falls out of the existing branch structure (the transition dispatch is a separate `if` branch below the no-transition case) and needs no extra guard.

---

### Task 1: Data model — `addBgVidClipAt` gains `fadeIn`/`fadeOut` cue fields

**Files:**
- Modify: `elastic-morph.html:9912-9923` (`addBgVidClipAt` — verify current line with `grep -n "function addBgVidClipAt" elastic-morph.html`, may have shifted)
- Test: `test.js`

**Interfaces:**
- Produces: every new `S.bgVidCues` entry has `fadeIn` (number, seconds, default `0`) and `fadeOut` (number, seconds, default `0`), in addition to the existing `t`, `dur`, `name`, `src`, `el`, `kind`, `transType`, `transDur`. Later tasks read `cue.fadeIn`/`cue.fadeOut` by these exact names.

- [ ] **Step 1: Write the failing test**

Add to `test.js`, in a new section (place it right after the existing "Video Timeline — bolder waveform backdrop" section, before "Video Timeline clip editing — UI: image file acceptance + IMG glyph"):

```js
/* ---------------- Video Timeline: Clip Fades ---------------- */
section("Video Timeline Clip Fades — data model (addBgVidClipAt)");

ok("addBgVidClipAt gives every new cue fadeIn: 0 and fadeOut: 0 by default", (() => {
  const fn = extractFn("addBgVidClipAt");
  return !!fn && fn.includes("fadeIn: 0, fadeOut: 0,");
})());
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test.js 2>&1 | grep -A1 "fadeIn: 0 and fadeOut: 0"`
Expected: `✗` (the field doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Find the cue object literal inside `addBgVidClipAt` (search for `const cue = { t, dur, name:`) and add the two new fields right after `dur`:

```js
  const cue = { t, dur, fadeIn: 0, fadeOut: 0, name: file.name.replace(/\.[^.]+$/, ""), src: url, el, kind: isImage ? "image" : "video", transType: S.bgVidTransDefault.type, transDur: S.bgVidTransDefault.dur };
```

(Only the object literal line changes — nothing else in `addBgVidClipAt` is touched.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node test.js 2>&1 | grep -A1 "fadeIn: 0 and fadeOut: 0"`
Expected: `✓`.

- [ ] **Step 5: Run full suite and check for build drift**

Run: `npm run ci` — expect all tests passing, 0 failed.
Run: `git diff --stat elastic-morph.html` — expect empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: Video Timeline cues gain fadeIn/fadeOut fields (default 0)"
```

---

### Task 2: `updateBgVideoTimeline` computes `S.bgVid._fadeAlpha`

**Files:**
- Modify: `elastic-morph.html:4955-4984` (`updateBgVideoTimeline` — verify current line with `grep -n "function updateBgVideoTimeline" elastic-morph.html`)
- Test: `test.js`

**Interfaces:**
- Consumes: `cue.fadeIn`/`cue.fadeOut` from Task 1.
- Produces: `S.bgVid._fadeAlpha` — a number in `[0, 1]`, `1` meaning "not faded", written every frame `updateBgVideoTimeline` runs. Task 3 reads this exact field name.

- [ ] **Step 1: Write the failing tests**

Read the current `updateBgVideoTimeline` first (`grep -n "function updateBgVideoTimeline" elastic-morph.html` then read ~30 lines from there) to confirm the exact current text still matches what's shown in Step 3 below — this function has been edited several times today, confirm before assuming.

Add to the "Video Timeline Clip Fades" section in `test.js`, after the Task 1 test:

```js
(() => {
  global.S = {
    bgVidCues: [
      { t: 0,  dur: 10, fadeIn: 2,   fadeOut: 2,   transType: "dissolve", transDur: 1, kind: "video", el: { id: "A" } },
      { t: 10, dur: 10, fadeIn: 4,   fadeOut: 0,   transType: "cut",      transDur: 0, kind: "video", el: { id: "B" } },
      { t: 20, dur: 10, fadeIn: 1,   fadeOut: 0,   transType: "dissolve", transDur: 1, kind: "video", el: { id: "C" } },
      { t: 40, dur: 3,  fadeIn: 2.5, fadeOut: 2.5, transType: "cut",      transDur: 0, kind: "video", el: { id: "D" } }
    ],
    bgVid: { on: false, el: null, src: null },
    bgVidTrans: null,
    playing: true
  };
  global.syncClipTime = () => { };
  try {
    const { updateBgVideoTimeline } = loadFns(["updateBgVideoTimeline"]);

    updateBgVideoTimeline(1);
    ok("fadeIn applies to the very first clip on the timeline even though its default transType is not 'cut' (no previous cue exists to transition from, so the transition is inert)",
      Math.abs(global.S.bgVid._fadeAlpha - 0.5) < 1e-9);

    updateBgVideoTimeline(9);
    ok("fadeOut applies when the next cue's incoming transition is a real 'cut' (no cross-fade to suppress it)",
      Math.abs(global.S.bgVid._fadeAlpha - 0.5) < 1e-9);

    updateBgVideoTimeline(11);
    ok("fadeIn applies right after a real 'cut' boundary (own transType is cut, so no transition is suppressing it)",
      Math.abs(global.S.bgVid._fadeAlpha - 0.25) < 1e-9);

    updateBgVideoTimeline(20.5);
    ok("fadeIn is suppressed when a real (non-cut, non-zero-duration) incoming transition exists at that edge",
      global.S.bgVid._fadeAlpha === 1);

    updateBgVideoTimeline(41);
    ok("overlapping fadeIn and fadeOut on a short clip take the smaller (more-faded) of the two ramps — here fadeIn is the binding constraint",
      Math.abs(global.S.bgVid._fadeAlpha - 0.4) < 1e-9);

    updateBgVideoTimeline(42);
    ok("the same overlapping-fade clip, later in its own window, where fadeOut becomes the binding constraint instead — proves both ramps are actually compared, not just one",
      Math.abs(global.S.bgVid._fadeAlpha - 0.4) < 1e-9);
  } catch (e) {
    ok("fadeIn applies to the very first clip on the timeline even though its default transType is not 'cut' (no previous cue exists to transition from, so the transition is inert)", false, e.message);
    ok("fadeOut applies when the next cue's incoming transition is a real 'cut' (no cross-fade to suppress it)", false);
    ok("fadeIn applies right after a real 'cut' boundary (own transType is cut, so no transition is suppressing it)", false);
    ok("fadeIn is suppressed when a real (non-cut, non-zero-duration) incoming transition exists at that edge", false);
    ok("overlapping fadeIn and fadeOut on a short clip take the smaller (more-faded) of the two ramps — here fadeIn is the binding constraint", false);
    ok("the same overlapping-fade clip, later in its own window, where fadeOut becomes the binding constraint instead — proves both ramps are actually compared, not just one", false);
  } finally {
    delete global.S; delete global.syncClipTime;
  }
})();
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "fadeIn applies\|fadeOut applies\|fadeIn is suppressed\|overlapping fadeIn"`
Expected: all six new assertions print `✗` (`S.bgVid._fadeAlpha` doesn't exist yet, so every comparison is `undefined - x` → `NaN`, and `Math.abs(NaN) < 1e-9` is `false`).

- [ ] **Step 3: Write minimal implementation**

Read `updateBgVideoTimeline`'s current exact text before editing — expected to currently read (confirm first):

```js
function updateBgVideoTimeline(t) {
  S.bgVidTrans = null;
  if (!S.bgVidCues.length) return;   // legacy single-video mode: drawBgVideo() drives S.bgVid.el untouched
  let idx = -1;
  for (let i = 0; i < S.bgVidCues.length; i++) { if (S.bgVidCues[i].t <= t + 0.03) idx = i; else break; }
  let cue = idx >= 0 ? S.bgVidCues[idx] : null;
  // A resized-shorter clip's own window can end before the next clip's t arrives — once
  // t passes cue.t + cue.dur, this cue is no longer active (a gap, not a hand-off).
  if (cue && t >= cue.t + cue.dur + 0.03) cue = null;
  const next = idx + 1 < S.bgVidCues.length ? S.bgVidCues[idx + 1] : null;

  if (cue && cue.el) {
    syncClipTime(cue.el, t - cue.t, cue.kind);
    S.bgVid.el = cue.el; S.bgVid.src = cue.src; S.bgVid.on = true; S.bgVid._active = true;
  } else {
    // Only the transient render flag goes false here — S.bgVid.on is the persisted #bgVidOn
    // checkbox setting (serialized into presets/share links); writing false to it directly
    // during a mid-playback gap would silently bake "video off" into whatever gets saved next.
    S.bgVid._active = false;
  }

  if (cue && next && next.el && next.transType && next.transType !== "cut" && next.transDur > 0) {
    const winStart = next.t - next.transDur;
    if (t >= winStart && t < next.t) {
      syncClipTime(next.el, t - winStart, next.kind);
      const p = Math.min(1, Math.max(0, (t - winStart) / next.transDur));
      S.bgVidTrans = { from: cue, to: next, p, type: next.transType };
    }
  }
}
```

Insert the fade-alpha computation right after the `if (cue && cue.el) { ... } else { ... }` block, before the transition-dispatch `if (cue && next && ...)` block:

```js
  if (cue && cue.el) {
    syncClipTime(cue.el, t - cue.t, cue.kind);
    S.bgVid.el = cue.el; S.bgVid.src = cue.src; S.bgVid.on = true; S.bgVid._active = true;
  } else {
    // Only the transient render flag goes false here — S.bgVid.on is the persisted #bgVidOn
    // checkbox setting (serialized into presets/share links); writing false to it directly
    // during a mid-playback gap would silently bake "video off" into whatever gets saved next.
    S.bgVid._active = false;
  }

  let fadeAlpha = 1;
  if (cue) {
    const elapsed = t - cue.t;
    const remaining = (cue.t + cue.dur) - t;
    const hasIncomingTransition = idx > 0 && cue.transType !== "cut" && cue.transDur > 0;
    const hasOutgoingTransition = next && next.transType !== "cut" && next.transDur > 0;
    if (!hasIncomingTransition && cue.fadeIn > 0 && elapsed < cue.fadeIn) {
      fadeAlpha = Math.min(fadeAlpha, Math.max(0, elapsed / cue.fadeIn));
    }
    if (!hasOutgoingTransition && cue.fadeOut > 0 && remaining < cue.fadeOut) {
      fadeAlpha = Math.min(fadeAlpha, Math.max(0, remaining / cue.fadeOut));
    }
  }
  S.bgVid._fadeAlpha = fadeAlpha;

  if (cue && next && next.el && next.transType && next.transType !== "cut" && next.transDur > 0) {
```

(The transition-dispatch block's own code is otherwise completely unchanged — only the new `let fadeAlpha = 1; ... S.bgVid._fadeAlpha = fadeAlpha;` block is inserted between the two existing blocks.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "fadeIn applies\|fadeOut applies\|fadeIn is suppressed\|overlapping fadeIn"`
Expected: all six `✓`.

- [ ] **Step 5: Run full suite and check for build drift**

Run: `npm run ci` — expect all tests passing, 0 failed.
Run: `git diff --stat elastic-morph.html` — expect empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: updateBgVideoTimeline computes S.bgVid._fadeAlpha for clip fades"
```

---

### Task 3: `drawBgVideoTimeline` composites the fade-to-black overlay

**Files:**
- Modify: `elastic-morph.html` — the no-active-transition branch inside `drawBgVideoTimeline` (search for `if (!S.bgVidTrans) { drawClip(v.el, 1, 0); return; }`)
- Test: `test.js`

**Interfaces:**
- Consumes: `S.bgVid._fadeAlpha` from Task 2.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

```js
ok("drawBgVideoTimeline's no-transition branch composites a black overlay scaled by 1 - S.bgVid._fadeAlpha, occluding the DNA trail residue underneath rather than just lowering the clip's own alpha", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes("if (!S.bgVidTrans) {")
    && fn.includes("drawClip(v.el, 1, 0);")
    && fn.includes("const fa = v._fadeAlpha;")
    && fn.includes("if (fa !== undefined && fa < 1) {")
    && fn.includes("ctx.globalAlpha = 1 - fa;")
    && fn.includes('ctx.fillStyle = "#000";')
    && fn.includes("ctx.fillRect(0, 0, W, H);");
})());
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test.js 2>&1 | grep -A1 "composites a black overlay"`
Expected: `✗`.

- [ ] **Step 3: Write minimal implementation**

Find (search for `if (!S.bgVidTrans) { drawClip(v.el, 1, 0); return; }`) and replace:

```js
  if (!S.bgVidTrans) { drawClip(v.el, 1, 0); return; }
```

with:

```js
  if (!S.bgVidTrans) {
    drawClip(v.el, 1, 0);
    const fa = v._fadeAlpha;
    if (fa !== undefined && fa < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - fa;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    return;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test.js 2>&1 | grep -A1 "composites a black overlay"`
Expected: `✓`.

- [ ] **Step 5: Run full suite and check for build drift**

Run: `npm run ci` — expect all tests passing, 0 failed.
Run: `git diff --stat elastic-morph.html` — expect empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: drawBgVideoTimeline fades the background video layer to black"
```

---

### Task 4: UI — Fade In / Fade Out fields in the clip detail panel

**Files:**
- Modify: `elastic-morph.html:9896-9911` (`renderBgVidTLPanel` — verify current line with `grep -n "function renderBgVidTLPanel" elastic-morph.html`)
- Test: `test.js`

**Interfaces:**
- Consumes: `cue.fadeIn`/`cue.fadeOut` from Task 1.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

```js
ok("renderBgVidTLPanel renders Fade In and Fade Out numeric inputs matching the existing transDur input's style, and wires their change listeners straight to the cue", (() => {
  const fn = extractFn("renderBgVidTLPanel");
  return !!fn
    && fn.includes('<label>Fade In <input type="number" id="bgVidClipFadeIn" min="0" max="8" step="0.1" value="${cue.fadeIn || 0}" style="width:48px;background:#0a0a12;color:var(--text);border:1px solid var(--line);border-radius:4px;padding:2px 4px;font-size:11px"></label>')
    && fn.includes('<label>Fade Out <input type="number" id="bgVidClipFadeOut" min="0" max="8" step="0.1" value="${cue.fadeOut || 0}" style="width:48px;background:#0a0a12;color:var(--text);border:1px solid var(--line);border-radius:4px;padding:2px 4px;font-size:11px"></label>')
    && fn.includes('$("bgVidClipFadeIn").addEventListener("change", e => cue.fadeIn = +e.target.value);')
    && fn.includes('$("bgVidClipFadeOut").addEventListener("change", e => cue.fadeOut = +e.target.value);');
})());
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test.js 2>&1 | grep -A1 "Fade In and Fade Out numeric inputs"`
Expected: `✗`.

- [ ] **Step 3: Write minimal implementation**

Read `renderBgVidTLPanel`'s current exact text before editing — expected to currently read (confirm first):

```js
function renderBgVidTLPanel() {
  const p = $("bgVidTLPanel"), cue = S.bgVidCues[S.bgVidTLSel];
  if (!cue) {
    p.innerHTML = `<span class="muted">Kein Clip ausgewählt — <b>+ Clip @ Playhead</b> zum Hinzufügen. ${S.bgVidCues.length} Clip(s) auf der Timeline.</span>`;
    return;
  }
  p.innerHTML =
    `<span class="set-pill">@ ${fmtTime(cue.t)} — ${cue.name}</span>` +
    `<label>Übergang <select id="bgVidClipTrans">...</select></label>` +
    `<label>Dauer <input type="number" id="bgVidClipTransDur" min="0.2" max="8" step="0.1" value="${cue.transDur}" style="width:48px;background:#0a0a12;color:var(--text);border:1px solid var(--line);border-radius:4px;padding:2px 4px;font-size:11px"></label>` +
    `<button class="btn" id="bgVidClipDelBtn">Delete</button>`;
  $("bgVidClipTrans").value = cue.transType;
  $("bgVidClipTrans").addEventListener("change", e => cue.transType = e.target.value);
  $("bgVidClipTransDur").addEventListener("change", e => cue.transDur = +e.target.value);
  $("bgVidClipDelBtn").addEventListener("click", () => deleteBgVidClip(S.bgVidTLSel));
}
```

(The `<select id="bgVidClipTrans">` line has all 9 `<option>` values inline — leave that entire line exactly as-is, it's shown abbreviated above only for readability.)

Insert the two new fields between the `transDur` input and the Delete button, and their two `change` listeners between the existing `transDur` listener and the Delete button's `click` listener:

```js
  p.innerHTML =
    `<span class="set-pill">@ ${fmtTime(cue.t)} — ${cue.name}</span>` +
    `<label>Übergang <select id="bgVidClipTrans">...</select></label>` +
    `<label>Dauer <input type="number" id="bgVidClipTransDur" min="0.2" max="8" step="0.1" value="${cue.transDur}" style="width:48px;background:#0a0a12;color:var(--text);border:1px solid var(--line);border-radius:4px;padding:2px 4px;font-size:11px"></label>` +
    `<label>Fade In <input type="number" id="bgVidClipFadeIn" min="0" max="8" step="0.1" value="${cue.fadeIn || 0}" style="width:48px;background:#0a0a12;color:var(--text);border:1px solid var(--line);border-radius:4px;padding:2px 4px;font-size:11px"></label>` +
    `<label>Fade Out <input type="number" id="bgVidClipFadeOut" min="0" max="8" step="0.1" value="${cue.fadeOut || 0}" style="width:48px;background:#0a0a12;color:var(--text);border:1px solid var(--line);border-radius:4px;padding:2px 4px;font-size:11px"></label>` +
    `<button class="btn" id="bgVidClipDelBtn">Delete</button>`;
  $("bgVidClipTrans").value = cue.transType;
  $("bgVidClipTrans").addEventListener("change", e => cue.transType = e.target.value);
  $("bgVidClipTransDur").addEventListener("change", e => cue.transDur = +e.target.value);
  $("bgVidClipFadeIn").addEventListener("change", e => cue.fadeIn = +e.target.value);
  $("bgVidClipFadeOut").addEventListener("change", e => cue.fadeOut = +e.target.value);
  $("bgVidClipDelBtn").addEventListener("click", () => deleteBgVidClip(S.bgVidTLSel));
```

(Keep the actual full `<select id="bgVidClipTrans">...</select>` line's 9 options exactly as they currently are in the file — do not retype them from the abbreviated version shown here, copy them from the file as read in this step.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node test.js 2>&1 | grep -A1 "Fade In and Fade Out numeric inputs"`
Expected: `✓`.

- [ ] **Step 5: Run full suite and check for build drift**

Run: `npm run ci` — expect all tests passing, 0 failed.
Run: `git diff --stat elastic-morph.html` — expect empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: Fade In / Fade Out controls in the Video Timeline clip detail panel"
```

---

### Task 5: Live verification and push

**Files:** none (verification only)

**Interfaces:** none — terminal task.

- [ ] **Step 1: Start a dev server**

Check `lsof -i :3456 -sTCP:LISTEN` first — this port is frequently occupied by an unrelated `npm start` from a separate checkout at `~/Desktop/Elastic Morph Cursor`. If occupied, use `npx --yes serve -l <free-port>` instead (e.g. 3464, incrementing past every port already used earlier today). Confirm fresh code: `updateBgVideoTimeline.toString()` should contain `_fadeAlpha` in its body.

- [ ] **Step 2: Lone clip with no neighbors — fade in and out**

Open the Video Timeline editor, add a single video clip with nothing before or after it. Set both `Fade In` and `Fade Out` to `1.5`s via the detail panel inputs. Force playback (or directly call `updateBgVideoTimeline(t)`/`drawBgVideoTimeline(W,H)` at several `t` values spanning the clip's start, middle, and end — same isolation technique used throughout this session's earlier Video Timeline verification rounds) and confirm: the video layer visibly fades in from black at its start, is fully opaque in the middle, fades to black before its end, and the DNA-visual organism keeps animating normally underneath/around it the entire time (not blacked out itself).

- [ ] **Step 3: Fade suppressed by a real transition**

Add a second clip after the first with a Dissolve transition between them (transDur > 0). Set the second clip's `Fade In` to a nonzero value too. Confirm the dissolve transition plays normally and the second clip's fade-in has no visible effect (the transition wins, per the locked design decision) — check `S.bgVid._fadeAlpha` stays `1` throughout the transition window via console, or confirm visually there's no extra black flash layered on top of the dissolve.

- [ ] **Step 4: First-clip edge case**

On an otherwise-empty timeline, add one clip with a nonzero `Fade In` and leave its transition type at the default (`Dissolve`, per `S.bgVidTransDefault`). Confirm it still fades in correctly from black at the very start of the timeline — this is the specific edge case Task 2 exists to handle (the default non-`cut` `transType` must not suppress the fade when there's no previous clip to transition from).

- [ ] **Step 5: Regression check — clips without any fade set behave exactly as before**

Add a clip and leave `Fade In`/`Fade Out` at their default `0`. Confirm it still hard-cuts in/out exactly as every Video Timeline clip has behaved in every prior round today — zero visual change for the common case.

- [ ] **Step 6: Final full-suite run and build-drift check**

Run: `npm run ci` — expect all tests passing, 0 failed.
Run: `git diff --stat elastic-morph.html` — expect empty.
Run: `git status` — expect clean (everything already committed across Tasks 1-4).

- [ ] **Step 7: Push**

```bash
git push origin main
```

(Requires the Bash tool's `dangerouslyDisableSandbox: true` flag in this environment, or `git push` hangs indefinitely — see the `git-sandbox-network-blocker` memory.)

- [ ] **Step 8: Confirm live**

Compare local vs. `https://elasticmorph.app/elastic-morph.html` via SHA-256 (`shasum -a 256 elastic-morph.html` vs. `curl -s https://elasticmorph.app/elastic-morph.html | shasum -a 256`) — they must match exactly, following the same standard this session has used for every prior Video Timeline round. Wait and recheck if Vercel hasn't finished deploying yet rather than reporting success prematurely.
