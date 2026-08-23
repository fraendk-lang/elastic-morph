# Elastic Morph — Feedback Loop Deepening (Round 1: Controls + New Mechanics)

## Kontext

Zweiter Punkt der Roadmap aus der Competitive-Analysis-Runde (siehe
[[project_morph_palette_system]]/Session-Notizen — Reihenfolge: Paletten-System ✅, dann
**Feedback-Loop-Vertiefung**, dann Frequenzband-Reaktivität, dann Community-Look-Gallery, dann
Live-Kamera zuletzt). Frank stufte diesen Punkt explizit als "ganz wichtig" ein.

Der bestehende "Feedback"-Effekt (`elastic-morph.html`, FX Rack I, `S.fx.feedback`) ist ein
klassischer Video-Feedback-Loop (Bild wird gezoomt/rotiert auf sich selbst zurückgefüttert, wie
eine Kamera auf ihren eigenen Monitor gerichtet) — aktuell aber nur ein einfacher An/Aus-Chip
ohne einstellbare Parameter; Zoom (1.045), Rotation (0.012 rad + Stereo-Modulation), Decay
(0.28) und Alpha (0.38 + Beat-Modulation) sind hart im Code verdrahtet
(`applyPostFX`, Zeilen 5527-5544).

**Nicht zu verwechseln mit** dem Shader-Engine-Style "Feedback Fractal" (`feedbackStyle`,
GLSL) — andere Mechanik, andere Baustelle, in dieser Runde nicht angefasst (per User-Bestätigung
2026-08-23).

## Entschiedene Fragen (User-bestätigt 2026-08-23)

- **Scope-Aufteilung:** Diese Runde bringt echte Regler für die 4 bestehenden Parameter
  (Zoom/Rotation/Decay/Alpha) **plus** 3 neue Mechaniken (Farb-Shift pro Iteration,
  Richtungs-Versatz, wählbarer Blend-Mode). **Mehrfach-Tap** (2-3 überlagerte Feedback-Loops)
  ist explizit auf eine **spätere, eigene Spec-Runde** verschoben — eigene Puffer-Architektur,
  neue Performance-Fragen, zu groß für diese Runde.
- **UI-Ort:** Neues eigenes Panel "Feedback Loop" (Struktur wie das Layer-B-Panel), nicht ein
  aufklappbarer Bereich unter dem FX-Rack-Chip. Der FX-Rack-Chip bleibt als zweiter,
  gleichwertiger An/Aus-Zugang bestehen (beide steuern denselben `S.fx.feedback`-Wert).
- **Datenmodell:** Neue Parameter kommen in ein **separates** State-Objekt `S.feedbackFX`, nicht
  in `S.fx` selbst — `S.fx` ist eine reine Boolean-Map, über die mehrere Stellen im Code blind
  mit `Object.keys(S.fx).forEach(...)` iterieren (Zufalls-FX-Auswahl, Cue-System,
  Basis-Szene-Reset); Zahlenwerte dort würden diese Stellen brechen.
- **Alle Default-Werte entsprechen exakt den heutigen Hardcode-Werten** — "Feedback an, Regler
  unverändert" muss sich exakt wie das heutige Verhalten anfühlen.
- **Exakte Slider-Wertebereiche sind Startwerte fürs Live-Tuning**, kein Spec-Fixpunkt — gleiches
  Vorgehen wie bei den Paletten-Ankerfarben.
- **Kein MIDI-Mapping, keine neuen Tastatur-Shortcuts** in dieser Runde (folgt dem Präzedenzfall
  der Paletten-Runde).

## Ist-Zustand

`S.fx` (Zeile ~2528): reine Boolean-Map, u.a. `{ mirror: false, kaleido: false, feedback: false,
tile: false, rgb: false, ... }`. `FX_DEFS` (Zeile ~6438-6449) definiert die FX-Rack-I-Chips
inkl. `["feedback", "Feedback", "echoing delay trails"]`; `buildFX()`/`toggleFX()`/`syncFXUI()`
(Zeile ~6463-6489) rendern die Chips generisch aus diesem Array und toggeln `S.fx[key]`.

