# Elastic Morph — Graphic EQ DNA Visual (New Mechanical-Device Engine, Round 1)

## Kontext

Frank möchte mehr DNA-Visuals im "mechanischen/objekthaften" Stil (wie die bestehenden Vinyl/
Tape-Machine/Cassette/Oscilloscope-Presets) statt weiterer Blob- oder geometrischer Varianten —
mittelfristig genug, um evtl. eine zweite DNA-Preset-Bank zu rechtfertigen (siehe
[[project_morph_feature_ideas]]). Diese Runde baut das erste neue Visual dieser Reihe: ein
**Graphic EQ** — bewusst gewählt, weil es direkt die 6 Frequenzbänder aus
[[project_morph_frequency_bands]] als ersten echten visuellen Konsumenten nutzt (bisher rein
Instrumentierung, siehe dortige Notiz "treibt noch nichts im Visual").

**Entschiedene Fragen (User-bestätigt 2026-08-24):**
- Erste Runde = **nur der Graphic EQ**, keine zweite DNA-Bank (kommt erst, wenn mehrere neue
  Visuals zusammenkommen — Backlog: Sequencer-Grid, Radio-Tuner, VU-Meter-Wand).
- Visuelle Umsetzung: **Equalizer-Balken** (6 vertikale Balken + Peak-Hold-Kappen), nicht
  Mixer-Fader-Optik (verschiebbare Kappen auf Schienen) — einfacher, passt besser zum
  "6-Band"-Charakter.
- Kein neuer UI-Regler — das Preset nutzt die bestehenden DNA-Controls wie jedes andere.
- Name/Beschreibung: **"Graphic EQ"**, "6-Band-Equalizer — reagiert direkt auf die
  Frequenzbänder. Technisch, clean, DJ-Set." Farbschema Cyan/Blau (Studio-Gear-Look, bewusst
  abgesetzt von Tapes Braun/Amber).

## Ist-Zustand

DNA-Presets (`PRESETS`-Array, `elastic-morph.html:2097` ff.) haben ein optionales `engine`-Feld;
fehlt es, gilt der Default "blob" (organische Partikel-Cloud, 10 der bestehenden Presets). Jeder
andere Engine-Wert hat eine dedizierte Draw-Funktion, dispatcht in `drawScene()`
(`elastic-morph.html:4636-4659`):
```js
const dnaEngine = P.engine || "blob";
if (dnaEngine === "filament") { drawFilaments(base, hue, growthF, energySize, seed); }
else if (dnaEngine === "attractor") { drawAttractor(...); }
... else if (dnaEngine === "tape") { drawTape(base, hue, growthF, energySize, seed); }
else if (dnaEngine === "sacred") { drawSacred(...); }
```
`base` (≈32% der kürzeren Canvas-Kante), `hue`/`P.sat` (Preset-Farbe), `growthF` (sanfter
Skalierungs-Modifier über den Song-Verlauf), `energySize` (Lautstärke-Puls-Multiplikator),
`seed` (Preset-Zufallswert) sind die Standard-Parameter aller Engine-Funktionen.

**Referenz-Engine `drawTape()`** (`elastic-morph.html:4034-4059`) ist strukturell am nächsten —
zwei rotierende Spulen plus ein simples 3-Band-VU-Meter (`[S.bass, S.mids, S.highs]`) am unteren
Rand, additiv (`globalCompositeOperation = "lighter"`) über einem soliden Gehäuse-Hintergrund.

Jede Engine hat außerdem einen Mini-Vorschau-Zweig im Preset-Picker (`buildPresets()`,
`elastic-morph.html:6043-6133`+, z.B. der `dance`-Zweig bei `else`-Fall Zeile 6122-6125: ein
16-Balken-Equalizer-artiges Muster mit simulierten `Math.sin`-Werten statt echter Audiodaten,
da die Preview-Canvas keine echte Wiedergabe hat).

Die neuen 6 Frequenzbänder (`S.bands.subBass/bass/lowMid/mid/highMid/air`, 0-1 geclampt) und
Onset-Signale (`S.kickOnset`/`S.snareOnset`, 0-1) aus [[project_morph_frequency_bands]] sind
bereits vorhanden und laufen jeden Frame während echter Wiedergabe/Live-Input — noch von
keinem Visual konsumiert.

