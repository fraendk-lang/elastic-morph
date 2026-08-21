# Elastic Morph — Visual DNA Grid: Larger Preset Previews

## Kontext

Erste Runde einer geplanten Serie optischer, nicht-destruktiver UI-Verbesserungen. Die
Visual-DNA-Bibliothek (`#page-dna`, Pro-Modus) zeigt 30+ Presets als Karten mit einer live
animierten Mini-Vorschau (`canvas.pcanvas`) — eines der stärksten visuellen Assets der App,
aktuell aber nur 48px hoch bei 190px breiten Karten dargestellt und dadurch stark
unterinszeniert. Aus drei im visuellen Companion verglichenen Richtungen (größere Karten /
quadratische Cover-Kacheln / Featured-Reihe + kompaktes Grid) hat Frank Option A gewählt:
gleiches Grid-Prinzip, aber deutlich größer.

## Ist-Zustand

`elastic-morph.html`, `<style>`-Block:

```css
#presetGrid, #customGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.preset-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
  transition: all .15s;
  position: relative;
}
.preset-card .swatch { height: 44px; border-radius: 8px; margin-bottom: 10px; }
.preset-card .pcanvas { display: block; width: 100%; height: 48px; border-radius: 8px; margin-bottom: 10px; }
.preset-card h4 { font-size: 13px; margin-bottom: 4px; }
.preset-card p { font-size: 11px; color: var(--text-dim); line-height: 1.45; }
```

`#presetGrid` und `#customGrid` teilen sich diese Klassen — jede Karte hat entweder ein
`.swatch` (statischer Farbverlauf für Karten ohne Live-Preview) oder ein `.pcanvas`
(animierter Canvas, per JS live gezeichnet, unabhängig von der CSS-Größe — die
Rendering-Logik selbst wird durch dieses Spec nicht angefasst).

## Soll-Zustand

Reine CSS-Wertänderung, keine HTML- oder JS-Änderung:

```css
#presetGrid, #customGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.preset-card { padding: 16px; }
.preset-card .swatch { height: 120px; margin-bottom: 12px; }
.preset-card .pcanvas { height: 120px; margin-bottom: 12px; }
```

- Kartenbreite: `minmax(190px, 1fr)` → `minmax(220px, 1fr)` (führt auf typischen Breiten
  automatisch zu einer Spalte weniger im Grid).
- Preview-Höhe (`.swatch` und `.pcanvas` gemeinsam, damit beide Kartentypen konsistent
  bleiben): `44px`/`48px` → `120px` (~2.5×).
- Grid-Gap `12px` → `14px`, Karten-Padding `14px` → `16px`, damit die Proportionen zur neuen
  Kartengröße passen (rein optische Fein-Justierung, kein hartes Requirement).
- `.preset-card h4`/`p`-Schriftgrößen bleiben unverändert — der Text war schon gut lesbar,
  soll nicht unnötig mitskaliert werden.

**Warum keine JS-Änderung nötig:** Das Canvas-Rendering für `.pcanvas` liest seine
Zeichenfläche bereits zur Laufzeit aus (kein hartcodierter Pixel-Wert im Rendering-Code für
diese Vorschau-Canvases) — eine reine CSS-Größenänderung reicht, die Live-Animation skaliert
automatisch mit.

## Out of Scope

- Lyrics-Studio-Layout und allgemeine Hover-/Fokus-Politur (separate, spätere Design-Runden,
  siehe [[project_elastic_universe]]-Notizen aus dieser Session).
- Keine Änderung an der Preset-Auswahl-Logik, `applyPreset()`, oder wie Karten geklickt
  werden — nur visuelle Größe.
- ArrowUp/ArrowDown Preset-Cycling (separate Idee, noch nicht gebrieft — siehe
  `project_arrow_key_preset_switch`-Notiz).

## Testing

- `test.js` hat aktuell keine Assertions, die auf `#presetGrid`/`.pcanvas`/`.preset-card`
  CSS-Werte referenzieren (geprüft per grep) — kein Test-Update nötig, `node test.js` muss vor
  und nach der Änderung unverändert grün bleiben.
- Manueller Check (live): Visual-DNA-Seite in Pro-Modus öffnen, bestätigen dass alle
  Preset-Karten (inkl. der mit `.swatch` statt `.pcanvas`, falls vorhanden) proportional
  größer und weiterhin klickbar/auswählbar sind, Grid bricht bei schmalen Viewports (Tablet/
  Mobile) sauber um.
