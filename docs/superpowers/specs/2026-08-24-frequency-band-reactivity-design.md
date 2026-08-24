# Elastic Morph — Frequency-Band Reactivity Refinement (Round 1: Analysis Layer)

## Kontext

Dritter Punkt der Roadmap aus der Competitive-Analysis-Runde (siehe
[[project_morph_palette_system]]/[[project_morph_feedback_loop]] — Reihenfolge: Paletten-System
✅, Feedback-Loop ✅, jetzt **Frequenzband-Reaktivität**, danach Community-Look-Gallery, dann
Live-Kamera zuletzt).

Elastic Morph hat aktuell eine 3-Band-Audio-Analyse (Bass 20-160Hz, Mid 160-2500Hz, Highs
2500-12000Hz, `bandEnergy()`/`updateAudioFeatures()` in `elastic-morph.html`), ein bestehendes
"Audio Mixer"-Panel (Gain pro Band, Glättung, Beat-Empfindlichkeit, Auto-Pegel) und ein
ausgereiftes Beat-System (Offline-BPM-Erkennung fürs ganze Track, Phasen-basierter Decay für
Datei-Wiedergabe, ein simpler Lautstärke-Sprung-Transient-Detektor für Live/Mic, ein separates
"Club Beat"-Zusatzsystem). `S.bass`/`S.mids`/`S.highs`/`S.beat`/`S.transient` werden an
dutzenden Stellen quer durch alle 12 Shader-Engine-Styles, Layer B, Partikel und diverse FX
gelesen.

## Entschiedene Fragen (User-bestätigt 2026-08-24)

- **Scope-Aufteilung:** Diese Runde bringt nur die **Analyse-Schicht** (mehr Bänder, Kick/
  Snare-Trennung, sichtbare Meter) — komplett innerhalb der Audio-Analyse + neuem UI, **ohne**
  die 12 Shader-Styles/Layer B/Partikel anzufassen. Die **Band-zu-Parameter-Routing-Matrix**
  (Nutzer wählt selbst, welches Band welchen visuellen Parameter treibt, ähnlich dem
  bestehenden MIDI-Mapping-System) ist explizit auf eine **spätere, eigene Spec-Runde**
  verschoben — größter, architektonisch invasivster Teil von Franks ursprünglichem Wunsch.
- **Reine Instrumentierung in dieser Runde:** die neuen, feineren Signale (6 Bänder, Kick/
  Snare-Onset) sind nur in neuen Metern sichtbar/messbar — sie treiben **noch nichts** im
  Visual. Erst die Routing-Matrix-Runde macht sie nutzbar. Bewusste Entscheidung für
  Nullrisiko gegenüber allen bestehenden Visual-Konsumenten von `S.bass`/`S.mids`/`S.highs`/
  `S.beat`/`S.transient` — diese bleiben **exakt unverändert**, komplett neue, parallele
  Zustände statt Ersatz.
- **6 Bänder**, aufbauend auf den bestehenden Grenzen: Sub-Bass 20-60Hz, Bass 60-160Hz,
  Low-Mid 160-500Hz, Mid 500-2000Hz, High-Mid 2000-6000Hz, Air 6000-16000Hz.
- **Kick/Snare-Trennung**, nicht das volle Spectral-Flux-Onset-Tracking — reuse des
  bestehenden Lautstärke-Sprung-Musters (wie `S.transient` heute), nur band-limitiert statt
  auf Gesamt-Lautstärke angewandt.
- **Kein neuer Gain-Regler pro Band** in dieser Runde — reine Anzeige, keine Bedienelemente,
  da noch nichts die neuen Bänder steuert. Kann in der Routing-Matrix-Runde nachgereicht
  werden, sobald Regler tatsächlich etwas bewegen.
- **Export-Pfad bleibt unangetastet:** Der deterministische HQ-Export nutzt eine komplett
  andere, vorab berechnete Feature-Timeline (`feat.bass[fi]` etc., `buildFeatureTimeline`),
  nicht die Live-`analyser`-Daten, auf denen diese Runde aufbaut. Die neuen Signale existieren
  ausschließlich im Live-Analyse-Pfad (`if (analyser && live)` in `updateAudioFeatures`), nicht
  im Idle-Demo- und nicht im Export-Zweig.

## Ist-Zustand

`bandEnergy(lo, hi)` (`elastic-morph.html:2662-2671`): bestehende Hilfsfunktion, mittelt
`freqData`-Bins zwischen zwei Frequenzgrenzen zu einem 0-1-Wert. Bereits generisch — die neue
Runde ruft sie nur mit 6 statt 3 Grenzpaaren auf, keine Änderung an der Funktion selbst nötig.

