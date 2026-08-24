# Elastic Morph — Community Look-Sharing Gallery (Round 1: Curated, No Backend)

## Kontext

Vierter Punkt der Roadmap aus der Competitive-Analysis-Runde (siehe
[[project_morph_palette_system]]/[[project_morph_feedback_loop]]/[[project_morph_frequency_bands]]
— Reihenfolge: Palette ✅, Feedback-Loop ✅, Frequenzbänder ✅, jetzt **Community-Gallery**,
danach Live-Kamera zuletzt).

Elastic Morph ist eine reine Client-Side-App ohne Backend — es gibt keine Datenbank, keinen
Server, kein Nutzerkonto-System. Der bestehende "Share Link"-Button (`elastic-morph.html:1579`,
`shareLink()` ab Zeile 8324) kodiert den kompletten `projectData()`-Zustand direkt in die
URL (`#s=<json>`), von `applyProject()` beim Laden ausgelesen (Zeile 8413-8414). Eine echte
Self-Service-Community-Plattform (Uploads, Accounts, Moderation) wäre ein fundamentaler
Architektur-Sprung — bewusst nicht Teil dieser Runde.

**Verwandter, aber explizit ausgeklammerter Gedanke:** Elastic Forge (`forge.elasticuniverse.app`,
eigenes Backend auf Railway) ist laut Frank als "Shader-Generator mit Community" gedacht — ob/wie
das mit dieser Gallery zusammenspielt, wird **separat, später** besprochen (siehe
[[vision_elastic_bridge]]), nicht Teil dieser Spec.

## Entschiedene Fragen (User-bestätigt 2026-08-24)

- **Kuratiert, kein Backend:** Frank sammelt Share-Links über bestehende Kanäle (Discord/
  Social/etc.) außerhalb der App und pflegt sie manuell in eine Datendatei ein. Kein
  Formular, kein Upload-Flow in der App.
- **Ein Galerie-Eintrag = ein kompletter Share-Link-Zustand** (nicht nur Visual-DNA/Palette) —
  einfachste Umsetzung, nutzt das bestehende `projectData()`/`applyProject()`-Format 1:1.
- **Separate JSON-Datei** (`assets/gallery/gallery.json`), nicht in `elastic-morph.html`
  hardcodiert — Frank kann neue Looks reinstellen, ohne Code anzufassen oder die
  Review-Pipeline zu durchlaufen.
- **Thumbnails manuell** (Screenshot + Crop durch Frank, wie bei anderen Bildern schon
  etabliert) — kein Auto-Generieren durch die App.
- **Neuer Nav-Tab "Gallery"**, gleiche Struktur wie die bestehenden Modes (Morph Studio/Live
  Morph/Creator Cuts/Lyrics/Visual DNA/Settings).
- **Laden ohne Bestätigungs-Dialog** — matcht das bestehende Verhalten von "Load Project" und
  Share-Links (kein `confirm()` davor), Undo (Cmd/Ctrl+Z) ist das etablierte Sicherheitsnetz.
- **Out of Scope:** kein Backend/Accounts/Moderationstools, keine Such-/Filter-UI, keine
  Auto-Thumbnails, keine Forge-Integration.

## Ist-Zustand

**Nav-/Mode-System** (`elastic-morph.html:1035-1040`): `<button class="navitem" data-mode="X">`
pro Tab; `setMode(mode)` (Zeile 7314-7326) toggelt `.navitem.active` und `.page.open` anhand
`data-mode`/`id="page-<mode>"`. Jede Page ist ein `<div class="page" id="page-X"><h2>...</h2>
<div class="sub">...</div>...</div>` (Muster z.B. `#page-live`, Zeile 1138-1148). `settings` ist
aktuell der letzte Tab.

**Fetch-Pattern für externe Daten** (`loadDemoManifest()`, Zeile 12539-12545): `try { const res
= await fetch(URL, { cache: "no-store" }); if (res.ok) return await res.json(); } catch (e) {
/* graceful fallback */ }` — bestehende Assets liegen unter `assets/` (z.B.
`assets/demo/demo.json`).

**Projekt-Laden:** `applyProject(o, fromScene)` (Zeile 6657 ff.) ist die zentrale
Restore-Funktion — bereits der einzige Pfad für Share-Links, Datei-Upload, Undo/Redo und alle
Scene-Bank-Systeme (siehe [[project_morph_palette_system]]-Notizen zur selben Funktion). Ein
Gallery-Eintrag ruft sie mit exakt demselben Objekt-Shape auf wie ein geparster Share-Link.

