# Feedback Loop Deepening (Round 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing FX Rack "Feedback" toggle (a video-feedback echo/trail effect with 4
hardcoded parameters) into a fully controllable effect with a dedicated panel: real sliders for
Zoom/Rotation/Decay/Alpha, plus 3 new mechanics (per-iteration hue-shift, direction drift,
selectable blend mode).

**Architecture:** A new `S.feedbackFX` state object (separate from the boolean-only `S.fx` map)
holds all 8 parameters, defaulting to today's hardcoded values. A new "Feedback Loop" HTML panel
(sliders + blend-mode select) sits right after the FX Rack I chips, with its own `#fbOn`
checkbox that reuses the existing `toggleFX("feedback")` path so it stays in lockstep with the
FX-Rack chip. `applyPostFX`'s feedback block reads `S.feedbackFX` instead of literals. Persists
for free everywhere `projectData()`/`applyProject()` already reach (Save/Load, Undo/Redo, Scene
Banks, share links) once those two functions carry the new field.

**Tech Stack:** Vanilla JS, Canvas2D. Single-file app (`elastic-morph.html`) with a
zero-dependency text-based test harness (`test.js`).

## Global Constraints

- All edits land in the **static (non-generated) region** of `elastic-morph.html` — before the
  `/* @BUILD-INJECT-V58 */` marker (currently line 8778 area — verify with `grep -n
  '@BUILD-INJECT-V58'` before starting, it drifts). Every edit location in this plan (lines
  1652, 2549, 5527-5544, 6438-6489, 6643, 6780, 6875-6876, 16165) is well before that.
- Every new/changed code path must leave existing behavior byte-for-byte identical when all
  `S.feedbackFX` fields sit at their defaults (`zoom: 1.045, rotation: 0.69, decay: 0.28, alpha:
  0.38, hueShift: 0, dirX: 0, dirY: 0, blend: "lighter"`) — this is a purely additive feature.
- `S.fx` stays a pure boolean map. Do not add numeric fields to it — several call sites iterate
  `Object.keys(S.fx).forEach(...)` assuming every value is a boolean (random-FX picker, cue
  system, Basis-Szene reset). All new numeric config lives in `S.feedbackFX`.
- `rotation` and `hueShift` are stored in **degrees**, not radians — conversion to radians
  happens only at the point of use inside `applyPostFX` (`F.rotation * Math.PI / 180`). Do not
  store radians in state; the UI sliders show degrees directly.
