# Shader Engine — Warp Tunnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Warp Tunnel" as a 17th Shader Engine style — 48 radial streak lines rushing
outward plus 3 rotating triangle-wireframe glints, both built from the existing cheap `segGlow`
2D primitive (no raymarch).

**Architecture:** One new GLSL style function inserted into the existing `SHADER_FRAG` string,
wired into the existing style-dispatch chain, `SHADER_STYLE_ID` map, and `<select>` dropdown —
plus a cost-gate registration (`HEAVY_SHADER`) in its actual source file, `src/inject-v64.js`.

**Tech Stack:** GLSL ES 1.00 (WebGL1 fragment shader), vanilla JS wiring, no new dependencies.

## Global Constraints

- 4 of 5 edits are pre-`@BUILD-INJECT-V58` marker (currently line 10753) in `elastic-morph.html`.
  The 5th — `HEAVY_SHADER` — is **post-marker only, generated from `src/inject-v64.js:6`** on
  every `node build.js` run. Edit `src/inject-v64.js`, never hand-edit the `elastic-morph.html`
  mirror (currently line 11930) — it is silently overwritten on the next build.
- **This is a documented, twice-repeated gap this exact class of task has hit before**: both the
  Portal/Crystal/Hypercube round and the Cosmic Drift round originally shipped without adding
  their new style to `HEAVY_SHADER`, and both needed a final-review fix for it. This plan's Task 1
  makes the `HEAVY_SHADER` edit + `node build.js` regeneration + a two-sided test (source file AND
  regenerated mirror) an explicit, non-skippable step — not a follow-up.
- `warpTunnel` does **not** join the separate 820px-resolution-cap style list
  (`elastic-morph.html` ~line 3951, `gyroid`/`crystal`/`cosmicDrift` only) — that set is reserved
  for styles with an actual 3D raymarch loop; Warp Tunnel has none (same precedent as `hypercube`,
  which is `HEAVY_SHADER` but not in the 820-cap set). This must be verified with an explicit
  negative test, not just left unmentioned.
- No GLSL array syntax (WebGL1/GLSL ES 1.00 safety) — already covered automatically by an
  existing generic test once this style's code lands before `void main(){` (see Task 1 Step 3 for
  why no new test is needed for this).
- Test count baseline: 626 passed, 0 failed (confirmed via an actual `node test.js` run just
  before this plan was written). Required after this task: exactly **634 passed, 0 failed** (626
  + 8 new).

---

## Task 1: Warp Tunnel shader style

**Files:**
- Modify: `elastic-morph.html:3844-3848` (new GLSL function), `elastic-morph.html:3869` (dispatch
  chain), `elastic-morph.html:3935` (`SHADER_STYLE_ID`), `elastic-morph.html:1659` (`<select>`
  option)
- Modify: `src/inject-v64.js:6` (`HEAVY_SHADER`)
- Test: `test.js`

**Interfaces:** None — self-contained, single task.

- [ ] **Step 1: Re-confirm exact current text at every touch point**

```bash
grep -n '@BUILD-INJECT-V58' elastic-morph.html
grep -n '<option value="cosmicDrift">' elastic-morph.html
grep -n 'else                   col = cosmicDriftStyle(uv);' elastic-morph.html
grep -n 'const SHADER_STYLE_ID' elastic-morph.html
grep -n 'const HEAVY_SHADER' elastic-morph.html src/inject-v64.js
sed -n '3843,3849p' elastic-morph.html
```
The last command's output must end with (read the surrounding lines with `Read` if it doesn't
match exactly — don't guess):
```
  col += vec3(1.0) * star * (0.6 + uLoud*0.4);
  col = applyEyeCatcherFX(col, uv);
  return col;
}

void main(){
```

- [ ] **Step 2: Make all 5 source edits, in this order**

