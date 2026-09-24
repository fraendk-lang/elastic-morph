# Obsidian Bloom — neue räumliche Visual DNA (Design)

Branch: `feature/obsidian-bloom` (kein Merge, kein Push nach `main` ohne separate Freigabe).
Ausgangsstand: `main` @ `7620469`. Auftrag: Frank, 2026-09-24 (externe Code-Analyse).

## Verifizierte Befunde (gegen aktuellen Code geprüft)

- Haupt-Canvas = Canvas 2D; Shader-Engine = eigener WebGL-Kontext (`initGL`/`renderShader`), per `drawImage` komponiert.
- `raymarch` (Label „SDF Blob (Raymarch)“) ist im GLSL (`raymarchStyle`) ein 2D-Dreiecksgitter; `test.js` prüft genau das.
- `glass: true` (Glass Animal) = 2D-Gradienten + Kontur, keine Glasoptik.
- Export: `buildFeatureTimeline` liefert nur bass/mids/highs/loud/stereo mit Grenzen 250/2000/12000 Hz; live 20–160/160–2500/2500–12000 Hz plus 6 Bänder und Kick-/Snare-Onsets. `renderExportFrame` setzt Bänder/Onsets nicht → Live-Reste.
- `S.time` ist im Export nicht absolute Songzeit (`EXP.time` startet bei 0, wächst mit `0.5 + loudness`). `S.seed` ist pro Start `Math.random()`; Identität muss aus `S.fpHash` kommen.
- `drawScene`-Wrapper (v-Module) legen nur Overlays darüber; ein Engine-Zweig im Basis-`drawScene` wird ausgeführt.
- `buildFeatureTimeline`, `renderExportFrame`, `drawScene`-Basis liegen vor dem Build-Marker (direkt editierbar).

## Entscheidungen

1. **Renderer:** eigener WebGL-Kontext/Programm für Engine-ID `sculpture` (kein Three.js). Ergebnis wird im DNA-Zweig von `drawScene` mit Identitäts-Transform über den 2D-Canvas gelegt (keine doppelte Kamera). Kamera im Shader. Preset: hohes `bgFade`, `bloom` ≈ 0, keine Preset-Partikel.
2. **Audio/Zeit-Vertrag:** Für geladene Dateien wird einmalig eine Timeline auf festem 60-Hz-Raster berechnet: 6 Bänder (dB-gemappt wie der Web-Audio-Analyser, −100…−30 dB → 0…1, ohne dessen Zeitglättung), Kick-/Snare-Onsets mit den Live-Regeln (Schwelle 0.04, ×8, Abfall 0.88/Schritt, Glättung 0.7) und gebackene Envelope-Follower (`form`/`surf`/`gloss`/`loud`). Der Renderer ist zustandslos und liest per absoluter Songzeit (Interpolation). Live-Datei, HQ-Export, Bereichsexport, Seek und 30/60 fps zeigen damit dasselbe Bild. Mikrofon/Tab-Audio: eigener Live-Adapter (nicht reproduzierbar, bewusst). Alte Renderer und deren Feed bleiben unverändert.
3. **Benennung:** Label „Triangular Light Grid“ statt „SDF Blob (Raymarch)“; Schlüssel `raymarch` bleibt.
4. **Material (erste Stufe):** opaker graphitfarbener Körper, warmes Hauptlicht, kühles Kantenlicht, Normalen, diffus/spekular, sparsame Schatten/AO. Kein Glas.

## Stufen (je eigener Plan)

- **A** Benennung + Vorher-Aufnahmen-Anleitung — `docs/superpowers/plans/2026-09-24-obsidian-A-shader-label.md`
- **B** Timeline-/Audio-/Zeitvertrag (`src/inject-v113.js`, Export-Hook) — `…-obsidian-B-audio-time-contract.md`
- **C** Renderer + Preset + Vorschau + Szenen + Qualitätsstufen + Fallback
- **D** Reproduzierbarkeits-/Export-/Performance-Tests und Testbericht

## Grenzen

Perf-/4K-/Referenzgerät-Messungen und echte MP4-Abnahme brauchen Franks Hardware; im Test-Browser wird nur gemessen, was dort messbar ist (mit Angabe der Umgebung).