`applyPostFX(W, H)` (Zeile 5520 ff.), der Feedback-Block (Zeile 5527-5544):
```js
if (fx.feedback) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.38 + S.beat * 0.08;
  ctx.translate(W / 2, H / 2);
  ctx.scale(1.045, 1.045);
  ctx.rotate(0.012 + S.stereo * 0.01);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(fbC, 0, 0, W, H);
  ctx.restore();
  fbctx.globalCompositeOperation = "copy";
  fbctx.globalAlpha = 1;
  fbctx.drawImage(canvas, 0, 0, fbC.width, fbC.height);
  fbctx.globalCompositeOperation = "source-over";
  fbctx.fillStyle = "rgba(0,0,0,0.28)";
  fbctx.fillRect(0, 0, fbC.width, fbC.height);
}
```
`fbC`/`fbctx` (Zeile 2572) ist ein separates Offscreen-Canvas, das rekursiv den akkumulierten
Feedback-Puffer hält — jedes zurückgezeichnete Frame enthält implizit alle vorherigen.

Referenz-Muster für "Toggle + reiches State-Objekt mit vielen Reglern": `S.layerB` (Zeile
~2546), dessen Panel-HTML (`<h3>Layer B</h3>`, ab Zeile ~1823) und dessen Persistenz-Handling in
`applyProject` (Zeile ~6857-6875, feldweise mit `!= null ? +wert : default` und Clamping) sowie
`projectData()` (Zeile ~6640: `layerB: (() => { const { _spin, _hue, _opPhase, _scPhase, ...rest
} = S.layerB; return rest; })()` — internal LFO-Phasen-Akkumulatoren werden bewusst von der
Serialisierung ausgeschlossen, siehe [[project_elastic_universe]]-Notizen zum Undo/Redo-Bug, den
das behoben hat). `#lbBlend` (Zeile 1826-1836) liefert die 9-Optionen-Blend-Mode-Liste, die diese
Runde wiederverwendet.

## Soll-Zustand

### 1. Datenmodell

Neues State-Objekt, initialisiert neben `S.layerB`/`S.palette`:
```js
S.feedbackFX = {
  zoom: 1.045,       // 1.00 = kein Wachstum, höher = schnellerer Spiral-Zoom
  rotation: 0.69,    // Grad/Frame (≈ heutiges 0.012 rad), UI-freundliche Einheit — Konvertierung
                      // zu Radiant passiert erst beim Rendern (Abschnitt 3); Audio-Kopplung
                      // (+stereo*0.01) bleibt in Radiant additiv, da sie das schon war
  decay: 0.28,        // Alpha der Schwarz-Abdunkelung pro Frame — höher = kürzere Trails
  alpha: 0.38,         // Rückfütterungs-Deckkraft — bestehende +beat*0.08 bleibt additiv
  hueShift: 0,          // Grad Hue-Rotation pro Frame, akkumuliert rekursiv über die Trail-Tiefe
  dirX: 0, dirY: 0,      // Richtungs-Drift als Bruchteil von W/H (0 = heutiges Verhalten, mittig)
  blend: "lighter"        // Compositing-Modus, heutiger Default bleibt
};
```
Anders als `S.layerB` braucht `S.feedbackFX` **keine** internen Phasen-Akkumulator-Felder (kein
`_spin`-Äquivalent) — alle Werte sind direkte Pro-Frame-Inkremente ohne fortlaufenden internen
Zustand, deshalb ist eine einfache Voll-Spreizung bei der Persistenz sicher (siehe Abschnitt 4).

### 2. UI — neues "Feedback Loop"-Panel

