# Landing Page Feature Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `index.html` (the marketing landing page)'s feature-card section: correct a
stale FX count, add 3 new cards (Particle Mode, Live Text & Lyrics, Video Timeline) in both
German and English.

**Architecture:** Pure copy edits inside `index.html`'s existing card-grid markup and its
`I18N.de`/`I18N.en` objects — no CSS, no JS logic, no new files.

**Tech Stack:** Plain HTML/JS (this page has no build step, no framework).

## Global Constraints

- All 3 edits land in `index.html` only (the landing page — distinct from `elastic-morph.html`,
  the app, which this task does not touch).
- Test count baseline: 620 passed, 0 failed (confirmed via an actual `node test.js` run just
  before this plan was written). Required after this task: exactly **626 passed, 0 failed** (620
  + 6 new).
- `index.html` had zero content-level test coverage before this task (only Service-Worker
  precache/existence checks existed) — this task adds the first ones.
- No screenshots, no new visual assets, no CSS/layout changes, no reordering of the 5 existing
  cards — copy only, per the approved spec's Non-Goals.

---

## Task 1: Add 3 feature cards, fix the FX count

**Files:**
- Modify: `index.html:173-179` (card grid), `index.html:191-195` (`I18N.de`), `index.html:207-211`
  (`I18N.en`)
- Test: `test.js`

**Interfaces:** None — self-contained, single task, no other task depends on it.

- [ ] **Step 1: Re-confirm exact current text**

```bash
grep -n '<div class="n">05</div>' index.html
grep -n '      f2: "WebGL-Shader' index.html
grep -n '      f2: "WebGL shaders' index.html
grep -n '      f5: "16' index.html
```
All four should print. Read the surrounding ~10 lines of each with `Read` if anything looks
different from Step 2's "find" blocks below — don't guess.

- [ ] **Step 2: Make all 3 edits**

**A) Card grid** — find:
```html
  <section class="feat">
    <div class="card reveal d3"><div class="n">01</div><h3>Visual DNA</h3><p data-i18n="f1"></p><div class="tags"><span class="tag">Filament</span><span class="tag">Attractor</span><span class="tag">Fractal Flame</span></div></div>
    <div class="card reveal d4"><div class="n">02</div><h3>Shader &amp; FX</h3><p data-i18n="f2"></p><div class="tags"><span class="tag">WebGL</span><span class="tag">GLSL</span><span class="tag">20 FX</span></div></div>
    <div class="card reveal d5"><div class="n">03</div><h3>Set Editor</h3><p data-i18n="f3"></p><div class="tags"><span class="tag">Timeline</span><span class="tag">Cues</span><span class="tag">MIDI</span></div></div>
    <div class="card reveal d6"><div class="n">04</div><h3>HQ Export</h3><p data-i18n="f4"></p><div class="tags"><span class="tag">MP4</span><span class="tag">4K</span><span class="tag">WebCodecs</span></div></div>
    <div class="card reveal d6"><div class="n">05</div><h3>Scene Banks</h3><p data-i18n="f5"></p><div class="tags"><span class="tag">16 Slots</span><span class="tag">Keyboard</span><span class="tag">Live</span></div></div>
  </section>
```
replace:
```html
  <section class="feat">
    <div class="card reveal d3"><div class="n">01</div><h3>Visual DNA</h3><p data-i18n="f1"></p><div class="tags"><span class="tag">Filament</span><span class="tag">Attractor</span><span class="tag">Fractal Flame</span></div></div>
    <div class="card reveal d4"><div class="n">02</div><h3>Shader &amp; FX</h3><p data-i18n="f2"></p><div class="tags"><span class="tag">WebGL</span><span class="tag">GLSL</span><span class="tag">30 FX</span></div></div>
    <div class="card reveal d5"><div class="n">03</div><h3>Set Editor</h3><p data-i18n="f3"></p><div class="tags"><span class="tag">Timeline</span><span class="tag">Cues</span><span class="tag">MIDI</span></div></div>
    <div class="card reveal d6"><div class="n">04</div><h3>HQ Export</h3><p data-i18n="f4"></p><div class="tags"><span class="tag">MP4</span><span class="tag">4K</span><span class="tag">WebCodecs</span></div></div>
    <div class="card reveal d6"><div class="n">05</div><h3>Scene Banks</h3><p data-i18n="f5"></p><div class="tags"><span class="tag">16 Slots</span><span class="tag">Keyboard</span><span class="tag">Live</span></div></div>
    <div class="card reveal d6"><div class="n">06</div><h3>Particle Mode</h3><p data-i18n="f6"></p><div class="tags"><span class="tag">11 Muster</span><span class="tag">Mirror</span><span class="tag">Konstellation</span></div></div>
    <div class="card reveal d6"><div class="n">07</div><h3>Live Text &amp; Lyrics</h3><p data-i18n="f7"></p><div class="tags"><span class="tag">Lyrics Sync</span><span class="tag">5 Endings</span><span class="tag">Live</span></div></div>
    <div class="card reveal d6"><div class="n">08</div><h3>Video Timeline</h3><p data-i18n="f8"></p><div class="tags"><span class="tag">Multi-Clip</span><span class="tag">9 Übergänge</span><span class="tag">Blenden</span></div></div>
  </section>
```