**A) New GLSL style function** (`elastic-morph.html`) — find:
```glsl
  col = applyEyeCatcherFX(col, uv);
  return col;
}

void main(){
```
*(unique — it's `cosmicDriftStyle`'s ending immediately followed by `main()`'s opening; confirmed
in Step 1)* replace:
```glsl
  col = applyEyeCatcherFX(col, uv);
  return col;
}
vec3 warpTunnelStyle(vec2 uv){
  vec3 col = vec3(0.0);
  float speed = 0.35 + uBass*0.5 + uBeat*0.3;
  for(int i=0;i<48;i++){
    float fi = float(i);
    float rnd = fract(sin(fi*12.9898)*43758.5453);
    float ang = (fi/48.0)*6.2831853 + rnd*0.15 + uTime*0.03;
    vec2 dir = vec2(cos(ang), sin(ang));
    float phase = fract(uTime*speed*(0.6+rnd*0.8) + rnd);
    float rNear = phase*phase*1.3;
    float rFar  = rNear + 0.05 + phase*0.25;
    float glow = segGlow(uv, dir*rNear, dir*rFar);
    float fade = smoothstep(0.0,0.08,phase) * smoothstep(1.0,0.75,phase);
    float hue = uHue + rnd*0.15 + uHighs*0.1;
    vec3 lineCol = uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) : hsv2rgb(vec3(fract(hue), 0.8, 1.0));
    col += lineCol * glow * fade * (0.6 + uLoud*0.7 + uBeat*0.5);
  }
  float shardA = uTime*0.25;
  mat2 Rs = mat2(cos(shardA),-sin(shardA),sin(shardA),cos(shardA));
  for(int s=0;s<3;s++){
    float fs = float(s);
    float sc = 0.35 + fs*0.18 + uMids*0.1;
    vec2 p0 = Rs*vec2(0.0, sc);
    vec2 p1 = Rs*vec2(sc*0.87, -sc*0.5);
    vec2 p2 = Rs*vec2(-sc*0.87, -sc*0.5);
    float sglow = segGlow(uv,p0,p1)+segGlow(uv,p1,p2)+segGlow(uv,p2,p0);
    col += vec3(0.7,0.85,1.0) * sglow * 0.12 * (0.5+uBeat*0.8);
  }
  col = applyEyeCatcherFX(col, uv);
  return col;
}

void main(){
```

**B) Dispatch chain** (`elastic-morph.html`) — find:
```glsl
  else                   col = cosmicDriftStyle(uv);
```
replace:
```glsl
  else if(uStyle < 15.5) col = cosmicDriftStyle(uv);
  else                   col = warpTunnelStyle(uv);
```

**C) `SHADER_STYLE_ID`** (`elastic-morph.html`) — find:
```js
const SHADER_STYLE_ID = { fluid:0, metaballs:1, tunnel:2, aurora:3, electric:4, chrome:5, gyroid:6, raymarch:7, feedback:8, strobe:9, warehouse:10, laser:11, portal:12, crystal:13, hypercube:14, cosmicDrift:15 };
```
replace:
```js
const SHADER_STYLE_ID = { fluid:0, metaballs:1, tunnel:2, aurora:3, electric:4, chrome:5, gyroid:6, raymarch:7, feedback:8, strobe:9, warehouse:10, laser:11, portal:12, crystal:13, hypercube:14, cosmicDrift:15, warpTunnel:16 };
```

**D) `<select id="shStyle">`** (`elastic-morph.html`) — find:
```html
      <option value="cosmicDrift">Style: Cosmic Drift</option>
    </select>
```
replace:
```html
      <option value="cosmicDrift">Style: Cosmic Drift</option>
      <option value="warpTunnel">Style: Warp Tunnel</option>
    </select>
```

**E) `HEAVY_SHADER`** (`src/inject-v64.js` — **not** `elastic-morph.html`) — find:
```js
const HEAVY_SHADER = new Set(["gyroid", "raymarch", "feedback", "crystal", "hypercube", "cosmicDrift"]);   // crystal: gyroid's structural twin (40-step march); hypercube: 32 unrolled segGlow + 16 projCube per pixel, comparable to feedback; cosmicDrift: measured ~2x gyroid's per-frame cost, the heaviest style in the app
```
replace:
```js
const HEAVY_SHADER = new Set(["gyroid", "raymarch", "feedback", "crystal", "hypercube", "cosmicDrift", "warpTunnel"]);   // crystal: gyroid's structural twin (40-step march); hypercube: 32 unrolled segGlow + 16 projCube per pixel, comparable to feedback; cosmicDrift: measured ~2x gyroid's per-frame cost, the heaviest style in the app; warpTunnel: ~57 segGlow evaluations (48 streaks + 9 shard edges), same cost class as hypercube, no raymarch
```

- [ ] **Step 3: Regenerate the HTML mirror and confirm it picked up the src/ edit**

```bash
node build.js
grep -n 'const HEAVY_SHADER' elastic-morph.html
```
Expected: `✓ Merged ...`, and the printed line contains `"warpTunnel"` — this confirms the
regenerated post-marker mirror now matches `src/inject-v64.js`, closing the exact gap that bit
both the Portal/Crystal/Hypercube round and the Cosmic Drift round.

Note for this step's test coverage: the existing generic tests "shader styles ≥ 9 defined",
"every shader style has an `<option>`", and the "no GLSL array syntax introduced" check (which
scans from `vec3 portalStyle` through the next `void main(){` — a boundary that will now include
`warpTunnelStyle` too, since it sits right before `void main(){`) all automatically re-validate
against this task's new code without any changes needed to them. Do not duplicate them.

