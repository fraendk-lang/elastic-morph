# Elastic Morph — ArrowUp/ArrowDown Preset Switch

## Kontext

Frank will live während einer Performance schnell zwischen Visual-DNA-Presets wechseln können,
ohne das Visual-DNA-Panel zu öffnen — per Tastatur, im Geiste der bestehenden Creator-Mode
Swipe-Geste (`cycleCreatorLook`, [[project_scene_banks_expansion]]-Session hat deren Code
zuletzt berührt). Ursprüngliche Notiz: [[project_arrow_key_preset_switch]].

`ArrowLeft`/`ArrowRight` sind bereits für ±5s Track-Skip belegt (`elastic-morph.html:7914-7915`).
`ArrowUp`/`ArrowDown` sind in der gesamten Datei unbelegt (geprüft per grep).

## Ist-Zustand

Es existiert bereits eine fast identische Funktion für die Touch-Swipe-Geste im Creator-Modus:

```js
// elastic-morph.html:9648-9677 (v62)
function getCreatorLookPicks() {
  const hasTrack = !!(S.audioBuffer || audioEl.src || S.micMode);
  if (!hasTrack) return [];
  return PRESETS.slice();
}
// ... überschrieben von einer zweiten, live gültigen Definition bei :10010, die
// zusätzlich S.swipeLookMode ("smart" vs "all") berücksichtigt.

function flashLookSwipe(name, dir, index, total) {
  const el = $("lookSwipeToast");
  if (!el) return;
  const pos = total > 1 ? ` (${index}/${total})` : "";
  el.textContent = (dir > 0 ? "→ " : "← ") + name + pos;
  el.classList.add("show");
  clearTimeout(flashLookSwipe._t);
  flashLookSwipe._t = setTimeout(() => el.classList.remove("show"), 950);
}

function cycleCreatorLook(delta) {
  const picks = getCreatorLookPicks();
  if (!picks.length) return;
  let idx = picks.indexOf(S.preset);
  if (idx < 0) idx = 0;
  idx = (idx + delta + picks.length) % picks.length;
  applyPreset(picks[idx]);
  hapticLookPulse();
  flashLookSwipe(picks[idx].name, delta, idx + 1, picks.length);
}
```

`cycleCreatorLook` ist nur an die Touch-Swipe-Geste in `initCreatorLookSwipe()` gebunden
(`S.uiMode === "creator"`, benötigt Touch + geladenen Track). Das globale keydown-Listener
sitzt bei `elastic-morph.html:7904` und bindet u.a. `ArrowLeft`/`ArrowRight`; es greift
modusunabhängig (Pro + Creator) und respektiert bereits zwei Guards, die für jedes neue
Binding automatisch mitgelten:

```js
document.addEventListener("keydown", e => {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
  if (document.querySelector('[aria-hidden="false"]')) return;
  ...
  if (e.key === "ArrowLeft") { e.preventDefault(); skip(-5); }
  if (e.key === "ArrowRight") { e.preventDefault(); skip(5); }
  ...
});
```

`#lookSwipeToast` ([elastic-morph.html:973-981](../../../elastic-morph.html) CSS,
[:1073](../../../elastic-morph.html) HTML) ist canvas-zentriert positioniert und nicht auf
den Creator-Modus beschränkt gestylt — funktioniert unverändert in Pro-Modus.

## Entschiedene Fragen (User-bestätigt 2026-08-21)

- **Modus:** Beide (Pro + Creator) — konsistent mit den anderen globalen Shortcuts
  (Space/Home/ArrowLeft/ArrowRight), die auch modusunabhängig feuern.
- **Preset-Liste:** Immer die volle `PRESETS`-Liste, unabhängig vom Smart/Alle-Swipe-Setting
  (`S.swipeLookMode`). Pro-Modus-Nutzer wollen volle Kontrolle, keine automatische Filterung.
- **Track-Pflicht:** Keine — funktioniert auch ohne geladenen Track/Mic (Visual-Setup vor dem
  Auflegen).