**B) `I18N.de`** — find:
```js
      f2: "WebGL-Shader (Fluid, Metaballs, Tunnel) plus zwei FX-Racks — Pixel/Farbe und Geometrie — alle audioreaktiv und stapelbar.",
      f3: "Marker auf der Wellenform setzen, die Szenen und Effekte abrufen — ein vorbereitetes Set, das deterministisch abläuft, auch im Export.",
      f4: "Frame-genauer Offline-Export als MP4 bis 4K, mit Ton — keine Frame-Drops, exakt reproduzierbar. Plus PNG-Stills.",
      f5: "16 Szenen in zwei umschaltbaren Bänken, plus eine feste Basis-Szene für den Set-Opener — live per Tastatur abrufbar, mitten im Auftritt.",
```
replace:
```js
      f2: "WebGL-Shader (Fluid, Metaballs, Tunnel, Portal, Kristall) plus drei FX-Racks — Pixel/Farbe, Geometrie und Kino-Look — alle audioreaktiv und stapelbar.",
      f3: "Marker auf der Wellenform setzen, die Szenen und Effekte abrufen — ein vorbereitetes Set, das deterministisch abläuft, auch im Export.",
      f4: "Frame-genauer Offline-Export als MP4 bis 4K, mit Ton — keine Frame-Drops, exakt reproduzierbar. Plus PNG-Stills.",
      f5: "16 Szenen in zwei umschaltbaren Bänken, plus eine feste Basis-Szene für den Set-Opener — live per Tastatur abrufbar, mitten im Auftritt.",
      f6: "Elf audioreaktive Partikel-Muster — von Sternenfeldern bis Magnetfeldern — mit Spiegelsymmetrie und Konstellations-Verbindungen zwischen den Punkten.",
      f7: "Songtitel, Lyrics im Takt oder spontane Text-Effekte live per Taste — von sanftem Fade bis Glitch-Blackout, während du auftrittst.",
      f8: "Mehrere Video-Clips hintereinander schneiden, mit neun Übergängen und weichen Blenden — aus dem Standbild-Visual wird ein echtes Schnitt-Tool.",
```

