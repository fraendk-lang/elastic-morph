# "Set to Gallery" Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Frank a personal, one-click way to package the look currently on screen into a ready-to-use Community Gallery entry (thumbnail JPG + JSON snippet), so growing `assets/gallery/gallery.json` no longer requires hand-crafting the entry from scratch.

**Architecture:** One new pure helper (`gallerySlug`) + one new handler (`addToGallery`) + one new button, all added to the static (non-build-injected) region of `elastic-morph.html`, next to the existing `shareBtn`. No backend, no new persisted state, no change to `loadGallery()`/`renderGallery()`. The button only triggers two local file downloads — Frank still manually moves the thumbnail into `assets/gallery/` and pastes the JSON object into `gallery.json` before committing, same as today's fully-manual process, just without the manual data-entry.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- Both new functions and the new button markup go in the **static region** of `elastic-morph.html` (before the `/* @BUILD-INJECT-V58 */` marker at line 11555) — no `node build.js` rebuild needed. Verified: `shareBtn`/`shareLink()` (the placement anchor) live at lines 1632/10624, both well before 11555.
- Default author is the fixed string `"Elastic Universe"` — not a prompt, not "Frank".
- Only the look's **name** is prompted for (`prompt()`, pre-filled with a suggestion); author and date are automatic.
- Thumbnail is an automatic screenshot of the current canvas (`canvas.toBlob`), not a manual crop.
- The button is a normal, visible Settings button (not hidden behind a shortcut) — it only ever produces local downloads on the clicking device, so it's harmless for any user to see.
- Entry shape must match the existing schema exactly: `{id, name, author, date, thumbnail, project}` (see `renderGallery()` at `elastic-morph.html:2831`, which reads `entry.name`/`entry.thumbnail`/`entry.author`/`entry.project`).

---

### Task 1: `gallerySlug()` helper, `addToGallery()` handler, and the button

**Files:**
- Modify: `elastic-morph.html:1632` (new button markup, next to `shareBtn`)
- Modify: `elastic-morph.html:10634` (new functions + wiring, next to `shareLink()`)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Consumes: `projectData()`, `canvas`, `showAppToast(msg, ms)` (all pre-existing).
- Produces: `gallerySlug(name)` — pure function, `string -> string`. `addToGallery()` — click handler, no return value, no new global state.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Set to Gallery button (personal admin tool)");

ok("gallerySlug() lowercases, strips non-alphanumerics, and is collision-safe across calls", (() => {
  const { gallerySlug } = loadFns(["gallerySlug"]);
  const a = gallerySlug("Neon Tunnel!!");
  const b = gallerySlug("Neon Tunnel!!");
  return /^neon-tunnel-\d+-[a-z0-9]{4}$/.test(a) && a !== b;
})());

ok("gallerySlug() falls back to 'look' for an empty or missing name", (() => {
  const { gallerySlug } = loadFns(["gallerySlug"]);
  return gallerySlug("").startsWith("look-") && gallerySlug(null).startsWith("look-");
})());

ok("Set to Gallery button exists next to Copy share link", () => {
  return html.includes('id="galleryAddBtn"') && html.includes('id="shareBtn"');
});

ok("addToGallery() prompts for a name, defaults author to Elastic Universe, and builds the schema-correct entry", (() => {
  const fn = extractFn("addToGallery");
  return !!fn
    && fn.includes("prompt(")
    && fn.includes('author: "Elastic Universe"')
    && fn.includes("gallerySlug(")
    && fn.includes("thumbnail:")
    && fn.includes("project: projectData()");
})());

ok("addToGallery() captures the canvas as a JPEG thumbnail and shows a completion toast", (() => {
  const fn = extractFn("addToGallery");
  return !!fn && fn.includes('canvas.toBlob(') && fn.includes('"image/jpeg"') && fn.includes("showAppToast(");
})());

