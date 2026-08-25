# Video Timeline — More Transition Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five new Video Timeline transition types — Iris, Zoom-Cross, Slide Vertical, Slide Diagonal, Glitch/RGB-Split — alongside the three that shipped earlier today (Dissolve, Wipe, Slide).

**Architecture:** All changes live in `drawBgVideoTimeline(W, H)` in `elastic-morph.html`, which sits entirely before the `@BUILD-INJECT-V58` marker (line 9874) — this feature is never touched by `build.js`'s regeneration step, so every edit below goes directly into `elastic-morph.html`, not any `src/inject-vNN.js` module. The shared `drawClip(el, alpha, xOff)` helper (a `const` arrow function nested inside `drawBgVideoTimeline`) gains two new optional parameters. Four of the five new types are new `if (type === ...)` branches following the existing pattern; Glitch additionally reuses the FX Rack's channel-isolation technique (`chC`/`chctx`/`fxC`/`fxctx` scratch canvases, already declared at module scope) instead of introducing a new canvas.

**Tech Stack:** Vanilla JS, HTML5 Canvas 2D. Zero-dependency test harness (`test.js`) that extracts function source via brace-matching and runs structural (`fn.includes(...)`) assertions — this codebase has no headless-canvas test runner, so canvas-drawing functions are tested by asserting their source contains the right dispatch branches and math, not by executing them and inspecting pixels. This matches the existing test style for every other DNA-visual engine (see `test.js`'s "Graphic EQ DNA Visual" section for the reference pattern).

## Global Constraints

- Every edit in this plan lands in `elastic-morph.html` before line 9874 (`@BUILD-INJECT-V58`) — never touch `src/inject-vNN.js` for this work.
- After every task's code change, run `npm run ci` (`node build.js && node test.js`) and confirm `git diff --stat elastic-morph.html` is empty post-build — a non-empty diff means something drifted between the source and the build-regenerated region, per `project_morph_build_pipeline_gotcha`.
- Existing type values `cut`, `dissolve`, `wipe`, `slide` must keep working byte-for-byte identically — every new branch is additive, appended after the existing `else if` chain, never modifying prior branches' math.
- New type values: `iris`, `zoom`, `slide-v`, `slide-d`, `glitch`. The existing `slide` value's *label* changes to "Slide Horizontal" in both UI selects; its *value* and its `drawBgVideoTimeline` branch are untouched.
- No new per-clip configuration (origin, scale range, intensity) for any of the five — all curves are fixed, per the approved design spec (`docs/superpowers/specs/2026-08-25-video-timeline-more-transitions-design.md`).
- Commit after each task. Push after each commit (Frank wants to see progress live — though note this feature's live-playback path doesn't need a deploy to test locally; push at natural checkpoints, at minimum after Task 7).

---

### Task 1: Extend `drawClip` with `yOff` and `scale`

**Files:**
- Modify: `elastic-morph.html:4964-4975` (the `drawClip` helper nested inside `drawBgVideoTimeline`)
- Test: `test.js` (new section, insert before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Produces: `drawClip(el, alpha, xOff, yOff = 0, scale = 1)` — existing 3-arg call sites (`drawClip(from.el, 1 - p, 0)` etc.) keep working unchanged since the two new params are optional with defaults matching current behavior (`yOff` default 0 = no vertical shift, `scale` default 1 = no size change).

- [ ] **Step 1: Write the failing test**

Add to `test.js`, before the summary block:

```js
/* ---------------- Video Timeline: more transition types ---------------- */
section("Video Timeline — more transition types");

ok("drawClip accepts optional yOff and scale params with backward-compatible defaults", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn && fn.includes("const drawClip = (el, alpha, xOff, yOff = 0, scale = 1)");
})());

ok("drawClip applies yOff to dy and scale to dw/dh before centering", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes("const dw = vw * scale * s, dh = vh * scale * s")
    && fn.includes("dy = (H - dh) / 2 + yOff");
})());
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test.js 2>&1 | grep -A2 "more transition types"`
Expected: both new assertions print `✗` (the source doesn't contain the new signature/math yet).

- [ ] **Step 3: Write minimal implementation**

In `elastic-morph.html`, replace the `drawClip` definition (currently lines 4964-4975):

```js
  const drawClip = (el, alpha, xOff, yOff = 0, scale = 1) => {
    if (!el || el.readyState < 2) return;
    const vw = el.videoWidth, vh = el.videoHeight;
    if (!vw || !vh) return;
    const s = v.cover ? Math.max(W / vw, H / vh) : Math.min(W / vw, H / vh);
    const dw = vw * scale * s, dh = vh * scale * s, dx = (W - dw) / 2 + xOff, dy = (H - dh) / 2 + yOff;
    ctx.save();
    ctx.globalAlpha = v.opacity * alpha;
    ctx.globalCompositeOperation = v.blend;
    try { ctx.drawImage(el, dx, dy, dw, dh); } catch (e) { }
    ctx.restore();
  };
```

(Renamed the local `scale` variable that held the cover/contain fit ratio to `s`, since the parameter is now called `scale` — this is the only behavioral-neutral rename needed; every existing call site still passes exactly 3 args, so `yOff`/`scale` default to 0/1 and `dw`/`dh`/`dx`/`dy` compute identically to before.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node test.js 2>&1 | grep -A2 "more transition types"`
Expected: both assertions print `✓`.

- [ ] **Step 5: Run full suite and check for build drift**

Run: `npm run ci`
Expected: all tests pass (379+), 0 failed.

Run: `git diff --stat elastic-morph.html`
Expected: no output (build.js regenerating from source modules reproduces the file identically — this task didn't touch anything inside the `@BUILD-INJECT-V58` region, so this should trivially hold).

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "refactor: extend Video Timeline drawClip with yOff and scale params"
```

---

### Task 2: Iris transition

**Files:**
- Modify: `elastic-morph.html` — the `if (type === ...)` chain in `drawBgVideoTimeline` (ends at what was line 4988, `} else if (type === "slide") { ... }`)
- Test: `test.js`

**Interfaces:**
- Consumes: `drawClip(el, alpha, xOff, yOff, scale)` from Task 1.
- Produces: `type === "iris"` branch — no new state, no new function name for later tasks to reference.

- [ ] **Step 1: Write the failing test**

Append to the "Video Timeline — more transition types" section in `test.js`:

```js
ok("iris branch clips a growing circle centered on screen for the incoming clip", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes('type === "iris"')
    && fn.includes("Math.hypot(W, H) / 2 * p")
    && fn.includes("ctx.arc(W / 2, H / 2,");
})());
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test.js 2>&1 | grep "iris branch"`
Expected: `✗`.

- [ ] **Step 3: Write minimal implementation**

Add a new branch immediately after the existing `slide` branch, before the closing `}` of the `if/else if` chain:

```js
  } else if (type === "iris") {
    drawClip(from.el, 1, 0);
    ctx.save(); ctx.beginPath();
    ctx.arc(W / 2, H / 2, Math.max(1, Math.hypot(W, H) / 2 * p), 0, Math.PI * 2);
    ctx.clip();
    drawClip(to.el, 1, 0);
    ctx.restore();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test.js 2>&1 | grep "iris branch"`
Expected: `✓`.

- [ ] **Step 5: Run full suite**

Run: `npm run ci` — expect 0 failed. Run: `git diff --stat elastic-morph.html` — expect empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Iris transition to Video Timeline"
```

---

### Task 3: Zoom-Cross transition

**Files:**
- Modify: `elastic-morph.html` — same `if/else if` chain, new branch after `iris`
- Test: `test.js`

**Interfaces:**
- Consumes: `drawClip(el, alpha, xOff, yOff, scale)` from Task 1.
- Produces: `type === "zoom"` branch.

- [ ] **Step 1: Write the failing test**

```js
ok("zoom branch scales the incoming clip from 0.3 to 1.0 while the outgoing clip fades at full scale", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes('type === "zoom"')
    && fn.includes("drawClip(from.el, 1 - p, 0)")
    && fn.includes("drawClip(to.el, p, 0, 0, 0.3 + 0.7 * p)");
})());
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test.js 2>&1 | grep "zoom branch"` — expect `✗`.

- [ ] **Step 3: Write minimal implementation**

```js
  } else if (type === "zoom") {
    drawClip(from.el, 1 - p, 0);
    drawClip(to.el, p, 0, 0, 0.3 + 0.7 * p);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test.js 2>&1 | grep "zoom branch"` — expect `✓`.

- [ ] **Step 5: Run full suite**

`npm run ci` — 0 failed. `git diff --stat elastic-morph.html` — empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Zoom-Cross transition to Video Timeline"
```

---

### Task 4: Slide Vertical and Slide Diagonal transitions

**Files:**
- Modify: `elastic-morph.html` — same `if/else if` chain, two new branches after `zoom`
- Test: `test.js`

**Interfaces:**
- Consumes: `drawClip(el, alpha, xOff, yOff, scale)` from Task 1.
- Produces: `type === "slide-v"` and `type === "slide-d"` branches.

- [ ] **Step 1: Write the failing test**

```js
ok("slide-v branch pushes vertically using yOff, xOff left at 0", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes('type === "slide-v"')
    && fn.includes("drawClip(from.el, 1, 0, -H * p)")
    && fn.includes("drawClip(to.el, 1, 0, H * (1 - p))");
})());

ok("slide-d branch pushes both axes together for a diagonal push", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes('type === "slide-d"')
    && fn.includes("drawClip(from.el, 1, -W * p, -H * p)")
    && fn.includes("drawClip(to.el, 1, W * (1 - p), H * (1 - p))");
})());
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test.js 2>&1 | grep "slide-"` — expect both `✗`.

- [ ] **Step 3: Write minimal implementation**

```js
  } else if (type === "slide-v") {
    drawClip(from.el, 1, 0, -H * p);
    drawClip(to.el, 1, 0, H * (1 - p));
  } else if (type === "slide-d") {
    drawClip(from.el, 1, -W * p, -H * p);
    drawClip(to.el, 1, W * (1 - p), H * (1 - p));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test.js 2>&1 | grep "slide-"` — expect both `✓`.

- [ ] **Step 5: Run full suite**

`npm run ci` — 0 failed. `git diff --stat elastic-morph.html` — empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Slide Vertical and Slide Diagonal transitions to Video Timeline"
```

---

### Task 5: Glitch/RGB-Split transition

**Files:**
- Modify: `elastic-morph.html` — same `if/else if` chain, final new branch after `slide-d`, plus a new helper function defined alongside `drawClip` inside `drawBgVideoTimeline`
- Test: `test.js`

**Interfaces:**
- Consumes: `fxC`/`fxctx` (full-res snapshot scratch canvas, declared module-scope at `elastic-morph.html:2891`) and `chC`/`chctx` (channel-isolation scratch canvas, declared module-scope at `elastic-morph.html:2892`) — both already sized to `canvas.width`/`canvas.height` by the existing resize handler (`elastic-morph.html:8853-8854`), so no new sizing wiring is needed. Consumes `v` (= `S.bgVid`, already in scope in `drawBgVideoTimeline`) for `.cover`/`.opacity`/`.blend`.
- Produces: `type === "glitch"` branch. No new state.

- [ ] **Step 1: Write the failing test**

```js
ok("glitch branch draws each clip cover-fit into fxctx, then channel-isolates via chC with an envelope peaking at p=0.5", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes('type === "glitch"')
    && fn.includes("const envelope = Math.sin(p * Math.PI)")
    && fn.includes("drawGlitchClip(from.el, 1 - p, envelope)")
    && fn.includes("drawGlitchClip(to.el, p, envelope)")
    && fn.includes('chctx.globalCompositeOperation = "multiply"')
    && fn.includes('chctx.globalCompositeOperation = "destination-in"');
})());

