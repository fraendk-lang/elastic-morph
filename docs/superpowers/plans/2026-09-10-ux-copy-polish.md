# UX Copy Polish Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project 4 of 4 in the "improve what's there" batch. Four small, confirmed copy problems: a Creator hint that implies HQ exports are silent (they aren't), a developer-facing placeholder text with an internal file path on the public landing page, an inconsistent "Upload Audio" vs "Track laden" button label, and a terse technical WebGL badge. All are pure text edits — no logic, no `node build.js`.

**Architecture:** 7 string replacements across two files: 4 in `elastic-morph.html` (Creator export hint, `#uploadBtn` label, the help-text sentence that names both old labels, the WebGL badge fallback string), 3 in `index.html` (the inline `reelPhSub` span plus its `I18N.de` and `I18N.en` entries). Nothing else changes.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`) + static landing page (`index.html`), zero-dependency static-assertion test harness (`test.js` — note: its `html` variable is `elastic-morph.html` only, so `index.html` changes are verified by manual check, not tests).

## Global Constraints

- Pure text. No JS logic, no markup structure, no id/class/attribute changes.
- Keep the `data-i18n` attributes and `<code>` tags where they are in `index.html` — only the human-readable words change (and the `<code>`-wrapped path is removed).
- `#uploadBtn` keeps its id and class; only the button's text content changes.
- Exact replacement strings are given verbatim in each step.

---

### Task 1: Seven copy replacements (Creator hint, upload label + help text, WebGL badge, landing fallback ×3)

**Files:**
- Modify: `elastic-morph.html` — Creator export hint (~1118), `#uploadBtn` label (~1036), help-text sentence (~2080), WebGL badge string (~13158)
- Modify: `index.html` — inline `reelPhSub` span (~167), `I18N.de.reelPhSub` (~205), `I18N.en.reelPhSub` (~224)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file — for the 4 `elastic-morph.html` strings only)

**Interfaces:**
- Consumes / Produces: nothing — text only.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("UX copy polish bundle");

ok("Creator export hint no longer calls HQ export 'stumm' (silent) and states it has sound", () => {
  return html.includes('Direkt = schnell, mit Ton · Stop = nochmal tippen · HQ = beste Qualität, mit Ton, dauert länger')
    && !html.includes('HQ = lang, stumm, beste Qualität');
});

ok("the audio-load button is labelled 'Track laden', not 'Upload Audio'", () => {
  return html.includes('<button class="btn" id="uploadBtn">Track laden</button>')
    && !html.includes('<button class="btn" id="uploadBtn">Upload Audio</button>');
});

ok("the drag/drop help sentence names only 'Track laden', not the removed 'Upload Audio' label", () => {
  return html.includes('Audio auf das Canvas ziehen oder <b>Track laden</b>. Das Visual entsteht aus dem Song-Fingerabdruck. Ohne Datei: <b>🎤 Live Input</b> für Mikro/Line-In.')
    && !html.includes('<b>Upload Audio</b> / <b>Track laden</b>');
});