ok("Set to Gallery button is wired to addToGallery()", () => {
  return script.includes('$("galleryAddBtn").addEventListener("click", addToGallery)');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all 6 new assertions under "Set to Gallery button (personal admin tool)" print `✗` (missing function/button), everything else still prints `✓`.

- [ ] **Step 3: Implement — the button (`elastic-morph.html:1632`)**

Find:

```html
        <button class="btn" id="shareBtn">🔗 Copy share link</button>
```

Replace it with:

```html
        <button class="btn" id="shareBtn">🔗 Copy share link</button>
        <button class="btn" id="galleryAddBtn" title="Personal tool: prepares a gallery.json entry + thumbnail for you to hand-add">★ Set to Gallery</button>
```

- [ ] **Step 4: Implement — `gallerySlug()` and `addToGallery()` (`elastic-morph.html:10634`, right after `shareLink()`/its listener)**

Find:

```js
$("shareBtn").addEventListener("click", shareLink);
```

Replace it with:

```js
$("shareBtn").addEventListener("click", shareLink);

/* v148: personal "Set to Gallery" tool — packages the current look into a
   ready-to-use assets/gallery/gallery.json entry (thumbnail JPG + JSON
   snippet), both downloaded locally. Frank still manually moves the
   thumbnail into assets/gallery/ and pastes the JSON object into
   gallery.json before committing — this only removes the hand-crafting
   step, it never writes anything live (no backend exists for that). */
function gallerySlug(name) {
  const base = (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "look";
  const rand = Math.random().toString(36).slice(2, 6);
  return base + "-" + Date.now() + "-" + rand;
}

function addToGallery() {
  const suggested = (S.preset && S.preset.name) || "Untitled Look";
  const name = prompt("Name für diesen Look?", suggested);
  if (!name) return;
  const id = gallerySlug(name);
  const entry = {
    id,
    name,
    author: "Elastic Universe",
    date: new Date().toISOString().slice(0, 10),
    thumbnail: "assets/gallery/" + id + ".jpg",
    project: projectData()
  };
  canvas.toBlob(blob => {
    if (!blob) { alert("Thumbnail-Erstellung fehlgeschlagen — bitte nochmal versuchen."); return; }
    const imgUrl = URL.createObjectURL(blob);
    const a1 = document.createElement("a");
    a1.href = imgUrl; a1.download = id + ".jpg"; a1.click();
    setTimeout(() => URL.revokeObjectURL(imgUrl), 10000);

    const jsonBlob = new Blob([JSON.stringify(entry, null, 2)], { type: "application/json" });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const a2 = document.createElement("a");
    a2.href = jsonUrl; a2.download = id + ".json"; a2.click();
    setTimeout(() => URL.revokeObjectURL(jsonUrl), 10000);

    showAppToast(`Gallery-Eintrag vorbereitet: ${id}.jpg + ${id}.json — Thumbnail nach assets/gallery/ verschieben, JSON-Objekt in gallery.json einfügen.`, 6500);
  }, "image/jpeg", 0.85);
}
$("galleryAddBtn").addEventListener("click", addToGallery);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 6 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add personal \"Set to Gallery\" button

Packages the on-screen look into a ready-to-use assets/gallery/
gallery.json entry: prompts for a name, defaults author to
\"Elastic Universe\", screenshots the current canvas as the
thumbnail, and downloads both files (<id>.jpg + <id>.json).

Frank still moves the thumbnail into assets/gallery/ and pastes the
JSON object into gallery.json himself before committing — this is a
personal prep tool, not a live/public submission path (no backend
exists to write there). Removes the hand-crafting step that's been
the real blocker on populating the gallery.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

1. Load a track, tweak the look until it's something you'd actually want in the
   gallery, click **★ Set to Gallery**, and confirm the name prompt is
   pre-filled with the current preset's name.
2. Confirm two files download: `<id>.jpg` (a real screenshot of what's on
   screen right now, not blank/black) and `<id>.json`.
3. Open the downloaded `.json` — confirm it's a single object with
   `id`/`name`/`author: "Elastic Universe"`/`date`/`thumbnail`/`project`, and
   that `project` looks like a full project payload (not truncated).
4. Move the `.jpg` into `assets/gallery/`, paste the JSON object into
   `assets/gallery/gallery.json`'s array, reload the app, open the Gallery
   tab — confirm the new card renders with the right thumbnail/name/author
   and that clicking it restores the look.
5. Click **Cancel** on the name prompt — confirm nothing downloads.
6. If the browser shows a "site wants to download multiple files" permission
   prompt on the first click, that's expected (two downloads in one click) —
   note whether it's disruptive enough to warrant a follow-up (e.g. zipping
   both files into one download) or is fine as-is.