- [ ] **Step 4: Write the tests**

Append to `test.js`, right before the `/* ---------------- summary ---------------- */` block:

```js
section("Shader Engine — Warp Tunnel");

ok("SHADER_STYLE_ID gained the warpTunnel entry with the correct uStyle value (16)", (() => {
  return /warpTunnel:\s*16/.test(script);
})());

["warpTunnelStyle"].forEach(fn =>
  ok("GLSL " + fn + " defined & called", (frag.split(fn).length - 1) >= 2));

ok("segGlow's total occurrence count rises well above hypercube's own 33 (1 definition + 32 call sites) baseline, confirming warpTunnelStyle's ~57 new segGlow calls (48 streaks + 9 shard edges) were actually added, not just referenced once", (() => {
  return (frag.split("segGlow").length - 1) >= 80;
})());

ok("main()'s dispatch chain: cosmicDrift's bare else became an explicit uStyle<15.5 branch, followed by warpTunnel as the new bare else", (() => {
  const mainIdx = frag.lastIndexOf("void main(){");
  if (mainIdx < 0) return false;
  const mainBody = frag.slice(mainIdx);
  const cosmicIdx = mainBody.indexOf("else if(uStyle < 15.5) col = cosmicDriftStyle(uv);");
  const warpIdx = mainBody.indexOf("else                   col = warpTunnelStyle(uv);");
  return cosmicIdx >= 0 && warpIdx > cosmicIdx;
})());

ok("#shStyle gained the new <option> after cosmicDrift", (() => {
  const selMatch = html.match(/<select id="shStyle"[^>]*>([\s\S]*?)<\/select>/);
  if (!selMatch) return false;
  const body = selMatch[1];
  const cosmicIdx = body.indexOf('value="cosmicDrift"');
  const warpIdx = body.indexOf('value="warpTunnel"');
  return cosmicIdx >= 0 && warpIdx > cosmicIdx;
})());

ok("src/inject-v64.js's HEAVY_SHADER Set literal includes warpTunnel — the actual source of truth (this file is regenerated into elastic-morph.html on every build; editing only the html mirror would be silently overwritten)", (() => {
  const src = injectSrc("inject-v64.js");
  const m = src.match(/const HEAVY_SHADER = new Set\(\[([^\]]*)\]\);/);
  return !!m && m[1].includes('"warpTunnel"');
})());

ok("the assembled elastic-morph.html mirror's HEAVY_SHADER matches src/inject-v64.js exactly, proving node build.js regeneration actually propagated the change", (() => {
  const m = script.match(/const HEAVY_SHADER = new Set\(\[([^\]]*)\]\);/);
  return !!m && m[1].includes('"warpTunnel"');
})());

ok("warpTunnel is deliberately NOT added to the 820px-resolution-cap style list (gyroid/crystal/cosmicDrift only) — it has no raymarch loop, matching hypercube's precedent", (() => {
  const m = script.match(/SH\.style === "gyroid" \|\| SH\.style === "crystal" \|\| SH\.style === "cosmicDrift"/);
  return !!m && !script.includes('SH.style === "warpTunnel"');
})());
```

- [ ] **Step 5: Run the tests and confirm the count**

```bash
node test.js
```
Expected: the new "Shader Engine — Warp Tunnel" section prints 8 lines with `✓`, and the final
summary line reads **`634 passed, 0 failed`** (626 baseline + 8 new). If it doesn't say exactly
that, stop and fix — do not adjust the expected number to match a wrong result.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html src/inject-v64.js test.js
git commit -m "feat(shader): add Warp Tunnel style — 48 radial streaks + 3 crystal-shard glints"
```

---

## After the Task: Live Verification + Push

Not a subagent task — the controller does this directly:

1. Local dev server (verify served content freshness before trusting it — see
   `project_morph_second_local_checkout.md` memory; go straight to a manually-started `npx serve`
   from a `lsof`-confirmed correct `cwd`).
2. Select "Warp Tunnel" from the Shader style dropdown. Confirm `GL.ok === true` (shader compiles
   and links) by reading it back in the browser BEFORE any pixel-sampling — this session's
   established discipline for anything touching the Shader Engine. Confirm the streaks radiate
   continuously without popping/resetting, the 3 shard glints are visible and rotate, speed
   responds to forced `S.bass`/`S.beat`, brightness responds to forced `S.loudness`.
3. `git push` (`dangerouslyDisableSandbox: true`).
4. Poll `https://elasticmorph.app/elastic-morph.html`, SHA-256 hash against the local file, until
   they match. Additionally confirm `GL.ok === true` on the live site too, not just local — same
   "confirm on both, before pixel-sampling" discipline used for every prior Shader Engine round
   this session.
5. Update project memory once hash-confirmed.
