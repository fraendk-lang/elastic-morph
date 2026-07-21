# Elastic Morph — offene Blindspots (Stand nach Phase D / v66)

Phase A–D sind **erledigt**. Unten: verbleibende Test-Lücken und optionale Follow-ups.

---

## Erledigt (Phase A–D)

### Phase A (v63)
- Upload MIME-Fallback, HQ Realtime-Fallback, Creator Export Mic/HQ, 9:16 Dock

### Phase B (v64)
- Shader-Zeit, Export-Gate, Analyse-Fehler, Stereo-Export, Heavy-Preset-Warnung, Batch-Hinweis

### Phase C (v65)
- Swipe Top3/Alle, Auto-Look optional, DE-Hilfe + Touch, Pro-Portrait-Sheet, Demo-Banner, Look-Lock, Dock-Label

### Phase D (v66)
- [x] CI: `.github/workflows/ci.yml` — `node build.js && node test.js`
- [x] Version-Sync: `package.json` v66, `build.js` → `sw.js` Cache v66, README
- [x] Semantische Nav (`<button>`), Focus-Trap in Modals (Help, Welcome, Portrait, Set Editor)
- [x] Photosensitivität im Creator (`creatorReduceFlash`)
- [x] `lang="de"` + deutsche Nav-Hinweise
- [x] WebGL-Status-Badge bei Shader-Ausfall
- [x] `src/inject-v66.js` — Foundation-Modul

---

## Tests — noch offen (optional)

- [ ] Export-Pipeline Integration (WebCodecs, Muxer, MediaRecorder)
- [ ] Touch/Swipe E2E (Playwright)
- [ ] Determinismus Live ↔ HQ (Particles/Random)

---

## Optionale Follow-ups

- [ ] Preset-Cards / FX-Chips als `<button>` (weitere a11y)
- [ ] Vollständiges i18n EN|DE Toggle
- [ ] Weitere Monolith-Auslagerung nach `src/`

---

*Zuletzt aktualisiert: Launch-Paket v70 (Onboarding, Freemium-Prep, E2E Smoke)*

---

## Launch (v69/v70) — erledigt

- [x] Demo-Track ohne Upload (`generateDemoTrackBuffer`)
- [x] 3-Schritte-Onboarding + Export-Erfolgs-Dialog
- [x] Default-Look „Liquid Memory“ für Demo/Erststart
- [x] Free-Tier: 1080p + Wasserzeichen (`?pro=1` / „Pro testen“)
- [x] Landing: Demo-Reel-Slot (`demo-reel.mp4`)
- [x] `LAUNCH-CHECKLIST.md`, README v70, Playwright Smoke
