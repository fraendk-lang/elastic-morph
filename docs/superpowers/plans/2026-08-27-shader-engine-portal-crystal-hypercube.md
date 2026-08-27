# Shader Engine — Portal Depth, Crystal Prism, Hypercube Drift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 new Shader Engine GLSL styles — Portal Depth, Crystal Prism, Hypercube Drift — to the existing 12-style WebGL system.

**Architecture:** All 3 styles are new GLSL functions (`xxxStyle(vec2 uv) -> vec3`) added to the single embedded fragment-shader source string, dispatched via the existing `uStyle` uniform / `SHADER_STYLE_ID` map / `<select id="shStyle">` mechanism every existing style already uses — the exact same 4-touch-point pattern the v33 round (4 styles) already proved out.

**Tech Stack:** WebGL1 (GLSL ES 1.00) fragment shader, vanilla JS.

## Global Constraints

- Every edit lands in `elastic-morph.html` before the `@BUILD-INJECT-V58` marker (currently line 10231 — verify fresh with `grep -n "@BUILD-INJECT-V58" elastic-morph.html`).
- After every code change, run `npm run ci` and confirm `git diff --stat elastic-morph.html` is empty.
- **This round's single biggest risk, different in kind from every prior Alpha-Milestone round:** a malformed GLSL function can fail the ENTIRE shader program's compile/link step. Per `initGL()` (`elastic-morph.html:3698-3742`), a failed fragment-shader compile (`glCompile` returns `null`) or link makes `initGL()` set `GL.ok = false` and return `false` — this doesn't crash the app, but it silently disables the ENTIRE Shader Engine (all 15 styles, not just the 3 new ones), with only a `console.warn("shader compile: ...")` or `console.warn("shader link: ...")` as any trace. `npm run ci` CANNOT catch this class of bug — there is no WebGL context in Node, so nothing in this codebase's test suite compiles GLSL. Live-verification (Task 2) is the only thing that can, and it must check that the whole program still compiles AND that every one of the 12 pre-existing styles still renders correctly — not just the 3 new ones.
- No GLSL arrays anywhere in the new code (WebGL1/GLSL ES 1.00 array-constructor/dynamic-indexing support is inconsistent across older drivers, and none of the 12 existing styles use one) — Hypercube Drift's 16 cube vertices are 16 individually-named `vec2` locals, its 32 edges/struts are 32 explicit one-line calls, not a loop over an array.
- Every new style calls `applyEyeCatcherFX(col, uv)` at the end and respects the palette system (`uPalOn > 0.5 ? mix(uPalA, uPalB, mixT) : <hsv2rgb or hardcoded-color fallback>`), matching the established convention.
- `git fetch`/`git push` require the Bash tool's `dangerouslyDisableSandbox: true` flag in this environment, or they hang indefinitely.

---

### Task 1: Three new GLSL styles + wiring

