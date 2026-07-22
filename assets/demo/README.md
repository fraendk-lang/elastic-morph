# Demo-Track für Launch (Phase 1)

Der Button **„Demo starten“** lädt zuerst eine **echte Audio-Datei** aus diesem Ordner.  
Nur wenn keine Datei da ist, fällt die App auf synthetisches Audio zurück.

## Aktueller Track

| Datei | Größe | Rolle |
|-------|-------|--------|
| `Elastic Field - Dust Reel.mp3` | ~4 MB | **Primär** — schneller Load |
| `Elastic Field - Dust Reel.wav` | ~49 MB | Fallback / Master |
| `demo.json` | — | Metadaten «Dust Reel» · Elastic Field |

MP3 neu erzeugen aus WAV:

```bash
npm run encode:demo
```

## Prüfen

```bash
npm run check:demo
npm run build && npm test
npm run test:e2e
```

Im Browser: **Demo starten** — Banner: `Demo — «Dust Reel» · Elastic Field`.
