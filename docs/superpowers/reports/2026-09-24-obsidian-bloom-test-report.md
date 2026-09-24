# Obsidian Bloom — Umsetzungs- und Testbericht

Branch `feature/obsidian-bloom` (von `main` @ `7620469`). Nicht gemergt, nicht gepusht, Produktion unverändert.
Spec: `docs/superpowers/specs/2026-09-24-obsidian-bloom-design.md`. Pläne: `docs/superpowers/plans/2026-09-24-obsidian-*.md`.

## 1. Was gebaut wurde

| Stufe | Inhalt |
|---|---|
| A | Label „SDF Blob (Raymarch)“ → „Triangular Light Grid“ (Schlüssel `raymarch` unverändert) |
| B | Audio-/Zeitvertrag `src/inject-v113.js`: 60-Hz-Timeline (6 Bänder, Kick/Snare, Follower), Sampler per absoluter Songzeit, Live-Adapter, Export-Hook `S._hqT` |
| C | „Obsidian Bloom“ (`engine: "sculpture"`, `src/inject-v114.js`): eigener WebGL-Kontext, begrenzter SDF-Raymarcher, Preset (Ambient-Bank), Qualitätsstufen Auto/Hoch/Mittel/Niedrig, No-GPU-Fallback + Badge, Kartenvorschau, Szenen-Kompatibilität |
| C2 | Komposition (`uGrow`) zustandslos aus absoluter Progress; Context-Loss-Handler und Idle-Release gehärtet |
| C3 | Snare-Signatur sichtbar gemacht (Ripple-Burst + Rim-Lift) |
| — | App-Version 114 (Service-Worker-Cache) |

Look: opake, graphitfarbene, polierte Skulptur; warme Key-Softbox, kühler Rim-Strip, AO/Softshadow, Filmic-Tonemap + Gamma genau einmal im Shader; keine Bloom-/Feedback-/Screen-Add-Kette; dunkler, ruhiger Hintergrund (`bgFade 0.9`, `bloom 0`, keine Partikel). Silhouette: 4 weich vereinigte Lappen + 5 Blütenrippen, Parameter aus `S.fpHash`.

## 2. Abgleich der Befunde (gegen den Code geprüft)

Alle Befunde aus dem Auftrag bestätigt (Canvas2D + separater WebGL-Canvas; `raymarch` = Dreiecksgitter mit passendem Test; Glass Animal = 2D-Gradienten; Export-Timeline nur bass/mids/highs mit anderen Bandgrenzen, Onsets/Bänder im Export nicht neu gesetzt; `Math.random` in Flame/Attractor). Zusätzlich gefunden: `S.time` ist im Export nicht absolute Songzeit (`EXP.time` startet bei 0 und wächst mit `0.5 + loudness`), `S.seed` ist pro Start zufällig (Identität deshalb aus `S.fpHash`), `drawScene`-Wrapper legen nur Overlays darüber.

## 3. Tests

**Automatisiert:** `npm run ci` → **933 bestanden, 0 fehlgeschlagen** (inkl. Verhaltenstests für Timeline, Sampler, Live-Adapter, Seed, Qualität, Render-Größe, Tint, stateless Growth). Fünf unabhängige Reviews (A selbst geprüft; B, C: Approved, keine Critical/Important).
**E2E (`npm run test:e2e`, Playwright/Chromium headless):** 3 von 3 bestanden (Landingpage lädt, App-Shell + Creator-Dock, Welcome/Canvas sichtbar). Der Smoke-Test prüft nur die Oberfläche und deckt Obsidian Bloom nicht ab.

**Live im App-Build (Chromium, Claude-Browser-Pane, Apple M2 / ANGLE-Metal):**