Neuer Panel-Abschnitt (Struktur wie das Layer-B-Panel, Zeile ~1823 ff.):
```html
<div class="divider"></div>
<h3>Feedback Loop</h3>
<label class="check" style="margin-bottom:10px"><input type="checkbox" id="fbOn"> Enable feedback loop</label>
<select id="fbBlend" class="pm-select">
  <option value="lighter" selected>Blend: Add</option>
  <option value="screen">Blend: Screen</option>
  <option value="source-over">Blend: Normal</option>
  <option value="multiply">Blend: Multiply</option>
  <option value="overlay">Blend: Overlay</option>
  <option value="difference">Blend: Difference</option>
  <option value="color-dodge">Blend: Color Dodge</option>
  <option value="hard-light">Blend: Hard Light</option>
  <option value="hue">Blend: Hue</option>
</select>
<div class="slider-row" style="margin-top:10px">
  <label>Zoom <span class="val" id="fbZoomVal">4.5</span></label>
  <input type="range" id="fbZoom" min="0" max="15" value="4.5" step="0.5">
</div>
<div class="slider-row">
  <label>Rotation° <span class="val" id="fbRotVal">0.69</span></label>
  <input type="range" id="fbRot" min="-3" max="3" value="0.69" step="0.01">
</div>
<div class="slider-row">
  <label>Decay <span class="val" id="fbDecayVal">28</span></label>
  <input type="range" id="fbDecay" min="5" max="60" value="28">
</div>
<div class="slider-row">
  <label>Intensität <span class="val" id="fbAlphaVal">38</span></label>
  <input type="range" id="fbAlpha" min="0" max="90" value="38">
</div>
<div class="slider-row">
  <label>Hue-Shift <span class="val" id="fbHueVal">0</span></label>
  <input type="range" id="fbHue" min="0" max="8" value="0" step="0.5">
</div>
<div class="slider-row">
  <label>Drift X <span class="val" id="fbDirXVal">0</span></label>
  <input type="range" id="fbDirX" min="-5" max="5" value="0">
</div>
<div class="slider-row">
  <label>Drift Y <span class="val" id="fbDirYVal">0</span></label>
  <input type="range" id="fbDirY" min="-5" max="5" value="0">
</div>
```
`#fbOn` synct bidirektional mit `S.fx.feedback` (bestehender FX-Rack-Chip bleibt der zweite
Zugang — `toggleFX("feedback")` und die neue `#fbOn`-Checkbox schreiben beide auf denselben
`S.fx.feedback`-Wert und rufen `syncFXUI()` bzw. eine neue `syncFeedbackFXUI()` gegenseitig auf,
damit beide UI-Stellen immer synchron bleiben). Zoom/Rotation/Hue-Shift nutzen sichtbare
Dezimalwerte direkt (kleine, feine Bereiche); Decay/Intensität/Drift folgen dem etablierten
0-100-Skalen-Muster (`value / 100` beim Schreiben nach `S.feedbackFX`, siehe Abschnitt 3) —
Zahlen sind Startwerte für die Live-Tuning-Runde.

### 3. Render-Logik — `applyPostFX`

Feedback-Block (Zeile 5527-5544) wird zu:
```js
if (fx.feedback) {
  const F = S.feedbackFX;
  ctx.save();
  ctx.globalCompositeOperation = F.blend;
  ctx.globalAlpha = F.alpha + S.beat * 0.08;
  ctx.translate(W / 2 + F.dirX * W, H / 2 + F.dirY * H);
  ctx.scale(F.zoom, F.zoom);
  ctx.rotate(F.rotation * Math.PI / 180 + S.stereo * 0.01);
  ctx.translate(-W / 2, -H / 2);
  if (F.hueShift) ctx.filter = `hue-rotate(${F.hueShift}deg)`;
  ctx.drawImage(fbC, 0, 0, W, H);
  ctx.filter = "none";
  ctx.restore();
  fbctx.globalCompositeOperation = "copy";
  fbctx.globalAlpha = 1;
  fbctx.drawImage(canvas, 0, 0, fbC.width, fbC.height);
  fbctx.globalCompositeOperation = "source-over";
  fbctx.fillStyle = `rgba(0,0,0,${F.decay})`;
  fbctx.fillRect(0, 0, fbC.width, fbC.height);
}
```
Der Hue-Shift wird **nur** beim Zurückzeichnen von `fbC` angewendet (nicht beim Speichern in
`fbctx`) — da `fbC` schon rekursiv alle vorherigen Frames enthält, akkumuliert sich die Rotation
über die Trail-Tiefe von selbst: jede Echo-Schicht ist ein bisschen weiter rotiert als die davor,
ohne dass pro Layer manuell nachgehalten werden muss, wie tief sie ist. Der `ctx.filter`-Reset
(`"none"`) direkt danach verhindert, dass der Filter in nachfolgende, unabhängige Draw-Calls im
selben Frame durchsickert (Reihenfolge-Kommentar Zeile 5513: `feedback -> mirror/kaleido -> tile
-> rgb split -> invert` — alles danach muss unbeeinflusst bleiben).

Die Richtungs-Drift (`dirX`/`dirY`) verschiebt den Zoom-/Rotations-Pivot selbst, statt ein
zweiter, unabhängiger Compositing-Pass zu sein — bleibt bei einem `drawImage`-Aufruf pro Frame,
kein Performance-Sprung gegenüber heute.

### 4. Persistenz

