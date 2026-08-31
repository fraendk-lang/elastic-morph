# Landing Page Feature Refresh: Design Spec

**Status:** Approved by Frank ("Das passt")
**Date:** 2026-08-31

## Goal

`index.html` (the marketing landing page, distinct from `elastic-morph.html`, the app itself) is
stale — its 5 feature cards haven't been touched since Scene Banks landed (2026-08-25) and don't
reflect a large batch of features shipped since: Particle Mode, the whole Text Mode system
(Hypno Loop, Text Endings, Lyrics Sync), Video Timeline, and the FX/Shader Engine's growth (still
says "20 FX", now 30). Frank explicitly scoped this round to copy/content only — no new
screenshots or captions (that idea is separately noted as declined-for-now).

## Context

*Line numbers are as of this spec's writing (2026-08-31) — re-confirm with a fresh `grep -n`
before editing.*

`index.html` is a small (284-line), fully hand-styled, bilingual (DE/EN) single page — dark
space theme, starfield canvas, purple/magenta gradient branding. Copy lives in one place: a
`data-i18n`/`data-i18n-html` attribute on each text element, resolved from an `I18N = { de: {...},
en: {...} }` object (`index.html:185-218`) by `setLang()`. The 5 feature cards live in
`<section class="feat">` (`index.html:173-179`) as a `repeat(auto-fit, minmax(230px,1fr))` grid —
adding more cards is a pure layout non-event, the grid already handles arbitrary card counts.

Each card: `<div class="card reveal dN"><div class="n">0N</div><h3>Title</h3><p data-i18n="fN">
</p><div class="tags"><span class="tag">...</span>×3</div></div>` — title is hardcoded (not
i18n'd, titles are already short/brand-neutral enough to work in both languages as-is, matching
existing precedent: "Visual DNA", "HQ Export" etc. read fine in English too), the description
paragraph is i18n'd via `data-i18n="fN"`, tags are hardcoded (also not i18n'd today — e.g.
"Keyboard"/"Live" already double as English words, matching precedent).

No test coverage exists for this page's *content* today (only Service-Worker precache/existence
checks in `test.js`) — this round adds the first content-level tests for it.

## Design

**Keep all 5 existing cards, update one, append 3 new ones — same visual pattern, same tag/title
style, nothing structural changes.**

1. **Visual DNA** — unchanged.
2. **Shader & FX** — copy and tags updated: "zwei FX-Racks"/"two FX racks" → three, "20 FX" tag →
   "30 FX", and the parenthetical shader example list gets a couple of the newer GLSL styles
   (Portal, Crystal) added alongside the original three.
3. **Set Editor** — unchanged.
4. **HQ Export** — unchanged.
5. **Scene Banks** — unchanged.
6. **Particle Mode** *(new)* — 11 patterns, mirror symmetry, constellation connections.
7. **Live Text & Lyrics** *(new)* — song title / beat-synced lyrics / 5 keyboard-triggered
   one-shot text effects (Text Endings), live performance framing.
8. **Video Timeline** *(new)* — multi-clip cutting, 9 transition types, fades — "turns the static
   visual into a real editing tool."