`updateAudioFeatures(dt)` (`elastic-morph.html:2674` ff.), relevanter Ausschnitt (Zeile
2677-2693, live-Zweig):
```js
  if (analyser && live) {
    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);
    const g = S.gain, M = S.mix;
    let eb = bandEnergy(20, 160) * g, em = bandEnergy(160, 2500) * g, eh = bandEnergy(2500, 12000) * g;
    const rawL = eb * 0.5 + em * 0.35 + eh * 0.15;
    S._lvlPeak = Math.max(rawL, (S._lvlPeak || 0.3) * 0.999);
    const norm = M.autoLevel ? 1 / Math.max(0.25, S._lvlPeak) : 1;
    const tb = Math.min(1, eb * M.bass * norm), tm = Math.min(1, em * M.mid * norm), th = Math.min(1, eh * M.high * norm);
    const a = 1 - (M.smooth || 0) * 0.8;
    S.bass += (tb - S.bass) * a; S.mids += (tm - S.mids) * a; S.highs += (th - S.highs) * a;
    S.loudness = Math.min(1, (S.bass * 0.5 + S.mids * 0.35 + S.highs * 0.15));
    const jump = Math.max(0, S.loudness - prevLoud);
    S.transient = Math.max(S.transient * 0.88, jump > (M.beatThresh || 0.04) ? Math.min(1, jump * 8) : 0);
    prevLoud = prevLoud * 0.7 + S.loudness * 0.3;
    S.energyAvg += (S.loudness - S.energyAvg) * 0.01;
    ...
  }
```
Diese Struktur (band-limitierte Energie → Sprung-Erkennung → Decay) ist genau das Muster, das
die neue Kick/Snare-Onset-Erkennung wiederverwendet, nur auf zwei neue, kombinierte Band-Paare
angewandt statt auf `S.loudness`.

"Audio Mixer"-Panel (`elastic-morph.html:1555-1564`): 3 Gain-Regler (`#mixBass`/`#mixMid`/
`#mixHigh`), Glättung (`#mixSmooth`), Beat-Empfindlichkeit (`#mixBeat`), Auto-Pegel-Checkbox
(`#mixAuto`) — alle an `S.mix` gebunden. Bleibt komplett unangetastet; die neuen Meter kommen
als reiner Anzeige-Zusatz darunter.

Referenz-Muster für eine kleine Live-Canvas-Anzeige im Panel: `#palPreview` (200×20px Canvas,
`drawPalettePreview()`), bereits etablierter Stil für "kleine Vorschau-Canvas im Options-Panel".

## Soll-Zustand

### 1. Datenmodell

Komplett neue, parallele State-Felder — `S.bass`/`S.mids`/`S.highs`/`S.beat`/`S.transient`
bleiben byte-identisch zum heutigen Verhalten:
```js
S.bands = { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, air: 0 };
S.kickOnset = 0;
S.snareOnset = 0;
```
Keine Persistenz — wie `S.bass`/`S.beat`/`S.stereo` heute sind das reine, jeden Frame neu
berechnete Live-Telemetrie-Werte, kein Teil des gespeicherten Projekts (`projectData()`/
`applyProject()` bleiben unangetastet für diese Felder).

### 2. Berechnung in `updateAudioFeatures`

Innerhalb des bestehenden `if (analyser && live) { ... }`-Blocks, nach der bestehenden
`eb`/`em`/`eh`-Berechnung, sechs neue `bandEnergy()`-Aufrufe plus Kick/Snare-Onset nach dem
etablierten Sprung-Erkennungs-Muster:
```js
S.bands.subBass = bandEnergy(20, 60) * g;
S.bands.bass = bandEnergy(60, 160) * g;
S.bands.lowMid = bandEnergy(160, 500) * g;
S.bands.mid = bandEnergy(500, 2000) * g;
S.bands.highMid = bandEnergy(2000, 6000) * g;
S.bands.air = bandEnergy(6000, 16000) * g;

const kickE = (S.bands.subBass + S.bands.bass) * 0.5;
prevKick = prevKick * 0.7 + kickE * 0.3;
const kickJump = Math.max(0, kickE - prevKick);
S.kickOnset = Math.max(S.kickOnset * 0.88, kickJump > (M.beatThresh || 0.04) ? Math.min(1, kickJump * 8) : 0);

const snareE = (S.bands.mid + S.bands.highMid) * 0.5;
prevSnare = prevSnare * 0.7 + snareE * 0.3;
const snareJump = Math.max(0, snareE - prevSnare);
S.snareOnset = Math.max(S.snareOnset * 0.88, snareJump > (M.beatThresh || 0.04) ? Math.min(1, snareJump * 8) : 0);
```
`prevKick`/`prevSnare` sind neue modulweite `let`-Variablen direkt neben dem bestehenden
`let prevLoud = 0;` (Zeile 2673) — gleiches Muster, gleiche Nachbarschaft. Wiederverwendet
`M.beatThresh` (bestehender Mixer-Regler) statt einen weiteren neuen Schwellwert-Regler
einzuführen — ein Sprung-Schwellwert für alle drei Erkennungen (Gesamt/Kick/Snare) bleibt
konsistent mit dem, was der Nutzer im Mixer-Panel schon einstellt.

