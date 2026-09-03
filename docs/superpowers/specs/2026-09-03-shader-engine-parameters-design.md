# Shader Engine Parameters — Design

## Problem

The Shader Engine (`S.shader`) exposes only four knobs — Style, Blend, Intensity,
Opacity — versus DNA Control's eleven sliders (Morph Amount, Memory, Mutation,
Gravity, Pulse Depth, Density, Color Drift, Camera Drift, Zoom, Organic Motion,
Identity Lock). Frank noticed this asymmetry directly: the Shader layer has no way
to change how fast a style animates, how zoomed-in its pattern is, or how
saturated/contrasty it reads — every one of the 17 GLSL styles is stuck with
whatever constants are baked into its own function body.

Separately, Frank also flagged that images/video in the background timeline share
one global filter/opacity/fit setting across every clip instead of per-clip
control. That is explicitly out of scope here — this spec covers Shader Engine
parameters only; the timeline per-clip work is a separate follow-up.

## Goals

- Give every Shader Engine style three real, user-facing knobs: **Speed**,
  **Scale**, **Color Bias**.
- Apply them globally, in one place, so all 17 style functions benefit without
  being individually touched or risked.
- Keep the change static (no live audio-reactive modulation) — see Non-Goals.

## Non-Goals

- **Per-style bespoke parameters** (e.g. "ring count" for Tunnel, "grid density"
  for Hypercube). This would require rewriting all 17 style functions and a
  style-aware dynamic UI — a much larger, multi-round project, closer in scope to
  how the DNA engines were built one at a time. Noted as a natural future
  follow-up, not part of this spec.
- **A "Complexity" knob** (e.g. FBM octave count, shard-loop count). These are
  fixed-bound `for` loops in GLSL; making the bounds live-uniform is a riskier
  shader rewrite for uncertain visual payoff. Skipped for v1.
- **Live audio-reactive modulation** of the three new knobs (i.e. no `LIVE_KEYS`/
  `liveMul()` treatment). Frank confirmed static-only is preferred: simpler,
  predictable, and avoids interaction with the shader's existing built-in
  beat-reactivity in `main()` (the beat zoom-punch and bass-driven rotation).
- **Timeline per-clip color/format controls** — separate spec, separate round.

## Design

### 1. GLSL changes — all contained in `main()`, no style function is touched

All edits live in the `SHADER_FRAG` template string (currently ~line 3492–3937)
and its `main()` function (~line 3907–3936). None of the 17 style functions
(`fluidStyle`, `metaStyle`, … `warpTunnelStyle`) are modified.

**Speed** needs no new GLSL uniform at all. It's implemented purely on the JS
side (see §2): the value fed into the existing `uTime` uniform is
`S.time * SH.speed` instead of `S.time`. `S.time` itself is untouched — it also
drives the DNA organism, particles, etc., and must keep ticking at real time.

Trade-off, accepted deliberately: because `S.time * SH.speed` is what's sent
every frame, changing the Speed slider mid-playback causes a phase jump in the
pattern (the accumulated "effective shader time" isn't continuous across a
speed change). **Correction (post-final-review):** this is not small — at a
typical mid-track `S.time` of ~250–350, a single slider step can jump the
effective shader time by several full units, reading as a hard cut in the
pattern rather than a subtle shift. Frank reviewed this magnitude explicitly
(2026-09-03, post-launch) and confirmed the trade-off stands: Speed is meant
as a set-once-then-leave-it control, not something to ride live mid-set, so
the jump is acceptable. Fixing it would require maintaining a
separately-integrated shader clock — deliberately not built, not a bug to
chase later.

**Scale** is a new uniform `uScale`, applied once right after the existing `uv`
computation at the top of `main()`:

```glsl
vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / min(uRes.x, uRes.y);
uv *= uScale;                                              // NEW
uv *= 1.0 - uBeat*0.10;                                    // existing beat zoom-punch
float rot = uTime*0.02 + uBass*0.18;                       // existing drift/rotation
uv = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * uv;
```

This composes cleanly with the existing beat-punch and rotation since it's a
plain multiplicative scale applied before them.

**Color Bias** is a new uniform `uColorBias`, applied once to the style's output
`col`, right before the existing vignette/tonemap block at the end of `main()`:

```glsl
// existing style dispatch sets `col`
float lum = dot(col, vec3(0.299, 0.587, 0.114));
col = mix(vec3(lum), col, 1.0 + uColorBias);                // NEW
// existing vignette + tonemap:
float vig = 1.0 - dot(uv,uv)*0.35;
col *= clamp(vig,0.0,1.0);
col = col/(col+vec3(0.7));
col = pow(col, vec3(0.85));
```

