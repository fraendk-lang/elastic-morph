# Elastic Morph — Launch-Checklist

Stand: **v84** (Phase 1 — echter Demo-Track)

**Phase 1 im Detail:** [`LAUNCH-PHASE-1.md`](LAUNCH-PHASE-1.md) · **Promotion:** [`LAUNCH-PROMOTION.md`](LAUNCH-PROMOTION.md)

---

## Phase 1 — Beweis (jetzt)

### Demo-Track (echt)
- [ ] `assets/demo/elastic-morph-demo.mp3` (oder `.wav`) — **eigenes/lizenzfreies** Werk
- [ ] `assets/demo/demo.json` — Titel + Künstler gesetzt
- [ ] `npm run check:demo` grün
- [ ] **Demo starten** zeigt echten Titel im Banner

### Produkt (5-Minuten-Test)
- [ ] Du: Demo → Look → HQ Export (Chrome/Edge)
- [ ] **Fremder Tester** ohne Erklärung (Script in LAUNCH-PHASE-1.md)
- [ ] HQ Export 1080p + Wasserzeichen (Free-Tier)
- [ ] **9:16** für Reels/Canvas getestet
- [ ] Fullscreen ohne Visual-Bug (v83)

### Inhalte
- [ ] **3–5 Showcase-Clips** (gleicher Demo-Track)
- [ ] **demo-reel.mp4** in Projektroot
- [ ] **og.png** auf Production aktuell

### Technik
- [ ] `npm run build && npm test` grün
- [ ] `npm run test:e2e` grün
- [ ] Demo-Assets im Deploy (`assets/demo/*`)

---

## Phase 2 — Soft Launch (danach)

- [ ] HTTPS auf elasticmorph.app
- [ ] Impressum/Datenschutz (Elastic Universe)
- [ ] Post in 2–3 Producer-Communities (Hook: Spotify Canvas in 10 Min)

---

## Free vs. Pro (v70 — noch ohne Payment)

| Free | Pro (Demo: `?pro=1` oder „Pro testen“) |
|------|----------------------------------------|
| max. 1080p HQ | 4K HQ |
| Wasserzeichen im Export | kein Wasserzeichen |
| alle Looks & Creator Flow | + voller Pro-Modus |

Später: Stripe/Lemon Squeezy an `elasticMorph.pro` koppeln.

---

## Bekannte Limits

- HQ Export: Chrome/Edge empfohlen
- Playwright E2E: Smoke only (kein Export/WebGL in CI)
- Demo-Track: **echte Datei in assets/demo/** — Fallback synthetisch nur für Dev
