# Elastic Morph — Professionalisierungs-Konzept

*Stand: 15. Juni 2026 · Ausgangsversion: v25 · Ziel: für andere veröffentlichen*

---

## 1. Vision in einem Satz

> **Elastic Morph verwandelt einen Track in wenigen Minuten in ein release-fertiges, einzigartiges Visual — im Browser, ohne Vorkenntnisse.**

Diese eine Aussage ist der Maßstab für jede künftige Entscheidung: Ein Feature, das diesen Satz stärkt, kommt rein. Ein Feature, das nur „auch noch möglich" ist, wird zur Option im Hintergrund — nicht zur Startseite.

Weil das Ziel „für andere veröffentlichen" ist, verschiebt sich der Schwerpunkt: Nicht mehr „was kann die Engine alles", sondern **„kommt ein fremder Mensch in 5 Minuten zu einem Ergebnis, das er teilen will."**

---

## 2. Zielgruppen

**Primär — unabhängige Musiker:innen / Producer.** Brauchen für jeden Release ein Bewegtbild für YouTube, Spotify Canvas, Reels/Shorts. Wollen schnell etwas Eigenes, das nicht nach Standard-Template aussieht. Kein VJ-Wissen, keine After-Effects-Zeit.

**Sekundär — Content-Creator & kleine Labels.** Brauchen am Fließband Clips in mehreren Formaten (16:9, 9:16, 1:1).

**Tertiär — VJs / Live-Performer.** Nutzen den Live-/Auto-VJ-Modus und das Set. Heute der technisch stärkste Teil — aber die kleinste Zielgruppe. Wichtig: nicht den Live-Teil zum Zentrum machen, obwohl er am weitesten ist.

---

## 3. Der Kern-Job (Job To Be Done)

„Wenn ich einen neuen Track fertig habe, will ich in wenigen Minuten ein **einzigartiges, hochwertiges Video** dazu erzeugen und teilen — ohne Software zu lernen."

Drei Versprechen daraus:
- **Einzigartig** — die „Visual DNA" aus dem Track-Fingerprint ist hier das Alleinstellungsmerkmal. Jeder Song → eine eigene Form. Das ist die Story.
- **Hochwertig** — das exportierte Video muss technisch einwandfrei sein (s. Phase 1).
- **Mühelos** — Presets-first, sieht sofort gut aus, Tiefe nur auf Wunsch.

---

## 4. Ehrliche Bestandsaufnahme

**Stärken**
- Sehr reichhaltige, audioreaktive Engine; vier DNA-Render-Arten inkl. echtem Fractal Flame.
- **Deterministische Identität**: Track-Fingerprint → Seed → reproduzierbare Visuals. Starkes, verkaufbares Konzept.
- Set Editor mit deterministischer Cue-Engine — Fundament für perfekte Exporte.
- Robuste Details bereits vorhanden (NaN-Schutz, Auto-Exposure, Kontext-Recovery, A–B-Loop, Auto-VJ-Whiteout-Schutz).
- Läuft als Single-File / PWA, offline, ohne Installation.