ok("the WebGL badge fallback text is user-friendly, not the terse technical warning", () => {
  return html.includes('el.textContent = ok ? "" : "Erweiterter Grafikmodus nicht verfügbar — kompatibler Modus aktiv";')
    && !html.includes('"⚠ WebGL Shader nicht verfügbar"');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all 4 new assertions print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement — Creator export hint (`elastic-morph.html` ~1118)**

Find:

```html
          <span class="cr-export-hint">Direkt = schnell mit Ton · Stop = nochmal tippen · HQ = lang, stumm, beste Qualität</span>
```

Replace it with:

```html
          <span class="cr-export-hint">Direkt = schnell, mit Ton · Stop = nochmal tippen · HQ = beste Qualität, mit Ton, dauert länger</span>
```

- [ ] **Step 4: Implement — `#uploadBtn` label (`elastic-morph.html` ~1036)**

Find:

```html
    <button class="btn" id="uploadBtn">Upload Audio</button>
```

Replace it with:

```html
    <button class="btn" id="uploadBtn">Track laden</button>
```

- [ ] **Step 5: Implement — help-text sentence (`elastic-morph.html` ~2080)**

Find:

```html
        <p>Audio auf das Canvas ziehen oder <b>Upload Audio</b> / <b>Track laden</b>. Das Visual entsteht aus dem Song-Fingerabdruck. Ohne Datei: <b>🎤 Live Input</b> für Mikro/Line-In.</p>
```

Replace it with:

```html
        <p>Audio auf das Canvas ziehen oder <b>Track laden</b>. Das Visual entsteht aus dem Song-Fingerabdruck. Ohne Datei: <b>🎤 Live Input</b> für Mikro/Line-In.</p>
```

- [ ] **Step 6: Implement — WebGL badge string (`elastic-morph.html` ~13158)**

Find:

```js
  el.textContent = ok ? "" : "⚠ WebGL Shader nicht verfügbar";
```

Replace it with:

```js
  el.textContent = ok ? "" : "Erweiterter Grafikmodus nicht verfügbar — kompatibler Modus aktiv";
```

- [ ] **Step 7: Implement — landing inline `reelPhSub` span (`index.html` ~167)**

Find:

```html
        <span data-i18n="reelPhSub">Lege <code style="color:var(--text)">assets/elasticmorph_elasticfield_dustreel.mp4</code> ins Projekt — oder starte die App direkt mit dem eingebauten Demo-Track.</span>
```

Replace it with:

```html
        <span data-i18n="reelPhSub">Das Demo-Reel lädt gerade — oder starte die App direkt mit dem eingebauten Demo-Track.</span>
```

- [ ] **Step 8: Implement — `I18N.de.reelPhSub` (`index.html` ~205)**

Find:

```js
      reelPhSub: "Lege <code style=\"color:var(--text)\">assets/elasticmorph_elasticfield_dustreel.mp4</code> ins Projekt — oder starte die App direkt mit dem eingebauten Demo-Track.",
```

Replace it with:

```js
      reelPhSub: "Das Demo-Reel lädt gerade — oder starte die App direkt mit dem eingebauten Demo-Track.",
```

- [ ] **Step 9: Implement — `I18N.en.reelPhSub` (`index.html` ~224)**

Find:

```js
      reelPhSub: "Add <code style=\"color:var(--text)\">assets/elasticmorph_elasticfield_dustreel.mp4</code> to the project — or launch the app with the built-in demo track.",
```

Replace it with:

```js
      reelPhSub: "The demo reel is loading — or launch the app straight away with the built-in demo track.",
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 4 new ones. Final line: `<N> passed, 0 failed`.

- [ ] **Step 11: Commit**

```bash
git add elastic-morph.html index.html test.js
git commit -m "polish: fix misleading/dev-facing UI copy (4 spots)

Project 4 of the 'improve what's there' batch — pure copy fixes:

- Creator export hint said 'HQ = lang, stumm' which reads as 'the HQ
  file has no audio'. HQ exports DO carry AAC audio; 'stumm' only ever
  meant 'no speaker playback while it renders' (still stated in the
  button tooltip). Now: 'HQ = beste Qualität, mit Ton, dauert länger'.
- The audio-load button in the Pro top bar was 'Upload Audio' while
  every other reference says 'Track laden' — unified to 'Track laden'
  (and the drag/drop help sentence no longer names the removed label).
- The WebGL fallback badge showed '⚠ WebGL Shader nicht verfügbar'
  (terse, technical). Now: 'Erweiterter Grafikmodus nicht verfügbar —
  kompatibler Modus aktiv'. The fallback renderer already runs; this
  is just the message.
- The landing page's demo-reel placeholder showed a developer
  instruction with an internal file path ('Lege assets/…mp4 ins
  Projekt'). Replaced (inline span + de/en i18n entries) with a
  plain user-facing line that works as both the loading and the
  failed-to-load state.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after the task)

1. Open the app in Creator mode — the export hint under the Direkt/HQ buttons should read
   the new wording; nothing about "stumm".
2. Confirm the Pro top-bar button now says "Track laden" and still opens the file picker.
3. Open the drag/drop help panel — the sentence should mention only "Track laden".
4. Force the WebGL fallback (a browser/tab without WebGL, or the shader engine on a
   machine that can't compile it) — the badge should show the friendly line.
5. Open the landing page `https://elasticmorph.app/` — the demo reel should still play as
   normal; if you throttle the network / block the mp4, the placeholder should now show
   the friendly line in both DE and EN (toggle the language switch), with no file path.