`S.feedbackFX` wird komplett gespeichert (`projectData()`, Zeile ~6640, neue Zeile:
`feedbackFX: { ...S.feedbackFX },` direkt neben `layerB`) — anders als bei `layerB` **ohne**
Feld-Ausschluss, da keine internen Akkumulatoren existieren (siehe Abschnitt 1). Laden
(`applyProject`, analog zu Zeile ~6857-6875) restauriert feldweise mit Fallback auf die
Hardcode-Defaults:
```js
const fb = o.feedbackFX || {};
S.feedbackFX.zoom = fb.zoom != null ? +fb.zoom : 1.045;
S.feedbackFX.rotation = fb.rotation != null ? +fb.rotation : 0.69;
S.feedbackFX.decay = fb.decay != null ? +fb.decay : 0.28;
S.feedbackFX.alpha = fb.alpha != null ? +fb.alpha : 0.38;
S.feedbackFX.hueShift = fb.hueShift != null ? +fb.hueShift : 0;
S.feedbackFX.dirX = fb.dirX != null ? +fb.dirX : 0;
S.feedbackFX.dirY = fb.dirY != null ? +fb.dirY : 0;
S.feedbackFX.blend = fb.blend || "lighter";
```
Landet damit automatisch in Scene Banks und Share-Links, ohne Sonderbehandlung — gleiches Muster
wie bei `S.palette` in der letzten Runde.

## Out of Scope

- **Mehrfach-Tap** (2-3 überlagerte Feedback-Loops mit eigenen Puffern) — eigene, spätere
  Spec-Runde.
- **Kein MIDI-Mapping** für die neuen Regler.
- **Keine neuen Tastatur-Shortcuts** — der bestehende FX-Rack-Chip-Zugang reicht.
- **Keine Änderung an der "Feedback Fractal"-Shader-Style** (`feedbackStyle`, GLSL) — andere
  Mechanik, nicht Teil dieser Runde.
- **Kein neuer Performance-Guard/Heavy-Klassifizierung** — der neue Code bleibt bei einem
  `drawImage`-Aufruf pro Frame wie heute, kein Anlass für eine `HEAVY_SHADER`-artige Behandlung.

## Testing

- `test.js`: neue Assertions (Muster wie die bestehenden `S.palette`/`S.layerB`-Checks):
  - `S.feedbackFX`-Initialisierung im Skript-Quelltext vorhanden, alle 8 Felder mit den
    dokumentierten Default-Werten.
  - Neue Panel-HTML-Elemente (`#fbOn`, `#fbBlend`, `#fbZoom`, `#fbRot`, `#fbDecay`, `#fbAlpha`,
    `#fbHue`, `#fbDirX`, `#fbDirY`) vorhanden, jeweils mit passendem Event-Listener.
  - `#fbOn` und der bestehende FX-Rack-Chip bleiben nach einem Toggle synchron (beide spiegeln
    `S.fx.feedback`).
  - `applyPostFX`s Feedback-Block nutzt `F.zoom`/`F.rotation`/`F.decay`/`F.alpha`/`F.blend`
    statt der alten Hardcode-Werte, `hue-rotate`-Filter wird nur beim `fbC`-Rückzeichnen gesetzt
    (nicht beim `fbctx`-Speichern), `ctx.filter` wird danach zurückgesetzt.
  - `projectData()`/`applyProject`-Rundlauf für `feedbackFX` (Save → Load stellt alle 8 Felder
    korrekt wieder her, inkl. Fallback-Defaults bei fehlenden Feldern in alten Save-Dateien).
  - **Regressionscheck:** mit allen `S.feedbackFX`-Werten auf den dokumentierten Defaults muss
    der erzeugte Code-Pfad exakt dem heutigen Verhalten entsprechen (`F.zoom === 1.045` etc. —
    keine neue Modulation, kein Hue-Shift, kein Drift, `lighter`-Blend).
- `node test.js` muss vor und nach der Änderung für alle bestehenden Assertions grün bleiben.
- Manueller Live-Check (Pro-Modus, Demo-Track): Feedback-Loop über beide Zugänge (Chip + Panel)
  an/aus schalten, alle 8 Regler einzeln durchtesten, Persistenz-Rundlauf über Scene-Bank-Save/
  Load, Vergleich "alle Regler auf Default" gegen den vorherigen (Vor-Feature-)Look zur
  Regressionsprüfung.
