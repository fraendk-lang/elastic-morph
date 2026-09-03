# Timeline Per-Clip Filter & Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each Video Timeline clip override the Filter (7 presets) and Fit (cover/contain) independently, falling back live to the existing global controls when unset.

**Architecture:** Two new fields (`filter`, `fit`, both `null` = inherit) live on each cue object, the same way `fadeIn`/`fadeOut`/`transType` already do. `drawClip`/`drawGlitchClip` (closures inside `drawBgVideoTimeline`) gain an optional `cue` parameter and compute an effective filter/fit per call, falling back to the global `S.bgVid.filter`/`S.bgVid.cover` when the cue has no override. Every draw call site passes its own cue explicitly — critical during transitions, where `from` and `to` are two different clips visible in the same frame and must resolve independently.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- `cue.filter`: `null` (default, inherit global) or one of `"none"`/`"cinematic"`/`"bw"`/`"duotone"`/`"vintage"`/`"dreamy"`/`"neon"`.
- `cue.fit`: `null` (default, inherit global) or `"cover"`/`"contain"`.
- `null` and `undefined` both mean "inherit" — checked via `!= null`, never `===`, so cues from old saved projects (missing these keys entirely) inherit automatically.
- `cue.filter = "none"` is a real, distinct override ("explicitly no filter") — never conflate it with `cue.filter = null` ("follow the global filter, whatever it currently is").
- No changes to `bgVidFilterCSS()` itself, no changes to `coverFilterCSS()`, no changes to any of the 7 filter presets' CSS.
- No changes to Opacity or Blend Mode handling — those stay global (out of scope, see spec's Non-Goals).

---

### Task 1: Data model + render-path inheritance

**Files:**
- Modify: `elastic-morph.html:11078` (`addBgVidClipAt` — cue object literal)
- Modify: `elastic-morph.html:5423-5432` (`updateBgVideoTimeline` — mirror active cue)
- Modify: `elastic-morph.html:5480-5608` (`drawBgVideoTimeline` — `drawClip`, `drawGlitchClip`, and every call site)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Produces: `cue.filter` / `cue.fit` (both default `null`) on every cue created by `addBgVidClipAt`.
- Produces: `S.bgVid._cue` — mirrors the currently-active cue (or `null` when there isn't one), read by the steady-state (non-transition) draw call.
- Produces: `drawClip(el, alpha, xOff, yOff = 0, scale = 1, cue = null)` and `drawGlitchClip(el, alpha, envelope, cue = null)` — both closures inside `drawBgVideoTimeline`, not called from outside it.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it (right after whatever `ok(...)` call currently precedes that comment):

```js
section("Video Timeline — per-clip Filter/Fit overrides");

ok("addBgVidClipAt's cue gains filter/fit defaulting to null (inherit global)", (() => {
  const fn = extractFn("addBgVidClipAt");
  return !!fn && fn.includes("fadeIn: 0, fadeOut: 0, filter: null, fit: null, name:");
})());

ok("updateBgVideoTimeline mirrors the active cue onto S.bgVid._cue, and clears it when there's no active cue", (() => {
  const fn = extractFn("updateBgVideoTimeline");
  return !!fn
    && fn.includes("S.bgVid.el = cue.el; S.bgVid.src = cue.src; S.bgVid.on = true; S.bgVid._active = true;\n    S.bgVid._cue = cue;")
    && fn.includes("S.bgVid._active = false;\n    S.bgVid._cue = null;");
})());

ok("drawClip accepts an optional cue param and computes effFit/effFilter from it, falling back to the global v.cover/v.filter when the cue has no override", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  return !!fn
    && fn.includes("const drawClip = (el, alpha, xOff, yOff = 0, scale = 1, cue = null) => {")
    && fn.includes('const effFit = cue && cue.fit != null ? cue.fit : (v.cover ? "cover" : "contain");')
    && fn.includes("const effFilter = cue && cue.filter != null ? cue.filter : v.filter;")
    && fn.includes('const s = effFit === "cover" ? Math.max(W / vw, H / vh) : Math.min(W / vw, H / vh);')
    && fn.includes('const filt = typeof bgVidFilterCSS === "function" ? bgVidFilterCSS({ filter: effFilter }) : "none";');
})());

ok("drawGlitchClip accepts an optional cue param, forwards it to its own drawClip fallback call, and computes effFit/effFilter the same way as drawClip", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  const idx = fn ? fn.indexOf("const drawGlitchClip = ") : -1;
  if (idx < 0) return false;
  const body = fn.slice(idx, idx + 1200);
  return body.includes("const drawGlitchClip = (el, alpha, envelope, cue = null) => {")
    && body.includes("drawClip(el, alpha, 0, 0, 1, cue); return;")
    && body.includes('const effFit = cue && cue.fit != null ? cue.fit : (v.cover ? "cover" : "contain");')
    && body.includes("const effFilter = cue && cue.filter != null ? cue.filter : v.filter;")
    && body.includes('const s = effFit === "cover" ? Math.max(hw / vw, hh / vh) : Math.min(hw / vw, hh / vh);')
    && body.includes('const filt = typeof bgVidFilterCSS === "function" ? bgVidFilterCSS({ filter: effFilter }) : "none";');
})());

ok("every drawClip/drawGlitchClip call site in drawBgVideoTimeline passes its own cue (S.bgVid._cue for steady-state, from/to for every transition branch, matching which element it draws)", (() => {
  const fn = extractFn("drawBgVideoTimeline");
  if (!fn) return false;
  const calls = [
    "drawClip(v.el, 1, 0, 0, 1, S.bgVid._cue);",
    "drawClip(from.el, 1 - p, 0, 0, 1, from);\n    drawClip(to.el, p, 0, 0, 1, to);",
    "drawClip(from.el, 1, 0, 0, 1, from);\n    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * p, H); ctx.clip();\n    drawClip(to.el, 1, 0, 0, 1, to);",
    "drawClip(from.el, 1, -W * p, 0, 1, from);\n    drawClip(to.el, 1, W * (1 - p), 0, 1, to);",
    "drawClip(from.el, 1, 0, 0, 1, from);\n    ctx.save(); ctx.beginPath();\n    ctx.arc(W / 2, H / 2, Math.max(1, Math.hypot(W, H) / 2 * p), 0, Math.PI * 2);\n    ctx.clip();\n    drawClip(to.el, 1, 0, 0, 1, to);",
    "drawClip(from.el, 1 - p, 0, 0, 1, from);\n    drawClip(to.el, p, 0, 0, 0.3 + 0.7 * p, to);",
    "drawClip(from.el, 1, 0, -H * p, 1, from);\n    drawClip(to.el, 1, 0, H * (1 - p), 1, to);",
    "drawClip(from.el, 1, -W * p, -H * p, 1, from);\n    drawClip(to.el, 1, W * (1 - p), H * (1 - p), 1, to);",
    "drawGlitchClip(from.el, 1 - p, envelope, from);\n    drawGlitchClip(to.el, p, envelope, to);",
  ];
  return calls.every(c => fn.includes(c));
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the 5 new assertions under "Video Timeline — per-clip Filter/Fit overrides" print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement — cue defaults in `addBgVidClipAt`**

At `elastic-morph.html:11078`, replace:

```js
  const cue = { t, dur, fadeIn: 0, fadeOut: 0, name: file.name.replace(/\.[^.]+$/, ""), src: url, el, kind: isImage ? "image" : "video", transType: S.bgVidTransDefault.type, transDur: S.bgVidTransDefault.dur };
```

with:

```js
  const cue = { t, dur, fadeIn: 0, fadeOut: 0, filter: null, fit: null, name: file.name.replace(/\.[^.]+$/, ""), src: url, el, kind: isImage ? "image" : "video", transType: S.bgVidTransDefault.type, transDur: S.bgVidTransDefault.dur };
```

- [ ] **Step 4: Implement — mirror the active cue in `updateBgVideoTimeline`**

At `elastic-morph.html:5423-5432`, replace:

```js
  const pending = [];
  if (cue && cue.el) {
    const p = syncClipTime(cue.el, t - cue.t, cue.kind);
    if (p) pending.push(p);
    S.bgVid.el = cue.el; S.bgVid.src = cue.src; S.bgVid.on = true; S.bgVid._active = true;
  } else {
    // Only the transient render flag goes false here — S.bgVid.on is the persisted #bgVidOn
    // checkbox setting (serialized into presets/share links); writing false to it directly
    // during a mid-playback gap would silently bake "video off" into whatever gets saved next.
    S.bgVid._active = false;
  }
```

with:

```js
  const pending = [];
  if (cue && cue.el) {
    const p = syncClipTime(cue.el, t - cue.t, cue.kind);
    if (p) pending.push(p);
    S.bgVid.el = cue.el; S.bgVid.src = cue.src; S.bgVid.on = true; S.bgVid._active = true;
    S.bgVid._cue = cue;
  } else {
    // Only the transient render flag goes false here — S.bgVid.on is the persisted #bgVidOn
    // checkbox setting (serialized into presets/share links); writing false to it directly
    // during a mid-playback gap would silently bake "video off" into whatever gets saved next.
    S.bgVid._active = false;
    S.bgVid._cue = null;
  }
```

- [ ] **Step 5: Implement — `drawClip` gains the `cue` param and effective-value computation**

At `elastic-morph.html:5480-5487`, replace:

```js
  const drawClip = (el, alpha, xOff, yOff = 0, scale = 1) => {
    const dim = clipElReady(el); if (!dim) return; const vw = dim.w, vh = dim.h;
    const s = v.cover ? Math.max(W / vw, H / vh) : Math.min(W / vw, H / vh);
    const dw = vw * scale * s, dh = vh * scale * s, dx = (W - dw) / 2 + xOff, dy = (H - dh) / 2 + yOff;
    ctx.save();
    ctx.globalAlpha = v.opacity * alpha;
    ctx.globalCompositeOperation = v.blend;
    const filt = typeof bgVidFilterCSS === "function" ? bgVidFilterCSS(v) : "none";
```

with:

```js
  const drawClip = (el, alpha, xOff, yOff = 0, scale = 1, cue = null) => {
    const dim = clipElReady(el); if (!dim) return; const vw = dim.w, vh = dim.h;
    const effFit = cue && cue.fit != null ? cue.fit : (v.cover ? "cover" : "contain");
    const effFilter = cue && cue.filter != null ? cue.filter : v.filter;
    const s = effFit === "cover" ? Math.max(W / vw, H / vh) : Math.min(W / vw, H / vh);
    const dw = vw * scale * s, dh = vh * scale * s, dx = (W - dw) / 2 + xOff, dy = (H - dh) / 2 + yOff;
    ctx.save();
    ctx.globalAlpha = v.opacity * alpha;
    ctx.globalCompositeOperation = v.blend;
    const filt = typeof bgVidFilterCSS === "function" ? bgVidFilterCSS({ filter: effFilter }) : "none";
```

The rest of `drawClip`'s body (the `if (filt === "none") {...} else {...}` block through `ctx.restore(); };`) is unchanged — it already just uses the local `filt` variable, which is now the effective one.

- [ ] **Step 6: Implement — `drawGlitchClip` gains the `cue` param and effective-value computation**

At `elastic-morph.html:5506-5515`, replace:

```js
  const drawGlitchClip = (el, alpha, envelope) => {
    if (!el || envelope <= 0.02) { drawClip(el, alpha, 0); return; }
    const dim = clipElReady(el); if (!dim) return; const vw = dim.w, vh = dim.h;
    const hw = Math.max(1, Math.round(W / 2)), hh = Math.max(1, Math.round(H / 2));
    // Half-res working area: the RGB-split/slice passes below are ~16 full-canvas raster ops
    // per clip, and the glitch look is deliberately low-fi, so a small scratch canvas (like the
    // FX Rack's Pixelate effect) costs far less without any visible quality loss.
    const s = v.cover ? Math.max(hw / vw, hh / vh) : Math.min(hw / vw, hh / vh);
    const dw = vw * s, dh = vh * s, dx = (hw - dw) / 2, dy = (hh - dh) / 2;
    const filt = typeof bgVidFilterCSS === "function" ? bgVidFilterCSS(v) : "none";
```

with:

```js
  const drawGlitchClip = (el, alpha, envelope, cue = null) => {
    if (!el || envelope <= 0.02) { drawClip(el, alpha, 0, 0, 1, cue); return; }
    const dim = clipElReady(el); if (!dim) return; const vw = dim.w, vh = dim.h;
    const hw = Math.max(1, Math.round(W / 2)), hh = Math.max(1, Math.round(H / 2));
    // Half-res working area: the RGB-split/slice passes below are ~16 full-canvas raster ops
    // per clip, and the glitch look is deliberately low-fi, so a small scratch canvas (like the
    // FX Rack's Pixelate effect) costs far less without any visible quality loss.
    const effFit = cue && cue.fit != null ? cue.fit : (v.cover ? "cover" : "contain");
    const effFilter = cue && cue.filter != null ? cue.filter : v.filter;
    const s = effFit === "cover" ? Math.max(hw / vw, hh / vh) : Math.min(hw / vw, hh / vh);
    const dw = vw * s, dh = vh * s, dx = (hw - dw) / 2, dy = (hh - dh) / 2;
    const filt = typeof bgVidFilterCSS === "function" ? bgVidFilterCSS({ filter: effFilter }) : "none";
```

The rest of `drawGlitchClip`'s body (the `fxctx.clearRect(...)` line through the end of the function) is unchanged.

- [ ] **Step 7: Implement — pass `cue` at every call site**

At `elastic-morph.html:5564-5608`, replace:

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
  const { from, to, p, type } = S.bgVidTrans;
  if (type === "dissolve") {
    drawClip(from.el, 1 - p, 0);
    drawClip(to.el, p, 0);
  } else if (type === "wipe") {
    drawClip(from.el, 1, 0);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * p, H); ctx.clip();
    drawClip(to.el, 1, 0);
    ctx.restore();
  } else if (type === "slide") {
    drawClip(from.el, 1, -W * p);
    drawClip(to.el, 1, W * (1 - p));
  } else if (type === "iris") {
    drawClip(from.el, 1, 0);
    ctx.save(); ctx.beginPath();
    ctx.arc(W / 2, H / 2, Math.max(1, Math.hypot(W, H) / 2 * p), 0, Math.PI * 2);
    ctx.clip();
    drawClip(to.el, 1, 0);
    ctx.restore();
  } else if (type === "zoom") {
    drawClip(from.el, 1 - p, 0);
    drawClip(to.el, p, 0, 0, 0.3 + 0.7 * p);
  } else if (type === "slide-v") {
    drawClip(from.el, 1, 0, -H * p);
    drawClip(to.el, 1, 0, H * (1 - p));
  } else if (type === "slide-d") {
    drawClip(from.el, 1, -W * p, -H * p);
    drawClip(to.el, 1, W * (1 - p), H * (1 - p));
  } else if (type === "glitch") {
    const envelope = Math.sin(p * Math.PI);
    drawGlitchClip(from.el, 1 - p, envelope);
    drawGlitchClip(to.el, p, envelope);
  }
}
```

with:

```js
  if (!S.bgVidTrans) {
    drawClip(v.el, 1, 0, 0, 1, S.bgVid._cue);
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
  const { from, to, p, type } = S.bgVidTrans;
  if (type === "dissolve") {
    drawClip(from.el, 1 - p, 0, 0, 1, from);
    drawClip(to.el, p, 0, 0, 1, to);
  } else if (type === "wipe") {
    drawClip(from.el, 1, 0, 0, 1, from);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * p, H); ctx.clip();
    drawClip(to.el, 1, 0, 0, 1, to);
    ctx.restore();
  } else if (type === "slide") {
    drawClip(from.el, 1, -W * p, 0, 1, from);
    drawClip(to.el, 1, W * (1 - p), 0, 1, to);
  } else if (type === "iris") {
    drawClip(from.el, 1, 0, 0, 1, from);
    ctx.save(); ctx.beginPath();
    ctx.arc(W / 2, H / 2, Math.max(1, Math.hypot(W, H) / 2 * p), 0, Math.PI * 2);
    ctx.clip();
    drawClip(to.el, 1, 0, 0, 1, to);
    ctx.restore();
  } else if (type === "zoom") {
    drawClip(from.el, 1 - p, 0, 0, 1, from);
    drawClip(to.el, p, 0, 0, 0.3 + 0.7 * p, to);
  } else if (type === "slide-v") {
    drawClip(from.el, 1, 0, -H * p, 1, from);
    drawClip(to.el, 1, 0, H * (1 - p), 1, to);
  } else if (type === "slide-d") {
    drawClip(from.el, 1, -W * p, -H * p, 1, from);
    drawClip(to.el, 1, W * (1 - p), H * (1 - p), 1, to);
  } else if (type === "glitch") {
    const envelope = Math.sin(p * Math.PI);
    drawGlitchClip(from.el, 1 - p, envelope, from);
    drawGlitchClip(to.el, p, envelope, to);
  }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 5 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 9: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: per-clip Filter/Fit overrides for the Video Timeline (render path)

cue.filter/cue.fit (default null = inherit) on every clip. drawClip
and drawGlitchClip take an optional cue and resolve the effective
filter/fit from it, falling back to the existing global S.bgVid
controls. Every call site passes its own cue explicitly, including
both sides of every transition (from and to are two different clips
visible in the same frame and must resolve independently).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: UI panel

**Files:**
- Modify: `elastic-morph.html:11010-11029` (`renderBgVidTLPanel`)
- Test: `test.js` (extends the section added in Task 1)

**Interfaces:**
- Consumes: `cue.filter` / `cue.fit` (from Task 1, both default `null`).
- Produces: DOM elements `#bgVidClipFilter`, `#bgVidClipFit`, kept in sync with `cue.filter`/`cue.fit` whenever a clip is selected (`renderBgVidTLPanel()` is already called on every selection change — no new call site needed).

- [ ] **Step 1: Write the failing tests**

In `test.js`, extend the section added in Task 1 (add these three `ok(...)` calls right after the ones from Task 1, still before the summary block):

```js
ok("renderBgVidTLPanel's per-clip panel gains a Filter select with all 8 options (Global + the 7 BG_VID_FILTERS presets)", (() => {
  const fn = extractFn("renderBgVidTLPanel");
  if (!fn) return false;
  const opts = ['value="">— Global —', 'value="none">Kein Filter', 'value="cinematic">Cinematic', 'value="bw">Schwarzweiß',
    'value="duotone">Duotone (DNA)', 'value="vintage">Vintage', 'value="dreamy">Dreamy', 'value="neon">Neon Glow'];
  return fn.includes('id="bgVidClipFilter"') && opts.every(o => fn.includes(o));
})());

ok("renderBgVidTLPanel's per-clip panel gains a Fit select with Global/Cover/Contain options", (() => {
  const fn = extractFn("renderBgVidTLPanel");
  return !!fn
    && fn.includes('<label>Fit <select id="bgVidClipFit"><option value="">— Global —</option><option value="cover">Cover (Bild füllen)</option><option value="contain">Contain (Bild einpassen)</option></select></label>');
})());

ok("renderBgVidTLPanel syncs the Filter/Fit selects to the cue's current override (empty string when null, i.e. \"— Global —\") and wires changes back with the e.target.value || null fallback", (() => {
  const fn = extractFn("renderBgVidTLPanel");
  return !!fn
    && fn.includes('$("bgVidClipFilter").value = cue.filter || "";')
    && fn.includes('$("bgVidClipFilter").addEventListener("change", e => cue.filter = e.target.value || null);')
    && fn.includes('$("bgVidClipFit").value = cue.fit || "";')
    && fn.includes('$("bgVidClipFit").addEventListener("change", e => cue.fit = e.target.value || null);');
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the 3 new assertions print `✗` (everything from Task 1 still `✓`).

- [ ] **Step 3: Implement — `renderBgVidTLPanel()`**

At `elastic-morph.html:11010-11029`, replace:

```js
function renderBgVidTLPanel() {
  const p = $("bgVidTLPanel"), cue = S.bgVidCues[S.bgVidTLSel];
  if (!cue) {
    p.innerHTML = `<span class="muted">Kein Clip ausgewählt — <b>+ Clip @ Playhead</b> zum Hinzufügen. ${S.bgVidCues.length} Clip(s) auf der Timeline.</span>`;
    return;
  }
  p.innerHTML =
    `<span class="set-pill">@ ${fmtTime(cue.t)} — ${cue.name}</span>` +
    `<label>Übergang <select id="bgVidClipTrans"><option value="cut">Cut</option><option value="dissolve">Dissolve</option><option value="wipe">Wipe</option><option value="slide">Slide Horizontal</option><option value="slide-v">Slide Vertikal</option><option value="slide-d">Slide Diagonal</option><option value="iris">Iris</option><option value="zoom">Zoom-Cross</option><option value="glitch">Glitch</option></select></label>` +
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
}
```

with:

```js
function renderBgVidTLPanel() {
  const p = $("bgVidTLPanel"), cue = S.bgVidCues[S.bgVidTLSel];
  if (!cue) {
    p.innerHTML = `<span class="muted">Kein Clip ausgewählt — <b>+ Clip @ Playhead</b> zum Hinzufügen. ${S.bgVidCues.length} Clip(s) auf der Timeline.</span>`;
    return;
  }
  p.innerHTML =
    `<span class="set-pill">@ ${fmtTime(cue.t)} — ${cue.name}</span>` +
    `<label>Übergang <select id="bgVidClipTrans"><option value="cut">Cut</option><option value="dissolve">Dissolve</option><option value="wipe">Wipe</option><option value="slide">Slide Horizontal</option><option value="slide-v">Slide Vertikal</option><option value="slide-d">Slide Diagonal</option><option value="iris">Iris</option><option value="zoom">Zoom-Cross</option><option value="glitch">Glitch</option></select></label>` +
    `<label>Dauer <input type="number" id="bgVidClipTransDur" min="0.2" max="8" step="0.1" value="${cue.transDur}" style="width:48px;background:#0a0a12;color:var(--text);border:1px solid var(--line);border-radius:4px;padding:2px 4px;font-size:11px"></label>` +
    `<label>Filter <select id="bgVidClipFilter"><option value="">— Global —</option><option value="none">Kein Filter</option><option value="cinematic">Cinematic</option><option value="bw">Schwarzweiß</option><option value="duotone">Duotone (DNA)</option><option value="vintage">Vintage</option><option value="dreamy">Dreamy</option><option value="neon">Neon Glow</option></select></label>` +
    `<label>Fit <select id="bgVidClipFit"><option value="">— Global —</option><option value="cover">Cover (Bild füllen)</option><option value="contain">Contain (Bild einpassen)</option></select></label>` +
    `<label>Fade In <input type="number" id="bgVidClipFadeIn" min="0" max="8" step="0.1" value="${cue.fadeIn || 0}" style="width:48px;background:#0a0a12;color:var(--text);border:1px solid var(--line);border-radius:4px;padding:2px 4px;font-size:11px"></label>` +
    `<label>Fade Out <input type="number" id="bgVidClipFadeOut" min="0" max="8" step="0.1" value="${cue.fadeOut || 0}" style="width:48px;background:#0a0a12;color:var(--text);border:1px solid var(--line);border-radius:4px;padding:2px 4px;font-size:11px"></label>` +
    `<button class="btn" id="bgVidClipDelBtn">Delete</button>`;
  $("bgVidClipTrans").value = cue.transType;
  $("bgVidClipTrans").addEventListener("change", e => cue.transType = e.target.value);
  $("bgVidClipTransDur").addEventListener("change", e => cue.transDur = +e.target.value);
  $("bgVidClipFilter").value = cue.filter || "";
  $("bgVidClipFilter").addEventListener("change", e => cue.filter = e.target.value || null);
  $("bgVidClipFit").value = cue.fit || "";
  $("bgVidClipFit").addEventListener("change", e => cue.fit = e.target.value || null);
  $("bgVidClipFadeIn").addEventListener("change", e => cue.fadeIn = +e.target.value);
  $("bgVidClipFadeOut").addEventListener("change", e => cue.fadeOut = +e.target.value);
  $("bgVidClipDelBtn").addEventListener("click", () => deleteBgVidClip(S.bgVidTLSel));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including all 8 new ones from Task 1 + Task 2. Final line: `<N> passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: Filter/Fit selects in the Video Timeline per-clip panel

Adds the two new rows to renderBgVidTLPanel(), synced to cue.filter/
cue.fit on selection and wired back with the e.target.value || null
fallback (empty-string option = inherit global, cleared to null).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after both tasks)

Not covered by `test.js` (static source assertions only, no real DOM/canvas
execution) — verify visually once both tasks are done:

1. Open the app, open the Video Timeline (🎬 Open Video Timeline), add 2-3
   clips (mix of images and videos).
2. Select a clip, set its Filter to something distinct from the global Filter
   dropdown (e.g. global = none, clip = Neon Glow). Play through that clip —
   confirm only that clip shows the Neon Glow look, others stay unaffected.
3. Set that same clip's Filter back to "— Global —". Change the *global*
   Filter dropdown to a different preset. Confirm the clip now follows the
   new global value live (no clip-specific value was left behind).
4. Set a clip's Filter explicitly to "Kein Filter" while the global Filter is
   set to something else (e.g. Vintage). Confirm that clip renders with no
   filter, not the global Vintage — this is the `filter: "none"` vs
   `filter: null` distinction.
5. Set one clip's Fit to Contain while the global Fit stays Cover (or vice
   versa). Confirm that one clip visibly letterboxes/crops differently from
   the others.
6. Set a transition (e.g. Dissolve) between two clips that have *different*
   Filter/Fit overrides. Scrub through the transition — confirm both clips
   keep their own look throughout the cross-fade (neither one borrows the
   other's filter or fit).
7. Save a project, reload the page, load that project back — confirm the
   per-clip Filter/Fit overrides you set are still there (not reset to
   "— Global —").
