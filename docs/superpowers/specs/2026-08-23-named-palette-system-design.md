# Elastic Morph — Named Palette System (Shader Engine + Layer B)

## Kontext

Kam aus einem Competitive-Analysis-Gespräch (Elastic Morph vs. Synesthesia/Milkdrop-Butterchurn/
Resolume/TouchDesigner/VS/HeavyM/Magic Music Visuals), in dem ein formales Paletten-System als
das am schnellsten umsetzbare der vier empfohlenen neuen Creative-Features markiert wurde — u.a.
weil die Vorarbeit aus dem letzten Feature ([[project_scene_banks_expansion]]-Nachbar-Spec
`2026-08-22-shader-eyecatcher-palette-fx-design.md`) schon zwei Ankerfarben-Konzepte in vier
Styles etabliert hat. Frank will dieses Feature bewusst **sichtbar und beworben** halten — im
Gegensatz zur letzten Runde, in der Farbmischung explizit *ohne* neue UI blieb (siehe
`Entschiedene Fragen` in der Vorgänger-Spec: „Kein neues Paletten-Feature").

**Korrektur einer falschen Annahme aus der letzten Session:** Die vier bereits gemischten Styles
liegen **nicht** in `src/inject-v62.js` (dort nicht gefunden), sondern direkt und ausschließlich
in `elastic-morph.html` selbst — der GLSL-Shader-Code (`SHADER_FRAG`, Zeilen ~3008-3266) liegt
komplett **vor** dem generierten Build-Bereich (`/* @BUILD-INJECT-V58 */` bis `/* ---- boot ---- */`,
aktuell Zeilen 8778-16004). Ebenso liegen das Palette-Panel-HTML (Zeilen 1393-1414), die
Save/Load-Logik (Zeilen 6568, 6676-6679), `drawPalettePreview`/`syncPaletteUI` (Zeilen 7536-7557)
und `drawLayerB` (Zeile 5147) alle **außerhalb** des generierten Bereichs — direkt in
`elastic-morph.html` editierbar, nicht in `src/inject-*.js`. Der Build-Gotcha aus der letzten
Spec gilt nur für Code, der tatsächlich innerhalb 8778-16004 landet; für dieses Feature ist das
voraussichtlich kein Code (siehe Out of Scope).

## Entschiedene Fragen (User-bestätigt 2026-08-23)

- **Verhältnis zum bestehenden Palette-Panel:** Neuer Modus *im* bestehenden Panel (nicht
  Ersatz, nicht komplett separates Feature). Bestehender Hue/Spread/Sat-Regler bleibt als
  „Eigene Mischung" erhalten.
- **Reichweite Shader Engine:** Alle 12 Styles bekommen echtes 2-Farben-Mixing im Named-Modus,
  nicht nur die 4 bereits umgebauten. Fallback aufs bisherige Verhalten bleibt für alle 12
  erhalten, wenn der Modus aus ist — keine Regression an den 8 unangetasteten Styles im
  Custom-HSL-Modus.
- **Erstes Paletten-Set:** Claude schlägt vor (analog zum Live-Tuning-Muster der letzten Runde),
  Frank bestätigt Namen/Richtung, exakte Hex-Werte werden live im Browser fein-getunt.
- **UI-Ort:** Kein neues Panel — Modus-Umschalter direkt unter der bestehenden `#palOn`-Checkbox
  im „Palette"-Bereich.

## Ist-Zustand

**Bestehendes Palette-Panel** (`elastic-morph.html:1393-1414`): Checkbox `#palOn` („eigene
Farben statt Preset-Gradient"), Regler `#palHue`/`#palSpread`/`#palSat`, Preview-Canvas
`#palPreview`, Button „Palette aus Cover-Bild". State in `S.palette = {on, hue, spread, sat}`.

**Datenfluss heute:** `currentDNA()` (Zeile 2907-2917) überschreibt bei `S.palette.on` die
DNA-Farbgene (`dna.hue`, `dna.hueEnd`, `dna.sat`). Die render-weite Variable `hue` (Zeile ~4295:
`S.palette.on ? S.palette.hue : (currentDNA().hue || 280)`) fließt in drei Stellen:
1. `gl.uniform1f(L.hue, ...)` (Zeile 3375) → Shader-Uniform `uHue`
2. `drawLayerB(W, H, hue, dt)` (Zeile 4672) → dortiger `colr()`-Helper (Zeile 5159-5163)
3. Weitere Canvas2D-Layer (Partikel etc.), außerhalb dieses Specs

**Shader Engine — 12 Style-Funktionen** (`SHADER_FRAG`, alle vor Zeile 3266):

| Style | Funktion (Zeile) | Farbmechanik heute |
|---|---|---|
| Fluid/Liquid | `fluidStyle` (3051) | `hsv2rgb` × 2 (Zeilen 3061-3062) |
| Metaballs/Plasma | `metaStyle` (3065) | `hsv2rgb` × 2 (3080-3081) |
| Tunnel/Kaleidoscope | `tunnelStyle` (3084) | `hsv2rgb` × 1 (3096) |
| Aurora | `auroraStyle` (3101) | **bereits** `mix(auroraA, auroraB, mixT)` (3119) |
| Electric/Blitz | `electricStyle` (3126) | `hsv2rgb` × 2 (3135, 3137) |
| Liquid Chrome | `chromeStyle` (3140) | `hsv2rgb` × 2 (3153, 3155) |
| Gyroid (3D Raymarch) | `gyroidStyle` (3159) | **bereits** `mix(gyroidA, gyroidB, mixT)` (3179-3180) |
| SDF Blob (Raymarch) | `raymarchStyle` (3184) | **bereits** `mix(hotA, hotB, mixT)` (3205) |
| Feedback Fractal | `feedbackStyle` (3209) | **bereits** `mix(feedbackA, feedbackB, mixT)` (3220) |
| Strobe | `strobeStyle` (3224) | `hsv2rgb` × 1 (3232) |
| Warehouse Fog | `warehouseStyle` (3236) | `hsv2rgb` × 1 (3244) |
| Laser Fans | `laserStyle` (3246) | `hsv2rgb` × 2 (3256, 3258) |

Jede hue-basierte Funktion berechnet lokal eine `hue`-Variable (Style-eigene Formel, z.B.
`fluidStyle` Zeile 3058: `float hue = uHue + 0.16*r.x + 0.10*f + uHighs*0.12;`) und ruft dann
`hsv2rgb(vec3(fract(hue), sat, val))` auf. Die 4 bereits gemischten Styles nutzen stattdessen
einen analog berechneten `mixT`-Skalar (z.B. `feedbackStyle` Zeile 3219:
`float mixT = fract(uHue + f*0.18 + a*0.12 + uHighs*0.08);`) mit fest im Code stehenden
`vec3`-Ankerfarben (z.B. `auroraA`/`auroraB`, Zeilen 3102-3103).

**Uniform-Setup:** Deklaration Zeilen 3010-3015, Location-Lookup Zeilen 3324-3335
(`GL.loc = {...}`), Wertzuweisung pro Frame Zeilen 3368-3377.

**Layer B** (`drawLayerB`, Zeile 5147): `colr(t, a)`-Helper (Zeile 5159-5163) liefert
`hsla(...)`-Strings; Modus `"dna"` (Default) nutzt `hue + t*50`, `"rainbow"` nutzt
`t*300 + S.time*30`, `"white"` ignoriert Farbe komplett. `LB.color` steuert die Auswahl
(`#lbColor`-Select, Zeile 1817-1820).

**Persistenz:** `S.palette` wird komplett gespeichert (`projectData()`, Zeile 6568:
`palette: {...S.palette}`) und geladen (Zeilen 6676-6679, feldweise mit Defaults). Scene-Bank-
Templates können `tpl.palette` mitliefern (Zeile 8198).

## Soll-Zustand

### 1. Datenmodell

`S.palette` bekommt zwei neue Felder:
```js
S.palette = { on: false, hue: 280, spread: 50, sat: 85, mode: "hsl", namedId: "toxic" }
```
`mode: "hsl"` (Default) = heutiges Verhalten unverändert. `mode: "named"` = neuer Modus.

Neue Konstante, in der Nähe der bestehenden DNA-Preset-Definitionen:
```js
const NAMED_PALETTES = [
  { id: "toxic",   name: "Toxic",    a: [0.05, 0.95, 0.15], b: [0.85, 0.05, 0.75] },
  { id: "sunset",  name: "Sunset",   a: [0.95, 0.45, 0.05], b: [0.45, 0.10, 0.75] },
  { id: "deepsea", name: "Deep Sea", a: [0.00, 0.70, 0.90], b: [0.05, 0.10, 0.55] },
  { id: "cherry",  name: "Cherry",   a: [0.95, 0.10, 0.45], b: [0.45, 0.02, 0.10] },
  { id: "solar",   name: "Solar",    a: [0.95, 0.80, 0.10], b: [0.90, 0.30, 0.05] },
  { id: "void",    name: "Void",     a: [0.35, 0.10, 0.75], b: [0.04, 0.03, 0.10] },
];
```
RGB-Werte (0-1) sind Startwerte für die Live-Tuning-Runde, kein festgeschriebener Endzustand —
gleiches Vorgehen wie bei den Ankerfarben der letzten Spec.

### 2. UI im Palette-Panel

Unter `#palOn` (Zeile ~1396) kommt ein zweiteiliger Radio-/Segment-Switch:
`#palModeHsl` ("Eigene Mischung", Default, checked) / `#palModeNamed` ("Vordefiniert").

Bei `mode === "named"`:
- `#palHue`/`#palSpread`/`#palSat`-Zeilen (1398-1409) werden per CSS/JS ausgeblendet
- Neues `<select id="palNamed">`, Optionen aus `NAMED_PALETTES` generiert
- `#palFromCover`-Button wird deaktiviert (Cover-Extraktion liefert nur einen Hue-Wert, keine
  zwei Ankerfarben — Erweiterung dafür ist explizit Out of Scope)
- `drawPalettePreview()` (Zeile 7536) bekommt einen zweiten Zweig: bei `mode === "named"` zeigt
  die Preview einen echten 2-Farben-Gradient aus `NAMED_PALETTES.find(p => p.id === namedId)`
  statt der HSL-Sweep-Logik (Zeilen 7540-7543)

`syncPaletteUI()` (Zeile 7547) und die Event-Listener (Zeilen 7554-7557) bekommen die
entsprechenden Ergänzungen für Mode-Switch und `#palNamed`.

### 3. Shader Engine — alle 12 Styles

Neue Uniforms (nach Zeile 3015): `uniform float uPalOn; uniform vec3 uPalA; uniform vec3 uPalB;`

Location-Lookup (nach Zeile 3334 in `GL.loc`): `palOn`, `palA`, `palB` analog zu `intensity`.

Pro-Frame-Zuweisung (nach Zeile 3377):
```js
const namedActive = S.palette.on && S.palette.mode === "named";
const pal = namedActive ? NAMED_PALETTES.find(p => p.id === S.palette.namedId) : null;
gl.uniform1f(L.palOn, namedActive && pal ? 1 : 0);
if (pal) { gl.uniform3f(L.palA, ...pal.a); gl.uniform3f(L.palB, ...pal.b); }
```

**Die 4 bereits gemischten Styles** — bestehender Aufruf bekommt eine Abfrage davor, z.B.
`feedbackStyle` (Zeile 3220):
```glsl
vec3 col = mix(uPalOn > 0.5 ? uPalA : feedbackA, uPalOn > 0.5 ? uPalB : feedbackB, mixT) * (...);
```
`mixT`-Berechnung (Zeile 3219) bleibt exakt unverändert — nur welche zwei Farben gemischt
werden, ändert sich.

**Die 8 Hue-only-Styles** — jeder `hsv2rgb(vec3(fract(hue_expr), sat, val))`-Aufruf wird zu:
```glsl
uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue_expr)) * val : hsv2rgb(vec3(fract(hue_expr), sat, val))
```
`hue_expr` ist die jeweils bestehende, Style-eigene Formel (z.B. `fluidStyle` Zeile 3058:
`uHue + 0.16*r.x + 0.10*f + uHighs*0.12`) — unverändert, nur als Mix-Parameter statt Hue-Winkel
wiederverwendet. Bei Styles mit zwei `hsv2rgb`-Aufrufen (Fluid, Meta, Electric, Laser) bekommt
jeder Aufruf unabhängig dieselbe Behandlung mit seinem jeweiligen `hue`/`val`.

Wenn `uPalOn == 0` (Custom-HSL-Modus oder Palette komplett aus): exakt heutiges Verhalten, keine
Regression.

### 4. Layer B

`colr(t, a)` (Zeile 5159-5163) bekommt einen dritten Zweig:
```js
const colr = (t, a) => {
  if (LB.color === "white") return `rgba(255,255,255,${a})`;
  if (LB.color === "dna" && S.palette.on && S.palette.mode === "named") {
    const pal = NAMED_PALETTES.find(p => p.id === S.palette.namedId);
    if (pal) {
      const mixT = ((t % 1) + 1) % 1;
      const r = Math.round(255 * (pal.a[0] + (pal.b[0]-pal.a[0])*mixT));
      const g = Math.round(255 * (pal.a[1] + (pal.b[1]-pal.a[1])*mixT));
      const bch = Math.round(255 * (pal.a[2] + (pal.b[2]-pal.a[2])*mixT));
      return `rgba(${r},${g},${bch},${a})`;
    }
  }
  const h = (LB.color === "rainbow" ? (t * 300 + S.time * 30) : (hue + t * 50)) + (LB._hue || 0);
  return `hsla(${((h % 360) + 360) % 360}, 82%, 63%, ${a})`;
};
```
`LB.color` (`#lbColor`-Select: dna/rainbow/white) bleibt unverändert — Named Gradient wirkt nur
innerhalb von `"dna"`, exakt wie heute schon `S.palette` dort einfließt.

### 5. Persistenz

`projectData()` (Zeile 6568) speichert `S.palette` bereits vollständig als Objekt-Spread — die
zwei neuen Felder (`mode`, `namedId`) sind automatisch mit dabei, keine Änderung nötig. Load-Code
(Zeilen 6676-6679) bekommt zwei neue Zeilen mit Defaults:
```js
S.palette.mode = pl.mode === "named" ? "named" : "hsl";
S.palette.namedId = pl.namedId || "toxic";
```
Damit landet der gewählte Named-Gradient automatisch in Scene Banks, Save/Load und Share-Links.

## Out of Scope

- **Kein Build-Gotcha-Risiko erwartet:** Alle betroffenen Stellen liegen außerhalb des
  generierten Bereichs (8778-16004) — trotzdem vor dem Commit `node build.js && git diff --stat
  elastic-morph.html` (erwarteter Diff: keiner, da nichts in `src/inject-*.js` geändert wird)
  und `npm run ci` zur Sicherheit.
- **„Palette aus Cover-Bild" bleibt Hue-only.** Die Erweiterung, aus einem Cover-Bild zwei
  Ankerfarben statt eines Hue-Werts zu extrahieren, ist ein eigenes, späteres Feature.
- **Kein MIDI-Mapping für Named-Palette-Auswahl.** Die bestehenden `palHueM`/`palSatM`-MIDI-
  Parameter (Zeilen 8096-8097) bleiben unverändert; ein MIDI-Parameter zum Durchschalten der
  Named Palettes ist nicht Teil dieser Runde.
- **Keine Tastatur-Shortcuts** (z.B. Arrow-Key-Cycle wie bei Preset/Shader-Style) zum
  Durchschalten der Named Palettes — kann später als eigenes kleines Follow-up ergänzt werden,
  analog zu [[project_arrow_key_preset_switch]]/[[project_morph_arrow_key_trio]].
- **Reihenfolge der übrigen Roadmap-Punkte** (Feedback-Loop-Vertiefung, Frequenzband-
  Reaktivität, Community-Look-Gallery, Live-Kamera-Layer zuletzt) bleibt wie in der letzten
  Session festgelegt — nicht Teil dieser Spec.

## Testing

- `test.js`: neue Sektion „Named Palette System" mit Assertions (Muster wie bestehende
  `extractGlslFn`-Nutzung, Zeilen 690-701 & 703-714):
  - `NAMED_PALETTES` im Skript-Quelltext vorhanden, enthält alle 6 IDs
  - Für alle 4 bereits gemischten Styles: `fn.includes("uPalOn > 0.5 ? uPalA")` (oder äquivalentes
    Muster je nach finaler Formatierung)
  - Für alle 8 Hue-only-Styles: `fn.includes("uPalOn > 0.5 ? mix(uPalA, uPalB")`
  - **Regressionscheck:** bestehende Assertion „fluidStyle/.../laserStyle untouched (no
    applyEyeCatcherFX call)" (Zeile 703-714) muss weiterhin grün bleiben — dieses Feature ruft
    `applyEyeCatcherFX` nirgends neu auf, ändert nur die Farbquelle vor dem bestehenden Aufruf.
  - `drawLayerB`/`colr`-Helper enthält den neuen `S.palette.mode === "named"`-Zweig
  - Save/Load-Roundtrip: `projectData()` gefolgt von Load stellt `mode`/`namedId` korrekt wieder
    her (Default-Fallback bei fehlenden Feldern in alten Save-Dateien)
- `node test.js` muss vor und nach der Änderung für alle bestehenden Assertions grün bleiben.
- Manueller Live-Check (Pro-Modus, Demo-Track): alle 12 Styles im Named-Modus durchschalten,
  jeweils gegen Custom-HSL-Modus vergleichen (keine Regression bei `mode: "hsl"` oder `on: false`);
  Layer-B-Overlay im `dna`-Farbmodus mit aktivem Named-Gradient prüfen; Scene-Bank speichern/laden
  mit aktivem Named-Gradient prüfen (Persistenz-Roundtrip in echter UI, nicht nur Unit-Test).
