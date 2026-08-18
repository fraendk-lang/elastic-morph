# Elastic Morph — Visual Polish (v113)

Ziel: DNA-Bloom wirkt im Ruhezustand zu matt, Layer-B-Overlays wirken teilweise zu generisch,
Text-Layer hat zu wenig Font-Auswahl. Drei unabhängige, in sich abgeschlossene Fixes.

**Nicht Teil dieser Spec:** "Zeitgemässere" Bewegung/Animation des DNA-Organismus selbst —
zu vage definiert, eigene Runde mit visuellen Referenzen nötig, kommt später.

---

## 1. Bloom-Pipeline weniger matt

**Datei:** `elastic-morph.html` (bzw. neues `src/inject-v113.js`), Bloom-Block bei `drawScene`.

**Ist-Zustand:**
```js
if (P.bloom > 0.05 && bloomC.width > 2) {
  bctx.globalCompositeOperation = "copy";
  bctx.drawImage(canvas, 0, 0, bloomC.width, bloomC.height);   // 1/6-Auflösung
  ctx.globalCompositeOperation = "screen";
  const bloomLive = dnaLive ? 1 : (heroOpen ? 0.48 : 0.36);
  ctx.globalAlpha = Math.min(0.36, P.bloom * (0.13 + S.loudness * 0.19 + S.beat * 0.05) * bloomLive);
  ctx.drawImage(bloomC, 0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}
```
Bei Stille + nicht-live (Preview/Idle) landet Alpha bei ~0.03 — kaum sichtbar. Downscale auf
1/6 Auflösung macht den Glow zusätzlich weich/unscharf statt definiert.

**Soll-Zustand:**
- Alpha-Deckel `0.36` → `0.55`
- Baseline-Term `0.13` → `0.22` (Bloom bleibt auch ohne Audio-Input sichtbar)
- `bloomLive`-Idle-Wert `0.36` → `0.6`, Hero-Wert `0.48` → `0.7` (Live bleibt `1`)
- Downscale-Auflösung `canvas.width / 6` → `canvas.width / 4` (Zeile ~7659) für definierteren Glow
- Bestehender Recording-Pfad (Zeile ~12507, `/4`) bleibt unverändert — schon feiner

**Akzeptanzkriterium:** Alle Presets im Preview-Grid (nicht live, kein Audio) zeigen sichtbaren
Glow an hellen DNA-Strukturen, ohne dass helle Presets (bloom ≥ 0.7) ins Weiß clippen
(`applyAutoExposure` fängt das ab, gegenprüfen).

---

## 2. Layer B — generische Typen zurückstufen + aufwerten

**Datei:** `elastic-morph.html`, `LAYERB_TYPES` (Zeile ~4972) + Randomizer (Zeile ~8215) +
`drawLayerB`-Cases für `bars`, `grid`, `waveform` (Zeile ~5063–5150).

**Schritt A — Gewichtung (klein, sofort):**
Randomizer (`LAYERB_TYPES[Math.floor(R() * LAYERB_TYPES.length)][0]`) zieht aktuell uniform
aus allen 16 Typen. Neue gewichtete Liste: distinktive Typen (helix, lissajous, hexgrid,
constellation, orbits, radialWave, pulseRings, spiral, tunnel, gridwave, rays) 2× Gewicht,
generische Basics (bars, grid, waveform, starfield, spectrumRing) 1× Gewicht.

**Schritt B — visuelle Auffrischung (3 Typen):**
`bars`, `grid`, `waveform` bekommen einen Glow-Kopplungs-Pass (leichtes `shadowBlur` an
Peaks, gekoppelt an `S.beat`) statt starrer harter Kanten — angelehnt an die bestehende
Bloom-Ästhetik der DNA, damit sie nicht wie ein generischer Winamp-Visualizer wirken.
`starfield` und `spectrumRing` bleiben unverändert (funktionieren als ruhige Kontrastoptionen).

**Akzeptanzkriterium:** Zufallsauswahl bevorzugt sichtbar die distinktiven Typen; Bars/Grid/
Waveform haben erkennbar mehr "DNA-Glow"-Anmutung im A/B-Vergleich vorher/nachher.

---

## 3. Font-Bundle erweitern

**Dateien:** neue `assets/fonts/*.woff2`, `<style>`-Block (neue `@font-face`-Regeln),
`TEXT_FONTS`-Map (Zeile ~5825), `<select id="textFont">` (Zeile ~1171), `sw.js` `ASSETS`-Array.

**Auswahl (6 Fonts, offene Lizenzen, self-hosted als woff2):**
| Key | Font | Charakter | Ersetzt/ergänzt |
|-----|------|-----------|------------------|
| `sansAlt` | Space Grotesk | geometrisch, modern | Ergänzung zu Modern Sans |
| `serifAlt` | Fraunces | expressiv, editorial | Ergänzung zu Light Serif |
| `monoAlt` | JetBrains Mono | technisch, sehr lesbar | Ergänzung zu Mono/Tech |
| `condensed` | Archivo Black / Anton | eng, laut, Headline | neu |
| `handwritten` | Caveat | organisch, persönlich | neu |
| `variable` | Bricolage Grotesque | eigenwillig, zeitgemäss | neu |

Alle als `woff2` in `assets/fonts/`, per `@font-face` mit `font-display: swap` eingebunden,
in `sw.js` `ASSETS` ergänzt (bleibt offline-fest, kein CDN-Request). `TEXT_FONTS`-Einträge
analog zum bestehenden Schema (`tw`, `aw`, `fam`, `upper`, `spacing`).

**Akzeptanzkriterium:** Alle 6 neuen Fonts wählbar im Text-Designer, laden auch offline
(Service-Worker-Cache), Datei-Overhead pro Font < 40 KB (nur Latin-Subset).

---

## Umsetzung

- Alle Zielstellen (Bloom-Pass, `drawLayerB`-Cases, `TEXT_FONTS`, `#textFont`-Select) liegen im
  statischen Bereich von `elastic-morph.html` (vor dem `/* @BUILD-INJECT-V58 */`-Marker in
  Zeile 8483) — dieser Bereich wird von `build.js` nicht angefasst (das Skript regeneriert nur
  den Marker-bis-Boot-Block aus `src/inject-v*.js`). Direkte Edits an `elastic-morph.html`,
  **kein** neues `src/inject-v113.js`-Modul, **kein** `build.js`/`APP_VERSION`-Change nötig.
- `sw.js`-Cache-Version wird manuell auf `elastic-morph-v113` gesetzt (Fonts kommen neu in die
  `ASSETS`-Liste).
- Bestehende Tests (`test.js`) laufen lassen — keine der drei Änderungen greift in DOM-Struktur/
  IDs ein, die von Tests referenziert werden (nur neue `<option>`s + neue `@font-face`-Regeln).

## Out of Scope (spätere Runde)
- "Zeitgemässere" Bewegung/Animation des DNA-Organismus selbst
