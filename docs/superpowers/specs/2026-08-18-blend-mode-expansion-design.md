# Elastic Morph — Blend-Mode Expansion (Layer B + Shader Engine)

## Kontext

Erstes von mehreren Teilprojekten aus einer größeren Brainstorm-Runde (DNA-Bewegung,
FX-Rack-Ergänzung, Layer-B-Modulation, Shader-Eye-Catcher, Blend-Modes). Die anderen Themen
werden als eigene, spätere Specs behandelt — siehe "Out of Scope" unten und die Roadmap-Notiz
am Ende.

**Befund aus der Code-Exploration:** Sowohl Layer B (`#lbBlend`) als auch die Shader Engine
(`#shBlend`) haben aktuell nur 3 Blend-Modes: Add (`lighter`), Screen (`screen`), Normal
(`source-over`). Canvas2D unterstützt nativ ~16 `globalCompositeOperation`-Werte; beide Werte
werden bereits generisch durchgereicht (`ctx.globalCompositeOperation = LB.blend` bzw.
`= SH.blend`), es gibt keine Whitelist/Validierung, die neue Werte blockieren würde.

## Ziel

Layer B und Shader Engine bekommen dieselbe erweiterte Blend-Mode-Liste (9 statt 3), damit
Nutzer mehr kreative Kompositions-Optionen haben, ohne dass sich die beiden Systeme in ihrem
Vokabular unterscheiden.

## Umfang

**Neue Blend-Modes (6, zusätzlich zu den bestehenden 3):**
| Value | Label | Charakter |
|---|---|---|
| `multiply` | Blend: Multiply | abdunkeln, sättigt Überlappungen |
| `overlay` | Blend: Overlay | Kontrast-Boost, hell wird heller/dunkel wird dunkler |
| `difference` | Blend: Difference | Farbinversion an Überlappung — psychedelisch |
| `color-dodge` | Blend: Color Dodge | extreme Highlights, glow-artig |
| `hard-light` | Blend: Hard Light | harter Kontrast-Mix |
| `hue` | Blend: Hue | färbt die Overlay-Struktur in den DNA-Ton ein |

**Betroffene Stellen (beide identisch erweitert):**
- `elastic-morph.html:1792` — `<select id="lbBlend">` (Layer B)
- `elastic-morph.html:1587` — `<select id="shBlend">` (Shader Engine)

Reihenfolge im Dropdown: bestehende 3 zuerst (unverändert, damit gespeicherte Presets/Projekte
mit `blend: "lighter"` etc. weiter exakt an derselben Stelle stehen), dann die 6 neuen.

**Kein Code-Change nötig** außerhalb der `<option>`-Listen — `S.layerB.blend`/`S.shader.blend`
und deren Event-Handler (`elastic-morph.html:6799`, `:6814`) reichen den Select-Value bereits
unverändert an `ctx.globalCompositeOperation` durch.

## Out of Scope (bewusst nicht Teil dieser Spec)

- Preset-seitige Blend-Mode-Defaults (Presets setzen weiterhin keinen Blend-Mode)
- Live-Vorschau-Swatches pro Option im Dropdown
- Alle ~16 Canvas-Compositing-Modes (nur die kuratierten 6 — Rest z. B. `luminosity`,
  `saturation`, `exclusion`, `darken`, `lighten`, `color-burn`, `soft-light` bewusst weggelassen)
- Die anderen 4 Brainstorm-Themen (DNA-Bewegung, FX-Rack-III-Vervollständigung + Shortcut,
  Layer-B-Modulation/LFO, Shader-Eye-Catcher-Styles) — jeweils eigene Spec später

## Testing

- `test.js`: Assertion, dass `#lbBlend` und `#shBlend` jeweils alle 9 `value="..."` enthalten
  (bestehende 3 + 6 neue)
- Manueller Check (live, `elasticmorph.app`): jeden neuen Blend-Mode einmal auf einem aktiven
  Preset mit Layer B an bzw. Shader Engine an durchklicken — kein Preset darf komplett
  schwarz/weiß clippen oder unbrauchbar werden (Difference/Color-Dodge sind bewusst extrem,
  aber müssen noch erkennbar Struktur zeigen)

## Roadmap (spätere Specs, nicht Teil dieser Runde)

1. FX Rack III (Cinematic) von 4 auf bis zu 10 Effekte auffüllen + eigenes Tastenkürzel
   (Alt+1–0 empfohlen statt Cmd/Ctrl — Ctrl+1–0 ist bereits FX Rack II, Cmd+1–0 kollidiert
   plattformübergreifend mit Browser-Tab-Shortcuts)
2. Layer B: freie LFO-Modulation zusätzlich zur bestehenden Beat/Zeit-Kopplung
3. Shader Engine: weitere GLSL-Styles als "Eye Catcher" (aktuell 12 Styles vorhanden)
4. DNA-Organismus-Bewegung "zeitgemässer" — braucht eigene Referenz-Diskussion
