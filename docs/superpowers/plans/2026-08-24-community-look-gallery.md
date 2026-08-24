# Community Look-Sharing Gallery (Round 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a curated, no-backend "Gallery" tab to Elastic Morph — a grid of community looks
loaded from a static JSON file that Frank maintains by hand, click-to-load via the app's
existing project-restore path.

**Architecture:** A new `assets/gallery/gallery.json` asset (array of `{id, name, author, date,
thumbnail, project}`) is fetched once and cached in memory. A new nav tab/page follows the
app's existing mode-switching pattern (`data-mode` + `.page`/`#page-<mode>` + `setMode()`).
Clicking a card calls the pre-existing `applyProject()` — the same function share-links, file
uploads, and undo/redo already use — so no new state-restore logic is needed anywhere.

**Tech Stack:** Vanilla JS, `fetch()`. Single-file app (`elastic-morph.html`) with a
zero-dependency text-based test harness (`test.js`).

## Global Constraints

- All edits land in the **static (non-generated) region** of `elastic-morph.html` — before the
  `/* @BUILD-INJECT-V58 */` marker (verify its current line with `grep -n '@BUILD-INJECT-V58'
  elastic-morph.html` before starting — it drifts). Every edit location in this plan is well
  before that.
- No confirmation dialog before loading a gallery look — matches the existing "Load Project"
  and share-link behavior (neither confirms before overwriting current state); Undo (Cmd/Ctrl+Z)
  is the app's established safety net for this class of action.
- Gallery card text (`entry.name`/`entry.author`) must be inserted via `textContent`, not
  `innerHTML` with string interpolation — even though this data comes from a file Frank curates
  himself (not live public submissions), building DOM nodes safely costs nothing extra and
  avoids any accidental-HTML-in-a-pasted-name issue. This is a deliberate, small deviation from
  the pre-existing `.preset-card` builder's `innerHTML` pattern (`buildPresets()`,
  `elastic-morph.html:7195-7217`), not an oversight — do not "fix" it to match that precedent.
- `loadGallery()` must never throw or break page load if `gallery.json` is missing, malformed,
  or the fetch fails (offline, `file://` protocol, 404 before Frank has published anything) —
  same graceful-fallback shape as the pre-existing `loadDemoManifest()`
  (`elastic-morph.html:12539-12545`).
- No search/filter/sort UI, no upload form, no backend, no auto-generated thumbnails — this
  round is fetch-and-display only.
- Test-first: every task adds its assertions to `test.js` before touching `elastic-morph.html`,
  confirms they fail, then implements.
- Before the final commit: `node build.js && git diff --stat elastic-morph.html` must show no
  diff, then `npm run ci` must pass.
- Source spec: `docs/superpowers/specs/2026-08-24-community-look-gallery-design.md`.

---

### Task 1: Gallery data — `gallery.json` asset + `loadGallery()`

**Files:**
- Create: `assets/gallery/gallery.json`
- Modify: `elastic-morph.html:2485` (new `loadGallery()` function, inserted right after the `NAMED_PALETTES` constant)
- Test: `test.js`

**Interfaces:**
- Produces: `loadGallery()` — async function, no params, returns `Promise<Array<{id, name,
  author, date, thumbnail, project}>>`. Returns `[]` on any fetch/parse failure, never rejects.
  Caches its result in module-scope `galleryData` after the first successful load. Consumed by
  Task 2's `renderGallery()`.
- Consumes: nothing new (uses the standard `fetch` API only).

- [ ] **Step 1: Write the failing tests**

Append to `test.js`:

```js
section("Community Look-Sharing Gallery — data loading");

ok("assets/gallery/gallery.json exists and is a valid empty-array JSON file", (() => {
  const p = path.join(__dirname, "assets/gallery/gallery.json");
  if (!fs.existsSync(p)) return false;
  try { return Array.isArray(JSON.parse(fs.readFileSync(p, "utf8"))); } catch (e) { return false; }
})());

ok("loadGallery() fetches assets/gallery/gallery.json with cache:no-store, caches the result, and never throws on failure", (() => {
  const fn = extractFn("loadGallery");
  return !!fn
    && fn.includes('fetch("assets/gallery/gallery.json", { cache: "no-store" })')
    && fn.includes("galleryData")
    && fn.includes("try {")
    && fn.includes("catch (e)");
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js`
Expected: both new assertions show `✗` (the file doesn't exist yet, the function doesn't exist yet).

- [ ] **Step 3: Implement — the asset file**

Create `assets/gallery/gallery.json`:
```json
[]
```

- [ ] **Step 4: Implement — `loadGallery()`**

