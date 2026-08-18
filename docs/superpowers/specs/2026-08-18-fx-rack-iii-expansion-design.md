# Elastic Morph — FX Rack III Expansion (Cinematic, 4 → 10 Effekte + Alt+1–0)

## Kontext

Zweites Teilprojekt aus der Brainstorm-Runde nach der Blend-Mode-Erweiterung. FX Rack III
("Cinematic") hat aktuell nur 4 von 10 möglichen Effekten und — anders als Rack I (plain 1–0)
und Rack II (Ctrl+1–0) — **kein Tastenkürzel**, nur Maus/Klick in der UI.

**Wichtiger Architektur-Befund:** `FX3_DEFS`, `applyPostFX3` und `buildFX3` liegen — anders als
Racks I/II — **im generierten Build-Bereich** von `elastic-morph.html` (nach dem
`/* @BUILD-INJECT-V58 */`-Marker, aktuell Zeile 8579). Source of truth ist `src/inject-v58.js`.
Diese Spec betrifft also `src/inject-v58.js` + `node build.js` danach, nicht direkte
HTML-Edits wie bei der Blend-Mode-Arbeit. `S.fx3`-Defaults (Zeile 2398) und der Keydown-Handler
für Zahlentasten liegen weiterhin im statischen Bereich von `elastic-morph.html`.

## Ziel

FX Rack III von 4 auf 10 Effekte auffüllen, alle 10 auf Alt+1–0 spielbar machen (analog zu
Rack I `1–0` und Rack II `Ctrl+1–0`).

## Bestehende Effekte (bleiben unverändert)

`lensflare` (Lens Flare), `lightleak` (Light Leak), `scanlines` (Scanlines), `motionblur`
(Motion Blur) — je in `src/inject-v58.js`, `function applyPostFX3`.

## Neue Effekte (6)

Alle im gleichen "billiger Canvas-Trick"-Stil wie die bestehenden 4 — Gradient/Composite-Draws,
audio-reaktiv über `S.beat`/`S.transient`/`S.loudness`/`S.mids`/`S.highs`/`S.stereo` (bereits
glatt abklingende Werte, kein eigener Decay-State nötig, siehe `fx.strobe` als Referenzmuster:
`if (Math.max(S.beat, S.transient) > 0.55) { ... }`).

| Key | Label | Beschreibung | Blend | Trigger |
|---|---|---|---|---|
| `anamorphflare` | Anamorphic Flare | horizontaler Streak-Gradient durch die Bildmitte (Ellipse statt rund wie Lens Flare) | `screen` | `S.beat > 0.5` |
| `letterbox` | Letterbox Reveal | schwarze Cinemascope-Balken oben/unten, Höhe direkt aus `S.beat`/`S.loudness` abgeleitet | `source-over` | kontinuierlich, Höhe moduliert |
| `doubleexposure` | Double Exposure | Geister-Kopie des Frames, fester diagonaler Versatz (nicht bewegungsrichtungs-basiert wie Motion Blur), Deckkraft an `S.loudness` | `screen` | kontinuierlich, Deckkraft moduliert |
| `dustscratches` | Dust & Scratches | zufällige Filmkorn-Specks (Math.random-Positionen pro Frame) + 1–2 langsam driftende vertikale Kratzer | `source-over`, niedrige Alpha | kontinuierlich, Flicker-Boost bei `S.transient` |
| `chromafringe` | Chromatic Edge Fringe | Rot-/Blau-Kanal-Versatz **nur im Rahmenbereich** via `ctx.clip()` (Außenrand minus Innenrechteck) — klar anders als RGB Split (Rack I), das den ganzen Frame versetzt | `screen` innerhalb der Clip-Maske | `S.transient > 0.2` |
| `bleachpulse` | Bleach Bypass Pulse | kurzer Kontrast/Entsättigungs-Stoß auf Beat, gleiches Schwellenwert-Muster wie Strobe | `hard-light` oder `overlay` | `Math.max(S.beat, S.transient) > 0.55` |

Keine Überschneidung mit bestehenden Features geprüft: Grain/Vignette/Grade laufen bereits
separat über "Master Finish" (`S.master`, Zeile ~8603) — die 6 neuen Effekte fügen dem nichts
Redundantes hinzu.

## Tastenkürzel

Alt+1–0, gleiche Konvention wie Rack I/II: Array-Reihenfolge in `FX3_DEFS` = Tasten-Reihenfolge.
Bestehende 4 zuerst (kein Muscle-Memory-Konflikt, da sie aktuell kein Kürzel haben), dann die 6
neuen in der Tabellen-Reihenfolge oben:

`1`=lensflare, `2`=lightleak, `3`=scanlines, `4`=motionblur, `5`=anamorphflare, `6`=letterbox,
`7`=doubleexposure, `8`=dustscratches, `9`=chromafringe, `0`=bleachpulse

Cmd/Meta bleibt bewusst ausgeschlossen (bestehende `!e.metaKey`-Guards, Browser-Tab-Kollision
plattformübergreifend) — Ctrl ist durch Rack II belegt, Alt ist frei (siehe Code-Exploration:
kein `e.altKey` wird aktuell irgendwo abgefragt).

## Betroffene Stellen

- `src/inject-v58.js`: `FX3_DEFS`-Array um 6 Einträge erweitern (`.push(...)`, `const` bleibt
  unangetastet, nur mutiert), `applyPostFX3` um 6 neue `if (f3.xxx)`-Blöcke erweitern
- `elastic-morph.html:2398`: `S.fx3`-Default-Objekt um 6 neue Keys erweitern (`false`)
- Keydown-Handler (aktuell ~Zeile 7776, statischer Bereich): neuer `else if (e.altKey)`-Zweig
  analog zum bestehenden `if (e.ctrlKey)`-Zweig für Rack II
- `node build.js` nach dem `src/inject-v58.js`-Edit ausführen, um `elastic-morph.html` neu zu
  generieren
- `test.js`: `"FX3_DEFS has 4 effects"` → `10`; neue Assertion nach dem Vorbild der
  bestehenden `fx2StateKeys`/`fx2DefKeys`-Cross-Check (Zeile 54–56), analog für `fx3`

## Out of Scope

- Keine "big tile" Live-Performance-Ansicht für Rack III (Rack I hat das, Rack II/III nicht —
  bleibt konsistent zum bestehenden Muster, kein UI-Umbau)
- Kein Umbau von Grain/Vignette/Master Finish

## Testing

- `node build.js && node test.js` — 100% grün
- Manueller Check (`npm start`, live): jeden der 6 neuen Effekte einzeln per Alt+5–0 auslösen,
  bestätigen dass er visuell erkennbar und klar von seinen "Geschwister-Effekten" (Lens Flare
  vs. Anamorphic Flare, Motion Blur vs. Double Exposure, RGB Split vs. Chromatic Edge Fringe)
  unterscheidbar ist. Alt+1–4 gegen die bestehenden 4 Effekte prüfen (funktionieren jetzt auch
  per Tastatur, nicht nur Maus).