Die 6 neuen `bandEnergy()`-Aufrufe laufen **nicht** durch `S.mix`-Gain/Glättung/Auto-Pegel —
das bleibt exklusiv den bestehenden 3 Bändern vorbehalten (kein neuer Gain-Regler, siehe
Entschiedene Fragen). Nur der globale `g = S.gain`-Faktor wird mitgenommen, da der sonst jede
Lautstärke-Anpassung des Nutzers ignorieren würde.

### 3. UI — Live-Meter im Audio-Mixer-Panel

Neue Zeile unter den bestehenden Reglern (`elastic-morph.html:1564`, nach dem Auto-Pegel-Opt):
```html
<div class="opt"><span>Bänder</span>
  <canvas id="bandMeter" width="200" height="30" style="flex:1;border-radius:6px;border:1px solid var(--line)"></canvas>
</div>
```
Neue `drawBandMeters()`-Funktion (Muster wie `drawPalettePreview()`): zeichnet 6 vertikale
Balken proportional zu `S.bands.*`, plus zwei kleine Punkt-Indikatoren (Kick/Snare), die kurz
aufleuchten, wenn `S.kickOnset`/`S.snareOnset` über einem kleinen Schwellwert liegen. Aufruf
jeden Frame aus der Haupt-Render-Schleife (an der Stelle, wo bereits andere Pro-Frame-UI-Updates
laufen — exakte Anbindung ist Sache des Implementierungsplans, nicht dieser Spec), damit die
Meter auch dann live sind, wenn das Options-Panel geöffnet aber sonst nichts angefasst wird.

## Out of Scope

- **Band-zu-Parameter-Routing-Matrix** — eigene, spätere Spec-Runde.
- **Kein neuer Gain-Regler pro Band.**
- **Export-Pfad (`buildFeatureTimeline`) bleibt unangetastet** — neue Signale sind reine
  Live-Vorschau.
- **`S.bass`/`S.mids`/`S.highs`/`S.beat`/`S.transient` bleiben exakt wie heute.**
- **Kein volles Spectral-Flux-Onset-Tracking** — nur band-limitierte Wiederverwendung des
  bestehenden Sprung-Erkennungs-Musters.
- **Idle-Demo-Modus** (kein Track geladen) bekommt keine simulierten Werte für die neuen
  Felder — sie bleiben bei ihren `0`-Defaults, bis echtes Audio läuft (die Meter zeigen dann
  einfach "still", was korrekt ist).

## Testing

- `test.js`: neue Assertions (Muster wie bestehende `S.mix`/`S.bass`-Checks):
  - `S.bands`-Initialisierung im Skript-Quelltext vorhanden, alle 6 Felder bei `0`.
  - `updateAudioFeatures` enthält alle 6 neuen `bandEnergy()`-Aufrufe mit den dokumentierten
    Frequenzgrenzen, sowie die Kick-/Snare-Onset-Berechnung.
  - Neue `prevKick`/`prevSnare`-Modulvariablen vorhanden.
  - `#bandMeter`-Canvas-Element vorhanden, `drawBandMeters` als Funktion definiert.
  - **Regressionscheck:** bestehende `S.bass`/`S.mids`/`S.highs`/`S.transient`-Berechnungszeilen
    bleiben byte-identisch zum Ist-Zustand — keine dieser Zeilen wird durch diese Runde verändert.
- `node test.js` muss vor und nach der Änderung für alle bestehenden Assertions grün bleiben.
- Manueller Live-Check (Pro-Modus, Demo-Track mit klarem Kick/Snare-Pattern, z.B. Techno/House):
  6 Meter-Balken reagieren sichtbar unterschiedlich auf Bassline vs. Hi-Hats, Kick-Indikator
  leuchtet auf Kick-Schläge, Snare-Indikator auf Snare/Clap — keine sichtbare Änderung an
  irgendeinem der 12 Shader-Styles, Layer B oder Partikel gegenüber dem Vor-Feature-Zustand.
