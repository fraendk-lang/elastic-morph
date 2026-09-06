# Image Layer Upload Downscaling — Design

## Problem

Reported: image filters appear to do nothing (or barely anything) with the
"Dreamy" filter, and separately, Chrome freezes / Safari does nothing when
using Image Layer A/B with a real photo. Live investigation
(`superpowers:systematic-debugging`) found:

1. The "Dreamy" non-reaction was explained and accepted as-is: its CSS
   filter (`blur(0.6px) brightness(1.06) saturate(1.12)`) is genuinely just
   very subtle — confirmed working correctly via direct UI interaction with
   a dramatic filter ("Schwarzweiß") on the same code path. Not a bug,
   no action taken (Frank's decision).
2. The freeze/no-response reports pointed to a real, separate bug:
   **uploaded images are never downscaled** — `loadImage()` stores the
   file at its original, full resolution in `IM.img`. A "standard" phone
   photo today is commonly 4000×3000px or larger. The "Displace / Wave"
   mode redraws the source image 70 times per frame
   (`elastic-morph.html:6411-6422`), and whenever an Image Layer filter is
   active, the wrapper that applies it (`elastic-morph.html:13212-13229`)
   sets `ctx.filter` once and lets the wrapped draw function run — meaning
   the browser must re-apply the filter effect across all 70 large
   `drawImage` calls, every frame, at full source resolution. This is a
   large, avoidable per-frame cost that scales with the uploaded photo's
   real pixel dimensions, not the canvas's actual display size.
3. A second, independent code path has the identical gap: loading a saved
   project file (`applyProject`'s `loadSrc`, `elastic-morph.html:9061-9070`)
   also loads the embedded image at full resolution with no cap — fixing
   only the upload path would let the bug resurface the next time a
   project is loaded.

## Goals

- Cap any image used by Image Layer A/B (`S.image.img` / `S.image2.img`) to
  a sane maximum dimension on both load paths — fresh upload
  (`loadImage()`) and project-file restore (`applyProject()`'s `loadSrc`)
  — so no downstream rendering code (Displace/Wave's 70-band loop, or any
  other mode) ever redraws a source image larger than necessary.
- Max dimension: **2048px** on the longest edge (confirmed with Frank) —
  well above any realistic on-screen or exported canvas size (even 4K
  export is 3840px wide), so no visible quality loss, while cutting a
  typical 4000px+ phone photo's pixel area (and therefore redraw cost) by
  4x or more.
- Avoid re-encoding/quality loss for images that are already small enough
  — only touch images that actually exceed the cap.
- Preserve transparency (PNG images with alpha, e.g. logos) — no lossy
  re-encode that would silently flatten transparent pixels.

## Non-Goals

- **Not re-optimizing already-saved project files.** `applyProject`'s
  `loadSrc` caps the in-memory `IM.img` used for rendering, but does not
  rewrite the project's stored `src` data URL — an old project saved before
  this fix keeps its embedded full-resolution image on disk/in the file
  until the user re-saves. Not requested, and shrinking stored project
  data is a separate concern from the rendering-performance bug reported.
- **Not changing the "Dreamy" filter's intensity** — explicitly out of
  scope per Frank's "lass es erstmal so" decision earlier in this
  investigation.
- **Not touching Background Video's per-clip filter path** — the reported
  freeze was specifically Image Layer A/B with an uploaded photo; video
  frames are already bounded by the video's own encoded resolution, not by
  an unbounded user-uploaded still image, and the video-filter code
  already has its own documented Chrome/Safari `ctx.filter` workaround
  (`elastic-morph.html:5699`).

## Design

### 1. Shared helper

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

Returns the original `img` unchanged when it's already within bounds (no
needless re-encode for typical web-sized images). Otherwise returns a
`<canvas>` element scaled to fit within `maxDim` on its longest edge. A
`<canvas>` is a fully valid `CanvasImageSource` everywhere `IM.img` is
currently consumed: `sampleImage()` (`elastic-morph.html:6335`) reads
`img.width`/`img.height` (canvases have both), and every `drawImageLayer`
mode calls `ctx.drawImage(IM.img, ...)` the same way regardless of whether
the source is an `Image` or a `<canvas>` — no other code changes needed.

### 2. `loadImage()` (fresh upload) — `elastic-morph.html:8802`

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
      IM.src = capped === img ? reader.result : capped.toDataURL("image/png");
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

`IM.src` (the data URL embedded in saved project files) stays as the
original, untouched `reader.result` when no downscaling happened —
identical behavior to today for any image already ≤2048px. Only when
`capImageSize` actually produced a smaller canvas does `IM.src` get
re-derived from *that* canvas, via PNG (lossless, alpha-preserving) rather
than JPEG — keeping a transparent logo transparent, at the cost of a larger
data URL than JPEG would produce (an acceptable trade for correctness; the
image is already capped to 2048px, so the size difference is modest).

### 3. `applyProject()`'s `loadSrc` (project restore) — `elastic-morph.html:9061-9070`

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

Same capping applied to the in-memory `IM.img`; `IM.src` (the project's own
stored data) is left untouched here per the Non-Goals section — this task
only guarantees rendering never redraws an oversized source, not that
every historical project file gets rewritten smaller.

### 4. Error handling

None needed beyond what already exists — `capImageSize` does pure
synchronous canvas arithmetic with no failure mode (given a loaded
`Image`, `.width`/`.height` are always valid numbers ≥1 by the time
`onload` fires).

### 5. Testing

Same static-source-assertion style as the rest of `test.js`:
- `capImageSize` exists with the documented early-return and scale-to-fit
  logic.
- `loadImage()` calls `capImageSize(img, IMAGE_LAYER_MAX_DIM)`, assigns the
  result to `IM.img`, and branches `IM.src` between the original
  `reader.result` and a PNG re-encode of the capped canvas based on
  whether capping actually changed anything.
- `applyProject`'s `loadSrc` calls `capImageSize(img, IMAGE_LAYER_MAX_DIM)`
  and assigns the result to `IM.img`.
- `IMAGE_LAYER_MAX_DIM` is `2048`.

### 6. Manual live-check (after implementation)

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
