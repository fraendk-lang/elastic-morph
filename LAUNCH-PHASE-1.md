# Launch Phase 1 — Beweis & Demo-Track

Stand: **v97** · Ziel: Launch-tauglicher **Wow-Moment** mit **echtem Demo-Song**

---

## Übersicht Phase 1

| # | Aufgabe | Status |
|---|---------|--------|
| 1 | **Echter Demo-Track** einbinden | ✅ Dust Reel (WAV + demo.json) |
| 2 | **Du** — 5-Minuten-Durchlauf | ⬜ |
| 3 | **Fremdtester** (1 Person, ohne Erklärung) | ⬜ → [`FREMDTEST.md`](FREMDTEST.md) |
| 4 | **3 Showcase-Clips** exportieren | ⬜ |
| 5 | **Landing-Reel** | ✅ `assets/elasticmorph_elasticfield_dustreel.mp4` |
| 6 | Technik-Check (Build, Unit-Tests) | ✅ 106 Tests · `check:demo` grün |
| 7 | E2E Smoke | ⬜ `npm run test:e2e` |

---

## Schritt 1 — Echten Demo-Song (erledigt)

### Dateien

```
assets/demo/
  Elastic Field - Dust Reel.wav   ← vollständiger Track (~49 MB)
  demo.json                       ← «Dust Reel» · Elastic Field
  README.md
```

### Prüfen

```bash
npm run check:demo    # ✓ Audio + Metadaten
npm run build && npm test
```

Im Browser: **Demo starten** → Banner zeigt `Demo — «Dust Reel» · Elastic Field`.

**Optional:** MP3-Version für schnelleren ersten Load (Paket B).

---

## Schritt 2 — Dein 5-Minuten-Test (selbst)

Chrome oder Edge, Hard Refresh (Cmd+Shift+R). Link: [elasticmorph.app](https://elasticmorph.app)

| Minute | Aktion | Erfolg wenn … |
|--------|--------|----------------|
| 0:00 | App öffnen → **Demo starten** | Track hörbar, Visual reagiert |
| 0:30 | Look wechseln (Swipe oder Visual DNA) | Kein Whiteout, DNA erkennbar |
| 1:00 | **Creator Cuts** → 16:9 → **HQ Export** (kurz 10 s reichen) | MP4 im Download |
| 2:00 | Format **9:16** → Export-Test | Vertikal OK |
| 3:00 | **Fullscreen** (F) | Kein Split/Whiteout |
| 4:00 | Eigenen MP3 laden | Analyse + Visual OK |

Notizen: Wo stockst **du** noch?

---

## Schritt 3 — Fremdtest (1 Person)

**Profil:** Musiker/produzierende Person, **kein** Entwickler, noch nie Elastic Morph gesehen.

Link: [https://elasticmorph.app](https://elasticmorph.app)

Vollständiges Script: [`FREMDTEST.md`](FREMDTEST.md)

### Erfolgskriterium Phase 1

- Tester exportiert **irgendein** MP4 in **unter 10 Minuten**
- Oder: klares Feedback **wo** UI scheitert (dann fixen)

---

## Schritt 4 — Showcase-Clips (3–5 Stück)

Mit **Dust Reel** — konsistente Marke.

| # | Look (Preset) | Format | Länge | Verwendung |
|---|---------------|--------|-------|------------|
| 1 | **Liquid Memory** | 9:16 | 15–30 s | Reels / TikTok |
| 2 | **Signal Creature** oder **Hyperspace** | 16:9 | 20–40 s | YouTube / Website |
| 3 | **Vinyl** oder **Black Bloom** | 1:1 | 8 s Loop | Spotify Canvas |
| 4 | optional | 16:9 | 30 s | Social / Website |
| 5 | optional | 9:16 | 15 s | Teaser |

**Export:** Chrome, HQ Export. Vor Upload: ffmpeg re-encode wenn Browser-MP4 nicht abspielt ([`REEL-EXPORT.md`](REEL-EXPORT.md)).

---

## Schritt 5 — Landing-Reel (erledigt)

- Datei: `assets/elasticmorph_elasticfield_dustreel.mp4` (H.264/AAC, faststart, 9:16)
- Landing `index.html` spielt Reel in 9:16-Container

---

## Schritt 6 — Technik-Check

```bash
npm run build && npm test          # 106 Tests grün
npm run test:e2e                   # Playwright Smoke
npm run check:demo                 # Demo-Track vorhanden
```

- [x] Service Worker Cache = v97 (`sw.js`)
- [x] `assets/demo/` mit deployen
- [x] Universe `/tools/morph` auf v97 sync

---

## Nach Phase 1

| Ergebnis | Nächster Schritt |
|----------|------------------|
| Fremdtest + Clips OK | **Soft Launch:** Communities, og.png, Showcase |
| Tester scheitert an Schritt X | UX-Fix, erneut 1 Tester |
| Export scheitert Safari | Hinweis in UI/Landing schärfen |

---

*Phase 1 = Beweis, dass Fremde begeistert werden können — nicht Feature-Entwicklung.*
