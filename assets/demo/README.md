# Demo-Track für Launch (Phase 1)

Der Button **„Demo starten“** lädt zuerst eine **echte Audio-Datei** aus diesem Ordner.  
Nur wenn keine Datei da ist, fällt die App auf synthetisches Audio zurück.

## Einrichtung (5 Minuten)

1. **Rechtssicherer Track wählen** — eigenes Werk oder explizit lizenzfrei (kein fremdes Spotify-Release).
2. Datei hier ablegen als **`elastic-morph-demo.mp3`** (alternativ `.wav`).
3. **`demo.json`** anpassen — Titel + Künstler (erscheinen in der App).
4. Optional kürzen: **45–90 Sekunden**, Hook/Drop sichtbar, BPM klar.
5. Test: App öffnen → **Demo starten** → Banner zeigt Titel statt „synthetisches Audio“.

## Empfohlene Track-Eigenschaften

| Kriterium | Warum |
|-----------|--------|
| 45–90 s | Schneller Wow, kleiner Download |
| Deutlicher Beat | Visual reagiert sofort sichtbar |
| Build-up + Drop | Showcase & Reels wirken professionell |
| Stereo, nicht zu leise | Analyse (BPM, Energie) zuverlässiger |

## Dateien

| Datei | Pflicht |
|-------|---------|
| `elastic-morph-demo.mp3` oder `.wav` | Ja (für echten Demo) |
| `demo.json` | Ja (Metadaten) |

## Prüfen

```bash
npm run check:demo
npm run build && npm test
```

Dann im Browser: **Demo starten** — unten Banner: `Demo — «Titel» · Künstler`.