## Soll-Zustand

### 1. `drawEqualizer()` — neue Engine-Funktion

Neue Funktion, gleiches Signatur-/Struktur-Muster wie `drawTape()`, platziert direkt danach
(`elastic-morph.html:4059`, nach `drawTape`s schließender `}`, vor dem Sacred-Geometry-
Kommentarblock):

```js
/* --- v114: GRAPHIC EQ — 6-band equalizer driven directly by S.bands, peak-hold caps flash on kick/snare --- */
let eqPeaks = [0, 0, 0, 0, 0, 0];
function drawEqualizer(base, hue, growthF, energySize, seed) {
  const P = currentDNA(), mn = Math.min(canvas.width, canvas.height);
  const w = mn * 0.5 * (0.9 + growthF * 0.15), h = mn * 0.32;
  const bands = [S.bands.subBass, S.bands.bass, S.bands.lowMid, S.bands.mid, S.bands.highMid, S.bands.air];
  const n = bands.length, bw = w / n;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#0c0c10";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = "rgba(205,212,222,0.4)"; ctx.lineWidth = Math.max(1, mn * 0.003);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.globalCompositeOperation = "lighter";
  const onset = Math.max(S.kickOnset || 0, S.snareOnset || 0);
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(1, bands[i]));
    const bh = v * h * 0.92;
    const bx = -w / 2 + i * bw + bw * 0.12;
    ctx.fillStyle = `hsl(${(hue + i * 22) % 360},${P.sat}%,56%)`;
    ctx.fillRect(bx, h / 2 - bh, bw * 0.76, bh);
    eqPeaks[i] = Math.max(v + onset * 0.15, eqPeaks[i] - 0.012);
    const py = h / 2 - eqPeaks[i] * h * 0.92;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(bx, py - 1, bw * 0.76, Math.max(1.5, mn * 0.004));
  }
  ctx.restore();
}
```
`eqPeaks` ist bewusst modulweiter State (gleiches Muster wie `prevLoud`/`prevKick`/`prevSnare`
aus der letzten Runde) — hält den Peak-Hold-Wert pro Balken über Frames hinweg, klingt mit
`-0.012`/Frame langsam ab, springt bei einem Kick/Snare-Onset kurz nach oben
(`v + onset * 0.15`). Da `S.bands`/`S.kickOnset`/`S.snareOnset` außerhalb der Live-Wiedergabe
bei `0` bleiben (siehe [[project_morph_frequency_bands]]-Spec), zeigt das EQ in Idle/Pause
korrekt "still" — kein Sonderfall nötig.

### 2. Dispatch-Verdrahtung

Neue Zeile in `drawScene()` (`elastic-morph.html:4652-4654`), zwischen dem bestehenden
`tape`- und `sacred`-Zweig:
```js
} else if (dnaEngine === "tape") {
  drawTape(base, hue, growthF, energySize, seed);
} else if (dnaEngine === "eq") {
  drawEqualizer(base, hue, growthF, energySize, seed);
} else if (dnaEngine === "sacred") {
```

### 3. Preset-Eintrag

Neuer Eintrag im `PRESETS`-Array, direkt nach dem bestehenden `"tape"`-Preset
(`elastic-morph.html:2358`, vor dem Sacred-Geometry-Kommentarblock), gleiche Feld-Struktur wie
jedes andere Nicht-Blob-Preset:
```js
{
  id: "eq", name: "Graphic EQ",
  desc: "6-Band-Equalizer — reagiert direkt auf die Frequenzbänder. Technisch, clean, DJ-Set.",
  hue: 190, hueEnd: 220, sat: 75, bgFade: 0.5,
  layers: 1, points: 0, noiseAmp: 0, speed: 0.4,
  particles: 0, particleStyle: "spark", symmetry: 1,
  verticalStretch: 1.0, grain: 0.05, lineMode: false, petals: 0, glass: false,
  motion: "orbit", flowBias: 0, constellation: false, bloom: 0.4, waveRing: false,
  engine: "eq",
  gradient: ["#04141c", "#0d3a52", "#4bd6f5"]
},
```
Farbverlauf Cyan/Blau, bewusst abgesetzt von Tapes Braun/Amber. Exakte Hue/Sat/Gradient-Werte
sind Startpunkte fürs Live-Tuning, kein Spec-Fixpunkt — gleiches Vorgehen wie bei Paletten/
Feedback-Loop-Defaults in den letzten Runden.