- **Richtung:** `ArrowDown` = nächstes Preset, `ArrowUp` = vorheriges (Listennavigations-
  Konvention: runter = weiter, hoch = zurück).

## Soll-Zustand

### 1. Neue Funktion `cyclePresetLook(delta)`

Platziert direkt neben `cycleCreatorLook` (~`elastic-morph.html:9677`), bewusst getrennt statt
`cycleCreatorLook` umzubauen — unterschiedliche Anforderungen (keine Track-Gate, keine
Smart/Alle-Filterung):

```js
function cyclePresetLook(delta) {
  let idx = PRESETS.indexOf(S.preset);
  if (idx < 0) idx = 0;
  idx = (idx + delta + PRESETS.length) % PRESETS.length;
  applyPreset(PRESETS[idx]);
  hapticLookPulse();
  flashLookSwipe(PRESETS[idx].name, delta, idx + 1, PRESETS.length, delta > 0 ? "↓ " : "↑ ");
}
```

`hapticLookPulse()` ist auf Desktop/ohne `navigator.vibrate` ein No-Op — unverändert
wiederverwendbar.

### 2. `flashLookSwipe` um optionalen Glyph-Parameter erweitern

Bestehende Swipe-Aufrufe (`cycleCreatorLook`) übergeben weiterhin nur 4 Argumente und behalten
ihr `→`/`←`-Verhalten exakt bei; nur der neue 5. Parameter weicht davon ab:

```js
function flashLookSwipe(name, dir, index, total, glyph) {
  const el = $("lookSwipeToast");
  if (!el) return;
  const pos = total > 1 ? ` (${index}/${total})` : "";
  el.textContent = (glyph || (dir > 0 ? "→ " : "← ")) + name + pos;
  el.classList.add("show");
  clearTimeout(flashLookSwipe._t);
  flashLookSwipe._t = setTimeout(() => el.classList.remove("show"), 950);
}
```

### 3. Keydown-Bindung (`elastic-morph.html:7904` Listener)

Neben den bestehenden `ArrowLeft`/`ArrowRight`-Zeilen:

```js
if (e.key === "ArrowDown") { e.preventDefault(); cyclePresetLook(1); }
if (e.key === "ArrowUp") { e.preventDefault(); cyclePresetLook(-1); }
```

Kein zusätzliches Modus-Gating nötig — die beiden bestehenden Guards oben im Listener
(Formularfeld-Fokus, offenes Modal) gelten automatisch mit. `e.preventDefault()` verhindert
Seiten-Scroll durch die Pfeiltasten, analog zu `ArrowLeft`/`ArrowRight`.

## Out of Scope

- Keine Änderung an `cycleCreatorLook`, `getCreatorLookPicks`, oder dem Smart/Alle-Swipe-
  Setting selbst.
- Kein neuer localStorage-Key, kein neuer Toggle in den Settings — reines Tastatur-Verhalten.
- Keine Änderung an der dritten Keydown-Listener (Shift+Digit Scene-Recall,
  [[project_scene_banks_expansion]]) — andere Tasten, kein Überschneidungsrisiko.

## Testing

- `test.js` erweitern um eine Assertion analog zu Zeile 88/89 (`ok("v62 look swipe", ...)`):
  prüft `script.includes("function cyclePresetLook")` und
  `script.includes('e.key === "ArrowDown"')`.
- Manueller Check (live): in Pro-Modus ohne Track ArrowDown/ArrowUp drücken → Preset wechselt,
  Toast zeigt Namen + Position mit `↓`/`↑`; am Ende der Liste wrappt es zum Anfang und
  umgekehrt; in einem Eingabefeld (z.B. Track-Titel) fokussiert lösen Pfeiltasten nichts aus;
  bei offenem Modal (z.B. Help-Overlay) ebenfalls kein Trigger; Creator-Modus-Swipe-Geste
  bleibt unverändert funktionsfähig (Regressionscheck).