At `uColorBias = 0` this is a no-op (mix factor 1.0). Negative values pull the
image toward grayscale (mix factor < 1.0); positive values push saturation/
contrast beyond the style's native output (mix factor > 1.0).

`initGL()`'s uniform-location block (~line 3974) gains two entries:

```js
scale: gl.getUniformLocation(prog, "uScale"),
colorBias: gl.getUniformLocation(prog, "uColorBias"),
```

`renderShader()` (~line 3998–4041) gains the corresponding per-frame sets,
alongside the existing `gl.uniform1f(L.time, S.time)` call which becomes
`gl.uniform1f(L.time, S.time * (SH.speed != null ? SH.speed : 1))`:

```js
gl.uniform1f(L.scale, SH.scale != null ? SH.scale : 1);
gl.uniform1f(L.colorBias, SH.colorBias != null ? SH.colorBias : 0);
```

### 2. State & persistence

`S.shader` (currently `{ on: false, style: "fluid", intensity: 0.7, opacity: 0.85,
blend: "lighter", warp: false }`, ~line 2970) gains:

```js
speed: 1.0,      // 0.2 – 3.0
scale: 1.0,      // 0.5 – 2.5
colorBias: 0,     // -0.8 – 0.8
```

Save (~line 8634, `shader: { ...S.shader }`) already spreads the whole object, so
no change needed there.

Load (~line 8907–8914) follows the existing clamp-fallback pattern used for
`opacity`/`intensity`/`style` so old saved projects without these fields don't
break:

```js
S.shader.speed = clampRange(S.shader.speed, 0.2, 3.0, 1.0);
S.shader.scale = clampRange(S.shader.scale, 0.5, 2.5, 1.0);
S.shader.colorBias = clampRange(S.shader.colorBias, -0.8, 0.8, 0);
```

(`clampRange(v, min, max, dflt)` — small helper, mirrors the existing `fbClamp`
used for `S.feedbackFX` fields at ~line 8875; add alongside it if no generic
clamp-with-default helper already exists.)

### 3. UI

Three new slider rows in the Shader Engine panel (~line 1673–1680), directly
after the existing Intensity/Opacity rows, matching their exact markup pattern:

```html
<div class="slider-row">
  <label>Speed <span class="val" id="shSpeedVal">100</span></label>
  <input type="range" id="shSpeed" min="20" max="300" value="100">
</div>
<div class="slider-row">
  <label>Scale <span class="val" id="shScaleVal">100</span></label>
  <input type="range" id="shScale" min="50" max="250" value="100">
</div>
<div class="slider-row">
  <label>Color Bias <span class="val" id="shColorBiasVal">0</span></label>
  <input type="range" id="shColorBias" min="-80" max="80" value="0">
</div>
```

`buildShader()` (~line 9043–9050) gains matching listeners, same style as the
existing Intensity/Opacity ones:

```js
$("shSpeed").addEventListener("input", e => { S.shader.speed = e.target.value / 100; $("shSpeedVal").textContent = e.target.value; });
$("shScale").addEventListener("input", e => { S.shader.scale = e.target.value / 100; $("shScaleVal").textContent = e.target.value; });
$("shColorBias").addEventListener("input", e => { S.shader.colorBias = e.target.value / 100; $("shColorBiasVal").textContent = e.target.value; });
```

`syncShaderUI()` (~line 15891) and the project-load UI sync (~line 8907–8914)
both gain matching lines to push `S.shader.speed/scale/colorBias` into the three
new slider elements + their value labels, mirroring how Intensity/Opacity are
already synced in both places.

### 4. Testing

New `test.js` assertions:

- `SHADER_FRAG` source contains the `uScale` and `uColorBias` uniform
  declarations, the `uv *= uScale;` line, and the color-bias `mix(...)` line.
- `S.shader` default object includes `speed: 1`, `scale: 1`, `colorBias: 0`.
- The three new slider elements exist with the specified `min`/`max`/`value`.
- Adjusting each slider's `input` event updates the corresponding `S.shader.*`
  field to the expected value.
- Save → load round-trip preserves non-default values for all three fields.
- Loading a project object *without* these fields (simulating an old save)
  leaves `S.shader.speed/scale/colorBias` at their clamped defaults rather than
  `undefined`.

## Open questions

None — Frank approved Approach C (Speed + Scale + Color Bias, static-only,
global-uniform implementation) and this design in full.
