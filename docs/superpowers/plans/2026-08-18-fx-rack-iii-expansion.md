# FX Rack III Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill FX Rack III (Cinematic) from 4 to 10 effects and give it its own Alt+1–0 keyboard shortcut, matching Rack I (plain 1–0) and Rack II (Ctrl+1–0).

**Architecture:** `FX3_DEFS`/`applyPostFX3`/`buildFX3` live in `src/inject-v58.js` — the actual source of truth — which `node build.js` merges into the generated (post-marker) region of `elastic-morph.html`. `S.fx3` defaults, `toggleFX3`, and the keydown handler live in the static (pre-marker) region of `elastic-morph.html` directly. Task 1 adds the 6 effects (source + build + UI wiring); Task 2 adds the keyboard shortcut on top.

**Tech Stack:** Vanilla JS, Canvas 2D (`globalCompositeOperation`, gradients, `clip()`), the existing zero-dependency test harness (`test.js`, via `node test.js`), `node build.js` to regenerate `elastic-morph.html` from `src/inject-v*.js`.

## Global Constraints

- Every code change must keep `node test.js` at 100% pass.
- `node build.js` must be run after editing `src/inject-v58.js`, and its output committed alongside the source change (both `src/inject-v58.js` and the regenerated `elastic-morph.html` in the same commit).
- No `build.js` `APP_VERSION`/`MODULES` change needed — this edits the *content* of an already-listed module (`inject-v58.js`), it doesn't add a new module file. (Confirmed in the prior blend-mode task's final review: `sw.js` is network-first, so a pure content change to `elastic-morph.html` needs no cache-version bump.)
- The 6 new effects must not touch `S.master` (Grain/Vignette/Grade — already-existing, separate global color-grading) or duplicate Rack I/II mechanics (RGB Split, Motion Blur's directional smear, Strobe's plain white flash).
- Alt+digit must not fire when Ctrl or Meta is also held (mutually exclusive with the existing Rack I/II branches).

---

### Task 1: Add the 6 new effects (source, build, UI wiring)

