# Image Layer Upload Downscaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap any image used by Image Layer A/B to 2048px on its longest edge, on both places an image can enter the app (fresh upload, and project-file restore), fixing a real performance bug where large real photos combined with "Displace / Wave" mode's 70-draws-per-frame loop and an active canvas filter can freeze Chrome and fail silently in Safari.

**Architecture:** A single shared helper, `capImageSize(img, maxDim)`, returns the original image unchanged if it's already small enough, or a downscaled `<canvas>` (a fully valid drawImage source everywhere `IM.img` is used) otherwise. Both `loadImage()` (upload) and `applyProject()`'s `loadSrc` (project restore) call it before storing the result in `IM.img`.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), Canvas 2D API, zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- Max dimension: exactly `2048` (longest edge) — confirmed with Frank.
- `capImageSize` must return the original `img` object unchanged (not a copy) when both `img.width <= maxDim` and `img.height <= maxDim` — no needless re-encode for already-small images.
- `IM.src` (the data URL embedded in saved project files) changes ONLY in `loadImage()`, and only when capping actually occurred: use `capped.toDataURL("image/png")` (PNG, not JPEG, to preserve transparency) instead of the original `reader.result`. `applyProject()`'s `loadSrc` does NOT touch `IM.src` at all — it only caps the in-memory `IM.img` (this task does not rewrite stored project data, per the spec's Non-Goals).
- No build-injection gotcha: `sampleImage`, `loadImage`, and `applyProject` are all confirmed native to `elastic-morph.html`, not sourced from any `src/inject-vNN.js` file. Every edit in this plan goes directly into `elastic-morph.html`, no `node build.js` rebuild step needed.

---

### Task 1: Add `capImageSize` and wire it into both image-load paths

