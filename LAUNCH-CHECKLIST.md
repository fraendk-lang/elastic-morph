# Elastic Morph — Launch-Checklist

Stand: **v97** (Launch Phase 1 — Dust Reel Demo)

**Phase 1 im Detail:** [`LAUNCH-PHASE-1.md`](LAUNCH-PHASE-1.md) · **Promotion:** [`LAUNCH-PROMOTION.md`](LAUNCH-PROMOTION.md) · **Fremdtest:** [`FREMDTEST.md`](FREMDTEST.md)

---

## Phase 1 — Beweis (jetzt)

### Demo-Track (echt)
- [x] `assets/demo/Elastic Field - Dust Reel.wav` — eigenes Werk (LANDR Master)
- [x] `assets/demo/demo.json` — «Dust Reel» · Elastic Field
- [x] `npm run check:demo` grün
- [x] **Demo starten** zeigt echten Titel im Banner
- [ ] Optional: **Demo-MP3** (~5 MB) für schnelleren Load

### Produkt (5-Minuten-Test)
- [ ] Du: Demo → Look → HQ Export (Chrome/Edge)
- [ ] **Fremder Tester** ohne Erklärung ([`FREMDTEST.md`](FREMDTEST.md))
- [ ] HQ Export 1080p + Wasserzeichen (Free-Tier)
- [ ] **9:16** für Reels/Canvas getestet
- [ ] Fullscreen ohne Visual-Bug (v83)

### Inhalte
- [ ] **3–5 Showcase-Clips** (gleicher Demo-Track)
- [x] **Landing-Reel** — `assets/elasticmorph_elasticfield_dustreel.mp4` (9:16, re-encoded)
- [ ] **og.png** mit echtem Visual-Frame (Social Preview)

### Technik
- [x] `npm run build && npm test` grün (106 Tests)
- [ ] `npm run test:e2e` grün
- [x] Demo-Assets im Deploy (`assets/demo/*`)
- [x] Service Worker Cache v97

---

## Phase 2 — Soft Launch

- [x] HTTPS auf [elasticmorph.app](https://elasticmorph.app)
- [x] Impressum/Datenschutz auf Morph + Universe
- [x] Elastic Morph auf Universe (`/tools/morph`, v97 sync)
- [x] Elastic Lab-Link auf Universe repariert
- [ ] Post in 2–3 Producer-Communities (Hook: Spotify Canvas in 10 Min)
- [ ] **Fremdtest** bestanden

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

- HQ Export: Chrome/Edge empfohlen; Browser-MP4 oft **fragmentiert** → vor Social ffmpeg re-encode ([`REEL-EXPORT.md`](REEL-EXPORT.md))
- Playwright E2E: Smoke only (kein Export/WebGL in CI)
- Demo-Track WAV ~49 MB — Fallback synthetisch nur wenn Datei fehlt
- Universe `/tools/morph`: Demo-Audio lädt von `elasticmorph.app` wenn lokal nicht gebündelt (WAV zu groß für Embed)