**Lücken (für „veröffentlichen" entscheidend)**
- **Export ist Echtzeit** (`captureStream`) → bei schweren Presets Frame-Drops, nicht deterministisch perfekt. *Größte Qualitätslücke.*
- **Onboarding fehlt** — ein fremder Mensch sieht ein volles Panel ohne Führung.
- **Feature-Sprawl im UI** — alles gleichzeitig sichtbar; keine Presets-first-Logik, keine progressive Offenlegung.
- **Kein durchgängiges Design-System** (Spacing, Typo, States) und keine Leer-/Lade-/Fehlerzustände.
- **Performance auf schwacher Hardware** — Flame/Attractor/Heavy-FX2 ungedrosselt; Mobile/Touch unerprobt.
- **Single-File 5000+ Zeilen** — schwer wartbar, sobald mehrere Leute/Versionen.
- **Keine Marke** — Name vorhanden, aber kein Logo/Farbsystem/Landingpage/Demo.

---

## 5. Design-Prinzipien (der „Profi-Kompass")

1. **Das Video ist das Produkt.** Alles dient dem exportierten Ergebnis.
2. **Sieht ohne Zutun gut aus.** Gute Defaults schlagen viele Regler.
3. **Presets-first, Tiefe auf Wunsch.** Einsteiger sehen 5 Knöpfe, Profis klappen den Rest auf.
4. **Deterministisch & teilbar.** Gleicher Track + gleiches Set = gleiches Ergebnis; Presets/Sets exportierbar.
5. **Verlässlich vor mächtig.** Lieber wenige Dinge perfekt als viele wackelig.

---

## 6. Roadmap in drei Phasen

### Phase 1 — Fundament & Vertrauen *(Voraussetzung fürs Veröffentlichen)*

**1a. Offline-/Deterministik-Export (Kernstück).**
Render Frame für Frame bei **fixem Zeitschritt** und fixer Auflösung (1080p, optional 4K) und Framerate (30/60) — entkoppelt von der CPU-Geschwindigkeit. Ergebnis: **keine Frame-Drops, perfekte Bewegung, reproduzierbar** (zusammen mit Cue-Engine + Seed).
Technische Optionen (Entscheidung s. §7):
- **WebCodecs `VideoEncoder` + Muxer** (modern, schnell, Chrome/Edge) — empfohlen.
- Frame-Capture → WASM-Encoder (breiter unterstützt, langsamer).
- Echtzeit-`captureStream` bleibt als Fallback.
Audio separat einbinden und muxen.

**1b. Performance-Budget.** Iterationszahl/Punktdichte der schweren Engines (Flame, Attractor) **an die FPS koppeln** (adaptiv). Heavy-FX2 (Halftone/Triangulate/Posterize) gegenseitig drosseln. Ziel: 60 fps auf einem Mittelklasse-Laptop.

**1c. Robustheit.** Cross-Browser-Matrix (Chrome/Edge/Firefox/Safari), Touch-Grundlagen, klare Fehlerzustände (kein WebGL, Export nicht unterstützt, Datei kaputt). **Automatisierte Regressions-Checks** statt nur manuellem Parse-Test.

### Phase 2 — Erlebnis & Zugänglichkeit *(macht es „für andere" nutzbar)*

**2a. Onboarding.** Erststart führt: Track laden (oder Demo) → ein guter Default-Look → „Exportiere deinen ersten Clip". Maximal drei Schritte bis zum Erfolgserlebnis.

**2b. UX/IA-Aufräumen.** Presets-first als Startfläche; fortgeschrittene Panels einklappbar (progressive Offenlegung); klare Gruppierung (Look / Bild / Text / Export). Das viele Rechts-Panel wird kuratiert statt komplett sichtbar.

**2c. Design-System.** Konsistente Tokens (Abstände, Radien, Typo, Farbrollen), saubere Hover/Focus/Disabled/Empty/Loading-Zustände, Tastatur-Zugänglichkeit. Sieht „aus einem Guss" aus.

### Phase 3 — Marke & Distribution *(macht es teilbar/auffindbar)*

- **Markenidentität**: Name final, Logo, Farb-/Typo-System, Tonalität.
- **Preset- & Set-Bibliothek**: Stöbern, importieren, teilen (Presets/Sets als Dateien — Fundament existiert via `.emorph.json`).
- **Landingpage + Demo-Reel**: zeigt in 20 Sekunden, was es kann.
- **PWA-Politur & teilbare Links**.

---

## 7. Entscheidungen *(beschlossen am 15.06.2026)*

1. **Architektur: modular + Mini-Build.** Mehrere Quelldateien, gebündelt zu einem Single-File-Artefakt, das weiter per Doppelklick läuft.
2. **Export-Technik: WebCodecs `VideoEncoder` + Muxer.** Deterministisch, HW-beschleunigt (Chrome/Edge, neueres Safari). Echtzeit-`captureStream` bleibt Fallback.
3. **Geschäftsmodell: kostenlos starten.** Verbreitung zuerst; Freemium/Pro später offengehalten (kein Lock-in jetzt).
4. **Distribution: Web-App + PWA.** Kein Install, teilbarer Link, installierbar. Native Desktop-App bleibt spätere Option.

---

## 8. Erste konkrete Schritte (Vorschlag)

1. **Diese vier offenen Entscheidungen klären** (kurzes Hin und Her, keine große Recherche nötig).
2. **Export-Prototyp**: deterministischer Offline-Renderer für ein 16:9-1080p-30fps-Clip eines Test-Tracks, zunächst ohne Audio-Mux — beweist das Kernstück.
3. **Performance-Guardrail** für Flame/Attractor (adaptive Dichte) — sofortiger spürbarer Gewinn.
4. **Onboarding-Skizze** (3 Schritte) + Presets-first-Startfläche als erstes UX-Inkrement.

---

## 9. Erfolgskriterien (woran wir „professionell" messen)

- Ein **fremder Mensch** lädt einen Track und hat in **unter 5 Minuten** einen exportierten Clip, den er teilen will.
- Der Export ist **pixelgenau** in gewählter Auflösung/Framerate, **ohne Frame-Drops**, deterministisch reproduzierbar.
- Läuft auf einem **Mittelklasse-Laptop flüssig** (Ziel 60 fps) und scheitert auf schwacher Hardware **kontrolliert** (klare Meldung, Fallback).
- Die App wirkt **aus einem Guss** — konsistentes Design, sinnvolle Defaults, keine toten Enden.
- **Einzigartigkeit** ist sicht- und erklärbar: „Dein Track → deine Form."

---

*Nächster Schritt: §7 entscheiden, dann mit dem Export-Kernstück (Phase 1a) starten.*
