# Elastic Morph — Brand & Style Guide

*Teil von **Elastic Universe** (Visual Computing Ecosystem). Stand: 15. Juni 2026.*

Dieses Dokument hält fest, wie Elastic Morph aussieht und klingt, damit App, Landingpage und künftige Assets konsistent bleiben.

---

## 1. Positionierung

**Elastic Morph** ist eine eigenständige App in der Elastic-Universe-Familie. Kern-Versprechen:

> Aus deinem Track wird ein **einzigartiges Visual** — die Form entsteht aus dem Fingerabdruck des Songs.

Abgrenzung innerhalb des Universe: Während z.B. *Elastic Paint* und *Elastic Pulse* allgemeine audiovisuelle/Sequencer-Tools sind, ist Morphs Alleinstellung die **Visual DNA** (deterministische, track-eigene Form) plus die **Fractal-Engines** (Filament, Attractor, Fractal Flame).

---

## 2. Farben

| Rolle | Hex | Einsatz |
|---|---|---|
| Hintergrund (Bühne) | `#050507` | Grundfläche, Vollbild |
| Panel | `#0e0e15` | Karten, Bedienflächen |
| Panel 2 | `#12121c` | erhöhte Flächen, Buttons |
| Linie/Rahmen | `#1e1e2c` | Rahmen, Trenner |
| Text | `#e8e8f0` | Fließtext, Überschriften |
| Text gedimmt | `#8a8aa0` | sekundärer Text |
| **Morph-Akzent** | `#b14bff` → `#d946ef` | **Signatur (Violett→Magenta)**: Primär-Buttons, aktive Zustände, Hero/Titel |
| **Universe-Grün** | `#1fe08a` | Dachmarken-Signal: ◉-Marke, „part of Elastic Universe", Eyebrows |
| Amber | `#f5a623` | Warnungen, Drop-/Cue-Marker |

**Regel:** Morph-Violett ist die Identität der App. Das Universe-Grün erscheint nur als Familien-Bezug (Lockup, Eyebrow), nicht als App-Primärfarbe.

Andere Apps der Familie haben jeweils ihre eigene Akzentfarbe — beim Karten-Layout darf jede DNA/jedes Element seinen eigenen Akzent (z.B. die Preset-Gradient-Farbe) als linken Balken tragen.

---

## 3. Typografie

- **Display/Headlines:** schwere Grotesk, eng, gern Versalien (System: -apple-system / Segoe UI / Inter, Weight 700–800, negatives Tracking). Hero-Titel im Violett→Magenta-Verlauf.
- **Eyebrow-Labels:** Versalien, ~2,5px gesperrt, 10–11px, in Universe-Grün (z.B. „ELASTIC UNIVERSE — VISUAL COMPUTING").
- **Fließtext/UI:** dieselbe Grotesk, 12–14px, `--text-dim` für Sekundäres.
- **Zahlen/Code-Tags:** tabular-nums; Tags in Versalien (WEBGL, GLSL, MIDI …).

---

## 4. Komponenten

- **Buttons:** Pill-Form (`border-radius: 999px`). Primär = Violett→Magenta-Verlauf, Text dunkel. Sekundär = transparenter Panel-Hintergrund + Linien-Rahmen, Hover in Akzentfarbe.
- **Karten:** dunkles Panel, ~16px Radius, dünner Rahmen, **linker Akzentbalken** in der jeweiligen Akzentfarbe, optional Nummer (01, 02 …) + Tag-Chips + „● LIVE"-Pill.
- **Eingaben/Selects:** Panel-2-Hintergrund, Linien-Rahmen, Fokus in Akzentfarbe.
- **Fokus (A11y):** sichtbarer `:focus-visible`-Ring in Akzentfarbe (nur Tastatur).
- **Lockup:** grünes ◉ + Wortmarke „Elastic **Morph**" (Morph in Akzentfarbe) + Link „part of Elastic Universe ↗".
- **Motiv:** schwarzer Raum + dezentes blau/türkises Pixel-Sternenfeld („Universe").

---

## 5. Tonalität

Selbstbewusst, technik-kreativ, knapp. Deutsch als Hauptsprache (englische Fachbegriffe ok). Du-Ansprache. Beispiele: „App starten", „Track laden", „Aus deinem Track wird ein Visual." Keine Marketing-Floskeln; konkret und einladend.

---

## 6. Assets im Projekt

- `elastic-morph.html` — die App (Single-File, PWA).
- `index.html` — Landingpage (verlinkt zur App, EU-Stil).
- `manifest.webmanifest`, `sw.js`, `icon-192/512.png` — PWA.
- `KONZEPT-Professionalisierung.md` — Produkt-/Roadmap-Konzept.
- `test.js` — Regressions-Checks (`node test.js`).

---

## 7. Do / Don't

- **Do:** Schwarz als Bühne, Violett-Magenta sparsam als Akzent, Grün nur als Familien-Bezug, Pill-Buttons, viel Negativraum.
- **Don't:** Akzentfarbe großflächig fluten, mehrere konkurrierende Akzentfarben mischen, das Universe-Grün als App-Primärfarbe verwenden, helle Hintergründe.
