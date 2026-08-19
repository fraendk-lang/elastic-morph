# Elastic Morph — Layer B Modulation (Opacity + Scale LFO)

## Kontext

Drittes Teilprojekt aus der Brainstorm-Runde (nach Blend-Modes und FX Rack III). Layer B hat
schon eine Art Modulation für `spin`/`sway`/`hueDrift`/`pulse` (feste Formeln, nur Tiefe
einstellbar — siehe `elastic-morph.html:2480`, Kommentar `// v43: modulation`), aber `opacity`
und `scale` sind komplett statisch.

**Architektur-Check:** Anders als FX Rack III liegt Layer B komplett im **statischen** Bereich
von `elastic-morph.html` (`S.layerB` bei Zeile 2480, `drawLayerB` bei Zeile 5056 — beide weit vor
dem `@BUILD-INJECT-V58`-Marker bei Zeile 8592, nicht in `src/inject-v*.js`). Direkte HTML-Edits,
kein `node build.js` nötig.

## Ziel

Opacity und Scale bekommen je einen unabhängigen LFO (Rate + Tiefe + Form), nach dem gleichen
Muster wie die bestehenden `_spin`/`_hue`-Akkumulatoren (dt-getrieben, deterministisch für
Export).

## Datenmodell

`S.layerB` (Zeile 2480) bekommt zwei neue Felder:

```js
opLfo: { rate: 0.3, depth: 0, shape: "sine" },
scaleLfo: { rate: 0.3, depth: 0, shape: "sine" },
```

`rate` in Hz (0.05–4, siehe UI-Mapping unten), `depth` 0–1 (Anteil ±Modulation um den Basiswert),
`shape` ∈ `"sine" | "triangle" | "square"`. Default `depth: 0` → keine Verhaltensänderung für
bestehende Presets/Projekte, die diese Felder noch nicht kennen (`Object.assign` beim Laden
älterer Presets lässt fehlende Felder auf dem Default).

## LFO-Berechnung

Neue Helper-Funktion, neben `LAYERB_TYPES` (Zeile ~5008):

```js
function lfoWave(shape, phase) {
  const p = phase - Math.floor(phase);   // 0..1
  if (shape === "square") return p < 0.5 ? 1 : -1;
  if (shape === "triangle") return p < 0.5 ? (4 * p - 1) : (3 - 4 * p);
  return Math.sin(p * Math.PI * 2);      // sine (default)
}
```

In `drawLayerB` (Zeile 5056), zwei neue Phasen-Akkumulatoren neben den bestehenden
`_spin`/`_hue` (gleicher `!S.frozen`-Guard, damit Export deterministisch bleibt):

```js
if (!S.frozen) {
  LB._spin = (LB._spin || 0) + dt * LB.spin * 1.4;
  LB._hue = (LB._hue || 0) + dt * LB.hueDrift * 60;
  LB._opPhase = (LB._opPhase || 0) + dt * LB.opLfo.rate;
  LB._scPhase = (LB._scPhase || 0) + dt * LB.scaleLfo.rate;
}
```

Anwendung — multiplikativ um den Basiswert, gleiches Prinzip wie `pulse`s
`1 + audio*depth`-Formel, mit `clamp01` für Opacity (Scale braucht keine Clamp, negative
Werte sind bei realistischen Tiefen nicht erreichbar):

```js
ctx.globalAlpha = clamp01(LB.opacity * (1 + LB.opLfo.depth * lfoWave(LB.opLfo.shape, LB._opPhase)));
...
const sc = LB.scale * (1 + LB.scaleLfo.depth * lfoWave(LB.scaleLfo.shape, LB._scPhase));
```

(`sc` wird schon heute pro Frame einmal aus `LB.scale` gelesen und in die Geometrie der
einzelnen Overlay-Typen multipliziert — eine Zeile Änderung an der Definition reicht, kein
Change in den einzelnen `case`-Blöcken nötig.)

## UI

Zwei neue Abschnitte im Layer-B-Panel (nach dem bestehenden `Hue Drift`-Regler, vor
`Mirror`-Select), gleiches Slider-Markup wie die bestehenden Regler:

- **Opacity LFO**: Rate-Slider (0–100 → 0.05–4 Hz), Tiefe-Slider (0–100%), Form-Select
  (Sinus/Dreieck/Rechteck)
- **Scale LFO**: gleiche drei Regler, eigener State

IDs: `lbOpLfoRate`/`lbOpLfoDepth`/`lbOpLfoShape`, `lbScLfoRate`/`lbScLfoDepth`/`lbScLfoShape`.
Rate-Mapping: `hz = 0.05 + (slider/100) * 3.95`.

## Out of Scope

- Keine Mod-Matrix (freies Routing) — nur die zwei festen Ziele Opacity/Scale
- Keine LFO für `spin`/`sway`/`hueDrift`/`pulse` — die haben schon eine Form von Modulation,
  bleiben unverändert
- Kein Tempo-Sync (LFO-Rate an BPM koppeln) — reine Zeit-basierte Hz-Rate

## Testing

- `test.js`: Assertion, dass `lfoWave` existiert und für alle 3 Formen sinnvolle Werte liefert
  (z. B. `lfoWave("sine", 0) === 0`, `lfoWave("square", 0) === 1`, `lfoWave("triangle", 0) === -1`),
  plus Assertion, dass `S.layerB` beide neuen LFO-Objekte mit `depth: 0` Default hat (bestehende
  Presets/Projekte bleiben unverändert im Verhalten)
- Manueller Check (live): Tiefe hochziehen bei aktivem Layer B, bestätigen dass Opacity/Scale
  sichtbar pulsieren, alle 3 Formen unterscheidbar sind, und bei Tiefe 0 exakt das alte
  (unmodulierte) Verhalten rauskommt