- **Reproduzierbarkeit** (Pixel-Hash des GL-Renderziels, gleiche Größe/Qualität): t = 60 s identisch bei Gesamtexport (30 fps), Bereichsexport ab 60 s, Gesamtexport bei 60 fps und nach zuvor gerenderten anderen Zeiten. t = 61,5 s: Bereichs- und Gesamtexport identisch. Andere Zeiten → andere Bilder. Gleicher Track + gleiche Zeit → gleicher Hash; Kick 1 → 0 kehrt exakt zum Basisbild zurück.
- **Identität:** drei verschiedene Fingerabdrücke → 12,6–14,6 % abweichende Pixel, Körperabdeckung 12,9–16,6 % (eigene Silhouetten, gleiche Formfamilie). *Hinweis:* drei Fingerabdrücke auf einem echten Demo-Track, nicht drei Audiodateien.
- **Stille:** Körper bleibt sichtbar und ruhig (Abdeckung 14,5 %; 5,7 % Abweichung zum aktiven Bild).
- **Bandwirkung** (Anteil geänderter Pixel gegenüber Basisbild): Bass 7,3 %, Kick 3,9 % (lokaler Bump), Snare 5,3 % (nach C3; vorher 0 %), Mitten 2,9 %, Höhen 0,9 %.
- **Echter HQ-Export:** 3 s Bereich ab 60 s, 1080p/30 fps, mit Ton → MP4 1920×1080, 3,088 s, 544 KB, Video und Audio dekodierbar/abspielbar, Frame bei 1,5 s: dunkle Fläche 89 %, keine ausgebrannten Pixel. Wanduhr: 60 s für 3 s Material.
- **Lebenszyklus:** Preset-Wechsel weg → GPU-Kontext nach ~5 s freigegeben; zurück → neu initialisiert; „DNA aus“ gibt frei; No-GPU-Fallback zeigt Badge und blendet es wieder aus; künstlicher Context-Loss (`WEBGL_lose_context`) erholt sich in ~84 ms; alle 58 Presets fehlerfrei durchgeschaltet; Szene speichern/laden behält das Preset; Blend behält die Engine; Vorschaukarten rendern ohne Fehler; keine Konsolenfehler.

## 4. Leistung (nur, was gemessen werden konnte)

Umgebung: Apple M2 (ANGLE Metal) im Claude-Browser-Pane, GL-Zeit inkl. `readPixels`-Sync, App parallel aktiv.

| Fall | Zeit pro Bild |
|---|---|
| 1080p-Vorschau „Hoch“ (rendert 1280×720) | ≈ 20 ms |
| „Mittel“ (960×540) | ≈ 13 ms |
| „Niedrig“ (640×360) | ≈ 7 ms |
| Hochformat 1080×1920 „Hoch“ (720×1280) | ≈ 24 ms |
| Export 1080p (Vollauflösung) | ≈ 43 ms |
| Export 4K (3840×2160) | ≈ 107 ms |

**Nicht messbar in dieser Sitzung:** die Gesamt-FPS der App (die Seite war im Test-Browser als `hidden` markiert, `requestAnimationFrame` auf ≈ 1 Hz gedrosselt — auch für andere Presets). Das 30-fps-Ziel für die 1080p-Vorschau ist deshalb **nicht bestätigt**; die GL-Zeiten sind die belastbare Größe. Referenzgerät und schwächere Hardware sind offen.

## 5. Bekannte Grenzen / offen

- Kein 4K-MP4 erzeugt (nur GL-Zeit gemessen), keine A/V-Sync-Messung über die Dauerprüfung hinaus, Safari/andere GPUs ungetestet.
- Vorher-Aufnahmen der Alt-Looks (Glass Animal, Hyperspace, Flame, Reaction) wurden nicht erstellt — nur die Anleitung liegt in Plan A.
- Kartenvorschau ist ein seeded 2D-Stand-in, nicht die echte GPU-Silhouette.
- Mikrofon/Tab-Audio: eigener Live-Adapter, bewusst nicht reproduzierbar. Beim Start der Wiedergabe kann es in der Vorschau einen einmaligen kleinen Sprung geben, wenn von Live-Adapter auf fertige Timeline gewechselt wird.
- Das DNA-Blend-Dropdown gilt für Obsidian Bloom bewusst nicht (opaker Körper, `source-over`).
- Das Qualitäts-Dropdown ist für alle DNAs sichtbar, wirkt aber nur auf Obsidian Bloom.
- Alt-Renderer im Export: Bänder/Onsets bleiben Live-Reste — dokumentierte Folgearbeit, nicht Teil dieser Stufe. Flame/Attractor nutzen weiterhin `Math.random`; Reaction koppelt Simulationsqualität an Schrittzahl.
- README nennt noch v94; nicht angepasst.
- „Weniger Flackern“ ist nur statisch getestet (Dämpfung 35 %).

## 6. Mögliche Ausbaustufen

GPU-Kartenvorschau mit echtem Rendering; Rauchglas mit Brechung/Absorption; Hyperspace als GPU-Partikel; Reaction-Diffusion mit fester Simulation als beleuchtete Fläche; Baking der 6 Bänder/Onsets in den Alt-Export-Pfad.
