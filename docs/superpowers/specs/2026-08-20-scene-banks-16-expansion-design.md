# Elastic Morph — Scene Banks 4→16 Expansion

## Kontext

Scene Recall soll live "um ein Vielfaches spannender" werden. Aktuell gibt es 4 Szenen-Slots
(A–D), gespeichert/abrufbar über das Settings-Panel (`#sceneBank`) und per `Shift+1…4`.
Nutzer will 16 Slots ("Wegen mir 16") plus einen fest reservierten Extra-Slot für einen
Standard-Look (z. B. Opener eines Sets).

## Ist-Zustand

Die Szenen-Logik existiert zweimal im File — die ursprüngliche Version (`elastic-morph.html:8495-8524`)
wird zur Laufzeit von einem späteren Patch überschrieben:

- **v71-Patch** (`elastic-morph.html:10963-11067`, `patchSceneBank()` → aufgerufen von
  `initSceneBank()`): überschreibt `loadScenes`/`saveScene`/`recallScene`/`renderScenes`.
  Storage-Key `SCENES_LS = "elasticMorph.scenes"`, Objekt keyed by numerischem Index `0..3`,
  Label-Array `SCENE_LABELS = ["A","B","C","D"]`. `saveScene(i)` hat einen localStorage-Quota-Guard
  (fällt bei `QuotaExceededError` auf Speichern ohne Bilddaten zurück) und `showAppToast`-Feedback.
- **Cue/Set-Editor** (`elastic-morph.html:8671`, `:8816`, `:8830-8832`): Song-Marker
  (`S.cues`) können optional eine Szene referenzieren (`cue.scene`, Werte `0..3` über ein
  `<select>` mit A/B/C/D). Playback ruft beim Erreichen eines Markers automatisch die
  referenzierte Szene ab (`applyCueImmediate`, `startCueTransition`). **Bleibt unverändert**
  (siehe Out of Scope) — Werte `0..3` überlappen sich unproblematisch mit den neuen
  Indizes 0-7 von Bank 1.