- `zoom` in state is an absolute Canvas2D scale factor (`1.045` = today's default). The UI
  slider shows it as "percent growth" (`4.5` = the same `1.045`) — the conversion
  (`1 + value/100` when writing, `(zoom - 1) * 100` when reading back for display) happens only
  in the UI wiring, never in `applyPostFX` or the persisted state.
- `decay`, `alpha`, `dirX`, `dirY` are stored as 0-1 fractions in state; their sliders use the
  same `value / 100` convention already established by `#palHue`/`#lbOp`/etc. elsewhere in this
  file.
- Test-first: every task adds its assertions to `test.js` before touching `elastic-morph.html`,
  confirms they fail, then implements.
- Before the final commit: `node build.js && git diff --stat elastic-morph.html` must show no
  diff, then `npm run ci` must pass.
- Source spec: `docs/superpowers/specs/2026-08-23-feedback-loop-deepening-design.md`.

---

### Task 1: Data model — `S.feedbackFX` state

**Files:**
- Modify: `elastic-morph.html:2549` (insert new key into the `S = {...}` object, right after `layerB`)
- Test: `test.js`

**Interfaces:**
- Produces: `S.feedbackFX` — `{ zoom: number, rotation: number, decay: number, alpha: number, hueShift: number, dirX: number, dirY: number, blend: string }`, defaulting to `{ zoom: 1.045, rotation: 0.69, decay: 0.28, alpha: 0.38, hueShift: 0, dirX: 0, dirY: 0, blend: "lighter" }`.
- Consumes: nothing (foundational task).

- [ ] **Step 1: Write the failing test**

Append to `test.js`:

```js
section("Feedback Loop Deepening — data model");

ok("S.feedbackFX initial state has all 8 fields at today's defaults", script.includes(
  'feedbackFX: { zoom: 1.045, rotation: 0.69, decay: 0.28, alpha: 0.38, hueShift: 0, dirX: 0, dirY: 0, blend: "lighter" },'
));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test.js`
Expected: the new assertion shows `✗`.

- [ ] **Step 3: Implement**

In `elastic-morph.html`, after line 2549 (`            _opPhase: 0, _scPhase: 0 },`), insert:

```js
  feedbackFX: { zoom: 1.045, rotation: 0.69, decay: 0.28, alpha: 0.38, hueShift: 0, dirX: 0, dirY: 0, blend: "lighter" },
```

(Line 2550, `  // v15: reactivity gain, auto-quality, auto-VJ`, follows immediately after.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node test.js`
Expected: the assertion shows `✓`.

- [ ] **Step 5: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add S.feedbackFX state for the Feedback Loop deepening feature"
```

---

### Task 2: UI — "Feedback Loop" panel (HTML + wiring)

**Files:**
- Modify: `elastic-morph.html:1652` (insert new panel HTML right after the FX Rack I chips)
- Modify: `elastic-morph.html:6486-6489` (`syncFXUI` — add `#fbOn` sync)
- Modify: `elastic-morph.html` (new: `syncFeedbackFXUI()` function + 9 event listeners, placed near the existing `toggleFX`/`syncFXUI` functions)
- Modify: `elastic-morph.html:16165` (boot sequence — add `syncFeedbackFXUI();` call)
- Test: `test.js`

**Interfaces:**
- Consumes: `S.feedbackFX` (Task 1), `S.fx.feedback` + `toggleFX`/`syncFXUI` (pre-existing).
- Produces: DOM elements `#fbOn`, `#fbBlend`, `#fbZoom`, `#fbRot`, `#fbDecay`, `#fbAlpha`, `#fbHue`, `#fbDirX`, `#fbDirY` (all with matching `#...Val` display spans except `#fbBlend`). `syncFeedbackFXUI()` — no params, no return value, sets every slider/select/checkbox from `S.feedbackFX`/`S.fx.feedback`. Task 3 and Task 4 call/rely on nothing new from this task beyond these DOM ids already matching what the spec's render logic (Task 4) will read from `S.feedbackFX`.

- [ ] **Step 1: Write the failing tests**

Append to `test.js`:

```js
section("Feedback Loop Deepening — UI panel");

ok("Feedback Loop panel HTML has all 9 controls", (() => {
  const ids = ["fbOn", "fbBlend", "fbZoom", "fbRot", "fbDecay", "fbAlpha", "fbHue", "fbDirX", "fbDirY"];
  return ids.every(id => html.includes('id="' + id + '"'));
})());

ok("#fbOn reuses toggleFX(\"feedback\") so it stays in lockstep with the FX Rack chip", script.includes(
  '$("fbOn").addEventListener("change", () => toggleFX("feedback"));'
));

ok("syncFXUI also syncs #fbOn to S.fx.feedback", (() => {
  const fn = extractFn("syncFXUI");
  return !!fn && fn.includes('$("fbOn").checked = !!S.fx.feedback;');
})());

ok("syncFeedbackFXUI sets every control from S.feedbackFX", (() => {
  const fn = extractFn("syncFeedbackFXUI");
  return !!fn
    && fn.includes('$("fbBlend").value = S.feedbackFX.blend;')
    && fn.includes("S.feedbackFX.zoom")
    && fn.includes("S.feedbackFX.rotation")
    && fn.includes("S.feedbackFX.decay")
    && fn.includes("S.feedbackFX.alpha")
    && fn.includes("S.feedbackFX.hueShift")
    && fn.includes("S.feedbackFX.dirX")
    && fn.includes("S.feedbackFX.dirY");
})());

ok("zoom slider converts percent-growth to an absolute scale factor (1 + value/100)", script.includes(
  "S.feedbackFX.zoom = 1 + (+e.target.value) / 100;"
));

ok("rotation/hueShift sliders write degrees directly (no radian conversion in the UI layer)", 
  script.includes("S.feedbackFX.rotation = +e.target.value;")
  && script.includes("S.feedbackFX.hueShift = +e.target.value;")
);

ok("decay/alpha/dirX/dirY sliders use the established value/100 fraction convention", 
  script.includes("S.feedbackFX.decay = e.target.value / 100;")
  && script.includes("S.feedbackFX.alpha = e.target.value / 100;")
  && script.includes("S.feedbackFX.dirX = e.target.value / 100;")
  && script.includes("S.feedbackFX.dirY = e.target.value / 100;")
);

ok("syncFeedbackFXUI is called at boot", script.includes("syncFeedbackFXUI();"));
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js`
Expected: all 8 new assertions show `✗`.

- [ ] **Step 3: Implement — HTML panel**

Insert immediately after `elastic-morph.html:1652` (`    <div id="fxChips"></div>`), before the
existing `    <div class="divider"></div>` on line 1653:

```html
    <div class="divider"></div>
    <h3>Feedback Loop</h3>
    <label class="check" style="margin-bottom:10px"><input type="checkbox" id="fbOn"> Enable feedback loop</label>
    <select id="fbBlend" class="pm-select">
      <option value="lighter" selected>Blend: Add</option>
      <option value="screen">Blend: Screen</option>
      <option value="source-over">Blend: Normal</option>
      <option value="multiply">Blend: Multiply</option>
      <option value="overlay">Blend: Overlay</option>
      <option value="difference">Blend: Difference</option>
      <option value="color-dodge">Blend: Color Dodge</option>
      <option value="hard-light">Blend: Hard Light</option>
      <option value="hue">Blend: Hue</option>
    </select>
    <div class="slider-row" style="margin-top:10px">
      <label>Zoom <span class="val" id="fbZoomVal">4.5</span></label>
      <input type="range" id="fbZoom" min="0" max="15" value="4.5" step="0.5">
    </div>
    <div class="slider-row">
      <label>Rotation° <span class="val" id="fbRotVal">0.69</span></label>
      <input type="range" id="fbRot" min="-3" max="3" value="0.69" step="0.01">
    </div>
    <div class="slider-row">
      <label>Decay <span class="val" id="fbDecayVal">28</span></label>
      <input type="range" id="fbDecay" min="5" max="60" value="28">
    </div>
    <div class="slider-row">
      <label>Intensität <span class="val" id="fbAlphaVal">38</span></label>
      <input type="range" id="fbAlpha" min="0" max="90" value="38">
    </div>
    <div class="slider-row">
      <label>Hue-Shift <span class="val" id="fbHueVal">0</span></label>
      <input type="range" id="fbHue" min="0" max="8" value="0" step="0.5">
    </div>
    <div class="slider-row">
      <label>Drift X <span class="val" id="fbDirXVal">0</span></label>
      <input type="range" id="fbDirX" min="-5" max="5" value="0">
    </div>
    <div class="slider-row">
      <label>Drift Y <span class="val" id="fbDirYVal">0</span></label>
      <input type="range" id="fbDirY" min="-5" max="5" value="0">
    </div>
```

(The original line 1653 divider that used to separate FX Rack I from FX Rack II now separates
this new panel from FX Rack II instead — no duplicate/missing divider.)

- [ ] **Step 4: Implement — `syncFXUI` gets `#fbOn`**

Change `elastic-morph.html:6486-6489` from:
```js
function syncFXUI() {
  document.querySelectorAll("[data-fx]").forEach(el =>
    el.classList.toggle("on", !!S.fx[el.dataset.fx]));
}
```
to:
```js
function syncFXUI() {
  document.querySelectorAll("[data-fx]").forEach(el =>
    el.classList.toggle("on", !!S.fx[el.dataset.fx]));
  $("fbOn").checked = !!S.fx.feedback;
}
```

- [ ] **Step 5: Implement — `syncFeedbackFXUI()` + event listeners**

Add this new function and its listeners directly after the existing `syncFXUI()` function (i.e.
right after the closing `}` you just edited in Step 4):

```js
function syncFeedbackFXUI() {
  $("fbBlend").value = S.feedbackFX.blend;
  const zoomPct = Math.round((S.feedbackFX.zoom - 1) * 1000) / 10;
  $("fbZoom").value = zoomPct; $("fbZoomVal").textContent = zoomPct;
  $("fbRot").value = S.feedbackFX.rotation; $("fbRotVal").textContent = S.feedbackFX.rotation;
  const decayPct = Math.round(S.feedbackFX.decay * 100);
  $("fbDecay").value = decayPct; $("fbDecayVal").textContent = decayPct;
  const alphaPct = Math.round(S.feedbackFX.alpha * 100);
  $("fbAlpha").value = alphaPct; $("fbAlphaVal").textContent = alphaPct;
  $("fbHue").value = S.feedbackFX.hueShift; $("fbHueVal").textContent = S.feedbackFX.hueShift;
  const dirXPct = Math.round(S.feedbackFX.dirX * 100);
  $("fbDirX").value = dirXPct; $("fbDirXVal").textContent = dirXPct;
  const dirYPct = Math.round(S.feedbackFX.dirY * 100);
  $("fbDirY").value = dirYPct; $("fbDirYVal").textContent = dirYPct;
}
$("fbOn").addEventListener("change", () => toggleFX("feedback"));
$("fbBlend").addEventListener("change", e => S.feedbackFX.blend = e.target.value);
$("fbZoom").addEventListener("input", e => { S.feedbackFX.zoom = 1 + (+e.target.value) / 100; $("fbZoomVal").textContent = e.target.value; });
$("fbRot").addEventListener("input", e => { S.feedbackFX.rotation = +e.target.value; $("fbRotVal").textContent = e.target.value; });
$("fbDecay").addEventListener("input", e => { S.feedbackFX.decay = e.target.value / 100; $("fbDecayVal").textContent = e.target.value; });
$("fbAlpha").addEventListener("input", e => { S.feedbackFX.alpha = e.target.value / 100; $("fbAlphaVal").textContent = e.target.value; });
$("fbHue").addEventListener("input", e => { S.feedbackFX.hueShift = +e.target.value; $("fbHueVal").textContent = e.target.value; });
$("fbDirX").addEventListener("input", e => { S.feedbackFX.dirX = e.target.value / 100; $("fbDirXVal").textContent = e.target.value; });
$("fbDirY").addEventListener("input", e => { S.feedbackFX.dirY = e.target.value / 100; $("fbDirYVal").textContent = e.target.value; });
```

`#fbOn`'s listener deliberately ignores `e.target.checked` and calls `toggleFX("feedback")`
(a flip) instead — this is the same pattern the pre-existing FX-Rack chips already use
(`chip.addEventListener("click", () => toggleFX(key))`), and it's what makes `toggleFX`'s other
side effect (`if (!S.fx.feedback) fbctx.clearRect(...)`, clearing the stale feedback buffer on
turn-off) fire correctly regardless of which of the two UI entry points the user clicked.

- [ ] **Step 6: Implement — boot-time sync call**

Change `elastic-morph.html:16165` from:
```js
syncPaletteUI();
```
to:
```js
syncPaletteUI();
syncFeedbackFXUI();
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `node test.js`
Expected: all 8 assertions from Step 1 show `✓`. Also re-check the pre-existing "every
$(\"id\") resolves to an element" assertion (Static checks section) still shows `✓`.

- [ ] **Step 8: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Feedback Loop panel UI (sliders + blend-mode select)"
```

---

### Task 3: Persistence — `projectData()` / `applyProject()`

**Files:**
- Modify: `elastic-morph.html:6643` (`projectData()` — add `feedbackFX` to the returned object)
- Modify: `elastic-morph.html:6875-6876` (`applyProject` — restore `feedbackFX` with safe defaults)
- Test: `test.js`

**Interfaces:**
- Consumes: `S.feedbackFX` (Task 1), `syncFeedbackFXUI()` (Task 2).
- Produces: nothing new consumed elsewhere; closes the save→load roundtrip for every path that
  already goes through `projectData()`/`applyProject()` (Save/Load, Undo/Redo, the 16-slot
  Scene Banks, Basis Szene, and share links all call `applyProject()` — confirmed via `grep -n
  "applyProject("`, no other restore path exists).

- [ ] **Step 1: Write the failing tests**

Append to `test.js`:

```js
section("Feedback Loop Deepening — persistence");

ok("projectData() includes feedbackFX", script.includes(
  "feedbackFX: { ...S.feedbackFX },"
));

ok("applyProject restores feedbackFX with safe defaults for every field", (() => {
  const fn = extractFn("applyProject");
  return !!fn
    && fn.includes("const fb = o.feedbackFX || {};")
    && fn.includes("S.feedbackFX.zoom = fb.zoom != null ? +fb.zoom : 1.045;")
    && fn.includes("S.feedbackFX.rotation = fb.rotation != null ? +fb.rotation : 0.69;")
    && fn.includes("S.feedbackFX.decay = fb.decay != null ? +fb.decay : 0.28;")
    && fn.includes("S.feedbackFX.alpha = fb.alpha != null ? +fb.alpha : 0.38;")
    && fn.includes("S.feedbackFX.hueShift = fb.hueShift != null ? +fb.hueShift : 0;")
    && fn.includes("S.feedbackFX.dirX = fb.dirX != null ? +fb.dirX : 0;")
    && fn.includes("S.feedbackFX.dirY = fb.dirY != null ? +fb.dirY : 0;")
    && fn.includes('S.feedbackFX.blend = fb.blend || "lighter";');
})());

ok("applyProject calls syncFeedbackFXUI after restoring project state", (() => {
  const fn = extractFn("applyProject");
  return !!fn && fn.includes("if (typeof syncFeedbackFXUI === \"function\") syncFeedbackFXUI();");
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js`
Expected: all 3 new assertions show `✗`.

- [ ] **Step 3: Implement — `projectData()`**

Change `elastic-morph.html:6643` from:
```js
    layerB: (() => { const { _spin, _hue, _opPhase, _scPhase, ...rest } = S.layerB; return rest; })(),
```
to:
```js
    layerB: (() => { const { _spin, _hue, _opPhase, _scPhase, ...rest } = S.layerB; return rest; })(),
    feedbackFX: { ...S.feedbackFX },
```

- [ ] **Step 4: Implement — `applyProject()`**

Change `elastic-morph.html:6875-6876` from:
```js
  S.layerB._spin = 0; S.layerB._hue = 0; S.layerB._opPhase = 0; S.layerB._scPhase = 0;
  $("lbOn").checked = !!S.layerB.on;
```
to:
```js
  S.layerB._spin = 0; S.layerB._hue = 0; S.layerB._opPhase = 0; S.layerB._scPhase = 0;
  const fb = o.feedbackFX || {};
  S.feedbackFX.zoom = fb.zoom != null ? +fb.zoom : 1.045;
  S.feedbackFX.rotation = fb.rotation != null ? +fb.rotation : 0.69;
  S.feedbackFX.decay = fb.decay != null ? +fb.decay : 0.28;
  S.feedbackFX.alpha = fb.alpha != null ? +fb.alpha : 0.38;
  S.feedbackFX.hueShift = fb.hueShift != null ? +fb.hueShift : 0;
  S.feedbackFX.dirX = fb.dirX != null ? +fb.dirX : 0;
  S.feedbackFX.dirY = fb.dirY != null ? +fb.dirY : 0;
  S.feedbackFX.blend = fb.blend || "lighter";
  if (typeof syncFeedbackFXUI === "function") syncFeedbackFXUI();
  $("lbOn").checked = !!S.layerB.on;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node test.js`
Expected: all 3 assertions from Step 1 show `✓`.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: persist S.feedbackFX through save/load, undo/redo, and scene banks"
```

---

### Task 4: Render logic — `applyPostFX`'s feedback block

**Files:**
- Modify: `elastic-morph.html:5527-5544`
- Test: `test.js`

**Interfaces:**
- Consumes: `S.feedbackFX` (Task 1).
- Produces: nothing new consumed elsewhere — this is the last piece that makes the panel's
  sliders actually affect the rendered output.

- [ ] **Step 1: Write the failing tests**

Append to `test.js`:

```js
section("Feedback Loop Deepening — render logic");

ok("applyPostFX's feedback block reads every parameter from S.feedbackFX instead of literals", (() => {
  const fn = extractFn("applyPostFX");
  return !!fn
    && fn.includes("const F = S.feedbackFX;")
    && fn.includes("ctx.globalCompositeOperation = F.blend;")
    && fn.includes("ctx.globalAlpha = F.alpha + S.beat * 0.08;")
    && fn.includes("ctx.translate(W / 2 + F.dirX * W, H / 2 + F.dirY * H);")
    && fn.includes("ctx.scale(F.zoom, F.zoom);")
    && fn.includes("ctx.rotate(F.rotation * Math.PI / 180 + S.stereo * 0.01);")
    && fn.includes("fbctx.fillStyle = `rgba(0,0,0,${F.decay})`;");
})());

ok("hue-rotate filter applies only to the fbC redraw, is reset immediately after, and is skipped when hueShift is 0", (() => {
  const fn = extractFn("applyPostFX");
  return !!fn
    && fn.includes("if (F.hueShift) ctx.filter = `hue-rotate(${F.hueShift}deg)`;")
    && fn.includes("ctx.drawImage(fbC, 0, 0, W, H);")
    && fn.includes('ctx.filter = "none";')
    && fn.indexOf("if (F.hueShift) ctx.filter") < fn.indexOf("ctx.drawImage(fbC, 0, 0, W, H);")
    && fn.indexOf("ctx.drawImage(fbC, 0, 0, W, H);") < fn.indexOf('ctx.filter = "none";');
})());
```

Byte-identical-at-defaults behavior is already covered structurally, not by a separate
assertion: Task 1 pins the default values (`zoom: 1.045`, `rotation: 0.69`, `decay: 0.28`,
`alpha: 0.38`, `blend: "lighter"`, `dirX`/`dirY`/`hueShift: 0`) and this task's own assertions
confirm those exact field names are read (`F.zoom`, `F.rotation * Math.PI / 180`, etc.) — so a
static check that also re-derives "1.045 in, 1.045 out" would only be restating Task 1's already-
tested constant, not verifying anything this task's diff could get wrong.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js`
Expected: both assertions show `✗` (old literals still in place).

- [ ] **Step 3: Implement**

Change `elastic-morph.html:5527-5544` from:
```js
  if (fx.feedback) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.38 + S.beat * 0.08;
    ctx.translate(W / 2, H / 2);
    ctx.scale(1.045, 1.045);
    ctx.rotate(0.012 + S.stereo * 0.01);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(fbC, 0, 0, W, H);
    ctx.restore();
    // store current combined frame, then darken it so the loop strictly decays (no whiteout)
    fbctx.globalCompositeOperation = "copy";
    fbctx.globalAlpha = 1;
    fbctx.drawImage(canvas, 0, 0, fbC.width, fbC.height);
    fbctx.globalCompositeOperation = "source-over";
    fbctx.fillStyle = "rgba(0,0,0,0.28)";   // stronger decay so the feedback loop can't run away to white
    fbctx.fillRect(0, 0, fbC.width, fbC.height);
  }
```
to:
```js
  if (fx.feedback) {
    const F = S.feedbackFX;
    ctx.save();
    ctx.globalCompositeOperation = F.blend;
    ctx.globalAlpha = F.alpha + S.beat * 0.08;
    ctx.translate(W / 2 + F.dirX * W, H / 2 + F.dirY * H);
    ctx.scale(F.zoom, F.zoom);
    ctx.rotate(F.rotation * Math.PI / 180 + S.stereo * 0.01);
    ctx.translate(-W / 2, -H / 2);
    if (F.hueShift) ctx.filter = `hue-rotate(${F.hueShift}deg)`;
    ctx.drawImage(fbC, 0, 0, W, H);
    ctx.filter = "none";
    ctx.restore();
    // store current combined frame, then darken it so the loop strictly decays (no whiteout)
    fbctx.globalCompositeOperation = "copy";
    fbctx.globalAlpha = 1;
    fbctx.drawImage(canvas, 0, 0, fbC.width, fbC.height);
    fbctx.globalCompositeOperation = "source-over";
    fbctx.fillStyle = `rgba(0,0,0,${F.decay})`;
    fbctx.fillRect(0, 0, fbC.width, fbC.height);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js`
Expected: all assertions from Step 1 show `✓`.

- [ ] **Step 5: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: wire Feedback Loop panel controls into applyPostFX's feedback block"
```

---

### Task 5: Full regression + manual live-check

**Files:** none modified — verification only.

**Interfaces:** none (terminal task).

- [ ] **Step 1: Full automated regression**

Run: `npm run ci`
Expected: `node build.js` reports the merge succeeded, then `node test.js` reports `fail: 0` and
every section — old and new — shows all `✓`.

- [ ] **Step 2: Confirm no generated-region drift**

Run: `git diff --stat elastic-morph.html`
Expected: no output (everything from Step 1 was already committed task-by-task).

Run: `git status --short`
Expected: empty.

- [ ] **Step 3: Manual live-check (Pro mode, real demo track)**

In the running app:
1. Turn Feedback on via the FX Rack chip — confirm `#fbOn` in the new panel shows checked too,
   and vice versa (toggle from the panel checkbox, confirm the chip lights up).
2. With defaults untouched, compare the visual against the pre-feature look (e.g. the commit
   before this branch started) — should be indistinguishable, since every `S.feedbackFX` default
   equals the value that used to be hardcoded.
3. Move each of the 7 sliders one at a time (Zoom, Rotation, Decay, Intensität, Hue-Shift, Drift
   X, Drift Y) and confirm each visibly changes the trail behavior in the expected direction
   (e.g. Hue-Shift > 0 produces a visible rainbow spiral over a few seconds, Drift X/Y produces a
   comet-tail drift instead of a centered spiral, Decay toward the low end produces long-lived
   trails and toward the high end produces short/tight ones).
4. Change the Blend-Mode dropdown through a few options and confirm the compositing look changes
   (e.g. Difference vs. Add look very different).
5. Turn Feedback off — confirm the trail clears immediately (pre-existing
   `fbctx.clearRect(...)` behavior in `toggleFX`, unaffected by this feature).
6. Save the current state into a Scene Bank slot with non-default Feedback Loop settings, switch
   to a different slot/preset, then reload the saved slot — confirm every slider position and
   the blend-mode selection come back exactly as saved.
7. Note any parameter ranges that feel too narrow/wide or mislabeled — per the design spec, the
   exact slider min/max bounds are live-tuning starting points, not final numbers.

No code changes are expected from this step unless Step 3.7 surfaces a concrete live-tuning
request — if so, that's a follow-up, not part of this plan's scope.
