# Elastic Morph

**Aus deinem Track wird ein einzigartiges Visual** — die Form entsteht aus dem Fingerabdruck des Songs. Im Browser, ohne Vorkenntnisse, exportierbar bis 4K.

Teil von **[Elastic Universe](https://elasticuniverse.app)** — Visual Computing Ecosystem.

---

## Was es kann

- **Visual DNA** — jeder Song bekommt eine deterministische, eigene Form aus seinem Fingerabdruck. Vier Render-Engines: Blob, Filament (Curl-Noise), Strange Attractor (de Jong) und echtes Fractal Flame (IFS).
- **Shader & FX** — WebGL-Shader (Fluid, Metaballs, Tunnel) plus zwei audioreaktive FX-Racks (Pixel/Farbe + Geometrie), stapelbar.
- **Bild- & Text-Ebenen** — Bilder als reaktive Visuals (inkl. Spin), Text-Designer mit 18 Animationen, Kreis-Text, 2-Farb-Gradient, Lower-Third.
- **Timeline & Set Editor** — Energie-Wellenform, Drop-Marker, A–B-Loop; Set-Editor mit getimten Cues, die Szenen + FX abrufen und beim Export deterministisch ablaufen.
- **HQ-Export** — frame-genauer Offline-Export als MP4 bis 4K, mit Ton (WebCodecs), keine Frame-Drops; plus Echtzeit-Export und PNG-Stills.
- **PWA** — installierbar, läuft offline.

## Nutzung

Reine statische Web-App, kein Build nötig.

- **Online/Deploy:** `index.html` (Landingpage) → „App starten" öffnet `elastic-morph.html`.
- **Lokal:** `elastic-morph.html` per Doppelklick öffnen, oder einen statischen Server starten (`npx serve`) für PWA/Service-Worker.
- **HQ-Export** braucht WebCodecs → am besten Chrome/Edge.

## Projektstruktur

| Datei | Zweck |
|---|---|
| `index.html` | Landingpage (Elastic-Universe-Stil) |
| `elastic-morph.html` | Die App (Single-File) |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | PWA |
| `test.js` | Regressions-Checks (`node test.js`) |
| `KONZEPT-Professionalisierung.md` | Produkt-/Roadmap-Konzept |
| `BRAND-Elastic-Morph.md` | Marken-/Style-Guide |

## Tests

```bash
node test.js
```

Statische Checks + Unit-Tests der reinen Funktionen (FFT, Attractor-Stabilität, Cue-Engine u.a.).

---

© Elastic Universe. Alle Rechte vorbehalten.