**Important:** do NOT place this next to `loadDemoManifest()`
(`elastic-morph.html:12539-12545`) — that function itself lives *inside* the generated region
(`/* @BUILD-INJECT-V58 */` at ~line 8969 through `/* ---- boot ---- */` at ~line 16205; verify
both markers' current line numbers with `grep -n '@BUILD-INJECT-V58\|/\* ---- boot ---- \*/'
elastic-morph.html` before placing anything). It is cited elsewhere in this plan only as a
*pattern reference* (the try/catch/`cache:"no-store"` shape), not as a placement anchor.

Insert this function immediately after the `NAMED_PALETTES` constant's closing `];`
(`elastic-morph.html:2485`), before the `/* ---------------- App state ---------------- */`
comment that precedes `const S = {`:

```js
let galleryData = null;
async function loadGallery() {
  if (galleryData) return galleryData;
  try {
    const res = await fetch("assets/gallery/gallery.json", { cache: "no-store" });
    if (res.ok) galleryData = await res.json();
  } catch (e) { /* offline / file:// / missing file — empty gallery, no crash */ }
  return galleryData || [];
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node test.js`
Expected: both assertions from Step 1 show `✓`.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html assets/gallery/gallery.json test.js
git commit -m "feat: add gallery.json asset + loadGallery() data loader"
```

---

### Task 2: Gallery UI — nav tab, page, card rendering, click-to-load

**Files:**
- Modify: `elastic-morph.html:1040` (nav — new `data-mode="gallery"` button)
- Modify: `elastic-morph.html:1519` (new `#page-gallery` page, inserted before `#page-settings`)
- Modify: `elastic-morph.html:7324-7336` (`setMode()` — new `gallery` case; exact line numbers
  drift as earlier edits land — match by the text shown in Step 6, not the number)
- Modify: `elastic-morph.html` (new CSS rule `.gallery-thumb`, new `renderGallery()` function)
- Test: `test.js`

**Interfaces:**
- Consumes: `loadGallery()` (Task 1). Pre-existing `applyProject(o)` (`elastic-morph.html:6657`)
  — called with a gallery entry's `.project` field, exactly as it's already called with a parsed
  share-link's payload.
- Produces: DOM elements `[data-mode="gallery"]` nav button, `#page-gallery`, `#galleryGrid`.
  Function `renderGallery()` — no params, no return value, populates `#galleryGrid` from
  `loadGallery()`. Nothing later in this plan depends on anything beyond these existing and
  working.

- [ ] **Step 1: Write the failing tests**

Append to `test.js`:

```js
section("Community Look-Sharing Gallery — UI");

ok("Gallery nav button and page exist", html.includes('data-mode="gallery"') && html.includes('id="page-gallery"') && html.includes('id="galleryGrid"'));

ok("setMode opens #page-gallery and calls renderGallery for the gallery mode", (() => {
  const fn = extractFn("setMode");
  return !!fn && fn.includes('if (mode === "gallery") { $("page-gallery").classList.add("open"); renderGallery(); }');
})());

ok("renderGallery builds cards via loadGallery() and loads a look via applyProject on click, using textContent not innerHTML for name/author", (() => {
  const fn = extractFn("renderGallery");
  return !!fn
    && fn.includes("loadGallery()")
    && fn.includes('$("galleryGrid")')
    && fn.includes("applyProject(entry.project)")
    && fn.includes("h4.textContent = entry.name;")
    && fn.includes('p.textContent = "by " + entry.author;');
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js`
Expected: all 3 new assertions show `✗`.

- [ ] **Step 3: Implement — nav button**

Change `elastic-morph.html:1040` from:
```html
    <button type="button" class="navitem" data-mode="settings">Settings</button>
```
to:
```html
    <button type="button" class="navitem" data-mode="settings">Settings</button>
    <button type="button" class="navitem" data-mode="gallery">Gallery</button>
```

- [ ] **Step 4: Implement — page markup**

Insert immediately before `elastic-morph.html:1519` (`    <div class="page" id="page-settings">`):
```html
    <!-- ---- GALLERY PAGE ---- -->
    <div class="page" id="page-gallery">
      <h2>Gallery</h2>
      <div class="sub">Community-Looks — von Frank kuratiert. Klick lädt den Look direkt.</div>
      <div id="galleryGrid" class="preset-grid"></div>
    </div>

```

Note: `class="preset-grid"` is a **new** class name, not the pre-existing `#presetGrid`/
`#customGrid` ID selectors — those two IDs already carry the grid-layout CSS
(`elastic-morph.html:382`: `display: grid; grid-template-columns: repeat(auto-fill,
minmax(220px, 1fr)); gap: 14px;`), but that rule is scoped to those two specific IDs, not a
reusable class. Step 5 below adds `.preset-grid` as a small reusable class with the identical
rule, so `#galleryGrid` gets the same grid layout without touching the existing selector.

- [ ] **Step 5: Implement — CSS**

Add these two new rules directly after the existing `#presetGrid, #customGrid { ... }` rule
(`elastic-morph.html:382`):
```css
  .preset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
  .gallery-thumb { display: block; width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 12px; }
```

- [ ] **Step 6: Implement — `setMode()` wiring**

Change `elastic-morph.html:7335` (line number approximate, drifts — find it by the exact text below) from:
```js
  if (mode === "settings") $("page-settings").classList.add("open");
}
```
to:
```js
  if (mode === "settings") $("page-settings").classList.add("open");
  if (mode === "gallery") { $("page-gallery").classList.add("open"); renderGallery(); }
}
```

- [ ] **Step 7: Implement — `renderGallery()`**

Add this new function directly after `loadGallery()` (added in Task 1 right after the
`NAMED_PALETTES` constant, `elastic-morph.html:2485` area — confirmed static-region, before
`/* @BUILD-INJECT-V58 */`):

```js
function renderGallery() {
  const grid = $("galleryGrid");
  grid.innerHTML = "";
  loadGallery().then(entries => {
    entries.forEach(entry => {
      const card = document.createElement("div");
      card.className = "preset-card";
      const head = document.createElement("div");
      head.className = "pc-head";
      const h4 = document.createElement("h4");
      h4.textContent = entry.name;
      head.appendChild(h4);
      card.appendChild(head);
      const img = document.createElement("img");
      img.className = "gallery-thumb";
      img.src = entry.thumbnail;
      img.alt = entry.name;
      card.appendChild(img);
      const p = document.createElement("p");
      p.textContent = "by " + entry.author;
      card.appendChild(p);
      card.addEventListener("click", () => applyProject(entry.project));
      grid.appendChild(card);
    });
  });
}
```

Reuses the existing `.preset-card`/`.pc-head` classes (`elastic-morph.html:383-403`) so gallery
cards visually match the DNA preset grid's hover/active styling for free — only the thumbnail
image and description line use the two new rules from Step 5.

- [ ] **Step 8: Run tests to verify they pass**

Run: `node test.js`
Expected: all 3 assertions from Step 1 show `✓`. Also re-check the pre-existing "every
$(\"id\") resolves to an element" assertion (Static checks section) still shows `✓`.

- [ ] **Step 9: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Gallery tab UI — nav, page, card grid, click-to-load"
```

---

### Task 3: Full regression + manual live-check

**Files:** none modified — verification only.

**Interfaces:** none (terminal task).

- [ ] **Step 1: Full automated regression**

Run: `npm run ci`
Expected: `node build.js` reports the merge succeeded, then `node test.js` reports `fail: 0` and
every section — old and new — shows all `✓`.

- [ ] **Step 2: Confirm no generated-region drift**

Run: `git diff --stat elastic-morph.html`
Expected: no output.

Run: `git status --short`
Expected: empty (aside from the new, already-committed `assets/gallery/gallery.json`).

- [ ] **Step 3: Manual live-check**

In the running app:
1. Open the new "Gallery" tab — confirm it appears in the left nav after "Settings", and shows
   an empty grid (no error, no broken layout) since `gallery.json` starts as `[]`.
2. Temporarily edit `assets/gallery/gallery.json` to contain 2-3 real entries — export a couple
   of actual looks from the running app (via the existing "Copy share link" button, then paste
   the decoded JSON payload into a `project` field, or via "Save Project"'s downloaded file) so
   the test data is realistic, not hand-typed fake data. Add matching thumbnail JPGs under
   `assets/gallery/thumbs/`.
3. Reload, open Gallery again — confirm the cards render with the correct thumbnail, name, and
   "by <author>" line, and visually match the DNA preset card style (hover state, rounded
   corners).
4. Click a card — confirm the app immediately switches to that look (preset, palette, feedback
   loop settings, etc. all change to match) with no confirmation dialog, matching "Load
   Project"'s existing behavior.
5. Confirm Cmd/Ctrl+Z (Undo) restores the previous state after loading a gallery look — this is
   the safety net this plan explicitly relies on instead of adding a confirmation dialog.
6. Switch to a different tab and back to Gallery — confirm it does NOT re-fetch
   `gallery.json` from the network a second time (check the browser's network tab, or add a
   temporary `console.log` in `loadGallery()` during this check only, removed afterward) —
   this validates the caching behavior from Task 1.
7. Revert `assets/gallery/gallery.json` back to `[]` before considering this step done, unless
   Frank wants to keep real curated entries live at this point — that's his call, not something
   to decide unilaterally.

No code changes are expected from this step unless it surfaces a concrete bug — if so, that's a
follow-up, not part of this plan's scope.