ok("drawGlitchClip falls back to a plain drawClip call when the envelope is negligible", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn && fn.includes("if (!el || el.readyState < 2 || envelope <= 0.02) { drawClip(el, alpha, 0); return; }");
})());
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test.js 2>&1 | grep -i glitch` — expect both `✗`.

- [ ] **Step 3: Write minimal implementation**

Add `drawGlitchClip` as a second nested helper, right after the `drawClip` definition from Task 1 (still inside `drawBgVideoTimeline`, before the `const { from, to, p, type } = S.bgVidTrans;` line):

```js
  const drawGlitchClip = (el, alpha, envelope) => {
    if (!el || el.readyState < 2 || envelope <= 0.02) { drawClip(el, alpha, 0); return; }
    const vw = el.videoWidth, vh = el.videoHeight;
    if (!vw || !vh) return;
    const s = v.cover ? Math.max(W / vw, H / vh) : Math.min(W / vw, H / vh);
    const dw = vw * s, dh = vh * s, dx = (W - dw) / 2, dy = (H - dh) / 2;
    fxctx.clearRect(0, 0, W, H);
    fxctx.globalAlpha = 1; fxctx.globalCompositeOperation = "source-over";
    try { fxctx.drawImage(el, dx, dy, dw, dh); } catch (e) { return; }
    ctx.save();
    ctx.globalAlpha = v.opacity * alpha;
    const d = Math.max(2, W * 0.01 * envelope);
    const chans = [["#ff0000", -d, 0], ["#00ff00", 0, 0], ["#0000ff", d, 0]];
    ctx.globalCompositeOperation = "lighter";
    for (const [col, ox, oy] of chans) {
      chctx.globalCompositeOperation = "copy"; chctx.globalAlpha = 1;
      chctx.drawImage(fxC, 0, 0);
      chctx.globalCompositeOperation = "multiply";
      chctx.fillStyle = col; chctx.fillRect(0, 0, W, H);
      chctx.globalCompositeOperation = "destination-in";
      chctx.drawImage(fxC, 0, 0);
      ctx.drawImage(chC, ox, oy);
    }
    ctx.globalCompositeOperation = v.blend;
    const slices = 4;
    for (let i = 0; i < slices; i++) {
      const sy = (i / slices) * H + (Math.random() - 0.5) * (H / slices) * 0.4;
      const sh = H / slices * 0.5;
      const sx = (Math.random() - 0.5) * W * 0.06 * envelope;
      ctx.drawImage(fxC, 0, sy, W, sh, sx, sy, W, sh);
    }
    ctx.restore();
  };