### 4. Preset-Vorschau (Mini-Canvas)

Neuer Zweig in `buildPresets()`s Vorschau-Rendering (`elastic-morph.html`, im bestehenden
`if (p.engine === "...") {...} else if (...) {...}`-Ketten-Muster, direkt nach dem
`"tape"`-Zweig, Zeile ~6103-6112), simulierte Balken statt echter Audiodaten (Vorschau-Canvas
hat keine Live-Wiedergabe — gleiches Prinzip wie der bestehende `dance`/`else`-Zweig, Zeile
6122-6125):
```js
} else if (p.engine === "eq") {
  const nb = 6, bw = W / nb;
  for (let i = 0; i < nb; i++) {
    const v = 0.3 + 0.6 * Math.abs(Math.sin(i * 0.9 + t * 2.2 + pv.seed));
    const bh = v * H * 0.42;
    c.fillStyle = `hsl(${(hue + i * 22) % 360},${p.sat}%,56%)`;
    c.fillRect(-W / 2 + i * bw + 1, H * 0.5 - bh, bw - 2, bh);
  }
}
```

## Out of Scope

- **Zweite DNA-Bank** — eigene, spätere Runde, wenn mehr neue Visuals existieren.
- **Sequencer-Grid, Radio-Tuner, VU-Meter-Wand** — Backlog, eigene Design-Runden.
- **Kein neuer UI-Regler** — nutzt ausschließlich bestehende DNA-Controls.
- **Keine Änderung an `S.bands`/`S.kickOnset`/`S.snareOnset`** — reiner Konsument der in
  [[project_morph_frequency_bands]] geschaffenen Signale, keine Änderung an deren Berechnung.
- **Kein Export-/Feature-Timeline-Sonderfall** — die Engine liest `S.bands` genau wie jede
  andere Engine `S.bass`/`S.mids`/`S.highs` liest; das Verhalten während HQ-Export folgt
  automatisch demselben (bereits bestehenden) Pfad, keine eigene Export-Logik nötig.

## Testing

- `test.js`: neue Assertions (Muster wie bestehende Engine-/Preset-Checks):
  - `drawEqualizer` als Funktion definiert, enthält `S.bands.subBass`/`.bass`/`.lowMid`/`.mid`/
    `.highMid`/`.air`, `S.kickOnset`, `S.snareOnset`.
  - `drawScene`s Dispatch-Kette enthält den neuen `dnaEngine === "eq"`-Zweig, ruft
    `drawEqualizer(base, hue, growthF, energySize, seed)`.
  - `PRESETS` enthält den `id: "eq"`-Eintrag mit `engine: "eq"`.
  - Preset-Vorschau-Kette (`buildPresets()`) enthält den neuen `p.engine === "eq"`-Zweig.
  - **Regressionscheck:** bestehende Engine-Dispatch-Zweige (`tape`, `sacred`, etc.) bleiben
    byte-identisch — der neue Zweig wird nur eingefügt, nichts Bestehendes verändert.
- `node test.js` muss vor und nach der Änderung für alle bestehenden Assertions grün bleiben.
- Manueller Live-Check (Pro-Modus, Demo-Track mit klarem Kick/Snare-Pattern): "Graphic EQ"-Preset
  auswählen, prüfen dass alle 6 Balken sichtbar unterschiedlich auf Bass/Mids/Highs/Air reagieren,
  Peak-Hold-Kappen blitzen bei Kick/Snare auf und klingen sichtbar ab, Verhalten in Pause/Idle
  zeigt korrekt "still" (keine Balken), Vorschau-Karte im Preset-Picker zeigt ein simuliertes
  Balken-Muster (nicht leer/kaputt).