**Files:**
- Modify: `elastic-morph.html` (3 new style functions + 2 helpers, added after the existing `laserStyle` function — verify current line with `grep -n "vec3 laserStyle" elastic-morph.html`)
- Modify: `elastic-morph.html` (`main()`'s dispatch chain — verify current line with `grep -n "void main(){" elastic-morph.html`, the second match, inside the fragment shader)
- Modify: `elastic-morph.html` (`SHADER_STYLE_ID` — verify current line with `grep -n "const SHADER_STYLE_ID" elastic-morph.html`)
- Modify: `elastic-morph.html` (`<select id="shStyle">` — verify current line with `grep -n 'id="shStyle"' elastic-morph.html`)
- Test: `test.js` (including one REQUIRED update to a pre-existing test — see Step 1 below, this is not optional)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: 3 working GLSL functions (`portalStyle`, `crystalStyle`, `hypercubeStyle`) reachable via `uStyle` values 12/13/14, `SHADER_STYLE_ID` entries `portal:12, crystal:13, hypercube:14`, and 3 new `<option>`s. Task 2 (live verification) depends on all of this being wired correctly and compiling.

- [ ] **Step 1: Write the failing tests, INCLUDING one required update to an existing test**

**Read this carefully before writing anything — one pre-existing test at `test.js` will silently break unless you update it, and this step is not optional.** Find it: `grep -n "every shader style has an <option>" test.js`, then read ~10 lines above it (`grep -n "const styleOpts" test.js`). Its current exact code is:

```js
const styleIds = (() => { const m = script.match(/SHADER_STYLE_ID = \{([^}]+)\}/); return m ? [...m[1].matchAll(/(\w+):/g)].map(x => x[1]) : []; })();
const styleOpts = [...html.matchAll(/<option value="(fluid|metaballs|tunnel|aurora|electric|chrome|gyroid|raymarch|feedback|strobe|warehouse|laser)"/g)].map(m => m[1]);
ok("shader styles ≥ 9 defined", styleIds.length >= 9, styleIds.join(","));
ok("every shader style has an <option>", styleIds.every(s => styleOpts.includes(s)), styleIds.filter(s => !styleOpts.includes(s)).join(","));
```

`styleIds` is derived generically from `SHADER_STYLE_ID` — it will automatically include `portal`/`crystal`/`hypercube` once you add them in Step 3, with zero test-file change needed for that part. But `styleOpts` is extracted via a regex with the 12 existing style names HARDCODED into an alternation (`fluid|metaballs|...|laser`) — it will NEVER match your 3 new `<option>` elements no matter what you do to the HTML, because the literal strings `portal`/`crystal`/`hypercube` don't appear in that regex. Left as-is, the very next line's `styleIds.every(s => styleOpts.includes(s))` check would go from passing to failing the moment you add the 3 new `SHADER_STYLE_ID` entries in Step 3 — and that failure would print as if 3 styles are simply missing their `<option>`, when the real issue is this test's own regex. **Replace the `styleOpts` line** with:

```js
const styleOpts = [...html.matchAll(/<option value="(fluid|metaballs|tunnel|aurora|electric|chrome|gyroid|raymarch|feedback|strobe|warehouse|laser|portal|crystal|hypercube)"/g)].map(m => m[1]);
```

(Only that one line changes — the `styleIds` line, and both `ok(...)` lines below it, stay exactly as they are.)

Now add this new section to `test.js`, right after the line `["auroraStyle", "electricStyle", "chromeStyle", "gyroidStyle", "raymarchStyle", "feedbackStyle", "strobeStyle", "warehouseStyle", "laserStyle"].forEach(fn => ok("GLSL " + fn + " defined & called", (frag.split(fn).length - 1) >= 2));`:

```js
/* ---------------- Shader Engine: Portal Depth, Crystal Prism, Hypercube Drift ---------------- */
section("Shader Engine — Portal Depth, Crystal Prism, Hypercube Drift");

ok("SHADER_STYLE_ID gained the 3 new entries with the correct uStyle values (12/13/14)", (() => {
  return /portal:\s*12/.test(script) && /crystal:\s*13/.test(script) && /hypercube:\s*14/.test(script);
})());

["portalStyle", "crystalStyle", "hypercubeStyle", "segGlow", "projCube"].forEach(fn =>
  ok("GLSL " + fn + " defined & called", (frag.split(fn).length - 1) >= 2));

ok("main()'s dispatch chain: laser's bare else became an explicit uStyle<11.5 branch, followed by portal/crystal/hypercube in order, ending in a bare else for hypercube", (() => {
  const mainIdx = frag.lastIndexOf("void main(){");
  if (mainIdx < 0) return false;
  const mainBody = frag.slice(mainIdx);
  const laserIdx = mainBody.indexOf("else if(uStyle < 11.5) col = laserStyle(uv*1.2);");
  const portalIdx = mainBody.indexOf("else if(uStyle < 12.5) col = portalStyle(uv);");
  const crystalIdx = mainBody.indexOf("else if(uStyle < 13.5) col = crystalStyle(uv);");
  const hypercubeIdx = mainBody.indexOf("else                   col = hypercubeStyle(uv);");
  return laserIdx >= 0 && portalIdx > laserIdx && crystalIdx > portalIdx && hypercubeIdx > crystalIdx;
})());

ok("#shStyle gained the 3 new <option> elements in order after laser", (() => {
  const selMatch = html.match(/<select id="shStyle"[^>]*>([\s\S]*?)<\/select>/);
  if (!selMatch) return false;
  const body = selMatch[1];
  const laserIdx = body.indexOf('value="laser"');
  const portalIdx = body.indexOf('value="portal"');
  const crystalIdx = body.indexOf('value="crystal"');
  const hypercubeIdx = body.indexOf('value="hypercube"');
  return laserIdx >= 0 && portalIdx > laserIdx && crystalIdx > portalIdx && hypercubeIdx > crystalIdx;
})());

ok("no GLSL array syntax introduced (WebGL1/GLSL ES 1.00 array-constructor risk avoided per design)", (() => {
  const s3 = frag.indexOf("vec3 portalStyle");
  const eIdx = frag.indexOf("void main(){", s3);
  const newStylesSrc = s3 >= 0 && eIdx > s3 ? frag.slice(s3, eIdx) : "";
  return newStylesSrc.length > 0 && !newStylesSrc.includes("[8]") && !newStylesSrc.includes("[24]") && !/vec[234]\s*\[/.test(newStylesSrc);
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "Portal Depth, Crystal Prism, Hypercube Drift\|SHADER_STYLE_ID gained\|dispatch chain: laser\|gained the 3 new <option>\|no GLSL array syntax"`
Expected: every new assertion prints `✗`. Also run `node test.js 2>&1 | grep -A1 "every shader style has an"` — this should still print `✓` at this point (the regex fix from Step 1 doesn't depend on the new styles existing yet, only on the updated alternation pattern, which correctly still matches all 12 pre-existing options).

- [ ] **Step 3: Write the implementation**

Confirm current line numbers first (they may have drifted): `grep -n "vec3 laserStyle" elastic-morph.html`, then read ~20 lines from there to confirm `laserStyle`'s exact current body, and `grep -n "void main(){" elastic-morph.html` (the SECOND match — the first is the vertex shader's trivial `main()`) to confirm the dispatch chain's exact current text.

**3a.** Add these 5 GLSL functions directly after the existing `laserStyle` function's closing `}`, before `void main(){`:

```glsl
vec3 portalStyle(vec2 uv){
  vec3 col = vec3(0.0);
  float rad = length(uv), ang = atan(uv.y, uv.x);
  for(int i=0;i<7;i++){
    float fi = float(i);
    float speed = 0.15 + fi*0.03 + uBass*0.1;
    float z = fract(uTime*speed + fi*0.143);
    float ringR = z*z*1.6 + 0.02;
    float ringW = 0.01 + z*0.03;
    float ring = smoothstep(ringW, 0.0, abs(rad - ringR));
    float fade = smoothstep(0.0, 0.15, z) * smoothstep(1.0, 0.7, z);
    float spokes = 0.6 + 0.4*sin(ang*6.0 + fi*2.1 + uTime*0.4 + uBeat*2.0);
    float glow = ring * fade * spokes * (0.6 + uBeat*0.8 + uLoud*0.5);
    float hue = uHue + fi*0.12 + z*0.25 + uHighs*0.08;
    vec3 layerCol = uPalOn > 0.5 ? mix(uPalA, uPalB, fract(hue)) : hsv2rgb(vec3(fract(hue), 0.75, 1.0));
    col += layerCol * glow;
  }
  col = applyEyeCatcherFX(col, uv);
  return col;
}
float crystalDist(vec3 p){
  float d = max(abs(p.x), max(abs(p.y), abs(p.z)));
  d = max(d, dot(abs(p), normalize(vec3(1.0,1.0,1.0))));
  d = max(d, dot(abs(p), normalize(vec3(1.0,-1.0,1.0))));
  return d;
}
vec3 crystalStyle(vec2 uv){
  vec3 crystA = vec3(0.9, 0.15, 0.95);
  vec3 crystB = vec3(0.1, 0.85, 0.9);
  vec3 ro = vec3(0.0, 0.0, -3.0);
  vec3 rd = normalize(vec3(uv, 1.6));
  float a = uTime*0.18 + uBass*0.25;
  mat2 R = mat2(cos(a),-sin(a),sin(a),cos(a));
  float scale = 1.1 + uMids*0.5;
  float glow = 0.0, t = 0.0, band = 0.0;
  for(int i=0;i<40;i++){
    vec3 p = ro + rd*t;
    p.xz = R*p.xz;
    float d = crystalDist(p*scale)/scale - 0.85;
    float shell = exp(-abs(d)*20.0);
    glow += shell * exp(-t*0.18) * (0.85 + uBeat*0.8);
    band += shell * (p.x*0.4 + p.y*0.3 + p.z*0.3);
    t += 0.15;
  }
  glow *= 0.09;
  float mixT = fract(uHue + band*0.05 + uHighs*0.1);
  float v = glow * (0.7 + uIntensity*0.6) * (0.7 + uLoud*0.6);
  vec3 col = mix(uPalOn > 0.5 ? uPalA : crystA, uPalOn > 0.5 ? uPalB : crystB, mixT) * v;
  col += mix(uPalOn > 0.5 ? uPalB : crystB, uPalOn > 0.5 ? uPalA : crystA, mixT) * (pow(glow, 3.0)*0.6);
  col = applyEyeCatcherFX(col, uv);
  return col;
}
float segGlow(vec2 uv, vec2 a, vec2 b){
  vec2 pa = uv - a, ba = b - a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return 0.008 / (length(pa - ba*h) + 0.006);
}
vec2 projCube(vec3 v, mat2 R, float persp){
  vec3 p = v; p.xz = R*p.xz;
  return p.xy * (persp/(persp + p.z));
}
vec3 hypercubeStyle(vec2 uv){
  float aOuter = uTime*0.22 + uBass*0.3;
  float aInner = uTime*-0.31 + uMids*0.4;
  mat2 Ro = mat2(cos(aOuter),-sin(aOuter),sin(aOuter),cos(aOuter));
  mat2 Ri = mat2(cos(aInner),-sin(aInner),sin(aInner),cos(aInner));
  float innerScale = 0.4 + 0.15*sin(uTime*0.5 + uBeat*2.0);
  float persp = 2.6;
  vec2 o0 = projCube(vec3(-1.0,-1.0,-1.0), Ro, persp), o1 = projCube(vec3(1.0,-1.0,-1.0), Ro, persp);
  vec2 o2 = projCube(vec3(1.0,1.0,-1.0), Ro, persp),  o3 = projCube(vec3(-1.0,1.0,-1.0), Ro, persp);
  vec2 o4 = projCube(vec3(-1.0,-1.0,1.0), Ro, persp), o5 = projCube(vec3(1.0,-1.0,1.0), Ro, persp);
  vec2 o6 = projCube(vec3(1.0,1.0,1.0), Ro, persp),   o7 = projCube(vec3(-1.0,1.0,1.0), Ro, persp);
  vec2 i0 = projCube(vec3(-1.0,-1.0,-1.0)*innerScale, Ri, persp), i1 = projCube(vec3(1.0,-1.0,-1.0)*innerScale, Ri, persp);
  vec2 i2 = projCube(vec3(1.0,1.0,-1.0)*innerScale, Ri, persp),  i3 = projCube(vec3(-1.0,1.0,-1.0)*innerScale, Ri, persp);
  vec2 i4 = projCube(vec3(-1.0,-1.0,1.0)*innerScale, Ri, persp), i5 = projCube(vec3(1.0,-1.0,1.0)*innerScale, Ri, persp);
  vec2 i6 = projCube(vec3(1.0,1.0,1.0)*innerScale, Ri, persp),   i7 = projCube(vec3(-1.0,1.0,1.0)*innerScale, Ri, persp);
  float glow = 0.0;
  glow += segGlow(uv,o0,o1)+segGlow(uv,o1,o2)+segGlow(uv,o2,o3)+segGlow(uv,o3,o0);
  glow += segGlow(uv,o4,o5)+segGlow(uv,o5,o6)+segGlow(uv,o6,o7)+segGlow(uv,o7,o4);
  glow += segGlow(uv,o0,o4)+segGlow(uv,o1,o5)+segGlow(uv,o2,o6)+segGlow(uv,o3,o7);
  glow += segGlow(uv,i0,i1)+segGlow(uv,i1,i2)+segGlow(uv,i2,i3)+segGlow(uv,i3,i0);
  glow += segGlow(uv,i4,i5)+segGlow(uv,i5,i6)+segGlow(uv,i6,i7)+segGlow(uv,i7,i4);
  glow += segGlow(uv,i0,i4)+segGlow(uv,i1,i5)+segGlow(uv,i2,i6)+segGlow(uv,i3,i7);
  glow += (segGlow(uv,o0,i0)+segGlow(uv,o1,i1)+segGlow(uv,o2,i2)+segGlow(uv,o3,i3)
         + segGlow(uv,o4,i4)+segGlow(uv,o5,i5)+segGlow(uv,o6,i6)+segGlow(uv,o7,i7)) * 0.7;
  glow *= (0.5 + uLoud*0.5 + uBeat*0.6);
  float mixT = fract(uHue + glow*0.03 + uHighs*0.1);
  vec3 col = (uPalOn > 0.5 ? mix(uPalA, uPalB, mixT) : hsv2rgb(vec3(mixT, 0.75, 1.0))) * glow;
  col = applyEyeCatcherFX(col, uv);
  return col;
}
```

**3b.** In `main()`'s dispatch chain, the current final branch is a bare `else` for `laser`:
```glsl
  else if(uStyle < 10.5) col = warehouseStyle(uv*1.2);
  else                  col = laserStyle(uv*1.2);
```
Change it to:
```glsl
  else if(uStyle < 10.5) col = warehouseStyle(uv*1.2);
  else if(uStyle < 11.5) col = laserStyle(uv*1.2);
  else if(uStyle < 12.5) col = portalStyle(uv);
  else if(uStyle < 13.5) col = crystalStyle(uv);
  else                   col = hypercubeStyle(uv);
```

**3c.** `SHADER_STYLE_ID` — currently:
```js
const SHADER_STYLE_ID = { fluid:0, metaballs:1, tunnel:2, aurora:3, electric:4, chrome:5, gyroid:6, raymarch:7, feedback:8, strobe:9, warehouse:10, laser:11 };
```
Change to:
```js
const SHADER_STYLE_ID = { fluid:0, metaballs:1, tunnel:2, aurora:3, electric:4, chrome:5, gyroid:6, raymarch:7, feedback:8, strobe:9, warehouse:10, laser:11, portal:12, crystal:13, hypercube:14 };
```

**3d.** `<select id="shStyle">` — currently ends with:
```html
      <option value="laser">Style: Laser Fans</option>
    </select>
```
Change to:
```html
      <option value="laser">Style: Laser Fans</option>
      <option value="portal">Style: Portal Depth</option>
      <option value="crystal">Style: Crystal Prism</option>
      <option value="hypercube">Style: Hypercube Drift</option>
    </select>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "Portal Depth, Crystal Prism, Hypercube Drift\|SHADER_STYLE_ID gained\|dispatch chain: laser\|gained the 3 new <option>\|no GLSL array syntax\|every shader style has an\|GLSL braces"`
Expected: every assertion prints `✓`, INCLUDING `"GLSL braces & parens balanced"` (a pre-existing test — this is your first real signal on whether the new GLSL is even lexically well-formed; the true compile check still requires the live browser in Task 2, but this catches gross brace/paren mismatches immediately).

- [ ] **Step 5: Run the full suite and check for build drift**

Run: `npm run ci` — expect all tests passing, 0 failed, `git diff --stat elastic-morph.html` empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Portal Depth, Crystal Prism, and Hypercube Drift shader styles"
```

---

### Task 2: Live verification and push

**Files:** none (no code changes — verification only).

**Interfaces:**
- Consumes: the fully-wired feature from Task 1.
- Produces: nothing — terminal task.

**This task's first check is the most important one in the whole round.** `npm run ci` cannot compile GLSL — there is no WebGL context in Node — so nothing before this point has confirmed the shader program actually compiles and links. A single malformed character in Task 1's GLSL can silently disable the ENTIRE Shader Engine (all 15 styles), not just the 3 new ones, per the Global Constraints section above.

- [ ] **Step 1: Start the dev server and open it in a browser**

The project's own `.claude/launch.json`-driven preview tool has intermittently served stale content from a wrong working directory in this environment (see project memory `project_morph_hq_export_frame_accuracy.md`). Prefer running the server directly:

```bash
npx --yes serve -l 3463 "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
```

Then open `http://localhost:3463/elastic-morph` in the browser tool and confirm via
`curl -s http://localhost:3463/elastic-morph | grep -c "hypercubeStyle"` returns `1`+ before trusting anything rendered in the tab.

- [ ] **Step 2: Confirm the whole shader program compiles**

In the browser console (`javascript_tool`):
```js
if (typeof loadDemoTrack === 'function') { await loadDemoTrack({}); }
S.shader.on = true; $("shOn").checked = true;
if (typeof initGL === 'function') initGL();
({ glOk: typeof GL !== 'undefined' ? GL.ok : 'GL not found' })
```
Expected: `glOk: true`. If it's `false`, check `read_console_messages` for a `"shader compile:"` or `"shader link:"` message — that is a hard stop. Read the GLSL you wrote in Task 1 character-by-character against the plan's exact code, fix the mismatch, reload, and retry this step before doing anything else in this task. Do NOT proceed to Step 3 until `GL.ok === true`.

- [ ] **Step 3: Confirm all 12 PRE-EXISTING styles still render correctly**

This is the headline check for this round. For each of `fluid, metaballs, tunnel, aurora, electric, chrome, gyroid, raymarch, feedback, strobe, warehouse, laser`: set `S.shader.style = "<id>"; $("shStyle").value = "<id>";`, wait ~1s, screenshot, and visually confirm it looks the same character as before this round (colorful/animated/non-black, matching what each style's name implies — you don't need pixel-perfect comparison, just confirm nothing looks broken/black/frozen). Check console for errors after each. If any pre-existing style now looks wrong, this is a Task 1 regression (most likely an off-by-one in the `main()` dispatch chain's `uStyle < N.5` thresholds) — stop and fix it before continuing.

- [ ] **Step 4: Confirm all 3 NEW styles render distinct, non-black, audio-reactive content**

For each of `portal, crystal, hypercube`: set the style, wait ~1s, screenshot, and confirm:
- **portal**: glowing rings appear to fly outward from center, colorful, motion visible frame-to-frame.
- **crystal**: a rotating glowing faceted/crystalline shape with color banding, not a flat blob.
- **hypercube**: a cube-in-cube wireframe with visible connecting struts, both cubes independently rotating.

Check console for errors after each. Also toggle `S.palette.on` off/on (or however the app's palette toggle is exposed in the UI you're testing through) and confirm each new style still looks reasonable both ways.

- [ ] **Step 5: Confirm the arrow-key style-cycle reaches all 3 new styles**

```js
({ cycles: typeof cycleShaderStyle === 'function', ids: Object.keys(SHADER_STYLE_ID) })
```
Expect `ids` to include `portal`, `crystal`, `hypercube` (15 total). Call `cycleShaderStyle(1)` repeatedly (or drive it via the actual arrow-key UI path if easier) and confirm `S.shader.style` eventually visits all 3 new values without error.

- [ ] **Step 6: Check console for errors, then clean up and push**

```bash
pkill -f "serve -l 3463"
```
```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
npm run ci
git status --short
git push origin main
```
(Use the Bash tool's `dangerouslyDisableSandbox: true` for the push, per the Global Constraints above.)

- [ ] **Step 7: Confirm live via hash match**

```bash
shasum -a 256 elastic-morph.html
curl -s https://elasticmorph.app/elastic-morph.html | shasum -a 256
```
Wait for the Vercel deploy to complete (30-60s is typical) before the second command if the hashes don't match on the first try.