**C) `I18N.en`** — find:
```js
      f2: "WebGL shaders (fluid, metaballs, tunnel) plus two FX racks — pixel/colour and geometry — all audio-reactive and stackable.",
      f3: "Drop markers on the waveform that recall scenes and effects — a prepared set that plays back deterministically, including in the export.",
      f4: "Frame-accurate offline export as MP4 up to 4K, with audio — no dropped frames, exactly reproducible. Plus PNG stills.",
      f5: "16 scenes across two switchable banks, plus a dedicated Basis Scene for your set opener — recallable live from the keyboard, mid-performance.",
```
replace:
```js
      f2: "WebGL shaders (fluid, metaballs, tunnel, portal, crystal) plus three FX racks — pixel/colour, geometry, and cinematic looks — all audio-reactive and stackable.",
      f3: "Drop markers on the waveform that recall scenes and effects — a prepared set that plays back deterministically, including in the export.",
      f4: "Frame-accurate offline export as MP4 up to 4K, with audio — no dropped frames, exactly reproducible. Plus PNG stills.",
      f5: "16 scenes across two switchable banks, plus a dedicated Basis Scene for your set opener — recallable live from the keyboard, mid-performance.",
      f6: "Eleven audio-reactive particle patterns — from starfields to magnetic fields — with mirror symmetry and constellation lines connecting the dots.",
      f7: "Song title, beat-synced lyrics, or spontaneous text effects triggered live from the keyboard — from a soft fade to a glitch blackout, mid-performance.",
      f8: "Cut multiple video clips together with nine transition styles and smooth fades — turning the static visual into a real editing tool.",
```

- [ ] **Step 3: Write the tests**

Append to `test.js`, right before the `/* ---------------- summary ---------------- */` block:

```js
section("Landing page — feature card refresh");

ok("index.html no longer says \"20 FX\" and now says \"30 FX\"", (() => {
  return !html.includes("20 FX") && html.includes("30 FX");
})());

ok("I18N.de and I18N.en both define f6 (Particle Mode) — exactly 2 occurrences across both language blocks", (() => {
  return (html.match(/f6: "/g) || []).length === 2;
})());

ok("I18N.de and I18N.en both define f7 (Live Text & Lyrics) — exactly 2 occurrences across both language blocks", (() => {
  return (html.match(/f7: "/g) || []).length === 2;
})());

ok("I18N.de and I18N.en both define f8 (Video Timeline) — exactly 2 occurrences across both language blocks", (() => {
  return (html.match(/f8: "/g) || []).length === 2;
})());

ok("the feature grid has exactly 8 cards (5 kept + 3 new)", (() => {
  return (html.match(/<div class="card /g) || []).length === 8;
})());

ok("all 3 new card titles are present exactly once each: Particle Mode, Live Text & Lyrics, Video Timeline", (() => {
  const count = s => (html.match(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  return count("<h3>Particle Mode</h3>") === 1 &&
         count("<h3>Live Text &amp; Lyrics</h3>") === 1 &&
         count("<h3>Video Timeline</h3>") === 1;
})());
```

- [ ] **Step 4: Run the tests and confirm the count**

```bash
node test.js
```
Expected: the new "Landing page — feature card refresh" section prints 6 lines with `✓`, and the
final summary line reads **`626 passed, 0 failed`** (620 baseline + 6 new).

- [ ] **Step 5: Commit**

```bash
git add index.html test.js
git commit -m "content(landing): refresh feature cards — 30 FX, Particle Mode, Live Text & Lyrics, Video Timeline"
```

---

## After the Task: Live Verification + Push

Not a subagent task — the controller does this directly:

1. Local dev server (verify served content freshness before trusting it — see
   `project_morph_second_local_checkout.md` memory).
2. Open `index.html`, confirm all 8 cards render without layout breakage in the grid, toggle
   DE/EN and confirm the 3 new cards' text swaps correctly in both directions, confirm the
   corrected FX count reads right.
3. `git push` (`dangerouslyDisableSandbox: true`).
4. Poll `https://elasticmorph.app/` (the landing page's own URL, not `/elastic-morph.html`), SHA-256
   hash against the local `index.html`, until they match.
5. Update project memory once hash-confirmed — a short addition to an existing relevant memory
   file is enough; if none fits well, a new short one is fine given this is a different area
   (landing page/marketing) from the app-feature memories used so far this session.