**Files:**
- Modify: `elastic-morph.html:6335` (insert `IMAGE_LAYER_MAX_DIM` constant and `capImageSize` function immediately before `sampleImage`)
- Modify: `elastic-morph.html:8802` (`loadImage` — cap the uploaded image, conditionally re-encode `IM.src`)
- Modify: `elastic-morph.html:9061` (`applyProject`'s `loadSrc` — cap the restored image)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Produces: `const IMAGE_LAYER_MAX_DIM = 2048;` and `function capImageSize(img, maxDim)` → `HTMLImageElement | HTMLCanvasElement`. No other task or file depends on these beyond what's wired in this same task — this is a single-task plan.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Image Layer upload downscaling");

ok("IMAGE_LAYER_MAX_DIM is 2048", (() => {
  return script.includes("const IMAGE_LAYER_MAX_DIM = 2048;");
})());

ok("capImageSize returns the original image unchanged when already within bounds", (() => {
  const fn = extractFn("capImageSize");
  return !!fn && fn.includes("if (img.width <= maxDim && img.height <= maxDim) return img;");
})());

ok("capImageSize scales a too-large image down to fit maxDim on its longest edge via a canvas", (() => {
  const fn = extractFn("capImageSize");
  return !!fn
    && fn.includes("const scale = maxDim / Math.max(img.width, img.height);")
    && fn.includes('const c = document.createElement("canvas");')
    && fn.includes("c.width = Math.max(1, Math.round(img.width * scale));")
    && fn.includes("c.height = Math.max(1, Math.round(img.height * scale));")
    && fn.includes("c.getContext(\"2d\").drawImage(img, 0, 0, c.width, c.height);")
    && fn.includes("return c;");
})());

ok("loadImage caps the uploaded image via capImageSize before storing it in IM.img", (() => {
  const fn = extractFn("loadImage");
  return !!fn
    && fn.includes("const capped = capImageSize(img, IMAGE_LAYER_MAX_DIM);")
    && fn.includes("IM.img = capped;")
    && fn.includes("sampleImage(capped, IM);");
})());

ok("loadImage keeps IM.src as the original data URL when no capping happened, or re-encodes the capped canvas as PNG (preserving transparency) when it did", (() => {
  const fn = extractFn("loadImage");
  return !!fn && fn.includes('IM.src = capped === img ? reader.result : capped.toDataURL("image/png");');
})());

ok("applyProject's loadSrc caps the restored image via capImageSize before storing it in IM.img, without touching IM.src", (() => {
  const fn = extractFn("applyProject");
  return !!fn
    && fn.includes("const capped = capImageSize(img, IMAGE_LAYER_MAX_DIM); IM.img = capped; sampleImage(capped, IM);");
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all 6 new assertions under "Image Layer upload downscaling" print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement — `capImageSize` helper**

At `elastic-morph.html:6335` (immediately before `function sampleImage(img, IM) {`), insert:

```js
const IMAGE_LAYER_MAX_DIM = 2048;
function capImageSize(img, maxDim) {
  if (img.width <= maxDim && img.height <= maxDim) return img;
  const scale = maxDim / Math.max(img.width, img.height);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.width * scale));
  c.height = Math.max(1, Math.round(img.height * scale));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c;
}
```

- [ ] **Step 4: Implement — `loadImage`**

At `elastic-morph.html:8802`, find the full function:

```js
function loadImage(file, IM, onId) {
  IM = IM || S.image; onId = onId || "imgOn";
  if (!file || !file.type.startsWith("image")) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      IM.img = img;
      IM.src = reader.result;   // data URL — embeddable in a project file
      sampleImage(img, IM);
      IM.on = true;
      $(onId).checked = true;
    };
    img.onerror = () => alert("Could not load that image.");
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
```

Replace it with:

```js
function loadImage(file, IM, onId) {
  IM = IM || S.image; onId = onId || "imgOn";
  if (!file || !file.type.startsWith("image")) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const capped = capImageSize(img, IMAGE_LAYER_MAX_DIM);
      IM.img = capped;
      IM.src = capped === img ? reader.result : capped.toDataURL("image/png");   // data URL — embeddable in a project file
      sampleImage(capped, IM);
      IM.on = true;
      $(onId).checked = true;
    };
    img.onerror = () => alert("Could not load that image.");
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
```

- [ ] **Step 5: Implement — `applyProject`'s `loadSrc`**

At `elastic-morph.html:9061`, find:

```js
  const loadSrc = (IM, ob, p) => {
    if (ob && ob.src) {
      IM.src = ob.src;
      const img = new Image();
      img.onload = () => { IM.img = img; sampleImage(img, IM); IM.on = !!ob.on; $(p + "On").checked = IM.on; };
      img.src = ob.src;
    } else {
      IM.on = false; IM.img = null; IM.cells = []; IM.src = null; $(p + "On").checked = false;
    }
  };
```

Replace it with:

```js
  const loadSrc = (IM, ob, p) => {
    if (ob && ob.src) {
      IM.src = ob.src;
      const img = new Image();
      img.onload = () => { const capped = capImageSize(img, IMAGE_LAYER_MAX_DIM); IM.img = capped; sampleImage(capped, IM); IM.on = !!ob.on; $(p + "On").checked = IM.on; };
      img.src = ob.src;
    } else {
      IM.on = false; IM.img = null; IM.cells = []; IM.src = null; $(p + "On").checked = false;
    }
  };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 6 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "fix: cap Image Layer A/B uploads to 2048px, fixing a Chrome freeze / Safari no-response bug

Root cause from a live debugging session: loadImage() (fresh upload)
and applyProject()'s loadSrc (project-file restore) both stored
uploaded images at their original, unbounded resolution. A real phone
photo (commonly 4000px+) combined with Displace/Wave mode's 70-draws-
per-frame loop and an active canvas filter (reapplied on each of those
70 large drawImage calls, every frame) made large photos catastrophically
expensive to render -- explaining the reported Chrome freeze, and
likely a Safari-specific canvas/filter limit hit silently (no visible
effect rather than a hang).

New capImageSize(img, maxDim) helper downscales to 2048px on the
longest edge via an offscreen canvas -- a canvas is a fully valid
drawImage source everywhere IM.img is already used, so no other
rendering code needed to change. Small images pass through unchanged.
Project files' stored image data (IM.src) is re-derived as PNG (not
JPEG) only when capping actually happened, preserving transparency for
images like logos.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

Not fully covered by `test.js` (no real large-image decode in the static
harness):

1. Upload a large real photo (4000px+ on the long edge) as Image Layer A,
   switch to "Displace / Wave" mode with a filter active (e.g. "Dreamy" or
   "Schwarzweiß") — confirm smooth playback, no freeze, and the filter is
   visibly applied (for a strong filter like B/W).
2. Confirm a small image (e.g. a 500×500 logo with transparency) uploads
   and renders identically to before this change (no visible re-encoding
   artifacts, transparency intact).
3. Save a project with a large uploaded image, reload the page, load that
   project back — confirm it renders smoothly (this exercises the
   `applyProject`/`loadSrc` path specifically).
4. Confirm a PNG with transparency, once large enough to trigger capping,
   keeps its transparency after being capped and re-saved into a project
   (exercises the `capped.toDataURL("image/png")` path).
