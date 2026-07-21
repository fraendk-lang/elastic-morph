# Elastic Morph — Benutzerhandbuch

**Aus deinem Track wird ein einzigartiges Visual.** Diese Anleitung erklärt den kompletten Workflow — vom ersten Start bis zum exportierten MP4.

Stand: **v78** (Export-Übergänge, Text-Presets, HQ-Polish)

---

## Inhaltsverzeichnis

1. [Was ist Elastic Morph?](#1-was-ist-elastic-morph)
2. [Erster Start in 3 Minuten](#2-erster-start-in-3-minuten)
3. [Oberfläche im Überblick](#3-oberfläche-im-überblick)
4. [Audio laden & abspielen](#4-audio-laden--abspielen)
5. [Looks & Visual DNA](#5-looks--visual-dna)
6. [Creator Cuts — Formate & Export](#6-creator-cuts--formate--export)
7. [Text Designer & Lyrics](#7-text-designer--lyrics)
8. [Ebenen & Effekte stapeln](#8-ebenen--effekte-stapeln)
9. [Timeline, Set Editor & Szenen](#9-timeline-set-editor--szenen)
10. [Live Morph & Mikrofon](#10-live-morph--mikrofon)
11. [Settings & Projekt speichern](#11-settings--projekt-speichern)
12. [Tastatur & Touch](#12-tastatur--touch)
13. [Tipps & Fehlerbehebung](#13-tipps--fehlerbehebung)

---

## 1. Was ist Elastic Morph?

Elastic Morph ist eine **browserbasierte Audio-Visual-App**. Sie analysiert deinen Song und erzeugt daraus eine **Visual DNA** — eine organische Form, die auf Bass, Mitten, Höhen und Beat reagiert.

**Besonderheiten:**

- **Deterministisch:** Derselbe Track → dieselbe Grundform (Fingerabdruck/Seed)
- **Live & exportierbar:** Was du siehst, kann als Video exportiert werden
- **Kein Plugin nötig:** Läuft im Browser, installierbar als PWA
- **Bis 4K:** Frame-genauer HQ-Export in Chrome/Edge

**Typische Anwendungen:** YouTube-Visuals, Reels/Shorts, Spotify Canvas, VJ-Loops, Social-Clips, Live-Shows.

---

## 2. Erster Start in 3 Minuten

### Variante A — Demo (ohne eigene Datei)

1. App öffnen (`elastic-morph.html` oder über die Landingpage)
2. **✦ Demo starten** klicken
3. Ein Look erscheint automatisch (Standard: *Liquid Memory*)
4. **Creator Cuts** in der linken Navigation → **⤓ HQ Export**

### Variante B — Eigener Track

1. **Upload Audio** oder Audio-Datei auf das Canvas **ziehen** (MP3, WAV, …)
2. Kurz warten — die App analysiert BPM, Energie und Phasen
3. Unter **Visual DNA** einen Look wählen (oder **Smart Look** nutzen)
4. **Creator Cuts** → Format wählen → **⤓ HQ Export**

### Willkommens-Overlay

Beim ersten Besuch erscheint eine **3-Schritte-Führung**: Track → Look → Export. Du kannst sie jederzeit unter **Settings → Show intro again** erneut anzeigen.

---

## 3. Oberfläche im Überblick

```
┌─────────────────────────────────────────────────────────────┐
│  Logo · Trackname · Upload · Export · Hilfe · Vollbild      │  ← Topbar
├──────────┬──────────────────────────────┬───────────────────┤
│          │                              │                   │
│  Nav     │         Canvas               │  Steuerpanel      │
│  (links) │    (Visual + Timeline)       │  (rechts)         │
│          │                              │                   │
├──────────┴──────────────────────────────┴───────────────────┤
│  Creator-Dock (Track · Look · Export) — im Creator-Modus    │
└─────────────────────────────────────────────────────────────┘
```

### Linke Navigation

| Bereich | Zweck |
|---------|--------|
| **Morph Studio** | Standard-Arbeitsmodus — volle Kontrolle |
| **Live Morph** | Performance-Modus, FX-Rack im Fokus |
| **Creator Cuts** | Formate, Text, Export, Master Finish |
| **Lyrics** | Sync-Text / Karaoke-Zeilen |
| **Visual DNA** | Presets, Palette, Smart Look |
| **Settings** | Szenen, Qualität, MIDI, Projekt |

### Canvas-Elemente

- **Wellenform-Timeline** unten — Klick springt zur Position, **I/O** markiert Export-Bereich
- **Phasen-Badge** (Birth, Rise, Peak, …) — Songstruktur
- **Preset-Badge** — aktueller Look-Name
- **Zoom-Buttons** (− / 1× / +) — auch per Pinch am Touchscreen

### Rechtes Steuerpanel

Von oben nach unten:

- **Shader Engine** (GPU-Effekte)
- **DNA Control** — Feinregler für den Organismus
- **Audio-Meter** — Bass / Mid / High / Energy
- **Particle Mode**, **Image Layer A/B**, **Layer B**, **Intro/Outro Cover**, …

Bereiche lassen sich **einklappen** — der Zustand wird gespeichert.

---

## 4. Audio laden & abspielen

### Track laden

| Methode | Aktion |
|---------|--------|
| Drag & Drop | Audio-Datei auf das Canvas ziehen |
| Upload | **Upload Audio** in der Topbar |
| Hero | **▶ Track laden** auf dem Startbildschirm |
| Demo | **✦ Demo starten** — synthetischer 48s-Track |

### Wiedergabe

- **Play/Pause:** Leertaste oder Klick auf die Timeline
- **±5 Sekunden:** Pfeiltasten ← →
- **Neustart:** Home
- **A–B Loop:** Bereich in der Timeline markieren (I/O-Punkte)

### Was passiert bei der Analyse?

Die App berechnet:

- **BPM** (automatisch oder per Tap-Button)
- **Band-Energie** (Bass, Mitten, Höhen)
- **Song-Phasen** (Birth → Rise → Peak → Break → Return → Outro)
- **Drop-Marker** (⚡ in der Timeline)
- **Visual-Fingerabdruck** (Hash + Seed unter Visual DNA)

### Audio Mixer (Settings)

Feinabstimmung der Reaktivität:

- **Bass / Mid / High** — einzelne Bänder verstärken oder dämpfen
- **Glättung** — weniger Zucken, mehr Fluss
- **Beat-Empfindlichkeit** — wie stark der Beat pulsiert
- **Auto-Pegel** — leise Tracks automatisch anheben

---

## 5. Looks & Visual DNA

### Presets (Visual DNA)

Unter **Visual DNA** findest du ~20 **Presets** — fertige Looks wie:

| Preset | Charakter | Gut für |
|--------|-----------|---------|
| Liquid Memory | Flüssig, langsam | Ambient, Trip-Hop |
| Signal Creature | Linien, Impulse | Techno, House |
| Black Bloom | Organische Blüten | Filmisch, langsam |
| … | … | … |

**Klick auf eine Karte** = Look sofort aktiv.

### Smart Look

Nach Track-Laden erscheinen **Empfehlungen** basierend auf BPM, Energie und Fingerprint. Ein Klick übernimmt Preset + passende Einstellungen.

### Palette

Eigene Farben statt Preset-Gradient:

- **Custom Palette** aktivieren
- **Farbton**, **Spreizung**, **Sättigung** anpassen

### Dual-Deck (Preset-Blending)

In der Topbar / DNA-Bereich:

- Zweites Preset wählen (**Blend With**)
- **Crossfade** zwischen zwei Looks — manuell oder automatisch über den Song

### DNA Story

Zeigt **Hash** und **Seed** deines Tracks — derselbe Song liefert immer dieselbe Grund-DNA. **Share-Card exportieren** erzeugt ein PNG mit Metadaten.

---

## 6. Creator Cuts — Formate & Export

**Creator Cuts** ist der Export-Hub. Hier wählst du Seitenverhältnis, Text, Finish und Export-Methode.

### Formate

| Format | Auflösung | Einsatz |
|--------|-----------|---------|
| **16:9** | 1920×1080 | YouTube |
| **9:16** | 1080×1920 | Reels, TikTok, Shorts |
| **1:1** | 1080×1080 | Instagram Square |
| **Cover Motion** | 1:1, Auto-Stop | Album-Cover-Loop |
| **Spotify Canvas** | 720×720, 8s | Spotify Canvas |
| **VJ Loop** | 16:9, 8 Takte | Beat-synchroner Loop |

Klick auf ein Format — das Canvas passt sich sofort an.

### Text Designer

- **Show text layer** — Titel/Künstler auf dem Video
- **Text-Presets** (Chips): Cinematic, Neon Lower Third, Karaoke, …
- Feineinstellung: Font, Animation, Position, Gradient, Kreis-Text, Lower-Third

Text-Presets und manuelle Einstellungen werden in **Projekten** und **Szenen** gespeichert.

### Export-Übergänge (DaVinci-style)

Block **Export-Übergänge** über dem HQ-Button:

| Option | Beschreibung |
|--------|--------------|
| **Einblendung** | Clip startet aus Schwarz/Weiß/Eigenfarbe |
| **Ausblendung** | Clip endet in Farbe |
| **Dauer** | 0–8 Sekunden je Richtung |
| **Kurve** | Smooth, Linear, Ease In/Out, S-Kurve |
| **Audio mitfaden** | Ton fade synchron zum Bild |

Gilt für **HQ Export** und **● Export** (Echtzeit).

### Intro- & Outro-Cover

Im rechten Panel (**Intro Cover Card** / **End-Credits**):

- **Image A** als statisches Cover am Anfang/Ende
- Haltedauer + Überblendung einstellbar
- **Ken Burns**, Filter (Cinematic, Vintage, Neon, …), Parallax-Tiefe

Ideal für Albumcover als Intro, dann Morph ins Visual.

### Master Finish

Professioneller Abschluss:

- **Vignette**, **Grain**, **Chromatic Aberration**, **Color Grade**
- **HQ Polish** — Schärfe + Anti-Banding (nur beim HQ-Export)
- **Auto-Exposure zurücksetzen** — falls das Bild zu dunkel wirkt

### Export-Methoden

#### ⤓ HQ Export (empfohlen)

- **Frame-genau**, deterministisch, reproduzierbar
- Bis **4K**, Bitrate skaliert automatisch
- Set/Cues werden exakt mitexportiert
- **Chrome oder Edge** erforderlich (WebCodecs)
- Dateiname: `elastic-morph-hq-3840x2160-30fps.mp4`
- Dauer: abhängig von Track-Länge und Auflösung (4K kann viele Minuten dauern)

**Optionen:**

- **Auflösung:** 720p Draft / 1080p / 4K
- **FPS:** 24 / 30 / 60
- **Draft (720p)** — schnelle Vorschau
- **Nur Bereich exportieren** — In/Out-Punkte in Sekunden
- **Batch Export** — 16:9 + 9:16 + 1:1 nacheinander

#### ● Export (Echtzeit)

- **MediaRecorder** — nimmt den Canvas live auf
- Schneller, aber abhängig von CPU/Fenstergröße
- **Fenster sichtbar lassen** während der Aufnahme
- Fallback auf Safari/iPad, wenn HQ nicht verfügbar
- Dateiname: `elastic-morph-realtime-1920x1080.mp4`

**Faustregel Dateigröße:**

| Größe | Typ |
|-------|-----|
| ~400–600 MB (voller Track, 4K) | HQ Export ✓ |
| ~40–80 MB | Echtzeit-Export (niedrigere Qualität) |

### Free vs. Pro

| Free | Pro (`?pro=1` oder „Pro testen“) |
|------|-----------------------------------|
| max. 1080p HQ | 4K HQ |
| Wasserzeichen im Export | kein Wasserzeichen |

---

## 7. Text Designer & Lyrics

### Text Designer (Creator Cuts)

Drei Zeilen möglich: **Titel**, **Artist**, **Label/Tagline**.

**Animationen** (Auswahl):

Static, Beat Pulse, Breathe, Typewriter, Karaoke Wipe, Glow, Wave, Slide In, Glitch, Shimmer, Chromatic, Bass Bounce, Fade In, Zoom In, Scramble/Decode, 3D Depth, Beat Gate, Intro & Outro only

**Render-Stile:** Solid Fill, Outline, Neon Glow  
**Blend-Modi:** Normal, Screen, Difference, …

### Lyrics-Modus

Unter **Lyrics**:

1. **Lyrics aktivieren**
2. Zeilen einfügen (eine Zeile pro Textzeile)
3. **Tap-Sync:** Während Wiedergabe **T** drücken, um Zeiten zu setzen
4. Zeilen erscheinen über den Text-Designer-Stil

---

## 8. Ebenen & Effekte stapeln

Das Visual entsteht aus **übereinander gestapelten Ebenen**:

```
(vorn)  Text · Logo · Export-Fade
        Intro/Outro Cover
        FX Rack III · Master Finish
        FX Rack I + II
        Layer B · Particles · Image B
        Image A · Shader · Visual DNA (Kern)
(hinten) Hintergrund-Video (optional)
```

### Shader Engine (Taste G)

GPU-Effekte: Fluid, Metaballs, Tunnel, Aurora, Electric, Chrome, Gyroid, Raymarch, Feedback.

### Image Layer A / B

Bild hochladen → Modi wie Dispersion, Displace, Halftone, Mosaic, Edges, Shatter, Spin, Backdrop.

- **13 Modi**, Creative Filter, Blend Modes, Beat-Sync
- **A ↔ B Interplay** — Crossfade zwischen zwei Bildern über den Song

### Layer B

Zweite geometrische Ebene: Spectrum Ring, Hex Grid, Waveform, … — additive Überlagerung.

### Particle Mode

Muster: Hyperspace, Orbit, Rain, Fireflies, … — reaktiv auf Audio.

### FX Rack I (Tasten 1–9, 0)

Spiegel, Kaleido, Feedback, Tile, RGB Split, Invert, Strobe, Shake, Pixelate, Glitch

### FX Rack II (Ctrl+1–0)

Hex Kaleido, Droste, Mirror Grid, Echo Spin, Radial Blur, Slice, Spin, Halftone, Triangulate, Posterize

### FX Rack III

Zusätzliche kreative Effekte (im Live-Modus sichtbar).

---

## 9. Timeline, Set Editor & Szenen

### Timeline

- **Klick** — zur Position springen
- **Wellenform** — Energieverlauf des Tracks
- **Phasen-Farben** — Songstruktur
- **⚡ Drops** — erkannte Drop-Positionen
- **I / O** — In- und Out-Punkt für Export-Bereich

### Set Editor (🎬)

Öffnen über den Set-Button an der Timeline.

- **Cues** setzen — zu einem Zeitpunkt Szene A–D, FX oder Transition auslösen
- **Transition:** Cut, Morph, Fade
- Cues feuern bei **Wiedergabe und HQ-Export** deterministisch
- **M** während Wiedergabe = Cue an aktueller Position

### Scene Bank (Settings)

Vier Slots **A–B–C–D**:

- Kompletten Look speichern (DNA, FX, Text, Mixer, …)
- **Shift+1 … Shift+4** — Szene live abrufen
- **Hinweis:** Bilder werden aus Speichergründen nicht in Szenen gespeichert — DNA, FX & Text schon

---

## 10. Live Morph & Mikrofon

### Live Input (🎤)

- **Mikrofon / Line-In** statt Datei
- Kein BPM/Phasen-Scan — reine Live-Reaktion
- Ideal für DJ-Sets, VJ-Performance, schnelles Testen
- **HQ Export** im Live-Modus nicht verfügbar → **● Export**

### Live Morph (Nav)

Fokus auf Performance:

- FX-Racks prominent
- Schnelles Toggeln von Effekten während Wiedergabe

### Auto-VJ (🤖)

Unter Settings:

- **Hands-off mode** — Look und Parameter entwickeln sich automatisch
- **Intensity** regelt, wie stark sich das Visual verändert

---

## 11. Settings & Projekt speichern

### Render Quality

| Stufe | Wirkung |
|-------|---------|
| Performance 0.75× | Schneller, weniger Details |
| Balanced 1× | Standard |
| High 1.5× / Ultra 2× | Schärfer, mehr GPU-Last |

**Auto quality** passt die Auflösung bei FPS-Einbrüchen automatisch an.

### Auto-Exposure

Verhindert **Whiteout** bei vielen leuchtenden Effekten. Bei zu dunklem Bild:

- Auto-Exposure kurz **aus**, oder
- **Auto-Exposure zurücksetzen** (Creator Cuts → Master Finish)

### Projekt speichern

**⤓ Save Project** → `.emorph.json` Datei:

- Enthält: DNA, FX, Text, Set/Cues, Export-Übergänge, Mixer, …
- **Audio nicht enthalten** — beim Laden erneut Track laden
- **Bild eingebettet** (kann Datei groß machen)

**🔗 Copy share link** — kompakter Link mit Look-Daten (ohne Bilder).

**Undo / Redo:** Cmd/Ctrl+Z · Cmd/Ctrl+Shift+Z

### Quick Templates

Ein-Klick-Startpunkte für typische Setups (Look + Palette voreingestellt).

### MIDI

**Connect MIDI** — Hardware-Regler auf DNA-Slider mappen. Ideal für Live-Performance.

---

## 12. Tastatur & Touch

### Desktop-Tastatur

| Taste | Aktion |
|-------|--------|
| **Space** | Play / Pause |
| **← →** | ±5 Sekunden |
| **Home** | Neustart |
| **1–9, 0** | FX Rack I toggeln |
| **Ctrl+1–0** | FX Rack II toggeln |
| **G** | Shader an/aus |
| **P** | PNG-Screenshot |
| **F** | Vollbild |
| **B** | Blackout |
| **[ ]** | Dual-Deck Crossfade |
| **M** | Cue an aktueller Position |
| **Shift+1–4** | Szene A–D abrufen |
| **T** | Tap-Sync (Lyrics-Modus) |
| **?** | Hilfe-Overlay |
| **Esc** | Hilfe / Set Editor schließen |
| **+ − 0** | Zoom rein / raus / reset |

### Touch & iPad

| Geste | Aktion |
|-------|--------|
| **Wischen** (Creator) | Look wechseln |
| **Pinch** | Zoomen |
| **− / 1× / +** | Zoom-Buttons |
| **🔓 Swipe** | Look-Wischen sperren |
| **⚙ Live-Regler** | Pro-Portrait-Panel |

In-App-Hilfe: **?**-Button in der Topbar.

---

## 13. Tipps & Fehlerbehebung

### Export

| Problem | Lösung |
|---------|--------|
| HQ-Button ausgegraut | Track laden und Analyse abwarten (Chrome/Edge) |
| Kleine Datei (~50 MB) | Du hast ● Export statt HQ genutzt — **⤓ HQ Export** in Creator Cuts |
| Safari / iPad | HQ nicht unterstützt → ● Export (Echtzeit) |
| Export hängt | **■ Export abbrechen** — Draft 720p testen |
| 4K sehr langsam | Normal — Fenster offen lassen, Draft zuerst prüfen |

### Visual

| Problem | Lösung |
|---------|--------|
| Bild zu dunkel | Auto-Exposure aus / zurücksetzen / Preset neu wählen |
| Bild zu hell | Auto-Exposure an · Reduce Flash aktivieren |
| Ruckeln | Render Quality auf Performance · Auto Quality an |
| Kein WebGL | Shader deaktivieren — DNA-Engine läuft weiter |

### Audio

| Problem | Lösung |
|---------|--------|
| Keine Reaktion | Reactivity/Gain erhöhen · Auto-Pegel an |
| BPM falsch | Tap-Button oder manuelle BPM-Eingabe |
| Mikrofon geht nicht | Browser-Berechtigung prüfen · HTTPS nötig |

### Allgemein

- **Hard Refresh** nach Updates: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Win)
- **PWA installieren:** ⤓ Install in der Topbar (Chrome/Edge)
- **Offline:** Nach erstem Laden cached der Service Worker die App

---

## Empfohlener Workflow (Produktion)

```
1. Track laden (oder Demo)
2. Visual DNA → Smart Look oder Preset wählen
3. Feintuning: DNA-Slider, FX, ggf. Image Layer
4. Creator Cuts → Format (16:9 / 9:16 / 1:1)
5. Text + Intro/Outro Cover optional
6. Export-Übergänge einstellen
7. Master Finish prüfen
8. Draft 720p → kurz checken
9. HQ Export 1080p oder 4K (Chrome)
10. Fertig — MP4 im Download-Ordner
```

---

## Weitere Ressourcen

| Datei | Inhalt |
|-------|--------|
| `README.md` | Entwickler-Kurzinfo, Build, Tests |
| `LAUNCH-CHECKLIST.md` | Pre-Launch QA |
| In-App **?** | Kurzanleitung & Shortcuts |

**Elastic Universe:** [elasticuniverse.app](https://elasticuniverse.app)

---

*Feedback und Fragen willkommen — die App lebt von echten Produzenten-Workflows.*
