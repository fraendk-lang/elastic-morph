# Elastic Morph — Pixelate Modulation Pilot

## Kontext

Pilot-Projekt: FX Rack I's Pixelate (Taste 9) reagiert nur auf Loudness/Beat für die
Blockgrösse — bei gleichbleibendem Pegel (z. B. im Auto-VJ während eines ruhigen
Song-Abschnitts) wirkt der Effekt eingefroren, obwohl er technisch "audio-reaktiv" ist.
Gleiche strukturelle Lücke wie bei Layer B vor der LFO-Erweiterung: Audio-Kopplung allein
reicht nicht gegen "langweilig bei stabilem Pegel".

**Scope-Entscheidung aus der Klärung:** Pilot NUR für Pixelate, rein intern automoduliert
(kein neuer Regler — Pixelate ist wie alle ~30 FX-Rack-Effekte ein reiner An/Aus-Chip ohne
Slider, das bleibt so). Ergebnis entscheidet, ob das Muster auf weitere Effekte ausgerollt wird.

## Ist-Zustand

`elastic-morph.html:5499` (`applyPostFX`, `if (fx.pixelate)`):

```js
if (fx.pixelate) {
  const bs = Math.max(3, Math.round((10 + S.loudness * 26 + S.beat * 14) * (H / 720)));
  const sw = Math.max(1, Math.floor(W / bs)), sh = Math.max(1, Math.floor(H / bs));
  fxctx.imageSmoothingEnabled = true;
  fxctx.globalCompositeOperation = "copy"; fxctx.globalAlpha = 1;
  fxctx.drawImage(canvas, 0, 0, sw, sh);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(fxC, 0, 0, sw, sh, 0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
}
```

Technik: Verkleinern MIT Glättung (weich), dann Hochskalieren OHNE Glättung (harte
Blockkanten) → klassischer Mosaik-Look. Blockgrösse `bs` ist die einzige variable Grösse.

## Soll-Zustand — zwei Achsen, beide zeitgesteuert

**1. Blockgrössen-Drift** — multiplikativer Faktor oben auf die bestehende Formel:

```js
const bsDrift = 1 + 0.3 * Math.sin(S.time * 0.25);   // ±30%, ~25s Zyklus
const bs = Math.max(3, Math.round((10 + S.loudness * 26 + S.beat * 14) * bsDrift * (H / 720)));
```

**2. Schärfe-Achse (neu)** — Cross-Fade zwischen hartem Mosaik und weichem Blur, nicht ein
hartes Umschalten von `imageSmoothingEnabled` (das würde flackern statt driften):

```js
const soft = 0.5 + 0.5 * Math.sin(S.time * 0.1);   // 0..1, ~63s Zyklus (langsames Fokussieren)
ctx.imageSmoothingEnabled = false;
ctx.globalAlpha = 1;
ctx.drawImage(fxC, 0, 0, sw, sh, 0, 0, W, H);        // harte Basis, immer gezeichnet
if (soft > 0.02) {
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = soft;
  ctx.drawImage(fxC, 0, 0, sw, sh, 0, 0, W, H);      // weicher Blur, per Alpha übergeblendet
  ctx.globalAlpha = 1;
}
ctx.imageSmoothingEnabled = true;
```

Beide Draws lesen aus derselben bereits verkleinerten `fxC` — kein zusätzlicher
Downscale-Schritt, nur der zweite Upscale-Draw kommt gelegentlich oben drauf (billig, eine
einzelne Canvas-Effekt-Ebene, kein Partikel-Loop).

**Kein neuer State nötig:** `S.time` ist bereits die im ganzen File genutzte, export-
deterministische Zeitbasis (`Math.sin(S.time * X)` ist das dominante Muster für zeitbasierte
Drifts in dieser Datei, z. B. `sway`) — kein neuer Phasen-Akkumulator wie bei Layer B nötig,
da hier keine per-Nutzer einstellbare Rate existiert, die einen `dt`-Akkumulator brauchen würde.

## Out of Scope

- Keine neuen UI-Regler (Entscheidung aus der Klärung)
- Keine Ausweitung auf andere FX-Rack-Effekte — das ist eine spätere Entscheidung, abhängig
  vom Ergebnis dieses Piloten
- Keine Persistenz/Serialisierung nötig (keine neue Werte in `S.fx`, nur lokale Konstanten
  in der Rendering-Funktion)

## Testing

- `test.js`: Assertion, dass der `applyPostFX`-Quelltext beide neuen Terme enthält
  (`bsDrift` und `soft`-Crossfade), Regressionsschutz falls der Block später umgebaut wird
- Manueller Check (live): Pixelate aktivieren, Track mit stabilem Pegel abspielen (oder
  Auto-VJ mit ruhigem Preset), bestätigen dass sich Blockgrösse UND Schärfe über ~30–60s
  sichtbar verändern, auch ohne Lautstärkeschwankung
