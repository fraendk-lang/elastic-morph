# Elastic Morph — DNA Flow-Motion Upgrade (Curl Noise)

## Kontext

Letztes Teilprojekt der Brainstorm-Roadmap. War von Anfang an als "zu vage" zurückgestellt
(`SPEC-visual-polish-v113.md`, Out-of-Scope). Nach Klärung: Fokus liegt auf dem `motion:"flow"`-
Modus der Partikelbewegung (nicht `"orbit"`, dem häufigeren Default).

## Ist-Zustand

`drawParticleMode` (`elastic-morph.html:4911`), Flow-Zweig bei `elastic-morph.html:4505-4511`:

```js
const ang = noise2(pt.fx * 1.8 + seed * 0.07, pt.fy * 1.8 + S.time * 0.15) * Math.PI * 2;
const v = dt * speed * 0.55 * (0.4 + S.loudness + S.beat * 0.4) * (0.5 + pt.sp);
pt.fx += Math.cos(ang) * v;
pt.fy += Math.sin(ang) * v + (P.flowBias || 0) * dt * (0.4 + S.bass * 0.8);
```

`noise2` (`elastic-morph.html:2913`) ist eine simple 3-Term-Sinussumme, deren Wert direkt als
Bewegungswinkel interpretiert wird. Das erzeugt eine eher wellig-geometrische als organische
Strömung. `noise2` wird an **28 Stellen** im Code genutzt (Kamera-Drift, Boids, Spektrum-Balken,
Hexgrid, u.a.) — wird für dieses Teilprojekt **nicht verändert**, um keine der anderen Systeme
ungewollt zu beeinflussen.

## Soll-Zustand

Zwei neue, ausschliesslich für den Flow-Modus genutzte Funktionen, neben `noise2`:

```js
function flowNoise(x, y) {
  return (
    Math.sin(x * 1.7 + y * 0.8) * 0.5 +
    Math.sin(x * 0.6 - y * 1.9 + 1.3) * 0.3 +
    Math.sin(x * 2.9 + y * 2.3 + 4.1) * 0.2 +
    Math.sin(x * 5.1 - y * 3.7 + 2.6) * 0.12 +
    Math.sin(x * 1.1 + y * 4.4 - 1.8) * 0.15
  );
}
function curlFlow(x, y) {
  const e = 0.06;
  const dy = (flowNoise(x, y + e) - flowNoise(x, y - e)) / (2 * e);
  const dx = (flowNoise(x + e, y) - flowNoise(x - e, y)) / (2 * e);
  return { x: dy, y: -dx };   // Gradient um 90° gedreht → divergenzfreies Strömungsfeld
}
```

`flowNoise` addiert 2 weitere Sinus-Terme (5 statt 3) für reichere Textur. `curlFlow` leitet über
finite Differenzen den Gradienten von `flowNoise` ab und rotiert ihn 90° — das macht das Feld
divergenzfrei (keine "Quellen"/"Senken", Partikel verklumpen nicht, verteilen sich nicht künstlich
weg) und damit deutlich glatter/wirbeliger als eine direkte Noise-zu-Winkel-Zuordnung.

Einsatz im Flow-Zweig — gleiche Geschwindigkeits-/Audio-Hüllkurve bleibt exakt erhalten, nur die
Richtung kommt jetzt aus `curlFlow` statt aus `noise2` + `cos`/`sin`:

```js
const cf = curlFlow(pt.fx * 1.8 + seed * 0.07, pt.fy * 1.8 + S.time * 0.15);
const v = dt * speed * 0.55 * (0.4 + S.loudness + S.beat * 0.4) * (0.5 + pt.sp);
pt.fx += cf.x * v;
pt.fy += cf.y * v + (P.flowBias || 0) * dt * (0.4 + S.bass * 0.8);
```

## Umfang

- Betrifft nur `motion:"flow"`-Presets. `motion:"orbit"` (Mehrheit der Presets) bleibt
  unangetastet.
- Kein neuer State, kein neuer UI-Regler — reine Verbesserung der bestehenden Bewegungsformel.
- Performance: 2 zusätzliche `flowNoise`-Calls pro Partikel pro Frame (je ~5 `Math.sin`-Ops),
  vernachlässigbar gegenüber dem bereits bestehenden Rendering-Aufwand.

## Out of Scope

- `motion:"orbit"` bleibt unverändert (war nicht der Fokus der Klärung)
- Boids/Schwarmverhalten, Feder-Physik/Soft-Body — andere, grössere Baustellen, in der
  Klärungsrunde bewusst nicht gewählt
- Kein neuer dritter Motion-Typ — bestehender Flow-Modus wird direkt verbessert

## Testing

- `test.js`: Assertion, dass `flowNoise`/`curlFlow` existieren; einfache numerische Checks
  (z. B. `curlFlow` liefert `{x,y}` mit endlichen, nicht-NaN Werten für ein paar Testpunkte;
  divergenzfrei-Eigenschaft indirekt über Vorzeichenwechsel bei benachbarten Punkten, falls
  sinnvoll ohne Overengineering)
- Manueller Check (live): einen Flow-Preset aktivieren, bestätigen dass die Partikelbewegung
  sichtbar flüssiger/wirbeliger wirkt statt wellig-gerichtet, kein Preset mit `motion:"orbit"`
  zeigt eine Verhaltensänderung