- **Keydown-Listener** — drei relevante, unabhängige `document.addEventListener("keydown", …)`-Blöcke:
  1. `elastic-morph.html:7891-7939` — Haupt-Shortcuts (Space, Pfeile, `f`, `b` = Blackout,
     `[`/`]`, `g`, `p`, `d`, Ziffern für FX-Racks I-III). Guard: früher Return bei offenem
     Modal (`document.querySelector('[aria-hidden="false"]')`, Zeile 7896) und bei Fokus in
     einem Formularfeld (Zeile 7893). Der `S.uiMode !== "creator"`-Guard (Zeile 7922) umschließt
     **nur** den Ziffern-Block für die FX-Racks, weil deren Panel (`#ctrl`) in Creator-Mode
     unsichtbar ist. Blackout (`b`) liegt bewusst außerhalb dieses Blocks.
  2. `elastic-morph.html:8165-8169` — Undo/Redo (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Y`), eigenständig
     modifier-gated, unberührt von dieser Änderung.
  3. `elastic-morph.html:8718-8725` — "extra keyboard": `Escape`, `?`, `Shift+P` (PNG),
     `M` (Cue setzen), **`Shift+Digit1-4` = Szenen-Recall**. Guard: nur Formularfeld-Check
     (Zeile 8719), **kein** Modal-Guard, kein Creator-Mode-Bezug.

## Soll-Zustand

### Datenmodell

- `SCENE_LABELS` erweitert von 4 auf 16 Buchstaben `A`–`P`. Storage bleibt index-basiert
  (`0..15`) unter demselben Key `elasticMorph.scenes` — bestehende gespeicherte Szenen 0-3
  (A-D) bleiben gültig und landen automatisch in Bank 1.
- `normalizeScenes`/`persistScenes`/`saveScene`/`recallScene`: Schleifen-/Bounds-Grenze
  `< 4` bzw. `> 3` wird zu `< 16` bzw. `> 15`.
- **Basis Szene** ist bewusst **kein** 17. Index in diesem Array (würde mit der
  Bank-Logik kollidieren), sondern ein eigener, separater Storage-Key
  `elasticMorph.sceneBasis` mit eigenem `saveBasisScene()`/`recallBasisScene()`, die
  dieselbe `sceneSnapshot()`-Erzeugung und denselben Quota-Guard/Toast-Mechanismus wie
  `saveScene` wiederverwenden.

### Panel-UI (`#sceneBank`, Settings-Seite)

- Neuer UI-State `activeSceneBank` (`1` oder `2`), ephemer (kein Persistieren nötig, startet
  bei `1` nach jedem Laden — analog zu anderen reinen Anzeige-Toggles im File).
- `renderScenes()` zeigt oben zwei Toggle-Buttons ("Bank 1 (A–H)" / "Bank 2 (I–P)"), darunter
  nur die 8 Zeilen der aktiven Bank (Indizes `0-7` bzw. `8-15`). Basis-Szene-Zeile wird
  **immer** oberhalb der Bank-Toggle-Buttons gerendert, unabhängig von `activeSceneBank`
  (siehe Mockup, per visuellem Vergleich vom Nutzer bestätigt).
- Klick auf einen Bank-Toggle-Button ruft `setActiveSceneBank(n)` auf → State setzen,
  `renderScenes()` erneut aufrufen.

### Tastenkürzel

| Taste | Verhalten | Ort |
|---|---|---|
| `Shift+1…8` | Recall Slot `(activeSceneBank-1)*8 + (digit-1)` innerhalb der aktiven Bank | Listener 3, ersetzt `/^Digit[1-4]$/` durch `/^Digit[1-8]$/` und rechnet den Bank-Offset ein |
| `Tab` | Togglet `activeSceneBank` zwischen 1 und 2, `e.preventDefault()` (verhindert Standard-Fokuswechsel) | Neu in Listener 3 |
| `B` | Recall Basis Szene (**ersetzt** Blackout vollständig) | Zeile 7904 in Listener 1 wird umgebaut: `$("blackoutBtn").click()` → `recallBasisScene()` |
| `Shift+B` | Blackout (neuer Trigger) | Neu in Listener 1, direkt neben der umgebauten `B`-Zeile: `if ((e.key==="b"||e.key==="B") && e.shiftKey) { e.preventDefault(); $("blackoutBtn").click(); }` |

### Guards für Listener 3

Listener 3 bekommt denselben Modal-Guard wie Listener 1 (`if
(document.querySelector('[aria-hidden="false"]')) return;`, direkt nach dem bestehenden
Formularfeld-Check) — verhindert, dass `Shift+1-8`/`Tab`/`?`/`Shift+P`/`M` feuern, während
ein Dialog offen ist.

**Kein** pauschaler Creator-Mode-Ausschluss für Szenen-Shortcuts: Der `S.uiMode !==
"creator"`-Guard in Listener 1 existiert *nur*, weil das FX-Rack-Panel (`#ctrl`) in
Creator-Mode unsichtbar ist (Kommentar Zeile 7918-7921). Das Scene-Bank-Panel lebt auf der
unabhängig navigierbaren Settings-Seite (`data-mode="settings"`, Zeile 1036) und ist von
`S.uiMode` (Creator/Pro-Layout) nicht betroffen — es gibt keine analoge "unsichtbares Panel"-
Bedingung, die einen Creator-Mode-Ausschluss rechtfertigt. Recall/Save/Blackout/Basis/Bank-Tab
bleiben deshalb in beiden Layout-Modi aktiv. *(Falls das nicht der gewünschten Lesart von
"gleiche Guards" entspricht, bitte bei der Spec-Review korrigieren.)*

## Out of Scope

- Cue/Set-Editor-Dropdown (`elastic-morph.html:8671`) bleibt bei A–D — keine Erweiterung auf
  16 Slots + Basis (Nutzer-Entscheidung). `cue.scene`-Werte `0..3` bleiben gültige Bank-1-Indizes,
  keine Migration nötig.
- Keine Persistenz des `activeSceneBank`-UI-States über Reloads hinweg.
- Keine Änderung an `sceneSnapshot()` selbst (Speicherinhalt pro Szene bleibt gleich).

## Testing

- Manuell im Browser: alle 16 Slots (beide Bänke) speichern/abrufen, Bank-Wechsel per Klick
  UND per `Tab`, Basis-Szene speichern/abrufen über `B`, Blackout über `Shift+B`, Verhalten bei
  offenem Modal (Help-Overlay o.ä. — `Shift+1-8`/`Tab` dürfen nicht feuern), Verhalten in
  Creator-Mode (Szenen-Shortcuts sollen dort weiterhin funktionieren), bestehende Cue-Marker
  mit `cue.scene 0-3` funktionieren nach der Migration unverändert.