## Soll-Zustand

### 1. Datenformat — `assets/gallery/gallery.json`

```json
[
  {
    "id": "toxic-spiral-01",
    "name": "Toxic Spiral",
    "author": "DJ Beispiel",
    "date": "2026-08-24",
    "thumbnail": "assets/gallery/thumbs/toxic-spiral-01.jpg",
    "project": { "app": "ElasticMorph", "version": 9, "...": "kompletter projectData()-Export" }
  }
]
```
`project` ist 1:1 das, was `projectData()` erzeugt bzw. was ein Share-Link-Hash enthält —
Frank exportiert einen Look normal (Share-Link kopieren oder "Save Project"), extrahiert das
JSON und fügt es als neuen Array-Eintrag ein. Reihenfolge im Array = Anzeige-Reihenfolge (kein
Sortier-/Filter-UI in dieser Runde).

Die Implementierung legt `assets/gallery/gallery.json` mit einem leeren Array (`[]`) an, damit
das Feature sofort funktioniert (leere, aber fehlerfreie Gallery) — Frank befüllt sie danach
eigenständig, kein Teil des Implementierungsplans.

### 2. Laden — `loadGallery()`

Neue Funktion, gleiches Try/Catch-Fetch-Muster wie `loadDemoManifest()`:
```js
let galleryData = null;
async function loadGallery() {
  if (galleryData) return galleryData;
  try {
    const res = await fetch("assets/gallery/gallery.json", { cache: "no-store" });
    if (res.ok) galleryData = await res.json();
  } catch (e) { /* offline / file:// — empty gallery, no crash */ }
  return galleryData || [];
}
```
Ergebnis wird in `galleryData` zwischengespeichert — erneutes Öffnen des Tabs lädt nicht neu.

### 3. UI — neuer "Gallery"-Tab

Neuer Nav-Button nach dem bestehenden Settings-Eintrag (`elastic-morph.html:1040`):
```html
<button type="button" class="navitem" data-mode="gallery">Gallery</button>
```
Neue Page (Muster wie `#page-live`):
```html
<div class="page" id="page-gallery">
  <h2>Gallery</h2>
  <div class="sub">Community-Looks — von Frank kuratiert. Klick lädt den Look direkt.</div>
  <div id="galleryGrid"></div>
</div>
```
`setMode()` (Zeile 7314-7326) bekommt eine neue Zeile nach dem bestehenden `settings`-Fall:
```js
if (mode === "gallery") { $("page-gallery").classList.add("open"); renderGallery(); }
```
`renderGallery()`: ruft `loadGallery()`, rendert pro Eintrag eine Karte (Thumbnail, Name,
Autor) in `#galleryGrid`, Klick auf eine Karte ruft `applyProject(entry.project)` — kein
`confirm()` davor (siehe Entschiedene Fragen).

## Out of Scope

- Kein Upload-/Formular-Flow in der App — Einsammeln bleibt außerhalb.
- Kein Backend, keine Accounts, keine Moderationstools.
- Keine Such-/Filter-/Sortier-Funktion — einfaches Grid in JSON-Array-Reihenfolge.
- Keine Auto-generierten Thumbnails.
- Keine Forge-Integration (separates, späteres Thema).

## Testing

- `test.js`: neue Assertions (Muster wie bestehende Mode-/Fetch-Checks):
  - `#galleryGrid`, `data-mode="gallery"`-Button und `#page-gallery` im HTML-Quelltext vorhanden.
  - `setMode` enthält den neuen `gallery`-Fall.
  - `loadGallery`/`renderGallery` als Funktionen definiert, `loadGallery` nutzt das etablierte
    Try/Catch-Fetch-Muster (`cache: "no-store"`, graceful fallback bei Fehler statt Crash).
  - `renderGallery`/Karten-Klick-Handler ruft `applyProject` mit dem `project`-Feld des
    jeweiligen Eintrags auf.
- `node test.js` muss vor und nach der Änderung für alle bestehenden Assertions grün bleiben.
- Manueller Live-Check: `assets/gallery/gallery.json` mit 2-3 Test-Einträgen befüllen (echte
  Share-Link-Exports aus der laufenden App), Gallery-Tab öffnen, Karten prüfen (Thumbnail lädt,
  Name/Autor korrekt), Klick lädt den Look sichtbar korrekt, zweites Öffnen des Tabs lädt nicht
  erneut per Netzwerk (Cache-Verhalten), Verhalten ohne `gallery.json` (leeres Array oder
  Fetch-Fehler) darf nicht crashen — leeres Grid statt Fehler.
