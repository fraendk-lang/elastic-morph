# Launch Phase 1 — Beweis & Demo-Track

Stand: **v84** · Ziel: Launch-tauglicher **Wow-Moment** mit **echtem Demo-Song**

---

## Übersicht Phase 1

| # | Aufgabe | Status |
|---|---------|--------|
| 1 | **Echter Demo-Track** einbinden | ⬜ Datei ablegen (siehe unten) |
| 2 | **Du** — 5-Minuten-Durchlauf | ⬜ |
| 3 | **Fremdtester** (1 Person, ohne Erklärung) | ⬜ |
| 4 | **3 Showcase-Clips** exportieren | ⬜ |
| 5 | **`demo-reel.mp4`** für Landing | ⬜ |
| 6 | Technik-Check (Build, E2E) | ⬜ |

---

## Schritt 1 — Echten Demo-Song einrichten (PRIORITÄT)

### Dateien

```
assets/demo/
  elastic-morph-demo.mp3   ← dein Track (45–90 s)
  demo.json                ← Titel + Künstler
  README.md
```

### demo.json anpassen

```json
{
  "title": "Dein Songtitel",
  "artist": "Frank Krumsdorf",
  "files": ["elastic-morph-demo.mp3"]
}
```

### Track-Auswahl

- **Eigenes Werk** (ideal) oder explizit **lizenzfrei**
- **45–90 Sekunden** — Hook, Beat, optional Drop
- Genres mit klarer Dynamik: Electronic, Trip-Hop, Ambient mit Punch, Deep House …
- **Nicht:** reines Piano ohne Percussion (Visual wirkt „tot“)

### Prüfen

```bash
npm run check:demo    # Audio + Metadaten OK?
npm run build && npm test
```

Im Browser: **Demo starten** → Banner zeigt `Demo — «Titel» · Künstler` (nicht „synthetisches Audio“).

---

## Schritt 2 — Dein 5-Minuten-Test (selbst)

Chrome oder Edge, Hard Refresh (Cmd+Shift+R).

| Minute | Aktion | Erfolg wenn … |
|--------|--------|----------------|
| 0:00 | App öffnen → **Demo starten** | Track hörbar, Visual reagiert |
| 0:30 | Look wechseln (Swipe oder Visual DNA) | Kein Whiteout, DNA erkennbar |
| 1:00 | **Creator Cuts** → 16:9 → **HQ Export** (kurz 10 s reichen zum Test) | MP4 im Download |
| 2:00 | Format **9:16** → Export-Test | Vertikal OK |
| 3:00 | **Fullscreen** (F) | Kein Split/Whiteout (v83) |
| 4:00 | Eigenen MP3 laden | Analyse + Visual OK |

Notizen: Wo stockst **du** noch?

---

## Schritt 3 — Fremdtest (1 Person)

**Profil:** Musiker/produzierende Person, **kein** Entwickler, noch nie Elastic Morph gesehen.

### Script (Wortlaut an Tester)

> „Mach bitte aus diesem Song ein Visual für Instagram/Spotify — ohne meine Hilfe.  
> Du darfst die App öffnen und alles ausprobieren, aber ich erkläre nichts.“

Link: `elastic-morph.html` (oder später elasticmorph.app)

### Beobachten (still mitnotieren)

1. Findet **Demo starten** allein?
2. Versteht **Look → Export**?
3. Wo bricht ab? (Schritt 1 / 2 / 3)
4. Gesichtsausdruck beim ersten Visual — **Wow** oder **hä**?
5. Export-Klick — findet HQ Export?

### Erfolgskriterium Phase 1

- Tester exportiert **irgendein** MP4 in **unter 10 Minuten**
- Oder: klares Feedback **wo** UI scheitert (dann fixen, nicht launchen)

---

## Schritt 4 — Showcase-Clips (3–5 Stück)

Mit **demselben Demo-Track** — konsistente Marke.

| # | Look (Preset) | Format | Länge | Verwendung |
|---|---------------|--------|-------|------------|
| 1 | **Liquid Memory** | 9:16 | 15–30 s | Reels / TikTok |
| 2 | **Signal Creature** oder **Hyperspace** | 16:9 | 20–40 s | YouTube / Website |
| 3 | **Vinyl** oder **Black Bloom** | 1:1 | 8 s Loop | Spotify Canvas |
| 4 | optional | 16:9 | 30 s | Landing `demo-reel.mp4` |
| 5 | optional | 9:16 | 15 s | Social Teaser |

**Export:** Chrome, HQ Export, Free-Tier (1080p + Wasserzeichen ist OK für Teaser).

**Caption-Idee:** „Made with Elastic Morph — Visual from my track's DNA“

---

## Schritt 5 — demo-reel.mp4 (Landing)

1. Bester 16:9-Clip aus Schritt 4 wählen
2. Als **`demo-reel.mp4`** in Projektroot legen
3. Landing `index.html` zeigt Video automatisch (`.reel-wrap.has-video`)

Optional: 5-Sek-Hook + 20-Sek-Highlight schneiden (iMovie, DaVinci, CapCut).

---

## Schritt 6 — Technik-Check

```bash
npm run build && npm test          # 89+ Tests grün
npm run test:e2e                   # Playwright Smoke
npm run check:demo                 # Demo-Track vorhanden
```

- [ ] Service Worker Cache = v84 (`sw.js`)
- [ ] `assets/demo/` mit deployen (MP3 nicht vergessen!)

---

## Nach Phase 1

| Ergebnis | Nächster Schritt |
|----------|------------------|
| Fremdtest + Clips OK | **Phase 2:** Deploy elasticmorph.app, Soft Launch |
| Tester scheitert an Schritt X | UX-Fix, erneut 1 Tester |
| Export scheitert Safari | Hinweis in UI/Landing schärfen |

---

## Quick-Referenz Demo-Track

| Problem | Lösung |
|---------|--------|
| Banner „synthetisches Audio“ | `assets/demo/elastic-morph-demo.mp3` fehlt |
| Metadaten Platzhalter | `demo.json` Titel/Künstler setzen |
| Datei zu groß | Auf 60–90 s kürzen, MP3 192–256 kbps |
| Visual reagiert schwach | Track mit mehr Bass/Beat wählen |

---

*Phase 1 = Beweis, dass Fremde begeistert werden können — nicht Feature-Entwicklung.*
