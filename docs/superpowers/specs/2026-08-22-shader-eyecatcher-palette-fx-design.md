# Elastic Morph — Eye-Catcher Palette + Post-FX for Weak Shader Styles

## Kontext

Teil 1 der ursprünglichen "Shader-Eye-Catcher-Styles"-Idee aus der Brainstorm-Runde vom
2026-08-18 (siehe [[project_elastic_universe]]/Session-Notizen; Schwester-Themen aus derselben
Runde — DNA-Bewegung, FX-Rack-III, Layer-B-Modulation, Blend-Modes — sind bereits umgesetzt).

Live-Test aller 12 Shader-Engine-Styles (`elastic-morph.html`, `SHADER_FRAG`) mit echtem
Demo-Track ergab vier schwache Styles: **Aurora/Polarlicht** (verwaschener rosa Nebel, keine
erkennbaren Vorhang-Bänder), **Gyroid (3D Raymarch)** (fast flacher matschig-lila Screen),
**Feedback Fractal** (flacher Farbkeil-Verlauf) und **SDF Blob (Raymarch)** (war komplett
kaputt — Marsch-Logik-Bug bereits separat gefixt, siehe Commits davor in dieser Session; die
Farb-/Glow-Behandlung bleibt aber schwach). Sechs Styles sind bereits stark und werden nicht
angefasst: Tunnel/Kaleidoscope, Metaballs/Plasma, Electric/Blitz, Warehouse Fog, Liquid Chrome,
Laser Fans. Fluid/Liquid bleibt bewusst soft/ambient (Nutzer-Entscheidung 2026-08-22).

**Befund aus Code-Vergleich mit der Schwester-App Elastic Lab**
(`elastic-lab-nextgen4/constants.tsx`, `SHARED_DEFS` ab Zeile 282): Lab erreicht seine
durchgängig druckvolle Optik über zwei geteilte Bausteine, die *jeder* seiner 100+ Styles
automatisch mitbekommt — `getPaletteColor(t)` (Farbmischung zwischen zwei kuratierten
Ankerfarben statt freier Hue-Rotation) und `applyMasterFX(col, uv)` (Bloom, Chromatic-
Aberration-Anmutung, Vignette, Korn). Morphs aktuelle Styles nutzen dagegen pro Style eigene
`hsv2rgb(hue+...)`-Formeln ohne geteilte Nachbehandlung — das ist die Hauptursache für die
matschige Optik der vier schwachen Styles.

**Wichtige Abgrenzung zu bestehendem Code:** Morph hat bereits ein "Master Finish"-System
(Export-Feature: Vignette, Grain, Color Grade, Chromatic Aberration — `elastic-morph.html:1352`
ff.), das auf 2D-Canvas-Ebene beim Kompositieren/Export läuft, unabhängig vom Style. Dieses
Spec betrifft eine andere Ebene (innerhalb des GLSL-Fragment-Shaders, bevor der Shader-Layer
auf den 2D-Canvas gezeichnet wird) und stapelt sich einfach mit dem bestehenden System — kein
Konflikt, keine Änderung an Master Finish nötig.

## Entschiedene Fragen (User-bestätigt 2026-08-22)

- **Kein neues Paletten-Feature:** Keine neue UI (kein Dropdown wie in Lab), keine neuen
  Uniforms, kein neuer localStorage-Key. Jeder der 4 Styles bekommt stattdessen fest zwei
  eigene Ankerfarben zugeordnet (an seinen Charakter angepasst) — reine interne Farblogik-
  Verbesserung.
- **Post-FX nur für die 4 reparierten Styles**, nicht global für alle 12 — kein Risiko für die
  6 bereits starken Styles.
- **`main()` bleibt unverändert.** Der neue Post-FX-Aufruf sitzt jeweils am Ende der 4
  betroffenen Style-Funktionen, vor deren `return`. Die bestehende globale
  Vignette/Reinhard-Tonemap-Behandlung in `main()` läuft danach für alle 12 Styles unverändert
  weiter wie bisher.
- **Keine eigene Vignette im neuen Helper** — würde sich mit der globalen Vignette in `main()`
  doppeln und unnötig abdunkeln. Der neue Helper deckt nur Bloom, Chromatic-Aberration-
  Anmutung und Korn ab.
- **Exakte Farbwerte werden live im Browser getunt**, nicht als Zahlen in diesem Spec
  festgelegt — folgt dem in dieser Session etablierten Workflow für visuelle
  Geschmacksentscheidungen (siehe Konversation: "Live im Browser tunen" für die Shader-Runde).

## Ist-Zustand

Die vier betroffenen Style-Funktionen (aktueller Stand, `elastic-morph.html`):

- `auroraStyle` — Zeilen 3093-3111
- `gyroidStyle` — Zeilen 3145-3166 (nutzt `gyroid()`-Helper, Zeile 3144)
- `raymarchStyle` — Zeilen 3167-3195 (Marsch-Logik bereits in dieser Session gefixt)
- `feedbackStyle` — Zeilen 3196-3205

Jede berechnet ihre Farbe über eigene `hsv2rgb(vec3(fract(hue), sat, val))`-Aufrufe mit
individuellen Hue-Verschiebungsformeln, ohne gemeinsamen Nachbehandlungs-Schritt. Die
Helper-Funktionen `hsv2rgb`, `hash`, `vnoise`, `fbm` sitzen weiter oben im selben
Template-Literal (`elastic-morph.html:3016-3042`).

## Soll-Zustand