```

Add the dispatch branch after `slide-d`:

```js
  } else if (type === "glitch") {
    const envelope = Math.sin(p * Math.PI);
    drawGlitchClip(from.el, 1 - p, envelope);
    drawGlitchClip(to.el, p, envelope);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test.js 2>&1 | grep -i glitch` — expect both `✓`.

- [ ] **Step 5: Run full suite**

`npm run ci` — 0 failed. `git diff --stat elastic-morph.html` — empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Glitch/RGB-Split transition to Video Timeline"
```

---

### Task 6: Wire the five new types into both transition-type UI selects

**Files:**
- Modify: `elastic-morph.html:2095-2099` (static `#bgVidTLTransType` select markup)
- Modify: `elastic-morph.html` — the `renderBgVidTLPanel()` function's template string that builds the per-clip `#bgVidClipTrans` select (currently a single-line `<select id="bgVidClipTrans">...</select>` literal)
- Test: `test.js`

**Interfaces:**
- Consumes: type values `iris`, `zoom`, `slide-v`, `slide-d`, `glitch` from Tasks 2-5 (must match exactly — a typo here means the dropdown silently selects a type `drawBgVideoTimeline` never matches, falling through to no-op).
- Produces: nothing new for later tasks — this is the last code task before verification.

- [ ] **Step 1: Write the failing test**

```js
const tlTransBlock = (html.match(/<select id="bgVidTLTransType"[^>]*>([\s\S]*?)<\/select>/) || [])[1] || "";
["cut", "dissolve", "wipe", "slide", "slide-v", "slide-d", "iris", "zoom", "glitch"].forEach(v =>
  ok("#bgVidTLTransType has option value=" + v, tlTransBlock.includes('value="' + v + '"')));
ok("#bgVidTLTransType relabels slide to Slide Horizontal", tlTransBlock.includes('value="slide">Slide Horizontal<'));

ok("renderBgVidTLPanel's per-clip select includes all 9 transition options with matching labels", (() => {
  const fn = extractFn("renderBgVidTLPanel");
  if (!fn) return false;
  const opts = ["cut>Cut", "dissolve>Dissolve", "wipe>Wipe", "slide\">Slide Horizontal",
    "slide-v\">Slide Vertikal", "slide-d\">Slide Diagonal", "iris\">Iris", "zoom\">Zoom-Cross", "glitch\">Glitch"];
  return opts.every(o => fn.includes(o));
})());
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test.js 2>&1 | grep -E "bgVidTLTransType|renderBgVidTLPanel"` — expect several `✗` (the 5 new option checks, plus the relabel check, plus the per-clip select check).

- [ ] **Step 3: Write minimal implementation**

Replace the static select block at `elastic-morph.html:2095-2099`:

```html
        <select id="bgVidTLTransType" style="margin-left:6px;background:#0a0a12;color:var(--text);border:1px solid var(--line);border-radius:6px;padding:3px 6px;font-size:11px">
          <option value="cut">Cut</option>
          <option value="dissolve" selected>Dissolve</option>
          <option value="wipe">Wipe</option>
          <option value="slide">Slide Horizontal</option>
          <option value="slide-v">Slide Vertikal</option>
          <option value="slide-d">Slide Diagonal</option>
          <option value="iris">Iris</option>
          <option value="zoom">Zoom-Cross</option>
          <option value="glitch">Glitch</option>
        </select>
```

Replace the per-clip select line inside `renderBgVidTLPanel()` (currently the single `<label>Übergang <select id="bgVidClipTrans">...` line):

```js
    `<label>Übergang <select id="bgVidClipTrans"><option value="cut">Cut</option><option value="dissolve">Dissolve</option><option value="wipe">Wipe</option><option value="slide">Slide Horizontal</option><option value="slide-v">Slide Vertikal</option><option value="slide-d">Slide Diagonal</option><option value="iris">Iris</option><option value="zoom">Zoom-Cross</option><option value="glitch">Glitch</option></select></label>` +
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test.js 2>&1 | grep -E "bgVidTLTransType|renderBgVidTLPanel"` — expect all `✓`.

- [ ] **Step 5: Run full suite**

`npm run ci` — 0 failed. `git diff --stat elastic-morph.html` — empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: wire 5 new transition types into Video Timeline UI selects"
```

---

### Task 7: Live verification and push

**Files:** none (verification only)

**Interfaces:** none — terminal task.

- [ ] **Step 1: Start the local dev server and open the Video Timeline editor**

Run: `npm start` (serves `elastic-morph.html` as-is — does *not* run `build.js`, so this is testing the exact file that was just hand-edited across Tasks 1-6). Open the app, upload any short video twice via the existing "🎬 Open Video Timeline" panel to create two clips with a gap between them.

- [ ] **Step 2: Force each new transition type via the browser console and confirm the expected visual shape**

For each of `iris`, `zoom`, `slide-v`, `slide-d`, `glitch`: select it in the per-clip transition dropdown, then in the console step through the transition window by setting `S.bgVidTrans = { from: S.bgVidCues[0], to: S.bgVidCues[1], p: <0, 0.5, 1>, type: "<type>" }` and observe the canvas at each `p`. Expected:
- `iris`: a circle grows from the screen center, revealing the incoming clip inside it, outgoing clip fills the rest.
- `zoom`: incoming clip visibly small and growing to full size while fading in; outgoing clip stays full-size while fading out.
- `slide-v`: outgoing clip pushed off the top, incoming clip pushed in from the bottom (or the reverse, whichever matches the sign convention above — confirm it's vertical motion, not horizontal).
- `slide-d`: both clips move diagonally at once.
- `glitch`: visible RGB channel fringing plus horizontal slice jitter, most intense at `p = 0.5`, minimal at `p = 0` and `p = 1`.

- [ ] **Step 3: Confirm the three original transitions and the zero-cues legacy path are unchanged**

Repeat the same console-forced check for `dissolve`, `wipe`, `slide` — confirm they look identical to how they behaved before this plan (crossfade, rectangular wipe, horizontal push respectively). Then clear `S.bgVidCues = []` and confirm a plain single background video (no timeline) still renders via the original `drawBgVideo` path with no console errors.

- [ ] **Step 4: Check the console for errors**

Confirm zero console errors/warnings during all of the above, including during the `glitch` type's `fxC`/`chC` scratch-canvas usage (these buffers are shared with the FX Rack's post-processing — confirm nothing looks corrupted in any other visual effect immediately after triggering a glitch transition, since both features share the same scratch canvases sequentially).

- [ ] **Step 5: Final full-suite run and build-drift check**

Run: `npm run ci` — expect all tests passing, 0 failed.
Run: `git diff --stat elastic-morph.html` — expect empty.
Run: `git status` — expect clean (everything already committed across Tasks 1-6).

- [ ] **Step 6: Push**

```bash
git push origin main
```

(Requires the Bash tool's `dangerouslyDisableSandbox: true` flag in this environment, or `git push` hangs indefinitely — see the `git-sandbox-network-blocker` memory. This is an environment quirk, not something to fix in the repo.)

- [ ] **Step 7: Confirm live**

`curl -s https://elasticmorph.app/sw.js | grep -n "CACHE_NAME\|const CACHE"` and compare against the local `sw.js` — if Vercel's deploy hasn't picked up the push yet, wait and recheck rather than assuming it's live from a "pushed" state alone (per `project_morph_build_pipeline_gotcha`: a successful push and a READY deployment are not proof of correctness — this task's cache-name check plus a live grep for one of the five new type strings in the deployed `elastic-morph.html` is the actual bar).