Deliberately excluded (per Frank's earlier approval): Auto-VJ, DNA Bank 2, Community Gallery —
too specific for a first-impression page, the existing 5 + these 3 already give real breadth
without turning into a changelog.

## Exact Code

### A) Feature cards markup (`index.html:173-179`)

Find:
```html
  <section class="feat">
    <div class="card reveal d3"><div class="n">01</div><h3>Visual DNA</h3><p data-i18n="f1"></p><div class="tags"><span class="tag">Filament</span><span class="tag">Attractor</span><span class="tag">Fractal Flame</span></div></div>
    <div class="card reveal d4"><div class="n">02</div><h3>Shader &amp; FX</h3><p data-i18n="f2"></p><div class="tags"><span class="tag">WebGL</span><span class="tag">GLSL</span><span class="tag">20 FX</span></div></div>
    <div class="card reveal d5"><div class="n">03</div><h3>Set Editor</h3><p data-i18n="f3"></p><div class="tags"><span class="tag">Timeline</span><span class="tag">Cues</span><span class="tag">MIDI</span></div></div>
    <div class="card reveal d6"><div class="n">04</div><h3>HQ Export</h3><p data-i18n="f4"></p><div class="tags"><span class="tag">MP4</span><span class="tag">4K</span><span class="tag">WebCodecs</span></div></div>
    <div class="card reveal d6"><div class="n">05</div><h3>Scene Banks</h3><p data-i18n="f5"></p><div class="tags"><span class="tag">16 Slots</span><span class="tag">Keyboard</span><span class="tag">Live</span></div></div>
  </section>
```
Replace:
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

*(Tag text — "11 Muster"/"9 Übergänge" — is hardcoded, not `data-i18n`'d, matching the existing
precedent of "16 Slots"/"Keyboard"/"Live" tags today. Card 7's tags likewise stay as-is across
languages, per that same precedent.)*

### B) `I18N.de` — updated f2, new f6/f7/f8 (`index.html:191-195`)

Find:
```js
      f2: "WebGL-Shader (Fluid, Metaballs, Tunnel) plus zwei FX-Racks — Pixel/Farbe und Geometrie — alle audioreaktiv und stapelbar.",
      f3: "Marker auf der Wellenform setzen, die Szenen und Effekte abrufen — ein vorbereitetes Set, das deterministisch abläuft, auch im Export.",
      f4: "Frame-genauer Offline-Export als MP4 bis 4K, mit Ton — keine Frame-Drops, exakt reproduzierbar. Plus PNG-Stills.",
      f5: "16 Szenen in zwei umschaltbaren Bänken, plus eine feste Basis-Szene für den Set-Opener — live per Tastatur abrufbar, mitten im Auftritt.",
```
Replace:
```js
      f2: "WebGL-Shader (Fluid, Metaballs, Tunnel, Portal, Kristall) plus drei FX-Racks — Pixel/Farbe, Geometrie und Kino-Look — alle audioreaktiv und stapelbar.",
      f3: "Marker auf der Wellenform setzen, die Szenen und Effekte abrufen — ein vorbereitetes Set, das deterministisch abläuft, auch im Export.",
      f4: "Frame-genauer Offline-Export als MP4 bis 4K, mit Ton — keine Frame-Drops, exakt reproduzierbar. Plus PNG-Stills.",
      f5: "16 Szenen in zwei umschaltbaren Bänken, plus eine feste Basis-Szene für den Set-Opener — live per Tastatur abrufbar, mitten im Auftritt.",
      f6: "Elf audioreaktive Partikel-Muster — von Sternenfeldern bis Magnetfeldern — mit Spiegelsymmetrie und Konstellations-Verbindungen zwischen den Punkten.",
      f7: "Songtitel, Lyrics im Takt oder spontane Text-Effekte live per Taste — von sanftem Fade bis Glitch-Blackout, während du auftrittst.",
      f8: "Mehrere Video-Clips hintereinander schneiden, mit neun Übergängen und weichen Blenden — aus dem Standbild-Visual wird ein echtes Schnitt-Tool.",
```

### C) `I18N.en` — same 4 lines, English (`index.html:207-211`)

Find:
```js
      f2: "WebGL shaders (fluid, metaballs, tunnel) plus two FX racks — pixel/colour and geometry — all audio-reactive and stackable.",
      f3: "Drop markers on the waveform that recall scenes and effects — a prepared set that plays back deterministically, including in the export.",
      f4: "Frame-accurate offline export as MP4 up to 4K, with audio — no dropped frames, exactly reproducible. Plus PNG stills.",
      f5: "16 scenes across two switchable banks, plus a dedicated Basis Scene for your set opener — recallable live from the keyboard, mid-performance.",
```
Replace:
```js
      f2: "WebGL shaders (fluid, metaballs, tunnel, portal, crystal) plus three FX racks — pixel/colour, geometry, and cinematic looks — all audio-reactive and stackable.",
      f3: "Drop markers on the waveform that recall scenes and effects — a prepared set that plays back deterministically, including in the export.",
      f4: "Frame-accurate offline export as MP4 up to 4K, with audio — no dropped frames, exactly reproducible. Plus PNG stills.",
      f5: "16 scenes across two switchable banks, plus a dedicated Basis Scene for your set opener — recallable live from the keyboard, mid-performance.",
      f6: "Eleven audio-reactive particle patterns — from starfields to magnetic fields — with mirror symmetry and constellation lines connecting the dots.",
      f7: "Song title, beat-synced lyrics, or spontaneous text effects triggered live from the keyboard — from a soft fade to a glitch blackout, mid-performance.",
      f8: "Cut multiple video clips together with nine transition styles and smooth fades — turning the static visual into a real editing tool.",
```

## Non-Goals

- No screenshots, no captions, no new visual asset pipeline — pure copy within the existing card
  pattern (Frank's explicit scoping this round).
- No reordering of the 5 existing cards, no CSS/layout changes — the grid already absorbs 8 cards
  cleanly with `auto-fit`.
- Auto-VJ, DNA Bank 2, Community Gallery — deliberately not added, per Frank's approval of the
  8-card shortlist.
- Card titles and tags stay hardcoded/non-i18n'd for cards 6–8, matching the existing precedent
  set by cards 1–5 (titles and several existing tags already read fine unchanged in both
  languages).

## Testing

New content-level tests in `test.js` (this page had none before):

- `index.html` no longer contains the string `"20 FX"`; contains `"30 FX"`.
- The `I18N.de` and `I18N.en` objects both define `f6`, `f7`, and `f8` (regex/`includes` check on
  the raw file, since there's no JS module system to `require` here — a `.match(/f6: "/g)` count
  of exactly 2 confirms both language blocks got the new key, matching how a missing translation
  would silently fall back to English per `setLang`'s `d[el.dataset.i18n] || el.textContent`
  fallback and therefore needs an explicit test, not just visual inspection).
- The feature grid contains exactly 8 `<div class="card` occurrences (5 kept + 3 new).
- The 3 new cards' `<h3>` titles ("Particle Mode", "Live Text &amp; Lyrics", "Video Timeline")
  are each present exactly once.

## Live Verification

Open `index.html` locally, confirm all 8 cards render in the grid without layout breakage, switch
the DE/EN toggle and confirm all 3 new cards' text swaps correctly (no English fallback leaking
into the German view or vice versa), confirm the corrected FX count reads right.