### 1. Neuer geteilter Helper `applyEyeCatcherFX(vec3 col, vec2 uv)`

Platziert direkt nach den bestehenden Helpern (`hsv2rgb`/`hash`/`vnoise`/`fbm`,
~`elastic-morph.html:3042`), vor der ersten Style-Funktion. Adaptiert aus Lab's
`applyMasterFX` (`constants.tsx:542-568`), reduziert auf die drei Elemente, die keine
Doppelung mit Bestehendem erzeugen:

```glsl
vec3 applyEyeCatcherFX(vec3 col, vec2 uv){
  col += col * col * 0.35;                                    // self-bloom
  float d = length(uv);
  col.r *= 1.0 + d * 0.12;                                     // chromatic-aberration-Anmutung
  col.b *= 1.0 - d * 0.12;                                     // (Kanal-Ungleichgewicht, kein Resample nötig -
                                                                 //  die Farbe ist bereits prozedural berechnet)
  col += (hash(uv * 500.0 + uTime) - 0.5) * 0.03;               // Korn
  return col;
}
```

Exakte Konstanten (`0.35`, `0.12`, `0.03`) sind Startwerte für die Live-Tuning-Runde, kein
festgeschriebener Endzustand.

### 2. Farbmischung statt freier Hue-Rotation in den 4 Style-Funktionen

Jede der 4 Funktionen ersetzt ihre `hsv2rgb(hue+...)`-Aufrufe durch `mix(farbeA, farbeB,
fract(t))` zwischen zwei style-eigenen, fest im Code stehenden `vec3`-Ankerfarben (keine
Uniform, kein globaler Lookup wie Lab's `getPaletteColor`, da kein Paletten-Feature entsteht).
Der Mix-Parameter `t` nutzt weiterhin die jeweils bestehende, style-eigene Signalquelle (z.B.
`flow`/`glow`/`f` je Style) an Stelle der bisherigen `hue`-Variable. `uHue` (Nutzer-Farbregler)
bleibt als additiver Offset auf `t` erhalten, damit der bestehende Hue-Slider weiter wirkt.

Konkrete Farbpaare pro Style (Ausgangspunkt für die Live-Runde, an den Charakter des jeweiligen
Styles angelehnt — Aurora grün/violett, Gyroid cyan/violett als Energie-Gitter-Anmutung,
Feedback Fractal magenta/cyan als psychedelischer Kontrast, SDF Blob bleibt beim bereits
funktionierenden warm/kühl-Kontrast aus der vorherigen Fix-Runde dieser Session):

| Style | Ankerfarbe A | Ankerfarbe B |
|---|---|---|
| Aurora | `vec3(0.05, 0.9, 0.55)` (grün) | `vec3(0.55, 0.15, 0.95)` (violett) |
| Gyroid | `vec3(0.0, 0.7, 0.9)` (cyan) | `vec3(0.3, 0.1, 0.9)` (violett) |
| Feedback Fractal | `vec3(1.0, 0.0, 0.6)` (magenta) | `vec3(0.0, 1.0, 1.0)` (cyan) |
| SDF Blob | bestehender warm/kühl-Kontrast aus der vorherigen Fix-Runde bleibt, nur `applyEyeCatcherFX` wird ergänzt |

### 3. Aufruf-Reihenfolge

Jede der 4 Funktionen ruft `applyEyeCatcherFX(col, uv)` als letzten Schritt vor `return` auf.
`main()` bleibt vollständig unverändert — dessen globale Vignette/Tonemap-Passage
(`elastic-morph.html:3245`ff.) läuft danach wie gehabt für alle 12 Styles.

## Out of Scope

- Kein neues Paletten-Auswahl-Feature, kein neuer Uniform, kein neuer localStorage-Key (siehe
  entschiedene Fragen).
- Keine Änderung an den 6 bereits starken Styles oder an Fluid/Liquid.
- Keine Änderung an `main()`, am bestehenden Master-Finish-Export-System, oder an
  `applyPreset`/der Visual-DNA-Preset-Auswahl.
- Teil 2 der ursprünglichen Idee (weitere Elastic-Lab-Visuals nach Morph portieren) ist
  explizit eine spätere, separate Spec-Runde — nicht Teil dieses Specs.

## Testing

- `test.js`: neue Assertion, die `function applyEyeCatcherFX` im Skript-Quelltext bestätigt
  sowie dass alle 4 betroffenen Style-Funktionen (`auroraStyle`, `gyroidStyle`,
  `raymarchStyle`, `feedbackStyle`) den Aufruf `applyEyeCatcherFX(col, uv)` enthalten —
  Fenster-Scoping über `extractFn` (wie bereits an anderer Stelle in `test.js` verwendet), um
  False-Positives durch identische Substrings in anderen Styles zu vermeiden.
- Regressionscheck: `node test.js` muss vor und nach der Änderung für alle bestehenden
  Assertions grün bleiben, insbesondere die, die `cycleCreatorLook`/`cyclePresetLook`
  betreffen (reine Style-interne Änderung, keine Auswirkung erwartet, aber prüfenswert).
- Manueller Live-Check (Pro-Modus, Demo-Track, wie in dieser Session etabliert): alle 4 Styles
  gegen die 6 unangetasteten Styles vergleichen — sichtbar mehr Struktur/Kontrast, keine
  übermäßige Abdunkelung durch Bloom/Vignette-Zusammenspiel, kein Ausbleichen ins Weiße/Graue
  bei hoher `uLoud`/`uBeat`.
