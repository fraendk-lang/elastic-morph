# Elastic Morph

**Aus deinem Track wird ein einzigartiges Visual** — die Form entsteht aus dem Fingerabdruck des Songs. Im Browser, ohne Vorkenntnisse, exportierbar bis 4K.

Teil von **[Elastic Universe](https://elasticuniverse.app)** — Visual Computing Ecosystem.

**Live:** [elasticmorph.app](https://elasticmorph.app) (nach Vercel-Deploy)

---

## Was es kann

- **Visual DNA** — deterministische Form aus dem Song-Fingerabdruck (Blob, Filament, Attractor, Flame, …)
- **Shader & FX** — WebGL-Shader + drei audioreaktive FX-Racks
- **Creator Mode** — Track → Look → Export (Standard), iPad-optimiert, **Demo-Track ohne Upload**
- **Image Layer A/B** — 13 Modi, Blend Modes, Beat-Sync, Creative Filter
- **Timeline & Set Editor** — Wellenform, Cues, deterministischer Export
- **HQ-Export** — frame-genau via WebCodecs (Chrome/Edge); Safari-Fallback auf Echtzeit
- **PWA** — installierbar, offline-fähig

---

## Schnellstart (Creator)

1. App öffnen → **Demo starten** (Dust Reel · Elastic Field)
2. Showcase-Look lädt automatisch (Club Strobe + Laser)
3. **HQ Export** — MP4 landet im Download-Ordner

**Lokal:** `npm start` → http://localhost:3456/elastic-morph.html (Demo-Track braucht HTTP, nicht `file://`).

**Ausführliche Anleitung:** [`ANLEITUNG.md`](ANLEITUNG.md)

Launch: [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md) · [`LAUNCH-PHASE-1.md`](LAUNCH-PHASE-1.md)

---

## Entwicklung

```bash
npm install
npm run build        # src/inject-*.js → elastic-morph.html
npm test             # Regressionstests (statisch + Unit)
npm run check:demo   # Demo-Track in assets/demo/
npm run ci           # Build + Test (CI / Vercel)
npm start            # Lokaler Server :3456
npm run test:e2e     # Playwright Smoke (optional)
```

- **HQ-Export:** Chrome/Edge empfohlen
- **Pro testen:** `?pro=1` oder „Pro testen“ im Creator-Dock

---

## Projektstruktur

| Datei | Zweck |
|---|---|
| `elastic-morph.html` | Die App (Single-File, nach `npm run build`) |
| `index.html` | Landingpage |
| `build.js` | Merged `src/inject-v58.js` … `inject-v93.js` |
| `src/inject-v*.js` | Feature-Module |
| `assets/demo/` | Demo-Track + `demo.json` |
| `test.js` | Statische Checks + Unit-Tests |
| `vercel.json` | Vercel Static Deploy (build + test) |
| `.github/workflows/ci.yml` | GitHub CI |

---

## Version

Aktuell **v94** — Demo-Track (Dust Reel), Showcase-Look, Club-Beat, Vercel-Deploy-Ready.

Free-Tier: max. 1080p + Wasserzeichen. Pro (Demo): `localStorage` / `?pro=1`.

---

© Elastic Universe. Alle Rechte vorbehalten.