**Files:**
- Modify: `src/inject-v58.js:444-449` (`FX3_DEFS`)
- Modify: `src/inject-v58.js:451-459` (`buildFX3` — dedupe its inline toggle into `toggleFX3`)
- Modify: `src/inject-v58.js:467-498` (`applyPostFX3` — add 6 new `if` blocks)
- Modify: `elastic-morph.html:2398` (`S.fx3` defaults)
- Modify: `elastic-morph.html:6342-6347` (add `toggleFX3` after `syncFX2UI`)
- Run: `node build.js` (regenerates `elastic-morph.html`'s generated region from `src/inject-v58.js`)
- Test: `test.js`

**Interfaces:**
- Consumes: `S.beat`, `S.transient`, `S.loudness`, `S.mids`, `S.highs`, `S.stereo`, `S.time` (all pre-existing, already-smoothed 0–1-ish audio-reactive values — confirmed via the existing `lensflare`/`lightleak`/`motionblur` blocks in the same function, which already consume them the same way). `snapshot(W, H)` (pre-existing, copies the current canvas into the offscreen `fxC`/`fxctx` buffer). `chC`/`chctx` (pre-existing offscreen per-channel scratch canvas, already used by Rack I's RGB Split at `elastic-morph.html:5452-5461` for channel-isolation via `multiply` + `destination-in`).
- Produces: `function toggleFX3(key)` — same signature/behavior as the existing `toggleFX2(key)` (`elastic-morph.html:6342`): flips `S.fx3[key]` and calls `syncFX3UI()`. Task 2 calls this from the keydown handler.

- [ ] **Step 1: Add the failing test assertions**

Open `test.js`, find (search for `FX3_DEFS has 4 effects`):

```js
const fx3Defs = (script.match(/const FX3_DEFS = \[([\s\S]*?)\];/) || [])[1] || "";
ok("FX3_DEFS has 4 effects", (fx3Defs.match(/\["/g) || []).length === 4);
```

Replace with:

```js
const fx3Defs = (script.match(/const FX3_DEFS = \[([\s\S]*?)\];/) || [])[1] || "";
ok("FX3_DEFS has 10 effects", (fx3Defs.match(/\["/g) || []).length === 10);
const fx3StateKeys = (() => { const m = script.match(/fx3:\s*\{([^}]+)\}/); return m ? [...m[1].matchAll(/(\w+):\s*false/g)].map(x => x[1]) : []; })();
const fx3DefKeys = [...fx3Defs.matchAll(/\["(\w+)"/g)].map(x => x[1]);
ok("fx3 state keys match FX3_DEFS", fx3StateKeys.length === 10 && fx3StateKeys.every(k => fx3DefKeys.includes(k)));
ok("function toggleFX3 defined", script.includes("function toggleFX3("));
["anamorphflare", "letterbox", "doubleexposure", "dustscratches", "chromafringe", "bleachpulse"].forEach(k =>
  ok("applyPostFX3 handles f3." + k, script.includes("f3." + k)));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: `"FX3_DEFS has 10 effects"`, `"fx3 state keys match FX3_DEFS"`, `"function toggleFX3 defined"`, and all 6 `"applyPostFX3 handles f3.X"` checks print `✗`.

- [ ] **Step 3: Extend `FX3_DEFS` in `src/inject-v58.js`**

Find (line 444):

```js
const FX3_DEFS = [
  ["lensflare", "Lens Flare", "beat-triggered light streak"],
  ["lightleak", "Light Leak", "warm edge bleed"],
  ["scanlines", "Scanlines", "CRT line texture"],
  ["motionblur", "Motion Blur", "directional smear on hits"]
];
```

Replace with:

```js
const FX3_DEFS = [
  ["lensflare", "Lens Flare", "beat-triggered light streak"],
  ["lightleak", "Light Leak", "warm edge bleed"],
  ["scanlines", "Scanlines", "CRT line texture"],
  ["motionblur", "Motion Blur", "directional smear on hits"],
  ["anamorphflare", "Anamorphic Flare", "horizontal streak through bright hits"],
  ["letterbox", "Letterbox Reveal", "cinemascope bars that breathe with the track"],
  ["doubleexposure", "Double Exposure", "offset ghost frame"],
  ["dustscratches", "Dust & Scratches", "film grain specks and drifting scratches"],
  ["chromafringe", "Chromatic Edge Fringe", "color fringing at the frame border"],
  ["bleachpulse", "Bleach Bypass Pulse", "beat-synced contrast punch"]
];
```

- [ ] **Step 4: Dedupe `buildFX3`'s toggle into `toggleFX3`**

In `src/inject-v58.js`, find (line 451):

```js
function buildFX3() {
  const chips = $("fx3Chips"); if (!chips) return;
  FX3_DEFS.forEach(([key, label, desc]) => {
    const chip = document.createElement("div");
    chip.className = "fxchip"; chip.textContent = label; chip.dataset.fx3 = key;
    chip.title = desc;
    chip.addEventListener("click", () => { S.fx3[key] = !S.fx3[key]; syncFX3UI(); });
    chips.appendChild(chip);
  });
}
```

Replace with:

```js
function buildFX3() {
  const chips = $("fx3Chips"); if (!chips) return;
  FX3_DEFS.forEach(([key, label, desc]) => {
    const chip = document.createElement("div");
    chip.className = "fxchip"; chip.textContent = label; chip.dataset.fx3 = key;
    chip.title = desc;
    chip.addEventListener("click", () => toggleFX3(key));
    chips.appendChild(chip);
  });
}
```

(`toggleFX3` is defined in `elastic-morph.html`'s static region in Step 6 below — it's in the same global script scope, so this reference resolves correctly at click-time regardless of source-file boundaries; this mirrors how Rack I/II already split `toggleFX`/`toggleFX2` from their `build*` functions.)

- [ ] **Step 5: Add the 6 new effect blocks to `applyPostFX3`**

In `src/inject-v58.js`, find the end of `applyPostFX3` (the `motionblur` block, right before the function's closing brace):

```js
  if (f3.motionblur && (S.beat > 0.6 || S.transient > 0.3)) {
    snapshot(W, H);
    ctx.globalAlpha = 0.35 + S.beat * 0.25;
    ctx.drawImage(fxC, 3 + S.stereo * 8, 0, W, H);
    ctx.globalAlpha = 1;
  }
}
```

Replace with:

```js
  if (f3.motionblur && (S.beat > 0.6 || S.transient > 0.3)) {
    snapshot(W, H);
    ctx.globalAlpha = 0.35 + S.beat * 0.25;
    ctx.drawImage(fxC, 3 + S.stereo * 8, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (f3.anamorphflare && S.beat > 0.5) {
    const cy = H * 0.5 + S.stereo * H * 0.06;
    const g = ctx.createRadialGradient(W * 0.5, cy, 0, W * 0.5, cy, W * 0.55);
    g.addColorStop(0, `rgba(160,200,255,${S.beat * 0.22})`);
    g.addColorStop(0.15, `rgba(160,200,255,${S.beat * 0.1})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.translate(W / 2, cy); ctx.scale(3.2, 1); ctx.translate(-W / 2, -cy);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (f3.letterbox) {
    const barH = H * (0.06 + Math.min(0.10, S.beat * 0.08 + S.loudness * 0.05));
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, barH);
    ctx.fillRect(0, H - barH, W, barH);
  }
  if (f3.doubleexposure) {
    snapshot(W, H);
    const a = 0.14 + S.loudness * 0.12;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = a;
    ctx.drawImage(fxC, -W * 0.015, -H * 0.015, W, H);
    ctx.restore();
  }
  if (f3.dustscratches) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const nSpecks = 14 + Math.round(S.transient * 20);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < nSpecks; i++) {
      const x = Math.random() * W, y = Math.random() * H, s = 0.6 + Math.random() * 1.4;
      ctx.fillRect(x, y, s, s);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const x = ((S.time * 11 + i * 271) % 1) * W;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    ctx.restore();
  }
  if (f3.chromafringe && S.transient > 0.2) {
    const margin = Math.min(W, H) * 0.05;
    const d = Math.max(2, W * 0.006 * (1 + S.transient));
    snapshot(W, H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(margin, margin, W - 2 * margin, H - 2 * margin);
    ctx.clip("evenodd");
    ctx.globalCompositeOperation = "screen";
    const chans = [["#ff0000", -d, 0], ["#0000ff", d, 0]];
    for (const [col, ox, oy] of chans) {
      chctx.globalCompositeOperation = "copy"; chctx.globalAlpha = 1;
      chctx.drawImage(fxC, 0, 0);
      chctx.globalCompositeOperation = "multiply";
      chctx.fillStyle = col; chctx.fillRect(0, 0, W, H);
      chctx.globalCompositeOperation = "destination-in";
      chctx.drawImage(fxC, 0, 0);
      ctx.drawImage(chC, ox, oy);
    }
    ctx.restore();
  }
  if (f3.bleachpulse) {
    const f = Math.max(S.beat, S.transient);
    if (f > 0.55) {
      ctx.save();
      ctx.globalCompositeOperation = "hard-light";
      ctx.fillStyle = `rgba(200,200,200,${Math.min(0.35, (f - 0.55) * 1.1)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}
```

- [ ] **Step 6: Add `S.fx3` defaults and `toggleFX3` in `elastic-morph.html`**

Find (line 2398):

```js
  fx3: { lensflare: false, lightleak: false, scanlines: false, motionblur: false },
```

Replace with:

```js
  fx3: { lensflare: false, lightleak: false, scanlines: false, motionblur: false, anamorphflare: false, letterbox: false, doubleexposure: false, dustscratches: false, chromafringe: false, bleachpulse: false },
```

Then find (line 6342, right after `toggleFX2`/`syncFX2UI`):

```js
function toggleFX2(key) {
  S.fx2[key] = !S.fx2[key];
  syncFX2UI();
}
function syncFX2UI() {
  document.querySelectorAll("[data-fx2]").forEach(el =>
    el.classList.toggle("on", !!S.fx2[el.dataset.fx2]));
}
```

Replace with:

```js
function toggleFX2(key) {
  S.fx2[key] = !S.fx2[key];
  syncFX2UI();
}
function syncFX2UI() {
  document.querySelectorAll("[data-fx2]").forEach(el =>
    el.classList.toggle("on", !!S.fx2[el.dataset.fx2]));
}
function toggleFX3(key) {
  S.fx3[key] = !S.fx3[key];
  syncFX3UI();
}
```

- [ ] **Step 7: Rebuild**

```bash
cd "/Users/frankkrumsdorf/Desktop/Elastic Morph Cursor"
node build.js
```

Expected output: `✓ Merged ... into elastic-morph.html (v112)` (the version number logged here is `build.js`'s internal `APP_VERSION` constant, unrelated to this task — do not change it).

- [ ] **Step 8: Run the tests to verify they pass**

Run: `node test.js`
Expected: `0 failed`, all new checks from Step 1 show `✓`.

- [ ] **Step 9: Manual visual check**

Run: `npm start`, open `elastic-morph.html`, start the demo track. In the FX Rack III panel (chips, no keyboard shortcut yet — that's Task 2), click each of the 6 new effect chips one at a time:
- `Anamorphic Flare` — horizontal glow streak on beat, distinct from the round `Lens Flare` glow already in the top-right.
- `Letterbox Reveal` — black bars top/bottom that grow slightly on loud/beat moments.
- `Double Exposure` — a faint, fixed-offset ghost of the frame; confirm it doesn't look identical to `Motion Blur` (that one's offset direction follows `S.stereo`, this one is a fixed up-left offset).
- `Dust & Scratches` — visible specks plus 1-2 drifting vertical lines.
- `Chromatic Edge Fringe` — color fringing only near the frame's edges, center stays clean; confirm this reads differently from `RGB Split` (Rack I), which shifts the whole frame.
- `Bleach Bypass Pulse` — a brief gray contrast punch on strong beats, distinct from `Strobe`'s pure white flash.

Confirm no effect throws a console error and none makes the canvas fully black/white for more than an instant.

- [ ] **Step 10: Commit**

```bash
git add src/inject-v58.js elastic-morph.html test.js
git commit -m "Add 6 cinematic effects to FX Rack III (4 -> 10)

Anamorphic Flare, Letterbox Reveal, Double Exposure, Dust & Scratches,
Chromatic Edge Fringe, and Bleach Bypass Pulse join the existing 4.
Source of truth is src/inject-v58.js; elastic-morph.html regenerated
via node build.js. Also extracted toggleFX3() out of buildFX3()'s
inline handler for consistency with toggleFX/toggleFX2, since Task 2
needs it callable from the keydown handler too."
```

---

### Task 2: Alt+1–0 keyboard shortcut

**Files:**
- Modify: `elastic-morph.html:7788-7797` (digit-key handler)
- Test: `test.js`

**Interfaces:**
- Consumes: `FX3_DEFS` (produced by Task 1, now 10 entries), `toggleFX3(key)` (produced by Task 1).

- [ ] **Step 1: Add the failing test assertion**

In `test.js`, extend the section added in Task 1 with:

```js
ok("Alt+digit toggles FX Rack III", script.includes('e.altKey') && script.includes('toggleFX3(def3[0])'));
```

- [ ] **Step 2: Run the tests to verify it fails**

Run: `node test.js`
Expected: the new check prints `✗`.

- [ ] **Step 3: Edit the keydown handler**

In `elastic-morph.html`, find (around line 7788):

```js
  // number keys 1–9 + 0 toggle the 10 FX (great for live performance)
  if (e.key >= "0" && e.key <= "9") {
    const idx = e.key === "0" ? 9 : +e.key - 1;
    if (e.ctrlKey) {                       // Ctrl+digit → FX Rack II (geometry)
      const def2 = FX2_DEFS[idx];
      if (def2) { e.preventDefault(); toggleFX2(def2[0]); }
    } else if (!e.metaKey && !e.altKey) {  // plain digit → FX Rack I
      const def = FX_DEFS[idx];
      if (def) toggleFX(def[0]);
    }
  }
```

Replace with:

```js
  // number keys 1–9 + 0 toggle the 10 FX (great for live performance)
  if (e.key >= "0" && e.key <= "9") {
    const idx = e.key === "0" ? 9 : +e.key - 1;
    if (e.ctrlKey) {                       // Ctrl+digit → FX Rack II (geometry)
      const def2 = FX2_DEFS[idx];
      if (def2) { e.preventDefault(); toggleFX2(def2[0]); }
    } else if (e.altKey) {                 // Alt+digit → FX Rack III (cinematic)
      const def3 = FX3_DEFS[idx];
      if (def3) { e.preventDefault(); toggleFX3(def3[0]); }
    } else if (!e.metaKey) {               // plain digit → FX Rack I
      const def = FX_DEFS[idx];
      if (def) toggleFX(def[0]);
    }
  }
```

- [ ] **Step 4: Run the tests to verify it passes**

Run: `node test.js`
Expected: `0 failed`.

- [ ] **Step 5: Manual visual check**

Run: `npm start`, open `elastic-morph.html`. With the demo track playing, press Alt+1 through Alt+9 and Alt+0 (order: 1=Lens Flare, 2=Light Leak, 3=Scanlines, 4=Motion Blur, 5=Anamorphic Flare, 6=Letterbox Reveal, 7=Double Exposure, 8=Dust & Scratches, 9=Chromatic Edge Fringe, 0=Bleach Bypass Pulse). Confirm each key toggles the matching chip's `on` state in the FX Rack III panel (visually highlighted) and the effect appears/disappears on canvas. Also press plain `1` and Ctrl+`1` again to confirm Racks I and II still work unaffected (regression check on the `else if` restructuring).

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "Add Alt+1-0 keyboard shortcut for FX Rack III"
```

---

## Final Verification

- [ ] `node build.js && node test.js` — expect `0 failed`.
- [ ] `git status` clean after both commits.
- [ ] `git diff HEAD~2 -- src/inject-v58.js elastic-morph.html` — confirm the `elastic-morph.html` diff for Task 1 is *entirely* the regenerated output of the `src/inject-v58.js` change (no hand-edits to the generated region) plus the Step 6 static-region additions.
